// web/main.js — React 岛入口

import { registerIsland } from './lib/island.js';

const islandUrl = (name) =>
  new URL(__ISLANDS__[name], import.meta.url).href;

function ensureActivityContainer() {
  let container = document.getElementById('home-heatmap');

  if (container) {
    return container;
  }

  const recentPosts =
    document.getElementById('recent-posts');

  if (!recentPosts) {
    return null;
  }

  container = document.createElement('div');
  container.id = 'home-heatmap';

  recentPosts.insertBefore(
    container,
    recentPosts.firstChild
  );

  return container;
}

registerIsland('react-tags', {
  find: () =>
    document.querySelector(
      '#page .tag-cloud-list'
    ),
  load: () =>
    import(islandUrl('tags')),
});

registerIsland('react-gallery', {
  find: () =>
    document.querySelector(
      '#masonry-gallery'
    ),
  load: () =>
    import(islandUrl('gallery')),
});

registerIsland('react-activity', {
  find: ensureActivityContainer,
  load: () =>
    import(islandUrl('activity')),
});
