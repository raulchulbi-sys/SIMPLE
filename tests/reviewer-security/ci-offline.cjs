'use strict';
// CI entrypoint: explicit local sources, no credential/env discovery or live mode.
const path=require('node:path'),assert=require('node:assert/strict');
const {run}=require('./consumer-entry-unit.cjs');
const {prepareSql,SCHEMA}=require('./prepare-projection-sql.cjs');
async function main(){
 const args=process.argv.slice(2);assert(args[0]==='--source-root'&&args.length===2,'Only --source-root is accepted; no live/project/credential option');
 const root=path.resolve(args[1]),prepared=prepareSql(root);
 assert(prepared.sql.trimEnd().endsWith('rollback;'));assert(!/\bcommit\s*;/i.test(prepared.sql));
 assert(!/\b(?:insert\s+into|update|delete\s+from|alter\s+table|drop\s+(?:table|schema|function))\s+(?:public|coach_private)\./i.test(prepared.sql));
 assert(prepared.sql.includes('create schema '+SCHEMA));
 const result=await run(root);
 console.log(JSON.stringify({...result,preparedSqlOnly:{checks:prepared.plannedChecks,executed:false,sourceSha256:prepared.sourceSha256},notRepeated:['four historical JWT/REST/revocation coverages','existing runtime/adapter/bridge suites','real browser/staging suites']}));
}
if(require.main===module)main().catch(()=>{console.error('offline_reviewer_regression_failed');process.exitCode=1;});
module.exports={main};
