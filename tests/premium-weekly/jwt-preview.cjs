// Temporary UI against exact synthetic staging IDs. The default mode is read-only.
// No Auth creation, provider dispatch, credentials in HTML/JSON, or production route.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
process.env.PREMIUM_WEEKLY_PORT='4242';
const H=require('./live.cjs'),P=require('./preview.cjs'),I=require('../../assets/coach-intake.js'),{scheduleChange}=require('./weekly-schedule.cjs');
const REF='dmqjexigdnfzobarhnib',manifest=path.join(__dirname,'private/weekly-fixture.json');
assert.equal(H.credentials.ref,REF);
const readManifest=()=>{const f=JSON.parse(fs.readFileSync(manifest));assert.equal(f.ref,REF);assert(f.cases.longitudinal);return f;};
const copy=v=>structuredClone(v),roles={athlete:'mock',reviewer:'reviewer'};
function safeError(response){const message=response.data?.message||response.data?.error;return /^[a-z_]+$/.test(message||'')?message:'staging_request_rejected';}
async function must(promise){const r=await promise;if(!r.ok)throw Error(safeError(r));return r.data;}
function publicCheckin(c){return c?{id:c.id,row_version:c.row_version,answers:copy(c.answers),submitted_at:c.submitted_at,week_number:c.week_number,routine_revision_id:c.routine_revision_id}:null;}
function publicRecommendation(r,exercises,snapshotDays=[]){
 if(!r)return null;const context=r.analysis_bundle?.provider,output=r.analysis_trace?.output||{},lookup=ref=>context?.routine?.exercises?.find(e=>e.ref===ref),name=ref=>lookup(ref)?.name||I.exercises.find(e=>e.id===lookup(ref)?.catalogue_id)?.name||'Ejercicio de la rutina';
 const descriptions={reps_increasing_comparable:'Aumentan las repeticiones con carga y RIR comparables.',stable_comparable:'Rendimiento estable con carga y RIR comparables.',reps_decreasing_comparable:'Bajan las repeticiones con carga y RIR comparables.',mixed_comparable:'Las exposiciones comparables muestran una evolución variable.',insufficient_data:'No hay suficientes exposiciones para establecer una tendencia.',context_changed_or_incomplete:'Cambió el contexto o faltan datos para comparar.'};
 const facts=(r.facts?.length?r.facts:output.facts||[]).map(f=>{const e=lookup(f.exercise_ref),latest=[...(f.observations||e?.exposures||[])].sort((a,b)=>String(b.date).localeCompare(String(a.date)))[0];return {exercise_name:name(f.exercise_ref),summary:descriptions[f.claim||e?.metrics?.trend]||'Datos de entrenamiento registrados.',sets:(latest?.sets||[]).map((s,i)=>({set_number:s.set_number??i+1,kg:s.kg,reps:s.reps,rir:s.rir}))};});
 const patches=r.kind==='REVIEW'?[]:r.patches||[],changes=patches.filter(p=>p.field==='planned_sets').map(p=>({action:'planned_sets',exercise_name:exercises.find(e=>e.id===p.target_id)?.name||'Ejercicio de la rutina',before:copy(p.from),after:copy(p.to)}));
 for(const p of patches.filter(p=>p.field==='weekly_schedule'))changes.push(scheduleChange(p,r.analysis_bundle,snapshotDays));
 return {id:r.id,kind:r.kind,state:r.state==='superseded'?'stale':r.state,analysis_week:r.analysis_week,revision_id:r.base_revision_id,facts,reason:r.review_reason||r.analysis_trace?.review_issue||output.reason||r.interpretation||'Recomendación pendiente de revisión.',changes,checkin_missing:context?.checkin_missing===true};
}
async function state(actor){
 const f=readManifest(),c=f.cases.longitudinal,role=roles[actor];if(!role)throw Error('invalid_request');
 const mesocycles=await must(H.read(role,'coach_mesocycles','id=eq.'+c.mesocycle));if(mesocycles.length!==1)throw Error('premium_not_authorized');const m=mesocycles[0];
 const result=await Promise.allSettled([
  must(H.read(role,'coach_mesocycle_weeks','mesocycle_id=eq.'+m.id+'&week_number=eq.'+m.tracking_week)),
  must(H.read(role,'routine_revisions','id=eq.'+m.current_revision_id)),
  must(H.read(role,'coach_weekly_checkins','mesocycle_id=eq.'+m.id+'&week_number=eq.'+m.tracking_week)),
  must(H.read(role,'coach_recommendations','mesocycle_id=eq.'+m.id+'&analysis_week=eq.'+m.tracking_week+'&order=created_at.desc')),
  must(H.read(role,'context_grants','user_id=eq.'+f.user+'&scope=eq.premium_weekly_checkin&notice_version=eq.premium-checkin-v1&revoked_at=is.null'))
 ]);
 for(const r of result)if(r.status==='rejected')throw r.reason;
 const [weeks,revisions,checkins,recommendations,grants]=result.map(r=>r.value);if(weeks.length!==1)throw Error('premium_weekly_invalid_week');
 const revision=revisions[0],rec=recommendations.find(r=>!['accepted','rejected','superseded'].includes(r.state))||null,provider=rec?.analysis_bundle?.provider;
 // Reviewer uses only rows its own JWT can read. No athlete fallback or workout reads.
 const snapshotExercises=(revision?.snapshot?.days||[]).flatMap(d=>(d.exercises||[]).map(e=>({id:e.id,name:e.name,day_name:d.name,ref:null})));
 const bindings=rec?.analysis_bundle?.bindings||[];
 const exercises=snapshotExercises.length?snapshotExercises:(provider?.routine?.exercises||[]).map(e=>({id:bindings.find(b=>b.ref===e.ref)?.exercise_id,name:e.name||I.exercises.find(x=>x.id===e.catalogue_id)?.name||'Ejercicio de la rutina',day_name:'Rutina actual',ref:e.ref})).filter(e=>e.id);
 return {mode:'staging',actor,user_id:f.user,permission:grants.length>0,exercises,mesocycle:{id:m.id,number:m.number,planned_weeks:m.planned_weeks,revision_id:m.current_revision_id,revision_no:revision?.revision_no||provider?.mesocycle?.current_revision||1,state:m.state},week:{id:weeks[0].id,number:m.tracking_week},session_summary:'Datos del mesociclo sintético de staging',checkin:publicCheckin(checkins[0]),recommendation:publicRecommendation(rec,exercises,revision?.snapshot?.days||[])};
}
function updateManifest(fields){const f=readManifest();Object.assign(f.cases.longitudinal,fields);fs.writeFileSync(manifest,JSON.stringify(f,null,2));}
function createJwtAdapter(phase='read-only'){
 assert(['read-only','checkin','review'].includes(phase));
 return {mode:'staging',cases:[['normal','Longitudinal · staging']],async handle({action,tag,actor,data={}}){
  if(tag!=='normal'||!roles[actor])throw Error('invalid_request');if(action==='state')return state(actor);
  if(action==='reset')throw Error('staging_reset_disabled');if(action==='analyze')throw Error('analysis_requires_explicit_runner');
  const f=readManifest(),c=f.cases.longitudinal,role=roles[actor];
  if(['permission','save'].includes(action)){
   if(phase!=='checkin'||actor!=='athlete')throw Error('staging_write_phase_closed');
   if(action==='permission')return must(H.rpc(role,'premium_weekly_permission',{p_mesocycle:c.mesocycle,p_allow:data.allow===true}));
   const row=await must(H.rpc(role,'premium_save_weekly_checkin',{p_mesocycle:c.mesocycle,p_week:data.week,p_revision:data.revision,p_expected:data.expected,p_answers:data.answers,p_submit:data.submit===true}));
   if(row.submitted_at)updateManifest({checkin:row.id,answers:copy(row.answers)});return publicCheckin(row);
  }
  if(phase!=='review'||!['review','reject','resolve','accept'].includes(action))throw Error('staging_write_phase_closed');
  const current=await state(actor),r=current.recommendation;if(!r||r.id!==data.id)throw Error('action_unavailable');
  if(action==='accept'){
   if(actor!=='athlete'||r.state!=='ready'||r.kind==='REVIEW')throw Error('action_unavailable');
   await must(H.rpc(role,'premium_accept_recommendation',{p_id:r.id}));const latest=await state(actor);updateManifest({revision:latest.mesocycle.revision_id,week:latest.week.number});return latest;
  }
  if(actor!=='reviewer'||r.state!=='pending_review')throw Error('action_unavailable');
  if(action==='resolve'){if(r.kind!=='REVIEW')throw Error('action_unavailable');await must(H.rpc(role,'premium_resolve_review',{p_id:r.id,p_kind:'KEEP',p_patches:[],p_reason:'Controlled staging browser human resolution: preserve routine.'}));}
  else {if(action==='review'&&r.kind==='REVIEW')throw Error('action_unavailable');await must(H.rpc(role,'premium_review_recommendation',{p_id:r.id,p_approve:action==='review',p_reason:'Controlled staging browser review by assigned reviewer.'}));}
  return state(actor);
 }};
}
const createJwtServer=phase=>P.createServer(createJwtAdapter(phase),4242);
if(require.main===module){const phase=process.argv[2]||'read-only';createJwtServer(phase).listen(4242,'127.0.0.1',()=>console.log('Temporary Premium JWT staging preview http://127.0.0.1:4242/review ('+phase+'; no model dispatch)'));}
module.exports={createJwtAdapter,createJwtServer,state,publicCheckin,publicRecommendation};
