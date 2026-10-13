#!/usr/bin/env node
'use strict';

// Exercise the shipped index, data, router and handlers. The optional mutations
// are applied while reading JavaScript; production files are never rewritten.
const fs = require('fs'), path = require('path'), assert = require('assert');
const crypto = require('crypto');
const { JSDOM, VirtualConsole } = require('jsdom');
const mutations = {
  previewMissing: { group: 'preview-source-evidence', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].preview = null;' },
  previewEager: { group: 'preview-lazy-load-and-provider-controls', file: 'video.js', anchor: "if (page.getAttribute('data-video-play-intent') === 'true')", replacement: 'if (item)' },
  previewReferrer: { group: 'preview-lazy-load-and-provider-controls', file: 'video.js', anchor: "current.referrerPolicy = 'strict-origin-when-cross-origin';", replacement: "current.referrerPolicy = 'no-referrer';" },
  previewControls: { group: 'preview-lazy-load-and-provider-controls', file: 'video.js', anchor: 'current.controls = true;', replacement: 'current.controls = false;' },
  previewIntent: { group: 'preview-card-gesture-and-private-input', file: 'video.js', anchor: "if (page.getAttribute('data-video-play-intent') === 'true')", replacement: 'if (false)' },
  previewCleanup: { group: 'preview-retry-stop-and-cleanup', file: 'video.js', anchor: 'clearTimeout(suppressTimer);\n      releasePlayer();', replacement: 'clearTimeout(suppressTimer);' },
  previewFailure: { group: 'preview-retry-stop-and-cleanup', file: 'video.js', anchor: 'current.onerror = failed;', replacement: 'current.onerror = function () {};' },
  previewPageHide: { group: 'preview-retry-stop-and-cleanup', file: 'video.js', anchor: "window.addEventListener('pagehide', pageHide);", replacement: 'void 0;' },
  previewUnsafe: { group: 'preview-invalid-source-fallback', file: 'video.js', anchor: "url.protocol === 'https:' && !url.username && !url.password", replacement: 'true' },
  shortPrompt: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].promptTemplate = "美丽的电影风格";' },
  fixedDuration: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].promptTemplate += "生成六秒视频。";' },
  fixedAspect: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].promptTemplate += "采用16:9画幅。";' },
  fixedResolution: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].promptTemplate += "4K分辨率。";' },
  fixedFps: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].promptTemplate += "24 FPS输出。";' },
  pureStyle: { group: 'ready-to-copy-style-and-optional-content', file: 'video.js', anchor: 'return prepared(item);', replacement: 'return "请先填写主体" + prepared(item);' },
  negativeMixed: { group: 'ready-to-copy-style-and-optional-content', file: 'video.js', anchor: 'return prepared(item);', replacement: 'return prepared(item) + item.negativePrompt;' },
  negativeCopy: { group: 'separate-negative-and-expandable-prompt', file: 'video.js', anchor: "helpers.copyText(item.negativePrompt, '排除词')", replacement: "helpers.copyText(output(item), '排除词')" },
  expandPrompt: { group: 'separate-negative-and-expandable-prompt', file: 'video.js', anchor: ".classList.toggle('is-expanded', expanded)", replacement: ".classList.toggle('is-expanded', false)" },
  catalog: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES.pop();' },
  evidence: { group: 'catalog-evidence-and-assets', file: 'data-video.js', anchor: 'window.HF_VIDEO_STYLES', append: '\nwindow.HF_VIDEO_STYLES[0].frames[0].src = "assets/img/video/missing.jpg";' },
  route: { group: 'independent-routes-and-navigation', file: 'app.js', anchor: "html = window.HFVideo.render(route);", replacement: "html = homeView();" },
  search: { group: 'search-tag-and-return-context', file: 'video.js', anchor: 'return matches(item, query) && (!tag || item.tags.indexOf(tag) >= 0);', replacement: 'return true;' },
  searchAnd: { group: 'search-tag-and-return-context', file: 'video.js', anchor: '.split(/\\s+/).every(', replacement: '.split(/\\s+/).some(' },
  keywords: { group: 'search-tag-and-return-context', file: 'video.js', anchor: "(item.keywords || []).join(' ')", replacement: "''" },
  tags: { group: 'search-tag-and-return-context', file: 'video.js', anchor: '(!tag || item.tags.indexOf(tag) >= 0)', replacement: 'true' },
  copy: { group: 'prepared-copy-and-txt', file: 'video.js', anchor: "helpers.copyText(output(item), '视频提示词')", replacement: "helpers.copyText(item.promptTemplate, '视频提示词')" },
  download: { group: 'prepared-copy-and-txt', file: 'video.js', anchor: "+ output(item) + '\\n\\n风格参考：'", replacement: "+ item.promptTemplate + '\\n\\n风格参考：'" },
  escaping: { group: 'input-escaping', file: 'video.js', anchor: 'pre.textContent = output(item)', replacement: 'pre.innerHTML = output(item)' },
  privacy: { group: 'memory-only-private-drafts', file: 'video.js', anchor: 'drafts[item.id][slot] = event.target.value;', replacement: 'drafts[item.id][slot] = event.target.value; localStorage.setItem("video-input-leak", event.target.value);' },
  drafts: { group: 'memory-only-private-drafts', file: 'video.js', anchor: 'function cleanup() { detach();', replacement: 'function cleanup() { drafts = Object.create(null); detach();' },
  reset: { group: 'reset-and-card-isolation', file: 'video.js', anchor: 'delete drafts[item.id];', replacement: 'void 0;' },
  gallery: { group: 'gallery-arrows-keyboard-and-thumbnails', file: 'video.js', anchor: "var frame = item.frames[index], image = page.querySelector('[data-video-main]');", replacement: "var frame = item.frames[0], image = page.querySelector('[data-video-main]');" },
  swipe: { group: 'gallery-gesture-and-click-suppression', file: 'video.js', anchor: 'Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.3', replacement: 'false' },
  dragClick: { group: 'gallery-gesture-and-click-suppression', file: 'video.js', anchor: 'if (suppressClick && event.detail !== 0)', replacement: 'if (false)' },
  attribution: { group: 'attribution-type-and-capture-labels', file: 'video.js', anchor: "esc(item.reference.creator) + ' <span>", replacement: "esc('MISSING CREATOR') + ' <span>" },
  capture: { group: 'attribution-type-and-capture-labels', file: 'video.js', anchor: "frame.captureKind === 'official-still' ? '官方剧照'", replacement: "frame.captureKind === 'official-still' ? '视频截帧'" },
  type: { group: 'attribution-type-and-capture-labels', file: 'video.js', anchor: "animation: '动画参考'", replacement: "animation: 'AI 视频'" },
  viewerCurrent: { group: 'dialog-current-frame-and-focus-return', file: 'video.js', anchor: "var frame = item.frames[index], image = viewer.querySelector('[data-video-viewer-image]');", replacement: "var frame = item.frames[0], image = viewer.querySelector('[data-video-viewer-image]');" },
  viewerFocus: { group: 'dialog-current-frame-and-focus-return', file: 'video.js', anchor: 'viewerTrigger.focus({ preventScroll: true });', replacement: 'void 0;' },
  viewerEscape: { group: 'dialog-navigation-cancel-and-cleanup', file: 'video.js', anchor: "if (event.key === 'Escape') { event.preventDefault(); closeViewer(true); return; }", replacement: "if (event.key === 'Escape') { event.preventDefault(); return; }" },
  viewerCleanup: { group: 'dialog-navigation-cancel-and-cleanup', file: 'video.js', anchor: 'closeViewer(false);', replacement: 'void 0;' },
  viewerSwipe: { group: 'dialog-navigation-cancel-and-cleanup', file: 'video.js', anchor: "viewer.addEventListener('pointerup', up);", replacement: "viewer.addEventListener('pointerup', function () {});" },
  paletteSearch: { group: 'global-palette-click-and-enter', file: 'app.js', anchor: 'if (q && window.HFVideo) base = base.concat', replacement: 'if (false) base = base.concat' },
  paletteEnter: { group: 'global-palette-click-and-enter', file: 'app.js', anchor: "go((s.video ? '/video/' : '/style/') + s.id);", replacement: "go('/style/' + s.id);" },
  missing: { group: 'missing-id-and-malformed-route', file: 'video.js', anchor: 'var item = get(id);', replacement: 'var item = data()[0];' },
  runtime: { group: 'no-video-runtime-errors', file: 'video.js', anchor: "'use strict';", replacement: "'use strict'; window.addEventListener('hashchange', function () { throw new Error('video mutation runtime'); });" }
};

async function run(root, mutant, onlyGroup) {
  root = path.resolve(root || path.join(__dirname, '..'));
  if (mutant) assert(mutations[mutant], 'Unknown video mutation: ' + mutant);
  let applied = false;
  const readScript = src => {
    const filename = src.split('?')[0];
    let code = fs.readFileSync(path.join(root, filename), 'utf8');
    const mutation = mutations[mutant];
    if (mutation && path.basename(filename) === mutation.file) {
      assert(code.includes(mutation.anchor), 'Missing mutation anchor: ' + mutant);
      code = mutation.append ? code + mutation.append : code.replace(mutation.anchor, mutation.replacement);
      applied = true;
    }
    return code;
  };
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace(/<script src="(assets\/js\/[^\"]+)"><\/script>/g, (_, src) => '<script>' + readScript(src) + '</script>');
  if (mutant) assert(applied, 'Mutation script was not loaded: ' + mutant);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'tools/curate/sources/video-style-references.json'), 'utf8'));
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  function session() {
    const out = { copied: '', downloads: [], errors: [], modalCalls: 0, network: [] }, blobs = new Map();
    const vc = new VirtualConsole();
    vc.on('jsdomError', error => out.errors.push(error.message));
    vc.on('error', error => out.errors.push(String(error)));
    out.dom = new JSDOM(html, {
      url: 'https://example.test/#/video', runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
      beforeParse(w) {
        w.scrollTo = () => {};
        w.HTMLElement.prototype.scrollIntoView = () => {};
        w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
        w.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
        out.mediaCalls = [];
        // Network/codec playback is verified in a real browser; here observe the
        // media lifecycle without JSDOM's unimplemented play/pause warnings.
        w.HTMLMediaElement.prototype.play = function () { out.mediaCalls.push(['play', this]); return Promise.resolve(); };
        w.HTMLMediaElement.prototype.pause = function () { out.mediaCalls.push(['pause', this]); };
        w.HTMLMediaElement.prototype.load = function () { out.mediaCalls.push(['load', this]); };
        w.navigator.clipboard = { writeText: async text => { out.copied = text; } };
        w.Blob = class { constructor(parts) { this.parts = parts; } };
        w.URL.createObjectURL = blob => { const url = 'blob:test-' + blobs.size; blobs.set(url, blob.parts.join('')); return url; };
        w.URL.revokeObjectURL = () => {};
        const anchorClick = w.HTMLAnchorElement.prototype.click;
        w.HTMLAnchorElement.prototype.click = function () {
          if (this.hasAttribute('download')) { out.downloads.push({ name: this.download, text: blobs.get(this.href) }); return; }
          anchorClick.call(this);
        };
        // JSDOM has no top layer. This shim observes the native-dialog API contract;
        // focus trapping and actual browser layout are also checked in browser QA.
        w.HTMLDialogElement.prototype.showModal = function () { out.modalCalls++; this.setAttribute('open', ''); };
        w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); this.dispatchEvent(new w.Event('close')); };
        w.fetch = (...args) => { out.network.push(args); return Promise.reject(new Error('No network expected in video composer')); };
        w.XMLHttpRequest.prototype.open = function (...args) { out.network.push(args); };
        w.XMLHttpRequest.prototype.send = function () {};
      }
    });
    out.w = out.dom.window; out.d = out.w.document;
    out.q = selector => out.d.querySelector(selector);
    out.all = selector => Array.from(out.d.querySelectorAll(selector));
    out.nav = async hash => { out.w.location.hash = hash; out.w.dispatchEvent(new out.w.Event('hashchange')); await wait(8); };
    out.fill = (selector, value) => { const el = out.q(selector); assert(el, 'Missing input ' + selector); el.value = value; el.dispatchEvent(new out.w.Event('input', { bubbles: true })); return el; };
    out.key = (el, key, extra = {}) => el.dispatchEvent(new out.w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));
    out.pointer = (el, type, x, y, extra = {}) => {
      const event = new out.w.MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, ...extra });
      Object.defineProperty(event, 'pointerId', { value: 7 });
      Object.defineProperty(event, 'isPrimary', { value: true });
      el.dispatchEvent(event);
    };
    return out;
  }
  const slots = ['主体', '场景', '动作'];
  const types = { ai: 'AI 视频', hybrid: 'AI 混合制作', animation: '动画参考' };
  const captureLabels = { 'official-still': '官方剧照', 'video-frame': '视频截帧' };
  const ids = s => s.all('.video-card').map(a => decodeURIComponent(a.hash.slice(8).split('?')[0])).sort();
  const route = item => '#/video/' + encodeURIComponent(item.id);
  const setSlots = (s, suffix = '') => slots.forEach((slot, i) => s.fill('[data-video-slot="' + slot + '"]', ['一只紫色纸鹤', '月光下的玻璃温室', '抬头后缓慢展开翅膀'][i] + suffix));
  const checkFrame = (s, item, index) => {
    const f = item.frames[index];
    assert(s.q('[data-video-main]').src.endsWith('/' + f.src));
    assert.strictEqual(s.q('[data-video-main]').alt, f.caption);
    assert.strictEqual(s.q('[data-video-caption]').textContent, f.time + ' · ' + f.caption);
    assert.strictEqual(s.q('[data-video-credit]').textContent, f.credit);
    assert.strictEqual(s.q('[data-video-frame="' + index + '"]').getAttribute('aria-pressed'), 'true');
  };
  const groups = {};
  groups['preview-source-evidence'] = async s => {
    assert(!s.w.HF_VIDEO_STYLES.some(item => item.id === 'video-eastern-myth-cinema'));
    for (const item of s.w.HF_VIDEO_STYLES) {
      const p = item.preview, record = manifest.entries.find(r => r.id === item.id);
      assert(p && ['youtube', 'vimeo', 'native'].includes(p.provider), item.id + ' needs a playable source');
      assert(/^https:\/\//.test(p.url) && p.label);
      assert.deepStrictEqual(JSON.parse(JSON.stringify(p)), record.preview);
      assert(record.playbackEvidence.evidence && record.playbackEvidence.checkedAt);
      if (p.provider === 'youtube') assert(/^[\w-]{11}$/.test(p.videoId));
      if (p.provider === 'vimeo') assert(/^\d{6,12}$/.test(p.videoId));
      if (p.provider === 'native') assert(/^https:\/\/.+\.(?:mp4|webm)(?:[?#]|$)/i.test(p.src));
    }
    await s.nav('#/video?q=' + encodeURIComponent('东方神话电影'));
    assert.strictEqual(s.all('.video-card').length, 0);
    await s.nav('#/video/video-eastern-myth-cinema');
    assert(s.q('#view h1').textContent.includes('没有找到'));
  };
  groups['preview-lazy-load-and-provider-controls'] = async s => {
    assert.strictEqual(s.all('iframe, video').length, 0, 'List does not preload forty players');
    for (const item of s.w.HF_VIDEO_STYLES) {
      await s.nav(route(item) + '?play=1');
      assert.strictEqual(s.all('iframe, video').length, 0, 'Pasted link waits for user gesture');
      const trigger = s.q('[data-video-action="play"]'); assert(trigger && trigger.tagName === 'BUTTON');
      assert(s.q('.video-player__links a').href === item.preview.url);
      trigger.click();
      const media = s.q('[data-video-media]'); assert(media, item.id + ' starts player');
      const src = new URL(media.src);
      if (item.preview.provider === 'native') {
        assert.strictEqual(media.tagName, 'VIDEO'); assert(media.controls && media.muted && media.playsInline);
        assert.strictEqual(media.preload, 'none');
        assert(media.src.startsWith(item.preview.src));
        if (item.preview.start) assert.strictEqual(src.hash, '#t=' + item.preview.start);
      } else {
        assert.strictEqual(media.tagName, 'IFRAME'); assert(media.title.includes(item.name));
        assert(media.allow.includes('autoplay') && media.hasAttribute('allowfullscreen'));
        assert.strictEqual(media.referrerPolicy, 'strict-origin-when-cross-origin');
        assert.strictEqual(src.searchParams.get('autoplay'), '1');
        assert.strictEqual(src.hostname, item.preview.provider === 'youtube' ? 'www.youtube-nocookie.com' : 'player.vimeo.com');
        assert(src.pathname.endsWith('/' + item.preview.videoId));
        if (item.preview.hash) assert.strictEqual(src.searchParams.get('h'), item.preview.hash);
      }
      s.q('[data-video-action="stop-play"]').click();
      assert(!s.q('[data-video-media]'));
    }
  };
  groups['preview-card-gesture-and-private-input'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0];
    s.q('.video-card').click(); await wait(15);
    assert.strictEqual(s.q('[data-video-id]').getAttribute('data-video-id'), item.id);
    const media = s.q('[data-video-media]'); assert(media, 'One card click opens and starts playback');
    const src = media.src;
    s.fill('[data-video-slot="主体"]', 'PRIVATE-PLAYER-DRAFT-3752');
    assert.strictEqual(media.src, src, 'Draft never becomes a player URL parameter');
    assert(!src.includes('PRIVATE-PLAYER-DRAFT-3752'));
    assert.strictEqual(s.network.length, 0, 'No composer requests');
    await s.nav('#/video'); await s.nav(route(item) + '?play=1');
    assert(!s.q('[data-video-media]'), 'Used playback intent does not survive navigation');
  };
  groups['preview-retry-stop-and-cleanup'] = async s => {
    const sample = ['youtube', 'vimeo', 'native'].map(provider => s.w.HF_VIDEO_STYLES.find(i => i.preview.provider === provider));
    for (const item of sample) {
      await s.nav(route(item)); s.q('[data-video-action="play"]').click();
      let media = s.q('[data-video-media]');
      media.dispatchEvent(new s.w.Event('error'));
      assert(s.q('[data-video-player-status]').textContent.includes('无法加载'));
      assert(s.q('.video-player__links a[href]'), 'Source fallback stays accessible');
      s.q('[data-video-action="retry-play"]').click();
      assert(!media.isConnected); assert.notStrictEqual(s.q('[data-video-media]'), media);
      media = s.q('[data-video-media]');
      s.q('[data-video-action="stop-play"]').click();
      assert(!media.isConnected); assert.strictEqual(s.d.activeElement, s.q('[data-video-action="play"]'));
      s.q('[data-video-action="play"]').click(); media = s.q('[data-video-media]');
      await s.nav('#/video');
      assert(!media.isConnected); assert(!s.q('[data-video-media]'));
      if (item.preview.provider === 'native') {
        assert(!media.getAttribute('src'), 'Detached native video releases its network source');
        assert(s.mediaCalls.some(call => call[0] === 'pause' && call[1] === media));
      }
      await s.nav(route(item)); s.q('[data-video-action="play"]').click();
      media = s.q('[data-video-media]');
      s.w.dispatchEvent(new s.w.Event('pagehide'));
      assert(!s.q('[data-video-media]') && !media.isConnected, 'Browser page exit releases media');
      assert(s.q('[data-video-action="play"]'), 'Back-forward cache can offer a fresh play action');
    }
  };
  groups['preview-invalid-source-fallback'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0];
    for (const preview of [
      {provider: 'native', src: 'javascript:alert(1)', url: 'javascript:alert(2)'},
      {provider: 'native', src: 'http://unsafe.test/movie.mp4', url: 'data:text/html,bad'},
      {provider: 'native', src: 'https://user:password@example.test/movie.mp4'},
      {provider: 'youtube', videoId: '../bad?x=1'},
      {provider: 'vimeo', videoId: '1195915021', hash: 'x&autoplay=0'},
      {provider: 'untrusted', src: 'https://example.test/player'}
    ]) {
      item.preview = preview; await s.nav(route(item));
      assert(!s.q('[data-video-action="play"]'), 'Unsafe preview becomes a source link');
      assert(!s.q('iframe, video'));
      assert.strictEqual(s.q('.video-player__poster').tagName, 'A');
      assert.strictEqual(s.q('.video-player__poster').href, item.reference.url);
    }
  };
  groups['catalog-evidence-and-assets'] = async s => {
    const entries = s.w.HF_VIDEO_STYLES;
    assert.strictEqual(entries.length, 40, 'Forty reviewed video styles are shipped');
    assert.strictEqual(new Set(entries.map(i => i.id)).size, 40);
    assert.strictEqual(manifest.entries.length, 40);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(manifest.checkedAt));
    for (const item of entries) {
      assert(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id));
      assert(item.name && item.summary && item.negativePrompt);
      assert(item.styleNotes.length >= 3 && item.styleNotes.length <= 4, 'Concise visual and motion analysis');
      assert(item.styleNotes.every(n => n.label && n.text));
      assert(item.tags.length >= 1 && Object.hasOwn(types, item.reference.type));
      assert(item.promptTemplate.length >= 600, item.id + ' needs a developed style prompt');
      assert(!/\{(?:主体|场景|动作)\}/.test(item.promptTemplate), item.id + ' has unresolved required content');
      assert(!/\d+(?:\.\d+)?\s*(?:秒|seconds?|fps|帧每秒|[kＫ]|p分辨率)|\d+\s*[:：×x]\s*\d+|[一二两三四五六七八九十]+\s*秒/i.test(item.promptTemplate), item.id + ' fixes duration, frame rate or aspect ratio');
      const record = manifest.entries.find(r => r.id === item.id);
      assert(record, item.id + ' missing source evidence');
      assert.strictEqual(record.rights.status, 'copyright-retained-editorial-reference');
      assert.strictEqual(record.reference.url, item.reference.url);
      assert(/^https:\/\//.test(item.reference.url));
      assert(record.sources.length > 0);
      assert(item.frames.length >= 2);
      for (const frame of item.frames) {
        assert(frame.caption && frame.credit && frame.time);
        assert(Object.hasOwn(captureLabels, frame.captureKind));
        assert(/^assets\/img\/video\/[a-z0-9-]+\/[a-z0-9.-]+$/.test(frame.src));
        const image = path.join(root, frame.src);
        assert(fs.existsSync(image), 'Missing local frame ' + frame.src);
        const evidence = record.frames.find(f => f.src === frame.src);
        assert(evidence, 'Unrecorded frame ' + frame.src);
        assert.strictEqual(evidence.captureKind, frame.captureKind);
        assert(/^https:\/\//.test(evidence.mediaUrl));
        assert.strictEqual(evidence.sha256, crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex'));
        if (frame.captureKind === 'official-still') assert(!/^\d{2}:\d{2}/.test(frame.time), 'Official still must not invent a timestamp');
      }
    }
  };
  groups['independent-routes-and-navigation'] = async s => {
    assert.strictEqual(s.all('.video-card').length, 40);
    assert.strictEqual(s.q('.nav__link.is-active').textContent, '视频风格');
    const videoIds = s.w.HF_VIDEO_STYLES.map(i => i.id);
    const oldIds = s.w.eval('STYLES.map(function (item) { return item.id; })');
    assert(videoIds.every(id => !oldIds.includes(id)), 'Video collection stays outside image/text data');
    for (const item of s.w.HF_VIDEO_STYLES) {
      await s.nav(route(item));
      assert.strictEqual(s.q('[data-video-id]').getAttribute('data-video-id'), item.id);
      assert.strictEqual(s.q('#view h1').textContent, item.name);
      assert.strictEqual(s.q('.nav__link.is-active').textContent, '视频风格');
    }
    await s.nav('#/'); assert(!s.q('[data-video-page]'));
    await s.nav('#/library?track=text'); assert(!s.q('[data-video-page]'));
    await s.nav('#/video'); assert.strictEqual(s.all('.video-card').length, 40);
  };
  groups['search-tag-and-return-context'] = async s => {
    const data = s.w.HF_VIDEO_STYLES;
    for (const item of data) {
      await s.nav('#/video?q=' + encodeURIComponent(item.name));
      assert(ids(s).includes(item.id), 'Full title finds ' + item.id);
      await s.nav('#/video?q=' + encodeURIComponent(item.name + ' nonexistent-5823'));
      assert.strictEqual(s.all('.video-card').length, 0, 'All search terms are required');
      assert(s.q('.video-empty'));
      const withoutAliases = [item.name, item.latin || '', item.summary, item.tags.join(' '), item.reference.title, item.reference.creator, item.bestFor || ''].join(' ').toLowerCase();
      const alias = (item.keywords || []).find(keyword => !/\s/.test(keyword) && !withoutAliases.includes(keyword.toLowerCase()));
      assert(alias, item.id + ' needs a discoverable keyword alias');
      await s.nav('#/video?q=' + encodeURIComponent(alias));
      assert(ids(s).includes(item.id), 'Keyword alias finds ' + item.id);
    }
    for (const tag of new Set(data.flatMap(i => i.tags))) {
      await s.nav('#/video?tag=' + encodeURIComponent(tag));
      assert.deepStrictEqual(ids(s), Array.from(data.filter(i => i.tags.includes(tag)), i => i.id).sort());
    }
    const item = data[0], tag = item.tags[0];
    await s.nav('#/video?tag=' + encodeURIComponent(tag));
    s.fill('#video-search', item.name);
    s.q('[data-video-search]').dispatchEvent(new s.w.Event('submit', { bubbles: true, cancelable: true })); await wait(8);
    const query = new URLSearchParams(s.w.location.hash.split('?')[1]);
    assert.strictEqual(query.get('q'), item.name); assert.strictEqual(query.get('tag'), tag);
    assert(ids(s).includes(item.id));
    const listHash = s.w.location.hash;
    await s.nav(route(item)); assert.strictEqual(s.q('.video-back').hash, listHash);
    s.q('.video-back').click(); await wait(12); assert.strictEqual(s.w.location.hash, listHash);
  };
  groups['prepared-copy-and-txt'] = async s => {
    for (const item of s.w.HF_VIDEO_STYLES) {
      await s.nav(route(item)); setSlots(s, item.id);
      const visible = s.q('[data-video-prompt]').textContent;
      assert(!/\{(?:主体|场景|动作)\}/.test(visible));
      for (const slot of slots) assert(visible.includes(s.q('[data-video-slot="' + slot + '"]').value));
      assert(!visible.includes(item.negativePrompt));
      assert(visible.includes(item.promptTemplate));
      s.q('[data-video-action="copy"]').click(); await wait(1);
      assert.strictEqual(s.copied, visible, item.id + ' copy must match prepared preview');
      s.q('[data-video-action="download"]').click();
      const download = s.downloads.at(-1);
      assert.strictEqual(download.name, item.id + '-video-prompt.txt');
      assert(download.text.includes(visible), item.id + ' TXT must contain prepared prompt');
      assert(download.text.includes(item.reference.url)); assert(download.text.includes('本站原创'));
      assert(!download.text.includes('data:image/'), 'Reference images are not exported');
    }
  };
  groups['ready-to-copy-style-and-optional-content'] = async s => {
    for (const item of s.w.HF_VIDEO_STYLES) {
      await s.nav(route(item));
      assert.strictEqual(s.q('[data-video-prompt]').textContent, item.promptTemplate);
      assert(!s.q('.video-customize').open, 'Content fields start optional and collapsed');
      s.q('[data-video-action="copy"]').click(); await wait(1);
      assert.strictEqual(s.copied, item.promptTemplate, 'Style is usable without filling fields');
      s.q('[data-video-action="download"]').click();
      assert(s.downloads.at(-1).text.includes(item.promptTemplate));
      assert(!s.downloads.at(-1).text.includes(item.negativePrompt));
      s.fill('[data-video-slot="主体"]', '  我的陶瓷飞船  ');
      const partial = s.q('[data-video-prompt]').textContent;
      assert(partial.startsWith('【我的内容】\n主体：我的陶瓷飞船\n\n'));
      assert(partial.endsWith(item.promptTemplate));
      assert(!/场景：|动作：/.test(partial.split('\n\n')[0]), 'Unused content fields are omitted');
      await s.nav('#/video'); await s.nav(route(item));
      assert(s.q('.video-customize').open, 'Existing draft stays visible on return');
    }
  };
  groups['separate-negative-and-expandable-prompt'] = async s => {
    for (const item of s.w.HF_VIDEO_STYLES) {
      await s.nav(route(item));
      const prompt = s.q('[data-video-prompt]'), expand = s.q('[data-video-action="expand-prompt"]');
      assert.strictEqual(expand.getAttribute('aria-controls'), prompt.id);
      assert.strictEqual(expand.getAttribute('aria-expanded'), 'false');
      assert(!prompt.classList.contains('is-expanded'));
      expand.click();
      assert.strictEqual(expand.getAttribute('aria-expanded'), 'true');
      assert(prompt.classList.contains('is-expanded'));
      expand.click();
      assert.strictEqual(expand.getAttribute('aria-expanded'), 'false');
      assert(!prompt.classList.contains('is-expanded'));
      assert(s.q('.video-avoid').textContent.includes(item.negativePrompt));
      s.q('[data-video-action="copy-negative"]').click(); await wait(1);
      assert.strictEqual(s.copied, item.negativePrompt);
      s.q('[data-video-action="copy"]').click(); await wait(1);
      assert.strictEqual(s.copied, item.promptTemplate, 'Negative copy never changes main prompt');
    }
  };
  groups['input-escaping'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0]; await s.nav(route(item));
    const hostile = '</textarea><img src=x onerror="window.VIDEO_INJECTED=1"><script>window.VIDEO_INJECTED=2</script> & "quoted"';
    s.fill('[data-video-slot="主体"]', hostile);
    assert(s.q('[data-video-prompt]').textContent.includes(hostile));
    assert(!s.q('[data-video-prompt] img, [data-video-prompt] script'));
    await s.nav('#/video'); await s.nav(route(item));
    assert.strictEqual(s.q('[data-video-slot="主体"]').value, hostile);
    assert(!s.q('.video-fields img, .video-fields script'));
    assert.strictEqual(s.w.VIDEO_INJECTED, undefined);
  };
  groups['memory-only-private-drafts'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0]; await s.nav(route(item));
    const beforeLocal = JSON.stringify(s.w.localStorage), beforeSession = JSON.stringify(s.w.sessionStorage);
    const secret = 'PRIVATE-VIDEO-DRAFT-7281';
    s.fill('[data-video-slot="主体"]', secret);
    await s.nav('#/video'); await s.nav(route(item));
    assert.strictEqual(s.q('[data-video-slot="主体"]').value, secret, 'Draft survives internal navigation');
    assert.strictEqual(JSON.stringify(s.w.localStorage), beforeLocal, 'No localStorage persistence');
    assert.strictEqual(JSON.stringify(s.w.sessionStorage), beforeSession, 'No sessionStorage persistence');
    assert.strictEqual(s.network.length, 0, 'No automatic draft uploads');
    const fresh = session();
    try { await fresh.nav(route(item)); assert.strictEqual(fresh.q('[data-video-slot="主体"]').value, '', 'New document starts empty'); }
    finally { fresh.w.close(); }
  };
  groups['reset-and-card-isolation'] = async s => {
    const [first, second] = s.w.HF_VIDEO_STYLES;
    await s.nav(route(first)); setSlots(s);
    await s.nav(route(second)); assert(slots.every(slot => s.q('[data-video-slot="' + slot + '"]').value === ''));
    setSlots(s, '-other');
    await s.nav(route(first)); s.q('[data-video-action="reset"]').click();
    assert(slots.every(slot => s.q('[data-video-slot="' + slot + '"]').value === ''));
    assert.strictEqual(s.q('[data-video-prompt]').textContent, first.promptTemplate);
    await s.nav(route(second)); assert(s.q('[data-video-slot="主体"]').value.endsWith('-other'));
    await s.nav(route(first)); assert.strictEqual(s.q('[data-video-slot="主体"]').value, '');
  };
  groups['gallery-arrows-keyboard-and-thumbnails'] = async s => {
    for (const item of s.w.HF_VIDEO_STYLES) {
      await s.nav(route(item)); checkFrame(s, item, 0);
      s.q('[data-video-action="next"]').click(); checkFrame(s, item, 1);
      s.q('[data-video-action="prev"]').click(); checkFrame(s, item, 0);
      s.key(s.q('.video-frame'), 'ArrowLeft'); checkFrame(s, item, item.frames.length - 1);
      s.key(s.q('.video-frame'), 'ArrowRight'); checkFrame(s, item, 0);
      s.q('[data-video-frame="1"]').click(); checkFrame(s, item, 1);
      s.key(s.q('[data-video-slot="主体"]'), 'ArrowRight'); checkFrame(s, item, 1);
      s.key(s.q('.video-frame'), 'ArrowRight', { ctrlKey: true }); checkFrame(s, item, 1);
    }
  };
  groups['gallery-gesture-and-click-suppression'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0]; await s.nav(route(item)); const surface = s.q('.video-frame');
    s.pointer(surface, 'pointerdown', 180, 50); s.pointer(surface, 'pointermove', 80, 50); s.pointer(surface, 'pointerup', 80, 50); checkFrame(s, item, 1);
    surface.dispatchEvent(new s.w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    assert(!s.q('.video-viewer'), 'Drag must not open zoom');
    s.pointer(surface, 'pointerdown', 80, 50); s.pointer(surface, 'pointerup', 180, 50); checkFrame(s, item, 0);
    s.pointer(surface, 'pointerdown', 100, 50); s.pointer(surface, 'pointerup', 130, 190); checkFrame(s, item, 0);
    s.pointer(surface, 'pointerdown', 180, 50); s.pointer(surface, 'pointercancel', 100, 50); s.pointer(surface, 'pointerup', 20, 50); checkFrame(s, item, 0);
  };
  groups['attribution-type-and-capture-labels'] = async s => {
    const kinds = new Set(), productionTypes = new Set();
    for (const item of s.w.HF_VIDEO_STYLES) {
      productionTypes.add(item.reference.type); await s.nav(route(item));
      const provenance = s.q('.video-provenance').textContent;
      assert(provenance.includes(item.reference.creator)); assert(provenance.includes(types[item.reference.type]));
      assert(provenance.includes(item.reference.note)); assert(provenance.includes(item.reference.recognition));
      assert(provenance.includes('并非作者制作参数或原始提示词')); assert(provenance.includes('未由本站逐条生成验证'));
      assert(provenance.includes('不随本站代码按 MIT 授权'));
      assert.strictEqual(s.q('.video-source-link').href, item.reference.url);
      for (let i = 0; i < item.frames.length; i++) {
        const f = item.frames[i]; kinds.add(f.captureKind); s.q('[data-video-frame="' + i + '"]').click();
        assert(s.q('[data-video-frame-label]').textContent.startsWith(captureLabels[f.captureKind]));
        assert.strictEqual(s.q('[data-video-credit]').textContent, f.credit);
      }
    }
    assert(kinds.has('official-still') && kinds.has('video-frame'));
    assert(productionTypes.has('animation') && productionTypes.has('hybrid') && productionTypes.has('ai'));
  };
  groups['dialog-current-frame-and-focus-return'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0]; await s.nav(route(item));
    s.q('[data-video-frame="1"]').click(); const trigger = s.q('.video-frame'); trigger.focus();
    s.d.body.style.overflow = 'scroll'; trigger.click();
    const dialog = s.q('dialog.video-viewer'); assert(dialog && dialog.open); assert.strictEqual(s.modalCalls, 1);
    assert.strictEqual(dialog.getAttribute('aria-modal'), 'true');
    assert(s.q('[data-video-viewer-image]').src.endsWith('/' + item.frames[1].src));
    assert.strictEqual(s.q('[data-video-viewer-image]').alt, item.frames[1].caption);
    assert.strictEqual(s.d.body.style.overflow, 'hidden');
    const close = s.q('[data-video-viewer-action="close"]'); assert.strictEqual(s.d.activeElement, close);
    s.key(close, 'Tab', { shiftKey: true }); assert.strictEqual(s.d.activeElement, Array.from(dialog.querySelectorAll('button')).at(-1));
    s.key(s.d.activeElement, 'Tab'); assert.strictEqual(s.d.activeElement, close);
    close.click(); assert(!s.q('.video-viewer')); assert.strictEqual(s.d.activeElement, trigger);
    assert.strictEqual(s.d.body.style.overflow, 'scroll');
  };
  groups['dialog-navigation-cancel-and-cleanup'] = async s => {
    const item = s.w.HF_VIDEO_STYLES[0]; await s.nav(route(item)); s.q('.video-frame').click();
    s.q('[data-video-viewer-action="next"]').click(); checkFrame(s, item, 1);
    assert(s.q('[data-video-viewer-image]').src.endsWith('/' + item.frames[1].src));
    assert(s.q('[data-video-viewer-caption]').textContent.includes(item.frames[1].caption));
    s.key(s.q('.video-viewer'), 'ArrowLeft'); checkFrame(s, item, 0);
    const image = s.q('[data-video-viewer-image]');
    s.pointer(image, 'pointerdown', 180, 50); s.pointer(image, 'pointerup', 80, 50); checkFrame(s, item, 1);
    assert(s.q('[data-video-viewer-image]').src.endsWith('/' + item.frames[1].src));
    s.key(s.q('.video-viewer'), 'Escape'); assert(!s.q('.video-viewer'));
    s.q('.video-frame').click(); s.q('.video-viewer').dispatchEvent(new s.w.Event('cancel', { cancelable: true })); assert(!s.q('.video-viewer'));
    s.q('.video-frame').click(); await s.nav('#/video'); assert(!s.q('.video-viewer')); assert.notStrictEqual(s.d.body.style.overflow, 'hidden');
    await s.nav(route(item)); s.q('[data-video-action="next"]').click(); checkFrame(s, item, 1);
  };
  groups['global-palette-click-and-enter'] = async s => {
    for (const [index, item] of Array.from(s.w.HF_VIDEO_STYLES).entries()) {
      await s.nav('#/video'); s.q('[data-action="palette-open"]').click();
      assert(s.q('#palette-list a[href="#/video"]'), 'Empty global search exposes the independent collection');
      const input = s.fill('#palette-input', item.name);
      const result = s.q('#palette-list a[href="' + route(item) + '"]'); assert(result, 'Palette finds ' + item.id);
      assert(result.textContent.includes('视频风格'));
      if (index % 2 === 0) result.click();
      else {
        const results = s.all('#palette-list [data-action="palette-go"]'), cursor = results.indexOf(result);
        for (let i = 0; i < cursor; i++) s.key(input, 'ArrowDown');
        s.key(input, 'Enter');
      }
      await wait(15); assert.strictEqual(s.q('[data-video-id]').getAttribute('data-video-id'), item.id);
      assert(!s.q('#palette').classList.contains('is-open'));
    }
  };
  groups['missing-id-and-malformed-route'] = async s => {
    for (const hash of ['#/video/not-a-video-style', '#/video/%E0%A4%A']) {
      await s.nav(hash); assert(s.q('#view h1').textContent.includes('没有找到这个视频风格'));
      assert(s.q('#view a[href="#/video"]')); assert(!s.q('[data-video-action="copy"]'));
    }
  };
  groups['no-video-runtime-errors'] = async s => {
    for (const item of s.w.HF_VIDEO_STYLES) { await s.nav(route(item)); s.q('.video-frame').click(); s.key(s.q('.video-viewer'), 'Escape'); }
    await s.nav('#/video'); await s.nav('#/'); await s.nav('#/video');
    assert.deepStrictEqual(s.errors, []);
  };
  if (onlyGroup) assert(groups[onlyGroup], 'Unknown video group: ' + onlyGroup);
  let passed = 0, failed = 0;
  for (const [name, check] of Object.entries(groups)) {
    if (onlyGroup && name !== onlyGroup) continue;
    const s = session();
    try { await wait(10); await check(s); passed++; console.log('PASS ' + name); }
    catch (error) { failed++; console.log('FAIL ' + name + ': ' + error.message); }
    finally { s.w.close(); }
  }
  console.log(`${passed}/${passed + failed} video regression groups passed`);
  return failed ? 1 : 0;
}

module.exports = { mutations, run };
if (require.main === module) run(process.argv[2], process.argv[3], process.argv[4]).then(code => { process.exitCode = code; }).catch(error => { console.error(error.stack); process.exitCode = 1; });
