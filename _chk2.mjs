const base = "https://11408-prog.github.io/azur_blog";

async function get(p) {
	const r = await fetch(base + p, { redirect: "follow" });
	return { code: r.status, body: r.ok ? await r.text() : "" };
}

(async () => {
	console.log("=== /albums/ listing ===");
	const a = await get("/albums/");
	console.log("status:", a.code, "len:", a.body.length);
	const links = [...new Set([...a.body.matchAll(/href="(\/azur_blog\/albums\/[^"]+)"/g)].map((m) => m[1]))];
	console.log("album links:", links);
	const imgs = [...new Set([...a.body.matchAll(/src="([^"]*albums[^"]*)"/g)].map((m) => m[1]))];
	console.log("album imgs:", imgs.slice(0, 8));

	console.log("\n=== album detail pages ===");
	for (const l of links.slice(0, 3)) {
		const d = await get(l.replace("/azur_blog", ""));
		console.log(d.code, decodeURIComponent(l), "len=" + d.body.length);
		if (d.code !== 200) console.log("   body:", d.body.slice(0, 200).replace(/\s+/g, " "));
		else {
			const ph = [...new Set([...d.body.matchAll(/src="([^"]*albums[^"]*)"/g)].map((m) => m[1]))];
			console.log("   photos:", ph.length, ph.slice(0, 3));
			const cover = [...new Set([...d.body.matchAll(/src="([^"]*cover[^"]*)"/g)].map((m) => m[1]))];
			console.log("   cover:", cover.slice(0, 2));
		}
	}

	console.log("\n=== music player cover refs ===");
	const m = await get("/music/");
	const mc = [...new Set([...m.body.matchAll(/(\/music\/cover\/[^"'\\ ]+)/g)].map((x) => x[1]))];
	console.log("cover refs on music page:", mc.length, mc.slice(0, 3));

	console.log("\n=== direct album image probes ===");
	for (const p of [
		"/images/albums/碧蓝航线/cover.webp",
		"/images/albums/立希和立希喜欢的人/cover.webp",
	]) {
		const r = await fetch(base + encodeURI(p), { method: "HEAD" });
		console.log(r.status, r.headers.get("content-type"), p);
	}
})();
