/**
 * 酷狗狗单增量同步脚本
 *
 * 作用：把酷狗歌单同步到本地，供音乐播放器以 local 模式播放。
 * 每次运行会对比歌单与本地清单，只下载新增的、删除已移除的。
 *
 * 用法：
 *   node scripts/sync-music.mjs            # 正常同步
 *   node scripts/sync-music.mjs --dry      # 只预览会做什么，不写盘
 *   node scripts/sync-music.mjs --limit 5  # 最多处理 5 首（调试用）
 *   node scripts/sync-music.mjs --online-only  # 连不上就静默跳过（构建时用）
 *
 * 说明：酷狗音频 CDN 的 SSL 证书失效，必须关闭证书校验才能下载，
 *       这就是为什么开头要设 NODE_TLS_REJECT_UNAUTHORIZED。
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const PLAYLIST_ID = process.env.KUGOU_PLAYLIST_ID || "collection_3_2586463630_2_0";
const API = `https://api.kfjie.me/music?server=kugou&type=playlist&id=${encodeURIComponent(PLAYLIST_ID)}`;

const MUSIC_DIR = path.join(ROOT, "public", "music");
const COVER_DIR = path.join(MUSIC_DIR, "cover");
// 清单放在 scripts/ 下而不是 public/music/：音频文件不入库，
// 但清单要入库，这样换机器时知道该同步哪些歌
const MANIFEST = path.join(ROOT, "scripts", "music-manifest.json");
const GENERATED = path.join(
	ROOT,
	"src",
	"components",
	"widgets",
	"music-player",
	"localPlaylist.generated.ts",
);

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const ONLINE_ONLY = args.includes("--online-only");
const limitIdx = args.indexOf("--limit");
const LIMIT = limitIdx >= 0 ? Number.parseInt(args[limitIdx + 1], 10) : Infinity;

/** 探测能否访问歌单接口，用于构建时判断要不要同步 */
async function isOnline(timeoutMs = 8000) {
	try {
		const res = await fetch(API, { signal: AbortSignal.timeout(timeoutMs) });
		return res.ok;
	} catch {
		return false;
	}
}

/** 从 kfjie 返回的 url 里提取歌曲 hash，作为稳定唯一标识 */
function extractHash(url) {
	try {
		const id = new URL(url).searchParams.get("id") || "";
		return decodeURIComponent(id).split("|")[0];
	} catch {
		return "";
	}
}

/** 估算 MP3 时长（秒）。对 CBR 准确，VBR 有误差 */
function mp3Duration(buf) {
	const BITRATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
	const RATE = [44100, 48000, 32000];
	let offset = 0;
	if (buf.slice(0, 3).toString("latin1") === "ID3") {
		const size = (buf[6] << 21) | (buf[7] << 14) | (buf[8] << 7) | buf[9];
		offset = 10 + size;
	}
	for (let i = offset; i < buf.length - 4; i++) {
		if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
			const bitrateIdx = (buf[i + 2] >> 4) & 0x0f;
			const rateIdx = (buf[i + 2] >> 2) & 0x03;
			if (bitrateIdx > 0 && bitrateIdx < 15 && rateIdx < 3) {
				const kbps = BITRATE[bitrateIdx];
				const bytes = buf.length - offset;
				return Math.round((bytes * 8) / (kbps * 1000));
			}
		}
	}
	return 0;
}

async function download(url, timeoutMs = 90000) {
	const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	return Buffer.from(await res.arrayBuffer());
}

function readManifest() {
	if (!fs.existsSync(MANIFEST)) return { songs: [] };
	try {
		return JSON.parse(fs.readFileSync(MANIFEST, "utf-8"));
	} catch {
		console.warn("清单文件损坏，按空清单处理");
		return { songs: [] };
	}
}

async function main() {
	if (ONLINE_ONLY) {
		const online = await isOnline();
		if (!online) {
			console.log("未联网或歌单接口不可达，跳过音乐同步");
			return;
		}
	}

	console.log("拉取歌单:", PLAYLIST_ID);
	const res = await fetch(API, { signal: AbortSignal.timeout(20000) });
	if (!res.ok) throw new Error(`歌单请求失败 HTTP ${res.status}`);
	const remote = await res.json();
	if (!Array.isArray(remote) || remote.length === 0) {
		console.error("歌单为空，检查 PLAYLIST_ID 是否正确");
		process.exit(1);
	}
	console.log(`歌单共 ${remote.length} 首`);

	const manifest = readManifest();
	const known = new Map(manifest.songs.map((s) => [s.hash, s]));

	const wanted = [];
	const seen = new Set();
	for (const song of remote) {
		const hash = extractHash(song.url || "");
		if (!hash || seen.has(hash)) continue;
		seen.add(hash);
		wanted.push({ hash, title: song.title || "未知", artist: song.author || "", url: song.url, pic: song.pic });
	}

	// 保护：接口返回异常时绝不能删本地文件。
	// 曾经因为接口返回 1 首假数据，导致 37 首被判定为"已移除"而删除。
	const localCount = manifest.songs.length;
	if (wanted.length === 0) {
		console.error("未解析出任何歌曲，保留本地现状不变");
		process.exit(0);
	}
	if (localCount > 0 && wanted.length < localCount * 0.5) {
		console.error(
			`远程歌单数量异常（远程 ${wanted.length} / 本地 ${localCount}），疑似接口返回异常，保留本地现状不变`,
		);
		process.exit(0);
	}

	const toAdd = [];
	const recovered = [];
	for (const s of wanted) {
		const old = known.get(s.hash);
		if (old) {
			if (old.title !== s.title || old.artist !== s.artist) {
				old.title = s.title;
				old.artist = s.artist;
			}
			continue;
		}
		// 清单丢了但文件还在（换机器、误删清单）：补录，不重复下载
		const file = `${s.hash}.mp3`;
		const dest = path.join(MUSIC_DIR, file);
		let size = 0;
		try {
			size = fs.statSync(dest).size;
		} catch {
			size = 0;
		}
		if (size > 10000) {
			let cover = "";
			const cfile = `cover/${s.hash}.jpg`;
			if (fs.existsSync(path.join(MUSIC_DIR, cfile))) cover = `/music/${cfile}`;
			manifest.songs.push({
				hash: s.hash,
				title: s.title,
				artist: s.artist,
				file,
				cover,
				duration: mp3Duration(fs.readFileSync(dest)),
			});
			recovered.push(s.title);
		} else {
			toAdd.push(s);
		}
	}
	if (recovered.length) {
		console.log(`本地已存在、补录进清单 ${recovered.length} 首（未重复下载）`);
	}
	const toRemove = manifest.songs.filter((s) => !seen.has(s.hash));

	console.log(`\n差异: 新增 ${toAdd.length} 首，移除 ${toRemove.length} 首，保持不变 ${wanted.length - toAdd.length} 首`);
	if (DRY) {
		if (toAdd.length) console.log("\n将要下载:"), toAdd.forEach((s, i) => console.log(`  + ${s.title} — ${s.artist}`));
		if (toRemove.length) console.log("\n将要删除:"), toRemove.forEach((s) => console.log(`  - ${s.title}`));
		console.log("\n(--dry 模式，未做任何改动)");
		return;
	}

	fs.mkdirSync(MUSIC_DIR, { recursive: true });
	fs.mkdirSync(COVER_DIR, { recursive: true });

	let done = 0;
	const tasks = toAdd.slice(0, Number.isFinite(LIMIT) ? LIMIT : toAdd.length);
	for (const s of tasks) {
		const file = `${s.hash}.mp3`;
		const dest = path.join(MUSIC_DIR, file);
		try {
			const buf = await download(s.url);
			fs.writeFileSync(dest, buf);
			const duration = mp3Duration(buf);

			let cover = "";
			if (s.pic) {
				try {
					const cbuf = await download(s.pic, 30000);
					const cfile = `cover/${s.hash}.jpg`;
					fs.writeFileSync(path.join(MUSIC_DIR, cfile), cbuf);
					cover = `/music/${cfile}`;
				} catch (e) {
					console.warn(`  封面失败（忽略）: ${s.title} — ${e.message}`);
				}
			}
			manifest.songs.push({
				hash: s.hash,
				title: s.title,
				artist: s.artist,
				file,
				cover,
				duration,
			});
			done++;
			console.log(`  [${done}/${tasks.length}] ${(buf.length / 1024 / 1024).toFixed(2)} MB  ${s.title} (${duration}s)`);
		} catch (e) {
			console.warn(`  下载失败: ${s.title} — ${e.message}`);
		}
	}

	for (const s of toRemove) {
		for (const rel of [s.file, s.cover.replace(/^\/music\//, "")]) {
			if (!rel) continue;
			try {
				fs.unlinkSync(path.join(MUSIC_DIR, rel));
			} catch {
				/* 文件可能已不存在 */
			}
		}
		console.log(`  已移除: ${s.title}`);
	}
	manifest.songs = manifest.songs.filter((s) => seen.has(s.hash));

	// 按歌单顺序排列
	const order = new Map(wanted.map((s, i) => [s.hash, i]));
	manifest.songs.sort((a, b) => (order.get(a.hash) ?? 999) - (order.get(b.hash) ?? 999));

	fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");

	// 生成播放列表（供 constants.ts 引用）
	const entries = manifest.songs
		.map(
			(s, i) =>
				`\t{\n\t\tid: ${i + 1},\n\t\ttitle: ${JSON.stringify(s.title)},\n\t\tartist: ${JSON.stringify(s.artist)},\n\t\tcover: ${JSON.stringify(s.cover || "/favicon/favicon.ico")},\n\t\turl: ${JSON.stringify(`/music/${s.file}`)},\n\t\tduration: ${s.duration},\n\t}`,
		)
		.join(",\n");
	const ts = `// 由 scripts/sync-music.mjs 自动生成，请勿手动编辑\nimport type { Song } from "./types";\n\nexport const LOCAL_PLAYLIST_GENERATED: Song[] = [\n${entries},\n];\n`;
	fs.writeFileSync(GENERATED, ts, "utf-8");

	const total = manifest.songs.reduce((n, s) => {
		try {
			return n + fs.statSync(path.join(MUSIC_DIR, s.file)).size;
		} catch {
			return n;
		}
	}, 0);
	console.log(`\n完成: 本地共 ${manifest.songs.length} 首，${(total / 1024 / 1024).toFixed(1)} MB`);
	console.log(`清单: public/music/manifest.json`);
	console.log(`列表: src/components/widgets/music-player/localPlaylist.generated.ts`);
}

main().catch((e) => {
	console.error("同步失败:", e.message);
	process.exit(1);
});
