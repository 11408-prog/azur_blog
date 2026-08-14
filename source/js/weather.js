/* 天气面板：浏览器定位 + wttr.in（免 key）+ 实时时间/日期 */
(function () {
  'use strict';

  var API = 'https://wttr.in/';
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  function $(id) { return document.getElementById(id); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* wttr.in weatherCode → 简单图标 */
  function iconFor(code) {
    var map = {
      '113': '☀️', '116': '🌤', '119': '☁️', '122': '☁️', '143': '🌫',
      '176': '🌦', '179': '🌨', '182': '🌧', '185': '🌧',
      '200': '⛈', '227': '🌨', '230': '❄️',
      '248': '🌫', '260': '🌫',
      '263': '🌦', '266': '🌦', '281': '🌧', '284': '🌧',
      '293': '🌦', '296': '🌦', '299': '🌧', '302': '🌧',
      '305': '🌧', '308': '🌧', '311': '🌧', '314': '🌧', '317': '🌧',
      '320': '🌨', '323': '🌨', '326': '🌨', '329': '❄️',
      '332': '❄️', '335': '❄️', '338': '❄️', '350': '🌨',
      '353': '🌦', '356': '🌧', '359': '🌧', '362': '🌧', '365': '🌧',
      '368': '🌨', '371': '❄️', '374': '🌨', '377': '🌧',
      '386': '⛈', '389': '⛈', '392': '⛈', '395': '⛈'
    };
    return map[code] || '';
  }

  function render(data) {
    var cur = data.current_condition && data.current_condition[0];
    if (!cur) return;

    var desc = (cur.weatherDesc && cur.weatherDesc[0] && cur.weatherDesc[0].value) || '未知';
    var temp = cur.temp_C;

    // 地点名：市 · 区/省 · 国家（去重）
    var place = '';
    if (data.nearest_area && data.nearest_area[0]) {
      var area = data.nearest_area[0];
      var name = area.areaName && area.areaName[0] && area.areaName[0].value;
      var region = area.region && area.region[0] && area.region[0].value;
      var country = area.country && area.country[0] && area.country[0].value;
      var parts = [];
      if (name) parts.push(name);
      if (region && region !== name) parts.push(region);
      if (country && parts.indexOf(country) === -1) parts.push(country);
      place = parts.join(' · ');
    }

    if ($('weather-icon')) $('weather-icon').textContent = iconFor(cur.weatherCode);
    if ($('weather-temp')) $('weather-temp').textContent = (temp !== undefined) ? temp + '°' : '--°';
    if ($('weather-desc')) $('weather-desc').textContent = desc;
    if ($('weather-place')) $('weather-place').textContent = place;
  }

  function clock() {
    var el = $('weather-time');
    var dateEl = $('weather-date');
    if (!el && !dateEl) return;
    var now = new Date();
    if (el) el.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    if (dateEl) dateEl.textContent = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 星期' + WEEK[now.getDay()];
  }

  function fetchWeather(url) {
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(render)
      .catch(function () {
        if ($('weather-desc')) $('weather-desc').textContent = '天气获取失败';
      });
  }

  function locate() {
    function useCoords(pos) {
      var lat = pos.coords.latitude.toFixed(2);
      var lon = pos.coords.longitude.toFixed(2);
      fetchWeather(API + lat + ',' + lon + '?format=j1&lang=zh');
    }
    // 拒绝授权 / 失败 / 不支持：按 IP 自动定位
    function fallback() {
      fetchWeather(API + '?format=j1&lang=zh');
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(useCoords, fallback, {
        timeout: 5000,
        maximumAge: 600000
      });
    } else {
      fallback();
    }
  }

  function init() {
    // 页面没有天气卡片（比如无侧栏）时静默跳过，不报错
    if (!$('weather-temp')) return;
    clock();
    setInterval(clock, 1000);
    locate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
