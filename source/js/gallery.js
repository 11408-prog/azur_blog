/* 画廊页：瀑布流（最短列贪心插入）+ 随机排列 + 灯箱
 * 算法：随机顺序逐张插入，每张放到当前高度最低的列（局部最优=列均衡）
 * 图片宽高来自 gallery.json（构建时生成），用 aspect-ratio 占位 → 零跳动、可边加载边看
 */
(function () {
  'use strict';

  // 路径统一由 BlogConfig 派生（见 blog-config.js），不硬编码 /azur_blog/
  var DATA_URL = window.BlogConfig
    ? window.BlogConfig.url('gallery.json')
    : '/azur_blog/gallery.json';

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

  // 迁移到 BlogLifecycle（P1-3）：mount() 本身对多次调用是安全的
  // （无 #masonry-gallery 容器时直接跳过；lastList 缓存避免重复请求 gallery.json）。
  // resize 防抖监听改用 ctx.on/ctx.timeout 登记，PJAX 切换时随旧模块一起清理重挂，
  // 避免"刚 resize 还没等 200ms 防抖跑完，页面就切走了"这种边缘情况下
  // 定时器残留、引用到已经不在文档里的旧容器。
  function register() {
    if (!window.BlogLifecycle) {
      // 兜底：生命周期管理器缺失时退回原有行为
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
      } else {
        mount();
      }
      document.addEventListener('pjax:complete', mount);
      var resizeTimer;
      window.addEventListener('resize', function () {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(mount, 200);
      });
      return;
    }

    window.BlogLifecycle.register('gallery', {
      mount: function (ctx) {
        mount();
        var resizeTimeoutId = null;
        ctx.on(window, 'resize', function () {
          if (resizeTimeoutId) clearTimeout(resizeTimeoutId);
          resizeTimeoutId = ctx.timeout(mount, 200);
        });
      }
    });
  }

  register();
})();
