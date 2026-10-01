const equal=require('util').isDeepStrictEqual;
const a=require('./live.cjs'),I=require('../../assets/coach-intake.js'),fs=require('fs'),crypto=require('crypto'),assert=require('assert/strict');
const t={...I.emptyBasic(),experience:'y1_2',goal:'balanced_mass',days:4,weekdays:['mon','tue','thu','sat'],minutes:60,effort:'learning',excluded:['bar_squat','db_curl'],activity:{type:'football',weekdays:['wed']},inventory:{equipment:['dumbbells','bands'],custom:['Máquina declarada']}};
const save=(v,submit=false,id=null,version=null)=>a.rpc('owner','save_my_training_intake',{p_id:id,p_expected:version,p_training:v,p_submit:submit});
(async()=>{await a.login();await a.grant('owner');let r;
for(const [n,patch] of Object.entries({premium:{schema_version:'premium-intake-v1'},preferred:{preferred:['goblet']},health:{health:'test'},badEnum:{effort:'expert'},noDays:{weekdays:[]},tooManyDays:{days:7},duplicateDays:{weekdays:['mon','mon','thu','sat']},unknownGear:{inventory:{equipment:['gym'],custom:[]}},unknownExercise:{excluded:['new-name']},activityNoDays:{activity:{type:'running',weekdays:[]}},activityNoneDays:{activity:{type:'none',weekdays:['mon']}},customPII:{inventory:{equipment:['dumbbells'],custom:['user@example.invalid']}},customLength:{inventory:{equipment:[],custom:['x'.repeat(41)]}}})){r=await save({...t,...patch},true);a.check('v2 backend rejects '+n,!r.ok&&r.data.message==='coach_invalid_intake');}
r=await save(I.emptyBasic());a.check('empty v2 draft allowed',r.ok&&r.data.schema_version===2);let draft=r.data;
r=await save(I.emptyBasic(),true,draft.id,draft.row_version);a.check('empty v2 submit denied',!r.ok);
const races=await Promise.all([save(t,false,draft.id,draft.row_version),save({...t,minutes:45},false,draft.id,draft.row_version)]);a.check('two tabs exactly one draft update',races.filter(r=>r.ok).length===1);draft=races.find(r=>r.ok).data;
r=await save(t,true,draft.id,draft.row_version);a.check('new fields persisted verbatim',r.ok&&r.data.schema_version===2&&equal(I.assertBasic(r.data.training),I.assertBasic(t)));const intake=r.data;
for(const who of ['other','trainer',null]){r=await a.table(who,'training_intakes','id=eq.'+intake.id);a.check((who||'anon')+' cannot read v2 intake',!r.ok||r.data.length===0);}
const key=crypto.randomUUID(),rr=await Promise.all([a.rpc('owner','reserve_basic_generation',{p_intake_id:intake.id,p_key:key}),a.rpc('owner','reserve_basic_generation',{p_intake_id:intake.id,p_key:key})]);a.check('idempotent v2 reserve single operation',rr.every(r=>r.ok)&&rr[0].data.id===rr[1].data.id);const op=rr[0].data;
r=await a.rpc('owner','accept_basic_plan',{p_operation:op.id});a.check('unreviewed v2 not accepted',!r.ok);
await a.grant('rejected');r=await a.rpc('rejected','save_my_training_intake',{p_id:null,p_expected:null,p_training:a.training,p_submit:true});a.check('legacy v1 saved unchanged',r.ok&&r.data.schema_version===1);const old=r.data;
r=await a.rpc('rejected','reserve_basic_generation',{p_intake_id:old.id,p_key:crypto.randomUUID()});a.check('legacy reserve still available',r.ok);const oldOp=r.data;
r=await a.rpc('reviewer','get_coach_review_queue');const newer=r.data?.find(x=>x.operation.id===op.id),legacy=r.data?.find(x=>x.operation.id===oldOp.id);
a.check('authorized reviewer exact v2 provider projection',r.ok&&!!newer&&equal(I.providerTraining(newer.training),I.providerTraining(t))&&newer.training.inventory.custom.length===0);
a.check('authorized reviewer legacy preserved',!!legacy&&equal(legacy.training,old.training));
a.check('reviewer no health or extra identity in context',!!newer&&!JSON.stringify(newer.training).includes('Máquina declarada')&&!Object.hasOwn(newer.training,'health')&&!Object.hasOwn(newer.training,'user_id'));
for(const who of ['owner','other','trainer',null]){r=await a.rpc(who,'get_coach_review_queue');a.check((who||'anon')+' reviewer access denied',!r.ok&&[401,403].includes(r.status));}
for(const fn of ['coach_backend_context','coach_backend_claim']){r=await a.rpc('owner',fn,{p_user:a.c.users.owner.id,p_operation:op.id,...(fn==='coach_backend_claim'?{p_model:'gpt-5.4-2026-03-05'}:{})});a.check('client cannot call '+fn,!r.ok);}
r=await a.rpc('owner','set_my_coach_context_permission',{p_scope:'training_intake',p_allow:false});a.check('revoke A works',r.ok);r=await a.rpc('reviewer','get_coach_review_queue');a.check('revoked v2 disappears from reviewer',r.ok&&!r.data.some(x=>x.operation.id===op.id));
a.write('v2-operations.json',{new:{intake,op},old:{intake:old,op:oldOp}});
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{fs.writeFileSync(a.out+'/live-v2.json',JSON.stringify({checks:a.checks.length,passed:a.checks.filter(x=>x.pass).length,detail:a.checks},null,2));});
