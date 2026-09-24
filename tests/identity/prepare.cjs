const fs=require('fs'),vm=require('vm');
const root='tests/identity',legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
if(fs.existsSync(root+'/private/rest.json'))throw Error('Fixture exists: retain manifest and clean it first');
fs.mkdirSync(root+'/private',{recursive:true});fs.mkdirSync(root+'/results',{recursive:true});
let source=fs.readFileSync(legacy+'/work/26-rest-prepare.cjs','utf8')
 .replaceAll('work/26-rest.private.json',root+'/private/rest.json')
 .replaceAll('work/26-rest-seed.private.sql',root+'/private/seed.sql')
 .replaceAll('outputs/26-synthetic-manifest.json',root+'/results/manifest.json')
 .replaceAll('outputs/26-rest-cleanup.sql',root+'/private/cleanup.sql')
 .replaceAll('test26','test28').replaceAll('simple26-','simple28-');
vm.runInNewContext(source,{require,console});
console.log('Prepared synthetic staging fixture; no SQL executed.');
