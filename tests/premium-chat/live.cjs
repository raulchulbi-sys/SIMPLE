// Exact-ID staging Chat fixtures and actual JWT tests. This harness cannot dispatch a provider.
// SQL files are prepared locally for the root coordinator; no credentials/JWTs are printed.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),priv=path.join(__dirname,'private'),out=path.join(__dirname,'results');
fs.mkdirSync(priv,{recursive:true});fs.mkdirSync(out,{recursive:true});
const mode=process.argv[2],tag=process.argv[3]||'mock',rows=[],get=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const file=n=>path.join(priv,'chat-'+n),write=(n,v)=>fs.writeFileSync(file(n),typeof v==='string'?v:JSON.stringify(v,null,2));
const credentials=get(path.resolve(root,'../coach-premium-phase2/tests/premium-phase2/private/fixture.json'));
assert.equal(credentials.ref,'dmqjexigdnfzobarhnib');
let fixture=fs.existsSync(file('fixture.json'))?get(file('fixture.json')):null,sessions=fs.existsSync(file('sessions.json'))?get(file('sessions.json')):{};
const q=x=>"'"+String(x).replaceAll("'","''")+"'",j=x=>q(JSON.stringify(x))+'::jsonb',equal=(a,b)=>require('util').isDeepStrictEqual(a,b);
const check=(name,v)=>{rows.push({name,pass:!!v});assert(v,name);},save=()=>write('fixture.json',fixture);
const I=require(path.join(root,'assets/coach-intake.js')),s=(n,lo=8,hi=12,rir=2,rest=180)=>({set_number:n,reps_min:lo,reps_max:hi,rir,rest_seconds:rest});
const training={...I.emptyPremium(),experience:'gt4',pause:false,goal:'balanced',weak_points:['unsure'],days:2,weekdays:['mon','thu'],minutes_by_day:{mon:60,thu:60},effort:'confident',confidence:'high',recovery:'mostly',sleep:'h7_8',stress:'medium',distribution:'coach',activity:{type:'none',weekdays:[],minutes:null,intensity:null},inventory:{equipment:I.equipment.map(e=>e.id),custom:[]}};
const weekly={schema_version:'premium-weekly-checkin-v1',recovery:'good',sleep:'normal',fatigue:'normal',stress:'moderate',session_perception:'similar',availability:{changed:false,weekdays:[],minutes_by_day:{}},review:{topic:'none',exercise_id:null}};
async function req(actor,route,data,method){
 assert(fixture?.ref==='dmqjexigdnfzobarhnib');assert(route.startsWith('/rest/v1/')||route.startsWith('/auth/v1/'),'Only staging JWT/RPC routes');assert(!route.includes('/functions/'),'No Edge/OpenAI route');
 const r=await fetch('https://'+fixture.ref+'.supabase.co'+route,{method:method||(data===undefined?'GET':'POST'),headers:{apikey:credentials.key,...(sessions[actor]?{Authorization:'Bearer '+sessions[actor].access_token}:{}),'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(25000)});
 const raw=await r.text();let dataOut;try{dataOut=raw?JSON.parse(raw):null;}catch{dataOut={code:'non_json_response'};}return{ok:r.ok,status:r.status,data:dataOut};
}
const rpc=(a,n,d)=>req(a,'/rest/v1/rpc/'+n,d),read=(a,t,w,select='*')=>req(a,'/rest/v1/'+t+'?select='+select+'&'+w),must=async p=>{const r=await p;if(!r.ok)throw Error('Controlled staging request failed: '+r.status+' '+(r.data?.code||'unknown'));return r.data;};
const c=()=>{const item=fixture?.cases[tag];assert(item,'Exact fixture case required');return item;};
const reserveArgs=(item,message,key=crypto.randomUUID())=>({p_mesocycle:item.mesocycle,p_revision:item.revision,p_key:key,p_message:message});
const load=item=>must(rpc('mock','premium_chat_load',{p_mesocycle:item.mesocycle}));
function safeProjection(value){const text=JSON.stringify(value);return !/context_bundle|message_digest|reserved_usd|"receipt"|analysis_bundle|weekly_grant_id|history_grant_id/.test(text);}
async function main(){
 if(mode==='prepare'){
  assert(!fixture,'Do not overwrite a manifest');fixture={ref:credentials.ref,prefix:'SYNTHETIC Premium Chat '+crypto.randomUUID(),user:credentials.users.mock.id,reviewer:credentials.users.reviewer.id,cases:{},grants:[],started:new Date().toISOString()};let sql=`begin;do $$begin if exists(select 1 from public.coach_mesocycles) or exists(select 1 from public.coach_recommendations) or exists(select 1 from public.coach_weekly_checkins) or exists(select 1 from public.coach_conversations) or exists(select 1 from public.coach_messages) or exists(select 1 from public.context_grants where scope in ('premium_training_history','premium_weekly_checkin','premium_chat')) then raise exception 'chat_fixture_nonempty_baseline';end if;end $$;\n`;
  for(const name of ['real','mock']){
   const item={routine:crypto.randomUUID(),days:[crypto.randomUUID(),crypto.randomUUID()],exercises:Array.from({length:4},()=>crypto.randomUUID()),workouts:Array.from({length:8},()=>crypto.randomUUID()),catalogue:['hack','floor_press','db_row','db_curl'],turns:[],recommendations:[],week:3};item.plans=[[s(1,6,8,1,240),s(2,8,10,0,240),s(3,10,12,0,240)],[s(1),s(2,8,12,1)],[s(1),s(2,8,12,1)],[s(1,10,15,1,150),s(2,10,15,0,150)]];fixture.cases[name]=item;
   sql+=`insert into public.routines(id,owner_id,name) values(${q(item.routine)},${q(fixture.user)},${q(fixture.prefix+' '+name)});\n`;
   item.days.forEach((id,i)=>sql+=`insert into public.routine_days(id,routine_id,name,day_order) values(${q(id)},${q(item.routine)},'Día ${i+1}',${i});\n`);
   item.exercises.forEach((id,i)=>{const p=item.plans[i][0];sql+=`insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values(${q(id)},${q(item.days[Math.floor(i/2)])},${q(I.exercises.find(e=>e.id===item.catalogue[i]).name)},${item.plans[i].length},${q(p.reps_min+'-'+p.reps_max)},${q(p.rir)},${p.rest_seconds},${i%2},'PRIVATE CANARY Chat exercise');\n`;});
   sql+=`select public.premium_provision(${q(fixture.user)},${q(item.routine)},(now() at time zone 'Europe/Madrid')::date-14,6,now()+interval '2 days');\n`;
   for(let k=0;k<4;k++)for(let d=0;d<2;d++){
    const data={routine_id:item.routine,routine_day_id:item.days[d],notes:'PRIVATE CANARY Chat workout',exercises:item.exercises.slice(d*2,d*2+2).map((id,j)=>{const i=d*2+j;return{exercise_id:id,name:'PRIVATE CANARY Chat name',sets:item.plans[i].map(p=>({set:p.set_number,kg:i===0?(p.set_number===1?90:82.5):40,reps:i===1?p.reps_min+k:p.reps_max,rir:p.rir}))};})};
    sql+=`insert into public.workouts(id,user_id,variant,day,workout_date,data) values(${q(item.workouts[k*2+d])},${q(fixture.user)},${q('SYNTHETIC Chat '+name)},'Día ${d+1}',(now() at time zone 'Europe/Madrid')::date-${(3-k)*7},jsonb_set(${j(data)},'{routine_revision_id}',(select to_jsonb(current_revision_id::text) from public.coach_mesocycles where routine_id=${q(item.routine)})));\n`;
   }
  }
  save();write('setup.sql',sql+'commit;');console.log('Prepared two exact-ID staging routines, no users or provider dispatch');return;
 }
 assert(fixture&&fixture.ref===credentials.ref);
 if(mode==='summary'){
  const latest=new Map(),reports=fs.readdirSync(out).filter(n=>/^chat-live-.*\.json$/.test(n)).map(n=>({name:n,mtime:fs.statSync(path.join(out,n)).mtimeMs,data:get(path.join(out,n))})).sort((a,b)=>a.mtime-b.mtime);
  for(const report of reports)for(const row of report.data.rows)latest.set(row.name,row.pass);
  console.log(JSON.stringify({unique_checks:latest.size,passed:[...latest.values()].filter(Boolean).length,reports:reports.length,incomplete_reports:reports.filter(r=>!r.data.completed).map(r=>r.name),provider_calls_by_this_harness:0}));return;
 }
 if(mode==='login'){
  for(const actor of ['mock','real','reviewer','trainer']){const u=credentials.users[actor],r=await req(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});check(actor+' existing controlled JWT',r.ok&&r.data.user.id===u.id);sessions[actor]=r.data;write('sessions.json',sessions);}return;
 }
 if(mode==='refresh'){
  for(const[actor,v]of Object.entries(sessions)){const r=await req(null,'/auth/v1/token?grant_type=refresh_token',{refresh_token:v.refresh_token});check(actor+' controlled JWT refresh',r.ok&&r.data.user.id===credentials.users[actor].id);sessions[actor]=r.data;write('sessions.json',sessions);}return;
 }
 if(mode==='intake'){
  const before=await must(read('mock','context_grants','user_id=eq.'+fixture.user));fixture.grants_before=before.map(g=>g.id);let sql='begin;\n';
  for(const[name,item]of Object.entries(fixture.cases)){
   const ms=await must(read('mock','coach_mesocycles','routine_id=eq.'+item.routine));check(name+' one scoped Premium mesocycle',ms.length===1&&ms[0].user_id===fixture.user);item.mesocycle=ms[0].id;item.revision=ms[0].current_revision_id;item.original_revision=item.revision;save();
   check(name+' intake actual JWT submit',(await rpc('mock','premium_save_intake',{p_mesocycle:item.mesocycle,p_expected:ms[0].row_version,p_training:training,p_submit:true})).ok);
   check(name+' training consent',(await rpc('mock','premium_permission',{p_mesocycle:item.mesocycle,p_allow:true})).ok);check(name+' weekly consent',(await rpc('mock','premium_weekly_permission',{p_mesocycle:item.mesocycle,p_allow:true})).ok);
   const plans=Object.fromEntries(item.exercises.map((id,i)=>[id,item.plans[i]]));
   sql+=`update public.routine_revisions r set snapshot=jsonb_set(r.snapshot,'{days}',(select jsonb_agg(d||jsonb_build_object('exercises',(select jsonb_agg(e||jsonb_build_object('planned_sets',${j(plans)}->(e->>'id'),'scheme',case when e->>'id'=${q(item.exercises[0])} then 'top_backoff' else 'variable' end) order by (e->>'exercise_order')::int) from jsonb_array_elements(d->'exercises')e)) order by (d->>'day_order')::int) from jsonb_array_elements(r.snapshot->'days')d)) where r.id=${q(item.revision)} and r.routine_id=${q(item.routine)};update public.routine_revisions set snapshot_hash=md5(snapshot::text) where id=${q(item.revision)};\nselect public.premium_bind_catalogue(${q(item.mesocycle)},${q(item.revision)},${j(Object.fromEntries(item.exercises.map((id,i)=>[id,item.catalogue[i]])))});select public.premium_assign_reviewer(${q(item.mesocycle)},${q(fixture.reviewer)});\nupdate public.coach_mesocycles set tracking_week=3 where id=${q(item.mesocycle)};update public.coach_mesocycle_weeks set state='completed' where mesocycle_id=${q(item.mesocycle)} and week_number<3;\n`;
  }
  fixture.grants=(await must(read('mock','context_grants','user_id=eq.'+fixture.user))).filter(g=>!fixture.grants_before.includes(g.id)).map(g=>g.id);save();write('enhance.sql',sql+'commit;');return;
 }
 if(mode==='checkin'){
  for(const[name,item]of Object.entries(fixture.cases)){const ci=await must(rpc('mock','premium_save_weekly_checkin',{p_mesocycle:item.mesocycle,p_week:3,p_revision:item.revision,p_expected:0,p_answers:weekly,p_submit:true}));check(name+' immutable week3 checkin actual JWT',!!ci.submitted_at&&ci.week_number===3);item.checkin=ci.id;}save();return;
 }
 if(mode==='permission'){
  for(const[name,item]of Object.entries(fixture.cases))check(name+' chat needs its own consent',(await load(item)).permission===false);
  for(const[name,item]of Object.entries(fixture.cases)){
   const permission=await rpc('mock','premium_chat_permission',{p_mesocycle:item.mesocycle,p_allow:true});check(name+' owner explicitly allows Chat',permission.ok);
   const after=await load(item);check(name+' Chat load after consent safe',after.permission===true&&safeProjection(after));
  }
  fixture.grants=(await must(read('mock','context_grants','user_id=eq.'+fixture.user))).filter(g=>!fixture.grants_before.includes(g.id)).map(g=>g.id);save();return;
 }
 if(mode==='baseline'){
  for(const[name,item]of Object.entries(fixture.cases))write('baseline-'+name+'.json',{revision:(await must(read('mock','routine_revisions','id=eq.'+item.revision)))[0],history:await must(read('mock','workouts','id=in.('+item.workouts.join(',')+')&order=id')),exercises:await must(read('mock','routine_exercises','id=in.('+item.exercises.join(',')+')&order=id'))});console.log('Captured exact fixture snapshots and training records');return;
 }
 const item=c();
 if(mode==='isolation'){
  assert(item.turn&&item.conversation,'Populated Chat is required; reserve the controlled mock turn first');
  const ownConversation=await must(read('mock','coach_conversations','id=eq.'+item.conversation,'id,user_id,mesocycle_id'));
  const ownTurn=await must(read('mock','coach_messages','id=eq.'+item.turn,'id,user_id,mesocycle_id'));
  check('owner reads its populated conversation',ownConversation.length===1&&ownConversation[0].user_id===fixture.user);
  check('owner reads its populated message',ownTurn.length===1&&ownTurn[0].user_id===fixture.user);
  for(const actor of ['real','trainer','reviewer',null]){
   const label=actor||'anon';check(label+' cannot load owner private Chat',!(await rpc(actor,'premium_chat_load',{p_mesocycle:item.mesocycle})).ok);
   check(label+' cannot grant owner Chat',(await rpc(actor,'premium_chat_permission',{p_mesocycle:item.mesocycle,p_allow:true})).ok===false);
   check(label+' cannot reserve owner Chat',!(await rpc(actor,'premium_chat_reserve',reserveArgs(item,'Explica mi RIR objetivo.'))).ok);
   for(const table of ['coach_conversations','coach_messages']){const r=await read(actor,table,'mesocycle_id=eq.'+item.mesocycle,'id,user_id,mesocycle_id');check(label+' cannot read '+table+' rows',!r.ok||r.data.length===0);}
  }
  for(const table of ['coach_conversations','coach_messages']){
   check('owner no direct '+table+' INSERT',!(await req('mock','/rest/v1/'+table,{user_id:fixture.user,routine_id:item.routine,mesocycle_id:item.mesocycle})).ok);
   check('owner no direct '+table+' UPDATE',!(await req('mock','/rest/v1/'+table+'?mesocycle_id=eq.'+item.mesocycle,{user_id:credentials.users.real.id},'PATCH')).ok);
   check('owner no direct '+table+' DELETE',!(await req('mock','/rest/v1/'+table+'?mesocycle_id=eq.'+item.mesocycle,undefined,'DELETE')).ok);
  }
  for(const actor of ['mock','real','trainer','reviewer',null]){
   check((actor||'anon')+' cannot select captured provider bundle',!(await read(actor,'coach_messages','mesocycle_id=eq.'+item.mesocycle,'context_bundle,receipt,reserved_usd,message_digest')).ok);
   check((actor||'anon')+' cannot call provider claim',!(await rpc(actor,'premium_chat_claim',{p_user:fixture.user,p_id:crypto.randomUUID(),p_input_bound:1,p_mode:'mock'})).ok);
   check((actor||'anon')+' cannot call provider finish',!(await rpc(actor,'premium_chat_finish',{p_user:fixture.user,p_id:crypto.randomUUID(),p_output:null,p_error:'Unauthorized fixture attempt',p_receipt:{},p_warnings:[]})).ok);
  }
  return;
 }
 if(mode==='input'){
  const before=await load(item),count=before.messages.length;
  const sensitive=['Me duele la rodilla al entrenar.','Mi email es athlete@example.com.','Mi identificador es '+fixture.user+'.','Estoy tomando medicación para una lesión.','I have knee pain.','Contacta conmigo en 600 000 000.','Mi peso es 82 kg.'];
  for(let i=0;i<sensitive.length;i++){const r=await rpc('mock','premium_chat_reserve',reserveArgs(item,sensitive[i]));check('sensitive input '+i+' rejected before persistence',r.ok&&r.data?.id===null&&r.data?.state==='rejected'&&r.data?.error==='premium_chat_sensitive_input');}
  const invalid=['','   ','x'.repeat(5000),'<script>alert(1)</script>'];
  for(let i=0;i<invalid.length;i++){const r=await rpc('mock','premium_chat_reserve',reserveArgs(item,invalid[i]));check('invalid blank/length/HTML input '+i+' rejected',!r.ok||r.data?.state==='rejected'&&r.data?.id===null);}
  check('rejected private inputs create no Chat rows',(await load(item)).messages.length===count);return;
 }
 if(mode==='reserve'||mode==='candidate-prepare'){
  const message=process.argv.slice(4).join(' ')||'Explícame por qué mi hack tiene una primera serie y dos backoff.';const key=crypto.randomUUID(),r=await must(rpc('mock','premium_chat_reserve',reserveArgs(item,message,key)));
  check(tag+' reserved safe current turn',r.state==='reserved'&&r.revision_id===item.revision&&r.week===3&&safeProjection(r));item.key=key;item.turn=r.id;item.conversation=r.conversation_id;item.message=message;item.turns.push(r.id);save();write('last-turn-'+tag+'.json',r);
  if(mode==='candidate-prepare')write('candidate-context-'+tag+'.sql',`select public.premium_chat_claim(${q(fixture.user)},${q(item.turn)},1,'prepare');`);
  return;
 }
 if(mode==='races'){
  const args=reserveArgs(item,item.message,item.key),same=await Promise.all([rpc('mock','premium_chat_reserve',args),rpc('mock','premium_chat_reserve',args)]);check('same-key double submit returns exactly same turn',same.every(r=>r.ok&&r.data.id===item.turn));
  check('same key changed message cannot alter turn',!(await rpc('mock','premium_chat_reserve',{...args,p_message:'Cambia todo el volumen.'})).ok);
  check('same text with another key is deduplicated',(await must(rpc('mock','premium_chat_reserve',reserveArgs(item,item.message)))).id===item.turn);
  check('new concurrent turn cannot race current response',!(await rpc('mock','premium_chat_reserve',reserveArgs(item,'Explica también mis descansos.'))).ok);
  check('stale tab revision cannot create a turn',!(await rpc('mock','premium_chat_reserve',{...reserveArgs(item,'¿Qué cambia esta semana?'),p_revision:crypto.randomUUID()})).ok);
  const visible=(await load(item)).messages;check('one current turn after race tests',visible.filter(r=>r.id===item.turn).length===1&&safeProjection(visible));return;
 }
 if(mode==='finish-sql'){
  assert(item.turn);const output={schema_version:'premium-chat-v1',answer:'El RIR indica cuántas repeticiones quedarían con una ejecución adecuada. La primera serie y las series posteriores conservan sus propios objetivos; consulta la prescripción de cada serie.',facts_used:[],suggested_action:'none',recommendation_candidate:null};
  let warnings=[];
  if(process.argv[4]==='candidate'){
   const C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-chat/chat-contract.mjs'))),Series=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-premium/series-contract.mjs'))),provider=get(file('provider-'+tag+'.json'));
   check('captured mock provider exact current message',provider.schema_version==='premium-chat-context-v1'&&provider.message===item.message);
   const e=provider.training.routine.exercises.find(e=>e.ref==='exercise_1');assert(e&&e.catalogue_id==='hack'&&e.planned_sets.length===3);
   output.answer='Hay una propuesta para retirar únicamente la tercera serie de hack. Las otras series conservan sus objetivos. Requiere revisión humana y tu aceptación antes de cambiar la rutina.';
   output.facts_used=['exercise_1.prescription','exercise_1.metric'];output.suggested_action='propose_recommendation';output.recommendation_candidate={schema_version:Series.SCHEMA_VERSION,kind:'MODIFY',facts:[{exercise_ref:e.ref,claim:e.metrics.trend}],interpretation:'Propuesta controlada del chat: petición explícita de reducir una serie, con prescripción y observaciones capturadas.',reason:'Retirar únicamente la última serie y conservar todas las restantes para revisar su rendimiento posterior.',confidence:'medium',changes:[{action:'remove_set',exercise_ref:e.ref,set_number:3,from:Series.prescription(e.planned_sets[2])}]};
   const quality=C.semantic(output,provider);check('mock Chat candidate closed schema and existing series semantics',C.validate(output)&&quality.ok);warnings=quality.warnings;write('candidate-output-'+tag+'.json',output);
  }
  write('mock-output-'+tag+'.json',output);const receipt={model:'mock',prompt_version:'premium-chat-v1',response_schema_version:'premium-chat-v1',input_tokens:0,output_tokens:0,cached_input_tokens:0,cost_usd:0,latency_ms:0};
  write('finish-'+tag+'.sql',`begin;select public.premium_chat_claim(${q(fixture.user)},${q(item.turn)},1,'mock');select public.premium_chat_finish(${q(fixture.user)},${q(item.turn)},${j(output)},null,${j(receipt)},${j(warnings)});commit;`);console.log('Prepared zero-provider mock completion SQL');return;
 }
 if(mode==='candidate-context-sql'){
  assert(item.turn);write('candidate-context-'+tag+'.sql',`select public.premium_chat_claim(${q(fixture.user)},${q(item.turn)},1,'prepare');`);console.log('Prepared read-only provider projection without dispatch');return;
 }
 if(mode==='accepted-context-prepare'){
  const stale=await rpc('mock','premium_chat_reserve',{...reserveArgs(item,'Comprueba mi revisión activa.'),p_revision:item.original_revision});check('old accepted tab cannot reserve against revision N',!stale.ok);
  const message='Explica las series actuales de hack y qué decisión ha sido aceptada.',key=crypto.randomUUID(),turn=await must(rpc('mock','premium_chat_reserve',reserveArgs(item,message,key)));
  check('post-acceptance turn captures N+1 and same week',turn.state==='reserved'&&turn.revision_id===item.revision&&turn.revision_no===2&&turn.week===3&&safeProjection(turn));
  item.turn=turn.id;item.key=key;item.message=message;item.turns.push(turn.id);save();write('accepted-context-'+tag+'.sql',`select public.premium_chat_claim(${q(fixture.user)},${q(item.turn)},1,'prepare');`);return;
 }
 if(mode==='accepted-context-assert'){
  const C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-chat/chat-contract.mjs'))),provider=get(file('accepted-provider-'+tag+'.json'));
  check('refreshed current context passes closed Chat validation',C.contextQuality(provider).ok&&provider.message===item.message&&provider.mesocycle.current_revision===2&&provider.mesocycle.week===3);
  const hack=provider.training.routine.exercises.find(e=>e.ref==='exercise_1');check('refreshed Hack has only accepted two planned sets',hack?.catalogue_id==='hack'&&equal(hack.planned_sets,item.plans[0].slice(0,2)));
  check('accepted decision is present as structured evidence',provider.recent_decisions.some(d=>d.state==='accepted'&&d.kind==='MODIFY'&&d.changes.some(p=>p.exercise_ref==='exercise_1'&&p.field==='planned_sets'&&p.from.length===3&&p.to.length===2))&&provider.evidence.some(e=>e.id.startsWith('decision_')));
  check('previous revision messages and summary are not reused as current facts',provider.last_messages.length===0&&provider.summary.topics.length===0&&provider.summary.references.length===0);
  check('earlier checkin retains its captured revision label',provider.checkin?.capture_revision_no===1&&provider.checkin?.belongs_to_active_revision===false);return;
 }
 if(mode==='candidate-pending'){
  const turn=(await load(item)).messages.find(t=>t.id===item.turn);check('mock candidate completed with existing recommendation link',turn?.state==='completed'&&!!turn.recommendation_id&&safeProjection(turn));item.rec=turn.recommendation_id;item.recommendations.push(item.rec);save();
  const rec=(await must(read('mock','coach_recommendations','id=eq.'+item.rec)))[0],base=get(file('baseline-'+tag+'.json'));
  check('candidate existing pipeline pending human review',rec.kind==='MODIFY'&&rec.state==='pending_review'&&rec.analysis_week===null&&rec.base_revision_id===item.revision&&rec.analysis_trace.origin==='premium_chat');
  check('candidate persistence never changes live prescription',equal(base.exercises,await must(read('mock','routine_exercises','id=in.('+item.exercises.join(',')+')&order=id'))));
  check('athlete cannot accept before explicit review',!(await rpc('mock','premium_accept_recommendation',{p_id:item.rec})).ok);return;
 }
 if(mode==='candidate-revocation'){
  assert(item.rec);check('Chat candidate owner explicitly revokes consent',(await rpc('mock','premium_chat_permission',{p_mesocycle:item.mesocycle,p_allow:false})).ok);
  const seen=await read('reviewer','coach_recommendations','id=eq.'+item.rec);check('assigned reviewer loses pending candidate read on revoke',!seen.ok||seen.data.length===0);
  check('reviewer cannot approve revoked candidate',!(await rpc('reviewer','premium_review_recommendation',{p_id:item.rec,p_approve:true,p_reason:'Attempt after explicit revocation'})).ok);
  check('owner cannot accept revoked candidate',!(await rpc('mock','premium_accept_recommendation',{p_id:item.rec})).ok);
  check('owner retains its Chat reply after revoke',(await load(item)).messages.some(t=>t.id===item.turn));
  check('owner can explicitly grant again',(await rpc('mock','premium_chat_permission',{p_mesocycle:item.mesocycle,p_allow:true})).ok);
  const regranted=await read('reviewer','coach_recommendations','id=eq.'+item.rec);check('new consent does not revive captured old candidate',!regranted.ok||regranted.data.length===0);
  check('old candidate still cannot be approved',!(await rpc('reviewer','premium_review_recommendation',{p_id:item.rec,p_approve:true,p_reason:'Attempt after new grant'})).ok);
  item.revoked_candidate=item.rec;save();return;
 }
 if(mode==='candidate-accept'){
  assert(item.rec);const base=get(file('baseline-'+tag+'.json')),previous=item.revision;
  check('athlete cannot self-approve Chat candidate',!(await rpc('mock','premium_review_recommendation',{p_id:item.rec,p_approve:true,p_reason:'Unauthorized athlete approval'})).ok);
  check('trainer without assignment cannot approve Chat candidate',!(await rpc('trainer','premium_review_recommendation',{p_id:item.rec,p_approve:true,p_reason:'Unauthorized trainer approval'})).ok);
  const before=await must(read('reviewer','coach_recommendations','id=eq.'+item.rec));check('explicit reviewer sees limited candidate only',before.length===1&&before[0].state==='pending_review'&&!/"last_messages"|"user_message"|"chat_provider"/.test(JSON.stringify(before)));
  check('reviewer cannot read complete Chat journal',!(await read('reviewer','coach_messages','mesocycle_id=eq.'+item.mesocycle,'context_bundle')).ok);
  await must(rpc('reviewer','premium_review_recommendation',{p_id:item.rec,p_approve:true,p_reason:'Controlled staging reviewer approves only the removal of hack set three.'}));
  const ready=(await must(read('mock','coach_recommendations','id=eq.'+item.rec)))[0];check('explicit reviewer approval ready',ready.state==='ready'&&!!ready.reviewed_at&&!!ready.review_reason);
  const pair=await Promise.all([rpc('mock','premium_accept_recommendation',{p_id:item.rec}),rpc('mock','premium_accept_recommendation',{p_id:item.rec})]);check('double acceptance exactly one N+1',pair.every(r=>r.ok)&&pair[0].data===pair[1].data&&pair[0].data!==previous);
  const revisions=await must(read('mock','routine_revisions','routine_id=eq.'+item.routine+'&order=revision_no')),fresh=revisions.find(r=>r.id===pair[0].data),old=revisions.find(r=>r.id===previous);
  check('old N immutable and one new revision',revisions.length===2&&equal(old,base.revision)&&fresh.revision_no===2);
  const newExercises=fresh.snapshot.days.flatMap(d=>d.exercises),oldExercises=base.revision.snapshot.days.flatMap(d=>d.exercises),target=newExercises.find(e=>e.id===item.exercises[0]);
  check('hack retains original UUID and exact first two planned sets',target.id===item.exercises[0]&&equal(target.planned_sets,item.plans[0].slice(0,2)));
  check('other three exercise prescriptions retain exact identity and order',oldExercises.filter(e=>e.id!==item.exercises[0]).every(e=>{const n=newExercises.find(n=>n.id===e.id);return n&&equal(n.planned_sets,e.planned_sets)&&n.day_id===e.day_id&&n.exercise_order===e.exercise_order&&n.name===e.name&&n.notes===e.notes;})&&newExercises.length===4);
  check('all eight historical workouts byte intact',equal(base.history,await must(read('mock','workouts','id=in.('+item.workouts.join(',')+')&order=id'))));
  const live=await must(read('mock','routine_exercises','id=in.('+item.exercises.join(',')+')&order=id'));
  check('live target has only intended set reduction',live.find(e=>e.id===item.exercises[0]).sets===2&&base.exercises.filter(e=>e.id!==item.exercises[0]).every(e=>equal(e,live.find(n=>n.id===e.id))));
  const m=(await must(read('mock','coach_mesocycles','id=eq.'+item.mesocycle)))[0];check('Chat acceptance preserves tracking week3',m.tracking_week===3&&m.current_revision_id===fresh.id);
  const accepted=(await must(read('mock','coach_recommendations','id=eq.'+item.rec)))[0];check('Chat recommendation accepted with exact N+1',accepted.state==='accepted'&&accepted.result_revision_id===fresh.id);
  item.revision=fresh.id;save();return;
 }
 if(mode==='completed'){
  const state=await load(item),turn=state.messages.find(t=>t.id===item.turn);check('completed mock reply visible to owner',turn?.state==='completed'&&!!turn.answer&&turn.error===null&&safeProjection(state));
  check('completed idempotency key returns original turn',(await must(rpc('mock','premium_chat_reserve',reserveArgs(item,item.message,item.key)))).id===item.turn);
  const base=get(file('baseline-'+tag+'.json'));
  check('Chat leaves current accepted revision unchanged',equal(base.revision,(await must(read('mock','routine_revisions','id=eq.'+item.revision)))[0]));
  check('Chat leaves workout history byte exact',equal(base.history,await must(read('mock','workouts','id=in.('+item.workouts.join(',')+')&order=id'))));
  check('Chat leaves live exercises byte exact',equal(base.exercises,await must(read('mock','routine_exercises','id=in.('+item.exercises.join(',')+')&order=id'))));return;
 }
 if(mode==='revocation'){
  check('owner revokes Chat processing',(await rpc('mock','premium_chat_permission',{p_mesocycle:item.mesocycle,p_allow:false})).ok);
  const own=await load(item);check('owner retains private history after revocation',own.permission===false&&own.messages.some(t=>t.id===item.turn));
  check('revoked Chat cannot reserve another message',!(await rpc('mock','premium_chat_reserve',reserveArgs(item,'Explícame mi sesión.'))).ok);return;
 }
 if(mode==='cleanup-sql'){
  let sql='begin;set constraints premium_revision_rec_fk deferred;\n';
  for(const[name,item]of Object.entries(fixture.cases)){
   assert(item.mesocycle&&item.revision);sql+=`do $$begin if not exists(select 1 from public.routines where id=${q(item.routine)} and owner_id=${q(fixture.user)} and name=${q(fixture.prefix+' '+name)}) then raise exception 'chat_cleanup_identity_mismatch';end if;end $$;\ndelete from public.coach_messages where mesocycle_id=${q(item.mesocycle)} and user_id=${q(fixture.user)};delete from public.coach_conversations where mesocycle_id=${q(item.mesocycle)} and user_id=${q(fixture.user)};delete from public.coach_weekly_checkins where mesocycle_id=${q(item.mesocycle)} and user_id=${q(fixture.user)};delete from public.coach_recommendations where mesocycle_id=${q(item.mesocycle)} and user_id=${q(fixture.user)};delete from public.coach_mesocycle_weeks where mesocycle_id=${q(item.mesocycle)} and user_id=${q(fixture.user)};delete from public.coach_mesocycles where id=${q(item.mesocycle)} and user_id=${q(fixture.user)};delete from public.routine_management where routine_id=${q(item.routine)} and user_id=${q(fixture.user)};delete from public.routine_revisions where routine_id=${q(item.routine)} and user_id=${q(fixture.user)};delete from public.workouts where id in (${item.workouts.map(q).join(',')}) and user_id=${q(fixture.user)} and data->>'routine_id'=${q(item.routine)};delete from public.routine_exercises where id in (${item.exercises.map(q).join(',')}) and day_id in (${item.days.map(q).join(',')});delete from public.routine_days where id in (${item.days.map(q).join(',')}) and routine_id=${q(item.routine)};delete from public.routines where id=${q(item.routine)} and owner_id=${q(fixture.user)};\n`;
  }
  fixture.grants=(await must(read('mock','context_grants','user_id=eq.'+fixture.user))).filter(g=>!fixture.grants_before.includes(g.id)).map(g=>g.id);save();sql+=`delete from public.context_grants where id in (${fixture.grants.map(q).join(',')||'null'}) and user_id=${q(fixture.user)} and scope in ('premium_training_history','premium_weekly_checkin','premium_chat');commit;`;write('cleanup.sql',sql);console.log('Prepared exact-fixture cleanup, budgets remain coordinator-controlled');return;
 }
 if(mode==='logout'){
  for(const actor of Object.keys(sessions))check(actor+' controlled local signout',(await req(actor,'/auth/v1/logout?scope=local',{})).ok);fs.unlinkSync(file('sessions.json'));return;
 }
 throw Error('Unsupported explicit test mode');
}
module.exports={fixture,credentials,sessions,rpc,read,must,req,load,rows,check,q,j,write,get,file,save,reserveArgs,safeProjection};
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(out,'chat-live-'+mode+'-'+tag+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,no_openai:true},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' checks');});
