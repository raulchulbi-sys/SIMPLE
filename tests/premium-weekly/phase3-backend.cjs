const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const sql=fs.readFileSync(path.join(__dirname,'phase3-backend.sql'),'utf8');
assert(sql.startsWith('-- STAGING ONLY'));assert(sql.includes('begin;'));assert(sql.trim().endsWith('rollback;'));
assert(!/\b(openai|commit;)\b/i.test(sql));
if(process.argv[2]==='verify-timezone'){
 const result=JSON.parse(fs.readFileSync(path.join(__dirname,'results/phase3-timezone.json'),'utf8'));
 assert.equal(result.project_id,'dmqjexigdnfzobarhnib');assert.equal(result.transaction,'rollback');assert.equal(result.pass,9);assert.equal(result.total,9);
 assert(Object.values(result.checks).every(x=>x===true));console.log(JSON.stringify({pass:9,total:9,boundary:result.actual_boundary_exercised,secondaryBoundary:result.secondary_boundary_exercised}));
}else if(process.argv[2]==='verify'){
 const result=JSON.parse(fs.readFileSync(path.join(__dirname,'results/phase3-backend.json'),'utf8'));
 assert.equal(result.project_id,'dmqjexigdnfzobarhnib');assert.equal(result.transaction,'rollback');
 assert(result.total>=35);assert.equal(result.pass,result.total);assert(Object.values(result.checks).every(x=>x===true));
 console.log(JSON.stringify({pass:result.pass,total:result.total,transaction:result.transaction}));
}else console.log(JSON.stringify({sql:'tests/premium-weekly/phase3-backend.sql',bytes:Buffer.byteLength(sql)}));
