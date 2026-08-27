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
  try {
    ap = new APlayer({
      container: document.getElementById('aplayer'),
      fixed: true,
      autoplay: false,          // 不自动播放，避免浏览器阻止
      loop: 'all',
      audio: [{
        name: 'BGM',
        artist: 'Unknown',
        url: '/azur_blog/music/bgm.mp3'
      }]
    });
    DSLog.info('BGM', 'APlayer 初始化成功');
  } catch (e) {
    DSLog.error('BGM', '初始化失败', e);
    return;
  }

  // 保存全局引用
  window._aplayer_instance = ap;

  // ---------- 辅助方法：触发状态更新事件 ----------
  function notifyStateChange() {
    document.dispatchEvent(new Event('bgmStateChange'));
  }

  // ---------- 包装播放/暂停方法（APlayer 1.x 不返回 Promise，不能 .then） ----------
  // 状态同步依赖下面的 'play'/'pause'/'ended' 事件，包装只负责触发事件
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

  // 监听 APlayer 自带的事件（用户通过其他方式播放/暂停时同步 UI）
  ap.on('play', notifyStateChange);
  ap.on('pause', notifyStateChange);
  ap.on('ended', notifyStateChange);

  // ---------- 自动播放：先直接尝试；被浏览器策略阻止则等首次用户交互 ----------
  function playOnInteraction() {
    try {
      ap.play();
      DSLog.info('BGM', '首次交互后开始播放');
    } catch (e) {
      DSLog.warn('BGM', '播放失败', e);
    }
  }

  function registerInteractionListeners() {
    ['click', 'touchstart', 'keydown'].forEach(function(evt) {
      document.addEventListener(evt, playOnInteraction, { once: true });
    });
  }

  try {
    ap.play();
    DSLog.info('BGM', '自动播放成功');
  } catch (e) {
    // 桌面浏览器阻止无手势自动播放：等用户第一次点击/触摸/按键
    DSLog.warn('BGM', '自动播放被阻止，等待首次交互后播放');
    notifyStateChange();
    registerInteractionListeners();
  }

  // ---------- 暴露调试接口 ----------
  window.__debug_bgm = ap;
  DSLog.info('BGM', '已就绪，可通过 window._aplayer_instance 控制');
})();
