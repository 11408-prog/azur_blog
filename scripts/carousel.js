'use strict';

/**
 * 首页轮播图：构建时扫描 source/carousel/ 文件夹，
 * 自动生成 /carousel-list.json 供前端轮播读取。
 * 以后加图 = 把图丢进 source/carousel/，重新 hexo generate 即可。
 */
const fs = require('fs');
const path = require('path');

hexo.extend.generator.register('carousel-images', function () {
  const dir = path.join(hexo.source_dir, 'carousel');
  let files = [];

  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f))
      .sort();
  } catch (e) {
    // 目录不存在时返回空列表
  }

  const images = files.map((f) => '/azur_blog/carousel/' + f);

  return {
    path: 'carousel-list.json',
    data: JSON.stringify({ images: images })
  };
});
