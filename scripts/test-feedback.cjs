const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite'),{webcrypto}=require('node:crypto');
const db=new DatabaseSync(':memory:');
db.exec(fs.readFileSync('drizzle/0000_sites_teacher_workspace.sql','utf8'));
db.exec(fs.readFileSync('drizzle/0001_teacher_feedback.sql','utf8').replaceAll('--> statement-breakpoint',''));
const env={DB:{prepare(sql){let args=[];return {bind(...a){args=a;return this},async first(){return db.prepare(sql).get(...args)||null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:r.changes}}}}}}};
const ctx=vm.createContext({crypto:webcrypto,TextEncoder,Response,Request,URL,console,btoa,atob});
vm.runInContext(fs.readFileSync('worker/index.js','utf8').replace('__ASSETS__','{}').replace('export default {','globalThis.WorkerApp = {'),ctx);
async function run(){
 for(const [id,email] of [['owner','2546605157@qq.com'],['a','a@example.com'],['b','b@example.com']]){
  db.prepare('INSERT INTO teachers(id,email,display_name,password_hash,password_salt,created_at,updated_at,is_admin) VALUES(?,?,?,?,?,?,?,?)').run(id,email,id,'test','test','2026-01-01','2026-01-01',id==='b'?1:0);
  const hash=Buffer.from(await webcrypto.subtle.digest('SHA-256',new TextEncoder().encode(id))).toString('hex');
  db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash,id,'2099-01-01','2026-01-01');
 }
 const call=async(who,path,method='GET',body,origin='https://test.site')=>{const r=await ctx.WorkerApp.fetch(new Request('https://test.site'+path,{method,headers:{...(who?{cookie:'d1_sid='+who}:{}),'content-type':'application/json',origin},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env,{});return {status:r.status,...await r.json()}};
 assert.equal((await call(null,'/api/feedback')).status,401);
 assert.equal((await call('a','/api/feedback?scope=all')).status,403);
 assert.equal((await call('b','/api/feedback?scope=all')).status,403); // is_admin alone never grants feedback access.
 assert.equal((await call('a','/api/feedback','POST',{category:'问题反馈',content:'测试问题反馈内容'},'https://other.site')).status,403);
 assert.equal((await call('a','/api/feedback','POST',{category:'问题反馈',content:'短'})).status,400);
 const created=await call('a','/api/feedback','POST',{category:'问题反馈',content:'<script>反馈文本不得执行</script>',contact:'选填联系'});assert.equal(created.status,201);
 assert.equal((await call('a','/api/feedback','POST',{category:'功能建议',content:'重复提交必须限制'})).status,429);
 assert.equal((await call('b','/api/feedback')).items.length,0);
 let inbox=await call('owner','/api/feedback?scope=all');assert.equal(inbox.unread,1);assert.equal(inbox.items[0].teacher_id,'a');
 assert.equal((await call('b','/api/feedback/read','POST',{scope:'all',ids:[created.id]})).status,403);
 await call('b','/api/feedback/read','POST',{scope:'mine',ids:[created.id]});assert.equal((await call('owner','/api/feedback?scope=all')).unread,1);
 await call('owner','/api/feedback/read','POST',{scope:'all',ids:[created.id]});assert.equal((await call('owner','/api/feedback?scope=all')).unread,0);
 assert.equal((await call('a','/api/feedback/'+created.id,'PATCH',{status:'已解决',reply:'越权'})).status,403);
 assert.equal((await call('owner','/api/feedback/missing','PATCH',{status:'待处理'})).status,404);
 assert.equal((await call('owner','/api/feedback/'+created.id,'PATCH',{status:'非法'})).status,400);
 await call('owner','/api/feedback/'+created.id,'PATCH',{status:'处理中',reply:'已收到问题'});
 let mine=await call('a','/api/feedback');assert.equal(mine.items[0].reply,'已收到问题');assert.equal(mine.unread,1);
 await call('a','/api/feedback/read','POST',{scope:'mine',ids:[created.id]});assert.equal((await call('a','/api/feedback')).unread,0);
 for(let i=0;i<4;i++){db.prepare('UPDATE teacher_feedback SET created_at=? WHERE teacher_id=?').run(new Date(Date.now()-120000-i*60000).toISOString(),'a');assert.equal((await call('a','/api/feedback','POST',{category:'功能建议',content:'频率回归测试'+i})).status,201)}
 db.prepare('UPDATE teacher_feedback SET created_at=?').run(new Date(Date.now()-120000).toISOString());
 assert.equal((await call('a','/api/feedback','POST',{category:'功能建议',content:'每日上限测试'})).status,429);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM workspaces').get().n,0);
 new vm.Script(fs.readFileSync('feedback.js','utf8'));
 console.log('PASS feedback SQL migration, auth, owner-only management, teacher isolation, read badges, reply/status, rate limits, origin/validation, workspace untouched, frontend syntax');
}
run().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.close());
