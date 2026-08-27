/* 统一日志工具 DSLog
 * ------------------------------------------------------------
 * 分级：debug/info（默认隐藏，开调试后显示）| warn/error（始终显示）
 * 开启调试模式：
 *   - 控制台执行：DSLog.enableDebug()
 *   - 或地址栏加 ?debug
 *   - 或 localStorage 存 blog_debug=1
 * 关闭：DSLog.disableDebug()
 * 用法：DSLog.info('模块名', '消息', 可选数据)
 */
(function () {
  'use strict';

  var KEY = 'blog_debug';
  var debugMode = false;
  try {
    debugMode =
      localStorage.getItem(KEY) === '1' ||
      /[?&]debug(?:=1)?/.test(window.location.search);
  } catch (e) { /* 隐私模式等场景忽略 */ }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function ts() {
    var d = new Date();
    return (
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0')
    );
  }

  function out(level, module, msg, color, extra) {
    var args = [
      '%c[' + ts() + '][' + level.toUpperCase() + '][' + module + '] ' + msg + '%c',
      'color:' + color + ';font-weight:bold',
      'color:inherit'
    ];
    if (extra !== undefined) args.push(extra);
    var fn = console[level] || console.log;
    if (typeof fn === 'function') fn.apply(console, args);
  }

  window.DSLog = {
    debug: function (m, msg, extra) { if (debugMode) out('debug', m, msg, '#9ca3af', extra); },
    info: function (m, msg, extra) { if (debugMode) out('info', m, msg, '#60a5fa', extra); },
    warn: function (m, msg, extra) { out('warn', m, msg, '#fbbf24', extra); },
    error: function (m, msg, extra) { out('error', m, msg, '#f87171', extra); },
    isDebug: function () { return debugMode; },
    enableDebug: function () {
      debugMode = true;
      try { localStorage.setItem(KEY, '1'); } catch (e) {}
      out('info', 'DSLog', '调试模式已开启');
    },
    disableDebug: function () {
      debugMode = false;
      try { localStorage.removeItem(KEY); } catch (e) {}
      out('info', 'DSLog', '调试模式已关闭');
    }
  };

  // ---------- 全局错误捕获（常显） ----------
  window.addEventListener('error', function (e) {
    out('error', 'global', '未捕获错误: ' + (e.message || 'unknown') +
      ' @ ' + (e.filename || '') + ':' + (e.lineno || 0));
  });

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    out('error', 'global', '未处理的 Promise 拒绝: ' +
      (r && r.message ? r.message : r));
  });

  out('info', 'DSLog', '日志系统就绪' + (debugMode ? '（调试模式）' : '（默认隐藏 debug/info，DSLog.enableDebug() 开启）'));
})();
