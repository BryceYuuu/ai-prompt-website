/* ==========================================================================
   书桐 SHUTONG — app
   hash 路由 / 视图渲染 / 交互 / 动效
   零依赖、零构建。数据来自 data-collected.js（真实素材）与 data.js（规范层）。
   ========================================================================== */

(function () {
  'use strict';

  var Art = window.HFArt;
  var ICON = Art.ICON;
  var Rules = window.HFRules;
  var CATS = TAXONOMY.categories;
  /* 数据文件用的是 `const HF_XXX = {...}` —— 经典脚本里的顶层 const 活在
     全局词法环境里，**不会**挂成 window.HF_XXX。所以这里必须读裸标识符。
     原先写成 window.HF_COVERS / window.HF_NOTES，两个都恒为 undefined，
     之所以没出事，是因为调用点都有 `s.cover || COVERS[id]`、
     `NOTES[id] || s.guide` 这样的兜底，正好接到了 data.js 组装好的字段。
     照抄那个写法加新数据会静默失效 —— 统一改成 typeof 守卫。 */
  var COVERS = (typeof HF_COVERS === 'object' && HF_COVERS) || {};
  var NOTES = (typeof HF_NOTES === 'object' && HF_NOTES) || {};
  var SAMPLES = (typeof HF_SAMPLES === 'object' && HF_SAMPLES) || {};

  /* ------------------------------------------------------------- util -- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function byId(id) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].id === id) return STYLES[i];
    return null;
  }
  function catOf(key) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].key === key) return CATS[i];
    return CATS[0];
  }
  function count(field, key) {
    var c = 0;
    STYLES.forEach(function (s) { if (s[field].indexOf(key) >= 0) c++; });
    return c;
  }
  function catCount(key) {
    var c = 0;
    STYLES.forEach(function (s) { if (s.category === key) c++; });
    return c;
  }
  function initials(name) { return String(name || '?').slice(0, 1).toUpperCase(); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  /* 补齐到指定宽度。用于**条数会长的集合**：牌号固定补 2 位的话，
     卡片数一过 99 就会「№ 07」和「№ 100」混排 —— 一列参差不齐的牌号
     比数字本身显眼得多。按总数取宽度，下次扩内容不用回来改这里。 */
  function padTo(n, w) { var s = String(n); while (s.length < w) s = '0' + s; return s; }
  function widthOf(total) { return String(total).length; }
  function compact(n) {
    if (n >= 10000) return (n / 1000).toFixed(0) + 'k';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
  }

  /* 卡片的「收藏 / 使用」统计。**没有数据就整块不渲染。**

     原先写的是 `compact(s.saves || 0)`，于是 78 张里 **60 张**（全部文字卡 ——
     数据里根本没有这两个字段）渲染成「0 / 0」。读者读到的是
     「这条从没被收藏、从没被用过」，而紧挨着的那张图片卡写着 2.8k。

     这不是「统计值是 0」，是「**没有这项统计**」。两个意思，界面上不能长得一样：
     前者是结论，后者是缺失。留一个空的 `.card__stats` 也是同样的噪音，所以整块不出。 */
  /* 封面比例：夹在 0.68–1.62，避免极端长条破坏瀑布流节奏 */
  function ar(c) {
    if (!c || !c.w || !c.h) return '4 / 3';
    var r = c.w / c.h;
    if (r < 0.68) r = 0.68;
    if (r > 1.62) r = 1.62;
    return Math.round(r * 1000) / 1000 + ' / 1';
  }

  /* 页面搜索与快捷搜索共用索引，包含常用中文别名和英文任务名。 */
  function searchHay(s) {
    var cat = catOf(s.category);
    return (s.name + ' ' + s.latin + ' ' + s.tagline + ' ' + s.uses.join(' ') + ' ' +
      s.moods.join(' ') + ' ' + s.author + ' ' + cat.name + ' ' + cat.key + ' ' +
      (s.prompt || '') + ' ' + (s.keywords || []).join(' ') + ' ' +
      (s.local ? s.local.prompt : '') + ' ' + (s.cloud ? s.cloud.prompt : '') + ' ' +
      (s.source ? s.source.repo + ' ' + s.source.act + ' ' + s.source.contributor : '') + ' ' +
      (s.local ? s.local.base + ' ' + s.local.sampler + ' ' + s.local.loras.map(function (x) { return x.name; }).join(' ') + ' ' + s.local.workflow : '') + ' ' +
      (s.cloud ? s.cloud.models.join(' ') : '')).toLowerCase();
  }

  /* ------------------------------------------------------------ toast -- */
  function toast(msg) {
    var host = $('#toast-host');
    if (!host) return;
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = ICON.check + '<span></span>';
    t.lastChild.textContent = msg;
    host.appendChild(t);
    setTimeout(function () {
      t.classList.add('is-out');
      setTimeout(function () { t.remove(); }, 320);
    }, 2300);
  }

  /* ------------------------------------------------------------- copy -- */
  function copyText(text, label) {
    var ok = function () { toast((label || '提示词') + '已复制到剪贴板'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok).catch(function () { legacy(text, ok); });
    } else {
      legacy(text, ok);
    }
  }
  function legacy(text, ok) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try { if (document.execCommand('copy')) ok(); else toast('复制失败，请手动选择文本'); } catch (e) { toast('复制失败，请手动选择文本'); }
    ta.remove();
  }

  /* --------------------------------------------------------- download -- */
  /* 纯前端下载：Blob + 一个临时 <a download>。不需要任何后端。
     URL.createObjectURL 在极端沙箱里可能不可用，所以整体包了 try。 */
  function downloadText(filename, text, mime) {
    try {
      var blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } }, 1000);
      toast('已下载 ' + filename);
    } catch (e) {
      toast('这个环境不支持直接下载，请用「复制」');
    }
  }

  /* 详情页的两个导出按钮做成**真 <a download href="blob:...">**，
     而不是纯 JS 按钮。理由和导航控件改真链接是同一条：
     宿主（预览面板）在 window 捕获阶段 stopImmediatePropagation 时，
     我们所有监听器都不会被调用，纯 JS 按钮就死了；
     而浏览器处理锚点的默认行为不经过监听器，照样能下载。
     代价是要管 object URL 的生命周期 —— 见 recycleBlobUrls。 */
  var blobUrls = [];
  function exportHref(filename, text, mime) {
    try {
      var url = URL.createObjectURL(new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' }));
      blobUrls.push(url);
      return url;
    } catch (e) {
      return '';   /* 环境不支持就退回纯按钮 + JS 下载 */
    }
  }
  /* 换页时回收上一批。不立刻 revoke：用户可能刚点了下载，
     浏览器还在读这个 blob，当场回收会掐断它。留一秒半再放。 */
  function recycleBlobUrls() {
    var urls = blobUrls;
    blobUrls = [];
    if (!urls.length) return;
    setTimeout(function () {
      urls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) { /* noop */ } });
    }, 1500);
  }

  /* 详情页的「拿走它」：把这张卡导出成可存档、可导入的参数包。
     注意导出的**不是**作者那份工作流文件本身 —— 那个由作者提供、
     文件名在参数表里。这里导出的是完整的提示词与参数，两者互补。
     页面上如实写明，不假装能下载到别人机器上的文件。 */
  function cardExport(s) {
    var out = {
      $format: '书桐提示词卡导出 · shutong-card-export/1',
      validation: s.curation ? s.curation.status : 'unverified-reference',
      curation: s.curation,
      licenseNote: s.licenseNote,
      licenseText: s.licenseText,
      id: s.id,
      name: s.name,
      latin: s.latin,
      version: s.version,
      category: s.category,
      track: s.track,
      author: s.author,
      license: s.license,
      updated: s.updated,
      tagline: s.tagline,
      uses: s.uses,
      moods: s.moods
    };
    if (s.local) {
      out.local = {
        base: s.local.base, sampler: s.local.sampler,
        steps: s.local.steps, cfg: s.local.cfg, seed: s.local.seed,
        workflow: s.local.workflow,
        loras: s.local.loras,
        prompt: s.local.prompt,
        negative: s.local.neg
      };
    }
    if (s.cloud) {
      out.cloud = {
        prompt: s.cloud.prompt,
        models: s.cloud.models,
        references: s.cloud.refs,
        banned: s.cloud.banned
      };
    }
    if (s.prompt) out.prompt = s.prompt;
    if (s.slots && s.slots.length) out.slots = s.slots;
    if (s.source) out.source = s.source;
    return JSON.stringify(out, null, 2);
  }

  /* 人类可读版：存下来就能照着跑，不依赖任何工具 */
  function cardMarkdown(s) {
    var L = s.local, C = s.cloud;
    var out = '# ' + s.name + '（' + s.latin + '）\n\n' +
      '> ' + s.tagline + '\n\n' +
      '- 分类：' + catOf(s.category).name + '\n' +
      '- 版本：v' + s.version + '　作者：' + s.author + '　协议：' + s.license + '\n' +
      '- 更新：' + s.updated + '\n' +
      '- 标签：' + s.uses.concat(s.moods).join('、') + '\n' +
      '- 来源：书桐 SHUTONG · 条目编号：' + s.id + '\n\n';

    if (L) {
      out += '## 本地轨道\n\n```\n' + L.prompt + '\n```\n\n' +
        '| 参数 | 值 |\n| --- | --- |\n' +
        '| 底模 | ' + L.base + ' |\n' +
        '| 采样器 | ' + L.sampler + ' |\n' +
        '| 步数 / CFG | ' + L.steps + ' / ' + L.cfg + ' |\n' +
        '| 固定种子 | ' + L.seed + ' |\n' +
        '| 工作流文件 | ' + L.workflow + '（仅记录名称，本站未提供文件） |\n\n' +
        'LoRA：' + L.loras.map(function (x) { return x.name + ' @ ' + x.weight.toFixed(2); }).join('、') + '\n\n' +
        '负向提示词：\n\n```\n' + L.neg + '\n```\n\n';
    }
    if (C) {
      out += '## 云端轨道\n\n```\n' + C.prompt + '\n```\n\n' +
        '参考工具：' + C.models.join('、') + '\n\n' +
        '参考图：' + C.refs + '\n\n' +
        '禁用词表：' + C.banned.join('、') + '\n\n';
    }
    if (s.prompt) out += '## 提示词（编辑整理）\n\n```\n' + s.prompt + '\n```\n\n';
    if (s.slots && s.slots.length) out += '槽位：' + s.slots.map(function (x) { return '{' + x + '}'; }).join(' ') + '\n\n';
    if (s.curation) out += '核验状态：本站尚未逐条模型实测。' + s.curation.method + '\n\n';
    if (s.licenseText) out += '## 上游许可\n\n' + s.licenseText + '\n\n';
    if (s.source) {
      out += '## 来源\n\n' + s.source.repo + '（' + s.source.url + '）\n贡献者：' + s.source.contributor + ' · ' + (s.source.license || '') + '\n';
    }
    return out;
  }

  /* 参数清单：贴到记事本里就能照着调 */
  function cardParamsText(s) {
    var L = s.local;
    if (!L) return '';
    return [
      '底模      ' + L.base,
      '采样器    ' + L.sampler,
      '步数      ' + L.steps,
      'CFG       ' + L.cfg,
      '种子      ' + L.seed,
      '工作流    ' + L.workflow,
      'LoRA      ' + L.loras.map(function (x) { return x.name + ' @ ' + x.weight.toFixed(2); }).join(' + ')
    ].join('\n');
  }

  /* ----------------------------------------------------------- router -- */
  /* --------------------------------------------------------- 路由 --
     路由状态由脚本自己持有（routeKey），location.hash 只是**尽力同步的目标**。

     为什么不能只听 hashchange：站点可能被嵌在 iframe / 预览面板里，
     这类宿主环境未必派发 hashchange。那种情况下页面渲染得好好的，
     但点任何链接都没反应 —— 因为没有任何东西在听。所以这里改成
     点击直接驱动渲染，hashchange 只用来兜住前进/后退和直接改地址。 */

  var routeKey = null;

  /* 最后一次看到的「提示词库」地址（**带筛选条件**）。详情页的返回键要回到这里，
     而不是回到一个被清空的 #/library —— 读者筛了一屏再点进一张卡，
     返回时筛选没了会很恼火。

     只放在内存里，**不落 localStorage/sessionStorage**：站点禁用存储
     （不透明来源的 iframe 里读它们会抛异常）。代价是刷新页面后丢失，
     那时退回该卡自己的分类，仍然是一个有用的落点。 */
  var lastLibraryHash = null;

  function readHash() {
    try { return location.hash || '#/'; } catch (e) { return '#/'; }
  }

  function parseRoute(h) {
    h = String(h || '').replace(/^#/, '');
    if (!h) h = '/';
    var qi = h.indexOf('?');
    var path = qi >= 0 ? h.slice(0, qi) : h;
    var qs = qi >= 0 ? h.slice(qi + 1) : '';
    var params = {};
    qs.split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i >= 0 ? kv.slice(0, i) : kv);
      var v = i >= 0 ? decodeURIComponent(kv.slice(i + 1)) : '';
      if (k) params[k] = v;
    });
    if (path.length > 1) path = path.replace(/\/+$/, '');
    return { path: path || '/', params: params };
  }

  function parseHash() { return parseRoute(routeKey || readHash()); }

  /* 唯一的跳转入口：先改自己的状态，再尽力同步地址，然后立刻渲染。
     不等 hashchange —— 等它就等于把能不能用交给宿主环境决定。 */
  function navigate(next) {
    if (routeKey === next) { render(); return; }   /* 同址也重绘，比如重复点同一个筛选 */
    routeKey = next;
    try {
      if (readHash() !== next) location.hash = next;
    } catch (e) { /* 极端沙箱里连 hash 都写不了：内存路由照常工作 */ }
    render();
  }

  function go(path, params) {
    var qs = '';
    if (params) {
      var parts = [];
      Object.keys(params).forEach(function (k) {
        if (params[k]) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
      });
      if (parts.length) qs = '?' + parts.join('&');
    }
    navigate('#' + path + qs);
  }

  function onHashChange() {
    var h = readHash();
    if (h === routeKey) return;      /* navigate() 已经渲染过，去重 */
    routeKey = h;
    render();
  }

  /* 站内 #/ 链接由脚本接管。用捕获阶段，保证比宿主后注册的拦截器先拿到事件。
     注意这里**故意不调用 preventDefault()**：浏览器的默认锚点跳转是第二条、
     与 JS 无关的通路。宿主若在捕获阶段 stopImmediatePropagation() 吃掉 click，
     我们的监听器收不到，但默认行为不受影响 —— hash 照改，hashchange 兜住渲染。
     代价只是地址被写两次同样的值，不产生多余历史记录。 */
  function onInternalLink(e) {
    if (e.__hfLink) return;      /* 挂在 window 和 document 两处，别处理两遍 */
    /* 这里**故意不看 e.defaultPrevented**：有些宿主会把页面上所有 click 的
       默认行为一律 preventDefault 掉。那种情况下浏览器的锚点跳转不会发生，
       正需要我们自己导航 —— 早退反而会把自己也一起关掉。
       组合键与中键仍然放行：那是「新标签页打开」的意图，不该被劫持。 */
    if (e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = e.target;
    var a = t && t.closest ? t.closest('a[href]') : null;
    if (!a || a.getAttribute('target')) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('#/') !== 0) return;
    e.__hfLink = true;
    navigate(href);
  }

  /* ------------------------------------------------------------ state -- */
  var state = {
    filters: { cat: '', use: '', mood: '', track: 'all', q: '', sort: 'hot' },
    limit: 12,
    detailTrack: 'local',
    /* 窄屏上筛选条默认收起 —— 不收的话第一张卡要滚过一整屏才出现，
       而「先看到东西」才是这个站点存在的理由。桌面端由 CSS 忽略这个状态。 */
    filtersOpen: false,
    /* 首页图版台当前展示的那张图。留在这里而不是 DOM 里，
       是因为详情页返回首页会整块重渲染 —— 读者刚点开的那张不能变回去。 */
    heroPlateId: ''
  };

  /* ================================================================ nav == */

  function navHTML(route) {
    var p = route.path;
    var link = function (href, label, match) {
      return '<a class="nav__link' + (match ? ' is-active' : '') + '" href="#' + href + '">' + label + '</a>';
    };
    return '' +
      '<div class="nav__inner">' +
        '<a class="brand" href="#/" aria-label="书桐 首页">' +
          '<span class="brand__mark" style="width:26px;height:26px">' +
            '<img src="assets/img/brand/mark-128.png" alt="" width="128" height="128">' +
          '</span>' +
          '<span class="brand__text">' +
            '<span class="brand__word"><img src="assets/img/brand/wordmark.png" alt="书桐 SHUTONG" width="1024" height="575"></span>' +
          '</span>' +
        '</a>' +
        '<nav class="nav__links">' +
          link('/', '图片风格', p === '/' || (p === '/library' && route.params.cat === 'image')) +
          link('/library?track=text', '场景提示词', p === '/library' && route.params.cat !== 'image') +
          link('/about', '使用说明', p === '/about') +
        '</nav>' +
        '<div class="nav__spacer"></div>' +
        '<button class="navsearch" data-action="palette-open">' +
          ICON.search + '<span>搜索提示词</span>' +
          '<span class="navsearch__kbd">⌘K</span>' +
        '</button>' +
        /* 登录入口已移除：账号体系还没做，放个登录按钮只是摆设。
           前期只留能真正跑通的东西 —— 浏览、搜索、看详情、复制提示词。 */
        '<button class="nav__toggle" data-action="menu-toggle" aria-label="菜单">' + ICON.menu + '</button>' +
      '</div>';
  }

  /* ============================================================== cover == */

  function coverHTML(s, opts) {
    opts = opts || {};
    var c = s.cover || COVERS[s.id];
    if (!c) return Art.art(s);
    var credit = c.creator && c.creator !== 'None' ? c.creator : (c.provider || '');
    return '<span class="cover">' +
      '<img src="' + esc(c.src) + '" alt="' + esc(s.name + ' 封面图') + '"' +
        ' width="' + (c.w || 1000) + '" height="' + (c.h || 750) + '"' +
        ' loading="lazy" decoding="async">' +
      (opts.plate ? '<span class="cover__plate">' + esc(opts.plate) + '</span>' : '') +
      (opts.credit === false || !credit ? '' :
        '<span class="cover__credit">' + esc(credit) + ' · ' + esc(c.license) + '</span>') +
    '</span>';
  }

  /* 封面图源的显示名。数据里的 `provider` 是照片的**原始出处**
     （Flickr / Wikimedia Commons / rawpixel），不是聚合器 ——
     页面上要告诉读者的是「图从哪儿来」，不是「我们用什么工具搜的」。 */
  var PROVIDER_NAME = {
    flickr: 'Flickr',
    wikimedia: 'Wikimedia Commons',
    rawpixel: 'rawpixel'
  };

  /* 数出封面里**实际出现过**哪些图源。
     ⚠️ 必须从数据里数，不能写死。规范页那段原先写的是「全部来自 Openverse
     聚合的 CC 授权照片」—— 后来为了扛住 Openverse 的单点故障，15 张封面
     改成直接从 Wikimedia Commons 取，于是这句话**变成了假话**，
     而它就在「每张图都追得到出处」这个标题底下，读者拿它当全站口径。
     这里从数据里数，再加图源时自动跟上，不用回来改文案。
     不认识的 key **原样透出**：宁可难看，也不能悄悄少列一个来源 ——
     那正好是这段话要避免的事。 */
  function coverProviders() {
    var seen = {}, out = [];
    Object.keys(COVERS).forEach(function (k) {
      var p = COVERS[k] && COVERS[k].provider;
      if (p && !seen[p]) { seen[p] = 1; out.push(PROVIDER_NAME[p] || p); }
    });
    return out;
  }

  /* 品牌母题：三片叠压的圆角面板，取代原来的吉祥物 */
  function glassHTML(cls) {
    return '<div class="glass' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' +
      '<span class="glass__p"></span><span class="glass__p"></span><span class="glass__p"></span>' +
    '</div>';
  }

  /* ============================================================== card == */

  function trackTags(s) {
    var out = '';
    if (s.track === 'edit') out += '<span class="tag tag--outline">上传原图</span>';
    if (s.local) out += '<span class="tag tag--local">本地</span>';
    if (s.cloud) out += '<span class="tag tag--cloud">云端</span>';
    if (s.category !== 'image') out += '<span class="tag tag--outline">任务模板</span>';
    return out;
  }

  /* 图版编号：按在总目里的次序固定，不随排序变化 */
  function plateNo(s) {
    var i = 0;
    for (var k = 0; k < STYLES.length; k++) { if (STYLES[k].id === s.id) { i = k; break; } }
    return padTo(i + 1, widthOf(STYLES.length));
  }

  /* 图片风格卡，顺序固定 —— 首页图版台的刻度尺与它一一对应。
     固定顺序很重要：刻度是「尺子」不是「榜单」，跟着热度重排会让人找不到刚才那格。 */
  function imageStyles() {
    return STYLES.filter(function (s) { return s.category === 'image'; });
  }

  /* 图片风格在「18 式」里的序号，从 1 起。 */
  function imgNo(s) {
    var list = imageStyles();
    for (var i = 0; i < list.length; i++) { if (list[i].id === s.id) return i + 1; }
    return 0;
  }

  /* 没有封面时的兜底高度档位，由 id 决定，保证同一张卡处处一致 */
  function cardSize(s) {
    var h = 0, id = String(s.id);
    for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    var m = h % 10;
    if (m < 3) return ' card--tall';
    if (m < 5) return ' card--port';
    if (m < 7) return ' card--short';
    if (m < 8) return ' card--wide';
    return '';
  }

  function styleCard(s) {
    var href = '#/style/' + esc(s.id);
    var cat = catOf(s.category);
    var cov = s.cover || COVERS[s.id];
    var artAttrs = cov
      ? ' class="card__art card__art--cover" style="aspect-ratio:' + ar(cov) + '"'
      : ' class="card__art"';
    return '' +
      '<article class="card spotlight reveal' + (s.category === 'image' ? ' card--image' : ' card--text') + (cov ? '' : cardSize(s)) + '" data-id="' + esc(s.id) + '"' +
        ' data-cat="' + esc(s.category) + '">' +
        /* 整张卡就是一个链接：点图像、点标题、点说明都进详情页。
           必须是 <article> 的直属子节点，这样 inset:0 才覆盖整卡而不只是图像区。
           这里**故意不放复制按钮** —— 复制是详情页里的动作。
           在列表上就能复制，别人看不到生成效果和使用说明，
           等于把「图录」做成了「剪贴板」。 */
        '<a class="card__link" href="' + href + '" aria-label="查看 ' + esc(s.name) + ' 的详情"></a>' +
        (s.category === 'image'
          ? '<div' + artAttrs + '>' + coverHTML(s, { plate: '№ ' + plateNo(s) }) +
            '<span class="card__badges"><span class="tag tag--outline">来源案例</span></span>' +
            '<span class="card__hint">' + ICON.arrowRight + '查看提示词</span></div>'
          : '<div class="card__excerpt"><div class="card__excerpt-head"><span>交付清单</span><span>№ ' + plateNo(s) + '</span></div>' +
            '<p>' + esc((SAMPLES[s.id] || s.tagline).slice(0, 180)) + '</p></div>') +
        '<div class="card__body">' +
          '<div class="row row--between gap-8 card__catrow">' +
            '<span class="catpill catpill--' + esc(s.category) + '"><i></i>' + esc(cat.name) + '</span>' +
            '<span class="card__ver">v' + esc(s.version) + '</span>' +
          '</div>' +
          '<div class="card__title">' +
            '<span class="card__name">' + esc(s.name) + '</span>' +
            '<span class="card__latin">' + esc(s.latin) + '</span>' +
          '</div>' +
          '<p class="card__desc">' + esc(s.tagline) + '</p>' +
          '<div class="card__foot">' +
            '<span class="card__author">' +
              '<span class="card__avatar">' + esc(initials(s.author)) + '</span>' + esc(s.author) +
            '</span>' +
            '<span class="card__open">查看用法 ' + ICON.arrowRight + '</span>' +
          '</div>' +
        '</div>' +
      '</article>';
  }

  /* ======================================================== 分类导航条 == */

  function catbarHTML(activeKey) {
    var tab = function (key, name, n) {
      return '<a class="cattab' + (activeKey === key ? ' is-on' : '') + '" href="#/library' +
        (key ? '?cat=' + encodeURIComponent(key) : '') + '">' +
        esc(name) + '<span class="cattab__n">' + pad2(n) + '</span></a>';
    };
    return '<div class="catbar"><div class="wrap catbar__in">' +
      tab('', '全部', STYLES.length) +
      CATS.map(function (c) { return tab(c.key, c.name, catCount(c.key)); }).join('') +
    '</div></div>';
  }

  /* ============================================================== home == */

  /* 各类交错：首屏能同时看到七个分类，而不是 18 张图片风格排在最前面 */
  function interleave(list) {
    var buckets = {}, out = [], i = 0, more = true;
    CATS.forEach(function (c) { buckets[c.key] = []; });
    list.forEach(function (s) {
      (buckets[s.category] || (buckets[s.category] = [])).push(s);
    });
    while (more) {
      more = false;
      CATS.forEach(function (c) {
        var arr = buckets[c.key];
        if (arr && arr[i]) { out.push(arr[i]); more = true; }
      });
      i++;
    }
    return out;
  }

  function firstOf(cat) {
    for (var i = 0; i < STYLES.length; i++) if (STYLES[i].category === cat) return STYLES[i];
    return STYLES[0];
  }

  /* 主图版的内容。抽成函数是因为点刻度时要**就地换**这一块 ——
     不能整页重渲染，那会把瀑布流 78 张卡重画一遍，
     滚动位置和悬停状态全丢，而这里要改的只有巴掌大一块。 */
  function heroPlateInner(s) {
    var w = widthOf(imageStyles().length);
    return '' +
         '<span class="hero__plate-head">' +
           '<span class="plate">№ ' + padTo(imgNo(s), w) + ' / ' + padTo(imageStyles().length, w) + '</span>' +
           /* 拉丁名单独一行（plate--latin）。一行两端对齐会溢出 ——
              见 views.css 里 .hero__plate-head 的说明。 */
           '<span class="plate plate--latin">' + esc(s.latin) + '</span>' +
         '</span>' +
      coverHTML(s) +
      '<span class="hero__plate-cap">' + esc(s.name) + '</span>' +
      '<span class="hero__plate-go">探索这个风格' + ICON.arrowRight + '</span>';
  }

  /* 刻度尺：一格一张图片风格，点哪格上面那块图版就换成哪张。
     这是首页唯一「能上手玩」的东西 —— 读者不用滚到瀑布流就能看见
     「这里有 18 种风格」，而且立刻明白它们是**可以互相替换的配方**。
     刻度顺序固定，不跟着热度重排：它是尺子，不是榜单。 */
  function heroIndexHTML(cur) {
    var list = imageStyles();
    var w = widthOf(list.length);
    return '<div class="hero__index">' +
      '<div class="hero__index-rule">' +
        list.map(function (s) {
          var on = s.id === cur.id;
          return '<button type="button" class="tick' + (on ? ' is-on' : '') + '"' +
            ' data-action="hero-plate" data-id="' + esc(s.id) + '"' +
            (on ? ' aria-current="true"' : '') +
            ' title="' + esc(padTo(imgNo(s), w) + ' ' + s.name) + '">' +
            '<span class="tick__bar"></span>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="hero__index-foot">' +
        '<span class="plate">' + list.length + ' 式</span>' +
        '<span class="plate hero__index-hint">左右滑动，探索更多</span>' +
      '</div>' +
    '</div>';
  }

  function heroHTML() {
    var plate = byId(state.heroPlateId) || firstOf('image');
    if (plate.category !== 'image') plate = firstOf('image');
    return '<section class="hero">' +
      '<div class="wrap hero__grid">' +
        '<div class="hero__intro">' +
          '<p class="hero__eyebrow reveal">书桐 · 图片风格灵感库</p>' +
          '<h1 class="hero__title reveal">让想象，<br><span>有自己的风格。</span></h1>' +
          '<p class="lead hero__sub reveal">上传你的照片，换一种画风。<br class="desktop-break">从手办、针织玩偶到像素图标，保留属于你的细节。</p>' +
          '<form class="hero__search reveal" data-action="search-submit">' +
            '<div class="searchbox">' + ICON.search +
              '<input type="search" name="q" placeholder="搜索转换效果，如手办、针织、像素" aria-label="搜索图片风格">' +
              '<button class="btn btn--primary" type="submit">探索</button>' +
            '</div>' +
          '</form>' +
          '<p class="hero__caption reveal">' + imageStyles().length + ' 种图片风格 · 打开即用 · 自由探索</p>' +
        '</div>' +
        '<div class="hero__visual reveal reveal--scale">' +
            '<a class="hero__plate" href="#/style/' + esc(plate.id) + '">' +
              heroPlateInner(plate) +
            '</a>' +
            '<div class="hero__controls"><button type="button" class="hero__arrow" data-action="hero-prev" aria-label="上一张风格">' + ICON.arrowLeft + '</button>' +
              '<button type="button" class="hero__autoplay" data-action="hero-autoplay">暂停轮播</button>' +
              '<button type="button" class="hero__arrow" data-action="hero-next" aria-label="下一张风格">' + ICON.arrowRight + '</button></div>' +
            heroIndexHTML(plate) +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function catalogueHTML() {
    var list = imageStyles();
    return '<section class="catalogue">' +
      '<div class="wrap">' +
        '<div class="catalogue__head reveal">' +
          '<div class="catalogue__title"><span class="eyebrow">THE STYLE COLLECTION</span><h2>每一种风格，<br>都是新的可能。</h2></div>' +
          '<div class="catalogue__side"><p>找到让你心动的画面。<br>打开卡片，探索它的提示词与用法。</p>' +
          '<a class="btn btn--ghost btn--sm" href="#/library?cat=image">筛选图片风格' + ICON.arrowRight + '</a></div>' +
        '</div>' +
        '<div class="gallery">' + list.map(styleCard).join('') + '</div>' +
        '<p class="collection-note">图片为来源项目公开案例，已保留署名；本站中文整理版尚未逐条实测。</p>' +
      '</div>' +
    '</section>';
  }

  function homeView() {
    return heroHTML() + catalogueHTML();
  }

  /* =========================================================== library == */

  function filtered() {
    var f = state.filters;
    var list = STYLES.filter(function (s) {
      if (f.cat && s.category !== f.cat) return false;
      if (f.use && s.uses.indexOf(f.use) < 0) return false;
      if (f.mood && s.moods.indexOf(f.mood) < 0) return false;
      /* 轨道筛选只有两个**互不重叠**的取值：双轨（图片风格）/ 单条（其余分类）。
         原先还有 local / cloud 两项，那时目录里确实有「仅本地」「仅云端」的卡。
         补全之后 18 张图片卡全是双轨，于是 双轨 / 本地 / 云端 三项会返回
         **完全相同的集合** —— 一个看起来在筛选、实际筛不动任何东西的控件，
         比没有这个控件更糟（读者会以为「云端」这一档里有别的东西）。
         要守的性质：任意两个选项的结果集不能相同。 */
      if (f.track === 'both' && s.category !== 'image') return false;
      if (f.track === 'text' && s.category === 'image') return false;
      if (f.q && searchHay(s).indexOf(f.q.toLowerCase()) < 0) return false;
      return true;
    });

    if (f.sort === 'new') list.sort(function (a, b) { return a.updated === b.updated ? 0 : (a.updated < b.updated ? 1 : -1); });
    if (f.sort === 'hot' && f.cat === '' && !f.q && !f.use && !f.mood && f.track === 'all') {
      list = interleave(STYLES);
    }
    return list;
  }

  /* 列表页地址：筛选条件全部进 URL。
     这样每个筛选结果都是可分享、可收藏的地址；更要紧的是 —— chip 因此
     可以是真 <a href>，浏览器的默认锚点跳转成为一条**不依赖 JS 的通路**。
     宿主若在捕获阶段吃掉 click，我们的监听器收不到，但 hash 照改，
     hashchange 照旧兜住渲染。
     传 limit:'' 表示把这个条件重置掉（新筛选回到第一页）。 */
  function libHref(overrides) {
    var next = {};
    Object.keys(state.filters).forEach(function (k) { next[k] = state.filters[k]; });
    Object.keys(overrides || {}).forEach(function (k) { next[k] = overrides[k]; });
    var parts = [];
    Object.keys(next).forEach(function (k) {
      if (next[k]) parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(next[k]));
    });
    return '#/library' + (parts.length ? '?' + parts.join('&') : '');
  }

  /* 改一个筛选条件 —— 同时把 limit 重置回第一页 */
  function filterHref(param, value) {
    var ov = { limit: '' };
    ov[param] = value;
    return libHref(ov);
  }

  function chips(items, activeKey, param, counts) {
    return items.map(function (it) {
      var on = activeKey === it.key;
      return '<a class="chip' + (on ? ' is-on' : '') + '" href="' + esc(filterHref(param, it.key)) + '"' +
        (on ? ' aria-current="true"' : '') + '>' + esc(it.key) +
        '<span class="chip__count">' + counts(it.key) + '</span></a>';
    }).join('');
  }

  function libraryView() {
    function available(field, key) {
      var f = state.filters;
      return STYLES.filter(function(s) {
        return (!f.cat || s.category === f.cat) && (f.track !== 'text' || s.category !== 'image') && (f.track !== 'both' || s.category === 'image') && s[field].indexOf(key) >= 0;
      }).length;
    }

    var list = filtered();
    var shown = list.slice(0, state.limit);
    var f = state.filters;
    /* 标题必须与筛选结果一致：只有 f.track 真的是 both / text 时才写「双轨 / 单条」，
       否则退回「全部提示词」。原先写的是 f.track !== 'all' ? '图片转换' : …，
       那个写法在 track=local（老链接）时会给出一页 78 张卡的「图片转换」。 */
    var trackName = f.track === 'both' ? '图片转换' : (f.track === 'text' ? '场景任务' : '');
    var head = f.cat ? catOf(f.cat).name : (f.use || f.mood || trackName || '全部提示词');
    /* 有几个条件真的在生效 —— 决定「清空筛选」要不要出现、筛选按钮上挂几 */
    var activeN = [f.cat, f.use, f.mood, f.q].filter(Boolean).length + (f.track !== 'all' ? 1 : 0);

    return '' +
      '<section class="lib-head">' +
        '<div class="wrap">' +
          '<div class="crumbs"><a href="#/">首页</a><span>/</span><span>提示词库</span></div>' +
          '<h1 class="lib-head__title">' + esc(head) + '</h1>' +
          '<p class="lead lib-head__sub">' +
            '图片、写作、编程、分析、学习、商业、生活——同一套卡片，同一个复制方式。' +
            '点开任意一张，先给你提示词，再给用法说明。</p>' +
        '</div>' +
      '</section>' +
      catbarHTML(f.cat) +
      /* 窄屏收起的部分打上 filters__hide-sm；搜索框不在其中，始终可见。
         桌面端这些类名不起作用，布局与改动前完全一致。 */
      '<div class="filters' + (state.filtersOpen ? ' is-open' : '') + '" id="filters">' +
        '<div class="wrap">' +
          '<div class="filters__row">' +
            '<span class="filters__label filters__hide-sm">用途</span>' +
            '<div class="filters__chips filters__hide-sm">' +
              '<a class="chip chip--sm' + (!f.use ? ' is-on' : '') +
                '" href="' + esc(filterHref('use', '')) + '">全部</a>' +
              chips(TAXONOMY.uses.filter(function(x){return available('uses',x.key)>0;}), f.use, 'use', function (k) { return available('uses', k); }) +
            '</div>' +
            '<div class="filters__mini">' + ICON.search +
              '<input type="search" data-action="filter-search" placeholder="在结果中搜索…" value="' + esc(f.q) + '">' +
            '</div>' +
          '</div>' +
          '<div class="filters__row filters__hide-sm">' +
            '<span class="filters__label">情绪</span>' +
            '<div class="filters__chips">' +
              '<a class="chip chip--sm' + (!f.mood ? ' is-on' : '') +
                '" href="' + esc(filterHref('mood', '')) + '">全部</a>' +
              chips(TAXONOMY.moods.filter(function(x){return available('moods',x.key)>0;}), f.mood, 'mood', function (k) { return available('moods', k); }) +
            '</div>' +
            '<span class="filters__label filters__label--end">类型</span>' +
            '<div class="seg" role="group" aria-label="按内容类型筛选">' +
              [['all', '全部'], ['both', '图片转换'], ['text', '文字任务']].map(function (tr) {
                var on = f.track === tr[0];
                return '<a class="seg__item' + (on ? ' is-on' : '') +
                  '" href="' + esc(filterHref('track', tr[0])) + '"' +
                  (on ? ' aria-current="true"' : '') + '>' + tr[1] + '</a>';
              }).join('') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<section class="section section--tight">' +
        '<div class="wrap">' +
          '<div class="lib-bar">' +
            /* 只在窄屏出现（CSS 控制）；aria-expanded 让读屏知道展开状态 */
            '<button class="filterstoggle" data-action="filters-toggle" aria-controls="filters"' +
              ' aria-expanded="' + (state.filtersOpen ? 'true' : 'false') + '">' +
              ICON.filter + '<span>筛选</span>' +
              (activeN ? '<span class="filterstoggle__n">' + activeN + '</span>' : '') +
            '</button>' +
            '<span class="lib-count">共 <b>' + list.length + '</b> 条提示词' +
              (f.q ? ' · 关键词「' + esc(f.q) + '」' : '') + '</span>' +
            '<div class="row gap-10 lib-bar__actions">' +
              /* 没有任何条件生效时不摆这个按钮 —— 点了也没用的按钮不该存在 */
              (activeN ? '<a class="btn btn--ghost btn--sm" href="#/library">清空筛选</a>' : '') +
              '<select class="select" data-action="sort">' +
                TAXONOMY.sorts.map(function (s) {
                  return '<option value="' + s.key + '"' + (f.sort === s.key ? ' selected' : '') + '>' +
                    esc(s.label) + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          (shown.length
            ? '<div class="gallery">' + shown.map(styleCard).join('') + '</div>'
            : '<div class="empty">' + glassHTML('empty__glass') +
              /* h2 不是 h3：上面那个 h1「全部提示词」还在页面上，
                 筛空了不等于标题也没了。写 h3 就是 h1 → h3 跳级。 */
              '<h2>这个组合下还没有提示词</h2>' +
              '<p>试试更短的关键词，或清空筛选重新浏览。</p>' +
              '<a class="btn btn--primary" href="#/library">清空筛选</a></div>') +
          (list.length > shown.length
            ? '<div class="loadmore"><a class="btn btn--ghost btn--lg" href="' +
              esc(libHref({ limit: String(state.limit * 2) })) + '">加载更多（还有 ' +
              (list.length - shown.length) + ' 条）</a></div>'
            : '') +
        '</div>' +
      '</section>';
  }

  /* ============================================================ detail == */

  function paramsHTML(pairs) {
    return '<dl class="params">' + pairs.map(function (p) {
      return '<div class="param"><dt>' + esc(p[0]) + '</dt><dd>' + esc(p[1]) + '</dd></div>';
    }).join('') + '</dl>';
  }

  function promptBlock(label, text, id) {
    return '' +
      '<div class="prompt">' +
        '<div class="prompt__bar">' +
          '<span class="prompt__label"><i></i>' + esc(label) + '</span>' +
          '<button class="prompt__copy" data-action="copy-prompt" data-id="' + esc(id) + '">' +
            ICON.copy + '复制全部</button>' +
        '</div>' +
        '<div class="prompt__body">' + esc(text) + '</div>' +
      '</div>';
  }

  /* 使用说明：把结构化区块渲染成正文流 */
  function notesHTML(s, preview) {
    var blocks = NOTES[s.id] || s.guide || [];
    if (preview) blocks = blocks.filter(function (b) { return b.t === 'img'; });
    /* 示例输出（手写，见 data-samples.js）。插在「怎么用」那条列表之后 ——
       顺序是：引言 → 怎么用 → 交付清单 → 参考图 → 容易踩的坑。
       没有列表块就退回到末尾，不让它凭空消失。

       这里给 <pre> 加 .sample：它和 t:'code' 的块长得一样，但行为要不同 ——
       代码块保持 overflow-x:auto（不许在 token 中间断行），
       示例是正文快照，必须换行（理由见 components.css 里 .prose pre.sample）。 */
    var sample = preview ? null : SAMPLES[s.id];
    var sampleHTML = sample
      ? '<h2>交付清单</h2>' +
        '<p class="sample-caption">预期交付结构，用于核对结果；不是模型运行记录。</p>' +
        '<pre class="sample"><code>' + esc(sample) + '</code></pre>'
      : '';
    var sampleUsed = false;
    var out = '', fig = 0;
    blocks.forEach(function (b) {
      if (b.t === 'h') out += '<h2>' + esc(b.v) + '</h2>';
      else if (b.t === 'p') out += '<p>' + esc(b.v) + '</p>';
      else if (b.t === 'warn') out += '<div class="warnbox">' + esc(b.v) + '</div>';
      else if (b.t === 'quote') out += '<blockquote>' + esc(b.v) + '</blockquote>';
      else if (b.t === 'code') out += '<pre><code>' + esc(b.v) + '</code></pre>';
      else if (b.t === 'list') {
        out += '<ul>' + b.v.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
        if (sampleHTML && !sampleUsed) { out += sampleHTML; sampleUsed = true; }
      } else if (b.t === 'img') {
        if (s.category === 'image' && !preview) return;
        fig++;
        var cov = s.cover || COVERS[s.id] || {};
        out += (s.category !== 'image' ? '<details class="reference-fold"><summary data-action="reference-toggle">查看参考配图与署名</summary>' : '') + '<figure>' +
          '<span class="cover" style="aspect-ratio:' + ar(cov) + '">' +
            '<img src="' + esc(b.v.src) + '" alt="' + esc(b.v.cap || '') + '"' +
              ' width="' + (cov.w || 1000) + '" height="' + (cov.h || 750) + '" loading="lazy">' +
          '</span>' +
          '<figcaption>' +
            '<span class="fig-n">Fig. ' + pad2(fig) + '</span>' +
            '<span>来源案例 · 非本站实测 · ' + esc(b.v.cap || '') + '</span>' +
            (b.v.credit ? '<span>© ' + esc(b.v.credit) + ' · ' + esc(b.v.license) + '</span>' : '') +
          '</figcaption>' +
        '</figure>' + (s.category !== 'image' ? '</details>' : '');
      }
    });
    if (sampleHTML && !sampleUsed) out += sampleHTML;
    return out;
  }

  /* 顶部提示词区：图片风格给双轨页签，其余分类给场景任务 */
  function promptZoneHTML(s) {
    var isImage = s.category === 'image';
    var zonehead = '<div class="zonehead"><h2>提示词</h2><span class="line"></span>' +
      '<span class="eyebrow">复制即用</span></div>';

    if (!isImage || s.track === 'edit') {
      return '<div class="promptzone">' + zonehead +
        promptBlock(s.track === 'edit' ? '先上传原图，再粘贴提示词' : '填入材料，获得可核对的交付结果', s.prompt, s.id + ':text') +
        (s.slots && s.slots.length
          ? '<div class="block-title">提示词里的槽位</div><div class="slots">' +
            s.slots.map(function (x) { return '<span class="slot">{' + esc(x) + '}</span>'; }).join('') +
            '</div>'
          : '') +
      '</div>';
    }

    /* 图片风格**必定**有两条轨道（rules.js 强制），所以这里不再有
       「某条轨道不存在就切到另一条」和「单一轨道」这两种分支 ——
       那是在规则只管「至少一条」时留下的兜底，现在它们永远不触发。
       留下的这一句只负责把地址里来的轨道值收敛到合法取值：
       ?track=local / cloud 之外的东西（拼错的、老链接）一律回到本地轨道。 */
    var t = (state.detailTrack === 'cloud') ? 'cloud' : 'local';
    state.detailTrack = t;

    /* 双轨页签是真链接：轨道状态进地址，可分享、可收藏，
       而且浏览器默认跳转是一条不依赖 JS 的通路。 */
    var tabBtn = function (key, label) {
      return '<a class="seg__item' + (t === key ? ' is-on' : '') +
        '" href="#/style/' + encodeURIComponent(s.id) + '?track=' + key + '"' +
        (t === key ? ' aria-current="true"' : '') + '>' + label + '</a>';
    };

    var localPanel = '';
    {
      var L = s.local;
      localPanel = promptBlock('本地参考 · 需自行配置模型与工作流', L.prompt, s.id + ':local') +
        '<details class="detail-fold detail-advanced"><summary data-action="reference-toggle"><span>模型与进阶参数</span><span class="detail-fold__hint">按需展开</span></summary><div class="detail-fold__body">' +
        paramsHTML([
          ['底模', L.base],
          ['采样器', L.sampler],
          ['步数 / CFG', L.steps + ' / ' + L.cfg],
          ['固定种子', String(L.seed)],
          ['工作流文件', L.workflow]
        ]) +
        '<div class="block-title">LoRA 与权重</div>' +
        '<div class="chiplist">' + L.loras.map(function (x) {
          return '<span class="tag tag--outline mono">' + esc(x.name) + ' · ' + x.weight.toFixed(2) + '</span>';
        }).join('') + '</div>' +
        '<div class="block-title">负向提示词</div>' +
        '<div class="chiplist">' + L.neg.split(',').map(function (x) {
          return '<span class="tag tag--ban">' + esc(x.trim()) + '</span>';
        }).join('') + '</div></div></details>';
    }

    var cloudPanel = '';
    {
      var C = s.cloud;
      cloudPanel = promptBlock('云端模板 · 用于支持图像生成的工具', C.prompt, s.id + ':cloud') +
        '<details class="detail-fold detail-advanced"><summary data-action="reference-toggle"><span>工具与使用建议</span><span class="detail-fold__hint">按需展开</span></summary><div class="detail-fold__body">' +
        '<div class="block-title">参考工具</div>' +
        '<div class="chiplist">' + C.models.map(function (m) {
          return '<span class="tag tag--cloud">' + esc(m) + '</span>';
        }).join('') + '</div>' +
        '<div class="block-title">参考图</div>' +
        '<p style="font-size:13.5px;color:var(--ink-3);line-height:1.7">' + esc(C.refs) + '</p>' +
        '<div class="block-title">禁用词表</div>' +
        '<div class="chiplist">' + C.banned.map(function (b) {
          return '<span class="tag tag--ban">' + esc(b) + '</span>';
        }).join('') + '</div></div></details>';
    }

    return '<div class="promptzone">' + zonehead +
      '<p class="recipe-note">待验证配方 · 图片为风格参考，非生成结果。参数与模型资源需自行确认。</p>' +
      '<div class="prompt-panel">' +
        '<div class="prompt-tabs">' +
          '<div class="seg">' +
            tabBtn('local', '本地工具') +
            tabBtn('cloud', '在线工具') +
          '</div>' +
          '<span class="num">同一风格 · 两种参考写法</span>' +
        '</div>' +
        (t === 'local' ? localPanel : cloudPanel) +
      '</div>' +
    '</div>';
  }

  /* 侧栏：署名、来源、统计 */
  function sideHTML(s) {
    var cat = catOf(s.category);
    var cov = s.cover || COVERS[s.id];
    var out = '<aside class="gh__side">';

    if (cov) {
      /* 这里**故意不放图**。
         实测 108/108 张卡的 guide 配图与封面是**同一个文件**，也就是说
         详情页上同一张照片出现了两次：侧栏一张缩略图 + 正文一张 Fig. NN。
         缩略图那份信息量更低（小、没有编号、离说明很远），所以留下正文那份。
         侧栏只保留它真正独有的东西：**署名、许可、来源链接**，
         以及那句必须出现在读者第一眼位置上的「非生成结果」。
         再用一句话把图的位置指过去 —— 否则读者会以为这一页没有配图。 */
      out += '<div class="sideblock refbox">' +
        '<div class="sideblock__t">参考图</div>' +
        '<p class="refbox__flag">来源案例 · 非本站实测</p>' +
        '<p class="num refbox__meta">' + esc(cov.title || '') +
          '<br>© ' + esc(cov.creator) + ' · ' + esc(cov.license) +
          (cov.sourceUrl ? ' · <a href="' + esc(cov.sourceUrl) + '" target="_blank" rel="noopener noreferrer">来源</a>' : '') +
        '</p>' +
        '<p class="num refbox__go">见页面预览区的参考图</p>' +
      '</div>';
    }

    out += '<div class="sideblock"><div class="sideblock__t">作者</div>' +
      '<div class="row gap-12">' +
        '<span class="card__avatar" style="width:34px;height:34px;font-size:14px">' + esc(initials(s.author)) + '</span>' +
        '<span><b style="font-size:14px">' + esc(s.author) + '</b>' +
        '<br><span class="num">' + (s.source ? '中文编辑与整理' : '模板作者') + '</span></span>' +
      '</div></div>';

    if (s.source) {
      out += '<div class="srcbox">' +
        '<div class="srcbox__head">' + ICON.globe + '来源与署名</div>' +
        '<div class="srcbox__body"><dl class="srcrow">' +
          '<dt>仓库</dt><dd><a href="' + esc(s.source.url) + '" target="_blank" rel="noopener noreferrer">' +
            esc(s.source.repo) + '</a></dd>' +
          '<dt>原始条目</dt><dd>' + esc(s.source.act) + '</dd>' +
          '<dt>贡献者</dt><dd>' + esc(s.source.contributor) + '</dd>' +
          '<dt>许可</dt><dd>' + esc(s.source.license || '') + '</dd>' + '<dt>整理方式</dt><dd>' + esc(s.source.mode || '') + '</dd>' + '<dt>仓库热度</dt><dd>' + esc(String(s.source.stars || '')) + ' stars · ' + esc(s.source.checkedAt || '') + ' 快照</dd>' +
        '</dl></div></div>';
    }

    out += '<div class="sideblock"><div class="sideblock__t">信息</div>' +
      '<dl style="margin:0">' +
        '<div class="sidestat"><dt>分类</dt><dd>' + esc(cat.name) + '</dd></div>' +
        '<div class="sidestat"><dt>版本</dt><dd>v' + esc(s.version) + '</dd></div>' +
        '<div class="sidestat"><dt>协议</dt><dd>' + esc(s.license) + '</dd></div>' +
        '<div class="sidestat"><dt>更新</dt><dd>' + esc(s.updated) + '</dd></div>' +
      '</dl></div>';

    out += '<div class="sideblock"><div class="sideblock__t">标签</div>' +
      '<div class="chiplist">' +
        s.uses.map(function (u) { return '<span class="tag tag--outline">' + esc(u) + '</span>'; }).join('') +
        s.moods.map(function (m) { return '<span class="tag">' + esc(m) + '</span>'; }).join('') +
      '</div></div>';

    return out + '</aside>';
  }

  /* 详情页的「拿走它」——把页面里提到的东西真正交到手上。
     没有后端，全靠前端生成：参数包 JSON + 使用说明 Markdown。
     作者那份工作流文件我们拿不到，就如实写明「由作者提供」，
     不假装这里能下载到别人机器上的文件。

     文案里**不要出现「登录」两个字**：这个站还没有账号体系，
     提一句「不需要登录」听着像在解释一个不存在的功能，
     反而把注意力引到没有的东西上。直接说能拿走什么就够了。 */
  function takeawayHTML(s) {
    var L = s.local;
    var id = esc(s.id);
    /* 这里刻意把 data-action 写死在调用点上，而不是当参数传进来：
       hf-test.js 靠扫源码里的字面量来比对「画出来的按钮」和「接住它的分支」，
       拼接出来的 action 它看不见 —— 死按钮走查会瞎掉。
       同样的约定由 interaction: data-action 一律字面量 那条断言守着。 */
    var btn = function (attrs, icon, label) {
      return '<button class="btn btn--ghost btn--sm" ' + attrs + '>' + icon + label + '</button>';
    };

    /* 两个导出是**真 <a download>**，href 在渲染时就造成 blob:。
       这样它们和导航链接一样，在宿主 stopImmediatePropagation 吃掉 click 时
       仍然能下载 —— 浏览器处理锚点默认行为不经过任何监听器。
       没有 href 就说明环境不支持 createObjectURL，那时退回纯按钮 + JS 下载。
       两条路互斥、恰好走一条，见 onAction 里的 export-* 分支。 */
    var jf = s.id + '-card.json';
    var mf = s.id + '-card.md';
    var jh = exportHref(jf, cardExport(s), 'application/json');
    var mh = exportHref(mf, cardMarkdown(s), 'text/markdown');

    return '' +
      '<div class="takeaway">' +
        '<div class="takeaway__head">' +
          '<span class="block-title" style="margin:0">保存与导出</span>' +
          '<span class="eyebrow">保存到本地</span>' +
        '</div>' +
        '<div class="takeaway__row">' +
          '<a class="btn btn--ghost btn--sm"' + (jh ? ' href="' + esc(jh) + '"' : '') +
            ' download="' + esc(jf) + '" data-action="export-json" data-id="' + id + '">' +
            ICON.download + '提示词卡 .json</a>' +
          '<a class="btn btn--ghost btn--sm"' + (mh ? ' href="' + esc(mh) + '"' : '') +
            ' download="' + esc(mf) + '" data-action="export-md" data-id="' + id + '">' +
            ICON.download + '使用说明 .md</a>' +
          (L ? btn('data-action="copy-negative" data-id="' + id + '"', ICON.copy, '复制负向词') : '') +
          (L ? btn('data-action="copy-params" data-id="' + id + '"', ICON.copy, '复制参数清单') : '') +
        '</div>' +
        '<p class="takeaway__note">' +
          (L ? '导出包含提示词和参考参数，不包含工作流或模型文件。' : '保存提示词原文与来源，方便下次使用。') +
        '</p>' +
      '</div>';
  }

  function detailView(id) {
    var s = byId(id);
    if (!s) {
      return '<section class="section"><div class="wrap empty">' + glassHTML('empty__glass') +
        /* h1：这一页整页只有这一句话，没有别的标题 —— 它就是这个页面的标题。
           写 h3 等于告诉读屏软件「上面还有两级，你自己找吧」。 */
        '<h1>找不到这条提示词</h1><p>请检查链接，或回到提示词库继续浏览。</p>' +
        '<a class="btn btn--primary" href="#/library">回到提示词库</a></div></section>';
    }

    var cat = catOf(s.category);
    /* 这张照片在页面上**只出现一次**，位置是使用说明里的 Fig. NN。
       侧栏的 .refbox 只负责署名与「非生成结果」声明，不再放一张缩略图 ——
       实测 108/108 张卡的 guide 配图就是封面本身，两处放同一张是纯冗余。 */

    var sim = STYLES.filter(function (x) {
      if (x.id === s.id) return false;
      return x.category === s.category;
    }).slice(0, 4);

    return '' +
      '<section class="gh">' +
        '<div class="wrap">' +
          /* 返回键。为什么必须有：面包屑是 --step--2 的小型大写灰字，
             读者根本不把它当出口 —— 用户的原话是「每一个 sku 点进去后都没有返回按钮」。
             它仍然是**真 <a href>**，不是 data-action 按钮：
             宿主在捕获阶段 stopImmediatePropagation 吃掉 click 时，
             浏览器默认跳转是唯一还活着的通路，返回键必须活在那条路上。

             目标是「上一次看到的提示词库地址」，筛选条件还在；
             直接从分享链接进来时 lastLibraryHash 是 null，退回这张卡自己的分类。 */
          '<div class="gh__nav">' +
            '<a class="backlink" href="' +
              esc(lastLibraryHash || ('#/library?cat=' + encodeURIComponent(s.category))) + '">' +
              ICON.arrowLeft + '<span>返回提示词库</span>' +
            '</a>' +
            '<div class="crumbs">' +
              '<a href="#/">首页</a><span>/</span>' +
              '<a href="#/library">提示词库</a><span>/</span>' +
              '<a href="#/library?cat=' + encodeURIComponent(s.category) + '">' + esc(cat.name) + '</a>' +
              '<span>/</span><span style="color:var(--ink-2)">' + esc(s.name) + '</span>' +
            '</div>' +
          '</div>' +

          '<header class="gh__head">' +
            '<div>' +
              '<div class="row gap-8 row--wrap" style="margin-bottom:1rem">' +
                '<span class="catpill catpill--' + esc(s.category) + '"><i></i>' + esc(cat.name) + '</span>' +
                trackTags(s) +
                '<span class="tag tag--outline">v' + esc(s.version) + '</span>' +
              '</div>' +
              '<h1 class="gh__title">' + esc(s.name) + '</h1>' +
              '<div class="gh__latin">' + esc(s.latin) + '</div>' +
              '<p class="gh__tagline">' + esc(s.tagline) + '</p>' +
            '</div>' +
            '<div class="gh__actions">' +
              /* 详情页是唯一的复制入口 —— 进来先看到生成效果和使用说明，再复制。 */
              '<button class="btn btn--primary btn--lg" data-action="copy-prompt" data-id="' +
                esc(s.category === 'image' && s.track !== 'edit' ? s.id + ':' + state.detailTrack : s.id + ':text') + '">' +
                ICON.copy + '复制提示词</button>' +
            '</div>' +
          '</header>' +

          '<div class="gh__grid">' +
            '<div class="gh__main">' +
              '<div class="detail-workspace' + (s.category === 'image' ? ' detail-workspace--image' : '') + '">' +
                promptZoneHTML(s) +
                (s.category === 'image'
                  ? '<div class="detail-preview prose">' + notesHTML(s, true) + '</div>'
                  : '<div class="detail-start"><span class="detail-kicker">从这里开始</span><h2>把它变成<br>你的专属助手。</h2><ol><li><b>01</b><span>复制完整提示词</span></li><li><b>02</b><span>粘贴到你常用的 AI 对话工具</span></li><li><b>03</b><span>补充任务背景与期望结果</span></li></ol><p>需要示例？展开下方使用指南。</p></div>') +
              '</div>' +
              takeawayHTML(s) +
              '<details class="detail-fold detail-guide"><summary data-action="reference-toggle"><span>使用指南与交付清单</span><span class="detail-fold__hint">步骤、参考与注意事项</span></summary>' +
                '<div class="prose detail-fold__body"><h2>使用说明</h2>' + notesHTML(s) + '</div>' +
              '</details>' +
            '</div>' +
            '<details class="detail-fold detail-source"><summary data-action="reference-toggle"><span>来源与作品信息</span><span class="detail-fold__hint">署名、授权与版本</span></summary>' +
              sideHTML(s) +
            '</details>' +
          '</div>' +
        '</div>' +
      '</section>' +

      (sim.length
        ? '<section class="related"><div class="wrap">' +
            '<div class="section-head reveal">' +
              '<div><span class="eyebrow">同类推荐</span>' +
              '<h2 style="margin-top:12px;font-size:26px">你可能也想要这些</h2></div>' +
              '<a class="btn btn--ghost btn--sm" href="#/library">全部提示词' + ICON.arrowRight + '</a>' +
            '</div>' +
            '<div class="gallery">' + sim.map(styleCard).join('') + '</div>' +
          '</div></section>'
        : '');
  }

  /* ============================================================= about == */

  function aboutView() {
    return '<section class="section"><div class="wrap" style="max-width:860px"><span class="eyebrow">HOW TO USE</span><h1>好提示词，解决具体问题。</h1><p class="lead">12 个照片转换模板，36 个实用任务。选好任务，复制即可使用。</p><h2>图片：先上传，再转换</h2><p>在支持图像编辑的 AI 工具中上传原图，再粘贴模板。检查人物身份、姿态和主体轮廓，逐步调整风格。本站提供提示词，不直接生成图片。</p><h2>文字：给材料，看交付</h2><p>选择场景任务，填好输入项，提交后按交付清单检查。涉及事实、代码和决策的结果需要核对依据。</p><h2>来源公开，效果如实说明</h2><p>文字模板改编自 <a href="https://github.com/danielmiessler/fabric" target="_blank" rel="noopener noreferrer">Fabric</a>（MIT，44,030 stars）；图片案例来自 <a href="https://github.com/jamez-bondos/awesome-gpt4o-images" target="_blank" rel="noopener noreferrer">awesome-gpt4o-images</a>（逐项 CC BY 4.0）。热度为 2026-09-21 仓库快照，不代表每条模板效果。详情页保留原始出处与署名。</p><p>这些模板经过编辑筛选和结构整理，尚未由本站逐条运行验证。案例图是来源项目展示的效果，中文改编版不承诺复现同样结果。</p></div></section>';
  }

  function retiredView() {
    return '<section class="section"><div class="wrap empty"><span class="eyebrow">书桐 · 提示词图录</span>' +
      '<h1>先从一条好提示词开始</h1><p>这里专注于图片风格与实用场景。浏览、复制，带到你的 AI 工具里使用。</p>' +
      '<a class="btn btn--primary" href="#/library">浏览提示词库</a></div></section>';
  }

  /* =========================================================== palette == */

  function paletteHTML() {
    return '' +
      '<div class="palette" id="palette" role="dialog" aria-modal="true" aria-label="搜索">' +
        '<div class="palette__scrim" data-action="palette-close"></div>' +
        '<div class="palette__panel">' +
          '<div class="palette__input">' +
            '<span style="width:19px;color:var(--ink-3)">' + ICON.search + '</span>' +
            '<input type="search" id="palette-input" placeholder="搜索提示词、分类、作者…" aria-label="搜索">' +
            '<span class="navsearch__kbd">ESC</span>' +
          '</div>' +
          '<div class="palette__list" id="palette-list"></div>' +
        '</div>' +
      '</div>';
  }

  var paletteCursor = 0;
  var paletteResults = [];

  function paletteRender(q) {
    var list = $('#palette-list');
    q = (q || '').trim().toLowerCase();
    var base = STYLES.filter(function (s) {
      if (!q) return true;
      return searchHay(s).indexOf(q) >= 0;
    }).slice(0, 7);

    paletteResults = base;
    if (paletteCursor >= base.length) paletteCursor = 0;

    var quick = '';
    if (!q) {
      /* ⚠️ 这里原先是 `CATS.slice(0, 4)` —— 分组标题写着「按分类浏览」，
         却只给 4 个。首页头图（`slice(0, 6)`）和页脚（手写 3 个）都犯过
         同一个病：**看着是全量，实际是截断**，而同一页面上就有一份真的全量。
         面板列表本身可滚动（`.palette__list{overflow-y:auto}`，
         面板 `max-height:70vh`），列全 7 个不会挤爆。 */
      quick = '<div class="palette__group">按分类浏览</div>' +
        CATS.map(function (c) {
          return '<a class="palette__item" href="#/library?cat=' + encodeURIComponent(c.key) + '">' +
            '<span class="palette__thumb" style="display:grid;place-items:center;background:var(--paper-2)">' +
            ICON.filter + '</span>' +
            '<span class="palette__meta"><span class="palette__name">' + esc(c.name) + '</span>' +
            '<span class="palette__sub">' + esc(c.desc) + '</span></span></a>';
        }).join('') +
        '<div class="palette__group">提示词</div>';
    }

    var rows = base.map(function (s, i) {
      return '<a class="palette__item' + (i === paletteCursor ? ' is-cursor' : '') +
        '" href="#/style/' + esc(s.id) + '" data-action="palette-go">' +
        '<span class="palette__thumb">' + coverHTML(s, { credit: false }) + '</span>' +
        '<span class="palette__meta"><span class="palette__name">' + esc(s.name) + '</span>' +
        '<span class="palette__sub">' + esc(s.tagline) + '</span></span>' +
        '<span class="num">' + esc(catOf(s.category).name) + '</span></a>';
    }).join('');

    list.innerHTML = quick + (rows || '<div class="palette__empty">没有找到相关提示词</div>');
  }

  function paletteOpen() {
    $('#palette').classList.add('is-open');
    var input = $('#palette-input');
    input.value = '';
    paletteCursor = 0;
    paletteRender('');
    setTimeout(function () { input.focus(); }, 60);
  }
  function paletteClose() { $('#palette').classList.remove('is-open'); }

  /* ============================================================ render == */

  function render() {
    var route = parseHash();

    /* 换页之前先把上一页那两个导出链接的 object URL 放掉，否则每进一次
       详情页就多攒两个，一直不释放。延迟回收，别掐断正在进行的下载。 */
    recycleBlobUrls();

    var keepFocus = document.activeElement &&
      document.activeElement.getAttribute &&
      document.activeElement.getAttribute('data-action') === 'filter-search';
    var caret = keepFocus ? document.activeElement.selectionStart : null;

    if (route.path === '/library') {
      state.filters = {
        cat: route.params.cat || '',
        use: route.params.use || '',
        mood: route.params.mood || '',
        /* 轨道只认这三个取值。老链接里的 track=local / track=cloud 落到 'all' ——
           那两项已经不存在了（见 filtered() 的说明），与其显示一个筛不动的档位，
           不如退回全部。白名单同时保证标题不会说谎。 */
        track: (['all', 'both', 'text'].indexOf(route.params.track) >= 0 ? route.params.track : 'all'),
        q: route.params.q || '',
        sort: route.params.sort === 'new' ? 'new' : 'hot'
      };
      /* 已展示条数也进地址 —— 「加载更多」才能是一个真链接 */
      var lim = parseInt(route.params.limit, 10);
      state.limit = (lim > 12) ? lim : 12;

      /* 记住这个地址（含筛选），详情页的返回键靠它回到读者刚才那一屏。
         放在这里而不是 navigate() 里，是因为 hashchange（前进/后退）
         也要更新它 —— 从详情页按浏览器后退回到列表，返回键不该再指向别处。 */
      lastLibraryHash = routeKey || readHash() || '#/library';
    }

    if (route.path.indexOf('/style/') === 0) {
      /* 当前轨道也进地址，双轨页签才能是真链接 */
      if (route.params.track === 'local' || route.params.track === 'cloud') {
        state.detailTrack = route.params.track;
      }
    }

    var html;
    if (route.path === '/') html = homeView();
    else if (route.path === '/library') html = libraryView();
    else if (route.path === '/creators' || route.path === '/submit') html = retiredView();
    else if (route.path === '/about') html = aboutView();
    else if (route.path.indexOf('/style/') === 0) html = detailView(route.path.slice(7));
    else html = '<section class="section"><div class="wrap empty">' + glassHTML('empty__glass') +
      /* h1，理由同上面详情页的「找不到这条提示词」：整页只有这一句。 */
      '<h1>没有找到这个页面</h1><p>先回首页看看提示词库吧。</p>' +
      '<a class="btn btn--primary" href="#/">回到首页</a></div></section>';

    $('#nav').innerHTML = navHTML(route);
    $('#view').innerHTML = html;
    var heading = $('#view h1');
    document.title = (heading ? heading.textContent.trim() + ' · ' : '') + '书桐 SHUTONG';

    $$('.mobilenav a').forEach(function (a) {
      var activeHref = route.path === '/library' ? (route.params.cat === 'image' ? '#/' : '#/library?track=text') : '#' + route.path;
      a.classList.toggle('is-active', a.getAttribute('href') === activeHref);
    });
    $('#mobilenav').classList.remove('is-open');

    observeReveal();
    heroCarouselInit();

    if (keepFocus) {
      var again = $('[data-action="filter-search"]');
      if (again) {
        again.focus();
        try { again.setSelectionRange(caret, caret); } catch (err) { /* noop */ }
      }
    }

    if (route.path !== '/library') window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ============================================================= motion = */

  var reduce = false;
  try {
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (e) { reduce = false; }

  var io = null;

  /* 宿主可能根本没有 requestAnimationFrame（实测过）。
     全站只留这一个调用点：缺失时同步执行，装饰性动画绝不能把整站拖垮。
     countUp 例外 —— 它的动画靠递归推进，同步执行会变成死循环，
     所以那里改成「没有 rAF 就直接落到终值」。 */
  var hasRaf = (typeof window.requestAnimationFrame === 'function');

  function raf(fn) {
    if (hasRaf) window.requestAnimationFrame(fn);
    else fn();
  }

  function countUp(el) {
    if (el.getAttribute('data-done')) return;
    el.setAttribute('data-done', '1');
    var target = parseFloat(el.getAttribute('data-count')) || 0;
    if (reduce || !hasRaf) {
      el.textContent = target.toLocaleString('en-US');
      return;
    }
    var dur = 900, t0 = null;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e).toLocaleString('en-US');
      if (p < 1) raf(frame);
      else el.textContent = target.toLocaleString('en-US');
    }
    el.textContent = '0';
    raf(frame);
  }

  /* 入场动画的兜底。观察者不工作时（宿主没实现、实现坏了、或页面被嵌在
     一个不派发 IntersectionObserver 回调的环境里），内容会永远停在
     opacity:0 —— 看起来像「整页空白」，实际是「有东西但看不见」。
     所以：只要元素进了视口就必须可见，IO 只是加速器，不是开关。 */
  function revealFallback() {
    var vh = window.innerHeight || document.documentElement.clientHeight || 800;
    $$('.reveal:not(.is-in)').forEach(function (n) {
      var r = n.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0) {
        n.classList.add('is-in');
        if (n.classList.contains('countup')) countUp(n);
      }
    });
  }

  var revealTimer = null;

  function observeReveal() {
    var nodes = $$('.reveal, .countup');
    /* 用 typeof 而不是 'in'：宿主可能把这个属性定义成 undefined，
       那样 `'IntersectionObserver' in window` 为真，`new undefined()` 直接抛错，
       后面的初始化全被打断。 */
    if (typeof window.IntersectionObserver !== 'function') {
      nodes.forEach(function (n) {
        n.classList.add('is-in');
        if (n.classList.contains('countup')) countUp(n);
      });
      return;
    }
    try {
      if (!io) {
        io = new window.IntersectionObserver(function (entries) {
          entries.forEach(function (e) {
            if (!e.isIntersecting) return;
            e.target.classList.add('is-in');
            if (e.target.classList.contains('countup')) countUp(e.target);
            io.unobserve(e.target);
          });
        }, { rootMargin: '0px 0px -8% 0px', threshold: .06 });
      }
      nodes.forEach(function (n, i) {
        if (!n.style.getPropertyValue('--d') && i % 3) n.style.setProperty('--d', (i % 3) * 70 + 'ms');
        io.observe(n);
      });
    } catch (err) {
      /* 观察者坏了也要有内容 */
      nodes.forEach(function (n) { n.classList.add('is-in'); });
      $$('.countup').forEach(countUp);
      return;
    }
    if (revealTimer) clearTimeout(revealTimer);
    revealTimer = setTimeout(revealFallback, 1000);
  }

  /* 聚光卡片：跟随光标的高光位置（aceternity spotlight 的零依赖改写） */
  var spotQueued = false, spotEl = null, spotX = 0, spotY = 0;
  function flushSpot() {
    if (spotEl) {
      spotEl.style.setProperty('--mx', spotX + 'px');
      spotEl.style.setProperty('--my', spotY + 'px');
    }
  }
  function onMouseMove(e) {
    var el = e.target.closest && e.target.closest('.spotlight');
    if (!el) return;
    spotEl = el;
    var r = el.getBoundingClientRect();
    spotX = e.clientX - r.left;
    spotY = e.clientY - r.top;
    if (spotQueued) return;
    spotQueued = true;
    raf(function () { spotQueued = false; flushSpot(); });
  }

  /* 图版台的指针视差：图版与三张小卡按不同深度跟着指针轻微位移。
     幅度刻意压得很小（最深的一张也只有十几像素）—— 要的是
     「纸被手指带了一下」的手感，不是「卡片在飞」。
     归一化到 -1..1 交给 CSS 乘各自的深度，JS 只写两个变量。 */
  var deskQueued = false, deskEl = null, deskX = 0, deskY = 0;
  function onDeskMove(e) {
    if (reduce) return;
    var el = e.target.closest && e.target.closest('.hero__visual');
    if (!el) return;
    deskEl = el;
    var r = el.getBoundingClientRect();
    /* 量到 0 宽高时别做除法 —— 宿主里元素可能是折叠的 */
    deskX = r.width ? ((e.clientX - r.left) / r.width - .5) * 2 : 0;
    deskY = r.height ? ((e.clientY - r.top) / r.height - .5) * 2 : 0;
    if (deskQueued) return;
    deskQueued = true;
    raf(function () {
      deskQueued = false;
      if (!deskEl) return;
      deskEl.style.setProperty('--px', deskX.toFixed(3));
      deskEl.style.setProperty('--py', deskY.toFixed(3));
    });
  }

  /* --------------------------------------------------------- clipboard - */
  function promptTextFor(key) {
    var parts = String(key).split(':');
    var s = byId(parts[0]);
    if (!s) return '';
    if (parts[1] === 'text') return s.prompt || '';
    if (parts[1] === 'cloud') return s.cloud ? s.cloud.prompt : '';
    if (parts[1] === 'local') return s.local ? s.local.prompt : '';
    return s.prompt || (s.local ? s.local.prompt : (s.cloud ? s.cloud.prompt : ''));
  }

  /* ============================================================ events == */

  /* 换图版。**故意不调 render()**：render() 会把整页（含瀑布流 78 张卡）
     重画一遍，滚动位置、悬停状态、正在播放的入场动画全丢，
     而这里真正要改的只有图版那一块。就地换完再补一次淡入，
     读者看到的是「翻了一页」，不是「整站刷新」。
     宿主没有 rAF 时跳过重放动画 —— 装饰绝不能挡在交互前面。 */
  /* 首页轮播：一个计时器；换路由清理；拖动后的 click 不能打开详情。 */
  var heroTimer = null;
  var heroPaused = reduce;
  var heroHovered = false;
  var heroDragUntil = 0;
  var heroPointer = null;
  var heroWheelAt = 0;

  function heroClickGuard(e) {
    if (Date.now() < heroDragUntil && e.target.closest && e.target.closest('.hero__plate')) {
      e.preventDefault(); e.stopImmediatePropagation();
    }
  }

  function heroSchedule() {
    clearTimeout(heroTimer);
    heroTimer = null;
    if (!$('.hero__visual')) return;
    heroTimer = setTimeout(function () {
      var region = $('.hero__visual');
      if (!region) return;
      var rect = region.getBoundingClientRect();
      if (!heroPaused && !heroHovered && !heroPointer && !document.hidden &&
          !region.contains(document.activeElement) && rect.bottom > 0 && rect.top < window.innerHeight) {
        heroStep(1);
      } else heroSchedule();
    }, 5000);
  }

  function heroStep(direction) {
    var list = imageStyles();
    var current = $('.hero__index .tick.is-on');
    var id = current ? current.getAttribute('data-id') : state.heroPlateId;
    var at = list.findIndex(function (s) { return s.id === id; });
    var host = $('.hero__plate');
    if (host) host.style.setProperty('--slide-from', direction > 0 ? '6%' : '-6%');
    heroPlateSet(list[(Math.max(at, 0) + direction + list.length) % list.length].id);
    heroSchedule();
  }

  function heroAutoplayLabel() {
    var button = $('[data-action="hero-autoplay"]');
    if (!button) return;
    button.textContent = heroPaused ? '播放轮播' : '暂停轮播';
    button.setAttribute('aria-label', heroPaused ? '开启自动轮播' : '暂停自动轮播');
    button.setAttribute('aria-pressed', heroPaused ? 'true' : 'false');
  }

  function heroCarouselInit() {
    clearTimeout(heroTimer);
    heroTimer = null;
    heroHovered = false;
    heroPointer = null;
    heroDragUntil = 0;
    var region = $('.hero__visual'), host = $('.hero__plate');
    if (!region || !host) return;
    region.setAttribute('role', 'region');
    region.setAttribute('aria-roledescription', '轮播');
    region.setAttribute('aria-label', '图片风格预览');
    heroAutoplayLabel();
    region.addEventListener('mouseenter', function () { heroHovered = true; });
    region.addEventListener('mouseleave', function () { heroHovered = false; heroSchedule(); });
    region.addEventListener('focusout', heroSchedule);
    region.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      heroStep(e.key === 'ArrowRight' ? 1 : -1);
    });
    host.addEventListener('dragstart', function (e) { e.preventDefault(); });
    host.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || e.isPrimary === false) return;
      heroDragUntil = 0;
      heroPointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
      try { host.setPointerCapture(e.pointerId); } catch (err) { /* optional */ }
    });
    host.addEventListener('pointerup', function (e) {
      if (!heroPointer || heroPointer.id !== e.pointerId) return;
      var dx = e.clientX - heroPointer.x, dy = e.clientY - heroPointer.y;
      heroPointer = null;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        heroDragUntil = Date.now() + 700;
        heroStep(dx < 0 ? 1 : -1);
      } else heroSchedule();
    });
    host.addEventListener('pointercancel', function () { heroPointer = null; heroSchedule(); });
    host.addEventListener('lostpointercapture', function () { heroPointer = null; });
    host.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) < 12 || Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      if (Date.now() - heroWheelAt < 650) return;
      heroWheelAt = Date.now();
      heroStep(e.deltaX > 0 ? 1 : -1);
    }, { passive: false });
    heroSchedule();
  }

  function heroPlateSet(id) {
    var s = byId(id);
    if (!s || s.category !== 'image') return;
    var host = $('.hero__visual .hero__plate');
    if (!host) return;

    state.heroPlateId = s.id;
    host.setAttribute('href', '#/style/' + s.id);
    host.innerHTML = heroPlateInner(s);

    $$('.hero__index .tick').forEach(function (b) {
      var on = b.getAttribute('data-id') === s.id;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });

    heroSchedule();
    if (reduce || !hasRaf) return;
    host.classList.remove('is-swap');
    raf(function () { host.classList.add('is-swap'); });
  }

  function onAction(e) {
    var t = e.target.closest('[data-action]');
    if (!t) return;
    var action = t.getAttribute('data-action');

    if (action === 'palette-open') { e.preventDefault(); paletteOpen(); return; }
    if (action === 'palette-close') { e.preventDefault(); paletteClose(); return; }
    if (action === 'palette-go') { setTimeout(paletteClose, 10); return; }
    if (action === 'menu-toggle') { e.preventDefault(); $('#mobilenav').classList.toggle('is-open'); return; }

    /* 首页图版台的刻度。这是**站内状态**，不是导航 —— 地址不变，
       所以用 <button> 而不是 <a>；换成链接反而会平白多出一条历史记录。 */
    if (action === 'hero-prev') { e.preventDefault(); heroStep(-1); return; }
    if (action === 'hero-next') { e.preventDefault(); heroStep(1); return; }
    if (action === 'hero-autoplay') { e.preventDefault(); heroPaused = !heroPaused; heroAutoplayLabel(); heroSchedule(); return; }
    if (action === 'hero-plate') {
      e.preventDefault();
      heroPlateSet(t.getAttribute('data-id'));
      return;
    }

    /* 窄屏的筛选开关。桌面端按钮被 CSS 藏起来，这个状态不影响布局。 */
    if (action === 'filters-toggle') {
      e.preventDefault();
      state.filtersOpen = !state.filtersOpen;
      render();
      return;
    }

    /* 复制只在详情页发生（copy-prompt）。
       这里原本还有一个卡片上的 quick-copy —— 已删除：
       在列表上就能复制，用户看不到生成效果和使用说明，
       等于把「图录」做成了「剪贴板」。 */
    if (action === 'copy-prompt') {
      e.preventDefault();
      var key = t.getAttribute('data-id');
      var txt = promptTextFor(key);
      if (txt) {
        var lbl = key.indexOf(':cloud') > -1 ? '云端提示词'
          : (key.indexOf(':local') > -1 ? '本地提示词' : '提示词');
        copyText(txt, lbl);
      }
      return;
    }

    if (action === 'export-json' || action === 'export-md') {
      var ex = byId(t.getAttribute('data-id'));
      if (!ex) return;
      /* 两条路，互斥，恰好走一条 —— 别把它改成「一律 preventDefault」：
         1) 控件是真 <a download href="blob:...">，且宿主没取消默认行为
            → 什么都不做，交给浏览器。这条在「宿主吃掉 click」时依然活着，
              因为锚点的默认行为不经过监听器。
              此时**绝不能** preventDefault，那会把唯一还活着的一条路掐掉。
         2) 默认行为被取消，或者环境不支持 createObjectURL（没有 href）
            → 自己造一个 Blob 下载。 */
      if (t.tagName === 'A' && t.getAttribute('href') && !e.defaultPrevented) return;
      e.preventDefault();
      if (action === 'export-json') downloadText(ex.id + '-card.json', cardExport(ex), 'application/json');
      else downloadText(ex.id + '-card.md', cardMarkdown(ex), 'text/markdown');
      return;
    }
    if (action === 'reference-toggle') {
      if (e.defaultPrevented) {
        var reference = t.closest('details');
        if (reference) reference.open = !reference.open;
      }
      return;
    }
    if (action === 'copy-negative') {
      e.preventDefault();
      var neg = byId(t.getAttribute('data-id'));
      if (neg && neg.local) copyText(neg.local.neg, '负向提示词');
      return;
    }
    if (action === 'copy-params') {
      e.preventDefault();
      var pc = byId(t.getAttribute('data-id'));
      var ptxt = pc ? cardParamsText(pc) : '';
      if (ptxt) copyText(ptxt, '参数清单');
      return;
    }

    /* filter / load-more / detail-track 原先都是按钮 + JS。
       现在它们都是真 <a href="#/library?...">：条件进地址，可分享、可收藏，
       而且浏览器的默认锚点跳转让它们在「宿主吃掉 click」的环境里依然可用。
       对应分支已删除 —— 留着一个永远不会被触发的分支，
       只会让「有没有死按钮」这类走查失去意义。 */

  }

  function onSubmit(e) {
    var form = e.target.closest('[data-action="search-submit"]');
    if (!form) return;
    e.preventDefault();
    var q = form.querySelector('input[name="q"]').value.trim();
    state.limit = 12;
    go('/library', { cat: 'image', q: q });
  }

  function onInput(e) {
    var t = e.target;
    if (t.getAttribute && t.getAttribute('data-action') === 'filter-search') {
      var v = t.value;
      clearTimeout(onInput._timer);
      onInput._timer = setTimeout(function () {
        var next = {};
        Object.keys(state.filters).forEach(function (k) { next[k] = state.filters[k]; });
        next.q = v;
        state.limit = 12;
        go('/library', next);
      }, 320);
    }
    if (t.id === 'palette-input') {
      paletteCursor = 0;
      paletteRender(t.value);
      return;
    }


  }

  function onChange(e) {
    var t = e.target;
    var da = t.getAttribute && t.getAttribute('data-action');
    if (da === 'sort') {
      var next = {};
      Object.keys(state.filters).forEach(function (k) { next[k] = state.filters[k]; });
      next.sort = t.value;
      state.limit = 12;
      go('/library', next);
      return;
    }
  }

  function onKey(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if ($('#palette').classList.contains('is-open')) paletteClose(); else paletteOpen();
      return;
    }
    if (e.key === 'Escape') {
      paletteClose();
      $('#mobilenav').classList.remove('is-open');
      return;
    }
    if ($('#palette').classList.contains('is-open')) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!paletteResults.length) return;
        paletteCursor = (paletteCursor + (e.key === 'ArrowDown' ? 1 : -1) + paletteResults.length) % paletteResults.length;
        paletteRender($('#palette-input').value);
        var cur = $('.palette__item.is-cursor');
        if (cur) cur.scrollIntoView({ block: 'nearest' });
      }
      if (e.key === 'Enter' && paletteResults[paletteCursor]) {
        e.preventDefault();
        var s = paletteResults[paletteCursor];
        paletteClose();
        go('/style/' + s.id);
      }
      return;
    }
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault();
      paletteOpen();
    }
  }

  /* 滚动：导航吸附 + 进度条 */
  var scrollQueued = false;
  function onScroll() {
    var nav = $('#nav');
    if (nav) nav.classList.toggle('is-stuck', window.scrollY > 8);
    if (scrollQueued) return;
    scrollQueued = true;
    var tick = function () {
      scrollQueued = false;
      var bar = $('#progress');
      if (!bar) return;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      bar.style.setProperty('--p', p.toFixed(4));
    };
    raf(tick);
  }

  /* ============================================================== boot == */

  var bootErrors = [];

  function report(e) {
    bootErrors.push(String((e && e.message) || e));
    if (window.console && console.error) console.error('[书桐]', e);
  }

  /* 渲染失败时别留一片白 —— 白屏是最难排查的故障形态 */
  function showFatal(e) {
    var v = $('#view');
    if (!v) return;
    v.innerHTML = '<div class="wrap" style="padding:72px 0;max-width:44rem">' +
      '<p class="eyebrow">渲染失败</p>' +
      '<h1 class="lib-head__title">页面没能加载出来</h1>' +
      '<p class="muted" style="margin-top:14px">把下面这行信息反馈给我们就行：</p>' +
      '<pre style="margin-top:12px;padding:14px;border:1px solid var(--rule-2);overflow:auto;font-size:12px">' +
      esc(String((e && e.stack) || e)) + '</pre>' +
      '</div>';
  }

  /* 页脚的「分类」栏从 CATS 生成，不手写。

     `index.html` 里原先手写了三个分类（生成图片 / 写作文案 / 编程开发）+「全部提示词」，
     而**同一段文字**写着「七类提示词」、头图的快捷入口和库页的分类条都是全 7 个 ——
     同一个页面上三种口径，读者看到的是「七类」下面列着三个。
     这和首页头图那个 `CATS.slice(0, 6)` 是同一种病：**看着是全量，实际是截断**。

     手写的另一个后果是静默落后：加一个分类，头图和分类条会跟着变（它们读 CATS），
     页脚不会。`index.html` 里那三行留着当无 JS 兜底，这里整块覆盖。 */
  function renderFooterCats() {
    var box = document.getElementById('foot-cats');
    if (!box) return;
    box.innerHTML = '<div class="footer__col-title">分类</div>' +
      CATS.map(function (c) {
        return '<a class="footer__link" href="#/library?cat=' + encodeURIComponent(c.key) + '">' +
          esc(c.name) + '</a>';
      }).join('') +
      '<a class="footer__link" href="#/library">全部提示词</a>';
  }

  function boot() {
    /* 点击接管是整站唯一必须成功的部分，放在最前面：
       后面任何一步抛错都影响不到它。
       同时挂 window 与 document 的捕获阶段 —— window 捕获先于任何
       document 上的监听器，宿主在 document 上抢注册也拦不住我们。 */
    try {
      window.addEventListener('click', heroClickGuard, true);
      window.addEventListener('click', onInternalLink, true);
      document.addEventListener('click', onInternalLink, true);
    } catch (e) { report(e); }

    /* 其余监听器逐个独立注册：一个失败不连坐 */
    [
      function () { document.addEventListener('click', onAction); },
      function () { document.addEventListener('submit', onSubmit); },
      function () { document.addEventListener('input', onInput); },
      function () { document.addEventListener('change', onChange); },
      function () { document.addEventListener('keydown', onKey); },
      function () { window.addEventListener('hashchange', onHashChange); },
      function () { window.addEventListener('scroll', onScroll, { passive: true }); },
      /* 兜底单独挂一个滚动监听，而不是塞进 onScroll：
         boot 会手动调一次 onScroll()，那样首屏元素会在同一帧就被点亮，
         入场动画直接没了。只有真的滚动才该触发兜底。 */
      function () { window.addEventListener('scroll', revealFallback, { passive: true }); },
      function () { document.addEventListener('mousemove', onMouseMove, { passive: true }); },
      function () { document.addEventListener('mousemove', onDeskMove, { passive: true }); }
    ].forEach(function (fn) { try { fn(); } catch (e) { report(e); } });

    /* 纯装饰层：失败不影响可用性 */
    try {
      document.body.insertAdjacentHTML('afterbegin', '<div class="progress" id="progress" aria-hidden="true"></div>');
    } catch (e) { report(e); }
    try {
      document.body.insertAdjacentHTML('beforeend', paletteHTML());
    } catch (e) { report(e); }

    /* 页脚分类栏：只做一次（它不随路由变），失败也只是页脚少了几个链接 ——
       `index.html` 里的兜底三行还在。 */
    try { renderFooterCats(); } catch (e) { report(e); }

    /* 渲染 —— 第二件必须成功的事 */
    try {
      navigate(readHash());
    } catch (e) {
      report(e);
      showFatal(e);
      return;
    }

    try { onScroll(); } catch (e) { report(e); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 供诊断使用：宿主环境里出了什么事，控制台能直接看到 */
  window.__shutong = { errors: function () { return bootErrors.slice(); } };

})();
