// Real controlled staging JWT actions; service completions below are explicitly MOCKED.
// This harness can only prepare SQL. Root coordinates every service SQL execution.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict'),{isDeepStrictEqual:equal}=require('util'),{pathToFileURL}=require('url');
const L=require('./live.cjs'),{fixture:f,rpc,table,req,must,file,readJSON,write,save,check,rows,q,j}=L;
const root=path.resolve(__dirname,'../..'),mode=process.argv[2],recSelect='id,mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,review_reason,reviewed_at,accepted_at,result_revision_id,analysis_week,analysis_trace';
const one=async(actor,name,where,select='*')=>(await must(table(actor,name,where,select)))[0];
const meso=()=>one('mock','coach_mesocycles','id=eq.'+f.mesocycle);
const recommendation=id=>one('mock','coach_recommendations','id=eq.'+id,recSelect);
const before=()=>readJSON(file('before-upgrade.json'));
const revision=id=>one('mock','routine_revisions','id=eq.'+id);
const importContract=name=>import(pathToFileURL(path.join(root,'supabase/functions/'+name)));
function provider(name){assert(/^[a-z-]+\.json$/.test(name),'Only private provider projections may be read');const v=readJSON(file(name));return v.provider||v;}
async function invariants(label,{liveUnchanged=false}={}){
 const b=before();
 check(label+' accepted Basic operation immutable',equal(b.operation,await one('mock','coach_operations','id=eq.'+f.basic_operation.id)));
 check(label+' original Basic revision immutable',equal(b.revision,await revision(b.revision.id)));
 check(label+' original nine workouts immutable',equal(b.workouts,await must(table('mock','workouts','id=in.('+b.workouts.map(w=>w.id).join(',')+')&order=id'))));
 check(label+' original personal notes immutable',equal(b.notes,await must(table('mock','routine_user_notes','routine_id=eq.'+f.routine+'&order=id'))));
 check(label+' original day UUIDs/order immutable',equal(b.days,await must(table('mock','routine_days','routine_id=eq.'+f.routine+'&order=id'))));
 if(liveUnchanged)check(label+' all twelve live exercise rows unchanged',equal(b.exercises,await must(table('mock','routine_exercises','id=in.('+b.exercises.map(e=>e.id).join(',')+')&order=id'))));
}
function mockReceipt(contract){return{model:'mock',prompt_version:contract.PROMPT_VERSION,response_schema_version:contract.SCHEMA_VERSION,provider_context_version:contract.CONTEXT_VERSION||contract.PROVIDER_VERSION,timestamp:new Date().toISOString(),status:200,failure_category:'none',schema_path:null,schema_index:null,schema_error:'none',response_fingerprint:null,input_tokens:0,output_tokens:0,cached_input_tokens:0,cost_usd:0,latency_ms:0};}
async function weeklyFinish(kind){
 assert(['KEEP','REVIEW'].includes(kind));const W=await importContract('simple-coach-premium/weekly-contract.mjs'),p=provider(kind==='KEEP'?'analysis-provider.json':'analysis-review-provider.json'),id=kind==='KEEP'?f.analysis:f.review_analysis;
 check(kind+' mock source uses inherited Basic and existing history',p.baseline_origin==='inherited_basic'&&p.history_origin==='shared_existing_training'&&p.routine.exercises.length===12&&W.contextQuality(p).ok);
 const output={schema_version:W.SCHEMA_VERSION,kind,facts:p.routine.exercises.slice(0,4).map(e=>({exercise_ref:e.ref,claim:e.metrics.trend})),interpretation:kind==='KEEP'?'La base heredada de Basic conserva series individuales y registros anteriores. Las observaciones capturadas no exigen cambiar la programación.':'La petición de revisar un ejercicio requiere una decisión humana explícita. Se conservan las series de la base heredada de Basic mientras se aclara la petición.',reason:kind==='KEEP'?'Mantener la programación y registrar nuevas exposiciones comparables antes de modificarla.':'El reviewer debe valorar la petición de revisión; no se propone ningún cambio automático.',confidence:'medium',changes:[],checkin_signals:W.checkinSignals(p)};
 const quality=W.semantic(output,p);check(kind+' mock completion passes real schema and weekly semantics',W.validate(output)&&quality.ok);
 write('analysis-'+kind.toLowerCase()+'-output.json',output);write('analysis-'+kind.toLowerCase()+'-finish.sql',`begin;select public.premium_analysis_claim(${q(f.user)},${q(id)},1,'mock');select public.premium_analysis_finish(${q(f.user)},${q(id)},${j(output)},null,${j(mockReceipt(W))},${j(quality.warnings)});commit;`);
 console.log('Prepared explicit MOCK '+kind+' completion; no provider call');
}
async function weeklyAccept(kind){
 const id=kind==='KEEP'?f.analysis:f.review_analysis,m=await meso(),r=await recommendation(id);check(kind+' actual owner reads persisted pending review',r?.kind===kind&&r.state==='pending_review'&&r.base_revision_id===f.revision&&r.analysis_week===m.tracking_week);
 check(kind+' owner cannot accept before reviewer',!(await rpc('mock','premium_accept_recommendation',{p_id:id})).ok);
 check(kind+' unrelated athlete cannot accept',!(await rpc('real','premium_accept_recommendation',{p_id:id})).ok);
 check(kind+' owner cannot self-approve',!(await rpc('mock','premium_review_recommendation',{p_id:id,p_approve:true,p_reason:'SYNTHETIC unauthorized athlete approval'})).ok);
 check(kind+' normal trainer cannot approve',!(await rpc('trainer','premium_review_recommendation',{p_id:id,p_approve:true,p_reason:'SYNTHETIC unauthorized trainer approval'})).ok);
 const rv=await one('reviewer','coach_recommendations','id=eq.'+id,recSelect);check(kind+' explicitly assigned reviewer sees correct proposal',rv?.id===id&&rv.state==='pending_review');
 if(kind==='REVIEW'){
  const no=await rpc('reviewer','premium_review_recommendation',{p_id:id,p_approve:true,p_reason:'SYNTHETIC blind REVIEW approval'});check('REVIEW cannot be approved without explicit resolution',!no.ok&&no.data?.message==='premium_manual_resolution_required');
  check('REVIEW owner cannot resolve',!(await rpc('mock','premium_resolve_review',{p_id:id,p_kind:'KEEP',p_patches:[],p_reason:'SYNTHETIC unauthorized owner resolution'})).ok);
  check('REVIEW normal trainer cannot resolve',!(await rpc('trainer','premium_resolve_review',{p_id:id,p_kind:'KEEP',p_patches:[],p_reason:'SYNTHETIC unauthorized trainer resolution'})).ok);
  await must(rpc('reviewer','premium_resolve_review',{p_id:id,p_kind:'KEEP',p_patches:[],p_reason:'SYNTHETIC explicit human decision: keep the inherited Basic programming until more comparable observations.'}));
 }else await must(rpc('reviewer','premium_review_recommendation',{p_id:id,p_approve:true,p_reason:'SYNTHETIC reviewer confirms KEEP for inherited Basic programming.'}));
 const ready=await recommendation(id);check(kind+' reviewer leaves explicit ready state',ready.state==='ready'&&ready.kind==='KEEP'&&!!ready.reviewed_at&&!!ready.review_reason&&ready.patches.length===0);
 if(kind==='REVIEW')check('REVIEW keeps original model evidence and records human resolution',ready.analysis_trace.manual_resolution==='KEEP'&&ready.analysis_trace.output?.kind==='REVIEW');
 const pair=await Promise.all([rpc('mock','premium_accept_recommendation',{p_id:id}),rpc('mock','premium_accept_recommendation',{p_id:id})]);check(kind+' double acceptance retains original revision',pair.every(r=>r.ok&&r.data===f.revision));
 const after=await meso();check(kind+' weekly acceptance advances exactly one week',after.tracking_week===m.tracking_week+1&&after.current_revision_id===f.revision);
 const accepted=await recommendation(id);check(kind+' accepted state is persisted',accepted.state==='accepted'&&accepted.result_revision_id===f.revision);
 await invariants(kind,{liveUnchanged:true});
}
async function reviewReserve(){
 const m=await meso();assert(m.current_revision_id===f.revision&&m.tracking_week>1);
 const e=f.exercises.find(e=>e.day_id===f.days[0]&&e.exercise_order===0),answers={...L.weekly,review:{topic:'exercise',exercise_id:e.id}};
 const ci=await must(rpc('mock','premium_save_weekly_checkin',{p_mesocycle:f.mesocycle,p_week:m.tracking_week,p_revision:f.revision,p_expected:0,p_answers:answers,p_submit:true}));
 check('Separate REVIEW captures current week and explicit exercise request',ci.week_number===m.tracking_week&&!!ci.submitted_at);f.review_checkin=ci.id;
 const key=f.keys.review_analysis=crypto.randomUUID();save();const args={p_mesocycle:f.mesocycle,p_key:key},pair=await Promise.all([rpc('mock','premium_weekly_reserve_analysis',args),rpc('mock','premium_weekly_reserve_analysis',args)]);
 check('Separate REVIEW double submit one recommendation',pair.every(r=>r.ok)&&pair[0].data.id===pair[1].data.id);f.review_analysis=pair[0].data.id;f.recommendations.push(f.review_analysis);save();
 write('analysis-review-prepare.sql',`select analysis_bundle->'provider' as provider from public.coach_recommendations where id=${q(f.review_analysis)} and user_id=${q(f.user)} and state='analyzing' and provider_state='reserved';`);
}
async function chatFinish(){
 const C=await importContract('simple-coach-chat/chat-contract.mjs'),S=await importContract('simple-coach-premium/series-contract.mjs'),p=provider('chat-provider.json');
 check('Chat captures inherited Basic in active twelve-exercise context',C.contextQuality(p).ok&&p.training.baseline_origin==='inherited_basic'&&p.training.history_origin==='shared_existing_training'&&p.training.routine.exercises.length===12&&p.message===f.chat_message);
 const e=p.training.routine.exercises.find(e=>e.ref==='exercise_1');assert(e?.catalogue_id==='goblet'&&e.planned_sets.length===3,'Controlled target is Monday goblet third set');
 const output={schema_version:C.SCHEMA_VERSION,answer:'La programación actual procede de Basic. Se propone retirar únicamente la tercera serie de sentadilla goblet del lunes; las otras series conservan sus objetivos. Requiere revisión y tu aceptación antes de aplicarse.',facts_used:['exercise_1.prescription','exercise_1.metric'],suggested_action:'propose_recommendation',recommendation_candidate:{schema_version:S.SCHEMA_VERSION,kind:'MODIFY',facts:[{exercise_ref:e.ref,claim:e.metrics.trend}],interpretation:'Propuesta controlada a partir de la petición explícita de retirar una serie de la base Basic, con las observaciones capturadas.',reason:'Retirar solo la última serie del lunes y conservar los demás ejercicios y sus series.',confidence:'medium',changes:[{action:'remove_set',exercise_ref:e.ref,set_number:3,from:S.prescription(e.planned_sets[2])}]}};
 const quality=C.semantic(output,p);check('Chat MOCK candidate passes existing per-set pipeline',C.validate(output)&&quality.ok);write('chat-candidate-output.json',output);
 write('chat-candidate-finish.sql',`begin;select public.premium_chat_claim(${q(f.user)},${q(f.turn)},1,'mock');select public.premium_chat_finish(${q(f.user)},${q(f.turn)},${j(output)},null,${j(mockReceipt(C))},${j(quality.warnings)});commit;`);
 console.log('Prepared explicit MOCK Chat candidate; no provider call');
}
async function chatAccept(){
 const loaded=await must(rpc('mock','premium_chat_load',{p_mesocycle:f.mesocycle})),t=loaded.messages.find(t=>t.id===f.turn),m=await meso();
 check('Chat persisted completion links existing recommendation',t?.state==='completed'&&t.error===null&&!!t.recommendation_id);f.chat_recommendation=t.recommendation_id;f.recommendations.push(t.recommendation_id);save();
 const r=await recommendation(t.recommendation_id);check('Chat candidate persisted as pending review at N',r.state==='pending_review'&&r.kind==='MODIFY'&&r.base_revision_id===f.revision&&r.analysis_week===null&&r.analysis_trace.origin==='premium_chat');
 await invariants('Chat before approval',{liveUnchanged:true});
 check('Chat athlete cannot accept before reviewer',!(await rpc('mock','premium_accept_recommendation',{p_id:r.id})).ok);
 check('Chat athlete cannot self-approve',!(await rpc('mock','premium_review_recommendation',{p_id:r.id,p_approve:true,p_reason:'SYNTHETIC unauthorized self approval'})).ok);
 check('Chat normal trainer cannot approve',!(await rpc('trainer','premium_review_recommendation',{p_id:r.id,p_approve:true,p_reason:'SYNTHETIC unauthorized trainer approval'})).ok);
 const rv=await one('reviewer','coach_recommendations','id=eq.'+r.id,recSelect);check('Chat assigned reviewer sees limited actionable candidate',rv?.id===r.id&&rv.state==='pending_review'&&!/"last_messages"|"user_message"|"chat_provider"/.test(JSON.stringify(rv)));
 check('Reviewer cannot read private complete Chat context',!(await table('reviewer','coach_messages','mesocycle_id=eq.'+f.mesocycle,'context_bundle')).ok);
 await must(rpc('reviewer','premium_review_recommendation',{p_id:r.id,p_approve:true,p_reason:'SYNTHETIC reviewer approves removal of Monday goblet set three only.'}));
 const ready=await recommendation(r.id);check('Chat human approval persists ready state',ready.state==='ready'&&!!ready.reviewed_at&&!!ready.review_reason);
 const pair=await Promise.all([rpc('mock','premium_accept_recommendation',{p_id:r.id}),rpc('mock','premium_accept_recommendation',{p_id:r.id})]);check('Chat double acceptance produces exactly one N+1',pair.every(r=>r.ok)&&pair[0].data===pair[1].data&&pair[0].data!==f.revision);
 const old=f.revision,fresh=await revision(pair[0].data),all=await must(table('mock','routine_revisions','routine_id=eq.'+f.routine+'&order=revision_no'));
 check('Exactly one additive revision with original N preserved',all.length===2&&fresh.revision_no===before().revision.revision_no+1&&equal(all.find(r=>r.id===old),before().revision));
 const original=before().revision.snapshot.days.flatMap(d=>d.exercises),updated=fresh.snapshot.days.flatMap(d=>d.exercises),target=original.find(e=>e.day_id===f.days[0]&&e.exercise_order===0),newTarget=updated.find(e=>e.id===target.id);
 check('N+1 keeps target UUID and exact remaining individual series',updated.length===12&&newTarget?.id===target.id&&equal(newTarget.planned_sets,target.planned_sets.slice(0,2)));
 const faithful=(e,n)=>n&&e.id===n.id&&e.day_id===n.day_id&&e.exercise_order===n.exercise_order&&e.name===n.name&&(e.notes??before().exercises.find(x=>x.id===e.id)?.notes??null)===(n.notes??null)&&e.sets===n.sets&&String(e.rir)===String(n.rir)&&e.rest_seconds===n.rest_seconds&&equal(e.planned_sets,n.planned_sets);
 check('N+1 other eleven exercises retain identity order notes prescription',original.filter(e=>e.id!==target.id).every(e=>faithful(e,updated.find(n=>n.id===e.id))));
 check('N+1 target retains day order name notes and first-set RIR/rest',target.day_id===newTarget.day_id&&target.exercise_order===newTarget.exercise_order&&target.name===newTarget.name&&(target.notes??before().exercises.find(x=>x.id===target.id)?.notes??null)===(newTarget.notes??null)&&String(target.rir)===String(newTarget.rir)&&target.rest_seconds===newTarget.rest_seconds);
 const live=await must(table('mock','routine_exercises','id=in.('+original.map(e=>e.id).join(',')+')&order=id'));
 check('Live rows change only intended target series count',live.find(e=>e.id===target.id)?.sets===2&&before().exercises.filter(e=>e.id!==target.id).every(e=>equal(e,live.find(n=>n.id===e.id))));
 const after=await meso();check('Chat acceptance preserves current tracking week',after.tracking_week===m.tracking_week&&after.current_revision_id===fresh.id);
 f.original_revision=old;f.revision=fresh.id;f.target_exercise=target.id;f.pipeline_week=after.tracking_week;save();await invariants('Chat after acceptance');
}
async function workout(){
 assert(f.original_revision&&f.target_exercise);const rev=await revision(f.revision),day=rev.snapshot.days.find(d=>d.id===f.days[0]),started=new Date(Date.now()-1800000).toISOString(),completed=new Date().toISOString(),today=new Date().toLocaleDateString('en-CA',{timeZone:'Europe/Madrid'});
 const existing=await must(table('mock','workouts','user_id=eq.'+f.user+'&workout_date=eq.'+today+'&data->>routine_id=eq.'+f.routine+'&data->>routine_day_id=eq.'+day.id,'id'));
 check('N+1 save respects existing product same-day duplicate guard',existing.length===0);
 const data={routine_id:f.routine,routine_day_id:day.id,routine_revision_id:f.revision,routine_name:rev.snapshot.name,day_name:day.name,workout_date:today,started_at:started,completed_at:completed,duration_seconds:1800,notes:'SYNTHETIC new Premium workout',exercises:day.exercises.map(e=>({exercise_id:e.id,name:e.name,target:e.target||'',planned_sets:e.planned_sets.length,planned_rir:e.planned_sets[0].rir,rest_minutes:e.planned_sets[0].rest_seconds/60,notes:'SYNTHETIC N+1 workout exercise note',sets:e.planned_sets.map(s=>({set:s.set_number,kg:20,reps:s.reps_min,rir:s.rir,done:true}))}))};
 const payload={id:crypto.randomUUID(),user_id:f.user,variant:day.name,day:day.name,workout_date:today,data};
 const saved=(await must(req('mock','/rest/v1/workouts',payload)))[0];check('Actual owner JWT inserts workout with current N+1 and UUIDs',saved?.id===payload.id&&saved.user_id===f.user&&saved.data.routine_revision_id===f.revision&&saved.data.exercises.every(e=>day.exercises.some(p=>p.id===e.exercise_id)));
 f.new_workout=saved.id;f.workouts.push(saved.id);save();write('new-workout.json',saved);
 check('N+1 workout preserves exact two target sets',saved.data.exercises.find(e=>e.exercise_id===f.target_exercise).sets.length===2&&saved.data.exercises.length===4);
 const again=await one('mock','workouts','id=eq.'+saved.id);check('Read after save retains exact recorded performance',equal(again,saved));
 for(const actor of ['real','trainer']){const r=await table(actor,'workouts','id=eq.'+saved.id);check(actor+' cannot read another athlete N+1 workout',!r.ok||r.data.length===0);}
 await invariants('New N+1 workout');
}
async function history(){
 const old=before().workouts,all=await must(table('mock','workouts','user_id=eq.'+f.user+'&order=id'));
 check('History preserves all nine Basic workouts plus exact N+1 workout',old.every(w=>equal(w,all.find(n=>n.id===w.id)))&&all.filter(w=>w.id===f.new_workout).length===1);
 const newRow=all.find(w=>w.id===f.new_workout);check('Shared history distinguishes recorded three-set Basic from two-set Premium',old.filter(w=>w.data.routine_day_id===f.days[0]).every(w=>w.data.exercises.find(e=>e.exercise_id===f.target_exercise).sets.length===3)&&newRow.data.exercises.find(e=>e.exercise_id===f.target_exercise).sets.length===2);
 await invariants('Subsequent history');
 const stale=await rpc('mock','premium_chat_reserve',{p_mesocycle:f.mesocycle,p_revision:f.original_revision,p_key:crypto.randomUUID(),p_message:'Explica la programación vigente.'});check('Old revision tab cannot reserve current Chat',!stale.ok);
 const message='Explica las series vigentes de sentadilla goblet y distingue la base Basic de la decisión Premium aceptada.',key=f.keys.followup=crypto.randomUUID();save();const t=await must(rpc('mock','premium_chat_reserve',{p_mesocycle:f.mesocycle,p_revision:f.revision,p_key:key,p_message:message}));
 check('Subsequent Chat binds N+1 without week advance',t.revision_id===f.revision&&t.week===f.pipeline_week);f.followup_turn=t.id;f.followup_message=message;f.turns.push(t.id);save();write('followup-prepare.sql',`select public.premium_chat_claim(${q(f.user)},${q(t.id)},1,'prepare');`);
}
async function historyContext(){
 const C=await importContract('simple-coach-chat/chat-contract.mjs'),p=provider('followup-provider.json'),e=p.training.routine.exercises.find(e=>e.ref==='exercise_1');
 check('Post-workout context validates inherited provenance and N+1',C.contextQuality(p).ok&&p.training.baseline_origin==='inherited_basic'&&p.training.history_origin==='shared_existing_training'&&p.mesocycle.current_revision===2&&p.mesocycle.week===f.pipeline_week);
 check('Post-workout prescription retains exact two target series',equal(e.planned_sets,before().revision.snapshot.days.flatMap(d=>d.exercises).find(e=>e.id===f.target_exercise).planned_sets.slice(0,2)));
 check('Post-workout context includes explicit accepted Premium decision',p.recent_decisions.some(d=>d.state==='accepted'&&d.kind==='MODIFY'&&d.changes.some(c=>c.field==='planned_sets'&&c.from.length===3&&c.to.length===2)));
 check('Previous revision conversation not reused as current facts',p.last_messages.length===0&&p.summary.topics.length===0&&p.summary.references.length===0);
 const saved=readJSON(file('new-workout.json')),recorded=saved.data.exercises.find(x=>x.exercise_id===f.target_exercise);
 check('Shared captured history includes actual new N+1 performance',e.exposures?.some(x=>x.date===saved.workout_date&&x.sets?.length===2&&x.sets.every((s,i)=>s.kg===recorded.sets[i].kg&&s.reps===recorded.sets[i].reps&&s.rir===recorded.sets[i].rir)));
 const output={schema_version:C.SCHEMA_VERSION,answer:'La base procede de Basic. Tras la decisión Premium aceptada, la sentadilla goblet del lunes conserva dos series con sus objetivos individuales; la nueva sesión queda registrada con esa estructura.',facts_used:['exercise_1.prescription','exercise_1.metric'],suggested_action:'none',recommendation_candidate:null},quality=C.semantic(output,p);assert(quality.ok);
 write('followup-finish.sql',`begin;select public.premium_chat_claim(${q(f.user)},${q(f.followup_turn)},1,'mock');select public.premium_chat_finish(${q(f.user)},${q(f.followup_turn)},${j(output)},null,${j(mockReceipt(C))},${j(quality.warnings)});commit;`);
}
async function main(){
 assert(f?.ref==='dmqjexigdnfzobarhnib','Staging-only exact manifest');assert(f.mesocycle,'Root must create authorized Premium fixture first');
 if(mode==='weekly-finish-keep')return weeklyFinish('KEEP');
 if(mode==='weekly-finish-review')return weeklyFinish('REVIEW');
 if(mode==='weekly-accept-keep')return weeklyAccept('KEEP');
 if(mode==='weekly-accept-review')return weeklyAccept('REVIEW');
 if(mode==='review-reserve')return reviewReserve();
 if(mode==='chat-finish')return chatFinish();
 if(mode==='chat-accept')return chatAccept();
 if(mode==='workout')return workout();
 if(mode==='history')return history();
 if(mode==='history-context')return historyContext();
 throw Error('Unsupported explicit pipeline mode');
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{if(rows.length)fs.writeFileSync(path.join(__dirname,'results/pipeline-'+mode+'.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode,provider_dispatches:0,mock_service_completion:true},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' '+mode+' checks');});
module.exports={invariants,mockReceipt};
