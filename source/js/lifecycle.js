/* 统一 PJAX 生命周期管理 BlogLifecycle
 * ------------------------------------------------------------
 * 解决的问题（见《需要解决的问题.md》P1-3）：
 *   各脚本自行注册 DOMContentLoaded / pjax:complete，初始化内部创建的
 *   监听器、定时器、Observer、DOM 节点没有统一清理，PJAX 反复切换后
 *   容易重复实例化、事件多次触发、内存泄漏。
 *
 * 用法（在模块 IIFE 内）：
 *   BlogLifecycle.register('weather', {
 *     mount: function (ctx) {
 *       // ctx 提供的资源登记方法会自动在 destroy 时回收
 *       ctx.interval(updateClock, 1000);
 *       ctx.on(document, 'click', handler);
 *       ctx.observer(new MutationObserver(fn));
 *       ctx.append(document.body, node);
 *     },
 *     destroy: function (ctx) { ... },   // 可选：ctx 资源已自动回收，这里只处理第三方实例
 *     refresh: function (ctx) { ... },   // 可选：persistent 模块在 PJAX 后更新页面相关部分
 *     persistent: true                   // 可选：全局常驻模块，PJAX 后不 destroy、只 refresh
 *   });
 *
 * 关键保证：
 *   1. mount() 一定在 destroy()（或 refresh()）之后才可能再次执行 → 不会叠加实例
 *   2. 全站只有一个 pjax:complete 监听器（由本文件统一注册）
 *   3. 单个模块抛错不影响其他模块（异常被捕获并交给 DSLog）
 *
 * 加载顺序要求：必须在 logger.js 之后（依赖 DSLog，缺失时自动降级）。
 */
(function () {
  'use strict';

  var log = window.DSLog || {
    debug: function () {}, info: function () {}, warn: function () {}, error: function () {}
  };

  var _modules = [];       // 注册顺序即执行顺序
  var _pjaxBound = false;  // 全站只绑定一次 pjax:complete
  var _initialMountDone = false;

  // ---------- 资源登记上下文 ----------
  // 模块在 mount 期间通过 ctx 申请的每类资源都会被记录，destroy 时自动回收。
  function createCtx(name) {
    var listeners = [];   // { target, type, fn, opts }
    var intervals = [];   // id
    var timeouts = [];    // id
    var observers = [];   // MutationObserver / ResizeObserver / IntersectionObserver
    var nodes = [];       // { parent, node }
    var rafIds = [];      // requestAnimationFrame id

    return {
      name: name,

      // 事件监听：登记后自动 removeEventListener
      on: function (target, type, fn, opts) {
        if (!target || typeof target.addEventListener !== 'function') return fn;
        target.addEventListener(type, fn, opts);
        listeners.push({ target: target, type: type, fn: fn, opts: opts });
        return fn;
      },

      // 定时器：登记后自动 clearInterval
      interval: function (fn, ms) {
        var id = setInterval(fn, ms);
        intervals.push(id);
        return id;
      },

      // 延时器：登记后自动 clearTimeout（已触发的清除无副作用）
      timeout: function (fn, ms) {
        var id = setTimeout(function () {
          fn();
        }, ms);
        timeouts.push(id);
        return id;
      },

      // 动画帧：登记后自动 cancelAnimationFrame
      raf: function (fn) {
        var id = requestAnimationFrame(fn);
        rafIds.push(id);
        return id;
      },

      // 各类 Observer：登记后自动 disconnect
      observer: function (obs) {
        if (obs && typeof obs.disconnect === 'function') observers.push(obs);
        return obs;
      },

      // 动态插入的 DOM 节点：登记后自动从父节点移除
      append: function (parent, node) {
        if (!parent || !node) return node;
        parent.appendChild(node);
        nodes.push({ parent: parent, node: node });
        return node;
      },

      // 统一回收（由生命周期管理器调用，模块一般不需要手动调）
      cleanup: function () {
        var i;
        for (i = 0; i < listeners.length; i++) {
          var l = listeners[i];
          try { l.target.removeEventListener(l.type, l.fn, l.opts); } catch (e) {}
        }
        for (i = 0; i < intervals.length; i++) clearInterval(intervals[i]);
        for (i = 0; i < timeouts.length; i++) clearTimeout(timeouts[i]);
        for (i = 0; i < rafIds.length; i++) {
          if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(rafIds[i]);
        }
        for (i = 0; i < observers.length; i++) {
          try { observers[i].disconnect(); } catch (e) {}
        }
        // 倒序移除，先插入的后移除，避免嵌套节点重复操作
        for (i = nodes.length - 1; i >= 0; i--) {
          var n = nodes[i];
          try {
            if (n.node && n.node.parentNode === n.parent) n.parent.removeChild(n.node);
          } catch (e) {}
        }
        listeners.length = 0;
        intervals.length = 0;
        timeouts.length = 0;
        rafIds.length = 0;
        observers.length = 0;
        nodes.length = 0;
      }
    };
  }

  // ---------- 安全执行包装 ----------
  function safeCall(mod, fnName, ctx) {
    var fn = mod[fnName];
    if (typeof fn !== 'function') return;
    try {
      fn(ctx);
    } catch (e) {
      log.error('Lifecycle', mod.name + ' 的 ' + fnName + '() 执行失败', {
        message: e && e.message, stack: e && e.stack
      });
    }
  }

  function mountModule(mod) {
    if (mod.mounted) {
      log.debug('Lifecycle', mod.name + ' 已挂载，跳过重复 mount');
      return;
    }
    mod.ctx = createCtx(mod.name);
    safeCall(mod, 'mount', mod.ctx);
    mod.mounted = true;
    log.debug('Lifecycle', mod.name + ' 已挂载');
  }

  function destroyModule(mod) {
    if (!mod.mounted) return;
    // 先让模块自己释放第三方实例（如播放器），再回收 ctx 登记的资源
    safeCall(mod, 'destroy', mod.ctx);
    if (mod.ctx) mod.ctx.cleanup();
    mod.mounted = false;
    log.debug('Lifecycle', mod.name + ' 已销毁');
  }

  // ---------- 生命周期驱动 ----------
  function mountAll() {
    _initialMountDone = true;
    for (var i = 0; i < _modules.length; i++) mountModule(_modules[i]);
  }

  // PJAX 后：常驻模块只 refresh，页面级模块 destroy → mount
  function onPjaxComplete() {
    for (var i = 0; i < _modules.length; i++) {
      var mod = _modules[i];
      if (mod.persistent) {
        if (!mod.mounted) { mountModule(mod); continue; }
        // 常驻模块的 DOM 引用可能随 #body-wrap 替换而失效，给它一个更新时机
        safeCall(mod, 'refresh', mod.ctx);
        log.debug('Lifecycle', mod.name + ' 常驻模块已刷新');
      } else {
        destroyModule(mod);
        mountModule(mod);
      }
    }
  }

  function bindPjaxOnce() {
    if (_pjaxBound) return;
    _pjaxBound = true;
    document.addEventListener('pjax:complete', onPjaxComplete);
    // 部分 PJAX 实现会在开始切换时先卸载，这里同样提供钩子给需要的模块
    document.addEventListener('pjax:send', function () {
      for (var i = 0; i < _modules.length; i++) {
        safeCall(_modules[i], 'onSend', _modules[i].ctx);
      }
    });
  }

  // ---------- 对外 API ----------
  window.BlogLifecycle = {
    /**
     * 注册一个受管模块。
     * @param {string} name 模块名（用于日志，重名会被拒绝）
     * @param {object} hooks { mount, destroy?, refresh?, onSend?, persistent? }
     */
    register: function (name, hooks) {
      if (!name || !hooks || typeof hooks.mount !== 'function') {
        log.warn('Lifecycle', '注册失败：需要 name 与 mount()', { name: name });
        return null;
      }
      for (var i = 0; i < _modules.length; i++) {
        if (_modules[i].name === name) {
          log.warn('Lifecycle', '模块重复注册，已忽略: ' + name);
          return null;
        }
      }
      var mod = {
        name: name,
        mount: hooks.mount,
        destroy: hooks.destroy,
        refresh: hooks.refresh,
        onSend: hooks.onSend,
        persistent: !!hooks.persistent,
        mounted: false,
        ctx: null
      };
      _modules.push(mod);
      bindPjaxOnce();
      // 首次加载：DOM 就绪后立即挂载（inject 脚本在 </body> 前执行，通常仍在 parsing）
      if (_initialMountDone) mountModule(mod);
      return mod;
    },

    // 查询某模块是否已挂载（调试用）
    isMounted: function (name) {
      for (var i = 0; i < _modules.length; i++) {
        if (_modules[i].name === name) return _modules[i].mounted;
      }
      return false;
    },

    // 列出已注册模块（调试用）
    list: function () {
      return _modules.map(function (m) {
        return { name: m.name, mounted: m.mounted, persistent: m.persistent };
      });
    }
  };

  // 首次挂载时机
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    mountAll();
  }

  log.info('Lifecycle', '生命周期管理器已就绪');
})();
