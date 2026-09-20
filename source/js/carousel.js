/* 轮播图（画廊页）+ 首页磁贴 */
(function () {
  'use strict';

  // 轮播最多用多少张图。
  // carousel-list.json 是构建时对 source/carousel/ 全量扫描并随机打乱的（scripts/carousel.js），
  // 图库有上千张时不能全塞进轮播：每张图一个 slide + 一个圆点，DOM 和圆点条都会失控。
  // 因为列表每次构建都重新洗牌，取前 N 张就是"每次部署换一批"。想恢复全量可改成 Infinity。
  var MAX_SLIDES = 12;

  // transitionend 没触发时的兜底解锁时间（略大于 CSS 里的 0.6s 过渡）
  var TRANSITION_FALLBACK_MS = 900;

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
        var all = (data && data.images) || [];
        var imgs = all.slice(0, MAX_SLIDES);
        DSLog.info('Carousel', '轮播数据加载成功，共 ' + all.length + ' 张，使用 ' + imgs.length + ' 张');
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
    var unlockTimer = null;

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
      d.addEventListener('click', function () { go(i); });
      dots.appendChild(d);
      return d;
    });
    wrap.appendChild(dots);

    var prev = document.createElement('button');
    prev.className = 'carousel-arrow prev';
    prev.setAttribute('aria-label', '上一张');
    prev.innerHTML = '&#10094;';
    prev.addEventListener('click', function () { go((cur - 1 + imgs.length) % imgs.length); });
    wrap.appendChild(prev);

    var next = document.createElement('button');
    next.className = 'carousel-arrow next';
    next.setAttribute('aria-label', '下一张');
    next.innerHTML = '&#10095;';
    next.addEventListener('click', function () { go((cur + 1) % imgs.length); });
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

    // 一次切换结束：解锁，并在首尾克隆页上无动画地跳回真实位置。
    // 幂等——transitionend 与兜底定时器谁先到都行，后到的直接忽略。
    function finishTransition() {
      if (!isTransitioning) return;
      isTransitioning = false;
      if (unlockTimer) {
        clearTimeout(unlockTimer);
        unlockTimer = null;
      }
      if (pos === imgs.length + 1) {
        setTrackPosition(1, false);
      } else if (pos === 0) {
        setTrackPosition(imgs.length, false);
      }
    }

    function go(i) {
      // 目标就是当前这一张：不会产生位移，也就永远等不到 transitionend，
      // 若不在这里拦掉，isTransitioning 会一直是 true，轮播整个锁死
      if (isTransitioning || i === cur) return;

      var oldCur = cur;
      cur = i;
      isTransitioning = true;

      if (oldCur === imgs.length - 1 && cur === 0) {
        setTrackPosition(imgs.length + 1, true);
      } else if (oldCur === 0 && cur === imgs.length - 1) {
        setTrackPosition(0, true);
      } else {
        setTrackPosition(cur + 1, true);
      }

      dotEls.forEach(function (d, k) { d.classList.toggle('active', k === cur); });

      // 兜底：transitionend 在标签页被切到后台、样式被覆盖等情况下可能不触发，
      // 超时后强制解锁，避免任何边缘情况把轮播永久锁住
      unlockTimer = setTimeout(finishTransition, TRANSITION_FALLBACK_MS);
    }

    track.addEventListener('transitionend', function (e) {
      if (e.target !== track) return;
      finishTransition();
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
      { title: '热爱', bg: u('img/love.jpg'), link: u('categories/热爱/') }
    ];

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
