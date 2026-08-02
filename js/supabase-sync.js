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
    _pullTimer: null,
    _lastPullCount: 0,

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
    // 立即推送（增删改时触发）
    pushNow() {
      const s = Storage.getSettings();
      if (!s.autoSync || !this.isConfigured() || this.syncing) return;
      this.pushAll();
    },

    // ====== 自动拉取（定期检查云端新数据）======
    startAutoPull(intervalMs = 15000) {
      if (!this.isConfigured()) return;
      this.stopAutoPull();
      this._pullTimer = setInterval(() => {
        if (this.syncing || document.hidden) return;
        this._doAutoPull();
      }, intervalMs);
      // 页面切回前台时立即拉一次
      document.addEventListener('visibilitychange', this._onVisible);
    },
    stopAutoPull() {
      if (this._pullTimer) { clearInterval(this._pullTimer); this._pullTimer = null; }
      document.removeEventListener('visibilitychange', this._onVisible);
    },
    _onVisible() {
      if (!document.hidden && SupabaseSync.isConfigured() && !SupabaseSync.syncing) {
        SupabaseSync._doAutoPull();
      }
    },
    async _doAutoPull() {
      const before = {};
      for (const k in Storage.state.records) { before[k] = (Storage.state.records[k]||[]).length; }
      await this.pullAll();
      // 检测是否有新数据
      let changed = false;
      for (const k in Storage.state.records) {
        if ((Storage.state.records[k]||[]).length !== (before[k]||0)) changed = true;
      }
      if (changed && this.onDataChanged) this.onDataChanged();
    },
    onDataChanged: null,  // 外部设置的回调
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
              Storage.state.records[key] = data.map(r => r.data || r);
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
      if (!push.ok) return { push, pull: { ok: false, reason: 'push-failed' } };
      const pull = await this.pullAll();
      return { push, pull };
    }
  };

  global.SupabaseSync = SupabaseSync;
})(window);
