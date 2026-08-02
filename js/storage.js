/* ============================================
   storage.js - 本地数据存储（IndexedDB）
   IndexedDB 上限远大于 localStorage，可存大量图片
   ============================================ */
(function (global) {
  'use strict';

  const DB_NAME = 'graduation-workbench-db';
  const DB_VERSION = 1;
  const DATA_VERSION = 1;

  // 全部数据 schema（按模块）
  const DEFAULT_STATE = {
    version: DATA_VERSION,
    tags: {
      exp: [
        { id: 't-solvent', name: '溶剂',     color: '#A8B5A0' },
        { id: 't-rosin',   name: '松香',     color: '#C9A8AB' },
        { id: 't-active',  name: '活性剂',   color: '#B8A9C9' },
        { id: 't-amine',   name: '有机胺',   color: '#D4C5A9' },
        { id: 't-inhibitor', name: '缓蚀剂', color: '#8FA9B7' },
        { id: 't-antiox',  name: '抗氧化剂', color: '#C5D1BD' },
        { id: 't-thixo',   name: '触变剂',   color: '#D0C5DC' },
      ],
      patent: [], job: [], paper: [],
    },
    records: {
      'exp-tinball-color':  [],
      'exp-tinball-clear':  [],
      'exp-tinpaste-color': [],
      'exp-tinpaste-clear': [],
      'exp-materials':      [],
      'patent-library':     [],
      'patent-innovation':  [],
      'patent-progress':    [],
      'job-study':          [],
      'job-companies':      [],
      'job-resume':         [],
      'job-fair':           [],
      'paper-progress':     [],
    },
    settings: { supabaseUrl: '', supabaseKey: '', autoSync: false }
  };

  // ====== IndexedDB 封装 ======
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadFromDB() {
    try {
      const db = await openDB();
      return new Promise((resolve) => {
        const tx = db.transaction('state', 'readonly');
        const store = tx.objectStore('state');
        const req = store.get('main');
        req.onsuccess = () => {
          db.close();
          if (req.result && req.result.data) {
            const parsed = req.result.data;
            return resolve(mergeDefaults(parsed, DEFAULT_STATE));
          }
          // 尝试从旧 localStorage 迁移
          const legacy = migrateFromLocalStorage();
          if (legacy) return resolve(legacy);
          resolve(deepClone(DEFAULT_STATE));
        };
        req.onerror = () => { db.close(); resolve(deepClone(DEFAULT_STATE)); };
      });
    } catch (e) {
      console.error('[storage] load error', e);
      const legacy = migrateFromLocalStorage();
      if (legacy) return legacy;
      return deepClone(DEFAULT_STATE);
    }
  }

  function migrateFromLocalStorage() {
    try {
      const raw = localStorage.getItem('graduation-workbench-v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        localStorage.removeItem('graduation-workbench-v1'); // 迁移后清掉
        return mergeDefaults(parsed, DEFAULT_STATE);
      }
    } catch (_) {}
    return null;
  }

  async function saveToDB(state) {
    state.version = DATA_VERSION;
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction('state', 'readwrite');
        const store = tx.objectStore('state');
        store.put({ id: 'main', data: state });
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => {
          db.close();
          // 存储满时回退到 localStorage
          try {
            localStorage.setItem('graduation-workbench-v1', JSON.stringify(state));
          } catch (_) {}
          reject(tx.error);
        };
      });
    } catch (e) {
      console.error('[storage] save error', e);
      try { window.dispatchEvent(new CustomEvent('storage-error', { detail: e })); } catch (_) {}
    }
  }

  function mergeDefaults(obj, defaults) {
    if (Array.isArray(defaults)) return Array.isArray(obj) ? obj : deepClone(defaults);
    if (defaults && typeof defaults === 'object') {
      const out = {};
      for (const k in defaults) {
        out[k] = (k in obj) ? mergeDefaults(obj[k], defaults[k]) : deepClone(defaults[k]);
      }
      for (const k in obj) {
        if (!(k in out)) out[k] = obj[k];
      }
      return out;
    }
    return obj === undefined ? defaults : obj;
  }

  function deepClone(x) { return JSON.parse(JSON.stringify(x)); }

  // ====== 记录操作 ======
  const Store = {
    state: deepClone(DEFAULT_STATE),
    _ready: false,
    _initPromise: null,

    async init() {
      if (this._initPromise) return this._initPromise;
      this._initPromise = loadFromDB().then(s => {
        this.state = s;
        this._ready = true;
        window.dispatchEvent(new CustomEvent('storage-changed'));
        return s;
      });
      return this._initPromise;
    },

    async save() {
      if (!this._ready) return;
      await saveToDB(this.state);
      try { window.dispatchEvent(new CustomEvent('storage-changed')); } catch (_) {}
    },

    getRecords(key) {
      const arr = this.state.records[key] || [];
      // 保证每条记录有唯一id
      arr.forEach(r => { if (!r.id) { r.id = genId(); console.log('[storage] auto-id assigned', r.id); } });
      return arr;
    },

    async addRecord(key, record) {
      if (!this.state.records[key]) this.state.records[key] = [];
      const id = record.id || genId();
      const now = new Date().toISOString();
      const item = Object.assign({ id, createdAt: now, updatedAt: now }, record);
      this.state.records[key].push(item);
      await this.save();
      return item;
    },

    async updateRecord(key, id, patch) {
      const arr = this.state.records[key] || [];
      const idx = arr.findIndex(r => r.id === id);
      if (idx >= 0) {
        arr[idx] = Object.assign({}, arr[idx], patch, { id, updatedAt: new Date().toISOString() });
        await this.save();
        return arr[idx];
      }
      return null;
    },

    async deleteRecord(key, id) {
      const arr = this.state.records[key] || [];
      const idx = arr.findIndex(r => r.id === id);
      console.log('[storage] delete', key, id, 'found at', idx, 'arr length', arr.length);
      if (idx >= 0) {
        arr.splice(idx, 1);
        await this.save();
        console.log('[storage] deleted, new length', arr.length);
        return true;
      }
      console.warn('[storage] delete NOT found, id=', id, 'available ids=', arr.map(r=>r.id));
      return false;
    },

    getRecord(key, id) {
      const arr = this.state.records[key] || [];
      return arr.find(r => r.id === id) || null;
    },

    getTags(scope) { return this.state.tags[scope] || []; },
    async addTag(scope, tag) {
      if (!this.state.tags[scope]) this.state.tags[scope] = [];
      const t = Object.assign({ id: genId() }, tag);
      this.state.tags[scope].push(t);
      await this.save();
      return t;
    },
    async updateTag(scope, id, patch) {
      const arr = this.state.tags[scope] || [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) { arr[idx] = Object.assign({}, arr[idx], patch); await this.save(); }
    },
    async deleteTag(scope, id) {
      const arr = this.state.tags[scope] || [];
      const idx = arr.findIndex(t => t.id === id);
      if (idx >= 0) { arr.splice(idx, 1); await this.save(); }
    },

    getSettings() { return this.state.settings; },
    async setSettings(patch) {
      this.state.settings = Object.assign({}, this.state.settings, patch);
      await this.save();
    },

    getRecordsByDate(dateStr) {
      const out = {};
      for (const k in this.state.records) {
        out[k] = this.state.records[k].filter(r => (r.date || '').slice(0, 10) === dateStr);
      }
      return out;
    },
    getDateIndex(scopeKey) {
      const idx = {};
      (this.state.records[scopeKey] || []).forEach(r => {
        const d = (r.date || '').slice(0, 10);
        if (d) idx[d] = (idx[d] || 0) + 1;
      });
      return idx;
    },
    getDateIndexByRoute(routeKey) {
      const idx = {};
      (this.state.records[routeKey] || []).forEach(r => {
        const d = (r.date || '').slice(0, 10);
        if (d) idx[d] = (idx[d] || 0) + 1;
      });
      return idx;
    },
    getDateIndexByModule() {
      const idx = {};
      const map = {
        'exp-tinball-color':'exp','exp-tinball-clear':'exp',
        'exp-tinpaste-color':'exp','exp-tinpaste-clear':'exp',
        'exp-materials':'exp',
        'patent-library':'patent','patent-innovation':'patent','patent-progress':'patent',
        'job-study':'job','job-companies':'job','job-resume':'job','job-fair':'job',
        'paper-progress':'paper',
      };
      for (const k in this.state.records) {
        const mod = map[k]; if (!mod) continue;
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
    if (record.tags && record.tags.length) lines.push(`- **标签**: ${record.tags.map(t => t.name).join('、')}`);
    lines.push(`- **创建时间**: ${record.createdAt || ''}`);
    lines.push(`- **更新时间**: ${record.updatedAt || ''}`);
    lines.push(''); lines.push('---'); lines.push('');
    const fieldMap = {
      'exp-tinball-color':['idea','result','analysis','nextPlan','files'],
      'exp-tinball-clear':['idea','result','analysis','nextPlan','files'],
      'exp-tinpaste-color':['idea','result','analysis','nextPlan','files'],
      'exp-tinpaste-clear':['idea','result','analysis','nextPlan','files'],
      'exp-materials':['name','desc','files'],
      'patent-library':['patentNo','patentName','summary','innovations','materials','files'],
      'patent-innovation':['idea','plan','materials','files'],
      'patent-progress':['content','files'],
      'job-study':['content','duration','done','files'],
      'job-companies':['name','location','url','hasInterview','interviewTime','interviewPlace','notes'],
      'job-resume':['fileName','change','target'],
      'job-fair':['time','location','company','notes'],
      'paper-progress':['content','files'],
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
        lines.push(`## ${label}`); lines.push(String(v)); lines.push('');
      }
    });
    return lines.join('\n');
  }

  const FIELD_LABELS = {
    idea:'今日实验构想',result:'实验结果',analysis:'原因分析',nextPlan:'明日安排',
    files:'附件',name:'名称',desc:'描述',patentNo:'专利号',patentName:'专利名称',
    summary:'摘要',innovations:'创新点',materials:'原材料信息',plan:'实施方案',
    content:'内容',duration:'时长（分钟）',done:'是否完成',location:'所在地',
    url:'网址',hasInterview:'是否有面试',interviewTime:'面试时间',interviewPlace:'面试地点',
    notes:'备注',fileName:'文件名',change:'修改部分',target:'适配公司',time:'时间',company:'公司名称',
  };

  function genId() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function exportAllMarkdown() {
    const out = [];
    out.push('# 加油毕业工作台 · 数据导出');
    out.push(''); out.push(`> 导出时间: ${new Date().toLocaleString()}`); out.push('');
    for (const k in Store.state.records) {
      const arr = Store.state.records[k] || [];
      if (!arr.length) continue;
      out.push(`## ${MODULE_LABELS[k] || k}（${arr.length}）`);
      out.push('');
      arr.forEach(r => { out.push('```markdown'); out.push(toMarkdown(r, k)); out.push('```'); out.push(''); });
    }
    return out.join('\n');
  }

  const MODULE_LABELS = {
    'exp-tinball-color':'锡球实验·有色','exp-tinball-clear':'锡球实验·无色',
    'exp-tinpaste-color':'锡膏实验·有色','exp-tinpaste-clear':'锡膏实验·无色',
    'exp-materials':'原料标签档案','patent-library':'专利资料库',
    'patent-innovation':'创新点记录','patent-progress':'我的专利进度',
    'job-study':'就业·学习','job-companies':'就业·相关公司',
    'job-resume':'就业·我的简历','job-fair':'就业·招聘会','paper-progress':'论文进度',
  };

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
  }

  async function exportToLocalFolder() {
    let totalRecs = 0;
    for (const k in Store.state.records) totalRecs += (Store.state.records[k]||[]).length;
    if (totalRecs === 0) {
      // 用全局 toast 提示
      if (typeof window !== 'undefined' && window.UI && window.UI.toast) {
        window.UI.toast('没有记录可导出', 'err');
      }
      return { ok: false, reason: 'empty' };
    }
    // 桌面 Chrome/Edge：选目录导出
    if (window.showDirectoryPicker) {
      try {
        const dir = await window.showDirectoryPicker();
        for (const k in Store.state.records) {
          const arr = Store.state.records[k] || [];
          if (!arr.length) continue;
          const sub = await dir.getDirectoryHandle(k, { create: true });
          for (const r of arr) {
            const baseName = `${(r.date||'').slice(0,10)}_${(r.title||r.name||r.id)}`.replace(/[\/\\:*?"<>|]/g,'_');
            const imgs = (r.files || []).filter(f => f.type && f.type.startsWith('image/'));
            for (let i = 0; i < imgs.length; i++) {
              const f = imgs[i];
              const ext = f.type === 'image/jpeg' ? 'jpg' : (f.type.split('/')[1] || 'png');
              try {
                const blob = await (await fetch(f.dataUrl)).blob();
                const imgFh = await sub.getFileHandle(`${baseName}_img${i+1}.${ext}`, { create: true });
                const w = await imgFh.createWritable();
                await w.write(blob); await w.close();
              } catch (_) {}
            }
            const fh = await sub.getFileHandle(baseName + '.md', { create: true });
            const w = await fh.createWritable();
            await w.write(toMarkdown(r, k)); await w.close();
          }
        }
        return { ok: true, mode: 'folder' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, aborted: true };
        // 失败则降级为下载
      }
    }
    // 降级：下载单个 .md 文件
    const text = exportAllMarkdown();
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `graduation-workbench-${new Date().toISOString().slice(0,10)}.md`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
    return { ok: true, mode: 'single' };
  }

  Store.clearAllData = async function () {
    const keepSettings = JSON.parse(JSON.stringify(Store.state.settings || {}));
    const fresh = deepClone(DEFAULT_STATE);
    fresh.settings = keepSettings;
    await saveToDB(fresh);
    Store.state = fresh;
  };

  global.Storage = Store;
  global.StorageUtils = {
    toMarkdown, exportAllMarkdown, downloadFile, exportToLocalFolder,
    clearAllData: () => Store.clearAllData(), MODULE_LABELS, FIELD_LABELS,
  };
})(window);
