const a=require('./api.cjs');
(async()=>{await a.login();const i=await a.setup('rollback'),r=await a.edge('rollback',i);a.check('rollback fixture ready',r.ok&&r.data.operation.state==='ready');a.fs.writeFileSync(a.path.join(__dirname,'private/rollback-operation.json'),JSON.stringify(r.data.operation));})().catch(e=>{console.error(e.message);process.exitCode=1});
