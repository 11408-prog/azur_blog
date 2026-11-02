const base = "https://11408-prog.github.io/azur_blog";

(async () => {
	const url = base + "/albums/" + encodeURI("碧蓝航线") + "/";
	const r = await fetch(url, { redirect: "follow" });
	const html = await r.text();

	console.log("page status:", r.status, "| final url:", r.url);
	console.log("len:", html.length);

	// every img in the page
	const imgs = [...html.matchAll(/<img[^>]*>/g)].map((m) => m[0]);
	console.log("\ntotal <img> tags:", imgs.length);

	const srcs = imgs
		.map((t) => {
			const m = t.match(/src="([^"]+)"/);
			return m ? m[1] : null;
		})
		.filter(Boolean);

	const uniq = [...new Set(srcs)];
	console.log("unique srcs:", uniq.length);

	// classify
	const albumImgs = uniq.filter((s) => s.includes("/images/albums/"));
	const astroImgs = uniq.filter((s) => s.includes("/_astro/"));
	const other = uniq.filter((s) => !s.includes("/images/albums/") && !s.includes("/_astro/"));

	console.log("\n  /images/albums/ :", albumImgs.length);
	console.log("  /_astro/        :", astroImgs.length);
	console.log("  other           :", other.length, other.slice(0, 5));

	console.log("\n=== album image refs (first 6) ===");
	for (const s of albumImgs.slice(0, 6)) console.log("   ", decodeURIComponent(s));

	console.log("\n=== probing album image refs ===");
	for (const s of albumImgs.slice(0, 6)) {
		const abs = s.startsWith("http") ? s : "https://11408-prog.github.io" + s;
		try {
			const hr = await fetch(abs, { method: "HEAD" });
			console.log("   ", hr.status, hr.headers.get("content-type"), decodeURIComponent(s).slice(0, 65));
		} catch (e) {
			console.log("    ERR", e.message.slice(0, 50));
		}
	}

	// Is the photo grid even rendered?
	console.log("\n=== does the page contain the photo grid markup? ===");
	for (const kw of ["PhotoCard", "photo", "grid", "photos"]) {
		console.log(`  ${kw}: ${(html.match(new RegExp(kw, "g")) || []).length}`);
	}
})();
