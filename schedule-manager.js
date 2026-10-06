/* Deterministic schedule identity and history preservation. No network or AI. */
(function(root){
  const identity=s=>String(s||'').replace(/第\d+周\s*·\s*/,'');
  const sort=rows=>[...rows].sort((a,b)=>a.date.localeCompare(b.date)||Number(a.period.split('-')[0])-Number(b.period.split('-')[0]));
  function validate(rows){
    if(!rows.length)throw Error('没有可保存的课次，请先导入课表');
    const seen=new Set();
    for(const r of rows){
      const d=new Date(r.date+'T12:00:00Z');
      if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!Number.isFinite(+d)||d.toISOString().slice(0,10)!==r.date)throw Error('日期无效');
      if(!/^\d{1,2}-\d{1,2}$/.test(r.period))throw Error('节次请填写例如7-8');
      const [a,b]=r.period.split('-').map(Number);if(a<1||b<a||b>20)throw Error('节次范围无效');
      const k=r.date+'|'+r.period;if(seen.has(k))throw Error('重复日期和节次：'+k);seen.add(k);
    }return sort(rows);
  }
  function resolve(rows,label){const k=identity(label);const hits=rows.filter(r=>(r.aliases||[]).some(a=>identity(a)===k));return hits.length===1?hits[0].id:null}
  function prepare(workspace,before,after,labels){
    const next=JSON.parse(JSON.stringify(workspace)), rows=validate(after).map(r=>({...r,aliases:[...(r.aliases||[])]}));
    if(new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!r.id))throw Error('课次身份重复或缺失');
    const refs=[...(next.logs||[]),...(next.attendance||[])];
    const maps=[next.lessonTaskCounts,next.courseProgress?.actual].filter(Boolean);
    const oldIds=new Set(before.map(r=>r.id));
    for(const ref of [...refs,...maps.flatMap(m=>Object.keys(m).map(lesson=>({lesson})))]){
      const id=ref.lessonId||resolve(before,ref.lesson);
      if(!id||!oldIds.has(id)||!rows.some(r=>r.id===id))throw Error('存在无法明确关联的历史课次：'+ref.lesson+'。请先核对，未覆盖原课表');
      if(refs.includes(ref))ref.lessonId=id;
    }
    rows.forEach((r,i)=>{const label=labels(r,i);if(!r.aliases.includes(label))r.aliases.push(label)});
    const owners=new Map();for(const r of rows)for(const a of r.aliases){const k=identity(a);if(owners.has(k)&&owners.get(k)!==r.id)throw Error('新课次名称与历史名称冲突，请核对');owners.set(k,r.id)}
    next.lessonSchedule=rows;next.settings.attendanceTotalLessons=rows.length;
    const active=resolve(before,next.lastLesson);next.lastLesson=active?labels(rows.find(r=>r.id===active),rows.findIndex(r=>r.id===active)):labels(rows[0],0);
    return next;
  }
  const api={identity,sort,validate,resolve,prepare};root.ScheduleManager=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
