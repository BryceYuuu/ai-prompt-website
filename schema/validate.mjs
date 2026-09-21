#!/usr/bin/env node
/* ==========================================================================
   书桐 SHUTONG — 提示词卡校验器（零依赖）
   用法：
     node schema/validate.mjs                    校验全部提示词卡
     node schema/validate.mjs card.json          校验单个 JSON 文件
     node schema/validate.mjs cards/*.json       批量
     node schema/validate.mjs --json             输出机器可读结果
   同时执行两套规则并比对：
     1) schema/style-card.schema.json  （声明式，给后端与第三方用）
     2) assets/js/rules.js             （命令式，给前端投稿表单用）
   两者结论必须一致，否则退出码为 2。
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ----------------------------------------------------------- loader ---- */

function loadModule(file, names) {
  const src = fs.readFileSync(file, 'utf8');
  const fn = new Function(src + '\n;return {' + names.map(n => n + ':' + n).join(',') + '};');
  return fn();
}

/* 采集层与示例层都必须先加载：
     · data.js 依赖 HF_COVERS / HF_NOTES / PROMPT_CARDS 组装总目
     · rules.js 的 textOf() 会把 HF_SAMPLES 一起扫红线（示例输出也是页面正文）
   少加载一个，rules.js 里的 typeof 守卫会静默退化成 {}，
   于是示例文本里的违禁词永远扫不出来 —— 校验照样全绿，但漏了东西。 */
function loadData() {
  const src = [
    fs.readFileSync(path.join(ROOT, 'assets/js/data-curated.js'), 'utf8'),
    fs.readFileSync(path.join(ROOT, 'assets/js/data.js'), 'utf8')
  ].join('\n');
  const fn = new Function(src + '\n;return {STYLES: STYLES, TAXONOMY: TAXONOMY};');
  return fn();
}

const { STYLES, TAXONOMY } = loadData();
const { HFRules } = loadModule(path.join(ROOT, 'assets/js/rules.js'), ['HFRules']);
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'style-card.schema.json'), 'utf8'));

/* ------------------------------------------------- json schema subset -- */

const typeOf = v =>
  v === null ? 'null'
    : Array.isArray(v) ? 'array'
      : typeof v === 'number' ? (Number.isInteger(v) ? 'integer' : 'number')
        : typeof v;

function resolveRef(ref, root) {
  return ref.replace(/^#\//, '').split('/').reduce((o, k) => o && o[k], root);
}

function validate(schema, data, root, p) {
  const errs = [];
  if (!schema || typeof schema !== 'object') return errs;

  if (schema.$ref) {
    const target = resolveRef(schema.$ref, root);
    if (!target) { errs.push(`${p}: 无法解析 $ref ${schema.$ref}`); return errs; }
    return errs.concat(validate(target, data, root, p));
  }

  const t = typeOf(data);

  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type];
    const ok = allowed.some(a => a === t || (a === 'number' && t === 'integer'));
    if (!ok) { errs.push(`${p}: 类型应为 ${allowed.join('|')}，实际是 ${t}`); return errs; }
  }

  if ('const' in schema && data !== schema.const) {
    errs.push(`${p}: 必须是 ${JSON.stringify(schema.const)}，实际是 ${JSON.stringify(data)}`);
  }
  if (schema.enum && !schema.enum.some(e => e === data)) {
    errs.push(`${p}: ${JSON.stringify(data)} 不在允许取值 [${schema.enum.join(', ')}] 中`);
  }

  if (typeof data === 'string') {
    if (schema.minLength != null && data.length < schema.minLength) errs.push(`${p}: 长度 ${data.length} < ${schema.minLength}`);
    if (schema.maxLength != null && data.length > schema.maxLength) errs.push(`${p}: 长度 ${data.length} > ${schema.maxLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) errs.push(`${p}: 「${data}」不匹配 ${schema.pattern}`);
    if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(data)) errs.push(`${p}: 「${data}」不是 YYYY-MM-DD`);
    if (schema.format === 'uri' && !/^https?:\/\/\S+$/.test(data)) errs.push(`${p}: 「${data}」不是合法链接`);
  }

  if (typeof data === 'number') {
    if (schema.minimum != null && data < schema.minimum) errs.push(`${p}: ${data} < ${schema.minimum}`);
    if (schema.maximum != null && data > schema.maximum) errs.push(`${p}: ${data} > ${schema.maximum}`);
  }

  if (Array.isArray(data)) {
    if (schema.minItems != null && data.length < schema.minItems) errs.push(`${p}: 至少 ${schema.minItems} 项，实际 ${data.length}`);
    if (schema.maxItems != null && data.length > schema.maxItems) errs.push(`${p}: 最多 ${schema.maxItems} 项，实际 ${data.length}`);
    if (schema.uniqueItems) {
      const seen = new Set();
      data.forEach((v, i) => {
        const k = JSON.stringify(v);
        if (seen.has(k)) errs.push(`${p}[${i}]: 重复项`);
        seen.add(k);
      });
    }
    if (schema.items) data.forEach((v, i) => errs.push(...validate(schema.items, v, root, `${p}[${i}]`)));
  }

  if (t === 'object') {
    (schema.required || []).forEach(k => {
      if (!(k in data)) errs.push(`${p}: 缺少必填字段 ${k}`);
    });
    if (schema.additionalProperties === false) {
      Object.keys(data).forEach(k => {
        if (!schema.properties || !(k in schema.properties)) errs.push(`${p}: 出现未声明字段 ${k}`);
      });
    }
    if (schema.properties) {
      Object.keys(schema.properties).forEach(k => {
        if (k in data) errs.push(...validate(schema.properties[k], data[k], root, `${p}.${k}`));
      });
    }
  }

  (schema.allOf || []).forEach(s => errs.push(...validate(s, data, root, p)));

  if (schema.anyOf) {
    const results = schema.anyOf.map(s => validate(s, data, root, p));
    if (!results.some(r => r.length === 0)) errs.push(`${p}: 不满足 anyOf 中任何一项 —— ${results[0].slice(0, 2).join('; ') || '(无细节)'}`);
  }
  if (schema.oneOf) {
    const results = schema.oneOf.map(s => validate(s, data, root, p));
    const passing = results.filter(r => r.length === 0).length;
    if (passing !== 1) errs.push(`${p}: 应恰好匹配 oneOf 中的 1 项，实际匹配 ${passing} 项`);
  }
  if (schema.if) {
    const cond = validate(schema.if, data, root, p);
    if (cond.length === 0 && schema.then) errs.push(...validate(schema.then, data, root, p));
    if (cond.length > 0 && schema.else) errs.push(...validate(schema.else, data, root, p));
  }

  return errs;
}

/* ------------------------------------------------------------- checks -- */

function checkOne(card, label) {
  const schemaErrs = validate(SCHEMA, card, SCHEMA, '$');
  const ruleRes = HFRules.checkCard(card, { taxonomy: TAXONOMY });
  const policy = ruleRes.policy || [];

  /* 只有「结构性」结论需要两套规则一致。
     策略性检查（IP 红线等）本质无法用纯 JSON Schema 表达，只存在于 rules.js。 */
  const agree = (schemaErrs.length === 0) === (ruleRes.errors.length === 0);

  return { label, schemaErrs, ruleErrs: ruleRes.errors, policy, warnings: ruleRes.warnings, agree };
}

function fmt(list, indent) {
  return list.map(e => indent + '· ' + (typeof e === 'string' ? e : `${'$.' + e.path} — ${e.msg}`)).join('\n');
}

/* --------------------------------------------------------------- main -- */

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const files = argv.filter(a => !a.startsWith('--'));

let targets;
if (files.length) {
  targets = [];
  for (const f of files) {
    const abs = path.resolve(f);
    const parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    (Array.isArray(parsed) ? parsed : [parsed]).forEach((c, i) =>
      targets.push({ card: c, label: path.basename(abs) + (Array.isArray(parsed) ? `[${i}]` : '') }));
  }
} else {
  targets = STYLES.map(s => ({ card: s, label: s.id }));
}

const results = targets.map(t => checkOne(t.card, t.label));

const blocked = r => r.schemaErrs.length || r.ruleErrs.length || r.policy.length;
const hardFail = results.filter(blocked);
const disagree = results.filter(r => !r.agree);

if (asJson) {
  console.log(JSON.stringify({
    total: results.length,
    passed: results.length - hardFail.length,
    failed: hardFail.length,
    ruleSetsDisagree: disagree.map(r => r.label),
    results: results.map(r => ({
      label: r.label,
      ok: !blocked(r),
      schemaErrors: r.schemaErrs,
      ruleErrors: r.ruleErrs.map(e => `$.${e.path} — ${e.msg}`),
      policyBlocks: r.policy.map(e => `$.${e.path} — ${e.msg}`),
      warnings: r.warnings.map(e => `$.${e.path} — ${e.msg}`)
    }))
  }, null, 2));
  process.exit(hardFail.length ? 1 : disagree.length ? 2 : 0);
}

console.log('书桐 SHUTONG · 提示词卡校验');
console.log('规则来源: schema/style-card.schema.json + assets/js/rules.js');
console.log('待校验: ' + results.length + ' 张卡\n');

for (const r of results) {
  if (!blocked(r)) {
    const w = r.warnings.length;
    console.log(`  PASS  ${r.label}${w ? `   (${w} 条警告)` : ''}`);
  } else {
    console.log(`  FAIL  ${r.label}`);
    if (r.schemaErrs.length) console.log(fmt(r.schemaErrs, '          [schema] '));
    if (r.ruleErrs.length) console.log(fmt(r.ruleErrs, '          [rules]  '));
    if (r.policy.length) console.log(fmt(r.policy, '          [policy] '));
  }
}

const warnTotal = results.reduce((n, r) => n + r.warnings.length, 0);
if (warnTotal) {
  console.log('\n警告明细（不拦截，建议修改）:');
  for (const r of results) {
    if (!r.warnings.length) continue;
    console.log(`  ${r.label}`);
    console.log(fmt(r.warnings, '    '));
  }
}

console.log('\n' + (results.length - hardFail.length) + '/' + results.length + ' 张卡通过校验');
if (disagree.length) {
  console.log('!! 两套规则的结构性结论不一致: ' + disagree.map(d => d.label).join(', '));
}

process.exit(hardFail.length ? 1 : disagree.length ? 2 : 0);
