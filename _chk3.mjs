const base = "https://11408-prog.github.io/azur_blog";

(async () => {
	console.log("=== rendered <script src> that are NOT _astro bundles ===");
	for (const p of ["/ai-tools/", "/friends/", "/albums/", "/diary/"]) {
		const h = await (await fetch(base + p)).text();
		const srcs = [...h.matchAll(/<script[^>]+src="([^"]+\.js)"/g)]
			.map((m) => m[1])
			.filter((s) => !s.includes("_astro"));
		console.log(p, "->", srcs);
	}

	console.log("\n=== inline image/album refs on /albums/ ===");
	const a = await (await fetch(base + "/albums/")).text();
	const covers = [...new Set([...a.matchAll(/src="([^"]*albums[^"]*)"/g)].map((m) => m[1]))];
	console.log("covers:", covers);
	for (const c of covers) {
		if (!c.startsWith("http")) {
			const r = await fetch("https://11408-prog.github.io" + encodeURI(c), { method: "HEAD" });
			console.log("  ", r.status, c);
		}
	}

	console.log("\n=== album detail photo refs ===");
	const d = await (await fetch(base + "/albums/" + encodeURI("碧蓝航线") + "/")).text();
	const ph = [...new Set([...d.matchAll(/src="([^"]*albums[^"]*)"/g)].map((m) => m[1]))];
	console.log("sample:", ph.slice(0, 4));
	for (const c of ph.slice(0, 3)) {
		if (!c.startsWith("http")) {
			const r = await fetch("https://11408-prog.github.io" + encodeURI(c), { method: "HEAD" });
			console.log("  ", r.status, decodeURIComponent(c).slice(0, 60));
		}
	}
})();
