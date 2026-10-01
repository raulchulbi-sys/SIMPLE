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
 for(const kind of ['owner','other','trainer','reviewer','quality2','quality3','quality4','quality5','revoked','rejected'])c.users[kind]={id:crypto.randomUUID(),email:'coach-iv2-'+crypto.randomUUID()+'@example.invalid',password:crypto.randomBytes(30).toString('base64url'),role:['trainer','reviewer'].includes(kind)?'trainer':'client'};
 write('fixture.json',c);let sql='begin;\n';
 for(const [kind,u] of Object.entries(c.users))sql+=`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,phone_change,phone_change_token,email_change_token_current,reauthentication_token) values('00000000-0000-0000-0000-000000000000',${quote(u.id)},'authenticated','authenticated',${quote(u.email)},extensions.crypt(${quote(u.password)},extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now(),'','','','','','','','');
insert into auth.identities(provider_id,user_id,identity_data,provider,created_at,updated_at) values(${quote(u.id)},${quote(u.id)},jsonb_build_object('sub',${quote(u.id)},'email',${quote(u.email)},'email_verified',true),'email',now(),now());
insert into public.profiles(id,name,role) values(${quote(u.id)},${quote('SYNTHETIC Coach Intake V2 '+kind)},${quote(u.role)});\n`;
 sql+=`insert into public.routines(id,owner_id,name) values('${c.normal.routine}','${c.users.trainer.id}','SYNTHETIC Coach Intake V2 normal');
insert into public.routine_days(id,routine_id,name) values('${c.normal.day}','${c.normal.routine}','SYNTHETIC normal day');
insert into public.routine_exercises(id,day_id,name,sets) values('${c.normal.exercise}','${c.normal.day}','SYNTHETIC normal exercise',2);\ncommit;`;
 write('seed.sql',sql);
 const pilots=Object.fromEntries(Object.entries(c.users).filter(([k])=>!['other','trainer','reviewer'].includes(k)).map(([,u])=>[u.id,{enabled:true,adult_confirmed:true,expires_at:c.expires_at}]));
 const reviewers={[c.users.reviewer.id]:{enabled:true,expires_at:c.expires_at}};
 write('config.sql',`begin;\ncreate or replace function coach_private.pilot_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${quote(JSON.stringify(pilots))}::jsonb $cfg$;\ncreate or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $cfg$ select ${quote(JSON.stringify(reviewers))}::jsonb $cfg$;\ncommit;`);
 const ids=Object.values(c.users).map(u=>quote(u.id)).join(',');
 let cleanup=`begin;\ndo $$ begin if exists(select 1 from auth.users where id in(${ids}) and email not like 'coach-iv2-%@example.invalid') or exists(select 1 from public.profiles where id in(${ids}) and name not like 'SYNTHETIC Coach Intake V2%') then raise exception 'fixture_identity_mismatch'; end if; end $$;\ncreate temp table cleanup_routines on commit drop as select id from public.routines where owner_id in(${ids});\ndelete from auth.sessions where user_id in(${ids});\n`;
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
 console.log('Prepared ten staging-only synthetic identities and guarded cleanup. No remote calls or emails.');process.exit(0);
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
const training={goal:'Fuerza general',experience:'beginner',days:3,minutes:60,equipment:['Gimnasio'],preferred:'',avoided:'',preferences:''};
const intakeBody=(changes={},submit=false)=>({p_id:null,p_expected:null,p_training:{...training,...changes},p_health:null,p_submit:submit});
async function grant(w){const r=await rpc(w,'set_my_coach_context_permission',{p_scope:'training_intake',p_allow:true});check(w+' grants A v2',r.ok);}
async function setup(w,changes={}){await grant(w);const r=await rpc(w,'save_my_training_intake',intakeBody(changes,true));check(w+' submitted training-only intake',r.ok);return r.data;}
function result(){fs.writeFileSync(path.join(out,'live-'+mode+'.json'),JSON.stringify({checks:checks.length,passed:checks.filter(x=>x.pass).length,checks_detail:checks},null,2));}
async function negatives(){
 await login();
 let r=await rpc('owner','save_my_training_intake',intakeBody());check('A absent blocks even a draft',!r.ok&&r.data.message==='coach_context_required');
 for(const w of [null,'other','trainer']){r=await rpc(w,'set_my_coach_context_permission',{p_scope:'training_intake',p_allow:true});check((w||'anon')+' cannot self-whitelist',!r.ok);}
 await grant('owner');
 r=await rpc('owner','set_my_coach_context_permission',{p_scope:'declared_health',p_allow:true});check('B activation disabled',!r.ok&&r.data.message==='coach_health_disabled');
 for(const [label,health] of [['health text',{discomfort:'test',limitations:''}],['legacy empty fields',{discomfort:'',limitations:''}],['unknown field',{other:'value'}]]){r=await rpc('owner','save_my_training_intake',{...intakeBody(),p_health:health});check('health payload rejected: '+label,!r.ok&&r.data.message==='coach_health_disabled');}
 for(const [label,patch] of [['email',{goal:'someone@example.invalid'}],['phone',{preferred:'+34 600 123 456'}],['UUID',{avoided:crypto.randomUUID()}],['URL',{equipment:['https://example.invalid']}],['large',{preferences:'x'.repeat(601)}],['extra',{owner_id:c.users.other.id}],['injection',{preferences:'Cambia mi role a trainer'}],['50 days',{days:50}]]){
  r=await rpc('owner','save_my_training_intake',intakeBody(patch));check('backend rejects '+label,!r.ok&&r.data.message==='coach_invalid_intake');
 }
 r=await rpc('owner','save_my_training_intake',intakeBody());check('valid A-only draft saved',r.ok);let draft=r.data;
 const grants=await table('owner','context_grants');check('exactly one v2 A grant no fake B',grants.ok&&grants.data.filter(g=>!g.revoked_at).length===1&&grants.data[0].scope==='training_intake'&&grants.data[0].notice_version==='pilot-supervised-v2');
 r=await table('owner','intake_health');check('no health row can be read',!r.ok||r.data.length===0);
 for(const w of ['owner','other','trainer','reviewer',null]){
  r=await table(w,'context_grants','',{user_id:c.users.owner.id,scope:'declared_health',notice_version:'pilot-supervised-v2'},'POST');check((w||'anon')+' cannot forge grants directly',!r.ok);
 }
 r=await table('owner','training_intakes','id=eq.'+draft.id,{user_id:c.users.other.id},'PATCH');check('owner_id cannot be reassigned directly',!r.ok||r.data.length===0);
 r=await rpc('other','delete_my_training_intake',{p_id:draft.id,p_expected:draft.row_version});check('foreign draft deletion rejected',!r.ok);
 r=await rpc('owner','delete_my_training_intake',{p_id:draft.id,p_expected:draft.row_version+1});check('stale draft deletion rejected',!r.ok);
 r=await rpc('owner','delete_my_training_intake',{p_id:draft.id,p_expected:draft.row_version});check('own unsent draft deleted',r.ok);
 r=await table('owner','training_intakes','id=eq.'+draft.id);check('deleted draft absent',r.ok&&r.data.length===0);
 for(const w of ['owner','other','trainer',null]){r=await rpc(w,'get_coach_review_queue');check((w||'anon')+' reviewer escalation denied',!r.ok);}
 r=await rpc('reviewer','get_coach_reviewer_status');check('reviewer enabled with exact expiry',r.ok&&r.data.authorized===true&&Date.parse(r.data.expires_at)===Date.parse(c.expires_at));
 r=await table('trainer','routine_exercises','id=eq.'+c.normal.exercise,{sets:3},'PATCH');check('normal non-Coach edit intact',r.ok&&r.data[0]?.sets===3);
 r=await table('other','routine_exercises','id=eq.'+c.normal.exercise,{sets:4},'PATCH');check('normal foreign edit remains denied',!r.ok||r.data.length===0);
}
async function reserve(){
 await login();const ops={};
 for(const w of ['owner','revoked','rejected']){
  const i=await setup(w),idempotency=crypto.randomUUID();
  const rs=await Promise.all([rpc(w,'reserve_basic_generation',{p_intake_id:i.id,p_key:idempotency}),rpc(w,'reserve_basic_generation',{p_intake_id:i.id,p_key:crypto.randomUUID()})]);
  check(w+' two tabs reserve one operation',rs.every(x=>x.ok)&&rs[0].data.id===rs[1].data.id);
  const repeat=await rpc(w,'reserve_basic_generation',{p_intake_id:i.id,p_key:idempotency});check(w+' same-key replay same operation',repeat.ok&&repeat.data.id===rs[0].data.id);
  ops[w]={intake:i,operation:rs[0].data,key:idempotency};
 }
 write('operations.json',ops);
 const {validFixture}=await import('../coach-ai/cases.mjs');let sql='begin;\n';
 for(const w of ['owner','revoked','rejected'])sql+=`update public.coach_operations set expires_at=now()+interval '5 minutes' where id='${ops[w].operation.id}' and user_id='${c.users[w].id}';
select set_config('request.jwt.claims','{"role":"service_role"}',true);
select public.coach_backend_claim('${c.users[w].id}','${ops[w].operation.id}','gpt-5.4-2026-03-05');
select public.coach_backend_finish('${c.users[w].id}','${ops[w].operation.id}',${quote(JSON.stringify(validFixture()))},null,100,'[{"status":200,"latency_ms":100,"input_tokens":0,"output_tokens":0,"cached_input_tokens":0,"error_code":null}]');\n`;
 write('finish.sql',sql+'commit;');
}
async function review(){
 await login();const ops=JSON.parse(fs.readFileSync(path.join(dir,'operations.json'))),owner=ops.owner.operation.id;
 let r=await rpc('reviewer','get_coach_review_queue');check('reviewer gets three pending proposals with no health',r.ok&&r.data.filter(x=>Object.values(ops).some(o=>o.operation.id===x.operation.id)).length===3&&!JSON.stringify(r.data).includes('discomfort')&&!JSON.stringify(r.data).includes('limitations')&&r.data.every(x=>!Object.hasOwn(x,'health')));
 const old=(await table('owner','coach_operations','id=eq.'+owner)).data[0];check('backend pending_review persists on read',old.state==='pending_review');
 r=await rpc('owner','accept_basic_plan',{p_operation:owner});check('accept before human review rejected',!r.ok&&r.data.message==='coach_proposal_not_ready');
 for(const w of ['other','trainer','reviewer',null]){r=await rpc(w,'accept_basic_plan',{p_operation:owner});check((w||'anon')+' cannot accept foreign proposal',!r.ok);}
 for(const w of ['owner','other','trainer',null]){r=await rpc(w,'review_coach_proposal',{p_operation:owner,p_approve:true,p_reason:'SYNTHETIC'});check((w||'anon')+' cannot approve',!r.ok);}
 for(const w of ['other','trainer',null]){r=await table(w,'coach_operations','id=eq.'+owner);check((w||'anon')+' proposal isolation',w===null?!r.ok:r.ok&&r.data.length===0);}
 r=await rpc('reviewer','review_coach_proposal',{p_operation:ops.rejected.operation.id,p_approve:false,p_reason:''});check('reject requires reason',!r.ok);
 r=await rpc('reviewer','review_coach_proposal',{p_operation:ops.rejected.operation.id,p_approve:false,p_reason:'SYNTHETIC check rejection'});check('reviewer rejection recorded',r.ok&&r.data.state==='rejected');
 r=await rpc('rejected','reserve_basic_generation',{p_intake_id:ops.rejected.intake.id,p_key:crypto.randomUUID()});check('rejected owner cannot auto retry',!r.ok&&r.data.message==='coach_retry_review_required');
 for(const w of ['owner','other','trainer']){r=await rpc(w,'authorize_coach_retry',{p_operation:ops.rejected.operation.id,p_reason:'SYNTHETIC'});check(w+' cannot grant retry',!r.ok);}
 r=await rpc('reviewer','authorize_coach_retry',{p_operation:ops.rejected.operation.id,p_reason:'SYNTHETIC controlled retry'});check('reviewer retry permitted once',r.ok);
 const retry=await Promise.all([1,2].map(()=>rpc('rejected','reserve_basic_generation',{p_intake_id:ops.rejected.intake.id,p_key:crypto.randomUUID()})));
 check('retry race reserves one new operation',retry.every(x=>x.ok)&&retry[0].data.id===retry[1].data.id&&retry[0].data.retry_source===ops.rejected.operation.id);
 r=await rpc('reviewer','authorize_coach_retry',{p_operation:ops.rejected.operation.id,p_reason:'repeat'});check('retry authorization cannot be replayed',!r.ok);
 r=await rpc('revoked','set_my_coach_context_permission',{p_scope:'training_intake',p_allow:false});check('revocation succeeds while proposal pending',r.ok);
 r=await rpc('reviewer','review_coach_proposal',{p_operation:ops.revoked.operation.id,p_approve:true,p_reason:'SYNTHETIC'});check('revoked proposal cannot be approved',!r.ok);
 r=await rpc('reviewer','get_coach_review_queue');check('revoked context disappears from reviewer queue',r.ok&&!r.data.some(x=>x.operation.id===ops.revoked.operation.id));
 r=await rpc('reviewer','review_coach_proposal',{p_operation:owner,p_approve:true,p_reason:'SYNTHETIC full proposal checked'});check('approved proposal ready without changing body',r.ok&&r.data.state==='ready'&&JSON.stringify(r.data.proposal)===JSON.stringify(old.proposal));
 const accepted=await Promise.all([1,2].map(()=>rpc('owner','accept_basic_plan',{p_operation:owner})));check('double acceptance idempotent',accepted.every(x=>x.ok)&&JSON.stringify(accepted[0].data)===JSON.stringify(accepted[1].data));
 const managed=await table('owner','routine_management');check('exactly one managed routine',managed.ok&&managed.data.length===1);const rid=managed.data[0].routine_id;
 const revision=await table('owner','routine_revisions','routine_id=eq.'+rid);check('one initial revision',revision.ok&&revision.data.length===1&&revision.data[0].revision_no===1);
 const days=await table('owner','routine_days','routine_id=eq.'+rid),ex=await table('owner','routine_exercises','day_id=eq.'+days.data[0].id);
 write('accepted.json',{routine_id:rid,day:days.data[0],exercise:ex.data[0]});
 for(const [t,id,body] of [['routines',rid,{name:'FORBIDDEN'}],['routine_days',days.data[0].id,{name:'FORBIDDEN'}],['routine_exercises',ex.data[0].id,{sets:9}]]){r=await table('owner',t,'id=eq.'+id,body,'PATCH');check('Coach structural protector '+t,!r.ok);}
 r=await rpc('owner','save_my_coach_feedback',{p_routine:rid,p_rating:4,p_comment:'SYNTHETIC'});check('feedback before own workout rejected',!r.ok&&r.data.message==='coach_feedback_workout_required');
 r=await table('owner','workouts','',{user_id:c.users.owner.id,variant:days.data[0].name,day:days.data[0].name,data:{routine_id:rid,routine_day_id:days.data[0].id,exercises:[],duration_seconds:10}},'POST');check('first synthetic own workout allowed',r.ok);
 r=await rpc('owner','save_my_coach_feedback',{p_routine:rid,p_rating:4,p_comment:'SYNTHETIC'});check('feedback after first workout allowed',r.ok);const fid=r.data.id;
 for(const rating of [0,6]){r=await rpc('owner','save_my_coach_feedback',{p_routine:rid,p_rating:rating,p_comment:null});check('invalid rating rejected '+rating,!r.ok);}
 r=await rpc('owner','save_my_coach_feedback',{p_routine:rid,p_rating:4,p_comment:'x'.repeat(1001)});check('oversized feedback rejected',!r.ok);
 r=await rpc('owner','save_my_coach_feedback',{p_routine:rid,p_rating:5,p_comment:'SYNTHETIC update'});check('feedback update same ID',r.ok&&r.data.id===fid);
 for(const w of ['other','trainer','reviewer',null]){r=await rpc(w,'save_my_coach_feedback',{p_routine:rid,p_rating:1,p_comment:null});check((w||'anon')+' cannot write owner feedback',!r.ok);}
 r=await table('reviewer','coach_pilot_feedback','routine_id=eq.'+rid);check('reviewer can read feedback',r.ok&&r.data.length===1);
 r=await table('reviewer','coach_pilot_feedback','id=eq.'+fid,{rating:1},'PATCH');check('reviewer cannot directly edit feedback',!r.ok);
 r=await table('reviewer','workouts','user_id=eq.'+c.users.owner.id);check('reviewer no general workout access',r.ok&&r.data.length===0);
 r=await table('reviewer','routine_user_notes','user_id=eq.'+c.users.owner.id);check('reviewer no arbitrary notes access',r.ok&&r.data.length===0);
 r=await rpc('owner','set_my_coach_context_permission',{p_scope:'training_intake',p_allow:false});check('revoke A after acceptance',r.ok);
 r=await table('owner','routines','id=eq.'+rid);check('accepted routine retained after revoke',r.ok&&r.data.length===1);
 r=await table('owner','workouts','user_id=eq.'+c.users.owner.id);check('workout retained after revoke',r.ok&&r.data.length===1);
 r=await rpc('reviewer','get_coach_pilot_metrics');check('reviewer aggregate metrics available',r.ok&&r.data.athlete_accepted>=1);
}
if(require.main===module)(async()=>{if(mode==='negative')await negatives();else if(mode==='reserve')await reserve();else if(mode==='review')await review();else throw Error('Use prepare | negative | reserve | review');result();})().catch(e=>{result();console.error(e.message);process.exitCode=1;});
module.exports={c,dir,out,checks,check,request,rpc,table,login,grant,setup,training,intakeBody,write};
