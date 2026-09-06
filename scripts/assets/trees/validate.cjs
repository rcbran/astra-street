const fs=require('node:fs');
const validator=require('/tmp/astra-tree-assets/validator/node_modules/gltf-validator');
(async()=>{for(const species of ['fir_tree_01','pine_tree_01','tree_small_02']){
const p='/tmp/astra-tree-assets/output/'+species;
const report=await validator.validateBytes(new Uint8Array(fs.readFileSync(p+'.glb')),{uri:species+'.glb'});
fs.writeFileSync(p+'-validation.json',JSON.stringify(report,null,2));
console.log(species,report.issues.numErrors,'errors',report.issues.numWarnings,'warnings');
if(report.issues.numErrors)process.exitCode=1;
}})();
