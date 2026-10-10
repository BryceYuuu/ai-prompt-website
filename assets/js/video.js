/* Independent video-style study collection. Stills are references; prompts are original templates. */
(function () {
  'use strict';
  var drafts = Object.create(null);
  var lastList = '#/video';
  var detach = function () {};
  var slots = ['主体', '场景', '动作'];
  var types = { ai: 'AI 视频', hybrid: 'AI 混合制作', animation: '动画参考' };
  var arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function data() { return Array.isArray(window.HF_VIDEO_STYLES) ? window.HF_VIDEO_STYLES : []; }
  function get(id) { return data().find(function (item) { return item.id === id; }); }
  function captureLabel(frame) {
    return frame.captureKind === 'official-still' ? '官方剧照' : (frame.captureKind === 'video-frame' ? '视频截帧' : '参考画面');
  }
  function sourceUrl(url) { return /^https:\/\//.test(String(url || '')) ? url : '#/video'; }
  function listUrl(query, tag) {
    var pairs = [];
    if (query) pairs.push('q=' + encodeURIComponent(query));
    if (tag) pairs.push('tag=' + encodeURIComponent(tag));
    return '#/video' + (pairs.length ? '?' + pairs.join('&') : '');
  }
  function prepared(item) {
    var values = drafts[item.id] || {};
    var content = slots.filter(function (key) { return values[key] && values[key].trim(); }).map(function (key) { return key + '：' + values[key].trim(); });
    return (content.length ? '【我的内容】\n' + content.join('\n') + '\n\n' : '') + item.promptTemplate;
  }
  function output(item) {
    return prepared(item);
  }
  function matches(item, query) {
    var hay = [item.name, item.latin || '', item.summary, (item.tags || []).join(' '), (item.keywords || []).join(' '), item.reference.title, item.reference.creator, item.bestFor || ''].join(' ').toLowerCase();
    return String(query || '').toLowerCase().trim().split(/\s+/).every(function (term) { return hay.indexOf(term) >= 0; });
  }
  function card(item, index) {
    var frame = item.frames[0];
    return '<a class="video-card" href="#/video/' + encodeURIComponent(item.id) + '">' +
      '<div class="video-card__image"><img src="' + esc(frame.src) + '" alt="' + esc(frame.caption) + '" loading="lazy" decoding="async">' +
        '<span class="video-card__type">' + esc(types[item.reference.type] || '视频参考') + '</span>' +
        '<span class="video-card__count">' + item.frames.length + ' 张参考画面</span></div>' +
      '<div class="video-card__body"><div class="video-card__index">STYLE ' + String(index + 1).padStart(2, '0') + '<span>' + esc((item.tags || []).slice(0, 2).join(' / ')) + '</span></div>' +
        '<h2>' + esc(item.name) + '</h2><p>' + esc(item.summary) + '</p>' +
        '<div class="video-card__foot"><span>参考 · ' + esc(item.reference.title) + '</span><span class="video-card__go" aria-hidden="true">' + arrow + '</span></div></div></a>';
  }
  function collection(params) {
    var query = params.q || '', tag = params.tag || '';
    lastList = listUrl(query, tag);
    var all = data(), tags = [];
    all.forEach(function (item) { (item.tags || []).forEach(function (value) { if (tags.indexOf(value) < 0) tags.push(value); }); });
    if (tags.indexOf(tag) < 0) tag = '';
    var list = all.filter(function (item) { return matches(item, query) && (!tag || item.tags.indexOf(tag) >= 0); });
    return '<section class="video-page wrap" data-video-page="list">' +
      '<header class="video-intro"><div><p class="video-eyebrow">MOTION STUDIES / 动态影像研究</p><h1>让画面，<br>有自己的<span>运动方式。</span></h1><p class="video-intro__copy">从好作品里，拆解画风、镜头和动作。<br>挑一种风格，把你的想法写成下一段视频。</p></div>' +
      '<div class="video-intro__aside"><span class="video-intro__number">' + String(all.length).padStart(2, '0') + '<small>种影像风格</small></span><p>真实作品参考 × 原创提示词</p><div class="video-intro__legend"><span>看画面</span><i>→</i><span>懂风格</span><i>→</i><span>写自己的故事</span></div></div></header>' +
      '<div class="video-disclosure">参考中包含 AI 视频、混合制作与传统动画，逐条标注。参考画面用于风格分析；提示词由本站原创，尚未逐条生成验证。</div>' +
      '<div class="video-filters"><form class="video-search" role="search" data-video-search><label class="sr-only" for="video-search">搜索视频风格</label><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.5"/></svg><input id="video-search" name="q" type="search" value="' + esc(query) + '" placeholder="搜索画风、题材、镜头…" autocomplete="off"><input type="hidden" name="tag" value="' + esc(tag) + '"><button class="btn btn--primary" type="submit">搜索</button></form>' +
      '<nav class="video-tags" aria-label="视频风格标签"><a href="' + esc(listUrl(query, '')) + '"' + (!tag ? ' class="is-active" aria-current="true"' : '') + '>全部风格</a>' + tags.map(function (value) { return '<a href="' + esc(listUrl(query, value)) + '"' + (tag === value ? ' class="is-active" aria-current="true"' : '') + '>' + esc(value) + '</a>'; }).join('') + '</nav></div>' +
      '<div class="video-results"><p aria-live="polite">' + list.length + ' 种风格' + (query ? ' · “' + esc(query) + '”' : '') + '</p>' + ((query || tag) ? '<a href="#/video">清除筛选</a>' : '<span>按画面找灵感，不按热度排名</span>') + '</div>' +
      (list.length ? '<div class="video-grid">' + list.map(card).join('') + '</div>' : '<div class="video-empty"><h2>暂时没有匹配的风格</h2><p>试试“手绘”“超现实”或更短的关键词。</p><a class="btn btn--ghost" href="#/video">查看全部视频风格</a></div>') +
      '<p class="video-bottom-note">参考画面保留原作署名与来源。想理解完整的运动和节奏，请进入详情观看原片；静帧无法替代视频本身。</p></section>';
  }
  function detail(item) {
    var values = drafts[item.id] || {}, frame = item.frames[0], many = item.frames.length > 1;
    return '<article class="video-page video-detail wrap" data-video-page="detail" data-video-id="' + esc(item.id) + '">' +
      '<a class="video-back" href="' + esc(lastList) + '">← 返回视频风格</a><header class="video-detail__head"><div><p class="video-eyebrow">MOTION STUDY / ' + esc(item.latin || 'VIDEO STYLE') + '</p><h1>' + esc(item.name) + '</h1><p>' + esc(item.summary) + '</p></div><a class="btn btn--ghost video-source-link" href="' + esc(sourceUrl(item.reference.url)) + '" target="_blank" rel="noopener noreferrer">查看原作 ↗</a></header>' +
      '<div class="video-detail__grid"><div class="video-analysis"><section class="video-reference" aria-label="参考画面">' +
      '<div class="video-stage' + (!many ? ' video-stage--single' : '') + '">' +
      (many ? '<button type="button" class="video-arrow video-arrow--prev" data-video-action="prev" aria-label="上一张参考画面">' + arrow + '</button>' : '') +
      '<button type="button" class="video-frame" data-video-action="zoom" aria-label="放大当前参考画面，按左右方向键切换" aria-haspopup="dialog"><img data-video-main src="' + esc(frame.src) + '" alt="' + esc(frame.caption) + '" draggable="false"><span class="video-frame__label" data-video-frame-label>' + esc(captureLabel(frame)) + ' · 非本站生成结果</span><span class="video-frame__zoom" aria-hidden="true">放大 ↗</span></button>' +
      (many ? '<button type="button" class="video-arrow" data-video-action="next" aria-label="下一张参考画面">' + arrow + '</button>' : '') + '</div>' +
      '<p class="video-frame__caption" data-video-caption aria-live="polite">' + esc(frame.time + ' · ' + frame.caption) + '</p>' +
      '<div class="video-thumbnails" role="group" aria-label="选择参考画面">' + item.frames.map(function (picture, index) { return '<button type="button" data-video-frame="' + index + '" aria-pressed="' + (index === 0 ? 'true' : 'false') + '" aria-label="第 ' + (index + 1) + ' 张，' + esc(picture.time + '，' + picture.caption) + '"><img src="' + esc(picture.src) + '" alt="" loading="lazy"><span>' + esc(picture.time) + '</span></button>'; }).join('') + '</div>' +
      '<p class="video-credit" data-video-credit>' + esc(frame.credit) + '</p></section>' +
      '<section class="video-notes"><p class="video-eyebrow">THE VISUAL LANGUAGE</p><h2>这个风格，怎么成立？</h2><div>' + item.styleNotes.map(function (note, index) { return '<section class="video-note"><span>0' + (index + 1) + '</span><div><h3>' + esc(note.label) + '</h3><p>' + esc(note.text) + '</p></div></section>'; }).join('') + '</div>' +
      (item.bestFor ? '<p class="video-best"><b>适合做</b>' + esc(item.bestFor) + '</p>' : '') + '</section></div>' +
      '<section class="video-compose" aria-labelledby="video-compose-title"><div class="video-compose__top"><p class="video-eyebrow">THE STYLE PROMPT</p><span>本站原创</span></div><h2 id="video-compose-title">把这种风格，带进你的视频。</h2><p class="video-compose__hint">画风、材质、动态与镜头语言，整理成一套完整提示词。直接复制，或加入你自己的内容。</p>' +
      '<details class="video-customize"' + (slots.some(function (slot) { return values[slot] && values[slot].trim(); }) ? ' open' : '') + '><summary>加入我的内容 <span>选填</span></summary><p>只填写你需要的部分。内容仅保留在当前浏览会话。</p>' +
      '<div class="video-fields">' + slots.map(function (slot, index) { var hints = ['一位背着帆布包的年轻旅行者', '雨后的山间车站，傍晚', '缓缓抬头，向远处驶来的列车挥手']; return '<label for="video-slot-' + index + '"><span>' + esc(slot) + '</span><textarea id="video-slot-' + index + '" data-video-slot="' + slot + '" maxlength="800" rows="2" placeholder="例如：' + esc(item.examples && item.examples[slot] || hints[index]) + '">' + esc(values[slot] || '') + '</textarea></label>'; }).join('') + '</div>' +
      '<button type="button" class="video-text-button" data-video-action="reset">清空填写</button></details>' +
      '<div class="video-compose__actions"><button type="button" class="btn btn--primary" data-video-action="copy">复制提示词 ' + arrow + '</button><button type="button" class="btn btn--ghost" data-video-action="download">下载 TXT</button></div>' +
      '<div class="video-prompt-label"><h3>完整风格提示词</h3><button type="button" data-video-action="expand-prompt" aria-expanded="false" aria-controls="video-prompt-text">展开全文</button></div><pre id="video-prompt-text" class="video-prompt" data-video-prompt tabindex="0">' + esc(output(item)) + '</pre>' +
      (item.negativePrompt ? '<details class="video-avoid"><summary>风格避坑 <span>可选排除词</span></summary><p>' + esc(item.negativePrompt) + '</p><button type="button" class="video-text-button" data-video-action="copy-negative">复制排除词</button><small>仅用于支持负面提示词的工具；不会混入上面的主提示词。</small></details>' : '') +
      '<p class="video-usage">时长、画幅和故事由你决定。将这套风格与自己的内容搭配使用；图生视频时，可按工具要求另配首帧。不同模型的理解、输入长度和控制能力不同，请按实际结果调整。</p>' +
      (item.caveat ? '<p class="video-caveat">' + esc(item.caveat) + '</p>' : '') + '</section></div>' +
      '<section class="video-provenance"><div><p class="video-eyebrow">REFERENCE / 参考作品</p><h2>' + esc(item.reference.title) + '</h2><p>' + esc(item.reference.creator) + ' <span>· ' + esc(types[item.reference.type] || '视频参考') + '</span></p></div><div><p>' + esc(item.reference.note) + '</p>' + (item.reference.recognition ? '<p class="video-provenance__recognition">收录依据：' + esc(item.reference.recognition) + '</p>' : '') + '<p class="video-rights">仅以少量参考画面分析视觉语言，图片版权归原权利人，不随本站代码按 MIT 授权。提示词为本站原创风格练习，并非作者制作参数或原始提示词，也未由本站逐条生成验证。</p><a href="' + esc(sourceUrl(item.reference.url)) + '" target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a></div></section></article>';
  }
  function render(route) {
    if (route.path === '/video') return collection(route.params || {});
    var id;
    try { id = decodeURIComponent(route.path.slice(7)); } catch (e) { id = ''; }
    var item = get(id);
    return item ? detail(item) : '<section class="video-page wrap video-empty"><h1>没有找到这个视频风格</h1><p>这条链接可能已更新，回到视频风格库继续探索。</p><a class="btn btn--primary" href="#/video">查看视频风格</a></section>';
  }
  function cleanup() { detach(); detach = function () {}; }
  function mount(root, helpers) {
    cleanup();
    var page = root.querySelector('[data-video-page]');
    if (!page) return;
    var item = get(page.getAttribute('data-video-id')), index = 0, pointer = null;
    var viewer = null, viewerTrigger = null, previousOverflow = '', suppressClick = false, suppressTimer = null;
    function updatePrompt() { var pre = page.querySelector('[data-video-prompt]'); if (pre) pre.textContent = output(item); }
    function choose(next) {
      if (!item) return;
      index = (next + item.frames.length) % item.frames.length;
      var frame = item.frames[index], image = page.querySelector('[data-video-main]');
      image.src = frame.src; image.alt = frame.caption;
      page.querySelector('[data-video-caption]').textContent = frame.time + ' · ' + frame.caption;
      page.querySelector('[data-video-credit]').textContent = frame.credit;
      page.querySelector('[data-video-frame-label]').textContent = captureLabel(frame) + ' · 非本站生成结果';
      updateViewer();
      Array.prototype.forEach.call(page.querySelectorAll('[data-video-frame]'), function (button) { button.setAttribute('aria-pressed', String(Number(button.getAttribute('data-video-frame')) === index)); });
    }
    function updateViewer() {
      if (!viewer) return;
      var frame = item.frames[index], image = viewer.querySelector('[data-video-viewer-image]');
      image.src = frame.src; image.alt = frame.caption;
      viewer.querySelector('[data-video-viewer-label]').textContent = captureLabel(frame) + ' · 非本站生成结果';
      viewer.querySelector('[data-video-viewer-caption]').textContent = (index + 1) + ' / ' + item.frames.length + ' · ' + frame.time + ' · ' + frame.caption;
      viewer.querySelector('[data-video-viewer-credit]').textContent = frame.credit;
    }
    function closeViewer(restoreFocus) {
      if (!viewer) return;
      var closing = viewer;
      viewer = null;
      if (closing.open && typeof closing.close === 'function') closing.close();
      closing.remove();
      document.body.style.overflow = previousOverflow;
      if (restoreFocus && viewerTrigger && viewerTrigger.isConnected) viewerTrigger.focus({ preventScroll: true });
      viewerTrigger = null;
    }
    function openViewer(trigger) {
      if (viewer) return;
      viewerTrigger = trigger;
      previousOverflow = document.body.style.overflow;
      viewer = document.createElement('dialog');
      viewer.className = 'video-viewer';
      viewer.setAttribute('aria-label', item.name + ' · 参考画面大图');
      viewer.setAttribute('aria-modal', 'true');
      viewer.innerHTML = '<div class="video-viewer__head"><p data-video-viewer-label></p><button type="button" class="video-viewer__close" data-video-viewer-action="close" aria-label="关闭参考大图">关闭 ×</button></div>' +
        '<div class="video-viewer__stage' + (item.frames.length === 1 ? ' video-viewer__stage--single' : '') + '">' +
        (item.frames.length > 1 ? '<button type="button" class="video-arrow video-arrow--prev" data-video-viewer-action="prev" aria-label="上一张参考画面">' + arrow + '</button>' : '') +
        '<img class="video-viewer__image" data-video-viewer-image alt="" draggable="false">' +
        (item.frames.length > 1 ? '<button type="button" class="video-arrow" data-video-viewer-action="next" aria-label="下一张参考画面">' + arrow + '</button>' : '') + '</div>' +
        '<p class="video-viewer__caption" data-video-viewer-caption aria-live="polite"></p><p class="video-viewer__credit" data-video-viewer-credit></p>';
      viewer.addEventListener('click', function (event) {
        var button = event.target.closest('[data-video-viewer-action]');
        if (!button) return;
        var action = button.getAttribute('data-video-viewer-action');
        if (action === 'close') closeViewer(true);
        else choose(index + (action === 'next' ? 1 : -1));
      });
      viewer.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') { event.preventDefault(); closeViewer(true); return; }
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); choose(index + (event.key === 'ArrowRight' ? 1 : -1)); return; }
        if (event.key === 'Tab') {
          var buttons = viewer.querySelectorAll('button'), first = buttons[0], last = buttons[buttons.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }
      });
      viewer.addEventListener('cancel', function (event) { event.preventDefault(); closeViewer(true); });
      viewer.addEventListener('close', function (event) { if (event.target === viewer) closeViewer(true); });
      viewer.addEventListener('pointerdown', down);
      viewer.addEventListener('pointermove', move);
      viewer.addEventListener('pointerup', up);
      viewer.addEventListener('pointercancel', cancel);
      document.body.appendChild(viewer);
      updateViewer();
      document.body.style.overflow = 'hidden';
      if (typeof viewer.showModal === 'function') viewer.showModal();
      else { viewer.setAttribute('open', ''); viewer.setAttribute('role', 'dialog'); }
      viewer.querySelector('[data-video-viewer-action="close"]').focus();
    }
    function click(event) {
      var button = event.target.closest('[data-video-action],[data-video-frame]');
      if (!button || !page.contains(button) || !item) return;
      if (button.hasAttribute('data-video-frame')) { choose(Number(button.getAttribute('data-video-frame'))); return; }
      var action = button.getAttribute('data-video-action');
      if (action === 'zoom') {
        if (suppressClick && event.detail !== 0) { event.preventDefault(); return; }
        openViewer(button); return;
      }
      if (action === 'prev') choose(index - 1);
      if (action === 'next') choose(index + 1);
      if (action === 'copy') helpers.copyText(output(item), '视频提示词');
      if (action === 'copy-negative') helpers.copyText(item.negativePrompt, '排除词');
      if (action === 'expand-prompt') {
        var expanded = button.getAttribute('aria-expanded') !== 'true';
        button.setAttribute('aria-expanded', String(expanded));
        button.textContent = expanded ? '收起全文' : '展开全文';
        page.querySelector('[data-video-prompt]').classList.toggle('is-expanded', expanded);
      }
      if (action === 'download') helpers.downloadText(item.id + '-video-prompt.txt', item.name + '\n本站原创视频风格模板\n\n' + output(item) + '\n\n风格参考：' + item.reference.title + '\n' + sourceUrl(item.reference.url) + '\n参考画面并非本站生成结果。');
      if (action === 'reset') {
        delete drafts[item.id];
        Array.prototype.forEach.call(page.querySelectorAll('[data-video-slot]'), function (input) { input.value = ''; });
        updatePrompt();
      }
    }
    function input(event) {
      var slot = event.target.getAttribute('data-video-slot');
      if (!item || slots.indexOf(slot) < 0) return;
      if (!drafts[item.id]) drafts[item.id] = Object.create(null);
      drafts[item.id][slot] = event.target.value;
      updatePrompt();
    }
    function submit(event) {
      if (!event.target.hasAttribute('data-video-search')) return;
      event.preventDefault();
      helpers.navigate(listUrl(event.target.elements.q.value.trim(), event.target.elements.tag.value));
      var search = root.querySelector('#video-search');
      if (search) search.focus({ preventScroll: true });
    }
    function keydown(event) {
      if (!item || !event.target.closest('.video-reference') || event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); choose(index + (event.key === 'ArrowRight' ? 1 : -1)); }
    }
    function down(event) {
      var surface = event.target.closest('.video-frame,.video-viewer__image');
      if (!item || event.isPrimary === false || event.button > 0 || !surface) return;
      clearTimeout(suppressTimer);
      suppressClick = false;
      pointer = { x: event.clientX, y: event.clientY, moved: false, id: event.pointerId };
      try { if (surface.setPointerCapture) surface.setPointerCapture(event.pointerId); } catch (e) { /* Native capture is optional in older browsers. */ }
    }
    function move(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      if (Math.abs(event.clientX - pointer.x) > 8 || Math.abs(event.clientY - pointer.y) > 8) pointer.moved = true;
    }
    function up(event) {
      if (!pointer || event.pointerId !== pointer.id) return;
      var dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      suppressClick = pointer.moved || Math.abs(dx) > 8 || Math.abs(dy) > 8;
      pointer = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3) choose(index + (dx < 0 ? 1 : -1));
      suppressTimer = setTimeout(function () { suppressClick = false; }, 450);
    }
    function cancel() { pointer = null; suppressClick = true; }
    var events = { click: click, input: input, submit: submit, keydown: keydown, pointerdown: down, pointermove: move, pointerup: up, pointercancel: cancel };
    Object.keys(events).forEach(function (name) { page.addEventListener(name, events[name]); });
    detach = function () {
      clearTimeout(suppressTimer);
      closeViewer(false);
      Object.keys(events).forEach(function (name) { page.removeEventListener(name, events[name]); });
    };
  }
  window.HFVideo = { render: render, mount: mount, cleanup: cleanup, search: function (query) { return data().filter(function (item) { return matches(item, query); }); } };
})();
