/* Feedback is separate from workspaces. All permissions are enforced by Worker. */
(() => {
  'use strict';
  const style=document.createElement('style');
  style.textContent=`.feedback-entry{position:relative;white-space:nowrap}.feedback-count{background:#ed2435;color:#fff;border-radius:20px;padding:1px 6px;margin-left:5px;font-size:12px}.feedback-panel{position:fixed;inset:0;z-index:10000;background:#30233166;display:none;align-items:center;justify-content:center;padding:18px}.feedback-panel.show{display:flex}.feedback-dialog{background:#fff;border-radius:24px;width:min(760px,100%);max-height:90dvh;overflow:auto;padding:24px;color:#352f3b;box-shadow:0 20px 70px #30233144}.feedback-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.feedback-head h2{margin:0}.feedback-help{color:#807786;font-size:14px;line-height:1.6}.feedback-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.feedback-dialog button{cursor:pointer}.feedback-dialog button:disabled{opacity:.5;cursor:wait}.feedback-form{display:grid;gap:12px;border:1px solid #f1e6ea;padding:16px;border-radius:18px;background:#fff8fa}.feedback-dialog label{display:grid;gap:6px}.feedback-dialog textarea,.feedback-dialog select,.feedback-dialog input{font:inherit;color:inherit;box-sizing:border-box;width:100%;border:1px solid #e7dfe7;border-radius:12px;padding:10px;background:#fff}.feedback-dialog textarea{min-height:100px;resize:vertical}.feedback-card{border:1px solid #eee3e9;border-radius:16px;margin:12px 0;padding:16px}.feedback-card p{white-space:pre-wrap;overflow-wrap:anywhere;margin:8px 0}.feedback-meta{font-size:13px;color:#867b8a}.feedback-status{color:#ed2435}.feedback-reply{background:#f5f6ff;border-radius:10px;padding:10px}.feedback-message{min-height:24px;font-size:14px;color:#c71930;margin:10px 0}.feedback-message.success{color:#14804a}.feedback-admin-edit{display:grid;gap:10px;margin-top:12px}.feedback-tabs button[aria-pressed=true]{background:#ed2435;color:white}@media(max-width:600px){.feedback-panel{padding:8px}.feedback-dialog{padding:16px;max-height:95dvh}}`;
  style.textContent+='.feedback-panel [hidden],.feedback-entry[hidden]{display:none!important}';
  document.head.append(style);
  const entry=document.createElement('button');entry.id='feedbackEntry';entry.className='btn feedback-entry';entry.type='button';entry.hidden=true;
  document.querySelector('#accountBtn')?.after(entry);
  const panel=document.createElement('div');panel.id='feedbackPanel';panel.className='feedback-panel';panel.innerHTML=`<section class="feedback-dialog" role="dialog" aria-modal="true" aria-labelledby="feedbackTitle"><div class="feedback-head"><h2 id="feedbackTitle">问题反馈 / 功能建议</h2><button class="btn" id="feedbackClose" aria-label="关闭反馈">×</button></div><p class="feedback-help">反馈保存到云端。教师只能查看自己的提交；管理员可查看全部并回复。请勿填写密码、邀请码或学生敏感信息。这里是站内提醒，不是手机推送。</p><div class="feedback-tabs"><button class="btn" id="feedbackMine">我的反馈</button><button class="btn" id="feedbackInbox" hidden>管理员收件箱</button><button class="btn" id="feedbackRefresh">刷新</button></div><form class="feedback-form" id="feedbackForm"><label>类型<select id="feedbackCategory"><option>问题反馈</option><option>功能建议</option></select></label><label>内容（5～2000字）<textarea id="feedbackContent" minlength="5" maxlength="2000" required placeholder="请说明遇到的问题、操作步骤，或希望增加的功能"></textarea></label><label>联系方式（选填）<input id="feedbackContact" maxlength="120" placeholder="便于管理员联系你，不会公开给其他教师"></label><button type="submit" class="btn primary" id="feedbackSubmit">提交反馈</button><small class="feedback-help">每分钟最多1条，滚动24小时最多5条。</small></form><div class="feedback-message" id="feedbackMessage" role="status" aria-live="polite"></div><div id="feedbackList"></div></section>`;
  document.body.append(panel);
  const q=s=>panel.querySelector(s);
  let teacher=null,scope='mine',generation=0,busy=false,opener=null;
  const message=(text,success=false)=>{q('#feedbackMessage').textContent=text;q('#feedbackMessage').classList.toggle('success',success)};
  const api=(path,options={})=>window.classroomApi(path,options);
  const badge=n=>{entry.replaceChildren(document.createTextNode(teacher?.isAdmin?'反馈管理':'问题反馈'));if(n){const b=document.createElement('span');b.className='feedback-count';b.textContent=n>99?'99+':String(n);entry.append(b)}entry.title=n?`${n}条未读反馈或回复`:'提交建议、查看处理结果'};
  function modes(){q('#feedbackInbox').hidden=!teacher?.isAdmin;q('#feedbackForm').hidden=scope==='all';q('#feedbackMine').setAttribute('aria-pressed',String(scope==='mine'));q('#feedbackInbox').setAttribute('aria-pressed',String(scope==='all'))}
  function node(tag,text,css){const n=document.createElement(tag);n.textContent=text;if(css)n.className=css;return n}
  function render(items){
    const list=q('#feedbackList');list.replaceChildren();
    list.append(node('p',items.length?'显示最近100条反馈；打开列表后标记这些反馈为已读。':'暂无反馈。','feedback-help'));
    for(const item of items){
      const card=node('article','','feedback-card');
      card.append(node('strong',`${item.category} · ${item.status}`,'feedback-status'));
      const time=new Date(item.created_at).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
      card.append(node('div',scope==='all'?`${item.display_name} · 工号 ${item.employee_no||'未设置'} · ${item.email} · ${time}`:time,'feedback-meta'));
      card.append(node('p',item.content));if(item.contact)card.append(node('p','联系方式：'+item.contact,'feedback-meta'));
      if(item.reply)card.append(node('p','管理员回复：'+item.reply,'feedback-reply'));
      if(scope==='all'){
        const form=node('form','','feedback-admin-edit'),status=document.createElement('select');status.setAttribute('aria-label','处理状态');
        for(const value of ['待处理','处理中','已解决']){const opt=node('option',value);opt.value=value;status.append(opt)}status.value=item.status;
        const reply=document.createElement('textarea');reply.maxLength=2000;reply.value=item.reply;reply.placeholder='回复教师（选填）';reply.setAttribute('aria-label','管理员回复');
        const save=node('button','保存处理结果','btn primary');save.type='submit';form.append(status,reply,save);
        form.onsubmit=async event=>{event.preventDefault();if(busy)return;const g=generation;busy=true;save.disabled=true;try{await api('/api/feedback/'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify({status:status.value,reply:reply.value})});if(g!==generation)return;message('处理结果已保存，教师将在站内收到提醒。',true);await load(false)}catch(e){if(g===generation)message(e.message)}finally{busy=false;save.disabled=false}};
        card.append(form);
      }list.append(card);
    }
  }
  async function load(markRead=true){
    if(!teacher)return;const g=generation,currentScope=scope;
    try{const data=await api('/api/feedback?scope='+currentScope);if(g!==generation||scope!==currentScope)return;render(data.items);
      if(markRead&&data.items.length){await api('/api/feedback/read',{method:'POST',body:JSON.stringify({scope:currentScope,ids:data.items.map(r=>r.id)})});}
      await poll();
    }catch(e){if(g===generation)message(e.message)}
  }
  async function poll(){if(!teacher||document.hidden)return;const g=generation;try{const data=await api('/api/feedback?scope='+(teacher.isAdmin?'all':'mine'));if(g===generation)badge(data.unread)}catch(e){if(g===generation){entry.title='反馈提醒读取失败，请打开后重试：'+e.message}}}
  const close=()=>{panel.classList.remove('show');opener?.focus()};
  entry.onclick=()=>{opener=document.activeElement;scope=teacher?.isAdmin?'all':'mine';modes();panel.classList.add('show');message('正在读取云端反馈…');load().then(()=>{if(q('#feedbackMessage').textContent==='正在读取云端反馈…')message('')});q('#feedbackClose').focus()};
  q('#feedbackClose').onclick=close;panel.addEventListener('click',e=>{if(e.target===panel)close()});
  panel.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close()}if(e.key==='Tab'){const focusable=[...panel.querySelectorAll('button,input,select,textarea')].filter(n=>!n.disabled&&n.getClientRects().length);const first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}}});
  q('#feedbackMine').onclick=()=>{scope='mine';modes();message('');load()};q('#feedbackInbox').onclick=()=>{scope='all';modes();message('');load()};q('#feedbackRefresh').onclick=()=>load();
  q('#feedbackForm').onsubmit=async e=>{e.preventDefault();if(busy)return;const g=generation;busy=true;q('#feedbackSubmit').disabled=true;message('正在提交…');try{await api('/api/feedback',{method:'POST',body:JSON.stringify({category:q('#feedbackCategory').value,content:q('#feedbackContent').value,contact:q('#feedbackContact').value})});if(g!==generation)return;q('#feedbackContent').value='';q('#feedbackContact').value='';message('提交成功，管理员可在反馈管理中查看。',true);await load()}catch(error){if(g===generation)message(error.message)}finally{busy=false;q('#feedbackSubmit').disabled=false}};
  window.classroomFeedback={setTeacher(next){if(teacher?.id===next?.id){teacher=next;return}generation++;teacher=next;entry.hidden=!next;panel.classList.remove('show');q('#feedbackContent').value='';q('#feedbackContact').value='';q('#feedbackList').replaceChildren();message('');badge(0);poll()}};
  setInterval(poll,60000);document.addEventListener('visibilitychange',poll);
})();
