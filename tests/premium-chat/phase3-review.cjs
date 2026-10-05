// A3: genuine weekly REVIEW output through the existing pipeline, with real staging JWTs.
// No Edge or OpenAI route is available. All SQL is prepared for the root coordinator.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {pathToFileURL}=require('url'),root=path.resolve(__dirname,'../..'),priv=path.join(__dirname,'private'),out=path.join(__dirname,'results');
fs.mkdirSync(priv,{recursive:true});fs.mkdirSync(out,{recursive:true});
const mode=process.argv[2],rows=[],get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file=n=>path.join(priv,'phase3-review-'+n),write=(n,v)=>fs.writeFileSync(file(n),typeof v==='string'?v:JSON.stringify(v,null,2));
const credentials=get(path.resolve(root,'../coach-premium-phase2/tests/premium-phase2/private/fixture.json'));
assert.equal(credentials.ref,'dmqjexigdnfzobarhnib','Staging only');
let fixture=fs.existsSync(file('fixture.json'))?get(file('fixture.json')):null;
let sessions=fs.existsSync(file('sessions.json'))?get(file('sessions.json')):{};
const q=x=>"'"+String(x).replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb';
const equal=(a,b)=>require('util').isDeepStrictEqual(a,b),check=(name,v)=>{rows.push({name,pass:!!v});assert(v,name);};
const I=require(path.join(root,'assets/coach-intake.js'));
const training={...I.emptyPremium(),experience:'gt4',pause:false,goal:'balanced',weak_points:['unsure'],days:2,weekdays:['mon','thu'],minutes_by_day:{mon:60,thu:60},effort:'confident',confidence:'high',recovery:'mostly',sleep:'h7_8',stress:'medium',distribution:'coach',activity:{type:'none',weekdays:[],minutes:null,intensity:null},inventory:{equipment:['dumbbells','bands'],custom:[]}};
const answers={schema_version:'premium-weekly-checkin-v1',recovery:'normal',sleep:'normal',fatigue:'normal',stress:'moderate',session_perception:'similar',availability:{changed:false,weekdays:[],minutes_by_day:{}},review:{topic:'exercise',exercise_id:null}};
async function req(actor,route,data){
 assert(fixture?.ref==='dmqjexigdnfzobarhnib');
 assert(route.startsWith('/rest/v1/')||route.startsWith('/auth/v1/'),'No provider or Edge dispatch');
 assert(!route.includes('/functions/'),'No OpenAI route');
 const r=await fetch('https://'+fixture.ref+'.supabase.co'+route,{method:data===undefined?'GET':'POST',headers:{apikey:credentials.key,...(sessions[actor]?{Authorization:'Bearer '+sessions[actor].access_token}:{}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(25000)});
 const raw=await r.text();let value;try{value=raw?JSON.parse(raw):null;}catch{value={code:'non_json_response'};}return{ok:r.ok,status:r.status,data:value};
}
const rpc=(a,n,d)=>req(a,'/rest/v1/rpc/'+n,d),read=(a,t,w)=>req(a,'/rest/v1/'+t+'?select=*&'+w);
const must=async p=>{const r=await p;if(!r.ok)throw Error('Controlled staging request failed: '+r.status+' '+(r.data?.code||'unknown'));return r.data;};
const save=()=>write('fixture.json',fixture);
async function main(){
 if(mode==='prepare'){
  assert(!fixture,'Never overwrite an existing manifest');
  fixture={ref:credentials.ref,prefix:'SYNTHETIC Premium Phase3 REVIEW '+crypto.randomUUID(),user:credentials.users.mock.id,reviewer:credentials.users.reviewer.id,routine:crypto.randomUUID(),days:[crypto.randomUUID(),crypto.randomUUID()],exercises:Array.from({length:4},()=>crypto.randomUUID()),workouts:[crypto.randomUUID(),crypto.randomUUID()],catalogue:['floor_press','db_row','goblet','db_curl'],key:crypto.randomUUID(),grants:[],week:1,started:new Date().toISOString()};
  const c=fixture;let sql=`begin;do $$begin if exists(select 1 from public.coach_mesocycles) or exists(select 1 from public.coach_recommendations) or exists(select 1 from public.coach_weekly_checkins) or exists(select 1 from public.context_grants where scope in ('premium_training_history','premium_weekly_checkin')) then raise exception 'phase3_review_nonempty_baseline';end if;end $$;\ninsert into public.routines(id,owner_id,name) values(${q(c.routine)},${q(c.user)},${q(c.prefix)});\n`;
  c.days.forEach((id,i)=>sql+=`insert into public.routine_days(id,routine_id,name,day_order) values(${q(id)},${q(c.routine)},'Día ${i+1}',${i});\n`);
  c.exercises.forEach((id,i)=>sql+=`insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order) values(${q(id)},${q(c.days[Math.floor(i/2)])},${q(I.exercises.find(e=>e.id===c.catalogue[i]).name)},3,'8-12','2',180,${i%2});\n`);
  sql+=`select public.premium_provision(${q(c.user)},${q(c.routine)},(now() at time zone 'Europe/Madrid')::date,6,now()+interval '1 day');\n`;
  c.days.forEach((id,d)=>{const data={routine_id:c.routine,routine_day_id:id,notes:'PRIVATE CANARY REVIEW',exercises:c.exercises.slice(d*2,d*2+2).map(e=>({exercise_id:e,name:'PRIVATE CANARY REVIEW',sets:[{set:1,kg:40,reps:10,rir:2},{set:2,kg:40,reps:10,rir:2},{set:3,kg:40,reps:10,rir:2}]}))};sql+=`insert into public.workouts(id,user_id,variant,day,workout_date,data) values(${q(c.workouts[d])},${q(c.user)},'SYNTHETIC Phase3 REVIEW','Día ${d+1}',(now() at time zone 'Europe/Madrid')::date,${j(data)});\n`;});
  save();write('setup.sql',sql+'commit;');console.log('Prepared one new exact-ID staging fixture; no network mutation');return;
 }
 assert(fixture&&fixture.ref===credentials.ref);
 if(mode==='login'){
  for(const actor of ['mock','reviewer','trainer','real']){const u=credentials.users[actor],r=await req(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});check(actor+' existing controlled JWT',r.ok&&r.data.user.id===u.id);sessions[actor]=r.data;}
  write('sessions.json',sessions);return;
 }
 if(mode==='intake'){
  const m=await must(read('mock','coach_mesocycles','routine_id=eq.'+fixture.routine));check('one scoped mesocycle',m.length===1&&m[0].user_id===fixture.user);fixture.mesocycle=m[0].id;fixture.revision=m[0].current_revision_id;
  const before=await must(read('mock','context_grants','user_id=eq.'+fixture.user));fixture.grants_before=before.map(g=>g.id);
  check('owner submits closed Premium intake',(await rpc('mock','premium_save_intake',{p_mesocycle:fixture.mesocycle,p_expected:m[0].row_version,p_training:training,p_submit:true})).ok);
  check('owner grants training context',(await rpc('mock','premium_permission',{p_mesocycle:fixture.mesocycle,p_allow:true})).ok);
  check('owner grants separate weekly context',(await rpc('mock','premium_weekly_permission',{p_mesocycle:fixture.mesocycle,p_allow:true})).ok);
  fixture.grants=(await must(read('mock','context_grants','user_id=eq.'+fixture.user))).filter(g=>!fixture.grants_before.includes(g.id)).map(g=>g.id);save();
  write('enhance.sql',`begin;select public.premium_bind_catalogue(${q(fixture.mesocycle)},${q(fixture.revision)},${j(Object.fromEntries(fixture.exercises.map((id,i)=>[id,fixture.catalogue[i]])))});select public.premium_assign_reviewer(${q(fixture.mesocycle)},${q(fixture.reviewer)});commit;`);return;
 }
 if(mode==='checkin'){
  const a={...answers,review:{topic:'exercise',exercise_id:fixture.exercises[0]}};
  const c=await must(rpc('mock','premium_save_weekly_checkin',{p_mesocycle:fixture.mesocycle,p_week:1,p_revision:fixture.revision,p_expected:0,p_answers:a,p_submit:true}));
  check('owner immutable weekly checkin submitted',!!c.submitted_at&&c.routine_revision_id===fixture.revision&&c.user_id===fixture.user);fixture.checkin=c.id;save();return;
 }
 if(mode==='context'){
  const ctx=await must(rpc('mock','premium_weekly_provider_context',{p_mesocycle:fixture.mesocycle}));
  check('weekly context version and actual checkin',ctx.schema_version==='premium-weekly-provider-v1'&&!ctx.checkin_missing&&ctx.checkin.review.exercise_ref==='exercise_1');
  check('provider excludes private identities and notes',!JSON.stringify(ctx).includes('CANARY')&&!JSON.stringify(ctx).includes('@')&&!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(JSON.stringify(ctx)));
  write('context.json',ctx);write('baseline.json',{revision:(await must(read('mock','routine_revisions','id=eq.'+fixture.revision)))[0],history:await must(read('mock','workouts','id=in.('+fixture.workouts.join(',')+')&order=id')),exercises:await must(read('mock','routine_exercises','id=in.('+fixture.exercises.join(',')+')&order=id'))});return;
 }
 if(mode==='reserve'){
  const r=await must(rpc('mock','premium_weekly_reserve_analysis',{p_mesocycle:fixture.mesocycle,p_key:fixture.key}));
  check('weekly reservation exact revision and week',r.state==='analyzing'&&r.base_revision_id===fixture.revision&&r.analysis_week===1&&r.analysis_bundle.provider.schema_version==='premium-weekly-provider-v1');fixture.rec=r.id;save();return;
 }
 if(mode==='finish-sql'){
  const C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-premium/weekly-contract.mjs'))),ctx=get(file('context.json'));
  const output={schema_version:C.SCHEMA_VERSION,kind:'REVIEW',confidence:'low',facts:ctx.routine.exercises.map(e=>({exercise_ref:e.ref,claim:e.metrics.trend})),checkin_signals:[{field:'review',value:ctx.checkin.review.topic}],interpretation:'Hay una única exposición por ejercicio y una solicitud de revisar un ejercicio. La observación disponible no determina un cambio.',reason:'Solicitar resolución humana con el contexto capturado; no modificar automáticamente la programación.',changes:[]};
  const quality=C.semantic(output,ctx);check('controlled genuine REVIEW schema and semantic validity',C.validate(output)&&quality.ok);write('output.json',output);
  const receipt={model:'mock',prompt_version:C.PROMPT_VERSION,response_schema_version:C.SCHEMA_VERSION,input_tokens:0,output_tokens:0,cached_input_tokens:0,cost_usd:0,latency_ms:0,schema_valid:true,semantic_valid:true};
  write('finish.sql',`begin;select public.premium_analysis_claim(${q(fixture.user)},${q(fixture.rec)},1,'mock');select public.premium_analysis_finish(${q(fixture.user)},${q(fixture.rec)},${j(output)},null,${j(receipt)},${j(quality.warnings)});commit;`);return;
 }
 if(mode==='review'){
  const before=get(file('baseline.json')),r=(await must(read('mock','coach_recommendations','id=eq.'+fixture.rec)))[0],m=(await must(read('mock','coach_mesocycles','id=eq.'+fixture.mesocycle)))[0];
  check('genuine weekly REVIEW persisted pending human resolution',r.kind==='REVIEW'&&r.state==='pending_review'&&r.analysis_trace.error===null&&r.analysis_trace.output.kind==='REVIEW'&&r.analysis_trace.model==='mock'&&r.analysis_trace.charged_usd===0);
  check('reviewer explicitly assigned',m.reviewer_id===fixture.reviewer);
  check('pending REVIEW preserves canonical revision',equal(before.revision,(await must(read('mock','routine_revisions','id=eq.'+fixture.revision)))[0]));
  for(const actor of ['mock','trainer','real']){
   check(actor+' cannot manually resolve REVIEW',!(await rpc(actor,'premium_resolve_review',{p_id:fixture.rec,p_kind:'KEEP',p_patches:[],p_reason:'Unauthorized resolution attempt'})).ok);
   check(actor+' cannot accept unresolved REVIEW',!(await rpc(actor,'premium_accept_recommendation',{p_id:fixture.rec})).ok);
  }
  const other=await read('trainer','coach_recommendations','id=eq.'+fixture.rec);check('normal trainer cannot read REVIEW',!other.ok||other.data.length===0);
  const own=await must(read('reviewer','coach_recommendations','id=eq.'+fixture.rec));check('assigned reviewer reads exact persisted REVIEW',own.length===1&&own[0].kind==='REVIEW'&&own[0].state==='pending_review');
  const direct=await rpc('reviewer','premium_review_recommendation',{p_id:fixture.rec,p_approve:true,p_reason:'Attempt to approve unresolved review'});check('direct approval requires explicit resolution',!direct.ok&&direct.data?.message==='premium_manual_resolution_required');
  check('reviewer cannot accept on behalf of athlete',!(await rpc('reviewer','premium_accept_recommendation',{p_id:fixture.rec})).ok);
  await must(rpc('reviewer','premium_resolve_review',{p_id:fixture.rec,p_kind:'KEEP',p_patches:[],p_reason:'Controlled staging human decision: retain prescription and gather comparable exposure.'}));
  const ready=(await must(read('reviewer','coach_recommendations','id=eq.'+fixture.rec)))[0];check('human resolution ready KEEP with explicit reason',ready.kind==='KEEP'&&ready.state==='ready'&&ready.analysis_trace.manual_resolution==='KEEP'&&ready.analysis_trace.output.kind==='REVIEW'&&!!ready.review_reason&&!!ready.reviewed_at&&ready.patches.length===0);
  check('human resolution alone does not accept',(await must(read('mock','coach_mesocycles','id=eq.'+fixture.mesocycle)))[0].tracking_week===1);
  return;
 }
 if(mode==='accept'){
  const before=get(file('baseline.json'));const [a,b]=await Promise.all([rpc('mock','premium_accept_recommendation',{p_id:fixture.rec}),rpc('mock','premium_accept_recommendation',{p_id:fixture.rec})]);check('owner double accept returns same original revision',a.ok&&b.ok&&a.data===fixture.revision&&b.data===fixture.revision);
  const r=(await must(read('mock','coach_recommendations','id=eq.'+fixture.rec)))[0],m=(await must(read('mock','coach_mesocycles','id=eq.'+fixture.mesocycle)))[0];
  check('resolved weekly recommendation accepted',r.kind==='KEEP'&&r.state==='accepted'&&r.result_revision_id===fixture.revision);
  check('one tracking advancement and unchanged current revision',m.tracking_week===2&&m.current_revision_id===fixture.revision);
  const revs=await must(read('mock','routine_revisions','routine_id=eq.'+fixture.routine));check('KEEP creates no revision clone',revs.length===1&&equal(revs[0],before.revision));
  check('owned historical workouts byte exact',equal(before.history,await must(read('mock','workouts','id=in.('+fixture.workouts.join(',')+')&order=id'))));
  check('all live prescriptions and UUIDs byte exact',equal(before.exercises,await must(read('mock','routine_exercises','id=in.('+fixture.exercises.join(',')+')&order=id'))));
  const weeks=await must(read('mock','coach_mesocycle_weeks','mesocycle_id=eq.'+fixture.mesocycle+'&week_number=eq.1'));check('resolved first week completed with preserved revision',weeks.length===1&&weeks[0].state==='completed'&&weeks[0].revision_id===fixture.revision);return;
 }
 if(mode==='cleanup-sql'){
  const c=fixture;assert(c.rec&&c.mesocycle&&c.revision,'Complete exact-ID manifest required');
  write('cleanup.sql',`begin;set constraints premium_revision_rec_fk deferred;do $$begin if not exists(select 1 from public.routines where id=${q(c.routine)} and owner_id=${q(c.user)} and name=${q(c.prefix)}) or not exists(select 1 from public.coach_mesocycles where id=${q(c.mesocycle)} and routine_id=${q(c.routine)} and user_id=${q(c.user)}) then raise exception 'phase3_review_cleanup_identity_mismatch';end if;end $$;\ndelete from public.coach_weekly_checkins where id=${q(c.checkin)} and mesocycle_id=${q(c.mesocycle)} and user_id=${q(c.user)};delete from public.coach_recommendations where id=${q(c.rec)} and mesocycle_id=${q(c.mesocycle)} and user_id=${q(c.user)};delete from public.coach_mesocycle_weeks where mesocycle_id=${q(c.mesocycle)} and user_id=${q(c.user)};delete from public.coach_mesocycles where id=${q(c.mesocycle)} and user_id=${q(c.user)};delete from public.routine_management where routine_id=${q(c.routine)} and user_id=${q(c.user)};delete from public.routine_revisions where id=${q(c.revision)} and routine_id=${q(c.routine)} and user_id=${q(c.user)};delete from public.workouts where id in (${c.workouts.map(q).join(',')}) and user_id=${q(c.user)} and data->>'routine_id'=${q(c.routine)};delete from public.routine_exercises where id in (${c.exercises.map(q).join(',')}) and day_id in (${c.days.map(q).join(',')});delete from public.routine_days where id in (${c.days.map(q).join(',')}) and routine_id=${q(c.routine)};delete from public.routines where id=${q(c.routine)} and owner_id=${q(c.user)};delete from public.context_grants where id in (${c.grants.map(q).join(',')||'null'}) and user_id=${q(c.user)} and notice_version in ('premium-tracking-v1','premium-checkin-v1');commit;`);console.log('Prepared exact-ID cleanup; budget restoration remains coordinator-controlled');return;
 }
 if(mode==='logout'){
  for(const actor of Object.keys(sessions))check(actor+' controlled test session local signout',(await req(actor,'/auth/v1/logout?scope=local',{})).ok);
  fs.unlinkSync(file('sessions.json'));return;
 }
 throw Error('Unsupported explicit mode');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(out,'phase3-review-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,no_openai:true},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' checks');});
