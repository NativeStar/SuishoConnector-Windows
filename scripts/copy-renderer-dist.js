const path = require('path');
const fs = require('fs-extra');

async function main() {
  const repoRoot = path.resolve(__dirname, '..');
  const srcDir = path.join(repoRoot, 'renderer', 'dist');
  const destDir = path.join(repoRoot, 'dist', 'renderer');

  if (!(await fs.pathExists(srcDir))) {
    throw new Error(`renderer 构建产物不存在：${srcDir}（请先执行 renderer 的 build）`);
  }

  await fs.remove(destDir);
  await fs.ensureDir(path.dirname(destDir));
  await fs.copy(srcDir, destDir, { dereference: true });
  console.log(`已复制 renderer 产物到：${path.relative(repoRoot, destDir)}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

