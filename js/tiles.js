/* 首页磁贴：学习 / 生活 / 热爱 */
(function () {
  'use strict';

  function init() {
    var recentPosts = document.getElementById('recent-posts');
    if (!recentPosts) return;

    // 用 data 属性防重复，不受之前手动测试影响
    if (recentPosts.dataset.tilesInserted) return;

    var carousel = recentPosts.querySelector('.carousel');
    var tiles = buildTiles();

    if (carousel) {
      // 有轮播图 → 插到它后面
      carousel.insertAdjacentElement('afterend', tiles);
    } else {
      // 兜底：插到最前面
      recentPosts.insertBefore(tiles, recentPosts.firstChild);
    }

    recentPosts.dataset.tilesInserted = 'true';
  }

  function buildTiles() {
    var grid = document.createElement('div');
    grid.className = 'tiles-grid';

    var items = [
{ icon: '📚', title: '学习', desc: '记录技术成长', bg: '/azur_blog/img/study.jpg', link: '#' },
{ icon: '☕', title: '生活', desc: '日常点滴', bg: '/azur_blog/img/life.jpg', link: '#' },
{ icon: '⚓', title: '热爱', desc: '碧蓝航线与企业', bg: '/azur_blog/img/love.jpg', link: '#' }   ];

    items.forEach(function (item) {
      var el = document.createElement('a');
      el.href = item.link;
      el.className = 'tile';

      var bg = document.createElement('div');
      bg.className = 'tile-bg';
      bg.style.backgroundImage = 'url("' + item.bg + '")';

      var mask = document.createElement('div');
      mask.className = 'tile-mask';

      var icon = document.createElement('div');
      icon.className = 'tile-icon';
      icon.textContent = item.icon;

      var title = document.createElement('div');
      title.className = 'tile-title';
      title.textContent = item.title;

      var desc = document.createElement('div');
      desc.className = 'tile-desc';
      desc.textContent = item.desc;

      el.appendChild(bg);
      el.appendChild(mask);
      el.appendChild(icon);
      el.appendChild(title);
      el.appendChild(desc);
      grid.appendChild(el);
    });

    return grid;
  }

  // 轮询等待轮播图出现，最多 3 秒
  var attempts = 0;
  var maxAttempts = 30;
  var interval = setInterval(function () {
    attempts++;
    var recentPosts = document.getElementById('recent-posts');
    if (recentPosts && recentPosts.querySelector('.carousel')) {
      clearInterval(interval);
      init();
    } else if (attempts >= maxAttempts) {
      clearInterval(interval);
      init(); // 兜底：即使没有轮播图也插入
    }
  }, 100);

})();