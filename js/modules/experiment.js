/* ============================================
   experiment.js - 实验进度模块
   子页：锡球/锡膏 × 有色/无色、原料标签档案
   通用：顶部月历 + 列表 + 加号新建
   ============================================ */
(function (global) {
  'use strict';
  const { $, $$, h, clear, fmtDate, today, toast, openModal, confirmDialog,
          renderTagPicker, openTagEditor, readFileAsDataURL, renderFileChip, renderRecordsList, createAffirmationCard } = UI;

  // 子页配置
  const PAGES = {
    'exp-tinball-color':  { color: 'exp', title: '锡球实验 · 有色', key: 'exp-tinball-color',  group: 'exp' },
    'exp-tinball-clear':  { color: 'exp', title: '锡球实验 · 无色', key: 'exp-tinball-clear',  group: 'exp' },
    'exp-tinpaste-color': { color: 'exp', title: '锡膏实验 · 有色', key: 'exp-tinpaste-color', group: 'exp' },
    'exp-tinpaste-clear': { color: 'exp', title: '锡膏实验 · 无色', key: 'exp-tinpaste-clear', group: 'exp' },
    'exp-materials':      { color: 'exp', title: '原料标签档案',    key: 'exp-materials',      group: 'exp' },
  };

  function render(root, route, query) {
    const cfg = PAGES[route];
    if (!cfg) return false;
    _currentRoute = route;
    clear(root);

    // 顶部：标题 + 搜索 + 批量删除
    const batchBtn = h('button', { class: 'btn btn-ghost btn-sm', style: 'margin-left:auto' }, '🗑️ 批量删除');
    const head = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-exp)' }),
        cfg.title,
      ]),
      h('div', { style: 'display:flex;gap:8px;align-items:center' }, [
        h('div', { class: 'search' }, [
          h('span', null, '🔍'),
          h('input', { id: 'expSearch', placeholder: '搜索本模块记录' }),
        ]),
        batchBtn,
      ])
    ]);
    root.appendChild(head);

    // 显化语句 + 月历 并排
    const calAffirmRow = h('div', { class: 'cal-affirm-row' });
    calAffirmRow.appendChild(UI.createAffirmationCard());
    const calWrap = h('div', { class: 'card', style: 'padding:10px 12px' });
    calAffirmRow.appendChild(calWrap);
    root.appendChild(calAffirmRow);

    let selectedDate = today();
    const cal = Calendar.create({
      onPick: (d) => { selectedDate = d; refreshList(); },
      dateIndexByModule: Storage.getDateIndexByRoute(route),
      routeColor: 'var(--c-exp)',
      selected: new Set([selectedDate]),
    });
    calWrap.appendChild(cal.el);

    // 列表
    const listWrap = h('div', { id: 'expListWrap' });
    root.appendChild(listWrap);

    // 加号
    const fab = h('button', { class: 'btn-fab', 'aria-label': '新建' }, '＋');
    fab.addEventListener('click', () => openEditor(null, cfg, () => {
      cal.refresh(Storage.getDateIndexByRoute(route));
      refreshList();
    }, selectedDate));
    root.appendChild(fab);

    // 搜索
    $('#expSearch').addEventListener('input', refreshList);

    // 批量删除开关
    batchBtn.addEventListener('click', () => {
      _batchMode = !_batchMode;
      _batchSelected.clear();
      batchBtn.textContent = _batchMode ? '✕ 退出批量' : '🗑️ 批量删除';
      batchBtn.className = _batchMode ? 'btn btn-soft btn-sm' : 'btn btn-ghost btn-sm';
      _refreshFn();
    });

    _refreshFn = refreshList;
    refreshList();

    function refreshList() {
      clear(listWrap);
      const kw = ($('#expSearch').value || '').trim().toLowerCase();

      // 搜索模式：在当前子模块的所有日期中搜索
      if (kw) {
        const records = Storage.getRecords(route)
          .filter(r => JSON.stringify(r).toLowerCase().includes(kw))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        listWrap.appendChild(h('div', { class: 'section-title' }, [
          '🔍 搜索 "' + kw + '"（' + records.length + ' 条）'
        ]));
        if (!records.length) {
          listWrap.appendChild(h('div', { class: 'empty', style: 'padding:20px;text-align:center' },
            '没有匹配的记录'));
        } else {
          const list = renderRecordsList(records, r => buildItem(r, cfg, () => {
            cal.refresh(Storage.getDateIndexByRoute(route));
            refreshList();
          }));
          listWrap.appendChild(list);
        }
        addBatchFooter();
        return;
      }

      // 正常模式：只显示选中日期的记录
      const records = Storage.getRecords(route);
      let filtered = records
        .filter(r => r.date === selectedDate)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

      listWrap.appendChild(h('div', { class: 'section-title' }, [
        '📅 ' + selectedDate + ' 的记录（' + filtered.length + '）'
      ]));

      if (!filtered.length) {
        listWrap.appendChild(h('div', { class: 'empty', style: 'padding:20px;text-align:center' },
          '这一天还没有记录，点右下角 ＋ 新建吧'
        ));
      } else {
        const list = renderRecordsList(filtered, r => buildItem(r, cfg, () => {
          cal.refresh(Storage.getDateIndexByRoute(route));
          refreshList();
        }));
        listWrap.appendChild(list);
      }
      addBatchFooter();
    }

    function addBatchFooter() {
      if (!_batchMode) return;
      // 获取当前显示的记录列表
      const kw = ($('#expSearch').value || '').trim().toLowerCase();
      let visibleRecords = [];
      if (kw) {
        visibleRecords = Storage.getRecords(route).filter(r => JSON.stringify(r).toLowerCase().includes(kw));
      } else {
        visibleRecords = Storage.getRecords(route).filter(r => r.date === selectedDate);
      }
      const allIds = visibleRecords.map(r => r.id);

      const bar = h('div', { class: 'batch-bar' }, [
        h('span', { class: 'batch-count' },
          _batchSelected.size > 0 ? ('已选 ' + _batchSelected.size + ' / ' + allIds.length + ' 条')
          : ('共 ' + allIds.length + ' 条，点击勾选')
        ),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
          allIds.forEach(id => _batchSelected.add(id));
          _refreshFn();
        }}, '全选'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => {
          _batchSelected.clear();
          _refreshFn();
        }}, '取消全选'),
        h('button', { class: 'btn btn-danger btn-sm', disabled: _batchSelected.size === 0 ? 'disabled' : null,
          onclick: _batchSelected.size === 0 ? null : (async () => {
            if (!await confirmDialog('确认删除 ' + _batchSelected.size + ' 条记录吗？\n此操作不可撤销，图片也将一并删除。')) return;
            const ids = [..._batchSelected];
            for (const id of ids) { await Storage.deleteRecord(route, id); }
            _batchSelected.clear();
            _batchMode = false;
            batchBtn.textContent = '🗑️ 批量删除';
            batchBtn.className = 'btn btn-ghost btn-sm';
            cal.refresh(Storage.getDateIndexByRoute(route));
            _refreshFn();
            toast('已删除 ' + ids.length + ' 条', 'ok');
          })
        }, '🗑️ 确认删除'),
      ]);
      listWrap.appendChild(bar);
    }

    // 打开既有记录
    if (query && query.openRecord) {
      const r = Storage.getRecord(route, query.openRecord);
      if (r) setTimeout(() => openEditor(r, cfg, () => {
        cal.refresh(Storage.getDateIndexByRoute(route));
        refreshList();
      }), 50);
    }
  }

  function buildItem(r, cfg, onChange) {
    const title = r.title || r.idea || r.name || r.summary || '未命名';
    const imgs = (r.files || []).filter(f => f.type && f.type.startsWith('image/'));
    const thumbs = imgs.length ? h('div', { class: 'li-thumbs' },
      imgs.slice(0, 3).map(f => h('img', { src: f.dataUrl, class: 'li-thumb-img', onclick: (e) => { e.stopPropagation(); viewImage(f.dataUrl); } }))
    ) : null;
    // 批量模式下的复选框
    const cb = _batchMode ? (() => {
      const c = h('input', { type: 'checkbox', class: 'batch-cb' });
      c.checked = _batchSelected.has(r.id);
      c.addEventListener('change', (e) => {
        if (e.target.checked) _batchSelected.add(r.id); else _batchSelected.delete(r.id);
        _refreshFn();
      });
      return c;
    })() : null;
    const item = h('div', { class: 'list-item' }, [
      cb,
      h('span', { class: 'li-emoji' }, cfg.title.includes('锡球') ? '⚪' : (cfg.title.includes('锡膏') ? '🟡' : '🏷️')),
      h('div', { class: 'li-main' }, [
        h('div', { class: 'li-title' }, title.slice(0, 40) + (title.length > 40 ? '…' : '')),
        h('div', { class: 'li-sub' }, (r.tags || []).map(t => '【' + t.name + '】').join('') || '—'),
        thumbs,
      ]),
      h('div', { class: 'li-meta' }, r.date || ''),
    ]);
    if (_batchMode) {
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'INPUT') return;
        const cb = item.querySelector('.batch-cb');
        cb.checked = !cb.checked;
        if (cb.checked) _batchSelected.add(r.id); else _batchSelected.delete(r.id);
        _refreshFn();
      });
    } else {
      item.addEventListener('click', () => openEditor(r, cfg, onChange));
    }
    return item;
  }

  // 查看大图
  function viewImage(dataUrl) {
    const img = h('img', { src: dataUrl, style: 'max-width:100%;max-height:70vh;border-radius:12px' });
    openModal({ title: '图片预览', body: img, footer: null });
  }

  // ===== 编辑器 =====
  function openEditor(record, cfg, onChange, defaultDate) {
    const isNew = !record;
    const data = record ? JSON.parse(JSON.stringify(record)) : {
      id: null,
      title: '',
      date: defaultDate || today(),
      tags: [],
      idea: '',
      result: '',
      analysis: '',
      nextPlan: '',
      files: [],
    };

    if (cfg.title === '原料标签档案') {
      openMaterialEditor(data, cfg, onChange);
      return;
    }

    const tagIds = data.tags.map(t => t.id);

    // 表单
    const titleInp = h('input', { class: 'input', placeholder: '实验标题（可留空）', value: data.title || '' });
    const dateInp  = h('input', { class: 'input', type: 'date', value: data.date });
    const tagPickerEl = renderTagPicker('exp', tagIds, (ids) => {
      data.tags = ids.map(id => Storage.getTags('exp').find(t => t.id === id)).filter(Boolean);
    });
    const ideaInp = h('textarea', { class: 'textarea', placeholder: '今日实验构想' }, data.idea || '');
    const resultInp = h('textarea', { class: 'textarea', placeholder: '实验结果' }, data.result || '');
    const analysisInp = h('textarea', { class: 'textarea', placeholder: '原因分析' }, data.analysis || '');
    const nextInp = h('textarea', { class: 'textarea', placeholder: '明日安排' }, data.nextPlan || '');

    const fileInput = h('input', { type: 'file', multiple: true, style: 'display:none' });
    const fileList = h('div', { class: 'tag-row' });
    function refreshFiles() {
      clear(fileList);
      (data.files || []).forEach((f, i) => {
        const chip = h('div', { class: 'file-thumb' }, [
          f.type && f.type.startsWith('image/') ? h('img', { src: f.dataUrl }) : h('span', null, '📎'),
          h('span', null, f.name),
          h('a', { href: '#', style: 'color:var(--danger);text-decoration:underline', 'data-i': i }, '✕'),
        ]);
        chip.querySelector('a').addEventListener('click', (e) => {
          e.preventDefault();
          data.files.splice(i, 1); refreshFiles();
        });
        fileList.appendChild(chip);
      });
    }
    refreshFiles();
    fileInput.addEventListener('change', async (e) => {
      for (const f of e.target.files) {
        try { data.files.push(await readFileAsDataURL(f)); } catch (_) {}
      }
      refreshFiles();
      fileInput.value = '';
    });
    const addFileBtn = h('button', { class: 'btn btn-ghost btn-sm' }, '📎 添加图片/文件');
    addFileBtn.addEventListener('click', () => fileInput.click());

    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '实验标题'), titleInp]),
      h('div', { class: 'field' }, [h('label', null, '日期'), dateInp]),
      h('div', { class: 'field' }, [h('label', null, '标签（可多选）'), tagPickerEl]),
      h('div', { class: 'field' }, [h('label', null, '今日实验构想'), ideaInp]),
      h('div', { class: 'field' }, [h('label', null, '实验结果'), resultInp]),
      h('div', { class: 'field' }, [h('label', null, '原因分析'), analysisInp]),
      h('div', { class: 'field' }, [h('label', null, '明日安排'), nextInp]),
      h('div', { class: 'field' }, [h('label', null, '附件（多图/文件）'), addFileBtn, fileInput, fileList]),
    ]);

    const saveBtn = h('button', { class: 'btn' }, isNew ? '保存' : '保存修改');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const footer = [delBtn, cancelBtn, saveBtn].filter(Boolean);

    const close = openModal({ title: cfg.title + (isNew ? ' · 新建' : ' · 编辑'), body, footer });
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除这条记录吗？此操作不可撤销。')) {
        Storage.deleteRecord(cfg.key, data.id);
        close.close();
        toast('已删除', 'ok');
        if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.title = titleInp.value.trim();
      data.date = dateInp.value;
      data.idea = ideaInp.value;
      data.result = resultInp.value;
      data.analysis = analysisInp.value;
      data.nextPlan = nextInp.value;
      if (!data.date) { toast('请选择日期', 'err'); return; }
      if (isNew) Storage.addRecord(cfg.key, data);
      else Storage.updateRecord(cfg.key, data.id, data);
      close.close();
      toast('已保存', 'ok');
      if (onChange) onChange();
    });
  }

  function getRouteKey() {
    return _currentRoute || 'exp-tinball-color';
  }
  let _currentRoute = null;
  let _batchMode = false, _batchSelected = new Set(), _refreshFn = null;

  // ===== 原料标签档案 =====
  function openMaterialEditor(record, cfg, onChange) {
    _currentRoute = 'exp-materials';
    const data = record && record.id ? record : { id: null, date: today(), name: '', desc: '', tags: [], files: [] };
    const tagIds = data.tags.map(t => t.id);

    const nameInp = h('input', { class: 'input', placeholder: '原料名称', value: data.name || '' });
    const dateInp = h('input', { class: 'input', type: 'date', value: data.date });
    const tagPickerEl = renderTagPicker('exp', tagIds, (ids) => {
      data.tags = ids.map(id => Storage.getTags('exp').find(t => t.id === id)).filter(Boolean);
    });
    const descInp = h('textarea', { class: 'textarea', placeholder: '原料描述、规格、用途、来源…' }, data.desc || '');

    const fileInput = h('input', { type: 'file', multiple: true, style: 'display:none' });
    const fileList = h('div', { class: 'tag-row' });
    function refreshFiles() {
      clear(fileList);
      (data.files || []).forEach((f, i) => {
        const chip = h('div', { class: 'file-thumb' }, [
          f.type && f.type.startsWith('image/') ? h('img', { src: f.dataUrl }) : h('span', null, '📎'),
          h('span', null, f.name),
          h('a', { href: '#', style: 'color:var(--danger)', 'data-i': i }, '✕'),
        ]);
        chip.querySelector('a').addEventListener('click', (e) => {
          e.preventDefault(); data.files.splice(i, 1); refreshFiles();
        });
        fileList.appendChild(chip);
      });
    }
    refreshFiles();
    fileInput.addEventListener('change', async (e) => {
      for (const f of e.target.files) {
        try { data.files.push(await readFileAsDataURL(f)); } catch (_) {}
      }
      refreshFiles(); fileInput.value = '';
    });

    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '原料名称'), nameInp]),
      h('div', { class: 'field' }, [h('label', null, '建档日期'), dateInp]),
      h('div', { class: 'field' }, [h('label', null, '标签'), tagPickerEl]),
      h('div', { class: 'field' }, [h('label', null, '描述'), descInp]),
      h('div', { class: 'field' }, [h('label', null, '附件'), h('button', { class: 'btn btn-ghost btn-sm', onclick: () => fileInput.click() }, '📎 添加'), fileInput, fileList]),
    ]);

    const saveBtn = h('button', { class: 'btn' }, data.id ? '保存修改' : '保存');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = data.id ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const footer = [delBtn, cancelBtn, saveBtn].filter(Boolean);
    const close = openModal({ title: cfg.title + (data.id ? ' · 编辑' : ' · 新建'), body, footer });
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除？')) {
        Storage.deleteRecord('exp-materials', data.id); close.close();
        toast('已删除', 'ok'); if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.name = nameInp.value.trim();
      data.date = dateInp.value;
      data.desc = descInp.value;
      if (!data.name) { toast('请输入原料名称', 'err'); return; }
      if (data.id) Storage.updateRecord('exp-materials', data.id, data);
      else Storage.addRecord('exp-materials', data);
      close.close(); toast('已保存', 'ok'); if (onChange) onChange();
    });
  }

  // 暴露 currentRoute setter
  function setCurrentRoute(r) { _currentRoute = r; }

  // 在 Router 调 render 前记录
  function preRoute(route) { _currentRoute = route; }

  global.ExperimentModule = { render, PAGES, setCurrentRoute, preRoute };
})(window);
