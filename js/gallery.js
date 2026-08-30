/* 画廊页：瀑布流（最短列贪心插入）+ 随机排列 + 灯箱
 * 算法：随机顺序逐张插入，每张放到当前高度最低的列（局部最优=列均衡）
 * 图片宽高来自 gallery.json（构建时生成），用 aspect-ratio 占位 → 零跳动、可边加载边看
 */
(function () {
  'use strict';

  var DATA_URL = '/azur_blog/gallery.json';

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function colCount() {
    var w = window.innerWidth;
    if (w <= 480) return 1;
    if (w <= 768) return 2;
    return 3;
  }

  function wireLightbox(container) {
    container.querySelectorAll('img').forEach(function (img) {
      if (img.parentNode.tagName !== 'A') {
        var a = document.createElement('a');
        a.href = img.getAttribute('src');
        a.setAttribute('data-fancybox', 'gallery');
        a.setAttribute('data-caption', img.getAttribute('alt') || '');
        img.parentNode.insertBefore(a, img);
        a.appendChild(img);
      }
    });
    if (window.btf && window.btf.loadLightbox) {
      btf.loadLightbox(container.querySelectorAll('img:not(.no-lightbox)'));
    }
  }

  var lastCols = 0;
  var lastList = null;

  function render(container, list) {
    container.innerHTML = '';

    // 建列
    var n = colCount();
    var cols = [];
    for (var i = 0; i < n; i++) {
      var col = document.createElement('div');
      col.className = 'mg-col';
      container.appendChild(col);
      cols.push(col);
    }
    lastCols = n;

    // 随机顺序，逐张插入最短列
    shuffle(list).forEach(function (it) {
      var minCol = cols[0];
      var minH = cols[0].offsetHeight;
      for (var j = 1; j < cols.length; j++) {
        if (cols[j].offsetHeight < minH) {
          minCol = cols[j];
          minH = cols[j].offsetHeight;
        }
      }
      var img = document.createElement('img');
      img.src = it.url;
      img.alt = it.alt || '';
      img.loading = 'lazy';
      // 用真实宽高比占位：未加载时高度就已知，插入位置准确、不跳动
      if (it.w && it.h) {
        img.style.aspectRatio = it.w + ' / ' + it.h;
      }
      minCol.appendChild(img);
    });

    wireLightbox(container);
    DSLog.info('Gallery', '贪心瀑布流渲染完成：' + list.length + ' 张 / ' + n + ' 列');
  }

  function mount() {
    var container = document.getElementById('masonry-gallery');
    if (!container) return;

    // 列数变化时才重建（保留已加载状态；刷新/换列数时重新洗牌）
    if (lastCols === colCount() && container.querySelector('.mg-col')) return;

    if (lastList) {
      render(container, lastList);
      return;
    }

    fetch(DATA_URL)
      .then(function (r) { return r.json(); })
      .then(function (list) {
        lastList = list;
        render(container, list);
      })
      .catch(function () {
        DSLog.warn('Gallery', '图片列表加载失败');
        container.innerHTML = '<div class="heatmap-fallback">画廊加载失败</div>';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
  document.addEventListener('pjax:complete', mount);
  window.addEventListener('resize', mount); // 窗口尺寸变化时切换列数
})();
