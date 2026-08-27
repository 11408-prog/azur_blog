// source/js/music.js
(function() {
  // 防止重复初始化
  if (window._aplayer_instance) {
    console.log('[音乐] 播放器已存在，跳过初始化');
    return;
  }

  // ---------- 创建容器（如果不存在） ----------
  if (!document.getElementById('aplayer')) {
    var container = document.createElement('div');
    container.id = 'aplayer';
    // 使用不影响音频播放的隐藏方式（不 display:none）
    container.style.cssText = 'position:fixed;bottom:0;left:0;z-index:-1;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(container);
    console.log('[音乐] 容器已创建');
  }

  // ---------- 初始化 APlayer（带错误捕获） ----------
  var ap;
  try {
    ap = new APlayer({
      container: document.getElementById('aplayer'),
      fixed: true,
      autoplay: false,
      loop: 'all',
      audio: [{
        name: 'BGM',
        artist: 'Unknown',
        url: '/azur_blog/music/bgm.mp3'
      }]
    });
    console.log('[音乐] APlayer 初始化成功', ap);
  } catch (e) {
    console.error('[音乐] APlayer 初始化失败:', e);
    return; // 初始化失败则退出
  }

  // 保存全局引用
  window._aplayer_instance = ap;

  var isPlaying = false;
  var btn = null;

  // ---------- 创建音乐按钮并插入 #rightside 末尾 ----------
  function createMusicButton() {
    var rightside = document.getElementById('rightside');
    if (!rightside) {
      console.warn('[音乐] 未找到 #rightside，300ms 后重试');
      setTimeout(createMusicButton, 300);
      return;
    }
    if (document.getElementById('music-toggle')) {
      console.log('[音乐] 按钮已存在，跳过创建');
      return;
    }

    btn = document.createElement('div');
    btn.id = 'music-toggle';
    btn.className = 'rightside-item';
    btn.title = '背景音乐';
    btn.innerHTML = '♪';
    Object.assign(btn.style, {
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      background: 'rgba(0,0,0,0.4)',
      color: '#fff',
      fontSize: '20px',
      transition: '0.3s',
      marginBottom: '6px',
      backdropFilter: 'blur(2px)'
    });

    btn.addEventListener('mouseenter', function() {
      this.style.background = isPlaying ? 'rgba(255,100,100,0.9)' : 'rgba(0,0,0,0.7)';
    });
    btn.addEventListener('mouseleave', function() {
      this.style.background = isPlaying ? 'rgba(255,100,100,0.8)' : 'rgba(0,0,0,0.4)';
    });

    // 插入到末尾
    rightside.appendChild(btn);
    console.log('[音乐] 按钮已插入 #rightside 末尾');

    // UI 更新
    function updateUI(playing) {
      if (!btn) return;
      btn.style.background = playing ? 'rgba(255,100,100,0.8)' : 'rgba(0,0,0,0.4)';
      btn.innerHTML = playing ? '⏸' : '▶';
    }

    // 尝试自动播放（允许失败，进入暂停状态）
    if (ap && typeof ap.play === 'function') {
      ap.play().then(function() {
        isPlaying = true;
        updateUI(true);
        console.log('[音乐] 自动播放成功');
      }).catch(function(err) {
        isPlaying = false;
        updateUI(false);
        console.warn('[音乐] 自动播放被阻止（正常现象）:', err);
      });
    } else {
      console.error('[音乐] ap 实例无效，无法播放');
      updateUI(false);
    }

    // 点击切换
    btn.addEventListener('click', function(e) {
      // 不阻止冒泡，避免影响其他按钮
      if (!ap || typeof ap.play !== 'function') {
        console.error('[音乐] ap 实例无效');
        return;
      }
      if (isPlaying) {
        ap.pause();
        isPlaying = false;
        updateUI(false);
        console.log('[音乐] 暂停');
      } else {
        ap.play().then(function() {
          isPlaying = true;
          updateUI(true);
          console.log('[音乐] 开始播放');
        }).catch(function(err) {
          console.error('[音乐] 播放失败:', err);
          // 如果播放失败，UI 保持不变（仍显示 ▶）
        });
      }
    });

    console.log('[音乐] 初始化完成');
  }

  // ---------- 启动 ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createMusicButton);
  } else {
    createMusicButton();
  }

  // ---------- PJAX 兼容 ----------
  document.addEventListener('pjax:complete', function() {
    if (!document.getElementById('music-toggle')) {
      console.log('[音乐] PJAX 后重新创建按钮');
      createMusicButton();
    }
  });

})();