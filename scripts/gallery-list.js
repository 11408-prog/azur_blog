'use strict';

/**
 * 画廊图片列表生成器
 * 构建时扫描 source/carousel/ 文件夹，生成 /gallery.json，
 * 供画廊页 {% gallery url,/gallery.json %} 加载。
 * 以后加图 = 把图丢进 source/carousel/，重新 hexo generate 即可。
 */
const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('gallery-list', function () {
  const dir = path.join(hexo.source_dir, 'carousel');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f));
  } catch (e) {
    files = [];
  }
  files.sort();

  const images = files.map((f) => ({
    url: '/azur_blog/carousel/' + f,
    alt: path.basename(f, path.extname(f))
  }));

  return {
    path: 'gallery.json',
    data: JSON.stringify(images)
  };
});
