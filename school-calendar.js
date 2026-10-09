/* Calendar transformations are pure; callers preview and atomically save their own workspace. */
(function(root){
  const M=typeof module==='undefined'?root.ScheduleManager:require('./schedule-manager.js');
  const clone=x=>JSON.parse(JSON.stringify(x));
  const moved={'2026-09-28':'2026-12-21','2026-09-29':'2026-12-22','2026-09-30':'2026-12-23','2026-10-07':'2026-10-10'};
  function adjust(date){return moved[date]||(/^2026-10-0[1-7]$/.test(date)?null:date)}
  function week(date,start='2026-08-31'){const d=new Date(start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return Math.floor((new Date(date+'T12:00:00Z')-d)/604800000)+1}
  function label(name,start,r,i,legacy=false){const d=new Date(r.date+'T12:00:00Z'),day=['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getUTCDay()];return `第${i+1}节课 · 第${week(r.date,start)}周 · ${d.getUTCMonth()+1}月${d.getUTCDate()}日${day} · ${legacy?name.replace(/^25/,''):name} · ${r.period}节${!legacy&&r.course?' · '+r.course:''}`}
  function preset(name,legacy=false){
    if(!/^25机电[23]班$/.test(name))return [];
    const rows=[];for(let w=1;w<=16;w++){
      const add=(offset,period)=>{const d=new Date('2026-09-01T12:00:00Z');d.setUTCDate(d.getUTCDate()+(w-1)*7+offset);const originalDate=d.toISOString().slice(0,10);const date=legacy?({'2026-09-28':'2026-12-21','2026-09-29':'2026-12-22','2026-09-30':'2026-12-23','2026-10-06':'2026-10-10'}[originalDate]||originalDate):adjust(originalDate);if(date)rows.push({id:`preset:${name}:${originalDate}:${period}`,originalDate,date,period,course:'单片机技术及应用',aliases:[]})};
      if(name==='25机电3班'){add(0,'1-2');if(w%2===0)add(2,'3-4')}else add(1,w%2===0?'1-4':'1-2');
    }return M.sort(rows).map((r,i)=>({...r,aliases:[label(name,'2026-08-31',r,i,true)]}));
  }
  function rowsFor(workspace){
    if(!workspace.lessonSchedule?.length)return preset(workspace.className,true);
    return M.sort(workspace.lessonSchedule).map((r,i)=>({...r,id:r.id||`lesson:${workspace.className}:${r.date}:${r.period}`,aliases:[...new Set([...(r.aliases||[]),label(workspace.className,workspace.settings?.termStartDate,r,i)])]}));
  }
  function correction(name,rows){
    const result=[];for(const r of rows){
      if(name==='25机电3班'&&r.date==='2026-10-10'&&r.period==='1-2')continue;
      if(name==='26电气8班'&&r.date==='2026-10-10'&&['7-8','9-10'].includes(r.period)&&r.course==='电气接线原理')continue;
      const date=adjust(r.date);if(date)result.push({...r,date});
    }
    if(name==='26工器1班'&&rows.some(r=>r.course==='电气接线原理')&&!result.some(r=>r.date==='2026-10-10'&&r.period==='9-10'))result.push({id:'calendar:26工器1班:2026-10-07:9-10',originalDate:'2026-10-07',date:'2026-10-10',period:'9-10',course:'电气接线原理',aliases:[]});
    return result;
  }
  function plan(payload,{from,to,all=true,className,repair=false}){
    if(!repair)M.validate([{date:from,period:'1-2'},{date:to,period:'3-4'}]);
    if(!repair&&from===to)throw Error('原日期与新日期相同');
    const next=clone(payload),changes=[];
    for(const [name,workspace] of Object.entries(payload.classes||{})){
      if(!all&&name!==className)continue;
      if(repair&&!['25机电2班','25机电3班','26电气8班','26工器1班','26工器2班'].includes(name))continue;
      const before=rowsFor(workspace);if(!before.length)continue;
      // Only recover an old name when its full date+period maps to exactly one original row.
      const refs=[...(workspace.logs||[]),...(workspace.attendance||[]),...Object.keys(workspace.lessonTaskCounts||{}).map(lesson=>({lesson})),...Object.keys(workspace.courseProgress?.actual||{}).map(lesson=>({lesson}))];
      for(const ref of refs){if(M.resolve([...before,...(workspace.archivedLessons||[])],ref.lesson))continue;const m=String(ref.lesson||'').match(/(\d+)月(\d+)日.*?·\s*(?:25)?机电[23]班\s*·\s*(\d+-\d+)节/);if(!m)continue;const date=`2026-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`,hits=before.filter(r=>(r.originalDate||r.date)===date&&r.period===m[3]);if(hits.length===1)hits[0].aliases.push(ref.lesson)}
      const after=repair?correction(name,before):before.map(r=>r.date===from?{...r,date:to}:r);
      const removed=before.filter(r=>!after.some(a=>a.id===r.id)),added=after.filter(r=>!before.some(b=>b.id===r.id)),changed=after.filter(r=>before.some(b=>b.id===r.id&&b.date!==r.date));
      if(!removed.length&&!added.length&&!changed.length)continue;
      const labels=(r,i)=>label(name,workspace.settings?.termStartDate||'2026-08-31',r,i);
      next.classes[name]=M.prepare(workspace,before,after,labels,{archiveRemoved:repair});
      changes.push({className:name,count:after.length,removed:removed.map(r=>({date:r.date,period:r.period})),added:added.map(r=>({date:r.date,period:r.period})),moved:changed.map(r=>({from:before.find(b=>b.id===r.id).date,to:r.date,period:r.period}))});
    }
    return {payload:next,changes};
  }
  const api={adjust,week,label,preset,rowsFor,plan};root.SchoolCalendar=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
