// Real staging JWTs; SQL-seeded proposals used only for infrastructure tests (not real OpenAI validation).
const a=require('./api.cjs');const {fs,path,c,check,login,rpc,table,save}=a;
const names=['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions'];
async function deny(name,p){const r=await p;check(name,!r.ok);return r;}
(async()=>{await login();
for(const n of names){
 for(const who of ['owner','other','trainer']){const r=await table(who,n,'user_id=eq.'+c.users.owner.id);check(n+' own RLS '+who,r.ok&&(who==='owner'||r.data.length===0));}
 await deny(n+' anon denied',table(null,n));
 for(const who of ['owner','other','trainer',null])for(const [verb,payload]of [['POST',{user_id:c.users.owner.id}],['PATCH',{user_id:c.users.other.id}],['DELETE',undefined]])await deny(n+' '+(who||'anon')+' '+verb,table(who,n,'user_id=eq.'+c.users.owner.id,payload,verb));
}
for(const who of ['owner','other','trainer',null])for(const fn of ['coach_backend_context','coach_backend_claim','coach_backend_finish'])await deny(fn+' service only '+who,rpc(who,fn,{p_user:c.users.owner.id,p_operation:c.users.owner.id,...(fn.endsWith('claim')?{p_model:'gpt-5-mini-2025-08-07'}:fn.endsWith('finish')?{p_proposal:null,p_error:'technical_error',p_latency_ms:0,p_attempts:[]}: {})}));
await deny('cannot impersonate get access',rpc('other','get_my_coach_access',{user_id:c.users.owner.id}));
const {cases}=await import('./cases.mjs'),ctx=cases[0].context,ops={};
for(const who of ['owner','other','expired','stale','revoked','rollback','browser1','browser2','retry']){
 const r=await rpc(who,'save_my_training_intake',{p_id:null,p_expected:null,p_training:ctx.training,p_health:ctx.health,p_submit:true});check(who+' valid submitted',r.ok);
 for(const scope of ['training_intake','declared_health'])check(who+' explicit real context '+scope,(await rpc(who,'set_my_coach_context_permission',{p_scope:scope,p_allow:true})).ok);
 const x=await rpc(who,'reserve_basic_generation',{p_intake_id:r.data.id,p_key:a.crypto.randomUUID()});
 if(['other','expired'].includes(who))check(who+' cannot reserve',!x.ok);else {check(who+' reserved',x.ok);ops[who]={intake:r.data,operation:x.data};}
}
await deny('trainer cannot create intake',rpc('trainer','save_my_training_intake',{p_id:null,p_expected:null,p_training:ctx.training,p_health:ctx.health,p_submit:true}));
await deny('cannot edit someone else intake',rpc('other','save_my_training_intake',{p_id:ops.owner.intake.id,p_expected:1,p_training:ctx.training,p_health:ctx.health,p_submit:false}));
const concurrent=await Promise.all(Array.from({length:4},()=>rpc('owner','reserve_basic_generation',{p_intake_id:ops.owner.intake.id,p_key:a.crypto.randomUUID()})));
check('four concurrent reservations one operation',concurrent.every(r=>r.ok&&r.data.id===ops.owner.operation.id));
await deny('accept before proposal rejected',rpc('owner','accept_basic_plan',{p_operation:ops.owner.operation.id}));
await deny('accept other owner rejected',rpc('other','accept_basic_plan',{p_operation:ops.owner.operation.id}));
fs.writeFileSync(path.join(__dirname,'private/operations.json'),JSON.stringify(ops));save('security');
console.log('Security setup ready; no provider requests sent.');
})().catch(e=>{save('security');console.error(e.message);process.exitCode=1});
