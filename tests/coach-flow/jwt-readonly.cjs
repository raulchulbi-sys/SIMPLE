// Existing, explicitly authorized staging identities only. Tokens live in this process,
// never in files, browser storage, screenshots, results or child-process environments.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{spawn}=require('child_process');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),project='dmqjexigdnfzobarhnib',base='https://'+project+'.supabase.co';
const labels=['mock','real','retry','reviewer','trainer'];
const manifest=JSON.parse(fs.readFileSync(path.resolve(process.argv[2]),'utf8'));
const proof=JSON.parse(fs.readFileSync(path.join(__dirname,'private/jwt-scope-proof.json'),'utf8'));
assert.equal(manifest.ref,project);assert.equal(proof.project,project);assert.equal(proof.negativeTargetExists,false);
for(const label of labels){const u=manifest.users?.[label],p=proof.actors.find(a=>a.label===label);assert(u&&p&&u.id===p.id&&p.synthetic_auth_exists&&/@example\.invalid$/.test(u.email),'Authorized synthetic cohort only');}
const sessions=new Map(),checks=[],blocked=[],traffic={provider:0,businessWrites:0,authLogins:0,authenticatedReads:0,negativeReservations:0};
const check=(actor,name,pass,details={})=>{checks.push({actor,name,pass:!!pass,...details});if(!pass)throw Error('Assertion failed: '+actor+' '+name);};
async function raw(route,options){const r=await fetch(base+route,{...options,signal:AbortSignal.timeout(20000)});let data;try{data=await r.json();}catch{data=null;}return{status:r.status,ok:r.ok,data};}
async function request(actor,route,body){
 const session=sessions.get(actor);assert(session,'Verified JWT required');
 const get=/^\/rest\/v1\/(profiles|routines|workouts|coach_operations|routine_revisions|coach_mesocycles|coach_messages)\?/.test(route);
 const readRPC=['get_my_coach_access','premium_my_access','get_coach_reviewer_access','premium_reviewer_state'].some(n=>route==='/rest/v1/rpc/'+n);
 const negative=route==='/rest/v1/rpc/premium_chat_reserve'&&body?.p_mesocycle===proof.negativeTarget;
 assert(get&&body===undefined||readRPC&&body!==undefined||negative,'Read-only route allowlist');
 if(negative)traffic.negativeReservations++;else traffic.authenticatedReads++;
 return raw(route,{method:body===undefined?'GET':'POST',headers:{apikey:manifest.key,Authorization:'Bearer '+session.token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
}
const denied=r=>[401,403].includes(r.status),empty=r=>r.status===200&&Array.isArray(r.data)&&r.data.length===0;
async function login(actor){
 const u=manifest.users[actor];traffic.authLogins++;
 const r=await raw('/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:manifest.key,'Content-Type':'application/json'},body:JSON.stringify({email:u.email,password:u.password})});
 delete u.password;
 if(!r.ok||typeof r.data?.access_token!=='string'){blocked.push({actor,reason:'Existing synthetic sign-in unavailable',httpStatus:r.status});return false;}
 const data=r.data,token=data.access_token;delete data.refresh_token;delete data.access_token;
 const identity=await raw('/auth/v1/user',{headers:{apikey:manifest.key,Authorization:'Bearer '+token}});
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));
 check(actor,'Auth verifies a real project JWT',identity.status===200&&identity.data.id===u.id&&claims.sub===u.id&&claims.iss===base+'/auth/v1'&&claims.role==='authenticated'&&claims.exp>Date.now()/1000);
 sessions.set(actor,{token,id:u.id});return true;
}
async function reads(actor){
 const s=sessions.get(actor),own=proof.owners.find(x=>x.id===s.id),scope=proof.actors.find(x=>x.label===actor);
 let r=await request(actor,'/rest/v1/profiles?select=id,role&id=eq.'+s.id);check(actor,'own profile role unchanged',r.status===200&&r.data.length===1&&r.data[0].id===s.id&&r.data[0].role===scope.role);
 r=await request(actor,'/rest/v1/routines?select=id,owner_id&owner_id=eq.'+s.id);check(actor,'own existing routines readable',r.status===200&&r.data.length===own.routines&&r.data.every(x=>x.owner_id===s.id),{expectedRows:own.routines});
 r=await request(actor,'/rest/v1/workouts?select=id,user_id&user_id=eq.'+s.id);check(actor,'own workout history readable',r.status===200&&r.data.length===own.workouts&&r.data.every(x=>x.user_id===s.id),{expectedRows:own.workouts});
 const other=proof.actors.find(x=>x.role==='client'&&x.id!==s.id).id;
 r=await request(actor,'/rest/v1/routines?select=id,owner_id&owner_id=eq.'+other);check(actor,'unassigned foreign client routine denied',denied(r)||empty(r));
 r=await request(actor,'/rest/v1/coach_operations?select=id,user_id,intake_id&user_id=eq.'+s.id+'&intake_id=eq.'+proof.negativeTarget);check(actor,'owner/intake absent operation returns empty',empty(r));
 r=await request(actor,'/rest/v1/coach_operations?select=id,user_id&user_id=eq.'+other);check(actor,'foreign Basic operations not exposed (no rows currently exist)',denied(r)||empty(r));
 r=await request(actor,'/rest/v1/routine_revisions?select=id,user_id');check(actor,'existing foreign private revisions denied',denied(r)||empty(r));
 r=await request(actor,'/rest/v1/coach_mesocycles?select=id,user_id');check(actor,'existing foreign mesocycles denied',denied(r)||empty(r));
 r=await request(actor,'/rest/v1/coach_messages?select=id,user_id');check(actor,'chat transcript empty (no messages currently exist)',denied(r)||empty(r));
 r=await request(actor,'/rest/v1/rpc/get_my_coach_access',{});check(actor,'Basic capability fails closed',denied(r)||r.status===200&&r.data?.authorized===false&&r.data.can_generate!==true);
 r=await request(actor,'/rest/v1/rpc/premium_my_access',{});check(actor,'Premium capability fails closed',denied(r)||r.status===200&&r.data?.enabled===false);
 r=await request(actor,'/rest/v1/rpc/get_coach_reviewer_access',{});check(actor,'no Basic reviewer privilege granted',denied(r)||r.status===200&&r.data===false);
 r=await request(actor,'/rest/v1/rpc/premium_reviewer_state',{p_mesocycle:null});check(actor,'no effective reviewer scope granted (actor label is not authority)',denied(r)||r.status===200&&Array.isArray(r.data?.scopes)&&r.data.scopes.length===0);
 if(actor==='reviewer')for(const [index,id]of (proof.expiredReviewerScopes||[]).entries()){
  r=await request(actor,'/rest/v1/rpc/premium_reviewer_state',{p_mesocycle:id});check(actor,'expired existing reviewer assignment '+(index+1)+' rejected',denied(r)&&r.data?.message==='premium_not_authorized');
 }
 const args={p_mesocycle:proof.negativeTarget,p_revision:crypto.randomUUID(),p_key:crypto.randomUUID(),p_message:'¿Qué significa RIR?'};
 const expectedDenial=scope.role==='client'?'premium_chat_not_authorized':'coach_not_authorized';
 r=await request(actor,'/rest/v1/rpc/premium_chat_reserve',args);check(actor,'absent Premium scope rejects before reservation',denied(r)&&r.data?.message===expectedDenial,{httpStatus:r.status,errorCode:r.data?.message});
 r=await request(actor,'/rest/v1/rpc/premium_chat_reserve',{...args,p_message:'¿Y el descanso?'});check(actor,'changed content remains denied without scope (not a key-conflict proof)',denied(r)&&r.data?.message===expectedDenial,{httpStatus:r.status,errorCode:r.data?.message});
}
async function browserReads(){
 require('./recovery.cjs');
 const {chromium,webkit}=require(path.resolve(path.dirname(process.execPath),'../node_modules/playwright'));
 const server=spawn(process.execPath,['tests/coach-pilot/preview.cjs'],{cwd:root,env:{...process.env,COACH_PORT:'4272'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Loopback preview unavailable')),10000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('exit',()=>{clearTimeout(t);reject(Error('Loopback preview exited'));});});
  for(const engine of ['chromium','webkit']){const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{
   for(const actor of ['mock','real','retry'].filter(a=>sessions.has(a))){const page=await browser.newPage({viewport:{width:390,height:844}}),session=sessions.get(actor);let readCount=0,attempts=0;
    await page.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
    await page.exposeFunction('qaReadOwnOperation',async({owner,intake})=>{assert.equal(owner,session.id);assert.equal(intake,proof.negativeTarget);readCount++;const r=await request(actor,'/rest/v1/coach_operations?select=*&user_id=eq.'+owner+'&intake_id=eq.'+intake+'&order=created_at.desc,id.desc&limit=1');return{data:r.ok?r.data?.[0]||null:null,error:r.ok?null:{message:'read_denied'}};});
    await page.exposeFunction('qaReadOwnAccess',async()=>{const r=await request(actor,'/rest/v1/rpc/get_my_coach_access',{});return{data:r.ok?r.data:null,error:r.ok?null:{message:'read_denied'}};});
    const boot=async(recover=true)=>{await page.waitForFunction(()=>window.previewReady);await page.evaluate(({id,intake,recover})=>{
     user={id};profile={id,role:'client'};window.qaInvocations=0;
     db.functions.invoke=async()=>{qaInvocations++;throw Error('No provider dispatch in read-only JWT test');};
     db.rpc=async name=>{if(name!=='get_my_coach_access')throw Error('Read-only bridge RPC denied');return window.qaReadOwnAccess();};
     const from=db.from;db.from=table=>{if(table!=='coach_operations')return from(table);const filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},limit(){return q;},maybeSingle(){return q;},then(resolve,reject){return window.qaReadOwnOperation({owner:filters.user_id,intake:filters.intake_id}).then(resolve,reject);}};return q;};
     if(recover){coachShell('<p>Read-only authenticated test</p>');return coachRecoverGeneration(intake,simpleCoach.epoch,id);}
    },{id:session.id,intake:proof.negativeTarget,recover});};
    await page.goto('http://127.0.0.1:4272/demo');await boot();await page.locator('#coachRecoverRefresh').waitFor();
    check(actor,engine+' mixed UI/real JWT: absent operation stays uncertain',readCount===1&&await page.locator('#coachAccept').count()===0,{type:'browser + real authenticated HTTP relay'});
    await page.locator('#coachRecoverRefresh').click();await page.waitForFunction(()=>!simpleCoach.busy);check(actor,engine+' mixed UI/real JWT: refresh reads only',readCount===2&&await page.evaluate(()=>qaInvocations===0),{type:'browser + real authenticated HTTP relay'});
    await page.reload();await boot(false);await page.evaluate(()=>openSimpleCoach());await page.getByText('Esta cuenta todavía no está autorizada para el piloto.',{exact:true}).waitFor();attempts=await page.evaluate(()=>qaInvocations);
    check(actor,engine+' mixed UI/real JWT: reload respects unavailable capability',attempts===0&&await page.locator('#coachConfirmSend').count()===0,{type:'browser + real authenticated HTTP relay'});
    await page.close();
   }
  }finally{await browser.close();}}
 }finally{server.kill();}
}
(async()=>{let failed=false;try{for(const actor of labels){if(await login(actor))await reads(actor);}if(process.argv.includes('--browser'))await browserReads();}
 catch(e){failed=true;console.error(/^Assertion failed:/.test(e.message)?e.message:'Authenticated harness stopped: '+e.name);}
 finally{sessions.clear();for(const u of Object.values(manifest.users))delete u.password;fs.mkdirSync(out,{recursive:true});const result={project,realJWT:true,paidProviderCalls:0,traffic,tokensPersisted:false,permissionsChanged:false,fixturesChanged:false,passed:checks.filter(c=>c.pass).length,total:checks.length,completed:!failed,blocked,checks};fs.writeFileSync(path.join(out,'authenticated.json'),JSON.stringify(result,null,2));console.log(result.passed+'/'+result.total+' JWT assertions; '+blocked.length+' unavailable sign-ins');if(failed)process.exitCode=1;}})();
