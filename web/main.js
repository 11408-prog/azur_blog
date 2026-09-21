// web/main.js — React 岛入口（体积很小：不包含 React，也没有任何静态 import 的外部文件）
// 构建：npm run build:web → source/js/dist/app.js + source/js/dist/islands/*.js
//
// 新增一个岛：写 web/islands/xxx.mount.jsx（导出 mount），在 web/build.mjs 的 ISLANDS 里登记，
// 然后在这里 registerIsland 一行。
import { registerIsland } from './lib/island.js';

// __ISLANDS__ 由 web/build.mjs 在打包入口时注入：{ 岛名字: 打包后的相对路径（带内容哈希） }。
// 岛的文件名带哈希，所以入口里必须写明确切路径——入口本身用 ?v= 版本号防缓存。
// 用 new URL(相对路径, import.meta.url) 保证不管站点 root 是什么，都相对 app.js 自己所在的目录。
const islandUrl = (name) => new URL(__ISLANDS__[name], import.meta.url).href;

registerIsland('react-tags', {
  // 标签页（source/tags/index.md，type: tags）：Hexo 输出的静态标签云
  find: () => document.querySelector('#page .tag-cloud-list'),
  load: () => import(islandUrl('tags')),
});
