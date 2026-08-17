'use strict';

/**
 * 活跃度数据生成器
 * 构建时扫描 source/_posts/ 的文章发布日期，按天计数，
 * 生成 /data/activity.json 供前端热力图渲染。
 * 格式：{ "2026-08-11": 2, "2026-08-14": 1, ... }
 */
const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('activity-data', function () {
  const postsDir = path.join(hexo.source_dir, '_posts');
  let files = [];
  try {
    files = fs.readdirSync(postsDir).filter((f) => f.endsWith('.md'));
  } catch (e) {
    files = [];
  }

  const counts = {};
  for (const f of files) {
    const content = fs.readFileSync(path.join(postsDir, f), 'utf8');
    // front matter 里的 date 行，取日期部分（兼容 "2026-08-11 20:31:32" 和 "2026-08-11"）
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
