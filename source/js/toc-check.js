/* 目录/侧栏卡片显示控制
 * ------------------------------------------------------------
 * 迁移到 BlogLifecycle（见《需要解决的问题.md》P1-3）：
 *   本模块没有定时器/监听器/动态 DOM，init() 本身是幂等的，
 *   纯粹根据当前页面重新计算并覆盖 class/style，重复调用无副作用。
 *   迁移的意义主要是让全站只有一个 pjax:complete 监听入口，
 *   而不是每个模块各自绑定一份。
 * 页面级模块（非 persistent）：PJAX 后 destroy（无需清理）→ mount 重新计算。
 */
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

  function register() {
    if (!window.BlogLifecycle) {
      // 兜底：生命周期管理器缺失时退回原有行为，保证功能不丢
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        init();
      }
      document.addEventListener('pjax:complete', init);
      return;
    }

    window.BlogLifecycle.register('toc-check', {
      mount: function () {
        init();
      }
      // 无 destroy：没有需要清理的资源，PJAX 后直接重新 mount 即可
    });
  }

  register();
})();