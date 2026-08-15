/**
 * 皮肤立绘批量转换脚本：PNG/JPG -> WebP
 * ------------------------------------------------------------
 * 用法：node scripts/convert-skins.js
 *
 * 做的事：
 *   - 把 source/img/汇总-立绘/ 下所有 PNG/JPG 转成 WebP（quality 90）
 *   - 保持原尺寸，不缩放（保留高清，正文按容器宽度显示）
 *   - 原图先备份到 source/_img_backup/img/汇总-立绘/，确认效果后可删
 *   - 转换后删除源 PNG/JPG（引用需同步改为 .webp，见文章更新说明）
 *
 * 注意：Windows 下避免读句柄占用——先读 buffer 再写新文件（.webp 是
 *       新路径，不会和源文件冲突），全部写完后才删源文件。
 */
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'source', 'img', '汇总-立绘');
const BACKUP = path.join(__dirname, '..', 'source', '_img_backup', 'img', '汇总-立绘');

async function main() {
  if (!fs.existsSync(DIR)) {
    console.error(`目录不存在: ${DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(BACKUP, { recursive: true });

  const files = fs.readdirSync(DIR).filter((f) => /\.(png|jpe?g)$/i.test(f));
  let totalBefore = 0;
  let totalAfter = 0;

  for (const f of files) {
    const full = path.join(DIR, f);
    const stat = fs.statSync(full);
    totalBefore += stat.size;

    // 1. 备份原图（只备份一次）
    const bak = path.join(BACKUP, f);
    if (!fs.existsSync(bak)) fs.copyFileSync(full, bak);

    // 2. 读 buffer + 转 webp（新路径写入，避免占用冲突）
    const input = fs.readFileSync(full);
    const out = path.join(DIR, path.basename(f, path.extname(f)) + '.webp');
    const buf = await sharp(input)
      .resize({ withoutEnlargement: true })
      .webp({ quality: 90 })
      .toBuffer();
    fs.writeFileSync(out, buf);
    totalAfter += buf.length;

    // 3. 删源文件（排除 .webp 输出本身）
    if (path.resolve(full) !== path.resolve(out)) fs.unlinkSync(full);

    console.log(
      `${f} -> ${path.basename(out)}  (${(stat.size / 1024).toFixed(0)}KB -> ${(buf.length / 1024).toFixed(0)}KB)`
    );
  }

  console.log('\n完成。');
  console.log(
    `总计: ${(totalBefore / 1024 / 1024).toFixed(1)}MB -> ${(totalAfter / 1024 / 1024).toFixed(1)}MB ` +
      `(省 ${((1 - totalAfter / totalBefore) * 100).toFixed(1)}%)`
  );
  console.log(`原图备份在: ${BACKUP}`);
  console.log('记得同步更新文章里的图片引用：.png/.jpg -> .webp');
}

main();
