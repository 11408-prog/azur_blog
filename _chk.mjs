const url = "https://11408-prog.github.io/azur_blog/";

(async () => {
	const h = await (await fetch(url)).text();

	// The h1 sits inside the banner; print from the second occurrence of banner-title.
	const idxs = [];
	let p = 0;
	while ((p = h.indexOf("banner-title", p)) !== -1) {
		idxs.push(p);
		p += 12;
	}
	console.log("banner-title occurrences:", idxs.length);

	const start = idxs[idxs.length - 1] ?? 0;
	console.log("\n=== from last banner-title ===");
	console.log(h.slice(start - 300, start + 1500));
})();
