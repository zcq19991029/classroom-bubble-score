/* Derived criterion grades. Never rewrites score, logs, attendance or schedule. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const round=n=>Math.round((n+Number.EPSILON)*10)/10;
  const numeric=v=>v!==''&&v!==null&&v!==undefined&&Number.isFinite(Number(v));
  const key=s=>s.id?'id:'+s.id:'no:'+s.studentNo;
  // Preserve an explicitly configured legacy fixed benchmark without writing a migration.
  const mode=cfg=>cfg.mode==='manual'||(!cfg.mode&&numeric(cfg.taskTarget)&&Number(cfg.taskTarget)>0)?'manual':'projects';
  function evidence(cfg,s){
    const r=(cfg.students||{})[key(s)]||{},projects=Array.isArray(cfg.projects)?cfg.projects:[];
    if(mode(cfg)==='projects'){
      let earned=0,target=0,pending=0;
      for(const p of projects){if(!String(p.name||'').trim())continue;const max=numeric(p.maximum)&&Number(p.maximum)>0?Number(p.maximum):5,v=p.scores?.[key(s)];if(!numeric(v)){pending++;continue}earned+=Number(v);target+=max;}
      return {earned:target?earned:null,target:target||null,pending,graded:target>0,source:'已评分项目满分自动累计'};
    }
    const target=numeric(cfg.taskTarget)&&Number(cfg.taskTarget)>0?Number(cfg.taskTarget):null,graded=r.status==='graded'&&numeric(r.earned);
    return {target,earned:graded?Number(r.earned):null,pending:graded?0:1,graded,source:'教师固定累计满分'};
  }
  function classified(data,s){let bonus=0,penalty=0,unclassified=0;for(const l of data.logs||[]){if(!(l.studentId===s.id||(!l.studentId&&String(l.no)===String(s.studentNo))))continue;const d=Number(l.delta)||0;if(l.assessmentCategory==='reward')bonus+=d;else if(l.assessmentCategory==='discipline')penalty-=d;else if(l.assessmentCategory!=='task')unclassified++;}return {bonus,penalty,unclassified};}
  const copy=v=>JSON.parse(JSON.stringify(v));
  function append(data,effects,action,label,lesson){data.logs=data.logs||[];for(const effect of effects){const s=data.students.find(s=>key(s)===effect.key);if(!s||!effect.delta)continue;s.score=Math.round(((Number(s.score)||0)+effect.delta)*1e8)/1e8;data.logs.unshift({id:crypto.randomUUID(),studentId:s.id,no:s.studentNo,name:s.name,delta:effect.delta,score:s.score,assessmentCategory:effect.category,assessmentCommand:true,projectId:effect.projectId||null,source:label,action,lesson:lesson||'未标注课节',time:new Date().toISOString(),lessonDate:new Date().toISOString().slice(0,10)});}}
  function commit(data,next,effects,label,lesson){const h=data.criterionHistory||(data.criterionHistory={undo:[],redo:[]}),cmd={before:copy(data.criterionAssessment||{}),after:copy(next),effects:copy(effects),label,lesson};data.criterionAssessment=copy(next);append(data,effects,'record',label,lesson);h.undo.push(cmd);h.redo=[];}
  function travel(data,redo=false){const h=data.criterionHistory;if(!h)return false;const src=redo?h.redo:h.undo,dst=redo?h.undo:h.redo,cmd=src.pop();if(!cmd)return false;data.criterionAssessment=copy(redo?cmd.after:cmd.before);append(data,cmd.effects.map(e=>({...e,delta:e.delta*(redo?1:-1)})),redo?'redo':'undo',(redo?'重做：':'撤销：')+cmd.label,cmd.lesson);dst.push(cmd);return true;}
  function dutyScore(participants,expected){if(!Number.isInteger(participants)||!Number.isInteger(expected)||expected<=0||participants<0||participants>expected)throw Error('参与/应到人数须为有效整数，参与不能超过应到');return Math.round(500*participants/expected)/100;}
  function duty(next,recordKey,ids,participants,expected){const score=dutyScore(participants,expected),old=next.duties?.[recordKey];next.duties=next.duties||{};next.duties[recordKey]={studentKeys:[...ids],participants,expected,score};const keys=new Set([...(old?.studentKeys||[]),...ids]);return [...keys].map(k=>({key:k,category:'reward',delta:Math.round(((ids.includes(k)?score:0)-(old?.studentKeys?.includes(k)?Number(old.score)||0:0))*100)/100}));}
  function calculate(data,s,attendance,coverage){
    const cfg=data.criterionAssessment||{},r=(cfg.students||{})[key(s)]||{};
    const task=evidence(cfg,s),{target,graded,earned}=task,rate=target&&graded?clamp(earned/target,0,1):null,c=classified(data,s);
    const bonus=(numeric(r.bonus)?Number(r.bonus):0)+c.bonus,penalty=(numeric(r.penalty)?Number(r.penalty):0)+c.penalty;
    const performanceRate=target&&graded?clamp((earned+bonus-penalty)/target,0,1):null;
    const learning=performanceRate===null?null:round(40+40*performanceRate);
    const regular=learning===null?null:round(learning+clamp(attendance,0,20));
    const contribution=regular===null?null:round(regular*.4);
    const pass=numeric(data.settings?.passScore)?Number(data.settings.passScore):60;
    const needed=contribution===null?null:Math.max(0,Math.ceil(((pass-contribution)/.6-1e-9)*10)/10);
    const e=data.examScores?.[s.id],exam=numeric(e)&&Number(e)>=0&&Number(e)<=100?Number(e):null;
    const foundation=['met','makeup'].includes(r.foundation)?r.foundation:'pending';
    const reasons=[];
    if(!target)reasons.push(mode(cfg)==='projects'?'项目待录入/无已评分项目':'任务满分待设置');
    if(!graded||task.pending)reasons.push('待批改');
    if(c.unclassified&&!r.legacyReviewed)reasons.push('旧积分未分类，待教师确认');
    if(foundation!=='met')reasons.push(foundation==='makeup'?'待补做':'基础待确认');
    if(!coverage?.complete)reasons.push('考勤未齐/待核对');
    return {key:key(s),task,performanceRate,unclassified:c.unclassified,draftEarned:numeric(r.earned)?Number(r.earned):null,target,earned,rate,bonus,penalty,learning,attendance,regular,contribution,needed,exam,final:exam===null||contribution===null?null:round(contribution+exam*.6),foundation,ready:!reasons.length,reasons,status:graded?'graded':'pending'};
  }
  const api={calculate,key,round,numeric,evidence,classified,commit,travel,duty,dutyScore,mode};
  if(typeof module!=='undefined')module.exports=api;
  root.CriterionAssessment=api;
})(typeof window==='undefined'?globalThis:window);
