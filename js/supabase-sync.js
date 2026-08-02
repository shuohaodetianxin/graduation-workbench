/* ============================================
   supabase-sync.js - 云端同步（纯 fetch，无 CDN 依赖）
   ============================================ */
(function (global) {
  'use strict';

  const SYNC_TABLES = {
    'exp-tinball-color':  'exp_tinball_color',
    'exp-tinball-clear':  'exp_tinball_clear',
    'exp-tinpaste-color': 'exp_tinpaste_color',
    'exp-tinpaste-clear': 'exp_tinpaste_clear',
    'exp-materials':      'exp_materials',
    'patent-library':     'patent_library',
    'patent-innovation':  'patent_innovation',
    'patent-progress':    'patent_progress',
    'job-study':          'job_study',
    'job-companies':      'job_companies',
    'job-resume':         'job_resume',
    'job-fair':           'job_fair',
    'paper-progress':     'paper_progress',
    '__tags__':           'tags',
    '__settings__':       'settings',
  };

  const SupabaseSync = {
    syncing: false,
    _autoTimer: null,

    _restUrl() {
      const s = Storage.getSettings();
      return (s.supabaseUrl || '').replace(/\/+$/, '') + '/rest/v1';
    },
    _headers() {
      const s = Storage.getSettings();
      return {
        'apikey': s.supabaseKey || '',
        'Authorization': 'Bearer ' + (s.supabaseKey || ''),
        'Content-Type': 'application/json',
      };
    },
    isConfigured() {
      const s = Storage.getSettings();
      return !!(s.supabaseUrl && s.supabaseKey);
    },

    // ====== 断开连接 ======
    disconnect() {
      if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
      Storage.setSettings({ supabaseUrl: '', supabaseKey: '', autoSync: false });
      try { localStorage.removeItem('last_sync_at'); } catch (_) {}
    },

    // ====== 连接测试 ======
    async testConnection() {
      if (!this.isConfigured()) return false;
      try {
        const res = await fetch(this._restUrl() + '/tags?id=eq.tags&select=id', {
          headers: this._headers(),
        });
        return res.ok;
      } catch (e) {
        return false;
      }
    },

    // ====== 自动推送（防抖）======
    autoPush() {
      const s = Storage.getSettings();
      if (!s.autoSync || !this.isConfigured()) return;
      if (this._autoTimer) clearTimeout(this._autoTimer);
      this._autoTimer = setTimeout(async () => {
        if (this.syncing) return;
        await this.pushAll();
      }, 3000);
    },

    // ====== 全量推送 ======
    async pushAll() {
      if (!this.isConfigured()) return { ok: false, reason: 'not-configured' };
      this.syncing = true;
      const results = {};
      try {
        for (const key in Storage.state.records) {
          const table = SYNC_TABLES[key];
          if (!table) continue;
          const arr = Storage.state.records[key] || [];
          if (!arr.length) continue;
          // 构建推送行，确保每条有唯一id
          const rows = arr.map(r => ({ 
            id: r.id || ('r_' + Date.now() + '_' + Math.random().toString(36).slice(2,8)), 
            data: JSON.parse(JSON.stringify(r)),
            updated_at: r.updatedAt || new Date().toISOString() 
          }));
          // 先删光该表，再批量插入（全量替换，简单可靠）
          await fetch(this._restUrl() + '/' + table + '?id=neq.0', {
            method: 'DELETE',
            headers: this._headers(),
          }).catch(() => {});
          const res = await fetch(this._restUrl() + '/' + table, {
            method: 'POST',
            headers: { ...this._headers(), 'Prefer': 'return=minimal' },
            body: JSON.stringify(rows),
          });
          results[key] = res.ok ? { ok: true, n: rows.length } 
            : { ok: false, error: 'HTTP' + res.status + ' ' + (await res.text().catch(()=>'')).substring(0,200) };
          if (!res.ok) results._anyError = true;
        }
        // tags: 删旧插新
        const tagsRow = { id: 'tags', data: Storage.state.tags, updated_at: new Date().toISOString() };
        await fetch(this._restUrl() + '/tags?id=eq.tags', { method: 'DELETE', headers: this._headers() }).catch(()=>{});
        await fetch(this._restUrl() + '/tags', {
          method: 'POST',
          headers: { ...this._headers(), 'Prefer': 'return=minimal' },
          body: JSON.stringify(tagsRow),
        }).catch(()=>{});
        return { ok: !results._anyError, results };
      } catch (e) {
        return { ok: false, error: e.message };
      } finally {
        this.syncing = false;
      }
    },

    // ====== 全量拉取 ======
    async pullAll() {
      if (!this.isConfigured()) return { ok: false, reason: 'not-configured' };
      this.syncing = true;
      try {
        for (const key in SYNC_TABLES) {
          if (key.startsWith('__')) continue;
          const table = SYNC_TABLES[key];
          try {
            const res = await fetch(this._restUrl() + '/' + table + '?select=*', {
              headers: this._headers(),
            });
            if (!res.ok) continue;
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              // 合并云端和本地：云端数据按id覆盖/新增，本地独有数据保留
              const cloudMap = {};
              data.forEach(r => { if (r.data) cloudMap[r.data.id || r.id] = r.data; });
              const local = Storage.state.records[key] || [];
              const merged = [];
              const seen = new Set();
              // 先加云端数据
              Object.values(cloudMap).forEach(r => { merged.push(r); seen.add(r.id); });
              // 再加本地独有的
              local.forEach(r => { if (!seen.has(r.id)) merged.push(r); });
              Storage.state.records[key] = merged;
            }
          } catch (e) {
            console.warn('pull error', key, e);
          }
        }
        // tags
        try {
          const res = await fetch(this._restUrl() + '/tags?id=eq.tags&select=data', {
            headers: this._headers(),
          });
          if (res.ok) {
            const arr = await res.json();
            if (arr.length > 0 && arr[0].data) Storage.state.tags = arr[0].data;
          }
        } catch (_) {}
        Storage.save();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: e.message };
      } finally {
        this.syncing = false;
      }
    },

    async syncBoth() {
      const push = await this.pushAll();
      const pull = await this.pullAll();
      return { push, pull };
    }
  };

  global.SupabaseSync = SupabaseSync;
})(window);
