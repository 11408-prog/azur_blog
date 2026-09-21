// web/lib/island.js — 「岛」注册助手（不依赖 React）
// ------------------------------------------------------------
// 为什么这个文件不 import React：
//   inject.bottom 是全站加载的，入口文件里每多一个依赖，所有页面都要为它付体积。
//   所以入口只做一件很轻的事——判断「当前页面有没有这个岛的挂载点」；
//   有，才用动态 import() 去加载 React 和组件（esbuild 会把它们拆成独立的 chunk）。
//
// 与 BlogLifecycle 的配合：
//   - PJAX 会整体替换 #body-wrap，所以每次页面切换都是 destroy → mount
//   - destroy 时卸载 React root，不会遗留旧的 root（不泄漏、不重复渲染）
//   - 用 generation 计数处理竞态：chunk 还在下载时用户已经切走页面，
//     晚到的加载结果会被丢弃，不会往已经不存在的页面里挂载
//
// 用法（见 web/main.js）：
//   registerIsland('名字', {
//     find: () => document.querySelector('...'),        // 返回挂载点；没有就返回 null
//     load: () => import('./islands/xxx.mount.jsx'),    // 该模块必须导出 mount(target) → { unmount() }
//   });
export function registerIsland(name, { find, load }) {
  const lifecycle = window.BlogLifecycle;
  if (!lifecycle) {
    // 与其他模块一致：BlogLifecycle 缺失说明 inject 顺序有问题，要显式报出来而不是静默失效
    if (window.DSLog) window.DSLog.error('Island', 'BlogLifecycle 不可用，岛屿未注册: ' + name);
    return;
  }

  let handle = null;
  let generation = 0;

  lifecycle.register(name, {
    mount() {
      const target = find();
      if (!target) return;

      const mine = ++generation;
      load()
        .then((mod) => {
          if (mine !== generation) return;   // 加载期间已经切走页面 / 已被重新挂载
          handle = mod.mount(target);
          if (window.DSLog) window.DSLog.info('Island', '已挂载: ' + name);
        })
        .catch((err) => {
          if (window.DSLog) window.DSLog.error('Island', '加载失败: ' + name, { message: err && err.message });
        });
    },

    destroy() {
      generation++;
      if (handle) {
        handle.unmount();
        handle = null;
      }
    },
  });
}
