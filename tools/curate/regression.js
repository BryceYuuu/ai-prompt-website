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
 heroFeatured:['app.js','return HERO_FEATURES.map(function (item) { return byId(item.id); }).filter(function (s) { return s && s.category === \'image\'; });','return imageStyles();'],
 heroResult:['app.js','resultStart: feature && feature.resultStart','resultStart: 0'],
 search:['app.js',"if (f.q &&", "if (false &&"],
 sourceUI:['app.js',"esc(s.source.repo)","esc('MISSING')"],
 savedPersist:['app.js',"localStorage.setItem('shutong:saved', JSON.stringify(savedIds));","void 0;"],
 savedLoad:['app.js',"localStorage.getItem('shutong:saved')","'[]'"],
 savedFilter:['app.js',"if (f.saved === '1' && !isSaved(s.id)) return false;","if (false) return false;"],
 savedScope:['app.js',"esc(libHref({ cat: key, track: f.track === 'text' ? 'text' : 'all', group: '', source: '', use: '', mood: '', page: '' }))","esc('#/library?cat=' + key)"],
 categoryTrack:['app.js',"track: f.track === 'text' ? 'text' : 'all', group: ''","track: f.track, group: ''"],
 savedUnavailable:['app.js',"catch (e) { /* Restricted storage still permits an in-session collection. */ }","catch (e) { throw e; }"],
 slotValue:['app.js',"return values[slot] && values[slot].trim() ? values[slot].trim() : token;","return token;"],
 slotCopy:['app.js',"if (parts[1] === 'text') return preparedPrompt(s);","if (parts[1] === 'text') return s.prompt || '';"],
 slotReset:['app.js',"delete drafts[reset.id];","void 0;"],
 slotHTML:['app.js',"if (body) body.textContent = preparedPrompt(s);","if (body) body.innerHTML = preparedPrompt(s);"],
 slotPrivacy:['app.js',"drafts[card.id][slot] = t.value;","drafts[card.id][slot] = t.value; localStorage.setItem('leaked-input',t.value);"],
 preparedDownload:['app.js',"+ preparedPrompt(ready) +","+ ready.prompt +"],
 imageViewer:['app.js',"document.body.appendChild(viewer);","void 0;"],
 imageTapEntry:['app.js',"var zoomable = preview && s.category === 'image';","var zoomable = false;"],
 imageTapCurrent:['app.js',"$('.preview-image').setAttribute('data-image-index', String(index));","$('.preview-image').setAttribute('data-image-index', '0');"],
 imageTapDrag:['app.js',"t._suppressImageClick && e.detail !== 0","false && e.detail !== 0"],
 threadsLicense:['data-curated.js','"license": "CUSTOM"','"license": "CC-BY-4.0"'],
 longPromptLimit:['rules.js','prompt:  { min: 40, max: 8000 }','prompt:  { min: 40, max: 4000 }'],
 longPromptGuard:['rules.js',"else if (card.prompt.length > LIMITS.prompt.max) E('prompt', '图片转换提示词过长');",''],
 exampleMain:['app.js','var picture = pictures[index].v;','var picture = pictures[0].v;'],
 exampleSwipe:['app.js','Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2) step','false) step'],
 exampleViewerStep:['app.js','imageIndex = (imageIndex + direction + pictures.length) % pictures.length;','imageIndex = imageIndex;'],
 paginationOffset:['app.js','var start = (state.page - 1) * 12;','var start = 0;'],
 paginationContext:['app.js','libHref({ page: String(page) })',"('#/library?page=' + page)"],
 paginationHome:['app.js','list.slice((state.page - 1) * 12, state.page * 12)','list.slice(0, 12)'],
 useFilter:['app.js',"if (f.use && except !== 'use' && s.uses.indexOf(f.use) < 0) return false;","if (false) return false;"],
 browseGroup:['app.js',"if (f.group && except !== 'group'", "if (false && except !== 'group'"],
 browseSource:['app.js',"if (f.source && except !== 'source'", "if (false && except !== 'source'"],
 browseQuery:['app.js',".trim().split(/\\s+/).every(",".trim().split(/\\s+/).some("],
 browseInterrupted:['app.js','clearTimeout(onInput._timer);\n    var route', 'void 0;\n    var route'],
 threadsOwner:['data-curated.js','https://www.threads.com/@inkacalinka/post/Dc7fl2ulBQ5','https://www.threads.com/@lch1776244/post/Dc7fl2ulBQ5'],
 threadsOrientation:['data-curated.js','上方呈现羊毛毡绘本，下方保留原照片','上方保留原照片，下方呈现羊毛毡绘本'],
 negativeListContext:['rules.js',"return DENYLIST.indexOf(item.trim().toLowerCase()) >= 0 ? '' : item;",'return item;'],
 emersonOrientation:['data-curated.js','const HF_CURATED_SAMPLES =',"Object.values(HF_CURATED).filter(s=>s.source.promptUrl==='https://www.threads.com/@emersonigpost/post/DdvY_myCdNA').forEach(s=>{s.curation.output='一张上下对照海报，上方原照片，下方拼豆作品';});\nconst HF_CURATED_SAMPLES ="],
 emersonPromptComplete:['data-curated.js','const HF_CURATED_SAMPLES =',"Object.values(HF_CURATED).filter(s=>s.source.promptUrl==='https://www.threads.com/@emersonigpost/post/DeBXzYoCdWd').forEach(s=>{s.prompt=s.prompt.slice(0,1500);});\nconst HF_CURATED_SAMPLES ="],
 emersonSourcePage:['app.js','libHref({ page: String(page) })',"libHref({ page: String(page), source: '' })"],
 nalaContinuation:['app.js','(s.source.promptUrls || [])','([])'],
 nalaInterfaceText:['data-curated.js','确保**纸艺处理视觉','确保**纸艺处理视觉\\n查看另外 1 条'],
 nalaUsageNote:['data-curated.js','原帖末句停在','原帖已完整结束于'],
 exampleSelection:['app.js','picture = pictures[imageIndex].v;','picture = pictures[0].v;']
};
let applied=false;
function code(src){src=src.split('?')[0];let s=fs.readFileSync(path.join(root,src),'utf8');if(mutant&&mutations[mutant][0]===path.basename(src)){let [,a,b]=mutations[mutant];assert(s.includes(a),'missing mutation anchor '+mutant);s=s.replace(a,b);applied=true;}return s;}
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
const threadManifests=fs.readdirSync(path.join(root,'tools/curate/sources')).filter(f=>/^threads-.*\.json$/.test(f)).sort().map(f=>JSON.parse(fs.readFileSync(path.join(root,'tools/curate/sources',f))));
const threadRecords=new Map(threadManifests.flatMap(m=>m.cases.map(item=>[item.id,{manifest:m,item}])));
const primary=session(),dom=primary.dom,errors=primary.errors,blobs=primary.blobs;
const w=dom.window,d=w.document,wait=ms=>new Promise(r=>setTimeout(r,ms));let passed=0,failed=0;
async function check(name,fn){try{await fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.log('FAIL '+name+': '+e.message);}}
async function nav(hash){w.location.hash=hash;w.dispatchEvent(new w.Event('hashchange'));await wait(12);}
const q=s=>d.querySelector(s),all=s=>Array.from(d.querySelectorAll(s));
(async()=>{
 await wait(120);const cards=w.eval('STYLES'),images=cards.filter(s=>s.category==='image');
 await check('catalog-count-and-classification',()=>{assert.equal(cards.length,103);assert.equal(images.length,55);for(const cat of ['write','code','analyze','learn','business','life'])assert.equal(cards.filter(s=>s.category===cat).length,8);assert.equal(new Set(cards.map(s=>s.id)).size,103);});
 await check('source-evidence-and-license',()=>{for(const s of cards){if(s.source.provider==='threads'){
 const {manifest,item}=threadRecords.get(s.id);
 assert.equal(s.source.url,item.postUrl);assert.equal(s.cover.sourceUrl,item.postUrl);assert.equal(s.source.promptUrl,item.promptUrl);
 assert(s.source.url.startsWith(manifest.profileUrl+'/post/'));assert(s.source.promptUrl.startsWith(manifest.profileUrl+'/post/'));
 assert.equal(s.author,manifest.creator);assert.equal(s.source.contributor,manifest.creator);
 assert.equal(s.license,'CUSTOM');assert.equal(s.cover.license,'经授权收录');
 assert(s.licenseNote.includes('原作者保留权利'));assert(!('stars' in s.source));
 const raw=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.snapshot));
 assert.equal(require('crypto').createHash('sha256').update(raw).digest('hex'),s.source.sha256);
 assert(s.prompt.includes(raw.toString().trim()),'author prompt retained in full');
 continue;
 }assert(s.source.url.startsWith('https://github.com/'));assert(s.source.stars>=8000);assert(/^2026-09-(21|26)$/.test(s.source.checkedAt),'source verification date: '+s.id);assert(s.source.mode.includes('中文'));assert(s.curation.status.includes('not-'));if(s.category!=='image'){assert.equal(s.source.license,'MIT');assert.equal(s.license,'MIT');assert(s.licenseText.includes('Permission is hereby granted'));const raw=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.act+'.md'));assert.equal(require('crypto').createHash('sha256').update(raw).digest('hex'),s.source.sha256);}}});
 await check('image-input-preservation-and-credits',()=>{for(const s of images){assert.equal(s.track,'edit');assert(!s.local&&!s.cloud);assert(s.prompt.includes('上传图片'));assert(s.prompt.includes('【保持不变】'));assert(s.prompt.includes('不具备图像编辑能力'));assert(fs.existsSync(path.join(root,s.cover.src)));assert(s.cover.creator&&s.cover.licenseUrl);if(s.source.provider==='threads'){
 const {manifest,item}=threadRecords.get(s.id);assert(item);assert.equal(s.cover.creator,manifest.creator);
 assert.deepEqual(s.guide.filter(b=>b.t==='img').map(b=>b.v.src),item.images.map(i=>i.src));
 for(const img of item.images)assert.equal(require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,img.src))).digest('hex'),img.sha256);
 continue;
 }assert.equal(s.cover.license,'CC BY 4.0');const a=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.act.replace('案例 ','case-')+'-ATTRIBUTION.txt'),'utf8');assert(a.includes(s.cover.creator));}});
 await check('text-deliverables-and-retirement-audit',()=>{for(const s of cards.filter(s=>s.category!=='image')){assert.equal(s.track,'text');assert(!s.cover&&!s.local&&!s.cloud);assert(s.prompt.length>300);for(const label of ['【输入材料】','【处理步骤】','【交付内容】','【信息不足】'])assert(s.prompt.includes(label));assert(s.slots.length>0);}const a=JSON.parse(fs.readFileSync(path.join(root,'tools/curate/audit.json')));assert.equal(a.review.length,108);assert.equal(a.activeCount,cards.length);});
 await check('homepage-image-only-and-manual-carousel',async()=>{
   await nav('#/');assert(all('.card__link').length>0);
   for(const a of all('.card__link'))assert(images.some(s=>a.hash.endsWith(s.id)));
   const featured=all('.hero__index .tick').map(el=>el.getAttribute('data-id'));
   assert.equal(featured.length,8,'homepage has eight selected styles');assert.equal(new Set(featured).size,8);
   const first=q('.hero__plate').getAttribute('href');
   for(let i=0;i<8;i++){
     const hero=q('.hero__plate'),card=cards.find(s=>hero.hash.endsWith(s.id)),cover=hero.querySelector('.cover');
     assert.equal(card.id,featured[i]);assert.equal(card.category,'image');
     assert.equal(hero.querySelector('.plate').textContent,'№ '+String(i+1).padStart(2,'0')+' / 08');
     assert(cover.querySelector('.cover__credit').textContent.includes(card.cover.creator),'featured result retains attribution');
     if(card.source.provider==='threads'){
       assert(cover.classList.contains('cover--result'),'comparison preview shows generated result only');
       assert(parseFloat(cover.style.getPropertyValue('--hero-result-height'))>=200,'source photo is outside preview');
     }else assert(!cover.classList.contains('cover--result'),'standalone output is shown normally');
     q('[data-action="hero-next"]').click();
   }
   assert.equal(q('.hero__plate').getAttribute('href'),first,'eighth slide wraps to the first');
   q('[data-action="hero-prev"]').click();assert(q('.hero__plate').hash.endsWith(featured[7]));
   q('[data-action="hero-next"]').click();assert.equal(q('.hero__plate').getAttribute('href'),first);
   const original=cards.find(s=>s.id===featured[0]);await nav('#/style/'+original.id);
   assert.equal(q('.preview-image img').getAttribute('src'),original.cover.src,'detail retains the complete comparison');
   assert(!q('.preview-image').classList.contains('cover--result'));
 });
 await check('scene-and-category-filters',async()=>{
   await nav('#/library?track=text');assert.equal(Number(q('.lib-count b').textContent),48);assert.equal(all('.gallery .card').length,12);
   for(const cat of ['image','write','code','analyze','learn','business','life']){await nav('#/library?cat='+cat);assert.equal(Number(q('.lib-count b').textContent),cat==='image'?55:8);assert.equal(all('.gallery .card').length,cat==='image'?12:8);}
   const social=cards.filter(s=>s.uses.includes('社交封面'));await nav('#/library?use='+encodeURIComponent('社交封面'));
   assert.equal(Number(q('.lib-count b').textContent),social.length);assert.equal(all('.gallery .card').length,Math.min(12,social.length));
   assert(all('.gallery .card__link').every(a=>social.some(s=>a.hash==='#/style/'+s.id)));
   await nav('#/library?track=both');
   const codeTab=all('.catbar a').find(a=>new URLSearchParams(a.hash.split('?')[1]).get('cat')==='code');assert(codeTab);codeTab.click();await wait(12);
   assert.equal(all('.gallery .card').length,8,'changing from image filter to code clears conflicting track');
   assert.notEqual(new URLSearchParams(w.location.hash.split('?')[1]).get('track'),'both');
 });
 await check('pagination-pages-context-and-boundaries',async()=>{
   const ids=()=>all('.gallery .card__link').map(a=>a.hash);
   for(const [base,total] of [['#/',55],['#/library',103],['#/library?track=text',48]]) {
     const seen=[];await nav(base);
     assert(q('.pagination [aria-disabled="true"]'));assert(!q('.pagination [rel="prev"]'));
     for(let page=1;page<=Math.ceil(total/12);page++) {
       assert.equal(q('.pagination [aria-current="page"]').textContent,String(page));
       assert.equal(ids().length,Math.min(12,total-seen.length));seen.push(...ids());
       const next=q('.pagination [rel="next"]');
       if(page<Math.ceil(total/12)){assert(next);next.click();await wait(20);}else assert(!next);
     }
     assert.equal(new Set(seen).size,total,'no missing or duplicate cards across pages');
     q('.pagination [rel="prev"]').click();await wait(20);
     assert.equal(q('.pagination [aria-current="page"]').textContent,String(Math.ceil(total/12)-1));
   }
   await nav('#/library?cat=image&sort=new&q=照片&page=2');
   const pageLink=q('.pagination [rel="prev"]');assert(pageLink);
   const params=new URLSearchParams(pageLink.hash.split('?')[1]);
   for(const [k,v] of [['cat','image'],['sort','new'],['q','照片']])assert.equal(params.get(k),v);
   const back=w.location.hash;const first=q('.gallery .card__link');first.click();await wait(20);
   assert(all('a').some(a=>a.getAttribute('href')===back),'detail back link retains page');
   await nav(back);q('[data-action="sort"]').value='hot';q('[data-action="sort"]').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(20);
   assert.equal(q('.pagination [aria-current="page"]').textContent,'1');
   await nav('#/library?page=2');q('[data-action="filter-search"]').value='inkacalinka';q('[data-action="filter-search"]').dispatchEvent(new w.Event('input',{bubbles:true}));await wait(360);
   assert.equal(q('.pagination [aria-current="page"]').textContent,'1');assert.equal(ids().length,10);
   for(const value of ['-1','0','NaN','1.5','Infinity']) {await nav('#/library?page='+value);assert.equal(q('.pagination [aria-current="page"]').textContent,'1');}
   await nav('#/library?page=999');assert.equal(q('.pagination [aria-current="page"]').textContent,'9');assert.equal(ids().length,7);
   await nav('#/library?q=zzzzNoSuchPrompt&page=4');assert(!q('.pagination'));assert(q('.empty'));
   await nav('#/library?cat=code&page=4');assert.equal(q('.pagination [aria-current="page"]').textContent,'1');assert(!q('.pagination [rel="next"]'));
   const fresh=session({savedRaw:JSON.stringify(cards.slice(0,15).map(s=>s.id))});
   try {await wait(80);const fw=fresh.dom.window,fd=fw.document;fw.location.hash='#/library?saved=1&page=2';fw.dispatchEvent(new fw.Event('hashchange'));await wait(20);
     assert.equal(fd.querySelectorAll('.gallery .card').length,3);assert(fd.querySelector('.pagination [rel="prev"]').hash.includes('saved=1'));assert.deepEqual(fresh.errors,[]);
   }finally{fresh.dom.window.close();}
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
 await check('browse-groups-and-card-hierarchy',async()=>{
   const taxonomy=w.eval('TAXONOMY'),browse=w.eval('HF_BROWSE');
   const assigned=taxonomy.imageGroups.flatMap(g=>g.ids);
   assert.equal(new Set(assigned).size,assigned.length,'each reviewed image belongs to one browse group');
   assert(images.every(s=>browse.imageGroup(s).key!=='other'),'all existing images are organized');
   assert.equal(browse.imageGroup({id:'future-style',category:'image'}).key,'other','future content remains discoverable');
   assert.equal(browse.source({source:{provider:'threads',url:'https://www.threads.com/@new_creator/post/123',contributor:'New creator'}}).key,'threads:new_creator');
   assert.equal(browse.source({source:{url:'https://github.com/new/repository#item'}}).key,'github:new/repository');
   await nav('#/');assert.equal(all('.browse-group').length,7,'homepage links to all six populated groups');
   for(const group of taxonomy.imageGroups.filter(g=>g.key!=='other')){
     await nav('#/library?cat=image&group='+group.key);
     const expected=images.filter(s=>browse.imageGroup(s).key===group.key);
     assert.equal(Number(q('.lib-count b').textContent),expected.length,group.name);
     assert(all('.gallery .card').every(el=>expected.some(s=>s.id===el.dataset.id)));
     assert.equal(q('.browse-group[aria-current="page"]').textContent,group.name+expected.length);
     assert(all('.gallery .card__title').every(el=>el.tagName==='H3'));
     assert(all('.gallery .card__meta').every(el=>/\d+ 张案例/.test(el.textContent)));
     assert(all('.gallery .catpill').every(el=>el.textContent===group.name));
   }
   await nav('#/library?cat=code');assert(!q('.browse-groups'));
   assert(all('.card__meta').every(el=>/\d+ 项输入/.test(el.textContent)));
   await nav('#/library?group=craft');assert.equal(q('.nav__link.is-active').textContent,'图片风格');assert.equal(q('.mobilenav a.is-active').hash,'#/');
   await nav('#/library?group=other');await nav('#/');assert.equal(all('.browse-group').length,7,'homepage never inherits an empty selected group');
 });
 await check('browse-source-filter-context-and-reset',async()=>{
   const browse=w.eval('HF_BROWSE');
   const key='threads:inkacalinka';await nav('#/library?cat=image&source='+encodeURIComponent(key)+'&group=drawing&sort=new');
   const expected=images.filter(s=>browse.source(s).key===key&&browse.imageGroup(s).key==='drawing');
   assert.equal(Number(q('.lib-count b').textContent),expected.length);
   assert(all('.gallery .card').every(el=>expected.some(s=>s.id===el.dataset.id)));
   assert.equal(q('[data-action="source"]').value,key);
   assert(q('.active-filters').textContent.includes('michelle'));
   const selectedGroup=q('.browse-group[aria-current="page"]');selectedGroup.click();await wait(20);
   assert.equal(Number(q('.lib-count b').textContent),expected.length,'repeated selected filter is stable');
   const removeSource=all('.active-filters a').find(a=>a.getAttribute('aria-label').includes('michelle'));
   removeSource.click();await wait(20);
   assert.equal(new URLSearchParams(w.location.hash.split('?')[1]).get('group'),'drawing');
   assert.equal(q('[data-action="source"]').value,'');
   await nav('#/library?cat=image&source='+encodeURIComponent('github:jamez-bondos/awesome-gpt4o-images')+'&sort=new&page=2');
   const back=w.location.hash,ids=all('.gallery .card').map(el=>el.dataset.id);
   assert.equal(ids.length,6);assert(q('.pagination [rel="prev"]').hash.includes('source='));
   q('.gallery .card__link').click();await wait(20);assert.equal(q('.backlink').hash,back);
   w.history.back();await wait(50);assert.equal(w.location.hash,back);assert.deepEqual(all('.gallery .card').map(el=>el.dataset.id),ids,'browser Back restores the source-filtered page');
   w.history.forward();await wait(50);assert(q('.gh__title'));assert.equal(q('.backlink').hash,back,'browser Forward retains the return destination');
   q('.backlink').click();await wait(20);assert.deepEqual(all('.gallery .card').map(el=>el.dataset.id),ids);
   const select=q('[data-action="source"]');select.value=key;select.dispatchEvent(new w.Event('change',{bubbles:true}));await wait(20);
   assert.equal(q('.pagination [aria-current="page"]').textContent,'1');assert.equal(Number(q('.lib-count b').textContent),10);
   assert.equal(d.activeElement,q('[data-action="source"]'),'select retains keyboard focus');
   await nav('#/library?cat=image&group=objects&source='+encodeURIComponent(key));
   assert(q('.empty'));assert(q('.active-filters').textContent.includes('创意物件'));
   assert.equal(q('.empty a').hash,'#/library?cat=image','reset stays in image collection');
   q('.empty a').click();await wait(20);assert.equal(Number(q('.lib-count b').textContent),images.length);
   await nav('#/library?cat=image&group=drawing&source='+encodeURIComponent(key));
   const code=all('.catbar a').find(a=>new URLSearchParams(a.hash.split('?')[1]).get('cat')==='code');code.click();await wait(20);
   assert.equal(Number(q('.lib-count b').textContent),8,'new category clears image/source constraints');
   const fresh=session({savedRaw:JSON.stringify(['threads-inka-minimal-paper','threads-pet-doodle','code-reviewer'])});
   try {
     await wait(80);const fw=fresh.dom.window,fd=fw.document;
     fw.location.hash='#/library?saved=1&source='+encodeURIComponent(key);fw.dispatchEvent(new fw.Event('hashchange'));await wait(20);
     assert.deepEqual(Array.from(fd.querySelectorAll('.gallery .card'),el=>el.dataset.id),['threads-inka-minimal-paper'],'source filter remains inside saved collection');
     const reset=fd.querySelector('.lib-bar a[href="#/library?saved=1"]');assert(reset);reset.click();await wait(20);
     assert.equal(fd.querySelectorAll('.gallery .card').length,3,'reset retains all saved content');assert.deepEqual(fresh.errors,[]);
     fw.location.hash='#/library?saved=1&cat=image';fw.dispatchEvent(new fw.Event('hashchange'));await wait(20);
     assert(fd.querySelector('.lib-bar a[href="#/library?saved=1"]'),'image category can be cleared within favorites');
   } finally {fresh.dom.window.close();}
 });
 await check('browse-multiword-and-safe-navigation',async()=>{
   await nav('#/library?q='+encodeURIComponent('插画 michelle'));
   assert(all('.gallery .card').length>0);assert(all('.gallery .card').every(el=>el.dataset.id.startsWith('threads-inka-')));
   q('[data-action="palette-open"]').click();const input=q('#palette-input');input.value='插画 michelle';input.dispatchEvent(new w.Event('input',{bubbles:true}));await wait(20);
   assert(all('#palette-list a').length>0);assert(all('#palette-list a').every(a=>a.hash.startsWith('#/style/threads-inka-')));
   d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
   await nav('#/library?cat=image&group=unrecognized&source=unrecognized&q=%E0%A4%A');
   assert.equal(Number(q('.lib-count b').textContent),images.length,'malformed encoding and retired facet values do not break browsing');
   await nav('#/library?track=text&cat=code&group=drawing');assert.equal(Number(q('.lib-count b').textContent),8);
   const search=q('[data-action="filter-search"]');search.value='inkacalinka';search.dispatchEvent(new w.Event('input',{bubbles:true}));
   q('.gallery .card__link').click();await wait(400);
   assert(q('.gh__title'),'newer navigation cancels a pending search');assert(w.location.hash.startsWith('#/style/'));
   await nav('#/library?cat=image&q='+encodeURIComponent('<img src=x onerror=alert(1)>'));
   assert(q('.empty'));assert(!q('.active-filters img'),'search chips escape untrusted input');
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
 await check('image-tap-zoom-and-drag-suppression',async()=>{
   function pointer(surface,type,x,y){
     const event=new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});
     Object.defineProperty(event,'pointerId',{value:31});Object.defineProperty(event,'isPrimary',{value:true});surface.dispatchEvent(event);
   }
   function clickImage(surface,detail=1){surface.querySelector('img').dispatchEvent(new w.MouseEvent('click',{bubbles:true,cancelable:true,button:0,detail}));}
   function tap(surface){pointer(surface,'pointerdown',100,100);pointer(surface,'pointerup',101,100);clickImage(surface);}
   function assertOpenAndClose(surface,expected){
     const viewer=q('dialog.image-viewer');assert(viewer&&viewer.open,'clicking the image itself opens the viewer');
     assert.equal(viewer.querySelector('img').getAttribute('src'),expected,'viewer opens the currently displayed image');
     viewer.querySelector('.image-viewer__close').click();assert(!q('dialog.image-viewer'));
     assert.equal(d.activeElement,surface,'closing restores focus to the image control');assert.notEqual(d.body.style.overflow,'hidden');
   }
   const single=images.find(s=>s.guide.filter(b=>b.t==='img').length===1);assert(single);
   await nav('#/style/'+single.id);let surface=q('.preview-image');assert(surface,'single image exposes a clickable preview');
   assert.equal(surface.tagName,'BUTTON','image control has native keyboard activation');assert.equal(surface.type,'button');
   tap(surface);assertOpenAndClose(surface,surface.querySelector('img').getAttribute('src'));
   const s=cards.find(s=>s.id==='threads-inka-minimal-paper'),pictures=s.guide.filter(b=>b.t==='img');
   await nav('#/style/'+s.id);surface=q('.preview-image');assert(surface);
   q('.example-carousel [data-direction="1"]').click();tap(surface);assertOpenAndClose(surface,pictures[1].v.src);
   q('.example-gallery [data-image-index="2"]').click();tap(surface);assertOpenAndClose(surface,pictures[2].v.src);
   // A short drag must not open the viewer; nor may returning to the start erase a drag.
   for(const [label,moves] of [
     ['short horizontal drag',[[120,100]]],
     ['vertical scroll gesture',[[100,130]]],
     ['out-and-back drag',[[180,100],[100,100]]]
   ]){
     pointer(surface,'pointerdown',100,100);for(const [x,y] of moves)pointer(surface,'pointermove',x,y);
     const [x,y]=moves.at(-1);pointer(surface,'pointerup',x,y);clickImage(surface);
     assert(!q('dialog.image-viewer'),label+' does not accidentally enlarge');
     assert.equal(surface.querySelector('img').getAttribute('src'),pictures[2].v.src,label+' does not turn a page');
   }
   pointer(surface,'pointerdown',200,100);pointer(surface,'pointermove',60,105);pointer(surface,'pointerup',60,105);clickImage(surface);
   assert(!q('dialog.image-viewer'),'completed swipe does not also open the viewer');
   assert.equal(surface.querySelector('img').getAttribute('src'),pictures[3].v.src,'image button retains horizontal swipe navigation');
   tap(surface);assertOpenAndClose(surface,pictures[3].v.src);
   pointer(surface,'pointerdown',100,100);pointer(surface,'pointermove',125,100);pointer(surface,'pointercancel',125,100);clickImage(surface);
   assert(!q('dialog.image-viewer'),'cancelled drag does not accidentally enlarge');
   tap(surface);assertOpenAndClose(surface,pictures[3].v.src);
   pointer(surface,'pointerdown',100,100);pointer(surface,'pointermove',120,100);pointer(surface,'pointerup',120,100);
   clickImage(surface,0);assertOpenAndClose(surface,pictures[3].v.src);
 });
 await check('threads-gallery-source-and-search',async()=>{
   const imported=cards.filter(s=>s.source.provider==='threads');assert.equal(imported.length,37);
   for(const [term,count] of [['Chloe_Lai',4],['inkacalinka',10],['blissful_nala',10],['emersonigpost',13]]){await nav('#/library?cat=image&q='+term);assert.equal(Number(q('.lib-count b').textContent),count);assert.equal(all('.gallery .card').length,Math.min(12,count));}
   for(const s of imported){
     await nav('#/style/'+s.id);const pictures=s.guide.filter(b=>b.t==='img');
     assert.equal(all('.detail-preview figure').length,1,'one large preview, not a stacked image wall');
     const thumbs=all('.example-gallery [data-action="image-select"]');assert.equal(thumbs.length,pictures.length>1?pictures.length:0);
     const source=q('.srcbox');assert(!source.textContent.includes('仓库热度'));assert(source.querySelector('a[href="'+s.source.promptUrl+'"]'));
     for(const url of s.source.promptUrls || [])assert(source.querySelector('a[href="'+url+'"]'),'all author continuation sources are linked');
     for(let i=0;i<pictures.length;i++){
       if(thumbs.length)thumbs[i].click();assert.equal(q('.detail-preview .cover img').getAttribute('src'),pictures[i].v.src);if(thumbs.length)assert.equal(thumbs[i].getAttribute('aria-pressed'),'true');
       const zoom=q('.preview-zoom');zoom.click();const dialog=q('dialog.image-viewer');assert(dialog&&dialog.open);
       assert.equal(dialog.querySelector('img').getAttribute('src'),pictures[i].v.src);
       assert(dialog.textContent.includes('经授权收录'));dialog.querySelector('button').click();assert.equal(d.activeElement,zoom);
     }
     const ex=all('.takeaway a[download]');const md=blobs.get(ex.find(a=>a.download.endsWith('.md')).href);assert(md.includes(s.licenseNote));
   }
 });
 await check('emerson-original-prompts-complete-in-copy',async()=>{
   const imported=cards.filter(s=>s.source.provider==='threads'&&s.source.url.startsWith('https://www.threads.com/@emersonigpost/post/'));
   assert.equal(imported.length,13,'thirteen distinct Emerson prompts are published');
   for(const s of imported){
     const raw=fs.readFileSync(path.join(root,'tools/curate/sources',s.source.snapshot),'utf8').trim();
     assert(raw.length>500,'the source snapshot contains the full author instruction: '+s.id);
     const start='【作者原始提示词】\n',end='\n\n【保持不变】';
     assert(s.prompt.includes(start)&&s.prompt.includes(end),'source and site-added checks have explicit boundaries');
     const original=s.prompt.slice(s.prompt.indexOf(start)+start.length,s.prompt.indexOf(end));
     assert.equal(original,raw,'author text is complete and unchanged: '+s.id);
     assert(!/查看另外 \d+ 条|了解更多|完整 Prompt 放這裡/.test(original),'interface labels and social introductions are outside the prompt');
     await nav('#/style/'+s.id);
     assert(q('.prompt__body').textContent.includes(raw),'detail contains the entire author instruction');
     primary.copied='';q('.gh__actions [data-action="copy-prompt"]').click();await wait(1);
     assert(primary.copied.includes(raw),'copy includes the final source paragraph: '+s.id);
   }
 });
 await check('explicit-negative-list-keeps-positive-policy-checks',()=>{
   const perler=cards.find(s=>s.source.promptUrl==='https://www.threads.com/@emersonigpost/post/DdvY_myCdNA');assert(perler);
   const original=perler.prompt,opts={taxonomy:w.eval('TAXONOMY')};
   function policyFor(prompt,change){
     const card=JSON.parse(JSON.stringify(perler));card.prompt=prompt;if(change)change(card);
     return w.HFRules.checkCard(card,opts).policy.filter(p=>p.msg.includes('IP 风险词'));
   }
   assert.equal(policyFor(original).length,0,'the complete author prompt excludes LEGO rather than requests it');
   assert.equal(perler.prompt,original,'validation never rewrites the source prompt');
   for(const text of ['严格避免：LEGO、卡通。','請使用拼豆。嚴格避免：LEGO、卡通。','前文！严格避免: lego 、卡通。','前文\n严格避免：LEGO、卡通。','严格避免：LEGO、卡通。嚴格避免：Disney、卡通。']){
     assert.equal(policyFor(text).length,0,'closed sentence-start negative enumeration accepted: '+text);
   }
   for(const text of ['请生成 LEGO 造型。','严格避免：LEGO、卡通','严格避免 LEGO、卡通。','严格避免：LEGO。','请按严格避免：LEGO、卡通。','严格避免：LEGO风格、卡通。','严格避免：LEGO、卡通！','严格避免：LEGO、卡通。使用 LEGO 造型。']){
     assert(policyFor(text).length>0,'positive, ambiguous or unclosed use remains blocked: '+text);
   }
   assert(policyFor(original+'\n请生成 LEGO 造型。').length>0,'a valid negative list cannot hide a separate positive request');
   assert(policyFor(original,c=>{c.name='LEGO 拼豆';}).length>0,'name remains scanned');
   assert(policyFor(original,c=>{c.guide.push({t:'p',v:'使用 LEGO 造型'});}).length>0,'guide remains scanned');
   assert(policyFor(original,c=>{c.guide.push({t:'p',v:'严格避免：LEGO、卡通。'});}).length>0,'the prompt-only exception does not expand to guide fields');
 });
 await check('emerson-perler-horizontal-output',async()=>{
   const s=cards.find(s=>s.source.promptUrl==='https://www.threads.com/@emersonigpost/post/DdvY_myCdNA');assert(s,'Perler source exists');
   assert(s.curation.output.includes('左')&&s.curation.output.includes('右'),'deliverable describes left/right panels');
   assert(!/上下对照|上下分割|上方(?:保留)?原照|上半(?:部|部分)/.test(s.curation.output),'deliverable must not replace horizontal comparison with vertical panels');
   assert(/左右兩個等寬面板/.test(s.prompt)&&/不得上下分割/.test(s.prompt),'horizontal source instructions remain intact');
   await nav('#/style/'+s.id);
   assert(q('.detail-guide').textContent.includes(s.curation.output),'the same horizontal deliverable appears in the guide');
 });
 await check('emerson-source-pagination-and-return',async()=>{
   const key='threads:emersonigpost',browse=w.eval('HF_BROWSE');
   const expected=images.filter(s=>browse.source(s).key===key).map(s=>s.id).sort();assert.equal(expected.length,13);
   await nav('#/library?cat=image&source='+encodeURIComponent(key)+'&sort=new');
   const ids=()=>all('.gallery .card').map(el=>el.dataset.id),first=ids();
   assert.equal(first.length,12);assert.equal(Number(q('.lib-count b').textContent),13);
   const next=q('.pagination [rel="next"]');assert(next);
   assert.equal(new URLSearchParams(next.hash.split('?')[1]).get('source'),key,'next page retains the account filter');
   next.click();await wait(20);
   assert.equal(q('[data-action="source"]').value,key);assert.equal(q('.pagination [aria-current="page"]').textContent,'2');
   assert.equal(Number(q('.lib-count b').textContent),13);assert.equal(ids().length,1);assert(!q('.pagination [rel="next"]'));
   assert.deepEqual(first.concat(ids()).sort(),expected,'the two pages show every account card exactly once');
   const pageTwo=w.location.hash,lastId=ids()[0];
   q('.gallery .card__link').click();await wait(20);assert.equal(q('.backlink').hash,pageTwo);
   q('.backlink').click();await wait(20);assert.deepEqual(ids(),[lastId],'detail return restores the account second page');
   const prev=q('.pagination [rel="prev"]');assert(prev);
   assert.equal(new URLSearchParams(prev.hash.split('?')[1]).get('source'),key,'previous page retains the account filter');
   prev.click();await wait(20);assert.deepEqual(ids(),first);assert.equal(q('.pagination [aria-current="page"]').textContent,'1');
 });
 await check('nala-source-specific-layout-notes',async()=>{
   for(const s of cards.filter(s=>s.id.startsWith('threads-nala-')))assert(!/查看另外|了解更多/.test(s.prompt),'interface labels are excluded from the author prompt');
   const paper=cards.find(s=>s.id==='threads-nala-layered-paper');
   assert(paper.guide.some(b=>b.t==='warn'&&b.v.includes('原帖末句停在')),'unfinished source sentence is disclosed');
   assert(paper.prompt.includes('使用细腻哑光卡纸'),'second author reply is preserved');
   const clay=cards.find(s=>s.id==='threads-nala-clay-stickers');
   assert(clay.guide.some(b=>b.t==='warn'&&b.v.includes('不具有透明通道')),'JPEG previews do not imply PNG alpha');
   for(const id of ['dreamcore','surreal-color','character-turnaround'])assert(cards.find(s=>s.id==='threads-nala-'+id).guide.some(b=>b.t==='warn'&&b.v.includes('关键词')),'reference adaptation is disclosed');
   const stamp=cards.find(s=>s.id==='threads-nala-vintage-stamp');assert(stamp.curation.output.includes('原照缩略图'));
 });
 await check('example-carousel-arrows-swipe-and-viewer',async()=>{
   const s=cards.find(s=>s.id==='threads-inka-minimal-paper');const pictures=s.guide.filter(b=>b.t==='img');
   await nav('#/style/'+s.id);
   const src=()=>q('.example-carousel .cover img').getAttribute('src');
   const step=dir=>q('.example-carousel [data-direction="'+dir+'"]').click();
   step(1);assert.equal(src(),pictures[1].v.src);
   step(-1);assert.equal(src(),pictures[0].v.src);
   step(-1);assert.equal(src(),pictures[pictures.length-1].v.src,'previous wraps to last');
   step(1);assert.equal(src(),pictures[0].v.src);
   const surface=q('.example-carousel .cover');
   function pointer(type,x,y){const e=new w.MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperty(e,'pointerId',{value:1});surface.dispatchEvent(e);}
   pointer('pointerdown',200,100);pointer('pointerup',60,110);assert.equal(src(),pictures[1].v.src,'left swipe advances');
   pointer('pointerdown',60,100);pointer('pointerup',200,110);assert.equal(src(),pictures[0].v.src,'right swipe returns');
   pointer('pointerdown',200,100);pointer('pointerup',180,230);assert.equal(src(),pictures[0].v.src,'vertical gesture does not change image');
   pointer('pointerdown',200,100);pointer('pointercancel',60,110);pointer('pointerup',60,110);assert.equal(src(),pictures[0].v.src,'cancelled gesture ignored');
   const vertical=new w.WheelEvent('wheel',{deltaY:100,cancelable:true});surface.dispatchEvent(vertical);assert(!vertical.defaultPrevented);
   surface.dispatchEvent(new w.WheelEvent('wheel',{deltaX:80,cancelable:true}));assert.equal(src(),pictures[1].v.src);
   q('.example-carousel').dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));assert.equal(src(),pictures[2].v.src);
   assert.equal(q('.example-counter').textContent,'3 / '+pictures.length);
   q('.preview-zoom').click();const viewer=q('.image-viewer');assert.equal(viewer.querySelector('img').getAttribute('src'),pictures[2].v.src);
   viewer.querySelector('[data-direction="1"]').click();assert.equal(viewer.querySelector('img').getAttribute('src'),pictures[3].v.src);assert.equal(src(),pictures[3].v.src);
   viewer.dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));assert.equal(viewer.querySelector('img').getAttribute('src'),pictures[2].v.src);
   viewer.querySelector('.image-viewer__close').click();assert(!q('.image-viewer'));assert.equal(q('.example-gallery [aria-pressed="true"]').getAttribute('data-image-index'),'2');
   await nav('#/style/cyber-night-market');assert(!q('.example-carousel'));assert(!q('.example-arrow'));q('.preview-zoom').click();assert(!q('.image-viewer .example-arrow'));q('.image-viewer__close').click();
 });
 await check('complete-long-prompts-with-bounded-size',()=>{
   const sample=cards.find(s=>s.id==='threads-inka-pastel-crayon');assert(sample.prompt.length>4000);
   const opts={taxonomy:w.eval('TAXONOMY')};
   assert(!w.HFRules.checkCard(sample,opts).errors.some(e=>e.path==='prompt'),'full source accepted');
   const oversized={...sample,prompt:'A'.repeat(8001)};
   assert(w.HFRules.checkCard(oversized,opts).errors.some(e=>e.path==='prompt'),'oversized edit prompt rejected');
   const schema=JSON.parse(fs.readFileSync(path.join(root,'schema/style-card.schema.json')));let count=0;
   function walk(v){if(!v||typeof v!=='object')return;if(v.properties&&v.properties.prompt&&v.properties.prompt.maxLength){count++;assert.equal(v.properties.prompt.maxLength,w.HFRules.LIMITS.prompt.max);}Object.values(v).forEach(walk);}
   walk(schema);assert(count>=4,'schema prompt branches checked');
 });
 await check('threads-distinct-content-and-layout',async()=>{
   const imported=cards.filter(s=>s.source.provider==='threads');
   const prompts=imported.map(s=>fs.readFileSync(path.join(root,'tools/curate/sources',s.source.snapshot),'utf8').replace(/\s/g,'').toLowerCase());
   assert.equal(new Set(prompts).size,prompts.length,'no repeated original prompts');
   const hashes=[...threadRecords.values()].flatMap(r=>r.item.images.map(i=>i.sha256));assert.equal(new Set(hashes).size,hashes.length,'no repeated source images');
   for(const id of ['threads-inka-needle-felt','threads-inka-travel-magnet']){
     const s=cards.find(c=>c.id===id);assert(s);await nav('#/style/'+id);
     assert(s.curation.output.includes('下方保留原照片'),'retain reversed source layout');
     assert(q('.detail-guide').textContent.includes(s.curation.output));
   }
 });
 await check('disclosures-and-filtered-backlink',async()=>{await nav('#/library?cat=code');await nav('#/style/code-reviewer');assert.equal(q('.backlink').getAttribute('href'),'#/library?cat=code');for(const el of all('.detail-guide,.detail-source')){assert(!el.open);el.querySelector('summary').click();assert(el.open);el.querySelector('summary').click();assert(!el.open);}});
 await check('about-and-retired-route-exits',async()=>{await nav('#/about');assert(q('#view').textContent.includes('尚未由本站逐条运行验证'));assert(q('#view').textContent.includes('Fabric'));for(const h of ['#/style/novelist','#/creators','#/submit','#/missing']){await nav(h);assert(q('#view h1'));assert(q('#view a[href^="#/"]'));}});
 await check('no-runtime-errors',()=>assert.deepEqual(errors,[]));
 if(mutant)assert(applied,'mutation not applied');
 dom.window.close();console.log(`${passed}/${passed+failed} reviewed-contract groups passed`);if(!failed)console.log('JSDOM 全部通过');process.exitCode=failed?1:0;
})().catch(e=>{dom.window.close();console.error(e);process.exitCode=1;});
