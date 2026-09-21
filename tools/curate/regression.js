'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const mutant=process.argv[3]||'';
const mutations={
 text:['data-curated.js','【交付内容】','【空泛建议】'],
 disclosure:['app.js','<details class="detail-fold detail-guide">','<details open class="detail-fold detail-guide">'],
 about:['app.js','尚未由本站逐条运行验证','已由本站逐条运行验证'],
 runtime:['app.js',"(function", "throw new Error('injected failure'); (function"],
 count:['data-curated.js' ,'const HF_CURATED_SAMPLES =','delete HF_CURATED["chef"];\nconst HF_CURATED_SAMPLES ='],
 source:['data-curated.js','"stars": 44030','"stars": 1'],
 image:['data-curated.js','"track": "edit"','"track": "text"'],
 prompt:['data-curated.js','【保持不变】','【无约束】'],
 license:['data-curated.js','"license": "MIT"','"license": "UNKNOWN"'],
 catalog:['app.js',"f.track === 'text' && s.category === 'image'","f.track === 'text' && false"],
 copy:['app.js',"if (parts[1] === 'text') return s.prompt || '';", "if (parts[1] === 'text') return 'BROKEN';"],
 export:['app.js','if (s.prompt) out.prompt = s.prompt;','if (s.prompt) out.prompt = "BROKEN";'],
 detail:['app.js',"if (!isImage || s.track === 'edit') {", "if (!isImage) {"],
 hero:['app.js',"heroStep(1); return;", "return;"],
 search:['app.js',"if (f.q &&", "if (false &&"],
 sourceUI:['app.js',"esc(s.source.repo)","esc('MISSING')"]
};
let applied=false;
function code(src){let s=fs.readFileSync(path.join(root,src),'utf8');if(mutant&&mutations[mutant][0]===path.basename(src)){let [,a,b]=mutations[mutant];assert(s.includes(a),'missing mutation anchor '+mutant);s=s.replace(a,b);applied=true;}return s;}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="(assets\/js\/[^\"]+)"><\/script>/g,(_,src)=>'<script>'+code(src)+'</script>');
const errors=[],blobs=new Map();let copied='';const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
const dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.IntersectionObserver=class {constructor(cb){this.cb=cb;}observe(el){this.cb([{target:el,isIntersecting:true}]);}unobserve(){}disconnect(){}};w.navigator.clipboard={writeText:async s=>{copied=s;}};w.URL.createObjectURL=b=>{const id='blob:'+blobs.size;blobs.set(id,b.parts.join(''));return id;};w.URL.revokeObjectURL=()=>{};w.Blob=class{constructor(parts){this.parts=parts;}};}});
const w=dom.window,d=w.document,wait=ms=>new Promise(r=>setTimeout(r,ms));let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
async function nav(hash){w.location.hash=hash;w.dispatchEvent(new w.Event('hashchange'));await wait(12);}
const q=s=>d.querySelector(s),all=s=>Array.from(d.querySelectorAll(s));
(async()=>{
 await wait(120);const cards=w.eval('STYLES'),images=cards.filter(s=>s.category==='image');
 await check('catalog-count-and-classification',()=>{assert.equal(cards.length,48);assert.equal(images.length,12);for(const cat of ['write','code','analyze','learn','business','life'])assert.equal(cards.filter(s=>s.category===cat).length,6);assert.equal(new Set(cards.map(s=>s.id)).size,48);});
 await check('source-evidence-and-license',()=>{for(const s of cards){assert(s.source.url.startsWith('https://github.com/'));assert(s.source.stars>=8000);assert.equal(s.source.checkedAt,'2026-09-21');assert(s.source.mode.includes('中文'));assert(s.curation.status.includes('not-'));if(s.category!=='image'){assert.equal(s.source.license,'MIT');assert.equal(s.license,'MIT');assert(s.licenseText.includes('Permission is hereby granted'));const raw=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.act+'.md'));assert.equal(require('crypto').createHash('sha256').update(raw).digest('hex'),s.source.sha256);}}});
 await check('image-input-preservation-and-credits',()=>{for(const s of images){assert.equal(s.track,'edit');assert(!s.local&&!s.cloud);assert(s.prompt.includes('上传图片'));assert(s.prompt.includes('【保持不变】'));assert(s.prompt.includes('不具备图像编辑能力'));assert(fs.existsSync(path.join(root,s.cover.src)));assert(s.cover.creator&&s.cover.licenseUrl);assert.equal(s.cover.license,'CC BY 4.0');const a=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.act.replace('案例 ','case-')+'-ATTRIBUTION.txt'),'utf8');assert(a.includes(s.cover.creator));}});
 await check('text-deliverables-and-retirement-audit',()=>{for(const s of cards.filter(s=>s.category!=='image')){assert.equal(s.track,'text');assert(!s.cover&&!s.local&&!s.cloud);assert(s.prompt.length>300);for(const label of ['【输入材料】','【处理步骤】','【交付内容】','【信息不足】'])assert(s.prompt.includes(label));assert(s.slots.length>0);}const a=JSON.parse(fs.readFileSync(path.join(root,'tools/curate/audit.json')));assert.equal(a.review.length,108);assert.equal(a.activeCount,cards.length);});
 await check('homepage-image-only-and-manual-carousel',async()=>{await nav('#/');assert(all('.card__link').length>0);for(const a of all('.card__link'))assert(images.some(s=>a.hash.endsWith(s.id)));const hero=q('.hero__plate');const first=hero.getAttribute('href');q('[data-action="hero-next"]').click();assert.notEqual(q('.hero__plate').getAttribute('href'),first);q('[data-action="hero-prev"]').click();assert.equal(q('.hero__plate').getAttribute('href'),first);});
 await check('scene-and-category-filters',async()=>{await nav('#/library?track=text&limit=100');assert.equal(all('.gallery .card').length,36);for(const cat of ['image','write','code','analyze','learn','business','life']){await nav('#/library?cat='+cat+'&limit=100');assert.equal(all('.gallery .card').length,cat==='image'?12:6);}});
 await check('search-and-empty-state',async()=>{await nav('#/library?q='+encodeURIComponent('PRD'));assert(all('.gallery .card').length>0);await nav('#/library?q=zzzzNoSuchPrompt');assert.equal(all('.gallery .card').length,0);assert(q('.empty a'));});
 await check('all-48-details-copy-and-export',async()=>{for(const s of cards){await nav('#/style/'+s.id);assert.equal(q('.gh__title').textContent.trim(),s.name);assert.equal(q('.prompt__body').textContent.trim(),s.prompt);assert.equal(all('.prompt-tabs .seg__item').length,0);assert(q('.srcbox').textContent.includes(s.source.repo));copied='';q('.gh__actions [data-action="copy-prompt"]').click();await wait(1);assert.equal(copied,s.prompt);const ex=all('.takeaway a[download]');assert.equal(ex.length,2);const j=JSON.parse(blobs.get(ex.find(a=>a.download.endsWith('.json')).href));assert.equal(j.prompt,s.prompt);assert.equal(j.source.url,s.source.url);assert.equal(j.validation,s.curation.status);const md=blobs.get(ex.find(a=>a.download.endsWith('.md')).href);assert(md.includes(s.prompt));assert(md.includes('尚未逐条模型实测'));assert(md.includes(s.source.license));}});
 await check('disclosures-and-filtered-backlink',async()=>{await nav('#/library?cat=code');await nav('#/style/code-reviewer');assert.equal(q('.backlink').getAttribute('href'),'#/library?cat=code');for(const el of all('.detail-guide,.detail-source')){assert(!el.open);el.querySelector('summary').click();assert(el.open);el.querySelector('summary').click();assert(!el.open);}});
 await check('about-and-retired-route-exits',async()=>{await nav('#/about');assert(q('#view').textContent.includes('尚未由本站逐条运行验证'));assert(q('#view').textContent.includes('Fabric'));for(const h of ['#/style/novelist','#/creators','#/submit','#/missing']){await nav(h);assert(q('#view h1'));assert(q('#view a[href^="#/"]'));}});
 await check('no-runtime-errors',()=>assert.deepEqual(errors,[]));
 if(mutant)assert(applied,'mutation not applied');
 dom.window.close();console.log(`${passed}/${passed+failed} reviewed-contract groups passed`);if(!failed)console.log('JSDOM 全部通过');process.exitCode=failed?1:0;
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
