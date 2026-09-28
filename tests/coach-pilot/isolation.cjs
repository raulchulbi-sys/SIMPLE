const a=require('./api.cjs'),{check,rpc,table}=a;
(async()=>{await a.login();const who='browser2',u=a.c.users[who].id;
for(const n of ['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions']){
 const own=await table(who,n,'user_id=eq.'+u);check(n+' populated owner reads',own.ok&&own.data.length>0);
 for(const w of ['owner','other','trainer','reviewer']){const r=await table(w,n,'user_id=eq.'+u);check(n+' other user isolated '+w,r.ok&&r.data.length===0);}
 check(n+' anon denied',!(await table(null,n)).ok);
 for(const w of [who,'other','trainer','reviewer',null])for(const [method,data]of [['POST',{user_id:u}],['PATCH',{user_id:u}],['DELETE',undefined]])check(n+' '+(w||'anon')+' cannot direct '+method,!(await table(w,n,'user_id=eq.'+u,data,method)).ok);
}
const op=(await table(who,'coach_operations')).data[0];
for(const w of [who,'other','trainer','reviewer',null])for(const fn of ['coach_backend_context','coach_backend_claim','coach_backend_finish']){const r=await rpc(w,fn,{p_user:u,p_operation:op.id,...(fn.endsWith('claim')?{p_model:'gpt-5.4-2026-03-05'}:fn.endsWith('finish')?{p_proposal:null,p_error:'technical_error',p_latency_ms:0,p_attempts:[]}: {})});check(fn+' service only '+(w||'anon'),!r.ok);}
for(const w of ['other','trainer',null])check((w||'anon')+' Edge cannot access foreign intake',!(await a.edge(w,{id:op.intake_id})).ok);
check('Edge rejects frontend model override',!(await a.request(who,'/functions/v1/simple-coach-mock',{intake_id:op.intake_id,key:a.crypto.randomUUID(),model:'gpt-5-mini-2025-08-07'})).ok);
const days=(await table(who,'routine_days','routine_id=eq.'+op.routine_id)).data;
check('Coach routine structure cannot edit',!(await table(who,'routines','id=eq.'+op.routine_id,{name:'illegal'},'PATCH')).ok);
check('Coach day structure cannot edit',!(await table(who,'routine_days','id=eq.'+days[0].id,{name:'illegal'},'PATCH')).ok);
const ex=(await table(who,'routine_exercises','day_id=eq.'+days[0].id)).data[0];check('Coach exercise structure cannot edit',!(await table(who,'routine_exercises','id=eq.'+ex.id,{sets:6},'PATCH')).ok);
check('cycle remains usable',(await rpc(who,'get_client_routine_cycle_progress',{p_client_id:u,p_routine_id:op.routine_id})).ok);
a.save('isolation');})().catch(e=>{a.save('isolation');console.error(e.message);process.exitCode=1});
