const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('cloud.html','utf8');
for(const className of ['25机电2班','25机电3班']){
 const grid={innerHTML:'',querySelectorAll:()=>[]};
 const c=vm.createContext({SchoolCalendar:require('../school-calendar.js'),data:{className,lessonSchedule:[],settings:{termStartDate:'2026-09-01'}},lessonGrid:grid,selectLesson:()=>{},esc:s=>s,lessonIdentity:s=>s});
 for(const name of ['scheduleDate','schedulePeriodText','schoolWeekMonday','schoolWeekNumber','weekday','adjustAutumn2026PresetDate','buildLessonOptions'])vm.runInContext(html.split(/\r?\n/).find(l=>l.trimStart().startsWith(`function ${name}(`)),c);
 c.buildLessonOptions(); const labels=[...grid.innerHTML.matchAll(/data-lesson="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(labels.length,className==='25机电3班'?23:16);
 assert(!labels.some(x=>/9月29日|9月30日|10月6日/.test(x)));
 if(className==='25机电3班'){
  assert(!labels.some(x=>x.includes('10月10日')));
  assert(labels.some(x=>x.includes('第6周 · 10月8日星期四 · 机电3班 · 3-4节')));
  assert(labels.some(x=>x.includes('第17周 · 12月22日星期二')));
 }else {assert(labels.some(x=>x.includes('第17周 · 12月23日星期三')));assert(labels.some(x=>x.includes('第6周 · 10月10日星期六 · 机电2班 · 1-4节')));assert(!labels.some(x=>x.includes('10月7日')));}
 for(const day of ['9月1日','9月8日','9月10日','9月15日','9月22日','9月24日'])if(className==='25机电3班')assert(labels.some(x=>x.includes(day)));
 console.log('PASS',className,labels.length,'date correction, preserved Thursday, past lessons and week17');
}
