const {spawnSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const files=process.argv.includes('--postgres')?['postgres.test.mjs','install.test.mjs']:['contract.test.mjs','reconciliation.test.mjs','checkout-regression.test.mjs'];
const r=spawnSync(process.execPath,['--experimental-vm-modules','--test','--test-concurrency=1','--test-reporter=tap',...files],{cwd:__dirname,encoding:'utf8'});
fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});const kind=process.argv.includes('--postgres')?'postgres':'offline';
fs.writeFileSync(path.join(__dirname,'results',kind+'.tap'),(r.stdout??'')+(r.stderr??''));
const pick=x=>Number(r.stdout.match(new RegExp('^# '+x+' (\\d+)','m'))?.[1]);
const result={kind,tests:pick('tests'),passed:pick('pass'),failed:pick('fail'),exit:r.status};
fs.writeFileSync(path.join(__dirname,'results',kind+'.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
if(r.status)console.log(r.stdout);process.exitCode=r.status??1;
