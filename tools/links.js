/* ============================================================================
   全站链接 / 图片完整性审计

   为什么要有这个：一个「实打实」的站，最先被用户发现的问题不是文案短，
   而是**点了没反应**或者**图片是破的**。而这两类问题靠肉眼翻页面翻不完 ——
   上百张卡、每条路由几十个链接。

   做法：每条路由渲染完之后，把页面上**所有** <a href> 和 <img src> 抓出来，
   逐个判定：

     href="#/style/<id>"    → id 必须在 STYLES 里
     href="#/library?..."   → 参数名必须是已知的，参数值必须在分类表里
     href="#/..."           → 路径必须是已知路由
     href="#" 或 ""         → 占位链接，直接报错（点了跳顶部，看着像坏的）
     href 指向外部          → 允许，但必须是 https 且不能是 example.com 之类
     img src                → 文件必须真的存在（用站点自己的 COVERS 映射反查）

   同时统计「同一张卡有没有出现重复 id」「卡片引用的封面文件是否都在」。

   用法：
     cd shutong && node tools/links.js "$(pwd)"
   退出码：0 = 全部干净，1 = 有问题
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const CH = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const TIMEOUT_MS = parseInt(process.env.LINKS_TIMEOUT_MS, 10) > 0
  ? parseInt(process.env.LINKS_TIMEOUT_MS, 10) : 60000;

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('找不到站点根目录（缺 index.html）：' + ROOT);
  process.exit(2);
}

/* 路由清单要和 app.js 的 parseHash 分支一致 —— 少一条就会漏掉一整页的链接 */
const ROUTES = ['#/', '#/library', '#/creators', '#/about', '#/submit'];

const PROBE = `
<script>
/* 输出节点先建好、每步都刷 —— 中途抛异常也能看到「跑到哪一步炸的」。
   一次性在最后写结果的话，一抛异常就什么都不剩，只能看到「没有回报」，
   排查成本极高（这个探针第一版就是这么翻车的）。 */
window.__L = { routes: [], bad: [], stats: {}, phase: 'init' };
var __pre = document.createElement('pre');
__pre.id = '__links-out';
function __flush() { __pre.textContent = JSON.stringify(window.__L); }
document.documentElement.appendChild(__pre);

window.addEventListener('error', function (e) {
  window.__L.bad.push('JS 异常: ' + e.message + ' @' + e.lineno);
  __flush();
});

function run() {
  var L = window.__L;
  var ROUTES = __ROUTES__;      /* 由 Node 侧注入，保持单一事实来源 */
  try {
    __flush();

    /* --- 站点自己知道的事实，拿来当判定依据 --- */
    L.phase = 'facts';
    var ids = {}; STYLES.forEach(function (s) { ids[s.id] = s; });
    var cats = {}; TAXONOMY.categories.forEach(function (c) { cats[c.key] = c; });
    var uses = {}; TAXONOMY.uses.forEach(function (u) { uses[u.key] = u; });
    var moods = {}; TAXONOMY.moods.forEach(function (m) { moods[m.key] = m; });
    L.stats.cards = STYLES.length;
    __flush();

    /* 已知路由（带参数的页面也要认） */
    var KNOWN = ['#/', '#/library', '#/creators', '#/about', '#/submit'];
    /* 轨道筛选的取值只有这三个。注意与**详情页**的 ?track= 区分开：
       那边仍是 local / cloud（选看哪一条轨道），这边是「哪种卡」。
       图片风格补全双轨之后，库页的 local / cloud 两档与「双轨」返回同一集合，
       已经删掉 —— 留着的话这张表会替一个筛不动的档位背书。 */
    var LIB_PARAMS = { cat: cats, use: uses, mood: moods, track: { all: 1, both: 1, text: 1 },
                       q: null, sort: { hot: 1, new: 1 }, page: null, saved: { 1: 1 } };

    /* 详情页也要扫，而且每个分类各挑一张 —— 文本卡和图片卡的详情页结构不同 */
    var detailRoutes = [];
    var byCat = {};
    STYLES.forEach(function (s) { (byCat[s.category] = byCat[s.category] || []).push(s.id); });
    Object.keys(byCat).forEach(function (c) { detailRoutes.push('#/style/' + byCat[c][0]); });
    L.stats.detailRoutes = detailRoutes.length;
    __flush();

    function checkHref(href, where) {
      if (href == null) return;
      var h = String(href).trim();
      if (h === '' || h === '#') {
        L.bad.push(where + ' → 占位链接 href="' + h + '"（点了只会跳回顶部）');
        return;
      }
      if (h.indexOf('#') !== 0) {
        /* blob: / data: 是导出链接的合法 href（见 app.js 的 exportHref）：
           它们指向页面内生成的文件，不走网络，也不是「外链」。
           漏掉这条会把每个详情页的两个导出链接全报成假阳性。 */
        if (h.indexOf('blob:') === 0 || h.indexOf('data:') === 0) return;
        if (h.indexOf('https://') !== 0) {
          L.bad.push(where + ' → 外链不是 https：' + h.slice(0, 60));
        }
        if (/example\\.(com|org)|localhost|127\\.0\\.0\\.1|TODO|占位/.test(h)) {
          L.bad.push(where + ' → 外链像占位符：' + h.slice(0, 60));
        }
        return;
      }
      /* 站内链接 */
      if (h.indexOf('#/style/') === 0) {
        var id = decodeURIComponent(h.slice(8).split('?')[0]);
        if (!ids[id]) L.bad.push(where + ' → 指向不存在的卡片：' + h);
        var q = h.indexOf('?') >= 0 ? h.slice(h.indexOf('?') + 1) : '';
        if (q && q.replace(/track=(local|cloud)/g, '').replace(/[?&]/g, '') !== '') {
          L.bad.push(where + ' → 详情页参数不认识：' + h);
        }
        return;
      }
      if (h.indexOf('#/library') === 0) {
        var qs = h.indexOf('?') >= 0 ? h.slice(h.indexOf('?') + 1) : '';
        qs.split('&').forEach(function (pair) {
          if (!pair) return;
          var k = decodeURIComponent(pair.split('=')[0]);
          var v = decodeURIComponent((pair.split('=')[1] || ''));
          if (!(k in LIB_PARAMS)) { L.bad.push(where + ' → 库页参数名不认识：' + k + '（' + h + '）'); return; }
          var table = LIB_PARAMS[k];
          if (table && v && !table[v]) L.bad.push(where + ' → 库页参数值不在分类表里：' + k + '=' + v);
        });
        return;
      }
      if (h.indexOf('#/?page=') === 0 && /^[1-9][0-9]*$/.test(h.slice(8))) return;
      if (KNOWN.indexOf(h) >= 0) return;
      L.bad.push(where + ' → 未知站内路由：' + h);
    }

    function scan(route) {
      L.phase = 'scan ' + route;
      location.hash = route;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      var v = document.getElementById('view');
      if (!v) { L.bad.push(route + ' → 没有 #view'); return; }
      var links = v.querySelectorAll('a[href]');
      Array.prototype.forEach.call(links, function (a) {
        checkHref(a.getAttribute('href'), route);
      });
      /* 图片：src 必须是站点里真实存在的文件。
         用 naturalWidth===0 判定加载失败（complete 为真时才可信）。 */
      var imgs = v.querySelectorAll('img');
      Array.prototype.forEach.call(imgs, function (im) {
        var src = im.getAttribute('src') || '';
        if (!src) { L.bad.push(route + ' → <img> 没有 src'); return; }
        if (src.indexOf('assets/') !== 0 && src.indexOf('http') !== 0) {
          L.bad.push(route + ' → <img> src 不是站点相对路径：' + src.slice(0, 60));
        }
        if (im.complete && im.naturalWidth === 0) {
          L.bad.push(route + ' → 图片加载失败：' + src);
        }
      });
      L.routes.push({ route: route, links: links.length, imgs: imgs.length, text: v.textContent.replace(/\\s+/g, ' ').trim().length });
      __flush();
    }

    ROUTES.concat(detailRoutes).forEach(scan);
    /* 数据层自身的一致性：id 不能重复；每张卡都要有封面 */
    L.phase = 'data';
    var seen = {};
    STYLES.forEach(function (s) {
      if (seen[s.id]) L.bad.push('数据层 → 卡片 id 重复：' + s.id);
      seen[s.id] = 1;
      var cov = (s.cover || HF_COVERS[s.id] || {});
      if (s.category === 'image' && !cov.src) L.bad.push('数据层 → ' + s.id + ' 没有封面');
    });

    L.phase = 'done';
    L.done = true;
    __flush();
  } catch (err) {
    L.bad.push('探针在 ' + L.phase + ' 阶段抛异常：' + (err && err.message));
    L.phase = 'threw';
    __flush();
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
else run();
</script>`;

function childHTML() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const at = html.lastIndexOf('</body>');
  const probe = PROBE.replace('__ROUTES__', JSON.stringify(ROUTES));
  return html.slice(0, at) + probe + html.slice(at);
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.avif': 'image/avif'
};

function startServer() {
  const child = childHTML();
  const srv = http.createServer(function (req, res) {
    if (req.url.indexOf('/__links.html') === 0) {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      return res.end(child);
    }
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const file = path.join(ROOT, p);
    if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); return res.end('404');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(fs.readFileSync(file));
  });
  return new Promise(function (r) { srv.listen(0, '127.0.0.1', function () { r({ srv: srv, port: srv.address().port }); }); });
}

function chrome(url) {
  return new Promise(function (resolve) {
    const args = [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--window-size=1440,900', '--virtual-time-budget=8000', '--dump-dom', url
    ];
    const p = spawn(CH, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '', done = false;
    const timer = setTimeout(function () {
      if (done) return;
      done = true;
      try { p.kill('SIGKILL'); } catch (e) { /* noop */ }
      resolve(out + '\n<!-- CHROME_TIMEOUT -->');
    }, TIMEOUT_MS);
    p.stdout.on('data', function (d) { out += d; });
    p.on('close', function () { if (done) return; done = true; clearTimeout(timer); resolve(out); });
  });
}

function unesc(s) {
  return s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

(async function main() {
  const { srv, port } = await startServer();
  const dom = await chrome('http://127.0.0.1:' + port + '/__links.html');
  srv.close();

  if (dom.indexOf('<!-- CHROME_TIMEOUT -->') >= 0) {
    console.log('✗ Chrome 超时被杀 —— 本次判定不可信，请重跑（或调大 LINKS_TIMEOUT_MS）');
    process.exit(2);
  }
  const m = dom.match(/<pre id="__links-out">([\s\S]*?)<\/pre>/);
  if (!m) {
    console.log('✗ 探针没有回报结果。DOM 片段: ' +
      unesc(dom.replace(/\s+/g, ' ').slice(0, 300)));
    process.exit(2);
  }
  const L = JSON.parse(unesc(m[1]));

  console.log('扫了 ' + L.routes.length + ' 条路由（含 ' + L.stats.detailRoutes + ' 个分类的详情页样本）\n');
  L.routes.forEach(function (r) {
    console.log('  ' + r.route.padEnd(30) +
      ' 链接 ' + String(r.links).padStart(4) +
      '  图 ' + String(r.imgs).padStart(2) +
      '  正文 ' + String(r.text).padStart(5) + ' 字');
  });
  console.log('\n共 ' + L.stats.cards + ' 张卡\n');

  if (L.bad.length) {
    console.log('发现 ' + L.bad.length + ' 个问题：');
    const uniq = [...new Set(L.bad)];
    uniq.slice(0, 40).forEach(function (b) { console.log('  ✗ ' + b); });
    if (uniq.length > 40) console.log('  ... 还有 ' + (uniq.length - 40) + ' 条');
    process.exit(1);
  }
  console.log('链接与图片完整性：全部通过（没有死链、没有占位链接、没有加载失败的图）');
})();
