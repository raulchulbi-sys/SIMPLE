// Explicit denial-only live check. No fixture creation, scope activation or OpenAI endpoint.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const REF='dmqjexigdnfzobarhnib',BASE='https://'+REF+'.supabase.co';
const [directory,manifest,flag]=process.argv.slice(2);assert.equal(flag,'--verify-denials');
const dir=path.resolve(directory);assert(dir.startsWith(path.join(__dirname,'private')+path.sep));
const before=JSON.parse(fs.readFileSync(path.join(dir,'before-db.json'),'utf8'));
assert.deepEqual(before.metadata.pilot_config,{});assert.deepEqual(before.metadata.reviewer_config,{});
assert(before.integrity.filter(x=>['training_intakes','coach_operations'].includes(x.name)).every(x=>Number(x.rows)===0));
const cfg=JSON.parse(fs.readFileSync(manifest,'utf8'));assert.equal(cfg.ref,REF);
const owner=cfg.users.mock;assert.equal(owner.id,'c7bbe50b-d349-4f7e-8fdc-476f17c22674');assert(owner.email.endsWith('@example.invalid'));
const expected=before.actors.find(x=>x.id===owner.id);assert(expected.synthetic&&expected.role==='client');
const edge=BASE+'/functions/v1/simple-coach-mock',rows=[];
const dummy={intake_id:'11111111-1111-4111-8111-111111111111',key:'22222222-2222-4222-8222-222222222222'};
let token=null,loggedIn=false;
async function request(url,options={}){assert(url.startsWith(BASE+'/'));return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(25000)});}
async function check(name,fn){await fn();rows.push({name,pass:true});}
const headers=(jwt=cfg.key,origin)=>({apikey:cfg.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json',...(origin?{origin}:{})});
(async()=>{try{
 await check('missing JWT denied',async()=>{const r=await request(edge,{method:'POST',headers:{apikey:cfg.key,'Content-Type':'application/json'},body:JSON.stringify(dummy)});assert.equal(r.status,401);await r.body?.cancel();});
 await check('invalid JWT denied',async()=>{const r=await request(edge,{method:'POST',headers:headers('not-a-jwt'),body:JSON.stringify(dummy)});assert.equal(r.status,401);await r.body?.cancel();});
 await check('anon JWT has no user identity',async()=>{const r=await request(edge,{method:'POST',headers:headers(),body:JSON.stringify(dummy)});assert.equal(r.status,401);await r.body?.cancel();});
 const origins=['http://127.0.0.1:4194','http://localhost:4194','http://127.0.0.1:4195','http://localhost:4195','http://127.0.0.1:4280','http://localhost:4280','https://simple-staging-raulchulbi.pages.dev','https://4a8636ab.simple-staging-raulchulbi.pages.dev'];
 for(const origin of origins)await check('preflight '+origin,async()=>{const r=await request(edge,{method:'OPTIONS',headers:{...headers(cfg.key,origin),'Access-Control-Request-Method':'POST'}});assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);assert((r.headers.get('vary')||'').split(',').map(x=>x.trim().toLowerCase()).includes('origin'));assert.equal(r.headers.get('cache-control'),'no-store');});
 await check('unapproved origin denied',async()=>{const r=await request(edge,{method:'POST',headers:headers(cfg.key,'https://example.invalid'),body:JSON.stringify(dummy)});assert.equal(r.status,403);assert(!r.headers.get('access-control-allow-origin'));await r.body?.cancel();});
 await check('GET denied',async()=>{const r=await request(edge,{method:'GET',headers:headers()});assert.equal(r.status,405);await r.body?.cancel();});
 const login=await request(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:headers(),body:JSON.stringify({email:owner.email,password:owner.password})});
 assert(login.ok,'Existing synthetic login failed: '+login.status);const session=await login.json();assert.equal(session.user.id,owner.id);token=session.access_token;loggedIn=true;
 await check('existing synthetic identity authenticated',async()=>{const r=await request(BASE+'/auth/v1/user',{headers:headers(token)});assert(r.ok);assert.equal((await r.json()).id,owner.id);});
 await check('disabled synthetic owner denied before reservation',async()=>{const r=await request(edge,{method:'POST',headers:headers(token,origins[6]),body:JSON.stringify(dummy)});assert.equal(r.status,400);const b=await r.json();assert.equal(b.error,'coach_pilot_required');assert.equal(r.headers.get('access-control-allow-origin'),origins[6]);});
 await check('client-supplied model rejected',async()=>{const r=await request(edge,{method:'POST',headers:headers(token),body:JSON.stringify({...dummy,model:'gpt-5.4'})});assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_request');});
 await check('invalid body rejected before reservation',async()=>{const r=await request(edge,{method:'POST',headers:headers(token),body:'{'});assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_request');});
 }finally{
 if(loggedIn){const r=await request(BASE+'/auth/v1/logout?scope=local',{method:'POST',headers:headers(token)});assert(r.ok,'Synthetic session cleanup failed');await r.body?.cancel();token=null;rows.push({name:'synthetic session signed out locally',pass:true});}
 fs.writeFileSync(path.join(dir,'postdeploy-http.json'),JSON.stringify({project:REF,denialsOnly:true,providerCalls:0,credentialsPersisted:false,checks:rows},null,2)+'\n');
 }
 console.log(JSON.stringify({passed:rows.length,checks:rows,providerCalls:0}));
})().catch(e=>{console.error('Postdeploy STOP: '+e.message);process.exitCode=1;});
