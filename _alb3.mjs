const base = "https://11408-prog.github.io/azur_blog";

(async () => {
	const r = await fetch(base + "/albums/", { redirect: "follow" });
	const html = await r.text();

	// Grab the album card area: look for the cover.webp img and print surroundings
	const m = html.indexOf("/images/albums/");
	if (m === -1) {
		console.log("no /images/albums/ found");
	} else {
		console.log("=== markup around album cover img ===");
		console.log(html.slice(Math.max(0, m - 1200), m + 700));
	}

	console.log("\n\n=== all href values that are NOT _astro / not http ===");
	const hrefs = [...new Set([...html.matchAll(/href="([^"]+)"/g)].map((x) => x[1]))].filter(
		(h) => !h.includes("_astro") && !h.startsWith("http") && !h.startsWith("#"),
	);
	for (const h of hrefs) console.log("   ", decodeURIComponent(h));
})();
