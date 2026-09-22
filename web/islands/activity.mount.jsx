// web/islands/activity.mount.jsx
// 首页活跃度热力图 React Island 的挂载入口。

import { createRoot } from 'react-dom/client';
import { ActivityHeatmap } from './ActivityHeatmap.jsx';

const urlFor = (p) =>
  window.BlogConfig
    ? window.BlogConfig.url(p)
    : '/azur_blog/' + p;

export function mount(container) {
  const root = createRoot(container);

  root.render(
    <ActivityHeatmap
      dataUrl={urlFor('data/activity.json')}
    />
  );

  return {
    unmount() {
      root.unmount();
      container.innerHTML = '';
    },
  };
}
