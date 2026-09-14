/* 统一站点路径配置 BlogConfig
 * ------------------------------------------------------------
 * 解决的问题（见《需要解决的问题.md》P1-8）：
 *   source/js/ 与 scripts/ 中大量硬编码 '/azur_blog/' 前缀。
 *   一旦部署方式变化（GitHub Pages 子路径 → 自定义域名根路径），
 *   这些字面量会全部失效，需要逐个文件修改。
 *
 * 机制：
 *   Hexo 的 config.root 已由 Butterfly 主题输出到全局变量
 *   GLOBAL_CONFIG.root（themes/butterfly/layout/includes/head/config.pug），
 *   且在 <head> 中加载，早于所有 inject.bottom 脚本。
 *   本文件把它包装成统一的引用入口，全站只此一处保留兜底字面量。
 *
 * 用法：
 *   BlogConfig.root          → '/azur_blog/'
 *   BlogConfig.url('music/bgm.mp3')  → '/azur_blog/music/bgm.mp3'
 *
 * 加载顺序要求：必须在所有业务脚本之前（logger.js 之后即可）。
 */
(function () {
  'use strict';

  // 兜底值：仅当 GLOBAL_CONFIG 意外缺失时使用（正常构建不会走到这里）
  var FALLBACK_ROOT = '/azur_blog/';

  function resolveRoot() {
    var root = window.GLOBAL_CONFIG && window.GLOBAL_CONFIG.root;
    if (typeof root !== 'string' || !root) return FALLBACK_ROOT;
    // 规范化：确保以 / 开头和结尾（Hexo 的 root 本身即为此形式）
    if (root.charAt(0) !== '/') root = '/' + root;
    if (root.charAt(root.length - 1) !== '/') root = root + '/';
    return root;
  }

  var root = resolveRoot();

  window.BlogConfig = {
    // 站点根路径，形如 '/azur_blog/' 或 '/'
    root: root,

    /**
     * 把站点内相对路径拼成带 root 前缀的绝对路径。
     * @param {string} p 形如 'music/bgm.mp3' 或 '/music/bgm.mp3'
     * @returns {string} '/azur_blog/music/bgm.mp3'
     */
    url: function (p) {
      if (typeof p !== 'string' || !p) return root;
      // 外部链接（协议开头 / 协议相对）与锚点原样返回
      if (/^(https?:)?\/\//i.test(p) || p.charAt(0) === '#') return p;
      var s = p.charAt(0) === '/' ? p.slice(1) : p;
      return root + s;
    },

    // 去掉路径中的 root 前缀（构建产物校验、调试时使用）
    strip: function (p) {
      if (typeof p !== 'string') return p;
      return root !== '/' && p.indexOf(root) === 0 ? p.slice(root.length) : p;
    }
  };

  if (window.DSLog) {
    window.DSLog.info('BlogConfig', '站点根路径已确定', { root: root });
  }
})();
