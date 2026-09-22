// web/build.mjs — 打包 React 岛（esbuild）
//   node web/build.mjs            一次性打包
//   node web/build.mjs --watch    监听变化持续打包
//
// 输出：source/js/dist/
//   app.js
//   islands/<name>-<hash>.js
//   shared/<name>-<hash>.js

import { build, context } from 'esbuild';
import {
  rmSync,
  readdirSync,
  statSync,
  readFileSync,
} from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

const OUT = 'source/js/dist';
const watch = process.argv.includes('--watch');

// React Island：名字必须与 web/main.js 中的 islandUrl('xxx') 对应。
const ISLANDS = {
  tags: 'web/islands/tags.mount.jsx',
  gallery: 'web/islands/gallery.mount.jsx',
};

const common = {
  bundle: true,
  format: 'esm',
  target: 'es2020',
  minify: true,
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
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

function islandMap(metafile) {
  const map = {};

  for (const [file, info] of Object.entries(metafile.outputs)) {
    if (!info.entryPoint) continue;

    const name = Object.keys(ISLANDS).find(
      (n) => ISLANDS[n] === info.entryPoint
    );

    if (name) {
      map[name] = relative(OUT, file).replace(/\\/g, '/');
    }
  }

  for (const name of Object.keys(ISLANDS)) {
    if (!map[name]) {
      throw new Error('没有找到岛的输出: ' + name);
    }
  }

  return map;
}

function entryOptions(map) {
  return {
    ...common,
    entryPoints: {
      app: 'web/main.js',
    },
    outdir: OUT,
    define: {
      ...common.define,
      __ISLANDS__: JSON.stringify(map),
    },
  };
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);

    statSync(p).isDirectory()
      ? walk(p, out)
      : out.push(p);
  }

  return out;
}

function report() {
  const files = walk(OUT).filter((f) =>
    f.endsWith('.js')
  );

  console.log('\n打包产物（' + OUT + '）：');

  let entryGz = 0;

  for (const f of files) {
    const buf = readFileSync(f);
    const gz = gzipSync(buf, { level: 9 }).length;

    if (f.endsWith('app.js')) {
      entryGz = gz;
    }

    console.log(
      '  ' +
        relative(OUT, f)
          .replace(/\\/g, '/')
          .padEnd(34) +
        String(buf.length).padStart(8) +
        ' B   gzip ' +
        String(gz).padStart(6) +
        ' B'
    );
  }

  console.log(
    '  → 每个页面都要加载的只有入口 app.js（gzip ' +
      entryGz +
      ' B，无静态岛依赖）'
  );
  console.log(
    '  → React 岛仅在页面存在挂载点时动态加载\n'
  );
}

rmSync(OUT, {
  recursive: true,
  force: true,
});

if (watch) {
  let entryCtx = null;

  const rebuildEntry = async (metafile) => {
    if (entryCtx) {
      await entryCtx.dispose();
    }

    entryCtx = await context(
      entryOptions(islandMap(metafile))
    );

    await entryCtx.rebuild();

    console.log('[web] 已重新打包入口');
  };

  const islandCtx = await context({
    ...islandOptions,
    logLevel: 'info',
    plugins: [
      {
        name: 'rebuild-entry',
        setup(buildApi) {
          buildApi.onEnd((result) => {
            if (!result.errors.length) {
              rebuildEntry(result.metafile);
            }
          });
        },
      },
    ],
  });

  await islandCtx.watch();

  console.log('监听中…（Ctrl+C 退出）');
} else {
  const islands = await build(islandOptions);

  await build(
    entryOptions(islandMap(islands.metafile))
  );

  report();
}
