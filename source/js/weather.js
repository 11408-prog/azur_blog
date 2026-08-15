/* 天气面板 - 固定显示郑州天气 */
(function () {
  'use strict';

  var CITY = 'Zhengzhou';

  // Font Awesome 6 免费版天气图标（实心字形，线条风由 CSS 描边实现）
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

  function render(data) {
    var cur = data.current_condition[0];
    var temp = cur.temp_C;
    var desc = translateDesc(cur.weatherDesc[0].value);
    var icon = iconFor(cur.weatherCode);

    var panel = document.getElementById('weather-panel');
    if (!panel) return;

    panel.innerHTML = '' +
      '<div class="weather-main">' +
        '<i class="weather-icon fa-solid ' + icon + '"></i>' +
        '<div class="weather-temp">' + temp + '°C</div>' +
        '<div class="weather-desc">' + desc + '</div>' +
      '</div>' +
      '<div class="weather-place">' + CITY + '</div>';
  }

  function fetchWeather(city) {
    fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1')
      .then(function (r) {
        if (!r.ok) throw new Error('network');
        return r.json();
      })
      .then(function (data) {
        render(data);
      })
      .catch(function () {
        var panel = document.getElementById('weather-panel');
        if (panel) panel.innerHTML = '<div style="text-align:center;color:#999;padding:10px;">天气加载失败</div>';
      });
  }

  fetchWeather(CITY);
})();