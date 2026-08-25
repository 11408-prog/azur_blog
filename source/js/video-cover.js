(function () {
  'use strict';
  
  // 竖屏直接退出，保持 Butterfly 原来的静态封面
  if (window.innerWidth < window.innerHeight) return;

  var header = document.getElementById('page-header');
  if (!header || !header.classList.contains('full_page')) return;

  var video = document.createElement('video');
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.setAttribute('disablePictureInPicture', '');
  video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center 20%;z-index:0;opacity:0.9;';
  video.innerHTML = '<source src="/azur_blog/videos/cover.mp4" type="video/mp4">';

  header.style.position = 'relative';
  header.style.overflow = 'hidden';
  header.insertBefore(video, header.firstChild);

  var style = document.createElement('style');
  style.textContent = `
    #page-header { background-image: none !important; background-color: #0a0a0a; }
    #page-header::before { content:""; position:absolute; inset:0; background:rgba(0,0,0,0.2); z-index:1; }
    #site-info, #nav { position:relative; z-index:2; }
  `;
  document.head.appendChild(style);
})();