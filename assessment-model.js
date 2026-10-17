/* Derived criterion grades. Never rewrites score, logs, attendance or schedule. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const round=n=>Math.round((n+Number.EPSILON)*10)/10;
  const numeric=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
  const key=s=>s.id?'id:'+s.id:'no:'+s.studentNo;
  function calculate(data,s,attendance,coverage){
    const cfg=data.criterionAssessment||{},r=(cfg.students||{})[key(s)]||{};
    const target=numeric(cfg.taskTarget)&&Number(cfg.taskTarget)>0?Number(cfg.taskTarget):null;
    const graded=r.status==='graded'&&numeric(r.earned)&&Number(r.earned)>=0;
    const earned=graded?Number(r.earned):null,rate=target&&graded?clamp(earned/target,0,1):null;
    const bonus=clamp(numeric(r.bonus)?Number(r.bonus):0,0,5),penalty=Math.max(0,numeric(r.penalty)?Number(r.penalty):0);
    const learning=rate===null?null:round(40+clamp(40*rate+bonus-penalty,0,40));
    const regular=learning===null?null:round(learning+clamp(attendance,0,20));
    const contribution=regular===null?null:round(regular*.4);
    const pass=numeric(data.settings?.passScore)?Number(data.settings.passScore):60;
    const needed=contribution===null?null:Math.max(0,Math.ceil(((pass-contribution)/.6-1e-9)*10)/10);
    const e=data.examScores?.[s.id],exam=numeric(e)&&Number(e)>=0&&Number(e)<=100?Number(e):null;
    const foundation=['met','makeup'].includes(r.foundation)?r.foundation:'pending';
    const reasons=[];
    if(!target)reasons.push('任务满分待设置');
    if(!graded)reasons.push('待批改');
    if(foundation!=='met')reasons.push(foundation==='makeup'?'待补做':'基础待确认');
    if(!coverage?.complete)reasons.push('考勤未齐/待核对');
    return {key:key(s),draftEarned:numeric(r.earned)?Number(r.earned):null,target,earned,rate,bonus,penalty,learning,attendance,regular,contribution,needed,exam,final:exam===null||contribution===null?null:round(contribution+exam*.6),foundation,ready:!reasons.length,reasons,status:graded?'graded':'pending'};
  }
  const api={calculate,key,round,numeric};
  if(typeof module!=='undefined')module.exports=api;
  root.CriterionAssessment=api;
})(typeof window==='undefined'?globalThis:window);
