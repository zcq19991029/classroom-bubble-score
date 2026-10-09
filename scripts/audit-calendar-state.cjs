/* Private files are read only; output is aggregate counts, never student records. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const [beforeFile,...afterFiles]=process.argv.slice(2);
if(!beforeFile||!afterFiles.length)throw Error('Usage: node scripts/audit-calendar-state.cjs before-workspace.json after-class.json ...');
const before=JSON.parse(fs.readFileSync(beforeFile,'utf8'));
function withoutIds(rows){return rows.map(({lessonId,...r})=>r)}
for(const file of afterFiles){
 const a=JSON.parse(fs.readFileSync(file,'utf8')),b=before.classes[a.className];assert(b,'Missing class');
 for(const key of ['students','homework','examScores','lessonTaskCounts','courseProgress'])assert.deepEqual(a[key],b[key],a.className+' '+key);
 for(const key of ['logs','attendance'])assert.deepEqual(withoutIds(a[key]||[]),withoutIds(b[key]||[]),a.className+' '+key);
 const rows=a.lessonSchedule||[],seen=new Set();for(const r of rows){const k=r.date+'|'+r.period;assert(!seen.has(k),'duplicate');seen.add(k)}
 console.log(JSON.stringify({className:a.className,lessons:rows.length,students:a.students.length,logs:a.logs.length,attendance:a.attendance.length,archived:(a.archivedLessons||[]).length,oct10:rows.filter(r=>r.date==='2026-10-10').map(r=>r.period),oct8:rows.filter(r=>r.date==='2026-10-08').map(r=>r.period),week17:rows.filter(r=>r.date>='2026-12-21'&&r.date<='2026-12-27').map(r=>r.date+' '+r.period),history:'unchanged (only stable lessonId may be added)'}));
}
