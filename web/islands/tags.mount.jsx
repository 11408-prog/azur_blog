// web/islands/tags.mount.jsx — 标签页岛的挂载入口（被 web/main.js 动态加载）
// 导出 mount(cloud) → { unmount() }，约定见 web/lib/island.js。
//
// 渐进增强：
//   - Hexo 生成的静态标签云（.tag-cloud-list）保持原样；React 应用挂在它前面的新容器里
//   - 只有数据加载成功、React 真正渲染出内容之后，才隐藏静态标签云（TagsExplorer 的 onReady）
//   - 因此没有 JS / 加载失败 / 爬虫，看到的都是原来的静态页面
import { createRoot } from 'react-dom/client';
import { TagsExplorer } from './TagsExplorer.jsx';

const urlFor = (p) => (window.BlogConfig ? window.BlogConfig.url(p) : '/azur_blog/' + p);

export function mount(cloud) {
  const container = document.createElement('div');
  container.id = 'tags-app';
  cloud.parentNode.insertBefore(container, cloud);

  const root = createRoot(container);
  root.render(
    <TagsExplorer
      dataUrl={urlFor('data/tags.json')}
      urlFor={urlFor}
      onReady={() => { cloud.style.display = 'none'; }}
    />
  );

  return {
    unmount() {
      root.unmount();
      container.remove();
      cloud.style.display = '';
    },
  };
}
