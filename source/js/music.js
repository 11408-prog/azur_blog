// source/js/music.js
// 注意：APlayer 1.x 的 play()/pause() 不返回 Promise，所有调用都不能用 .then/.catch
(function() {
  // 防止重复初始化
  if (window._aplayer_instance) {
    DSLog.info('BGM', '播放器已存在，跳过初始化');
    return;
  }

  // ---------- 创建 APlayer 容器（必须存在） ----------
  if (!document.getElementById('aplayer')) {
    var container = document.createElement('div');
    container.id = 'aplayer';
    container.style.cssText = 'position:fixed;bottom:0;left:0;z-index:-1;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(container);
    DSLog.info('BGM', '容器已创建');
  }

  // ---------- 初始化 APlayer ----------
  var ap;
  var audioUrl = '/azur_blog/music/bgm.mp3';
  try {
    ap = new APlayer({
      container: document.getElementById('aplayer'),
      fixed: true,
      autoplay: false,
      loop: 'all',
      audio: [{
        name: 'BGM',
        artist: 'Unknown',
        url: audioUrl
      }]
    });
    DSLog.info('BGM', 'APlayer 初始化成功', { url: audioUrl });
  } catch (e) {
    DSLog.error('BGM', 'APlayer 初始化失败', { message: e.message, stack: e.stack, name: e.name });
    return;
  }

  // 保存全局引用
  window._aplayer_instance = ap;

  // ---------- 音频加载状态监听 ----------
  ap.audio.addEventListener('canplay', function () {
    DSLog.info('BGM', '音频可播放', { url: audioUrl, duration: ap.audio.duration });
  });

  ap.audio.addEventListener('error', function () {
    var err = ap.audio.error;
    var codeMap = {
      1: 'MEDIA_ERR_ABORTED',
      2: 'MEDIA_ERR_NETWORK',
      3: 'MEDIA_ERR_DECODE',
      4: 'MEDIA_ERR_SRC_NOT_SUPPORTED'
    };
    DSLog.error('BGM', '音频加载失败', {
      url: audioUrl,
      errorCode: err ? err.code : 'unknown',
      errorName: err ? codeMap[err.code] : 'unknown',
      networkState: ap.audio.networkState,
      readyState: ap.audio.readyState
    });
  });

  // ---------- 辅助方法：触发状态更新事件 ----------
  function notifyStateChange() {
    document.dispatchEvent(new Event('bgmStateChange'));
  }

  // ---------- 包装播放/暂停方法 ----------
  var originalPlay = ap.play.bind(ap);
  var originalPause = ap.pause.bind(ap);

  ap.play = function() {
    originalPlay();
    notifyStateChange();
  };

  ap.pause = function() {
    originalPause();
    notifyStateChange();
  };

  // 监听 APlayer 自带的事件
  ap.on('play', function () {
    DSLog.debug('BGM', '状态变化', { state: 'playing' });
    notifyStateChange();
  });
  ap.on('pause', function () {
    DSLog.debug('BGM', '状态变化', { state: 'paused' });
    notifyStateChange();
  });
  ap.on('ended', function () {
    DSLog.debug('BGM', '状态变化', { state: 'ended' });
    notifyStateChange();
  });

  // ---------- 自动播放：先直接尝试；被浏览器策略阻止则等首次用户交互 ----------
  function playOnInteraction() {
    try {
      ap.play();
      DSLog.info('BGM', '首次交互后开始播放');
    } catch (e) {
      DSLog.warn('BGM', '交互后播放仍失败', { message: e.message, name: e.name });
    }
  }

  function registerInteractionListeners() {
    ['click', 'touchstart', 'keydown'].forEach(function(evt) {
      document.addEventListener(evt, playOnInteraction, { once: true });
    });
    DSLog.debug('BGM', '已注册交互监听器', { events: ['click', 'touchstart', 'keydown'] });
  }

  try {
    ap.play();
    DSLog.info('BGM', '自动播放成功');
  } catch (e) {
    DSLog.warn('BGM', '自动播放被阻止，等待首次交互后播放', { message: e.message, name: e.name });
    notifyStateChange();
    registerInteractionListeners();
  }

  // ---------- 暴露调试接口 ----------
  window.__debug_bgm = ap;
  DSLog.info('BGM', '已就绪，可通过 window._aplayer_instance 控制');
})();