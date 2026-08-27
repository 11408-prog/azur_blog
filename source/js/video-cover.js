(function () {
  'use strict';

  // 竖屏直接退出
  if (window.innerWidth < window.innerHeight) {
    DSLog.debug('VideoCover', '竖屏模式，跳过视频挂载');
    return;
  }

  function mountVideo() {
    var header = document.getElementById('page-header');
    if (!header) {
      DSLog.warn('VideoCover', '未找到 #page-header');
      return;
    }
    if (!header.classList.contains('full_page')) {
      DSLog.debug('VideoCover', '非 full_page 页面，跳过');
      return;
    }
    // PJAX 后 #page-header 是新节点，video 会被一并替换；已存在则不重复挂载
    if (header.querySelector('video')) {
      DSLog.debug('VideoCover', 'video 已存在，跳过重复挂载');
      return;
    }

    var video = document.createElement('video');
    video.autoplay = true;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.setAttribute('disablePictureInPicture', '');
    video.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center 20%;z-index:0;opacity:0.9;';

    var src = '/azur_blog/videos/cover.mp4';
    video.innerHTML = '<source src="' + src + '" type="video/mp4">';

    // 错误捕获：视频文件不存在、格式不支持、网络失败等
    video.addEventListener('error', function (e) {
      var err = video.error;
      var codeMap = {
        1: 'MEDIA_ERR_ABORTED',
        2: 'MEDIA_ERR_NETWORK',
        3: 'MEDIA_ERR_DECODE',
        4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
      };
      DSLog.error('VideoCover', '视频加载失败', {
        src: src,
        errorCode: err ? err.code : 'unknown',
        errorName: err ? codeMap[err.code] : 'unknown',
        networkState: video.networkState,
        readyState: video.readyState
      });
    });

    // 加载成功
    video.addEventListener('loadeddata', function () {
      DSLog.info('VideoCover', '视频加载成功', { src: src, duration: video.duration });
    });

    header.style.position = 'relative';
    header.style.overflow = 'hidden';
    header.insertBefore(video, header.firstChild);
    DSLog.info('VideoCover', '视频封面已挂载/重建');
  }

  // 背景样式只在首次注入一次
  if (document.getElementById('video-cover-style')) {
    DSLog.debug('VideoCover', '样式已存在，跳过注入');
  } else {
    var style = document.createElement('style');
    style.id = 'video-cover-style';
    style.textContent = `
      #page-header.full_page { background-image: none !important; background-color: #0a0a0a; }
      #page-header.full_page::before { content:""; position:absolute; inset:0; background:rgba(0,0,0,0.2); z-index:1; }
      #site-info, #nav { position:relative; z-index:2; }
    `;
    document.head.appendChild(style);
    DSLog.debug('VideoCover', '样式首次注入');
  }

  // 首次挂载 + PJAX 完成后重建
  mountVideo();
  document.addEventListener('pjax:complete', mountVideo);
})();