const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../assessment-model.js');
const s={id:'stable-a',studentNo:'01',score:17},b={id:'stable-b',studentNo:'02',score:8};
const d={students:[s,b],settings:{passScore:60},logs:[{delta:17}],attendance:[],homework:[],examScores:{},lessonSchedule:[],courseProgress:{},criterionAssessment:{taskTarget:10,students:{}}};
const record=(st,earned,extra={})=>d.criterionAssessment.students[M.key(st)]={earned,status:'graded',foundation:'met',...extra};
const calc=st=>M.calculate(d,st,20,{complete:true});
for(const [n,v] of [[10,100],[8,92],[6,84],[0,60]]){record(s,n);assert.equal(calc(s).regular,v)}
record(s,0,{foundation:'pending'});assert.equal(calc(s).ready,false);
record(s,6);record(b,6);let before=calc(b);record(s,10);assert.deepEqual(calc(b),before);
for(let i=0;i<50;i++)d.students.push({id:'synthetic-'+i});assert.deepEqual(calc(b),before);
record(s,10);record(b,10);assert.equal(calc(s).regular,100);assert.equal(calc(b).regular,100);
record(s,10,{status:'pending'});assert.equal(calc(s).learning,null);
record(s,0);d.criterionAssessment.taskTarget=0;assert.equal(calc(s).learning,null);d.criterionAssessment.taskTarget=10;
record(s,6,{bonus:200});assert.equal(calc(s).bonus,5);assert.equal(calc(s).learning,69);
record(s,10,{bonus:5});assert.equal(calc(s).learning,80);
record(s,0,{penalty:200});assert.equal(calc(s).learning,40);assert.equal(M.calculate(d,s,0,{complete:true}).regular,40);
record(s,0);assert.equal(calc(s).needed,60);assert.equal(calc(s).exam,null);d.examScores[s.id]=0;assert.equal(calc(s).final,24);d.examScores[s.id]=100;assert.equal(calc(s).final,84);
d.settings.passScore=100;assert.equal(calc(s).needed,126.7);d.settings.passScore=60;
assert.equal(M.calculate(d,s,20,{complete:false}).ready,false);
const snapshot=JSON.stringify(d);calc(s);assert.equal(JSON.stringify(d),snapshot);assert.deepEqual(calc(s),M.calculate(JSON.parse(snapshot),s,20,{complete:true}));
for(const file of ['cloud.html','index.html']){const html=fs.readFileSync(file,'utf8');assert(!html.includes('function classroomAssignments'));assert(html.includes('assessment-model.js'));for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);}
new vm.Script(fs.readFileSync('assessment-ui.js','utf8'));
const html=fs.readFileSync('cloud.html','utf8');
const deductionCode=html.match(/function attendanceDeduction\(status,record\)\{[^\n]+/)[0];
const ctx={CriterionAssessment:M,data:{settings:{absenceDeduction:1,truantDeduction:3}},customAttendanceRules:()=>[{name:'早退',deduction:2}]};vm.createContext(ctx);vm.runInContext(deductionCode,ctx);
assert.equal(ctx.attendanceDeduction('迟到'),1);assert.equal(ctx.attendanceDeduction('旷课'),3);assert.equal(ctx.attendanceDeduction('请假'),0);assert.equal(ctx.attendanceDeduction('早退'),2);
const historical={deduction:1};ctx.data.settings.absenceDeduction=8;assert.equal(ctx.attendanceDeduction('迟到',historical),1);assert.equal(ctx.attendanceDeduction('历史原因',{deduction:4}),4);assert.equal(ctx.attendanceDeduction('签到',{deduction:0}),0);
assert.equal(ctx.attendanceDeduction('迟到'),8);assert.deepEqual(historical,{deduction:1});
console.log('PASS criterion fixed denominator, independence, 100/92/84/60, pending vs zero, caps, exam rounding, serialization, immutable raw facts, both entry syntax');
