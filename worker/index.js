const assets = __ASSETS__;

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};
const SESSION_COOKIE = "d1_sid";
const SESSION_DAYS = 30;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;
const OWNER_EMAIL = "2546605157@qq.com";

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
  // Cloudflare Workers currently accepts PBKDF2 iteration counts up to 100000.
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64ToBytes(salt), iterations: 100000, hash: "SHA-256" }, material, 256);
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

async function ensureInviteTable(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS invite_codes (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL UNIQUE,
    created_by TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    used_at TEXT
  )`).run();
  try { await db.prepare("ALTER TABLE teachers ADD COLUMN avatar_text TEXT NOT NULL DEFAULT ''").run(); } catch (_) {}
  await db.prepare("UPDATE teachers SET is_admin=1 WHERE lower(email)=lower(?)").bind(OWNER_EMAIL).run();
}

function inviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

async function createInvite(db, teacherId) {
  await ensureInviteTable(db);
  const code = inviteCode();
  const now = new Date();
  const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  await db.prepare("INSERT INTO invite_codes(id,code_hash,created_by,expires_at,max_uses,uses,created_at) VALUES(?,?,?,?,1,0,?)")
    .bind(crypto.randomUUID(), await digestHex(code), teacherId, expires, now.toISOString()).run();
  return { code, expiresAt: expires };
}

async function registerWithInvite(db, input) {
  await ensureInviteTable(db);
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const employeeNo = String(input.employeeNo || "").trim() || null;
  const displayName = String(input.displayName || "教师").trim().slice(0, 80) || "教师";
  const code = String(input.inviteCode || "").trim().toUpperCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || !code) return { error: "请填写有效邮箱、至少6位密码和邀请码", status: 400 };
  if (await findTeacher(db, { email, employeeNo })) return { error: "邮箱或工号已注册", status: 409 };
  const row = await db.prepare("SELECT * FROM invite_codes WHERE code_hash=? AND uses < max_uses AND expires_at>? LIMIT 1").bind(await digestHex(code), new Date().toISOString()).first();
  if (!row) return { error: "邀请码无效、已使用或已过期", status: 400 };
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const salt = randomSalt();
  await db.prepare("INSERT INTO teachers(id,employee_no,email,display_name,password_hash,password_salt,is_admin,created_at,updated_at) VALUES(?,?,?,?,?,?,0,?,?)")
    .bind(id, employeeNo, email, displayName, await derivePassword(password, salt), salt, now, now).run();
  await db.prepare("UPDATE invite_codes SET uses=uses+1,used_at=? WHERE id=? AND uses < max_uses").bind(now, row.id).run();
  const teacher = await findTeacher(db, { email });
  return { teacher, session: await createSession(db, id) };
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
  const owner = String(row.email || '').toLowerCase() === OWNER_EMAIL;
  return { id: row.id, employeeNo: row.employee_no, email: row.email, displayName: row.display_name, avatarText: row.avatar_text || "", isAdmin: Boolean(row.is_admin) || owner };
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
  if (employeeNo && !email) {
    const byNo = await findTeacher(db, { employeeNo });
    if (!byNo) return { error: "账号或密码不正确", status: 401 };
    if (!(await passwordMatches(password, byNo.password_salt, byNo.password_hash))) return { error: "账号或密码不正确", status: 401 };
    return { teacher: byNo, session: await createSession(db, byNo.id), needsMigration: false };
  }
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
  await ensureInviteTable(db);
  const url = new URL(request.url);
  const pathname = url.pathname;
  if (request.method === "GET" && pathname === "/api/health") {
    const tables = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('teachers','sessions','workspaces','migration_audit','teacher_feedback') ORDER BY name").all();
    return json({ ok: true, database: "DB", tables: tables.results || [] });
  }
  if (pathname === "/api/auth/login" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await bootstrapTeacher(db, body, env);
    if (result.error) return json({ error: result.error }, { status: result.status });
    return json({ ok: true, teacher: publicTeacher(result.teacher), needsMigration: result.needsMigration }, { headers: { "set-cookie": cookieHeader(result.session.token) } });
  }
  if (pathname === "/api/auth/register" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const result = await registerWithInvite(db, body);
    if (result.error) return json({ error: result.error }, { status: result.status });
    return json({ ok: true, teacher: publicTeacher(result.teacher) }, { headers: { "set-cookie": cookieHeader(result.session.token) } });
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
  if (pathname === '/api/feedback' || pathname.startsWith('/api/feedback/')) {
    const owner = String(teacher.email || '').toLowerCase() === OWNER_EMAIL;
    if (request.method !== 'GET' && request.headers.get('origin') !== url.origin) return json({error:'反馈请求来源不正确'}, {status:403});
    const all = url.searchParams.get('scope') === 'all';
    if (all && !owner) return json({error:'仅所有者管理员可查看全部反馈'}, {status:403});
    if (pathname === '/api/feedback' && request.method === 'GET') {
      const where = all ? '' : ' WHERE f.teacher_id=?';
      const args = all ? [] : [teacher.id];
      const items = await db.prepare(`SELECT f.*,t.display_name,t.employee_no,t.email FROM teacher_feedback f JOIN teachers t ON t.id=f.teacher_id${where} ORDER BY f.created_at DESC,f.id DESC LIMIT 100`).bind(...args).all();
      const unread = await db.prepare(`SELECT COUNT(*) AS count FROM teacher_feedback f${all?' WHERE f.admin_unread=1':' WHERE f.teacher_id=? AND f.teacher_unread=1'}`).bind(...args).first();
      return json({ok:true,items:items.results,unread:unread.count,canManage:owner});
    }
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16000) return json({error:'反馈内容过长'}, {status:413});
    let body; try { body=JSON.parse(raw); } catch { return json({error:'请求格式无效'}, {status:400}); }
    if (!body || typeof body !== 'object') return json({error:'请求格式无效'}, {status:400});
    if (pathname === '/api/feedback' && request.method === 'POST') {
      const category=body.category,content=String(body.content||'').trim(),contact=String(body.contact||'').trim();
      if (!['问题反馈','功能建议'].includes(category)||content.length<5||content.length>2000||contact.length>120) return json({error:'内容请填写5～2000字，联系方式最多120字'}, {status:400});
      const id=crypto.randomUUID(),now=new Date().toISOString(),minute=new Date(Date.now()-60000).toISOString(),day=new Date(Date.now()-86400000).toISOString();
      // Single conditional insert: concurrent submissions share the same database rate limit.
      const result=await db.prepare(`INSERT INTO teacher_feedback(id,teacher_id,category,content,contact,created_at,updated_at)
        SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM teacher_feedback WHERE teacher_id=? AND created_at>?)
        AND (SELECT COUNT(*) FROM teacher_feedback WHERE teacher_id=? AND created_at>?)<5`).bind(id,teacher.id,category,content,contact,now,now,teacher.id,minute,teacher.id,day).run();
      if (!result.meta?.changes) return json({error:'提交太频繁：每分钟1条、24小时最多5条，请稍后再试'}, {status:429});
      return json({ok:true,id}, {status:201});
    }
    if (pathname === '/api/feedback/read' && request.method === 'POST') {
      if (!Array.isArray(body.ids)||body.ids.length>100||body.ids.some(id=>typeof id!=='string'||id.length>80)) return json({error:'反馈编号无效'}, {status:400});
      if (body.scope==='all' && !owner) return json({error:'仅所有者管理员可管理反馈'}, {status:403});
      if (body.ids.length) {
        const admin=body.scope==='all',marks=body.ids.map(()=>'?').join(',');
        await db.prepare(`UPDATE teacher_feedback SET ${admin?'admin_unread':'teacher_unread'}=0 WHERE id IN (${marks})${admin?'':' AND teacher_id=?'}`).bind(...body.ids,...(admin?[]:[teacher.id])).run();
      }
      return json({ok:true});
    }
    if (request.method === 'PATCH' && /^\/api\/feedback\/[^/]+$/.test(pathname)) {
      if (!owner) return json({error:'仅所有者管理员可回复反馈'}, {status:403});
      const status=body.status,reply=String(body.reply??'').trim();
      if (!['待处理','处理中','已解决'].includes(status)||reply.length>2000) return json({error:'处理状态或回复无效'}, {status:400});
      const result=await db.prepare('UPDATE teacher_feedback SET status=?,reply=?,teacher_unread=1,admin_unread=0,updated_at=? WHERE id=?').bind(status,reply,new Date().toISOString(),decodeURIComponent(pathname.split('/').pop())).run();
      return result.meta?.changes?json({ok:true}):json({error:'反馈不存在'}, {status:404});
    }
    return json({error:'Not found'}, {status:404});
  }
  if (pathname === "/api/auth/invite" && request.method === "POST") {
    if (!teacher.is_admin && String(teacher.email || '').toLowerCase() !== OWNER_EMAIL) return json({ error: "仅管理员可以生成一次性邀请码" }, { status: 403 });
    return json({ ok: true, ...(await createInvite(db, teacher.id)) });
  }
  if (pathname === "/api/auth/profile" && request.method === "PUT") {
    const body = await request.json().catch(() => ({}));
    const displayName = String(body.displayName || "教师账号").trim().slice(0, 80) || "教师账号";
    const avatarText = String(body.avatarText || "").trim().slice(0, 2);
    const employeeNo = String(body.employeeNo || "").trim().slice(0, 24) || null;
    if (employeeNo && !/^[A-Za-z0-9_-]{3,24}$/.test(employeeNo)) return json({ error: "工号需为3～24位字母、数字、下划线或短横线" }, { status: 400 });
    const duplicate = employeeNo ? await db.prepare("SELECT id FROM teachers WHERE employee_no=? AND id<>? LIMIT 1").bind(employeeNo, teacher.id).first() : null;
    if (duplicate) return json({ error: "该工号已被其他账号使用" }, { status: 409 });
    await db.prepare("UPDATE teachers SET employee_no=?,display_name=?,avatar_text=?,updated_at=? WHERE id=?").bind(employeeNo, displayName, avatarText, new Date().toISOString(), teacher.id).run();
    const updated = await db.prepare("SELECT * FROM teachers WHERE id=? LIMIT 1").bind(teacher.id).first();
    return json({ ok: true, teacher: publicTeacher(updated) });
  }
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
    if (Object.prototype.hasOwnProperty.call(body, 'expectedUpdatedAt')) {
      const result = await db.prepare("UPDATE workspaces SET payload_json=?,payload_version=?,source='sites-d1',updated_at=? WHERE teacher_id=? AND updated_at=?")
        .bind(JSON.stringify(payload), Number(payload.version || 2), now, teacher.id, body.expectedUpdatedAt).run();
      if (!result.meta?.changes) return json({ error: "云端已发生变化，请刷新后重新调整课表" }, { status: 409 });
      return json({ ok: true, updatedAt: now });
    }
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
    // Sites 的根网址直接进入教师云端版；公开演示仍可通过 /index.html 打开。
    if (pathname === "/") pathname = "/cloud.html";
    const asset = assets[pathname];
    if (!asset) return text("Not found", 404);
    return new Response(decodeBase64(asset.body), { headers: { "content-type": asset.type, "cache-control": "no-cache" } });
  },
};
