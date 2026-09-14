/* 天气面板 - 固定显示郑州天气，含日期/时间/湿度
 * ------------------------------------------------------------
 * 架构（见《需要解决的问题.md》P1-5）：数据层与 UI 层分离
 *   数据层：内存缓存 + 30 分钟有效期，统一负责 fetch
 *   UI 层：只消费缓存渲染，不发请求
 * PJAX 时：侧栏面板（在 #body-wrap 内）会被替换成新节点，
 *   因此只需「用缓存重绘 UI」，不重跑数据获取流程。
 * 本脚本经 inject.bottom 挂载，位于 #body-wrap 之外，
 *   整页加载只执行一次，闭包内的缓存可跨 PJAX 存活。
 */
(function () {
  'use strict';

  var CITY = 'Zhengzhou';
  var API_URL = 'https://wttr.in/' + encodeURIComponent(CITY) + '?format=j1';
  var CACHE_TTL = 30 * 60 * 1000;   // 数据有效期：30 分钟
  var CLOCK_INTERVAL = 1000;        // 时钟刷新间隔

  // ---------- 数据层（唯一持有缓存，UI 不直接 fetch） ----------
  var _cache = null;        // 最近一次成功的天气数据
  var _cachedAt = 0;        // 缓存时间戳（ms）
  var _fetching = false;    // 并发保护：避免同一时刻重复请求

  function isCacheFresh() {
    return _cache !== null && (Date.now() - _cachedAt) < CACHE_TTL;
  }

  // 拉取天气数据；成功后更新缓存并触发一次渲染
  function refreshData() {
    if (_fetching) {
      DSLog.debug('Weather', '已有请求在途，跳过');
      return Promise.resolve(_cache);
    }
    _fetching = true;
    DSLog.info('Weather', '请求天气', CITY);
    return fetch(API_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('network ' + r.status);
        return r.json();
      })
      .then(function (data) {
        _cache = data;
        _cachedAt = Date.now();
        DSLog.info('Weather', '天气数据已缓存', CITY);
        renderWeather(data);
        updateClock();
        return data;
      })
      .catch(function (e) {
        DSLog.warn('Weather', '天气加载失败', { city: CITY, message: e && e.message });
        // 有旧缓存则保留显示，不覆盖成失败态
        if (!_cache) renderFailure();
        return null;
      })
      .then(function (v) { _fetching = false; return v; });
  }

  // 确保有数据：缓存新鲜则直接用，否则才发请求
  function ensureData() {
    if (isCacheFresh()) {
      DSLog.debug('Weather', '缓存命中，跳过请求', { age: Date.now() - _cachedAt });
      return Promise.resolve(_cache);
    }
    return refreshData();
  }

  // ---------- UI 层（只渲染，不发请求） ----------

  // Font Awesome 图标映射
  function iconFor(code) {
    var map = {
      113: 'fa-sun', 116: 'fa-cloud-sun', 119: 'fa-cloud', 122: 'fa-cloud',
      143: 'fa-smog', 176: 'fa-cloud-rain', 179: 'fa-snowflake', 182: 'fa-snowflake',
      185: 'fa-cloud-rain', 200: 'fa-cloud-bolt', 227: 'fa-snowflake', 230: 'fa-snowflake',
      248: 'fa-smog', 260: 'fa-smog', 263: 'fa-cloud-rain', 266: 'fa-cloud-rain',
      281: 'fa-cloud-rain', 284: 'fa-cloud-rain', 293: 'fa-cloud-rain',
      296: 'fa-cloud-rain', 299: 'fa-cloud-showers-heavy', 302: 'fa-cloud-showers-heavy',
      305: 'fa-cloud-showers-heavy', 308: 'fa-cloud-showers-heavy', 311: 'fa-cloud-rain'
    };
    return map[code] || 'fa-cloud';
  }

  function translateDesc(raw) {
    var map = {
      'Clear': '晴', 'Sunny': '晴', 'Partly cloudy': '多云',
      'Cloudy': '阴', 'Overcast': '阴天', 'Mist': '薄雾', 'Fog': '雾',
      'Freezing fog': '冻雾', 'Light rain': '小雨', 'Moderate rain': '中雨',
      'Heavy rain': '大雨', 'Light snow': '小雪', 'Moderate snow': '中雪',
      'Heavy snow': '大雪', 'Thunderstorm': '雷阵雨',
      'Patchy rain possible': '局部小雨', 'Patchy snow possible': '局部小雪'
    };
    return map[raw] || raw;
  }

  function renderWeather(data) {
    if (!data || !data.current_condition || !data.current_condition[0]) return;
    var panel = document.getElementById('weather-panel');
    if (!panel) return;

    var cur = data.current_condition[0];
    var temp = cur.temp_C;
    var desc = translateDesc(cur.weatherDesc[0].value);
    var icon = iconFor(cur.weatherCode);
    var humidity = cur.humidity;   // 湿度（字符串，如 "65"）

    // 先清空再写入，防止 PJAX 后节点重复叠加
    panel.innerHTML = '';
    panel.innerHTML =
      '<div class="weather-datetime">' +
        '<span class="weather-date"></span>' +
        '<span class="weather-time" id="weather-time"></span>' +
      '</div>' +
      '<div class="weather-main">' +
        '<i class="weather-icon fa-solid ' + icon + '"></i>' +
        '<div class="weather-temp">' + temp + '</div>' +
        '<div class="weather-desc">' + desc + '</div>' +
      '</div>' +
      '<div class="weather-details">' +
        '<span class="weather-humidity">湿度 ' + humidity + '%</span>' +
        '<span class="weather-place">' + CITY + '</span>' +
      '</div>';
  }

  function renderFailure() {
    var panel = document.getElementById('weather-panel');
    if (panel) {
      panel.innerHTML = '<div style="text-align:center;color:#999;padding:10px;">天气加载失败</div>';
    }
  }

  // 时钟更新（日期 + 时间）；DOM 用动态查询，兼容 PJAX 后的新节点
  function updateClock() {
    var dateEl = document.querySelector('#weather-panel .weather-date');
    var timeEl = document.getElementById('weather-time');
    if (!dateEl || !timeEl) return;

    var now = new Date();
    var year = now.getFullYear();
    var month = String(now.getMonth() + 1).padStart(2, '0');
    var day = String(now.getDate()).padStart(2, '0');
    var weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    var weekday = weekdays[now.getDay()];

    dateEl.textContent = year + '年' + month + '月' + day + '日 ' + weekday;

    var hours = String(now.getHours()).padStart(2, '0');
    var mins = String(now.getMinutes()).padStart(2, '0');
    timeEl.textContent = hours + ':' + mins;
  }

  // 用现有缓存重绘 UI（PJAX 后走这条路径，不发请求）
  function redrawFromCache() {
    if (_cache) {
      renderWeather(_cache);
      updateClock();
      DSLog.debug('Weather', '已用缓存重绘面板');
    }
  }

  // ---------- 生命周期挂载 ----------
  // 数据与定时器是全局的（不随页面切换销毁），面板 DOM 才是页面级的。
  // 因此注册为 persistent：PJAX 后只 refresh（重绘面板 + 视情况后台更新数据）。
  function register() {
    if (!window.BlogLifecycle) {
      // 兜底：生命周期管理器缺失时退回原有行为，保证功能不丢
      DSLog.warn('Weather', 'BlogLifecycle 不可用，退回独立初始化');
      ensureData();
      setInterval(updateClock, CLOCK_INTERVAL);
      setInterval(function () { ensureData(); }, CACHE_TTL);
      document.addEventListener('pjax:complete', function () {
        redrawFromCache();
        ensureData();
      });
      return;
    }

    window.BlogLifecycle.register('weather', {
      persistent: true,

      mount: function (ctx) {
        // 首次挂载：拉数据 + 启动定时器（由 ctx 登记，销毁时自动回收）
        ensureData();
        ctx.interval(updateClock, CLOCK_INTERVAL);
        // 到期后主动更新数据；ensureData 内部会判断缓存是否仍新鲜
        ctx.interval(function () { ensureData(); }, CACHE_TTL);
        DSLog.info('Weather', '已挂载');
      },

      // PJAX 后面板是新节点：先用缓存立即重绘，再按 TTL 决定是否后台更新
      refresh: function () {
        redrawFromCache();
        ensureData();
        DSLog.info('Weather', 'PJAX 完成，面板已按缓存重绘');
      }
    });
  }

  register();
})();
