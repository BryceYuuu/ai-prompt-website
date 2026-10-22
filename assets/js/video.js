/* Independent video-style study collection. Stills are references; prompts are original templates. */
(function () {
  'use strict';
  var drafts = Object.create(null);
  var modes = Object.create(null);
  var lastList = '#/video';
  var detach = function () {};
  var playIntent = null;
  var slots = ['主体', '场景', '动作'];
  var types = { ai: 'AI 视频', hybrid: 'AI 混合制作', animation: '动画参考' };
  var ISSUES = 'https://github.com/BryceYuuu/ai-prompt-website/issues/new';
  /* Tags are flat in the data; the list groups them into readable facets. Unlisted tags fall into 其他. */
  var FACETS = [
    { name: '画面媒介', tags: ['二维', '三维', '手绘', '绘画', '写实', '手工材质', '黏土', '绒毛', '微缩', '定格感', '版画', '套色', '图形动画', '清线漫画', '数字墨线', '几何', '极简', '抽象', '混合动画'] },
    { name: '题材气质', tags: ['角色动画', '奇幻', '超现实', '电影感', '科幻', '梦境', '迷幻', '暗调', '悬疑', '都市', '发光', '奇幻生物', '拟纪录', '复古档案', '视觉论文', '音乐影像'] },
    { name: '节奏动态', tags: ['舒缓节奏', '动作', '空间转场', '软体动态'] }
  ];
  var FACET_VISIBLE = 7;
  var HOME_PICKS = ['video-postman-animation', 'video-luminous-cloud-fable', 'video-papier-mache-theatre', 'video-liquid-museum-animation', 'video-neon-comic-collage', 'video-tilt-shift-mini-world'];
  /* The catalogue (~110 KB gzip) is loaded on demand so image and task pages do not wait for it. */
  var dataScript = null, dataFailed = false, dataWaiters = [];
  function ready() { return Array.isArray(window.HF_VIDEO_STYLES); }
  function dataSrc() {
    var hint = document.querySelector('meta[data-video-data]');
    return (hint && hint.getAttribute('content')) || 'assets/js/data-video.js';
  }
  function load(callback) {
    if (ready()) { if (callback) callback(); return; }
    if (callback) dataWaiters.push(callback);
    if (dataScript) return;
    dataFailed = false;
    dataScript = document.createElement('script');
    dataScript.src = dataSrc();
    dataScript.async = true;
    dataScript.onload = function () {
      var waiting = dataWaiters; dataWaiters = [];
      waiting.forEach(function (fn) { try { fn(); } catch (e) { /* One consumer must not block the others. */ } });
      window.dispatchEvent(new Event('hf:video-ready'));
    };
    dataScript.onerror = function () {
      dataScript.remove(); dataScript = null; dataFailed = true; dataWaiters = [];
      window.dispatchEvent(new Event('hf:video-error'));
    };
    document.head.appendChild(dataScript);
  }
  var arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var playIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 4.8a1 1 0 0 1 1.5-.86l11 7.2a1 1 0 0 1 0 1.72l-11 7.2A1 1 0 0 1 8 19.2Z"/></svg>';
  function esc(value) {
    return String(value == null ? '' : value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function data() { return Array.isArray(window.HF_VIDEO_STYLES) ? window.HF_VIDEO_STYLES : []; }
  function get(id) { return data().find(function (item) { return item.id === id; }); }
  function captureLabel(frame) {
    return frame.captureKind === 'official-still' ? '官方剧照' : (frame.captureKind === 'video-frame' ? '视频截帧' : '参考画面');
  }
  function httpsUrl(value) {
    try {
      var url = new URL(String(value || ''));
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch (e) { return ''; }
  }
  function sourceUrl(url) { return httpsUrl(url) || '#/video'; }
  function previewFor(item) {
    var raw = item.preview || {}, provider = raw.provider, id = String(raw.videoId || '');
    var url = httpsUrl(raw.url) || sourceUrl(item.reference.url), src = '';
    var start = Number(raw.start);
    start = Number.isFinite(start) && start >= 0 && start <= 86400 ? start : 0;
    if (provider === 'youtube' && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&mute=1&playsinline=1&rel=0&enablejsapi=1';
      if (start) src += '&start=' + Math.floor(start);
      if (/^https?:$/.test(location.protocol)) src += '&origin=' + encodeURIComponent(location.origin);
    } else if (provider === 'vimeo' && /^\d{6,12}$/.test(id) && (!raw.hash || /^[A-Za-z0-9]{6,20}$/.test(String(raw.hash)))) {
      src = 'https://player.vimeo.com/video/' + id + '?autoplay=1&muted=1&playsinline=1&dnt=1';
      if (raw.hash) src += '&h=' + encodeURIComponent(raw.hash);
      if (start) src += '#t=' + start + 's';
    } else if (provider === 'native') {
      src = httpsUrl(raw.src);
      if (src && start) {
        var mediaUrl = new URL(src);
        mediaUrl.hash = 't=' + start;
        src = mediaUrl.href;
      }
    }
    if (!src) provider = 'external';
    return { provider: provider, src: src, url: url, label: raw.label || (provider === 'native' ? '来源视频' : '原作视频'), note: raw.note || '' };
  }
  function playerPoster(item, preview) {
    var embedded = preview.provider !== 'external';
    var tag = embedded ? 'button type="button" data-video-action="play"' : 'a href="' + esc(preview.url) + '" target="_blank" rel="noopener noreferrer"';
    return '<' + tag + ' class="video-player__poster" aria-label="' + esc((embedded ? '播放预览：' : '在来源网站观看：') + item.reference.title) + '"><img src="' + esc(item.frames[0].src) + '" alt="" decoding="async"><span class="video-player__poster-shade"></span><span class="video-player__invite"><span class="video-player__play">' + playIcon + '</span><span>' + (embedded ? '播放预览' : '在来源网站观看 ↗') + '</span></span><span class="video-player__work">' + esc(item.reference.title) + '</span></' + (embedded ? 'button' : 'a') + '>';
  }
  function player(item) {
    var preview = previewFor(item), embedded = preview.provider !== 'external';
    return '<section class="video-player" data-video-player aria-labelledby="video-player-title"><div class="video-player__head"><div><p class="video-eyebrow">WATCH THE MOTION</p><h2 id="video-player-title">先看动画，再拆画风。</h2></div><span>' + esc(preview.label) + '</span></div><div class="video-player__screen" data-video-player-screen>' + playerPoster(item, preview) + '</div><div class="video-player__footer"><p data-video-player-status role="status" aria-live="polite">' + (embedded ? '点击播放，直接感受画面的运动和节奏。' : '该来源暂不支持站内播放，可打开原作观看。') + '</p>' + (preview.note ? '<p class="video-player__note">' + esc(preview.note) + '</p>' : '') + '<div class="video-player__links"><a href="' + esc(preview.url) + '" target="_blank" rel="noopener noreferrer">在来源网站观看 ↗</a><button type="button" data-video-action="retry-play" hidden>重新加载</button><button type="button" data-video-action="stop-play" hidden>关闭预览</button></div></div></section>';
  }
  function listUrl(query, tag, type) {
    var pairs = [];
    if (query) pairs.push('q=' + encodeURIComponent(query));
    if (tag) pairs.push('tag=' + encodeURIComponent(tag));
    if (type) pairs.push('type=' + encodeURIComponent(type));
    return '#/video' + (pairs.length ? '?' + pairs.join('&') : '');
  }
  function mode(item) { return modes[item.id] === 'short' && item.shortPrompt ? 'short' : 'full'; }
  function template(item) { return mode(item) === 'short' ? item.shortPrompt : item.promptTemplate; }
  function prepared(item) {
    var values = drafts[item.id] || {};
    var content = slots.filter(function (key) { return values[key] && values[key].trim(); }).map(function (key) { return key + '：' + values[key].trim(); });
    return (content.length ? '【我的内容】\n' + content.join('\n') + '\n\n' : '') + template(item);
  }
  function approx(text) {
    var n = String(text || '').length;
    return n >= 600 ? '约 ' + Math.round(n / 100) * 100 + ' 字' : '约 ' + Math.round(n / 10) * 10 + ' 字';
  }
  function validTests(item) {
    return (Array.isArray(item.tests) ? item.tests : []).filter(function (t) {
      return t && t.model && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '') && /^assets\/[a-z0-9\/._-]+\.(?:mp4|webm|jpg|jpeg|png|webp)$/i.test(t.media || '');
    });
  }
  function output(item) {
    return prepared(item);
  }
  function matches(item, query) {
    var hay = [item.name, item.latin || '', item.summary, (item.tags || []).join(' '), (item.keywords || []).join(' '), item.reference.title, item.reference.creator, item.bestFor || ''].join(' ').toLowerCase();
    return String(query || '').toLowerCase().trim().split(/\s+/).every(function (term) { return hay.indexOf(term) >= 0; });
  }
  function card(item, index) {
    var frame = item.frames[0], embedded = previewFor(item).provider !== 'external';
    return '<a class="video-card" href="#/video/' + encodeURIComponent(item.id) + (embedded ? '?play=1' : '') + '"' + (embedded ? ' data-video-play-id="' + esc(item.id) + '"' : '') + '>' +
      '<div class="video-card__image"><img src="' + esc(frame.src) + '" alt="' + esc(frame.caption) + '" loading="lazy" decoding="async">' +
        '<span class="video-card__type">' + esc(types[item.reference.type] || '视频参考') + '</span>' +
        '<span class="video-card__play">' + playIcon + (embedded ? '播放预览' : '原作观看 ↗') + '</span>' +
        '<span class="video-card__count">' + (validTests(item).length ? '已有本站实测 · ' : '') + item.frames.length + ' 张参考画面</span></div>' +
      '<div class="video-card__body"><div class="video-card__index">STYLE ' + String(index + 1).padStart(2, '0') + '<span>' + esc((item.tags || []).slice(0, 2).join(' / ')) + '</span></div>' +
        '<h2>' + esc(item.name) + '</h2><p>' + esc(item.summary) + '</p>' +
        '<div class="video-card__foot"><span>参考 · ' + esc(item.reference.title) + '</span><span class="video-card__go" aria-hidden="true">' + arrow + '</span></div></div></a>';
  }
  function chip(label, href, on, count) {
    return '<a href="' + esc(href) + '"' + (on ? ' class="is-active" aria-current="true"' : '') + '>' + esc(label) + (count != null ? '<small>' + count + '</small>' : '') + '</a>';
  }
  function facetsHTML(all, query, tag, type) {
    var counts = Object.create(null), known = [];
    all.forEach(function (item) { (item.tags || []).forEach(function (value) { counts[value] = (counts[value] || 0) + 1; }); });
    var groups = FACETS.map(function (facet) {
      known = known.concat(facet.tags);
      return { name: facet.name, tags: facet.tags.filter(function (value) { return counts[value]; }) };
    });
    var rest = Object.keys(counts).filter(function (value) { return known.indexOf(value) < 0; });
    if (rest.length) groups.push({ name: '其他', tags: rest });
    var typeRow = '<div class="video-facet"><span class="video-facet__name">制作方式</span><div class="video-facet__chips">' +
      chip('全部', listUrl(query, tag, ''), !type) +
      Object.keys(types).map(function (key) {
        return chip(types[key], listUrl(query, tag, key), type === key, all.filter(function (item) { return item.reference.type === key; }).length);
      }).join('') + '</div></div>';
    return '<nav class="video-tags video-facets" aria-label="视频风格筛选">' + typeRow + groups.map(function (group) {
      var sorted = group.tags.slice().sort(function (a, b) { return counts[b] - counts[a]; });
      var shown = sorted.slice(0, FACET_VISIBLE), hidden = sorted.slice(FACET_VISIBLE);
      var tagChip = function (value) { return chip(value, listUrl(query, tag === value ? '' : value, type), tag === value, counts[value]); };
      return '<div class="video-facet"><span class="video-facet__name">' + esc(group.name) + '</span><div class="video-facet__chips">' + shown.map(tagChip).join('') +
        (hidden.length ? '<details class="video-facet__more"' + (hidden.indexOf(tag) >= 0 ? ' open' : '') + '><summary>更多 ' + hidden.length + '</summary>' + hidden.map(tagChip).join('') + '</details>' : '') +
        '</div></div>';
    }).join('') + '</nav>';
  }
  function collection(params) {
    var query = params.q || '', tag = params.tag || '', type = Object.hasOwnProperty.call(types, params.type) ? params.type : '';
    lastList = listUrl(query, tag, type);
    var all = data(), tags = [];
    all.forEach(function (item) { (item.tags || []).forEach(function (value) { if (tags.indexOf(value) < 0) tags.push(value); }); });
    if (tags.indexOf(tag) < 0) tag = '';
    var pool = all.filter(function (item) { return !type || item.reference.type === type; });
    var list = pool.filter(function (item) { return matches(item, query) && (!tag || item.tags.indexOf(tag) >= 0); });
    var tested = all.filter(function (item) { return validTests(item).length; }).length;
    return '<section class="video-page wrap" data-video-page="list">' +
      '<header class="video-intro"><div><p class="video-eyebrow">MOTION STUDIES / 动态影像研究</p><h1>让画面，<br>有自己的<span>运动方式。</span></h1><p class="video-intro__copy">从好作品里，拆解画风、镜头和动作。<br>挑一种风格，把你的想法写成下一段视频。</p></div>' +
      '<div class="video-intro__aside"><span class="video-intro__number">' + String(all.length).padStart(2, '0') + '<small>种影像风格</small></span><p>真实作品参考 × 原创提示词</p><div class="video-intro__legend"><span>看动画</span><i>→</i><span>懂风格</span><i>→</i><span>写自己的故事</span></div></div></header>' +
      '<details class="video-disclosure"><summary><span>原作参考</span><span>本站原创提示词</span><span>' + (tested ? tested + ' 条已实测' : '尚未逐条实测') + '</span><b>来源说明</b></summary><p>参考中包含 AI 视频、混合制作与传统动画，逐条标注。参考画面只用于风格分析，版权归原权利人；提示词由本站原创，尚未逐条生成验证。播放器由来源网站提供，若无法加载，可在详情页打开原作。</p></details>' +
      '<div class="video-filters"><form class="video-search" role="search" data-video-search><label class="sr-only" for="video-search">搜索视频风格</label><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.5"/></svg><input id="video-search" name="q" type="search" value="' + esc(query) + '" placeholder="搜索画风、题材、镜头…" autocomplete="off"><input type="hidden" name="tag" value="' + esc(tag) + '"><input type="hidden" name="type" value="' + esc(type) + '"><button class="btn btn--primary" type="submit">搜索</button></form>' +
      facetsHTML(all, query, tag, type) + '</div>' +
      '<div class="video-results"><p aria-live="polite">' + list.length + ' 种风格' + (query ? ' · “' + esc(query) + '”' : '') + (tag ? ' · ' + esc(tag) : '') + (type ? ' · ' + esc(types[type]) : '') + '</p>' + ((query || tag || type) ? '<a href="#/video">清除筛选</a>' : '<span>按画面找灵感，不按热度排名</span>') + '</div>' +
      (list.length ? '<div class="video-grid">' + list.map(card).join('') + '</div>' : '<div class="video-empty"><h2>暂时没有匹配的风格</h2><p>试试“手绘”“超现实”或更短的关键词。</p><a class="btn btn--ghost" href="#/video">查看全部视频风格</a></div>') +
      '</section>';
  }
  function related(item) {
    var all = data(), at = all.indexOf(item);
    return all.filter(function (other) { return other !== item; }).map(function (other) {
      var shared = (other.tags || []).filter(function (value) { return item.tags.indexOf(value) >= 0; }).length;
      return { item: other, score: shared * 2 + (other.reference.type === item.reference.type ? 1 : 0), distance: Math.abs(all.indexOf(other) - at) };
    }).sort(function (a, b) { return b.score - a.score || a.distance - b.distance; }).slice(0, 4).map(function (entry) { return entry.item; });
  }
  function relatedHTML(item) {
    var all = data(), at = all.indexOf(item), prev = all[(at - 1 + all.length) % all.length], next = all[(at + 1) % all.length];
    return '<section class="video-related" aria-labelledby="video-related-title"><div class="video-related__head"><div><p class="video-eyebrow">KEEP EXPLORING</p><h2 id="video-related-title">相近的风格</h2></div>' +
      '<nav class="video-related__step" aria-label="上一个和下一个视频风格"><a href="#/video/' + encodeURIComponent(prev.id) + '" rel="prev"><span>上一个</span>' + esc(prev.name) + '</a><a href="#/video/' + encodeURIComponent(next.id) + '" rel="next"><span>下一个</span>' + esc(next.name) + '</a></nav></div>' +
      '<div class="video-related__grid">' + related(item).map(function (other) {
        return '<a class="video-related__card" href="#/video/' + encodeURIComponent(other.id) + '"><span class="video-related__image"><img src="' + esc(other.frames[0].src) + '" alt="" loading="lazy" decoding="async"></span><span class="video-related__tags">' + esc((other.tags || []).slice(0, 2).join(' / ')) + '</span><strong>' + esc(other.name) + '</strong><span class="video-related__summary">' + esc(other.summary) + '</span></a>';
      }).join('') + '</div></section>';
  }
  function testsHTML(item) {
    var tests = validTests(item);
    var submit = ISSUES + '?title=' + encodeURIComponent('[实测] ' + item.name);
    if (!tests.length) return '<section class="video-tests video-tests--empty" aria-labelledby="video-tests-title"><div><p class="video-eyebrow">SITE TESTS / 本站实测</p><h2 id="video-tests-title">实测效果</h2><p>这条提示词还没有实测片段。上方画面来自原作，不代表复制提示词后能直接得到的结果；有了实测会在这里与原作并排展示，并注明模型、日期和所用版本。</p></div><a class="btn btn--ghost" href="' + esc(submit) + '" target="_blank" rel="noopener noreferrer">提交我的生成结果 ↗</a></section>';
    return '<section class="video-tests" aria-labelledby="video-tests-title"><div class="video-tests__head"><div><p class="video-eyebrow">SITE TESTS / 本站实测</p><h2 id="video-tests-title">实测效果</h2></div><a href="' + esc(submit) + '" target="_blank" rel="noopener noreferrer">提交我的生成结果 ↗</a></div><div class="video-tests__grid">' +
      tests.map(function (t) {
        var isVideo = /\.(?:mp4|webm)$/i.test(t.media);
        var media = isVideo
          ? '<video src="' + esc(t.media) + '" controls muted playsinline preload="none"' + (t.poster && /^assets\//.test(t.poster) ? ' poster="' + esc(t.poster) + '"' : '') + '></video>'
          : '<img src="' + esc(t.media) + '" alt="' + esc(item.name + ' 实测画面') + '" loading="lazy">';
        return '<figure class="video-test">' + media + '<figcaption><b>' + esc(t.model) + '</b><span>' + esc(t.date) + ' · ' + (t.version === 'short' ? '精简版' : '完整版') + '提示词</span>' + (t.note ? '<p>' + esc(t.note) + '</p>' : '') + '</figcaption></figure>';
      }).join('') + '</div></section>';
  }
  function teaser() {
    if (!ready()) return '';
    var all = data(), picks = HOME_PICKS.map(get).filter(Boolean);
    if (picks.length < 6) picks = picks.concat(all.filter(function (item) { return picks.indexOf(item) < 0; })).slice(0, 6);
    return picks.map(function (item, index) {
      return '<a class="home-motion__card" href="#/video/' + encodeURIComponent(item.id) + '"><span class="home-motion__image"><img src="' + esc(item.frames[0].src) + '" alt="' + esc(item.frames[0].caption) + '" loading="lazy" decoding="async"><span class="home-motion__type">' + esc(types[item.reference.type] || '视频参考') + '</span><span class="home-motion__play" aria-hidden="true">' + playIcon + '</span></span>' +
        '<span class="home-motion__meta"><span>' + String(index + 1).padStart(2, '0') + '</span>' + esc((item.tags || []).slice(0, 2).join(' / ')) + '</span><strong>' + esc(item.name) + '</strong><span class="home-motion__ref">参考 · ' + esc(item.reference.title) + '</span></a>';
    }).join('');
  }
  function loadingView() {
    if (dataFailed) return '<section class="video-page wrap video-empty" data-video-loading><h1>视频风格暂时没有加载出来</h1><p>可能是网络不稳定。图片风格和场景提示词仍可正常使用。</p><button type="button" class="btn btn--primary" data-video-retry-load>重新加载</button></section>';
    return '<section class="video-page wrap video-loading" data-video-loading aria-busy="true"><p class="video-eyebrow">MOTION STUDIES / 动态影像研究</p><h1>正在载入视频风格…</h1><div class="video-loading__grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div></section>';
  }
  function detail(item, autoplay) {
    var values = drafts[item.id] || {}, frame = item.frames[0], many = item.frames.length > 1;
    return '<article class="video-page video-detail wrap" data-video-page="detail" data-video-id="' + esc(item.id) + '"' + (autoplay ? ' data-video-play-intent="true"' : '') + '>' +
      '<a class="video-back" href="' + esc(lastList) + '">← 返回视频风格</a><header class="video-detail__head"><div><p class="video-eyebrow">MOTION STUDY / ' + esc(item.latin || 'VIDEO STYLE') + '</p><h1>' + esc(item.name) + '</h1><p>' + esc(item.summary) + '</p></div><a class="btn btn--ghost video-source-link" href="' + esc(sourceUrl(item.reference.url)) + '" target="_blank" rel="noopener noreferrer">查看原作 ↗</a></header>' +
      '<div class="video-detail__grid"><div class="video-analysis">' + player(item) + '<section class="video-reference" aria-label="参考画面"><h2 class="video-reference__title">参考画面拆解</h2>' +
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
      (item.shortPrompt ? '<div class="video-version" role="radiogroup" aria-label="提示词版本">' +
        [['full', '完整版', approx(item.promptTemplate) + ' · 细节最全'], ['short', '精简版', approx(item.shortPrompt) + ' · 适合有字数上限的工具']].map(function (option) {
          var on = mode(item) === option[0];
          return '<button type="button" role="radio" aria-checked="' + on + '" data-video-mode="' + option[0] + '"><b>' + option[1] + '</b><small>' + option[2] + '</small></button>';
        }).join('') + '</div>' : '') +
      '<div class="video-compose__actions"><button type="button" class="btn btn--primary" data-video-action="copy">复制提示词 ' + arrow + '</button><button type="button" class="btn btn--ghost" data-video-action="download">下载 TXT</button></div>' +
      '<div class="video-prompt-label"><h3 data-video-prompt-title>' + (mode(item) === 'short' ? '精简风格提示词' : '完整风格提示词') + '</h3><button type="button" data-video-action="expand-prompt" aria-expanded="false" aria-controls="video-prompt-text">展开全文</button></div><pre id="video-prompt-text" class="video-prompt" data-video-prompt tabindex="0">' + esc(output(item)) + '</pre>' +
      (item.negativePrompt ? '<details class="video-avoid"><summary>风格避坑 <span>可选排除词</span></summary><p>' + esc(item.negativePrompt) + '</p><button type="button" class="video-text-button" data-video-action="copy-negative">复制排除词</button><small>仅用于支持负面提示词的工具；不会混入上面的主提示词。</small></details>' : '') +
      '<p class="video-usage">时长、画幅和故事由你决定。工具有字数上限时用精简版；图生视频可按工具要求另配首帧。</p></section></div>' +
      testsHTML(item) +
      '<section class="video-provenance"><div><p class="video-eyebrow">REFERENCE / 参考作品</p><h2>' + esc(item.reference.title) + '</h2><p>' + esc(item.reference.creator) + ' <span>· ' + esc(types[item.reference.type] || '视频参考') + '</span></p></div><div><p>' + esc(item.reference.note) + '</p>' + (item.reference.recognition ? '<p class="video-provenance__recognition">收录依据：' + esc(item.reference.recognition) + '</p>' : '') + '<a href="' + esc(sourceUrl(item.reference.url)) + '" target="_blank" rel="noopener noreferrer">查看原始来源 ↗</a>' +
      '<details class="video-fineprint"><summary>版权与使用说明</summary><p class="video-rights">仅以少量参考画面分析视觉语言，图片版权归原权利人，不随本站代码按 MIT 授权。提示词为本站原创风格练习，并非作者制作参数或原始提示词，也未由本站逐条生成验证。</p>' + (item.caveat ? '<p class="video-caveat">' + esc(item.caveat) + '</p>' : '') + '<p>不同模型的理解、输入长度和控制能力不同，请按实际结果调整。</p></details></div></section>' +
      relatedHTML(item) + '</article>';
  }
  function render(route) {
    if (!ready()) { if (!dataFailed) load(); return loadingView(); }
    if (route.path === '/video') { playIntent = null; return collection(route.params || {}); }
    var id;
    try { id = decodeURIComponent(route.path.slice(7)); } catch (e) { id = ''; }
    var item = get(id);
    var autoplay = item && playIntent === item.id && route.params && route.params.play === '1';
    playIntent = null;
    return item ? detail(item, autoplay) : '<section class="video-page wrap video-empty"><h1>没有找到这个视频风格</h1><p>这条链接可能已更新，回到视频风格库继续探索。</p><a class="btn btn--primary" href="#/video">查看视频风格</a></section>';
  }
  function cleanup() { detach(); detach = function () {}; }
  function mount(root, helpers) {
    cleanup();
    var retry = root.querySelector('[data-video-retry-load]');
    if (retry) retry.addEventListener('click', function () { dataFailed = false; root.innerHTML = loadingView(); load(); });
    var page = root.querySelector('[data-video-page]');
    if (!page) return;
    var item = get(page.getAttribute('data-video-id')), index = 0, pointer = null;
    var viewer = null, viewerTrigger = null, previousOverflow = '', suppressClick = false, suppressTimer = null;
    var media = null, playerTimer = null;
    var preview = item ? previewFor(item) : null;
    function playerStatus(message) {
      var status = page.querySelector('[data-video-player-status]');
      if (status) status.textContent = message;
    }
    function playerControls(visible) {
      ['retry-play', 'stop-play'].forEach(function (action) {
        var button = page.querySelector('[data-video-action="' + action + '"]');
        if (button) button.hidden = !visible;
      });
    }
    function releasePlayer() {
      clearTimeout(playerTimer);
      if (!media) return;
      media.onload = media.onerror = media.oncanplay = media.onplaying = null;
      if (media.tagName === 'VIDEO') {
        try { media.pause(); } catch (e) { /* Playback might not have started. */ }
        media.removeAttribute('src');
        try { media.load(); } catch (e) { /* Older browsers may not implement load. */ }
      }
      media.remove();
      media = null;
    }
    function stopPlayer(restoreFocus) {
      releasePlayer();
      var screen = page.querySelector('[data-video-player-screen]');
      if (screen) screen.innerHTML = playerPoster(item, preview);
      playerStatus('预览已关闭。点击画面可重新播放。');
      playerControls(false);
      var button = page.querySelector('[data-video-action="play"]');
      if (button && restoreFocus !== false) button.focus({ preventScroll: true });
    }
    function startPlayer() {
      if (!preview || preview.provider === 'external') return;
      var screen = page.querySelector('[data-video-player-screen]');
      if (!screen) return;
      releasePlayer();
      screen.textContent = '';
      playerStatus('正在加载视频…');
      playerControls(true);
      var current;
      function loaded() {
        if (media !== current) return;
        clearTimeout(playerTimer);
        playerStatus('默认静音播放，可在播放器中开启声音或全屏观看。');
      }
      function failed() {
        if (media !== current) return;
        clearTimeout(playerTimer);
        playerStatus('视频暂时无法加载。可以重新加载，或在来源网站观看。');
      }
      if (preview.provider === 'native') {
        current = document.createElement('video');
        current.controls = true;
        current.playsInline = true;
        current.muted = true;
        current.autoplay = true;
        current.preload = 'none';
        current.poster = item.frames[0].src;
        current.setAttribute('aria-label', item.name + ' · 视频预览');
        current.oncanplay = loaded;
        current.onplaying = loaded;
        current.onerror = failed;
      } else {
        current = document.createElement('iframe');
        current.title = item.name + ' · ' + preview.label;
        current.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
        current.setAttribute('allowfullscreen', '');
        current.referrerPolicy = 'strict-origin-when-cross-origin';
        current.onload = function () {
          if (media !== current) return;
          clearTimeout(playerTimer);
          playerStatus('若未自动播放，请点播放器中的播放键。默认静音，可自行开启声音。');
        };
        current.onerror = failed;
      }
      media = current;
      current.setAttribute('data-video-media', preview.provider);
      current.src = preview.src;
      screen.appendChild(current);
      playerTimer = setTimeout(function () {
        if (media === current) playerStatus('加载较慢。可以重新加载，或在来源网站观看；提示词与参考图仍可使用。');
      }, 12000);
      if (preview.provider === 'native') {
        try {
          var attempt = current.play();
          if (attempt && typeof attempt.catch === 'function') attempt.catch(function () {
            if (media === current) playerStatus('点击播放器的播放键开始预览，也可在来源网站观看。');
          });
        } catch (e) { failed(); }
      }
    }
    function visibility() {
      if (!document.hidden || !media) return;
      if (media.tagName === 'VIDEO') {
        try { media.pause(); } catch (e) { /* No active playback. */ }
      } else if (media.contentWindow) {
        try {
          if (preview.provider === 'youtube') media.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), 'https://www.youtube-nocookie.com');
          if (preview.provider === 'vimeo') media.contentWindow.postMessage({ method: 'pause' }, 'https://player.vimeo.com');
        } catch (e) { /* Third-party player may still be loading. */ }
      }
    }
    function pageHide() {
      // Release external documents when leaving the tab, including bfcache entry.
      // The restored page keeps a working poster without unexpected background audio.
      if (media) stopPlayer(false);
    }
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
      var button = event.target.closest('[data-video-action],[data-video-frame],[data-video-mode]');
      if (!button || !page.contains(button) || !item) return;
      if (button.hasAttribute('data-video-frame')) { choose(Number(button.getAttribute('data-video-frame'))); return; }
      if (button.hasAttribute('data-video-mode')) {
        modes[item.id] = button.getAttribute('data-video-mode');
        Array.prototype.forEach.call(page.querySelectorAll('[data-video-mode]'), function (option) { option.setAttribute('aria-checked', String(option === button)); });
        page.querySelector('[data-video-prompt-title]').textContent = mode(item) === 'short' ? '精简风格提示词' : '完整风格提示词';
        updatePrompt();
        return;
      }
      var action = button.getAttribute('data-video-action');
      if (action === 'play' || action === 'retry-play') { startPlayer(); return; }
      if (action === 'stop-play') { stopPlayer(); return; }
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
      if (action === 'download') helpers.downloadText(item.id + '-video-prompt.txt', item.name + '\n本站原创视频风格模板 · ' + (mode(item) === 'short' ? '精简版' : '完整版') + '\n\n' + output(item) + '\n\n风格参考：' + item.reference.title + '\n' + sourceUrl(item.reference.url) + '\n参考画面并非本站生成结果。');
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
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pageHide);
    detach = function () {
      clearTimeout(suppressTimer);
      releasePlayer();
      closeViewer(false);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pageHide);
      Object.keys(events).forEach(function (name) { page.removeEventListener(name, events[name]); });
    };
    if (page.getAttribute('data-video-play-intent') === 'true') {
      page.removeAttribute('data-video-play-intent');
      startPlayer();
    }
  }
  // This module loads before app.js. Record the click before its capture-phase router
  // replaces the list; URL parameters alone must never opt a visitor into playback.
  window.addEventListener('click', function (event) {
    playIntent = null;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    var link = event.target.closest && event.target.closest('.video-card[data-video-play-id]');
    if (link && link.closest('[data-video-page="list"]')) playIntent = link.getAttribute('data-video-play-id');
  }, true);
  window.HFVideo = { render: render, mount: mount, cleanup: cleanup, ready: ready, load: load, teaser: teaser, search: function (query) { return data().filter(function (item) { return matches(item, query); }); } };
})();
