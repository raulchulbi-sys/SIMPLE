// Actual frontend; synthetic server state only. Never a JWT/server-security proof.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const {training}=require('./recovery.cjs');
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),checks=[];
const check=(name,pass)=>{checks.push({name,pass:!!pass});assert(pass,name);};
const id=()=>require('crypto').randomUUID();
async function basic(page,engine,proposal){
 for(const state of ['reserved','failed','pending_review','ready','accepted','absent']){
  const owner=id(),rid=id(),intake=id(),op=id();
  const tables={routines:[{id:rid,owner_id:owner,name:'SYNTHETIC accepted routine'}],routine_days:[{id:id(),routine_id:rid,name:'SYNTHETIC day',day_order:0}],routine_exercises:[],routine_revisions:[{id:id(),user_id:owner,routine_id:rid,snapshot:{preserved:true}}],workouts:[{id:id(),user_id:owner,data:{routine_id:rid,value:20}}],routine_user_notes:[{id:id(),user_id:owner,routine_id:rid,note:'SYNTHETIC existing note'}],training_intakes:[{id:intake,user_id:owner,state:'submitted',revision:1,row_version:1,training}],context_grants:[{id:id(),user_id:owner,scope:'training_intake',notice_version:'pilot-supervised-v2',revoked_at:null}],coach_operations:state==='absent'?[]:[{id:op,user_id:owner,intake_id:intake,state,proposal,routine_id:state==='accepted'?rid:null,error_code:state==='failed'?'provider_network_or_timeout':null,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+60000).toISOString()}]};
  const boot=async()=>{await page.waitForFunction(()=>window.previewReady);await page.evaluate(({owner,rid,state,tables})=>{
   user={id:owner};profile={id:owner,role:'client'};Object.assign(mock.tables,structuredClone(tables));window.reloadQA={invocations:0,writes:0};
   db.functions.invoke=async()=>{reloadQA.invocations++;throw Error('Provider forbidden in reload test');};
   db.rpc=async(name)=>{if(name==='get_my_coach_access')return demoResult({authorized:true,can_generate:false,routine_id:rid,accepted_routines:[{routine_id:rid,name:'SYNTHETIC accepted routine'}],latest_operation_state:state==='absent'?null:state});reloadQA.writes++;throw Error('No RPC writes in reload test');};
   return openSimpleCoach();
  },{owner,rid,state,tables});};
  await page.goto('http://127.0.0.1:4273/demo');await boot();
  await page.evaluate(({owner,intake})=>simpleCoach.generationAttempt={owner,intake},{owner,intake});
  // A complete navigation drops the in-memory ambiguity marker; persisted server state is restored by the test, not by app storage.
  await page.reload();await boot();
  check(engine+' '+state+' full reload drops memory-only attempt',await page.evaluate(()=>simpleCoach.generationAttempt===null));
  if(!['accepted','absent'].includes(state)){
   await page.locator('#coachPending').click();
   if(state==='ready')await page.locator('#coachAccept').waitFor();
   else if(state==='pending_review')await page.locator('#coachRefresh').waitFor();
   else await page.getByRole('heading',{name:state==='reserved'?'Estamos preparando tu rutina':'Propuesta no disponible',exact:true}).waitFor();
   check(engine+' '+state+' reload recovers existing operation without acceptance',await page.evaluate(({op,state})=>simpleCoach.operation.id===op&&(state==='ready'||!document.getElementById('coachAccept')),{op,state}));
  }else check(engine+' '+state+' reload retains accepted routine route',await page.locator('#coachOpen').getAttribute('data-coach-routine')===rid&&await page.locator('#coachConfirmSend').count()===0);
  check(engine+' '+state+' no dispatch/write or historical mutation',await page.evaluate(expected=>reloadQA.invocations===0&&reloadQA.writes===0&&Object.entries(expected).every(([k,v])=>JSON.stringify(mock.tables[k])===JSON.stringify(v)),tables));
  await page.evaluate(()=>coachDialog().close());
 }
}
async function premium(page,engine){
 for(const mode of ['content','revision','permission']){
  await page.goto('http://127.0.0.1:4273/demo');await page.waitForFunction(()=>window.previewReady);
  await page.evaluate(mode=>{
   const root=document.createElement('div');root.id='context-fixture';root.style.cssText='position:fixed;inset:0;background:white;z-index:99999';document.body.append(root);
   window.contextQA={mode,calls:[],provider:0,records:new Map(),conflicts:0,view:{permission:true,history_permission:true,available:true,week:1,revision_no:1,revision_id:crypto.randomUUID(),mesocycle_id:crypto.randomUUID(),conversation:{id:crypto.randomUUID()},messages:[{id:crypto.randomUUID(),sequence:1,state:'completed',revision_id:crypto.randomUUID(),user_content:'SYNTHETIC prior question',assistant_answer:'SYNTHETIC confirmed answer'}]}};
   contextQA.originalTranscript=JSON.stringify(contextQA.view.messages);
   window.contextController=PremiumChat.mount(root,async(action,data)=>{
    const q=contextQA;if(action==='state')return structuredClone(q.view);if(action!=='send')throw Error('Unexpected action');q.calls.push(structuredClone(data));
    if(q.calls.length===1){q.records.set(data.key,structuredClone(data));q.provider++;throw Error('preview_offline');}
    const first=q.records.get(data.key);
    if(!q.view.permission)throw Error('premium_chat_context_revoked');
    if(data.revision_id!==q.view.revision_id)throw Error('premium_chat_stale_revision');
    if(first&&(first.message!==data.message||first.mesocycle_id!==data.mesocycle_id||first.revision_id!==data.revision_id)){q.conflicts++;throw Error('premium_chat_key_conflict');}
    if(!first){q.records.set(data.key,structuredClone(data));q.provider++;}
    const message={id:data.message_id,sequence:2,state:'completed',revision_id:data.revision_id,user_content:data.message,assistant_answer:'SYNTHETIC answer'};q.view.messages.push(message);return structuredClone(q.view);
   });
  },mode);
  await page.waitForFunction(()=>contextController.snapshot().view);
  const box=page.locator('#context-fixture'),input=box.locator('textarea');
  await input.fill('¿Qué significa RIR?');await box.locator('[data-action=send]').click();await page.waitForFunction(()=>contextQA.calls.length===1&&!contextController.snapshot().busy);
  if(mode==='content'){
   await input.fill('¿Y el descanso?');await page.waitForFunction(()=>document.querySelector('#context-fixture [data-action=send]').dataset.robustClick!=='1');await box.locator('[data-action=send]').click();await page.waitForFunction(()=>contextQA.calls.length===2&&!contextController.snapshot().busy);
   check(engine+' content conflict reaches simulated server with original key',await page.evaluate(()=>contextQA.conflicts===1&&contextQA.calls[0].key===contextQA.calls[1].key));
   check(engine+' content conflict retains draft and displays server error',await input.inputValue()==='¿Y el descanso?'&&await box.locator('.chat-status').innerText().then(t=>t.includes('otro mensaje')));
  }else if(mode==='revision'){
   await page.evaluate(()=>{contextQA.view.revision_id=crypto.randomUUID();contextQA.view.revision_no=2;});
   await page.waitForFunction(()=>document.querySelector('#context-fixture [data-action=send]').dataset.robustClick!=='1');await box.locator('[data-action=send]').click();await page.waitForFunction(()=>contextQA.calls.length===2&&!contextController.snapshot().busy);
   check(engine+' revision changed between attempts rejects old context',await page.evaluate(()=>contextQA.calls[0].key===contextQA.calls[1].key&&contextController.snapshot().view.revision_no===2));
   check(engine+' revision rejection does not automatically resend new turn',await page.evaluate(()=>contextQA.calls.length===2&&contextQA.provider===1));
  }else{
   await page.evaluate(async()=>{contextQA.view.permission=false;await contextController.load();});
   check(engine+' revoked context disables input and clears outstanding key',await input.isDisabled()&&await page.evaluate(()=>contextController.snapshot().outstanding===null));
   check(engine+' revoked context causes no automatic resend',await page.evaluate(()=>contextQA.calls.length===1&&contextQA.provider===1));
  }
  check(engine+' '+mode+' prior confirmed transcript preserved without duplicate charge',await page.evaluate(()=>JSON.stringify(contextQA.view.messages)===contextQA.originalTranscript&&contextQA.provider===1));
  await page.evaluate(()=>contextController.destroy());
 }
}
(async()=>{const server=spawn(process.execPath,['tests/coach-pilot/preview.cjs'],{cwd:root,env:{...process.env,COACH_PORT:'4273'},stdio:['ignore','pipe','pipe'],windowsHide:true});try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Preview timeout')),10000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('exit',()=>{clearTimeout(t);reject(Error('Preview exited'));});});
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 const proposal=C.decodeOutput({days:training.weekdays.map(day=>({day,exercises:['goblet','db_rdl','floor_press','band_row'].map(id=>({id,k:0,b:[{s:2,lo:8,hi:10,r:3,rest:120}]}))}))},{training});assert(C.reviewProposal(proposal,{training}).ok);
 for(const engine of ['chromium','webkit']){const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{const p=await browser.newPage({viewport:{width:390,height:844}});p.setDefaultTimeout(10000);await p.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());await basic(p,engine,proposal);await premium(p,engine);}finally{await browser.close();}}
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'reload-context.json'),JSON.stringify({simulated:true,realJWT:false,paidProviderCalls:0,passed:checks.filter(x=>x.pass).length,total:checks.length,checks},null,2));console.log(checks.length+'/'+checks.length+' simulated reload/context assertions');
 }finally{server.kill();}})().catch(e=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'reload-context-failure.json'),JSON.stringify({simulated:true,error:e.message,checks},null,2));console.error(e.message);process.exitCode=1;});
