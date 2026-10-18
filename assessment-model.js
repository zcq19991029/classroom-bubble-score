/* Derived criterion grades. Never rewrites score, logs, attendance or schedule. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const round=n=>Math.round((n+Number.EPSILON)*10)/10;
  const numeric=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
  const key=s=>s.id?'id:'+s.id:'no:'+s.studentNo;
  const copy=v=>JSON.parse(JSON.stringify(v));
  function append(data,effects,action,label,lesson){data.logs=data.logs||[];for(const effect of effects){const s=data.students.find(s=>key(s)===effect.key);if(!s||!effect.delta)continue;s.score=Math.round(((Number(s.score)||0)+effect.delta)*1e8)/1e8;data.logs.unshift({id:crypto.randomUUID(),studentId:s.id,no:s.studentNo,name:s.name,delta:effect.delta,score:s.score,assessmentCategory:effect.category,assessmentCommand:true,projectId:effect.projectId||null,source:label,action,lesson:lesson||'未标注课节',time:new Date().toISOString(),lessonDate:new Date().toISOString().slice(0,10)});}}
  function commit(data,next,effects,label,lesson){const h=data.criterionHistory||(data.criterionHistory={undo:[],redo:[]}),cmd={before:copy(data.criterionAssessment||{}),after:copy(next),effects:copy(effects),label,lesson};data.criterionAssessment=copy(next);append(data,effects,'record',label,lesson);h.undo.push(cmd);h.redo=[];}
  function travel(data,redo=false){const h=data.criterionHistory;if(!h)return false;const src=redo?h.redo:h.undo,dst=redo?h.undo:h.redo,cmd=src.pop();if(!cmd)return false;data.criterionAssessment=copy(redo?cmd.after:cmd.before);append(data,cmd.effects.map(e=>({...e,delta:e.delta*(redo?1:-1)})),redo?'redo':'undo',(redo?'重做：':'撤销：')+cmd.label,cmd.lesson);dst.push(cmd);return true;}
  function dutyScore(participants,expected){if(!Number.isInteger(participants)||!Number.isInteger(expected)||expected<=0||participants<0||participants>expected)throw Error('参与/应到人数须为有效整数，参与不能超过应到');return Math.round(500*participants/expected)/100;}
  function duty(next,recordKey,ids,participants,expected){const score=dutyScore(participants,expected),old=next.duties?.[recordKey];next.duties=next.duties||{};next.duties[recordKey]={studentKeys:[...ids],participants,expected,score};const keys=new Set([...(old?.studentKeys||[]),...ids]);return [...keys].map(k=>({key:k,category:'reward',delta:Math.round(((ids.includes(k)?score:0)-(old?.studentKeys?.includes(k)?Number(old.score)||0:0))*100)/100}));}
  // Attendance units are direct points out of 48, independent of schedule length.
  function attendanceFacts(data,s,options={}){
    const latest=new Map();let unknown=false;
    for(const a of data.attendance||[]){if(!(a.studentId===s.id||(!a.studentId&&String(a.no)===String(s.studentNo))))continue;
      const resolved=options.resolve?.(a.lessonId||a.lesson),lesson=resolved||a.lessonId||a.lesson;
      if(!lesson)unknown=true;const k=lesson||('unknown:'+a.id);
      const old=latest.get(k);if(!old||String(a.time||'')>String(old.time||''))latest.set(k,a);
    }
    let loss=0,actualTruant=0,lateEarly=0;
    for(const a of latest.values()){
      let deduction;
      if(numeric(a.deduction))deduction=Number(a.deduction);
      else if(options.deduction)deduction=options.deduction(a.status,a);
      else if(['签到','请假'].includes(a.status))deduction=0;
      else if(a.status==='迟到')deduction=numeric(data.settings?.absenceDeduction)?Number(data.settings.absenceDeduction):1;
      else if(['旷课','缺勤'].includes(a.status))deduction=numeric(data.settings?.truantDeduction)?Number(data.settings.truantDeduction):3;
      else deduction=Number((data.settings?.customAttendanceRules||[]).find(r=>r.name===a.status)?.deduction)||0;
      loss+=Math.max(0,Number(deduction)||0);
      if(a.status==='旷课'&&lessonKnown(a))actualTruant++;
      if(['迟到','早退'].includes(a.status)&&lessonKnown(a))lateEarly++;
    }
    function lessonKnown(a){return !!(a.lessonId||a.lesson)}
    const totalTruant=actualTruant;
    return {loss:round(loss),score:round(clamp(48-loss,0,48)),actualTruant,lateEarly,totalTruant,failed:totalTruant>=3,unknown};
  }
  function calculate(data,s,attendance,coverage,facts){
    const r=data.criterionAssessment?.students?.[key(s)]||{};
    const target=Math.max(0,...(data.students||[]).map(x=>numeric(x.score)?Number(x.score):0));
    const earned=numeric(s.score)?Number(s.score):0,rate=target>0?clamp(earned/target,0,1):0;
    facts=facts||attendanceFacts(data,s);
    const learning=round(52*rate),att=numeric(attendance)?clamp(Number(attendance),0,48):facts.score;
    const regular=round(learning+att),contribution=round(regular*.4);
    const pass=numeric(data.settings?.passScore)?Number(data.settings.passScore):60;
    const needed=facts.failed?null:Math.max(0,Math.ceil(((pass-contribution)/.6-1e-9)*10)/10);
    const e=data.examScores?.[s.id],exam=numeric(e)&&Number(e)>=0&&Number(e)<=100?Number(e):null;
    const foundation=['met','makeup'].includes(r.foundation)?r.foundation:'pending',reasons=[];
    if(!target)reasons.push('本班尚无正累计积分，学习暂按0');
    if(foundation!=='met')reasons.push(foundation==='makeup'?'待补做':'基础待确认');
    if(!coverage?.complete)reasons.push('考勤未齐，按已登记记录预估');
    if(facts.unknown)reasons.push('存在未关联课次的考勤，次数待核对');
    const final=exam===null?null:round(contribution+exam*.6);
    return {key:key(s),target,earned,rate,learning,attendance:round(att),regular,contribution,needed,exam,final,foundation,ready:!reasons.length,reasons,attendanceFacts:facts,attendanceFailed:facts.failed,result:facts.failed?'考勤挂科（旷课累计达到3大节）':final===null?'待考':reasons.length?'预估/待复核':final>=pass?'及格':'不及格'};
  }
  const api={calculate,attendanceFacts,key,round,numeric,commit,travel,duty,dutyScore};
  if(typeof module!=='undefined')module.exports=api;
  root.CriterionAssessment=api;
})(typeof window==='undefined'?globalThis:window);
