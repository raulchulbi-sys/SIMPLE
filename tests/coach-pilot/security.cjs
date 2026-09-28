const a=require('./api.cjs'),{check,fs,path,rpc,table,c,crypto}=a;
const fixtureFile=path.join(__dirname,'private/operations.json');
async function reject(w,name,args,code){const r=await rpc(w,name,args);check(w+' rejects '+name+(code?' '+code:''),!r.ok&&(!code||r.data.message===code));return r;}
(async()=>{await a.login();const cases=await import('../coach-ai/cases.mjs');const ctx=cases.cases[0].context,ops={};
 for(const w of ['other','trainer','reviewer',null]){const r=await rpc(w,'get_coach_review_queue');check((w||'anon')+' reviewer permission',w==='reviewer'?r.ok:!r.ok);}
 for(const w of ['owner','other','trainer','reviewer',null]){const r=await rpc(w,'get_coach_pilot_metrics');check((w||'anon')+' metrics permission',w==='reviewer'?r.ok:!r.ok);}
 for(const w of ['owner','other','expired']){const r=await rpc(w,'get_my_coach_access');check(w+' pilot authorization',r.ok&&r.data.authorized===(w==='owner'));}
 for(const w of ['other','expired'])await reject(w,'save_my_training_intake',{p_id:null,p_expected:null,p_training:ctx.training,p_health:ctx.health,p_submit:true},'coach_pilot_required');
 for(const w of ['owner','retry','stale','revoked','browser1','browser2','rollback']){
 const context=w==='retry'?cases.cases.find(x=>x.id==='needs-review').context:w==='browser1'?cases.cases.find(x=>x.id==='injection').context:ctx;
 const r=await rpc(w,'save_my_training_intake',{p_id:null,p_expected:null,p_training:context.training,p_health:context.health,p_submit:true});check(w+' intake persisted',r.ok, r.ok?'':JSON.stringify(r.data));ops[w]={intake:r.data};
 await reject(w,'reserve_basic_generation',{p_intake_id:r.data.id,p_key:crypto.randomUUID()},'coach_context_required');
 for(const scope of ['training_intake','declared_health'])check(w+' explicit consent '+scope,(await rpc(w,'set_my_coach_context_permission',{p_scope:scope,p_allow:true})).ok);
 const grants=await table(w,'context_grants','revoked_at=is.null');check(w+' versioned consent',grants.data.length===2&&grants.data.every(x=>x.notice_version==='pilot-supervised-v1'));
 if(w==='retry'||w==='browser1'||w==='browser2')continue;
 const results=await Promise.all([1,2].map(()=>rpc(w,'reserve_basic_generation',{p_intake_id:r.data.id,p_key:crypto.randomUUID()})));check(w+' two tabs one reservation',results.every(x=>x.ok)&&results[0].data.id===results[1].data.id);ops[w].operation=results[0].data;
 }
 const safety=await a.edge('retry',ops.retry.intake);check('real Edge safety gate blocks before provider',safety.ok&&safety.data.operation.state==='failed'&&safety.data.operation.error_code==='safety_review_required');
 ops.retry.operation=safety.data.operation;
 const safetyReceipt=(await table('retry','coach_operations','id=eq.'+safety.data.operation.id)).data[0];check('safety no provider attempts or cost',safetyReceipt.provider_attempts.length===0&&Number(safetyReceipt.estimated_cost)===0);
 const rv=await rpc('revoked','set_my_coach_context_permission',{p_scope:'declared_health',p_allow:false});check('revoke consent',rv.ok);
 const ro=(await table('revoked','coach_operations','id=eq.'+ops.revoked.operation.id)).data[0];check('revoke invalidates reservation',ro.state==='stale');
 await reject('revoked','reserve_basic_generation',{p_intake_id:ops.revoked.intake.id,p_key:crypto.randomUUID()},'coach_context_required');
 for(const w of ['owner','other','trainer','reviewer',null]){
 const direct=await table(w,'coach_operations','id=eq.'+ops.owner.operation.id,{state:'ready'},'PATCH');check((w||'anon')+' cannot self approve',!direct.ok);
 const feedback=await table(w,'coach_pilot_feedback','',{user_id:c.users.owner.id,routine_id:c.normal.routine,rating:5},'POST');check((w||'anon')+' no direct feedback insert',!feedback.ok);
 }
 for(const w of ['other','trainer','reviewer'])for(const t of ['training_intakes','intake_health','context_grants','coach_operations']){const r=await table(w,t,'user_id=eq.'+c.users.owner.id);check(w+' table isolation '+t,r.ok&&r.data.length===0);}
 await reject('owner','coach_backend_claim',{p_user:c.users.owner.id,p_operation:ops.owner.operation.id,p_model:'gpt-5.4-2026-03-05'});
 fs.writeFileSync(fixtureFile,JSON.stringify(ops));a.save('security-pre');
})().catch(e=>{a.save('security-pre');console.error(e.message);process.exitCode=1});
