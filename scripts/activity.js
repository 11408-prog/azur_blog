'use strict';

const fs = require('fs');
const path = require('path');

// 递归读取目录下所有 .md 文件
function walkDir(dir, files = []) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath, files);
    } else if (item.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

hexo.extend.generator.register('activity-data', function () {
  const postsDir = path.join(hexo.source_dir, '_posts');
  let files = [];
  try {
    files = walkDir(postsDir);
  } catch (e) {
    files = [];
  }

  const counts = {};
  for (const filePath of files) {
    const content = fs.readFileSync(filePath, 'utf8');
    const m = content.match(/^date:\s*['"]?(\d{4}-\d{2}-\d{2})/m);
    if (m) {
      const day = m[1];
      counts[day] = (counts[day] || 0) + 1;
    }
  }

  return {
    path: 'data/activity.json',
    data: JSON.stringify(counts)
  };
});