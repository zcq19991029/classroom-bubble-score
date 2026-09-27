const assets = __ASSETS__;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const SESSION_COOKIE = "d1_sid";
const SESSION_DAYS = 30;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

function json(value, init = {}) {
  return new Response(JSON.stringify(value), {
    ...init,
    headers: { ...JSON_HEADERS, ...(init.headers || {}) },
  });
}

function text(value, status = 200, headers = {}) {
  return new Response(value, { status, headers });
}

function parseCookies(request) {
  const raw = request.headers.get("cookie") || "";
  return Object.fromEntries(raw.split(";").map((part) => {
    const i = part.indexOf("=");
    return i > 0 ? [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1).trim())] : [];
  }).filter((entry) => entry.length));
}

function cookieHeader(token, maxAge = SESSION_DAYS * 86400) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function randomSalt() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
}

async function digestHex(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function derivePassword(password, salt) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64ToBytes(salt), iterations: 120000, hash: "SHA-256" }, material, 256);
  return bytesToBase64(new Uint8Array(bits));
}

async function passwordMatches(password, salt, expected) {
  return (await derivePassword(password, salt)) === expected;
}

async function supabaseVerify(email, password, env) {
  const url = String(env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = String(env.SUPABASE_ANON_KEY || "");
  if (!url || !key) return { ok: false, reason: "Supabase 兼容登录尚未配置" };
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return { ok: false, reason: "旧账号或密码不正确" };
  const body = await response.json();
  return { ok: true, user: body.user || {} };
}

async function findTeacher(db, { email, employeeNo }) {
  if (email) {
    const row = await db.prepare("SELECT * FROM teachers WHERE lower(email)=lower(?) LIMIT 1").bind(email).first();
    if (row) return row;
  }
  if (employeeNo) return db.prepare("SELECT * FROM teachers WHERE employee_no=? LIMIT 1").bind(employeeNo).first();
  return null;
}

async function createSession(db, teacherId) {
  const token = crypto.randomUUID();
  const tokenHash = await digestHex(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString();
  await db.prepare("INSERT INTO sessions(token_hash,teacher_id,expires_at,created_at) VALUES(?,?,?,?)")
    .bind(tokenHash, teacherId, expires, now.toISOString()).run();
  return { token, expires };
}

function publicTeacher(row) {
  return { id: row.id, employeeNo: row.employee_no, email: row.email, displayName: row.display_name, isAdmin: Boolean(row.is_admin) };
}

async function sessionTeacher(request, db) {
  const token = parseCookies(request)[SESSION_COOKIE];
  if (!token) return null;
  const hash = await digestHex(token);
  const row = await db.prepare("SELECT t.*, s.expires_at FROM sessions s JOIN teachers t ON t.id=s.teacher_id WHERE s.token_hash=? LIMIT 1").bind(hash).first();
  if (!row) return null;
  if (Date.parse(row.expires_at) <= Date.now()) {
    await db.prepare("DELETE FROM sessions WHERE token_hash=?").bind(hash).run();
    return null;
  }
  return row;
}

function safePayload(value) {
  if (!value || typeof value !== "object") return null;
  const classes = value.classes && typeof value.classes === "object" ? value.classes : {};
  const names = Object.keys(classes);
  if (!names.length || names.length > 100) return null;
  let students = 0;
  let logs = 0;
  for (const item of Object.values(classes)) {
    if (!item || !Array.isArray(item.students)) return null;
    students += item.students.length;
    logs += Array.isArray(item.logs) ? item.logs.length : 0;
  }
  if (students > 10000 || logs > 200000) return null;
  return { ...value, version: Number(value.version || 2), classes };
}

async function bootstrapTeacher(db, input, env) {
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const employeeNo = String(input.employeeNo || "").trim() || null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6) return { error: "请提供有效邮箱和至少6位密码", status: 400 };
  let teacher = await findTeacher(db, { email, employeeNo });
  let needsMigration = false;
  if (!teacher) {
    const old = await supabaseVerify(email, password, env);
    if (!old.ok) return { error: old.reason, status: 401 };
    const salt = randomSalt();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const meta = old.user?.user_metadata || {};
    const resolvedEmployee = employeeNo || String(meta.employee_no || "").trim() || null;
    const displayName = String(input.displayName || meta.display_name || meta.full_name || "教师").trim().slice(0, 80) || "教师";
    await db.prepare("INSERT INTO teachers(id,employee_no,email,display_name,password_hash,password_salt,is_admin,created_at,updated_at) VALUES(?,?,?,?,?,?,0,?,?)")
      .bind(id, resolvedEmployee, email, displayName, await derivePassword(password, salt), salt, now, now).run();
    teacher = await findTeacher(db, { email });
    needsMigration = true;
  } else if (!(await passwordMatches(password, teacher.password_salt, teacher.password_hash))) {
    return { error: "账号或密码不正确", status: 401 };
  }
  const session = await createSession(db, teacher.id);
  return { teacher, session, needsMigration };
}

async function handleApi(request, env) {
  if (!env.DB) return json({ error: "Sites D1 绑定 DB 不可用" }, { status: 503 });
  const db = env.DB;
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (request.method === "GET" && pathname === "/api/health") {
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('teachers','sessions','workspaces','migration_audit') ORDER BY name").all();
    return json({ ok: true, database: "DB", tables: tables.results || [] });
  }
  if (pathname === "/api/auth/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await bootstrapTeacher(db, body, env);
    if (result.error) return json({ error: result.error }, { status: result.status });
    return json({ ok: true, teacher: publicTeacher(result.teacher), needsMigration: result.needsMigration }, { headers: { "set-cookie": cookieHeader(result.session.token) } });
  }
  if (pathname === "/api/auth/session" && request.method === "GET") {
    const teacher = await sessionTeacher(request, db);
    return teacher ? json({ ok: true, teacher: publicTeacher(teacher) }) : json({ ok: false }, { status: 401 });
  }
  if (pathname === "/api/auth/logout" && request.method === "POST") {
    const token = parseCookies(request)[SESSION_COOKIE];
    if (token) await db.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digestHex(token)).run();
    return json({ ok: true }, { headers: { "set-cookie": cookieHeader("", 0) } });
  }
  if (pathname === "/api/migrate" && request.method === "POST") {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return json({ error: "备份数据过大，未写入" }, { status: 413 });
    const body = JSON.parse(raw);
    const payload = safePayload(body.payload);
    if (!payload) return json({ error: "备份结构不完整，未写入" }, { status: 400 });
    const boot = await bootstrapTeacher(db, body, env);
    if (boot.error) return json({ error: boot.error }, { status: boot.status });
    const teacher = boot.teacher;
    const existing = await db.prepare("SELECT teacher_id FROM workspaces WHERE teacher_id=? LIMIT 1").bind(teacher.id).first();
    if (existing && !body.overwrite) return json({ error: "该教师已有 Sites 数据。为防止覆盖，请先导出备份并明确 overwrite=true", teacher: publicTeacher(teacher) }, { status: 409 });
    const now = new Date().toISOString();
    const payloadJson = JSON.stringify(payload);
    const payloadHash = await digestHex(payloadJson);
    await db.prepare("INSERT INTO workspaces(teacher_id,payload_json,payload_version,source,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(teacher_id) DO UPDATE SET payload_json=excluded.payload_json,payload_version=excluded.payload_version,source=excluded.source,updated_at=excluded.updated_at")
      .bind(teacher.id, payloadJson, Number(payload.version || 2), "supabase-backup-import", now).run();
    const classes = Object.values(payload.classes || {});
    const studentCount = classes.reduce((sum, item) => sum + (Array.isArray(item.students) ? item.students.length : 0), 0);
    const logCount = classes.reduce((sum, item) => sum + (Array.isArray(item.logs) ? item.logs.length : 0), 0);
    await db.prepare("INSERT INTO migration_audit(id,teacher_id,source,classes_count,students_count,logs_count,payload_sha256,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .bind(crypto.randomUUID(), teacher.id, "supabase-backup-import", classes.length, studentCount, logCount, payloadHash, now).run();
    return json({ ok: true, teacher: publicTeacher(teacher), classes: classes.length, students: studentCount, logs: logCount, payloadSha256: payloadHash, needsMigration: boot.needsMigration }, { headers: { "set-cookie": cookieHeader(boot.session.token) } });
  }
  const teacher = await sessionTeacher(request, db);
  if (!teacher) return json({ error: "请先登录 Sites 教师账号" }, { status: 401 });
  if (pathname === "/api/workspace" && request.method === "GET") {
    const row = await db.prepare("SELECT payload_json,updated_at,source FROM workspaces WHERE teacher_id=? LIMIT 1").bind(teacher.id).first();
    if (!row) return json({ ok: true, payload: null });
    return json({ ok: true, payload: JSON.parse(row.payload_json), updatedAt: row.updated_at, source: row.source });
  }
  if (pathname === "/api/workspace" && request.method === "PUT") {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_PAYLOAD_BYTES) return json({ error: "数据过大，未写入" }, { status: 413 });
    const body = JSON.parse(raw);
    const payload = safePayload(body.payload);
    if (!payload) return json({ error: "数据结构不完整，未写入" }, { status: 400 });
    const now = new Date().toISOString();
    await db.prepare("INSERT INTO workspaces(teacher_id,payload_json,payload_version,source,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(teacher_id) DO UPDATE SET payload_json=excluded.payload_json,payload_version=excluded.payload_version,source='sites-d1',updated_at=excluded.updated_at")
      .bind(teacher.id, JSON.stringify(payload), Number(payload.version || 2), "sites-d1", now).run();
    return json({ ok: true, updatedAt: now });
  }
  return json({ error: "Not found" }, { status: 404 });
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export default {
  async fetch(request, env, ctx) {
    void ctx;
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      try { return await handleApi(request, env); }
      catch (error) { console.error("api failure", error); return json({ error: "服务器处理失败，数据未写入" }, { status: 500 }); }
    }
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return text("Bad request", 400); }
    if (pathname === "/") pathname = "/index.html";
    const asset = assets[pathname];
    if (!asset) return text("Not found", 404);
    return new Response(decodeBase64(asset.body), { headers: { "content-type": asset.type, "cache-control": "no-cache" } });
  },
};
