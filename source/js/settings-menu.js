/* ==========================================
 * Azur Blog - Settings Manager
 * ========================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'azur-blog-settings';

  var defaultSettings = {
    blur: false,
    animation: true
  };

  var settings = loadSettings();

  /* ----------------------------------------
   * Storage
   * ---------------------------------------- */

  function loadSettings() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return Object.assign({}, defaultSettings);
      }

      return Object.assign(
        {},
        defaultSettings,
        JSON.parse(saved)
      );
    } catch (error) {
      return Object.assign({}, defaultSettings);
    }
  }

  function saveSettings() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );
  }

  function createGearButton() {

    var menus = document.getElementById('menus');

    if (!menus) {
      return;
    }

    /* 已存在就不重复创建 */
    if (document.getElementById('nav-settings-wrapper')) {
      return;
    }

    var wrapper = document.createElement('div');

    wrapper.id = 'nav-settings-wrapper';

    wrapper.innerHTML = `
      <button
        id="nav-settings-toggle"
        type="button"
        aria-label="打开设置"
        title="设置"
      >
        <i class="fas fa-cog"></i>
      </button>
    `;

    menus.appendChild(wrapper);
  }

  /* ----------------------------------------
   * Panel
   * ---------------------------------------- */

  function createPanel(ctx) {

    if (document.getElementById('settings-overlay')) {
      return;
    }

    var overlay = document.createElement('div');

    overlay.id = 'settings-overlay';

    overlay.innerHTML = `
      <aside id="settings-panel">

        <header class="settings-header">

          <div class="settings-title">
            网站设置
          </div>

          <button
            class="settings-close"
            type="button"
            aria-label="关闭设置"
          >
            <i class="fas fa-times"></i>
          </button>

        </header>


        <div class="settings-content">

          <!-- 外观 -->

          <section class="settings-section">

            <div class="settings-section-title">
              外观
            </div>


            <div class="settings-item">

              <div class="settings-item-info">

                <div class="settings-item-title">
                  深色模式
                </div>

                <div class="settings-item-desc">
                  切换网站的明暗主题
                </div>

              </div>

              <label class="settings-switch">

                <input
                  type="checkbox"
                  id="setting-darkmode"
                >

                <span class="settings-switch-track"></span>

              </label>

            </div>


            <div class="settings-item">

              <div class="settings-item-info">

                <div class="settings-item-title">
                  背景模糊
                </div>

                <div class="settings-item-desc">
                  增强背景与页面内容的层次
                </div>

              </div>

              <label class="settings-switch">

                <input
                  type="checkbox"
                  id="setting-blur"
                >

                <span class="settings-switch-track"></span>

              </label>

            </div>


            <div class="settings-item">

              <div class="settings-item-info">

                <div class="settings-item-title">
                  页面动画
                </div>

                <div class="settings-item-desc">
                  控制页面中的过渡和动态效果
                </div>

              </div>

              <label class="settings-switch">

                <input
                  type="checkbox"
                  id="setting-animation"
                >

                <span class="settings-switch-track"></span>

              </label>

            </div>

          </section>


          <!-- 音乐 -->

          <section class="settings-section">

            <div class="settings-section-title">
              音乐
            </div>


            <div class="settings-item">

              <div class="settings-item-info">

                <div class="settings-item-title">
                  背景音乐
                </div>

                <div class="settings-item-desc">
                  控制网站背景音乐播放状态
                </div>

              </div>

              <label class="settings-switch">

                <input
                  type="checkbox"
                  id="setting-bgm"
                >

                <span class="settings-switch-track"></span>

              </label>

            </div>

          </section>


          <!-- 背景 -->

          <section class="settings-section">

            <div class="settings-section-title">
              背景
            </div>


            <div class="settings-background-grid">

              <button
                class="settings-background"
                data-bg="/azur_blog/img/background.jpg"
                style="background-image:url('/azur_blog/img/background.jpg')"
              >
                <span class="settings-background-label">
                  默认背景
                </span>
              </button>


              <button
                class="settings-background"
                data-bg="/azur_blog/img/covers/enterprise_2.jpg"
                style="background-image:url('/azur_blog/img/covers/enterprise_2.jpg')"
              >
                <span class="settings-background-label">
                  Enterprise 02
                </span>
              </button>


              <button
                class="settings-background"
                data-bg="/azur_blog/img/phone_cover.jpg"
                style="background-image:url('/azur_blog/img/phone_cover.jpg')"
              >
                <span class="settings-background-label">
                  手机背景
                </span>
              </button>


              <button
                class="settings-background"
                data-bg="/azur_blog/img/love.jpg"
                style="background-image:url('/azur_blog/img/love.jpg')"
              >
                <span class="settings-background-label">
                  Love
                </span>
              </button>

            </div>

          </section>


          <!-- 恢复 -->

          <section class="settings-section">

            <button
              id="settings-reset"
              class="settings-reset"
              type="button"
            >
              恢复默认设置
            </button>

          </section>

        </div>

      </aside>
    `;

    ctx.append(document.body, overlay);

    bindEvents(ctx);

    syncUI();
  }

  /* ----------------------------------------
   * Events
   * ---------------------------------------- */

  function bindEvents(ctx) {

    var overlay = document.getElementById('settings-overlay');

    if (!overlay) {
      return;
    }

    /* 点击遮罩关闭 */

    ctx.on(
      overlay,
      'click',
      function (event) {

        if (event.target === overlay) {
          closePanel();
        }

      }
    );


    /* 关闭按钮 */

    var closeButton =
      overlay.querySelector('.settings-close');

    if (closeButton) {

      ctx.on(
        closeButton,
        'click',
        closePanel
      );

    }


    /* 齿轮按钮 */

    ctx.on(
      document,
      'click',
      function (event) {

        var button =
          event.target.closest('#nav-settings-toggle');

        if (!button) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        togglePanel();

      }
    );


    /* ESC */

    ctx.on(
      document,
      'keydown',
      function (event) {

        if (event.key === 'Escape') {
          closePanel();
        }

      }
    );


    /* 深色模式 */

    var darkMode =
      document.getElementById('setting-darkmode');

    if (darkMode) {

      ctx.on(
        darkMode,
        'change',
        function () {

        var nativeButton =
        document.getElementById('darkmode');

        if (nativeButton) {
        nativeButton.click();
        }

        syncDarkMode();

        }
      );

    }


    /* 背景模糊 */

    var blur =
      document.getElementById('setting-blur');

    if (blur) {

      ctx.on(
        blur,
        'change',
        function () {

          settings.blur =
            blur.checked;

          saveSettings();

          applySettings();

        }
      );

    }


    /* 页面动画 */

    var animation =
      document.getElementById(
        'setting-animation'
      );

    if (animation) {

      ctx.on(
        animation,
        'change',
        function () {

          settings.animation =
            animation.checked;

          saveSettings();

          applySettings();

        }
      );

    }


    /* BGM */

    var bgm =
      document.getElementById('setting-bgm');

    if (bgm) {

      ctx.on(
        bgm,
        'change',
        function () {

          var player =
            window._aplayer_instance;

          if (!player) {
            return;
          }

          if (bgm.checked) {
            player.play();
          } else {
            player.pause();
          }

        }
      );

    }


    /* 背景 */

    var backgrounds =
      overlay.querySelectorAll(
        '.settings-background'
      );

    Array.prototype.forEach.call(
      backgrounds,
      function (button) {

        ctx.on(
          button,
          'click',
          function () {

            changeBackground(
              button.dataset.bg
            );

            backgrounds.forEach(
              function (item) {
                item.classList.remove(
                  'is-active'
                );
              }
            );

            button.classList.add(
              'is-active'
            );

          }
        );

      }
    );


    /* 恢复默认 */

    var reset =
      document.getElementById(
        'settings-reset'
      );

    if (reset) {

      ctx.on(
        reset,
        'click',
        resetSettings
      );

    }

  }

  /* ----------------------------------------
   * Settings
   * ---------------------------------------- */

  function applySettings() {

    var webBg =
      document.getElementById('web_bg');

    if (webBg) {

      webBg.classList.toggle(
        'settings-blur',
        settings.blur
      );

    }

    document.documentElement.classList.toggle(
      'settings-disable-animation',
      !settings.animation
    );

  }


  function syncUI() {

    var blur =
      document.getElementById('setting-blur');

    var animation =
      document.getElementById(
        'setting-animation'
      );

    if (blur) {
      blur.checked = settings.blur;
    }

    if (animation) {
      animation.checked =
        settings.animation;
    }

    syncDarkMode();

    syncBGM();

    applySettings();

  }


  function syncDarkMode() {

    var checkbox =
      document.getElementById(
        'setting-darkmode'
      );

    if (!checkbox) {
      return;
    }

    checkbox.checked =
      document.documentElement
        .getAttribute('data-theme') === 'dark';

  }


  function syncBGM() {

    var checkbox =
      document.getElementById(
        'setting-bgm'
      );

    if (!checkbox) {
      return;
    }

    var player =
      window._aplayer_instance;

    checkbox.checked =
      !!player &&
      !player.audio.paused;

  }

  /* ----------------------------------------
   * Background
   * ---------------------------------------- */

  function changeBackground(path) {

    var webBg =
      document.getElementById('web_bg');

    if (!webBg) {
      return;
    }

    webBg.style.backgroundImage =
      'url("' + path + '")';

    localStorage.setItem(
      'azur-blog-background',
      path
    );

  }


  function restoreBackground() {

    var webBg =
      document.getElementById('web_bg');

    if (!webBg) {
      return;
    }

    var saved =
      localStorage.getItem(
        'azur-blog-background'
      );

    if (!saved) {
      return;
    }

    webBg.style.backgroundImage =
      'url("' + saved + '")';

  }

  /* ----------------------------------------
   * Panel control
   * ---------------------------------------- */

  function openPanel() {

    var overlay =
      document.getElementById(
        'settings-overlay'
      );

    if (!overlay) {
      return;
    }

    overlay.classList.add(
      'is-open'
    );

  }


  function closePanel() {

    var overlay =
      document.getElementById(
        'settings-overlay'
      );

    if (!overlay) {
      return;
    }

    overlay.classList.remove(
      'is-open'
    );

  }


  function togglePanel() {

    var overlay =
      document.getElementById(
        'settings-overlay'
      );

    if (!overlay) {
      return;
    }

    overlay.classList.toggle(
      'is-open'
    );

  }

  /* ----------------------------------------
   * Reset
   * ---------------------------------------- */

  function resetSettings() {

    settings =
      Object.assign(
        {},
        defaultSettings
      );

    localStorage.removeItem(
      'azur-blog-background'
    );

    localStorage.removeItem(
      'theme'
    );

    saveSettings();

    window.location.reload();

  }

  /* ----------------------------------------
   * Lifecycle
   * ---------------------------------------- */

  var lifecycle =
    window.BlogLifecycle;

  if (!lifecycle) {
    return;
  }

  lifecycle.register(
    'settings-menu',
    {
      persistent: true,

      mount: function (ctx) {

        createGearButton();

        createPanel(ctx);

        restoreBackground();

      },

      refresh: function () {

        createGearButton();

        syncDarkMode();

        syncBGM();

      }

    }
  );

})();