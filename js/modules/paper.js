/* ============================================
   paper.js - 论文进度模块
   顶部月历 + 选中日期录入 + 纵向时间线
   ============================================ */
(function (global) {
  'use strict';
  const { $, $$, h, clear, fmtDate, today, toast, openModal, confirmDialog, renderTagPicker, createAffirmationCard } = UI;

  function render(root, route, query) {
    if (route !== 'paper-progress') return false;
    ExperimentModule.setCurrentRoute(route);
    clear(root);

    const head = h('div', { class: 'card' }, [
      h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-paper)' }),
        '论文进度'
      ]),
      h('div', { class: 'search' }, [
        h('span', null, '🔍'),
        h('input', { id: 'paperSearch', placeholder: '搜索本模块记录' }),
      ])
    ]);
    root.appendChild(head);

    const calAffirmRow = h('div', { class: 'cal-affirm-row' });
    calAffirmRow.appendChild(createAffirmationCard());
    const calWrap = h('div', { class: 'card', style: 'padding:10px 12px' });
    calAffirmRow.appendChild(calWrap);
    root.appendChild(calAffirmRow);
    let selectedDate = today();
    const cal = Calendar.create({
      onPick: (d) => { selectedDate = d; refreshInput(); },
      dateIndexByModule: Storage.getDateIndexByRoute('paper-progress'),
      routeColor: 'var(--c-paper)',
      selected: new Set([selectedDate]),
    });
    calWrap.appendChild(cal.el);

    const inputCard = h('div', { class: 'card' });
    root.appendChild(inputCard);
    function refreshInput() {
      clear(inputCard);
      inputCard.appendChild(h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-paper)' }),
        selectedDate + ' · 论文进度'
      ]));
      const existed = Storage.getRecords('paper-progress').find(r => r.date === selectedDate);
      const tagIds = existed && existed.tags ? existed.tags.map(t => t.id) : [];
      const tagPickerEl = renderTagPicker('paper', tagIds, () => {});
      const ta = h('textarea', { class: 'textarea', placeholder: '输入当日论文进度，例如：完成第三章实验部分初稿、补充文献 12 篇…' }, existed ? existed.content : '');
      const saveBtn = h('button', { class: 'btn' }, existed ? '保存修改' : '保存');
      const delBtn = existed ? h('button', { class: 'btn btn-danger' }, '删除') : null;
      inputCard.appendChild(ta);
      inputCard.appendChild(h('div', { class: 'field', style: 'margin-top:10px' }, [h('label', null, '标签'), tagPickerEl]));
      const actions = h('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [delBtn, saveBtn].filter(Boolean));
      inputCard.appendChild(actions);
      saveBtn.addEventListener('click', () => {
        if (!ta.value.trim()) { toast('请输入内容', 'err'); return; }
        const tags = tagIds.slice().map(id => Storage.getTags('paper').find(t => t.id === id)).filter(Boolean);
        if (existed) Storage.updateRecord('paper-progress', existed.id, { content: ta.value, tags });
        else Storage.addRecord('paper-progress', { date: selectedDate, content: ta.value, tags });
        toast('已保存', 'ok');
        cal.refresh(Storage.getDateIndexByRoute('paper-progress'));
        refreshTimeline();
      });
      if (delBtn) delBtn.addEventListener('click', async () => {
        if (await confirmDialog('确认删除？')) {
          Storage.deleteRecord('paper-progress', existed.id);
          toast('已删除', 'ok');
          cal.refresh(Storage.getDateIndexByRoute('paper-progress'));
          refreshInput();
          refreshTimeline();
        }
      });
    }
    refreshInput();

    const tlCard = h('div', { class: 'card' });
    root.appendChild(tlCard);
    function refreshTimeline() {
      clear(tlCard);
      const kw = ($('#paperSearch').value || '').trim().toLowerCase();
      const records = Storage.getRecords('paper-progress')
        .filter(r => !kw || JSON.stringify(r).toLowerCase().includes(kw))
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      tlCard.appendChild(h('div', { class: 'card-title' }, [
        h('span', { class: 'dot', style: 'background:var(--c-paper)' }),
        kw ? '🔍 搜索 "' + kw + '"（' + records.length + ' 条）' : '时间线'
      ]));
      if (!records.length) {
        tlCard.appendChild(h('div', { class: 'empty' }, [
          h('div', { class: 'e-emoji' }, '🌸'),
          h('div', null, kw ? '没有匹配的记录' : '点击日历日期开始记录'),
        ]));
        return;
      }
      const tl = h('div', { class: 'timeline' });
      records.forEach(r => {
        const item = h('div', { class: 'tl-item', 'data-color': 'paper' }, [
          h('div', { class: 'tl-date' }, UI.fmtDateCN(r.date)),
          h('div', { class: 'tl-body' }, [
            h('div', null, r.content),
            (r.tags && r.tags.length) ? h('div', { style: 'margin-top:6px' }, r.tags.map(t => h('span', { class: 'tag-pill', style: 'background:' + t.color }, t.name))) : null,
          ].filter(Boolean)),
          h('div', { class: 'tl-actions' }, [
            (() => {
              const b = h('button', { class: 'btn btn-ghost btn-sm' }, '编辑');
              b.addEventListener('click', () => {
                selectedDate = r.date;
                cal.setMonth(new Date(r.date).getFullYear(), new Date(r.date).getMonth());
                refreshInput();
              });
              return b;
            })()
          ])
        ]);
        tl.appendChild(item);
      });
      tlCard.appendChild(tl);
    }
    refreshTimeline();

    // 搜索框 input 事件
    $('#paperSearch').addEventListener('input', refreshTimeline);
  }

  global.PaperModule = { render };
})(window);
