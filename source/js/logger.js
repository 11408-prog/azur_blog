/* 统一日志工具 DSLog
 * ------------------------------------------------------------
 * 分级：debug/info（默认隐藏，开调试后显示）| warn/error（始终显示）
 * 所有日志都会写入内存缓存（最近 500 条）和 localStorage（最近 200 条），支持一键导出
 * 开启调试模式：
 *   - 控制台执行：DSLog.enableDebug()
 *   - 或地址栏加 ?debug
 *   - 或 localStorage 存 blog_debug=1
 * 关闭：DSLog.disableDebug()
 * 用法：DSLog.info('模块名', '消息', 可选数据)
 * 导出：DSLog.export() → 下载 YYYY-MM-DD-前端.log
 */
(function () {
  'use strict';

  var KEY = 'blog_debug';
  var BUFFER_KEY = 'blog_log_buffer';
  var MAX_MEMORY = 500;
  var MAX_STORAGE = 200;
  var debugMode = false;
  var _buffer = [];

  try {
    debugMode =
      localStorage.getItem(KEY) === '1' ||
      /[?&]debug(?:=1)?/.test(window.location.search);
  } catch (e) { /* 隐私模式等场景忽略 */ }

  // 从 localStorage 恢复历史日志
  try {
    var stored = localStorage.getItem(BUFFER_KEY);
    if (stored) {
      var parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        _buffer = parsed;
      }
    }
  } catch (e) { /* 忽略解析错误 */ }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function ts() {
    var d = new Date();
    return (
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0')
    );
  }

  function fullTs() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + ts();
  }

  function sanitize(str) {
    if (typeof str !== 'string') return str;
    // 路径用户名脱敏
    str = str.replace(/\/home\/[^\/]+\//g, '/home/<user>/');
    str = str.replace(/\/Users\/[^\/]+\//g, '/Users/<user>/');
    str = str.replace(/C:\\Users\\[^\\]+\\/gi, 'C:\\Users\\<user>\\');
    // Token / API Key 脱敏（20位以上的字母数字下划线连字符）
    str = str.replace(/[a-zA-Z0-9_-]{20,}/g, '***');
    return str;
  }

  function sanitizeObj(obj) {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitize(obj);
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Error) {
      return {
        message: sanitize(obj.message),
        stack: sanitize(obj.stack),
        name: obj.name
      };
    }
    try {
      var str = JSON.stringify(obj);
      return JSON.parse(sanitize(str));
    } catch (e) {
      return obj;
    }
  }

  function pushBuffer(level, module, msg, extra) {
    var entry = {
      time: fullTs(),
      level: level,
      module: module,
      msg: sanitize(msg),
      extra: extra !== undefined ? sanitizeObj(extra) : undefined
    };
    _buffer.push(entry);
    if (_buffer.length > MAX_MEMORY) {
      _buffer = _buffer.slice(_buffer.length - MAX_MEMORY);
    }
    // 同步到 localStorage（最近 200 条）
    try {
      var toStore = _buffer.slice(-MAX_STORAGE);
      localStorage.setItem(BUFFER_KEY, JSON.stringify(toStore));
    } catch (e) { /* 隐私模式或容量不足时忽略 */ }
  }

  function out(level, module, msg, color, extra) {
    // 写入缓存
    pushBuffer(level, module, msg, extra);

    // 控制台输出
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
    debug: function (m, msg, extra) {
      pushBuffer('debug', m, msg, extra);
      if (debugMode) out('debug', m, msg, '#9ca3af', extra);
    },
    info: function (m, msg, extra) {
      pushBuffer('info', m, msg, extra);
      if (debugMode) out('info', m, msg, '#60a5fa', extra);
    },
    warn: function (m, msg, extra) {
      pushBuffer('warn', m, msg, extra);
      out('warn', m, msg, '#fbbf24', extra);
    },
    error: function (m, msg, extra) {
      pushBuffer('error', m, msg, extra);
      out('error', m, msg, '#f87171', extra);
    },
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
    },
    export: function () {
      var lines = _buffer.map(function (entry) {
        var line = '[' + entry.time + '][' + entry.level.toUpperCase() + '][' + entry.module + '] ' + entry.msg;
        if (entry.extra !== undefined) {
          try {
            line += ' | ' + JSON.stringify(entry.extra);
          } catch (e) {
            line += ' | [object]';
          }
        }
        return line;
      });
      var content = lines.join('\n');
      var blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var d = new Date();
      var filename = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '-前端.log';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      out('info', 'DSLog', '日志已导出: ' + filename + '（共 ' + _buffer.length + ' 条）');
    },
    getBufferSize: function () { return _buffer.length; },
    clearBuffer: function () {
      _buffer = [];
      try { localStorage.removeItem(BUFFER_KEY); } catch (e) {}
      out('info', 'DSLog', '日志缓存已清空');
    }
  };

  // ---------- 全局错误捕获（常显） ----------
  window.addEventListener('error', function (e) {
    var msg = '未捕获错误: ' + sanitize(e.message || 'unknown') +
      ' @ ' + sanitize(e.filename || '') + ':' + (e.lineno || 0);
    pushBuffer('error', 'global', msg, { filename: e.filename, lineno: e.lineno, colno: e.colno });
    out('error', 'global', msg);
  });

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    var msg = '未处理的 Promise 拒绝: ' +
      (r && r.message ? sanitize(r.message) : sanitize(String(r)));
    pushBuffer('error', 'global', msg, { reason: r && r.stack ? sanitize(r.stack) : String(r) });
    out('error', 'global', msg);
  });

  out('info', 'DSLog', '日志系统就绪' + (debugMode ? '（调试模式）' : '（默认隐藏 debug/info，DSLog.enableDebug() 开启）'));
})();