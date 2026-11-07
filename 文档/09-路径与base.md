# 09 路径与 base：手写的根路径必须过 `withBase()`

站点部署在子路径 `/azur_blog/` 下，所以所有站内路径都要带上这个前缀。

## 问题是什么

**Astro 只自动处理它自己管的路径**：`_astro` 产物、`<Image>` 优化图、以及你主动调用 `withBase()` 的地方。
凡是**代码里手写的 `"/xxx"` 字符串**，Astro 一律原样输出，**不会加 base**。

后果：本地 dev 完全正常（dev 时 base 和根路径等价），**一上线全 404**。首次上线时实际翻车的清单：

| 出问题的东西 | 位置 | 线上表现 |
| --- | --- | --- |
| 横幅标题和打字机全不显示 | `MainGridLayout.astro` 的 `isHomePage` | 子路径下 `pathname` 是 `/azur_blog/` 而不是 `/`，首页判定失败，文字层带 `hidden` |
| 导航栏首页高亮失效 | `Navbar.astro` 同样的判断 | 首页不高亮 |
| 相册封面和所有照片 404 | `utils/album-scanner.ts` 写死 `/images/albums/...` | 详情页满屏破图 |
| 音乐播放器封面不显示 | `music-player/constants.ts` 只给 `url` 加了 base，漏了 `cover` | 封面空白 |
| 页面内联脚本 404 | 多个 `pages/*.astro` 里的 `<script src="/js/...">` | 筛选标签、友链交互失效 |
| 404 页"返回首页"跳错 | `pages/404.astro` 的 `href="/"` | 点到域名根 |
| 相册返回按钮 | `albums/[id]/index.astro` 的 `href="/albums/"` | 404 |
| 看板娘 iframe | `features/pio/Pio.astro` | 空白。现已改用 `BASE_URL` 拼接路径（当前 `enable: false`，未在线上暴露过） |

## 规矩

**1. 任何以 `/` 开头的站内路径，一律套 `withBase()`**，别直接写字符串：

```ts
// ✗ 错的：线上 404
const cover = `/images/albums/${name}/cover.webp`;

// ✓ 对的
import { withBase } from "../config";
const cover = withBase(`/images/albums/${name}/cover.webp`);
```

`withBase` 定义在 `src/config/siteConfig.ts`，并已从 `src/config/index.ts` 重新导出。

**2. 判断"是不是首页 / 某个路由"时，先剥掉 base 前缀再比**：

```ts
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const rel = p.startsWith(BASE) ? p.slice(BASE.length) || "/" : p;
const isHome = rel === "/";
```

**3. `.astro` 里 `is:inline` 的 script 属性用表达式**，因为 `is:inline` 不经过 Astro 处理，必须显式传：

```astro
<script is:inline src={withBase("/js/x.js")}></script>
```

**4. 自查**：

```bash
grep -rnE '(href|src|action)="/[a-zA-Z]' src --include=*.astro | grep -v withBase
```

## 当前还没改的地方

2026-11-05 自查，下面 4 个页面里的 `<script is:inline src="/js/...">` 还是手写的根路径：

| 文件 | 脚本 |
| --- | --- |
| `src/pages/skills.astro` | `/js/filter-tabs-handler.js` |
| `src/pages/projects.astro` | `/js/filter-tabs-handler.js` |
| `src/pages/timeline.astro` | `/js/filter-tabs-handler.js` |
| `src/pages/devices.astro` | `/js/devices-page-handler.js` |

它们对应的功能页**目前都关着**（见 [02](./02-项目结构与配置速查.md)），所以线上没有暴露。**启用其中任何一个之前，先改成 `src={withBase("/js/...")}`**。

## 为什么文章里的图片不用管

Markdown 正文里的 `/img/xxx.png` 会自动被打成 `/azur_blog/_astro/xxx.webp`：只要图片存在于 `src/assets/public/` 的影子目录里（见 [04](./04-图标图片与横幅.md)），就会走 Astro 的图片优化通道，路径由 Astro 生成，自动带 base。2026-11-02 实测全站 html 里**没有**裸的 `/img/` 引用。

## `_redirects` 在 GitHub Pages 上无效

旧站 `gh-pages` 里那份 `/azur_blog/* /:splat 200` 是 Cloudflare Pages / Netlify 的语法，**GitHub Pages 完全不读这个文件**。
所以"旧链接重定向"在本项目只能靠**生成 HTML 跳转页**来实现，不要指望 `_redirects`。这项仍是待办，见 [11](./11-迁移记录与待办.md)。
