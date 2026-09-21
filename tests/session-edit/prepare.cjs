const fs=require('fs');
const root='tests/session-edit',legacy='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a';
if(fs.existsSync(root+'/private/rest.json'))throw Error('Fixture manifest already exists. Keep its cleanup identities; do not overwrite it.');
fs.mkdirSync(root+'/private',{recursive:true});fs.mkdirSync(root+'/results',{recursive:true});
// Reuse the reviewed synthetic-user setup, with new random identities and private files.
let seed=fs.readFileSync(legacy+'/work/26-rest-prepare.cjs','utf8')
 .replaceAll('work/26-rest.private.json',root+'/private/rest.json')
 .replaceAll('work/26-rest-seed.private.sql',root+'/private/seed.sql')
 .replaceAll('outputs/26-synthetic-manifest.json',root+'/results/synthetic-manifest.json')
 .replaceAll('outputs/26-rest-cleanup.sql',root+'/cleanup.sql').replaceAll('test26','test27').replaceAll('simple26-','simple27-');
require('vm').runInNewContext(seed,{require,console});
console.log('Prepared isolated staging fixture. No SQL was executed.');
