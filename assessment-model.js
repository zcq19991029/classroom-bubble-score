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
  const attendanceDefaults=Object.freeze({'签到':0,'请假':0,'公假':0,'迟到':1,'早退':1,'旷课':3,'缺勤':3});
  function attendancePolicy(payload={}){
    if(payload.attendancePolicy?.version===1)return copy(payload.attendancePolicy);
    const candidates=new Map();
    const classes=[...Object.values(payload.classes||{}),...(payload.archivedClasses||[]).map(x=>x.data||x.classData||x)];
    for(const c of classes)for(const r of c.settings?.customAttendanceRules||[]){if(Object.hasOwn(attendanceDefaults,r.name)||!numeric(r.deduction))continue;if(!candidates.has(r.name))candidates.set(r.name,new Set());candidates.get(r.name).add(Math.max(0,Number(r.deduction)));}
    return {version:1,customRules:[...candidates].map(([name,values])=>({name,deduction:values.size===1?[...values][0]:null,needsReview:values.size!==1})),retiredRules:[]};
  }
  function attendanceDeduction(settings={},status,record){
    if(Object.hasOwn(attendanceDefaults,status))return attendanceDefaults[status];
    const shared=settings.attendancePolicy?.customRules?.find(r=>r.name===status)||settings.attendancePolicy?.retiredRules?.find(r=>r.name===status);
    if(numeric(shared?.deduction))return Math.max(0,Number(shared.deduction));
    if(numeric(record?.deduction))return Math.max(0,Number(record.deduction));
    const custom=(settings.customAttendanceRules||[]).find(r=>r.name===status);
    return Math.max(0,Number(custom?.deduction)||0);
  }
  function attendanceFacts(data,s,options={}){
    const latest=new Map();let unknown=false;
    function resolve(a){
      const resolved=attendanceLesson(data,a);
      return resolved.known?resolved.key:null;
    }
    for(const a of data.attendance||[]){if(!(a.studentId===s.id||(!a.studentId&&String(a.no)===String(s.studentNo))))continue;
      if(attendanceLesson(data,a).ignored)continue;
      const lesson=resolve(a);
      if(!lesson)unknown=true;const k=lesson||('unknown:'+(a.id||latest.size));
      const old=latest.get(k);if(!old||String(a.time||'')>String(old.record.time||''))latest.set(k,{record:a,known:!!lesson});
    }
    let loss=0,actualTruant=0,late=0,early=0;
    for(const {record:a,known} of latest.values()){
      if(options.policy?.customRules?.some(r=>r.name===a.status&&r.needsReview))unknown=true;
      const deduction=options.deduction?options.deduction(a.status,a):attendanceDeduction(data.settings,a.status,a);
      loss+=Math.max(0,Number(deduction)||0);
      if(a.status==='旷课'&&known)actualTruant++;
      if(a.status==='迟到'&&known)late++;
      if(a.status==='早退'&&known)early++;
    }
    const lateEarly=late+early,convertedTruant=Math.floor(lateEarly/3),remainder=lateEarly%3,totalTruant=actualTruant+convertedTruant;
    return {loss:round(loss),score:round(clamp(48-loss,0,48)),actualTruant,late,early,lateEarly,convertedTruant,remainder,totalTruant,failed:totalTruant>=3,unknown};
  }
  function calculate(data,s,attendance,coverage,facts){
    const r=data.criterionAssessment?.students?.[key(s)]||{};
    const target=Math.max(0,...(data.students||[]).map(x=>numeric(x.score)?Number(x.score):0));
    const earned=numeric(s.score)?Number(s.score):0,rate=target>0?clamp(earned/target,0,1):0;
    facts=facts||attendanceFacts(data,s);
    const learning=round(52*rate),att=numeric(attendance)?clamp(Number(attendance),0,48):facts.score;
    const regular=round(learning+att),contributionRaw=regular*.4,contribution=round(contributionRaw);
    const pass=numeric(data.settings?.passScore)?Number(data.settings.passScore):60;
    const needed=facts.failed?null:Math.max(0,Math.ceil(((pass-contributionRaw)/.6-1e-9)*10)/10);
    const e=data.examScores?.[s.id],exam=numeric(e)&&Number(e)>=0&&Number(e)<=100?Number(e):null;
    const foundation=['met','makeup'].includes(r.foundation)?r.foundation:'pending',reasons=[];
    if(!target)reasons.push('本班尚无正累计积分，学习暂按0');
    if(!coverage?.complete)reasons.push('考勤未齐，按已登记记录预估');
    if(facts.unknown)reasons.push('存在未关联课次的考勤，次数待核对');
    const final=exam===null?null:round(contributionRaw+exam*.6);
    return {key:key(s),target,earned,rate,learning,attendance:round(att),regular,contribution,contributionRaw,needed,exam,final,foundation,ready:!reasons.length,reasons,attendanceFacts:facts,attendanceFailed:facts.failed,result:facts.failed?'考勤挂科（实际＋折算旷课达到3次）':final===null?'待考':reasons.length?'预估/待复核':final>=pass?'及格':'不及格'};
  }
  function attendanceLesson(data,a){
    const review=a.id&&data.attendanceReview?.[a.id];
    if(review?.action==='ignore')return {key:'ignored:'+a.id,known:false,ignored:true,label:(a.lesson||'未标注课节')+'（已忽略）',date:a.date||''};
    if(review?.action==='assign'){const target=attendanceTargets(data).find(t=>t.key===review.lessonKey);if(target)return {...target,known:true,reviewed:true};return {key:'review-invalid:'+a.id,known:false,label:(a.lesson||'未标注课节')+'（核对归属已失效）',date:a.date||''};}
    const rows=[...(data.lessonSchedule||[]),...(data.archivedLessons||[])],identity=v=>String(v||'').replace(/第\d+周\s*·\s*/,'').trim();
    let row=a.lessonId?rows.find(r=>r.id===a.lessonId):null;
    if(!row){const hits=rows.filter(r=>(r.aliases||[]).some(v=>identity(v)===identity(a.lesson)));if(hits.length===1)row=hits[0];}
    // Legacy custom schedules have no ids/aliases. Match the displayed lesson's
    // date, period, class AND course, never its data-entry date or sequence number.
    if(!row){const m=identity(a.lesson).match(/^第\d+节课\s*·\s*(\d{1,2})月(\d{1,2})日星期[一二三四五六日天]\s*·\s*([^·]+?)\s*·\s*(\d{1,2}-\d{1,2})节\s*·\s*(.+)$/);if(m&&m[3].trim()===String(data.className||'').trim()){const dateSuffix='-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0'),hits=rows.filter(r=>/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&r.date.endsWith(dateSuffix)&&r.period===m[4]&&String(r.course||'').trim()===m[5].trim());if(hits.length===1)row=hits[0];}}
    if(row&&row.id!=null&&String(row.id).trim())return {key:'lesson:'+row.id,known:true,label:row.aliases?.at(-1)||a.lesson||[row.date,row.period,row.course].filter(Boolean).join(' · '),date:row.date||''};
    if(row&&/^\d{4}-\d{2}-\d{2}$/.test(row.date||'')&&/^\d{1,2}-\d{1,2}$/.test(row.period||'')&&String(row.course||'').trim()&&data.className)return {key:'legacy:'+JSON.stringify([data.className,row.date,row.period,row.course]),known:true,label:row.aliases?.at(-1)||a.lesson,date:row.date};
    return {key:'unknown:'+String(a.date||'')+'|'+String(a.lesson||'未标注课节'),known:false,label:(a.lesson||'未标注课节')+'（课次待核对）',date:a.date||''};
  }
  function attendanceGroups(data){
    const groups=new Map();for(const [index,a] of (data.attendance||[]).entries()){const lesson=attendanceLesson(data,a);if(!groups.has(lesson.key))groups.set(lesson.key,{...lesson,latest:new Map(),records:[]});const g=groups.get(lesson.key),student=a.studentId?'id:'+a.studentId:a.no!=null&&String(a.no).trim()?'no:'+a.no:'unidentified:'+index,old=g.latest.get(student);g.records.push(a);if(!lesson.ignored&&(!old||String(a.time||'')>String(old.time||'')))g.latest.set(student,a);}
    return [...groups.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.key.localeCompare(b.key)).map(g=>({...g,records:[...g.records].sort((a,b)=>String(b.time||'').localeCompare(String(a.time||''))),items:[...g.latest.values()].sort((a,b)=>String(a.no).localeCompare(String(b.no),undefined,{numeric:true}))}));
  }
  function attendanceCoverage(data,s,date){
    const due=(data.lessonSchedule||[]).filter(r=>r.date&&r.date<=date),known=new Set();
    for(const a of data.attendance||[]){if(!(a.studentId===s.id||(!a.studentId&&String(a.no)===String(s.studentNo))))continue;const r=attendanceLesson(data,a);if(r.known)known.add(r.key);}
    return {complete:due.length>0&&due.every(r=>{const ref=r.id?'lesson:'+r.id:'legacy:'+JSON.stringify([data.className,r.date,r.period,r.course]);return known.has(ref)})};
  }
  function attendanceTargets(data){
    const targets=new Map();for(const r of [...(data.lessonSchedule||[]),...(data.archivedLessons||[])]){const stable=r.id!=null&&String(r.id).trim(),valid=/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&/^\d{1,2}-\d{1,2}$/.test(r.period||'')&&r.course&&data.className;if(!stable&&!valid)continue;const key=stable?'lesson:'+r.id:'legacy:'+JSON.stringify([data.className,r.date,r.period,r.course]);if(!targets.has(key))targets.set(key,{key,label:[r.date,r.period&&r.period+'节',r.course,r.cancelled?'已归档':''].filter(Boolean).join(' · ')||r.aliases?.at(-1)||String(r.id),date:r.date||''});}return [...targets.values()];
  }
  function reviewAttendance(data,ids,action,lessonKey){
    if(!['assign','ignore','clear'].includes(action))throw Error('无效的核对操作');
    if(action==='assign'&&!attendanceTargets(data).some(t=>t.key===lessonKey))throw Error('请选择当前班级有效课次');
    const records=ids.map(id=>{const hits=(data.attendance||[]).filter(a=>a.id===id);if(!id||hits.length!==1)throw Error('记录身份缺失或重复，不能自动核对');return hits[0]});if(!records.length)throw Error('请先勾选待核对记录');
    const before=copy(data.attendanceReview||{}),next=copy(before),time=new Date().toISOString();for(const r of records){if(action==='clear')delete next[r.id];else next[r.id]={action,...(action==='assign'?{lessonKey}:{}),reviewedAt:time};}
    data.attendanceReview=next;data.attendanceReviewHistory=data.attendanceReviewHistory||[];data.attendanceReviewHistory.push({before,after:copy(next),time});
  }
  function undoAttendanceReview(data){const last=data.attendanceReviewHistory?.pop();if(!last)return false;data.attendanceReview=copy(last.before);return true;}
  const api={calculate,attendanceFacts,attendanceDeduction,attendanceDefaults,attendancePolicy,attendanceLesson,attendanceGroups,attendanceCoverage,attendanceTargets,reviewAttendance,undoAttendanceReview,key,round,numeric,commit,travel,duty,dutyScore};
  if(typeof module!=='undefined')module.exports=api;
  root.CriterionAssessment=api;
})(typeof window==='undefined'?globalThis:window);
