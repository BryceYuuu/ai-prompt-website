// Each reviewed-catalog regression group is exercised by a destructive in-memory mutation.
// Covers the current reviewed catalog; legacy dual-track features are not distributed.
const {spawnSync}=require('child_process');
const path=require('path');
const cases=['keywords','text','disclosure','about','runtime','count','source','image','prompt','license','catalog','copy','export','detail','hero','search','sourceUI','savedPersist','savedLoad','savedFilter','savedScope','categoryTrack','savedUnavailable','slotValue','slotCopy','slotReset','slotHTML','slotPrivacy','preparedDownload','imageViewer','threadsLicense','exampleSelection'];
const selected=process.argv[2]?cases.filter(x=>x===process.argv[2]):cases;
if(!selected.length)throw Error('Unknown mutation');
const expected = {
 keywords:'keyword-aliases-in-library-and-palette', text:'text-deliverables-and-retirement-audit',
 disclosure:'disclosures-and-filtered-backlink', about:'about-and-retired-route-exits',
 runtime:'no-runtime-errors', count:'catalog-count-and-classification', source:'source-evidence-and-license',
 image:'image-input-preservation-and-credits', prompt:'image-input-preservation-and-credits', license:'source-evidence-and-license',
 catalog:'scene-and-category-filters', copy:'all-card-details-copy-and-export', export:'all-card-details-copy-and-export',
 detail:'all-card-details-copy-and-export', hero:'homepage-image-only-and-manual-carousel', search:'search-and-empty-state', sourceUI:'all-card-details-copy-and-export',
 savedPersist:'saved-collection-toggle-filter-and-reload', savedLoad:'saved-collection-toggle-filter-and-reload', savedFilter:'saved-collection-toggle-filter-and-reload',
 savedScope:'saved-collection-toggle-filter-and-reload', categoryTrack:'scene-and-category-filters', savedUnavailable:'saved-storage-corruption-and-unavailability',
 slotValue:'prompt-builder-preview-copy-reset-and-safe-drafts', slotCopy:'prompt-builder-preview-copy-reset-and-safe-drafts',
 slotReset:'prompt-builder-preview-copy-reset-and-safe-drafts', slotHTML:'prompt-builder-preview-copy-reset-and-safe-drafts', slotPrivacy:'prompt-builder-preview-copy-reset-and-safe-drafts',
 preparedDownload:'prompt-builder-preview-copy-reset-and-safe-drafts', imageViewer:'image-viewer-content-and-close', threadsLicense:'source-evidence-and-license', exampleSelection:'threads-gallery-source-and-search'
};
let missed=0;
for(const name of selected){const p=spawnSync(process.execPath,[path.join(__dirname,'curate/regression.js'),path.resolve(__dirname,'..'),name],{encoding:'utf8',env:process.env});const caught=p.status!==0&&p.stdout.split('\n').some(line=>line.startsWith('FAIL '+expected[name]+':'));console.log((caught?'CAUGHT ':'MISSED ')+name);if(!caught){missed++;console.log(p.stdout,p.stderr);}}
console.log(`${selected.length-missed}/${selected.length} mutations caught`);if(!missed)console.log('变异测试通过');process.exitCode=missed?1:0;
