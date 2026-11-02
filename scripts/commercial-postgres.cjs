'use strict';
// New disposable PostgreSQL cluster only. Never connects to an existing server.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),bin=process.env.SIMPLE_POSTGRES_BIN;
if(!bin || !fs.existsSync(path.join(bin,process.platform==='win32'?'initdb.exe':'initdb')))throw Error('Set SIMPLE_POSTGRES_BIN to an existing PostgreSQL 17 bin directory');
const parent=path.join(root,'.tests-local');fs.mkdirSync(parent,{recursive:true});
const dir=fs.mkdtempSync(path.join(parent,'postgres-')),data=path.join(dir,'data');
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('PG')));
function command(name,args){const r=spawnSync(path.join(bin,name+(process.platform==='win32'?'.exe':'')),args,{env,encoding:'utf8',windowsHide:true,timeout:60000});if(r.status!==0)throw Error(r.stderr||r.error?.message||name+' failed');return r.stdout;}
let started=false;
try{
 command('initdb',['-D',data,'-U','simple_local','--auth=trust','--encoding=UTF8','--no-locale']);
 command('pg_ctl',['-D',data,'-l',path.join(dir,'postgres.log'),'-o','-h 127.0.0.1 -p 55449','-w','start']);started=true;
 const args=['-X','-q','-h','127.0.0.1','-p','55449','-U','simple_local','-v','ON_ERROR_STOP=1'];
 command('psql',[...args,'-d','postgres','-c','create database simple_sprint_20261102;']);
 command('psql',[...args,'-d','postgres','-c',"comment on database simple_sprint_20261102 is 'SIMPLE isolated commercial sprint 20261102';"]);
 const testEnv={...env,SIMPLE_LOCAL_PSQL:path.join(bin,process.platform==='win32'?'psql.exe':'psql'),SIMPLE_LOCAL_TEST_DATA:data};
 for(const files of [['tests/billing-test/postgres.test.mjs','tests/billing-test/install.test.mjs'],['tests/commercial/postgres.test.mjs']]){
  const r=spawnSync(process.execPath,['--experimental-vm-modules','--test','--test-concurrency=1',...files],{cwd:root,env:testEnv,encoding:'utf8',timeout:120000,windowsHide:true});
  const out=path.join(root,'tests/commercial/results');fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,files.length===2?'billing-postgres.tap':'commercial-postgres.tap'),(r.stdout||'')+(r.stderr||''));
  console.log(r.stdout);if(r.status!==0)throw Error(r.stderr||'Local PostgreSQL regression failed');
 }
}finally{
 if(started)command('pg_ctl',['-D',data,'-m','fast','-w','stop']);
 // Keep only this ignored synthetic cluster and logs for inspection; never delete an older cluster.
 console.log('Isolated cluster stopped; local evidence: '+dir);
}
