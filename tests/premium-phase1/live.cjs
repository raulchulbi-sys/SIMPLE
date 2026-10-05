// Real staging JWT tests. Never call OpenAI or create/change/delete Auth users.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=path.join(__dirname,'private'),out=path.join(__dirname,'results');fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const save=(n,x)=>fs.writeFileSync(path.join(dir,n),typeof x==='string'?x:JSON.stringify(x,null,2));
const q=x=>"'"+String(x).replaceAll("'","''")+"'",mode=process.argv[2];
if(mode==='prepare'){
 const source=JSON.parse(fs.readFileSync(process.argv[3]));assert.equal(source.ref,'dmqjexigdnfzobarhnib');
 assert(!fs.existsSync(path.join(dir,'fixture.json')),'Never replace a fixture manifest');
 const c={ref:source.ref,key:source.key,users:source.users,routine:crypto.randomUUID(),days:[crypto.randomUUID(),crypto.randomUUID()],exercises:Array.from({length:4},()=>crypto.randomUUID()),replacement:crypto.randomUUID(),workouts:[]};
 save('fixture.json',c);process.exit(0);
}
const c=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json')));assert.equal(c.ref,'dmqjexigdnfzobarhnib');
if(mode==='attach'){Object.assign(c,JSON.parse(fs.readFileSync(path.join(dir,'attach.json'))));save('fixture.json',c);process.exit(0);}
if(mode==='fresh-after-cleanup'){save('fixture-first-run.json',c);c.workouts=[];delete c.ui_routine;delete c.ui_days;delete c.ui_mesocycle;delete c.grants;save('fixture.json',c);process.exit(0);}
const base='https://'+c.ref+'.supabase.co',I=require('../../assets/coach-intake.js');
let sessions=fs.existsSync(path.join(dir,'sessions.json'))?JSON.parse(fs.readFileSync(path.join(dir,'sessions.json'))):{};
let checks=[];function check(n,v){checks.push({name:n,pass:!!v});if(!v)throw Error(n);}
async function request(w,route,data,method){const r=await fetch(base+route,{method:method||(data===undefined?'GET':'POST'),headers:{apikey:c.key,...(sessions[w]?{Authorization:'Bearer '+sessions[w].access_token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(25000)});let d;try{d=await r.json();}catch{d=null;}return{ok:r.ok,status:r.status,data:d};}
const rpc=(w,n,d)=>request(w,'/rest/v1/rpc/'+n,d);
const good={...I.emptyPremium(),experience:'y2_4',pause:false,goal:'balanced',weak_points:['upper_back'],days:2,weekdays:['mon','thu'],minutes_by_day:{mon:60,thu:45},effort:'confident',confidence:'medium',recovery:'mostly',sleep:'h7_8',stress:'low',distribution:'coach',activity:{type:'none',weekdays:[],minutes:null,intensity:null},inventory:{equipment:['dumbbells','bench'],custom:[]}};
async function main(){
 if(['intake','pending','accept','replacement','closed','race','atomic','scoped-review','unassigned-review'].includes(mode))for(const k of Object.keys(c.users))assert(sessions[k]?.expires_at>Date.now()/1000+60,'Refresh staging JWT before running '+mode);
 if(mode==='login'){
  for(const [k,u] of Object.entries(c.users)){
   const r=await request(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});check('JWT '+k,r.ok&&r.data.user.id===u.id);sessions[k]=r.data;
  }save('sessions.json',sessions);
 }
 if(mode==='setup'){
  let sql='begin;\n';sql+=`insert into public.routines(id,owner_id,name) values('${c.routine}','${c.users.mock.id}','SYNTHETIC Premium Phase1');\n`;
  c.days.forEach((d,i)=>sql+=`insert into public.routine_days(id,routine_id,name,day_order) values('${d}','${c.routine}','Día ${i+1}',${i});\n`);
  const names=['Remo con mancuerna','Press con mancuernas','Sentadilla goblet','Hiperextensiones de cadera'];
  c.exercises.forEach((e,i)=>sql+=`insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values('${e}','${c.days[Math.floor(i/2)]}',${q(names[i])},3,'8-12','2',180,${i%2},'PRIVATE NOTE CANARY');\n`);
  for(let j=0;j<4;j++)for(let d=0;d<2;d++){
   const id=crypto.randomUUID();c.workouts.push(id);const data={routine_id:c.routine,routine_day_id:c.days[d],personal_note:'PRIVATE NOTE CANARY',exercises:[d*2,d*2+1].filter(i=>i!==3||j===3).map(i=>({exercise_id:c.exercises[i],name:names[i],notes:'PRIVATE NOTE CANARY',sets:Array.from({length:3},()=>({kg:20,reps:i===0?8+j:i===1?10:12-j,rir:2}))}))};
   sql+=`insert into public.workouts(id,user_id,variant,day,workout_date,data) values('${id}','${c.users.mock.id}','SYNTHETIC Premium','Día ${d+1}',current_date-${21-j*7},${q(JSON.stringify(data))}::jsonb);\n`;
  }
  sql+=`select public.premium_provision('${c.users.mock.id}','${c.routine}',current_date-21,7,now()+interval '1 day');\ncommit;`;
  save('setup.sql',sql);save('fixture.json',c);
 }
 if(mode==='ui-setup'){
  assert(!c.ui_routine,'Do not create another UI fixture');c.ui_routine=crypto.randomUUID();c.ui_days=[crypto.randomUUID(),crypto.randomUUID()];save('fixture.json',c);
  save('ui-setup.sql',`begin;insert into public.routines(id,owner_id,name) values('${c.ui_routine}','${c.users.mock.id}','SYNTHETIC Premium UI');\n`+c.ui_days.map((id,i)=>`insert into public.routine_days(id,routine_id,name,day_order) values('${id}','${c.ui_routine}','Día ${i+1}',${i});`).join('\n')+`\nselect public.premium_provision('${c.users.mock.id}','${c.ui_routine}',current_date,5,now()+interval '1 day');commit;`);
 }
 if(mode==='intake'){
  const m=c.mesocycle;let version=1;
  check('history requires explicit grant',!(await rpc('mock','premium_training_history',{p_mesocycle:m})).ok);
  for(const w of ['real','trainer','reviewer']){
   check(w+' cannot save another intake',!(await rpc(w,'premium_save_intake',{p_mesocycle:m,p_expected:version,p_training:good,p_submit:true})).ok);
   check(w+' cannot grant another history',!(await rpc(w,'premium_permission',{p_mesocycle:m,p_allow:true})).ok);
   check(w+' cannot read another history',!(await rpc(w,'premium_training_history',{p_mesocycle:m})).ok);
   for(const table of ['coach_mesocycles','coach_mesocycle_weeks','coach_recommendations','routine_revisions','routine_management']){
    const r=await request(w,'/rest/v1/'+table+'?select=*&'+(table==='routine_management'?'routine_id':'user_id')+'=eq.'+(table==='routine_management'?c.routine:c.users.mock.id));check(w+' RLS '+table,r.ok&&r.data.length===0);
   }
  }
  for(const bad of [ {...good,health:{}},{...good,weak_points:['chest'],experience:'lt6'}, {...good,confidence:'medium',effort:'unknown'}, {...good,minutes_by_day:{mon:60}}, {...good,inventory:{equipment:['invented'],custom:[]}}, {...good,inventory:{equipment:[],custom:['dolor lumbar']}}, {...good,activity:{type:'football',weekdays:[],minutes:60,intensity:'high'}} ])
   check('invalid intake rejected '+checks.length,!(await rpc('mock','premium_save_intake',{p_mesocycle:m,p_expected:version,p_training:bad,p_submit:true})).ok);
  check('null optimistic version rejected',!(await rpc('mock','premium_save_intake',{p_mesocycle:m,p_expected:null,p_training:good,p_submit:true})).ok);
  const draft=await rpc('mock','premium_save_intake',{p_mesocycle:m,p_expected:version,p_training:{...I.emptyPremium(),experience:'lt6'},p_submit:false});check('real draft persisted',draft.ok&&draft.data.intake.experience==='lt6');version=draft.data.row_version;
  check('stale draft rejected',!(await rpc('mock','premium_save_intake',{p_mesocycle:m,p_expected:1,p_training:good,p_submit:true})).ok);
  const submitted=await rpc('mock','premium_save_intake',{p_mesocycle:m,p_expected:version,p_training:good,p_submit:true});check('real premium-intake-v1 submitted',submitted.ok&&submitted.data.state==='active'&&submitted.data.intake.schema_version==='premium-intake-v1');
  check('submitted intake immutable',!(await rpc('mock','premium_save_intake',{p_mesocycle:m,p_expected:submitted.data.row_version,p_training:good,p_submit:true})).ok);
  check('grant allowed',(await rpc('mock','premium_permission',{p_mesocycle:m,p_allow:true})).ok);
  const h=await rpc('mock','premium_training_history',{p_mesocycle:m});check('own history actual RPC',h.ok);save('history.json',h.data);
  const metrics=c.exercises.map(e=>h.data.exercises.find(x=>x.exercise_id===e).metrics.trend);
  check('A descriptive comparable progression',metrics[0]==='reps_increasing_comparable');check('B stable performance',metrics[1]==='stable_comparable');check('C repeated decline',metrics[2]==='reps_decreasing_comparable');check('D insufficient history',metrics[3]==='insufficient_data');
  const provider=await rpc('mock','premium_provider_context',{p_mesocycle:m});check('provider projection allowed',provider.ok);const serialized=JSON.stringify(provider.data);check('provider has no internal UUIDs',!/[a-f0-9]{8}-[a-f0-9-]{27}/i.test(serialized));check('provider has no free notes',!serialized.includes('CANARY')&&!serialized.includes('Hiperextensiones'));save('provider.json',provider.data);
  check('revoke allowed',(await rpc('mock','premium_permission',{p_mesocycle:m,p_allow:false})).ok);check('revoke blocks new history',!(await rpc('mock','premium_training_history',{p_mesocycle:m})).ok);check('revoke blocks new provider context',!(await rpc('mock','premium_provider_context',{p_mesocycle:m})).ok);check('grant restored for fixture',(await rpc('mock','premium_permission',{p_mesocycle:m,p_allow:true})).ok);
  check('anonymous history denied',!(await rpc(null,'premium_training_history',{p_mesocycle:m})).ok);
  check('client cannot provision access',!(await rpc('mock','premium_provision',{p_user:c.users.mock.id,p_routine:c.routine,p_start:'2026-10-02',p_weeks:7,p_until:'2026-11-01'})).ok);
  check('client cannot produce/approve recommendations',!(await rpc('mock','premium_mock_recommendation',{p_mesocycle:m,p_kind:'KEEP',p_patches:[],p_facts:[],p_interpretation:'Mock'})).ok);
  check('direct Premium object insert denied',!(await request('mock','/rest/v1/coach_recommendations',{mesocycle_id:m})).ok);
 }
 if(mode==='recs'){
  const patch=(i,f,a,b)=>({target_id:c.exercises[i],field:f,from:a,to:b});
  const specs={keepA:['KEEP',[],['Las repeticiones aumentaron con la misma carga y RIR.'],'Mantener. No se atribuye causalidad.'],keepB:['KEEP',[],['Las repeticiones permanecieron estables con la misma carga y RIR.'],'Mantener.'],reviewD:['REVIEW',[],['Solo consta una exposición.'],'Evidencia insuficiente; revisión humana.'],modifyC:['MODIFY',[patch(2,'sets',3,2)],['Las repeticiones bajaron en tres exposiciones comparables.'],'Se propone reducir una serie; no se presume la causa.'],competing:['MODIFY',[patch(2,'rest_seconds',180,210)],['Misma revisión de origen.'],'Cambio concurrente de prueba.']};
  save('recommend.sql','begin;\nset local role service_role;\n'+Object.entries(specs).map(([k,[kind,p,f,i]])=>`select ${q(k)} as label,public.premium_mock_recommendation('${c.mesocycle}',${q(kind)},${q(JSON.stringify(p))}::jsonb,${q(JSON.stringify(f))}::jsonb,${q(i)}) as id;`).join('\n')+'\ncommit;');
 }
 if(mode==='pending'){
  check('cannot accept before review',!(await rpc('mock','premium_accept_recommendation',{p_id:c.recs.modifyC})).ok);
  for(const w of ['real','trainer','reviewer'])check(w+' cannot accept another recommendation',!(await rpc(w,'premium_accept_recommendation',{p_id:c.recs.modifyC})).ok);
  check('owner cannot self-review',!(await rpc('mock','premium_review_recommendation',{p_id:c.recs.modifyC,p_approve:true,p_reason:'Self review'})).ok);
 }
 if(mode==='accept'){
  const old=c.initial_revision;
  const keep=await rpc('mock','premium_accept_recommendation',{p_id:c.recs.keepA});check('KEEP does not create revision',keep.ok&&keep.data===old);
  const responses=await Promise.all([rpc('mock','premium_accept_recommendation',{p_id:c.recs.modifyC}),rpc('mock','premium_accept_recommendation',{p_id:c.recs.modifyC})]);save('accept-responses.json',responses);check('double acceptance idempotent',responses.every(r=>r.ok)&&responses[0].data===responses[1].data);c.revision2=responses[0].data;save('fixture.json',c);
  check('old competing recommendation rejected',!(await rpc('mock','premium_accept_recommendation',{p_id:c.recs.competing})).ok);
  const revisions=await request('mock','/rest/v1/routine_revisions?routine_id=eq.'+c.routine+'&order=revision_no');check('exactly revision1 and2',revisions.ok&&revisions.data.length===2&&revisions.data[0].id===old&&revisions.data[1].id===c.revision2);save('revisions-after.json',revisions.data);
  const locked=await request('mock','/rest/v1/routine_exercises?id=eq.'+c.exercises[0],{sets:10},'PATCH');check('direct structure editing rejected',!locked.ok);
  const mutation=await request('mock','/rest/v1/routine_revisions?id=eq.'+old,{reason:'overwrite'},'PATCH');check('immutable revision API',!mutation.ok);
 }
 if(mode==='replacement-sql'){
  const p={target_id:c.exercises[3],field:'replace_exercise',from:c.exercises[3],to:{id:c.replacement,catalogue_id:'glute_bridge',sets:2,target:'10-15',rir:'2',rest_seconds:150}};
  save('replacement.sql',`begin;set local role service_role;select public.premium_mock_recommendation('${c.mesocycle}','MODIFY',${q(JSON.stringify([p]))}::jsonb,'["Sustitución explícita sintética; no equivalencia histórica."]'::jsonb,'Nuevo UUID sin heredar datos.');commit;`);
 }
 if(mode==='replacement'){
  const r=await rpc('mock','premium_accept_recommendation',{p_id:c.replace_rec});check('replacement revision3',r.ok&&r.data!==c.revision2);c.revision3=r.data;save('fixture.json',c);
 }
 if(mode==='closed'){
  check('completed mesocycle rejects acceptance',!(await rpc('mock','premium_accept_recommendation',{p_id:c.closed_rec})).ok);
  check('completed mesocycle rejects history',!(await rpc('mock','premium_training_history',{p_mesocycle:c.mesocycle})).ok);
 }
 if(mode==='scoped-review'){
  for(const table of ['coach_mesocycles','coach_mesocycle_weeks','coach_recommendations']){
   const r=await request('reviewer','/rest/v1/'+table+'?select=*&'+(table==='coach_mesocycles'?'id':'mesocycle_id')+'=eq.'+c.mesocycle);check('explicit reviewer scoped '+table,r.ok&&r.data.length>0);
   const normal=await request('trainer','/rest/v1/'+table+'?select=*&'+(table==='coach_mesocycles'?'id':'mesocycle_id')+'=eq.'+c.mesocycle);check('normal trainer still denied '+table,normal.ok&&normal.data.length===0);
  }
  check('assigned reviewer cannot use owner history API',!(await rpc('reviewer','premium_training_history',{p_mesocycle:c.mesocycle})).ok);
  check('assigned reviewer cannot accept for owner',!(await rpc('reviewer','premium_accept_recommendation',{p_id:c.scoped_rec})).ok);
  check('assigned reviewer can validate scoped recommendation',(await rpc('reviewer','premium_review_recommendation',{p_id:c.scoped_rec,p_approve:true,p_reason:'Structured staging review'})).ok);
  check('client cannot assign a reviewer',!(await rpc('mock','premium_assign_reviewer',{p_mesocycle:c.mesocycle,p_reviewer:c.users.mock.id})).ok);
 }
 if(mode==='restore-grant')check('owner restores fixture history grant',(await rpc('mock','premium_permission',{p_mesocycle:c.mesocycle,p_allow:true})).ok);
 if(mode==='unassigned-review'){
  const r=await request('reviewer','/rest/v1/coach_recommendations?mesocycle_id=eq.'+c.mesocycle);check('removed reviewer loses scoped access',r.ok&&r.data.length===0);
 }
 if(mode==='race'){
  const r=await Promise.all(c.race.map(p_id=>rpc('mock','premium_accept_recommendation',{p_id})));
  save('race-responses.json',r);
  check('two different recommendations one winner',r.filter(x=>x.ok).length===1&&r.filter(x=>!x.ok).length===1);
  c.race_revision=r.find(x=>x.ok).data;save('fixture.json',c);
 }
 if(mode==='atomic'){
  const before=await request('mock','/rest/v1/routine_revisions?routine_id=eq.'+c.routine+'&order=revision_no');
  check('mid-apply failure rejects recommendation',!(await rpc('mock','premium_accept_recommendation',{p_id:c.atomic_rec})).ok);
  const after=await request('mock','/rest/v1/routine_revisions?routine_id=eq.'+c.routine+'&order=revision_no');check('mid-apply failure creates no partial revision',JSON.stringify(before.data)===JSON.stringify(after.data));
 }
 if(mode==='final-sql'){
  const rec=(patches,reason)=>`select public.premium_mock_recommendation('${c.mesocycle}','MODIFY',${q(JSON.stringify(patches))}::jsonb,'["Synthetic Phase1 verification"]'::jsonb,${q(reason)});`;
  const patch=(i,f,a,b)=>({target_id:c.exercises[i],field:f,from:a,to:b});
  const replace={target_id:c.exercises[0],field:'replace_exercise',from:c.exercises[0],to:{id:crypto.randomUUID(),catalogue_id:'glute_bridge',sets:2,target:'10-15',rir:'2',rest_seconds:150}};
  save('atomic.sql','begin;set local role service_role;'+rec([replace,patch(0,'sets',3,2)],'Atomic failure fixture')+'commit;');
  save('race.sql','begin;set local role service_role;'+rec([patch(0,'sets',3,2)],'Concurrent A')+rec([patch(1,'sets',3,2)],'Concurrent B')+'commit;');
 }
}
main().then(()=>{fs.writeFileSync(path.join(out,mode+'.json'),JSON.stringify({mode,checks},null,2));console.log(JSON.stringify({mode,passed:checks.length}));}).catch(e=>{fs.writeFileSync(path.join(out,mode+'-failure.json'),JSON.stringify({mode,checks,error:e.message},null,2));console.error(e.message);process.exitCode=1;});
