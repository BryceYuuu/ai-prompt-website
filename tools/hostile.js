/* ============================================================================
   敌意宿主环境走查

   起因：站点在 file:// 直开、jsdom、无头 Chrome 顶层页面里都点得动，
   但用户报告「所有按键都点不开」。差异只可能来自**宿主**——把页面嵌进
   iframe 的预览面板。

   预览面板通常长这样：一个 sandbox 过的 iframe，指向本机 http 服务。
   于是这里把能造成「页面渲染正常但点哪都没反应」的宿主条件逐个复现：

     top            顶层打开（基线，必须全绿）
     plain          同源 iframe，无 sandbox
     sandbox        沙箱 iframe，只有 allow-scripts（不透明来源：
                    cookie / localStorage 一律抛 SecurityError）
     no-io          删掉 IntersectionObserver（入场动画依赖它，
                    缺失时内容可能永远停在 opacity:0）
     no-raf         删掉 requestAnimationFrame
     io-dead        观察者「在、但永远不回调」（宿主屏蔽了它，或实现是坏的）
     io-dead-quiet  同上，但探针一步都不点、也不滚动 —— 专门验证定时兜底
                    （非 quiet 的 io-dead 测不出来：探针为了点击会滚动，
                     滚动本身就会触发 onScroll 里的 revealFallback）
     hostile-click  宿主在 window 捕获阶段抢先注册点击监听并
                    stopImmediatePropagation()，模拟预览面板「吃掉」点击
     hostile-prevent 宿主在 window 捕获阶段把所有 click 的默认行为一律取消
                    （所以它必须抢在 app.js 之前注册，否则测不出来）

   探针**完全同步**，不使用任何定时器。原因是实测发现：
   sandbox（不透明来源）的 iframe 在 --virtual-time-budget 下
   setTimeout 和 rAF 都不推进，任何异步探针都会卡死在第一步。
   同步探针反而更严格 —— 它证明站点在「一个定时器都没有」的环境里也能用。

   探针挂在 DOMContentLoaded 上，注册顺序在 app.js 之后，
   所以运行时站点已经 boot 完毕。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '..');
const CH = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');
const ONLY = process.argv[3] || '';
/* 每个模式等 Chrome 多久。默认 45 秒（正常一个模式约 8 秒，5 倍余量）。
   机器上同时有别的东西在跑无头 Chrome 时会偶发超时，用环境变量调大即可：
   HOSTILE_TIMEOUT_MS=120000 node tools/hostile.js */
const TIMEOUT_MS = parseInt(process.env.HOSTILE_TIMEOUT_MS, 10) > 0
  ? parseInt(process.env.HOSTILE_TIMEOUT_MS, 10) : 45000;

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('找不到站点根目录（缺 index.html）：' + ROOT);
  process.exit(2);
}

/* ----------------------------------------------------------- 子页面探针 -- */

const PROBE = `
<script>
window.__H = { env: {}, steps: [], errors: [], hitMiss: [] };
window.addEventListener('error', function (e) {
  window.__H.errors.push(String(e.message));
});

function cn(e) {
  if (!e) return 'null';
  var c = (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '';
  return e.tagName.toLowerCase() + (c ? '.' + String(c).trim().split(/\\s+/).join('.') : '');
}
function instantScroll(y) {
  var prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = prev;
}
function clickTarget(el) {
  if (!el) return null;
  var vh = document.documentElement.clientHeight, vw = document.documentElement.clientWidth;
  var spots = [0.5, 0.42, 0.6, 0.34, 0.68, 0.28];
  for (var i = 0; i < spots.length; i++) {
    var r = el.getBoundingClientRect();
    instantScroll(window.scrollY + r.top - vh * spots[i] + r.height / 2);
    r = el.getBoundingClientRect();
    var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    var hit = document.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return { el: hit, x: x, y: y };
  }
  return null;
}
/* 找不到落点时**必须说清为什么**。
   这条走查曾经报出一批「用 realClick 的那几步全灭、用 clickMaybeDefault 的那几步全活」
   的失败 —— 因为后者有 location.hash 兜底，前者没有。而失败信息只有
   「找不到能命中 X 的落点」一句，看不出是元素被裁掉了、被盖住了、还是根本没尺寸。
   于是只能靠猜。这里把判定所需的三个事实一次带出来：
   ① 元素的 rect 与视口尺寸（尺寸为 0 / 落在视口外 → 直接出局）；
   ② 中心点 elementFromPoint 实际命中了谁（被盖住时这里会露出真凶）；
   ③ 从元素到根这一条链上，哪些祖先的 visibility / opacity / clip-path /
      display / pointer-events 会让它不可点（.reveal--wipe 的
      clip-path: inset(0 100% 0 0) 就是靠这条现形的 —— 被裁到零宽的元素
      不参与命中测试，而 getBoundingClientRect 仍然返回完整矩形）。 */
function whyNoHit(el) {
  if (!el) return '（元素不存在）';
  var r = el.getBoundingClientRect();
  var vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
  var chain = [], n = el;
  while (n && n.nodeType === 1 && n !== document.documentElement) {
    var c = getComputedStyle(n);
    if (c.visibility !== 'visible' || c.opacity === '0' || c.clipPath !== 'none' ||
        c.display === 'none' || c.pointerEvents === 'none') {
      chain.push(cn(n) + '{vis:' + c.visibility + ' op:' + c.opacity +
        ' clip:' + c.clipPath + ' disp:' + c.display + ' pe:' + c.pointerEvents + '}');
    }
    n = n.parentElement;
  }
  var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  var inVp = (x >= 0 && y >= 0 && x <= vw && y <= vh);
  var hit = inVp ? document.elementFromPoint(x, y) : null;
  /* 文档级的读数：整个文档没布局 / 只有这个元素没尺寸，是两件不同的事，
     分开报才不用猜。 */
  function box(n) { if (!n) return 'n/a'; var q = n.getBoundingClientRect();
    return Math.round(q.width) + 'x' + Math.round(q.height); }
  return '（rect=' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' +
    Math.round(r.width) + 'x' + Math.round(r.height) + ' 视口=' + vw + 'x' + vh +
    ' 文档: body=' + box(document.body) + ' #view=' + box(document.querySelector('#view')) +
    ' 中心' + (inVp ? '命中 ' + cn(hit) : '在视口外') +
    (chain.length ? ' 可疑祖先: ' + chain.join(' < ') : '') + '）';
}
function realClick(el) {
  var t = clickTarget(el);
  if (!t) {
    var why = '找不到能命中 ' + cn(el) + ' 的落点 ' + whyNoHit(el);
    /* 记到一处。这样**所有**调用点都被覆盖 —— 不必指望每个 step 都记得去看返回值。
       （上一次失败里，正是那些忘了看返回值的 step 报出了「找不到落点」以外的东西，
         把一次量具故障说成了五处互不相干的站点故障。） */
    window.__H.hitMiss.push(why);
    return { ok: false, why: why };
  }
  var clickEv = null;
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
    var Ctor = type.indexOf('pointer') === 0 ? (window.PointerEvent || MouseEvent) : MouseEvent;
    var ev = new Ctor(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: t.x, clientY: t.y, button: 0,
      buttons: (type === 'mousedown' || type === 'pointerdown') ? 1 : 0
    });
    if (type === 'click') clickEv = ev;
    t.el.dispatchEvent(ev);
  });
  return { ok: true, hit: cn(t.el), prevented: !!(clickEv && clickEv.defaultPrevented) };
}
/* 导航类控件（真 <a href="#/...">）在宿主吃掉 click 时，靠浏览器默认行为
   仍然能改 hash。合成事件不触发默认行为，而且 hashchange 是异步任务，
   同步探针等不到 —— 所以这里手动补上这两步，复现真实浏览器的路径。
   **但只在默认行为确实没被取消时才补** —— 否则会把
   「宿主把默认行为 preventDefault 掉」这种情况测成绿的。
   若我们的监听器已经处理过，补发是无害的：onHashChange 会因 routeKey
   已同步而直接返回。 */
function clickMaybeDefault(el) {
  var r = realClick(el);
  /* ⚠ 命中不到就**别兜底**。
     r.ok === false 表示一次点击都没发出去（clickTarget 找不到落点）。
     这时若照样补 location.hash，就等于把「量具没点到」伪装成「导航正常」——
     正是这个伪装让上一次的失败看起来自相矛盾：有兜底的步骤全绿、没兜底的步骤全灭，
     而报告里只有「找不到能命中的落点」一句，看不出是量具坏了还是站点坏了。
     量具故障就该到处都红，不该只红一半。 */
  if (!r.ok) return r;
  var a = el && el.closest ? el.closest('a[href^="#/"]') : null;
  if (a && !r.prevented) {
    try { location.hash = a.getAttribute('href'); } catch (e) { }
    try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { }
  }
  return r;
}

/* 跳到某个主栏目。优先点导航链接（真实路径），拿不到就直接改地址。 */
function goNav(hash) {
  var a = document.querySelector('.nav a[href="' + hash + '"]');
  if (a) { clickMaybeDefault(a); return true; }
  try { location.hash = hash; } catch (e) { }
  try { window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (e) { }
  return false;
}

function post() { try { parent.postMessage(window.__H, '*'); } catch (e) { } }

function run() {
  var R = window.__H;
  R.downloads = window.__DL || [];

  /* --- 量具自检：守卫到底有没有被注入 ---
     childHTML() 用一个字符串 replace 把 DOWNLOAD_GUARD 插进去。那个 replace
     一旦没匹配上，**不报错、不警告**，只是守卫消失：导出那一步的
     「默认行为被取消 N 个」于是变成 0，读起来像站点坏了。
     把这件事变成页面里的一个显式读数，失败时才不会误判成站点缺陷。 */
  R.env.guard = (window.__DL ? 'present' : 'ABSENT');
  R.env.host = {
    ate: (typeof window.__HOST_ATE === 'number' ? window.__HOST_ATE : null),
    prevented: (typeof window.__HOST_PREVENTED === 'number' ? window.__HOST_PREVENTED : null)
  };

  /* --- 环境事实 --- */
  R.env.origin = (function () { try { return String(location.origin); } catch (e) { return 'THROWS'; } })();
  R.env.inIframe = (window.top !== window.self);
  try { void document.cookie; R.env.cookie = 'ok'; } catch (e) { R.env.cookie = 'THROWS ' + e.name; }
  try { window.localStorage.getItem('x'); R.env.localStorage = 'ok'; }
  catch (e) { R.env.localStorage = 'THROWS ' + e.name; }
  /* 用 typeof：宿主可能把属性定义成 undefined，'in' 判断会放行然后 new 抛错 */
  R.env.io = (typeof window.IntersectionObserver === 'function');
  R.env.raf = (typeof window.requestAnimationFrame === 'function');
  R.env.hashWrite = (function () {
    try { var b = location.hash; location.hash = '#/__probe'; var ok = location.hash === '#/__probe'; location.hash = b; return ok ? 'ok' : 'mismatch'; }
    catch (e) { return 'THROWS ' + e.name; }
  })();

  R.env.cards = document.querySelectorAll('.card').length;
  R.env.revealTotal = document.querySelectorAll('.reveal').length;
  /* 「视口内、却没有 is-in」的 .reveal 个数 —— 这是「有内容但看不见」的度量。
     只数视口内的：屏幕外的元素本来就该等滚动再入场，不是故障。

     为什么量 is-in 而不是 getComputedStyle().opacity：
     无头 Chrome 配 --virtual-time-budget 时**CSS 过渡不推进**，
     已经拿到 is-in 的元素计算出来的 opacity 仍然停在 0 —— 量 opacity
     会把正常情况报成故障。is-in 才是脚本真正控制的状态；
     拿到 is-in 之后过渡播不播是浏览器的事。 */
  function stuckCount() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    return Array.prototype.filter.call(document.querySelectorAll('.reveal'), function (n) {
      var r = n.getBoundingClientRect();
      if (!(r.top < vh && r.bottom > 0)) return false;
      return !n.classList.contains('is-in');
    }).length;
  }
  R.env.revealStuck = stuckCount();
  R.env.ioDead = (window.__IO_DEAD === true);
  R.env.bootErrors = (window.__shutong && window.__shutong.errors) ? window.__shutong.errors() : ['no-diag'];

  function step(name, fn) {
    /* 静止模式：一步都不点，也不滚动 —— 只观察页面自身是否可见 */
    if (window.__HOST_QUIET) return;
    var v;
    try { v = fn() || {}; }
    catch (e) { v = { ok: false, note: 'THREW ' + (e && e.message) }; }
    v.name = name;
    R.steps.push(v);
    post();               /* 每步都回报：虚拟时间随时可能烧完 */
  }

  /* 1. 首页点卡片 → 详情页 */
  step('首页点卡片', function () {
    var r = clickMaybeDefault(document.querySelector('.card__link'));
    return {
      hash: location.hash,
      ok: location.hash.indexOf('#/style/') === 0 && !!document.querySelector('.gh__title'),
      note: (r.ok ? '' : r.why + ' ') + '标题=' + ((document.querySelector('.gh__title') || {}).textContent || '无')
    };
  });

  /* 2. 详情页切轨道（真链接） */
  step('详情页转换提示词', function () {
    var body = document.querySelector('.prompt__body');
    return {ok: !!body && body.textContent.includes('上传'), note: '原图输入指引'};
  });

  /* 3. 详情页复制按钮（纯 JS 控件） */
  step('详情页复制按钮', function () {
    /* 让 copyText 走同步的 legacy 分支再点。
       不这么做的话这条断言是恒为真的：navigator.clipboard.writeText 是 promise，
       同步探针等不到它的 toast，只能验「点了没抛异常」—— 而按钮被宿主
       吃掉点击时同样不会抛异常，于是故障和正常长得一模一样。
       删掉 clipboard，走 document.execCommand 那条**同步**路径
       （它本身也是真实路径），toast 立刻就能看到。 */
    try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch (e) { }
    var e0 = R.errors.length;
    var t0 = document.querySelectorAll('.toast').length;
    var btn = document.querySelector('.gh__actions [data-action="copy-prompt"]');
    var r = realClick(btn);
    var grew = document.querySelectorAll('.toast').length - t0;
    return {
      ok: !!btn && grew > 0 && R.errors.length === e0,
      note: (btn ? btn.textContent.trim() : '无按钮') + '，toast +' + grew + '，异常 +' + (R.errors.length - e0) +
            (r.ok ? '' : ' —— ' + r.why)
    };
  });

  /* 4. 导航 → 提示词库 */
  step('导航→提示词库', function () {
    var r = clickMaybeDefault(document.querySelector('.nav a[href="#/library?track=text"]'));
    return { hash: location.hash, ok: location.hash === '#/library?track=text' && !!document.querySelector('.filters'),
      note: r.ok ? '' : r.why };
  });

  /* 5. 点一个用途 chip 真的筛掉东西（真链接） */
  step('点用途 chip 筛选', function () {
    var n0 = document.querySelectorAll('.gallery .card').length;
    /* 「全部」的 href 里不含 use=（清空条件时不写进地址），天然被排除 */
    var chip = document.querySelector('.filters .chip[href*="use="]');
    if (!chip) return { ok: false, note: '没有用途 chip' };
    var r = clickMaybeDefault(chip);
    var n1 = document.querySelectorAll('.gallery .card').length;
    return { ok: n1 > 0 && n1 < n0,
      note: n0 + ' → ' + n1 + '  hash=' + location.hash + (r.ok ? '' : ' —— ' + r.why) };
  });

  /* 6. 加载更多（真链接） */
  step('加载更多', function () {
    goNav('#/library');
    var n0 = document.querySelectorAll('.gallery .card').length;
    var more = document.querySelector('.loadmore a');
    if (!more) return { ok: false, note: '没有 load-more（首屏 ' + n0 + ' 张）' };
    var r = clickMaybeDefault(more);
    var n1 = document.querySelectorAll('.gallery .card').length;
    return { ok: n1 > n0, note: n0 + ' → ' + n1 + (r.ok ? '' : ' —— ' + r.why) };
  });

  /* 7. 参考图折叠（<details>，零 JS） */
  step('参考图折叠', function () {
    goNav('#/style/linux-terminal');
    var guide = document.querySelector('.detail-guide');

    var d = document.querySelector('.detail-guide');
    if (!d) return { ok: false, note: '没有 FAQ（hash=' + location.hash + '）' };
    var summary = d.querySelector('summary');
    if (!summary) return { ok: false, note: '不是 <details>' };
    var r = realClick(summary);
    return { ok: !!d.open, note: 'open=' + d.open + (r.ok ? '' : ' —— ' + r.why) };
  });

  /* 9. 详情页导出——**真 <a download href="blob:...">**。
     这是导航类控件：宿主在捕获阶段吃掉 click 时，监听器全不跑，
     但浏览器处理锚点默认行为不经过监听器，照样能下载。
     所以这一步在**所有**模式下都必须活着（含 hostile-click）。 */
  step('详情页导出', function () {
    goNav('#/style/cyber-night-market');
    var row = document.querySelector('.takeaway__row');
    if (!row) return { ok: false, note: '没有拿走它区块（hash=' + location.hash + '）' };
    if (row.querySelectorAll('[data-action]').length !== 2) {
      return { ok: false, note: '控件数=' + row.querySelectorAll('[data-action]').length + '，应为 2' };
    }
    var ex = row.querySelectorAll('a[data-action][download]');
    if (ex.length !== 2) return { ok: false, note: '导出里有 ' + ex.length + ' 个真链接，应为 2' };
    var names = Array.prototype.map.call(ex, function (a) { return a.getAttribute('download'); }).join(', ');
    var want = 'cyber-night-market-card.json, cyber-night-market-card.md';
    if (names !== want) return { ok: false, note: 'download 名不对：' + names };
    var noHref = Array.prototype.filter.call(ex, function (a) { return !a.getAttribute('href'); }).length;
    if (noHref) return { ok: false, note: noHref + ' 个导出链接没有 href，退回纯 JS 了' };

    var e0 = R.errors.length, d0 = R.downloads.length, prevented = 0, why = '';
    Array.prototype.forEach.call(ex, function (a) {
      var r = realClick(a);
      if (r.prevented) prevented++;
      else if (!why) why = r.why || '';
    });
    var grew = R.downloads.length - d0;
    /* 守卫统一取消默认行为（见 DOWNLOAD_GUARD），所以 prevented 恒为 2。
       预期 grew === 2 —— onAction 的 JS 兜底把两个文件都补下来。
       例外只有一个：hostile-click 下宿主把 click 整个吃掉，站点的兜底跑不到，
       于是 grew === 0。那种情况只能验「链接是真的、文件名对、href 在」，
       验不到「下载真的发生」—— 这是量具的取舍，见 DOWNLOAD_GUARD 的注释。
       「默认行为还在时交给浏览器」那条由 JSDOM 套件与 export-always-prevent
       变异守着，不靠这里。 */
    var hostAte = (typeof window.__HOST_ATE === 'number') && window.__HOST_ATE > 0;
    var ok = R.errors.length === e0 && prevented === 2 && (grew === 2 || (hostAte && grew === 0));
    return {
      ok: ok,
      note: '2 个真链接 [' + names + ']，默认行为被取消 ' + prevented + ' 个，JS 兜底下载 ' + grew + ' 个，异常 +' + (R.errors.length - e0) +
            (hostAte ? '（宿主吃掉点击，兜底跑不到）' : '') + (why ? ' —— ' + why : '')
    };
  });

  /* 10. 详情页复制负向词 / 参数清单（纯 JS 控件，没有原生等价物） */
  step('详情页复制', function () {
    /* navigator.clipboard 已在第 3 步删掉，这里走的同样是同步 legacy 路径 */
    var row = document.querySelector('.gh__actions');
    if (!row) return { ok: false, note: '没有复制区块' };
    var cp = row.querySelectorAll('button[data-action="copy-prompt"]');
    if (cp.length !== 1) return { ok: false, note: '复制控件 ' + cp.length + ' 个，应为 1' };
    var e0 = R.errors.length, t0 = document.querySelectorAll('.toast').length, why = '';
    Array.prototype.forEach.call(cp, function (b) {
      var r = realClick(b);
      if (!r.ok && !why) why = r.why || '';
    });
    var grew = document.querySelectorAll('.toast').length - t0;
    return { ok: grew === 1 && R.errors.length === e0,
      note: 'toast +' + grew + '，异常 +' + (R.errors.length - e0) + (why ? ' —— ' + why : '') };
  });

  R.phase = 'done';
  R.done = true;
  post();
  var pre = document.createElement('pre');
  pre.id = '__hostile-out';
  pre.textContent = JSON.stringify(R);
  document.documentElement.appendChild(pre);

  /* 定时兜底要等一个定时器周期才生效，同步探针看不到。
     所以补一条异步尾巴 —— 只有定时器能推进的环境（非 sandbox）才会跑到，
     sandbox 下不会覆盖上面的同步结果，父页面取到的仍是最新一条。 */
  setTimeout(function () {
    R.env.timerWorks = true;
    R.env.revealStuckLate = stuckCount();
    post();
  }, 1600);
}

/* boot() 也挂在 DOMContentLoaded 上，且注册在前，所以这里运行时站点已就绪。

   ⚠ 但**视口尺寸不一定就绪**。sandbox（不透明来源）的 iframe 里实测会撞上：
   子页面脚本跑的那一刻，父页面还没给 iframe 定尺寸，于是
   documentElement.clientWidth/Height 都是 0 —— 媒体查询全部走最窄分支
   （桌面导航 display:none、卡片宽度 0），clickTarget 的「x > vw」恒成立，
   每一次点击都找不到落点。量到的是**另一个页面**，而报出来像「十处站点故障」。
   这是竞态：有时撞上、有时不撞，所以表现为偶发。

   修法：视口没有尺寸就**不跑**。父页面在 iframe load 之后反复喊 go，
   等到定好尺寸再跑一次。顶层模式没有父页面来喊，而它的视口第一帧就是对的，
   所以照样在这里直接跑。 */
window.__H.started = false;
/* 「文档真的布局过」——clientWidth 证明不了这件事：它在布局之前就已经是
   iframe 的宽度（来自初始包含块），所以会放行一个还没布局的文档，
   于是每个元素的 getBoundingClientRect 都是 0,0 0x0（不是 display:none，
   而是根本没量过），clickTarget 全部落空。--dump-dom 不产出帧，
   文档什么时候被布局是不确定的 —— 这就是偶发的来源。
   真正能证明布局发生过的是：站点自己渲染出来的东西有实际尺寸。
   getBoundingClientRect 会强制同步布局，所以这里不是等运气，是催它一次。 */
function laidOut() {
  var c = document.querySelector('.card') || document.querySelector('#view > *');
  if (!c) return false;
  var r = c.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}
function tryRun() {
  if (window.__H.started) return;
  /* 三个前提，缺一不可：
     ① 站点已经 boot（DOMContentLoaded 之后）—— 父页面的 go 有可能在子页面
        还在解析时就送达，那时 querySelector('.card__link') 是 null，
        量出来的是「元素不存在」，又是一批看着像站点故障的假象；
     ② 视口有尺寸；
     ③ 文档已经布局过。 */
  if (document.readyState === 'loading') return;
  if (!document.documentElement.clientWidth) return;
  if (!laidOut()) return;
  window.__H.started = true;
  run();
}
window.addEventListener('message', function (e) {
  if (!e.data || !e.data.__hostileGo) return;
  tryRun();
});
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tryRun);
else tryRun();
</script>
`;

/* ------------------------------------------------------------ 页面拼装 -- */

/* 量具的一部分：**不许真的下载**。必须排在所有注入之前，包括 PRE_SCRIPTS 里的敌意注入。

   「拿走它」的两个导出是真 <a download href="blob:">，有两条下载路径：
     ① 浏览器默认行为（不经过任何监听器）
     ② onAction 的 JS 兜底：Blob + createObjectURL + 新建 <a download> + a.click()

   覆写 HTMLAnchorElement.prototype.click 只拦得住 ②。① 是默认行为，绕过 .click()，
   覆写它拦不到 —— 这里原本写着「合成事件不会触发浏览器默认行为，所以不会真的落盘」，
   **那是错的**：实测往 ~/Downloads 里写了 47 个 cyber-night-market-card (N).json，
   而且那个挂着的下载让 --virtual-time-budget 永远烧不完（6 个模式集体超时 16 分钟）。

   为什么必须排在 PRE_SCRIPTS 之前：hostile-click 用 stopImmediatePropagation
   抢先注册，会把**之后**注册的所有 window 捕获监听器一起吃掉 ——
   包括这个守卫。而 stopImmediatePropagation **不阻止默认行为**，
   所以下载照旧发生、照样挂住。守卫排在最前面才拦得住。

   代价要说清楚：hostile-click 下宿主把 click 整个吃掉，站点的 JS 兜底也不会跑，
   于是那一步只能验「链接是真的、文件名对、href 在」，验不到「下载真的发生」。
   这是量具为了不污染用户目录必须付的代价，不是站点缺陷。 */
const DOWNLOAD_GUARD = `<script>
window.__DL = [];
/* ① 默认行为 */
window.addEventListener('click', function (e) {
  var t = e.target, a = t && t.closest ? t.closest('a[download]') : null;
  if (a) e.preventDefault();
}, true);
/* ② JS 兜底的最后一步 */
(function () {
  var proto = window.HTMLAnchorElement && window.HTMLAnchorElement.prototype;
  if (!proto || !proto.click) return;
  var real = proto.click;
  proto.click = function () {
    if (this.hasAttribute && this.hasAttribute('download')) {
      window.__DL.push(String(this.getAttribute('download')));
      return;
    }
    return real.apply(this, arguments);
  };
})();
</script>
`;

const PRE_SCRIPTS = {
  'no-io': `<script>
    try { Object.defineProperty(window, 'IntersectionObserver', { value: undefined, configurable: true }); } catch (e) {}
  </script>`,
  'no-raf': `<script>
    try { Object.defineProperty(window, 'requestAnimationFrame', { value: undefined, configurable: true }); } catch (e) {}
    try { Object.defineProperty(window, 'cancelAnimationFrame', { value: undefined, configurable: true }); } catch (e) {}
  </script>`,
  'hostile-click': `<script>
    /* 模拟预览面板：在 window 捕获阶段抢先注册，并 stopImmediatePropagation */
    window.__HOST_ATE = 0;
    window.addEventListener('click', function (e) {
      window.__HOST_ATE++;
      e.stopImmediatePropagation();
    }, true);
  </script>`,
  'hostile-prevent': `<script>
    /* 另一种宿主：把所有 click 的默认行为一律 preventDefault 掉。
       必须挂在 **window 捕获**上，而且要抢在 app.js 之前注册 ——
       挂在 document 捕获是测不出来的：站点的监听器在 window 捕获，
       永远先跑，那时 defaultPrevented 还是 false。 */
    window.__HOST_PREVENTED = 0;
    window.addEventListener('click', function (e) {
      window.__HOST_PREVENTED++;
      e.preventDefault();
    }, true);
  </script>`,
  'io-dead': `<script>
    /* 观察者「在、但永远不回调」：宿主屏蔽了它，或者实现是坏的。
       这是最阴的一种 —— typeof 判断为真、构造函数不抛错，
       但回调永远不来，内容就停在 opacity:0。
       唯一能救的是那条定时兜底。 */
    window.__IO_DEAD = true;
    window.IntersectionObserver = function () {
      return { observe: function () {}, unobserve: function () {}, disconnect: function () {} };
    };
  </script>`,
  'io-dead-quiet': `<script>
    /* 同上，但探针一步都不点。
       非 quiet 的 io-dead 测不出定时兜底：探针为了点击会滚动，
       滚动本身就会触发 onScroll 里的 revealFallback，把结果掩盖掉。
       要单独验证「定时兜底」，必须让页面完全静止。 */
    window.__IO_DEAD = true;
    window.__HOST_QUIET = true;
    window.IntersectionObserver = function () {
      return { observe: function () {}, unobserve: function () {}, disconnect: function () {} };
    };
  </script>`
};

function childHTML(mode) {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const pre = PRE_SCRIPTS[mode] || '';
  /* 下载守卫在最前，敌意注入在其后，两者都在站点脚本之前。
     顺序不能换：hostile-click 会吃掉之后注册的所有 window 捕获监听器。

     ⚠ 注入靠一个**字符串 replace**。没匹配上时 replace 会**静默原样返回** ——
     守卫和敌意注入一起消失，而走查照样跑、照样报绿（导出那一步的
     「默认行为被取消 N 个」变成 0，读起来像站点坏了）。
     这是本项目反复踩的「静默退化」，所以宁可在构建期炸掉。 */
  const ANCHOR = '<script src="assets/js/data-curated.js"></script>';
  if (html.indexOf(ANCHOR) < 0) {
    throw new Error('hostile: index.html 里找不到 ' + ANCHOR +
      ' —— 注入锚点变了，childHTML() 的 replace 会静默失效');
  }
  html = html.replace(ANCHOR, DOWNLOAD_GUARD + pre + '\n' + ANCHOR);
  /* 探针必须在 app.js 之后 */
  const at = html.lastIndexOf('</body>');
  if (at < 0) throw new Error('hostile: index.html 里找不到 </body> —— 探针无处可挂');
  return html.slice(0, at) + PROBE + html.slice(at);
}

function parentHTML(mode) {
  const sandbox = mode === 'sandbox' ? ' sandbox="allow-scripts"' : '';
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>hostile:${mode}</title>
<style>body{margin:0;font:12px/1.5 monospace}iframe{border:0}</style></head><body>
<pre id="out">WAITING</pre>
<iframe id="f" src="/__child.html?m=${mode}"${sandbox} style="width:1440px;height:900px;border:0"></iframe>
<script>
var got = [];
function flush() {
  document.getElementById('out').textContent = 'HOSTILE_RESULT ' + JSON.stringify(got);
}
window.addEventListener('message', function (e) {
  if (!e.data || !e.data.env) return;
  got.push(e.data);
  flush();                       /* 收到就写，不等定时器 */
});
/* 子页面在**视口有尺寸之前不跑**（sandbox 模式下实测会撞上 0×0 的竞态，
   见 PROBE 末尾的说明）。这里负责在 iframe load 之后反复喊它开工，
   直到它开始回报为止。父页面是普通页面，定时器在 --virtual-time-budget 下照常推进。 */
var f = document.getElementById('f');
var tries = 0;
function go() {
  if (got.length > 0 || tries++ > 120) return;   /* 已开工，或约 6 秒还没尺寸就放弃 */
  try { f.contentWindow.postMessage({ __hostileGo: 1 }, '*'); } catch (e) { }
  setTimeout(go, 50);
}
f.addEventListener('load', function () { go(); });
setTimeout(go, 0);               /* 万一 load 因为某个子资源迟迟不来，这里先踢一脚 */
setTimeout(flush, 15000);        /* 兜底（顶层模式下不生效，无所谓） */
</script>
</body></html>`;
}

/* ---------------------------------------------------------------- 服务 -- */

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.avif': 'image/avif'
};

const MODES = ['top', 'plain', 'sandbox', 'no-io', 'no-raf', 'io-dead', 'io-dead-quiet', 'hostile-click', 'hostile-prevent'];

/* hostile-* 里宿主会吃掉或取消 click。真 <a> 靠浏览器默认行为仍然可用
   （探针用 clickMaybeDefault 复现导航这条路径），而纯 JS 控件（复制、
   投稿 chips）本来就只能靠 JS —— 这几条是宿主作祟时的已知边界，
   单独列出，不算站点回归。

   注意「详情页导出」**不在** JS_ONLY 里：它是真 <a download href="blob:">，
   属于 NEEDS_LINK 那一类，宿主吃掉 click 时也必须活着。
   它曾经是纯 JS 按钮，正是在这条走查里暴露出「宿主吃点击就死」，
   才改成真链接的 —— 别改回去。 */
const JS_ONLY = ['详情页复制按钮', '详情页复制'];
const NEEDS_LINK = ['首页点卡片', '详情页转换提示词', '导航→提示词库', '点用途 chip 筛选', '加载更多', '参考图折叠', '详情页导出'];

function startServer() {
  const children = {}, parents = {};
  MODES.forEach(function (m) { children[m] = childHTML(m); parents[m] = parentHTML(m); });

  const srv = http.createServer(function (req, res) {
    const m = (req.url.split('m=')[1] || 'top').split('&')[0];
    if (req.url.indexOf('/__child.html') === 0) {
      res.writeHead(200, { 'content-type': MIME['.html'] });
      return res.end(children[m] || children.top);
    }
    if (req.url.indexOf('/__parent-') === 0) {
      const pm = req.url.replace('/__parent-', '').replace('.html', '').split('?')[0];
      res.writeHead(200, { 'content-type': MIME['.html'] });
      return res.end(parents[pm] || parents.top);
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
      '--window-size=1440,900', '--virtual-time-budget=12000', '--dump-dom', url
    ];
    const p = spawn(CH, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let out = '';
    let done = false;
    /* 硬超时。--virtual-time-budget 的语义是「虚拟时间烧完就退出」，
       但只要页面持续有任务排队（实测：合成点击触发了真实下载，
       下载请求永远不结束），虚拟时间就永远烧不完，--dump-dom 会一直等。
       没有这层保护，整个走查会**静默挂死** —— 已经发生过一次，
       22 分钟零输出。宁可明确报超时，也不要挂在那里。 */
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

function extract(dom) {
  const m = dom.match(/HOSTILE_RESULT (\[[\s\S]*?\])<\/pre>/);
  if (m) { try { return JSON.parse(unesc(m[1])); } catch (e) { /* fall through */ } }
  const t = dom.match(/<pre id="__hostile-out">([\s\S]*?)<\/pre>/);
  if (t) { try { return [JSON.parse(unesc(t[1]))]; } catch (e) { return null; } }
  return null;
}

(async function main() {
  const { srv, port } = await startServer();
  const base = 'http://127.0.0.1:' + port;
  let bad = 0;

  for (const mode of MODES) {
    if (ONLY && mode !== ONLY) continue;
    /* top 模式没有父页面，直接打开子页面，结果读它自己的 #__hostile-out */
    const url = base + (mode === 'top' ? '/__child.html?m=top' : '/__parent-' + mode + '.html');
    const dom = await chrome(url);
    const data = extract(dom);
    console.log('\n══ ' + mode + ' ══════════════════════════════════════');
    if (dom.indexOf('<!-- CHROME_TIMEOUT -->') >= 0) {
      console.log('  ✗ Chrome 超时被杀 —— 页面里还有任务排不完（下载？死循环？）');
      console.log('    DOM 片段: ' + unesc(dom.replace(/<!-- CHROME_TIMEOUT -->/, '').replace(/\s+/g, ' ').slice(0, 300)));
      bad++;
      continue;
    }
    if (!data || !data.length) {
      console.log('  ✗ 子页面没有回报结果 —— 探针没跑完（脚本被宿主掐断？）');
      console.log('    DOM 片段: ' + unesc(dom.replace(/\s+/g, ' ').slice(0, 300)));
      bad++;
      continue;
    }
    const R = data[data.length - 1];
    console.log('  env ' + JSON.stringify(R.env));
    /* 量具自检先于一切站点断言：守卫不在时，导出的「被取消 0 个」是量具故障，
       不是站点故障 —— 必须把这两件事分开报，否则会去修一个没坏的东西。 */
    if (R.env.guard !== 'present') {
      console.log('  ✗ 下载守卫没有注入 —— childHTML() 的 replace 静默失效了' +
        '（index.html 的 data-curated.js 标签写法变了？）');
      bad++;
    }
    if (R.errors && R.errors.length) console.log('  ✗ 运行时异常 ' + JSON.stringify(R.errors.slice(0, 3)));
    /* 量具故障与站点故障必须分开报。命中不到 = 探针一次点击都没发出去，
       后面所有「没生效」的结论都不成立 —— 不能拿它去改站点。 */
    if (R.hitMiss && R.hitMiss.length) {
      console.log('  ✗ 量具没点到（' + R.hitMiss.length + ' 处，下面的失败都不能算站点缺陷）：');
      R.hitMiss.slice(0, 4).forEach(function (w) { console.log('      ' + w); });
      bad++;
    }
    if (R.env.bootErrors && R.env.bootErrors.length) console.log('  ✗ boot 报错 ' + JSON.stringify(R.env.bootErrors.slice(0, 3)));

    const ate = mode.indexOf('hostile-') === 0;
    (R.steps || []).forEach(function (s) {
      const expected = ate && JS_ONLY.indexOf(s.name) >= 0;
      const mark = s.ok ? '✓' : (expected ? '·' : '✗');
      console.log('  ' + mark + ' ' + s.name + (s.note ? '   [' + s.note + ']' : '') +
        (expected && !s.ok ? '   ← 纯 JS 控件，宿主吃点击时预期失效' : ''));
      if (!s.ok && !expected) bad++;
    });
    if (ate) {
      const lost = (R.steps || []).filter(function (s) { return NEEDS_LINK.indexOf(s.name) >= 0 && !s.ok; });
      if (lost.length) console.log('  ✗ 宿主吃点击时，导航类交互也失效了：' + lost.map(function (s) { return s.name; }).join('、'));
    }
    if (R.phase !== 'done') { console.log('  ✗ 探针没跑到底（phase=' + R.phase + '）'); bad++; }
    /* 观察者不可用时，内容绝不能停在 opacity:0。
       两条路各管一半：typeof 判断兜住「压根没有」，
       定时兜底兜住「在、但永远不回调」。 */
    if (R.env.io === false && R.env.revealStuck > 0) {
      console.log('  ✗ IntersectionObserver 不可用，视口内仍有 ' + R.env.revealStuck + ' 个 .reveal 没拿到 is-in');
      bad++;
    }
    if (R.env.ioDead) {
      if (!R.env.timerWorks) {
        console.log('  · 观察者已死，但这个环境不推进定时器，定时兜底无法验证（预期内）');
      } else if (R.env.revealStuckLate > 0) {
        console.log('  ✗ 观察者永不回调，定时兜底也没生效：视口内还有 ' + R.env.revealStuckLate + ' 个 .reveal 没拿到 is-in');
        bad++;
      }
    }
  }

  srv.close();
  console.log('\n' + (bad === 0 ? '敌意环境走查全部通过' : '敌意环境走查发现 ' + bad + ' 个问题'));
  process.exit(bad === 0 ? 0 : 1);
})();
