// Grouping UI v2: homepage bubble visual and pointer-capture dragging.
(function(){
  'use strict';
  const M=window.GroupingModel;
  let modal,data,state,nodes=[],raf=0,lastFrame=0,dragSession=null,activeGroupId='';
  const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const student=id=>data.students.find(item=>String(item.id)===String(id));
  const groupFor=id=>id==='unassigned'?null:state.groups.find(group=>group.id===id);
  const shortNo=(value,index)=>{const digits=String(value??'').replace(/\D/g,'');return digits?digits.slice(-2).padStart(2,'0'):String(index+1).padStart(2,'0')};
  const scoreFor=s=>Number(s?.score||0);
  const setMessage=(text,kind='')=>{const el=modal?.querySelector('.group-message');if(el){el.textContent=text||'';el.className=`group-message ${kind}`}};
  const groupStudentIds=id=>id==='unassigned'?(state.unassignedIds||[]):(groupFor(id)?.studentIds||[]);
  const isLeader=id=>state.groups.some(group=>String(group.leaderId||'')===String(id));

  function bubbleHtml(id,index,isPublic){
    const s=student(id);if(!s)return '';
    const leader=isLeader(id);
    return `<div class="bubble-wrap group-student ${isPublic?'public-student':'group-zone-student'} ${leader?'group-leader':''}" data-student="${esc(id)}" tabindex="0" role="button" aria-label="${esc(s.name)}，学号${esc(s.studentNo||'')}${leader?'，组长':''}"><div class="bubble"><span class="emoji">${esc(s.emoji||'😊')}</span><span class="score">${scoreFor(s)}</span>${leader?'<span class="group-leader-mark" aria-hidden="true">★</span>':''}</div><div class="student-label"><span class="no">${esc(shortNo(s.studentNo,index))}</span>${esc(s.name)}</div></div>`;
  }
  function zoneHtml(id,title,max){
    const ids=groupStudentIds(id),count=id==='unassigned'?`${ids.length} 人`:`${ids.length}/${max}`;
    return `<section class="group-zone ${id==='unassigned'?'public-zone':''}" data-zone="${esc(id)}"><header><div><b>${esc(title)}</b><span>${count}</span></div>${id!=='unassigned'?`<label>上限 <input data-max="${esc(id)}" type="number" min="1" max="100" value="${max}" ${state.locked?'disabled':''}></label>`:''}</header><div class="zone-canvas"><div class="zone-hint">${id==='unassigned'?'拖入任意小组':'拖入学生；长按设置组长'}</div>${ids.map((studentId,index)=>bubbleHtml(studentId,index,id==='unassigned')).join('')}</div></section>`;
  }
  function render(){
    if(!modal)return;
    if(!state.groups.some(group=>group.id===activeGroupId))activeGroupId=state.groups[0]?.id||'';
    modal.querySelector('.group-count').value=state.groups.length;
    const lock=modal.querySelector('.group-lock');lock.textContent=state.locked?'🔒 分组已锁定':'🔓 已解锁，可拖动设置';lock.classList.toggle('unlocked',!state.locked);
    modal.querySelector('[data-resize]').disabled=state.locked;
    const active=state.groups.find(group=>group.id===activeGroupId);
    modal.querySelector('.group-layout').innerHTML=`<nav class="group-tabs" aria-label="选择分组">${state.groups.map(group=>`<button type="button" class="group-tab ${group.id===activeGroupId?'active':''}" data-group-tab="${esc(group.id)}">${esc(group.name)} <span>${group.studentIds.length}/${group.max}</span></button>`).join('')}</nav><div class="group-columns">${zoneHtml('unassigned','公共池',0)}${active?zoneHtml(active.id,active.name,active.max):''}</div>`;
    modal.querySelectorAll('[data-group-tab]').forEach(button=>button.onclick=()=>{activeGroupId=button.dataset.groupTab;releaseAll();render();setMessage(`当前编辑：${state.groups.find(group=>group.id===activeGroupId)?.name||''}`,'ok')});
    modal.querySelector('.committee').innerHTML='<h3>班委设置</h3>'+M.ROLES.map(role=>`<label>${esc(role)}<select data-role="${esc(role)}" ${state.locked?'disabled':''}><option value="">未设置</option>${data.students.map(s=>`<option value="${esc(s.id)}" ${state.committee[role]===String(s.id)?'selected':''}>${esc(s.studentNo)} ${esc(s.name)}</option>`).join('')}</select></label>`).join('');
    requestAnimationFrame(()=>{createPhysicsNodes();startPhysics()});
  }
  function createPhysicsNodes(){
    nodes=[];modal.querySelectorAll('.group-zone').forEach(zone=>{const canvas=zone.querySelector('.zone-canvas'),isPublic=zone.classList.contains('public-zone'),metrics=isPublic?{nodeWidth:82,diameter:76,height:108,gap:82}:{nodeWidth:90,diameter:84,height:118,gap:90};zone.querySelectorAll('[data-student]').forEach((el,index)=>{const id=String(el.dataset.student),n={id,zone:zone.dataset.zone,el,canvas,metrics,x:18+(index%Math.max(1,Math.floor((canvas.clientWidth-20)/metrics.gap)))*metrics.gap,y:18+Math.floor(index/Math.max(1,Math.floor((canvas.clientWidth-20)/metrics.gap)))*metrics.gap,vx:0,vy:0,r:metrics.diameter/2,dragging:false,pointerId:null,moved:false,longPressed:false,pressTimer:null,grabX:0,grabY:0,lastPX:0,lastPY:0,lastPT:0};el.style.transform=`translate3d(${n.x}px,${n.y}px,0)`;nodes.push(n);bindBubble(n)})});
  }
  function targetZoneAt(x,y,ignore){const zones=(document.elementsFromPoint?.(x,y)||[]).map(el=>el.closest?.('.group-zone')).filter(Boolean);return zones.find(zone=>!ignore||zone.dataset.zone!==ignore.zone)||zones[0]||null}
  function targetIsBlocked(zone,n){if(!zone||zone.dataset.zone==='unassigned')return false;const group=groupFor(zone.dataset.zone);return !!group&&group.studentIds.length>=group.max&&!group.studentIds.includes(n.id)}
  function setPreview(zone,n){modal.querySelectorAll('.group-zone').forEach(item=>{const active=!!zone&&item===zone;item.classList.toggle('target-preview',active&&!targetIsBlocked(zone,n));item.classList.toggle('drop-blocked',active&&targetIsBlocked(zone,n))})}
  function restoreNodeStyle(n){n.el.style.position='';n.el.style.left='';n.el.style.top='';n.el.style.pointerEvents='';n.el.style.transform=`translate3d(${n.x}px,${n.y}px,0)`}
  function finishDrag(n,event,cancelled=false){
    if(!dragSession||dragSession.node!==n||event?.pointerId!==n.pointerId)return;
    clearTimeout(n.pressTimer);const session=dragSession;dragSession=null;n.pointerId=null;n.el.classList.remove('dragging');modal.querySelectorAll('.group-zone').forEach(zone=>zone.classList.remove('target-preview','drop-blocked'));try{n.el.releasePointerCapture?.(session.pointerId)}catch(_){ }
    if(cancelled||!session.moved||session.longPressed){n.dragging=false;restoreNodeStyle(n);startPhysics();return}
    const zone=targetZoneAt(event.clientX,event.clientY,n);
    if(!zone||targetIsBlocked(zone,n)||zone.dataset.zone===session.source){n.dragging=false;restoreNodeStyle(n);startPhysics();return}
    try{if(zone.dataset.zone==='unassigned')M.remove(state,n.id);else M.add(state,n.id,zone.dataset.zone);setMessage(`已移动 ${student(n.id)?.name||''}；保存后同步云端`,'ok');render()}catch(error){n.dragging=false;setMessage(error.message,'error');render()}
  }
  function bindBubble(n){
    const el=n.el;
    el.addEventListener('pointerdown',event=>{if(state.locked||event.button!==0||dragSession)return;event.preventDefault();event.stopPropagation();const rect=n.canvas.getBoundingClientRect();n.dragging=true;n.pointerId=event.pointerId;n.moved=false;n.longPressed=false;n.lastPX=event.clientX;n.lastPY=event.clientY;n.lastPT=performance.now();n.grabX=event.clientX-rect.left-n.x;n.grabY=event.clientY-rect.top-n.y;n.vx=n.vy=0;dragSession={node:n,pointerId:event.pointerId,source:n.zone,moved:false,longPressed:false};el.style.position='fixed';el.style.left='0';el.style.top='0';el.style.transform=`translate3d(${event.clientX-n.grabX}px,${event.clientY-n.grabY}px,0)`;n.pressTimer=setTimeout(()=>{if(!dragSession||dragSession.node!==n||dragSession.moved)return;dragSession.longPressed=true;n.longPressed=true;n.dragging=false;try{el.releasePointerCapture?.(n.pointerId)}catch(_){ }n.pointerId=null;el.classList.remove('dragging');restoreNodeStyle(n);const group=groupFor(n.zone);if(group){if(String(group.leaderId||'')===n.id){group.leaderId=null;setMessage(`已取消 ${student(n.id)?.name||''} 的组长身份`,'ok')}else{M.leader(state,n.zone,n.id);setMessage(`已将 ${student(n.id)?.name||''} 设为${group.name}组长`,'ok')}render()}dragSession=null},620);el.classList.add('dragging');el.setPointerCapture?.(event.pointerId)});
    el.addEventListener('pointermove',event=>{if(!dragSession||dragSession.node!==n||event.pointerId!==n.pointerId)return;const movement=Math.hypot(event.clientX-n.lastPX,event.clientY-n.lastPY);if(!dragSession.moved&&movement<4)return;dragSession.moved=true;clearTimeout(n.pressTimer);const rect=n.canvas.getBoundingClientRect(),now=performance.now(),dt=Math.max(8,now-n.lastPT)/1000;n.x=Math.max(2,Math.min(n.canvas.clientWidth-n.metrics.nodeWidth,event.clientX-rect.left-n.grabX));n.y=Math.max(2,Math.min(n.canvas.clientHeight-n.metrics.height,event.clientY-rect.top-n.grabY));n.vx=Math.max(-900,Math.min(900,(event.clientX-n.lastPX)/dt*.82));n.vy=Math.max(-900,Math.min(900,(event.clientY-n.lastPY)/dt*.82));n.lastPX=event.clientX;n.lastPY=event.clientY;n.lastPT=now;el.style.transform=`translate3d(${event.clientX-n.grabX}px,${event.clientY-n.grabY}px,0)`;setPreview(targetZoneAt(event.clientX,event.clientY,n),n)});
    el.addEventListener('pointerup',event=>finishDrag(n,event,false));el.addEventListener('pointercancel',event=>finishDrag(n,event,true));el.addEventListener('lostpointercapture',event=>{if(dragSession?.node===n)finishDrag(n,event,true)});
  }
  function tick(now){if(!modal?.classList.contains('open'))return;const dt=Math.min(.025,Math.max(0,(now-lastFrame)/1000));lastFrame=now;for(const zone of modal.querySelectorAll('.group-zone')){const canvas=zone.querySelector('.zone-canvas'),list=nodes.filter(node=>node.zone===zone.dataset.zone&&!node.dragging);if(list.length){const metrics=list[0].metrics;window.BubblePhysics?.step(list,dt,{width:canvas.clientWidth,ground:Math.max(2,canvas.clientHeight-metrics.height),gravityY:95,nodeWidth:metrics.nodeWidth,diameter:metrics.diameter})}}for(const n of nodes)if(!n.dragging)n.el.style.transform=`translate3d(${n.x}px,${n.y}px,0)`;raf=requestAnimationFrame(tick)}
  function startPhysics(){cancelAnimationFrame(raf);lastFrame=performance.now();raf=requestAnimationFrame(tick)}
  async function save(){const button=modal.querySelector('[data-save]');button.disabled=true;try{const old=JSON.parse(JSON.stringify(data)),next=JSON.parse(JSON.stringify(data));next.grouping=state;await window.saveScheduleCloud(next,old);window.classroomCloudBridge.setData(next);data=next;setMessage('保存成功，云端已同步','ok')}catch(error){setMessage(`保存失败：${error.message}（原数据未覆盖）`,'error')}finally{button.disabled=false}}
  function resizeGroups(){if(state.locked)return;const count=Math.max(1,Math.min(30,Number(modal.querySelector('.group-count').value)||1));while(state.groups.length<count){const index=state.groups.length+1;state.groups.push({id:`group-${index}`,name:`第${index}组`,max:4,studentIds:[],leaderId:null})}while(state.groups.length>count){const group=state.groups.pop();state.unassignedIds.push(...group.studentIds)}state.groupCount=count;if(!state.groups.some(group=>group.id===activeGroupId))activeGroupId=state.groups[0]?.id||'';render()}
  function releaseAll(event){if(!dragSession)return;const n=dragSession.node;clearTimeout(n.pressTimer);dragSession=null;n.dragging=false;n.pointerId=null;n.el.classList.remove('dragging');restoreNodeStyle(n);modal.querySelectorAll('.group-zone').forEach(zone=>zone.classList.remove('target-preview','drop-blocked'));try{n.el.releasePointerCapture?.(event?.pointerId)}catch(_){ }startPhysics()}
  function open(){data=JSON.parse(JSON.stringify(window.classroomCloudBridge.getData()));state=M.normalize(data.grouping,data.students);state.locked=state.locked!==false;activeGroupId=state.groups[0]?.id||'';modal.classList.add('open');render();setMessage(state.locked?'分组默认锁定，请先解锁后修改':'已解锁，可拖动分组')}
  function init(){
    const entry=document.createElement('button');entry.className='btn';entry.id='groupingEntry';entry.textContent='分组与班委';document.querySelector('#rosterManageBtn')?.after(entry);entry.onclick=open;
    modal=document.createElement('div');modal.id='groupingModal';modal.innerHTML='<section class="grouping-panel"><button class="grouping-close" aria-label="关闭">×</button><h2>分组与班委</h2><p class="group-note">分组页使用主页同款气泡。默认锁定，解锁后可用鼠标拖动；长按组内气泡设置或取消组长。</p><div class="group-toolbar"><label>分组数 <input class="group-count" type="number" min="1" max="30"></label><button data-resize>调整组数</button><button class="group-lock" type="button">🔒 分组已锁定</button><button data-save>保存到云端</button></div><p class="group-message"></p><div class="group-layout"></div><aside class="committee"></aside></section>';document.body.append(modal);
    modal.querySelector('.grouping-close').onclick=()=>{modal.classList.remove('open');releaseAll();cancelAnimationFrame(raf)};modal.querySelector('[data-save]').onclick=save;modal.querySelector('[data-resize]').onclick=resizeGroups;modal.querySelector('.group-lock').onclick=()=>{state.locked=!state.locked;releaseAll();render();setMessage(state.locked?'分组已锁定':'已解锁，可拖动、长按和修改','ok')};
    modal.addEventListener('change',event=>{try{if(event.target.dataset.max&&!state.locked)M.max(state,event.target.dataset.max,event.target.value);if(event.target.dataset.role&&!state.locked)M.role(state,event.target.dataset.role,event.target.value);render()}catch(error){setMessage(error.message,'error');render()}});
    window.addEventListener('pointerup',releaseAll);window.addEventListener('pointercancel',releaseAll);window.addEventListener('blur',releaseAll);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseAll()});window.addEventListener('pointermove',event=>{if(event.pointerType==='mouse'&&event.buttons===0&&dragSession)releaseAll(event)},true);
  }
  document.addEventListener('DOMContentLoaded',init);
})();
