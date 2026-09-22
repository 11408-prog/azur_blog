// web/islands/ActivityHeatmap.jsx
// 首页活跃度热力图（Git 提交版 · 四季度横排）
//
// 保留原 activity.js 的数据与视觉规则：
// - 1–3月 / 4–6月 / 7–9月 / 10–12月
// - 周一对齐
// - 0 / 1 / 2 / 3-4 / 5+ 五档
// - 总计 / 过去一月 / 最近一周
// - 桌面端显示，<= 1024px 隐藏

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

const SEASONS = [
  { name: '1–3月', startMonth: 0, endMonth: 2 },
  { name: '4–6月', startMonth: 3, endMonth: 5 },
  { name: '7–9月', startMonth: 6, endMonth: 8 },
  { name: '10–12月', startMonth: 9, endMonth: 11 },
];

const DESKTOP_QUERY = '(min-width: 1025px)';

let cachedData = null;
let cachedPromise = null;

function loadData(url) {
  if (cachedData) return Promise.resolve(cachedData);

  if (!cachedPromise) {
    cachedPromise = fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (
          !data ||
          Array.isArray(data) ||
          typeof data !== 'object'
        ) {
          throw new Error(
            'activity.json 格式错误：必须是对象'
          );
        }

        cachedData = data;
        return data;
      })
      .catch((error) => {
        cachedPromise = null;
        throw error;
      });
  }

  return cachedPromise;
}

function pad(number) {
  return number < 10 ? `0${number}` : String(number);
}

function getLevel(count) {
  if (!count) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
}

function parseKey(key) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);

  if (!match) return null;

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
}

function normalizeDate(date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function formatDate(date) {
  return (
    date.getFullYear() +
    '-' +
    pad(date.getMonth() + 1) +
    '-' +
    pad(date.getDate())
  );
}

function getEarliestDate(data) {
  const keys = Object.keys(data)
    .filter((key) => parseKey(key))
    .sort();

  return keys.length ? parseKey(keys[0]) : null;
}

function getStats(data) {
  const today = normalizeDate(new Date());
  const startDate = getEarliestDate(data) || today;

  const oneMonthAgo = new Date(today);
  oneMonthAgo.setDate(today.getDate() - 29);

  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 6);

  let totalCount = 0;
  let monthCount = 0;
  let weekCount = 0;

  for (const [key, rawCount] of Object.entries(data)) {
    const date = parseKey(key);
    if (!date) continue;

    const count =
      typeof rawCount === 'number'
        ? rawCount
        : Number(rawCount) || 0;

    if (date >= startDate && date <= today) totalCount += count;
    if (date >= oneMonthAgo && date <= today) monthCount += count;
    if (date >= oneWeekAgo && date <= today) weekCount += count;
  }

  return {
    totalCount,
    monthCount,
    weekCount,
    totalRange:
      `${formatDate(startDate)} - ${formatDate(today)}`,
    monthRange:
      `${formatDate(oneMonthAgo)} - ${formatDate(today)}`,
    weekRange:
      `${formatDate(oneWeekAgo)} - ${formatDate(today)}`,
  };
}

function buildSeasonDays(year, season, data) {
  const start = new Date(year, season.startMonth, 1);
  const end = new Date(year, season.endMonth + 1, 0);

  const firstDayIndex =
    (start.getDay() + 6) % 7;

  const days = [];

  for (let i = 0; i < firstDayIndex; i++) {
    days.push({
      key: `empty-start-${i}`,
      empty: true,
    });
  }

  const cursor = new Date(start);

  while (cursor <= end) {
    const key =
      cursor.getFullYear() +
      '-' +
      pad(cursor.getMonth() + 1) +
      '-' +
      pad(cursor.getDate());

    const rawCount = data[key];
    const count =
      typeof rawCount === 'number'
        ? rawCount
        : Number(rawCount) || 0;

    days.push({
      key,
      empty: false,
      count,
      level: getLevel(count),
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  const lastDayIndex =
    (end.getDay() + 6) % 7;

  for (let i = lastDayIndex + 1; i < 7; i++) {
    days.push({
      key: `empty-end-${i}`,
      empty: true,
    });
  }

  return days;
}

function SeasonBlock({ year, season, data }) {
  const days = useMemo(
    () => buildSeasonDays(year, season, data),
    [year, season, data]
  );

  return (
    <div className="season-block">
      <div className="season-label">
        {season.name}
      </div>

      <div className="season-grid">
        {days.map((day) =>
          day.empty ? (
            <div
              className="heatmap-cell"
              key={day.key}
              aria-hidden="true"
              style={{ visibility: 'hidden' }}
            />
          ) : (
            <div
              className={`heatmap-cell level-${day.level}`}
              key={day.key}
              title={`${day.key}：${day.count} 次提交`}
            />
          )
        )}
      </div>
    </div>
  );
}

function Stat({ value, label, range }) {
  return (
    <div className="stat-item">
      <div className="stat-num">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-range">{range}</div>
    </div>
  );
}

function HeatmapLegend() {
  return (
    <div className="heatmap-legend">
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((level) => (
        <span
          key={level}
          className={`heatmap-legend-box level-${level}`}
          aria-hidden="true"
        />
      ))}
      <span>More</span>
    </div>
  );
}

function isDesktopQuery() {
  return window.matchMedia
    ? window.matchMedia(DESKTOP_QUERY).matches
    : true;
}

export function ActivityHeatmap({ dataUrl }) {
  const [isDesktop, setIsDesktop] = useState(isDesktopQuery);
  const [data, setData] = useState(cachedData);
  const [status, setStatus] = useState(
    cachedData ? 'ready' : 'idle'
  );
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!window.matchMedia) return undefined;

    const mediaQuery = window.matchMedia(DESKTOP_QUERY);

    const handleChange = (event) => {
      setIsDesktop(event.matches);
    };

    handleChange(mediaQuery);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  useEffect(() => {
    if (!isDesktop || data) return undefined;

    let cancelled = false;

    setStatus('loading');
    setError(null);

    loadData(dataUrl)
      .then((nextData) => {
        if (cancelled) return;

        setData(nextData);
        setStatus('ready');
      })
      .catch((nextError) => {
        if (cancelled) return;

        const message =
          nextError?.message || '未知错误';

        if (window.DSLog) {
          window.DSLog.warn(
            'Activity',
            '活跃度数据加载失败',
            { message }
          );
        }

        setError(message);
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [isDesktop, data, dataUrl]);

  if (!isDesktop) {
    return null;
  }

  if (status === 'idle' || status === 'loading') {
    return (
      <div
        className="heatmap-fallback heatmap-loading"
        role="status"
        aria-live="polite"
      >
        正在加载活跃度…
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div
        className="heatmap-fallback"
        role="alert"
      >
        活跃度数据加载失败
        {error ? `（${error}）` : ''}
      </div>
    );
  }

  if (!data) return null;

  const year = new Date().getFullYear();
  const stats = getStats(data);

  return (
    <>
      <div
        className="seasons-row"
        aria-label={`${year} 年活跃度`}
      >
        {SEASONS.map((season) => (
          <SeasonBlock
            key={season.name}
            year={year}
            season={season}
            data={data}
          />
        ))}
      </div>

      <div className="heatmap-stats">
        <Stat
          value={stats.totalCount}
          label="总计提交"
          range={stats.totalRange}
        />
        <Stat
          value={stats.monthCount}
          label="过去一月提交"
          range={stats.monthRange}
        />
        <Stat
          value={stats.weekCount}
          label="最近一周提交"
          range={stats.weekRange}
        />
      </div>

      <div className="heatmap-footer">
        <HeatmapLegend />

        <div className="heatmap-source">
          数据来源：本网站Git提交记录
        </div>
      </div>
    </>
  );
}
