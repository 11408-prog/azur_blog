/* 轮播图（画廊页）+ 首页磁贴 */
(function () {
  'use strict';

  // 路径统一由 BlogConfig 派生（见 blog-config.js），不硬编码 /azur_blog/
  function u(p) {
    return window.BlogConfig ? window.BlogConfig.url(p) : '/azur_blog/' + p;
  }

  function init() {
    // 画廊页：渲染轮播到 #gallery-carousel
    var galleryBox = document.getElementById('gallery-carousel');
    if (galleryBox) {
      renderCarouselInto(galleryBox);
      return;
    }

    // 首页：只插入磁贴（轮播已移到画廊页）
    var recentPosts = document.getElementById('recent-posts');
    if (!recentPosts) return;
    insertTiles(recentPosts);
  }

  function renderCarouselInto(container) {
    // 清理旧的（防止 PJAX 切换后重复）
    var old = container.querySelector('.carousel');
    if (old) old.remove();

    fetch(u('carousel-list.json'))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var imgs = (data && data.images) || [];
        DSLog.info('Carousel', '轮播数据加载成功，共 ' + imgs.length + ' 张');
        if (imgs.length) {
          container.appendChild(buildCarousel(imgs));
        }
      })
      .catch(function () {
        DSLog.warn('Carousel', '轮播数据加载失败');
      });
  }

  /* ========== 轮播图 ========== */
  function buildCarousel(imgs) {
    var cur = 0;
    var pos = 1;
    var isTransitioning = false;

    var wrap = document.createElement('div');
    wrap.className = 'carousel';

    var track = document.createElement('div');
    track.className = 'carousel-track';

    var allImgs = [imgs[imgs.length - 1]].concat(imgs, [imgs[0]]);

    allImgs.forEach(function (src, i) {
      var slide = document.createElement('div');
      slide.className = 'carousel-slide';
      var img = document.createElement('img');
      img.src = src;
      img.alt = '轮播图 ' + (i === 0 ? imgs.length : (i === allImgs.length - 1 ? 1 : i));
      img.loading = 'lazy';
      slide.appendChild(img);
      track.appendChild(slide);
    });

    wrap.appendChild(track);
    track.style.transform = 'translateX(-100%)';

    var dots = document.createElement('div');
    dots.className = 'carousel-dots';
    var dotEls = imgs.map(function (_, i) {
      var d = document.createElement('span');
      d.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      d.addEventListener('click', function () { if (!isTransitioning) go(i); });
      dots.appendChild(d);
      return d;
    });
    wrap.appendChild(dots);

    var prev = document.createElement('button');
    prev.className = 'carousel-arrow prev';
    prev.setAttribute('aria-label', '上一张');
    prev.innerHTML = '&#10094;';
    prev.addEventListener('click', function () { if (!isTransitioning) go((cur - 1 + imgs.length) % imgs.length); });
    wrap.appendChild(prev);

    var next = document.createElement('button');
    next.className = 'carousel-arrow next';
    next.setAttribute('aria-label', '下一张');
    next.innerHTML = '&#10095;';
    next.addEventListener('click', function () { if (!isTransitioning) go((cur + 1) % imgs.length); });
    wrap.appendChild(next);

    function setTrackPosition(index, animate) {
      if (!animate) {
        track.style.transition = 'none';
      } else {
        track.style.transition = 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
      }
      pos = index;
      track.style.transform = 'translateX(-' + (pos * 100) + '%)';
    }

    function go(i) {
      if (isTransitioning) return;
      var oldCur = cur;
      cur = i;

      if (oldCur === imgs.length - 1 && cur === 0) {
        isTransitioning = true;
        setTrackPosition(imgs.length + 1, true);
      } else if (oldCur === 0 && cur === imgs.length - 1) {
        isTransitioning = true;
        setTrackPosition(0, true);
      } else {
        isTransitioning = true;
        setTrackPosition(cur + 1, true);
      }

      dotEls.forEach(function (d, k) { d.classList.toggle('active', k === cur); });
    }

    track.addEventListener('transitionend', function () {
      isTransitioning = false;
      if (pos === imgs.length + 1) {
        setTrackPosition(1, false);
      } else if (pos === 0) {
        setTrackPosition(imgs.length, false);
      }
    });

    return wrap;
  }

  /* ========== 磁贴 ========== */
  function insertTiles(recentPosts) {
    if (recentPosts.querySelector('.tiles-grid')) return;

    var carousel = recentPosts.querySelector('.carousel');
    var tiles = buildTiles();

    if (carousel) {
      carousel.insertAdjacentElement('afterend', tiles);
    } else {
      recentPosts.insertBefore(tiles, recentPosts.firstChild);
    }
  }

  function buildTiles() {
    var grid = document.createElement('div');
    grid.className = 'tiles-grid';

    var items = [
{ title: '学习', bg: u('img/study.jpg'), link: u('categories/学习/') },
{ title: '热爱', bg: u('img/love.jpg'), link: u('categories/热爱/') }    ];

    items.forEach(function (item) {
      var el = document.createElement('a');
      el.href = item.link;
      el.className = 'tile';

      var bg = document.createElement('div');
      bg.className = 'tile-bg';
      bg.style.backgroundImage = 'url("' + item.bg + '")';

      var mask = document.createElement('div');
      mask.className = 'tile-mask';

      var title = document.createElement('div');
      title.className = 'tile-title';
      title.textContent = item.title;

      el.appendChild(bg);
      el.appendChild(mask);
      el.appendChild(title);
      grid.appendChild(el);
    });

    return grid;
  }

  // 迁移到 BlogLifecycle（P1-3）：init() 本身对重复调用是安全的
  // （画廊页会先移除旧轮播再建新的；首页磁贴有已存在判断），
  // 不需要 destroy，也不需要把内部的 click/transitionend 监听器接到 ctx.on——
  // 这些监听器绑在动态创建的子元素上，元素本身会随 PJAX 整体丢弃，不会累积泄漏。
  function register() {
    if (!window.BlogLifecycle) {
      // 兜底：生命周期管理器缺失时退回原有行为
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      document.addEventListener('pjax:complete', init);
      return;
    }

    window.BlogLifecycle.register('carousel', {
      mount: function () {
        init();
      }
    });
  }

  register();
})();
