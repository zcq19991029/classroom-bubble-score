const fs=require('node:fs'),vm=require('node:vm');
const assert=require('node:assert/strict');
const XLSX=require('../xlsx.full.min.js');
const html=fs.readFileSync('cloud.html','utf8');
const context=vm.createContext({XLSX,window:{XLSX}});
for(const name of ['scheduleDate','schedulePeriodText','schoolWeekRange','schoolPeriod','schoolWeekMonday','schoolWeekNumber','schoolDateForWeek','schoolAdjustDate','parseSchoolWorkbook','schoolRowsToSchedule']){
 const line=html.split(/\r?\n/).find(x=>x.trimStart().startsWith(`function ${name}(`));vm.runInContext(line,context);
}
const file='C:/Users/25466/Desktop/课表.xlsx',buffer=fs.readFileSync(file);
const wb=XLSX.read(buffer,{type:'buffer'});
for(const sn of wb.SheetNames)console.log('SHEET',sn,JSON.stringify(XLSX.utils.sheet_to_json(wb.Sheets[sn],{header:1,defval:'',raw:false})));
try{
 const groups=context.parseSchoolWorkbook(buffer);
 const rules=[['2026-09-28','2026-12-21'],['2026-09-29','2026-12-22'],['2026-09-30','2026-12-23'],['2026-10-06','2026-10-10']].map(([from,to])=>({from,to}));
 const rows=context.schoolRowsToSchedule(groups,'2026-08-31',rules);
 console.log('PARSED',JSON.stringify(groups));
 for(const name of ['25机电2班','25机电3班']){const r=rows.filter(x=>x.className===name);assert.equal(r.length,24);assert.equal(r.filter(x=>x.period==='3-4').length,8);}
 for(const name of ['26电气8班','26工器1班','26工器2班'])assert.equal(rows.filter(x=>x.className===name).length,24);
 console.log('PASS: real workbook, all five classes 24 sessions, each mechatronics class 8 even-week sessions');
 for(const name of ['26电气8班','26工器1班','26工器2班']){const r=rows.filter(x=>x.className===name);console.log('RESULT',name,r.length,JSON.stringify(r));}
}catch(e){console.log('PARSER_FAILED',e.message);process.exitCode=1;}
