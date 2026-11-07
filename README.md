# azur_blog

「Ghost」的个人博客，基于 [Mizuki](https://github.com/LyraVoid/Mizuki)（Astro 静态博客模板）定制，部署在 GitHub Pages。

**在线访问：<https://11408-prog.github.io/azur_blog/>**

## 技术栈

| 项 | 说明 |
| --- | --- |
| 框架 | [Astro](https://astro.build) 7（静态输出） |
| UI | Svelte 5 + Tailwind CSS 4 + TypeScript |
| 内容 | Markdown / MDX，Astro 内容集合 |
| 搜索 | [Pagefind](https://pagefind.app)（构建后生成索引） |
| 页面切换 | Swup（无刷新过渡） |
| 代码规范 | Biome |
| 包管理器 | **pnpm**（`preinstall` 会拦截 npm / yarn） |

## 内容与功能

- 文章按目录分类：技术笔记（Java、Linux、Python）、课程笔记、投资、同人文等
- 加密文章：客户端 AES-256-GCM 解密，访问需要输入密码
- 数学公式（KaTeX）、Mermaid / PlantUML 图表、代码块增强（行号、折叠、复制）
- 日记、友链、相册、归档、关于等页面
- RSS / Atom 订阅、站点地图、OG 图片
- 背景音乐播放器、看板娘（Live2D）、深浅色与主题色切换
- 评论（Twikoo / Giscus，当前关闭）

各功能页面的开关集中在 `src/config/siteConfig.ts` 的 `featurePages`。

## 快速开始

需要 Node.js 20 或更高版本，以及 pnpm 11。

```bash
git clone https://github.com/11408-prog/azur_blog.git
cd azur_blog
pnpm install
ENABLE_CONTENT_SYNC=false pnpm dev      # http://localhost:3000
```

> PowerShell 不支持 `VAR=value command` 写法，请先单独执行 `$env:ENABLE_CONTENT_SYNC="false"`。
> 没有使用独立内容仓库时，建议始终设置 `ENABLE_CONTENT_SYNC=false`，否则 `predev` / `prebuild` 会尝试联网同步内容。

## 常用命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 本地开发，端口 3000 |
| `pnpm build` | 构建到 `dist/`（含样式、字体加载检查与 Pagefind 索引） |
| `pnpm preview` | 预览构建产物 |
| `pnpm check` / `pnpm type-check` | Astro 与 TypeScript 类型检查 |
| `pnpm test` | 运行测试 |
| `pnpm lint` / `pnpm format` | Biome 检查与格式化（作用于 `src/`） |
| `pnpm new-post` | 新建文章 |
| `pnpm sync-music` | 同步音乐文件 |

Windows 上也可以直接双击 `start-site.bat`，它会自动完成"清理 → 构建 → 校验 → 启动预览 → 打开浏览器"。构建产物不能用 `file://` 直接打开，必须通过 HTTP 访问。

## 目录结构

```
├── astro.config.mjs        Astro 与 Markdown 插件配置
├── src/
│   ├── config/             站点、导航、侧栏、评论、音乐等配置
│   ├── content/
│   │   ├── posts/          文章（按目录分类）
│   │   └── spec/           关于、友链等单页内容
│   ├── pages/              路由页面
│   ├── components/         Astro / Svelte 组件
│   ├── plugins/            自定义 remark / rehype 插件
│   └── utils/              工具函数（含文章加密）
├── public/                 静态资源（图片、字体、音乐、Live2D 模型）
├── scripts/                构建前后脚本（内容同步、字体、索引提交等）
├── tests/                  测试
├── docs/                   模板文档（内容编写、渲染、部署等）
├── deploy-pages.ps1        部署脚本（构建并推送到 gh-pages）
├── deploy.bat              部署脚本的双击入口
└── auto-deploy.cmd         一键部署并提交源码
```

## 写文章

```bash
pnpm new-post
```

文章放在 `src/content/posts/`，可以按目录组织分类。front matter 字段、加密文章、图片与链接写法详见 [`docs/CONTENT_AUTHORING.zh.md`](./docs/CONTENT_AUTHORING.zh.md)。

## 部署

站点发布在 GitHub Pages，访问路径带有 `/azur_blog` 前缀，`base` 会由 `siteConfig.siteURL` 自动推导。

本地部署（Windows）：

1. 在 <https://github.com/settings/tokens> 创建一个具有 `repo` 权限的 token
2. 把 token 单独放进项目根目录的 `.deploy-token` 文件（已被 `.gitignore` 忽略，**不要提交**）
3. 双击 `deploy.bat`，或运行 `auto-deploy.cmd` 同时提交并推送源码

脚本会构建站点，补上 `.nojekyll`，再把 `dist/` 的内容强制推送到 `gh-pages` 分支。该分支每次都会被完整重建，请不要在上面手动改动。

完整的流程、踩坑记录和排障方法见 [`部署守则.md`](./部署守则.md)，日常维护说明见 [`开发守则.md`](./开发守则.md)。

## 环境变量

复制 `.env.example` 为 `.env` 后按需填写。涉及密钥的变量（例如 `BILI_SESSDATA`）只通过环境变量传入，**不要写进代码或提交到仓库**。

## 致谢与许可

- [Mizuki](https://github.com/LyraVoid/Mizuki)：本站基于该模板修改
- 部分插件改编自 [Firefly](https://github.com/CuteLeaf/Firefly)，其余第三方内容见 [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md)

代码遵循 [Apache-2.0](./LICENSE) 许可。文章内容、图片和音乐的版权归各自作者所有，请勿未经许可转载或二次分发。
