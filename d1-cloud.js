(() => {
  'use strict';
  const screen = document.querySelector('#authScreen');
  const message = document.querySelector('#authMessage');
  const state = document.querySelector('#cloudState');
  const accountBtn = document.querySelector('#accountBtn');
  const classSwitcher = document.querySelector('#classSwitcher');
  const authForm = document.querySelector('#authForm');
  const authEmail = document.querySelector('#authEmail');
  const authEmployeeNo = document.querySelector('#authEmployeeNo');
  const authPassword = document.querySelector('#authPassword');
  const togglePassword = document.querySelector('#togglePassword');
  const signInBtn = document.querySelector('#signInBtn');
  const registerTab = document.querySelector('#registerTab');
  const loginTab = document.querySelector('#loginTab');
  const forgotPasswordBtn = document.querySelector('#forgotPasswordBtn');
  const rememberLogin = document.querySelector('#rememberLogin');
  let teacher = null;
  let cloudPayload = { version: 2, activeClass: '', classes: {} };
  let loading = false;
  let syncPending = false;
  let syncTimer = 0;
  let syncInFlight = false;
  let syncRetryTimer = 0;
  let scheduleSaving = false;
  let calendarPreview = null;
  const pendingStorageKey = () => {
    const identity = teacher?.id || teacher?.employeeNo || teacher?.email || 'default';
    return `teacherCloudPending:${String(identity).replace(/[^a-zA-Z0-9_.@-]/g, '_')}`;
  };
  const clone = value => JSON.parse(JSON.stringify(value || {}));
  const readPending = () => {
    try {
      const raw = localStorage.getItem(pendingStorageKey());
      if (!raw) return null;
      const value = JSON.parse(raw);
      return value && value.payload ? value : null;
    } catch (_) { return null; }
  };
  const rememberPending = () => {
    try { localStorage.setItem(pendingStorageKey(), JSON.stringify({ savedAt: Date.now(), payload: clone(cloudPayload) })); } catch (_) {}
  };
  const forgetPending = () => { try { localStorage.removeItem(pendingStorageKey()); } catch (_) {} };
  window.schoolCalendarCloud = {
    async preview(options){
      if(!teacher||loading)throw Error('请先等待自动登录和云端同步完成');
      if(scheduleSaving||syncInFlight)throw Error('正在同步，请稍后重试');
      if(syncPending){await flush();if(syncPending)throw Error('已有数据尚未保存');}
      const latest=await api('/api/workspace');
      if(JSON.stringify(normalizePayload(latest.payload))!==JSON.stringify(cloudPayload))throw Error('云端已变化，请重新加载再预览');
      const plan=SchoolCalendar.plan(latest.payload,{...options,className:cloudPayload.activeClass});
      calendarPreview={latest,plan,local:JSON.stringify(cloudPayload)};
      return {changes:plan.changes};
    },
    backup(){
      if(!calendarPreview)throw Error('请先预览');
      const url=URL.createObjectURL(new Blob([JSON.stringify(calendarPreview.latest.payload)],{type:'application/json'})),a=document.createElement('a');
      a.href=url;a.download=`校历修改前-全班备份-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    },
    cancel(){calendarPreview=null},
    async save(){
      if(!teacher||loading||!calendarPreview)throw Error('请重新登录并预览');
      if(scheduleSaving||syncInFlight)throw Error('正在保存，请勿重复提交');
      if(syncPending||calendarPreview.local!==JSON.stringify(cloudPayload))throw Error('预览后数据变化，请重新预览');
      if(!calendarPreview.plan.changes.length)throw Error('没有待修改课次');
      scheduleSaving=true;clearTimeout(syncTimer);
      try{
        const {latest,plan}=calendarPreview;
        await api('/api/workspace',{method:'PUT',body:JSON.stringify({payload:plan.payload,expectedUpdatedAt:latest.updatedAt})});
        cloudPayload=normalizePayload(plan.payload);calendarPreview=null;syncPending=false;
        renderClasses();loading=true;try{window.classroomCloudBridge.setData(clone(cloudPayload.classes[cloudPayload.activeClass]))}finally{loading=false}
        setState('校历已同步');
      }catch(e){setState('校历保存失败','error',e.message);throw e}finally{scheduleSaving=false}
    }
  };
  window.saveScheduleCloud = async (candidate, original) => {
    if (!teacher || loading) throw new Error('请先登录并等待云端同步完成');
    if (scheduleSaving || syncInFlight) throw new Error('正在同步，请稍后重试');
    scheduleSaving = true; clearTimeout(syncTimer);
    try {
      if(syncPending){await flush();if(syncPending)throw new Error('已有数据同步失败，请先恢复同步');}
      const latest=await api('/api/workspace');
      const remote=latest.payload?.classes?.[original.className];
      if(JSON.stringify(remote)!==JSON.stringify(cloudPayload.classes[original.className]))throw new Error('云端班级已变化，请刷新后重试');
      const payload=clone(latest.payload);payload.classes[candidate.className]=clone(candidate);
      await api('/api/workspace',{method:'PUT',body:JSON.stringify({payload,expectedUpdatedAt:latest.updatedAt})});
      cloudPayload=normalizePayload(payload);syncPending=false;setState('云端已同步');renderClasses();
    } catch(error){setState('课表保存失败','error',error.message);throw error}
    finally{scheduleSaving=false}
  };
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const setMessage = value => { if (message) message.textContent = value || ''; };
  const setState = (value, type = '', detail = '') => { if (!state) return; state.textContent = value; state.className = `cloud-state ${type}`; state.title = detail || value; };
  const configuredApiBase = String(window.CLASSROOM_API_BASE || document.querySelector('meta[name="classroom-api-base"]')?.content || '').replace(/\/$/, '');
  // A Pages copy keeps the UI static while the Worker remains the only data
  // authority. The hostname check avoids hard-coding a cross-origin request
  // for the normal Sites page, but permits an explicit override for mirrors.
  const apiBase = configuredApiBase || (location.hostname.endsWith('.github.io') ? 'https://classroom-bubble-score.zcq991029.chatgpt.site' : '');
  const api = async (path, options = {}) => {
    const target = /^https?:\/\//i.test(path) ? path : `${apiBase}${path}`;
    const response = await fetch(target, { credentials: apiBase ? 'include' : 'same-origin', cache: 'no-store', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
    return body;
  };
  window.classroomApi = api;
  const normalizeClass = value => {
    const item = clone(value);
    if (!item || !Array.isArray(item.students)) return null;
    item.className = String(item.className || '当前班级').trim() || '当前班级';
    item.logs = Array.isArray(item.logs) ? item.logs : [];
    item.attendance = Array.isArray(item.attendance) ? item.attendance : [];
    item.homework = Array.isArray(item.homework) ? item.homework : [];
    item.examScores = item.examScores && typeof item.examScores === 'object' ? item.examScores : {};
    item.lessonTaskCounts = item.lessonTaskCounts && typeof item.lessonTaskCounts === 'object' ? item.lessonTaskCounts : {};
    item.lessonSchedule = Array.isArray(item.lessonSchedule) ? item.lessonSchedule : [];
    item.settings = item.settings && typeof item.settings === 'object' ? item.settings : {};
    return item;
  };
  const normalizePayload = value => {
    const next = { version: 2, activeClass: '', classes: {} };
    const classes = value && value.classes && typeof value.classes === 'object' ? value.classes : {};
    Object.entries(classes).forEach(([key, value]) => { const item = normalizeClass(value); if (item) next.classes[item.className || key] = item; });
    next.activeClass = value && next.classes[value.activeClass] ? value.activeClass : Object.keys(next.classes)[0] || '';
    return next;
  };
  const renderClasses = () => {
    if (!classSwitcher) return;
    const names = Object.keys(cloudPayload.classes);
    classSwitcher.innerHTML = names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    classSwitcher.value = names.includes(cloudPayload.activeClass) ? cloudPayload.activeClass : names[0] || '';
    classSwitcher.disabled = !teacher || names.length < 2;
    classSwitcher.title = names.length > 1 ? '点击切换班级' : `当前班级：${classSwitcher.value || '未加载'}`;
  };
  const keepCurrent = current => {
    const item = normalizeClass(current);
    if (!item) return;
    cloudPayload.classes[item.className] = item;
    cloudPayload.activeClass = item.className;
    renderClasses();
  };
  const writeCloud = async (options = {}) => api('/api/workspace', { method: 'PUT', body: JSON.stringify({ payload: clone(cloudPayload) }), ...options });
  const flush = async () => {
    if (!teacher || loading || syncInFlight) return;
    syncInFlight = true;
    clearTimeout(syncRetryTimer);
    try {
      while (syncPending && teacher) {
        syncPending = false;
        setState('正在保存', 'syncing');
        await writeCloud();
        setState('云端已同步');
        const saveStatus = document.querySelector('#saveStatus');
        if (saveStatus) saveStatus.textContent = `云端已同步 · ${cloudPayload.activeClass}`;
      }
      if (!syncPending) forgetPending();
    } catch (error) {
      syncPending = true;
      rememberPending();
      setState('云端保存失败', 'error', error.message);
      setMessage(`云端保存失败：${error.message}`);
      syncRetryTimer = setTimeout(flush, 5000);
    } finally { syncInFlight = false; }
  };
  const load = async () => {
    loading = true;
    setState('正在同步', 'syncing');
    let recoveredLocal = false;
    try {
      const result = await api('/api/workspace');
      const remotePayload = normalizePayload(result.payload);
      const pending = readPending();
      const localClass = normalizeClass(window.classroomCloudBridge.getData());
      const remoteClass = localClass && remotePayload.classes[localClass.className];
      const remoteUpdatedAt = Math.max(Number(result.updatedAt) || 0, Number(remoteClass?.updatedAt) || 0);
      const pendingUpdatedAt = Number(pending?.savedAt) || 0;
      const localUpdatedAt = Number(localClass?.updatedAt) || 0;
      if (pending && pendingUpdatedAt > remoteUpdatedAt) {
        cloudPayload = normalizePayload(pending.payload);
        recoveredLocal = true;
      } else {
        if (pending) forgetPending();
        cloudPayload = remotePayload;
        if (localClass && remoteClass && localUpdatedAt > remoteUpdatedAt) {
          cloudPayload.classes[localClass.className] = localClass;
          cloudPayload.activeClass = localClass.className;
          recoveredLocal = true;
        }
      }
      if (!Object.keys(cloudPayload.classes).length) {
        keepCurrent(window.classroomCloudBridge.getData());
        rememberPending();
        syncPending = true;
        await writeCloud();
        forgetPending();
      }
      renderClasses();
      const current = cloudPayload.classes[cloudPayload.activeClass];
      if (current) window.classroomCloudBridge.setData(clone(current));
      if (recoveredLocal) {
        rememberPending();
        syncPending = true;
        setState('正在恢复未同步修改', 'syncing');
      } else setState('云端已同步');
      const saveStatus = document.querySelector('#saveStatus');
      if (saveStatus) saveStatus.textContent = `云端已同步 · ${cloudPayload.activeClass}`;
    } catch (error) {
      setState('同步失败', 'error', error.message);
      setMessage(`云端数据读取失败：${error.message}`);
    } finally {
      loading = false;
      if (syncPending && teacher) { clearTimeout(syncTimer); syncTimer = setTimeout(flush, 0); }
    }
  };
  const applySession = async next => {
    teacher = next && next.teacher ? next.teacher : null;
    if (!teacher) {
      window.classroomFeedback?.setTeacher(null);
      screen?.classList.add('show');
      renderClasses();
      setState('等待登录');
      return;
    }
    screen?.classList.remove('show');
    renderAccountButton();
    await load();
  };
  const renderAccountButton = () => {
    window.classroomFeedback?.setTeacher(teacher);
    if (!accountBtn) return;
    const name = teacher?.displayName || teacher?.employeeNo || '教师账号';
    accountBtn.classList.toggle('admin', Boolean(teacher?.isAdmin));
    accountBtn.innerHTML = `<span class="account-avatar">${escapeHtml((teacher?.avatarText || name.charAt(0) || '师').slice(0,2))}</span><span class="account-name">${escapeHtml(name)}</span>${teacher?.isAdmin ? '<span class="account-crown" title="所有者管理员 VIP" aria-label="所有者管理员 VIP"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l5 4 4-7 4 7 5-4-2 13H5z"/><path d="M5 21h14"/></svg></span>' : ''}`;
  };
  const login = async () => {
    const identifier = authEmail?.value.trim() || '';
    const password = authPassword?.value || '';
    if (!identifier) { setMessage('请输入邮箱或工号'); authEmail?.focus(); return; }
    if (!password) { setMessage('请输入密码'); authPassword?.focus(); return; }
    signInBtn.disabled = true;
    signInBtn.textContent = '正在登录…';
    setMessage('正在登录 Sites 云端…');
    try {
      const body = identifier.includes('@') ? { email: identifier, password } : { employeeNo: identifier, password };
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });
      try { await api('/api/auth/session'); }
      catch (_) { throw new Error('浏览器未保存登录会话。跨站 Cookie 可能被阻止，请使用 Sites 备用入口或允许该站点的跨站 Cookie 后重试。'); }
      if (rememberLogin?.checked) localStorage.setItem('teacherCloudRemember', JSON.stringify({ identifier })); else localStorage.removeItem('teacherCloudRemember');
      if (rememberLogin?.checked && navigator.credentials && window.PasswordCredential) {
        try { await navigator.credentials.store(new PasswordCredential({ id: identifier, password, name: '课堂气泡赋分平台' })); } catch (_) {}
      }
      await applySession({ teacher: result.teacher });
      setMessage('');
      if (typeof toast === 'function') toast('登录成功，已连接 Sites D1');
    } catch (error) { setMessage(error.message); }
    finally { signInBtn.disabled = false; signInBtn.textContent = '登录'; }
  };
  let registerMode = false;
  const register = async () => {
    const email = authEmail?.value.trim() || '';
    const employeeNo = authEmployeeNo?.value.trim() || '';
    const password = authPassword?.value || '';
    const inviteCode = document.querySelector('#authOtp')?.value.trim().toUpperCase() || '';
    if (!email || !employeeNo || password.length < 6 || !inviteCode) { setMessage('注册需要邮箱、工号、至少6位密码和一次性邀请码'); return; }
    signInBtn.disabled = true; signInBtn.textContent = '正在注册…'; setMessage('正在验证邀请码…');
    try {
      const result = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, employeeNo, password, displayName: employeeNo, inviteCode }) });
      await applySession({ teacher: result.teacher }); setMessage('注册成功，已进入教师云端空间');
    } catch (error) { setMessage(error.message); }
    finally { signInBtn.disabled = false; signInBtn.textContent = registerMode ? '注册账号' : '登录'; }
  };
  const setAuthMode = (isRegister) => {
    registerMode = isRegister;
    registerTab?.classList.toggle('active', isRegister); loginTab?.classList.toggle('active', !isRegister);
    if (authEmployeeNo) authEmployeeNo.style.display = isRegister ? 'block' : 'none';
    const otpRow = document.querySelector('#otpRow'); if (otpRow) otpRow.style.display = isRegister ? 'grid' : 'none';
    if (signInBtn) signInBtn.textContent = isRegister ? '注册账号' : '登录';
    if (forgotPasswordBtn) forgotPasswordBtn.style.display = isRegister ? 'none' : 'none';
    setMessage('');
  };
  registerTab?.addEventListener('click', () => setAuthMode(true));
  loginTab?.addEventListener('click', () => setAuthMode(false));
  setAuthMode(false);
  if (forgotPasswordBtn) forgotPasswordBtn.style.display = 'none';
  if (authEmployeeNo) authEmployeeNo.style.display = 'none';
  togglePassword?.addEventListener('click', () => {
    const visible = authPassword.type === 'password';
    authPassword.type = visible ? 'text' : 'password';
    togglePassword.setAttribute('aria-pressed', String(visible));
    togglePassword.setAttribute('aria-label', visible ? '隐藏密码' : '显示密码');
    togglePassword.title = visible ? '隐藏密码' : '显示密码';
  });
  if (authForm) authForm.addEventListener('submit', event => { event.preventDefault(); registerMode ? register() : login(); });
  if (signInBtn) signInBtn.onclick = () => registerMode ? register() : login();
  document.querySelector('#signUpBtn')?.addEventListener('click', register);
  document.querySelector('#generateInviteBtn')?.addEventListener('click', async () => {
    try {
      const result = await api('/api/auth/invite', { method: 'POST', body: '{}' });
      const text = `课堂气泡赋分系统注册邀请\n\n一次性邀请码：${result.code}\n有效期至：${new Date(result.expiresAt).toLocaleString('zh-CN')}\n使用次数：仅限 1 次\n\n安全规则：\n- 邀请码 24 小时有效；\n- 每个邀请码只能使用一次；\n- 请勿转发到公开群聊或网页；\n- 注册后请妥善保存账号和密码。`;
      try { await navigator.clipboard.writeText(text); alert(`${text}\n\n已复制整段邀请内容，可直接粘贴给同事。`); }
      catch (_) { window.prompt('请复制以下邀请内容', text); }
    }
    catch (error) { alert(`生成邀请码失败：${error.message}`); }
  });
  if (classSwitcher) classSwitcher.addEventListener('change', async () => {
    const name = classSwitcher.value;
    if (!name || !cloudPayload.classes[name] || name === cloudPayload.activeClass) return;
    keepCurrent(window.classroomCloudBridge.getData());
    cloudPayload.activeClass = name;
    loading = true;
    window.classroomCloudBridge.setData(clone(cloudPayload.classes[name]));
    loading = false;
    renderClasses();
    syncPending = true;
    await flush();
  });
  window.cloudDataChanged = data => {
    if (!teacher || loading || scheduleSaving) return;
    keepCurrent(data);
    syncPending = true;
    rememberPending();
    clearTimeout(syncTimer);
    setState('正在保存', 'syncing');
    syncTimer = setTimeout(flush, 180);
  };
  accountBtn?.addEventListener('click', () => { if (!teacher) return; document.querySelector('#profileModal')?.classList.add('show'); });
  document.querySelector('#signOutBtn')?.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {}); teacher = null; window.classroomFeedback?.setTeacher(null); document.querySelector('#profileModal')?.classList.remove('show'); screen?.classList.add('show'); setState('等待登录'); });
  const remembered = JSON.parse(localStorage.getItem('teacherCloudRemember') || 'null');
  if (authEmail) { authEmail.type = 'text'; authEmail.placeholder = '邮箱或工号'; }
  if (remembered && authEmail) { authEmail.value = remembered.identifier || ''; if (rememberLogin) rememberLogin.checked = true; }
  state?.addEventListener('click', () => { if (state.classList.contains('error')) alert(`云端同步失败原因：\n\n${state.title || '暂未取得详细错误'}`); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && syncPending) { rememberPending(); flush(); } });
  window.addEventListener('pagehide', () => { if (teacher) { keepCurrent(window.classroomCloudBridge.getData()); syncPending = true; rememberPending(); flush(); } });
  api('/api/auth/session').then(applySession).catch(() => applySession(null));
  const profileNameInput = document.querySelector('#profileNameInput');
  const profileAvatarInput = document.querySelector('#profileAvatarInput');
  const profileEmployeeInput = document.querySelector('#profileEmployeeInput');
  function fillProfile() {
    if (!teacher) return;
    if (profileNameInput) profileNameInput.value = teacher.displayName || '';
    if (profileAvatarInput) profileAvatarInput.value = teacher.avatarText || '';
    if (profileEmployeeInput) profileEmployeeInput.value = teacher.employeeNo || '';
    const name = profileNameInput?.value.trim() || teacher.displayName || '教师账号';
    document.querySelector('#profileNamePreview').textContent = name;
    document.querySelector('#profileAvatarPreview').textContent = (profileAvatarInput?.value.trim() || name.charAt(0) || '师').slice(0, 2);
    document.querySelector('#profileMetaPreview').textContent = `工号 ${teacher.employeeNo || '未设置'} · ${teacher.email || ''}`;
    const badge = document.querySelector('#profileAdminBadge'); if (badge) badge.style.display = teacher.isAdmin ? 'inline-flex' : 'none';
  }
  accountBtn?.addEventListener('click', fillProfile);
  [profileNameInput, profileAvatarInput, profileEmployeeInput].forEach(input => input?.addEventListener('input', () => {
    const name = profileNameInput?.value.trim() || teacher?.displayName || '教师账号';
    document.querySelector('#profileNamePreview').textContent = name;
    document.querySelector('#profileAvatarPreview').textContent = (profileAvatarInput?.value.trim() || name.charAt(0) || '师').slice(0, 2);
  }));
  const showProfileSaved = () => {
    document.querySelector('#profileModal')?.classList.remove('show');
    document.querySelector('.profile-save-feedback')?.remove();
    const feedback = document.createElement('div');
    feedback.className = 'profile-save-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.innerHTML = '<span class="profile-save-check" aria-hidden="true">✓</span><span>保存成功</span>';
    document.body.appendChild(feedback);
    requestAnimationFrame(() => feedback.classList.add('show'));
    window.setTimeout(() => feedback.remove(), 1700);
  };
  document.querySelector('#saveProfileBtn')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = '保存中…';
    try {
      const result = await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ displayName: profileNameInput?.value || '', avatarText: profileAvatarInput?.value || '', employeeNo: profileEmployeeInput?.value || '' }) });
      teacher = result.teacher; renderAccountButton(); fillProfile(); setState('资料已保存');
      const status = document.querySelector('#saveStatus'); if (status) status.textContent = '个人资料已同步到 Sites D1';
      showProfileSaved();
    } catch (error) { setMessage(error.message); if (typeof toast === 'function') toast(`保存失败：${error.message}`); }
    finally { button.disabled = false; button.textContent = originalText; }
  });
})();
