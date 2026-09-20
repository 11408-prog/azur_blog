/* ==========================================
 * Azur Blog - Settings Manager
 * ========================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'azur-blog-settings';
  var BG_KEY = 'azur-blog-background';
  var BG_STYLE_ID = 'azur-bg-override';   // 与 inject.head 里的内联脚本共用同一个 <style>

  /* 卡片透明度：
   *   预设 'low' / 'high'，或 'custom'（滑块拖出来的任意值，存在 cardAlpha 里）。
   *   cardAlpha 是卡片背景的 alpha（1 = 完全不透明）；滑块显示的「透明度%」= (1 - alpha) × 100。
   *   最多允许 60% 透明（alpha 不低于 0.4），再低正文会被背景图淹没。 */
  var ALPHA_MIN = 0.4;
  var SLIDER_MAX = Math.round((1 - ALPHA_MIN) * 100);    // 60
  var PRESET_ALPHA = { low: 0.92, high: 0.65 };          // 与 settings-menu.css 里两档的数值保持一致

  var defaultSettings = {
    blur: false,
    animation: true,
    cardOpacity: 'low',    // 'low' | 'high' | 'custom'；默认档即「低透明度」
    cardAlpha: 0.92        // 仅 cardOpacity === 'custom' 时生效
  };

  /* 其余任何值（包括旧版本存进 localStorage 的 'default'）一律按 'low' 处理；cardAlpha 限制在有效范围内 */
  function normalizeSettings(s) {
    if (s.cardOpacity !== 'high' && s.cardOpacity !== 'custom') s.cardOpacity = 'low';
    /* 只接受有限数字：Number(null) / Number('') 都是 0，会被误当成"0 透明度"夹到下限 */
    var a = (typeof s.cardAlpha === 'number' && isFinite(s.cardAlpha)) ? s.cardAlpha : defaultSettings.cardAlpha;
    s.cardAlpha = Math.min(1, Math.max(ALPHA_MIN, Math.round(a * 100) / 100));
    return s;
  }

  function effectiveAlpha() {
    return settings.cardOpacity === 'custom' ? settings.cardAlpha : PRESET_ALPHA[settings.cardOpacity];
  }

  function sliderFromAlpha(a) {
    return Math.round((1 - a) * 100);
  }

  function alphaFromSlider(v) {
    v = Math.min(SLIDER_MAX, Math.max(0, Number(v) || 0));
    return Math.round((1 - v / 100) * 100) / 100;
  }

  var settings = normalizeSettings(loadSettings());

  /* 路径统一由 BlogConfig 派生（见 blog-config.js），不硬编码 /azur_blog/
   * BlogConfig 理论上一定会先于本文件加载，这里加个降级只是为了防御性写法，
   * 和 gallery.js 里 DATA_URL 的处理方式保持一致。 */
  function bgUrl(path) {
    return window.BlogConfig ?
      window.BlogConfig.url(path) :
      path;
  }

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

  /* localStorage 在隐私模式 / 被禁用 / 配额满时会抛异常，
   * 所有读写统一走这几个函数，失败时静默降级（设置仅本次页面有效）。 */
  function storageGet(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); return true; } catch (error) { return false; }
  }

  function storageRemove(key) {
    try { localStorage.removeItem(key); } catch (error) { /* 忽略 */ }
  }

  function saveSettings() {
    storageSet(STORAGE_KEY, JSON.stringify(settings));
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


            <div class="settings-item settings-item-stack">

              <div class="settings-item-info">

                <div class="settings-item-title">
                  卡片透明度
                </div>

                <div class="settings-item-desc">
                  选择「高透明度」可以透出背景图，不使用毛玻璃效果
                </div>

              </div>

              <div class="settings-opacity-group">

                <button
                  class="settings-opacity-option"
                  type="button"
                  data-opacity="low"
                >
                  低透明度
                </button>

                <button
                  class="settings-opacity-option"
                  type="button"
                  data-opacity="high"
                >
                  高透明度
                </button>

              </div>

            </div>


            <div class="settings-item settings-item-stack">

              <div class="settings-slider-head">

                <div class="settings-item-info">

                  <div class="settings-item-title">
                    自定义透明度
                  </div>

                  <div class="settings-item-desc">
                    拖动滑块精确调节，0% 为完全不透明；选上面的预设会同步到对应数值
                  </div>

                </div>

                <output
                  class="settings-slider-value"
                  id="setting-card-alpha-value"
                  for="setting-card-alpha"
                >
                  8%
                </output>

              </div>

              <input
                class="settings-slider"
                type="range"
                id="setting-card-alpha"
                min="0"
                max="60"
                step="1"
                value="8"
                aria-label="自定义卡片透明度"
              >

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
                data-bg="${bgUrl('img/background.jpg')}"
                style="background-image:url('${bgUrl('img/background.jpg')}')"
              >
                <span class="settings-background-label">
                  默认背景
                </span>
              </button>


              <button
                class="settings-background"
                data-bg="${bgUrl('img/covers/enterprise_2.jpg')}"
                style="background-image:url('${bgUrl('img/covers/enterprise_2.jpg')}')"
              >
                <span class="settings-background-label">
                  Enterprise 02
                </span>
              </button>


              <button
                class="settings-background"
                data-bg="${bgUrl('img/phone_cover.jpg')}"
                style="background-image:url('${bgUrl('img/phone_cover.jpg')}')"
              >
                <span class="settings-background-label">
                  手机背景
                </span>
              </button>


              <button
                class="settings-background"
                data-bg="${bgUrl('img/love.jpg')}"
                style="background-image:url('${bgUrl('img/love.jpg')}')"
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


    /* 卡片透明度 */

    var opacityButtons =
      overlay.querySelectorAll(
        '.settings-opacity-option'
      );

    Array.prototype.forEach.call(
      opacityButtons,
      function (button) {

        ctx.on(
          button,
          'click',
          function () {

            settings.cardOpacity =
              button.dataset.opacity;

            saveSettings();

            applySettings();

          }
        );

      }
    );


    /* 自定义透明度滑块 */

    var alphaSlider =
      document.getElementById('setting-card-alpha');

    if (alphaSlider) {

      alphaSlider.min = '0';
      alphaSlider.max = String(SLIDER_MAX);

      /* 拖动过程中实时预览，只改内存和 <html> 上的变量，不写存储 */
      ctx.on(
        alphaSlider,
        'input',
        function () {

          settings.cardOpacity = 'custom';
          settings.cardAlpha = alphaFromSlider(alphaSlider.value);

          applySettings();

        }
      );

      /* 松手（或键盘调完）后再保存，避免拖动时每一帧都写 localStorage */
      ctx.on(
        alphaSlider,
        'change',
        function () {

          saveSettings();

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

            if (changeBackground(button.dataset.bg)) {
              syncActiveBackground(button.dataset.bg);
            }

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

    document.documentElement.setAttribute(
      'data-card-opacity',
      settings.cardOpacity
    );

    /* 只有 data-card-opacity="custom" 时 CSS 才会读这个变量；其余档位下它存在但不起作用 */
    document.documentElement.style.setProperty(
      '--card-alpha',
      String(settings.cardAlpha)
    );

    syncOpacityButtons();

  }


  /* 给当前生效档位的按钮加 is-active，其余去掉 */
  function syncOpacityButtons() {

    var overlay =
      document.getElementById('settings-overlay');

    if (!overlay) {
      return;
    }

    var buttons =
      overlay.querySelectorAll(
        '.settings-opacity-option'
      );

    Array.prototype.forEach.call(
      buttons,
      function (button) {

        button.classList.toggle(
          'is-active',
          button.dataset.opacity === settings.cardOpacity
        );

      }
    );

    /* 滑块和数值跟着当前生效的 alpha 走：选预设 → 滑块跳到该预设对应的位置；
     * 拖动时 slider.value 本来就等于 t，不会打断拖动 */
    var t = sliderFromAlpha(effectiveAlpha());

    var slider =
      overlay.querySelector('#setting-card-alpha');

    var label =
      overlay.querySelector('#setting-card-alpha-value');

    if (slider) {

      if (String(slider.value) !== String(t)) {
        slider.value = String(t);
      }

      /* WebKit 的轨道不能只给"已填充部分"上色，靠这个变量画渐变 */
      slider.style.setProperty(
        '--pct',
        (t / SLIDER_MAX * 100) + '%'
      );

    }

    if (label) {
      label.textContent = t + '%';
    }

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

  /* 背景通过 <style id="azur-bg-override"> 覆盖 #web_bg，而不是直接写行内 style：
   * inject.head 里的内联脚本在首次绘制前就能创建同一个 <style>，页面加载时不会先闪一下默认背景。
   * !important 可以压过主题写在 #web_bg 上的行内背景图。 */
  function applyBackgroundStyle(path) {

    var safe = String(path).replace(/["\\\n\r]/g, '');

    var style = document.getElementById(BG_STYLE_ID);

    if (!style) {
      style = document.createElement('style');
      style.id = BG_STYLE_ID;
      document.head.appendChild(style);
    }

    style.textContent =
      '#web_bg{background-image:url("' + safe + '")!important}';

  }


  function changeBackground(path) {

    if (!document.getElementById('web_bg')) {
      return false;
    }

    applyBackgroundStyle(path);

    storageSet(BG_KEY, path);

    return true;

  }


  /* 根据当前生效的背景路径，给对应按钮加 is-active，
   * 其余按钮去掉——用于页面刷新/PJAX 后恢复视觉状态，
   * 避免"背景是对的，但面板里看不出选中的是哪张"。 */
  function syncActiveBackground(path) {

    var overlay =
      document.getElementById('settings-overlay');

    if (!overlay) {
      return;
    }

    var backgrounds =
      overlay.querySelectorAll(
        '.settings-background'
      );

    Array.prototype.forEach.call(
      backgrounds,
      function (button) {

        button.classList.toggle(
          'is-active',
          button.dataset.bg === path
        );

      }
    );

  }


  function restoreBackground() {

    var saved = storageGet(BG_KEY);

    /* 没有保存过自定义背景时，当前生效的就是主题配置里的默认背景，
     * 这里统一按 bgUrl('img/background.jpg') 计算，保证和面板里
     * "默认背景"按钮的 data-bg 是同一个值，才能正确高亮上。 */
    var currentPath =
      saved || bgUrl('img/background.jpg');

    /* 正常情况下 inject.head 的内联脚本已经处理过；
     * 这里兜底（比如内联脚本没配置），保证背景一定被恢复。 */
    if (saved && document.getElementById('web_bg')) {
      applyBackgroundStyle(saved);
    }

    syncActiveBackground(currentPath);

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

    /* 深色模式/BGM 状态可能在 mount 之后才发生变化
     * （比如 music.js 在 settings-menu.js 之后才创建播放器实例，
     *   或用户通过主题自带按钮切换了深色模式），
     * 每次真正打开面板前重新同步一次，避免显示过期状态。 */
    syncDarkMode();
    syncBGM();

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

    if (overlay.classList.contains('is-open')) {
      closePanel();
    } else {
      openPanel();
    }

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

    storageRemove(BG_KEY);

    storageRemove('theme');

    saveSettings();

    window.location.reload();

  }

  /* 脚本一执行就先把已保存的设置应用到 <html>，
   * 不必等到 DOMContentLoaded 之后 mount → createPanel → syncUI 才生效
   * （更早的一层由 inject.head 里的内联脚本负责，见 themes/butterfly/_config.yml）。 */
  applySettings();

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