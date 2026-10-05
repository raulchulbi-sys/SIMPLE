// Actual staging JWT/RPC E2E. SQL receipts are explicitly mocked: never provider evidence.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),priv=path.join(__dirname,'private'),out=path.join(__dirname,'results');
fs.mkdirSync(priv,{recursive:true});fs.mkdirSync(out,{recursive:true});
const readJSON=p=>JSON.parse(fs.readFileSync(p,'utf8')),file=n=>path.join(priv,n),write=(n,v)=>fs.writeFileSync(file(n),typeof v==='string'?v:JSON.stringify(v,null,2));
const creds=readJSON(path.resolve(root,'../coach-premium-phase2/tests/premium-phase2/private/fixture.json'));
assert.equal(creds.ref,'dmqjexigdnfzobarhnib');
let fixture=fs.existsSync(file('fixture.json'))?readJSON(file('fixture.json')):null,sessions=fs.existsSync(file('sessions.json'))?readJSON(file('sessions.json')):{},rows=[];
const q=v=>"'"+String(v).replaceAll("'","''")+"'",j=v=>q(JSON.stringify(v))+'::jsonb',save=()=>write('fixture.json',fixture);
const check=(name,ok)=>{rows.push({name,pass:!!ok});assert(ok,name);};
async function req(actor,route,body,method){
 assert(route.startsWith('/rest/v1/')||route.startsWith('/auth/v1/'),'No provider dispatch from this harness');
 const r=await fetch('https://'+creds.ref+'.supabase.co'+route,{method:method||(body===undefined?'GET':'POST'),headers:{apikey:creds.key,...(sessions[actor]?{Authorization:'Bearer '+sessions[actor].access_token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(25000)});
 const raw=await r.text();let data;try{data=raw?JSON.parse(raw):null;}catch{data={code:'non_json_response'};}return{ok:r.ok,status:r.status,data};
}
const rpc=(a,n,v={})=>req(a,'/rest/v1/rpc/'+n,v),table=(a,n,where='',select='*')=>req(a,'/rest/v1/'+n+'?select='+select+'&'+where),must=async p=>{const r=await p;if(!r.ok)throw Error('Controlled staging failure '+r.status+' '+(r.data?.message||r.data?.code||'unknown'));return r.data;};
// The adapter uses exactly the SDK queries/RPC through the current controlled JWT.
function sdk(actor){return{auth:{getSession:async()=>({data:{session:sessions[actor]},error:null})},rpc:async(n,v)=>{const r=await rpc(actor,n,v);return{data:r.ok?r.data:null,error:r.ok?null:r.data};},from(n){let query='',columns='*';const builder={select(v){columns=v;return this;},eq(k,v){query+='&'+k+'=eq.'+encodeURIComponent(v);return this;},is(k,v){query+='&'+k+'=is.'+String(v);return this;},order(k,{ascending=true}={}){query+='&order='+k+'.'+(ascending?'asc':'desc');return this;},then(resolve,reject){return table(actor,n,query,columns).then(r=>({data:r.ok?r.data:null,error:r.ok?null:r.data})).then(resolve,reject);}};return builder;}};}
const mode=process.argv[2];
const I=require(path.join(root,'assets/coach-intake.js'));require(path.join(root,'assets/coach-programming-v4.js'));require(path.join(root,'assets/coach-programming-v5.js'));const Q=globalThis.SimpleCoachProgrammingV5;
const set=(n,lo=8,hi=12,rir=2,rest=180)=>({set_number:n,reps_min:lo,reps_max:hi,rir,rest_seconds:rest});
const basic={...I.emptyBasic(),experience:'gt4',goal:'balanced_mass',days:3,weekdays:['mon','wed','fri'],minutes:60,effort:'habitual',activity:{type:'none',weekdays:[]},inventory:{equipment:I.equipment.map(e=>e.id),custom:[]}};
const premium={...I.emptyPremium(),experience:'gt4',pause:false,goal:'balanced',weak_points:['unsure'],days:3,weekdays:['mon','wed','fri'],minutes_by_day:{mon:60,wed:60,fri:60},effort:'confident',confidence:'high',recovery:'mostly',sleep:'h7_8',stress:'medium',distribution:'coach',activity:{type:'none',weekdays:[],minutes:null,intensity:null},inventory:{equipment:I.equipment.map(e=>e.id),custom:[]}};
const weekly={schema_version:'premium-weekly-checkin-v1',recovery:'good',sleep:'normal',fatigue:'normal',stress:'moderate',session_perception:'similar',availability:{changed:false,weekdays:[],minutes_by_day:{}},review:{topic:'none',exercise_id:null}};
const catalogue=['goblet','db_rdl','floor_press','band_row'];
const plans=[[set(1,6,8,1,240),set(2,8,10,1,240),set(3,10,12,0,240)],[set(1,8,10,2,240),set(2,8,10,2,240)],[set(1,8,10,1,180),set(2,10,12,0,180)],[set(1),set(2,10,12,1,180)]];
const proposal={schema_version:2,name:'Basic · rutina inicial',description:Q.instruction(basic),days:basic.weekdays.map(d=>({name:I.weekdays.find(v=>v.id===d).label,exercises:catalogue.map((id,i)=>({name:Q.byId.get(id).name,sets:plans[i].length,...Object.fromEntries(Object.entries(plans[i][0]).filter(([k])=>k!=='set_number')),scheme:new Set(plans[i].map(s=>JSON.stringify({...s,set_number:0}))).size===1?'straight':'varied',planned_sets:plans[i]}))}))};
const equal=(a,b)=>require('util').isDeepStrictEqual(a,b);
async function basicPrepare(){
 const C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-mock/contract.mjs')));assert(C.reviewProposal(proposal,{training:basic}).ok);
 await must(rpc('mock','set_my_coach_context_permission',{p_scope:'training_intake',p_allow:true}));
 fixture.intake=await must(rpc('mock','save_my_training_intake',{p_id:null,p_expected:null,p_training:basic,p_health:null,p_submit:true}));
 fixture.basic_operation=await must(rpc('mock','reserve_basic_generation',{p_intake_id:fixture.intake.id,p_key:crypto.randomUUID()}));save();
 write('basic-finish.sql',`begin;select set_config('request.jwt.claims','{"role":"service_role"}',true);select public.coach_backend_claim(${q(fixture.user)},${q(fixture.basic_operation.id)},'gpt-5.4-2026-03-05');select public.coach_backend_finish(${q(fixture.user)},${q(fixture.basic_operation.id)},${j(proposal)},null,1,'[{"status":200,"latency_ms":1,"input_tokens":0,"output_tokens":0,"cached_input_tokens":0,"error_code":null}]');update public.coach_operations set model_provider='mock' where id=${q(fixture.basic_operation.id)} and user_id=${q(fixture.user)};commit;`);
 check('Basic V5 real JWT intake and reservation',fixture.intake.state==='submitted'&&fixture.basic_operation.state==='reserved');
}
async function baseline(){
 const f=fixture;return{operation:(await must(table('mock','coach_operations','id=eq.'+f.basic_operation.id)))[0],revision:(await must(table('mock','routine_revisions','id=eq.'+f.revision)))[0],routine:(await must(table('mock','routines','id=eq.'+f.routine)))[0],days:await must(table('mock','routine_days','routine_id=eq.'+f.routine+'&order=id')),exercises:await must(table('mock','routine_exercises','day_id=in.('+f.days.join(',')+')&order=id')),workouts:await must(table('mock','workouts','id=in.('+f.workouts.join(',')+')&order=id')),notes:await must(table('mock','routine_user_notes','routine_id=eq.'+f.routine+'&order=id'))};
}
async function main(){
 if(mode==='prepare'){
  assert(!fixture,'Do not overwrite fixture identities');fixture={ref:creds.ref,user:creds.users.mock.id,other:creds.users.real.id,reviewer:creds.users.reviewer.id,prefix:'SYNTHETIC Upgrade '+crypto.randomUUID(),workouts:[],notes:[],turns:[],recommendations:[],keys:{},started:new Date().toISOString()};save();
  write('basic-config.sql',`begin;create or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $p$ select ${j({[fixture.user]:{enabled:true,adult_confirmed:true,expires_at:'2026-10-08T00:00:00Z',generation_limit:2}})} $p$;create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $p$ select ${j({[fixture.reviewer]:{enabled:true,expires_at:'2026-10-08T00:00:00Z'}})} $p$;commit;`);console.log('Exact synthetic manifest; reuse existing accounts, no Auth creation');return;
 }
 assert(fixture?.ref===creds.ref);
 if(mode==='login'){
  for(const a of ['mock','real','reviewer','trainer']){const u=creds.users[a],r=await must(req(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password}));check(a+' actual controlled JWT',r.user.id===u.id);sessions[a]=r;}write('sessions.json',sessions);return;
 }
 if(mode==='basic-prepare')return basicPrepare();
 if(mode==='basic-accept'){
  const op=fixture.basic_operation.id;const before=await must(rpc('reviewer','review_coach_proposal',{p_operation:op,p_approve:true,p_reason:'SYNTHETIC upgrade V5 baseline, mocked model proposal.'}));check('Basic reviewer actual JWT approve',before.state==='ready');
  const pair=await Promise.all([rpc('mock','accept_basic_plan',{p_operation:op}),rpc('mock','accept_basic_plan',{p_operation:op})]);check('Basic acceptance exactly one routine',pair.every(r=>r.ok)&&pair[0].data===pair[1].data);fixture.routine=pair[0].data;
  const m=(await must(table('mock','routine_management','routine_id=eq.'+fixture.routine)))[0];fixture.revision=m.current_revision_id;fixture.days=(await must(table('mock','routine_days','routine_id=eq.'+fixture.routine+'&order=day_order'))).map(d=>d.id);fixture.exercises=await must(table('mock','routine_exercises','day_id=in.('+fixture.days.join(',')+')&order=day_id,exercise_order'));
  check('Basic accepted V5 twelve exercise UUIDs',fixture.exercises.length===12&&new Set(fixture.exercises.map(e=>e.id)).size===12);save();
  let sql='begin;';for(let d=0;d<fixture.days.length;d++)for(let k=0;k<3;k++){
   const id=crypto.randomUUID(),ex=fixture.exercises.filter(e=>e.day_id===fixture.days[d]);fixture.workouts.push(id);const data={routine_id:fixture.routine,routine_day_id:fixture.days[d],routine_revision_id:fixture.revision,notes:'PRIVATE SYNTHETIC legacy workout note',exercises:ex.map(e=>({exercise_id:e.id,name:e.name,sets:proposal.days[d].exercises[e.exercise_order].planned_sets.map(s=>({set:s.set_number,kg:e.exercise_order===0&&s.set_number===2?null:20,reps:k+8,rir:s.rir})),notes:'PRIVATE SYNTHETIC exercise note'}))};
   sql+=`insert into public.workouts(id,user_id,variant,day,workout_date,data) values(${q(id)},${q(fixture.user)},'SYNTHETIC Upgrade V5','SYNTHETIC day',(now() at time zone 'Europe/Madrid')::date-${k===2?1:(2-k)*7},${j(data)});`;
  }
  for(const e of fixture.exercises.slice(0,2)){const id=crypto.randomUUID();fixture.notes.push(id);sql+=`insert into public.routine_user_notes(id,user_id,routine_id,exercise_key,note) values(${q(id)},${q(fixture.user)},${q(fixture.routine)},${q('exercise:'+e.id)},'PRIVATE SYNTHETIC personal note');`;}
  sql+='commit;';save();write('basic-history.sql',sql);return;
 }
 if(mode==='baseline'){write('before-upgrade.json',await baseline());check('baseline captures complete accepted Basic',true);return;}
 if(mode==='upgrade'){
  let access=await must(rpc('mock','premium_my_access'));check('Premium authorized only after server entitlement',access.enabled===true);
  await must(rpc('mock','premium_admission_permission',{p_allow:true,p_notice:access.notice_version}));
  const key=fixture.keys.upgrade=crypto.randomUUID();save();const args={p_routine:fixture.routine,p_revision:fixture.revision,p_key:key,p_start:new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'}),p_weeks:6};
  const pair=await Promise.all([rpc('mock','upgrade_basic_routine_to_premium',args),rpc('mock','upgrade_basic_routine_to_premium',args)]);check('Two tabs upgrade one mesocycle',pair.every(r=>r.ok)&&pair[0].data===pair[1].data);fixture.mesocycle=pair[0].data;save();
  check('retry upgrade preserves mesocycle',(await must(rpc('mock','upgrade_basic_routine_to_premium',args)))===fixture.mesocycle);
  const current=await baseline(),before=readJSON(file('before-upgrade.json'));for(const k of Object.keys(before))check('upgrade immutable '+k,equal(before[k],current[k]));
  const m=(await must(table('mock','routine_management','routine_id=eq.'+fixture.routine)))[0];check('management premium retains Basic provenance',m.plan_kind==='premium'&&m.operation_id===fixture.basic_operation.id&&m.current_revision_id===fixture.revision);return;
 }
 if(mode==='premium-context'){
  const m=(await must(table('mock','coach_mesocycles','id=eq.'+fixture.mesocycle)))[0];await must(rpc('mock','premium_save_intake',{p_mesocycle:fixture.mesocycle,p_expected:m.row_version,p_training:premium,p_submit:true}));
  for(const [name,args]of [['premium_permission',{p_mesocycle:fixture.mesocycle,p_allow:true}],['premium_weekly_permission',{p_mesocycle:fixture.mesocycle,p_allow:true}],['premium_chat_permission',{p_mesocycle:fixture.mesocycle,p_allow:true}]])check(name+' actual owner consent',(await rpc('mock',name,args)).ok);
  const rev=(await must(table('mock','routine_revisions','id=eq.'+fixture.revision)))[0];const binding=Object.fromEntries(rev.snapshot.days.flatMap(d=>d.exercises.map(e=>[e.id,Q.byName.get(e.name).id])));
  write('premium-bind.sql',`begin;select public.premium_bind_catalogue(${q(fixture.mesocycle)},${q(fixture.revision)},${j(binding)});select public.premium_assign_reviewer(${q(fixture.mesocycle)},${q(fixture.reviewer)});commit;`);
  const ci=await must(rpc('mock','premium_save_weekly_checkin',{p_mesocycle:fixture.mesocycle,p_week:1,p_revision:fixture.revision,p_expected:0,p_answers:weekly,p_submit:true}));check('week1 actual JWT submitted checkin',ci.week_number===1&&!!ci.submitted_at);fixture.checkin=ci.id;save();return;
 }
 if(mode==='adapter'){
  const A=require(path.join(root,'assets/coach-premium-adapter.js'));
  const adapter=A.create(sdk('mock'),{mesocycleId:fixture.mesocycle}),state=await adapter.load();check('Actual existing SDK adapter loads exact owner',state.user_id===fixture.user&&state.mesocycle.id===fixture.mesocycle);check('Adapter shows all 12 original UUIDs',state.days.flatMap(d=>d.exercises).length===12);check('Adapter active prescription matches revision',state.mesocycle.revision_id===fixture.revision);write('adapter-state.json',state);return;
 }
 if(mode==='reserve-analysis'){
  const args={p_mesocycle:fixture.mesocycle,p_key:fixture.keys.analysis=crypto.randomUUID()};save();const pair=await Promise.all([rpc('mock','premium_weekly_reserve_analysis',args),rpc('mock','premium_weekly_reserve_analysis',args)]);check('weekly two tabs one reserved recommendation',pair.every(r=>r.ok)&&pair[0].data.id===pair[1].data.id);fixture.analysis=pair[0].data.id;fixture.recommendations.push(fixture.analysis);save();write('analysis-prepare.sql',`select analysis_bundle->'provider' provider from public.coach_recommendations where id=${q(fixture.analysis)} and user_id=${q(fixture.user)};`);return;
 }
 if(mode==='reserve-chat'){
  const args={p_mesocycle:fixture.mesocycle,p_revision:fixture.revision,p_key:fixture.keys.chat=crypto.randomUUID(),p_message:'Quiero retirar únicamente la última serie de goblet del lunes. Conserva las demás series y explica el origen Basic de la programación.'};fixture.chat_message=args.p_message;save();const pair=await Promise.all([rpc('mock','premium_chat_reserve',args),rpc('mock','premium_chat_reserve',args)]);check('Chat two tabs one reserved message',pair.every(r=>r.ok)&&pair[0].data.id===pair[1].data.id);fixture.turn=pair[0].data.id;fixture.turns.push(fixture.turn);save();write('chat-prepare.sql',`select public.premium_chat_claim(${q(fixture.user)},${q(fixture.turn)},1,'prepare');`);return;
 }
 if(mode==='logout'){for(const a of Object.keys(sessions))await must(req(a,'/auth/v1/logout?scope=local',{}));fs.unlinkSync(file('sessions.json'));check('controlled JWTs signed out; credentials not published',true);return;}
 throw Error('Unsupported explicit mode '+mode);
}
module.exports={fixture,creds,sessions,rpc,table,req,must,sdk,readJSON,file,write,save,check,rows,q,j,baseline,plans,catalogue,proposal,basic,premium,weekly};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(out,'live-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,provider_dispatches:0},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' checks');});
