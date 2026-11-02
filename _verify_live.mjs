const base = "https://11408-prog.github.io/azur_blog";
const urls = [
	base + "/",
	base + "/posts/",
	base + "/albums/",
	base + "/archive/",
	base + "/about/",
	base + "/ai-tools/",
	base + "/friends/",
];

(async () => {
	console.log("=== page checks ===");
	for (const u of urls) {
		try {
			const r = await fetch(u, { redirect: "follow" });
			const txt = r.ok ? await r.text() : "";
			const based = (txt.match(/\/azur_blog\/_astro\//g) || []).length;
			const bare = (txt.match(/(?:href|src)="\/_astro\//g) || []).length;
			const title = (txt.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
			const nojek = txt.length;
			console.log(
				`${r.status} ${u.replace(base, "") || "/"} | base=${based} bare=${bare} len=${nojek} | ${title.slice(0, 40)}`,
			);
		} catch (e) {
			console.log("ERR", u, e.message);
		}
	}
})();
