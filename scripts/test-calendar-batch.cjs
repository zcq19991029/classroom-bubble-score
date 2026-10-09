const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('../school-calendar.js'),M=require('../schedule-manager.js');
const make=name=>({className:name,settings:{termStartDate:'2026-08-31'},students:[{id:'s',score:3}],logs:[],attendance:[],lessonSchedule:[],lessonTaskCounts:{},courseProgress:{actual:{}}});
const a=make('25机电3班'),b=make('25机电2班');
const old=C.preset(a.className,true).find(r=>r.originalDate==='2026-10-06');
a.logs=[{studentId:'s',lesson:'第8节课 · 第6周 · 10月6日星期二 · 机电3班 · 1-2节',delta:3}];
a.attendance=[{studentId:'s',lesson:old.aliases[0],status:'迟到'}];
const payload={version:2,activeClass:a.className,classes:{[a.className]:a,[b.className]:b,'测试班':make('测试班')}},original=JSON.stringify(payload);
const fixed=C.plan(payload,{repair:true});assert.equal(JSON.stringify(payload),original);assert.equal(fixed.changes.length,2);
assert.equal(fixed.payload.classes[a.className].lessonSchedule.length,23);assert.equal(fixed.payload.classes[b.className].lessonSchedule.length,16);
assert(fixed.payload.classes[b.className].lessonSchedule.some(r=>r.date==='2026-10-10'&&r.period==='1-4'));
assert(fixed.payload.classes[a.className].lessonSchedule.some(r=>r.date==='2026-10-08'&&r.period==='3-4'));
const cancelled=fixed.payload.classes[a.className].archivedLessons[0];assert.equal(M.resolve([cancelled],a.logs[0].lesson),cancelled.id);assert.equal(fixed.payload.classes[a.className].logs[0].delta,3);assert.equal(fixed.payload.classes[a.className].students[0].score,3);
assert.equal(C.plan(fixed.payload,{repair:true}).changes.length,0);
const date='2026-10-14';const moved=C.plan(fixed.payload,{from:date,to:'2026-10-15',all:true});assert(moved.changes.some(c=>c.className===b.className));assert.equal(moved.payload.classes[a.className].archivedLessons.length,1);
assert.throws(()=>C.plan(fixed.payload,{from:'2026-10-08',to:'2026-10-22',all:true}),/重复/);
assert.equal(C.week('2026-10-10'),6);assert.equal(C.week('2026-12-22'),17);assert.equal(C.adjust('2026-10-06'),null);assert.equal(C.adjust('2026-10-07'),'2026-10-10');
const single=C.plan(fixed.payload,{from:date,to:'2026-10-15',all:false,className:a.className});assert.equal(single.changes.length,0);
const code=fs.readFileSync('d1-cloud.js','utf8'),part=code.slice(code.indexOf('  let calendarPreview ='),code.indexOf('  window.saveScheduleCloud ='));
async function run(){for(const mode of ['success','failure','conflict','loggedout']){
 let puts=0;const context=vm.createContext({window:{classroomCloudBridge:{setData:()=>{}}},SchoolCalendar:C,URL,Blob,document:{createElement:()=>({click:()=>{}})},setTimeout:()=>{},clearTimeout:()=>{},clone:x=>JSON.parse(JSON.stringify(x)),normalizePayload:x=>x,setState:()=>{},renderClasses:()=>{},api:async(path,opts)=>{if(opts){puts++;assert.equal(JSON.parse(opts.body).expectedUpdatedAt,'r1');if(mode!=='success')throw Error('失败/冲突');return {ok:true}}return {updatedAt:'r1',payload:JSON.parse(original)}}});
 vm.runInContext(`let teacher=${mode==='loggedout'?'null':'{}'},loading=false,scheduleSaving=false,syncInFlight=false,syncPending=false,syncTimer=0,cloudPayload=${original};`+part,context);
 if(mode==='loggedout'){await assert.rejects(context.window.schoolCalendarCloud.preview({repair:true}));continue}
 await context.window.schoolCalendarCloud.preview({repair:true});assert.equal(puts,0);context.window.schoolCalendarCloud.cancel();assert.equal(puts,0);await context.window.schoolCalendarCloud.preview({repair:true});
 if(mode==='success'){await context.window.schoolCalendarCloud.save();assert.equal(puts,1);assert.equal(vm.runInContext('cloudPayload.classes["25机电3班"].lessonSchedule.length',context),23)}
 else{await assert.rejects(context.window.schoolCalendarCloud.save());assert.equal(vm.runInContext('JSON.stringify(cloudPayload)',context),original)}
 }console.log('PASS all/current classes, school makeup, preserved history/archive, immutable/cancelled preview, atomic save, failure/conflict rollback, login guard')}
run().catch(e=>{console.error(e);process.exitCode=1});
