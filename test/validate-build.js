// test/validate-build.js — 构建产物校验
// 用法:
//   node test/validate-build.js           完整检查
//   node test/validate-build.js --quick   快速检查（跳过文章扫描等耗时项）
//   node test/validate-build.js --strict  严格模式（警告也视为失败）
//   npm test                              等价于第一行

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

const results = [];
const pass  = (msg) => results.push({ level: 'pass', msg });
const warn  = (msg) => results.push({ level: 'warn', msg });
const error = (msg) => results.push({ level: 'error', msg });

const QUICK = process.argv.includes('--quick');

/**
 * 从 _config.yml 读取 root（前端资源前缀）。
 * 路径硬编码治理后（见《需要解决的问题.md》P1-8），前端 JS 与构建脚本
 * 均从同一份 root 派生，校验脚本也不应再写死 '/azur_blog/'。
 * 读取失败时退回默认值，避免校验本身崩溃。
 */
function readSiteRoot() {
  const file = path.join(ROOT, '_config.yml');
  try {
    const m = fs.readFileSync(file, 'utf-8').match(/^root:\s*(\S+)/m);
    if (!m) return '/azur_blog/';
    let r = m[1].replace(/['"]/g, '');
    if (!r.startsWith('/')) r = '/' + r;
    if (!r.endsWith('/')) r = r + '/';
    return r;
  } catch (e) {
    return '/azur_blog/';
  }
}
const SITE_ROOT = readSiteRoot();

// ─── 工具函数 ───────────────────────────────────────────────

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (e) {
    error(`无法解析 JSON: ${path.relative(ROOT, filePath)} — ${e.message}`);
    return null;
  }
}

/** 递归收集匹配的文件路径 */
function walk(dir, pattern, limit = 500) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function scan(d) {
    if (out.length >= limit) return;
    for (const name of fs.readdirSync(d, { withFileTypes: true })) {
      if (out.length >= limit) return;
      const full = path.join(d, name.name);
      if (name.isDirectory()) scan(full);
      else if (pattern.test(name.name)) out.push(full);
    }
  })(dir);
  return out;
}

/** 扫描 source/_posts/ 下所有 .md（排除 index.md 和 _drafts） */
function walkPosts(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  (function scan(d) {
    for (const name of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, name.name);
      if (name.isDirectory() && name.name !== '_drafts') scan(full);
      else if (name.name.endsWith('.md') && name.name !== 'index.md') out.push(full);
    }
  })(dir);
  return out;
}

/**
 * 从主题配置中提取 inject 段引用的本地资源路径
 * 返回 { css: string[], js: string[] }（已去掉 ?v= 参数）
 */
function extractInjectRefs() {
  const file = path.join(ROOT, 'themes', 'butterfly', '_config.yml');
  if (!fs.existsSync(file)) return { css: [], js: [] };
  // 标准化 CRLF → LF，避免 Windows 换行导致正则失败
  const content = fs.readFileSync(file, 'utf-8').replace(/\r\n/g, '\n');

  // 提取 inject: 段（贪婪匹配到下一个顶层 key 或文件末尾）
  const sectionMatch = content.match(/^inject:[\s\S]+?(?=\n[a-zA-Z][a-zA-Z_]*:)/m);
  if (!sectionMatch) return { css: [], js: [] };
  const section = sectionMatch[0];

  const css = [], js = [];
  const lines = section.split('\n');
  for (const line of lines) {
    // href="<root>css/xxx.css?v=1.2"
    const hrefMatch = line.match(/href="([^"]+)"/);
    if (hrefMatch && hrefMatch[1].startsWith(SITE_ROOT)) {
      css.push(hrefMatch[1].split('?')[0]);
    }
    // src="<root>js/xxx.js?v=1.2"
    const srcMatch = line.match(/src="([^"]+)"/);
    if (srcMatch && srcMatch[1].startsWith(SITE_ROOT)) {
      js.push(srcMatch[1].split('?')[0]);
    }
  }
  return { css, js };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  检查项
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ── A. 配置检查 ──

function checkSiteConfig() {
  const file = path.join(ROOT, '_config.yml');
  if (!fs.existsSync(file)) {
    warn('未找到 _config.yml，跳过配置检查');
    return;
  }
  const content = fs.readFileSync(file, 'utf-8');

  // root 必须为 /azur_blog/（前端 JS 写死了该前缀）
  const rootMatch = content.match(/^root:\s*(\S+)/m);
  if (rootMatch) {
    const root = rootMatch[1].replace(/['"]/g, '');
    if (root === '/azur_blog/') {
      pass('root 配置正确 (/azur_blog/)');
    } else {
      error(`root = "${root}"，前端 JS 写死了 /azur_blog/，改了会全站资源错位`);
    }
  }

  // url 与 root 一致性
  const urlMatch = content.match(/^url:\s*(\S+)/m);
  if (urlMatch && rootMatch) {
    const url = urlMatch[1].replace(/['"]/g, '');
    const root = rootMatch[1].replace(/['"]/g, '');
    if (url.endsWith(root.replace(/\/$/, ''))) {
      pass(`url (${url}) 与 root (${root}) 一致`);
    } else {
      warn(`url "${url}" 与 root "${root}" 可能不一致，请检查`);
    }
  }
}

// ── B. 静态资源检查 ──

function checkKeyAssets() {
  const required = [
    'img/avatar.png',
    'img/favicon.png',
    'videos/cover.mp4',
    'music/bgm.mp3',
  ];
  const missing = required.filter(f => !fs.existsSync(path.join(PUBLIC, f)));
  if (missing.length) {
    warn(`关键资源缺失: ${missing.join(', ')}`);
  } else {
    pass('关键资源全部存在 (avatar / favicon / cover.mp4 / bgm.mp3)');
  }
}

// ── C. Inject 引用检查 ──

function checkInjectRefs() {
  const { css, js } = extractInjectRefs();
  const all = [...css, ...js];

  if (all.length === 0) {
    warn('未能从主题配置提取 inject 引用，跳过检查');
    return;
  }

  // 1) 文件是否存在于 public/
  const missing = [];
  for (const ref of all) {
    const localPath = ref.replace('/azur_blog/', '');
    if (!fs.existsSync(path.join(PUBLIC, localPath))) {
      missing.push(ref);
    }
  }
  if (missing.length) {
    error(`inject 引用的文件在构建产物中不存在:\n  ${missing.join('\n  ')}`);
  } else {
    pass(`inject 引用的 ${all.length} 个本地资源全部存在于构建产物`);
  }

  // 2) 版本号检查（开发守则第 6 节：改完 CSS/JS 必须升版本号）
  const themeFile = path.join(ROOT, 'themes', 'butterfly', '_config.yml');
  const content = fs.readFileSync(themeFile, 'utf-8').replace(/\r\n/g, '\n');
  const sectionMatch = content.match(/^inject:[\s\S]+?(?=\n[a-zA-Z][a-zA-Z_]*:)/m);
  if (!sectionMatch) return;
  const section = sectionMatch[0];

  const noVersion = [];
  const lines = section.split('\n');
  for (const line of lines) {
    const hrefMatch = line.match(/href="([^"]+)"/);
    const srcMatch = line.match(/src="([^"]+)"/);
    const match = hrefMatch || srcMatch;
    if (match && match[1].startsWith('/azur_blog/')) {
      if (!/\?v=/.test(match[1])) {
        const ref = match[1].split('?')[0];
        noVersion.push(ref);
      }
    }
  }
  if (noVersion.length) {
    warn(`以下 inject 资源缺少版本号 (?v=)，改文件后浏览器缓存不失效:\n  ${noVersion.join('\n  ')}`);
  } else {
    pass('inject 本地资源均带版本号');
  }
}

// ── D. 关键页面 HTML 检查 ──

function checkKeyPages() {
  const pages = [
    'index.html',
    'gallery/index.html',
    'categories/index.html',
    'tags/index.html',
  ];
  const missing = pages.filter(p => !fs.existsSync(path.join(PUBLIC, p)));
  if (missing.length) {
    error(`关键页面未生成: ${missing.join(', ')}`);
  } else {
    pass('关键页面 HTML 全部生成 (首页 / 画廊 / 分类 / 标签)');
  }
}

// ── E. 文章 front matter 检查 ──

function checkPostFrontMatter() {
  if (QUICK) return; // 快速模式跳过

  const postsDir = path.join(ROOT, 'source', '_posts');
  const files = walkPosts(postsDir);
  let validCount = 0;

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) {
      warn(`缺少 front matter: ${path.relative(postsDir, file)}`);
      continue;
    }
    const fm = fmMatch[1];
    const missing = [];
    if (!/^title:\s*.+/m.test(fm)) missing.push('title');
    if (!/^date:\s*.+/m.test(fm)) missing.push('date');
    if (!/^categories:\s*.+/m.test(fm)) missing.push('categories');

    if (missing.length) {
      warn(`${path.relative(postsDir, file)} 缺少: ${missing.join(', ')}`);
    } else {
      validCount++;
    }
  }
  pass(`文章 front matter 检查完成（${files.length} 篇，${validCount} 篇完整）`);
}

// ── F. 图片格式真实性检查（防 HEIF 伪装 .jpg）──

function checkImageFormats() {
  const imgs = walk(path.join(PUBLIC, 'img'), /\.(jpe?g|png)$/i, 300);

  // 已知 HEIF/HEVC brand（iPhone 拍摄常见）
  const heifBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];
  const heifIssues = [];

  for (const file of imgs) {
    try {
      const buf = Buffer.alloc(12);
      const fd = fs.openSync(file, 'r');
      fs.readSync(fd, buf, 0, 12, 0);
      fs.closeSync(fd);

      const brand = buf.slice(8, 12).toString('ascii');
      // 检查 ftyp 容器 + HEIF brand
      const isFtyp = buf.slice(4, 8).toString('ascii') === 'ftyp';
      if (isFtyp && heifBrands.includes(brand)) {
        const ext = path.extname(file).toLowerCase();
        if (ext === '.jpg' || ext === '.jpeg') {
          heifIssues.push(`${path.relative(PUBLIC, file)} (HEIF 内容伪装 .jpg)`);
        } else if (ext === '.png') {
          heifIssues.push(`${path.relative(PUBLIC, file)} (HEIF 内容伪装 .png)`);
        }
      }
    } catch (_) { /* 跳过不可读文件 */ }
  }

  if (heifIssues.length) {
    error(`发现 HEIF 格式图片使用了错误扩展名（iPhone 常见坑）:\n  ${heifIssues.join('\n  ')}\n  修复: 用 compress-images.js 或 sharp 转为真实 jpg/png`);
  } else {
    pass(`图片格式检查通过（抽检 ${imgs.length} 张）`);
  }
}

// ── G. gallery.json（画廊瀑布流数据）──

function checkGallery() {
  const file = path.join(PUBLIC, 'gallery.json');
  if (!fs.existsSync(file)) {
    error('gallery.json 不存在');
    return;
  }
  const data = readJson(file);
  if (!data) return;
  if (!Array.isArray(data)) {
    error('gallery.json 必须是数组');
    return;
  }
  if (data.length === 0) {
    // 开发守则第 11 节大坑：空画廊部署上去线上画廊空白
    error('gallery.json 为空数组（画廊无图，线上将显示空白画廊）');
    return;
  }

  let noUrl = 0, noDim = 0;
  data.forEach((item, i) => {
    if (!item.url) { error(`gallery[${i}] 缺少 url`); noUrl++; }
    if (!item.w || !item.h) noDim++;
  });
  if (noUrl > 0) {
    // url 缺失是硬伤，前端无法渲染
  } else if (noDim > 0) {
    // w/h 缺失只是视觉降级，前端用默认占位兜底
    warn(`gallery.json 有 ${noDim}/${data.length} 张图片缺少尺寸信息（前端有默认占位，非阻断项）`);
  } else {
    pass(`gallery.json 检查通过（${data.length} 张图片）`);
  }
}

// ── H. activity.json（活跃度热力图数据）──

function checkActivity() {
  const file = path.join(PUBLIC, 'data', 'activity.json');
  if (!fs.existsSync(file)) {
    error('data/activity.json 不存在');
    return;
  }
  const data = readJson(file);
  if (!data) return;
  if (Array.isArray(data)) {
    error('activity.json 不能是数组，必须是 { "2026-09-01": 1 } 格式');
    return;
  }
  const keys = Object.keys(data);
  if (keys.length === 0) {
    warn('activity.json 为空对象（热力图将无数据）');
  } else {
    // 抽检 key 格式
    const badKeys = keys.filter(k => !/^\d{4}-\d{2}-\d{2}$/.test(k));
    if (badKeys.length) {
      warn(`activity.json 有 ${badKeys.length} 个 key 不是 YYYY-MM-DD 格式`);
    } else {
      // 抽检 value 类型
      const badVals = keys.slice(0, 10).filter(k => typeof data[k] !== 'number');
      if (badVals.length) {
        warn(`activity.json 有非数字值: ${badVals.join(', ')}`);
      } else {
        pass(`activity.json 检查通过（${keys.length} 天数据）`);
      }
    }
  }
}

// ── I. carousel-list.json（轮播/磁贴图片列表）──

function checkCarousel() {
  const file = path.join(PUBLIC, 'carousel-list.json');
  if (!fs.existsSync(file)) {
    error('carousel-list.json 不存在');
    return;
  }
  const data = readJson(file);
  if (!data) return;
  if (!data.images || !Array.isArray(data.images)) {
    error('carousel-list.json 缺少 images 数组');
    return;
  }
  pass(`carousel-list.json 检查通过（${data.images.length} 张）`);
}

// ── J. tags.json（标签页数据，供 React 岛做多标签筛选）──

function checkTagsData() {
  const file = path.join(PUBLIC, 'data', 'tags.json');
  if (!fs.existsSync(file)) {
    error('data/tags.json 不存在（标签页的 React 岛没有数据，会回退为静态标签云）');
    return;
  }
  const data = readJson(file);
  if (!data) return;
  if (!data || !Array.isArray(data.tags) || !Array.isArray(data.posts)) {
    error('tags.json 必须是 { "tags": [], "posts": [] } 结构');
    return;
  }

  const n = data.tags.length;
  const bad = [];
  data.tags.forEach((t, i) => {
    if (!t || !t.name || !t.path || !(t.count > 0)) bad.push(`tags[${i}]`);
  });
  data.posts.forEach((p, i) => {
    const ok = p && p.title && p.path && p.date && Array.isArray(p.tags) && p.tags.length > 0 &&
      p.tags.every((x) => Number.isInteger(x) && x >= 0 && x < n);
    if (!ok) bad.push(`posts[${i}]`);
  });

  if (bad.length) {
    error(`tags.json 有 ${bad.length} 处结构错误（下标越界 / 缺字段）: ${bad.slice(0, 5).join(', ')}`);
  } else if (n === 0) {
    warn('tags.json 没有任何标签（标签页将回退为静态标签云）');
  } else {
    pass(`tags.json 检查通过（${n} 个标签 / ${data.posts.length} 篇带标签的文章）`);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  报告输出
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function printReport() {
  const strict = process.argv.includes('--strict');

  console.log('\n' + '━'.repeat(52));
  console.log('  构建产物校验报告');
  console.log('━'.repeat(52));

  const groups = { error: [], warn: [], pass: [] };
  for (const r of results) groups[r.level].push(r.msg);

  if (groups.error.length) {
    console.log('\n❌ 错误 (' + groups.error.length + '):');
    groups.error.forEach(m => console.log('   ' + m));
  }
  if (groups.warn.length) {
    console.log('\n⚠️  警告 (' + groups.warn.length + '):');
    groups.warn.forEach(m => console.log('   ' + m));
  }
  if (groups.pass.length) {
    console.log('\n✅ 通过 (' + groups.pass.length + '):');
    groups.pass.forEach(m => console.log('   ' + m));
  }

  const total = results.length;
  const failCount = groups.error.length + (strict ? groups.warn.length : 0);

  console.log('\n' + '━'.repeat(52));
  console.log(
    `  共 ${total} 项检查 · ` +
    `${groups.error.length} 错误 · ` +
    `${groups.warn.length} 警告 · ` +
    `${groups.pass.length} 通过` +
    (strict ? ' · 严格模式' : '')
  );

  if (failCount > 0) {
    console.log('  ❌ 验证失败，请修复上述错误后再部署');
  } else {
    console.log('  ✅ 验证通过，可以部署');
  }
  console.log('━'.repeat(52) + '\n');

  process.exit(failCount > 0 ? 1 : 0);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  入口
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

if (!fs.existsSync(PUBLIC)) {
  console.error('❌ public/ 目录不存在，请先运行 npm run build');
  console.error('   或使用 npm run test:build 自动执行 clean + build + test');
  process.exit(1);
}

console.log('🔍 开始构建产物验证...\n');

// A. 配置
checkSiteConfig();

// B-C. 资源
checkKeyAssets();
checkInjectRefs();

// D. 页面
checkKeyPages();

// E. 文章（--quick 跳过）
checkPostFrontMatter();

// F-J. 构建产物
checkImageFormats();
checkGallery();
checkActivity();
checkCarousel();
checkTagsData();

printReport();
