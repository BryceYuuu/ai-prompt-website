'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(process.argv[2]||path.join(__dirname,'../..'));
const mutant=process.argv[3]||'';
const mutations={
 keywords:['app.js',"(s.keywords || []).join(' ')","''"],
 text:['data-curated.js','【交付内容】','【空泛建议】'],
 disclosure:['app.js','<details class="detail-fold detail-guide">','<details open class="detail-fold detail-guide">'],
 about:['app.js','尚未由本站逐条运行验证','已由本站逐条运行验证'],
 runtime:['app.js',"(function", "throw new Error('injected failure'); (function"],
 count:['data-curated.js' ,'const HF_CURATED_SAMPLES =','delete HF_CURATED["chef"];\nconst HF_CURATED_SAMPLES ='],
 source:['data-curated.js','"stars": 44076','"stars": 1'],
 image:['data-curated.js','"track": "edit"','"track": "text"'],
 prompt:['data-curated.js','【保持不变】','【无约束】'],
 license:['data-curated.js','"license": "MIT"','"license": "UNKNOWN"'],
 catalog:['app.js',"f.track === 'text' && s.category === 'image'","f.track === 'text' && false"],
 copy:['app.js',"if (parts[1] === 'text') return preparedPrompt(s);", "if (parts[1] === 'text') return 'BROKEN';"],
 export:['app.js','if (s.prompt) out.prompt = s.prompt;','if (s.prompt) out.prompt = "BROKEN";'],
 detail:['app.js',"if (!isImage || s.track === 'edit') {", "if (!isImage) {"],
 hero:['app.js',"heroStep(1); return;", "return;"],
 search:['app.js',"if (f.q &&", "if (false &&"],
 sourceUI:['app.js',"esc(s.source.repo)","esc('MISSING')"],
 savedPersist:['app.js',"localStorage.setItem('shutong:saved', JSON.stringify(savedIds));","void 0;"],
 savedLoad:['app.js',"localStorage.getItem('shutong:saved')","'[]'"],
 savedFilter:['app.js',"if (f.saved === '1' && !isSaved(s.id)) return false;","if (false) return false;"],
 savedScope:['app.js',"esc(libHref({ cat: key, track: f.track === 'text' ? 'text' : 'all', use: '', mood: '', limit: '' }))","esc('#/library?cat=' + key)"],
 categoryTrack:['app.js',"track: f.track === 'text' ? 'text' : 'all', use: ''","track: f.track, use: ''"],
 savedUnavailable:['app.js',"catch (e) { /* Restricted storage still permits an in-session collection. */ }","catch (e) { throw e; }"],
 slotValue:['app.js',"return values[slot] && values[slot].trim() ? values[slot].trim() : token;","return token;"],
 slotCopy:['app.js',"if (parts[1] === 'text') return preparedPrompt(s);","if (parts[1] === 'text') return s.prompt || '';"],
 slotReset:['app.js',"delete drafts[reset.id];","void 0;"],
 slotHTML:['app.js',"if (body) body.textContent = preparedPrompt(s);","if (body) body.innerHTML = preparedPrompt(s);"],
 slotPrivacy:['app.js',"drafts[card.id][slot] = t.value;","drafts[card.id][slot] = t.value; localStorage.setItem('leaked-input',t.value);"],
 preparedDownload:['app.js',"+ preparedPrompt(ready) +","+ ready.prompt +"],
 imageViewer:['app.js',"document.body.appendChild(viewer);","void 0;"],
 threadsLicense:['data-curated.js','"license": "CUSTOM"','"license": "CC-BY-4.0"'],
 exampleSelection:['app.js','picture = pictures[imageIndex].v;','picture = pictures[0].v;']
};
let applied=false;
function code(src){let s=fs.readFileSync(path.join(root,src),'utf8');if(mutant&&mutations[mutant][0]===path.basename(src)){let [,a,b]=mutations[mutant];assert(s.includes(a),'missing mutation anchor '+mutant);s=s.replace(a,b);applied=true;}return s;}
const html=fs.readFileSync(path.join(root,'index.html'),'utf8').replace(/<script src="(assets\/js\/[^\"]+)"><\/script>/g,(_,src)=>'<script>'+code(src)+'</script>');
// Each session owns its storage, clipboard and errors: reload tests must not pass
// by accidentally keeping the previous page's in-memory collection or drafts.
function session(options={}) {
 const errors=[],blobs=new Map(),out={errors,blobs,copied:'',downloads:[]};
 const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));vc.on('error',e=>errors.push(String(e)));
 out.dom=new JSDOM(html,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){
  w.scrollTo=()=>{};
  w.IntersectionObserver=class {constructor(cb){this.cb=cb;}observe(el){this.cb([{target:el,isIntersecting:true}]);}unobserve(){}disconnect(){}};
  w.navigator.clipboard={writeText:async s=>{out.copied=s;}};
  w.URL.createObjectURL=b=>{const id='blob:'+blobs.size;blobs.set(id,b.parts.join(''));return id;};
  w.URL.revokeObjectURL=()=>{};w.Blob=class{constructor(parts){this.parts=parts;}};
  const anchorClick=w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click=function(){if(this.hasAttribute('download')){out.downloads.push({name:this.download,text:blobs.get(this.href)});return;}anchorClick.call(this);};
  if(options.savedRaw!==undefined)w.localStorage.setItem('shutong:saved',options.savedRaw);
  if(options.storageDenied)Object.defineProperty(w,'localStorage',{get(){throw new w.DOMException('Storage is disabled','SecurityError');}});
 }});
 return out;
}
const primary=session(),dom=primary.dom,errors=primary.errors,blobs=primary.blobs;
const w=dom.window,d=w.document,wait=ms=>new Promise(r=>setTimeout(r,ms));let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
async function nav(hash){w.location.hash=hash;w.dispatchEvent(new w.Event('hashchange'));await wait(12);}
const q=s=>d.querySelector(s),all=s=>Array.from(d.querySelectorAll(s));
(async()=>{
 await wait(120);const cards=w.eval('STYLES'),images=cards.filter(s=>s.category==='image');
 await check('catalog-count-and-classification',()=>{assert.equal(cards.length,70);assert.equal(images.length,22);for(const cat of ['write','code','analyze','learn','business','life'])assert.equal(cards.filter(s=>s.category===cat).length,8);assert.equal(new Set(cards.map(s=>s.id)).size,70);});
 await check('source-evidence-and-license',()=>{for(const s of cards){if(s.source.provider==='threads'){
 assert(s.source.url.startsWith('https://www.threads.com/@lch1776244/post/'));
 assert(s.source.promptUrl.startsWith('https://www.threads.com/@lch1776244/post/'));
 assert.equal(s.license,'CUSTOM');assert.equal(s.cover.license,'经授权收录');
 assert(s.licenseNote.includes('原作者保留权利'));assert(!('stars' in s.source));
 const raw=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.snapshot));
 assert.equal(require('crypto').createHash('sha256').update(raw).digest('hex'),s.source.sha256);
 assert(s.prompt.includes(raw.toString().trim()),'author prompt retained in full');
 continue;
 }assert(s.source.url.startsWith('https://github.com/'));assert(s.source.stars>=8000);assert(/^2026-09-(21|26)$/.test(s.source.checkedAt),'source verification date: '+s.id);assert(s.source.mode.includes('中文'));assert(s.curation.status.includes('not-'));if(s.category!=='image'){assert.equal(s.source.license,'MIT');assert.equal(s.license,'MIT');assert(s.licenseText.includes('Permission is hereby granted'));const raw=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.act+'.md'));assert.equal(require('crypto').createHash('sha256').update(raw).digest('hex'),s.source.sha256);}}});
 await check('image-input-preservation-and-credits',()=>{for(const s of images){assert.equal(s.track,'edit');assert(!s.local&&!s.cloud);assert(s.prompt.includes('上传图片'));assert(s.prompt.includes('【保持不变】'));assert(s.prompt.includes('不具备图像编辑能力'));assert(fs.existsSync(path.join(root,s.cover.src)));assert(s.cover.creator&&s.cover.licenseUrl);if(s.source.provider==='threads'){
 const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/curate/sources/threads-lch1776244.json')));
 const item=manifest.cases.find(c=>c.id===s.id);assert(item);assert(s.cover.creator.includes('@lch1776244'));
 assert.deepEqual(s.guide.filter(b=>b.t==='img').map(b=>b.v.src),item.images.map(i=>i.src));
 for(const img of item.images)assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,img.src))).digest('hex'),img.sha256);
 continue;
 }assert.equal(s.cover.license,'CC BY 4.0');const a=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.act.replace('案例 ','case-')+'-ATTRIBUTION.txt'),'utf8');assert(a.includes(s.cover.creator));}});
 await check('text-deliverables-and-retirement-audit',()=>{for(const s of cards.filter(s=>s.category!=='image')){assert.equal(s.track,'text');assert(!s.cover&&!s.local&&!s.cloud);assert(s.prompt.length>300);for(const label of ['【输入材料】','【处理步骤】','【交付内容】','【信息不足】'])assert(s.prompt.includes(label));assert(s.slots.length>0);}const a=JSON.parse(fs.readFileSync(path.join(root,'tools/curate/audit.json')));assert.equal(a.review.length,108);assert.equal(a.activeCount,cards.length);});
 await check('homepage-image-only-and-manual-carousel',async()=>{await nav('#/');assert(all('.card__link').length>0);for(const a of all('.card__link'))assert(images.some(s=>a.hash.endsWith(s.id)));const hero=q('.hero__plate');const first=hero.getAttribute('href');q('[data-action="hero-next"]').click();assert.notEqual(q('.hero__plate').getAttribute('href'),first);q('[data-action="hero-prev"]').click();assert.equal(q('.hero__plate').getAttribute('href'),first);});
 await check('scene-and-category-filters',async()=>{
   await nav('#/library?track=text&limit=100');assert.equal(all('.gallery .card').length,48);
   for(const cat of ['image','write','code','analyze','learn','business','life']){await nav('#/library?cat='+cat+'&limit=100');assert.equal(all('.gallery .card').length,cat==='image'?22:8);}
   await nav('#/library?track=both');
   const codeTab=all('.catbar a').find(a=>new URLSearchParams(a.hash.split('?')[1]).get('cat')==='code');assert(codeTab);codeTab.click();await wait(12);
   assert.equal(all('.gallery .card').length,8,'changing from image filter to code clears conflicting track');
   assert.notEqual(new URLSearchParams(w.location.hash.split('?')[1]).get('track'),'both');
 });
 await check('keyword-aliases-in-library-and-palette',async()=>{
   const cases=[['照片转手办','anime-figurine'],['amigurumi','plush-toy'],['会议纪要','meeting-minutes'],['Anki卡片','flashcard-maker'],['CODE REVIEW','code-reviewer']];
   for(const [term,id] of cases){
     await nav('#/library?q='+encodeURIComponent(term));
     assert(all('.gallery .card__link').some(a=>a.getAttribute('href')==='#/style/'+id),term+' missing in library');
     q('[data-action="palette-open"]').click();
     const input=q('#palette-input');input.value=term;input.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(30);
     assert(all('#palette-list a').some(a=>a.getAttribute('href')==='#/style/'+id),term+' missing in palette');
     d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   }
 });
 await check('search-and-empty-state',async()=>{await nav('#/library?q='+encodeURIComponent('PRD'));assert(all('.gallery .card').length>0);await nav('#/library?q=zzzzNoSuchPrompt');assert.equal(all('.gallery .card').length,0);assert(q('.empty a'));});
 await check('all-card-details-copy-and-export',async()=>{for(const s of cards){await nav('#/style/'+s.id);assert.equal(q('.gh__title').textContent.trim(),s.name);assert.equal(q('.prompt__body').textContent.trim(),s.prompt);assert.equal(all('.prompt-tabs .seg__item').length,0);assert(q('.srcbox').textContent.includes(s.source.repo));primary.copied='';q('.gh__actions [data-action="copy-prompt"]').click();await wait(1);assert.equal(primary.copied,s.prompt);const ex=all('.takeaway a[download]');assert.equal(ex.length,2);const j=JSON.parse(blobs.get(ex.find(a=>a.download.endsWith('.json')).href));assert.equal(j.prompt,s.prompt);assert.equal(j.source.url,s.source.url);assert.equal(j.validation,s.curation.status);const md=blobs.get(ex.find(a=>a.download.endsWith('.md')).href);assert(md.includes(s.prompt));assert(md.includes('尚未逐条模型实测'));assert(md.includes(s.source.license));}});
 await check('saved-collection-toggle-filter-and-reload',async()=>{
   await nav('#/style/code-reviewer');
   const save=q('[data-action="save-toggle"][data-id="code-reviewer"]');
   assert(save,'detail save control');save.click();
   assert(JSON.parse(w.localStorage.getItem('shutong:saved')).includes('code-reviewer'),'saved ID persisted');
   await nav('#/library?saved=1');
   assert.deepEqual(all('.gallery .card__link').map(a=>a.getAttribute('href')),['#/style/code-reviewer']);
   const category=all('.catbar a').find(a=>new URLSearchParams(a.hash.split('?')[1]).get('cat')==='code');
   assert(category&&new URLSearchParams(category.hash.split('?')[1]).get('saved')==='1','category links preserve collection scope');
   category.click();await wait(12);assert.equal(all('.gallery .card').length,1);
   const noMatch=all('.catbar a').find(a=>new URLSearchParams(a.hash.split('?')[1]).get('cat')==='write');noMatch.click();await wait(12);
   assert.equal(all('.gallery .card').length,0,'empty saved category shows no unrelated prompts');
   const reset=q('.lib-bar a[href="#/library?saved=1"]');assert(reset,'clear-filter link stays inside collection');reset.click();await wait(12);
   assert.equal(all('.gallery .card').length,1,'clearing a category returns to collection');
   const reload=session({savedRaw:w.localStorage.getItem('shutong:saved')});
   try {
     await wait(80);const rw=reload.dom.window,rd=rw.document;
     rw.location.hash='#/library?saved=1';rw.dispatchEvent(new rw.Event('hashchange'));await wait(12);
     assert.deepEqual(Array.from(rd.querySelectorAll('.gallery .card__link'),a=>a.getAttribute('href')),['#/style/code-reviewer'],'saved collection survives a new session');
     rd.querySelector('[data-action="save-toggle"][data-id="code-reviewer"]').click();await wait(12);
     assert.equal(rd.querySelectorAll('.gallery .card').length,0,'removing a saved card updates the collection');
     assert.deepEqual(JSON.parse(rw.localStorage.getItem('shutong:saved')),[]);
     assert.deepEqual(reload.errors,[]);
   } finally {reload.dom.window.close();}
   await nav('#/style/code-reviewer');q('[data-action="save-toggle"][data-id="code-reviewer"]').click();
   assert.deepEqual(JSON.parse(w.localStorage.getItem('shutong:saved')),[]);
 });
 await check('saved-storage-corruption-and-unavailability',async()=>{
   for(const options of [{savedRaw:'{broken JSON'},{savedRaw:'{"unexpected":"object"}'},{storageDenied:true}]) {
     const fresh=session(options);
     try {
       await wait(80);const fw=fresh.dom.window,fd=fw.document;
       assert(fd.querySelector('.card__link'),'catalog still renders with unusable storage');
       fw.location.hash='#/style/meeting-minutes';fw.dispatchEvent(new fw.Event('hashchange'));await wait(12);
       fd.querySelector('[data-action="save-toggle"][data-id="meeting-minutes"]').click();
       fw.location.hash='#/library?saved=1';fw.dispatchEvent(new fw.Event('hashchange'));await wait(12);
       assert(fd.querySelector('.card__link[href="#/style/meeting-minutes"]'),'session collection remains useful');
       assert.deepEqual(fresh.errors,[]);
     } finally {fresh.dom.window.close();}
   }
 });
 await check('prompt-builder-preview-copy-reset-and-safe-drafts',async()=>{
   const s=cards.find(s=>s.id==='code-reviewer');await nav('#/style/'+s.id);
   const inputs=all('[data-action="slot-input"][data-id="'+s.id+'"]');
   assert.equal(inputs.length,s.slots.length,'one editable field per placeholder');
   const values={};
   inputs.forEach((input,i)=>{
     const slot=input.getAttribute('data-slot');assert(s.slots.includes(slot));
     values[slot]=i===0?'<img src=x onerror="window.__promptInjection=1"> $& $1 {not-a-slot}':('真实输入 '+i);
     input.value=values[slot];input.dispatchEvent(new w.Event('input',{bubbles:true}));
   });
   const expected=s.prompt.replace(/\{([^{}]+)\}/g,(token,key)=>Object.hasOwn(values,key)?values[key]:token);
   assert.equal(q('.prompt__body').textContent.trim(),expected);
   primary.copied='';q('.gh__actions [data-action="copy-prompt"]').click();await wait(1);
   assert.equal(primary.copied,expected,'clipboard uses the filled prompt');
   q('[data-action="download-prepared"]').click();
   const download=primary.downloads.at(-1);assert(download&&download.name===s.id+'-my-prompt.md');
   assert(download.text.includes(expected)&&download.text.includes(s.source.url),'prepared download contains filled text and source');
   assert(!q('.prompt__body img')&&!w.__promptInjection,'input stays text');
   assert(!Object.values(w.localStorage).some(stored=>Object.values(values).some(input=>stored.includes(input))),'private input is not saved to local storage');
   await nav('#/library?cat=code');await nav('#/style/'+s.id);
   assert.equal(q('[data-action="slot-input"]').value,values[s.slots[0]],'draft survives same-tab navigation');
   assert.equal(q('.prompt__body').textContent.trim(),expected);
   q('[data-action="reset-slots"]').click();
   assert.equal(q('.prompt__body').textContent.trim(),s.prompt,'reset restores placeholders');
   assert(all('[data-action="slot-input"]').every(input=>input.value===''),'reset clears fields');
   primary.copied='';q('.gh__actions [data-action="copy-prompt"]').click();await wait(1);
   assert.equal(primary.copied,s.prompt,'reset also affects clipboard');
   const fresh=session();
   try {await wait(80);const fw=fresh.dom.window;fw.location.hash='#/style/'+s.id;fw.dispatchEvent(new fw.Event('hashchange'));await wait(12);assert.equal(fw.document.querySelector('.prompt__body').textContent.trim(),s.prompt,'draft is not inherited by a new session');}
   finally {fresh.dom.window.close();}
 });
 await check('image-viewer-content-and-close',async()=>{
   const s=images[0];await nav('#/style/'+s.id);const opener=q('[data-action="image-expand"]');assert(opener);opener.click();
   const viewer=q('dialog.image-viewer');assert(viewer&&viewer.open,'full image dialog opens');
   assert.equal(viewer.querySelector('img').getAttribute('src'),s.cover.src);
   assert(viewer.textContent.includes(s.cover.creator)&&viewer.textContent.includes('非本站实测'),'source case disclosure retained');
   viewer.querySelector('button').click();assert(!q('dialog.image-viewer'));assert.equal(d.activeElement,opener,'focus returns to the opening control');assert.notEqual(d.body.style.overflow,'hidden');
 });
 await check('threads-gallery-source-and-search',async()=>{
   const imported=cards.filter(s=>s.source.provider==='threads');assert.equal(imported.length,4);
   await nav('#/library?cat=image&q=Chloe_Lai&limit=100');assert.equal(all('.gallery .card').length,4);
   for(const s of imported){
     await nav('#/style/'+s.id);const pictures=s.guide.filter(b=>b.t==='img');
     assert.equal(all('.detail-preview figure').length,1,'one large preview, not a stacked image wall');
     const thumbs=all('.example-gallery [data-action="image-expand"]');assert.equal(thumbs.length,pictures.length);
     const source=q('.srcbox');assert(!source.textContent.includes('仓库热度'));assert(source.querySelector('a[href="'+s.source.promptUrl+'"]'));
     for(let i=0;i<thumbs.length;i++){
       thumbs[i].click();const dialog=q('dialog.image-viewer');assert(dialog&&dialog.open);
       assert.equal(dialog.querySelector('img').getAttribute('src'),pictures[i].v.src);
       assert(dialog.textContent.includes('经授权收录'));dialog.querySelector('button').click();assert.equal(d.activeElement,thumbs[i]);
     }
     const ex=all('.takeaway a[download]');const md=blobs.get(ex.find(a=>a.download.endsWith('.md')).href);assert(md.includes(s.licenseNote));
   }
 });
 await check('disclosures-and-filtered-backlink',async()=>{await nav('#/library?cat=code');await nav('#/style/code-reviewer');assert.equal(q('.backlink').getAttribute('href'),'#/library?cat=code');for(const el of all('.detail-guide,.detail-source')){assert(!el.open);el.querySelector('summary').click();assert(el.open);el.querySelector('summary').click();assert(!el.open);}});
 await check('about-and-retired-route-exits',async()=>{await nav('#/about');assert(q('#view').textContent.includes('尚未由本站逐条运行验证'));assert(q('#view').textContent.includes('Fabric'));for(const h of ['#/style/novelist','#/creators','#/submit','#/missing']){await nav(h);assert(q('#view h1'));assert(q('#view a[href^="#/"]'));}});
 await check('no-runtime-errors',()=>assert.deepEqual(errors,[]));
 if(mutant)assert(applied,'mutation not applied');
 dom.window.close();console.log(`${passed}/${passed+failed} reviewed-contract groups passed`);if(!failed)console.log('JSDOM 全部通过');process.exitCode=failed?1:0;
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
