/* 天气面板 - 手动输入城市，不获取位置权限 */
(function () {
  'use strict';

  var STORAGE_KEY = 'azur_weather_city';
  var DEFAULT_CITY = 'Beijing';

  function getSavedCity() {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_CITY; } catch (e) { return DEFAULT_CITY; }
  }

  function saveCity(name) {
    try { localStorage.setItem(STORAGE_KEY, name); } catch (e) {}
  }

  function iconFor(code) {
    var map = {
      113: '☀️', 116: '⛅', 119: '☁️', 122: '☁️', 143: '🌫️',
      176: '🌦️', 179: '🌨️', 182: '🌨️', 185: '🌨️', 200: '⛈️',
      227: '🌨️', 230: '❄️', 248: '🌫️', 260: '🌫️', 263: '🌦️',
      266: '🌧️', 281: '🌧️', 284: '🌧️', 293: '🌧️', 296: '🌧️',
      299: '🌧️', 302: '🌧️', 305: '🌧️', 308: '🌧️', 311: '🌧️'
    };
    return map[code] || '☁️';
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

  function render(data, cityName) {
    var cur = data.current_condition[0];
    var temp = cur.temp_C;
    var desc = translateDesc(cur.weatherDesc[0].value);
    var icon = iconFor(cur.weatherCode);

    var panel = document.getElementById('weather-panel');
    if (!panel) return;

    panel.innerHTML = '' +
      '<div class="weather-main">' +
        '<div class="weather-icon">' + icon + '</div>' +
        '<div class="weather-temp">' + temp + '°C</div>' +
        '<div class="weather-desc">' + desc + '</div>' +
      '</div>' +
      '<div class="weather-place">' + (cityName || '未知城市') + '</div>' +
      '<div class="weather-clock">' +
        '<span id="weather-time">--:--:--</span>' +
        '<span id="weather-date">----/--/--</span>' +
      '</div>' +
      '<div class="weather-city-input">' +
        '<input type="text" id="weather-city" placeholder="输入城市 (如 Beijing)" value="' + (cityName || '') + '">' +
      '</div>';

    var input = document.getElementById('weather-city');
    if (input) {
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var val = this.value.trim();
          if (val) {
            saveCity(val);
            fetchWeather(val);
          }
        }
      });
      input.addEventListener('blur', function () {
        var val = this.value.trim();
        if (val && val !== cityName) {
          saveCity(val);
          fetchWeather(val);
        }
      });
    }

    function tick() {
      var now = new Date();
      var h = String(now.getHours()).padStart(2, '0');
      var m = String(now.getMinutes()).padStart(2, '0');
      var s = String(now.getSeconds()).padStart(2, '0');
      var y = now.getFullYear();
      var mo = String(now.getMonth() + 1).padStart(2, '0');
      var d = String(now.getDate()).padStart(2, '0');
      var timeEl = document.getElementById('weather-time');
      var dateEl = document.getElementById('weather-date');
      if (timeEl) timeEl.textContent = h + ':' + m + ':' + s;
      if (dateEl) dateEl.textContent = y + '年' + mo + '月' + d + '日';
    }
    tick();
    if (window._weatherClock) clearInterval(window._weatherClock);
    window._weatherClock = setInterval(tick, 1000);
  }

  function fetchWeather(city) {
    fetch('https://wttr.in/' + encodeURIComponent(city) + '?format=j1')
      .then(function (r) {
        if (!r.ok) throw new Error('network');
        return r.json();
      })
      .then(function (data) {
        // wttr.in 对无效城市会返回默认位置，通过 nearest_area 判断
        var area = data.nearest_area[0];
        var returnedName = area.areaName[0].value;
        // 如果返回的城市和输入差异极大，可能是 fallback
        render(data, city);
      })
      .catch(function () {
        var panel = document.getElementById('weather-panel');
        if (panel) panel.innerHTML = '<div style="text-align:center;color:#999;padding:10px;">查询失败，请检查城市名</div>';
      });
  }

  var saved = getSavedCity();
  fetchWeather(saved);
})();