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
  const clone = value => JSON.parse(JSON.stringify(value || {}));
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const setMessage = value => { if (message) message.textContent = value || ''; };
  const setState = (value, type = '', detail = '') => { if (!state) return; state.textContent = value; state.className = `cloud-state ${type}`; state.title = detail || value; };
  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `请求失败（${response.status}）`);
    return body;
  };
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
  const writeCloud = async () => api('/api/workspace', { method: 'PUT', body: JSON.stringify({ payload: clone(cloudPayload) }) });
  const flush = async () => {
    if (!teacher || loading || syncInFlight) return;
    syncInFlight = true;
    try {
      while (syncPending && teacher) {
        syncPending = false;
        setState('正在保存', 'syncing');
        await writeCloud();
        setState('云端已同步');
        const saveStatus = document.querySelector('#saveStatus');
        if (saveStatus) saveStatus.textContent = `云端已同步 · ${cloudPayload.activeClass}`;
      }
    } catch (error) {
      syncPending = true;
      setState('云端保存失败', 'error', error.message);
      setMessage(`云端保存失败：${error.message}`);
    } finally { syncInFlight = false; }
  };
  const load = async () => {
    loading = true;
    setState('正在同步', 'syncing');
    try {
      const result = await api('/api/workspace');
      cloudPayload = normalizePayload(result.payload);
      if (!Object.keys(cloudPayload.classes).length) {
        keepCurrent(window.classroomCloudBridge.getData());
        await writeCloud();
      }
      renderClasses();
      const current = cloudPayload.classes[cloudPayload.activeClass];
      if (current) window.classroomCloudBridge.setData(clone(current));
      setState('云端已同步');
      const saveStatus = document.querySelector('#saveStatus');
      if (saveStatus) saveStatus.textContent = `云端已同步 · ${cloudPayload.activeClass}`;
    } catch (error) {
      setState('同步失败', 'error', error.message);
      setMessage(`云端数据读取失败：${error.message}`);
    } finally { loading = false; }
  };
  const applySession = async next => {
    teacher = next && next.teacher ? next.teacher : null;
    if (!teacher) {
      screen?.classList.add('show');
      renderClasses();
      setState('等待登录');
      return;
    }
    screen?.classList.remove('show');
    if (accountBtn) accountBtn.textContent = teacher.displayName || teacher.employeeNo || '教师账号';
    await load();
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
      if (rememberLogin?.checked) localStorage.setItem('teacherCloudRemember', JSON.stringify({ identifier })); else localStorage.removeItem('teacherCloudRemember');
      await applySession({ teacher: result.teacher });
      setMessage('');
      if (typeof toast === 'function') toast('登录成功，已连接 Sites D1');
    } catch (error) { setMessage(error.message); }
    finally { signInBtn.disabled = false; signInBtn.textContent = '登录'; }
  };
  if (registerTab) registerTab.style.display = 'none';
  if (loginTab) loginTab.style.display = 'none';
  if (forgotPasswordBtn) forgotPasswordBtn.style.display = 'none';
  if (authEmployeeNo) authEmployeeNo.style.display = 'none';
  if (authForm) authForm.addEventListener('submit', event => { event.preventDefault(); login(); });
  if (signInBtn) signInBtn.onclick = login;
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
  window.cloudDataChanged = data => { if (!teacher || loading) return; keepCurrent(data); syncPending = true; clearTimeout(syncTimer); syncTimer = setTimeout(flush, 180); };
  accountBtn?.addEventListener('click', () => { if (!teacher) return; document.querySelector('#profileModal')?.classList.add('show'); });
  document.querySelector('#signOutBtn')?.addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST', body: '{}' }).catch(() => {}); teacher = null; document.querySelector('#profileModal')?.classList.remove('show'); screen?.classList.add('show'); setState('等待登录'); });
  const remembered = JSON.parse(localStorage.getItem('teacherCloudRemember') || 'null');
  if (authEmail) { authEmail.type = 'text'; authEmail.placeholder = '邮箱或工号'; }
  if (remembered && authEmail) { authEmail.value = remembered.identifier || ''; if (rememberLogin) rememberLogin.checked = true; }
  state?.addEventListener('click', () => { if (state.classList.contains('error')) alert(`云端同步失败原因：\n\n${state.title || '暂未取得详细错误'}`); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && syncPending) flush(); });
  window.addEventListener('pagehide', () => { if (teacher) { keepCurrent(window.classroomCloudBridge.getData()); syncPending = true; flush(); } });
  api('/api/auth/session').then(applySession).catch(() => applySession(null));
})();
