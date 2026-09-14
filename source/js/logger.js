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
  // 持久化节流：内存 Buffer 与 localStorage 分离，避免每条日志都同步写盘
  var FLUSH_INTERVAL = 5000;  // 定时器兜底间隔（ms）
  var FLUSH_THRESHOLD = 20;   // 累计新增条数达到即写
  var debugMode = false;
  var _buffer = [];
  var _dirty = false;         // 内存 Buffer 是否有未持久化的改动
  var _pendingCount = 0;      // 距上次持久化新增的条数
  var _flushTimer = null;

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
    // 只标记待持久化，真正的 localStorage 写入由 flushToStorage() 批量完成
    _dirty = true;
    _pendingCount++;
    scheduleFlush();
  }

  // 将内存 Buffer 的最近 MAX_STORAGE 条写入 localStorage（同步 API，故需节流）
  function flushToStorage() {
    if (!_dirty) return;
    _dirty = false;
    _pendingCount = 0;
    try {
      localStorage.setItem(BUFFER_KEY, JSON.stringify(_buffer.slice(-MAX_STORAGE)));
    } catch (e) { /* 隐私模式或容量不足时忽略 */ }
  }

  // 节流调度：达到条数阈值立即写，否则等定时器兜底
  function scheduleFlush() {
    if (_pendingCount >= FLUSH_THRESHOLD) {
      flushToStorage();
      return;
    }
    if (_flushTimer === null) {
      _flushTimer = setTimeout(function () {
        _flushTimer = null;
        flushToStorage();
      }, FLUSH_INTERVAL);
    }
  }

  // 页面离开时确保日志落地（定时器可能尚未触发）
  window.addEventListener('pagehide', flushToStorage);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flushToStorage();
  });

  // 唯一的 Buffer 写入入口：所有级别都经由此函数入缓存
  // printToConsole 为 false 时只入缓存、不打印（debug/info 在非调试模式下如此）
  // printExtra 为 false 时不把 extra 打到控制台（全局错误捕获沿用原行为：只入缓存不打印）
  function out(level, module, msg, color, extra, printToConsole, printExtra) {
    pushBuffer(level, module, msg, extra);

    // 控制台输出
    if (printToConsole === false) return;
    var args = [
      '%c[' + ts() + '][' + level.toUpperCase() + '][' + module + '] ' + msg + '%c',
      'color:' + color + ';font-weight:bold',
      'color:inherit'
    ];
    if (extra !== undefined && printExtra !== false) args.push(extra);
    var fn = console[level] || console.log;
    if (typeof fn === 'function') fn.apply(console, args);
  }

  window.DSLog = {
    debug: function (m, msg, extra) {
      // 是否打印由 debugMode 决定；Buffer 一定写入（此前 debugMode 为 false 时也要入缓存）
      out('debug', m, msg, '#9ca3af', extra, debugMode);
    },
    info: function (m, msg, extra) {
      out('info', m, msg, '#60a5fa', extra, debugMode);
    },
    warn: function (m, msg, extra) {
      out('warn', m, msg, '#fbbf24', extra, true);
    },
    error: function (m, msg, extra) {
      out('error', m, msg, '#f87171', extra, true);
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
  // 只调用 out()：Buffer 写入由 out() 统一负责，避免与 pushBuffer() 重复
  // 第 7 个参数 printExtra=false 保持与原实现一致的控制台输出（不额外打印对象）
  window.addEventListener('error', function (e) {
    var msg = '未捕获错误: ' + sanitize(e.message || 'unknown') +
      ' @ ' + sanitize(e.filename || '') + ':' + (e.lineno || 0);
    out('error', 'global', msg, '#f87171',
      { filename: e.filename, lineno: e.lineno, colno: e.colno }, true, false);
  });

  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    var msg = '未处理的 Promise 拒绝: ' +
      (r && r.message ? sanitize(r.message) : sanitize(String(r)));
    out('error', 'global', msg, '#f87171',
      { reason: r && r.stack ? sanitize(r.stack) : String(r) }, true, false);
  });

  out('info', 'DSLog', '日志系统就绪' + (debugMode ? '（调试模式）' : '（默认隐藏 debug/info，DSLog.enableDebug() 开启）'));
})();