/* ============================================
   router.js - 简易 hash 路由
   ============================================ */
(function (global) {
  'use strict';

  const ROUTE_META = {
    'home':                 { title: '工作台首页',  module: 'home' },
    'exp-tinball-color':    { title: '锡球实验 · 有色', module: 'experiment' },
    'exp-tinball-clear':    { title: '锡球实验 · 无色', module: 'experiment' },
    'exp-tinpaste-color':   { title: '锡膏实验 · 有色', module: 'experiment' },
    'exp-tinpaste-clear':   { title: '锡膏实验 · 无色', module: 'experiment' },
    'exp-materials':        { title: '原料标签档案',    module: 'experiment' },
    'patent-library':       { title: '专利资料库',     module: 'patent' },
    'patent-innovation':    { title: '创新点记录',     module: 'patent' },
    'patent-progress':      { title: '我的专利进度',   module: 'patent' },
    'job-study':            { title: '就业 · 学习',     module: 'employment' },
    'job-companies':        { title: '就业 · 相关公司', module: 'employment' },
    'job-resume':           { title: '就业 · 我的简历', module: 'employment' },
    'job-fair':             { title: '就业 · 招聘会',   module: 'employment' },
    'paper-progress':       { title: '论文进度',       module: 'paper' },
  };

  const MODULE_RENDERERS = {
    'home':       HomeModule.render,
    'experiment': ExperimentModule.render,
    'patent':     PatentModule.render,
    'employment': EmploymentModule.render,
    'paper':      PaperModule.render,
  };

  let currentRoute = 'home';

  function parseHash() {
    const h = (location.hash || '#/home').replace(/^#\/?/, '');
    const [path, queryStr] = h.split('?');
    const query = {};
    if (queryStr) {
      queryStr.split('&').forEach(p => {
        const [k, v] = p.split('=');
        query[decodeURIComponent(k)] = decodeURIComponent(v || '');
      });
    }
    return { path: path || 'home', query };
  }

  function go(route, query) {
    let q = '';
    if (query && Object.keys(query).length) {
      q = '?' + Object.keys(query).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(query[k])).join('&');
    }
    location.hash = '#/' + route + q;
  }

  function dispatch() {
    const { path, query } = parseHash();
    currentRoute = path;
    const meta = ROUTE_META[path] || ROUTE_META['home'];
    document.getElementById('topbarTitle').textContent = meta.title;
    // 侧边高亮
    document.querySelectorAll('.nav-item, .nav-sub').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-sub[data-route="' + path + '"]').forEach(el => el.classList.add('active'));
    // 底部高亮（按模块对应）
    const moduleToBottom = {
      'home': 'home',
      'exp-tinball-color': 'exp-tinball-color',
      'exp-tinball-clear': 'exp-tinball-color',
      'exp-tinpaste-color': 'exp-tinball-color',
      'exp-tinpaste-clear': 'exp-tinball-color',
      'exp-materials': 'exp-tinball-color',
      'patent-library': 'patent-progress',
      'patent-innovation': 'patent-progress',
      'patent-progress': 'patent-progress',
      'job-study': 'job-study',
      'job-companies': 'job-study',
      'job-resume': 'job-study',
      'job-fair': 'job-study',
      'paper-progress': 'paper-progress',
    };
    document.querySelectorAll('.bottom-nav a').forEach(el => el.classList.remove('active'));
    const bk = moduleToBottom[path];
    if (bk) document.querySelector('.bottom-nav a[data-route="' + bk + '"]')?.classList.add('active');

    const renderer = MODULE_RENDERERS[meta.module];
    const content = document.getElementById('content');
    content.scrollTop = 0;
    if (renderer) renderer(content, path, query);
    // 自动展开当前路由所在的分组（如果在折叠状态）
    if (window.App && App.expandGroupOfRoute) App.expandGroupOfRoute(path);
    // 关闭侧边栏（手机端）
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarMask').classList.remove('show');
  }

  function init() {
    window.addEventListener('hashchange', dispatch);
    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        go(el.dataset.route);
      });
    });
    dispatch();
  }

  global.Router = { go, init, get current() { return currentRoute; } };
})(window);
