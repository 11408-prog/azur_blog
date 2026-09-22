// web/islands/gallery.mount.jsx
// 画廊 React Island 的挂载入口
//
// 挂载点：source/gallery/index.md 中的 #masonry-gallery
// 生命周期：由 web/lib/island.js + BlogLifecycle 管理

import { createRoot } from 'react-dom/client';
import { GalleryExplorer } from './GalleryExplorer.jsx';

const urlFor = (p) =>
  window.BlogConfig
    ? window.BlogConfig.url(p)
    : '/azur_blog/' + p;

export function mount(container) {
  const root = createRoot(container);

  root.render(
    <GalleryExplorer
      dataUrl={urlFor('gallery.json')}
    />
  );

  return {
    unmount() {
      root.unmount();
      container.innerHTML = '';
    },
  };
}
