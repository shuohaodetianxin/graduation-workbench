/* ============================================
   patent.js - 专利进度模块
   1) 专利资料库（按录入时间倒序 / 文件上传 / AI 解析创新点）
   2) 创新点记录（原料标签 + 创新构思 + 实施方案 + 所需材料）
   3) 我的专利进度（月历 + 纵向时间线）
   ============================================ */
(function (global) {
  'use strict';
  const { $, $$, h, clear, fmtDate, today, toast, openModal, confirmDialog,
          renderTagPicker, readFileAsDataURL, renderFileChip, renderRecordsList, createAffirmationCard } = UI;

  const TITLES = {
    'patent-library':    '专利资料库',
    'patent-innovation': '创新点记录',
    'patent-progress':   '我的专利进度',
  };

  function render(root, route, query) {
    if (!TITLES[route]) return false;
    ExperimentModule.setCurrentRoute(route);
    clear(root);

    const head = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-patent)' }),
        TITLES[route],
      ]),
      h('div', { class: 'search' }, [
        h('span', null, '🔍'),
        h('input', { id: 'patentSearch', placeholder: '搜索本模块记录' }),
      ])
    ]);
    root.appendChild(head);

    if (route === 'patent-progress') return renderPatentProgress(root, query);
    if (route === 'patent-library') return renderPatentLibrary(root, query);
    if (route === 'patent-innovation') return renderInnovation(root, query);
  }

  // ============ 专利资料库 ============
  function renderPatentLibrary(root, query) {
    const listWrap = h('div', { id: 'patentList' });
    root.appendChild(listWrap);

    const fab = h('button', { class: 'btn-fab', 'aria-label': '新建' }, '＋');
    fab.addEventListener('click', () => openLibraryEditor(null, () => refresh()));
    root.appendChild(fab);

    $('#patentSearch').addEventListener('input', refresh);

    function refresh() {
      clear(listWrap);
      const kw = ($('#patentSearch').value || '').trim().toLowerCase();
      const records = Storage.getRecords('patent-library')
        .filter(r => !kw || JSON.stringify(r).toLowerCase().includes(kw))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      listWrap.appendChild(h('div', { class: 'section-title' }, [
        kw ? '🔍 搜索 "' + kw + '"（' + records.length + ' 条）' : '📚 专利资料（' + records.length + '）'
      ]));
      const list = renderRecordsList(records, r => buildLibraryItem(r, refresh));
      listWrap.appendChild(list);
    }
    refresh();
    if (query && query.openRecord) {
      const r = Storage.getRecord('patent-library', query.openRecord);
      if (r) setTimeout(() => openLibraryEditor(r, refresh), 50);
    }
  }

  function buildLibraryItem(r, onChange) {
    const item = h('div', { class: 'list-item' }, [
      h('span', { class: 'li-emoji' }, '📜'),
      h('div', { class: 'li-main' }, [
        h('div', { class: 'li-title' }, r.patentName || r.title || '未命名专利'),
        h('div', { class: 'li-sub' }, [
          r.patentNo ? '【' + r.patentNo + '】 ' : '',
          r.summary ? r.summary.slice(0, 50) + (r.summary.length > 50 ? '…' : '') : '—'
        ].join('')),
      ]),
      h('div', { class: 'li-meta' }, (r.date || '').slice(0, 10)),
    ]);
    item.addEventListener('click', () => openLibraryEditor(r, onChange));
    return item;
  }

  function openLibraryEditor(record, onChange) {
    const isNew = !record;
    const data = record ? JSON.parse(JSON.stringify(record)) : {
      id: null, date: today(), patentNo: '', patentName: '', summary: '',
      innovations: '', materials: '', files: [], aiParsed: false,
    };
    const dateInp = h('input', { class: 'input', type: 'date', value: data.date });
    const noInp = h('input', { class: 'input', placeholder: '专利号 / 申请号', value: data.patentNo || '' });
    const nameInp = h('input', { class: 'input', placeholder: '专利名称', value: data.patentName || '' });
    const summaryInp = h('textarea', { class: 'textarea', placeholder: '摘要' }, data.summary || '');
    const innovInp = h('textarea', { class: 'textarea', placeholder: '创新点（AI 解析后填入，可手动修改）' }, data.innovations || '');
    const matInp = h('textarea', { class: 'textarea', placeholder: '原材料信息' }, data.materials || '');

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
        chip.querySelector('a').addEventListener('click', (e) => { e.preventDefault(); data.files.splice(i, 1); refreshFiles(); });
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

    const aiBtn = h('button', { class: 'btn btn-soft btn-sm' }, '🤖 AI 解析创新点');
    aiBtn.addEventListener('click', () => {
      aiParse(noInp.value + ' ' + nameInp.value + '\n' + summaryInp.value, (result) => {
        if (result.innovations) innovInp.value = result.innovations;
        if (result.materials) matInp.value = result.materials;
        toast('AI 解析完成（请人工核对）', 'ok');
      });
    });

    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '日期'), dateInp]),
      h('div', { class: 'field' }, [h('label', null, '专利号 / 申请号'), noInp]),
      h('div', { class: 'field' }, [h('label', null, '专利名称'), nameInp]),
      h('div', { class: 'field' }, [h('label', null, '摘要'), summaryInp]),
      h('div', { class: 'field' }, [
        h('label', null, '创新点'),
        h('div', { style: 'display:flex;gap:8px;align-items:flex-start' }, [
          h('div', { style: 'flex:1' }, innovInp),
          h('div', { style: 'padding-top:6px' }, aiBtn),
        ])
      ]),
      h('div', { class: 'field' }, [h('label', null, '原材料信息'), matInp]),
      h('div', { class: 'field' }, [
        h('label', null, '专利文件（PDF/图片）'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => fileInput.click() }, '📎 上传文件'),
        fileInput, fileList
      ]),
    ]);
    const saveBtn = h('button', { class: 'btn' }, isNew ? '保存' : '保存修改');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const footer = [delBtn, cancelBtn, saveBtn].filter(Boolean);
    const close = openModal({ title: '专利资料库 · ' + (isNew ? '新增' : '编辑'), body, footer });
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除？')) {
        Storage.deleteRecord('patent-library', data.id); close.close();
        toast('已删除', 'ok'); if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.date = dateInp.value;
      data.patentNo = noInp.value.trim();
      data.patentName = nameInp.value.trim();
      data.summary = summaryInp.value;
      data.innovations = innovInp.value;
      data.materials = matInp.value;
      if (isNew) Storage.addRecord('patent-library', data);
      else Storage.updateRecord('patent-library', data.id, data);
      close.close(); toast('已保存', 'ok'); if (onChange) onChange();
    });
  }

  // AI 解析（启发式本地实现，识别关键词并提取）
  function aiParse(text, cb) {
    setTimeout(() => {
      const lines = text.split(/[\n。;；,，]/).map(s => s.trim()).filter(Boolean);
      const innovationKw = ['创新', '改进', '新颖', '首次', '突破', '优势', '解决', '提升', '降低', '增强', '延长', '减小', '防止', '避免', '环保', '无铅', '低银', '高可靠'];
      const materialKw = ['松香', '溶剂', '活性剂', '有机胺', '缓蚀剂', '抗氧化剂', '触变剂', '锡', '银', '铜', '镍', '铋', '锑', '锌', '树脂'];
      const innov = lines.filter(l => innovationKw.some(k => l.includes(k)));
      const mat   = lines.filter(l => materialKw.some(k => l.includes(k)));
      cb({
        innovations: innov.length ? innov.slice(0, 8).map(s => '• ' + s).join('\n') : '（未识别到明确创新点，请手动填写）',
        materials:   mat.length ? mat.slice(0, 8).map(s => '• ' + s).join('\n') : '（未识别到明确原材料，请手动填写）',
      });
    }, 400);
  }

  // ============ 创新点记录 ============
  function renderInnovation(root, query) {
    const listWrap = h('div', { id: 'innList' });
    root.appendChild(listWrap);
    const fab = h('button', { class: 'btn-fab', 'aria-label': '新建' }, '＋');
    fab.addEventListener('click', () => openInnovationEditor(null, () => refresh()));
    root.appendChild(fab);
    $('#patentSearch').addEventListener('input', refresh);
    function refresh() {
      clear(listWrap);
      const kw = ($('#patentSearch').value || '').trim().toLowerCase();
      const records = Storage.getRecords('patent-innovation')
        .filter(r => !kw || JSON.stringify(r).toLowerCase().includes(kw))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      listWrap.appendChild(h('div', { class: 'section-title' }, [
        kw ? '🔍 搜索 "' + kw + '"（' + records.length + ' 条）' : '💡 创新点（' + records.length + '）'
      ]));
      const list = renderRecordsList(records, r => buildInnItem(r, refresh));
      listWrap.appendChild(list);
    }
    refresh();
    if (query && query.openRecord) {
      const r = Storage.getRecord('patent-innovation', query.openRecord);
      if (r) setTimeout(() => openInnovationEditor(r, refresh), 50);
    }
  }
  function buildInnItem(r, onChange) {
    const item = h('div', { class: 'list-item' }, [
      h('span', { class: 'li-emoji' }, '💡'),
      h('div', { class: 'li-main' }, [
        h('div', { class: 'li-title' }, r.title || r.idea || '未命名创新点'),
        h('div', { class: 'li-sub' }, (r.tags || []).map(t => '【' + t.name + '】').join('') || '—'),
      ]),
      h('div', { class: 'li-meta' }, r.date || ''),
    ]);
    item.addEventListener('click', () => openInnovationEditor(r, onChange));
    return item;
  }
  function openInnovationEditor(record, onChange) {
    const isNew = !record;
    const data = record ? JSON.parse(JSON.stringify(record)) : {
      id: null, date: today(), title: '', idea: '', plan: '', materials: '',
      tags: [], files: [],
    };
    const tagIds = data.tags.map(t => t.id);
    const dateInp = h('input', { class: 'input', type: 'date', value: data.date });
    const titleInp = h('input', { class: 'input', placeholder: '创新点标题', value: data.title || '' });
    const tagPickerEl = renderTagPicker('patent', tagIds, (ids) => {
      data.tags = ids.map(id => Storage.getTags('patent').find(t => t.id === id)).filter(Boolean);
    });
    const ideaInp = h('textarea', { class: 'textarea', placeholder: '创新构思' }, data.idea || '');
    const planInp = h('textarea', { class: 'textarea', placeholder: '实施方案' }, data.plan || '');
    const matInp = h('textarea', { class: 'textarea', placeholder: '所需材料' }, data.materials || '');

    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '日期'), dateInp]),
      h('div', { class: 'field' }, [h('label', null, '创新点标题'), titleInp]),
      h('div', { class: 'field' }, [h('label', null, '原料标签（可多选）'), tagPickerEl]),
      h('div', { class: 'field' }, [h('label', null, '创新构思'), ideaInp]),
      h('div', { class: 'field' }, [h('label', null, '实施方案'), planInp]),
      h('div', { class: 'field' }, [h('label', null, '所需材料'), matInp]),
    ]);
    const saveBtn = h('button', { class: 'btn' }, isNew ? '保存' : '保存修改');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const footer = [delBtn, cancelBtn, saveBtn].filter(Boolean);
    const close = openModal({ title: '创新点记录 · ' + (isNew ? '新增' : '编辑'), body, footer });
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除？')) {
        Storage.deleteRecord('patent-innovation', data.id); close.close();
        toast('已删除', 'ok'); if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.date = dateInp.value; data.title = titleInp.value.trim();
      data.idea = ideaInp.value; data.plan = planInp.value; data.materials = matInp.value;
      if (isNew) Storage.addRecord('patent-innovation', data);
      else Storage.updateRecord('patent-innovation', data.id, data);
      close.close(); toast('已保存', 'ok'); if (onChange) onChange();
    });
  }

  // ============ 我的专利进度 ============
  function renderPatentProgress(root, query) {
    const calAffirmRow = h('div', { class: 'cal-affirm-row' });
    calAffirmRow.appendChild(createAffirmationCard());
    const calWrap = h('div', { class: 'card', style: 'padding:10px 12px' });
    calAffirmRow.appendChild(calWrap);
    root.appendChild(calAffirmRow);
    let selectedDate = today();
    const cal = Calendar.create({
      onPick: (d) => { selectedDate = d; },
      dateIndexByModule: Storage.getDateIndexByRoute('patent-progress'),
      routeColor: 'var(--c-patent)',
      selected: new Set([selectedDate]),
    });
    calWrap.appendChild(cal.el);

    const inputArea = h('div', { class: 'card' });
    root.appendChild(inputArea);
    refreshInput();

    function refreshInput() {
      clear(inputArea);
      inputArea.appendChild(h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-patent)' }),
        selectedDate + ' · 进度'
      ]));
      const existed = Storage.getRecords('patent-progress').find(r => r.date === selectedDate);
      const ta = h('textarea', { class: 'textarea', placeholder: '输入当日专利进度，例如：撰写权利要求书 1-3、完成附图说明…' }, existed ? existed.content : '');
      const saveBtn = h('button', { class: 'btn' }, existed ? '保存修改' : '保存');
      const delBtn = existed ? h('button', { class: 'btn btn-danger' }, '删除') : null;
      const actions = h('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [delBtn, saveBtn].filter(Boolean));
      inputArea.appendChild(ta);
      inputArea.appendChild(actions);
      saveBtn.addEventListener('click', () => {
        if (!ta.value.trim()) { toast('请输入内容', 'err'); return; }
        if (existed) Storage.updateRecord('patent-progress', existed.id, { content: ta.value });
        else Storage.addRecord('patent-progress', { date: selectedDate, content: ta.value });
        toast('已保存', 'ok');
        cal.refresh(Storage.getDateIndexByRoute('patent-progress'));
        refreshTimeline();
      });
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (await confirmDialog('确认删除？')) {
          Storage.deleteRecord('patent-progress', existed.id);
          toast('已删除', 'ok');
          cal.refresh(Storage.getDateIndexByRoute('patent-progress'));
          refreshInput();
          refreshTimeline();
        }
      });
    }

    // 时间线
    const tlWrap = h('div', { class: 'card' });
    root.appendChild(tlWrap);
    function refreshTimeline() {
      clear(tlWrap);
      const kw = ($('#patentSearch').value || '').trim().toLowerCase();
      const records = Storage.getRecords('patent-progress')
        .filter(r => !kw || JSON.stringify(r).toLowerCase().includes(kw))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      tlWrap.appendChild(h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-patent)' }),
        kw ? '🔍 搜索 "' + kw + '"（' + records.length + ' 条）' : '时间线'
      ]));
      if (!records.length) {
        tlWrap.appendChild(h('div', { class: 'empty' }, [
          h('div', { class: 'e-emoji' }, '🌿'),
          h('div', null, kw ? '没有匹配的记录' : '点击日历日期开始记录'),
        ]));
        return;
      }
      const tl = h('div', { class: 'timeline' });
      records.forEach(r => {
        const item = h('div', { class: 'tl-item', 'data-color': 'patent' }, [
          h('div', { class: 'tl-date' }, UI.fmtDateCN(r.date)),
          h('div', { class: 'tl-body' }, r.content),
          h('div', { class: 'tl-actions' }, [
            (() => {
              const b = h('button', { class: 'btn btn-ghost btn-sm' }, '编辑');
              b.addEventListener('click', () => { selectedDate = r.date; cal.setMonth(new Date(r.date).getFullYear(), new Date(r.date).getMonth()); refreshInput(); });
              return b;
            })()
          ])
        ]);
        tl.appendChild(item);
      });
      tlWrap.appendChild(tl);
    }
    refreshTimeline();

    // 搜索框 input 事件
    $('#patentSearch').addEventListener('input', refreshTimeline);
  }

  global.PatentModule = { render, TITLES };
})(window);
