// Focused reproduction: a submitted intake survives reload while registration is uncertain.
// Actual frontend, synthetic persistence; no JWT/security/provider success is claimed.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{spawn}=require('child_process');
const {seed,training}=require('./recovery.cjs');
const {chromium,webkit}=require('C:/Users/raulc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../..'),out=path.join(__dirname,'results'),checks=[];
const check=(name,pass)=>{checks.push({name,pass:!!pass});assert(pass,name);};
(async()=>{const server=spawn(process.execPath,['tests/coach-pilot/preview.cjs'],{cwd:root,env:{...process.env,COACH_PORT:'4266'},stdio:['ignore','pipe','pipe'],windowsHide:true});try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Preview unavailable')),10000);server.stdout.once('data',()=>{clearTimeout(t);resolve();});server.once('exit',()=>{clearTimeout(t);reject(Error('Preview exited'));});});
 const C=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
 const proposal=C.decodeOutput({days:training.weekdays.map(day=>({day,exercises:['goblet','db_rdl','floor_press','band_row'].map(id=>({id,k:0,b:[{s:2,lo:8,hi:10,r:3,rest:120}]}))}))},{training});
 for(const engine of ['chromium','webkit']){const browser=await(engine==='chromium'?chromium:webkit).launch({headless:true,...(engine==='chromium'?{channel:'msedge'}:{})});try{const p=await browser.newPage();p.setDefaultTimeout(8000);await p.route('**/*',r=>['127.0.0.1','localhost'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  for(const prior of [false,true]){
   await seed(p,'delayed',proposal);await p.locator('#coachConfirmSend').click();await p.locator('#coachRecoverRefresh').waitFor();
   const snapshot=await p.evaluate(prior=>{
    if(prior){const r={id:crypto.randomUUID(),owner_id:user.id,name:'SYNTHETIC previous accepted routine'};mock.tables.routines.push(r);mock.tables.workouts.push({id:crypto.randomUUID(),user_id:user.id,data:{routine_id:r.id,unchanged:20}});mock.tables.coach_operations.push({id:crypto.randomUUID(),user_id:user.id,intake_id:crypto.randomUUID(),state:'accepted',routine_id:r.id,created_at:'2026-01-01T00:00:00Z'});}
    return{owner:user.id,tables:structuredClone(mock.tables),op:flow.operation};
   },prior);
   let newInvocations=0;const dispatchName=prior?'reloadDispatchPrior':'reloadDispatchFirst';await p.exposeFunction(dispatchName,()=>{newInvocations++;return{data:null,error:{message:'offline'}};});
   await p.reload();await p.waitForFunction(()=>window.previewReady);
   await p.evaluate(({owner,tables,prior,dispatchName})=>{
    user={id:owner};profile={id:owner,role:'client'};Object.assign(mock.tables,tables);window.reloadReads=[];window.reloadWrites=0;
    const rpc=db.rpc,from=db.from;db.rpc=async(name,args)=>{if(name==='get_my_coach_access'){const r=mock.tables.routines[0];return demoResult({authorized:true,can_generate:true,latest_operation_state:prior?'accepted':null,routine_id:r?.id,accepted_routines:r?[{routine_id:r.id,name:r.name}]:[]});}reloadWrites++;return rpc(name,args);};
    db.from=table=>{const q=from(table),eq=q.eq;q.eq=(k,v)=>{reloadReads.push({table,key:k,value:v});return eq(k,v);};return q;};
    db.functions.invoke=()=>window[dispatchName]();return openSimpleCoach();
   },{...snapshot,prior,dispatchName});
   if(prior)await p.locator('#coachNewGeneration').click();await p.locator('#coachBegin').click();
   // The old candidate returns to consent/questionnaire and can dispatch again.
   if(await p.locator('#coachConsentForm').count()){
    await p.locator('#coachConsentForm button').click();await p.evaluate(t=>{simpleCoach.wizard.data=t;simpleCoach.wizard.step=coachWizardSteps().length-1;coachRenderQuestionnaire();coachWizardReview();},training);await p.locator('#coachConfirmSend').click();await p.waitForFunction(()=>!simpleCoach.busy);
   }
   check(engine+' '+(prior?'existing routine':'first routine')+' reload cannot repeat invocation',newInvocations===0);
   await p.locator('#coachRecoverRefresh').waitFor();
   check(engine+' reload recovery reads exact owner and submitted intake',await p.evaluate(({owner,op})=>reloadReads.some(x=>x.table==='coach_operations'&&x.key==='user_id'&&x.value===owner)&&reloadReads.some(x=>x.table==='coach_operations'&&x.key==='intake_id'&&x.value===op.intake_id),snapshot));
   check(engine+' reload does not save another intake or alter history',await p.evaluate(t=>reloadWrites===0&&JSON.stringify(mock.tables.training_intakes)===JSON.stringify(t.training_intakes)&&JSON.stringify(mock.tables.workouts)===JSON.stringify(t.workouts)&&JSON.stringify(mock.tables.routines)===JSON.stringify(t.routines),snapshot.tables));
   await p.evaluate(op=>mock.tables.coach_operations.push(op),snapshot.op);await p.locator('#coachRecoverRefresh').click();await p.locator('#coachRefresh').waitFor();
   check(engine+' delayed registration is recovered by read only',newInvocations===0&&await p.evaluate(id=>simpleCoach.operation.id===id,snapshot.op.id));
  }
  await seed(p,'delayed',proposal);await p.evaluate(()=>coachSave(false));
  const draft=await p.evaluate(()=>structuredClone(mock.tables));await p.reload();await p.waitForFunction(()=>window.previewReady);
  await p.evaluate(t=>{Object.assign(mock.tables,t);return openSimpleCoach();},draft);await p.locator('#coachBegin').click();
  check(engine+' ordinary saved draft is not treated as uncertain dispatch',await p.locator('#coachConsentForm').count()===1&&await p.locator('#coachRecoverRefresh').count()===0);
  await p.locator('#coachConsentForm button').click();
  check(engine+' draft answers remain editable without invocation',await p.evaluate(t=>!!simpleCoach.wizard&&JSON.stringify(simpleCoach.wizard.data)===JSON.stringify(t)&&mock.tables.coach_operations.length===0,training));
 }finally{await browser.close();}}
 fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'reload-uncertain.json'),JSON.stringify({simulated:true,realJWT:false,paidProviderCalls:0,checks,passed:checks.length,total:checks.length},null,2));console.log(checks.length+'/'+checks.length+' uncertain reload assertions');
 }finally{server.kill();}})().catch(e=>{fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'reload-uncertain-failure.json'),JSON.stringify({simulated:true,error:e.message,checks},null,2));console.error(e.message);process.exitCode=1;});
