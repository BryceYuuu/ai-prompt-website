// Each reviewed-catalog regression group is exercised by a destructive in-memory mutation.
// Covers the current reviewed catalog; legacy dual-track features are not distributed.
const {spawnSync}=require('child_process');
const path=require('path');
const cases=['text','disclosure','about','runtime','count','source','image','prompt','license','catalog','copy','export','detail','hero','search','sourceUI'];
const selected=process.argv[2]?cases.filter(x=>x===process.argv[2]):cases;
if(!selected.length)throw Error('Unknown mutation');
let missed=0;
for(const name of selected){const p=spawnSync(process.execPath,[path.join(__dirname,'curate/regression.js'),path.resolve(__dirname,'..'),name],{encoding:'utf8',env:process.env});const caught=p.status!==0&&/^FAIL /m.test(p.stdout);console.log((caught?'CAUGHT ':'MISSED ')+name);if(!caught){missed++;console.log(p.stdout,p.stderr);}}
console.log(`${selected.length-missed}/${selected.length} mutations caught`);if(!missed)console.log('变异测试通过');process.exitCode=missed?1:0;
