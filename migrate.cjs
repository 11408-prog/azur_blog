// 迁移脚本：旧站 Hexo → blog-v2 (Mizuki/Astro)
// 幂等：每次运行先清空目标目录，再全量生成。
// 用法：node migrate.js [--dry]
"use strict";

const fs = require("fs");
const path = require("path");

const SRC_SITE = "C:/Users/ASUS/Desktop/blog";
const SRC_POSTS = path.join(SRC_SITE, "source/_posts");
const SRC_IMG = path.join(SRC_SITE, "source/img");

const DST_ROOT = path.resolve(__dirname);
const DST_POSTS = path.join(DST_ROOT, "src/content/posts");
const DST_IMG = path.join(DST_ROOT, "public/img");

const DRY = process.argv.includes("--dry");
const warnings = [];

function walk(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) walk(full, out);
		else if (/\.mdx?$/i.test(e.name)) out.push(full);
	}
	return out;
}

function countFiles(dir) {
	if (!fs.existsSync(dir)) return 0;
	let n = 0;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		n += e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1;
	}
	return n;
}

// 去掉 YAML 值两端的引号
function unquote(s) {
	if (s == null) return "";
	let v = String(s).trim();
	if (
		(v.startsWith('"') && v.endsWith('"')) ||
		(v.startsWith("'") && v.endsWith("'"))
	) {
		v = v.slice(1, -1);
	}
	return v.trim();
}

// 解析 Hexo front matter（只处理本项目实际出现的形态）
function convert(file, rel) {
	const raw = fs.readFileSync(file, "utf8");
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) {
		warnings.push(`无 front matter，按标题兜底: ${rel}`);
		const base = path.basename(rel, path.extname(rel));
		return {
			fm: `title: ${JSON.stringify(base)}\npublished: 2026-01-01\n`,
			body: raw,
		};
	}
	const yaml = m[1];
	const body = m[2];

	const pick = (key) => {
		const mm = yaml.match(new RegExp(`^${key}:\\s*(.*)$`, "m"));
		return mm ? mm[1].trim() : "";
	};

	const title = pick("title") || path.basename(rel, path.extname(rel));

	// date: 2026-10-24 10:52:04 → published: 2026-10-24
	const dateRaw = pick("date");
	const dm = dateRaw.match(/^(\d{4}-\d{2}-\d{2})/);
	const published = dm ? dm[1] : "2026-01-01";
	if (!dm && dateRaw) warnings.push(`日期无法解析，用默认值: ${rel} (${dateRaw})`);

	// categories → category（Mizuki 只支持单值）
	const catRaw = pick("categories");
	const category = unquote(catRaw.replace(/^\[|\]$/g, "").split(",")[0] || "");

	// tags: [a,b] → ["a","b"]  —— 数字必须加引号，否则 YAML 解析成 number 违反 schema
	let tags = [];
	const tagsRaw = pick("tags");
	const inline = tagsRaw.match(/^\[(.*)\]$/);
	if (inline) {
		tags = inline[1]
			.split(/[,，]/) // 中英文逗号都拆
			.map((s) => unquote(s))
			.filter(Boolean);
	} else if (tagsRaw) {
		tags = [unquote(tagsRaw)];
	}

	// cover → image
	const cover = unquote(pick("cover"));

	const lines = ["---", `title: ${JSON.stringify(title)}`, `published: ${published}`];
	if (category) lines.push(`category: ${JSON.stringify(category)}`);
	if (tags.length) lines.push(`tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]`);
	if (cover) lines.push(`image: ${JSON.stringify(cover)}`);
	lines.push("---", "");

	return { fm: `${lines.join("\n")}\n`, body };
}

// 递归删除目录。
// 注意：Node v25 在本机中文路径下用 fs.rmSync 会在删除时崩溃 (0xC0000409)，
// 因此改用 unlinkSync + rmdirSync，走不同代码路径，实测正常。
function rmAll(dir) {
	if (!fs.existsSync(dir)) return;
	for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) rmAll(full);
		else fs.unlinkSync(full);
	}
	fs.rmdirSync(dir);
}

// 清空目标目录（幂等前提），并确保目录本身存在
function emptyDir(dir) {
	rmAll(dir);
	fs.mkdirSync(dir, { recursive: true });
}

// ---- 主流程 ----
const files = walk(SRC_POSTS).sort();
if (!files.length) {
	console.error(`!! 源文章目录为空或不存在: ${SRC_POSTS}`);
	process.exit(1);
}

if (!DRY) emptyDir(DST_POSTS);

let count = 0;
for (const file of files) {
	const rel = path.relative(SRC_POSTS, file);
	const dst = path.join(DST_POSTS, rel);
	if (!DRY) {
		fs.mkdirSync(path.dirname(dst), { recursive: true });
		const { fm, body } = convert(file, rel);
		fs.writeFileSync(dst, fm + body, "utf8");
	}
	count++;
}

// 图片：source/img → public/img（文章里的 /img/x 引用对应 public/img/x）
// 注意：Node v25 在本机中文路径下 fs.cpSync 复制子目录会报 EIO，
// 因此图片由 PowerShell 完成（见 migrate-images.ps1），这里只统计。
let imgCount = countFiles(DST_IMG);
if (imgCount === 0) {
	warnings.push(`图片未复制，请运行 migrate-images.ps1（目标: ${DST_IMG}）`);
}

console.log(`${DRY ? "[DRY] " : ""}文章 ${count} 篇 → ${DST_POSTS}`);
console.log(`图片 ${imgCount} 个 → ${DST_IMG}`);
if (warnings.length) {
	console.log(`\n需要人工检查 ${warnings.length} 处:`);
	warnings.forEach((w) => console.log(`  - ${w}`));
} else {
	console.log("无警告");
}
