(function () {
  'use strict';

  function init() {
    var toc = document.getElementById('card-toc');
    var hasToc = toc && toc.querySelector('.toc-item, .toc-link, a[href^="#"]');

    // 控制 no-toc 类（用于无目录文章恢复显示卡片）
    if (hasToc) {
      document.documentElement.classList.remove('no-toc');
    } else {
      document.documentElement.classList.add('no-toc');
    }

    // 文章页：动态控制侧边栏卡片显示
    var bodyWrap = document.getElementById('body-wrap');
    var isPostPage = bodyWrap && bodyWrap.classList.contains('post');
    var asideCards = document.querySelectorAll('#aside-content .card-widget');

    asideCards.forEach(function (card) {
      if (!isPostPage) {
        // 非文章页：全部显示
        card.style.display = '';
        return;
      }
      // 文章页：有目录时只显示目录，无目录时全部显示
      if (hasToc) {
        if (card.id === 'card-toc') {
          card.style.display = '';
        } else {
          card.style.display = 'none';
        }
      } else {
        card.style.display = '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // PJAX 切换后重新执行
  document.addEventListener('pjax:complete', init);
})();