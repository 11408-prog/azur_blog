const base = "https://11408-prog.github.io/azur_blog";

async function get(p) {
	const r = await fetch(base + p, { redirect: "follow" });
	const body = r.ok ? await r.text() : "";
	return { code: r.status, body, url: r.url };
}

(async () => {
	console.log("=== /albums/ listing ===");
	const a = await get("/albums/");
	console.log("status:", a.code, "len:", a.body.length);

	const links = [...new Set([...a.body.matchAll(/href="(\/azur_blog\/albums\/[^"]+)"/g)].map((m) => m[1]))];
	console.log("album links:", links);

	// cover srcs actually in the markup
	const imgs = [...new Set([...a.body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
	console.log("\nimg srcs on listing (first 10):");
	for (const s of imgs.slice(0, 10)) console.log("   ", s);

	console.log("\n=== album detail: 碧蓝航线 ===");
	const d = await get("/albums/" + encodeURI("碧蓝航线") + "/");
	console.log("status:", d.code, "len:", d.body.length);

	if (d.code !== 200) {
		console.log("body head:", d.body.slice(0, 400).replace(/\s+/g, " "));
	} else {
		const ph = [...new Set([...d.body.matchAll(/<img[^>]+src="([^"]+)"/g)].map((m) => m[1]))];
		console.log("photo srcs (first 5):");
		for (const s of ph.slice(0, 5)) console.log("   ", decodeURIComponent(s));
		// probe them
		console.log("\nprobing photo srcs:");
		for (const s of ph.slice(0, 3)) {
			const abs = s.startsWith("http") ? s : "https://11408-prog.github.io" + s;
			const r = await fetch(abs, { method: "HEAD" });
			console.log("   ", r.status, decodeURIComponent(s).slice(0, 70));
		}
	}

	console.log("\n=== direct cover probe ===");
	for (const p of ["/images/albums/碧蓝航线/cover.webp", "/images/albums/立希和立希喜欢的人/cover.webp"]) {
		const r = await fetch(base + encodeURI(p), { method: "HEAD" });
		console.log("  based:", r.status, decodeURIComponent(p));
		const r2 = await fetch("https://11408-prog.github.io" + encodeURI(p), { method: "HEAD" });
		console.log("  root :", r2.status, decodeURIComponent(p));
	}
})();
