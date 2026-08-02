/* ============================================
   app.js - 主入口：绑定全局事件、PWA、设置
   ============================================ */
(function () {
  'use strict';
  const { h, clear, toast, openModal, confirmDialog } = UI;

  document.addEventListener('DOMContentLoaded', () => {
    // 侧边栏控制
    document.getElementById('openSidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.add('open');
      document.getElementById('sidebarMask').classList.add('show');
    });
    function closeSidebar() {
      document.getElementById('sidebar').classList.remove('open');
      document.getElementById('sidebarMask').classList.remove('show');
    }
    document.getElementById('closeSidebar').addEventListener('click', closeSidebar);
    document.getElementById('sidebarMask').addEventListener('click', closeSidebar);

    // 导出 Markdown
    document.getElementById('exportMd').addEventListener('click', async () => {
      const r = await StorageUtils.exportToLocalFolder();
      if (r.aborted) return;
      if (r.mode === 'folder') toast('已导出到所选文件夹', 'ok');
      else toast('已导出 Markdown 文件（浏览器不支持选目录时）', 'ok');
    });

    // 设置 · Supabase
    document.getElementById('openSettings').addEventListener('click', openSettingsModal);

    // 同步按钮
    document.getElementById('syncNowBtn').addEventListener('click', doPull);
    document.getElementById('syncPanelBtn').addEventListener('click', doPull);
    document.getElementById('fabSyncBtn').addEventListener('click', doPush);
    document.getElementById('syncPanelConfig').addEventListener('click', openSettingsModal);
    // 顶栏断开连接按钮
    document.getElementById('disconnectTopBtn').addEventListener('click', async () => {
      if (!SupabaseSync.isConfigured()) { toast('未配置 Supabase', 'err'); return; }
      const ok = await confirmDialog('确定要断开 Supabase 连接吗？\n本机数据不会被删除，但将停止云端同步。');
      if (!ok) return;
      SupabaseSync.disconnect();
      initConnectionStatus();
      toast('已断开云端连接', 'ok');
    });

    // PWA：杀光所有旧 Service Worker，不再注册新的（避免缓存旧代码）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.unregister());
        // 清空所有 SW 缓存
        caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      });
    }
    // 显示版本号
    document.getElementById('topbarTitle').dataset.ver = 'v20260802';

    // 侧边栏分组折叠/展开（状态持久化到 localStorage）
    initSidebarGroups();

    Router.init();

    // 初始连接检测
    initConnectionStatus();
  });

  // ====== 连接状态管理 ======
  const SYNC_TIME_KEY = 'last_sync_at';

  function setSyncBadge(state, text) {
    const b = document.getElementById('syncBadge');
    b.className = 'sync-indicator ' + state;
    const txt = b.querySelector('.sync-text');
    if (txt) txt.textContent = text;
    else b.appendChild(document.createTextNode(text));
    // 已连接时显示断开按钮
    const dBtn = document.getElementById('disconnectTopBtn');
    if (dBtn) dBtn.style.display = (state === 'online') ? '' : 'none';
  }

  function setSyncPanel(state, statusText, timeText) {
    const row = document.getElementById('syncPanelRow');
    const status = document.getElementById('syncPanelStatus');
    const time = document.getElementById('syncPanelTime');
    row.className = 'sync-panel-row ' + state;
    status.textContent = statusText;
    time.textContent = timeText || '';
  }

  function getLastSyncText() {
    const ts = localStorage.getItem(SYNC_TIME_KEY);
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diff = Math.floor((now - d) / 1000);
    if (diff < 60) return '刚刚同步';
    if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前同步';
    if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前同步';
    return d.getMonth()+1 + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  async function initConnectionStatus() {
    if (!SupabaseSync.isConfigured()) {
      setSyncBadge('offline', '本地');
      setSyncPanel('offline', '未连接云端', '数据仅保存在本设备');
      return;
    }
    // 配置了但需要验证连接
    setSyncBadge('syncing', '连接中…');
    setSyncPanel('syncing', '正在连接云端…', '');
    const ok = await SupabaseSync.testConnection();
    if (ok) {
      setSyncBadge('online', '已连接');
      setSyncPanel('online', '云端已连接', getLastSyncText());
    } else {
      setSyncBadge('error', '连接失败');
      setSyncPanel('error', '云端连接失败', '请检查 Supabase 配置');
    }
  }

  // ====== 侧边栏分组折叠 ======
  const NAV_COLLAPSE_KEY = 'nav_collapsed_groups';
  function initSidebarGroups() {
    let collapsed = {};
    try { collapsed = JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY) || '{}'); } catch (_) {}
    Object.keys(collapsed).forEach(g => {
      if (collapsed[g]) {
        const el = document.querySelector('.nav-group[data-group="' + g + '"]');
        if (el) { el.classList.add('collapsed'); updateAria(el, false); }
      }
    });

    document.querySelectorAll('[data-toggle-group]').forEach(title => {
      const toggle = () => {
        const group = title.closest('.nav-group');
        const groupName = group.dataset.group;
        const isCollapsed = group.classList.toggle('collapsed');
        updateAria(group, !isCollapsed);
        let cur = {};
        try { cur = JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY) || '{}'); } catch (_) {}
        cur[groupName] = isCollapsed;
        localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(cur));
      };
      title.addEventListener('click', (e) => {
        // 点标题本身才折叠；点内部子项不影响
        e.preventDefault();
        toggle();
      });
      title.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }
  function updateAria(groupEl, expanded) {
    const t = groupEl.querySelector('[data-toggle-group]');
    if (t) t.setAttribute('aria-expanded', String(expanded));
  }
  // 展开当前路由所在的分组（被 router 调用）
  function expandGroupOfRoute(route) {
    const sub = document.querySelector('.nav-sub[data-route="' + route + '"]');
    if (!sub) return;
    const group = sub.closest('.nav-group');
    if (!group) return;
    if (group.classList.contains('collapsed')) {
      group.classList.remove('collapsed');
      updateAria(group, true);
      let cur = {};
      try { cur = JSON.parse(localStorage.getItem(NAV_COLLAPSE_KEY) || '{}'); } catch (_) {}
      cur[group.dataset.group] = false;
      localStorage.setItem(NAV_COLLAPSE_KEY, JSON.stringify(cur));
    }
  }

  // 暴露到全局，供 router.js 调用
  window.App = { expandGroupOfRoute };

  async function doSync() {
    toast('已保存到云端', 'ok');
  }

  // 底部按钮：推送到云端
  async function doPush() {
    if (!SupabaseSync.isConfigured()) {
      toast('请先配置 Supabase', 'err'); return;
    }
    setSyncBadge('syncing', '推送中…');
    const r = await SupabaseSync.pushAll();
    if (r.ok) {
      const ts = new Date().toISOString();
      localStorage.setItem(SYNC_TIME_KEY, ts);
      setSyncBadge('online', '已推送');
      let total = 0;
      for (const k in Storage.state.records) total += (Storage.state.records[k]||[]).length;
      toast('已保存' + total + '条到云端', 'ok');
    } else {
      setSyncBadge('error', '推送失败');
      toast('推送失败: ' + (r.error || r.reason || ''), 'err');
    }
  }

  // 顶栏按钮：从云端拉取更新
  async function doPull() {
    if (!SupabaseSync.isConfigured()) {
      toast('请先配置 Supabase', 'err'); return;
    }
    setSyncBadge('syncing', '更新中…');
    const r = await SupabaseSync.pullAll();
    if (r.ok) {
      const ts = new Date().toISOString();
      localStorage.setItem(SYNC_TIME_KEY, ts);
      setSyncBadge('online', '已更新');
      let total = 0;
      for (const k in Storage.state.records) total += (Storage.state.records[k]||[]).length;
      toast('已同步 ' + total + ' 条记录', 'ok');
      Router.dispatch();
    } else {
      setSyncBadge('error', '更新失败');
      toast('更新失败: ' + (r.error || r.reason || ''), 'err');
    }
  }

  // ====== 设置弹窗 ======
  function openSettingsModal() {
    const s = Storage.getSettings();
    const urlInp = h('input', { class: 'input', placeholder: 'https://xxxxx.supabase.co', value: s.supabaseUrl || '' });
    const keyInp = h('input', { class: 'input', placeholder: 'anon public key', value: s.supabaseKey || '' });
    const autoInp = h('input', { type: 'checkbox' }); autoInp.checked = !!s.autoSync;

    const sqlBox = h('pre', { class: 'md-preview', style: 'white-space:pre-wrap;font-size:12px' }, SUPABASE_SQL);

    // —— 段一：Supabase 云端同步
    const syncSection = h('div', { class: 'settings-section' }, [
      h('h3', { class: 'settings-section-title' }, 'Supabase 云端同步'),
      h('p', { class: 'settings-section-desc' }, '配置后可在多设备间同步数据。未配置时使用本地存储，数据仅保存在当前设备。'),
      h('div', { class: 'field' }, [h('label', null, 'Supabase URL'), urlInp]),
      h('div', { class: 'field' }, [h('label', null, 'Anon Public Key'), keyInp]),
      h('div', { class: 'field' }, [h('label', { style: 'display:inline-flex;gap:6px' }, [autoInp, '自动同步（每次修改后推送）'])]),
      h('div', { class: 'field' }, [
        h('label', null, '在 Supabase SQL 编辑器中执行以下语句建表：'),
        sqlBox,
      ]),
      h('div', { class: 'data-actions' }, [
        h('button', { class: 'btn btn-soft btn-sm', id: 'disconnectBtn' }, '断开连接'),
      ]),
    ]);

    // —— 段二：数据管理
    const exportBtn = h('button', { class: 'btn btn-soft btn-sm', id: 'exportDataBtn' }, '导出数据');
    const clearBtn = h('button', { class: 'btn btn-danger-ghost btn-sm', id: 'clearLocalBtn' }, '清除本地数据');
    const dataSection = h('div', { class: 'settings-section' }, [
      h('h3', { class: 'settings-section-title' }, '数据管理'),
      h('p', { class: 'settings-section-desc' }, '把全部记录导出为 Markdown 文件，或清空本机存储。'),
      h('div', { class: 'data-actions' }, [exportBtn, clearBtn]),
    ]);

    const body = h('div', null, [syncSection, dataSection]);

    const save = h('button', { class: 'btn' }, '保存');
    const cancel = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const test = h('button', { class: 'btn btn-soft' }, '测试连接');
    const foot = h('div', { style: 'display:flex;gap:8px' }, [cancel, test, save]);
    const close = openModal({ title: '设置', body, footer: foot });

    // —— 保存
    save.addEventListener('click', () => {
      Storage.setSettings({
        supabaseUrl: urlInp.value.trim(),
        supabaseKey: keyInp.value.trim(),
        autoSync: autoInp.checked,
      });
      toast('已保存', 'ok');
      close.close();
      initConnectionStatus();
    });

    // —— 测试连接
    test.addEventListener('click', async () => {
      Storage.setSettings({ supabaseUrl: urlInp.value.trim(), supabaseKey: keyInp.value.trim() });
      setSyncBadge('syncing', '测试中…');
      const ok = await SupabaseSync.testConnection();
      if (ok) {
        setSyncBadge('online', '连接成功');
        setSyncPanel('online', '云端已连接', getLastSyncText());
        toast('Supabase 连接成功', 'ok');
      } else {
        setSyncBadge('error', '连接失败');
        setSyncPanel('error', '云端连接失败', '请检查 URL 与 Key');
        toast('连接失败，请检查 URL 与 Key', 'err');
      }
    });

    // —— 断开连接（二次确认）
    syncSection.querySelector('#disconnectBtn').addEventListener('click', async () => {
      if (!SupabaseSync.isConfigured()) {
        toast('当前未配置 Supabase', 'err');
        return;
      }
      const ok = await confirmDialog('确定要断开 Supabase 连接吗？\n本机数据不会被删除，但将停止云端同步。');
      if (!ok) return;
      SupabaseSync.disconnect();
      // 同步把表单清空
      urlInp.value = '';
      keyInp.value = '';
      autoInp.checked = false;
      toast('已断开 Supabase 连接', 'ok');
      initConnectionStatus();
    });

    // —— 导出数据
    exportBtn.addEventListener('click', async () => {
      const r = await StorageUtils.exportToLocalFolder();
      if (r.aborted) return;
      if (r.mode === 'folder') toast('已导出到所选文件夹', 'ok');
      else toast('已导出 Markdown 文件（浏览器不支持选目录时）', 'ok');
    });

    // —— 清除本地数据（二次确认）
    clearBtn.addEventListener('click', async () => {
      const ok = await confirmDialog('确定要清除本机全部数据吗？\n所有记录将被删除，且无法恢复（云端数据不受影响）。建议先点「导出数据」备份。');
      if (!ok) return;
      StorageUtils.clearAllData();
      toast('已清除本地数据', 'ok');
      setTimeout(() => location.reload(), 400);
    });
  }

  // Supabase 建表 SQL
  const SUPABASE_SQL = `-- 在 Supabase SQL Editor 中执行
create table if not exists public.exp_tinball_color (
  id text primary key,
  data jsonb,
  updated_at timestamptz
);
create table if not exists public.exp_tinball_clear (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.exp_tinpaste_color (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.exp_tinpaste_clear (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.exp_materials (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.patent_library (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.patent_innovation (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.patent_progress (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_study (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_companies (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_resume (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.job_fair (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.paper_progress (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.tags (
  id text primary key, data jsonb, updated_at timestamptz);
create table if not exists public.settings (
  id text primary key, data jsonb, updated_at timestamptz);
-- 开放匿名读写（仅供个人使用，生产环境请加 RLS）
alter table public.exp_tinball_color enable row level security;
-- 简化：直接 policy 允许 anon
create policy "anon all" on public.exp_tinball_color for all using (true) with check (true);
create policy "anon all" on public.exp_tinball_clear for all using (true) with check (true);
create policy "anon all" on public.exp_tinpaste_color for all using (true) with check (true);
create policy "anon all" on public.exp_tinpaste_clear for all using (true) with check (true);
create policy "anon all" on public.exp_materials for all using (true) with check (true);
create policy "anon all" on public.patent_library for all using (true) with check (true);
create policy "anon all" on public.patent_innovation for all using (true) with check (true);
create policy "anon all" on public.patent_progress for all using (true) with check (true);
create policy "anon all" on public.job_study for all using (true) with check (true);
create policy "anon all" on public.job_companies for all using (true) with check (true);
create policy "anon all" on public.job_resume for all using (true) with check (true);
create policy "anon all" on public.job_fair for all using (true) with check (true);
create policy "anon all" on public.paper_progress for all using (true) with check (true);
create policy "anon all" on public.tags for all using (true) with check (true);
create policy "anon all" on public.settings for all using (true) with check (true);
`;
})();
