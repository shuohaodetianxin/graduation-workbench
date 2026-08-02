/* ============================================
   calendar.js - 通用月历组件
   支持：年月切换 / 左右滑动切月 / 多色圆环 / 单选日期
   ============================================ */
(function (global) {
  'use strict';
  const { h, clear, fmtDate, today } = UI;

  // 模块 → 圆环颜色
  const MODULE_COLOR = {
    exp: '#7ECDB8', patent: '#F5C24D', job: '#B79CE0', paper: '#F5A0B0',
  };
  const MODULE_TO_RING = {
    exp: 'r-exp', patent: 'r-patent', job: 'r-job', paper: 'r-paper',
  };

  // 构造月历
  // options: {
  //   onPick(dateStr),              // 点击某天
  //   mode: 'single' | 'multi',     // 默认 single
  //   selected: Set<string>,        // 已选
  //   dateIndexByModule: object,    // { 'YYYY-MM-DD': {exp:1, patent:1...} }
  //   highlightToday: bool,
  //   initialDate: Date,
  //   showMonthLabel: bool
  // }
  function createCalendar(options = {}) {
    const state = {
      year: (options.initialDate || new Date()).getFullYear(),
      month: (options.initialDate || new Date()).getMonth(),
      selected: options.selected || new Set(),
      onPick: options.onPick || (() => {}),
      dateIndexByModule: options.dateIndexByModule || {},
      routeColor: options.routeColor || null,  // 单子模块模式：纯色环
      highlightToday: options.highlightToday !== false,
      pickerMode: options.pickerMode !== false, // 提供月份选择器
    };

    const root = h('div', { class: 'calendar' });
    const head = h('div', { class: 'cal-head' });
    const title = h('div', { class: 'cal-title' });
    const grid = h('div', { class: 'cal-grid' });
    const navL = h('button', { class: 'icon-btn', 'aria-label': '上个月' }, '‹');
    const navR = h('button', { class: 'icon-btn', 'aria-label': '下个月' }, '›');
    const yearSel = h('select', { class: 'select', style: 'width:auto;padding:6px 10px;font-size:13px' });
    const monthSel = h('select', { class: 'select', style: 'width:auto;padding:6px 10px;font-size:13px' });

    // 年份范围：当前年 ±5
    const thisYear = new Date().getFullYear();
    for (let y = thisYear - 5; y <= thisYear + 5; y++) {
      const opt = h('option', { value: String(y) }, String(y) + '年');
      if (y === state.year) opt.selected = true;
      yearSel.appendChild(opt);
    }
    for (let m = 0; m < 12; m++) {
      const opt = h('option', { value: String(m) }, (m + 1) + '月');
      if (m === state.month) opt.selected = true;
      monthSel.appendChild(opt);
    }
    yearSel.addEventListener('change', () => { state.year = +yearSel.value; render(); });
    monthSel.addEventListener('change', () => { state.month = +monthSel.value; render(); });

    const navLWrap = h('div', { class: 'cal-nav' }, [navL, yearSel, monthSel, navR]);
    head.appendChild(navLWrap);
    head.appendChild(title);
    root.appendChild(head);
    root.appendChild(grid);

    // 触摸滑动切月
    let touchStartX = 0;
    grid.addEventListener('touchstart', (e) => { touchStartX = e.touches[0].clientX; }, { passive: true });
    grid.addEventListener('touchend', (e) => {
      const dx = (e.changedTouches[0].clientX - touchStartX);
      if (Math.abs(dx) > 50) {
        if (dx < 0) nextMonth(); else prevMonth();
      }
    });
    navL.addEventListener('click', prevMonth);
    navR.addEventListener('click', nextMonth);

    function prevMonth() {
      state.month--;
      if (state.month < 0) { state.month = 11; state.year--; }
      yearSel.value = String(state.year);
      monthSel.value = String(state.month);
      render();
    }
    function nextMonth() {
      state.month++;
      if (state.month > 11) { state.month = 0; state.year++; }
      yearSel.value = String(state.year);
      monthSel.value = String(state.month);
      render();
    }

    function render() {
      clear(grid);
      const DOW = ['日','一','二','三','四','五','六'];
      DOW.forEach(d => grid.appendChild(h('div', { class: 'cal-dow' }, d)));

      const first = new Date(state.year, state.month, 1);
      const startWeekday = first.getDay();
      const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();
      const prevDays = new Date(state.year, state.month, 0).getDate();
      const todayStr = today();
      title.textContent = `${state.year} 年 ${state.month + 1} 月`;

      // 上月补位
      for (let i = startWeekday - 1; i >= 0; i--) {
        const d = prevDays - i;
        const date = new Date(state.year, state.month - 1, d);
        grid.appendChild(buildDayCell(date, true, todayStr));
      }
      // 本月
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(state.year, state.month, d);
        grid.appendChild(buildDayCell(date, false, todayStr));
      }
      // 下月补位（凑满 6 行 = 42 格）
      const totalCells = startWeekday + daysInMonth;
      const next = (Math.ceil(totalCells / 7) * 7) - totalCells;
      for (let d = 1; d <= next; d++) {
        const date = new Date(state.year, state.month + 1, d);
        grid.appendChild(buildDayCell(date, true, todayStr));
      }
    }

    function buildDayCell(date, dim, todayStr) {
      const ds = fmtDate(date);
      const num = h('span', { class: 'day-num' }, String(date.getDate()));
      const cell = h('div', { class: 'cal-day' + (dim ? ' dim' : '') }, [num]);
      cell.dataset.date = ds;

      // 圆环：conic-gradient 切成扇形作为底层，中间用白圆覆盖只留边缘环
      const idx = state.dateIndexByModule[ds];
      if (idx) {
        const ring = h('div', { class: 'day-ring' });
        const inner = h('div', { class: 'day-ring-inner' });
        if (state.routeColor) {
          // 单子模块模式：纯色环
          ring.style.background = state.routeColor;
        } else {
          // 多模块模式：conic-gradient 多色环
          const mods = Object.keys(idx);
          const seg = 360 / mods.length;
          const colors = mods.map(m => MODULE_COLOR[m] || '#A8B5A0');
          const stops = colors.map((c, i) => `${c} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ');
          ring.style.background = `conic-gradient(${stops})`;
        }
        cell.appendChild(ring);
        cell.appendChild(inner);
      }

      if (state.highlightToday && ds === todayStr) cell.classList.add('today');
      if (state.selected.has(ds)) cell.classList.add('selected');

      cell.addEventListener('click', () => {
        if (dim) {
          // 切到对应月
          if (date.getMonth() === (state.month + 1) % 12 && date.getFullYear() > state.year) nextMonth();
          else if (date.getMonth() === (state.month - 1 + 12) % 12 && date.getFullYear() < state.year) prevMonth();
        }
        state.selected.clear();
        state.selected.add(ds);
        state.onPick(ds);
        render();
      });
      return cell;
    }

    render();

    return {
      el: root,
      refresh(newIdx) {
        if (newIdx) state.dateIndexByModule = newIdx;
        render();
      },
      goToday() {
        const t = new Date();
        state.year = t.getFullYear(); state.month = t.getMonth();
        yearSel.value = String(state.year);
        monthSel.value = String(state.month);
        render();
      },
      setMonth(y, m) {
        state.year = y; state.month = m;
        yearSel.value = String(y); monthSel.value = String(m);
        render();
      },
      getSelected() {
        return Array.from(state.selected)[0];
      }
    };
  }

  global.Calendar = { create: createCalendar };
})(window);
