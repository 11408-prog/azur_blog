'use strict';

/**
 * daily_log 日志记录（Hexo 事件驱动）
 * ------------------------------------------------------------
 * 作用：
 *   - 构建/部署/本地服务等事件自动记录到 daily_log/YYYY-MM-DD.log
 *   - 每次运行自动清理 7 天前的日志文件
 *   - daily_log/ 已在 .gitignore 中排除，不会上传 GitHub
 *
 * 用法：
 *   - 不需要手动调用，hexo generate / server / deploy 时自动触发
 *   - 想手动加一行日志：node -e "require('./scripts/daily-log').log('自定义消息')"
 *     或直接在其它 hexo 脚本里 require 本模块调用 log()
 */
const fs = require('fs');
const path = require('path');

// 兼容两种运行环境：hexo 运行时（hexo 全局存在）与独立 require（用 __dirname 推导）
const ROOT = typeof hexo !== 'undefined' ? hexo.base_dir : path.join(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'daily_log');
const KEEP_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) { return n < 10 ? '0' + n : '' + n; }

function log(msg) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const d = new Date();
    const date = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    const ts = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    fs.appendFileSync(path.join(LOG_DIR, date + '.log'), '[' + ts + '] ' + msg + '\n');
    cleanup();
  } catch (e) {
    console.error('[daily_log] 写入失败:', e.message);
  }
}

function cleanup() {
  try {
    const cutoff = Date.now() - KEEP_DAYS * DAY_MS;
    for (const f of fs.readdirSync(LOG_DIR)) {
      if (!f.endsWith('.log')) continue;
      const p = path.join(LOG_DIR, f);
      try {
        if (fs.statSync(p).mtimeMs < cutoff) {
          fs.unlinkSync(p);
          console.log('[daily_log] 已清理过期日志: ' + f);
        }
      } catch (e) { /* 单个文件失败不中断 */ }
    }
  } catch (e) { /* 目录不存在等忽略 */ }
}

// ---------- Hexo 事件挂钩（仅 hexo 运行时注册） ----------
if (typeof hexo !== 'undefined') {
  // 是否处于 `hexo server` 本地会话中；只有这种场景才输出下面这些更详细的信息，
  // 普通的 `hexo generate` / `hexo deploy`（比如 auto-deploy-fixed.cmd 里跑的那些）
  // 保持跟以前完全一样的极简两行输出，不受影响。
  let isServerMode = false;
  let initialGenerateDone = false;
  let genStartTime = 0;
  let pendingChangedFiles = [];

  hexo.on('server', () => {
    isServerMode = true;
    log('本地服务启动');
  });

  // 本地开发时，编辑 source/ 下的文件会触发增量重新构建；这里记录具体是哪个文件
  // 改动触发的（跳过服务器刚启动时的一次性全量扫描，那次没有参考价值，全是噪音）。
  if (hexo.source && typeof hexo.source.on === 'function') {
    hexo.source.on('processAfter', ({ type, path: filePath }) => {
      if (!isServerMode || !initialGenerateDone) return;
      if (!filePath) return;
      pendingChangedFiles.push(filePath);
    });
  }

  hexo.on('generateBefore', () => {
    genStartTime = Date.now();
    log('构建开始');
  });

  hexo.on('generateAfter', () => {
    if (!isServerMode) {
      log('构建完成');
      return;
    }

    const durationSec = ((Date.now() - genStartTime) / 1000).toFixed(1);
    let fileCount = '?';
    let postCount = '?';
    try { fileCount = hexo.route.list().length; } catch (e) { /* 忽略 */ }
    try { postCount = hexo.locals.get('posts').length; } catch (e) { /* 忽略 */ }

    let detail = `构建完成 (用时 ${durationSec}s，共 ${fileCount} 个文件，${postCount} 篇文章`;
    if (initialGenerateDone && pendingChangedFiles.length) {
      // 去重：同一次重建可能因为依赖关系被同一个文件触发多次
      const uniqueFiles = Array.from(new Set(pendingChangedFiles));
      detail += `，改动: ${uniqueFiles.join(', ')}`;
    }
    detail += ')';
    log(detail);

    initialGenerateDone = true;
    pendingChangedFiles = [];
  });

  hexo.on('deployBefore', () => log('部署开始'));
  hexo.on('deployAfter', () => log('部署完成'));

  // 捕获构建过程中真正的警告/报错内容（比如模板渲染失败、文件处理出错），
  // 而不是像以前那样只知道"构建完成"却不知道过程中到底有没有出问题。
  // 只在本地 server 会话里写进日志文件；控制台原有输出不受影响，照常打印。
  if (hexo.log) {
    ['warn', 'error', 'fatal'].forEach((level) => {
      const original = hexo.log[level];
      if (typeof original !== 'function') return;
      hexo.log[level] = function (...args) {
        if (isServerMode) {
          const msg = args
            .map((a) => {
              if (a instanceof Error) return a.message;
              if (a && a.err instanceof Error) return a.err.message;
              if (typeof a === 'string') return a;
              try { return JSON.stringify(a); } catch (e) { return String(a); }
            })
            .join(' ');
          log(`[${level.toUpperCase()}] ${msg}`);
        }
        return original.apply(hexo.log, args);
      };
    });
  }
}

module.exports = { log, cleanup, LOG_DIR };
