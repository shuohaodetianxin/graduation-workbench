/* ============================================
   storage.js - 本地数据存储（Markdown 格式）
   负责：localStorage 缓存 / Markdown 序列化 / 导入导出
   ============================================ */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'graduation-workbench-v1';
  const DATA_VERSION = 1;

  // 全部数据 schema（按模块）
  const DEFAULT_STATE = {
    version: DATA_VERSION,
    tags: {
      // 用户自定义标签（每个分类独立一组）
      exp: [
        { id: 't-solvent', name: '溶剂',     color: '#A8B5A0' },
        { id: 't-rosin',   name: '松香',     color: '#C9A8AB' },
        { id: 't-active',  name: '活性剂',   color: '#B8A9C9' },
        { id: 't-amine',   name: '有机胺',   color: '#D4C5A9' },
        { id: 't-inhibitor', name: '缓蚀剂', color: '#8FA9B7' },
        { id: 't-antiox',  name: '抗氧化剂', color: '#C5D1BD' },
        { id: 't-thixo',   name: '触变剂',   color: '#D0C5DC' },
      ],
      patent: [],
      job: [],
      paper: [],
    },
    records: {
      'exp-tinball-color':  [], // 锡球有色
      'exp-tinball-clear':  [], // 锡球无色
      'exp-tinpaste-color': [], // 锡膏有色
      'exp-tinpaste-clear': [], // 锡膏无色
      'exp-materials':      [], // 原料标签档案
      'patent-library':     [],
      'patent-innovation':  [],
      'patent-progress':    [],
      'job-study':          [],
      'job-companies':      [],
      'job-resume':         [],
      'job-fair':           [],
      'paper-progress':     [],
    },
    settings: {
      supabaseUrl: '',
      supabaseKey: '',
      autoSync: false,
    }
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return deepClone(DEFAULT_STATE);
      const parsed = JSON.parse(raw);
      // 合并默认值（防止升级时缺字段）
      return mergeDefaults(parsed, DEFAULT_STATE);
    } catch (e) {
      console.error('[storage] load error', e);
      return deepClone(DEFAULT_STATE);
    }
  }

  function save(state) {
    state.version = DATA_VERSION;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // 派发全局事件，便于首页等页面监听刷新
    try { window.dispatchEvent(new CustomEvent('storage-changed')); } catch (_) {}
    // 自动推送云端（如果已配置且开启 autoSync）
    try {
      if (window.SupabaseSync && window.SupabaseSync.pushNow) {
        window.SupabaseSync.pushNow();
      }
    } catch (_) {}
  }

  function mergeDefaults(obj, defaults) {
    if (Array.isArray(defaults)) return Array.isArray(obj) ? obj : deepClone(defaults);
    if (defaults && typeof defaults === 'object') {
      const out = {};
      for (const k in defaults) {
        out[k] = (k in obj) ? mergeDefaults(obj[k], defaults[k]) : deepClone(defaults[k]);
      }
      return out;
    }
    return obj === undefined ? defaults : obj;
  }

  function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

  // ====== 记录操作 ======
  const Store = {
    state: load(),

    save() { save(this.state); },

    getRecords(key) {
      return this.state.records[key] || [];
    },

    addRecord(key, record) {
      if (!this.state.records[key]) this.state.records[key] = [];
      const id = record.id || genId();
      const now = new Date().toISOString();
      const item = Object.assign({
        id,
        createdAt: now,
        updatedAt: now,
      }, record);
      this.state.records[key].push(item);
      this.save();
      return item;
    },

    updateRecord(key, id, patch) {
      const arr = this.state.records[key] || [];
      const idx = arr.findIndex(r => r.id === id);
      if (idx >= 0) {
        arr[idx] = Object.assign({}, arr[idx], patch, { id, updatedAt: new Date().toISOString() });
        this.save();
        return arr[idx];
      }
      return null;
    },

    deleteRecord(key, id) {
      const arr = this.state.records[key] || [];
      const idx = arr.findIndex(r => r.id === id);
      if (idx >= 0) {
        arr.splice(idx, 1);
        this.save();
        return true;
      }
      return false;
    },

    getRecord(key, id) {
      const arr = this.state.records[key] || [];
      return arr.find(r => r.id === id) || null;
    },

    // 标签
    getTags(scope) { return this.state.tags[scope] || []; },
    addTag(scope, tag) {
      if (!this.state.tags[scope]) this.state.tags[scope] = [];
      const t = Object.assign({ id: genId() }, tag);
      this.state.tags[scope].push(t);
      this.save();
      return t;
    },
    updateTag(scope, id, patch) {
      const arr = this.state.tags[scope] || [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) {
        arr[idx] = Object.assign({}, arr[idx], patch);
        this.save();
      }
    },
    deleteTag(scope, id) {
      const arr = this.state.tags[scope] || [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) {
        arr.splice(idx, 1);
        this.save();
      }
    },

    // 设置
    getSettings() { return this.state.settings; },
    setSettings(patch) {
      this.state.settings = Object.assign({}, this.state.settings, patch);
      this.save();
    },

    // ====== 工具：取某天全部记录（按模块） ======
    getRecordsByDate(dateStr /* YYYY-MM-DD */) {
      const out = {};
      for (const k in this.state.records) {
        out[k] = this.state.records[k].filter(r => (r.date || '').slice(0, 10) === dateStr);
      }
      return out;
    },

    // 计算某模块在某月哪些日期有数据（用于日历圆环）
    getDateIndex(scopeKey) {
      const idx = {};
      const arr = this.state.records[scopeKey] || [];
      arr.forEach(r => {
        const d = (r.date || '').slice(0, 10);
        if (d) idx[d] = (idx[d] || 0) + 1;
      });
      return idx;
    },

    // 某个子模块的日期索引（只统计该 routeKey 的记录，用于子模块日历单色圈圈）
    getDateIndexByRoute(routeKey) {
      const idx = {};
      const arr = this.state.records[routeKey] || [];
      arr.forEach(r => {
        const d = (r.date || '').slice(0, 10);
        if (d) idx[d] = (idx[d] || 0) + 1;
      });
      return idx;
    },

    // 跨模块的每日索引（给首页日历 / 多色圆环用）
    getDateIndexByModule() {
      const idx = {}; // { 'YYYY-MM-DD': {exp:1, patent:1, job:1, paper:1} }
      const map = {
        'exp-tinball-color':'exp','exp-tinball-clear':'exp',
        'exp-tinpaste-color':'exp','exp-tinpaste-clear':'exp',
        'exp-materials':'exp',
        'patent-library':'patent','patent-innovation':'patent','patent-progress':'patent',
        'job-study':'job','job-companies':'job','job-resume':'job','job-fair':'job',
        'paper-progress':'paper',
      };
      for (const k in this.state.records) {
        const mod = map[k];
        if (!mod) continue;
        (this.state.records[k] || []).forEach(r => {
          const d = (r.date || '').slice(0, 10);
          if (!d) return;
          if (!idx[d]) idx[d] = {};
          idx[d][mod] = (idx[d][mod] || 0) + 1;
        });
      }
      return idx;
    },
  };

  // ====== Markdown 序列化 ======
  function toMarkdown(record, moduleKey) {
    const lines = [];
    lines.push(`# ${record.title || record.name || '未命名记录'}`);
    lines.push('');
    lines.push(`- **模块**: ${moduleKey}`);
    lines.push(`- **日期**: ${record.date || ''}`);
    if (record.tags && record.tags.length) {
      lines.push(`- **标签**: ${record.tags.map(t => t.name).join('、')}`);
    }
    lines.push(`- **创建时间**: ${record.createdAt || ''}`);
    lines.push(`- **更新时间**: ${record.updatedAt || ''}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 业务字段
    const fieldMap = {
      'exp-tinball-color':  ['idea','result','analysis','nextPlan','files'],
      'exp-tinball-clear':  ['idea','result','analysis','nextPlan','files'],
      'exp-tinpaste-color': ['idea','result','analysis','nextPlan','files'],
      'exp-tinpaste-clear': ['idea','result','analysis','nextPlan','files'],
      'exp-materials':      ['name','desc','files'],
      'patent-library':     ['patentNo','patentName','summary','innovations','materials','files'],
      'patent-innovation':  ['idea','plan','materials','files'],
      'patent-progress':    ['content','files'],
      'job-study':          ['content','duration','done','files'],
      'job-companies':      ['name','location','url','hasInterview','interviewTime','interviewPlace','notes'],
      'job-resume':         ['fileName','change','target'],
      'job-fair':           ['time','location','company','notes'],
      'paper-progress':     ['content','files'],
    };
    const fields = fieldMap[moduleKey] || [];
    fields.forEach(f => {
      const v = record[f];
      if (v === undefined || v === null || v === '') return;
      const label = FIELD_LABELS[f] || f;
      if (Array.isArray(v)) {
        lines.push(`## ${label}`);
        v.forEach(item => {
          if (typeof item === 'string') lines.push(`- ${item}`);
          else if (item.name) lines.push(`- ${item.name}${item.dataUrl ? ' (附件)' : ''}`);
        });
        lines.push('');
      } else if (typeof v === 'object' && v && v.dataUrl) {
        lines.push(`## ${label}`);
        lines.push(`附件: ${v.name || 'file'} (${v.type || ''}, ${Math.round((v.size||0)/1024)} KB)`);
        lines.push('');
      } else if (typeof v === 'boolean') {
        lines.push(`- **${label}**: ${v ? '✅ 是' : '❌ 否'}`);
      } else {
        lines.push(`## ${label}`);
        lines.push(String(v));
        lines.push('');
      }
    });
    return lines.join('\n');
  }

  const FIELD_LABELS = {
    idea: '今日实验构想',
    result: '实验结果',
    analysis: '原因分析',
    nextPlan: '明日安排',
    files: '附件',
    name: '名称',
    desc: '描述',
    patentNo: '专利号',
    patentName: '专利名称',
    summary: '摘要',
    innovations: '创新点',
    materials: '原材料信息',
    plan: '实施方案',
    content: '内容',
    duration: '时长（分钟）',
    done: '是否完成',
    location: '所在地',
    url: '网址',
    hasInterview: '是否有面试',
    interviewTime: '面试时间',
    interviewPlace: '面试地点',
    notes: '备注',
    fileName: '文件名',
    change: '修改部分',
    target: '适配公司',
    time: '时间',
    company: '公司名称',
  };

  function genId() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ====== 导出全部 Markdown ======
  function exportAllMarkdown() {
    const out = [];
    out.push('# 加油毕业工作台 · 数据导出');
    out.push('');
    out.push(`> 导出时间: ${new Date().toLocaleString()}`);
    out.push('');
    for (const k in Store.state.records) {
      const arr = Store.state.records[k] || [];
      if (!arr.length) continue;
      out.push(`## ${MODULE_LABELS[k] || k}（${arr.length}）`);
      out.push('');
      arr.forEach(r => {
        out.push('```markdown');
        out.push(toMarkdown(r, k));
        out.push('```');
        out.push('');
      });
    }
    return out.join('\n');
  }

  const MODULE_LABELS = {
    'exp-tinball-color':  '锡球实验 · 有色',
    'exp-tinball-clear':  '锡球实验 · 无色',
    'exp-tinpaste-color': '锡膏实验 · 有色',
    'exp-tinpaste-clear': '锡膏实验 · 无色',
    'exp-materials':      '原料标签档案',
    'patent-library':     '专利资料库',
    'patent-innovation':  '创新点记录',
    'patent-progress':    '我的专利进度',
    'job-study':          '就业 · 学习',
    'job-companies':      '就业 · 相关公司',
    'job-resume':         '就业 · 我的简历',
    'job-fair':           '就业 · 招聘会',
    'paper-progress':     '论文进度',
  };

  // ====== 提供给下载 ======
  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  // 导出到本地文件夹（通过 <a download> + File System Access API 支持时直接选目录）
  async function exportToLocalFolder() {
    // 优先使用 File System Access API（Chrome/Edge）
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker();
        for (const k in Store.state.records) {
          const arr = Store.state.records[k] || [];
          if (!arr.length) continue;
          const sub = await dir.getDirectoryHandle(k, { create: true });
          for (const r of arr) {
            const fileName = `${(r.date||'').slice(0,10)}_${(r.title||r.name||r.id)}.md`.replace(/[\/\\:*?"<>|]/g,'_');
            const fh = await sub.getFileHandle(fileName, { create: true });
            const w = await fh.createWritable();
            await w.write(toMarkdown(r, k));
            await w.close();
          }
        }
        return { ok: true, mode: 'folder' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, aborted: true };
        console.warn('showDirectoryPicker failed, fallback to zip', e);
      }
    }
    // 退化：导出单个 .md 文件
    const text = exportAllMarkdown();
    downloadFile(`graduation-workbench-${new Date().toISOString().slice(0,10)}.md`, text);
    return { ok: true, mode: 'single' };
  }

  global.Storage = Store;

  // ====== 危险操作：清空全部本地数据（保留默认标签和 settings） ======
  Store.clearAllData = function () {
    // 备份 settings（避免用户配置 Supabase 后又被清掉）
    const keepSettings = JSON.parse(JSON.stringify(Store.state.settings || {}));
    // 重置为默认状态
    const fresh = deepClone(DEFAULT_STATE);
    fresh.settings = keepSettings;
    save(fresh);
    // 重新加载内存中的 state
    Store.state = load();
  };

  // 暴露 deepClone / load 给外部用（如导入功能预留）
  global.StorageUtils = {
    toMarkdown,
    exportAllMarkdown,
    downloadFile,
    exportToLocalFolder,
    clearAllData: () => Store.clearAllData(),
    MODULE_LABELS,
    FIELD_LABELS,
  };
})(window);
