// web/islands/GalleryExplorer.jsx
// 画廊页：React + 响应式三列/双列/单列 + 图片比例占位 + Lazy Loading + Fancybox
//
// 数据来自构建期生成的 /gallery.json：
//   [{ url, alt, w, h }, ...]
//
// 与旧版 gallery.js 的主要区别：
//   1. 不再通过 offsetHeight 读取真实 DOM 高度做贪心插入。
//   2. 直接利用 gallery.json 的 w/h 估算图片高度。
//   3. ResizeObserver 监听容器宽度，而不是只监听 window.innerWidth。
//   4. React Island 由 BlogLifecycle 管理，PJAX 切页时自动卸载。
//   5. 只有滚动到附近的图片才会真正加载：每张图先占好和最终尺寸一样大的位置
//      （用 w/h 算比例，视觉上和「图片还没下载完」的占位状态没有区别），
//      用一个共享的 IntersectionObserver 监听，进入缓冲区后才把 <img src> 填进去、
//      揭开之后不再收回——图库有上千张图时，这样能保证同一时刻只有少量图片在下载，
//      而不是一次性把全部原图都塞进下载队列。不改变任何看得见的界面。
//   6. 点击图片打开灯箱时，改为直接调用 Fancybox.show(完整列表, {startIndex})，
//      而不是依赖「当前 DOM 里有哪些 [data-fancybox] 元素」。原因：
//      有了「只挂载附近图片」之后，DOM 里不会同时存在全部 <a data-fancybox> 元素，
//      如果还靠 Fancybox 自己扫描 DOM 来决定「上一张/下一张」能翻到哪些图，
//      翻到还没被揭开的图片时就会翻不动。用编程接口传入完整数组，
//      灯箱的上一张/下一张永远能覆盖全部图片，跟当前挂载了哪几张无关。
//      打开的灯箱本身样式和交互不变，只是这一步内部换了接线方式。

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const GAP = 12;

// 图片进入这个距离（像素）之内就开始加载，而不是非要等它真正出现在视口里，
// 减少「刚好卡在边界，用户能看见还在加载」的情况。
const REVEAL_MARGIN = '800px 0px';

function getColumnCount(width) {
  if (width <= 480) return 1;
  if (width <= 768) return 2;
  return 3;
}

function shuffle(source) {
  const arr = [...source];

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr;
}

/**
 * 根据图片宽高比估算每列高度。
 * 不读取 offsetHeight，从而避免在插入图片过程中反复触发布局计算。
 */
function buildColumns(items, count, containerWidth) {
  const columns = Array.from({ length: count }, () => []);

  if (!items.length) {
    return columns;
  }

  // 首次渲染且 ResizeObserver 尚未回调时，给一个合理的估算宽度。
  const width = Math.max(containerWidth || 1000, 1);
  const columnWidth = (width - GAP * (count - 1)) / count;
  const heights = Array(count).fill(0);

  for (const item of items) {
    let target = 0;

    for (let i = 1; i < count; i++) {
      if (heights[i] < heights[target]) {
        target = i;
      }
    }

    columns[target].push(item);

    const ratio =
      Number(item.w) > 0 && Number(item.h) > 0
        ? Number(item.h) / Number(item.w)
        : 1;

    heights[target] += columnWidth * ratio;

    if (columns[target].length > 1) {
      heights[target] += GAP;
    }
  }

  return columns;
}

export function GalleryExplorer({ dataUrl }) {
  const containerRef = useRef(null);

  const [items, setItems] = useState(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [error, setError] = useState(null);

  // gallery.json：失败不缓存，下次进入画廊时可以重新尝试。
  useEffect(() => {
    let cancelled = false;

    fetch(dataUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then((data) => {
        if (cancelled) return;

        if (!Array.isArray(data)) {
          throw new Error('gallery.json 格式错误：顶层必须是数组');
        }

        setItems(data);
      })
      .catch((err) => {
        if (cancelled) return;

        if (window.DSLog) {
          window.DSLog.warn(
            'Gallery',
            '图片列表加载失败',
            { message: err && err.message }
          );
        }

        setError('画廊加载失败');
      });

    return () => {
      cancelled = true;
    };
  }, [dataUrl]);

  // 监听真正的画廊容器尺寸。
  useEffect(() => {
    const element = containerRef.current;

    if (!element) return;

    const updateWidth = () => {
      setContainerWidth(element.clientWidth);
    };

    updateWidth();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(updateWidth);
      observer.observe(element);

      return () => {
        observer.disconnect();
      };
    }

    // 旧浏览器兜底。
    window.addEventListener('resize', updateWidth);

    return () => {
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // 数据加载后只随机一次。
  // 调整窗口大小时不重新打乱图片，避免视觉跳动。
  const shuffledItems = useMemo(() => {
    if (!items) return [];
    return shuffle(items);
  }, [items]);

  const columnCount = getColumnCount(containerWidth);

  const columns = useMemo(
    () =>
      buildColumns(
        shuffledItems,
        columnCount,
        containerWidth
      ),
    [shuffledItems, columnCount, containerWidth]
  );

  // 按 URL 查找一张图在「展示顺序」（即 shuffledItems）里排第几，
  // 供打开灯箱时告诉 Fancybox 从哪一张开始、上一张/下一张分别是谁。
  const indexByUrl = useMemo(() => {
    const map = new Map();
    shuffledItems.forEach((it, i) => map.set(it.url, i));
    return map;
  }, [shuffledItems]);

  // 已经「揭开」（真正渲染 <img src>）过的图片，按 url 记录，揭开后不再收回。
  // 只增不减：用户完整滚过一遍画廊后，等同于全部渲染，但每一时刻的下载压力
  // 只取决于滚动速度，而不是页面一打开就把全部图片一起塞进下载队列。
  const [revealed, setRevealed] = useState(() => new Set());
  const observerRef = useRef(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      // 不支持 IntersectionObserver 的环境：直接全部揭开，
      // 等价于「一次性渲染」，不影响可用性，只是拿不到这次的性能优化。
      setRevealed(new Set(items ? items.map((it) => it.url) : []));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const arrived = entries.filter((e) => e.isIntersecting);
        if (!arrived.length) return;

        setRevealed((prev) => {
          const next = new Set(prev);
          for (const entry of arrived) {
            const url = entry.target.getAttribute('data-url');
            if (url) next.add(url);
            observer.unobserve(entry.target);
          }
          return next;
        });
      },
      { rootMargin: REVEAL_MARGIN }
    );

    observerRef.current = observer;
    return () => observer.disconnect();
  }, [items]);

  // 每张图的包装元素一旦出现在 DOM 里就登记给共享的 observer；
  // 已经揭开过的不用再登记（它已经在渲染真实 <img>，不需要再等交叉检测）。
  const registerNode = useCallback(
    (url) => (node) => {
      if (node && observerRef.current && !revealed.has(url)) {
        observerRef.current.observe(node);
      }
    },
    [revealed]
  );

  // 点击图片：改为直接调用 Fancybox 的编程接口，传入完整列表 + 起始下标，
  // 而不是依赖 DOM 里当前存在哪些 [data-fancybox] 元素——原因见文件顶部说明。
  // 保留 <a href> 不变，只在「普通左键点击」时拦截默认跳转；
  // 中键新标签页打开、Ctrl/Cmd+点击这类浏览器原生行为不受影响。
  const openLightbox = useCallback(
    (event, item) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      event.preventDefault();

      if (!window.Fancybox) {
        if (window.DSLog) {
          window.DSLog.warn('Gallery', 'Fancybox 未加载，改为在新标签页打开原图');
        }
        window.open(item.url, '_blank', 'noopener');
        return;
      }

      window.Fancybox.show(
        shuffledItems.map((it) => ({ src: it.url, caption: it.alt || '' })),
        { startIndex: indexByUrl.get(item.url) || 0 }
      );
    },
    [shuffledItems, indexByUrl]
  );

  if (error) {
    return (
      <div
        ref={containerRef}
        className="gallery-status"
        role="status"
      >
        {error}
      </div>
    );
  }

  if (!items) {
    return (
      <div
        ref={containerRef}
        className="gallery-status"
        role="status"
        aria-live="polite"
      >
        正在加载画廊…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div
        ref={containerRef}
        className="gallery-status"
        role="status"
      >
        暂无图片
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="gallery-grid"
    >
      {columns.map((column, columnIndex) => (
        <div
          className="mg-col"
          key={columnIndex}
        >
          {column.map((item) => {
            const ratio =
              Number(item.w) > 0 && Number(item.h) > 0
                ? Number(item.w) / Number(item.h)
                : 1;
            const isRevealed = revealed.has(item.url);

            return (
              <a
                className="gallery-item"
                href={item.url}
                key={item.url}
                data-url={item.url}
                ref={registerNode(item.url)}
                style={{ aspectRatio: String(ratio) }}
                onClick={(event) => openLightbox(event, item)}
              >
                {isRevealed && (
                  <img
                    data-gallery-image
                    src={item.url}
                    alt={item.alt || ''}
                    loading="lazy"
                    decoding="async"
                    width={item.w || undefined}
                    height={item.h || undefined}
                  />
                )}
              </a>
            );
          })}
        </div>
      ))}
    </div>
  );
}
