// Reuse the existing Basic V5 regression runner against this worktree's current index.
const fs=require('fs'),path=require('path'),Module=require('module');
const source=fs.readFileSync(path.join(__dirname,'../coach-quality-v5/training.cjs'),'utf8');
if(!source.includes('http://127.0.0.1:4200/demo'))throw Error('Existing runner entrypoint changed');
const runner=new Module(__filename,module);runner.filename=__filename;runner.paths=module.paths;
runner._compile(source.replace('http://127.0.0.1:4200/demo','http://127.0.0.1:4252/demo'),__filename);
