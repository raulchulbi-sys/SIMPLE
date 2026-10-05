// Diagnostic regression tests: every Auth/RPC/provider transport is intercepted locally.
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm'),{pathToFileURL}=require('url');
const root=path.resolve(__dirname,'../..'),rows=[],copy=v=>structuredClone(v),sentinel='HIDDEN_OUTPUT_SENTINEL';
const check=(name,condition)=>{rows.push({name,pass:!!condition});assert(condition,name);};
async function main(){
 const C=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-chat/chat-contract.mjs'))),S=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-premium/series-contract.mjs')));
 const sets=[{set_number:1,reps_min:8,reps_max:12,rir:2,rest_seconds:180},{set_number:2,reps_min:8,reps_max:12,rir:2,rest_seconds:180}];
 const ctx={schema_version:C.CONTEXT_VERSION,training:{schema_version:'premium-provider-v2',intake:{experience:'gt4',goal:'balanced'},routine:{days:[{ref:'day_1',order:0}],exercises:[{ref:'exercise_1',day_ref:'day_1',catalogue_id:'db_curl',prescription:{sets:2,reps:'8-12',rir:'2',rest_seconds:180},planned_sets:sets,prescription_format:'canonical_individual_sets',metrics:{trend:'stable_comparable',exposures:3,recorded_sets:6},exposures:[]}]},allowed_replacements:[]},mesocycle:{number:1,week:3,current_revision:1},checkin_missing:true,checkin:null,week_schedule:[],recent_decisions:[],last_messages:[],summary:{topics:[],explained_decisions:[],open_questions:[],references:[]},evidence:[{id:'intake',value:{source:'training.intake'}},{id:'exercise_1.prescription',value:{source:'training.routine.exercises'}},{id:'exercise_1.metric',value:{source:'training.routine.exercises'}}],message:'Explica mi objetivo de RIR.'};
 const output={schema_version:C.SCHEMA_VERSION,answer:'El RIR 2 indica terminar con unas dos repeticiones posibles antes del límite técnico. Cada serie conserva su propio objetivo.',facts_used:['exercise_1.prescription'],suggested_action:'none',recommendation_candidate:null};
 const inherited=copy(ctx);inherited.training.baseline_origin='inherited_basic';inherited.training.history_origin='shared_existing_training';
 check('Chat inherited Basic provenance remains closed and valid',C.contextQuality(inherited).ok&&C.semantic(output,inherited).ok&&C.PROMPT.includes('no creada por Premium'));
 check('Chat unknown provenance rejected without weakening legacy context',!C.contextQuality({...inherited,training:{...inherited.training,baseline_origin:'arbitrary'}}).ok&&C.contextQuality(ctx).ok);
 const W=await import(pathToFileURL(path.join(root,'supabase/functions/simple-coach-premium/weekly-contract.mjs'))),weekly={...copy(inherited.training),schema_version:W.PROVIDER_VERSION,checkin_missing:true,checkin:null,recent_weeks:[],week_schedule:[],week_schedule_source:'mesocycle_plan'};
 check('Weekly inherited Basic and existing owned routine provenance valid',W.contextQuality(weekly).ok&&W.contextQuality({...weekly,baseline_origin:'existing_owned_routine'}).ok);
 check('Weekly arbitrary baseline or history provenance rejected',!W.contextQuality({...weekly,baseline_origin:'arbitrary'}).ok&&!W.contextQuality({...weekly,history_origin:'arbitrary'}).ok);
 const candidate={schema_version:S.SCHEMA_VERSION,kind:'MODIFY',facts:[{exercise_ref:'exercise_1',claim:'stable_comparable'}],changes:[{action:'remove_set',exercise_ref:'exercise_1',set_number:2,from:S.prescription(sets[1])}],reason:'Petición concreta de retirar únicamente la última serie para revisión y aceptación.',interpretation:'Rendimiento comparable estable; la petición no demuestra por sí misma un problema de programación.',confidence:'medium'};
 const envelope=(value=output)=>({status:'completed',usage:{input_tokens:100,output_tokens:60,input_tokens_details:{cached_tokens:20}},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
 const response=(body,status=200)=>async()=>new Response(typeof body==='string'?body:JSON.stringify(body),{status});
 const analyze=fetcher=>C.analyze(ctx,'LOCAL_TEST_NOT_A_CREDENTIAL',fetcher);
 const closed=r=>C.FAILURE_CATEGORIES.includes(r.receipt.failure_category)&&C.SCHEMA_ERRORS.includes(r.receipt.schema_error)&&(r.receipt.schema_path===null||C.SCHEMA_PATHS.includes(r.receipt.schema_path))&&(r.receipt.schema_index===null||Number.isInteger(r.receipt.schema_index)&&r.receipt.schema_index>=0&&r.receipt.schema_index<=7)&&!JSON.stringify(r.receipt).includes(sentinel);
 const success=await analyze(response(envelope()));check('successful trace fixed model versions UTC timestamp',success.receipt.model==='gpt-5.4-2026-03-05'&&success.receipt.prompt_version===C.PROMPT_VERSION&&success.receipt.provider_context_version===C.CONTEXT_VERSION&&success.receipt.response_schema_version===C.SCHEMA_VERSION&&/^\d{4}-\d\d-\d\dT.*Z$/.test(success.receipt.timestamp));
 check('success keeps known usage and exact cost',success.receipt.status===200&&success.receipt.input_tokens===100&&success.receipt.output_tokens===60&&success.receipt.cached_input_tokens===20&&Math.abs(success.receipt.cost_usd-.001105)<1e-10);
 check('safe validated response gets fingerprint only after success',success.output&&success.receipt.failure_category==='none'&&/^[a-f0-9]{64}$/.test(success.receipt.response_fingerprint)&&closed(success));
 check('canonical fingerprint independent of property order',await C.safeFingerprint(Object.fromEntries(Object.entries(output).reverse()),ctx)===success.receipt.response_fingerprint);
 const failures=[
  ['HTTP429',response(sentinel,429),'rate_limit','protocol',429],['HTTP500',response(sentinel,500),'http','protocol',500],
  ['network rejection',async()=>{throw Error(sentinel);},'transport_network','transport',0],
  ['timeout rejection',async()=>{throw new DOMException(sentinel,'TimeoutError');},'transport_timeout','transport',0],
  ['provider nonJSON envelope',response(sentinel),'protocol','json',200],['provider null envelope',response('null'),'protocol','protocol',200],
  ['provider oversized envelope',response('x'.repeat(100001)),'size','protocol',200],
  ['provider incomplete with usage',response({...envelope(),status:'incomplete'}),'incomplete','incomplete',200],
  ['provider refusal',response({...envelope(),output:[{type:'message',content:[{type:'refusal',refusal:sentinel}]}]}),'refusal','refusal',200],
  ['provider malformed content',response({...envelope(),output:[{type:'message',content:sentinel}]}),'protocol','protocol',200],
  ['provider reasoning only',response({...envelope(),output:[{type:'reasoning',summary:[{text:sentinel}]}]}),'protocol','protocol',200],
  ['output nonJSON',response({...envelope(),output:[{type:'message',content:[{type:'output_text',text:sentinel}]}]}),'json','json',200],
  ['schema extra unknown key',response(envelope({...output,[sentinel]:'unknown'})),'schema','object_keys',200],
  ['scope medical answer',response(envelope({...output,answer:'Tengo dolor y necesito tratamiento.'})),'scope','unsafe',200],
  ['scope email answer',response(envelope({...output,answer:'Escribe a test@example.invalid.'})),'scope','unsafe',200],
  ['evidence unknown value',response(envelope({...output,facts_used:[sentinel]})),'evidence','unsupported_evidence',200],
  ['candidate action mismatch',response(envelope({...output,recommendation_candidate:candidate})),'candidate','action_mismatch',200],
  ['candidate unsupported metrics',response(envelope({...output,suggested_action:'propose_recommendation',recommendation_candidate:{...candidate,facts:[{exercise_ref:'exercise_1',claim:'reps_increasing_comparable'}]}})),'candidate','candidate',200]
 ];
 for(const[name,fetcher,category,error,status]of failures){let calls=0;const r=await analyze(async(...args)=>{calls++;return fetcher(...args);});check(name+' closed failure without output/hash/retry',!r.output&&!!r.error&&r.receipt.failure_category===category&&r.receipt.schema_error===error&&r.receipt.status===status&&r.receipt.response_fingerprint===null&&calls===1&&closed(r));if(name==='provider incomplete with usage')check('failure retains available token cost receipt',r.receipt.input_tokens===100&&r.receipt.cost_usd>0);}
 const noKey=await C.analyze(ctx,'',async()=>{throw Error('must not run');});check('configuration traced before dispatch',noKey.error==='configuration_error'&&noKey.receipt.failure_category==='configuration'&&noKey.receipt.response_fingerprint===null);
 const invalidCtx=await C.analyze({...ctx,message:'Tengo una lesión.'},'LOCAL_TEST_NOT_A_CREDENTIAL',async()=>{throw Error('must not run');});check('invalid context traced before dispatch',invalidCtx.error==='invalid_chat_context'&&invalidCtx.receipt.failure_category==='context'&&closed(invalidCtx));
 const missing=copy(output);delete missing.answer;check('missing trusted field path precise without value',JSON.stringify(C.schemaDiagnostic(missing))===JSON.stringify({path:'$.answer',index:null,error:'required'}));
 const wrongFact=C.schemaDiagnostic({...output,facts_used:['intake',{}]});check('array path plus bounded index safe',wrongFact.path==='$.facts_used[]'&&wrongFact.index===1&&wrongFact.error==='type');
 const wrongFrom=C.schemaDiagnostic({...output,suggested_action:'propose_recommendation',recommendation_candidate:{...candidate,changes:[{...candidate.changes[0],from:{...candidate.changes[0].from,rir:9}}]}});check('candidate per-set schema diagnosis precise',wrongFrom.path==='$.recommendation_candidate.changes[].from.rir'&&wrongFrom.index===0&&wrongFrom.error==='number_range');
 check('unknown output keys never become diagnostic paths',!JSON.stringify(C.schemaDiagnostic({...output,[sentinel]:'private'})).includes(sentinel));
 check('rejected sensitive output never hashed',await C.safeFingerprint({...output,answer:'Mi peso es 82 kg.'},ctx)===null);
 check('unsafe candidate text never hashed even if Series would pass',await C.safeFingerprint({...output,suggested_action:'propose_recommendation',recommendation_candidate:{...candidate,reason:'Contacta a test@example.invalid.'}},ctx)===null);
 check('unknown extra reasoning never hashed',await C.safeFingerprint({...output,reasoning:sentinel},ctx)===null);
 // Real gateway source, only TypeScript annotations removed; no external transport.
 let handler,lastFinish,dispatches=0,prepares=0,preparedContext=ctx;
 const id='00000000-0000-4000-8000-000000000001',turn={id,state:'reserved'},fetcher=async(url,init)=>{
  if(url.endsWith('/auth/v1/user'))return new Response(JSON.stringify({id}));
  if(url.includes('/rpc/')){const name=url.split('/').at(-1),b=JSON.parse(init.body);if(name==='premium_chat_reserve')return new Response(JSON.stringify(turn));if(name==='premium_chat_claim'){if(b.p_mode==='prepare'){prepares++;return new Response(JSON.stringify({prepared:true,provider:preparedContext,output_tokens:1000}));}return new Response(JSON.stringify({claimed:true,provider:preparedContext,output_tokens:1000}));}if(name==='premium_chat_finish'){lastFinish=b;return new Response(JSON.stringify({...turn,state:'failed',error:b.p_error}));}throw Error('Unexpected intercepted RPC');}
  assert.equal(url,'https://api.openai.com/v1/responses');dispatches++;return new Response(sentinel,{status:500});
 };
 let source=fs.readFileSync(path.join(root,'supabase/functions/simple-coach-chat/index.ts'),'utf8').replace(/^import .*;\s*/,'').replace(/:(Request|string|unknown|any)\b/g,'').replace(/\)!(?=[;,])/g,')');
 vm.runInNewContext(source,{Chat:C,Deno:{env:{get:n=>({SUPABASE_URL:'https://dmqjexigdnfzobarhnib.supabase.co',SUPABASE_ANON_KEY:'PUBLIC_TEST',SUPABASE_SERVICE_ROLE_KEY:'SERVER_TEST',OPENAI_API_KEY:'LOCAL_TEST_NOT_A_CREDENTIAL'})[n]},serve:h=>handler=h},fetch:fetcher,Request,Response,AbortSignal,TextEncoder,TextDecoder,Set,Error,JSON},{filename:'actual-chat-telemetry-gateway'});
 const body={key:id,mesocycle_id:id,revision_id:id,message:ctx.message},request=new Request('https://dmqjexigdnfzobarhnib.supabase.co/functions/v1/simple-coach-chat',{method:'POST',headers:{authorization:'Bearer LOCAL_TEST',origin:'http://127.0.0.1:4245'},body:JSON.stringify(body)});
 const reply=await handler(request),publicBody=await reply.json();check('actual gateway sends trace only to service finish',dispatches===1&&prepares===1&&lastFinish.p_receipt.failure_category==='http'&&lastFinish.p_receipt.provider_context_version===C.CONTEXT_VERSION&&lastFinish.p_receipt.response_fingerprint===null);
 check('gateway public error excludes private diagnostics/body',!JSON.stringify(publicBody).includes('failure_category')&&!JSON.stringify(publicBody).includes(sentinel));
 preparedContext={...ctx,user_id:id};const before=dispatches,blocked=await handler(new Request('https://dmqjexigdnfzobarhnib.supabase.co/functions/v1/simple-coach-chat',{method:'POST',headers:{authorization:'Bearer LOCAL_TEST',origin:'http://127.0.0.1:4251'},body:JSON.stringify(body)}));
 check('unified local preview allowed while invalid context prevents provider',blocked.status===200&&dispatches===before&&lastFinish.p_error==='invalid_chat_context'&&lastFinish.p_receipt.failure_category==='context');
 check('preprovider context failure has complete bounded trace',lastFinish.p_receipt.status===0&&lastFinish.p_receipt.schema_error==='context'&&lastFinish.p_receipt.schema_path===null&&lastFinish.p_receipt.schema_index===null&&lastFinish.p_receipt.response_fingerprint===null&&lastFinish.p_receipt.provider_context_version===C.CONTEXT_VERSION);
 fs.mkdirSync(path.join(__dirname,'results'),{recursive:true});fs.writeFileSync(path.join(__dirname,'results/telemetry.json'),JSON.stringify({rows,total:rows.length,passed:rows.filter(r=>r.pass).length,completed:true,provider_transport:'intercepted'},null,2));console.log(rows.length+'/'+rows.length+' telemetry checks; all transport intercepted');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
