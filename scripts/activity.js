'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('activity-data', function () {
  const counts = {};

  try {
    // 在博客根目录执行 git log（.git 在根目录，不在 source/ 里）
    const gitLog = execSync(
      'git log --all --format="%ad" --date=short',
      {
        encoding: 'utf8',
        cwd: hexo.base_dir,
        timeout: 10000
      }
    );

    const lines = gitLog.trim().split('\n').filter(Boolean);
    for (const date of lines) {
      counts[date] = (counts[date] || 0) + 1;
    }

    hexo.log.info('Activity: 从 Git 日志统计了 ' + lines.length + ' 次提交');
  } catch (e) {
    // Git 失败时自动回退到文章日期统计（兜底）
    hexo.log.warn('Activity: Git 统计失败，回退到文章日期 - ' + e.message);

    const postsDir = path.join(hexo.source_dir, '_posts');
    let files = [];
    try {
      function walkDir(dir) {
        const result = [];
        for (const item of fs.readdirSync(dir)) {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            result.push(...walkDir(fullPath));
          } else if (item.endsWith('.md')) {
            result.push(fullPath);
          }
        }
        return result;
      }
      files = walkDir(postsDir);
    } catch (err) {
      files = [];
    }

    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf8');
      const m = content.match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
      if (m) {
        const day = m[1];
        counts[day] = (counts[day] || 0) + 1;
      }
    }
  }

  return {
    path: 'data/activity.json',
    data: JSON.stringify(counts)
  };
});