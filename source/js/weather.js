/* 天气面板 - 固定显示郑州天气，含日期/时间/湿度 */
(function () {
  'use strict';

  var CITY = 'Zhengzhou';
  var API_URL = 'https://wttr.in/' + encodeURIComponent(CITY) + '?format=j1';

  // ---------- Font Awesome 图标映射（保持不变） ----------
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

  // ---------- DOM 渲染 ----------
  function renderWeather(data) {
    var cur = data.current_condition[0];
    var temp = cur.temp_C;
    var desc = translateDesc(cur.weatherDesc[0].value);
    var icon = iconFor(cur.weatherCode);
    var humidity = cur.humidity;   // 湿度（字符串，如 "65"）

    var panel = document.getElementById('weather-panel');
    if (!panel) return;

    // 构建 HTML：日期 + 时间 + 天气主信息 + 湿度
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

  // ---------- 时钟更新（日期 + 时间） ----------
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
    var secs = String(now.getSeconds()).padStart(2, '0');
    timeEl.textContent = hours + ':' + mins + ':' + secs;
  }

  // ---------- 获取天气数据 ----------
  function fetchWeather() {
    DSLog.info('Weather', '请求天气', CITY);
    fetch(API_URL)
      .then(function (r) {
        if (!r.ok) throw new Error('network');
        return r.json();
      })
      .then(function (data) {
        DSLog.info('Weather', '天气数据已加载', CITY);
        renderWeather(data);
        // 渲染完成后立即更新一次时钟
        updateClock();
      })
      .catch(function () {
        DSLog.warn('Weather', '天气加载失败', CITY);
        var panel = document.getElementById('weather-panel');
        if (panel) {
          panel.innerHTML = '<div style="text-align:center;color:#999;padding:10px;">天气加载失败</div>';
        }
      });
  }

  // ---------- 初始化（含定时器管理） ----------
  function initWeather() {
    // 清除旧定时器（防止 PJAX 叠加）
    if (window._weatherClockInterval) {
      clearInterval(window._weatherClockInterval);
      window._weatherClockInterval = null;
    }
    if (window._weatherFetchInterval) {
      clearInterval(window._weatherFetchInterval);
      window._weatherFetchInterval = null;
    }

    // 首次拉取天气
    fetchWeather();

    // 时钟每秒刷新
    window._weatherClockInterval = setInterval(updateClock, 1000);

    // 天气每 30 分钟刷新一次（避免频繁请求）
    window._weatherFetchInterval = setInterval(fetchWeather, 30 * 60 * 1000);
  }

  // ---------- 挂载 ----------
  // 首次加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWeather);
  } else {
    initWeather();
  }

  // PJAX 完成后重新初始化（博客无刷新切换）
  document.addEventListener('pjax:complete', function () {
    // 重新初始化会清理旧定时器并重新拉取
    initWeather();
    DSLog.info('Weather', 'PJAX 完成，天气已重置');
  });
})();