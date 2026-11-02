const base = "https://11408-prog.github.io/azur_blog";

async function stat(url) {
	try {
		const r = await fetch(url, { redirect: "follow" });
		return { code: r.status, len: r.ok ? (await r.arrayBuffer()).byteLength : 0 };
	} catch (e) {
		return { code: "ERR", len: 0, msg: e.message.slice(0, 40) };
	}
}

(async () => {
	// sitemap lists every page that was actually built
	console.log("=== sitemap ===");
	const sm = await (await fetch(base + "/sitemap-0.xml")).text().catch(() => "");
	if (!sm) {
		const idx = await (await fetch(base + "/sitemap-index.xml")).text();
		console.log("index:", idx.slice(0, 300));
	}
	const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	console.log("total urls in sitemap:", locs.length);

	const posts = locs.filter((u) => u.includes("/posts/"));
	console.log("post urls:", posts.length);

	console.log("\n=== sample posts ===");
	for (const p of posts.slice(0, 5)) {
		const s = await stat(p);
		const enc = decodeURIComponent(p.replace(base, ""));
		console.log(s.code, s.len + "B", enc.slice(0, 70));
	}

	console.log("\n=== music files ===");
	// pull a real mp3 name out of the player's generated playlist
	const pl = await (await fetch(base + "/music/")).text();
	const mp3 = [...new Set([...pl.matchAll(/\/music\/([A-F0-9]{32}\.mp3)/g)].map((m) => m[1]))];
	console.log("mp3 refs found in player page:", mp3.length);
	for (const m of mp3.slice(0, 3)) {
		const s = await stat(base + "/music/" + m);
		console.log(s.code, (s.len / 1024 / 1024).toFixed(1) + " MB", m);
	}

	console.log("\n=== covers ===");
	const cov = [...new Set([...pl.matchAll(/\/music\/cover\/([^"']+\.(?:webp|jpg))/g)].map((m) => m[1]))];
	for (const c of cov.slice(0, 2)) {
		const s = await stat(base + "/music/cover/" + c);
		console.log(s.code, s.len + "B", c);
	}
})();
