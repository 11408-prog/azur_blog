(function () {
  'use strict';

  // 判断首页：#page-header 有 full_page 类，或当前路径是首页
  var header = document.getElementById('page-header');
  var isHome = header && header.classList.contains('full_page');
  if (!isHome) return;

  // 创建视频层
  var video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('disablePictureInPicture', '');
  video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;opacity:0.85;';
  video.innerHTML = '<source src="/azur_blog/videos/cover.mp4" type="video/mp4">';

  // 插入到顶部区域最底层
  header.style.position = 'relative';
  header.style.overflow = 'hidden';
  header.insertBefore(video, header.firstChild);

  // 隐藏原来的背景图，保留暗色遮罩让文字可读
  var style = document.createElement('style');
  style.textContent = `
    #page-header { background-image: none !important; background-color: #0a0a0a; }
    #page-header::before { content:""; position:absolute; inset:0; background:rgba(0,0,0,0.35); z-index:1; }
    #site-info, #nav { position:relative; z-index:2; }
  `;
  document.head.appendChild(style);
})();