(function () {
  'use strict';
  var toc = document.getElementById('card-toc');
  // 检查目录里是否有实际内容（toc-item 或 toc-link）
  var hasToc = toc && toc.querySelector('.toc-item, .toc-link, a[href^="#"]');
  if (!hasToc) {
    document.documentElement.classList.add('no-toc');
  }
})();