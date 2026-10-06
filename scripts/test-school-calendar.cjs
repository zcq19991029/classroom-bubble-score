const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const html=fs.readFileSync('cloud.html','utf8');
const context=vm.createContext({});
for(const name of ['schoolWeekMonday','schoolWeekNumber','schoolDateForWeek','lessonIdentity','sameLesson','lessonMapValue']){
  const line=html.split(/\r?\n/).find(x=>x.trimStart().startsWith(`function ${name}(`));
  assert.ok(line,name);vm.runInContext(line,context);
}
for(const [date,week] of [['2026-08-31',1],['2026-09-01',1],['2026-09-06',1],['2026-09-07',2],['2026-09-28',5],['2026-09-29',5],['2026-09-30',5],['2026-10-04',5],['2026-10-05',6],['2026-10-08',6],['2026-10-11',6],['2026-10-12',7],['2026-12-21',17],['2026-12-22',17],['2026-12-27',17]])assert.equal(context.schoolWeekNumber(date),week,date);
for(const start of ['2026-08-31','2026-09-01']){
  assert.equal(context.schoolDateForWeek(start,5,1),'2026-09-29');
  assert.equal(context.schoolDateForWeek(start,6,1),'2026-10-06');
  assert.equal(context.schoolDateForWeek(start,17,0),'2026-12-21');
  for(let week=1;week<=20;week++)for(let day=0;day<7;day++)assert.equal(context.schoolWeekNumber(context.schoolDateForWeek(start,week,day),start),week);
}
assert.equal(context.lessonIdentity('第1节课 · 第1周 · 10月8日'),context.lessonIdentity('第1节课 · 第6周 · 10月8日'));
console.log('PASS: calendar boundaries, 280 import/display round trips and lesson selection identity');
const old='第1节课 · 第1周 · 10月8日星期四 · 26电气8班 · 7-8节',fixed=old.replace('第1周','第6周');
assert.equal(context.sameLesson(old,fixed),true);
assert.equal(context.sameLesson(old,fixed.replace('7-8节','9-10节')),false);
assert.equal(context.lessonMapValue({[old]:'旧教学进度'},fixed),'旧教学进度');
assert.equal(context.lessonMapValue({[old]:'旧',[fixed]:''},fixed),'');
