'use strict';

/**
 * Netlify 路径适配生成器
 * 生成 public/_redirects：把 /azur_blog/* 前缀请求重写到根路径。
 * 原因：站点 root 配置为 /azur_blog/（GitHub Pages 项目路径），
 *       Netlify 部署在根路径 /，用重写让所有带前缀的资源正常加载。
 * 注意：GitHub Pages 忽略 _redirects 文件，双平台共存无冲突。
 */
hexo.extend.generator.register('netlify-redirects', function () {
  return {
    path: '_redirects',
    data: '/azur_blog/*  /:splat  200\n'
  };
});
