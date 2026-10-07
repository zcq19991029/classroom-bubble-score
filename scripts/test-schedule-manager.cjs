const assert=require('node:assert/strict'),M=require('../schedule-manager.js');
const before=[{id:'a',date:'2026-10-10',period:'7-8',course:'测试',aliases:['第1节课 · 第6周 · A']},{id:'b',date:'2026-10-10',period:'9-10',course:'测试',aliases:['第2节课 · 第6周 · B']}];
const original={settings:{},lastLesson:before[0].aliases[0],logs:[{lesson:before[0].aliases[0],delta:3}],attendance:[{lesson:before[1].aliases[0],status:'旷课'}],lessonTaskCounts:{[before[0].aliases[0]]:5},courseProgress:{actual:{[before[1].aliases[0]]:'已教'}},students:[{score:3}]};
const snapshot=JSON.stringify(original),label=(r,i)=>`第${i+1}节课 · ${r.date} · ${r.period}`;
const moved=M.prepare(original,before,before.map(r=>({...r,date:r.id==='a'?'2026-12-22':r.date})),label);
assert.equal(JSON.stringify(original),snapshot);assert.equal(moved.logs[0].delta,3);assert.equal(moved.logs[0].lessonId,'a');assert.equal(moved.attendance[0].lessonId,'b');assert.equal(M.resolve(moved.lessonSchedule,before[0].aliases[0]),'a');assert.equal(M.resolve(moved.lessonSchedule,label(moved.lessonSchedule[1],1)),'a');assert.equal(moved.students[0].score,3);assert.equal(moved.lessonTaskCounts[before[0].aliases[0]],5);
assert.throws(()=>M.prepare({...original,logs:[{lesson:'未知旧课次'}]},before,before,label),/无法明确关联/);
assert.throws(()=>M.validate([{date:'2026-02-30',period:'1-2'}]),/日期/);
assert.throws(()=>M.validate([before[0],before[0]]),/重复/);
assert.throws(()=>M.validate([{date:'2026-10-10',period:'8-7'}]),/节次/);
assert.equal(M.prepare(original,before,before.map(r=>({...r,date:'2026-10-13'})),label).lessonSchedule.length,2);
const emptyHistory={settings:{},lastLesson:before[0].aliases[0],students:[],logs:[],attendance:[]};
assert.equal(M.prepare(emptyHistory,before,[before[1]],label).lastLesson,label(before[1],0));
assert.throws(()=>M.prepare(original,before,[before[1]],label),/无法明确关联/);
console.log('PASS stable identity, sort, multi-move, historical scoring/attendance/progress, invalid/duplicate/orphan protection, immutable preview');
const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync('cloud.html','utf8');
for(const block of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(block[1]);
console.log('PASS inline script syntax');
async function testCloudFailure(){
 const code=fs.readFileSync('d1-cloud.js','utf8'),start=code.indexOf('  window.saveScheduleCloud = async'),end=code.indexOf('  const clone',start);
 const original={className:'测试班',students:[],lessonSchedule:before},candidate={...original,lessonSchedule:[{...before[0],date:'2026-12-22'}]};
 for(const mode of ['fail','conflict','success','loggedout']){
  const ctx=vm.createContext({window:{},clearTimeout:()=>{},setState:()=>{},renderClasses:()=>{},clone:x=>JSON.parse(JSON.stringify(x)),normalizePayload:x=>x,api:async(path,options)=>{if(options){if(mode==='fail')throw Error('模拟网络失败');assert.equal(JSON.parse(options.body).expectedUpdatedAt,'revision1');return {ok:true}}return {updatedAt:'revision1',payload:{classes:{测试班:mode==='conflict'?{...original,changed:true}:original}}}}});
  vm.runInContext(`let teacher=${mode==='loggedout'?'null':'{}'},loading=false,syncInFlight=false,scheduleSaving=false,syncTimer=0,syncPending=false,cloudPayload=${JSON.stringify({classes:{测试班:original}})};`+code.slice(start,end),ctx);
  if(mode==='success'){await ctx.window.saveScheduleCloud(candidate,original);assert.equal(vm.runInContext('cloudPayload.classes["测试班"].lessonSchedule[0].date',ctx),'2026-12-22')}
  else{await assert.rejects(ctx.window.saveScheduleCloud(candidate,original));assert.equal(vm.runInContext('cloudPayload.classes["测试班"].lessonSchedule[0].date',ctx),'2026-10-10')}
 }
 console.log('PASS cloud success, failed-save rollback, concurrent-change rejection, login guard');
}
testCloudFailure().catch(e=>{console.error(e);process.exitCode=1});
