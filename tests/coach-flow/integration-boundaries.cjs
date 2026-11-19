'use strict';
// Actual frontend, synthetic SDK/state. No JWT, provider or connected-service claim.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const {seed,training}=require('./recovery.cjs');
const {chromium,webkit}=require(process.env.SIMPLE_PLAYWRIGHT_MODULE||path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),checks=[];
const check=(name,pass)=>checks.push({name,pass:!!pass});
const baseline=process.argv.includes('--baseline');
const suffix=baseline?'-before':process.argv.includes('--historical-before')?'-historical-before':'';
async function basic(p,engine,proposal){
 for(const [name,access]of [['closed',{authorized:true,can_generate:false}],['string false',{authorized:true,can_generate:'false'}],['string true',{authorized:true,can_generate:'true'}],['missing capability',{authorized:true}],['not admitted',{authorized:false,can_generate:true}],['read failed',null]]){
  await seed(p,'pending',proposal);
  await p.evaluate(access=>{const rpc=db.rpc;window.boundaryReads=0;db.rpc=async(n,a)=>{if(n==='get_my_coach_access'){boundaryReads++;return access?demoResult(access):demoResult(null,{message:'read unavailable'});}return rpc(n,a);};},access);
  // The form was already open when availability changed: recheck immediately before saving.
  await p.locator('#coachConfirmSend').click();await p.waitForFunction(()=>!simpleCoach.busy);
  check(engine+' Basic '+name+' stops before intake write and dispatch',await p.evaluate(()=>flow.saves===0&&flow.calls===0&&mock.tables.training_intakes.length===0));
 }
 await seed(p,'pending',proposal);await p.evaluate(()=>{const rpc=db.rpc;db.rpc=(n,a)=>n==='get_my_coach_access'?Promise.resolve(demoResult({authorized:true,can_generate:false})):rpc(n,a);return openSimpleCoach();});
 check(engine+' initial closed gate is explained without confusing admission with generation',await p.locator('#coachDialog').innerText().then(t=>t.includes('generación')&&t.includes('disponible')));
 await seed(p,'delayed',proposal);await p.locator('#coachConfirmSend').click();await p.locator('#coachRecoverRefresh').waitFor();
 const saved=await p.evaluate(()=>({owner:user.id,tables:structuredClone(mock.tables)}));
 await p.reload();await p.waitForFunction(()=>window.previewReady);
 await p.evaluate(({owner,tables})=>{user={id:owner};profile={id:owner,role:'client'};Object.assign(mock.tables,tables);window.boundaryBasic={writes:0,calls:0};db.rpc=async n=>{if(n==='get_my_coach_access')return demoResult({authorized:true,can_generate:false});boundaryBasic.writes++;throw Error('Unexpected write');};db.functions.invoke=async()=>{boundaryBasic.calls++;throw Error('No dispatch');};return openSimpleCoach();},saved);
 await p.locator('#coachBegin').click();await p.locator('#coachRecoverRefresh').waitFor();
 check(engine+' closed gate preserves submitted recovery and exact saved data',await p.evaluate(t=>boundaryBasic.writes===0&&boundaryBasic.calls===0&&simpleCoach.generationAttempt?.intake===t.training_intakes[0].id&&JSON.stringify(mock.tables.training_intakes)===JSON.stringify(t.training_intakes),saved.tables));
}
async function mountChat(p,state){
 await p.evaluate(state=>{
  const root=document.createElement('div');root.id='boundary-chat';root.style.cssText='position:fixed;inset:0;background:white;z-index:99999';document.body.append(root);
  window.chatBoundary={view:state,calls:[],mode:'uncertain',records:new Map()};
  window.boundaryChat=PremiumChat.mount(root,async(action,data)=>{
   if(action==='state')return structuredClone(chatBoundary.view);
   if(action!=='send')throw Error('Unexpected action');
   chatBoundary.calls.push(structuredClone(data));
   if(chatBoundary.mode==='uncertain')throw Error('preview_offline');
   if(chatBoundary.mode==='emptyResponse')return{};
   const original=chatBoundary.original;
   if(original&&data.key===original.key&&data.message!==original.message)throw Error('premium_chat_key_conflict');
   // Match the real adapter: the server owns message IDs, independently of the UI UUID.
   const row={id:crypto.randomUUID(),sequence:chatBoundary.view.messages.length+1,state:chatBoundary.mode==='pending'?'reserved':'completed',revision_id:data.revision_id,user_content:data.message,assistant_answer:chatBoundary.mode==='pending'?null:'SYNTHETIC answer'};
   chatBoundary.view.messages.push(row);return{message:row};
  },{pollMs:60000});
 },state);
 await p.waitForFunction(()=>boundaryChat.snapshot().view);
}
async function premium(p,engine){
 await p.goto('http://127.0.0.1:4266/demo');await p.waitForFunction(()=>window.previewReady);
 const state=await p.evaluate(()=>({permission:true,history_permission:true,available:true,week:1,revision_no:1,revision_id:crypto.randomUUID(),mesocycle_id:crypto.randomUUID(),conversation:{id:crypto.randomUUID()},messages:[]}));
 await mountChat(p,state);await p.locator('#boundary-chat textarea').fill('¿Cómo ajusto el descanso?');await p.locator('#boundary-chat [data-action=send]').click();await p.waitForFunction(()=>!boundaryChat.snapshot().busy&&chatBoundary.calls.length===1);
 const first=await p.evaluate(()=>chatBoundary.calls[0]);
 check(engine+' Premium ambiguous send stores identifiers only',await p.evaluate(()=>{const m=JSON.parse(sessionStorage.getItem('simple-premium-chat-pending:'+chatBoundary.view.mesocycle_id));return Object.keys(m).sort().join(',')==='key,message_id,revision_id'&&!JSON.stringify(m).includes('descanso');}));
 await p.reload();await p.waitForFunction(()=>window.previewReady);await mountChat(p,state);
 check(engine+' Premium full reload retains same uncertain key and context',await p.evaluate(first=>{const o=boundaryChat.snapshot().outstanding;return o?.key===first.key&&o.message_id===first.message_id&&o.revision_id===first.revision_id;},first));
 await p.evaluate(async()=>{await boundaryChat.load();await boundaryChat.load();});
 check(engine+' Premium empty read never sends and retains the marker',await p.evaluate(first=>chatBoundary.calls.length===0&&boundaryChat.snapshot().outstanding?.key===first.key,first));
 await p.evaluate(async()=>{chatBoundary.view.messages.push({id:crypto.randomUUID(),sequence:1,state:'completed',revision_id:chatBoundary.view.revision_id,user_content:'SYNTHETIC unrelated history',assistant_answer:'SYNTHETIC previous answer'});await boundaryChat.load();});
 check(engine+' Premium unrelated terminal history does not confirm uncertain request',await p.evaluate(first=>chatBoundary.calls.length===0&&boundaryChat.snapshot().outstanding?.key===first.key,first));
 await p.evaluate(first=>{chatBoundary.mode='confirmed';chatBoundary.original=first;},first);
 await p.locator('#boundary-chat textarea').fill('Otra pregunta distinta');await p.locator('#boundary-chat [data-action=send]').click();await p.waitForFunction(()=>!boundaryChat.snapshot().busy&&chatBoundary.calls.length===1);
 check(engine+' Premium changed content reaches server with original key and stays unresolved',await p.evaluate(first=>chatBoundary.calls[0].key===first.key&&boundaryChat.snapshot().outstanding?.key===first.key&&chatBoundary.view.messages.length===1,first));
 await p.locator('#boundary-chat textarea').fill(first.message);await p.waitForFunction(()=>document.querySelector('#boundary-chat [data-action=send]').dataset.robustClick!=='1');await p.locator('#boundary-chat [data-action=send]').click();await p.waitForFunction(()=>!boundaryChat.snapshot().busy&&chatBoundary.calls.length===2);
 check(engine+' Premium explicit retry after reload reuses key and original context',await p.evaluate(first=>chatBoundary.calls[1].key===first.key&&chatBoundary.calls[1].revision_id===first.revision_id,first));
 check(engine+' Premium server-confirmed completion releases marker despite different server ID',await p.evaluate(()=>boundaryChat.snapshot().outstanding===null&&sessionStorage.getItem('simple-premium-chat-pending:'+chatBoundary.view.mesocycle_id)===null&&chatBoundary.view.messages.length===2));
 // Confirmed pending response binds the server ID, then read-only completion clears it.
 await p.evaluate(()=>chatBoundary.mode='pending');await p.locator('#boundary-chat textarea').fill('¿Y las repeticiones?');await p.waitForFunction(()=>document.querySelector('#boundary-chat [data-action=send]').dataset.robustClick!=='1');await p.locator('#boundary-chat [data-action=send]').click();await p.waitForFunction(()=>!boundaryChat.snapshot().busy&&chatBoundary.calls.length===3);
 check(engine+' Premium confirmed pending response binds server message ID',await p.evaluate(()=>boundaryChat.snapshot().outstanding?.message_id===chatBoundary.view.messages.at(-1).id&&boundaryChat.snapshot().outstanding?.key===chatBoundary.calls[2].key));
 await p.evaluate(async()=>{const m=chatBoundary.view.messages.at(-1);m.state='completed';m.assistant_answer='SYNTHETIC completed';await boundaryChat.load();});
 check(engine+' Premium read-only confirmation releases pending marker without another send',await p.evaluate(()=>boundaryChat.snapshot().outstanding===null&&chatBoundary.calls.length===3));
 for(const change of ['revision','permission']){
  await p.evaluate(()=>chatBoundary.mode='uncertain');await p.locator('#boundary-chat textarea').fill('¿Puedo revisar mi rutina?');await p.waitForFunction(()=>document.querySelector('#boundary-chat [data-action=send]').dataset.robustClick!=='1');await p.locator('#boundary-chat [data-action=send]').click();await p.waitForFunction(()=>!boundaryChat.snapshot().busy);
  const count=await p.evaluate(()=>chatBoundary.calls.length);
  await p.evaluate(async change=>{if(change==='revision'){chatBoundary.view.revision_id=crypto.randomUUID();chatBoundary.view.revision_no++;}else chatBoundary.view.permission=false;await boundaryChat.load();},change);
  check(engine+' Premium '+change+' invalidates old key without resending',await p.evaluate(count=>boundaryChat.snapshot().outstanding===null&&chatBoundary.calls.length===count,count));
 }
 await p.evaluate(()=>boundaryChat.destroy());
 await p.goto('http://127.0.0.1:4266/demo');await p.waitForFunction(()=>window.previewReady);
 const historical=await p.evaluate(state=>({...state,messages:[{id:crypto.randomUUID(),sequence:1,state:'completed',revision_id:state.revision_id,user_content:'¿Cómo ajusto el descanso?',assistant_answer:'SYNTHETIC historical answer'}]}),state);
 await mountChat(p,historical);await p.evaluate(()=>chatBoundary.mode='emptyResponse');await p.locator('#boundary-chat textarea').fill('¿Cómo ajusto el descanso?');await p.locator('#boundary-chat [data-action=send]').click();await p.waitForFunction(()=>!boundaryChat.snapshot().busy&&chatBoundary.calls.length===1);
 check(engine+' Premium empty dispatch response cannot confirm a historical message with identical text',await p.locator('#boundary-chat textarea').inputValue()==='¿Cómo ajusto el descanso?'&&await p.locator('#boundary-chat .chat-status').innerText().then(t=>t.includes('No se ha podido confirmar')));
 check(engine+' Premium same-text history keeps uncertainty and cannot trigger another send',await p.evaluate(()=>chatBoundary.calls.length===1&&chatBoundary.view.messages.length===1&&boundaryChat.snapshot().outstanding?.key===chatBoundary.calls[0].key));
 await p.evaluate(()=>boundaryChat.destroy());
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});const server=spawn(process.execPath,['tests/coach-flow/preview-offline.cjs'],{cwd:root,env:{...process.env,COACH_PORT:'4266'},stdio:['ignore','pipe','pipe'],windowsHide:true});
 try{
  await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('exit',()=>{clearTimeout(t);reject(Error('Preview exited'));});});
  const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
  const proposal=C.decodeOutput({days:training.weekdays.map(day=>({day,exercises:['goblet','db_rdl','floor_press','band_row'].map(id=>({id,k:0,b:[{s:2,lo:8,hi:10,r:3,rest:120}]}))}))},{training});
  for(const engine of ['chromium','webkit']){
   const b=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});
   try{const p=await b.newPage({serviceWorkers:'block'});p.setDefaultTimeout(10000);const external=[];await p.route('**/*',r=>{if(['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname))return r.continue();external.push(r.request().url());return r.abort();});await basic(p,engine,proposal);await premium(p,engine);check(engine+' no external HTTP',external.length===0);}finally{await b.close();}
  }
 }finally{server.kill();}
 const failed=checks.filter(x=>!x.pass);fs.writeFileSync(path.join(out,'integration-boundaries'+suffix+'.json'),JSON.stringify({simulated:true,realJWT:false,providerCalls:0,total:checks.length,passed:checks.length-failed.length,checks},null,2));console.log((checks.length-failed.length)+'/'+checks.length+' integration boundary cases');for(const x of failed)console.error('FAIL '+x.name);if(failed.length)process.exitCode=1;
})().catch(e=>{fs.writeFileSync(path.join(out,'integration-boundaries'+suffix+'-failure.json'),JSON.stringify({error:e.message,checks},null,2));console.error(e.message);process.exitCode=1;});
