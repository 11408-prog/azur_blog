import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const distDirectory = path.join(projectRoot, "dist");

function getAttribute(tag, name) {
	const match = tag.match(
		new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
	);
	return match?.[1] ?? match?.[2] ?? match?.[3];
}

// 站点部署在子路径（例如 /azur_blog/）时，HTML 里的链接带有 base 前缀，
// 但构建产物直接放在 dist/ 根目录，所以要逐级去掉开头的路径段来定位真实文件。
// 一直找不到时返回原始路径，让后面的 readFile 照常报出缺失文件的错误。
function resolveStylesheetPath(pathname) {
	const segments = (pathname.startsWith("/") ? pathname.slice(1) : pathname)
		.split("/")
		.filter(Boolean);
	for (let skip = 0; skip < segments.length; skip++) {
		const candidate = path.resolve(distDirectory, ...segments.slice(skip));
		if (existsSync(candidate)) return candidate;
	}
	return path.resolve(distDirectory, ...segments);
}

async function loadPageStyles(htmlPath) {
	const html = await readFile(path.join(distDirectory, htmlPath), "utf8");
	const stylesheetUrls = [...html.matchAll(/<link\b[^>]*>/gi)]
		.map(([tag]) => ({
			href: getAttribute(tag, "href"),
			rel: getAttribute(tag, "rel"),
		}))
		.filter(
			({ href, rel }) =>
				href && rel?.split(/\s+/).some((value) => value === "stylesheet"),
		)
		.map(({ href }) => href);

	const inlineStyles = [
		...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
	]
		.map((match) => match[1])
		.join("\n");

	const linkedStyles = await Promise.all(
		stylesheetUrls.map(async (stylesheetUrl) => {
			const pathname = decodeURIComponent(stylesheetUrl.split(/[?#]/, 1)[0]);
			if (
				/^(?:[a-z]+:)?\/\//i.test(pathname) ||
				pathname.startsWith("data:")
			) {
				return "";
			}

			const assetPath = resolveStylesheetPath(pathname);
			const relativePath = path.relative(distDirectory, assetPath);
			if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
				throw new Error(
					`Stylesheet escapes dist directory: ${stylesheetUrl}`,
				);
			}

			return readFile(assetPath, "utf8");
		}),
	);

	return {
		html,
		loadedCss: `${inlineStyles}\n${linkedStyles.join("\n")}`,
		stylesheetUrls,
	};
}

// 关于页只有在源文件里真的写了 ::github{repo="..."} 卡片时，才要求渲染出卡片标记。
// 否则换掉模板示例内容的站点会被这条检查误伤。样式规则仍然始终要求加载。
const aboutSource = await readFile(
	path.join(projectRoot, "src/content/spec/about.md"),
	"utf8",
).catch(() => "");
const aboutHasGithubCard = /^::github\{/m.test(aboutSource);

const pages = [
	{
		name: "Homepage",
		htmlPath: "index.html",
		requiredMarkup: [],
		requiredRules: [
			["--page-bg:", "page background variable"],
			["--card-bg:", "card background variable"],
			["--radius-large:", "shared radius variable"],
			["#banner-carousel", "banner layout styles"],
			[".widget-container", "responsive widget styles"],
		],
	},
	{
		name: "About page",
		htmlPath: "about/index.html",
		requiredMarkup: aboutHasGithubCard
			? [["card-github", "rendered GitHub repository card"]]
			: [],
		requiredRules: [
			[".card-github", "GitHub repository card styles"],
			[".custom-md .image-grid", "extended Markdown layout styles"],
		],
	},
];

for (const page of pages) {
	const { html, loadedCss, stylesheetUrls } = await loadPageStyles(page.htmlPath);
	const missingMarkup = page.requiredMarkup
		.filter(([token]) => !html.includes(token))
		.map(([, description]) => description);
	const missingRules = page.requiredRules
		.filter(([token]) => !loadedCss.includes(token))
		.map(([, description]) => description);

	if (missingMarkup.length > 0 || missingRules.length > 0) {
		const loadedStylesheets = stylesheetUrls.join(", ") || "none";
		const missing = [
			...missingMarkup.map((description) => `${description} markup`),
			...missingRules,
		];
		throw new Error(
			`${page.name} is missing: ${missing.join(", ")}. ` +
				`Loaded stylesheets: ${loadedStylesheets}`,
		);
	}

	console.log(
		`Verified ${page.name.toLowerCase()} styles across ` +
			`${stylesheetUrls.length} linked stylesheet(s).`,
	);
}
