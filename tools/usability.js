/* ============================================================================
   可用性走查：像用户一样真的点一遍

   用法：
     cd shutong && node tools/usability.js          # 默认根目录 = 本脚本的上一级
     node tools/usability.js "<站点根目录>"          # 也可以显式指定

   四种模式各跑一遍：
     normal         普通浏览器（1440）。
                   开头先过一遍**首页图版台**：头图上那三片灰色圆角方块
                   （品牌玻璃母题）已经换成印刷套准网格 + 18 格刻度尺，
                   点刻度换主图版。这里验的是 JSDOM 里根本不存在的东西 ——
                   命中检测、层叠、布局，所以只能在真浏览器里跑。
     no-hashchange  把 hashchange 事件彻底屏蔽，模拟 iframe / 预览面板这类
                    不派发该事件的宿主环境 —— 这是「页面渲染正常但点哪都没反应」
                    的典型成因，必须确保路由不依赖它。
     narrow         窄屏 560。走另一套检查：筛选默认收起、首张卡片必须在一屏内出现、
                    展开/收起、展开后点 chip 能筛选，以及**详情页的返回键**
                    （窄屏是它最要紧的地方：没有鼠标悬停、面包屑又小）。
                    这里也是唯一真的点一下返回键的地方 —— 点完正好要回列表，
                    不会打断别的步骤。桌面档只做命中测试，不点。
                    桌面流程在窄屏跑不通（chip 行是 display:none，
                    realClick 找不到落点），所以分开写。
     tablet         平板 900。720–1100px 是唯一「汉堡抽屉」形态的区间
                    （≤720 变常驻底部条，>1100 是完整横向导航），原来只有
                    1440 与 560 两档，整整一档无覆盖 —— 而它恰恰是最容易漏的：
                    抽屉里曾经只放 4 个分类链接，导致手机上创作者/投稿/规范
                    完全点不到。这一档专门守两件事：抽屉能开合，
                    以及抽屉里必须是**主栏目**。

   点击用完整的 pointerdown→mousedown→pointerup→mouseup→click 序列派发到
   elementFromPoint 命中的元素上。坐标要反复试几次：站点里有 sticky 的分类栏，
   滚到视口中心时坐标可能正好落在它上面，命中不对就换个位置重试。

   三个已经踩过的坑，别改回去：
   1. 量坐标之前必须把 scroll-behavior 临时改成 auto。站点全局开了平滑滚动，
      紧跟在 scrollIntoView 后面的 getBoundingClientRect 拿到的是滚动前的坐标，
      elementFromPoint 会命中视口外的点，报出一堆假的「被遮挡」。
   2. 选「用途」chip 一定要带 :not([data-value=""])。那个 data-value 为空的
      「全部」也是 .chip[data-param="use"]，点到它等于清空筛选，hash 里不会有 use=。
   3. 探针里必须注入 NO_MOTION 把过渡时长归零，否则 --virtual-time-budget
      会让 .mobilenav / .palette 这类靠过渡隐藏的元素停在起点：类名已经 is-open，
      计算样式却还是 hidden，命中落到它底下的内容上 —— 全是假阳性。
      同理，visible() 必须看计算样式，不能只量 rect（收起时它仍然占布局）。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/* 四档的名字。写在这里是因为解析命令行参数时就要用。 */
const ALL_MODES = ['normal', 'no-hashchange', 'narrow', 'tablet'];

const ROOT = (function () {
  /* 允许只跑某一档，给变异测试用（四档全跑要开四次无头 Chrome，太慢）：
       node tools/usability.js "<站点根目录>" tablet
       node tools/usability.js tablet            # 根目录取默认
     档名以外的第一个非选项参数才当根目录。 */
  const args = process.argv.slice(2);
  const picked = args.filter(a => ALL_MODES.indexOf(a) >= 0);
  const rootArg = args.filter(a => ALL_MODES.indexOf(a) < 0)[0];
  return rootArg ? path.resolve(rootArg) : path.resolve(__dirname, '..');
})();
const CH = process.env.CHROME_BIN || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : 'google-chrome');

const ARGS = process.argv.slice(2);
const ONLY_MODES = ARGS.filter(a => ALL_MODES.indexOf(a) >= 0);

if (!fs.existsSync(path.join(ROOT, 'index.html'))) {
  console.error('找不到站点根目录（缺 index.html）：' + ROOT);
  process.exit(2);
}

/* 必须在 app.js 之前执行：把 hashchange 的注册整个吞掉 */
const KILL_HASHCHANGE = `<script>
(function () {
  var orig = window.addEventListener;
  window.addEventListener = function (type) {
    if (type === 'hashchange') return;      /* 假装宿主环境不支持这个事件 */
    return orig.apply(window, arguments);
  };
})();
</script>
`;

/* ----------------------------------------------------------------------------
   量具的 bug，不是站点的 bug —— 把过渡和动画的时长归零

   无头 Chrome 的 --virtual-time-budget 推进 setTimeout，却**不推进 CSS 过渡**。
   于是出现「类名加上了、计算样式还停在起点」：.mobilenav 与 .palette 都靠
   visibility+opacity+transition 隐藏，探针点开之后量到的仍是
   visibility:hidden / opacity:0，elementFromPoint 命中的是它底下的内容，
   于是报出一堆假的「被遮挡」「点不开」。

   实测对照（同一页面、同一元素）：
     过渡未推进 → 类名 is-open=true，计算样式 hidden/0，命中 div.hero__brandline
     归零之后   → 类名 is-open=true，计算样式 visible/1，命中 a.palette__item，点击成功

   真浏览器里过渡必然走完，所以这不是站点缺陷；而走查要量的是**稳定态**，
   不是中间帧。app.js 里没有任何 transitionend / animationend 依赖，
   归零不会掩盖真实行为。
   ------------------------------------------------------------------------- */
const NO_MOTION = `<style id="__no-motion">*,*::before,*::after{transition:none!important;animation:none!important}</style>
`;

/* 「内部溢出」检查：元素的 scrollWidth 超过自己的 clientWidth，
   就是内容顶出了自己的盒子。

   为什么页面级溢出检测（tools/overflow.js）抓不到：父元素不滚动，
   文档宽度也就正常 —— 只是里面那行字画到了边框外面。
   （本站 body 是 overflow-x: clip，页面级横向溢出在结构上就不可能发生，
   所以这一类缺陷只能靠「量元素自己」来发现。）

   实测案例：首页图版顶栏原来是一行两端对齐（「№ 01 / 18」+「Cyber Night Market」），
   内容宽 215px、实际 237px，**溢出 18px**，拉丁名被顶出图版边框。
   它一直在那儿，但顶栏字色太浅（--ink-4，2.24:1）根本看不清，
   直到这一轮把对比度修好才暴露出来 —— 「看不见的缺陷」和「不存在的缺陷」
   在截图里长得一模一样。

   ⚠ 一条恒为真的断言和一个干净的结果长得一模一样，所以：
     1. 选择器组必须**逐段**展开（第一版直接拼 ' *'，A 的后代一个都没扫到，
        变异测试没变红才发现）；
     2. 把「扫了多少个元素」一起带出去 —— 扫了 0 个时说「没问题」是废话。 */
const SPILL_SNIPPET = `
function spillVisible(el) {
  var n = el;
  while (n && n.nodeType === 1) {
    var s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    n = n.parentElement;
  }
  return true;
}
/* 溢出是不是**绝对定位的装饰**造成的？
   首页那三张 floatcard 里有一张用 inset-inline-end: -2% 故意挂在右边界外
   （设计如此，由 section.hero 的 overflow-x: hidden 兜着），
   它会让 .hero__visual / .hero__grid 的 scrollWidth 大于 clientWidth。
   这类「悬出去的装饰」不算缺陷 —— 真正的缺陷发生在正常流的文字上。 */
function spillFromOutOfFlow(el) {
  var kids = el.querySelectorAll('*');
  var pr = el.getBoundingClientRect();
  for (var i = 0; i < kids.length; i++) {
    var p = getComputedStyle(kids[i]).position;
    if (p !== 'absolute' && p !== 'fixed') continue;
    if (kids[i].getBoundingClientRect().right > pr.right + 1) return true;
  }
  return false;
}
function spillCheck(scope) {
  var out = [];
  /* ⚠ 选择器组不能直接拼 ' *' —— 'A, B *' 只给**最后一段**加了后代选择器，
     A 的后代一个都扫不到。第一版就是这么写的，于是这条断言恒为真：
     变异测试（plate-head-overflows）没变红才发现。逐段展开才对。 */
  var sel = scope.split(',').map(function (s) { return s.trim() + ' *'; }).join(', ');
  var all = document.querySelectorAll(sel);
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    /* SVG / 图片没有「内容比盒子宽」这回事 */
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    /* overflow-x 不是 visible 的，是**故意的**滚动或裁切容器（走马灯、代码块、
       封面裁切），跳过。 */
    if (getComputedStyle(el).overflowX !== 'visible') continue;
    if (!spillVisible(el)) continue;
    if (spillFromOutOfFlow(el)) continue;
    out.push(cn(el) + ' ' + el.scrollWidth + '>' + el.clientWidth +
      ' 「' + (el.textContent || '').trim().slice(0, 16) + '」');
  }
  out.scanned = all.length;
  return out;
}
`;

const PROBE = `
<script>
window.__UX = { log: [], errors: [] };
window.addEventListener('error', function (e) {
  window.__UX.errors.push(String(e.message) + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
});
${SPILL_SNIPPET}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function instantScroll(y) {
  var prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = prev;
}

function cn(e) {
  if (!e) return 'null';
  var c = (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '';
  return e.tagName.toLowerCase() + (c ? '.' + String(c).trim().split(/\\s+/).join('.') : '');
}

/* 找一个「点下去真的能命中目标」的位置，最多试 6 个落点 */
function clickTarget(el) {
  if (!el) return null;
  var vh = document.documentElement.clientHeight;
  var vw = document.documentElement.clientWidth;
  var spots = [0.5, 0.42, 0.6, 0.34, 0.68, 0.28];
  for (var i = 0; i < spots.length; i++) {
    var r = el.getBoundingClientRect();
    instantScroll(window.scrollY + r.top - vh * spots[i] + r.height / 2);
    r = el.getBoundingClientRect();
    var x = Math.round(r.left + r.width / 2);
    var y = Math.round(r.top + r.height / 2);
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    var hit = document.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return { el: hit, x: x, y: y };
  }
  return null;
}

function realClick(el) {
  var t = clickTarget(el);
  if (!t) return { ok: false, why: '找不到能命中 ' + cn(el) + ' 的落点' };
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
    var Ctor = type.indexOf('pointer') === 0 ? (window.PointerEvent || MouseEvent) : MouseEvent;
    t.el.dispatchEvent(new Ctor(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: t.x, clientY: t.y, button: 0,
      buttons: (type === 'mousedown' || type === 'pointerdown') ? 1 : 0
    }));
  });
  return { ok: true, hit: cn(t.el) };
}

function rec(label, pass, detail) {
  window.__UX.log.push({ label: label, pass: !!pass, detail: detail == null ? '' : String(detail) });
}

/* 在 el 的中心点派发完整指针序列，接收方是 elementFromPoint 真正命中的元素。
   用途：验证「链接层盖住整张卡」——目标（著录区文字）本身被 .card__link 盖住
   是设计如此，所以不能用 realClick 的「命中必须是自己或自己的祖先」判据，
   否则会误报「找不到落点」。返回值里带上实际命中的元素，好断言确实是链接。 */
function clickThrough(el) {
  if (!el) return { ok: false, why: '元素不存在' };
  var vh = document.documentElement.clientHeight;
  var vw = document.documentElement.clientWidth;
  var spots = [0.5, 0.42, 0.6, 0.34, 0.68, 0.28];
  for (var i = 0; i < spots.length; i++) {
    var r = el.getBoundingClientRect();
    instantScroll(window.scrollY + r.top - vh * spots[i] + r.height / 2);
    r = el.getBoundingClientRect();
    var x = Math.round(r.left + r.width / 2);
    var y = Math.round(r.top + r.height / 2);
    if (x < 0 || y < 0 || x > vw || y > vh) continue;
    var hit = document.elementFromPoint(x, y);
    if (!hit) continue;
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
      var Ctor = type.indexOf('pointer') === 0 ? (window.PointerEvent || MouseEvent) : MouseEvent;
      hit.dispatchEvent(new Ctor(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: x, clientY: y, button: 0,
        buttons: (type === 'mousedown' || type === 'pointerdown') ? 1 : 0
      }));
    });
    return { ok: true, hit: cn(hit) };
  }
  return { ok: false, why: '找不到能命中 ' + cn(el) + ' 的落点' };
}

(async function run() {
  if (document.readyState === 'loading') await new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, { once: true }); });
  await sleep(300);

  /* 0. 内部溢出 —— **必须放在所有交互之前**。
     这条断言第一版放在图版台那一段之后，而那一段会点第 7 格换图版；
     第 7 张的拉丁名很短（Mist Ink），顶栏不溢出 —— 于是变异测试
     （plate-head-overflows）没变红，查了半天才发现是**状态依赖**：
     断言的结果取决于它前面发生过什么。

     所以量的是**用户第一眼看到的那个状态**：默认图版是第一张
     「Cyber Night Market」，恰好是 18 个拉丁名里最长的（153px）。
     详情里把当前图版名打出来 —— 万一以后第一张换了、不再是那个最长的，
     这行字会立刻说明「这条检查没覆盖到最坏情况」。 */
  var spillHome = spillCheck('#view, #nav, footer');
  rec('布局：没有元素的内部内容顶出自己的盒子（首页）',
      spillHome.length === 0,
      spillHome.slice(0, 4).join(' | ') ||
      ('已扫 ' + spillHome.scanned + ' 个元素，当前图版「' +
        ((document.querySelector('.hero__plate-head .plate--latin') || {}).textContent || '?').trim() + '」'));

  /* 0. 首页图版台 —— 用户报「这里不需要产品 logo，需要一些高级的设计和交互」。
     那三片灰色圆角方块已经换成印刷套准网格 + 刻度尺。
     这里验两件 JSDOM 里根本验不了的事：刻度真的落得到指针、点下去图版真的换图。
     JSDOM 没有布局也没有层叠，命中检测只在真浏览器里存在。 */
  var plate = document.querySelector('.hero__visual .hero__plate');
  var plateHit = plate ? clickTarget(plate) : null;
  rec('首页图版台：主图版是真链接且指针落得到',
      !!plate && plate.tagName === 'A' &&
      (plate.getAttribute('href') || '').indexOf('#/style/') === 0 && !!plateHit,
      (plate ? plate.tagName + ' href=' + plate.getAttribute('href') : '找不到 .hero__plate') +
      (plateHit ? ' 命中=' + cn(plateHit.el) : ' ✗ 找不到落点'));

  rec('首页头图不再摆品牌玻璃母题',
      document.querySelectorAll('.hero__glass').length === 0 &&
      !document.querySelector('.hero__visual .desk'),
      'glass=' + document.querySelectorAll('.hero__glass').length +
      ' desk=' + document.querySelectorAll('.hero__visual .desk').length +
      ' 规矩线=' + document.querySelectorAll('.hero__visual .desk__reg').length);

  var ticks = document.querySelectorAll('.hero__index .tick');
  var tick7 = ticks[6];
  var tickHit = tick7 ? clickTarget(tick7) : null;
  var imageTotal = STYLES.filter(function (s) { return s.category === 'image'; }).length;
  rec('首页图版台：刻度尺覆盖所有图片风格，指针落得到',
      ticks.length === imageTotal && imageTotal > 0 && !!tickHit,
      '格数=' + ticks.length + ' / ' + imageTotal + (tickHit ? ' 命中=' + cn(tickHit.el) : ' ✗ 找不到落点'));

  var wantId = tick7 ? tick7.getAttribute('data-id') : '';
  var srcBefore = (document.querySelector('.hero__plate .cover img') || {}).src || '';
  var hashBeforeDesk = location.hash;
  var r0 = tick7 ? realClick(tick7) : { ok: false, why: '没有第 7 格' };
  await sleep(220);
  var srcAfter = (document.querySelector('.hero__plate .cover img') || {}).src || '';
  /* 两件事都要成立：图变了，而且换到的是**那一张**。
     只比「有变化」的话，点哪格都换到同一张也能过。 */
  rec('首页图版台：点第 7 格，图版真的换成那一张',
      !!srcAfter && srcAfter !== srcBefore && srcAfter.endsWith(STYLES.find(function(s){return s.id === wantId;}).cover.src),
      '期望条目 "' + wantId + '"，实际 ' + srcAfter.split('/').pop() +
      '（原 ' + srcBefore.split('/').pop() + '）' + (r0.ok ? '' : ' ⚠ ' + r0.why));
  rec('首页图版台：换图不改地址栏',
      location.hash === hashBeforeDesk,
      'hash=' + location.hash + '（换图前 ' + hashBeforeDesk + '）');

  /* 0b. 换过图版之后再量一次 —— 顶栏的高度和宽度都跟着图版内容走，
       而这时显示的是**另一张**（第 7 张）。两条一起过，才说明顶栏
       对长名字和短名字都稳。 */
  var spillSwapped = spillCheck('.hero__visual');
  rec('布局：换过图版之后顶栏也不溢出',
      spillSwapped.length === 0,
      spillSwapped.slice(0, 4).join(' | ') ||
      ('已扫 ' + spillSwapped.scanned + ' 个元素，当前图版「' +
        ((document.querySelector('.hero__plate-head .plate--latin') || {}).textContent || '?').trim() + '」'));

  /* 1. 首页点卡片 */
  var r1 = realClick(document.querySelector('.card__link'));
  await sleep(250);
  rec('首页点卡片 → 进详情页',
      location.hash.indexOf('#/style/') === 0 && !!document.querySelector('.gh__title'),
      'hash=' + location.hash + ' 标题=' + (document.querySelector('.gh__title') || {}).textContent +
      (r1.ok ? '' : ' ⚠ ' + r1.why));

  /* 1b. 详情页的返回键。用户报「每一个 sku 点进去后都没有返回按钮」——
         这条守它：必须在、必须是真链接、而且指针真的落得到它上面
         （面包屑那条老路是 --step--2 的灰色小字，看得见但没人把它当出口）。

         这里只做命中测试、**不点**：点了会离开详情页，
         后面的步骤（轨道页签 / 复制 / 拿走它）全都假设还在这一页上。
         真的点一下由窄屏档负责（那边点完正好要回列表）。 */
  var back = document.querySelector('.gh__nav a.backlink');
  var backHit = back ? clickTarget(back) : null;
  var backRect = back ? back.getBoundingClientRect() : { width: 0, height: 0 };
  rec('详情页有返回键，且指针落得到它上面',
      !!back && backRect.width > 0 && backRect.height > 0 && !!backHit,
      (back ? '文案="' + back.textContent.trim() + '" ' +
        Math.round(backRect.width) + 'x' + Math.round(backRect.height) : '找不到 .gh__nav a.backlink') +
      (backHit ? ' 命中=' + cn(backHit.el) : ' ✗ 找不到落点'));
  rec('详情页返回键指向提示词库且没挂 data-action',
      !!back && (back.getAttribute('href') || '').indexOf('#/library') === 0 &&
      !back.hasAttribute('data-action'),
      back ? 'href=' + back.getAttribute('href') : 'n/a');

  rec('详情页提供上传原图的转换提示词',
      !!document.querySelector('.prompt__body') && document.querySelector('.prompt__body').textContent.includes('上传'), '图生图任务');

  /* Real hit testing for the new working controls, beyond DOM-only contracts. */
  var field = document.querySelector('[data-action="slot-input"]');
  var rf = realClick(field);
  if (field) { field.value = 'QA 柔和自然光'; field.dispatchEvent(new Event('input', { bubbles: true })); }
  rec('详情工作台：字段可点且实时更新提示词', rf.ok && document.querySelector('.prompt__body').textContent.indexOf('QA 柔和自然光') >= 0,
      rf.ok ? '填写内容已进入预览' : rf.why);
  var rr = realClick(document.querySelector('[data-action="reset-slots"]'));
  rec('详情工作台：重置可点且清空输入', rr.ok && field && !field.value && document.querySelector('.prompt__body').textContent.indexOf('QA 柔和自然光') < 0,
      rr.ok ? '恢复模板占位符' : rr.why);
  var save = document.querySelector('.gh__actions [data-action="save-toggle"]');
  var rs = realClick(save);
  rec('详情工作台：收藏可点且状态更新', rs.ok && save.getAttribute('aria-pressed') === 'true', rs.ok ? '已收藏' : rs.why);
  realClick(save);
  var zoom = document.querySelector('[data-action="image-expand"]');
  var rz = realClick(zoom), viewer = document.querySelector('dialog.image-viewer');
  rec('详情工作台：大图可打开', rz.ok && !!viewer && viewer.open && !!viewer.querySelector('img'), rz.ok ? '完整图片' : rz.why);
  var rc = realClick(document.querySelector('.image-viewer__close'));
  rec('详情工作台：大图可关闭并回到入口', rc.ok && !document.querySelector('dialog.image-viewer') && document.activeElement === zoom, rc.ok ? '焦点已返回' : rc.why);

  /* 3. 复制按钮 */
  var copy = document.querySelector('.gh__actions [data-action="copy-prompt"]');
  var e0 = window.__UX.errors.length;
  realClick(copy);
  await sleep(200);
  rec('详情页复制按钮可点且不报错',
      !!copy && window.__UX.errors.length === e0,
      '按钮文案="' + (copy ? copy.textContent.trim() : '无') + '"');

  /* 3b. 详情页「拿走它」——导出参数包 / 说明、复制负向词 / 参数清单。
     这一层专门验「指针真的能落到它上面」（命中测试），
     至于点了之后走哪条路、默认行为有没有被取消，由 hostile.js 和 hf-test.js 管。
     导出必须是真 <a download href="blob:...">：宿主吃掉 click 时它才活得下来。 */
  var exLinks = document.querySelectorAll('.takeaway__row a[data-action][download]');
  var exCopy = document.querySelectorAll('.takeaway__row button[data-action^="copy-"]');
  if (exLinks.length === 2 && exCopy.length === 0) {
    var id = location.hash.replace('#/style/', '').split('?')[0];
    var e1 = window.__UX.errors.length;
    var rEx = realClick(exLinks[0]);
    /* 自己再算一次落点。realClick 只回一个 class 字符串，
       而 clickTarget 的判据允许「命中的是目标的祖先」—— 对导出链接来说，
       那恰恰意味着「被别的东西盖住了」，必须排除掉。
       量坐标要紧跟 realClick（它内部已经把滚动落定），中间别插 await。 */
    var rb = exLinks[0].getBoundingClientRect();
    var hitEl = document.elementFromPoint(
      Math.round(rb.left + rb.width / 2), Math.round(rb.top + rb.height / 2));
    var landOnIt = !!hitEl && (hitEl === exLinks[0] || exLinks[0].contains(hitEl));
    await sleep(200);
    var dl = exLinks[0].getAttribute('download');
    var href = exLinks[0].getAttribute('href') || '';
    rec('「拿走它」导出控件能点到',
        rEx.ok && landOnIt && /^blob:/.test(href) &&
        dl === decodeURIComponent(id) + '-card.json' && window.__UX.errors.length === e1,
        '命中=' + (hitEl ? cn(hitEl) : 'null') + ' 下载名=' + dl + ' href=' + href.slice(0, 24) +
        (rEx.ok ? '' : ' ⚠ ' + rEx.why));
  } else {
    rec('「拿走它」导出控件能点到', false,
        '导出 ' + exLinks.length + ' 个、复制 ' + exCopy.length + ' 个，各应为 2');
  }

  /* 4. 相关推荐 */
  var rel = document.querySelector('.related .card__link');
  if (rel) {
    var h1 = location.hash;
    realClick(rel);
    await sleep(250);
    rec('相关推荐卡片可点开', location.hash !== h1 && !!document.querySelector('.gh__title'), 'hash=' + location.hash);
  } else { rec('相关推荐卡片可点开', false, '没有 .related'); }

  /* 5. 导航 → 提示词库 */
  realClick(document.querySelector('.nav a[href="#/library?track=text"]'));
  await sleep(300);
  rec('导航 → 提示词库', location.hash === '#/library?track=text' && !!document.querySelector('.filters'), 'hash=' + location.hash);

  /* 6. 加载更多（要在还没筛选、列表满 78 条时测） */
  var more = document.querySelector('.loadmore a');
  if (more) {
    var n0 = document.querySelectorAll('.gallery .card').length;
    realClick(more);
    await sleep(300);
    rec('加载更多真的加了卡片', document.querySelectorAll('.gallery .card').length > n0,
        n0 + ' → ' + document.querySelectorAll('.gallery .card').length);
  } else { rec('加载更多真的加了卡片', false, '没找到按钮'); }

  /* 7. 分类栏标签 */
  var catTab = document.querySelectorAll('.cattab')[2];
  var r6 = realClick(catTab);
  await sleep(300);
  rec('库页点分类栏标签', location.hash.indexOf('cat=') > 0,
      'hash=' + location.hash + (r6.ok ? '' : ' ⚠ ' + r6.why));

  /* 8. 用途 chip —— 现在是 <a href="#/library?...use=...">。
     选带 use= 的那个：「全部」的 href 里不含 use=（清空条件时不写进地址），
     所以这条选择器天然排除了它。 */
  var chip = document.querySelector('.filters .chip[href*="use="]');
  var r7 = realClick(chip);
  await sleep(300);
  rec('库页点用途 chip', location.hash.indexOf('use=') > 0,
      '点了「' + (chip ? chip.textContent.trim() : '无') + '」 hash=' + location.hash +
      (r7.ok ? '' : ' ⚠ ' + r7.why));

  /* 9. 列表卡片上不该有任何复制入口 —— 复制只能在详情页 */
  var cardCopy = document.querySelector(
    '.gallery .card [data-action="quick-copy"], .gallery .card [data-action="copy-prompt"]');
  var cardBtn = document.querySelector('.gallery .card button:not([data-action="save-toggle"])');
  rec('列表卡片上没有复制按钮', !cardCopy && !cardBtn,
      cardCopy ? '卡片上出现了复制按钮'
        : (cardBtn ? '卡片上还有按钮：' + cardBtn.textContent.trim() : '复制入口只在详情页'));

  /* 10. 清空筛选 */
  var clear = document.querySelector('.lib-bar__actions a[href^="#/library"]');
  if (clear) {
    realClick(clear);
    await sleep(300);
    rec('清空筛选保留场景提示词范围', location.hash === '#/library?track=text' && !!document.querySelector('.gallery .card'),
        'hash=' + location.hash + ' 卡片=' + document.querySelectorAll('.gallery .card').length);
  }

  /* 11. 返回首页 */
  realClick(document.querySelector('.nav a[href="#/"]'));
  await sleep(300);
  rec('导航 → 首页', location.hash === '#/' || location.hash === '', 'hash=' + location.hash);

  /* 12. 投稿页 */
  realClick(document.querySelector('.nav a[href="#/about"]'));
  await sleep(300);
  rec('导航 → 使用说明', location.hash === '#/about' && !!document.querySelector('#view h1'), 'hash=' + location.hash);

  /* 13. 整卡可点：指针停在「著录区」文字上（不是图像），也必须进详情页。
     这条专门验证链接层覆盖的是整卡而不只是图像区。 */
  realClick(document.querySelector('.nav a[href="#/library?track=text"]'));
  await sleep(300);
  var anyCard = document.querySelector('.gallery .card');
  if (anyCard) {
    var bodyEl = anyCard.querySelector('.card__body') || anyCard;
    var r9 = clickThrough(bodyEl);
    await sleep(320);
    var wentIn = location.hash.indexOf('#/style/') === 0 && !!document.querySelector('.gh__title');
    var onLink = /card__link/.test(r9.hit || '');
    rec('点卡片著录区也能进详情页', wentIn && onLink,
        'hash=' + location.hash + ' 实际命中=' + r9.hit + (r9.ok ? '' : ' ⚠ ' + r9.why));
  } else {
    rec('点卡片著录区也能进详情页', false, '列表里没有卡片');
  }

  /* 14. ⌘K 搜索面板 —— 全站最显眼的功能之一，必须真的能用。
     四件事分开验：点按钮能开、打字能筛、Esc 能关、⌘K 也能开。
     面板里的结果项是**真链接**，所以顺带验它们的 href 指得对。 */
  realClick(document.querySelector('.nav a[href="#/"]'));
  await sleep(300);
  var opener = document.querySelector('[data-action="palette-open"]');
  var panel = document.querySelector('#palette');
  if (opener && panel) {
    realClick(opener);
    await sleep(220);
    var opened = panel.classList.contains('is-open');

    /* 空查询时面板顶部是「按分类浏览」快捷入口，它们**只在没输入时渲染**。
       所以必须在打字之前读它们的 href —— 打完字这些节点就没了，
       写在后面等于这一类入口永远没被检查过（变异测试抓出来的漏洞）。
       选择器要精确到 #/library?cat=，否则会把下面 7 个提示词条目一起捞进来。 */
    var quick = [].slice.call(panel.querySelectorAll('.palette__item[href^="#/library?cat="]'));
    var quickBad = quick.filter(function (a) {
      return !(a.getAttribute('href') || '').slice('#/library?cat='.length);
    }).map(function (a) { return a.getAttribute('href'); });

    var all = panel.querySelectorAll('.palette__item').length;
    var input = document.querySelector('#palette-input');
    if (input) {
      input.value = '赛博';
      input.dispatchEvent(new window.Event('input', { bubbles: true }));
    }
    await sleep(220);
    var narrowed = panel.querySelectorAll('.palette__item').length;
    /* 打字之后剩下的应当全是提示词条目（分类快捷入口已收起） */
    var hrefOk = true;
    Array.prototype.forEach.call(panel.querySelectorAll('.palette__item[href]'), function (a) {
      if ((a.getAttribute('href') || '').indexOf('#/style/') !== 0) hrefOk = false;
    });
    rec('⌘K 面板：点按钮能开，打字能筛，结果指向真页面',
        opened && quick.length >= 4 && quickBad.length === 0 && narrowed > 0 && narrowed < all && hrefOk,
        '开=' + opened + ' 分类快捷入口=' + quick.length + ' 个' +
        (quickBad.length ? '（href 非法：' + quickBad.join('、') + '）' : '') +
        ' 结果 ' + all + ' → ' + narrowed + ' 条，href 合规=' + hrefOk);

    /* 搜到的提示词卡片必须点得开 —— 这是面板最主要的使用路径 */
    var hitItem = panel.querySelector('.palette__item[href^="#/style/"]');
    if (hitItem) {
      var wantCard = hitItem.getAttribute('href');
      realClick(hitItem);
      await sleep(360);
      rec('⌘K 面板：搜到的卡片点得开',
          location.hash === wantCard && !!document.querySelector('.gh__head'),
          '期望 ' + wantCard + ' 实际 ' + location.hash +
          ' 详情页渲染=' + !!document.querySelector('.gh__head'));
    } else {
      rec('⌘K 面板：搜到的卡片点得开', false, '打字后没有提示词结果');
    }

    /* Esc 关闭 */
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(200);
    var closed = !panel.classList.contains('is-open');
    /* ⌘K 再开一次（键盘路径，和点按钮不是同一条）。
       注意 paletteOpen() 会把输入框清空，所以下面第一条又是分类快捷入口。 */
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
    await sleep(220);
    var reopened = panel.classList.contains('is-open');
    rec('⌘K 面板：Esc 能关，⌘K 能开', closed && reopened, 'Esc 关=' + closed + ' ⌘K 开=' + reopened);

    /* 点第一条结果真的跳过去。
       光比 hash 不够 —— 路由拼错时 hash 照样会变（#/libary?cat=image），
       页面却落到「找不到」上。所以要求目标页真的渲染出来。 */
    var first = panel.querySelector('.palette__item[href^="#/"]');
    if (first) {
      var want = first.getAttribute('href');
      realClick(first);
      await sleep(360);
      var landed = want.indexOf('#/library') === 0
        ? !!document.querySelector('#filters')
        : (want.indexOf('#/style/') === 0 ? !!document.querySelector('.gh__head') : false);
      rec('⌘K 面板：点结果真的跳过去', location.hash === want && landed,
          '期望 ' + want + ' 实际 ' + location.hash + ' 目标页渲染=' + landed);
    } else {
      rec('⌘K 面板：点结果真的跳过去', false, '面板里没有结果项');
    }
  } else {
    rec('⌘K 面板：点按钮能开，打字能筛，结果指向真页面', false,
        '没找到 [data-action="palette-open"] 或 #palette');
    rec('⌘K 面板：搜到的卡片点得开', false, '同上');
    rec('⌘K 面板：Esc 能关，⌘K 能开', false, '同上');
    rec('⌘K 面板：点结果真的跳过去', false, '同上');
  }

  var box = document.createElement('div');
  box.id = 'UX';
  box.textContent = JSON.stringify(window.__UX);
  document.body.appendChild(box);
})();
</script>
`;

/* ============================================================================
   窄屏流程（560）：筛选默认收起
   ========================================================================= */
const PROBE_NARROW = `
<script>
window.__UX = { log: [], errors: [] };
window.addEventListener('error', function (e) {
  window.__UX.errors.push(String(e.message) + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
});
${SPILL_SNIPPET}

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function instantScroll(y) {
  var prev = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, y);
  document.documentElement.style.scrollBehavior = prev;
}
function cn(e) {
  if (!e) return 'null';
  var c = (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '';
  return e.tagName.toLowerCase() + (c ? '.' + String(c).trim().split(/\\s+/).join('.') : '');
}
function visible(el) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return false;
  /* 只看 rect 不够：.mobilenav 收起时是 visibility:hidden + opacity:0，
     但它**仍然占布局**，rect 是有尺寸的。必须看计算样式。 */
  var s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
  return parseFloat(s.opacity || '1') > 0.01;
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
function realClick(el) {
  var t = clickTarget(el);
  if (!t) return { ok: false, why: '找不到能命中 ' + cn(el) + ' 的落点' };
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
    var Ctor = type.indexOf('pointer') === 0 ? (window.PointerEvent || MouseEvent) : MouseEvent;
    t.el.dispatchEvent(new Ctor(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: t.x, clientY: t.y, button: 0,
      buttons: (type === 'mousedown' || type === 'pointerdown') ? 1 : 0
    }));
  });
  return { ok: true, hit: cn(t.el) };
}
function rec(label, pass, detail) {
  window.__UX.log.push({ label: label, pass: !!pass, detail: detail == null ? '' : String(detail) });
}
function firstCardTop() {
  var c = document.querySelector('.gallery .card');
  if (!c) return -1;
  return Math.round(c.getBoundingClientRect().top + window.scrollY);
}

(async function run() {
  if (document.readyState === 'loading') await new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, { once: true }); });
  await sleep(400);
  /* 探针默认落在首页（没有 hash），而筛选条只在库页 —— 先跳过去 */
  if (location.hash.indexOf('#/library') !== 0) {
    location.hash = '#/library';
    await sleep(500);
  }
  instantScroll(0);

  var vh = document.documentElement.clientHeight;

  /* 1. 最重要的一条：不滚动就能看到第一张卡片。
     这是整个改动的目的 —— 窄屏原来首卡顶部 902px，一屏根本装不下。
     窗口高度用 900（可视区约 813），贴近真机；用 1200 的话视口太高，这条断言会变得很松。 */
  var top = firstCardTop();
  rec('首张卡片在一屏之内', top >= 0 && top < vh,
      '首卡顶部=' + top + 'px 视口高=' + vh + 'px' + (top < vh ? ' ✓' : ' ✗ 要滚动才看得到'));

  /* 2. 筛选面板默认收起，但搜索框留着 */
  var filters = document.querySelector('.filters');
  var chips = document.querySelector('.filters .filters__chips');
  rec('筛选默认收起', !!filters && !filters.classList.contains('is-open') && !visible(chips),
      'filters.is-open=' + (filters ? filters.classList.contains('is-open') : 'n/a') +
      ' chip行可见=' + visible(chips));
  rec('收起时搜索框仍然可见', visible(document.querySelector('.filters__mini')));

  /* 3. 筛选按钮可见 */
  var toggle = document.querySelector('[data-action="filters-toggle"]');
  rec('筛选按钮在窄屏可见', visible(toggle), '尺寸=' +
      (toggle ? Math.round(toggle.getBoundingClientRect().width) + 'x' +
        Math.round(toggle.getBoundingClientRect().height) : 'n/a'));

  /* 4. 点开 */
  var r1 = realClick(toggle);
  await sleep(320);
  filters = document.querySelector('.filters');
  chips = document.querySelector('.filters .filters__chips');
  rec('点筛选按钮展开面板', !!filters && filters.classList.contains('is-open') && visible(chips),
      'is-open=' + (filters ? filters.classList.contains('is-open') : 'n/a') +
      (r1.ok ? '' : ' ⚠ ' + r1.why));

  /* 5. 展开后点一个 chip 要真的筛掉东西 */
  var chip = document.querySelector('.filters .chip[href*="use="]');
  var before = document.querySelectorAll('.gallery .card').length;
  var r2 = realClick(chip);
  await sleep(400);
  var after = document.querySelectorAll('.gallery .card').length;
  var badge = document.querySelector('.filterstoggle__n');
  rec('展开后点 chip 能筛选', location.hash.indexOf('use=') > 0 && after > 0 && after < before,
      '「' + (chip ? chip.textContent.trim() : '无') + '」 ' + before + ' → ' + after +
      ' 条 · 按钮计数=' + (badge ? badge.textContent.trim() : '无') +
      (r2.ok ? '' : ' ⚠ ' + r2.why));

  /* 6. 有筛选条件时，「清空筛选」必须出现 */
  rec('有筛选条件时出现「清空筛选」', !!document.querySelector('.lib-bar a[href="#/library"]'));

  /* 7. 再点一次收起 */
  realClick(document.querySelector('[data-action="filters-toggle"]'));
  await sleep(320);
  filters = document.querySelector('.filters');
  rec('再点一次收起面板', !!filters && !filters.classList.contains('is-open'));

  /* 8. 收起状态下点卡片照样进详情页 */
  realClick(document.querySelector('.gallery .card__link'));
  await sleep(350);
  rec('收起状态下点卡片进详情页',
      location.hash.indexOf('#/style/') === 0 && !!document.querySelector('.gh__title'),
      'hash=' + location.hash);

  /* 8b. 详情页的返回键 —— 窄屏是它最要紧的地方（没有鼠标悬停、面包屑又小）。
         这里真的点一下：窄屏读者点进一张卡之后，唯一明确的出口就是它。
         先量再点，点完就离开详情页了。 */
  var back = document.querySelector('.gh__nav a.backlink');
  rec('窄屏详情页有返回键且看得见', visible(back),
      back ? '尺寸=' + Math.round(back.getBoundingClientRect().width) + 'x' +
        Math.round(back.getBoundingClientRect().height) : '找不到 .gh__nav a.backlink');
  /* 面包屑在 ≤720px 让位（CSS 里 display:none）——
     它末项就是这张卡的名字，和下面的 H1 完全重复，两行挤在标题上方没意义。 */
  rec('窄屏详情页把面包屑让给返回键',
      !!back && !visible(document.querySelector('.gh__nav .crumbs')),
      'crumbs 可见=' + visible(document.querySelector('.gh__nav .crumbs')));
  var rb = back ? realClick(back) : { ok: false, why: '没有返回键' };
  await sleep(420);
  rec('窄屏点返回键真的回到列表',
      location.hash.indexOf('#/library') === 0 && !!document.querySelector('.gallery .card'),
      'hash=' + location.hash + (rb.ok ? '' : ' ⚠ ' + rb.why));
  /* 第 5 步筛过「use=」，返回键该回到**那一屏**而不是一个被清空的列表。
     这条是 JSDOM 套件里那条断言的真人版 —— 那边是合成 nav，这边是真的指针点击。 */
  rec('窄屏返回键带回刚才的筛选条件',
      location.hash.indexOf('use=') > 0,
      'hash=' + location.hash);

  /* 9. 回到库页，确认没有任何条件时「清空筛选」不出现（点了没用的按钮不该在） */
  location.hash = '#/library';
  await sleep(400);
  rec('无条件时「清空筛选」不出现',
      !document.querySelector('.lib-bar a[href="#/library"]'),
      '按钮=' + (document.querySelector('.lib-bar a[href="#/library"]') ? '还在' : '已隐藏'));

  /* 10. 内部溢出 —— 窄屏是最容易顶出盒子的地方（560px 里要塞下同样的字）。
        桌面档也有一条同样的检查，两档都要过：只在桌面过、窄屏溢出的情况
        才是最常见的真实缺陷。 */
  var spillNarrow = spillCheck('#view, #nav, footer');
  rec('布局：没有元素的内部内容顶出自己的盒子（窄屏 560）',
      spillNarrow.length === 0,
      spillNarrow.slice(0, 4).join(' | ') || ('已扫 ' + spillNarrow.scanned + ' 个元素'));

  var box = document.createElement('div');
  box.id = 'UX';
  box.textContent = JSON.stringify(window.__UX);
  document.body.appendChild(box);
})();
</script>
`;

/* ============================================================================
   平板档（900）：导航只靠汉堡抽屉

   为什么单开一档：720–1100px 是唯一「汉堡抽屉」形态的区间
   （≤720 变成常驻底部条，>1100 是完整横向导航），而原来的走查只有
   1440 和 560 两档 —— 整整一档没有任何覆盖，偏偏它还是窄屏里最容易漏的：
   曾经抽屉里只放 4 个分类链接，导致手机上创作者/投稿/规范完全点不到。
   这一档专门守两件事：抽屉能开合，以及抽屉里必须是**主栏目**。
   ========================================================================= */
const PROBE_TABLET = `
<script>
window.__UX = { log: [], errors: [] };
window.addEventListener('error', function (e) {
  window.__UX.errors.push(String(e.message) + ' @' + String(e.filename || '').split('/').pop() + ':' + e.lineno);
});

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function cn(e) {
  if (!e) return 'null';
  var c = (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) || '';
  return e.tagName.toLowerCase() + (c ? '.' + String(c).trim().split(/\\s+/).join('.') : '');
}
function visible(el) {
  if (!el) return false;
  var r = el.getBoundingClientRect();
  if (!(r.width > 0 && r.height > 0)) return false;
  /* 抽屉收起时是 visibility:hidden + opacity:0 + pointer-events:none，
     但**仍然占布局**，rect 有尺寸 —— 只量 rect 会把它判成「可见」。 */
  var s = getComputedStyle(el);
  if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') return false;
  return parseFloat(s.opacity || '1') > 0.01;
}
function realClick(el) {
  if (!el) return { ok: false, why: '元素不存在' };
  var r = el.getBoundingClientRect();
  var x = Math.round(r.left + r.width / 2), y = Math.round(r.top + r.height / 2);
  var hit = document.elementFromPoint(x, y);
  if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) {
    return { ok: false, why: '落点被 ' + cn(hit) + ' 占了' };
  }
  ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach(function (type) {
    var Ctor = type.indexOf('pointer') === 0 ? (window.PointerEvent || MouseEvent) : MouseEvent;
    hit.dispatchEvent(new Ctor(type, {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y, button: 0,
      buttons: (type === 'mousedown' || type === 'pointerdown') ? 1 : 0
    }));
  });
  return { ok: true, hit: cn(hit) };
}
function rec(label, pass, detail) {
  window.__UX.log.push({ label: label, pass: !!pass, detail: detail == null ? '' : String(detail) });
}

/* 抽屉里必须有的主栏目。少一个就有人点不到那一整页。 */
var SECTIONS = { '#/': '图片风格', '#/library?track=text': '场景提示词', '#/about': '使用说明', '#/library?saved=1': '我的收藏' };

(async function run() {
  if (document.readyState === 'loading') await new Promise(function (resolve) { document.addEventListener('DOMContentLoaded', resolve, { once: true }); });
  await sleep(500);

  var toggle = document.querySelector('.nav__toggle');
  var nav = document.getElementById('mobilenav');
  rec('900px：汉堡按钮可见、抽屉默认收起',
      visible(toggle) && !!nav && !nav.classList.contains('is-open') && !visible(nav),
      '汉堡可见=' + visible(toggle) + ' 抽屉 is-open=' + (nav ? nav.classList.contains('is-open') : 'n/a') +
      ' 抽屉可见=' + visible(nav));

  /* 抽屉里的链接集合 —— 这条是这一档存在的理由 */
  if (nav) {
    var got = [].map.call(nav.querySelectorAll('a[href]'), function (a) { return a.getAttribute('href'); });
    var missing = Object.keys(SECTIONS).filter(function (h) { return got.indexOf(h) < 0; });
    var extra = got.filter(function (h) { return !(h in SECTIONS); });
    rec('900px：抽屉里是主栏目，且四个都在',
        missing.length === 0 && extra.length === 0,
        '缺=' + (missing.map(function (h) { return SECTIONS[h] + '(' + h + ')'; }).join('、') || '无') +
        ' 多=' + (extra.join('、') || '无'));
  } else {
    rec('900px：抽屉里是主栏目，且四个都在', false, '没有 #mobilenav');
  }

  /* 点开 */
  var r1 = realClick(toggle);
  await sleep(340);
  nav = document.getElementById('mobilenav');
  rec('900px：点汉堡能展开抽屉',
      !!nav && nav.classList.contains('is-open') && visible(nav),
      'is-open=' + (nav ? nav.classList.contains('is-open') : 'n/a') +
      (r1.ok ? '' : ' ⚠ ' + r1.why));

  /* 抽屉里的链接必须真的能点进去，而且点完要自己收起来 */
  var target = nav ? nav.querySelector('a[href="#/about"]') : null;
  var r2 = realClick(target);
  await sleep(360);
  nav = document.getElementById('mobilenav');
  rec('900px：点抽屉里的「使用说明」真的进得去且抽屉收起',
      location.hash === '#/about' && !!document.querySelector('#view h1') &&
      !!nav && !nav.classList.contains('is-open'),
      'hash=' + location.hash + ' 抽屉 is-open=' + (nav ? nav.classList.contains('is-open') : 'n/a') +
      (r2.ok ? '' : ' ⚠ ' + r2.why));

  /* Esc 也要能关（键盘用户） */
  var r3 = realClick(document.querySelector('.nav__toggle'));
  await sleep(340);
  var opened2 = !!nav && nav.classList.contains('is-open');
  document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await sleep(300);
  nav = document.getElementById('mobilenav');
  rec('900px：Esc 能关掉抽屉', opened2 && !!nav && !nav.classList.contains('is-open'),
      '先开=' + opened2 + ' Esc 后 is-open=' + (nav ? nav.classList.contains('is-open') : 'n/a') +
      (r3.ok ? '' : ' ⚠ ' + r3.why));

  var box = document.createElement('div');
  box.id = 'UX';
  box.textContent = JSON.stringify(window.__UX);
  document.body.appendChild(box);
})();
</script>
`;

function run(mode) {
  /* 三种模式复用同一个文件名：少建少删，也避免根目录里堆一串 __ux-*.html。
     注意必须写在站点根目录 —— 页面用相对路径引 assets，写到 /tmp 会全断。 */
  const TMP = path.join(ROOT, '__ux.html');
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const diagnostics = '<script>window.addEventListener("unhandledrejection",function(e){document.documentElement.setAttribute("data-probe-error",String(e.reason&&e.reason.stack||e.reason));});</script>';
  const inject = diagnostics + NO_MOTION + (mode === 'no-hashchange' ? KILL_HASHCHANGE : '') + MODE[mode].probe;
  html = html.replace(/<head\b[^>]*>/i, m => m + '\n' + inject);
  fs.writeFileSync(TMP, html);

  let dom = '';
  try {
    dom = execFileSync(CH, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-software-rasterizer',
      '--disable-dev-shm-usage', '--hide-scrollbars', '--virtual-time-budget=20000',
      '--window-size=' + MODE[mode].w + ',' + MODE[mode].h, '--dump-dom', 'file://' + TMP
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] });
  } finally {
    /* 删除失败不能把整轮验收带走 —— 有些环境会拦截批量删除。
       但**不能把「删不掉」报成「没东西可删」**：沙箱的批量删除护栏
       （单轮累计超过约 50 个删除就要二次确认）会拦下 unlinkSync，
       静默 catch 的后果是探针副本留在站点根目录里，而所有人都以为清干净了。
       删不掉就把话说明白，`accept.sh` 最后一项会统一兜住这件事。 */
    try { fs.unlinkSync(TMP); }
    catch (e) {
      console.log('⚠ 临时副本删不掉：' + TMP + '（' + (e.code || e.message) + '）');
      console.log('  它含注入的 rAF 桩，发布前必须手动删除。');
    }
  }

  const m = dom.match(/<div id="UX">([\s\S]*?)<\/div>/);
  if (!m) { fs.writeFileSync(require('path').join(require('os').tmpdir(), 'shutong-ux-failed.html'), dom); return { ok: false, msg: '探针没有输出 ' + ((dom.match(/data-probe-error="([^"]*)"/) || [])[1] || '') }; }
  return { ok: true, data: JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')) };
}

const MODE = {
  'normal':        { label: '普通浏览器 1440',                w: 1440, h: 1200, probe: PROBE },
  'no-hashchange': { label: '屏蔽 hashchange（模拟 iframe / 预览面板）', w: 1440, h: 1200, probe: PROBE },
  'narrow':        { label: '窄屏 560（筛选默认收起）',        w: 560,  h: 900,  probe: PROBE_NARROW },
  'tablet':        { label: '平板 900（导航只靠汉堡抽屉）',     w: 900,  h: 900,  probe: PROBE_TABLET }
};

let totalFail = 0;
const RUN = ONLY_MODES.length ? ONLY_MODES : ALL_MODES;
if (ONLY_MODES.length) console.log('（只跑：' + ONLY_MODES.join('、') + '）');
RUN.forEach(mode => {
  console.log('\n===== ' + MODE[mode].label + ' =====');
  const r = run(mode);
  if (!r.ok) { console.log('  !! ' + r.msg); totalFail++; return; }
  let bad = 0;
  r.data.log.forEach(x => {
    if (!x.pass) bad++;
    console.log((x.pass ? '  PASS  ' : '  FAIL  ') + x.label + (x.detail ? '   → ' + x.detail : ''));
  });
  if (r.data.errors.length) {
    console.log('  --- 运行时报错 ---');
    r.data.errors.forEach(e => console.log('    ' + e));
  }
  console.log('  ' + (r.data.log.length - bad) + '/' + r.data.log.length + ' 通过');
  totalFail += bad;
});

console.log('\n' + (totalFail ? totalFail + ' 项失败' : '全部模式通过'));
process.exit(totalFail ? 1 : 0);
