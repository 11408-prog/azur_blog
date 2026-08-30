/* 画廊页：瀑布流（CSS 多列）+ 随机排列 + 灯箱 */
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

  function mount() {
    var container = document.getElementById('masonry-gallery');
    if (!container) return;

    fetch(DATA_URL)
      .then(function (r) { return r.json(); })
      .then(function (list) {
        var imgs = shuffle(list.slice()); // 随机排列，每次刷新顺序不同
        container.innerHTML = imgs.map(function (it) {
          return '<img src="' + it.url + '" alt="' + it.alt + '" loading="lazy">';
        }).join('');
        wireLightbox(container);
        DSLog.info('Gallery', '瀑布流渲染完成，共 ' + imgs.length + ' 张（随机顺序）');
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
})();
