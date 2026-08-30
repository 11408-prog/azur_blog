'use strict';

/**
 * 画廊图片列表生成器
 * 构建时扫描 source/carousel/，生成 /gallery.json（含每张图的宽高）。
 * 前端瀑布流用 w/h 做 aspect-ratio 占位 → 贪心插入零跳动、可边加载边看。
 * 加图 = 丢进 source/carousel/ + 重新构建。
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

hexo.extend.generator.register('gallery-list', async function () {
  const dir = path.join(hexo.source_dir, 'carousel');
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|gif|webp|avif)$/i.test(f));
  } catch (e) {
    files = [];
  }
  files.sort();

  const images = [];
  for (const f of files) {
    const item = {
      url: '/azur_blog/carousel/' + f,
      alt: path.basename(f, path.extname(f))
    };
    // 读取真实尺寸（读不到就省略，前端用默认占位）
    try {
      const meta = await sharp(path.join(dir, f)).metadata();
      item.w = meta.width;
      item.h = meta.height;
    } catch (e) { /* 忽略，前端兜底 */ }
    images.push(item);
  }

  return {
    path: 'gallery.json',
    data: JSON.stringify(images)
  };
});
