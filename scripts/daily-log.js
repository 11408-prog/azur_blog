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
  hexo.on('generateBefore', () => log('构建开始'));
  hexo.on('generateAfter', () => log('构建完成'));
  hexo.on('deployBefore', () => log('部署开始'));
  hexo.on('deployAfter', () => log('部署完成'));
  hexo.on('server', () => log('本地服务启动'));
}

module.exports = { log, cleanup, LOG_DIR };
