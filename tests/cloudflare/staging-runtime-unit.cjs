'use strict';
// Offline transport contract: the fixture follows the app's share/redeem RPCs.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module');
const REF='dmqjexigdnfzobarhnib',REVIEWER='6b47ae02-6574-46db-acdb-f00925efdd74';
const IDs={trainer:'11111111-1111-4111-8111-111111111111',client:'22222222-2222-4222-8222-222222222222',routine:'33333333-3333-4333-8333-333333333333',day:'44444444-4444-4444-8444-444444444444',exercise:'55555555-5555-4555-8555-555555555555',assignment:'66666666-6666-4666-8666-666666666666'};
function setup({redeemFails=false,wrongMaxUses=false,wrongForbiddenContract=false,logoutStatus=204,logoutCode=null}={}){
 const file=path.join(__dirname,'staging-runtime.cjs'),localRequire=createRequire(file),calls=[],browserCalls=[];let expiry,decode;
 const module={exports:{}},unitReviewer={ref:REF,users:{reviewer:{id:REVIEWER,email:'reviewer-unit@example.invalid',password:'unit-memory-only'}}};
 const accountEmail=slot=>'simple-qa-cloudflare_hosting_20261014-'+slot+'@example.com';
 const readFileSync=(name,...args)=>name==='RAM_REVIEWER'?JSON.stringify(unitReviewer):fs.readFileSync(name,...args);
 async function fetch(url,options){const route=new URL(url).pathname,body=options.body?JSON.parse(options.body):null;
  const token=options.headers.Authorization?.slice('Bearer '.length),actor=token?JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub:null;
  calls.push({route,method:options.method,actor,...(route==='/rest/v1/rpc/create_routine_share_code'?{maxUses:body.p_max_uses,expiresAt:body.p_expires_at,routine:body.p_routine_id}:{})});
  let data,status=200;
  if(route==='/auth/v1/token'){
   const id=body.email===unitReviewer.users.reviewer.email?REVIEWER:body.email===accountEmail('trainer')?IDs.trainer:IDs.client;
   const exp=Math.floor(Date.now()/1000)+3600,payload=Buffer.from(JSON.stringify({sub:id,role:'authenticated',iss:'https://'+REF+'.supabase.co/auth/v1',exp})).toString('base64url');
   data={user:{id},access_token:'eyJhbGciOiJIUzI1NiJ9.'+payload+'.unit',refresh_token:'unit-memory-only',expires_at:exp};
  }else if(route==='/auth/v1/logout'){status=logoutStatus;data=logoutCode?{error_code:logoutCode}:null;}
  else if(route==='/functions/v1/simple-cloudflare-hosting-qa')data=body.action==='cleanup'?{deleted:body.ids}:{id:IDs[body.slot],slot:body.slot,email:accountEmail(body.slot),password:'unit-memory-only'};
  else if(route==='/rest/v1/rpc/create_routine_atomic')data=IDs.routine;
  else if(route==='/rest/v1/routine_days')data=[{id:IDs.day,routine_id:IDs.routine}];
  else if(route==='/rest/v1/routine_exercises')data=[{id:IDs.exercise,day_id:IDs.day}];
  else if(route==='/rest/v1/rpc/create_routine_share_code'){expiry=body.p_expires_at;data=[{code:'SMP-A1B2C3',max_uses:wrongMaxUses?2:1,expires_at:expiry}];}
  else if(route==='/rest/v1/rpc/redeem_routine_share_code'){data=redeemFails?{code:'P0001'}:IDs.assignment;status=redeemFails?400:200;}
  else if(route==='/rest/v1/routine_assignments'&&options.method==='GET')data=[{id:IDs.assignment,trainer_id:IDs.trainer,client_id:IDs.client,trainer_routine_id:IDs.routine,client_routine_id:null}];
  else if(route==='/rest/v1/routines')data=[{id:IDs.routine,owner_id:IDs.trainer}];
  else if(route==='/rest/v1/rpc/get_client_routine_structure')data={days:[{id:IDs.day,exercises:[{id:IDs.exercise}]}]};
  else if(route==='/rest/v1/workouts'&&options.method==='GET')data=[];
  else if(route==='/rest/v1/workouts'&&options.method==='POST'){
   assert.equal(actor,IDs.client);assert.equal(body.user_id,IDs.trainer);status=wrongForbiddenContract?403:400;
   data=wrongForbiddenContract?{code:'42501',message:'RLS-only'}:{code:'P0001',message:'workout_context_not_authorized'};
  }
  else{status=403;data={code:'42501'};}
  return{ok:status>=200&&status<300,status,json:async()=>decode(JSON.stringify(data))};
 }
 const nativeBrowser={run:async input=>{
  browserCalls.push({client:input.accounts.client.id,trainer:input.accounts.trainer.id,hasPasswords:!!input.accounts.client.password&&!!input.accounts.trainer.password,hasReadback:typeof input.readback==='function',hosting:input.hosting,assignment:input.fixture.assignment});
  return {nativeBrowser:true,credentials_persisted:false};
 }};
 const context=vm.createContext({require:name=>name==='node:fs'?{...fs,readFileSync}:name==='./staging-cloudflare-browser.cjs'?nativeBrowser:localRequire(name),module,exports:module.exports,__dirname,Buffer,process,fetch,AbortSignal,Date,console:{log:()=>{},error:()=>{}}});
 vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});decode=vm.runInContext('JSON.parse',context);
 const runtime=module.exports;runtime.init('RAM_REVIEWER');return{runtime,calls,browserCalls};
}
test('seed uses trainer share creation, one-use short expiry, client redemption and assignment read only',async()=>{
 const {runtime,calls}=setup();await runtime.execute({op:'create'});const result=await runtime.execute({op:'seed'});
 assert.equal(result.fixture.assignment,IDs.assignment);
 const share=calls.find(c=>c.route==='/rest/v1/rpc/create_routine_share_code');assert.equal(share.actor,IDs.trainer);assert.equal(share.maxUses,1);assert.equal(share.routine,IDs.routine);
 const remaining=Date.parse(share.expiresAt)-Date.now();assert(remaining>29*60*1000&&remaining<=30*60*1000);
 assert.equal(calls.find(c=>c.route==='/rest/v1/rpc/redeem_routine_share_code').actor,IDs.client);
 const assignmentCalls=calls.filter(c=>c.route==='/rest/v1/routine_assignments');assert.equal(assignmentCalls.length,1);assert.equal(assignmentCalls[0].method,'GET');
 assert.equal(JSON.stringify(result).includes('SMP-A1B2C3'),false,'Share credential must stay in RAM');
});
test('redemption error preserves partial fixture inventory without direct-insert fallback',async()=>{
 const {runtime,calls}=setup({redeemFails:true});await runtime.execute({op:'create'});await assert.rejects(runtime.execute({op:'seed'}),/controlled_api_failed_400/);
 const result=await runtime.execute({op:'inventory'});assert.equal(result.fixture.routine,IDs.routine);assert.equal(result.fixture.assignment,undefined);
 assert.equal(calls.some(c=>c.route==='/rest/v1/routine_assignments'&&c.method==='POST'),false);
});
test('unexpected multi-use response is rejected before client can redeem',async()=>{
 const {runtime,calls}=setup({wrongMaxUses:true});await runtime.execute({op:'create'});await assert.rejects(runtime.execute({op:'seed'}));
 assert.equal(calls.some(c=>c.route==='/rest/v1/rpc/redeem_routine_share_code'),false);
});
test('cross-owner save requires the installed domain guard and preserves own history on reread',async()=>{
 const {runtime,calls}=setup();await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const result=await runtime.execute({op:'api'});
 assert(result.checks.some(c=>c.name==='client_cannot_save_for_trainer'&&c.pass));assert(result.checks.some(c=>c.name==='rejected_cross_owner_attempt_preserves_own_history'&&c.pass));
 assert.equal(calls.filter(c=>c.route==='/rest/v1/workouts'&&c.method==='POST').length,1);assert.equal(calls.filter(c=>c.route==='/rest/v1/workouts'&&c.method==='GET').length,2);
});
test('generic RLS rejection does not silently replace the exact installed domain-guard contract',async()=>{
 const {runtime}=setup({wrongForbiddenContract:true});await runtime.execute({op:'create'});await runtime.execute({op:'seed'});await assert.rejects(runtime.execute({op:'api'}),/controlled_check_failed/);
});
test('cleanup tolerates only exact missing-session 403 after UI global logout',async()=>{
 for(const code of ['session_not_found','session_missing']){const {runtime}=setup({logoutStatus:403,logoutCode:code});await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const result=await runtime.execute({op:'cleanup'});assert.equal(result.deleted.length,2);}
});
test('other logout 403 cannot silently proceed to privileged cleanup',async()=>{
 const {runtime,calls}=setup({logoutStatus:403,logoutCode:'not_admin'});await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const before=calls.filter(c=>c.route==='/functions/v1/simple-cloudflare-hosting-qa').length;
 await assert.rejects(runtime.execute({op:'cleanup'}),/logout_failed/);assert.equal(calls.filter(c=>c.route==='/functions/v1/simple-cloudflare-hosting-qa').length,before);
});
test('explicit native browser operation passes only task actors in RAM with readback and verified public hosting arguments',async()=>{
 const {runtime,calls,browserCalls}=setup();await runtime.execute({op:'create'});await runtime.execute({op:'seed'});const before=calls.length;
 const hosting={projectId:REF,pagesProject:'simple-staging-raulchulbi',stableUrl:'https://simple-staging-raulchulbi.pages.dev/',deploymentUrl:'https://4a8636ab.simple-staging-raulchulbi.pages.dev/'};
 const result=await runtime.execute({op:'browser-cloudflare',hosting});assert.equal(result.nativeBrowser,true);assert.equal(calls.length,before,'Coordinator must not create, seed or call Auth again');
 assert.equal(browserCalls.length,1);assert.equal(browserCalls[0].client,IDs.client);assert.equal(browserCalls[0].trainer,IDs.trainer);assert.equal(browserCalls[0].assignment,IDs.assignment);
 assert.equal(browserCalls[0].hasPasswords,true);assert.equal(browserCalls[0].hasReadback,true);assert.equal(browserCalls[0].hosting,hosting);
 assert.equal(JSON.stringify(result).includes('unit-memory-only'),false);assert.equal((await runtime.execute({op:'inventory'})).accounts.length,2,'Browser op preserves explicit cleanup inventory');
});
test('native browser operation cannot run before normal fixture sharing completes',async()=>{
 const {runtime,browserCalls}=setup();await runtime.execute({op:'create'});await assert.rejects(runtime.execute({op:'browser-cloudflare'}),/fixture_not_seeded/);assert.equal(browserCalls.length,0);
});
test('native browser rejects foreign hosts, backend, reused workout and substituted identity before loading a browser',()=>{
 const {validateInput}=require('./staging-cloudflare-browser.cjs');
 const input={fixture:{...IDs},accounts:Object.fromEntries(['trainer','client'].map(slot=>[slot,{id:IDs[slot],slot,email:'simple-qa-cloudflare_hosting_20261014-'+slot+'@example.com',password:'unit-memory-only'}])),readback:async()=>{},hosting:{projectId:REF,pagesProject:'simple-staging-raulchulbi',stableUrl:'https://simple-staging-raulchulbi.pages.dev/',deploymentUrl:'https://4a8636ab.simple-staging-raulchulbi.pages.dev/'}};
 assert.equal(validateInput(input).projectId,REF);
 for(const hosting of [{...input.hosting,projectId:'yvguatdqncadkwewlepe'},{...input.hosting,stableUrl:'https://foreign.pages.dev/'},{...input.hosting,deploymentUrl:'https://4a8636ab.foreign.pages.dev/'},{...input.hosting,deploymentUrl:'https://a.b.simple-staging-raulchulbi.pages.dev/'},{...input.hosting,deploymentUrl:input.hosting.deploymentUrl+'?access_token=unit'}])assert.throws(()=>validateInput({...input,hosting}));
 assert.throws(()=>validateInput({...input,fixture:{...input.fixture,workout:IDs.assignment}}),/fresh_fixture_required/);
 assert.throws(()=>validateInput({...input,accounts:{...input.accounts,client:{...input.accounts.client,id:IDs.trainer}}}),/synthetic_identity_mismatch/);
 assert.throws(()=>validateInput({...input,accounts:{...input.accounts,client:{...input.accounts.client,email:'other-user@example.com'}}}),/reserved_task_email_required/);
});
test('native request diagnostics omit credentials, query tokens and URL fragments',()=>{
 const {networkEntry}=require('./staging-cloudflare-browser.cjs');
 assert.deepEqual(networkEntry('https://dmqjexigdnfzobarhnib.supabase.co/auth/v1/token?grant_type=password&access_token=do-not-print#refresh_token=do-not-print','POST',200),{origin:'https://'+REF+'.supabase.co',path:'/auth/v1/token',method:'POST',status:200});
});
test('trainer-only resume requires the exact 29 unique prior successes and unchanged owned workout and note',()=>{
 const {validateInput,validateResume,savedSnapshot,PRIOR_CHECKS}=require('./staging-cloudflare-browser.cjs');
 const fixture={...IDs,workout:'77777777-7777-4777-8777-777777777777',note:'88888888-8888-4888-8888-888888888888'};
 const persisted={workouts:[{id:fixture.workout,user_id:fixture.client,data:{routine_id:fixture.routine,routine_day_id:fixture.day,exercises:[{exercise_id:fixture.exercise,sets:[{kg:'10',reps:'8',rir:'3',done:true},{kg:'12',reps:'9',rir:'2',done:true}]}]}}],notes:[{id:fixture.note,user_id:fixture.client,routine_id:fixture.routine,exercise_key:'exercise:'+fixture.exercise,note:'SYNTHETIC Cloudflare note'}]};
 const hosting={projectId:REF,pagesProject:'simple-staging-raulchulbi',stableUrl:'https://simple-staging-raulchulbi.pages.dev/',deploymentUrl:'https://4a8636ab.simple-staging-raulchulbi.pages.dev/',resumeTrainer:true};
 const prior={project:REF,phase:'chromium_trainer_own_client_progress:failed',request_interception:false,local_server:false,passed:29,checks:PRIOR_CHECKS.map(name=>({name,pass:true})),hosting,workout_id:fixture.workout,note_id:fixture.note,workout_data_sha256:savedSnapshot(persisted,fixture).hash,prohibited_requests:[],script_errors:[]};
 const input={fixture,persisted,hosting,prior};assert.equal(validateResume(input).hash,prior.workout_data_sha256);
 for(const changed of [{...prior,phase:'chromium_client_save:failed'},{...prior,checks:prior.checks.map((c,i)=>i===1?prior.checks[0]:c)},{...prior,workout_id:IDs.assignment},{...prior,note_id:IDs.assignment},{...prior,workout_data_sha256:'0'.repeat(64)},{...prior,request_interception:true}])assert.throws(()=>validateResume({...input,prior:changed}));
 const wrongOwner=structuredClone(persisted);wrongOwner.workouts[0].user_id=fixture.trainer;assert.throws(()=>validateResume({...input,persisted:wrongOwner}));
 const accounts=Object.fromEntries(['trainer','client'].map(slot=>[slot,{id:fixture[slot],slot,email:'simple-qa-cloudflare_hosting_20261014-'+slot+'@example.com',password:'unit-memory-only'}]));
 assert.equal(validateInput({fixture,accounts,readback:async()=>persisted,hosting}).resumeTrainer,true);
 assert.throws(()=>validateInput({fixture,accounts,readback:async()=>persisted,hosting:{...hosting,resumeTrainer:false}}),/fresh_fixture_required/);
});
test('only the protected reviewer queue exact domain rejection is expected; other 403s remain failures',()=>{
 const {expectedQueueRejection}=require('./staging-cloudflare-browser.cjs');
 const entry={origin:'https://'+REF+'.supabase.co',path:'/rest/v1/rpc/premium_initial_review_queue',method:'POST',status:403,error_code:'42501',domain_error:'premium_initial_reviewer_required'};assert.equal(expectedQueueRejection(entry),true);
 for(const changed of [{...entry,error_code:undefined},{...entry,domain_error:'coach_reviewer_required'},{...entry,error_code:'P0001'},{...entry,path:'/rest/v1/workouts'},{...entry,status:401},{...entry,method:'GET'}])assert.equal(expectedQueueRejection(changed),false);
});
test('native cancellation classification requires exact error code and successful matching operation',()=>{
 const {failureCode,confirmedCancellation}=require('./staging-cloudflare-browser.cjs');
 const entry={engine:'chromium',actor:'trainer',origin:'https://'+REF+'.supabase.co',path:'/rest/v1/routines',method:'HEAD',code:'net::ERR_ABORTED'},response={...entry,status:200};
 assert.equal(confirmedCancellation(entry,[response]),true);assert.equal(confirmedCancellation(entry,[]),false);assert.equal(confirmedCancellation({...entry,code:'native_request_failed'},[response]),false);assert.equal(confirmedCancellation({...entry,code:'net::ERR_FAILED'},[response]),false);
 assert.equal(confirmedCancellation(entry,[{...response,actor:'client'}]),false);assert.equal(confirmedCancellation({...entry,method:'GET'},[{...response,method:'GET'}]),false);
 assert.equal(failureCode('net::ERR_ABORTED'),'net::ERR_ABORTED');assert.equal(failureCode('net::ERR_FAILED'),'net::ERR_FAILED');assert.equal(failureCode('https://host/?token=secret'),'unclassified_native_failure');
});
test('resume bootstrap reuses the cached coordinator and invalidates only native browser code, with no credential IO',async()=>{
 const file=path.join(__dirname,'staging-cloudflare-resume.cjs'),calls=[],cache={'NATIVE_BROWSER':{},'OTHER_MODULE':{}};
 const requireStub=name=>{assert.equal(name,'./staging-runtime.cjs');return {REF,execute:async command=>{calls.push(command);return {trainerOnly:command.hosting.resumeTrainer};}};};requireStub.resolve=name=>{assert.equal(name,'./staging-cloudflare-browser.cjs');return 'NATIVE_BROWSER';};requireStub.cache=cache;
 // Preserve require.resolve/cache on the VM wrapper as Node provides them.
 const wrapper=name=>name==='node:assert/strict'?assert:requireStub(name);wrapper.resolve=requireStub.resolve;wrapper.cache=cache;
 const second={exports:{}};vm.runInNewContext(fs.readFileSync(file,'utf8'),{module:second,exports:second.exports,require:wrapper});
 await assert.rejects(second.exports.run({fixture:{}}),/existing_saved_fixture_required/);assert.equal(calls.length,0);
 assert.equal((await second.exports.run({fixture:{workout:IDs.routine,note:IDs.exercise}})).trainerOnly,true);assert.equal(calls.length,1);assert.equal(calls[0].op,'browser-cloudflare');assert.equal(cache.NATIVE_BROWSER,undefined);assert(cache.OTHER_MODULE);
 assert.equal(Object.hasOwn(calls[0],'accounts'),false,'Credentials are taken only from the already running coordinator closure');
});
test('trainer progress caption alone cannot release assertions before the async body and chart are visible',async()=>{
 const {waitForTrainerProgress}=require('./staging-cloudflare-browser.cjs');let releaseBody,bodyRequested;const requested=new Promise(resolve=>{bodyRequested=resolve;}),bodyReady=new Promise(resolve=>{releaseBody=resolve;}),seen=[];
 const page={waitForFunction:async()=>{seen.push('caption');},locator:selector=>({waitFor:async options=>{assert.equal(options.state,'visible');seen.push(selector);if(selector==='#clientProgressBody .history-session'){bodyRequested();await bodyReady;}}})};
 let finished=false;const waiting=waitForTrainerProgress(page).then(()=>{finished=true;});await requested;assert.equal(finished,false);assert.equal(seen.includes('#clientProgressChart svg'),false,'The title may already show one session while days are still loading');
 releaseBody();await waiting;assert.equal(finished,true);assert(seen.includes('#clientProgressExercise'));assert(seen.includes('#statisticsStageControls button'));assert(seen.includes('#clientProgressChart svg'));
});
