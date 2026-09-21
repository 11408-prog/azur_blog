'use strict';

/**
 * 标签页数据生成器
 * ------------------------------------------------------------
 * 构建时生成 /data/tags.json，供标签页的 React 岛（web/islands/TagsExplorer.jsx）
 * 做「多标签筛选 + 排序」。数据形态：
 *
 *   {
 *     "tags":  [ { "name": "hexo", "path": "tags/hexo/", "count": 2 }, ... ],
 *     "posts": [ { "title": "...", "path": "2026/08/11/.../", "date": "2026-08-11", "tags": [0, 3] }, ... ]
 *   }
 *
 *   - posts[].tags 存的是 tags 数组的下标（不是名字），交集/并集运算更快、体积更小
 *   - path 不带 root 前缀（前端用 BlogConfig.url() 拼），中文/特殊字符已 encodeURI，
 *     与 scripts/gallery-list.js 的处理方式一致（# 和 ? 会被当成锚点/查询串，必须手动编码）
 *   - 没有任何标签的文章不进 posts（标签页用不到它们）
 *   - tags 按「文章数降序、名称升序」输出，保证每次构建顺序稳定（前端拿到后还会按用户选的方式再排）
 */
hexo.extend.generator.register('tags-data', function (locals) {
  const enc = (p) => encodeURI(p).replace(/#/g, '%23').replace(/\?/g, '%3F');

  const tagByName = new Map();   // name -> { name, path, count }
  const posts = [];

  for (const post of locals.posts.sort('-date').toArray()) {
    const tagObjs = post.tags.toArray();
    if (!tagObjs.length) continue;

    for (const t of tagObjs) {
      if (!tagByName.has(t.name)) {
        tagByName.set(t.name, { name: t.name, path: enc(t.path), count: 0 });
      }
      tagByName.get(t.name).count++;
    }
    posts.push({
      title: post.title || '(无标题)',
      path: enc(post.path),
      date: post.date.format('YYYY-MM-DD'),
      names: tagObjs.map((t) => t.name),
    });
  }

  const tags = [...tagByName.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-Hans-CN')
  );
  const index = new Map(tags.map((t, i) => [t.name, i]));

  return {
    path: 'data/tags.json',
    data: JSON.stringify({
      tags: tags,
      posts: posts.map((p) => ({
        title: p.title,
        path: p.path,
        date: p.date,
        tags: p.names.map((n) => index.get(n)),
      })),
    }),
  };
});
