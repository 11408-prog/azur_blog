/* 活跃度热力图：侧栏月视图 + 独立页年视图（可切换年份） */
(function () {
  'use strict';

  var DATA_URL = '/azur_blog/data/activity.json';

  // 密度 4 档：无 / 1 篇 / 2 篇 / 3 篇+（海军蓝深浅）
  var COLORS = [
    'rgba(30, 58, 95, 0.06)',
    'rgba(30, 58, 95, 0.32)',
    'rgba(30, 58, 95, 0.58)',
    'rgba(30, 58, 95, 0.95)'
  ];

  var WEEKDAY = ['一', '二', '三', '四', '五', '六', '日'];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function level(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    return 3;
  }

  function cell(day, count) {
    var el = document.createElement('div');
    el.className = 'act-cell';
    el.style.backgroundColor = COLORS[level(count)];
    el.title = day ? day + '：' + count + ' 篇' : '';
    return el;
  }

  /* ========== 侧栏：当月日历 ========== */
  function monthView(box, data) {
    var now = new Date();
    var y = now.getFullYear();
    var m = now.getMonth();
    var daysInMonth = new Date(y, m + 1, 0).getDate();
    var firstIdx = (new Date(y, m, 1).getDay() + 6) % 7; // 周一起始

    var grid = document.createElement('div');
    grid.className = 'act-month-grid';
    WEEKDAY.forEach(function (l) {
      var s = document.createElement('span');
      s.className = 'act-weekday';
      s.textContent = l;
      grid.appendChild(s);
    });
    for (var i = 0; i < firstIdx; i++) grid.appendChild(cell(null, 0));
    var monthKey = y + '-' + pad(m + 1);
    var monthCount = 0;
    for (var d = 1; d <= daysInMonth; d++) {
      var key = monthKey + '-' + pad(d);
      var c = data[key] || 0;
      monthCount += c;
      grid.appendChild(cell(key, c));
    }
    box.appendChild(grid);

    var info = document.createElement('div');
    info.className = 'act-info';
    info.textContent = monthKey.replace('-', '年') + '月 · 共 ' + monthCount + ' 篇';
    box.appendChild(info);
  }

  /* ========== 独立页：整年视图 ========== */
  function yearGrid(container, data, year) {
    container.innerHTML = '';
    var start = new Date(year, 0, 1);
    var end = new Date(year, 11, 31);
    var startIdx = (start.getDay() + 6) % 7;
    var cursor = new Date(start);
    cursor.setDate(cursor.getDate() - startIdx); // 对齐到周一

    while (cursor <= end) {
      for (var i = 0; i < 7; i++) {
        var inYear = cursor.getFullYear() === year;
        var key = year + '-' + pad(cursor.getMonth() + 1) + '-' + pad(cursor.getDate());
        container.appendChild(cell(inYear ? key : null, inYear ? (data[key] || 0) : 0));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  function init() {
    fetch(DATA_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var monthBox = document.getElementById('activity-month');
        if (monthBox) monthView(monthBox, data);

        var yearHead = document.getElementById('activity-year-head');
        var yearGridBox = document.getElementById('activity-year-grid');
        if (yearHead && yearGridBox) {
          // 数据里出现的年份（升序）
          var years = [];
          for (var k in data) {
            var y = parseInt(k.slice(0, 4), 10);
            if (years.indexOf(y) === -1) years.push(y);
          }
          years.sort();
          if (!years.length) years.push(new Date().getFullYear());
          var cur = years[years.length - 1];

          var btnPrev = document.createElement('button');
          btnPrev.className = 'act-year-btn';
          btnPrev.innerHTML = '&#10094;';
          var label = document.createElement('span');
          label.className = 'act-year-label';
          var btnNext = document.createElement('button');
          btnNext.className = 'act-year-btn';
          btnNext.innerHTML = '&#10095;';

          function render() {
            label.textContent = cur + ' 年';
            btnPrev.disabled = cur <= years[0];
            btnNext.disabled = cur >= years[years.length - 1];
            yearGrid(yearGridBox, data, cur);
          }

          btnPrev.addEventListener('click', function () { if (cur > years[0]) { cur--; render(); } });
          btnNext.addEventListener('click', function () { if (cur < years[years.length - 1]) { cur++; render(); } });
          yearHead.appendChild(btnPrev);
          yearHead.appendChild(label);
          yearHead.appendChild(btnNext);
          render();
        }
      })
      .catch(function () { /* 数据缺失时不渲染，静默 */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
