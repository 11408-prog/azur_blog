// web/main.js — React 岛入口
// 构建：npm run build:web → source/js/dist/app.js + source/js/dist/islands/*.js
//
// 这里不静态 import React / ReactDOM。
// 只有当前页面存在对应挂载点时，才会动态加载对应 React Island。

import { registerIsland } from './lib/island.js';

// __ISLANDS__ 由 web/build.mjs 在打包入口时注入：
// {
//   tags: 'islands/tags-xxxxx.js',
//   gallery: 'islands/gallery-xxxxx.js'
// }
const islandUrl = (name) =>
  new URL(__ISLANDS__[name], import.meta.url).href;

// 标签页：Hexo 生成的静态标签云作为渐进增强的基础内容。
registerIsland('react-tags', {
  find: () =>
    document.querySelector('#page .tag-cloud-list'),
  load: () => import(islandUrl('tags')),
});

// 画廊页：#masonry-gallery 作为 React Island 挂载点。
registerIsland('react-gallery', {
  find: () =>
    document.querySelector('#masonry-gallery'),
  load: () => import(islandUrl('gallery')),
});
