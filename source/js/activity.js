/* 首页活跃度热力图（Git提交版 · 四季横排 · 无跨季） */
(function () {
  'use strict';

  var DATA_URL = '/azur_blog/data/activity.json';
  var SEASONS = [
    { name: '春', startMonth: 0, endMonth: 2 },
    { name: '夏', startMonth: 3, endMonth: 5 },
    { name: '秋', startMonth: 6, endMonth: 8 },
    { name: '冬', startMonth: 9, endMonth: 11 }
  ];

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function level(count) {
    if (!count) return 0;
    if (count === 1) return 1;
    if (count === 2) return 2;
    if (count <= 4) return 3;
    return 4;
  }

  function cell(day, count) {
    var el = document.createElement('div');
    el.className = 'heatmap-cell level-' + level(count);
    el.title = day ? day + '：' + count + ' 次提交' : '';
    return el;
  }

  function normalizeDate(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function getStats(data) {
    var today = normalizeDate(new Date());
    var oneYearAgo = new Date(today);
    oneYearAgo.setDate(today.getDate() - 365);
    var oneMonthAgo = new Date(today);
    oneMonthAgo.setDate(today.getDate() - 30);
    var oneWeekAgo = new Date(today);
    oneWeekAgo.setDate(today.getDate() - 7);

    var yearCount = 0;
    var monthCount = 0;
    var weekCount = 0;

    for (var key in data) {
      if (!data.hasOwnProperty(key)) continue;
      var d = normalizeDate(new Date(key));
      var count = data[key];
      if (d >= oneYearAgo && d <= today) yearCount += count;
      if (d >= oneMonthAgo && d <= today) monthCount += count;
      if (d >= oneWeekAgo && d <= today) weekCount += count;
    }

    function fmt(date) {
      return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    return {
      yearCount: yearCount,
      monthCount: monthCount,
      weekCount: weekCount,
      yearRange: fmt(oneYearAgo) + ' - ' + fmt(today),
      monthRange: fmt(oneMonthAgo) + ' - ' + fmt(today),
      weekRange: fmt(oneWeekAgo) + ' - ' + fmt(today)
    };
  }

  /* 渲染单个季节块（只含当季日期，周一对齐） */
  function renderSeasonBlock(year, season, data) {
    var seasonStart = new Date(year, season.startMonth, 1);
    var seasonEnd = new Date(year, season.endMonth + 1, 0);
    var firstDayIdx = (seasonStart.getDay() + 6) % 7;
    var lastDayIdx = (seasonEnd.getDay() + 6) % 7;

    var grid = document.createElement('div');
    grid.className = 'season-grid';

    // 前导空位：让季度第一天出现在正确的星期行
    for (var i = 0; i < firstDayIdx; i++) {
      var empty = document.createElement('div');
      empty.className = 'heatmap-cell';
      empty.style.visibility = 'hidden';
      grid.appendChild(empty);
    }

    // 当季日期
    var cursor = new Date(seasonStart);
    while (cursor <= seasonEnd) {
      var key = cursor.getFullYear() + '-' + pad(cursor.getMonth() + 1) + '-' + pad(cursor.getDate());
      grid.appendChild(cell(key, data[key] || 0));
      cursor.setDate(cursor.getDate() + 1);
    }

    // 尾部空位：补齐到周日，保持最后一列完整
    for (var i = lastDayIdx; i < 6; i++) {
      var empty = document.createElement('div');
      empty.className = 'heatmap-cell';
      empty.style.visibility = 'hidden';
      grid.appendChild(empty);
    }

    var block = document.createElement('div');
    block.className = 'season-block';
    var label = document.createElement('div');
    label.className = 'season-label';
    label.textContent = season.name;
    block.appendChild(label);
    block.appendChild(grid);
    return block;
  }

  function render(container, data) {
    var year = new Date().getFullYear();
    container.innerHTML = '';

    // 四季横排
    var seasonsRow = document.createElement('div');
    seasonsRow.className = 'seasons-row';
    for (var i = 0; i < 4; i++) {
      seasonsRow.appendChild(renderSeasonBlock(year, SEASONS[i], data));
    }

    // 统计面板
    var stats = getStats(data);
    var statsBox = document.createElement('div');
    statsBox.className = 'heatmap-stats';
    statsBox.innerHTML =
      '<div class="stat-item">' +
        '<div class="stat-num">' + stats.yearCount + '</div>' +
        '<div class="stat-label">过去一年提交</div>' +
        '<div class="stat-range">' + stats.yearRange + '</div>' +
      '</div>' +
      '<div class="stat-item">' +
        '<div class="stat-num">' + stats.monthCount + '</div>' +
        '<div class="stat-label">过去一月提交</div>' +
        '<div class="stat-range">' + stats.monthRange + '</div>' +
      '</div>' +
      '<div class="stat-item">' +
        '<div class="stat-num">' + stats.weekCount + '</div>' +
        '<div class="stat-label">最近一周提交</div>' +
        '<div class="stat-range">' + stats.weekRange + '</div>' +
      '</div>';

    // 底部
    var footer = document.createElement('div');
    footer.className = 'heatmap-footer';

    var legend = document.createElement('div');
    legend.className = 'heatmap-legend';
    legend.innerHTML = '<span>Less</span>' +
      '<span class="heatmap-legend-box level-0"></span>' +
      '<span class="heatmap-legend-box level-1"></span>' +
      '<span class="heatmap-legend-box level-2"></span>' +
      '<span class="heatmap-legend-box level-3"></span>' +
      '<span class="heatmap-legend-box level-4"></span>' +
      '<span>More</span>';

    var source = document.createElement('div');
    source.className = 'heatmap-source';
    source.textContent = '数据来源：Git 提交记录';

    footer.appendChild(legend);
    footer.appendChild(source);

    container.appendChild(seasonsRow);
    container.appendChild(statsBox);
    container.appendChild(footer);

    DSLog.info('Activity', '热力图渲染完成，四季视图');
  }

  function init() {
    var recentPosts = document.getElementById('recent-posts');
    if (!recentPosts) return;

    var container = document.getElementById('home-heatmap');
    if (!container) {
      container = document.createElement('div');
      container.id = 'home-heatmap';
      recentPosts.insertBefore(container, recentPosts.firstChild);
    }

    DSLog.info('Activity', '开始加载活跃度数据', DATA_URL);
    fetch(DATA_URL)
      .then(function (r) { 
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json(); 
      })
      .then(function (data) {
        DSLog.info('Activity', '数据加载成功', data);
        render(container, data);
      })
      .catch(function (err) {
        DSLog.warn('Activity', '数据加载失败: ' + err.message);
        container.innerHTML = '<div class="heatmap-fallback">活跃度数据加载失败 (' + err.message + ')</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
})();