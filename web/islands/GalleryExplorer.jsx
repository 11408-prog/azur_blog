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

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

const GAP = 12;

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

  // Butterfly Fancybox / lightbox 初始化。
  useEffect(() => {
    if (!items || !containerRef.current) {
      return;
    }

    const images = containerRef.current.querySelectorAll(
      'img[data-gallery-image]'
    );

    if (
      window.btf &&
      typeof window.btf.loadLightbox === 'function'
    ) {
      window.btf.loadLightbox(images);
    }
  }, [columns, items]);

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
          {column.map((item) => (
            <a
              className="gallery-item"
              href={item.url}
              data-fancybox="gallery"
              data-caption={item.alt || ''}
              key={item.url}
            >
              <img
                data-gallery-image
                src={item.url}
                alt={item.alt || ''}
                loading="lazy"
                decoding="async"
                width={item.w || undefined}
                height={item.h || undefined}
              />
            </a>
          ))}
        </div>
      ))}
    </div>
  );
}
