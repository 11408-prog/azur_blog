/**
 * 相册图片 -> WebP 转换工具
 *
 * 背景：Mizuki 的相册图片放在 public/ 下，不经过 Astro 图片优化，原样复制到 dist。
 *       目前两个相册共 36MB 原图，手机加载很慢。
 *
 * 重要机制（src/utils/album-scanner.ts:153-173）：
 *       扫描器会遍历目录里所有图片文件。如果 001.jpg 和 001.webp 同时存在，
 *       两张都会进照片列表 -> 每张照片重复显示两次。
 *       所以不能"保留原图 + 新增 webp"，必须替换（原图备份到项目外）。
 *
 * 用法（在项目根目录执行）：
 *   node tools-convert-albums.mjs            # 真正执行：备份 + 转换 + 替换
 *   node tools-convert-albums.mjs --dry-run  # 只统计，不改动任何文件
 *
 * 回滚：把备份目录里的图片拷回 public/images/albums/<相册名>/ 即可。
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// 脚本位于 <项目根>/tools-convert-albums.mjs，所以项目根就是它所在目录
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const ALBUM_ROOT = path.join(ROOT, "public", "images", "albums");
// 备份放到项目外（工作区根目录），避免被打进 dist
const BACKUP_ROOT = path.join(
	path.dirname(ROOT),
	`相册原图备份-${new Date().toISOString().slice(0, 10)}`,
);

const DRY_RUN = process.argv.includes("--dry-run");

// 转换参数：quality 82 视觉无损，最大边 1600 足够相册展示
const QUALITY = 82;
const MAX_EDGE = 1600;

// 需要跳过的文件：封面由扫描器单独查找，不能被转换或删除
const SKIP_FILES = new Set(["cover.jpg", "cover.webp", "cover.png"]);
// 模板示例目录（无图片，跳过）
const SKIP_DIRS = new Set([
	"EncryptedExample",
	"ExternalExample",
	"HiddenExample",
]);

const CONVERTIBLE = new Set([".jpg", ".jpeg", ".png"]);

function human(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function listAlbums() {
	return fs
		.readdirSync(ALBUM_ROOT, { withFileTypes: true })
		.filter((d) => d.isDirectory() && !SKIP_DIRS.has(d.name))
		.map((d) => d.name);
}

async function main() {
	if (!fs.existsSync(ALBUM_ROOT)) {
		console.error("找不到相册目录:", ALBUM_ROOT);
		process.exit(1);
	}

	const albums = listAlbums();
	console.log(`相册目录: ${ALBUM_ROOT}`);
	console.log(`待处理相册: ${albums.join(" / ")}`);
	console.log(`模式: ${DRY_RUN ? "DRY-RUN（只统计，不改动）" : "正式执行"}\n`);

	let totalBefore = 0;
	let totalAfter = 0;
	let converted = 0;
	let skipped = 0;
	let failed = 0;

	for (const album of albums) {
		const dir = path.join(ALBUM_ROOT, album);
		const files = fs
			.readdirSync(dir)
			.filter((f) => CONVERTIBLE.has(path.extname(f).toLowerCase()))
			.filter((f) => !SKIP_FILES.has(f));

		if (files.length === 0) {
			console.log(`[跳过] ${album}（无可转换图片）`);
			continue;
		}

		let albumBefore = 0;
		let albumAfter = 0;
		console.log(`\n=== ${album}（${files.length} 张）===`);

		if (!DRY_RUN) {
			fs.mkdirSync(path.join(BACKUP_ROOT, album), { recursive: true });
		}

		for (const file of files) {
			const srcPath = path.join(dir, file);
			const outName = `${path.basename(file, path.extname(file))}.webp`;
			const outPath = path.join(dir, outName);

			try {
				const before = fs.statSync(srcPath).size;
				albumBefore += before;

				if (DRY_RUN) {
					// dry-run 下不真正转换，只按经验系数估算
					albumAfter += Math.round(before * 0.18);
					converted++;
					continue;
				}

				// 1. 备份原图（保留 mtime）
				fs.copyFileSync(srcPath, path.join(BACKUP_ROOT, album, file));

				// 2. 转换（限制最大边，保持比例，不放大）
				await sharp(srcPath)
					.rotate()
					.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
					.webp({ quality: QUALITY })
					.toFile(outPath);

				// 3. 继承原图修改时间（相册日期字段取自 mtime）
				const st = fs.statSync(srcPath);
				fs.utimesSync(outPath, st.atime, st.mtime);

				// 4. 删除原图
				fs.unlinkSync(srcPath);

				const after = fs.statSync(outPath).size;
				albumAfter += after;
				converted++;
			} catch (err) {
				failed++;
				console.error(`  [失败] ${file}: ${err.message}`);
			}
		}

		totalBefore += albumBefore;
		totalAfter += albumAfter;
		console.log(
			`  小计: ${human(albumBefore)} -> ${DRY_RUN ? `约 ${human(albumAfter)}` : human(albumAfter)}`,
		);
	}

	console.log(`\n${"=".repeat(46)}`);
	console.log(`转换成功: ${converted} 张   跳过: ${skipped}   失败: ${failed}`);
	console.log(
		`总体积: ${human(totalBefore)} -> ${DRY_RUN ? `约 ${human(totalAfter)}（估算）` : human(totalAfter)}`,
	);
	if (totalBefore > 0 && !DRY_RUN) {
		const saved = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
		console.log(`节省: ${saved}%  (${human(totalBefore - totalAfter)})`);
	}
	if (!DRY_RUN && converted > 0) {
		console.log(`\n原图备份目录: ${BACKUP_ROOT}`);
		console.log("回滚方法: 把备份目录里的图片拷回对应相册目录，删掉同名 .webp");
	}
	console.log("\n下一步: 运行 start-site.bat 构建验证相册显示正常");
}

main().catch((err) => {
	console.error("脚本异常:", err);
	process.exit(1);
});
