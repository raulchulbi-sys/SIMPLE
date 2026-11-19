'use strict';
// Loopback-only disposable PostgreSQL. No remote credentials or existing clusters.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),bin=process.env.SIMPLE_POSTGRES_BIN;
const options=process.argv.slice(2);
if(options.length>1||(options[0]&&!options[0].startsWith('--test-name-pattern=')))throw Error('Unsupported option');
if(!bin||!fs.existsSync(path.join(bin,process.platform==='win32'?'initdb.exe':'initdb')))throw Error('Set SIMPLE_POSTGRES_BIN');
const parent=path.join(root,'.tests-local');fs.mkdirSync(parent,{recursive:true});
const dir=fs.mkdtempSync(path.join(parent,'premium-review-')),data=path.join(dir,'data');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
function command(name,args){const r=spawnSync(path.join(bin,name+(process.platform==='win32'?'.exe':'')),args,{env,encoding:'utf8',windowsHide:true,timeout:60000});if(r.status!==0)throw Error(r.stderr||r.error?.message||name+' failed');return r.stdout;}
let started=false;
try{
 command('initdb',['-D',data,'-U','simple_local','--auth=trust','--encoding=UTF8','--no-locale']);
 command('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o','-h 127.0.0.1 -p 55451','-w','start']);started=true;
 const args=['-X','-q','-h','127.0.0.1','-p','55451','-U','simple_local','-v','ON_ERROR_STOP=1','-d','postgres'];
 command('psql',[...args,'-c','create database simple_premium_review_local;']);
 command('psql',[...args,'-c',"comment on database simple_premium_review_local is 'SIMPLE disposable Premium review security';"]);
 const r=spawnSync(process.execPath,['--test','--test-concurrency=1',...options,'tests/premium-review-security/postgres.test.mjs'],{cwd:root,env:{...env,SIMPLE_LOCAL_PSQL:path.join(bin,process.platform==='win32'?'psql.exe':'psql'),SIMPLE_LOCAL_TEST_DATA:data},encoding:'utf8',timeout:240000,windowsHide:true});
 const out=path.join(root,'tests/premium-review-security/results');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,options.length?'filtered.tap':'postgres.tap'),(r.stdout||'')+(r.stderr||''));
 console.log(r.stdout);if(r.status!==0)throw Error(r.stderr||'Premium review regression failed');
}finally{if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log('Own disposable cluster stopped: '+dir);}
