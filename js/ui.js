/* ============================================
   ui.js - 通用 UI 工具：弹窗 / Toast / 渲染辅助
   ============================================ */
(function (global) {
  'use strict';

  // 工具
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'style') el.setAttribute('style', attrs[k]);
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') el.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== undefined && attrs[k] !== null) el.setAttribute(k, attrs[k]);
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        if (c == null || c === false) return;
        if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(c));
        else el.appendChild(c);
      });
    }
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }
  function fmtDate(d) {
    if (!d) return '';
    const x = new Date(d);
    if (isNaN(x)) return '';
    const y = x.getFullYear();
    const m = String(x.getMonth() + 1).padStart(2, '0');
    const day = String(x.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  function fmtDateCN(d) {
    if (!d) return '';
    const x = new Date(d);
    if (isNaN(x)) return '';
    return `${x.getFullYear()}年${x.getMonth()+1}月${x.getDate()}日`;
  }
  function today() { return fmtDate(new Date()); }

  // ====== Toast ======
  function toast(msg, type) {
    const host = $('#toastHost');
    const el = h('div', { class: 'toast ' + (type || '') }, msg);
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      setTimeout(() => el.remove(), 400);
    }, 1800);
  }

  // ====== 弹窗 ======
  function openModal({ title, body, footer, onClose }) {
    const m = $('#modal');
    if (!m) { console.error('modal root not found'); return { close: () => {} }; }
    $('#modalTitle').textContent = title || '';
    clear($('#modalBody'));
    if (body) {
      if (typeof body === 'string') $('#modalBody').innerHTML = body;
      else $('#modalBody').appendChild(body);
    }
    // 关键修复：过滤掉 null/undefined/false 元素（原来会导致 appendChild 报错）
    clear($('#modalFoot'));
    if (footer) {
      const normalize = (b) => (b && typeof b === 'object' && b.nodeType === 1) ? b : null;
      if (Array.isArray(footer)) {
        footer.filter(b => normalize(b)).forEach(b => $('#modalFoot').appendChild(b));
      } else if (typeof footer === 'string') {
        $('#modalFoot').innerHTML = footer;
      } else if (normalize(footer)) {
        $('#modalFoot').appendChild(footer);
      }
    } else {
      $('#modalFoot').appendChild(h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '关闭'));
    }
    m.classList.add('open');
    m.setAttribute('aria-hidden', 'false');
    const closeHandler = () => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
      $$('[data-modal-close]', m).forEach(b => b.removeEventListener('click', closeHandler));
      if (onClose) onClose();
    };
    $$('[data-modal-close]', m).forEach(b => b.addEventListener('click', closeHandler));
    return { close: closeHandler };
  }
  function closeModal() { $('#modal').classList.remove('open'); }

  // ====== 简易确认（独立浮层，不影响主弹窗的 DOM 和事件）======
  function confirmDialog(text) {
    return new Promise((resolve) => {
      // 独立 confirm 浮层（在主弹窗之上）
      const wrap = h('div', { class: 'modal confirm-modal open', 'aria-hidden': 'false' });
      const mask = h('div', { class: 'modal-mask' });
      const panel = h('div', { class: 'modal-panel', style: 'max-width:340px' });
      const title = h('h3', { class: 'modal-title' }, '确认');
      const body  = h('div', { class: 'modal-body' }, [h('div', { style: 'white-space:pre-line;line-height:1.6;font-size:14px' }, text)]);
      const ok = h('button', { class: 'btn' }, '确定');
      const cancel = h('button', { class: 'btn btn-ghost' }, '取消');
      const foot = h('div', { class: 'modal-foot', style: 'display:flex;gap:8px;justify-content:flex-end' }, [cancel, ok]);
      panel.append(title, body, foot);
      wrap.append(mask, panel);
      document.body.appendChild(wrap);

      const close = (result) => {
        wrap.remove();
        resolve(result);
      };
      mask.addEventListener('click', () => close(false));
      ok.addEventListener('click', () => close(true));
      cancel.addEventListener('click', () => close(false));
    });
  }

  // ====== 通用：标签选择器（支持行内新建/删除/改色） ======
  const TAG_COLORS = ['#7ECDB8','#F5C24D','#B79CE0','#F5A0B0','#88B8E0','#FFB347','#A8D8B9','#F2C9D0','#C8B5E5','#F0D860'];
  function renderTagPicker(scope, selectedIds, onChange) {
    const tags = Storage.getTags(scope);
    const wrap = h('div', { class: 'tag-row tag-picker' });

    const refresh = () => {
      const fresh = renderTagPicker(scope, selectedIds, onChange);
      wrap.replaceWith(fresh);
    };

    tags.forEach(t => {
      const isOn = selectedIds.includes(t.id);
      const c = h('span', { class: 'chip' + (isOn ? ' on tag-managed' : ' tag-managed') }, [
        h('span', { class: 'swatch swatch-editable', style: `background:${t.color}`, title: '点击更换颜色' }),
        h('span', { class: 'tag-name' }, t.name),
        h('button', { class: 'tag-x', type: 'button', title: '删除标签', 'aria-label': '删除' }, '×'),
      ]);

      // 主体点击：切换选中
      c.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-x') || e.target.classList.contains('swatch-editable')) return;
        const idx = selectedIds.indexOf(t.id);
        if (idx >= 0) selectedIds.splice(idx, 1);
        else selectedIds.push(t.id);
        c.classList.toggle('on');
        if (onChange) onChange(selectedIds.slice());
      });

      // 色点：循环切换颜色
      const swatchEl = c.querySelector('.swatch-editable');
      swatchEl.addEventListener('click', (e) => {
        e.stopPropagation();
        const cur = t.color;
        const arr = TAG_COLORS.slice();
        // 当前色不在预设中，把它放到队首，确保下一次点也能轮换
        if (!arr.includes(cur)) arr.unshift(cur);
        const i = arr.indexOf(cur);
        const next = arr[(i + 1) % arr.length];
        Storage.updateTag(scope, t.id, { color: next });
        refresh();
      });

      // × 按钮：删除标签（带确认）
      c.querySelector('.tag-x').addEventListener('click', async (e) => {
        e.stopPropagation();
        const ok = await confirmDialog(`确定要删除标签「${t.name}」吗？使用过此标签的记录将不再显示此标签。`);
        if (!ok) return;
        Storage.deleteTag(scope, t.id);
        const idx2 = selectedIds.indexOf(t.id);
        if (idx2 >= 0) selectedIds.splice(idx2, 1);
        if (onChange) onChange(selectedIds.slice());
        toast('已删除', 'ok');
        refresh();
      });

      wrap.appendChild(c);
    });

    // 行内新建标签
    const add = h('span', { class: 'chip chip-add' }, '＋ 新建');
    add.addEventListener('click', () => {
      const editor = h('span', { class: 'chip chip-editor' });
      const nameInp = h('input', { class: 'tag-input', placeholder: '标签名（回车保存）', maxlength: 12 });
      const swatches = h('span', { class: 'tag-swatches' });
      let chosenColor = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
      TAG_COLORS.forEach(col => {
        const isOn = (col === chosenColor);
        const s = h('span', { class: 'swatch-dot' + (isOn ? ' on' : ''), style: `background:${col}` });
        s.addEventListener('click', (e) => {
          e.stopPropagation();
          chosenColor = col;
          $$('.swatch-dot', swatches).forEach(x => x.classList.toggle('on', x.style.background.includes(col)));
        });
        swatches.appendChild(s);
      });
      const saveInline = () => {
        const name = (nameInp.value || '').trim();
        if (!name) { toast('请输入标签名', 'err'); return; }
        const tag = Storage.addTag(scope, { name, color: chosenColor });
        if (!selectedIds.includes(tag.id)) selectedIds.push(tag.id);
        if (onChange) onChange(selectedIds.slice());
        toast('已添加', 'ok');
        const fresh = renderTagPicker(scope, selectedIds, onChange);
        wrap.replaceWith(fresh);
      };
      nameInp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); saveInline(); }
        if (e.key === 'Escape') { wrap.replaceWith(renderTagPicker(scope, selectedIds, onChange)); }
      });
      editor.appendChild(nameInp);
      editor.appendChild(swatches);
      add.replaceWith(editor);
      nameInp.focus();
    });
    wrap.appendChild(add);
    return wrap;
  }

  function openTagEditor(scope, onCreate) {
    const nameInp = h('input', { class: 'input', placeholder: '标签名称' });
    const colorInp = h('input', { class: 'input', type: 'color', value: '#A8B5A0', style: 'height:42px;padding:4px' });
    const save = h('button', { class: 'btn' }, '保存');
    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '名称'), nameInp]),
      h('div', { class: 'field' }, [h('label', null, '颜色'), colorInp]),
    ]);
    const close = openModal({ title: '新建标签', body, footer: [h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消'), save] });
    save.addEventListener('click', () => {
      const name = nameInp.value.trim();
      if (!name) { toast('请输入标签名', 'err'); return; }
      const tag = Storage.addTag(scope, { name, color: colorInp.value });
      close.close();
      toast('已添加', 'ok');
      if (onCreate) onCreate(tag);
    });
  }

  // ====== 文件 → base64 dataURL ======
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        if (file.type && file.type.startsWith('image/')) {
          compressImage(fr.result, 800, 0.7).then(dataUrl => {
            resolve({ name: file.name, type: 'image/jpeg', size: dataUrl.length, dataUrl });
          }).catch(() => {
            // 压缩失败用原图
            resolve({ name: file.name, type: file.type, size: file.size, dataUrl: fr.result });
          });
        } else {
          resolve({ name: file.name, type: file.type, size: file.size, dataUrl: fr.result });
        }
      };
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  function compressImage(dataUrl, maxWidth, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  // ====== 文件预览（缩略图/链接） ======
  function renderFileChip(f) {
    const isImg = f.type && f.type.startsWith('image/');
    if (isImg) {
      return h('a', { class: 'file-thumb', href: f.dataUrl, target: '_blank' }, [
        h('img', { src: f.dataUrl, alt: f.name }),
        f.name
      ]);
    }
    return h('a', { class: 'file-thumb', href: f.dataUrl, download: f.name }, '📎 ' + f.name);
  }

  // ====== 简易 HTML 转义（render 用） ======
  function renderRecordsList(records, mapper) {
    if (!records.length) {
      return h('div', { class: 'empty' }, [
        h('div', { class: 'e-emoji' }, '🌱'),
        h('div', null, '还没有记录，从右上角加号开始吧'),
      ]);
    }
    const list = h('div', { class: 'list' });
    records.forEach(r => list.appendChild(mapper(r)));
    return list;
  }

  // ====== 每日显化语句 ======
  const AFFIRMATIONS = [
    '我拥有无穷的力量，能够显化我的任何愿望。',
    '我相信相信的力量，一切美好都在向我走来。',
    '每一天，我都在变得更好、更强、更接近目标。',
    '我正在吸引一切成功与好运来到我的生命中。',
    '我的潜力是无限的，我能做到任何我决定做的事。',
    '宇宙正在为我安排最好的结果，我只需相信。',
    '我感恩当下拥有的一切，更多美好正在到来。',
    '我专注的能量在哪里，成果就在哪里。',
    '我有能力创造我想要的生活，没有人能阻挡我。',
    '我值得拥有我想要的一切，我全然接受。',
    '我的每一步努力都在为未来铺路，我不会放弃。',
    '我选择相信今天会是美好的一天，事实也是如此。',
    '我内心的力量远超想象，我正在不断突破自己。',
    '所有我需要的资源、人和机会，都会在对的时刻出现。',
    '我释放所有的怀疑和恐惧，选择相信自己的能力。',
    '我是自己人生的创造者，我创造我想要的现实。',
    '我对自己充满信心，我知道自己走在正确的路上。',
    '今天的选择会成为明天的礼物，我选择行动。',
    '我允许自己成功，我允许自己快乐，我允许自己闪耀。',
    '困难只是垫脚石，每一次跨越都让我更强大。',
    '我的能量场在吸引着同频的美好人和事。',
    '我相信直觉的指引，我知道该做什么。',
    '我放下比较，专注于自己的节奏和成长。',
    '我是完整的，我是有力量的，我是充满爱的。',
    '每一个清晨都是新的开始，我选择拥抱它。',
    '我对自己温柔而坚定，我允许自己慢慢来。',
    '我的人生正在按照完美的节奏展开。',
    '我种下的每一颗种子，都将在对的时间开花。',
    '我相信过程，我享受旅程，我期待结果。',
    '我是光，我是力量，我是爱的化身。',
    '今天，我选择成为最好的自己。',
  ];

  function getDailyAffirmation() {
    const d = new Date();
    const idx = d.getDate() % AFFIRMATIONS.length;
    return AFFIRMATIONS[idx];
  }

  function createAffirmationCard() {
    const text = getDailyAffirmation();
    const d = new Date();
    const dateLabel = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`;
    return h('div', { class: 'affirmation-card' }, [
      h('div', { class: 'affirmation-text' }, '✦ ' + text + ' ✦'),
      h('div', { class: 'affirmation-sub' }, '— 今日显化 · ' + dateLabel + ' —'),
    ]);
  }

  // ====== 跨子分类搜索 ======
  // 每个子分类对应的"标题/名称"字段（用户搜索时匹配的字段）
  const SEARCH_FIELDS = {
    'exp-tinball-color':  ['title'],
    'exp-tinball-clear':  ['title'],
    'exp-tinpaste-color': ['title'],
    'exp-tinpaste-clear': ['title'],
    'exp-materials':      ['name'],
    'patent-library':     ['patentName', 'patentNo'],
    'patent-innovation':  ['title'],
    'patent-progress':    ['content'],
    'job-study':          ['content'],
    'job-companies':      ['name'],
    'job-resume':         ['fileName', 'target'],
    'job-fair':           ['company'],
    'paper-progress':     ['content'],
  };

  // 各分组包含的子分类键
  const GROUP_ROUTES = {
    exp:    ['exp-tinball-color', 'exp-tinball-clear', 'exp-tinpaste-color', 'exp-tinpaste-clear', 'exp-materials'],
    patent: ['patent-library', 'patent-innovation', 'patent-progress'],
    job:    ['job-study', 'job-companies', 'job-resume', 'job-fair'],
    paper:  ['paper-progress'],
  };

  // 子分类的 emoji
  const ROUTE_EMOJI = {
    'exp-tinball-color':  '🟠',
    'exp-tinball-clear':  '⚪',
    'exp-tinpaste-color': '🟡',
    'exp-tinpaste-clear': '🟨',
    'exp-materials':      '🏷️',
    'patent-library':     '📜',
    'patent-innovation':  '💡',
    'patent-progress':    '📊',
    'job-study':          '📚',
    'job-companies':      '🏢',
    'job-resume':         '📄',
    'job-fair':           '🎪',
    'paper-progress':     '📝',
  };

  // 从记录里取出"标题/名称"
  function getRecordTitle(key, r) {
    const fields = SEARCH_FIELDS[key] || ['title'];
    for (const f of fields) {
      const v = r[f];
      if (v && String(v).trim()) return String(v);
    }
    return '';
  }

  /**
   * 在某个分组的所有子分类里搜索匹配的记录
   * @param {string} group - 'exp' | 'patent' | 'job' | 'paper'
   * @param {string} kw - 关键词（不区分大小写）
   * @returns {Array<{ key, r, title, date, label, emoji }>}
   */
  function searchInGroup(group, kw) {
    const routes = GROUP_ROUTES[group] || [];
    const q = (kw || '').trim().toLowerCase();
    if (!q) return [];
    const labels = (global.StorageUtils && global.StorageUtils.MODULE_LABELS) || {};
    const out = [];
    routes.forEach(key => {
      const records = Storage.getRecords(key) || [];
      records.forEach(r => {
        const title = getRecordTitle(key, r);
        if (!title) return;
        if (title.toLowerCase().includes(q)) {
          out.push({
            key,
            r,
            title,
            date: r.date || '',
            label: labels[key] || key,
            emoji: ROUTE_EMOJI[key] || '📌',
          });
        }
      });
    });
    // 按日期降序
    out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return out;
  }

  /**
   * 渲染跨子分类搜索结果面板
   * @param {Array} matches - searchInGroup 返回的结果
   * @param {function} onPick - 点击某条 (match) => void；默认行为是跳到对应路由并打开记录
   */
  function renderGroupSearchResults(matches, onPick) {
    if (!matches.length) {
      return h('div', { class: 'empty', style: 'padding:18px;text-align:center' }, '没有匹配的记录');
    }
    const wrap = h('div', { class: 'search-results' });

    // 按子分类分组
    const grouped = {};
    matches.forEach(m => { (grouped[m.key] = grouped[m.key] || []).push(m); });
    Object.keys(grouped).forEach(k => {
      const items = grouped[k];
      wrap.appendChild(h('div', { class: 'section-title' }, [
        (items[0].emoji || '📌') + ' ' + items[0].label + '（' + items.length + '）'
      ]));
      items.forEach(m => {
        const item = h('div', { class: 'list-item' }, [
          h('span', { class: 'li-emoji' }, m.emoji),
          h('div', { class: 'li-main' }, [
            h('div', { class: 'li-title' }, m.title),
            h('div', { class: 'li-sub' }, '📅 ' + (m.date || '未指定日期')),
          ]),
          h('div', { class: 'li-meta' }, [
            h('span', { class: 'badge-route', style: 'background:#FFF' }, '查看'),
          ]),
        ]);
        item.addEventListener('click', () => {
          if (onPick) onPick(m);
          else Router.go(m.key, { openRecord: m.r.id });
        });
        wrap.appendChild(item);
      });
    });
    return wrap;
  }

  // 导出
  global.UI = {
    $, $$, h, clear, escapeHtml, fmtDate, fmtDateCN, today,
    toast, openModal, closeModal, confirmDialog,
    renderTagPicker, openTagEditor, readFileAsDataURL, renderFileChip, renderRecordsList,
    getDailyAffirmation, createAffirmationCard,
    // 新增：跨子分类搜索
    SEARCH_FIELDS, GROUP_ROUTES, ROUTE_EMOJI,
    getRecordTitle, searchInGroup, renderGroupSearchResults,
  };
})(window);
