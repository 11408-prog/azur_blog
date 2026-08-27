(function () {
  'use strict';

  // 竖屏直接退出，保持 Butterfly 原来的静态封面
  if (window.innerWidth < window.innerHeight) return;

  function mountVideo() {
    var header = document.getElementById('page-header');
    if (!header || !header.classList.contains('full_page')) return;
    // PJAX 后 #page-header 是新节点，video 会被一并替换；已存在则不重复挂载
    if (header.querySelector('video')) return;

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
    DSLog.info('VideoCover', '视频封面已挂载/重建');
  }

  // 背景样式只在首次注入一次（document.head 不被 PJAX 替换）
  if (!document.getElementById('video-cover-style')) {
    var style = document.createElement('style');
    style.id = 'video-cover-style';
    // 注意：必须限定 .full_page（有视频的页面），否则会误伤文章页的 post-bg 封面
    style.textContent = `
      #page-header.full_page { background-image: none !important; background-color: #0a0a0a; }
      #page-header.full_page::before { content:""; position:absolute; inset:0; background:rgba(0,0,0,0.2); z-index:1; }
      #site-info, #nav { position:relative; z-index:2; }
    `;
    document.head.appendChild(style);
  }

  // 首次挂载 + PJAX 完成后重建（PJAX 替换 #body-wrap，video 随 header 一起被换掉）
  mountVideo();
  document.addEventListener('pjax:complete', mountVideo);
})();
