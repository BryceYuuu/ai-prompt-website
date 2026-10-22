'use strict';
/* 无头 Chrome 的一次性配置目录。

   不传 --user-data-dir 时，headless Chrome 会在
   ~/Library/Caches/Google/Chrome-headless 与
   ~/Library/Application Support/Google/Chrome-headless
   留下无法自动清理的 scoped_dir*，曾累计占用约 31GB。
   所以每次启动都 mkdtemp 一个目录，用完（成功、失败、超时、进程退出、Ctrl-C）都删掉；
   后台 spawn 的 Chrome 以独立进程组启动，结束时整组杀掉，不留孤儿 helper 进程。 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const dirs = new Set();
const children = new Set();

function create() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shutong-chrome-'));
  dirs.add(dir);
  return dir;
}

function remove(dir) {
  dirs.delete(dir);
  try { fs.rmSync(dir, { recursive: true, force: true }); }
  catch (e) { console.log('⚠ 临时 Chrome 配置目录删不掉：' + dir + '（' + (e.code || e.message) + '）'); }
}

/* spawn 时带上 detached:true，进程组号即 pid，杀 -pid 能连同渲染、GPU 等子进程一起结束。 */
function track(child) { children.add(child); return child; }
function kill(child) {
  children.delete(child);
  try { process.kill(-child.pid, 'SIGKILL'); }
  catch (e) { try { child.kill('SIGKILL'); } catch (err) { /* already gone */ } }
}
function untrack(child) { children.delete(child); }

function cleanupAll() {
  Array.from(children).forEach(kill);
  Array.from(dirs).forEach(remove);
}
process.on('exit', cleanupAll);
['SIGINT', 'SIGTERM'].forEach(function (signal) {
  process.once(signal, function () { cleanupAll(); process.exit(signal === 'SIGINT' ? 130 : 143); });
});

/* 同步调用（execFileSync）用：拿到目录 → 执行 → finally 删除。 */
function withProfile(fn) {
  const dir = create();
  try { return fn('--user-data-dir=' + dir); }
  finally { remove(dir); }
}

module.exports = { create, remove, track, kill, untrack, withProfile };
