// Staging only. Reuses existing controlled test accounts; never creates/edits Auth users.
// Credentials and receipts stay in ignored private/. No automatic OpenAI retries.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=path.join(__dirname,'private'),out=path.join(__dirname,'results');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const ref='dmqjexigdnfzobarhnib',base='https://'+ref+'.supabase.co';
const write=(n,x)=>fs.writeFileSync(path.join(dir,n),typeof x==='string'?x:JSON.stringify(x,null,2));
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const mode=process.argv[2];
if(mode==='prepare'){
 if(fs.existsSync(path.join(dir,'fixture.json')))throw Error('Do not replace an existing manifest');
 const s=JSON.parse(fs.readFileSync(process.argv[3]));assert.equal(s.ref,ref);
 const users={mock:s.users.ca,real:s.users.cm,retry:s.users.cb,reviewer:s.users.ta,trainer:s.users.tb};
 const c={ref,key:s.key,users,expires:new Date(Date.now()+12*3600000).toISOString(),operations:{}};write('fixture.json',c);
 console.log('Existing staging accounts only; no Auth writes.');process.exit(0);
}
const c=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json')));assert.equal(c.ref,ref);
let sessions=fs.existsSync(path.join(dir,'sessions.json'))?JSON.parse(fs.readFileSync(path.join(dir,'sessions.json'))):{};
const rows=[];const check=(name,pass)=>{rows.push({name,pass:!!pass});if(!pass)throw Error(name);};
async function request(w,route,data,method){
 if(!route.startsWith('/rest/v1/')&&!route.startsWith('/auth/v1/token?')&&!(mode==='real'&&route==='/functions/v1/simple-coach-mock'))throw Error('Route guard');
 const r=await fetch(base+route,{method:method||(data===undefined?'GET':'POST'),headers:{apikey:c.key,...(sessions[w]?{Authorization:'Bearer '+sessions[w].access_token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(route.startsWith('/functions/')?120000:20000)});
 const t=await r.text();let value;try{value=JSON.parse(t)}catch{value=null}return {ok:r.ok,status:r.status,data:value};
}
const rpc=(w,n,p={})=>request(w,'/rest/v1/rpc/'+n,p),table=(w,n,q='')=>request(w,'/rest/v1/'+n+'?select=*&'+q);
async function login(){for(const [k,u] of Object.entries(c.users)){
 if(sessions[k]?.expires_at>Date.now()/1000+180)continue;
 const r=await request(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});check('existing staging JWT '+k,r.ok&&r.data.user.id===u.id);sessions[k]=r.data;
 }write('sessions.json',sessions);}
const oldTraining={goal:'Ganar masa muscular',experience:'beginner',days:3,minutes:60,equipment:['Mancuernas'],preferred:'',avoided:'',preferences:''};
const training=require('../coach-quality-v5/cases.cjs').A.training;
const oldProposal={schema_version:1,name:'SYNTHETIC · previous generation',description:'Controlled staging fixture',days:[0,1,2].map(n=>({name:'Día '+(n+1),exercises:[{name:'Sentadilla con peso corporal',sets:2,reps_min:8,reps_max:12,rir:3,rest_seconds:120},{name:'Remo con mancuerna',sets:2,reps_min:8,reps_max:12,rir:3,rest_seconds:120}]}))};
const ex=name=>({name,sets:2,reps_min:8,reps_max:10,rir:3,rest_seconds:120,scheme:'straight',planned_sets:[1,2].map(set_number=>({set_number,reps_min:8,reps_max:10,rir:3,rest_seconds:120}))});
const proposal={schema_version:2,name:'SYNTHETIC · second generation',description:globalThis.SimpleCoachProgrammingV5.instruction(training),days:['Lunes','Miércoles','Viernes'].map(name=>({name,exercises:['goblet','db_rdl','floor_press','band_row'].map(id=>ex(globalThis.SimpleCoachProgrammingV5.byId.get(id).name))}))};
const save=()=>write('fixture.json',c);
const digest=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
async function snapshot(w){const op=(await table(w,'coach_operations','id=eq.'+c.operations[w].first)).data;const rid=c.operations[w].routine;const values={op,routine:(await table(w,'routines','id=eq.'+rid)).data,days:(await table(w,'routine_days','routine_id=eq.'+rid)).data,workout:(await table(w,'workouts','id=eq.'+c.operations[w].workout)).data,intake:(await table(w,'training_intakes','id=eq.'+c.operations[w].intake)).data,management:(await table(w,'routine_management','routine_id=eq.'+rid)).data,revisions:(await table(w,'routine_revisions','routine_id=eq.'+rid)).data};return digest(values);}
async function run(){
 await login();
 if(mode==='first'){
  const w=process.argv[3];assert(['mock','real','retry'].includes(w));if(c.operations[w])throw Error('Fixture already reserved');
  check(w+' consent',(await rpc(w,'set_my_coach_context_permission',{p_scope:'training_intake',p_allow:true})).ok);
  const i=await rpc(w,'save_my_training_intake',{p_id:null,p_expected:null,p_training:oldTraining,p_submit:true});check(w+' legacy intake',i.ok&&i.data.schema_version===1);
  const o=await rpc(w,'reserve_basic_generation',{p_intake_id:i.data.id,p_key:crypto.randomUUID()});check(w+' first reservation',o.ok&&o.data.state==='reserved');
  c.operations[w]={first:o.data.id,intake:i.data.id,row_version:i.data.row_version};save();
  write('first-ready-'+w+'.sql',`update public.coach_operations set state='ready',prompt_version='basic-initial-v2',model_provider='mock',proposal=${quote(JSON.stringify(oldProposal))}::jsonb,review_decision='approved',reviewed_by='${c.users.reviewer.id}',reviewed_at=now(),review_reason='Synthetic fixture only' where id='${o.data.id}' and user_id='${c.users[w].id}' and state='reserved';`);
 }else if(mode==='accept-first'){
  const w=process.argv[3],a=await rpc(w,'accept_basic_plan',{p_operation:c.operations[w].first});check(w+' old routine accepted',a.ok&&typeof a.data==='string');c.operations[w].routine=a.data;c.operations[w].workout=crypto.randomUUID();save();
  const day=(await table(w,'routine_days','routine_id=eq.'+a.data)).data[0];
  write('workout-'+w+'.sql',`insert into public.workouts(id,user_id,variant,day,workout_date,data) values('${c.operations[w].workout}','${c.users[w].id}','SYNTHETIC second generation',0,current_date,jsonb_build_object('routine_id','${a.data}','routine_day_id','${day.id}','day_id','${day.id}','day_name',${quote(day.name)},'exercises','[]'::jsonb));`);
 }else if(mode==='baseline'){
  for(const w of ['mock','real','retry']){c.operations[w].hash=await snapshot(w);const a=await rpc(w,'get_my_coach_access');check(w+' allowance 1 blocks second',a.ok&&!a.data.can_generate&&a.data.consumed_generations===1&&a.data.remaining_generations===0);}save();
 }else if(mode==='second'){
  const w=process.argv[3];const a=await rpc(w,'get_my_coach_access');check(w+' allowance2 permits second',a.ok&&a.data.can_generate&&a.data.remaining_generations===1);
  const i=await rpc(w,'save_my_training_intake',{p_id:c.operations[w].intake,p_expected:c.operations[w].row_version,p_training:training,p_submit:true});check(w+' new v2 intake preserves old',i.ok&&i.data.id!==c.operations[w].intake&&i.data.schema_version===2);c.operations[w].secondIntake=i.data.id;c.operations[w].secondKey=crypto.randomUUID();save();
  const rs=await Promise.all(Array.from({length:8},(_,n)=>rpc(w,'reserve_basic_generation',{p_intake_id:i.data.id,p_key:n<4?c.operations[w].secondKey:crypto.randomUUID()})));
  check(w+' 8 concurrent requests exactly one second UUID',rs.every(r=>r.ok&&r.data.id===rs[0].data.id&&r.data.retry_source===null&&r.data.id!==c.operations[w].first));c.operations[w].second=rs[0].data.id;save();
  const b=await rpc(w,'get_my_coach_access');check(w+' second reservation exhausts allowance',b.ok&&!b.data.can_generate&&b.data.remaining_generations===0&&b.data.consumed_generations===2);
  check(w+' first immutable after concurrency',(await snapshot(w))===c.operations[w].hash);
  check(w+' no premature acceptance',!(await rpc(w,'accept_basic_plan',{p_operation:c.operations[w].second})).ok);
  write('finish-'+w+'.sql',`select set_config('request.jwt.claims','{"role":"service_role"}',false); select public.coach_backend_claim('${c.users[w].id}','${c.operations[w].second}','gpt-5.4-2026-03-05'); select public.coach_backend_finish('${c.users[w].id}','${c.operations[w].second}',${quote(JSON.stringify(proposal))}::jsonb,null,100,'[{"status":200,"latency_ms":100,"input_tokens":100,"output_tokens":100,"cached_input_tokens":0,"error_code":null}]'::jsonb);`);
 }else if(mode==='pending'){
  const w=process.argv[3],op=(await table(w,'coach_operations','id=eq.'+c.operations[w].second)).data[0];check(w+' pending_review',op.state==='pending_review'&&op.prompt_version==='basic-initial-v5');
  check(w+' forbidden accept before review',!(await rpc(w,'accept_basic_plan',{p_operation:op.id})).ok);
  const q=await rpc('reviewer','get_coach_review_queue');check(w+' reviewer sees specific second and first',q.ok&&q.data.some(x=>x.operation.id===op.id)&&q.data.some(x=>x.operation.id===c.operations[w].first));check('no health projection',q.data.every(x=>!Object.hasOwn(x,'health')));
  for(const other of ['trainer',null])check((other||'anon')+' cannot review',!(await rpc(other,'get_coach_review_queue')).ok);
  check('other client cannot read operation',(await table('real','coach_operations','id=eq.'+op.id)).data.length===0);
  check('client cannot service-claim',!(await rpc(w,'coach_backend_claim',{p_user:c.users[w].id,p_operation:op.id,p_model:'gpt-5.4-2026-03-05'})).ok);
  check('client cannot raise entitlement',!(await request(w,'/rest/v1/rpc/generation_limit',{u:c.users[w].id})).ok);
 }else if(mode==='accept-second'){
  const w='mock',id=c.operations[w].second;
  check('reviewer approves mock second',(await rpc('reviewer','review_coach_proposal',{p_operation:id,p_approve:true,p_reason:'Synthetic acceptance test; no AI call'})).ok);
  const rs=await Promise.all([1,2,3].map(()=>rpc(w,'accept_basic_plan',{p_operation:id})));
  check('concurrent acceptance creates one new routine',rs.every(r=>r.ok&&r.data===rs[0].data)&&rs[0].data!==c.operations[w].routine);c.operations[w].secondRoutine=rs[0].data;save();
  check('old operation/routine/intake/revision/workout unchanged',(await snapshot(w))===c.operations[w].hash);
  const a=await rpc(w,'get_my_coach_access');check('two accepted routines; legacy scalar stays old',a.ok&&a.data.accepted_routines.length===2&&a.data.routine_id===c.operations[w].routine&&!a.data.can_generate);
  const ints=(await table(w,'training_intakes','id=eq.'+c.operations[w].secondIntake)).data[0];const third=await rpc(w,'save_my_training_intake',{p_id:ints.id,p_expected:ints.row_version,p_training:training,p_submit:true});check('third intake valid without third authorization',third.ok);c.operations[w].thirdIntake=third.data.id;save();
  const denied=await rpc(w,'reserve_basic_generation',{p_intake_id:third.data.id,p_key:crypto.randomUUID()});check('third independent generation server-rejected',!denied.ok&&denied.data.message==='coach_generation_limit');
  check('only two root operations persisted',(await table(w,'coach_operations')).data.length===2);
  const protectedEdit=await request(w,'/rest/v1/routines?id=eq.'+c.operations[w].routine,{name:'Unwanted edit'},'PATCH');check('old Coach structure protected',!protectedEdit.ok);
 }else if(mode==='retry'){
  const w='retry',id=c.operations[w].second;
  check('accepted first never retryable',!(await rpc('reviewer','authorize_coach_retry',{p_operation:c.operations[w].first,p_reason:'Synthetic guard test'})).ok);
  check('reviewer rejects mock second',(await rpc('reviewer','review_coach_proposal',{p_operation:id,p_approve:false,p_reason:'Synthetic retry test'})).ok);
  check('reject alone does not grant retry',!(await rpc(w,'get_my_coach_access')).data.can_generate);
  check('explicit reviewer retry after accepted old routine',(await rpc('reviewer','authorize_coach_retry',{p_operation:id,p_reason:'Authorized synthetic retry, same generation'})).ok);
  const a=await rpc(w,'get_my_coach_access');check('retry authorized without new allowance',a.data.can_generate&&a.data.consumed_generations===2&&a.data.remaining_generations===0);
  const rs=await Promise.all([1,2,3].map(()=>rpc(w,'reserve_basic_generation',{p_intake_id:c.operations[w].secondIntake,p_key:crypto.randomUUID()})));
  check('one retry only, linked to second rather than accepted first',rs.every(r=>r.ok&&r.data.id===rs[0].data.id&&r.data.retry_source===id));c.operations[w].retry=rs[0].data.id;save();
  check('root count stays two',(await rpc(w,'get_my_coach_access')).data.consumed_generations===2);
  check('old accepted immutable after retry',(await snapshot(w))===c.operations[w].hash);
 }else if(mode==='guards'){
  const w='mock';
  for(const x of ['trainer',null])check((x||'anon')+' cannot use athlete access',!(await rpc(x,'get_my_coach_access')).ok);
  const op=(await table(w,'coach_operations','id=eq.'+c.operations[w].first)).data[0];
  check('operation update forbidden',!(await request(w,'/rest/v1/coach_operations?id=eq.'+op.id,{retry_authorized_at:new Date().toISOString()},'PATCH')).ok);
  check('operation insert forbidden',!(await request(w,'/rest/v1/coach_operations',{user_id:c.users[w].id,intake_id:op.intake_id,idempotency_key:crypto.randomUUID()})).ok);
  check('reviewer direct access still restricted',(await table('reviewer','coach_operations')).data.length===0);
  const bad=await rpc('real','accept_basic_plan',{p_operation:op.id});check('foreign acceptance forbidden',!bad.ok);
 }else if(mode==='real'){
  const w='real';if(fs.existsSync(path.join(dir,'real-dispatch.json')))throw Error('One dispatch only; inspect receipt, never retry');
  const a=await rpc(w,'get_my_coach_access');check('real synthetic second available',a.ok&&a.data.can_generate&&a.data.remaining_generations===1);
  const i=await rpc(w,'save_my_training_intake',{p_id:c.operations[w].intake,p_expected:c.operations[w].row_version,p_training:training,p_submit:true});check('real synthetic v2 submitted',i.ok&&i.data.schema_version===2);c.operations[w].secondIntake=i.data.id;c.operations[w].secondKey=crypto.randomUUID();save();
  write('real-dispatch.json',{project:ref,intake_id:i.data.id,key:c.operations[w].secondKey,dispatches:1,at:new Date().toISOString()});
  const r=await request(w,'/functions/v1/simple-coach-mock',{intake_id:i.data.id,key:c.operations[w].secondKey});write('real-edge.json',r);check('one real Edge request returned',r.ok&&r.data.operation?.id);
  c.operations[w].second=r.data.operation.id;save();
  const op=(await table(w,'coach_operations','id=eq.'+c.operations[w].second)).data[0];write('real-operation.json',op);
  check('real V5 persisted pending review',op.state==='pending_review'&&op.prompt_version==='basic-initial-v5'&&op.output_schema_version===2&&op.retry_source===null);
  check('exactly one provider dispatch',op.provider_attempts.length===1&&op.provider_attempts[0].status===200);
  check('real not approved or accepted',op.reviewed_at===null&&op.routine_id===null&&op.accepted_at===null);
  check('real first rows unchanged',(await snapshot(w))===c.operations[w].hash);
  check('real reviewer visibility',(await rpc('reviewer','get_coach_review_queue')).data.some(x=>x.operation.id===op.id));
  console.log(JSON.stringify({state:op.state,prompt:op.prompt_version,cost:op.estimated_cost,provider_calls:op.provider_attempts.length}));
 }else throw Error('Unknown mode');
 fs.writeFileSync(path.join(out,mode+'-'+(process.argv[3]||'all')+'.json'),JSON.stringify({passed:rows.length,total:rows.length,checks:rows},null,2));console.log(mode+': '+rows.length+'/'+rows.length+' passed');
}
run().catch(e=>{console.error(e.message);fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({mode,error:e.message,checks:rows},null,2));process.exitCode=1;});
