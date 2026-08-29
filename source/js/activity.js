/* 首页活跃度热力图（文章日期版）：自然年视图，可切换年份 */
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

  var ALL_DAYS = ['一', '二', '三', '四', '五', '六', '日'];
  var DAY_LABELS = ['一', '三', '五']; // 行标签只显示 周一/周三/周五

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function level(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    return 3;
  }

  function cell(day, count) {
    var el = document.createElement('div');
    el.className = 'heatmap-cell';
    el.style.backgroundColor = COLORS[level(count)];
    el.title = day ? day + '：' + count + ' 篇' : '';
    return el;
  }

  /* ========== 渲染某一年 ========== */
  function renderYear(container, data, year) {
    var gridBox = container.querySelector('.heatmap-grid');
    gridBox.innerHTML = '';

    var start = new Date(year, 0, 1);
    var end = new Date(year, 11, 31);
    var startIdx = (start.getDay() + 6) % 7; // 周一起始
    var cursor = new Date(start);
    cursor.setDate(cursor.getDate() - startIdx); // 对齐到周一

    while (cursor <= end) {
      for (var d = 0; d < 7; d++) {
        var inYear = cursor.getFullYear() === year;
        var key = year + '-' + pad(cursor.getMonth() + 1) + '-' + pad(cursor.getDate());
        gridBox.appendChild(cell(inYear ? key : null, inYear ? (data[key] || 0) : 0));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  function build(container, data) {
    // 年份列表（升序）
    var years = [];
    for (var k in data) {
      var y = parseInt(k.slice(0, 4), 10);
      if (years.indexOf(y) === -1) years.push(y);
    }
    years.sort();
    if (!years.length) years.push(new Date().getFullYear());
    var cur = years[years.length - 1];

    container.innerHTML = '';

    // 头部：年份 + 切换按钮
    var head = document.createElement('div');
    head.className = 'heatmap-head';
    var btnPrev = document.createElement('button');
    btnPrev.className = 'heatmap-year-btn';
    btnPrev.innerHTML = '&#10094;';
    var label = document.createElement('span');
    label.className = 'heatmap-year-label';
    var btnNext = document.createElement('button');
    btnNext.className = 'heatmap-year-btn';
    btnNext.innerHTML = '&#10095;';

    // 主体：行标签列 + 网格
    var body = document.createElement('div');
    body.className = 'heatmap-body';

    var days = document.createElement('div');
    days.className = 'heatmap-days';
    ALL_DAYS.forEach(function (l) {
      var s = document.createElement('span');
      s.textContent = DAY_LABELS.indexOf(l) !== -1 ? l : '';
      days.appendChild(s);
    });
    body.appendChild(days);

    var grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    body.appendChild(grid);

    function render() {
      label.textContent = cur + ' 年';
      btnPrev.disabled = cur <= years[0];
      btnNext.disabled = cur >= years[years.length - 1];
      renderYear(container, data, cur);
    }

    btnPrev.addEventListener('click', function () { if (cur > years[0]) { cur--; render(); } });
    btnNext.addEventListener('click', function () { if (cur < years[years.length - 1]) { cur++; render(); } });

    head.appendChild(btnPrev);
    head.appendChild(label);
    head.appendChild(btnNext);
    container.appendChild(head);
    container.appendChild(body);
    render();

    DSLog.info('Activity', '热力图渲染完成，年份: ' + cur);
  }

  function init() {
    var recentPosts = document.getElementById('recent-posts');
    if (!recentPosts) return; // 仅首页

    // 在 #recent-posts 内部最前面插入热力图容器（原轮播位置，保持在同一列内）
    var container = document.getElementById('home-heatmap');
    if (!container) {
      container = document.createElement('div');
      container.id = 'home-heatmap';
      recentPosts.insertBefore(container, recentPosts.firstChild);
    }

    DSLog.info('Activity', '开始加载活跃度数据', DATA_URL);
    fetch(DATA_URL)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        DSLog.info('Activity', '数据加载成功', data);
        build(container, data);
      })
      .catch(function () {
        DSLog.warn('Activity', '数据加载失败');
        container.innerHTML = '<div class="heatmap-fallback">活跃度数据加载失败</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // PJAX 回首页时重新渲染
  document.addEventListener('pjax:complete', init);
})();
