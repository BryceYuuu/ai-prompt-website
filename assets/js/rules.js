/* ==========================================================================
   书桐 SHUTONG — 提示词卡校验规则（单一事实来源）
   浏览器与 Node（schema/validate.mjs）共用同一份规则。
   schema/style-card.schema.json 是它的声明式对应物，
   两者的一致性由 hf-test.js 断言保证。

   两种卡：
     image  图片提示词 —— edit（图生图）或 create（文生图）使用顶层 prompt；
                        历史 both 保留本地和云端两条轨道
     其余   文本提示词 —— 必须有 prompt 原文，track 固定为 'text'，
                        不许有轨道
   ========================================================================== */

var HFRules = (function () {
  'use strict';

  var GENERATORS = [
    'neon', 'film', 'hardedge', 'plush', 'etch', 'candy', 'ink', 'glass', 'riso',
    'mini', 'darkroom', 'sketch', 'chrome', 'pixel', 'soft', 'wire', 'tropic', 'blues'
  ];

  /* 顶层分类。与 data.js 的 TAXONOMY.categories 保持一致，
     由 hf-test.js 的防漂移断言守着。 */
  var CATEGORIES = ['image', 'write', 'code', 'analyze', 'learn', 'business', 'life'];
  var TEXT_CATEGORIES = ['write', 'code', 'analyze', 'learn', 'business', 'life'];

  var LICENSES = [
    { key: 'MIT', label: 'MIT（保留版权与许可声明）' },
    { key: 'CC-BY-4.0', label: '署名共享（允许商用，需署名）' },
    { key: 'CC0-1.0', label: '公共领域（放弃所有权利）' },
    { key: 'ALL-RIGHTS-RESERVED', label: '保留所有权利（仅平台内使用）' },
    { key: 'CUSTOM', label: '自定义（需在说明中写明）' }
  ];

  /* 已知的 IP 风险词。正向命中即拦截（policy），不是警告。
     正式运营时必须持续维护，尤其要补上「在世艺术家姓名」名单。
     下面只放商标 / 作品集类示例，中英双语。 */
  var DENYLIST = [
    'disney', 'pixar', 'marvel', 'dc comics', 'nintendo', 'pokemon',
    'studio ghibli', 'ghibli', 'lego', 'hello kitty', 'sanrio',
    'harry potter', 'star wars', 'mickey', 'batman', 'spider-man', 'elsa',
    '迪士尼', '皮克斯', '漫威', '任天堂', '宝可梦', '吉卜力', '乐高',
    '米老鼠', '哈利波特', '星球大战', '蝙蝠侠', '蜘蛛侠', '奥特曼', '高达'
  ];

  var LIMITS = {
    id:      { min: 3, max: 60, re: /^[a-z0-9]+(-[a-z0-9]+)*$/ },
    name:    { min: 2, max: 20 },
    latin:   { min: 2, max: 40 },
    tagline: { min: 8, max: 60 },
    version: { re: /^\d+\.\d+$/ },
    author:  { min: 1, max: 30 },
    prompt:  { min: 40, max: 8000 },
    neg:     { min: 1, max: 500 },
    refs:    { min: 1, max: 300 },
    steps:   { min: 1, max: 150 },
    cfg:     { min: 0, max: 30 },
    seed:    { min: 0, max: 4294967295 },
    weight:  { min: 0, max: 1.5 },
    uses:    { min: 1, max: 3 },
    moods:   { min: 1, max: 3 },
    loras:   { min: 0, max: 6 },
    models:  { min: 1, max: 6 },
    banned:  { min: 1, max: 12 },
    coverW:  { min: 200 },
    coverH:  { min: 200 }
  };


  /* 描述视觉特征必须用这些维度的词，而不是「某某人的风格」 */
  var VISUAL_WORDS = /色|光|影|质感|颗粒|饱和|对比|构图|线条|材质|纸|墨|胶片|镜头|反射|渐变|留白|噪点|纹理|透视|比例|景深|冷|暖|灰|暗|亮|锐|柔|边|层|几何|网格|笔触|排线|高光|暗部|色调/;
  var IP_PATTERN = /in the style of|style of [A-Z][a-z]+|风格 of/i;

  /* ------------------------------------------------------------ utils -- */

  function isStr(v) { return typeof v === 'string'; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function isInt(v) { return isNum(v) && Math.floor(v) === v; }
  function filled(v) { return isStr(v) && v.trim().length > 0; }

  function hexOk(c) { return isStr(c) && /^#[0-9a-fA-F]{6}$/.test(c); }

  /* Only discount exact DENYLIST items in a closed, explicitly negative list.
     This is a scan-only copy: author text is never changed. Requiring a sentence
     boundary, colon, enumeration and final period avoids treating a loose
     "avoid" phrase as permission. Other fields and positive uses stay scanned. */
  function withoutExplicitNegativeItems(prompt) {
    if (!isStr(prompt)) return prompt;
    return prompt.replace(/(^|[。！？\r\n])([ \t\u3000]*)(严格避免|嚴格避免)([：:])([^。！？\r\n]+)(?=。)/g,
      function (whole, boundary, space, label, colon, body) {
        var items = body.split('、');
        if (items.length < 2 || items.some(function (item) { return !item.trim(); })) return whole;
        return boundary + space + label + colon + items.map(function (item) {
          return DENYLIST.indexOf(item.trim().toLowerCase()) >= 0 ? '' : item;
        }).join('、');
      });
  }

  function textOf(card, forDenylist) {
    var parts = [card.name, card.latin, card.tagline, card.author,
      forDenylist ? withoutExplicitNegativeItems(card.prompt) : card.prompt];
    if (card.local) parts.push(card.local.prompt, card.local.neg, card.local.base,
      (card.local.loras || []).map(function (l) { return l && l.name; }).join(' '));
    if (card.cloud) parts.push(card.cloud.prompt, card.cloud.refs, (card.cloud.models || []).join(' '));
    if (card.cover) parts.push(card.cover.title, card.cover.creator);
    /* 作者说明同样要过红线，否则可以在正文里绕过去 */
    (card.guide || []).forEach(function (b) {
      if (!b) return;
      if (typeof b.v === 'string') parts.push(b.v);
      else if (Array.isArray(b.v)) parts.push(b.v.join(' '));
      else if (b.v && typeof b.v === 'object') parts.push(b.v.cap, b.v.credit);
    });
    /* 示例输出也是页面正文（data-samples.js），同样要过红线。
       漏掉它，示例就成了绕过 DENYLIST 的后门。 */
    var samples = (typeof HF_SAMPLES === 'object' && HF_SAMPLES) || {};
    if (isStr(samples[card.id])) parts.push(samples[card.id]);
    return parts.filter(isStr).join(' \n ').toLowerCase();
  }

  /* --------------------------------------------------------- validate -- */

  function checkCard(card, opts) {
    opts = opts || {};
    var tax = opts.taxonomy || { uses: [], moods: [] };
    var useKeys = tax.uses.map(function (u) { return u.key; });
    var moodKeys = tax.moods.map(function (m) { return m.key; });
    var errs = [], pol = [], warns = [];
    var E = function (p, m) { errs.push({ path: p, msg: m }); };
    var P = function (p, m) { pol.push({ path: p, msg: m }); };
    var W = function (p, m) { warns.push({ path: p, msg: m }); };

    if (!card || typeof card !== 'object') {
      E('$', '不是一个对象');
      return { errors: errs, policy: pol, warnings: warns };
    }

    /* --- 标识 --- */
    if (!filled(card.id)) E('id', '必填');
    else {
      if (!LIMITS.id.re.test(card.id)) E('id', '只能用小写字母、数字和连字符，且不能以连字符开头结尾');
      else if (card.id.length < LIMITS.id.min || card.id.length > LIMITS.id.max)
        E('id', '长度需在 ' + LIMITS.id.min + '–' + LIMITS.id.max + ' 之间');
    }

    if (!filled(card.name)) E('name', '必填');
    else if (card.name.length < LIMITS.name.min || card.name.length > LIMITS.name.max)
      E('name', '长度需在 ' + LIMITS.name.min + '–' + LIMITS.name.max + ' 个字符之间');

    if (!filled(card.latin)) E('latin', '必填');
    else if (card.latin.length < LIMITS.latin.min || card.latin.length > LIMITS.latin.max)
      E('latin', '长度需在 ' + LIMITS.latin.min + '–' + LIMITS.latin.max + ' 之间');

    if (!filled(card.tagline)) E('tagline', '必填');
    else if (card.tagline.length < LIMITS.tagline.min || card.tagline.length > LIMITS.tagline.max)
      E('tagline', '长度需在 ' + LIMITS.tagline.min + '–' + LIMITS.tagline.max + ' 个字符之间');

    /* --- 顶层分类 --- */
    var isImage = card.category === 'image';
    if (!filled(card.category)) E('category', '必填：决定这张卡走双轨还是单条提示词');
    else if (CATEGORIES.indexOf(card.category) < 0)
      E('category', '「' + card.category + '」不是受支持的分类');
    else if (isImage && !VISUAL_WORDS.test(card.tagline || ''))
      W('tagline', '没读到任何视觉描述词（颜色 / 光线 / 质感 / 构图…），用户无法判断这是什么风格');

    /* --- 分类 --- */
    ['uses', 'moods'].forEach(function (field) {
      var arr = card[field];
      var allowed = field === 'uses' ? useKeys : moodKeys;
      var lim = LIMITS[field];
      if (!Array.isArray(arr) || !arr.length) { E(field, '至少选 1 个'); return; }
      if (arr.length > lim.max) E(field, '最多选 ' + lim.max + ' 个');
      if (new Set(arr).size !== arr.length) E(field, '不能重复');
      arr.forEach(function (v) {
        if (allowed.indexOf(v) < 0) E(field, '「' + v + '」不在分类表里，需先扩充 TAXONOMY');
      });
    });

    /* --- 轨道：由数据推导，不许手填 --- */
    var hasLocal = !!card.local, hasCloud = !!card.cloud;
    if (isImage && (card.track === 'edit' || card.track === 'create')) {
      if (!filled(card.prompt) || card.prompt.length < LIMITS.prompt.min) E('prompt', '图片转换必须提供完整提示词');
      else if (card.prompt.length > LIMITS.prompt.max) E('prompt', '图片转换提示词过长');
      if (hasLocal || hasCloud) E('track', '图片转换不应包含未经验证的模型参数');
    } else if (isImage) {
      /* 两条轨道缺一不可。
         这里原先写的是「至少要有一条轨道」，而同一个文件的第 8 行注释写的是
         「必须有本地 / 云端轨道」—— 注释和代码口径不一致，谁也没发现。
         代价是目录里混进了 3 张单轨卡（玻璃拟态 / 热带饱和只有云端，
         暗房红调只有本地），而「规范」页正写着「图片风格**都**有两条轨道，
         我们保证它们指向同一个视觉结果」，详情页顶部也因此会显示「单一轨道」。
         三处口径必须收敛到一处：**图片风格就是双轨**。 */
      if (!hasLocal || !hasCloud)
        E('track', '图片风格必须有本地与云端两条轨道' +
          (hasLocal ? '（缺云端轨道）' : hasCloud ? '（缺本地轨道）' : '（两条都缺）'));
      if (card.track !== 'both')
        E('track', '图片风格的轨道必须是 both，实际是「' + card.track + '」');
      /* 提示词的唯一出处是轨道。顶层再放一份是已删除的「列表页一键复制」
         留下的影子字段：导出文件里同一段提示词会出现两次，
         而且它必须跟 local.prompt 手工保持同步，谁忘了改就静默不一致。 */
      if (filled(card.prompt))
        E('prompt', '图片风格的提示词请写进两条轨道，不要在顶层再放一份');
    } else {
      if (hasLocal || hasCloud)
        E('track', '非图片分类不应该有本地 / 云端轨道，提示词请写进 prompt');
      if (card.track !== 'text')
        E('track', '非图片分类的轨道必须标为 text');
      if (!filled(card.prompt)) E('prompt', '必填：提示词原文');
      else if (card.prompt.length < LIMITS.prompt.min)
        E('prompt', '至少 ' + LIMITS.prompt.min + ' 个字符');
      else if (card.prompt.length > LIMITS.prompt.max)
        E('prompt', '过长（上限 ' + LIMITS.prompt.max + '）');
    }

    /* --- 封面：可选，但填了就必须完整，否则无法署名 --- */
    var cov = card.cover;
    if (cov != null) {
      if (typeof cov !== 'object' || Array.isArray(cov)) E('cover', '必须是对象');
      else {
        if (!filled(cov.src)) E('cover.src', '必填：图片路径或链接');
        else if (!/^(https?:\/\/|\/\/|assets\/|\.\/|\.\.\/)/.test(cov.src))
          E('cover.src', '必须是相对路径或 http(s) 链接');
        if (!isInt(cov.w) || cov.w < LIMITS.coverW.min) E('cover.w', '必须是 >= ' + LIMITS.coverW.min + ' 的整数');
        if (!isInt(cov.h) || cov.h < LIMITS.coverH.min) E('cover.h', '必须是 >= ' + LIMITS.coverH.min + ' 的整数');
        if (!filled(cov.creator)) W('cover.creator', '没有记录图片作者，页面上无法署名');
        if (!filled(cov.license)) W('cover.license', '没有记录图片协议，存在合规风险');
      }
    } else {
      if (isImage) W('cover', '图片转换需要来源案例图');
    }

    /* --- 版本与署名 --- */
    if (!filled(card.version)) E('version', '必填');
    else if (!LIMITS.version.re.test(card.version)) E('version', '格式必须是 主版本.次版本，例如 1.4');

    if (!filled(card.author)) E('author', '必填');
    else if (card.author.length > LIMITS.author.max) E('author', '过长');

    var licKeys = LICENSES.map(function (l) { return l.key; });
    if (!filled(card.license)) E('license', '必填，必须明确授权协议');
    else if (licKeys.indexOf(card.license) < 0) E('license', '「' + card.license + '」不是受支持的协议');

    /* --- 预览图配置 --- */
    var a = card.art;
    if (!a || typeof a !== 'object') E('art', '必填');
    else {
      if (GENERATORS.indexOf(a.g) < 0) E('art.g', '未知的生成器「' + a.g + '」');
      if (!Array.isArray(a.p) || a.p.length !== 4) E('art.p', '必须是 4 个十六进制颜色');
      else a.p.forEach(function (c, i) { if (!hexOk(c)) E('art.p[' + i + ']', '「' + c + '」不是合法颜色'); });
      if (!isInt(a.seed) || a.seed < 0) E('art.seed', '必须是非负整数，否则预览图无法复现');
    }

    /* --- 本地轨道 --- */
    if (hasLocal) {
      var L = card.local;
      if (!filled(L.base)) E('local.base', '必填：底模名称与版本');
      if (!filled(L.workflow)) E('local.workflow', '必填：工作流文件名，否则无法复现');
      if (!filled(L.sampler)) E('local.sampler', '必填');
      if (!isInt(L.steps) || L.steps < LIMITS.steps.min || L.steps > LIMITS.steps.max)
        E('local.steps', '必须是 ' + LIMITS.steps.min + '–' + LIMITS.steps.max + ' 的整数');
      if (!isNum(L.cfg) || L.cfg < LIMITS.cfg.min || L.cfg > LIMITS.cfg.max)
        E('local.cfg', '必须是 ' + LIMITS.cfg.min + '–' + LIMITS.cfg.max + ' 的数字');
      if (!isInt(L.seed) || L.seed < LIMITS.seed.min || L.seed > LIMITS.seed.max)
        E('local.seed', '必须是非负整数');
      if (!filled(L.neg)) E('local.neg', '必填：没有负向词就无法约束模型');
      else if (L.neg.length > LIMITS.neg.max) E('local.neg', '过长');
      if (!filled(L.prompt)) E('local.prompt', '必填');
      else if (L.prompt.length < LIMITS.prompt.min) E('local.prompt', '至少 ' + LIMITS.prompt.min + ' 个字符，太短的提示词无法稳定复现风格');
      else if (L.prompt.length > LIMITS.prompt.max) E('local.prompt', '过长');

      if (!Array.isArray(L.loras)) E('local.loras', '必须是数组（可以为空数组）');
      else {
        if (L.loras.length > LIMITS.loras.max) E('local.loras', '最多 ' + LIMITS.loras.max + ' 个');
        L.loras.forEach(function (l, i) {
          if (!l || typeof l !== 'object') { E('local.loras[' + i + ']', '必须是 { name, weight } 对象'); return; }
          if (!filled(l.name)) E('local.loras[' + i + '].name', '必填');
          if (!isNum(l.weight) || l.weight < LIMITS.weight.min || l.weight > LIMITS.weight.max)
            E('local.loras[' + i + '].weight', '权重需在 ' + LIMITS.weight.min + '–' + LIMITS.weight.max + ' 之间');
        });
      }
    }

    /* --- 云端轨道 --- */
    if (hasCloud) {
      var C = card.cloud;
      if (!Array.isArray(C.models) || !C.models.length) E('cloud.models', '至少写 1 个验证过的模型');
      else if (C.models.length > LIMITS.models.max) E('cloud.models', '最多 ' + LIMITS.models.max + ' 个');
      if (!filled(C.refs)) E('cloud.refs', '必填：说明需要什么参考图');
      else if (C.refs.length > LIMITS.refs.max) E('cloud.refs', '过长');
      if (!Array.isArray(C.banned) || !C.banned.length) E('cloud.banned', '必填：云端模型必须给禁用词');
      else if (C.banned.length > LIMITS.banned.max) E('cloud.banned', '最多 ' + LIMITS.banned.max + ' 个');
      if (!filled(C.prompt)) E('cloud.prompt', '必填');
      else if (C.prompt.length < LIMITS.prompt.min) E('cloud.prompt', '至少 ' + LIMITS.prompt.min + ' 个字符');
      else if (C.prompt.length > LIMITS.prompt.max) E('cloud.prompt', '过长');
      if (filled(C.prompt) && C.prompt.indexOf('{') < 0)
        W('cloud.prompt', '没有找到 {主体} 之类的槽位，用户不知道要替换哪里');
    }

    /* --- 内容红线：命中即拦截 --- */
    var all = textOf(card);
    if (IP_PATTERN.test(all)) P('$', '出现「模仿某位创作者」的表述。必须改成可描述的视觉特征');
    var denyText = textOf(card, true);
    var hits = DENYLIST.filter(function (w) { return denyText.indexOf(w) >= 0; });
    if (hits.length) P('$', '命中 IP 风险词：' + hits.join('、') + '。涉及他人商标或作品，不予上架');

    /* --- 复现性 --- */
    if (hasLocal && hasCloud) {
      var lp = (card.local.prompt || '').length, cp = (card.cloud.prompt || '').length;
      if (lp && cp && (cp / lp > 4 || lp / cp > 4))
        W('$', '两条轨道的提示词详略差距过大，风格对齐可能不稳');
    }

    return { errors: errs, policy: pol, warnings: warns };
  }

  function isOk(res) {
    return res.errors.length === 0 && (res.policy || []).length === 0;
  }

  /* ------------------------------------------------------- empty card -- */

  function emptyCard() {
    return {
      id: '', name: '', latin: '', tagline: '',
      category: 'image',
      uses: [], moods: [], track: 'both',
      version: '1.0', author: '', license: 'CC-BY-4.0',
      updated: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString().slice(0, 10),
      cover: null,
      art: { g: 'soft', p: ['#F4F0E6', '#D9D3C6', '#8A8478', '#8E2F1C'], seed: 1 },
      local: {
        base: '', loras: [], workflow: '', sampler: 'DPM++ 2M Karras',
        steps: 28, cfg: 3.5, seed: 0, neg: '', prompt: ''
      },
      cloud: {
        models: [], refs: '', banned: [], prompt: ''
      }
    };
  }

  function slugify(s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  }

  return {
    GENERATORS: GENERATORS,
    CATEGORIES: CATEGORIES,
    TEXT_CATEGORIES: TEXT_CATEGORIES,
    LICENSES: LICENSES,
    DENYLIST: DENYLIST,
    LIMITS: LIMITS,
    checkCard: checkCard,
    isOk: isOk,
    emptyCard: emptyCard,
    slugify: slugify
  };
})();
