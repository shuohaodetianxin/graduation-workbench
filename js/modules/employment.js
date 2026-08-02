/* ============================================
   employment.js - 就业进度模块
   1) 学习：日历 + 自定义标签 + 时长 + 完成 + 柱状统计
   2) 相关公司：省份选择 + 列表 + 面试标记
   3) 我的简历：日期 → 上传简历 → 列表
   4) 招聘会：月历 + 加号新建 + 当日底部日程
   ============================================ */
(function (global) {
  'use strict';
  const { $, $$, h, clear, fmtDate, today, toast, openModal, confirmDialog,
          renderTagPicker, readFileAsDataURL, renderFileChip, renderRecordsList, createAffirmationCard } = UI;

  const TITLES = {
    'job-study':     '就业 · 学习',
    'job-companies': '就业 · 相关公司',
    'job-resume':    '就业 · 我的简历',
    'job-fair':      '就业 · 招聘会',
  };

  const PROVINCES = ['北京','上海','天津','重庆','广东','江苏','浙江','山东','河南','四川','湖北','福建','湖南','河北','山西','内蒙古','辽宁','吉林','黑龙江','安徽','江西','广西','海南','贵州','云南','西藏','陕西','甘肃','青海','宁夏','新疆'];

  function render(root, route, query) {
    if (!TITLES[route]) return false;
    clear(root);

    const head = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-job)' }),
        TITLES[route],
      ]),
      h('div', { class: 'search' }, [
        h('span', null, '🔍'),
        h('input', { id: 'jobSearch', placeholder: '搜索本模块记录' }),
      ]),
    ]);
    root.appendChild(head);

    if (route === 'job-study')     return renderStudy(root, query);
    if (route === 'job-companies') return renderCompanies(root, query);
    if (route === 'job-resume')    return renderResume(root, query);
    if (route === 'job-fair')      return renderFair(root, query);
  }

  // ============ 学习 ============
  function renderStudy(root, query) {
    let selectedDate = today();
    const calAffirmRow = h('div', { class: 'cal-affirm-row' });
    calAffirmRow.appendChild(createAffirmationCard());
    const calWrap = h('div', { class: 'card', style: 'padding:10px 12px' });
    calAffirmRow.appendChild(calWrap);
    root.appendChild(calAffirmRow);
    const cal = Calendar.create({
      onPick: (d) => { selectedDate = d; dateInp.value = d; refreshList(); },
      dateIndexByModule: Storage.getDateIndexByRoute('job-study'),
      routeColor: 'var(--c-job)',
      selected: new Set([selectedDate]),
    });
    calWrap.appendChild(cal.el);

    // 新增学习（页内表单）
    const newCard = h('div', { class: 'card' });
    newCard.appendChild(h('div', { class: 'card-title' }, [
      h('span', { class: 'dot', style: 'background:var(--c-job)' }),
      '📝 新增学习记录'
    ]));
    const tagIds = [];
    const contentInp = h('input', { class: 'input', placeholder: '学习内容（例：刷 LeetCode 两题）' });
    const durInp = h('input', { class: 'input', type: 'number', min: 0, placeholder: '时长（分钟）' });
    const doneInp = h('input', { type: 'checkbox', id: 'studyDone' });
    const doneLabel = h('label', { for: 'studyDone', style: 'display:inline-flex;align-items:center;gap:6px' }, [doneInp, '已完成']);
    const dateInp = h('input', { class: 'input', type: 'date', value: selectedDate });
    const tagPickerEl = renderTagPicker('job', tagIds, () => {});
    newCard.appendChild(h('div', { class: 'row cols-2' }, [
      h('div', { class: 'field' }, [h('label', null, '日期'), dateInp]),
      h('div', { class: 'field' }, [h('label', null, '时长（分钟）'), durInp]),
    ]));
    newCard.appendChild(h('div', { class: 'field' }, [h('label', null, '内容'), contentInp]));
    newCard.appendChild(h('div', { class: 'field' }, [h('label', null, '标签（可多选）'), tagPickerEl]));
    newCard.appendChild(h('div', { class: 'field' }, [doneLabel]));
    const addBtn = h('button', { class: 'btn', style: 'margin-top:10px' }, '保存');
    newCard.appendChild(addBtn);
    root.appendChild(newCard);

    // 柱状图（按标签累计）
    const chartCard = h('div', { class: 'card' });
    chartCard.appendChild(h('div', { class: 'card-title' }, [
      h('span', { class: 'dot', style: 'background:var(--c-job)' }),
      '📊 标签累计时长'
    ]));
    const chartEl = h('div', { class: 'bar-chart' });
    chartCard.appendChild(chartEl);
    root.appendChild(chartCard);

    // 列表
    const listWrap = h('div', { id: 'studyList' });
    root.appendChild(listWrap);
    function refreshChart() {
      clear(chartEl);
      const records = Storage.getRecords('job-study');
      const map = {};
      records.forEach(r => {
        const dur = +r.duration || 0;
        (r.tags || []).forEach(t => { map[t.name] = (map[t.name] || 0) + dur; });
      });
      const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
      if (!entries.length) {
        chartCard.appendChild(h('div', { class: 'empty', style: 'padding:20px' }, '还没有数据，开始记录吧～'));
        return;
      }
      const max = Math.max(...entries.map(e => e[1])) || 1;
      entries.slice(0, 8).forEach(([name, val]) => {
        const col = h('div', { class: 'bar-col' }, [
          h('div', { class: 'val' }, val + '分'),
          h('div', { class: 'bar', style: `height:${(val / max) * 130 + 6}px` }),
          h('div', { class: 'lbl', title: name }, name),
        ]);
        chartEl.appendChild(col);
      });
    }
    function refreshList() {
      clear(listWrap);
      const kw = ($('#jobSearch').value || '').trim().toLowerCase();
      let records;
      if (kw) {
        // 搜索模式：所有日期
        records = Storage.getRecords('job-study')
          .filter(r => JSON.stringify(r).toLowerCase().includes(kw))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        listWrap.appendChild(h('div', { class: 'section-title' }, ['🔍 搜索 "' + kw + '"（' + records.length + ' 条）']));
      } else {
        records = Storage.getRecords('job-study')
          .filter(r => r.date === selectedDate)
          .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        listWrap.appendChild(h('div', { class: 'section-title' }, ['📅 ' + selectedDate + ' 的学习记录（' + records.length + '）']));
      }
      if (!records.length) {
        listWrap.appendChild(h('div', { class: 'empty', style: 'padding:20px;text-align:center' }, kw ? '没有匹配的记录' : '这一天还没有学习记录'));
      }
      const list = renderRecordsList(records, r => {
        const item = h('div', { class: 'list-item' }, [
          h('span', { class: 'li-emoji' }, r.done ? '✅' : '⏳'),
          h('div', { class: 'li-main' }, [
            h('div', { class: 'li-title' }, r.content || '—'),
            h('div', { class: 'li-sub' }, [
              (r.tags || []).map(t => '【' + t.name + '】').join(''),
              '  ·  ' + (r.duration || 0) + ' 分钟',
            ].join('')),
          ]),
          h('div', { class: 'li-meta' }, r.date || ''),
        ]);
        item.addEventListener('click', () => openStudyEditor(r, refreshAll));
        return item;
      });
      listWrap.appendChild(list);
    }
    function refreshAll() { cal.refresh(Storage.getDateIndexByRoute('job-study')); refreshChart(); refreshList(); }
    refreshAll();

    // 搜索绑定
    $('#jobSearch').addEventListener('input', refreshList);

    addBtn.addEventListener('click', () => {
      const content = contentInp.value.trim();
      if (!content) { toast('请输入学习内容', 'err'); return; }
      const data = {
        date: dateInp.value || today(),
        content,
        duration: +durInp.value || 0,
        done: doneInp.checked,
        tags: tagIds.slice().map(id => Storage.getTags('job').find(t => t.id === id)).filter(Boolean),
      };
      Storage.addRecord('job-study', data);
      contentInp.value = ''; durInp.value = ''; doneInp.checked = false;
      toast('已保存', 'ok');
      refreshAll();
    });

    function openStudyEditor(record, onChange) {
      const isNew = !record;
      const data = record ? JSON.parse(JSON.stringify(record)) : { id: null, date: today(), content: '', duration: 0, done: false, tags: [] };
      const tagIds2 = (data.tags || []).map(t => t.id);
      const dateInp2 = h('input', { class: 'input', type: 'date', value: data.date });
      const contentInp2 = h('input', { class: 'input', value: data.content });
      const durInp2 = h('input', { class: 'input', type: 'number', value: data.duration });
      const doneInp2 = h('input', { type: 'checkbox' }); doneInp2.checked = !!data.done;
      const tagPickerEl2 = renderTagPicker('job', tagIds2, () => {});
      const body = h('div', { class: 'row' }, [
        h('div', { class: 'field' }, [h('label', null, '日期'), dateInp2]),
        h('div', { class: 'field' }, [h('label', null, '内容'), contentInp2]),
        h('div', { class: 'field' }, [h('label', null, '时长（分钟）'), durInp2]),
        h('div', { class: 'field' }, [h('label', null, '标签'), tagPickerEl2]),
        h('div', { class: 'field' }, [h('label', null, '状态'), h('label', { style: 'display:inline-flex;gap:6px' }, [doneInp2, '已完成'])]),
      ]);
      const saveBtn = h('button', { class: 'btn' }, '保存');
      const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
      const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
      const close = openModal({ title: '学习 · 编辑', body, footer: [delBtn, cancelBtn, saveBtn] });
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (await confirmDialog('确认删除？')) {
          Storage.deleteRecord('job-study', data.id); close.close();
          toast('已删除', 'ok'); if (onChange) onChange();
        }
      });
      saveBtn.addEventListener('click', () => {
        data.date = dateInp2.value; data.content = contentInp2.value;
        data.duration = +durInp2.value || 0; data.done = doneInp2.checked;
        data.tags = tagIds2.map(id => Storage.getTags('job').find(t => t.id === id)).filter(Boolean);
        if (isNew) Storage.addRecord('job-study', data);
        else Storage.updateRecord('job-study', data.id, data);
        close.close(); toast('已保存', 'ok'); if (onChange) onChange();
      });
    }
  }

  // ============ 相关公司 ============
  function renderCompanies(root, query) {
    let cur = PROVINCES[0];

    // 省份滑动栏
    const bar = h('div', { class: 'province-bar' });
    PROVINCES.forEach(p => {
      const c = h('div', { class: 'prov-chip' + (p === cur ? ' active' : '') }, p);
      c.addEventListener('click', () => {
        cur = p;
        $$('.prov-chip', bar).forEach(x => x.classList.toggle('active', x.textContent === p));
        refresh();
      });
      bar.appendChild(c);
    });
    root.appendChild(bar);

    // 列表
    const listWrap = h('div', { id: 'compList' });
    root.appendChild(listWrap);

    // 明显的页内按钮 + 浮动 FAB 双入口
    const inlineAdd = h('button', { class: 'btn btn-soft', style: 'margin-bottom:14px;width:100%' }, '＋ 在 ' + cur + ' 添加公司');
    inlineAdd.addEventListener('click', () => openCompanyEditor(null, cur, refresh));
    root.appendChild(inlineAdd);

    const fab = h('button', { class: 'btn-fab', 'aria-label': '添加公司', title: '添加公司' }, '＋');
    fab.addEventListener('click', () => openCompanyEditor(null, cur, refresh));
    root.appendChild(fab);

    function refresh() {
      clear(listWrap);
      const kw = ($('#jobSearch').value || '').trim().toLowerCase();
      let records = Storage.getRecords('job-companies');
      if (kw) {
        records = records.filter(r => JSON.stringify(r).toLowerCase().includes(kw));
        listWrap.appendChild(h('div', { class: 'section-title' }, ['🔍 搜索 "' + kw + '"（' + records.length + ' 条）']));
      } else {
        records = records.filter(r => (r.location || '').includes(cur));
        listWrap.appendChild(h('div', { class: 'section-title' }, ['📍 ' + cur + '（' + records.length + '）']));
      }
      records = records.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      const list = renderRecordsList(records, r => {
        const item = h('div', { class: 'list-item' + (r.hasInterview ? ' has-interview' : '') }, [
          h('span', { class: 'li-emoji' }, r.hasInterview ? '🎯' : '🏢'),
          h('div', { class: 'li-main' }, [
            h('div', { class: 'li-title' }, r.name || '—'),
            h('div', { class: 'li-sub' }, [
              r.location || '',
              r.hasInterview ? '  ·  面试: ' + (r.interviewTime || '待定') + ' @ ' + (r.interviewPlace || '—') : '',
            ].join('')),
          ]),
          h('div', { class: 'li-meta' }, [
            r.url ? h('a', { href: r.url, target: '_blank', style: 'color:var(--primary)' }, '🔗') : ''
          ]),
        ]);
        item.addEventListener('click', () => openCompanyEditor(r, cur, refresh));
        return item;
      });
      listWrap.appendChild(list);
    }
    refresh();

    // 搜索绑定
    $('#jobSearch').addEventListener('input', refresh);
  }

  function openCompanyEditor(record, province, onChange) {
    const isNew = !record;
    const data = record ? JSON.parse(JSON.stringify(record)) : {
      id: null, date: today(), name: '', location: province || '', url: '',
      hasInterview: false, interviewTime: '', interviewPlace: '', notes: '',
    };

    const nameInp = h('input', { class: 'input', placeholder: '公司名称', value: data.name || '' });
    const locInp = h('input', { class: 'input', placeholder: '所在地（省/市）', value: data.location || '' });
    const urlInp = h('input', { class: 'input', placeholder: '公司网址（选填）', value: data.url || '' });
    const hasInp = h('input', { type: 'checkbox' }); hasInp.checked = !!data.hasInterview;
    const timeInp = h('input', { class: 'input', type: 'datetime-local', value: data.interviewTime || '' });
    const placeInp = h('input', { class: 'input', placeholder: '面试地点', value: data.interviewPlace || '' });
    const notesInp = h('textarea', { class: 'textarea', placeholder: '备注' }, data.notes || '');
    const dateInp = h('input', { class: 'input', type: 'date', value: data.date });

    function syncInterview() {
      const en = hasInp.checked;
      timeInp.disabled = !en;
      placeInp.disabled = !en;
      timeInp.style.opacity = en ? '1' : '.45';
      placeInp.style.opacity = en ? '1' : '.45';
      timeInp.style.background = en ? '#fff' : '#f3f4f5';
      placeInp.style.background = en ? '#fff' : '#f3f4f5';
      timeInp.placeholder = en ? '选择面试时间' : '先勾选"有面试"';
      placeInp.placeholder = en ? '面试地点' : '先勾选"有面试"';
    }
    hasInp.addEventListener('change', syncInterview);
    syncInterview();

    const interviewFields = h('div', { class: 'row cols-2 interview-fields' }, [
      h('div', { class: 'field' }, [h('label', null, '面试时间'), timeInp]),
      h('div', { class: 'field' }, [h('label', null, '面试地点'), placeInp]),
    ]);

    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '公司名称 *'), nameInp]),
      h('div', { class: 'field' }, [h('label', null, '所在地'), locInp]),
      h('div', { class: 'field' }, [h('label', null, '公司网址'), urlInp]),
      h('div', { class: 'field' }, [h('label', null, '登记日期'), dateInp]),
      h('div', { class: 'field' }, [
        h('label', { class: 'check-row' }, [hasInp, ' 是否有面试（勾选后可填时间和地点）']),
      ]),
      interviewFields,
      h('div', { class: 'field' }, [h('label', null, '备注'), notesInp]),
    ]);

    const saveBtn = h('button', { class: 'btn' }, '保存');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const close = openModal({ title: '相关公司 · ' + (isNew ? '新增' : '编辑'), body, footer: [delBtn, cancelBtn, saveBtn] });

    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除？')) {
        Storage.deleteRecord('job-companies', data.id); close.close();
        toast('已删除', 'ok'); if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.name = nameInp.value.trim();
      data.location = locInp.value.trim();
      data.url = urlInp.value.trim();
      data.hasInterview = hasInp.checked;
      data.interviewTime = hasInp.checked ? timeInp.value : '';
      data.interviewPlace = hasInp.checked ? placeInp.value : '';
      data.notes = notesInp.value;
      if (!data.name) { toast('请输入公司名称', 'err'); return; }
      if (isNew) Storage.addRecord('job-companies', data);
      else Storage.updateRecord('job-companies', data.id, data);
      close.close(); toast('已保存', 'ok'); if (onChange) onChange();
    });
  }

  // ============ 我的简历 ============
  function renderResume(root, query) {
    // 明显的页内按钮
    const inlineAdd = h('button', { class: 'btn btn-soft', style: 'margin-bottom:14px;width:100%' }, '＋ 上传新简历');
    inlineAdd.addEventListener('click', () => openResumeDatePicker(refresh));
    root.appendChild(inlineAdd);

    const listWrap = h('div', { id: 'resumeList' });
    root.appendChild(listWrap);

    const fab = h('button', { class: 'btn-fab', 'aria-label': '上传简历', title: '上传简历' }, '＋');
    fab.addEventListener('click', () => openResumeDatePicker(refresh));
    root.appendChild(fab);

    function refresh() {
      clear(listWrap);
      const kw = ($('#jobSearch').value || '').trim().toLowerCase();
      const records = Storage.getRecords('job-resume')
        .filter(r => !kw || JSON.stringify(r).toLowerCase().includes(kw))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      listWrap.appendChild(h('div', { class: 'section-title' }, [
        kw ? '🔍 搜索 "' + kw + '"（' + records.length + ' 条）' : '📄 简历版本（' + records.length + '）'
      ]));
      const list = renderRecordsList(records, r => {
        const item = h('div', { class: 'list-item' }, [
          h('span', { class: 'li-emoji' }, '📄'),
          h('div', { class: 'li-main' }, [
            h('div', { class: 'li-title' }, r.fileName || '简历'),
            h('div', { class: 'li-sub' }, [
              r.target ? '适配: ' + r.target : '',
              r.change ? (r.target ? ' · ' : '') + r.change.slice(0, 40) : '',
            ].join('')),
          ]),
          h('div', { class: 'li-meta' }, r.date || ''),
        ]);
        item.addEventListener('click', () => openResumeEditor(r, r.date, refresh));
        return item;
      });
      listWrap.appendChild(list);
    }
    refresh();

    // 搜索绑定
    $('#jobSearch').addEventListener('input', refresh);
  }

  // 第一步：选择简历更新日期
  function openResumeDatePicker(onChange) {
    const dateInp = h('input', { class: 'input', type: 'date', value: today() });
    const next = h('button', { class: 'btn' }, '下一步 → 上传');
    const body = h('div', { class: 'field' }, [
      h('label', null, '这份简历的更新日期'),
      dateInp,
    ]);
    const close = openModal({
      title: '上传简历 · 第 1 步 / 共 2 步',
      body,
      footer: [h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消'), next],
    });
    next.addEventListener('click', () => {
      if (!dateInp.value) { toast('请选择日期', 'err'); return; }
      close.close();
      openResumeEditor(null, dateInp.value, onChange);
    });
  }

  // 第二步：上传文件 + 编辑
  function openResumeEditor(record, date, onChange) {
    const isNew = !record;
    const data = record ? JSON.parse(JSON.stringify(record)) : {
      id: null, date: date || today(), fileName: '', fileData: null, change: '', target: '',
    };
    const dateInp = h('input', { class: 'input', type: 'date', value: data.date });
    const fileInp = h('input', { type: 'file', style: 'display:none', accept: '.pdf,.doc,.docx,.png,.jpg,.jpeg' });
    const fileBox = h('div', { class: 'file-thumb', style: 'padding:8px 12px;width:100%' });
    const pickFileBtn = h('button', { class: 'btn btn-ghost btn-sm' }, '📎 选择文件');

    function refreshFile() {
      clear(fileBox);
      if (data.fileData) {
        const f = data.fileData;
        fileBox.appendChild(h('span', null, f.type && f.type.startsWith('image/') ? '🖼️' : '📎'));
        fileBox.appendChild(h('span', null, f.name));
        if (f.dataUrl) {
          const dl = h('a', { href: f.dataUrl, download: f.name, style: 'color:var(--primary);margin-left:6px' }, '下载');
          fileBox.appendChild(dl);
        }
      } else {
        fileBox.appendChild(h('span', { style: 'color:var(--text-faint)' }, '（未上传）'));
      }
    }
    refreshFile();
    pickFileBtn.addEventListener('click', () => fileInp.click());
    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const d = await readFileAsDataURL(f);
        data.fileData = d; data.fileName = f.name;
        refreshFile();
        toast('已选择文件', 'ok');
      } catch (_) { toast('读取失败', 'err'); }
    });

    const targetInp = h('input', { class: 'input', placeholder: '适配公司（例：宁德时代）', value: data.target || '' });
    const changeInp = h('textarea', { class: 'textarea', placeholder: '本次修改了哪些部分' }, data.change || '');

    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '日期'), dateInp]),
      h('div', { class: 'field' }, [
        h('label', null, '简历文件 *'),
        h('div', { style: 'display:flex;gap:8px;align-items:center' }, [pickFileBtn, fileBox]),
        fileInp,
      ]),
      h('div', { class: 'field' }, [h('label', null, '适配公司'), targetInp]),
      h('div', { class: 'field' }, [h('label', null, '修改部分'), changeInp]),
    ]);
    const saveBtn = h('button', { class: 'btn' }, '保存');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const close = openModal({ title: '我的简历 · ' + (isNew ? '新增' : '编辑'), body, footer: [delBtn, cancelBtn, saveBtn] });
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除？')) {
        Storage.deleteRecord('job-resume', data.id); close.close();
        toast('已删除', 'ok'); if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.date = dateInp.value;
      data.target = targetInp.value.trim();
      data.change = changeInp.value;
      if (!data.fileName) { toast('请上传简历文件', 'err'); return; }
      if (isNew) Storage.addRecord('job-resume', data);
      else Storage.updateRecord('job-resume', data.id, data);
      close.close(); toast('已保存', 'ok'); if (onChange) onChange();
    });
  }

  // ============ 招聘会 ============
  function renderFair(root, query) {
    const calAffirmRow = h('div', { class: 'cal-affirm-row' });
    calAffirmRow.appendChild(createAffirmationCard());
    const calWrap = h('div', { class: 'card', style: 'padding:10px 12px' });
    calAffirmRow.appendChild(calWrap);
    root.appendChild(calAffirmRow);
    let selectedDate = today();
    const cal = Calendar.create({
      onPick: (d) => { selectedDate = d; refreshFair(); },
      dateIndexByModule: Storage.getDateIndexByRoute('job-fair'),
      routeColor: 'var(--c-job)',
      selected: new Set([selectedDate]),
    });
    calWrap.appendChild(cal.el);

    const dayWrap = h('div', { class: 'card' });
    root.appendChild(dayWrap);

    // 双入口：明显的页内按钮 + FAB
    const inlineAdd = h('button', { class: 'btn btn-soft', style: 'margin-bottom:14px;width:100%' }, '＋ 为 ' + selectedDate + ' 新建招聘会日程');
    inlineAdd.addEventListener('click', () => openFairEditor({ date: selectedDate }, () => { cal.refresh(Storage.getDateIndexByRoute('job-fair')); refreshFair(); }));
    root.appendChild(inlineAdd);

    const fab = h('button', { class: 'btn-fab', 'aria-label': '新建招聘会日程', title: '新建招聘会日程' }, '＋');
    fab.addEventListener('click', () => openFairEditor({ date: selectedDate }, () => { cal.refresh(Storage.getDateIndexByRoute('job-fair')); refreshFair(); }));
    root.appendChild(fab);

    function refreshFair() {
      clear(dayWrap);
      const kw = ($('#jobSearch').value || '').trim().toLowerCase();
      let items;
      if (kw) {
        items = Storage.getRecords('job-fair')
          .filter(r => JSON.stringify(r).toLowerCase().includes(kw))
          .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        dayWrap.appendChild(h('div', { class: 'card-title' }, [
          h('span', { class: 'dot', style: 'background:var(--c-job)' }),
          '🔍 搜索 "' + kw + '"（' + items.length + ' 条）'
        ]));
      } else {
        items = Storage.getRecords('job-fair').filter(r => r.date === selectedDate)
          .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
        dayWrap.appendChild(h('div', { class: 'card-title' }, [
          h('span', { class: 'dot', style: 'background:var(--c-job)' }),
          selectedDate + ' · 当日招聘会'
        ]));
      }
      const list = renderRecordsList(items, r => {
        const item = h('div', { class: 'list-item' }, [
          h('span', { class: 'li-emoji' }, '🎪'),
          h('div', { class: 'li-main' }, [
            h('div', { class: 'li-title' }, r.company || '—'),
            h('div', { class: 'li-sub' }, [r.time, r.location].filter(Boolean).join(' · ') + (r.notes ? ' · ' + r.notes.slice(0, 20) : '')),
          ]),
        ]);
        item.addEventListener('click', () => openFairEditor(r, () => { cal.refresh(Storage.getDateIndexByRoute('job-fair')); refreshFair(); }));
        return item;
      });
      dayWrap.appendChild(list);
      // 卡片底部再放一个"新建日程"按钮作为兜底
      const innerAdd = h('button', { class: 'btn btn-soft btn-sm', style: 'margin-top:10px;width:100%' }, '＋ 新建招聘会日程');
      innerAdd.addEventListener('click', () => openFairEditor({ date: selectedDate }, () => { cal.refresh(Storage.getDateIndexByRoute('job-fair')); refreshFair(); }));
      dayWrap.appendChild(innerAdd);
    }
    refreshFair();

    // 搜索绑定
    $('#jobSearch').addEventListener('input', refreshFair);
  }

  function openFairEditor(record, onChange) {
    const isNew = !record || !record.id;
    const data = record ? JSON.parse(JSON.stringify(record)) : { id: null, date: today(), time: '', location: '', company: '', notes: '' };
    const dateInp = h('input', { class: 'input', type: 'date', value: data.date });
    const timeInp = h('input', { class: 'input', type: 'time', value: data.time || '' });
    const locInp = h('input', { class: 'input', placeholder: '地点', value: data.location || '' });
    const compInp = h('input', { class: 'input', placeholder: '招聘会名称 / 主办方', value: data.company || '' });
    const notesInp = h('textarea', { class: 'textarea', placeholder: '备注' }, data.notes || '');
    const body = h('div', { class: 'row' }, [
      h('div', { class: 'field' }, [h('label', null, '日期'), dateInp]),
      h('div', { class: 'field' }, [h('label', null, '时间'), timeInp]),
      h('div', { class: 'field' }, [h('label', null, '地点'), locInp]),
      h('div', { class: 'field' }, [h('label', null, '招聘会名称 *'), compInp]),
      h('div', { class: 'field' }, [h('label', null, '备注'), notesInp]),
    ]);
    const saveBtn = h('button', { class: 'btn' }, '保存');
    const cancelBtn = h('button', { class: 'btn btn-ghost', 'data-modal-close':'' }, '取消');
    const delBtn = !isNew ? h('button', { class: 'btn btn-danger' }, '删除') : null;
    const close = openModal({ title: '招聘会 · ' + (isNew ? '新建日程' : '编辑'), body, footer: [delBtn, cancelBtn, saveBtn] });
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (await confirmDialog('确认删除？')) {
        Storage.deleteRecord('job-fair', data.id); close.close();
        toast('已删除', 'ok'); if (onChange) onChange();
      }
    });
    saveBtn.addEventListener('click', () => {
      data.date = dateInp.value;
      data.time = timeInp.value;
      data.location = locInp.value.trim();
      data.company = compInp.value.trim();
      data.notes = notesInp.value;
      if (!data.company) { toast('请输入招聘会名称', 'err'); return; }
      if (isNew) Storage.addRecord('job-fair', data);
      else Storage.updateRecord('job-fair', data.id, data);
      close.close(); toast('已保存', 'ok'); if (onChange) onChange();
    });
  }

  global.EmploymentModule = { render, TITLES, PROVINCES };
})(window);