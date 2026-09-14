/* 首页文章随机排序 + 置顶
 * ------------------------------------------------------------
 * 置顶判定（见《需要解决的问题.md》P1-7）：
 *   不再按标题字符串精确匹配，而是读取 Hexo front matter 的置顶标记。
 *   构建期 themes/butterfly/layout/includes/mixins/indexPostUI.pug
 *   已在满足 `article.top || article.sticky > 0` 时渲染图钉图标
 *   （a.article-title 内的 i.sticky），因此运行期只需检测该标记。
 *   → 文章标题可以自由修改，置顶状态不受影响。
 *   → 与主题原生置顶机制统一为同一份数据源（front matter），
 *      不再存在「PINNED 数组」与「sticky 字段」两套并存、互不一致的问题。
 *
 * 行为：置顶文章保持原有相对顺序排在最前，其余文章随机打乱。
 */
(function () {
  'use strict';

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  // 判断一张卡片是否被标记为置顶（依据构建期渲染的 front matter 标记）
  function isPinned(el) {
    var title = el.querySelector('.article-title');
    if (!title) return false;
    // indexPostUI.pug 仅在 article.top || article.sticky > 0 时输出 i.sticky
    return !!title.querySelector('i.sticky');
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
      // 广告位卡片（主题注入）不参与排序
      if (el.classList.contains('ads-wrap')) return;
      if (isPinned(el)) pinned.push(el);
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
