const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),M=require('../assessment-model.js');
const a={id:'a',studentNo:'01',score:10},b={id:'b',studentNo:'02',score:20};
const d={students:[a,b],logs:[{studentId:'a',delta:10}],attendance:[],settings:{passScore:60,absenceDeduction:1,truantDeduction:3,customAttendanceRules:[{name:'早退',deduction:1},{name:'工具未还',deduction:2}]},examScores:{},criterionAssessment:{taskTarget:999,projects:[{name:'不参与',scores:{'id:a':999}}],students:{'id:a':{earned:999,bonus:999,penalty:999,status:'pending',foundation:'met'}}}};
const calc=s=>M.calculate(d,s,undefined,{complete:true});
assert.equal(calc(a).learning,26);assert.equal(calc(a).regular,74);assert.equal(calc(a).contribution,29.6);assert.equal(calc(a).needed,50.7);assert.equal(calc(b).regular,100);assert.equal(calc(b).needed,33.4);
for(const [score,regular] of [[0,48],[16,89.6],[18,94.8],[-1,48]]){a.score=score;assert.equal(calc(a).regular,regular)}
a.score=10;b.score=25;assert.equal(calc(a).regular,68.8);b.score=20;
d.logs.push({studentId:'a',delta:100,assessmentCategory:'reward'});assert.equal(calc(a).regular,74,'classified logs not double counted');
a.score=0;b.score=0;assert.equal(calc(a).learning,0);assert.equal(calc(a).ready,false);assert.equal(calc(a).regular,48);a.score=10;b.score=20;
const rec=(id,status='旷课',extra={})=>({id,studentId:'a',lessonId:id,lesson:id,status,time:'2026-10-01',...extra});
d.attendance=[rec('l1')];assert.equal(calc(a).attendance,45);assert.equal(calc(a).attendanceFailed,false);
d.attendance.push(rec('l2'),rec('l3'));assert.equal(calc(a).attendance,39);assert.equal(calc(a).attendanceFacts.actualTruant,3);assert.equal(calc(a).attendanceFailed,true);assert.equal(calc(a).needed,null);
d.examScores.a=100;assert(calc(a).final>60);assert.match(calc(a).result,/考勤挂科/);
d.attendance[2].status='签到';assert.equal(calc(a).attendanceFailed,false);assert.notEqual(calc(a).needed,null);
d.attendance=Array.from({length:9},(_,i)=>rec('t'+i,i%2?'迟到':'早退'));assert.equal(calc(a).attendance,39);assert.equal(calc(a).attendanceFailed,false);assert.equal(calc(a).attendanceFacts.actualTruant,0);
d.attendance=[rec('same','旷课',{time:'2026-01-01'}),rec('same','签到',{time:'2026-02-01'}),rec('custom','工具未还'),rec('leave','请假')];assert.equal(calc(a).attendanceFacts.actualTruant,0);assert.equal(calc(a).attendance,46);
d.attendance=[rec('snap','迟到',{deduction:1})];d.settings.absenceDeduction=10;assert.equal(calc(a).attendance,47);
d.attendance=[rec('loss','工具未还',{deduction:100})];assert.equal(calc(a).attendance,0);assert.equal(calc(a).regular,26);
d.attendance=[rec('old','旷课',{lessonId:null,lesson:'旧别名'}),rec('new','签到',{lessonId:'stable',time:'2026-10-02'})];let facts=M.attendanceFacts(d,a,{resolve:()=> 'stable'});assert.equal(facts.actualTruant,0);assert.equal(facts.score,48);
d.attendance=[];delete d.examScores.a;assert.equal(calc(a).exam,null);assert.equal(calc(a).final,null);d.examScores.a=0;assert.equal(calc(a).final,29.6);assert.equal(calc(a).exam,0);
d.settings.passScore=100;assert(calc(a).needed>100);d.settings.passScore=60;
assert.equal(M.calculate(d,a,undefined,{complete:false}).ready,false);
const before=JSON.stringify(d);calc(a);assert.equal(JSON.stringify(d),before);assert.deepEqual(M.calculate(JSON.parse(before),a,undefined,{complete:true}),calc(a));
let cfg=structuredClone(d.criterionAssessment);M.commit(d,cfg,[{key:'id:a',category:'reward',delta:1}],'测试奖励','l1');assert.equal(calc(a).regular,76.6);M.travel(d);assert.equal(calc(a).regular,74);M.travel(d,true);assert.equal(calc(a).regular,76.6);
for(const [p,n,v] of [[4,5,4],[3,4,3.75],[5,5,5],[0,5,0]])assert.equal(M.dutyScore(p,n),v);for(const pair of [[6,5],[-1,5],[1,0],[1.5,4]])assert.throws(()=>M.dutyScore(...pair));
cfg=structuredClone(d.criterionAssessment);const effects=M.duty(cfg,'l|g',['id:a','id:b'],3,4);M.commit(d,cfg,effects,'人数','l');assert.equal(d.criterionAssessment.duties['l|g'].score,3.75);const score=a.score;M.travel(d);assert.equal(a.score,score-3.75);M.travel(d,true);assert.equal(a.score,score);
for(const file of ['cloud.html','index.html']){const html=fs.readFileSync(file,'utf8');for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);assert(html.includes('criterionAttendanceFacts'));assert(!html.includes('20*(total-loss)/total'));}
const html=fs.readFileSync('cloud.html','utf8'),deductionCode=html.match(/function attendanceDeduction\(status,record\)\{[^\n]+/)[0],ctx={CriterionAssessment:M,data:{settings:{absenceDeduction:1,truantDeduction:3}},customAttendanceRules:()=>[{name:'早退',deduction:2}]};vm.createContext(ctx);vm.runInContext(deductionCode,ctx);assert.equal(ctx.attendanceDeduction('旷课'),3);assert.equal(ctx.attendanceDeduction('迟到',{deduction:.5}),.5);assert.equal(ctx.attendanceDeduction('早退'),2);
console.log('PASS floating 52/48: existing score, realtime maximum, no free 40/no floor60/no double count, direct attendance snapshots, only actual 3 truancies, correction/dedup/aliases, exam rounding, undo redo duty, immutable restore and both HTML');
