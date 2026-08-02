/* ============================================
   supabase-sync.js - 可选云端同步
   通过 localStorage 缓存 + Supabase REST API
   零依赖：直接 fetch 调用
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
    client: null,
    syncing: false,
    _autoTimer: null,

    isConfigured() {
      const s = Storage.getSettings();
      return !!(s.supabaseUrl && s.supabaseKey);
    },

    init() {
      // 尝试动态加载 supabase-js（CDN）
      if (this.isConfigured() && !global.supabase) {
        return loadSupabaseLib().then(() => this._initClient()).catch(() => null);
      } else if (this.isConfigured() && global.supabase) {
        this._initClient();
        return Promise.resolve(this.client);
      }
      return Promise.resolve(null);
    },

    _initClient() {
      const s = Storage.getSettings();
      if (global.supabase && global.supabase.createClient) {
        try {
          this.client = global.supabase.createClient(s.supabaseUrl, s.supabaseKey, {
            auth: { persistSession: false },
          });
        } catch (e) {
          console.warn('supabase init fail', e);
          this.client = null;
        }
      }
      return this.client;
    },

    // ====== 断开连接：清空 URL/Key/autoSync，关闭客户端 ======
    disconnect() {
      // 取消待执行的自动推送
      if (this._autoTimer) { clearTimeout(this._autoTimer); this._autoTimer = null; }
      // 重置内存中的客户端
      this.client = null;
      // 清空 settings 中的 supabase 配置（保留其他设置）
      const s = Storage.getSettings();
      Storage.setSettings({
        supabaseUrl: '',
        supabaseKey: '',
        autoSync: false,
      });
      // 清空同步时间戳
      try { localStorage.removeItem('last_sync_at'); } catch (_) {}
    },

    // ====== 轻量连接测试 ======
    async testConnection() {
      if (!this.isConfigured()) return false;
      await this.init();
      if (!this.client) return false;
      try {
        // 用 tags 表做一次 select limit 1，验证连通性
        const { error } = await this.client
          .from(SYNC_TABLES.__tags__)
          .select('id')
          .limit(1);
        return !error;
      } catch (e) {
        console.warn('supabase testConnection fail', e);
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
      }, 3000); // 3 秒防抖
    },

    // ====== 全量推送（将本地数据推到云端）======
    async pushAll() {
      if (!this.isConfigured()) return { ok: false, reason: 'not-configured' };
      await this.init();
      if (!this.client) return { ok: false, reason: 'no-client' };
      this.syncing = true;
      const results = {};
      try {
        for (const key in Storage.state.records) {
          const table = SYNC_TABLES[key];
          if (!table) continue;
          const arr = Storage.state.records[key] || [];
          // upsert all
          if (!arr.length) continue;
          const rows = arr.map(r => ({ id: r.id, data: r, updated_at: r.updatedAt }));
          const { error } = await this.client.from(table).upsert(rows, { onConflict: 'id' });
          results[key] = error ? { ok: false, error: error.message } : { ok: true, n: rows.length };
        }
        // tags
        const tagsRow = { id: 'tags', data: Storage.state.tags, updated_at: new Date().toISOString() };
        await this.client.from(SYNC_TABLES.__tags__).upsert(tagsRow, { onConflict: 'id' });
        return { ok: true, results };
      } catch (e) {
        return { ok: false, error: e.message };
      } finally {
        this.syncing = false;
      }
    },

    // ====== 全量拉取 ======
    async pullAll() {
      if (!this.isConfigured()) return { ok: false, reason: 'not-configured' };
      await this.init();
      if (!this.client) return { ok: false, reason: 'no-client' };
      this.syncing = true;
      try {
        for (const key in Storage.state.records) {
          const table = SYNC_TABLES[key];
          if (!table) continue;
          const { data, error } = await this.client.from(table).select('*');
          if (error) { console.warn('pull', key, error); continue; }
          if (Array.isArray(data) && data.length > 0) {
            // 云端有数据才覆盖本地；为空时保留本地记录，防止误清空
            Storage.state.records[key] = data.map(r => r.data || r);
          }
        }
        // tags
        const { data: tagsData } = await this.client.from(SYNC_TABLES.__tags__).select('*').eq('id', 'tags').single();
        if (tagsData && tagsData.data) Storage.state.tags = tagsData.data;
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
      // push 失败时不拉取，避免用空数据覆盖本地记录
      if (!push.ok) return { push, pull: { ok: false, reason: 'push-failed' } };
      const pull = await this.pullAll();
      return { push, pull };
    }
  };

  function loadSupabaseLib() {
    return new Promise((resolve, reject) => {
      if (global.supabase) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('无法加载 supabase-js'));
      document.head.appendChild(s);
    });
  }

  global.SupabaseSync = SupabaseSync;
})(window);
