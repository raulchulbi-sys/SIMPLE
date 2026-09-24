const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const dir=__dirname,c=JSON.parse(fs.readFileSync(path.join(dir,'private/rest.json'))),i=c.ids;
assert.equal(c.ref,'dmqjexigdnfzobarhnib');const url='https://'+c.ref+'.supabase.co',tokens={},results=[],trace=[];
process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/raulc/Documents/Codex/2026-09-07/quiero-que-realices-una-auditor-a/work/pw-browsers';
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
async function req(who,route,method='GET',body){const r=await fetch(url+route,{method,headers:{apikey:c.key,...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{}),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const data=await r.json().catch(()=>null);if(!r.ok)throw Error(JSON.stringify({status:r.status,data}));return data;}
const table=(who,name,filter='',method='GET',body)=>req(who,'/rest/v1/'+name+'?'+filter,method,body);
const notes=()=>table('client','routine_user_notes','routine_id=eq.'+i.routine+'&order=exercise_key');
const key=id=>'exercise:'+id;
async function until(fn){const end=Date.now()+12000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,80));}throw Error('Timed out waiting for persisted state');}
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL '+name+' '+e.message.slice(0,400));throw e;}}
async function main(){
 for(const [who,u] of Object.entries(c.users)){const d=await req(null,'/auth/v1/token?grant_type=password','POST',{email:u.email,password:u.password});tokens[who]=d.access_token;assert.equal(d.user.id,u.id);}
 const sdk=await(await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js')).text();
 const html=fs.readFileSync('index.html','utf8').replace('https://yvguatdqncadkwewlepe.supabase.co',url).replace('sb_publishable_VYoUECN0MaGIOC2LtGi0iw_C0wqUY-W',c.key);
 for(const engine of ['chromium','webkit'])for(const width of [390,1280]){
  const label=engine+' '+width,b=await(engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
  let gate=null;const errors=[];
  try{
   await table('client','workouts','user_id=eq.'+c.users.client.id,'DELETE');
   await table('client','routine_user_notes','routine_id=eq.'+i.routine,'DELETE');
   await table('trainer','routine_exercises','id=eq.'+i.exercise,'PATCH',{name:'Press',notes:null,exercise_order:0});
   await table('trainer','routine_exercises','id=eq.'+i.second,'PATCH',{name:'Press',notes:null,exercise_order:1});
   await table('client','routine_user_notes','','POST',{user_id:c.users.client.id,routine_id:i.routine,exercise_key:'press',note:'LEGACY: never assign by name'});
   async function page(who='client'){
    const p=await b.newPage({viewport:{width,height:900},hasTouch:width===390});p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('dialog',d=>d.accept());
    await p.route('**/*',async r=>{const u=r.request().url();if(u==='https://simple.test/')return r.fulfill({body:html,contentType:'text/html'});if(u.includes('cdn.jsdelivr'))return r.fulfill({body:sdk,contentType:'application/javascript'});if(!u.startsWith(url+'/'))return r.abort();
     const held=gate?.p===p&&gate.match(r.request())?gate:null;if(held)gate=null;const response=await r.fetch();
     if(u.includes('/rest/v1/routine_user_notes')&&r.request().method()==='POST')trace.push({label,payload:r.request().postDataJSON(),status:response.status(),response:await response.json().catch(()=>null)});
     if(held){held.captured=true;await held.wait;}return r.fulfill({response});});
    await p.goto('https://simple.test/');await p.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(c.users[who].email);await p.locator('input[type=password]').first().fill(c.users[who].password);await p.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);return p;
   }
   async function open(p){await p.evaluate(async i=>{closeM('trainModal');await openSharedRoutine(i.routine);await startWorkoutDay(i.day);openM('trainModal');},i);await p.locator('#trainBody textarea').first().waitFor();}
   const input=(p,id)=>p.locator('#trainBody textarea[oninput*="'+id+'"]');
   async function persist(p,id,note){await input(p,id).fill(note);await until(async()=> (await notes()).some(n=>n.exercise_key===key(id)&&n.note===note));}
   async function fresh(p){await p.evaluate(()=>{closeM('trainModal');for(const k of Object.keys(localStorage))if(k.startsWith('simple_routine_notes_')||k.startsWith('simple_workout_draft_'))localStorage.removeItem(k);});await p.reload();await p.waitForFunction(()=>window.__simpleStarted&&!window.__simpleStartBusy);await open(p);}
   const p=await page(),q=await page();await open(p);await open(q);
   await test(label+' ambiguous legacy remains unassigned and untouched',async()=>{assert.equal(await input(p,i.exercise).inputValue(),'');assert.equal(await input(p,i.second).inputValue(),'');assert.equal((await notes()).find(n=>n.exercise_key==='press').note,'LEGACY: never assign by name');});
   await test(label+' two tabs persist independent homonym notes by UUID',async()=>{await persist(p,i.exercise,'A 137');await persist(q,i.second,'B 248');const rows=await notes();assert.equal(rows.find(n=>n.exercise_key===key(i.exercise)).note,'A 137');assert.equal(rows.find(n=>n.exercise_key===key(i.second)).note,'B 248');});
   await test(label+' reload without local notes/draft reads exact Supabase values',async()=>{await fresh(p);assert.equal(await input(p,i.exercise).inputValue(),'A 137');assert.equal(await input(p,i.second).inputValue(),'B 248');});
   await test(label+' rename and reorder preserve UUID notes; old name has independent note',async()=>{await table('trainer','routine_exercises','id=eq.'+i.exercise,'PATCH',{name:'Renamed UUID A',exercise_order:1});await table('trainer','routine_exercises','id=eq.'+i.second,'PATCH',{exercise_order:0});await fresh(p);assert.equal(await input(p,i.exercise).inputValue(),'A 137');assert.equal(await input(p,i.second).inputValue(),'B 248');assert.equal(await p.evaluate(()=>activeWorkout.exercises[0].name),'Press');});
   await test(label+' empty UUID note persists and suppresses fallback after reopening',async()=>{await persist(p,i.exercise,'');await fresh(p);assert.equal(await input(p,i.exercise).inputValue(),'');assert.equal(await input(p,i.second).inputValue(),'B 248');});
   await test(label+' delayed old note response cannot overwrite newer note',async()=>{
    const g={p,match:r=>r.method()==='POST'&&r.url().includes('/routine_user_notes')};g.wait=new Promise(resolve=>g.release=resolve);gate=g;
    await input(p,i.exercise).fill('old response');await until(()=>g.captured);await input(p,i.exercise).fill('new response');await new Promise(r=>setTimeout(r,450));g.release();await until(async()=> (await notes()).some(n=>n.exercise_key===key(i.exercise)&&n.note==='new response'));await fresh(p);assert.equal(await input(p,i.exercise).inputValue(),'new response');
   });
   await test(label+' trainer authorized notes RPC exposes UUID keys unchanged',async()=>{const rows=await req('trainer','/rest/v1/rpc/get_client_routine_notes','POST',{p_client_id:c.users.client.id,p_routine_id:i.routine});assert(rows.some(n=>n.exercise_key===key(i.exercise)&&n.note==='new response'));assert(rows.some(n=>n.exercise_key===key(i.second)&&n.note==='B 248'));});
   await test(label+' other user cannot read personal notes',async()=>{assert.deepEqual(await table('other','routine_user_notes','routine_id=eq.'+i.routine),[]);});
   await test(label+' save workout retains UUID notes and exact execution after reload',async()=>{
    await p.evaluate(()=>{for(const e of activeWorkout.exercises){updateSet(e.id,0,'kg','31');updateSet(e.id,0,'reps','13');updateSet(e.id,0,'rir','2');toggleSet(e.id,0);} });
    await p.evaluate(()=>saveWorkoutSession());const ws=await table('client','workouts','user_id=eq.'+c.users.client.id);assert.equal(ws.length,1);const ex=ws[0].data.exercises;assert.equal(ex.find(e=>e.exercise_id===i.exercise).notes,'new response');assert.equal(ex.find(e=>e.exercise_id===i.second).notes,'B 248');assert.equal(ex.find(e=>e.exercise_id===i.exercise).sets[0].kg,'31');await fresh(p);assert.equal(await input(p,i.exercise).inputValue(),'new response');assert(await input(p,i.exercise).isDisabled());
   });
   await test(label+' legacy row not rewritten and no foreign-routine note writes',async()=>{const ns=await notes();assert.equal(ns.length,3);assert.equal(ns.find(n=>n.exercise_key==='press').note,'LEGACY: never assign by name');assert(trace.filter(t=>t.label===label).every(t=>t.payload.routine_id===i.routine&&t.payload.exercise_key.startsWith('exercise:')));});
   await test(label+' no JavaScript errors or horizontal overflow',async()=>{assert.deepEqual(errors,[]);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));});
  }finally{if(gate)gate.release();await b.close();}
 }
}
main().catch(e=>{results.push({name:'Suite completion',pass:false,error:e.message});console.error(e);process.exitCode=1}).finally(async()=>{for(const who of Object.keys(tokens))await req(who,'/auth/v1/logout?scope=global','POST').catch(()=>{});fs.writeFileSync(path.join(dir,'results/live.json'),JSON.stringify({sha256:crypto.createHash('sha256').update(fs.readFileSync('index.html')).digest('hex'),project:c.ref,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass),results,trace},null,2));});
