/* 首页文章随机排序：置顶（sticky）文章固定最前，其余随机打乱 */
(function () {
  'use strict';

  // 置顶文章的标题（与 front matter 的 title 一致，加置顶文章时在这里追加）
  var PINNED = ['企业的皮肤和情人节台词汇总', '常用指令'];

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function init() {
    var container = document.getElementById('recent-posts');
    if (!container) return;

    // 卡片真实父容器（中间隔着一层 .recent-post-items）
    var list = container.querySelector('.recent-post-items') || container;

    var items = Array.prototype.slice.call(
      list.querySelectorAll('.recent-post-item')
    );
    if (!items.length) return;

    var pinned = [];
    var others = [];
    items.forEach(function (el) {
      var t = el.querySelector('.article-title');
      var title = t ? t.textContent.trim() : '';
      if (PINNED.indexOf(title) !== -1) pinned.push(el);
      else others.push(el);
    });

    var ordered = pinned.concat(shuffle(others));
    ordered.forEach(function (el) {
      list.appendChild(el); // 移动节点重排顺序（保持在卡片容器内）
    });
    DSLog.info('RandomPosts', '已重排文章：置顶 ' + pinned.length + ' 篇，随机 ' + others.length + ' 篇');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  document.addEventListener('pjax:complete', init);
})();
