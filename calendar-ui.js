(() => {
  const e=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const entry=document.createElement('button');entry.className='btn';entry.id='calendarEntry';entry.textContent='校历整天调课';
  document.querySelector('#feedbackEntry')?.after(entry);
  if(!entry.isConnected)document.querySelector('#accountBtn').after(entry);
  const modal=document.createElement('div');modal.className='overlay';modal.id='calendarModal';
  modal.innerHTML=`<section class="panel small"><div class="panel-head"><div><h2>校历整天调课</h2><p>选择原日期和新日期，同一天所有课程保持各自节次</p></div><button class="close" id="calendarClose">×</button></div><div class="form"><p>学校统一通知：选“本账号全部班级” → 原日期 → 新日期 → 预览 → 确认。只处理自己账号的班级，不修改其他教师数据。学期基准不变。</p><label>适用范围 <select id="calendarScope"><option value="all">本账号全部班级</option><option value="current">仅当前班级</option></select></label><label>原日期 <input type="date" id="calendarFrom"></label><label>新日期 <input type="date" id="calendarTo"></label><button class="btn primary" id="calendarPreview">预览整天调课</button><details><summary>2026秋季校历修正</summary><p>9/28—30移至12/21—23；10/10补10/7周三，不补10/6。取消的已记录课次归档保留，不改积分、考勤和日志。正常10/8周四课程保留。此按钮核对本账号已有的五个教学班；不会修改测试班。</p><button class="btn" id="calendarRepair">预览统一修正五个班</button></details><div id="calendarResult" aria-live="polite"></div></div></section>`;
  document.body.append(modal);const result=modal.querySelector('#calendarResult');let busy=false;
  entry.onclick=()=>modal.classList.add('show');
  modal.querySelector('#calendarClose').onclick=()=>{if(busy)return;window.schoolCalendarCloud?.cancel();result.innerHTML='';modal.classList.remove('show')};
  async function preview(repair){
    if(busy)return;busy=true;result.textContent='正在读取云端课表…';
    try{
      const p=await window.schoolCalendarCloud.preview({repair,all:repair||modal.querySelector('#calendarScope').value==='all',from:modal.querySelector('#calendarFrom').value,to:modal.querySelector('#calendarTo').value});
      if(!p.changes.length){result.textContent='所有目标班级均无需调整，未写入云端。';return}
      result.innerHTML=p.changes.map(c=>`<p><b>${e(c.className)}</b> · 保存后${c.count}次课<br>${c.moved.map(r=>`${e(r.from)} → ${e(r.to)} · ${e(r.period)}节`).concat(c.removed.map(r=>`取消并保留历史：${e(r.date)} · ${e(r.period)}节`),c.added.map(r=>`新增补课：${e(r.date)} · ${e(r.period)}节`)).join('<br>')}</p>`).join('')+'<p>预览未写入。确认后一次保存全部受影响班级；保存前自动下载全班备份。冲突或失败不覆盖旧数据。</p><button class="btn primary" id="calendarConfirm">确认全部并保存云端</button><button class="btn" id="calendarCancel">取消预览</button>';
      result.querySelector('#calendarCancel').onclick=()=>{window.schoolCalendarCloud.cancel();result.innerHTML=''};
      result.querySelector('#calendarConfirm').onclick=async()=>{
        if(busy)return;busy=true;const button=result.querySelector('#calendarConfirm');button.disabled=true;
        const shield=document.createElement('div');shield.id='calendarShield';shield.style.cssText='position:fixed;inset:0;z-index:99999;background:#ffffffdd;display:grid;place-items:center';shield.textContent='正在保存全部课表…';document.body.append(shield);
        try{window.schoolCalendarCloud.backup();await window.schoolCalendarCloud.save();result.textContent='保存成功：全部受影响课表已同步云端，历史记录保留。'}catch(err){const msg=document.createElement('p');msg.textContent='保存失败，原数据未覆盖：'+err.message;result.append(msg);button.disabled=false}finally{shield.remove();busy=false}
      };
    }catch(err){result.textContent='未保存：'+err.message}finally{busy=false}
  }
  modal.querySelector('#calendarPreview').onclick=()=>preview(false);
  modal.querySelector('#calendarRepair').onclick=()=>preview(true);
})();
