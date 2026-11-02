// 手写的递归删除工具：绕开 fs.rmSync(recursive) 在 Node 25 + 中文路径下的崩溃问题
import fs from "node:fs";
import path from "node:path";

function rmrf(target) {
  if (!fs.existsSync(target)) {
    console.log("[skip] 不存在:", target);
    return 0;
  }
  let n = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else {
        fs.unlinkSync(p);
        n++;
      }
    }
    fs.rmdirSync(dir);
  };
  walk(target);
  console.log(`[ok] 已删除 ${n} 个文件: ${target}`);
  return n;
}

let total = 0;
for (const t of process.argv.slice(2)) total += rmrf(t);
console.log(`[done] 共清理 ${total} 个文件`);
