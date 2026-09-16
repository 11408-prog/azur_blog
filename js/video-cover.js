(function () {
  'use strict';

  // 手机端（<=768px）：不挂视频，改用竖版封面图
  // 路径统一由 BlogConfig 派生（见 blog-config.js），不硬编码 /azur_blog/
  function u(p) {
    return window.BlogConfig ? window.BlogConfig.url(p) : '/azur_blog/' + p;
  }
  var PHONE_COVER = u('img/phone_cover.jpg');
  var mq = window.matchMedia('(max-width: 768px)');

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
    // 手机端：不挂视频（CSS 已换成 phone_cover 竖图背景）
    if (mq.matches) {
      DSLog.debug('VideoCover', '手机端，使用竖版封面图');
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

    var src = u('videos/cover.mp4');
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
      /* 手机端：页首换成竖版封面图，隐藏视频 */
      @media (max-width: 768px) {
        #page-header.full_page {
          background-image: url(${PHONE_COVER}) !important;
          background-size: cover;
          background-position: center top;
        }
        #page-header.full_page video { display: none !important; }
        #page-header.full_page::before { background: rgba(0,0,0,0.1); }
      }
    `;
    document.head.appendChild(style);
    DSLog.debug('VideoCover', '样式首次注入');
  }

  // 首次挂载 + PJAX 完成后重建 + 屏幕尺寸变化时切换
  // 迁移到 BlogLifecycle（P1-3）：mountVideo 本身是幂等的（已挂载则跳过），
  // 且 PJAX 后 #page-header 是全新节点，旧 video 会随之一起被替换，无需手动清理，
  // 所以不需要 destroy；resize 监听改用 ctx.on 登记，自动跟随 PJAX 回收重挂。
  function register() {
    if (!window.BlogLifecycle) {
      // 兜底：生命周期管理器缺失时退回原有行为
      mountVideo();
      document.addEventListener('pjax:complete', mountVideo);
      mq.addEventListener('change', mountVideo);
      return;
    }

    window.BlogLifecycle.register('video-cover', {
      mount: function (ctx) {
        mountVideo();
        ctx.on(mq, 'change', mountVideo);
      }
    });
  }

  register();
})();