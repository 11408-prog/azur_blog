const base = "https://11408-prog.github.io/azur_blog";

async function head(url) {
	try {
		const r = await fetch(url, { method: "HEAD", redirect: "follow" });
		return r.status;
	} catch (e) {
		return "ERR:" + e.message.slice(0, 40);
	}
}

(async () => {
	// Pull the homepage and find real asset URLs it references.
	const home = await (await fetch(base + "/")).text();
	const css = [...home.matchAll(/href="(\/azur_blog\/_astro\/[^"]+\.css)"/g)].map((m) => m[1]);
	const js = [...home.matchAll(/src="(\/azur_blog\/_astro\/[^"]+\.js)"/g)].map((m) => m[1]);
	const img = [...home.matchAll(/src="(\/azur_blog\/[^"]+\.(?:webp|jpg|png))"/g)].map((m) => m[1]);

	console.log("=== critical assets ===");
	for (const p of [...new Set([...css.slice(0, 2), ...js.slice(0, 2), ...img.slice(0, 2)])]) {
		console.log(await head(base + p.replace("/azur_blog", "")), p.slice(0, 80));
	}

	console.log("\n=== nojekyll check (underscore dir must be served) ===");
	console.log(await head(base + "/_astro/"), "<- any _astro dir entry");

	// Sample post pages from archive.
	const arch = await (await fetch(base + "/archive/")).text();
	const posts = [...arch.matchAll(/href="(\/azur_blog\/posts\/[^"]+)"/g)].map((m) => m[1]);
	const uniq = [...new Set(posts)];
	console.log("\n=== sample post pages (" + uniq.length + " links on archive) ===");
	for (const p of uniq.slice(0, 4)) {
		try {
			const r = await fetch(base + p.replace("/azur_blog", ""), { redirect: "follow" });
			const t = r.ok ? await r.text() : "";
			const title = (t.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
			const imgs = (t.match(/<img/g) || []).length;
			console.log(r.status, decodeURIComponent(p).slice(0, 60), "| imgs=" + imgs, "|", title.slice(0, 30));
		} catch (e) {
			console.log("ERR", p, e.message);
		}
	}

	console.log("\n=== music ===");
	console.log(await head(base + "/music/"), "music dir");
	const playlist = await (await fetch(base + "/music/")).text().catch(() => "");
	console.log("playlist len:", playlist.length);
})();
