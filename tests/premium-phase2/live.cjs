// Staging-only synthetic data; existing controlled users, no Auth writes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const dir=path.join(__dirname,'private'),out=path.join(__dirname,'results'),mode=process.argv[2];fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const write=(n,d)=>fs.writeFileSync(path.join(dir,n),typeof d==='string'?d:JSON.stringify(d,null,2)),q=x=>"'"+String(x).replaceAll("'","''")+"'";
if(mode==='prepare'){
 assert(!fs.existsSync(path.join(dir,'fixture.json')),'Never overwrite manifest');const source=JSON.parse(fs.readFileSync(process.argv[3]));assert.equal(source.ref,'dmqjexigdnfzobarhnib');
 const c={ref:source.ref,key:source.key,users:source.users,cases:{},grants:[]};for(const t of 'ABCDEFGH')c.cases[t]={routine:crypto.randomUUID(),days:[crypto.randomUUID(),crypto.randomUUID()],exercises:Array.from({length:4},()=>crypto.randomUUID()),workouts:[],keys:[]};write('fixture.json',c);process.exit(0);
}
const c=JSON.parse(fs.readFileSync(path.join(dir,'fixture.json')));assert.equal(c.ref,'dmqjexigdnfzobarhnib');const base='https://'+c.ref+'.supabase.co',I=require('../../assets/coach-intake.js');
let sessions=fs.existsSync(path.join(dir,'sessions.json'))?JSON.parse(fs.readFileSync(path.join(dir,'sessions.json'))):{},rows=[];
function check(name,v){rows.push({name,pass:!!v});if(!v)throw Error(name);}
async function request(w,route,data){const r=await fetch(base+route,{method:data===undefined?'GET':'POST',headers:{apikey:c.key,...(sessions[w]?{Authorization:'Bearer '+sessions[w].access_token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(route.includes('/functions/')?120000:20000)});let v;try{v=await r.json();}catch{v=null;}return{ok:r.ok,status:r.status,data:v};}
const rpc=(w,n,d)=>request(w,'/rest/v1/rpc/'+n,d);
const good={...I.emptyPremium(),experience:'y2_4',pause:false,goal:'balanced',weak_points:['unsure'],days:2,weekdays:['mon','thu'],minutes_by_day:{mon:60,thu:60},effort:'confident',confidence:'medium',recovery:'mostly',sleep:'h7_8',stress:'medium',distribution:'coach',activity:{type:'none',weekdays:[],minutes:null,intensity:null},inventory:{equipment:['dumbbells','bench','bands'],custom:[]}};
async function main(){
 if(mode==='login'){for(const[k,u]of Object.entries(c.users)){const r=await request(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});check('JWT '+k,r.ok&&r.data.user.id===u.id);sessions[k]=r.data;}write('sessions.json',sessions);}
 if(mode==='setup'){
  let sql='begin;\n';for(const[tag,f]of Object.entries(c.cases)){
   sql+=`insert into public.routines(id,owner_id,name) values('${f.routine}','${c.users.mock.id}','SYNTHETIC Premium Phase2 ${tag}');\n`;
   f.days.forEach((id,i)=>sql+=`insert into public.routine_days(id,routine_id,name,day_order) values('${id}','${f.routine}','Día ${i+1}',${i});\n`);
   f.catalogue=tag==='F'?['db_curl','floor_press','goblet','db_row']:['db_row','floor_press','goblet','db_curl'];
   f.exercises.forEach((id,i)=>sql+=`insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values('${id}','${f.days[Math.floor(i/2)]}',${q(I.exercises.find(e=>e.id===f.catalogue[i]).name)},3,'8-12','2',${i===2?240:180},${i%2},'PRIVATE NOTE CANARY');\n`);
   const n=tag==='D'?1:4;for(let j=0;j<n;j++)for(let d=0;d<2;d++){
    const id=crypto.randomUUID();f.workouts.push(id);const data={routine_id:f.routine,routine_day_id:f.days[d],notes:'PRIVATE NOTE CANARY',exercises:[d*2,d*2+1].map(i=>({exercise_id:f.exercises[i],name:'STORED NAME CANARY',sets:Array.from({length:3},()=>({kg:20,reps:tag==='A'?8+j:['C','G'].includes(tag)?12-j:10,rir:tag==='E'?[0,3,1,4][j]:2}))}))};
    sql+=`insert into public.workouts(id,user_id,variant,day,workout_date,data) values('${id}','${c.users.mock.id}','SYNTHETIC Premium Phase2','Día ${d+1}',current_date-${(n-1-j)*7},${q(JSON.stringify(data))}::jsonb);\n`;
   }sql+=`select public.premium_provision('${c.users.mock.id}','${f.routine}',current_date-21,6,now()+interval '1 day');\n`;
  }write('setup.sql',sql+'commit;');write('fixture.json',c);
 }
 if(mode==='attach'){const data=JSON.parse(fs.readFileSync(path.join(dir,'attach.json')));for(const f of Object.values(c.cases)){const m=data.find(r=>r.routine_id===f.routine);assert(m);f.mesocycle=m.id;f.revision=m.current_revision_id;}write('fixture.json',c);}
 if(mode==='intake'){
  let sql='begin;\n';for(const[tag,f]of Object.entries(c.cases)){
   const training=structuredClone(good);if(tag==='F')training.excluded=['db_curl'];if(tag==='G')training.minutes_by_day={mon:30,thu:30};
   check(tag+' real submitted intake',(await rpc('mock','premium_save_intake',{p_mesocycle:f.mesocycle,p_expected:1,p_training:training,p_submit:true})).ok);
   check(tag+' explicit history grant',(await rpc('mock','premium_permission',{p_mesocycle:f.mesocycle,p_allow:true})).ok);
   const bindings=Object.fromEntries(f.exercises.map((id,i)=>[id,f.catalogue[i]]));sql+=`select public.premium_bind_catalogue('${f.mesocycle}','${f.revision}',${q(JSON.stringify(bindings))}::jsonb);select public.premium_assign_reviewer('${f.mesocycle}','${c.users.reviewer.id}');\n`;
  }write('bind.sql',sql+'commit;');
 }
 if(mode==='context'){
  const contexts={};for(const[tag,f]of Object.entries(c.cases)){
   const r=await rpc('mock','premium_provider_context',{p_mesocycle:f.mesocycle});check(tag+' provider contract',r.ok&&r.data.schema_version==='premium-provider-v1');const text=JSON.stringify(r.data);
   check(tag+' no UUID identity notes or stored names',!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)&&!text.includes('CANARY')&&!text.includes('@')&&!text.includes('user_id'));
   check(tag+' exact catalogue mapping',r.data.routine.exercises.every((e,i)=>e.catalogue_id===f.catalogue[i]));contexts[tag]=r.data;
   if(tag==='F')check('F replacement exclusion',!r.data.allowed_replacements.some(e=>e.id==='db_curl'));
   if(tag==='E')check('E uncertain RIR',r.data.routine.exercises.every(e=>e.metrics.trend==='context_changed_or_incomplete'));
  }write('contexts.json',contexts);
  for(const w of ['real','trainer','reviewer']){check(w+' cannot get owner context',!(await rpc(w,'premium_provider_context',{p_mesocycle:c.cases.A.mesocycle})).ok);check(w+' cannot reserve owner analysis',!(await rpc(w,'premium_reserve_analysis',{p_mesocycle:c.cases.A.mesocycle,p_key:crypto.randomUUID()})).ok);}
  check('anon cannot get context',!(await rpc(null,'premium_provider_context',{p_mesocycle:c.cases.A.mesocycle})).ok);
  check('owner cannot bind catalogue',!(await rpc('mock','premium_bind_catalogue',{p_mesocycle:c.cases.A.mesocycle,p_revision:c.cases.A.revision,p_bindings:{}})).ok);
 }
 if(mode==='reserve-mock'){
  const f=c.cases[process.argv[3]||'A'],key=crypto.randomUUID();const[a,b]=await Promise.all([rpc('mock','premium_reserve_analysis',{p_mesocycle:f.mesocycle,p_key:key}),rpc('mock','premium_reserve_analysis',{p_mesocycle:f.mesocycle,p_key:key})]);check('double reservation same ID',a.ok&&b.ok&&a.data.id===b.data.id);f.mock_rec=a.data.id;write('fixture.json',c);write('reserved.json',a.data);
 }
 if(mode==='mock-checks'){
  const f=c.cases.A,id=f.mock_rec;
  check('athlete cannot approve own analysis',!(await rpc('mock','premium_review_recommendation',{p_id:id,p_approve:true,p_reason:'not authorized'})).ok);
  check('normal trainer cannot approve',!(await rpc('trainer','premium_review_recommendation',{p_id:id,p_approve:true,p_reason:'not assigned'})).ok);
  check('pending analysis cannot accept',!(await rpc('mock','premium_accept_recommendation',{p_id:id})).ok);
  check('other owner cannot accept',!(await rpc('real','premium_accept_recommendation',{p_id:id})).ok);
  check('owner cannot claim provider dispatch',!(await rpc('mock','premium_analysis_claim',{p_user:c.users.mock.id,p_id:id,p_input_bound:100,p_mode:'mock'})).ok);
  check('owner cannot forge provider result',!(await rpc('mock','premium_analysis_finish',{p_user:c.users.mock.id,p_id:id,p_output:null,p_error:null,p_receipt:{},p_warnings:[]})).ok);
  check('assigned reviewer sees trace',(await request('reviewer','/rest/v1/coach_recommendations?id=eq.'+id+'&select=id,analysis_trace')).data?.length===1);
  check('normal trainer no trace',(await request('trainer','/rest/v1/coach_recommendations?id=eq.'+id+'&select=id')).data?.length===0);
  check('assigned reviewer rejects mock',(await rpc('reviewer','premium_review_recommendation',{p_id:id,p_approve:false,p_reason:'Controlled mock complete; preserve fixture for real analysis.'})).ok);
 }
 if(mode==='real'){
  const tag=process.argv[3],f=c.cases[tag];assert(f);assert(sessions.mock.expires_at>Date.now()/1000+130,'Refresh JWT first');const file=path.join(out,'real.json'),ledger=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):[];
  assert(ledger.length<12,'12 call hard stop');assert(!ledger.some(r=>r.tag===tag&&tag!=='H'),'No automatic scenario repeat');
  const key=crypto.randomUUID();f.keys.push(key);write('fixture.json',c);ledger.push({tag,key,state:'dispatching'});fs.writeFileSync(file,JSON.stringify(ledger,null,2));const at=Date.now();const r=await request('mock','/functions/v1/simple-coach-premium',{mesocycle_id:f.mesocycle,key});
  const rec=r.data?.recommendation;Object.assign(ledger.at(-1),{state:'returned',http_status:r.status,elapsed_ms:Date.now()-at,recommendation:rec||null,error:r.data?.error||null});fs.writeFileSync(file,JSON.stringify(ledger,null,2));
  check(tag+' real pending human review',r.ok&&rec?.state==='pending_review');f.real_rec=rec.id;write('fixture.json',c);console.log(JSON.stringify({tag,state:rec.state,kind:rec.kind,receipt:rec.analysis_trace?.receipt}));
 }
 if(mode==='review-keep'){
  const f=c.cases[process.argv[3]||'H'];const rec=(await request('mock','/rest/v1/coach_recommendations?id=eq.'+f.real_rec+'&select=*')).data[0];assert.equal(rec.kind,'KEEP');
  const before=(await request('mock','/rest/v1/coach_mesocycles?id=eq.'+f.mesocycle+'&select=current_revision_id,tracking_week')).data[0];
  check('assigned reviewer validates KEEP',(await rpc('reviewer','premium_review_recommendation',{p_id:rec.id,p_approve:true,p_reason:'Synthetic manual KEEP review: evidence inspected.'})).ok);
  const[a,b]=await Promise.all([rpc('mock','premium_accept_recommendation',{p_id:rec.id}),rpc('mock','premium_accept_recommendation',{p_id:rec.id})]);check('KEEP concurrent same revision',a.ok&&b.ok&&a.data===before.current_revision_id&&b.data===a.data);
  const after=(await request('mock','/rest/v1/coach_mesocycles?id=eq.'+f.mesocycle+'&select=current_revision_id,tracking_week')).data[0];check('KEEP advances once no revision',after.current_revision_id===before.current_revision_id&&after.tracking_week===before.tracking_week+1);
 }
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(out,mode+(process.argv[3]&&['real','reserve-mock','review-keep'].includes(mode)?'-'+process.argv[3]:'')+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' checks');});
