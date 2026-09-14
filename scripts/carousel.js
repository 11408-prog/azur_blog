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
      .filter((f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f));
  } catch (e) {
    // 目录不存在时返回空列表
  }

  // 构建时随机打乱顺序：每次部署顺序换新，一次部署内保持稳定
  for (let i = files.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [files[i], files[j]] = [files[j], files[i]];
  }

  // 根路径统一从 Hexo 配置派生，不硬编码 /azur_blog/
  // （前端由 source/js/blog-config.js 读取同一份 GLOBAL_CONFIG.root）
  const root = hexo.config.root || '/';

  const images = files.map((f) => root + 'carousel/' + f);

  return {
    path: 'carousel-list.json',
    data: JSON.stringify({ images: images })
  };
});
