const a=require('./api.cjs');const {fs,path,c,crypto,check,login,rpc,table,setup,edge,save,training,health,request}=a;
const names=['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions'];
async function deny(name,p){const r=await p;check(name,!r.ok, r.ok?'unexpected success':'');return r;}
(async()=>{await login();
const existing=await table('owner','training_intakes','order=revision.desc&limit=1');const i=existing.data[0]||await setup('owner');
const generated=await edge('owner',i);check('real JWT Edge and service finalizer',generated.ok&&['ready','accepted'].includes(generated.data.operation?.state));const op=generated.data.operation;
if(op.state==='ready')check('generation creates no routine',(await table('owner','routines','owner_id=eq.'+c.users.owner.id)).data.length===0);
const concur=await Promise.all([edge('owner',i,op.idempotency_key),edge('owner',i),edge('owner',i)]);check('double click and two tabs same operation',concur.every(r=>r.ok&&r.data.operation.id===op.id));
await deny('other cannot accept owner',rpc('other','accept_basic_plan',{p_operation:op.id}));
const accepted=await Promise.all([rpc('owner','accept_basic_plan',{p_operation:op.id}),rpc('owner','accept_basic_plan',{p_operation:op.id})]);check('atomic concurrent acceptance one routine',accepted.every(r=>r.ok)&&accepted[0].data===accepted[1].data);
const rid=accepted[0].data, days=(await table('owner','routine_days','routine_id=eq.'+rid)).data,ex=(await table('owner','routine_exercises','day_id=in.('+days.map(x=>x.id).join(',')+')')).data;
check('complete two days four exercises',days.length===2&&ex.length===4);check('UUIDs unique',new Set([rid,...days.map(x=>x.id),...ex.map(x=>x.id)]).size===7);
check('exact prescription persisted',ex.every(e=>e.sets===2&&e.rir==='3'&&e.rest_seconds===90&&['8-12','10-12'].includes(e.target)));
check('no inherited workouts',(await table('owner','workouts','user_id=eq.'+c.users.owner.id)).data.length===0);
check('no inherited notes',(await table('owner','routine_user_notes','routine_id=eq.'+rid)).data.length===0);
for(const n of names){const own=await table('owner',n);check(n+' owner reads',own.ok&&own.data.length>0&&own.data.every(x=>x.user_id===c.users.owner.id));for(const who of ['other','trainer']){const r=await table(who,n,'user_id=eq.'+c.users.owner.id);check(n+' isolated '+who,r.ok&&r.data.length===0);}await deny(n+' anon denied',table(null,n));for(const who of ['owner','other','trainer',null])for(const [verb,payload]of [['POST',{user_id:c.users.owner.id}],['PATCH',{user_id:c.users.other.id}],['DELETE',undefined]])await deny(n+' '+(who||'anon')+' '+verb,table(who,n,'user_id=eq.'+c.users.owner.id,payload,verb));}
for(const who of ['owner','other','trainer',null])for(const fn of ['coach_backend_context','coach_backend_finish'])await deny(fn+' forbidden '+who,rpc(who,fn,{p_user:c.users.owner.id,p_operation:op.id,...(fn.endsWith('finish')?{p_proposal:op.proposal,p_error:null}:{})}));
await deny('cannot impersonate user parameter',rpc('other','get_my_coach_access',{user_id:c.users.owner.id}));
for(const who of ['other','expired']){const j=await setup(who);await deny(who+' cannot generate',edge(who,j));}
await deny('trainer cannot use intake RPC',rpc('trainer','save_my_training_intake',{p_id:null,p_expected:null,p_training:training,p_health:health,p_submit:true}));
await deny('owner cannot edit another intake',rpc('other','save_my_training_intake',{p_id:i.id,p_expected:i.row_version,p_training:training,p_health:health,p_submit:false}));
for(const [n,id,payload]of [['routines',rid,{name:'SYNTHETIC unauthorized edit'}],['routine_days',days[0].id,{name:'SYNTHETIC bad'}],['routine_exercises',ex[0].id,{sets:6}]])await deny(n+' Coach structure frozen',table('owner',n,'id=eq.'+id,payload,'PATCH'));
await deny('Coach delete blocked',table('owner','routine_exercises','id=eq.'+ex[0].id,undefined,'DELETE'));
await deny('Coach add day blocked',table('owner','routine_days','',{routine_id:rid,name:'SYNTHETIC bad',day_order:3},'POST'));
const normal=await table('trainer','routine_exercises','id=eq.'+c.normal.exercise,{sets:3},'PATCH');check('normal trainer routine remains editable',normal.ok&&normal.data[0]?.sets===3);
await table('trainer','routine_exercises','id=eq.'+c.normal.exercise,{sets:2},'PATCH');
check('pilot consumed after acceptance',(await rpc('owner','get_my_coach_access')).data.can_generate===false);
const again=await edge('owner',i);check('later generate never duplicates',again.ok&&again.data.operation.routine_id===rid);
for(const who of ['stale','revoked']){const j=await setup(who),r=await edge(who,j);check(who+' ready',r.ok&&r.data.operation.state==='ready');if(who==='stale'){const s=await rpc(who,'save_my_training_intake',{p_id:j.id,p_expected:j.row_version,p_training:{...training,goal:'SYNTHETIC changed'},p_health:health,p_submit:false});check('new immutable intake version',s.ok&&s.data.id!==j.id&&s.data.revision===j.revision+1);await deny('stale version draft conflict',rpc(who,'save_my_training_intake',{p_id:s.data.id,p_expected:99,p_training:training,p_health:health,p_submit:true}));}else await rpc(who,'set_my_coach_context_permission',{p_scope:'declared_health',p_allow:false});await deny(who+' cannot accept obsolete proposal',rpc(who,'accept_basic_plan',{p_operation:r.data.operation.id}));}
const j=await setup('retry');const d=await rpc('retry','save_my_training_intake',{p_id:j.id,p_expected:j.row_version,p_training:training,p_health:{discomfort:'SYNTHETIC discomfort',limitations:''},p_submit:true});const stopped=await edge('retry',d.data);check('declared limitation stops mock safely',stopped.ok&&stopped.data.operation.state==='failed'&&stopped.data.operation.error_code==='safety_review_required');
const amended=await rpc('retry','save_my_training_intake',{p_id:d.data.id,p_expected:d.data.row_version,p_training:training,p_health:health,p_submit:true});const retry=await edge('retry',amended.data);check('controlled retry after failure',retry.ok&&retry.data.operation.state==='ready');
await deny('Edge anon',edge(null,i));await deny('Edge unexpected payload',request('owner','/functions/v1/simple-coach-mock',{intake_id:i.id,key:crypto.randomUUID(),user_id:c.users.other.id}));
fs.writeFileSync(path.join(__dirname,'private/accepted.json'),JSON.stringify({rid,days,ex,op}));save('security');
})().catch(e=>{save('security');console.error(e.message);process.exitCode=1});
