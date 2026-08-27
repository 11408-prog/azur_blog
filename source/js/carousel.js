/* 首页轮播图 + 磁贴 */
(function () {
  'use strict';

  function init() {
    if (!document.getElementById('recent-posts')) return;
    var recentPosts = document.getElementById('recent-posts');
    if (!recentPosts) return;

    fetch('/azur_blog/carousel-list.json')   
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var imgs = (data && data.images) || [];
        DSLog.info('Carousel', '轮播数据加载成功，共 ' + imgs.length + ' 张');
        if (imgs.length) {
          recentPosts.insertBefore(buildCarousel(imgs), recentPosts.firstChild);
        }
        // 轮播图插入完成后，立即插入磁贴
        insertTiles(recentPosts);
      })
      .catch(function () {
        DSLog.warn('Carousel', '轮播数据加载失败，仅插入磁贴');
        // 轮播图失败也插入磁贴
        insertTiles(recentPosts);
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
{ title: '学习', bg: '/azur_blog/img/study.jpg', link: '/azur_blog/categories/学习/' },
{ title: '热爱', bg: '/azur_blog/img/love.jpg', link: '/azur_blog/categories/热爱/' }    ];

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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();