/**
 * 博客图片批量压缩脚本
 * ------------------------------------------------------------
 * 用法：
 *   1. 把这个文件放到你的博客项目根目录（和 source/ 同级）
 *   2. npm install sharp --save-dev
 *   3. node compress-images.js
 *
 * 做的事：
 *   - 按每类图片的"实际显示尺寸"重新缩放（不再用原图分辨率）
 *   - 用 sharp 重新编码压缩（保持原有扩展名/格式，避免改文件名影响已发布文章的引用）
 *   - 顺便修正 life.jpg / love.jpg / background.jpg 这种"内容是 avif/webp 但扩展名是 jpg"
 *     的问题——sharp 按文件真实内容读取，输出时会重新编码成扩展名对应的真实格式
 *   - 处理前会先把原图备份到 source/_img_backup/，如果效果不满意可以随时还原
 *
 * 注意：
 *   - 这个脚本会直接覆盖 source/ 下的图片文件，运行前确保代码已经提交（git commit），
 *     方便出问题时 git checkout 还原
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = __dirname;
const BACKUP_DIR = path.join(ROOT, 'source', '_img_backup');

// 每类图片的目标最大宽度（px）和压缩质量（0-100），按实际显示场景设置
// 想更激进/更保守压缩，改这里的数字就行
const TASKS = [
  // 头像：圆形展示，约 100px 直径，给 2x 视网膜留量即可
  { glob: ['source/img/avatar.png'], maxWidth: 300, quality: 82 },

  // favicon：极小图标
  { glob: ['source/img/favicon.png'], maxWidth: 64, quality: 90 },

  // 磁贴背景图（学习/生活/热爱）：桌面端每块约 300-400px 宽
  { glob: ['source/img/study.jpg', 'source/img/life.jpg', 'source/img/love.jpg'], maxWidth: 800, quality: 78 },

  // 头图 / 随机封面：全屏宽度展示，允许稍大，但仍需压缩
  { glob: ['source/img/covers'], maxWidth: 1920, quality: 76, isDir: true },

  // 首页轮播图：容器宽度展示，通常不超过 1000-1200px
  { glob: ['source/carousel'], maxWidth: 1400, quality: 78, isDir: true },
];

function collectFiles(task) {
  const files = [];
  for (const p of task.glob) {
    const full = path.join(ROOT, p);
    if (!fs.existsSync(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      for (const f of fs.readdirSync(full)) {
        if (/\.(jpe?g|png|webp|avif|gif)$/i.test(f)) {
          files.push(path.join(full, f));
        }
      }
    } else {
      files.push(full);
    }
  }
  return files;
}

function backup(file) {
  const rel = path.relative(path.join(ROOT, 'source'), file);
  const dest = path.join(BACKUP_DIR, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  if (!fs.existsSync(dest)) {
    fs.copyFileSync(file, dest);
  }
}

async function compressOne(file, maxWidth, quality) {
  const before = fs.statSync(file).size;
  const ext = path.extname(file).toLowerCase();

  // favicon 实际是 .ico 内容但改名叫 .png，sharp 读不了 ico，跳过，脚本最后会提醒手动换掉
  let meta;
  try {
    meta = await sharp(file).metadata();
  } catch (e) {
    return { file, before, after: before, skipped: true, reason: '无法识别的图片格式（可能是 .ico 伪装成 .png），需手动更换' };
  }

  // 文件名是 .jpg/.png，但内容实际已经是 avif/webp 这种高效格式：
  // 如果已经很小了，转成 jpeg 反而会变大，直接跳过，只在报告里提示格式不符
  const realFormat = meta.format; // 'jpeg' | 'png' | 'webp' | 'avif' | ...
  const expectedFormat = ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : ext.slice(1);
  const isEfficientMismatch = (realFormat === 'avif' || realFormat === 'heif' || realFormat === 'webp') && realFormat !== expectedFormat;

  if (isEfficientMismatch && before < 150 * 1024) {
    return {
      file,
      before,
      after: before,
      skipped: true,
      reason: `内容实际是 ${realFormat.toUpperCase()} 格式（文件名却是 ${ext}），已经比较小，不重新编码，建议改天专门统一一下文件名/格式`,
    };
  }

  backup(file);

  let pipeline = sharp(file).resize({ width: maxWidth, withoutEnlargement: true });

  if (ext === '.png') {
    pipeline = pipeline.png({ quality, compressionLevel: 9 });
  } else if (ext === '.webp') {
    pipeline = pipeline.webp({ quality });
  } else if (ext === '.gif') {
    // sharp 对动图处理复杂，跳过，直接保留原图
    return { file, before, after: before, skipped: true, reason: 'GIF 动图，跳过' };
  } else {
    // .jpg/.jpeg：统一重编码成标准 JPEG（包括内容实际是 avif/webp 但体积较大的情况，这时候转成压缩过的 jpeg 反而更小）
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  }

  const buffer = await pipeline.toBuffer();
  fs.writeFileSync(file, buffer);
  const after = fs.statSync(file).size;
  return { file, before, after, skipped: false };
}

async function main() {
  console.log('开始压缩图片，原图会先备份到 source/_img_backup/ ...\n');
  let totalBefore = 0;
  let totalAfter = 0;

  for (const task of TASKS) {
    const files = collectFiles(task);
    for (const file of files) {
      try {
        const r = await compressOne(file, task.maxWidth, task.quality);
        const rel = path.relative(ROOT, file);
        if (r.skipped) {
          console.log(`跳过 ${rel}${r.reason ? '：' + r.reason : ''}`);
          continue;
        }
        totalBefore += r.before;
        totalAfter += r.after;
        const pct = ((1 - r.after / r.before) * 100).toFixed(1);
        console.log(
          `${rel}: ${(r.before / 1024).toFixed(0)}KB -> ${(r.after / 1024).toFixed(0)}KB (省 ${pct}%)`
        );
      } catch (e) {
        console.error(`处理失败: ${file}`, e.message);
      }
    }
  }

  console.log('\n完成。');
  console.log(
    `总计: ${(totalBefore / 1024 / 1024).toFixed(2)}MB -> ${(totalAfter / 1024 / 1024).toFixed(2)}MB` +
      (totalBefore ? `（省 ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%）` : '')
  );
  console.log(`原图备份在: ${BACKUP_DIR}`);
  console.log('确认效果没问题后，可以把 source/_img_backup/ 加进 .gitignore，不用提交进仓库。');
}

main();
