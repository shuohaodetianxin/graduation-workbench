/* ============================================
   home.js - 工作台首页
   每日总览 / 4 个快捷入口 / 搜索
   ============================================ */
(function (global) {
  'use strict';
  const { $, $$, h, clear, fmtDate, today, toast, renderRecordsList, createAffirmationCard } = UI;

  // 监听数据变化，自动刷新首页（避免在非首页时重复渲染）
  let _active = false;
  window.addEventListener('storage-changed', () => {
    if (_active) {
      const content = document.getElementById('content');
      if (content) render(content);
    }
  });
  // 离开首页时取消激活
  window.addEventListener('hashchange', () => {
    const hash = (location.hash || '#/home').replace(/^#\/?/, '');
    _active = (hash.split('?')[0] === 'home' || hash === '');
  });

  function render(root) {
    _active = true;
    clear(root);

    // Hero + 显化语句
    const dateStr = today();
    const hero = h('div', { class: 'home-hero' }, [
      h('h1', null, '🌸 今天也要加油呀'),
      h('p', null, `${dateStr} · 总览你的实验、专利、就业与论文进度`),
    ]);
    root.appendChild(hero);
    root.appendChild(createAffirmationCard());

    // 4 个快捷入口
    const quickGrid = h('div', { class: 'quick-grid' });
    const quicks = [
      { color: 'exp',    emoji: '🧪', title: '新建实验记录', sub: '锡球 / 锡膏 · 有色 / 无色', route: 'exp-tinball-color' },
      { color: 'exp',    emoji: '🔍', title: '实验台账检索', sub: '查看全部历史记录',     route: 'exp-tinball-color' },
      { color: 'patent', emoji: '📚', title: '专利资料库',   sub: 'AI 解析创新点',         route: 'patent-library' },
      { color: 'job',    emoji: '🎓', title: '就业学习台账', sub: '时长统计 · 柱状图',     route: 'job-study' },
    ];
    quicks.forEach(q => {
      const c = h('a', { class: 'quick-card', 'data-color': q.color, 'data-route': q.route }, [
        h('div', { class: 'q-emoji' }, q.emoji),
        h('div', { class: 'q-title' }, q.title),
        h('div', { class: 'q-sub' }, q.sub),
      ]);
      quickGrid.appendChild(c);
    });
    root.appendChild(quickGrid);

    // 4 个模块当日汇总（只查询一次）
    const summary = h('div', { class: 'summary-grid' });
    const dateIdx = Storage.getDateIndexByModule()[dateStr] || {};
    const summaryItems = [
      { color: 'exp',    emoji: '🔬', label: '今日实验记录',  mod: 'exp' },
      { color: 'patent', emoji: '📜', label: '今日专利进度',  mod: 'patent' },
      { color: 'job',    emoji: '💼', label: '今日就业事项',  mod: 'job' },
      { color: 'paper',  emoji: '📄', label: '今日论文进度',  mod: 'paper' },
    ];
    summaryItems.forEach(s => {
      const n = (dateIdx[s.mod] || 0);
      summary.appendChild(h('div', { class: 'summary-card', 'data-color': s.color }, [
        h('div', { class: 'sc-emoji' }, s.emoji),
        h('div', { class: 'sc-num' }, String(n)),
        h('div', { class: 'sc-label' }, s.label),
      ]));
    });
    root.appendChild(summary);

    // 搜索
    const search = h('div', { class: 'search' }, [
      h('span', null, '🔍'),
      h('input', { id: 'homeSearch', placeholder: '搜索全部记录（标题、内容、标签）' }),
      h('button', { class: 'btn btn-sm', id: 'homeSearchBtn' }, '搜索'),
    ]);
    root.appendChild(search);

    const searchResult = h('div', { id: 'homeSearchResult' });
    root.appendChild(searchResult);

    // 事件
    $('#homeSearchBtn').addEventListener('click', doSearch);
    $('#homeSearch').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
    // 路由跳转
    $$('.quick-card', root).forEach(c => c.addEventListener('click', () => Router.go(c.dataset.route)));

    function doSearch() {
      const q = ($('#homeSearch').value || '').trim().toLowerCase();
      clear(searchResult);
      if (!q) { toast('请输入搜索关键词', 'err'); return; }
      const matches = [];
      for (const k in Storage.state.records) {
        (Storage.state.records[k] || []).forEach(r => {
          const text = JSON.stringify(r).toLowerCase();
          if (text.includes(q)) {
            matches.push({ key: k, r });
          }
        });
      }
      if (!matches.length) {
        searchResult.appendChild(h('div', { class: 'empty' }, [
          h('div', { class: 'e-emoji' }, '🍃'),
          h('div', null, '没有找到匹配的记录'),
        ]));
        return;
      }
      const MODULE_LABELS = StorageUtils.MODULE_LABELS;
      const grouped = {};
      matches.forEach(m => { (grouped[m.key] = grouped[m.key] || []).push(m.r); });
      const wrap = h('div', null);
      for (const k in grouped) {
        wrap.appendChild(h('div', { class: 'section-title' }, [MODULE_LABELS[k] + '（' + grouped[k].length + '）']));
        const list = renderRecordsList(grouped[k], r => buildSearchItem(k, r));
        wrap.appendChild(list);
      }
      searchResult.appendChild(wrap);
    }
  }

  function buildSearchItem(moduleKey, r) {
    const title = r.title || r.name || r.content || r.idea || r.summary || '未命名';
    const date = (r.date || '').slice(0, 10);
    const item = h('div', { class: 'list-item' }, [
      h('span', { class: 'li-emoji' }, iconByModule(moduleKey)),
      h('div', { class: 'li-main' }, [
        h('div', { class: 'li-title' }, title),
        h('div', { class: 'li-sub' }, (r.tags || []).map(t => t.name).join(' · ') || '—'),
      ]),
      h('div', { class: 'li-meta' }, date),
    ]);
    item.addEventListener('click', () => {
      Router.go(moduleKey, { openRecord: r.id });
    });
    return item;
  }

  function iconByModule(k) {
    if (k.startsWith('exp-')) return '🔬';
    if (k.startsWith('patent-')) return '📜';
    if (k.startsWith('job-')) return '💼';
    if (k.startsWith('paper-')) return '📄';
    return '📌';
  }

  global.HomeModule = { render };
})(window);
