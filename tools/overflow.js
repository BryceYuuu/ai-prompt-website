/* ============================================================================
   书桐 SHUTONG — 横向溢出检测

   截图上看不出「差了 3px 的溢出」，尤其是瀑布流和 sticky 分类栏。
   这里复制一份 index.html，注入探针，把每张视图中超出视口宽度的元素
   连同它们的宽度写进 DOM，再用 --dump-dom 读回来。

   用法： node tools/overflow.js <shutong 绝对路径>
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : '';
if (!ROOT) { console.error('usage: node overflow.js <shutong dir>'); process.exit(1); }

const CH = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const TMP = path.join(ROOT, '__ovf.html');

const PROBE = `
<script>
setTimeout(function measureOverflow() {
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', measureOverflow, { once: true }); return; }
  var doc = document.documentElement;
  var vw = doc.clientWidth;
  var out = [];
  var all = document.querySelectorAll('body *');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    var r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    /* 右边界越界，或元素本身比视口还宽 */
    var over = Math.round(r.right - vw);
    if (over > 1 || Math.round(r.width - vw) > 1) {
      var cs = getComputedStyle(el);
      if (cs.position === 'fixed' && cs.visibility === 'hidden') continue;
      out.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || '',
        w: Math.round(r.width),
        right: Math.round(r.right),
        over: over
      });
    }
  }
  out.sort(function (a, b) { return b.over - a.over; });
  var box = document.createElement('div');
  box.id = 'OVF';
  box.textContent = JSON.stringify({
    vw: vw,
    scrollW: doc.scrollWidth,
    clientW: doc.clientWidth,
    docOverflow: doc.scrollWidth - doc.clientWidth,
    count: out.length,
    top: out.slice(0, 6)
  });
  document.body.appendChild(box);
}, 400);
</script>
`;

const HASHES = [
  ['home', '#/'],
  ['library', '#/library'],
  ['library-last', '#/library?page=7'],
  ['library-code', '#/library?cat=code'],
  ['detail-image', '#/style/cyber-night-market'],
  ['detail-text', '#/style/linux-terminal'],
  ['about', '#/about'],
  ['saved', '#/library?saved=1']
];
const WIDTHS = [390, 480, 560, 720, 900, 1100, 1240, 1440];

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
html = html.replace(/<head\b[^>]*>/i, function (m) { return m + '\n' + PROBE; });
fs.writeFileSync(TMP, html);

let bad = 0, unjudged = 0;
try {
  for (const w of WIDTHS) {
    for (const [name, hash] of HASHES) {
      let dom = '';
      try {
        dom = execFileSync(CH, [
          '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer',
          '--disable-dev-shm-usage', '--hide-scrollbars', '--virtual-time-budget=3000',
          '--window-size=' + w + ',1200', '--dump-dom',
          'file://' + TMP + hash
        ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
      } catch (e) { console.log('  !! chrome failed', w, name); unjudged++; continue; }

      const m = dom.match(/<div id="OVF">([\s\S]*?)<\/div>/);
      if (!m) { console.log('  ?? no probe output', w, name); unjudged++; continue; }
      const d = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      const flag = d.docOverflow > 1 ? 'OVERFLOW' : 'ok';
      if (d.docOverflow > 1) bad++;
      console.log('  ' + String(w).padStart(4) + '  ' + name.padEnd(14) + flag.padEnd(10) +
        'doc=' + d.docOverflow + 'px  offenders=' + d.count +
        (d.count ? '  ' + d.top.map(function (o) { return o.tag + '.' + String(o.cls).split(' ')[0] + '(' + o.over + ')'; }).join(' ') : ''));
    }
  }
} finally {
  /* 删不掉不能把整轮验收带走 —— 有些环境会拦截批量删除。
     但**不能把「删不掉」报成「没东西可删」**：沙箱的批量删除护栏
     （单轮累计超过约 50 个删除就要二次确认）会拦下 unlinkSync，
     静默 catch 的后果是探针副本留在站点根目录里，而所有人都以为清干净了。
     删不掉就把话说明白，`accept.sh` 最后一项会统一兜住这件事。 */
  try { fs.unlinkSync(TMP); }
  catch (e) {
    console.log('\n⚠ 临时副本删不掉：' + TMP + '（' + (e.code || e.message) + '）');
    console.log('  它含注入的 rAF 桩，发布前必须手动删除。');
  }
}

console.log(bad ? '\n' + bad + ' 个组合有横向溢出' : '\n已检查 ' + (WIDTHS.length * HASHES.length - unjudged) + ' 个组合均没有横向溢出');
if (unjudged) console.log('⚠ ' + unjudged + ' 个组合未能完成测量，本轮不可判定');
process.exit(bad || unjudged ? 1 : 0);
