// source/js/music.js
// 首页 BGM 播放器（APlayer 1.x）
// ------------------------------------------------------------
// 生命周期（见《需要解决的问题.md》P1-4）：
//   音乐播放器是【全局常驻组件】，而 #body-wrap 内的页面内容是【页面级】的。
//   两者生命周期不同，因此播放器实例只创建一次，PJAX 切换不重建。
//   本脚本经 inject.bottom 挂载，位于 #body-wrap 之外，
//   整页加载只执行一次；PJAX 不会重新执行本文件。
//   但 APlayer 的容器挂在 document.body 上（同样不被 PJAX 替换），
//   因此实例与音频状态可以跨页面切换完整保留。
//
// 注意：APlayer 1.x 的 play()/pause() 不返回 Promise，所有调用都不能用 .then/.catch
//       且 play() 内部吞掉了自动播放被拦截的错误，不会抛异常——判断是否在播只能看 audio.paused
(function () {
  'use strict';

  var CONTAINER_ID = 'aplayer';
  var audioUrl = window.BlogConfig
    ? window.BlogConfig.url('music/bgm.mp3')
    : '/azur_blog/music/bgm.mp3';

  // ---------- 容器管理 ----------
  // 容器必须存在且脱离 PJAX 替换范围，播放器才能跨页面存活
  function ensureContainer() {
    var el = document.getElementById(CONTAINER_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = CONTAINER_ID;
    el.style.cssText =
      'position:fixed;bottom:0;left:0;z-index:-1;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
    DSLog.info('BGM', '播放器容器已创建');
    return el;
  }

  // ---------- 音频加载状态监听 ----------
  function bindAudioEvents(ap) {
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
  }

  // ---------- 状态变更通知（供齿轮菜单等同步 UI） ----------
  function notifyStateChange() {
    document.dispatchEvent(new Event('bgmStateChange'));
  }

  // ---------- 包装播放/暂停，使外部调用也能同步 UI ----------
  function wrapControls(ap) {
    var originalPlay = ap.play.bind(ap);
    var originalPause = ap.pause.bind(ap);

    ap.play = function () {
      originalPlay();
      notifyStateChange();
    };
    ap.pause = function () {
      originalPause();
      notifyStateChange();
    };

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
  }

  // ---------- 自动播放：先直接尝试；被浏览器策略拦截则等用户手势 ----------
  // 注意：APlayer 1.x 的 play() 内部自己 catch 了 audio.play() 的 rejection
  // （NotAllowedError 时会自行 pause），不会向外抛异常。
  // 所以不能靠 try/catch 判断"是否被拦截"，只能调用后检查 audio.paused 的真实状态。
  var INTERACTION_EVENTS = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
  var MAX_INTERACTION_ATTEMPTS = 10;
  var _armed = false;
  var _attempts = 0;
  var _verifyTimer = null;

  function disarmInteractionListeners() {
    if (!_armed) return;
    _armed = false;
    INTERACTION_EVENTS.forEach(function (evt) {
      document.removeEventListener(evt, onUserGesture, true);
    });
    DSLog.debug('BGM', '已移除交互监听器');
  }

  // 每个手势都尝试播放，直到确认真的播起来了才整体卸载监听：
  //   - 不同浏览器把不同事件算作"用户激活"（触屏是 touchend/pointerup，键盘 Esc 不算），
  //     所以监听多个事件、失败就保持监听，等下一个手势
  //   - 成功后 5 个事件一起移除，避免之后用户手动暂停又被 keydown 等事件"复活"
  function onUserGesture() {
    var ap = window._aplayer_instance;
    if (!ap || !ap.audio) return;
    if (!ap.audio.paused) {
      disarmInteractionListeners();
      return;
    }
    _attempts++;
    ap.play();
    clearTimeout(_verifyTimer);
    _verifyTimer = setTimeout(function () {
      if (ap.audio && !ap.audio.paused) {
        DSLog.info('BGM', '首次交互后开始播放', { attempts: _attempts });
        disarmInteractionListeners();
      } else if (_attempts >= MAX_INTERACTION_ATTEMPTS) {
        DSLog.warn('BGM', '多次交互后仍无法播放，放弃自动播放', { attempts: _attempts });
        disarmInteractionListeners();
      }
    }, 300);
  }

  function registerInteractionListeners() {
    if (_armed) return;
    _armed = true;
    _attempts = 0;
    INTERACTION_EVENTS.forEach(function (evt) {
      document.addEventListener(evt, onUserGesture, { capture: true, passive: true });
    });
    DSLog.debug('BGM', '已注册交互监听器', { events: INTERACTION_EVENTS });
  }

  function tryAutoplay(ap) {
    try {
      ap.play();
    } catch (e) {
      DSLog.warn('BGM', 'play() 抛出异常', { message: e.message, name: e.name });
    }
    // 给浏览器一点时间给出结果：被拦截时 APlayer 会在 rejection 里把自己 pause 掉
    setTimeout(function () {
      if (ap.audio && !ap.audio.paused) {
        DSLog.info('BGM', '自动播放成功');
        return;
      }
      DSLog.warn('BGM', '自动播放被浏览器拦截，等待首次用户手势后播放');
      notifyStateChange();
      registerInteractionListeners();
    }, 500);
  }

  // ---------- 实例创建（全局只成功执行一次） ----------
  function createPlayer() {
    if (typeof APlayer !== 'function') {
      DSLog.error('BGM', 'APlayer 库未加载，跳过初始化（可能是 CDN 不可用）');
      return null;
    }

    var container = ensureContainer();
    var ap;
    try {
      ap = new APlayer({
        container: container,
        fixed: true,
        autoplay: false,
        loop: 'all',
        audio: [{ name: 'BGM', artist: 'Unknown', url: audioUrl }]
      });
      DSLog.info('BGM', 'APlayer 初始化成功', { url: audioUrl });
    } catch (e) {
      DSLog.error('BGM', 'APlayer 初始化失败', {
        message: e.message, stack: e.stack, name: e.name
      });
      return null;
    }

    window._aplayer_instance = ap;
    window.__debug_bgm = ap;   // 调试接口
    bindAudioEvents(ap);
    wrapControls(ap);
    tryAutoplay(ap);
    DSLog.info('BGM', '已就绪，可通过 window._aplayer_instance 控制');
    return ap;
  }

  // ---------- 实例健康检查 ----------
  // 返回 true 表示现有实例仍可用，无需重建
  function isPlayerHealthy(ap) {
    return !!(ap && ap.audio && document.getElementById(CONTAINER_ID));
  }

  // 销毁失效实例（容器被移除、audio 丢失等异常场景）
  function destroyPlayer(ap) {
    if (!ap) return;
    try {
      if (typeof ap.destroy === 'function') ap.destroy();
    } catch (e) {
      DSLog.warn('BGM', '销毁播放器时出错', { message: e.message });
    }
    if (window._aplayer_instance === ap) window._aplayer_instance = null;
    if (window.__debug_bgm === ap) window.__debug_bgm = null;
  }

  // ---------- 幂等初始化 ----------
  // 无论被调用多少次：健康实例直接复用，绝不产生第二个 APlayer
  function initPlayer() {
    var existing = window._aplayer_instance;

    if (existing) {
      if (isPlayerHealthy(existing)) {
        DSLog.debug('BGM', '播放器已存在且健康，跳过初始化');
        return existing;
      }
      // 实例已失效（容器被移除等），先清理再重建
      DSLog.warn('BGM', '检测到播放器实例失效，重建');
      destroyPlayer(existing);
    }

    return createPlayer();
  }

  // ---------- 生命周期挂载 ----------
  // persistent：播放器跨页面常驻，PJAX 后不销毁，只做健康检查与 UI 同步
  function register() {
    if (!window.BlogLifecycle) {
      // 兜底：生命周期管理器缺失时仍保证播放器可用
      DSLog.warn('BGM', 'BlogLifecycle 不可用，退回独立初始化');
      initPlayer();
      return;
    }

    window.BlogLifecycle.register('music', {
      persistent: true,

      mount: function () {
        initPlayer();
      },

      // PJAX 后：播放器本体（body 上的容器与实例）不受影响，
      // 但齿轮菜单随 #body-wrap 被重建，其 BGM 状态需要重新同步。
      // 同时做一次健康检查，异常时才重建实例。
      refresh: function () {
        var ap = initPlayer();   // 幂等：健康则原样返回
        if (ap) notifyStateChange();
        DSLog.info('BGM', 'PJAX 完成，播放器状态已同步', {
          playing: !!(ap && ap.audio && !ap.audio.paused)
        });
      },

      // 真正需要释放时（页面卸载）交给浏览器回收音频资源
      destroy: function () {
        destroyPlayer(window._aplayer_instance);
      }
    });
  }

  register();
})();
