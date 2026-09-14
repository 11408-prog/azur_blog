'use strict';

/**
 * Netlify 路径适配生成器
 * 生成 public/_redirects：把 root 前缀请求重写到根路径。
 * 原因：站点 root 配置为 /azur_blog/（GitHub Pages 项目路径），
 *       Netlify 部署在根路径 /，用重写让所有带前缀的资源正常加载。
 * 注意：GitHub Pages 忽略 _redirects 文件，双平台共存无冲突。
 *
 * 前缀统一从 hexo.config.root 派生，不硬编码 /azur_blog/：
 *   - root = /azur_blog/  → 生成 "/azur_blog/*  /:splat  200"
 *   - root = /            → 无需重写，生成空文件
 */
hexo.extend.generator.register('netlify-redirects', function () {
  const root = hexo.config.root || '/';
  // 去掉首尾斜杠得到纯前缀；root 为 '/' 时前缀为空，说明已部署在根路径
  const prefix = root.replace(/^\/+/, '').replace(/\/+$/, '');
  const data = prefix ? `/${prefix}/*  /:splat  200\n` : '';

  return {
    path: '_redirects',
    data: data
  };
});
