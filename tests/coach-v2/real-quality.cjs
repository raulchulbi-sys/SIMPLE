// Authorized synthetic quality runs, staging ONLY. Run exactly one named case per process.
// No automatic retries. This harness must never be used with a real participant.
// Each dispatch is durably budgeted before the Edge call; uncertain outcomes retain $0.15.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const a=require('./live.cjs');
const REF='dmqjexigdnfzobarhnib',MAX_CALLS=10,MAX_USD=0.50,RESERVE_USD=0.15;
const ledgerFile=path.join(a.dir,'openai-budget.json'),lockFile=path.join(a.dir,'openai-budget.lock');
const caseName=process.argv[2],reconcile=process.argv.includes('--reconcile');
const cases={
 quality2:{label:'Principiante · 2 días · 30 min · gimnasio · ejercicio evitado',training:{...a.training,days:2,minutes:30,avoided:'Sentadilla con barra'}},
 quality3:{label:'Principiante · 3 días · casa · preferencia',training:{...a.training,days:3,minutes:60,equipment:['Mancuernas','Bandas'],preferred:'Remo con mancuerna'}},
 quality4:{label:'Intermedio · 4 días · 90 min · gimnasio',training:{...a.training,experience:'intermediate',days:4,minutes:90}},
 quality5:{label:'Avanzado · 5 días · gimnasio',training:{...a.training,experience:'experienced',days:5,minutes:60}},
};
const rounded=n=>Math.round(n*1e10)/1e10;
const total=ledger=>rounded(ledger.calls.reduce((sum,row)=>sum+row.budget_usd,0));
function readLedger(){
 if(!fs.existsSync(ledgerFile))return {version:1,project:REF,max_calls:MAX_CALLS,max_usd:MAX_USD,calls:[],halted:false};
 const ledger=JSON.parse(fs.readFileSync(ledgerFile));
 if(ledger.version!==1||ledger.project!==REF||!Array.isArray(ledger.calls)||ledger.calls.some(row=>!Number.isFinite(row.budget_usd)||row.budget_usd<0))throw Error('Invalid budget ledger; do not replace or reset it');
 return ledger;
}
function saveLedger(ledger){
 ledger.updated_at=new Date().toISOString();ledger.budget_used_usd=total(ledger);
 const tmp=ledgerFile+'.tmp';fs.writeFileSync(tmp,JSON.stringify(ledger,null,2));fs.renameSync(tmp,ledgerFile);
}
function assertion(rows,name,pass){rows.push({name,pass:!!pass});if(!pass)throw Error('Check failed: '+name);}
async function selectedSession(){
 const file=path.join(a.dir,'sessions.json');let sessions=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{};
 if(sessions[caseName]?.expires_at>Date.now()/1000+180)return sessions[caseName].access_token;
 const user=a.c.users[caseName];
 const response=await fetch('https://'+REF+'.supabase.co/auth/v1/token?grant_type=password',{
  method:'POST',headers:{apikey:a.c.key,'Content-Type':'application/json'},body:JSON.stringify({email:user.email,password:user.password}),signal:AbortSignal.timeout(20000),
 });
 const session=await response.json();if(!response.ok||session.user?.id!==user.id)throw Error('Synthetic JWT login failed: HTTP '+response.status);
 sessions[caseName]=session;fs.writeFileSync(file,JSON.stringify(sessions,null,2));return session.access_token;
}
async function run(){
 if(!Object.hasOwn(cases,caseName)||process.argv.slice(3).some(arg=>arg!=='--reconcile'))throw Error('Use quality2 | quality3 | quality4 | quality5, optionally --reconcile (read-only receipt recovery)');
 if(a.c.ref!==REF||!a.c.users[caseName]||!/^coach-v2-[0-9a-f-]+@example\.invalid$/.test(a.c.users[caseName].email)||a.c.users[caseName].role!=='client')throw Error('Synthetic staging identity guard failed');
 const lock=fs.openSync(lockFile,'wx');fs.writeSync(lock,JSON.stringify({case:caseName,process:process.pid,started_at:new Date().toISOString()}));
 let ledger=readLedger(),row=ledger.calls.find(item=>item.case===caseName),result={case:caseName,label:cases[caseName].label,synthetic:true,reconcile,checks:[]};
 const resultFile=path.join(a.out,'real-quality-'+caseName+'.json');
 try{
  const contract=await import('../../supabase/functions/simple-coach-mock/contract.mjs');
  const ctx={training:cases[caseName].training},body=contract.requestBody(ctx,contract.DEFAULT_MODEL);
  assertion(result.checks,'closed training-only context is feasible',contract.safetyGate(ctx)===null&&!Object.hasOwn(JSON.parse(body.input[0].content),'health'));
  // One token per UTF-8 input byte plus 4096 tokens of conservative envelope margin.
  const worstCase=rounded(body.max_output_tokens*15/1000000+(Buffer.byteLength(JSON.stringify(body))+4096)*2.5/1000000);
  assertion(result.checks,'per-dispatch conservative bound fits $0.15 reservation',worstCase<=RESERVE_USD);
  if(!reconcile){
   if(row)throw Error('This case was already dispatched or reserved. Use --reconcile; never retry automatically');
   if(ledger.halted)throw Error('Budget halted by an earlier failure; inspect ledger without issuing another call');
   if(ledger.calls.length>=MAX_CALLS||total(ledger)+RESERVE_USD>MAX_USD+1e-10)throw Error('Authorized call/cost limit would be exceeded');
  }else if(!row)throw Error('No prior reserved dispatch exists for reconciliation');
  const jwt=await selectedSession();
  const request=async(route,data)=>{
   const response=await fetch('https://'+REF+'.supabase.co'+route,{method:data===undefined?'GET':'POST',headers:{apikey:a.c.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},...(data===undefined?{}:{body:JSON.stringify(data)}),signal:AbortSignal.timeout(20000)});
   let value;try{value=await response.json();}catch{value=null;}return {ok:response.ok,status:response.status,data:value};
  };
  if(!reconcile){
   const access=await request('/rest/v1/rpc/get_my_coach_access',{});
   assertion(result.checks,'synthetic pilot enabled and generation not consumed',access.ok&&access.data.authorized===true&&access.data.generation_consumed===false);
   const prior=await request('/rest/v1/coach_operations?select=id,state');
   assertion(result.checks,'no operation pre-created for the quality participant',prior.ok&&Array.isArray(prior.data)&&prior.data.length===0);
   const grant=await request('/rest/v1/rpc/set_my_coach_context_permission',{p_scope:'training_intake',p_allow:true});
   assertion(result.checks,'A-only v2 consent recorded',grant.ok);
   const intake=await request('/rest/v1/rpc/save_my_training_intake',{p_id:null,p_expected:null,p_training:ctx.training,p_health:null,p_submit:true});
   assertion(result.checks,'structured intake submitted',intake.ok&&intake.data.state==='submitted');
   assertion(result.checks,'stored intake matches the selected synthetic inputs',JSON.stringify(contract.trainingContext({training:intake.data.training}))===JSON.stringify(contract.trainingContext(ctx)));
   row={case:caseName,reserved_at:new Date().toISOString(),model:contract.DEFAULT_MODEL,prompt_version:contract.PROMPT_VERSION,
    intake_id:intake.data.id,idempotency_key:crypto.randomUUID(),budget_usd:RESERVE_USD,confirmed_cost_usd:null,
    state:'dispatch_reserved',provider_dispatches_max:1,estimated_upper_bound_usd:worstCase};
   ledger.calls.push(row);saveLedger(ledger); // Durable reservation BEFORE the only Edge request.
   let edgeResponse;
   try{
    edgeResponse=await fetch('https://'+REF+'.supabase.co/functions/v1/simple-coach-mock',{
     method:'POST',headers:{apikey:a.c.key,Authorization:'Bearer '+jwt,'Content-Type':'application/json'},
     body:JSON.stringify({intake_id:row.intake_id,key:row.idempotency_key}),signal:AbortSignal.timeout(110000),
    });
    row.edge_http_status=edgeResponse.status;
    let value;try{value=await edgeResponse.json();}catch{value=null;}
    row.operation_id=typeof value?.operation?.id==='string'?value.operation.id:null;
    row.edge_error=typeof value?.error==='string'&&/^[a-z_]+$/.test(value.error)?value.error:null;
    row.state='edge_returned';
    if(edgeResponse.status===429){ledger.halted=true;ledger.halt_reason='HTTP 429; no automatic or next-case retry';}
   }catch{
    row.state='edge_transport_uncertain';ledger.halted=true;ledger.halt_reason='Uncertain Edge outcome; receipt reconciliation required';
   }
   saveLedger(ledger);
  }
  // Read-only receipt recovery: safe even after an uncertain network outcome, never repeats Edge.
  const receiptResult=await request('/rest/v1/coach_operations?select=*&intake_id=eq.'+encodeURIComponent(row.intake_id));
  assertion(result.checks,'one persistent operation after a single dispatch',receiptResult.ok&&receiptResult.data.length===1);
  const operation=receiptResult.data[0],attempts=operation.provider_attempts;
  row.operation_id=operation.id;row.operation_state=operation.state;row.operation_error=operation.error_code;
  if(Array.isArray(attempts)){
   row.provider_statuses=attempts.map(attempt=>attempt.status);
   row.provider_attempts=attempts.length;
   if(attempts.some(attempt=>attempt.status===429)){ledger.halted=true;ledger.halt_reason='OpenAI 429; no next case or automatic retry';}
   if(attempts.length>1){ledger.halted=true;ledger.halt_reason='Unexpected multiple provider attempts';}
   const cost=Number(operation.estimated_cost),usageConfirmed=operation.estimated_cost!==null&&Number.isFinite(cost)&&cost>=0&&
    Number.isSafeInteger(operation.input_tokens)&&operation.input_tokens>=0&&Number.isSafeInteger(operation.output_tokens)&&operation.output_tokens>=0&&
    attempts.length===1&&attempts.every(attempt=>Number.isSafeInteger(attempt.input_tokens)&&Number.isSafeInteger(attempt.output_tokens)&&attempt.input_tokens>=0&&attempt.output_tokens>=0);
   if(usageConfirmed){row.confirmed_cost_usd=cost;row.budget_usd=cost;row.state='receipt_confirmed';}
  }
  if(total(ledger)>MAX_USD+1e-10){ledger.halted=true;ledger.halt_reason='Confirmed total exceeded approved budget; do not issue any more calls';}
  saveLedger(ledger);
  result.edge_http_status=row.edge_http_status;result.state=operation.state;result.error_code=operation.error_code;
  result.model=operation.model_name;result.prompt_version=operation.prompt_version;result.input_tokens=operation.input_tokens;
  result.output_tokens=operation.output_tokens;result.estimated_cost_usd=operation.estimated_cost;result.latency_ms=operation.latency_ms;
  result.provider_statuses=row.provider_statuses||[];result.budget_used_usd=total(ledger);result.calls_reserved=ledger.calls.length;
  result.training=ctx.training;result.proposal=operation.proposal;
  // The receipt stays private for forensic comparison; no JWT/email is copied to results.
  a.write('real-quality-'+caseName+'-operation.json',operation);
  assertion(result.checks,'only one actual provider HTTP attempt',Array.isArray(attempts)&&attempts.length===1);
  assertion(result.checks,'unchanged GPT-5.4 model and prompt',operation.model_name===contract.DEFAULT_MODEL&&operation.prompt_version===contract.PROMPT_VERSION);
  assertion(result.checks,'actual usage and cost known',row.confirmed_cost_usd!==null&&operation.input_tokens>0&&operation.output_tokens>0);
  assertion(result.checks,'real proposal remains pending human review',operation.state==='pending_review'&&!!operation.proposal);
  const quality=contract.reviewProposal(operation.proposal,ctx);result.quality=quality;
  assertion(result.checks,'actual model output passes unchanged schema and quality rubric',quality.ok);
  const again=await request('/rest/v1/coach_operations?select=id,state&id=eq.'+encodeURIComponent(operation.id));
  assertion(result.checks,'subsequent read preserves same operation and pending state',again.ok&&again.data.length===1&&again.data[0].id===operation.id&&again.data[0].state==='pending_review');
  const managed=await request('/rest/v1/routine_management?select=routine_id');
  assertion(result.checks,'generation creates no accepted routine structure',managed.ok&&managed.data.length===0);
  result.passed=true;
 }catch(error){
  result.passed=false;result.failure=String(error.message||'Quality harness failure').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[redacted]');
  if(row){result.state=row.operation_state||row.state;result.error_code=row.operation_error||row.edge_error||null;result.budget_used_usd=total(ledger);result.calls_reserved=ledger.calls.length;}
  process.exitCode=1;
 }finally{
  fs.writeFileSync(resultFile,JSON.stringify(result,null,2));
  fs.closeSync(lock);fs.unlinkSync(lockFile);
  console.log(JSON.stringify({case:caseName,passed:result.passed,checks:result.checks.length,state:result.state,error_code:result.error_code,
   cost_usd:result.estimated_cost_usd??null,budget_used_usd:result.budget_used_usd??total(ledger),calls_reserved:ledger.calls.length,failure:result.failure||null}));
 }
}
if(require.main===module)run().catch(error=>{console.error(error.code==='EEXIST'?'Another quality process holds the budget lock; do not run concurrently':String(error.message||'Quality setup failed'));process.exitCode=1;});
module.exports={cases,MAX_CALLS,MAX_USD,RESERVE_USD};
