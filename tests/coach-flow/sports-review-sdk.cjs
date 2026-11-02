// Actual SDK/JWT reads only. No Edge dispatch, decisions or business writes are allowed.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),[arg,manifestPath,mode]=process.argv.slice(2),dir=path.resolve(arg);
assert(dir.startsWith(path.join(__dirname,'private')+path.sep));assert.equal(mode,'--prepare-and-wait');
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n))),plan=read('plan.json'),REF='dmqjexigdnfzobarhnib',BASE='https://'+REF+'.supabase.co';
require('./sports-review-plan.cjs').guard(plan);
const sdk=fs.readFileSync(path.resolve(root,'../google-auth/tests/onboarding/private/supabase-2.115.0.js'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
assert.equal(sha(sdk),'0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7');
const sandbox={console:{log(){},warn(){},error(){}},fetch:()=>{throw Error('Fallback network denied');},URL,Headers,Request,Response,AbortController,AbortSignal,setTimeout,clearTimeout,setInterval,clearInterval,TextEncoder,TextDecoder,crypto:globalThis.crypto,WebSocket,Buffer};
vm.createContext(sandbox);vm.runInContext(sdk.toString('utf8'),sandbox);
const resume=process.argv.includes('--resume-read-only'),plain=x=>JSON.parse(JSON.stringify(x));
const prior=resume?read('sdk-receipt.json'):null;
if(resume){assert.equal(prior.run,plan.run);assert(!prior.complete&&prior.providerCalls===0&&prior.businessWrites===0&&prior.checks.every(c=>c.pass));assert(Object.values(prior.signouts).every(Boolean));}
const receipt={run:plan.run,project:REF,kind:'real SDK/JWT reads plus local renderer with authenticated SDK relay',checks:prior?.checks||[],priorCounts:prior?.counts,counts:{},complete:false,providerCalls:0,businessWrites:0,tokensPersisted:false},clients={};
const save=()=>fs.writeFileSync(path.join(dir,'sdk-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
const check=(name,pass,kind='SDK/JWT')=>{const i=receipt.checks.findIndex(c=>c.name===name),entry={name,pass:!!pass,kind};if(i<0)receipt.checks.push(entry);else receipt.checks[i]=entry;save();assert(pass,name);};
const rpcNames=['get_my_coach_access','get_coach_review_queue','get_coach_reviewer_access','get_coach_pilot_metrics','get_coach_reviewer_status'];
for(const n of rpcNames)assert(plan.snapshot.read_rpcs.includes(n),'RPC must be STABLE/IMMUTABLE');
function fence(actor,url,options={}){
 const u=new URL(typeof url==='string'?url:url.url),method=options.method||'GET',c=receipt.counts[actor];
 assert.equal(u.origin,BASE,'Staging only');
 if(u.pathname==='/auth/v1/token')return method==='POST'&&u.searchParams.get('grant_type')==='password'&&++c.logins<=1;
 if(u.pathname==='/auth/v1/user')return method==='GET';
 if(u.pathname==='/auth/v1/logout')return method==='POST'&&u.searchParams.get('scope')==='local';
 if(method==='GET'&&u.pathname==='/rest/v1/profiles')return u.searchParams.get('id')==='eq.'+plan.actors[actor];
 if(method==='GET'&&u.pathname==='/rest/v1/coach_operations')return u.searchParams.get('id')==='eq.'+plan.operation;
 if(method==='GET'&&u.pathname==='/rest/v1/training_intakes')return u.searchParams.get('id')==='eq.'+plan.intake;
 if(method==='GET'&&u.pathname==='/rest/v1/coach_pilot_feedback')return actor==='reviewer';
 if(method==='POST'&&rpcNames.some(n=>u.pathname==='/rest/v1/rpc/'+n))return !options.body||options.body==='{}';
 return false;
}
async function ui(){
 process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
 const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 for(const engine of ['chromium','webkit']){
  const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  try{
   const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',()=>errors.push('pageerror'));
   await page.route('**/*',r=>{requests.push('blocked');return r.abort();});
   await page.exposeFunction('qaReadRPC',async name=>{assert(rpcNames.includes(name));const r=await clients.reviewer.rpc(name,{});if(r.error)throw Error('Read RPC failed');return r.data;});
   await page.exposeFunction('qaReadFeedback',async()=>{const r=await clients.reviewer.from('coach_pilot_feedback').select('*').order('updated_at',{ascending:false});return{data:r.data,error:r.error?{message:'read_denied'}:null};});
   await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
   for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g))await page.addStyleTag({content:m[1]});
   for(const f of ['theme.css','coach.css'])await page.addStyleTag({content:fs.readFileSync(path.join(root,'assets',f),'utf8')});
   await page.evaluate(id=>{
    window.$=id=>document.getElementById(id);window.esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    window.SUPABASE_URL='https://dmqjexigdnfzobarhnib.supabase.co';window.user={id};window.profile={role:'trainer'};
    window.db={auth:{onAuthStateChange(){}},from(table){if(table!=='coach_pilot_feedback')throw Error('Read table denied');return{select(){return{order:()=>qaReadFeedback()};}};}};
   },plan.actors.reviewer);
   for(const f of ['coach-intake.js','coach-programming-v4.js','coach-programming-v5.js','coach-questionnaire.js','coach-prescription.js','coach.js','coach-reviewer.js'])await page.addScriptTag({content:fs.readFileSync(path.join(root,'assets',f),'utf8')});
   await page.evaluate(async()=>{window.coachCall=name=>qaReadRPC(name);await openCoachReviewer();});
   const quality=page.locator('.coach-quality');
   check(engine+' five warnings rendered from real authenticated queue',await quality.locator('ul > li').count()===5,'browser + real SDK/JWT');
   receipt.warnings=await quality.locator('ul > li').allTextContents();save();
   check(engine+' 30 planned sets and human decision controls remain enabled',await page.locator('.coach-prescription ol li').count()===30&&await page.getByRole('button',{name:'Aprobar propuesta',exact:true}).isEnabled()&&await page.getByRole('button',{name:'Rechazar propuesta',exact:true}).isEnabled(),'browser + real SDK/JWT');
   check(engine+' direct/secondary distinction and uncertainty visible',(await quality.innerText()).includes('participación secundaria en 6 series / 3 días')&&(await quality.innerText()).includes('recuperación percibida'),'browser + real SDK/JWT');
   for(const width of [320,360,390,430,1280])for(const theme of ['light','dark']){
    await page.setViewportSize({width,height:844});await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    check(engine+' '+width+' '+theme+' readable warning layout',await page.locator('#coachDialog').evaluate(d=>d.scrollWidth<=d.clientWidth+1&&[...d.querySelectorAll('.coach-quality li')].every(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility==='visible')),'browser + real SDK/JWT');
   }
   check(engine+' no page errors or browser network',!errors.length&&!requests.length,'browser + real SDK/JWT');
  }finally{await browser.close();}
 }
}
async function main(){
 assert(resume||!fs.existsSync(path.join(dir,'sdk-receipt.json')),'Do not rerun this trial');
 const credentials=JSON.parse(fs.readFileSync(manifestPath));assert.equal(credentials.ref,REF);
 try{
  for(const actor of Object.keys(plan.actors)){
   const u=credentials.users[actor];assert.equal(u.id,plan.actors[actor]);assert(u.email.endsWith('@example.invalid'));
   receipt.counts[actor]={logins:0,reads:0,blocked:0};
   const guarded=(url,options={})=>{
    if(!fence(actor,url,options)){receipt.counts[actor].blocked++;throw Error('Request denied by read-only fence');}
    if(new URL(url).pathname.startsWith('/rest/'))receipt.counts[actor].reads++;
    return fetch(url,{...options,signal:AbortSignal.timeout(20000),redirect:'error'});
   };
   const db=sandbox.supabase.createClient(BASE,credentials.key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:guarded}});clients[actor]=db;
   const login=await db.auth.signInWithPassword({email:u.email,password:u.password});delete u.password;
   check(actor+' existing synthetic login',!login.error&&login.data.user?.id===u.id);
   const identity=await db.auth.getUser();check(actor+' server verifies identity',!identity.error&&identity.data.user?.id===u.id);
   const role=await db.from('profiles').select('id,role').eq('id',u.id).single();check(actor+' role unchanged',!role.error&&role.data.role===(['mock','real'].includes(actor)?'client':'trainer'));
  }
  // Sessions ready before opening the capability window; trigger contains only run ID.
  console.log('READY: four real SDK sessions in memory, no temporary access opened');
  const deadline=Date.now()+15*60000;while(!fs.existsSync(path.join(dir,'start-reads.json'))){assert(Date.now()<deadline,'Activation not received; stop safely');await new Promise(r=>setTimeout(r,500));}
  const trigger=read('start-reads.json');assert.equal(trigger.run,plan.run);
  const seed=read('seed-receipt.json'),cfg=seed.reviewer_config[plan.actors.reviewer];
  assert(Date.parse(cfg.expires_at)>Date.now()+5*60000&&Date.parse(cfg.expires_at)-Date.parse(cfg.activated_at)<=3600000);
  const cap=await clients.mock.rpc('get_my_coach_access',{});check('owner scope allows reads but no generation slot',!cap.error&&cap.data.authorized&&cap.data.can_generate===false);
  const queue=await clients.reviewer.rpc('get_coach_review_queue',{});check('reviewer safe projection contains exactly the one seeded operation',!queue.error&&queue.data.length===1&&queue.data[0].operation.id===plan.operation);
  const row=plain(queue.data[0]);assert.deepEqual(row.operation.proposal,plan.proposal);
  check('projection proposal preserved and pending human review',row.operation.state==='pending_review'&&row.operation.reviewed_at===null&&row.operation.accepted_at===null&&row.operation.routine_id===null);
  check('projection contains training-only keys and no health/custom data',Object.keys(row).sort().join(',')==='athlete,feedback,operation,training'&&Object.keys(row.training).every(k=>Object.hasOwn(plan.training,k))&&row.training.inventory.custom.length===0);
  receipt.projection=row;save();
  for(const actor of ['mock','real','trainer']){
   const q=await clients[actor].rpc('get_coach_review_queue',{});check(actor+' without reviewer capability denied projection',!!q.error&&q.error.message==='coach_reviewer_required');
  }
  for(const actor of Object.keys(plan.actors)){
   const op=await clients[actor].from('coach_operations').select('*').eq('id',plan.operation);
   check(actor+' direct operation ownership isolation',actor==='mock'?!op.error&&op.data.length===1:!!op.error||op.data.length===0);
   const intake=await clients[actor].from('training_intakes').select('*').eq('id',plan.intake);
   check(actor+' direct private intake ownership isolation',actor==='mock'?!intake.error&&intake.data.length===1:!!intake.error||intake.data.length===0);
  }
  await ui();
  const final=await clients.mock.from('coach_operations').select('*').eq('id',plan.operation).single();
  assert.deepEqual(plain(final.data),seed.operation);check('operation equivalent JSON after UI; no automatic decision',!final.error);
  const second=await clients.reviewer.rpc('get_coach_review_queue',{});assert.deepEqual(plain(second.data),plain(queue.data));check('reviewer projection unchanged after all reads',!second.error);
  check('no blocked mutation attempts or provider dispatch',Object.values(receipt.counts).every(c=>c.blocked===0));
  receipt.complete=true;
 }finally{
  receipt.signouts={};for(const [a,db]of Object.entries(clients)){try{const r=await db.auth.signOut({scope:'local'});receipt.signouts[a]=!r.error;}catch{receipt.signouts[a]=false;}delete clients[a];}
  for(const u of Object.values(credentials.users))delete u.password;receipt.finishedAt=new Date().toISOString();save();
 }
}
main().then(()=>console.log(JSON.stringify({complete:receipt.complete,passed:receipt.checks.filter(c=>c.pass).length,total:receipt.checks.length}))).catch(e=>{receipt.failure=e.name+': '+(e instanceof assert.AssertionError?e.message.split('\n')[0]:'Read harness failed; inspect sanitized receipt');save();console.error(receipt.failure);process.exitCode=1;});
