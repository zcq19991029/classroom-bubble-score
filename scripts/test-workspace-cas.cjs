const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const {DatabaseSync} = require('node:sqlite');
const {webcrypto} = require('node:crypto');
const db = new DatabaseSync(':memory:');
db.exec(fs.readFileSync('drizzle/0000_sites_teacher_workspace.sql', 'utf8'));
const env = {DB: {prepare(sql) {
  let args = [];
  return {
    bind(...values) { args = values; return this; },
    async first() { return db.prepare(sql).get(...args) || null; },
    async run() { const result = db.prepare(sql).run(...args); return {meta: {changes: result.changes}}; }
  };
}}};
const ctx = vm.createContext({crypto:webcrypto, TextEncoder, Response, Request, Headers, URL, console, btoa, atob});
vm.runInContext(fs.readFileSync('worker/index.js','utf8').replace('__ASSETS__','{}').replace('export default {','globalThis.WorkerApp = {'), ctx);
const payload = {version: 2, activeClass: '测试班', classes: {'测试班': {className: '测试班', students: [{id:'s1', name:'学生1', score:0}], logs: []}}};
async function main(){
  const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode('teacher'))).toString('hex');
  db.prepare('INSERT INTO teachers(id,email,display_name,password_hash,password_salt,created_at,updated_at,is_admin) VALUES(?,?,?,?,?,?,?,?)').run('teacher','t@example.com','教师','x','x','2026-01-01','2026-01-01',0);
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash,'teacher','2099-01-01','2026-01-01');
  const call = async (method, body) => { const response = await ctx.WorkerApp.fetch(new Request('https://test.site/api/workspace',{method,headers:{cookie:'d1_sid=teacher','content-type':'application/json',origin:'https://test.site'},...(body?{body:JSON.stringify(body)}:{})}), env, {}); return {status:response.status, body:await response.json()}; };
  const created = await call('PUT',{payload}); if (created.status !== 200) throw new Error(JSON.stringify(created)); assert.ok(created.body.updatedAt);
  const first = await call('GET'); assert.equal(first.status,200); assert.equal(first.body.payload.activeClass,'测试班');
  const legacyPayload = {...payload, classes: {'测试班': {...payload.classes['测试班'], students: [{id:'s1', name:'学生1', score:1}]}}};
  const legacy = await call('PUT',{payload:legacyPayload}); assert.equal(legacy.status,409);
  const stale = await call('PUT',{payload:legacyPayload, expectedUpdatedAt:'2000-01-01T00:00:00.000Z'}); assert.equal(stale.status,409);
  const casPayload = {...payload, classes: {'测试班': {...payload.classes['测试班'], students: [{id:'s1', name:'学生1', score:2}]}}};
  const saved = await call('PUT',{payload:casPayload, expectedUpdatedAt:first.body.updatedAt}); assert.equal(saved.status,200);
  assert.equal((await call('GET')).body.payload.classes['测试班'].students[0].score,2);
  console.log('PASS Worker workspace CAS: initial insert, legacy overwrite rejection, stale revision rejection, current revision update');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>db.close());
