/* ============================================
   app.js - 主入口（离线版）
   ============================================ */
(function () {
  'use strict';
  const { h, clear, toast, openModal, confirmDialog } = UI;

  document.addEventListener('DOMContentLoaded', async () => {
    // 等待 IndexedDB 加载完成
    await Storage.init();

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

    // 侧边栏分组折叠/展开（状态持久化到 localStorage）
    initSidebarGroups();

    Router.init();

    // 显示存储状态
    updateStorageStatus();
    window.addEventListener('storage-changed', updateStorageStatus);
    window.addEventListener('storage-error', () => {
      toast('存储空间不足！请导出备份后清理旧记录', 'err');
    });
  });

  function updateStorageStatus() {
    let total = 0;
    for (const k in Storage.state.records) {
      total += (Storage.state.records[k] || []).length;
    }
    // 估算存储占用（基于内存中的数据大小）
    let usageKB = 0;
    try {
      usageKB = Math.round(JSON.stringify(Storage.state).length / 1024);
    } catch (_) {}
    const el = document.getElementById('topbarStatus');
    if (el) el.textContent = total > 0 
      ? ('📋 ' + total + '条 ' + (usageKB > 1000 ? Math.round(usageKB/1000)+'MB' : usageKB+'KB'))
      : '💾 IndexedDB 存储';
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

  window.App = { expandGroupOfRoute };
})();
