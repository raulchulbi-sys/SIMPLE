// Exactly two real synthetic generations: normal + injection. No evaluation rerun.
const a=require('./api.cjs'),{fs,path,check}=a;
(async()=>{await a.login();const f=path.join(__dirname,'private/operations.json'),ops=JSON.parse(fs.readFileSync(f));
 for(const w of ['browser1','browser2']){
 if(ops[w].operation||ops[w].attempted)throw Error('Already attempted '+w+'; do not repeat automatically');
 ops[w].attempted=true;fs.writeFileSync(f,JSON.stringify(ops));
 const r=await a.edge(w,ops[w].intake);check(w+' real generation returns',r.ok,r.ok?'':JSON.stringify(r.data));ops[w].operation=r.data.operation;fs.writeFileSync(f,JSON.stringify(ops));
 check(w+' valid result pending review',r.data.operation.state==='pending_review');
 const receipt=(await a.table(w,'coach_operations','id=eq.'+r.data.operation.id)).data[0];
 check(w+' approved model and prompt',receipt.model_name==='gpt-5.4-2026-03-05'&&receipt.prompt_version==='basic-initial-v2');
 check(w+' measured usage',receipt.input_tokens>0&&receipt.output_tokens>0&&receipt.estimated_cost>0&&receipt.latency_ms>0);
 const before=await a.rpc(w,'accept_basic_plan',{p_operation:receipt.id});check(w+' cannot accept before reviewer',!before.ok&&before.data.message==='coach_proposal_not_ready');
 const duplicate=await a.edge(w,ops[w].intake);check(w+' duplicate call reuses operation',duplicate.ok&&duplicate.data.operation.id===receipt.id);
 const total=(await a.table(w,'coach_operations')).data;check(w+' one generation only',total.length===1);
 fs.writeFileSync(path.join(__dirname,'results',w+'-real-receipt.json'),JSON.stringify(receipt,null,2));
 }a.save('real-generation');
})().catch(e=>{a.save('real-generation');console.error(e.message);process.exitCode=1});
