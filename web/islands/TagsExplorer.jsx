// web/islands/TagsExplorer.jsx — 标签页：多标签筛选 + 排序
// ------------------------------------------------------------
// 数据来自构建期生成的 /data/tags.json（scripts/tags-data.js）：
//   tags:  [{ name, path, count }]
//   posts: [{ title, path, date, tags: [标签下标, ...] }]
//
// 行为约定：
//   - 匹配方式：「同时包含」= 交集（AND，默认），「包含任一」= 并集（OR）
//   - 交集模式下，标签上的数字是「在当前结果里还有几篇」，选了之后没有交集的标签会变灰不可点，
//     避免用户走进「零结果」的死胡同；并集模式下数字是标签的总文章数
//   - 标签的排列顺序只由「标签排序」决定，不随选择变化——多选时标签不会在鼠标下面乱跳
//   - 没选任何标签时不列文章，只给提示（保持原来标签云页面「以标签为主」的感觉）
//   - 选择状态同步到 URL hash（#tag=a&tag=b&mode=or&tsort=name&psort=title），可分享、刷新不丢
//   - 数据没加载成功时什么也不渲染，Hexo 生成的静态标签云会继续显示（见 tags.mount.jsx）
import { useEffect, useLayoutEffect, useMemo, useState } from 'react';

const collator = new Intl.Collator('zh-Hans-CN');

const MODES = [
  { value: 'and', label: '同时包含', hint: '交集：文章必须包含所有已选标签' },
  { value: 'or', label: '包含任一', hint: '并集：文章包含任意一个已选标签即可' },
];
const TAG_SORTS = [
  { value: 'count', label: '文章数（多 → 少）' },
  { value: 'name', label: '名称（拼音）' },
  { value: 'recent', label: '最近更新' },
];
const POST_SORTS = [
  { value: 'date-desc', label: '日期（新 → 旧）' },
  { value: 'date-asc', label: '日期（旧 → 新）' },
  { value: 'title', label: '标题' },
];
const DEFAULTS = { mode: 'and', tagSort: 'count', postSort: 'date-desc' };

// ---------- 数据加载（模块级缓存：PJAX 来回切换页面不重复请求） ----------
let cached = null;
function loadData(url) {
  if (!cached) {
    cached = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch((err) => {
        cached = null;   // 失败不缓存，下次进入页面可以重试
        throw err;
      });
  }
  return cached;
}

// ---------- URL hash <-> 状态 ----------
const HASH_KEYS = /(^|&)(tag|mode|tsort|psort)=/;

function readHash(tags) {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const byName = new Map(tags.map((t, i) => [t.name, i]));
  const selected = [...new Set(params.getAll('tag').map((n) => byName.get(n)).filter((i) => i !== undefined))];
  const pick = (key, allowed, fallback) => {
    const v = params.get(key);
    return allowed.some((o) => o.value === v) ? v : fallback;
  };
  return {
    selected,
    mode: pick('mode', MODES, DEFAULTS.mode),
    tagSort: pick('tsort', TAG_SORTS, DEFAULTS.tagSort),
    postSort: pick('psort', POST_SORTS, DEFAULTS.postSort),
  };
}

function writeHash(tags, state) {
  const current = window.location.hash.slice(1);
  if (current && !HASH_KEYS.test(current)) return;   // 页面上有别的用途的 hash，不要动它

  const params = new URLSearchParams();
  state.selected.forEach((i) => params.append('tag', tags[i].name));
  if (state.mode !== DEFAULTS.mode) params.set('mode', state.mode);
  if (state.tagSort !== DEFAULTS.tagSort) params.set('tsort', state.tagSort);
  if (state.postSort !== DEFAULTS.postSort) params.set('psort', state.postSort);

  const hash = params.toString();
  if (hash === current) return;
  const url = window.location.pathname + window.location.search + (hash ? '#' + hash : '');
  // replaceState：不新增历史记录，也不会触发 PJAX（PJAX 只监听 popstate 和链接点击）
  window.history.replaceState(window.history.state, '', url);
}

// ---------- 组件 ----------
export function TagsExplorer({ dataUrl, urlFor, onReady }) {
  const [data, setData] = useState(null);
  const [state, setState] = useState(null);   // { selected: number[], mode, tagSort, postSort }

  useEffect(() => {
    let cancelled = false;
    loadData(dataUrl)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setState(readHash(d.tags));
      })
      .catch((err) => {
        if (window.DSLog) window.DSLog.warn('Tags', '标签数据加载失败，保留静态标签云', { message: err && err.message });
      });
    return () => { cancelled = true; };
  }, [dataUrl]);

  // 用 layout effect：在浏览器绘制之前就隐藏静态标签云，避免两套内容同时闪一帧
  useLayoutEffect(() => {
    if (data && onReady) onReady();
  }, [data]);

  useEffect(() => {
    if (data && state) writeHash(data.tags, state);
  }, [data, state]);

  // 每个标签最近一篇文章的日期（'YYYY-MM-DD' 字符串可以直接按字典序比较）
  const latest = useMemo(() => {
    if (!data) return null;
    const out = data.tags.map(() => '');
    for (const p of data.posts) for (const i of p.tags) if (p.date > out[i]) out[i] = p.date;
    return out;
  }, [data]);

  const view = useMemo(() => {
    if (!data || !state) return null;
    const { tags, posts } = data;
    const sel = new Set(state.selected);
    const hasSel = sel.size > 0;

    // 1) 筛选
    let results = [];
    if (hasSel) {
      results = posts.filter((p) =>
        state.mode === 'and'
          ? state.selected.every((i) => p.tags.includes(i))
          : state.selected.some((i) => p.tags.includes(i))
      );
    }

    // 2) 标签上显示的数字
    let counts = tags.map((t) => t.count);
    if (hasSel && state.mode === 'and') {
      counts = tags.map(() => 0);
      for (const p of results) for (const i of p.tags) counts[i]++;
    }

    // 3) 标签排序（只看全局数据，不随选择变化）
    const order = tags.map((_, i) => i).sort((a, b) => {
      if (state.tagSort === 'name') return collator.compare(tags[a].name, tags[b].name);
      if (state.tagSort === 'recent') {
        return latest[b].localeCompare(latest[a]) || tags[b].count - tags[a].count || collator.compare(tags[a].name, tags[b].name);
      }
      return tags[b].count - tags[a].count || collator.compare(tags[a].name, tags[b].name);
    });

    // 4) 文章排序
    results = results.slice().sort((a, b) => {
      if (state.postSort === 'title') return collator.compare(a.title, b.title);
      const byDate = state.postSort === 'date-asc' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      return byDate || collator.compare(a.title, b.title);
    });

    return { tags, sel, hasSel, results, counts, order };
  }, [data, state, latest]);

  if (!view) return null;

  const { tags, sel, hasSel, results, counts, order } = view;
  const update = (patch) => setState((s) => ({ ...s, ...patch }));
  const toggle = (i) =>
    update({ selected: sel.has(i) ? state.selected.filter((x) => x !== i) : [...state.selected, i] });
  const isDisabled = (i) => hasSel && state.mode === 'and' && !sel.has(i) && counts[i] === 0;
  const modeLabel = MODES.find((m) => m.value === state.mode).label;

  return (
    <section className="tags-explorer" aria-label="标签筛选">
      <div className="tags-toolbar" role="group" aria-label="筛选与排序">
        <div className="tags-field">
          <span id="tags-mode-label">匹配方式</span>
          <div className="tags-segmented" role="radiogroup" aria-labelledby="tags-mode-label">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                role="radio"
                aria-checked={state.mode === m.value}
                className="tags-segment"
                title={m.hint}
                onClick={() => update({ mode: m.value })}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <label className="tags-field">
          <span>标签排序</span>
          <select value={state.tagSort} onChange={(e) => update({ tagSort: e.target.value })}>
            {TAG_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        <label className="tags-field">
          <span>文章排序</span>
          <select value={state.postSort} onChange={(e) => update({ postSort: e.target.value })}>
            {POST_SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      <div className="tags-cloud" role="group" aria-label="标签">
        {order.map((i) => (
          <button
            key={tags[i].name}
            type="button"
            className="tags-chip"
            aria-pressed={sel.has(i)}
            disabled={isDisabled(i)}
            onClick={() => toggle(i)}
          >
            <span className="tags-chip-name">{tags[i].name}</span>
            <span className="tags-chip-count">{counts[i]}</span>
          </button>
        ))}
      </div>

      <div className="tags-summary-row">
        <div className="tags-summary" role="status" aria-live="polite">
          {hasSel
            ? `已选 ${sel.size} 个标签${sel.size > 1 ? '（' + modeLabel + '）' : ''} · 共 ${results.length} 篇文章`
            : '点击上方标签开始筛选，可以同时选择多个'}
        </div>
        {hasSel && (
          <button type="button" className="tags-clear" onClick={() => update({ selected: [] })}>
            清除选择
          </button>
        )}
      </div>

      {hasSel && results.length === 0 && (
        <p className="tags-empty">没有同时包含这些标签的文章，试试切换为「包含任一」，或清除选择。</p>
      )}

      {results.length > 0 && (
        <ol className="tags-results">
          {results.map((p) => (
            <li key={p.path} className="tags-result">
              <a className="tags-result-title" href={urlFor(p.path)}>{p.title}</a>
              <time className="tags-result-date" dateTime={p.date}>{p.date}</time>
              <span className="tags-result-tags">
                {p.tags.map((i) => (
                  <span key={i} className={'tags-mini' + (sel.has(i) ? ' is-selected' : '')}>{tags[i].name}</span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
