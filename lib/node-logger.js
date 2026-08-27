/**
 * Node.js 统一日志模块
 * ------------------------------------------------------------
 * 用法：
 *   const log = require('./lib/node-logger')('compress-images');
 *   log.info('消息', { file: 'xxx.jpg' });
 *   log.error('处理失败', { error: e.message, stack: e.stack });
 *
 * 特性：
 *   - 四级输出：debug / info / warn / error
 *   - 双写：带颜色终端输出 + 无颜色追加到 daily_log/YYYY-MM-DD-后端.log
 *   - 自动创建 daily_log/ 目录
 *   - 每次写入时自动清理超过 7 天的旧日志文件
 *   - 敏感信息脱敏：绝对路径用户名、password/token/key/secret 等键值对
 */
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'daily_log');
const MAX_DAYS = 7;

// ANSI 颜色
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m',   // 青色
  info: '\x1b[34m',    // 蓝色
  warn: '\x1b[33m',    // 黄色
  error: '\x1b[31m',   // 红色
  bold: '\x1b[1m'
};

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function now() {
  const d = new Date();
  return {
    date: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
    time: pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) +
      '.' + String(d.getMilliseconds()).padStart(3, '0'),
    iso: d.toISOString()
  };
}

function sanitize(str) {
  if (typeof str !== 'string') return str;
  // 绝对路径用户名脱敏
  str = str.replace(/\/home\/[^\/]+\//g, '/home/<user>/');
  str = str.replace(/\/Users\/[^\/]+\//g, '/Users/<user>/');
  str = str.replace(/C:\\Users\\[^\\]+\\/gi, 'C:\\Users\\<user>\\');
  // password/token/key/secret 等键值对脱敏
  str = str.replace(/(password|passwd|pwd|token|secret|apikey|api_key|access_key)\s*[=:]\s*[^\s&;,]+/gi, '$1=***');
  // 20位以上的疑似密钥
  str = str.replace(/[a-zA-Z0-9_-]{20,}/g, '***');
  return str;
}

function sanitizeObj(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return sanitize(obj);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Error) {
    const o = {};
    Object.getOwnPropertyNames(obj).forEach(function (key) {
      o[key] = sanitizeObj(obj[key]);
    });
    return o;
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObj);
  }
  const result = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = sanitizeObj(obj[key]);
    }
  }
  return result;
}

function formatExtra(extra) {
  if (extra === undefined) return '';
  try {
    const s = JSON.stringify(sanitizeObj(extra));
    return ' | ' + s;
  } catch (e) {
    return ' | [object]';
  }
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function getLogFile() {
  const d = now();
  return path.join(LOG_DIR, d.date + '-后端.log');
}

function cleanOldLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const files = fs.readdirSync(LOG_DIR);
    const cutoff = Date.now() - MAX_DAYS * 24 * 60 * 60 * 1000;
    for (const file of files) {
      const fullPath = path.join(LOG_DIR, file);
      const stat = fs.statSync(fullPath);
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(fullPath);
      }
    }
  } catch (e) {
    // 清理失败不阻塞主流程
  }
}

function writeLog(level, module, msg, extra) {
  ensureLogDir();
  cleanOldLogs();

  const n = now();
  const line = '[' + n.date + ' ' + n.time + '][' + level.toUpperCase() + '][' + module + '] ' +
    sanitize(msg) + formatExtra(extra) + '\n';

  try {
    fs.appendFileSync(getLogFile(), line, 'utf8');
  } catch (e) {
    // 文件写入失败时回退到终端
    process.stderr.write('[logger-error] 写入日志文件失败: ' + e.message + '\n');
  }
}

function logToConsole(level, module, msg, extra) {
  const n = now();
  const color = COLORS[level] || COLORS.reset;
  const prefix = color + COLORS.bold +
    '[' + n.time + '][' + level.toUpperCase() + '][' + module + ']' +
    COLORS.reset + ' ';
  const extraStr = formatExtra(extra);

  if (level === 'error') {
    process.stderr.write(prefix + sanitize(msg) + extraStr + '\n');
  } else {
    process.stdout.write(prefix + sanitize(msg) + extraStr + '\n');
  }
}

function createLogger(module) {
  return {
    debug: function (msg, extra) {
      writeLog('debug', module, msg, extra);
      logToConsole('debug', module, msg, extra);
    },
    info: function (msg, extra) {
      writeLog('info', module, msg, extra);
      logToConsole('info', module, msg, extra);
    },
    warn: function (msg, extra) {
      writeLog('warn', module, msg, extra);
      logToConsole('warn', module, msg, extra);
    },
    error: function (msg, extra) {
      writeLog('error', module, msg, extra);
      logToConsole('error', module, msg, extra);
    }
  };
}

module.exports = createLogger;