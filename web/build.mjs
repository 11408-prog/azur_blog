// web/build.mjs — 打包 React 岛（esbuild）
//   node web/build.mjs            一次性打包（npm run build:web）
//   node web/build.mjs --watch    监听变化持续打包（npm run dev:web）
//
// 输出到 source/js/dist/（被 git 忽略，Hexo 会把它当普通静态资源复制到 public/js/dist/）：
//   app.js                       入口（每个页面都加载，几百字节，没有任何静态依赖）
//   islands/<名字>-<hash>.js     每个岛一份，含 React 与该岛的全部代码，只在页面上有挂载点时才动态加载
//   shared/*.js                  多个岛共用的代码（岛超过一个时才会出现）
//
// 为什么分两步打包：
//   如果入口和岛在同一次 splitting 打包里，esbuild 会让入口静态 import 一个共享的 runtime 小文件，
//   而 <script type="module"> 会一直等它下载完才触发 DOMContentLoaded——全站每个页面都要多等一次网络往返。
//   所以先打包各个岛（拿到带哈希的文件名），再把文件名注入到入口里，入口就是一个独立的小文件。
import { build, context } from 'esbuild';
import { rmSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

const OUT = 'source/js/dist';
const watch = process.argv.includes('--watch');

// 岛名字 → 挂载入口（名字要和 web/main.js 里 islandUrl('名字') 一致）
const ISLANDS = {
  tags: 'web/islands/tags.mount.jsx',
};

const common = {
  bundle: true,
  format: 'esm',
  target: 'es2020',         // 动态 import() 需要 ES2020
  minify: true,
  jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  legalComments: 'none',
  logLevel: 'warning',
  metafile: true,
};

const islandOptions = {
  ...common,
  entryPoints: ISLANDS,
  outdir: OUT + '/islands',
  splitting: true,
  entryNames: '[name]-[hash]',
  chunkNames: '../shared/[name]-[hash]',
};

/** 从 metafile 里取出「岛名字 → 相对于 OUT 的输出路径」 */
function islandMap(metafile) {
  const map = {};
  for (const [file, info] of Object.entries(metafile.outputs)) {
    if (!info.entryPoint) continue;
    const name = Object.keys(ISLANDS).find((n) => ISLANDS[n] === info.entryPoint);
    if (name) map[name] = relative(OUT, file).replace(/\\/g, '/');
  }
  for (const name of Object.keys(ISLANDS)) if (!map[name]) throw new Error('没有找到岛的输出: ' + name);
  return map;
}

function entryOptions(map) {
  return {
    ...common,
    entryPoints: { app: 'web/main.js' },
    outdir: OUT,
    define: { ...common.define, __ISLANDS__: JSON.stringify(map) },
  };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? walk(p, out) : out.push(p);
  }
  return out;
}

function report() {
  const files = walk(OUT).filter((f) => f.endsWith('.js'));
  console.log('\n打包产物（' + OUT + '）：');
  let entryGz = 0;
  for (const f of files) {
    const buf = readFileSync(f);
    const gz = gzipSync(buf, { level: 9 }).length;
    if (f.endsWith('app.js')) entryGz = gz;
    console.log('  ' + relative(OUT, f).replace(/\\/g, '/').padEnd(34) + String(buf.length).padStart(8) + ' B   gzip ' + String(gz).padStart(6) + ' B');
  }
  console.log('  → 每个页面都要加载的只有入口 app.js（gzip ' + entryGz + ' B，无静态依赖）；岛按需加载\n');
}

rmSync(OUT, { recursive: true, force: true });

if (watch) {
  // 监听模式：岛的文件名带哈希，岛一变入口就要重新打包，所以两步都放进 watch 回调里
  let entryCtx = null;
  const rebuildEntry = async (metafile) => {
    if (entryCtx) await entryCtx.dispose();
    entryCtx = await context(entryOptions(islandMap(metafile)));
    await entryCtx.rebuild();
    console.log('[web] 已重新打包');
  };
  const islandCtx = await context({
    ...islandOptions,
    logLevel: 'info',
    plugins: [{ name: 'rebuild-entry', setup(b) { b.onEnd((r) => { if (!r.errors.length) rebuildEntry(r.metafile); }); } }],
  });
  await islandCtx.watch();
  console.log('监听中…（Ctrl+C 退出）');
} else {
  const islands = await build(islandOptions);
  await build(entryOptions(islandMap(islands.metafile)));
  report();
}
