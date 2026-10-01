// Staging-only real JWT tests. No provider/Edge dispatch is implemented by this harness.
// SQL and credentials are written only to ignored private/. Caller explicitly applies fixture SQL.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),dir=path.join(__dirname,'private'),out=path.join(__dirname,'results');
fs.mkdirSync(dir,{recursive:true});fs.mkdirSync(out,{recursive:true});
const file=path.join(dir,'fixture.json'),mode=process.argv[2],ref='dmqjexigdnfzobarhnib',base='https://'+ref+'.supabase.co';
const quote=v=>"'"+String(v).replaceAll("'","''")+"'";
const write=(name,value)=>fs.writeFileSync(path.join(dir,name),typeof value==='string'?value:JSON.stringify(value,null,2));
if(mode==='prepare'){
 if(fs.existsSync(file))throw Error('Manifest already exists; do not replace fixture identities');
 const c={ref,key:'sb_publishable_GAqOb1_W3qiK8ka6EL1G7g_TutTPIVf',users:{},expires_at:new Date(Date.now()+8*3600000).toISOString(),normal:{routine:crypto.randomUUID(),day:crypto.randomUUID(),exercise:crypto.randomUUID()}};
 for(const kind of ['other','trainer','reviewer','A','B','C','D','E','F','G','H'])c.users[kind]={id:crypto.randomUUID(),email:'coach-q4-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomBytes(30).toString('base64url'),role:['trainer','reviewer'].includes(kind)?'trainer':'client'};
 write('fixture.json',c);let sql='begin;\n';
 for(const [kind,u] of Object.entries(c.users))sql+=`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,phone_change,phone_change_token,email_change_token_current,reauthentication_token) values('00000000-0000-0000-0000-000000000000',${quote(u.id)},'authenticated','authenticated',${quote(u.email)},extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','','');
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${quote(u.id)},${quote(u.id)},jsonb_build_object('sub',${quote(u.id)},'email',${quote(u.email)},'email_verified',true),'email',now(),now());
insert into public.profiles(id,name,role) values(${quote(u.id)},${quote('SYNTHETIC Coach Quality V4 '+kind)},${quote(u.role)});\n`;
 sql+=`insert into public.routines(id,owner_id,name) values('${c.normal.routine}','${c.users.trainer.id}','SYNTHETIC Coach Quality V4 normal');
insert into public.routine_days(id,routine_id,name) values('${c.normal.day}','${c.normal.routine}','SYNTHETIC normal day');
insert into public.routine_exercises(id,day_id,name,sets) values('${c.normal.exercise}','${c.normal.day}','SYNTHETIC normal exercise',2);\ncommit;`;
 write('seed.sql',sql);
 const pilots=Object.fromEntries(Object.entries(c.users).filter(([k])=>!['other','trainer','reviewer'].includes(k)).map(([,u])=>[u.id,{enabled:true,adult_confirmed:true,expires_at:c.expires_at}]));
 const reviewers={[c.users.reviewer.id]:{enabled:true,expires_at:c.expires_at}};
 write('config.sql',`begin;\ncreate or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${quote(JSON.stringify(pilots))}::jsonb $cfg$;\ncreate or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${quote(JSON.stringify(reviewers))}::jsonb $cfg$;\ncommit;`);
 const ids=Object.values(c.users).map(u=>quote(u.id)).join(',');
 let cleanup=`begin;\ndo $$ begin if exists(select 1 from auth.users where id in(${ids}) and email not like 'coach-q4-%@example.invalid') or exists(select 1 from public.profiles where id in(${ids}) and name not like 'SYNTHETIC Coach Quality V4%') then raise exception 'fixture_identity_mismatch'; end if; end $$;\ncreate temp table cleanup_routines on commit drop as select id from public.routines where owner_id in(${ids});\ndelete from auth.sessions where user_id in(${ids});\n`;
 for(const t of ['coach_pilot_feedback','routine_management','routine_revisions','coach_operations','context_grants','intake_health','training_intakes','workouts','routine_user_notes'])cleanup+=`delete from public.${t} where user_id in(${ids});\n`;
 cleanup+=`delete from public.routine_exercises where day_id in(select id from public.routine_days where routine_id in(select id from cleanup_routines));
delete from public.routine_days where routine_id in(select id from cleanup_routines);
delete from public.routines where id in(select id from cleanup_routines);
delete from public.profiles where id in(${ids});
delete from auth.users where id in(${ids});
create or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select '{}'::jsonb $cfg$;
create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select '{}'::jsonb $cfg$;
commit;`;
 write('cleanup.sql',cleanup);
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({ref,users:Object.entries(c.users).map(([kind,u])=>({kind,id:u.id,role:u.role})),expires_at:c.expires_at},null,2));
 console.log('Prepared eleven staging-only synthetic identities and guarded cleanup. No remote calls or emails.');process.exit(0);
}
const c=JSON.parse(fs.readFileSync(file));if(c.ref!==ref)throw Error('Staging project mismatch');
const sf=path.join(dir,'sessions.json');let sessions=fs.existsSync(sf)?JSON.parse(fs.readFileSync(sf)):{};
let checks=[];function check(name,pass){checks.push({name,pass:!!pass});console.log((pass?'PASS ':'FAIL ')+name);if(!pass)throw Error(name);}
async function request(w,route,body,method){
 if(!route.startsWith('/rest/v1/')&&!route.startsWith('/auth/v1/token?'))throw Error('Only staging Auth and REST are available; no OpenAI calls');
 const r=await fetch(base+route,{method:method||(body===undefined?'GET':'POST'),headers:{apikey:c.key,...(sessions[w]?{Authorization:'Bearer '+sessions[w].access_token}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const t=await r.text();let data;try{data=JSON.parse(t)}catch{data=null}return {ok:r.ok,status:r.status,data};
}
const rpc=(w,n,b={})=>request(w,'/rest/v1/rpc/'+n,b),table=(w,t,q='',b,m)=>request(w,'/rest/v1/'+t+'?'+q,b,m);
async function login(){for(const [kind,u] of Object.entries(c.users)){if(sessions[kind]?.expires_at>Date.now()/1000+120)continue;const r=await request(null,'/auth/v1/token?grant_type=password',{email:u.email,password:u.password});check('real JWT '+kind,r.ok&&r.data.user.id===u.id);sessions[kind]=r.data;}write('sessions.json',sessions);}
async function verify(){
 await login();
 for(const w of ['other','trainer',null]){
  const r=await rpc(w,'get_coach_review_queue');check((w||'anon')+' cannot access reviewer queue',!r.ok);
  const o=await table(w,'coach_operations');check((w||'anon')+' cannot read synthetic operations',!o.ok||o.data.length===0);
 }
 const queue=await rpc('reviewer','get_coach_review_queue');check('authorized reviewer reads queue',queue.ok&&Array.isArray(queue.data));
 const rows=queue.data.filter(x=>Object.values(c.users).some(u=>u.id===x.operation.user_id));
 check('only synthetic participants in staging queue',rows.length===queue.data.length);
 check('reviewer no health projection',rows.every(x=>!Object.hasOwn(x,'health')&&!Object.hasOwn(x.training||{},'health')));
 for(const w of ['A','B','C','D','E','F','G','H']){
  const r=await table(w,'coach_operations');check(w+' reads only own operation',r.ok&&r.data.length===1&&r.data[0].user_id===c.users[w].id);
  check(w+' never approved or accepted',r.data[0].reviewed_at===null&&r.data[0].routine_id===null&&['pending_review','failed'].includes(r.data[0].state));
  const foreign=await table(w,'coach_operations','user_id=neq.'+c.users[w].id);check(w+' cannot read another athlete',foreign.ok&&foreign.data.length===0);
  const managed=await table(w,'routine_management');check(w+' no accepted routine',managed.ok&&managed.data.length===0);
 }
 fs.writeFileSync(path.join(out,'live-security.json'),JSON.stringify({passed:checks.filter(x=>x.pass).length,total:checks.length,checks},null,2));
}
if(require.main===module){if(mode!=='verify')throw Error('Use prepare | verify; no approval or acceptance command exists');verify().catch(e=>{console.error(e.message);process.exitCode=1;});}
module.exports={c,dir,out,write};