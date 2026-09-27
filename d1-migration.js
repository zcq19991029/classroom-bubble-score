(() => {
  'use strict';
  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(body.error || `请求失败（${response.status}）`), { status: response.status, body });
    return body;
  };
  window.d1Api = { health: () => api('/api/health', { method: 'GET', headers: {} }), session: () => api('/api/auth/session', { method: 'GET', headers: {} }), workspace: () => api('/api/workspace', { method: 'GET', headers: {} }) };
  function addButton() {
    const cloudState = document.querySelector('#cloudState');
    if (!cloudState || document.querySelector('#d1MigrateBtn')) return;
    const button = document.createElement('button');
    button.id = 'd1MigrateBtn'; button.type = 'button'; button.className = 'btn';
    button.textContent = '迁移到 Sites 数据库';
    button.title = '把当前教师云端数据安全复制到 Sites D1；不会删除旧数据';
    button.style.whiteSpace = 'nowrap'; button.addEventListener('click', migrate);
    cloudState.insertAdjacentElement('afterend', button);
  }
  async function migrate() {
    const payload = typeof window.getCloudPayloadSnapshot === 'function' ? window.getCloudPayloadSnapshot() : null;
    if (!payload || !payload.classes || !Object.keys(payload.classes).length) { alert('当前还没有可迁移的班级数据。请先登录并确认班级数据已加载。'); return; }
    const email = prompt('请输入当前教师账号邮箱（只用于验证旧账号，不会保存明文密码）'); if (!email) return;
    const password = prompt('请输入当前教师账号密码（只用于本次验证）'); if (!password) return;
    const employeeNo = prompt('请输入工号（可选，例如 11445）') || '';
    const displayName = prompt('请输入显示姓名（可选）') || '';
    const button = document.querySelector('#d1MigrateBtn'); button.disabled = true; button.textContent = '正在迁移…';
    const request = (overwrite = false) => api('/api/migrate', { method: 'POST', body: JSON.stringify({ email, password, employeeNo, displayName, payload, overwrite }) });
    try {
      let result;
      try { result = await request(false); }
      catch (error) {
        if (error.status !== 409) throw error;
        if (!confirm('Sites 数据库已经有记录。为避免覆盖，系统默认停止。\n\n如果你确认当前页面数据是最新备份，才点击“确定”覆盖。')) throw error;
        result = await request(true);
      }
      alert(`迁移完成：${result.classes} 个班级、${result.students} 名学生、${result.logs} 条操作记录。\n\n旧 Supabase 数据未删除，Sites D1 已保存一份可核对副本。`);
      const state = document.querySelector('#cloudState'); if (state) { state.textContent = 'Sites 数据库已迁移'; state.className = 'cloud-state'; }
    } catch (error) { alert(`迁移未完成：${error.message}\n\n没有覆盖现有数据。`); }
    finally { button.disabled = false; button.textContent = '迁移到 Sites 数据库'; }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton, { once: true }); else addButton();
  window.setTimeout(addButton, 1000);
})();
