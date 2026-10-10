(function(){
  'use strict';
  function apply(){
    const bridge=window.classroomCloudBridge;
    if(!bridge||!bridge.getData)return;
    const data=bridge.getData()||{};
    const ids=new Set(Object.values(data.grouping?.committee||{}).filter(Boolean).map(String));
    document.querySelectorAll('#stage .bubble-wrap').forEach(el=>{
      const id=el.dataset.studentId;
      const on=!!id&&ids.has(String(id));
      el.classList.toggle('committee-member',on);
      let crown=el.querySelector('.committee-crown');
      if(on&&!crown){crown=document.createElement('span');crown.className='committee-crown';crown.textContent='👑';crown.setAttribute('aria-label','班委');el.querySelector('.bubble')?.append(crown)}
      if(!on)crown?.remove();
    });
  }
  document.addEventListener('DOMContentLoaded',()=>{
    const css=document.createElement('style');
    css.textContent='.bubble-wrap.committee-member{z-index:60!important}.bubble-wrap.committee-member .bubble{transform:scale(1.12);box-shadow:0 0 0 3px rgba(238,184,55,.72),0 15px 35px rgba(209,153,34,.32)}.committee-crown{position:absolute;right:-4px;top:-12px;font-size:24px;z-index:4;filter:drop-shadow(0 2px 2px #fff)}';
    document.head.append(css);
    const stage=document.querySelector('#stage');
    window.refreshCommitteeHome=apply;
    if(stage){new MutationObserver(apply).observe(stage,{childList:true,subtree:true});setTimeout(apply,500)}
  });
})();
