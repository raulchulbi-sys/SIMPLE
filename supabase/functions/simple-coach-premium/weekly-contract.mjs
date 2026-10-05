/* Weekly extension: subjective signals never replace the factual per-set history. */
import * as Series from './series-contract.mjs';
export const MODEL=Series.MODEL,MAX_OUTPUT=Series.MAX_OUTPUT,CATALOGUE=Series.CATALOGUE,CLAIMS=Series.CLAIMS;
export const prescription=Series.prescription;
export const PROMPT_VERSION='premium-weekly-analysis-v1',SCHEMA_VERSION='premium-weekly-analysis-v1',PROVIDER_VERSION='premium-weekly-provider-v1';
export const WEEKDAYS=['mon','tue','wed','thu','fri','sat','sun'];
export const SIGNAL_VALUES={recovery:['very_good','good','normal','worse','bad'],sleep:['very_good','good','normal','bad','very_bad'],fatigue:['very_low','low','normal','high','very_high'],stress:['low','moderate','high','very_high'],session_perception:['easier','similar','harder','much_harder'],availability:['changed','unchanged'],review:['none','volume','effort','duration','distribution','exercise']};
const obj=p=>({type:'object',properties:p,required:Object.keys(p),additionalProperties:false}),en=a=>({type:'string',enum:a}),ref={type:'string',minLength:1,maxLength:32},integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const scheduleItem=obj({day_ref:ref,weekday:en(WEEKDAYS),minutes:integer(15,120)}),schedule={type:'array',minItems:1,maxItems:7,items:scheduleItem};
const scheduleAction=obj({action:en(['change_week_schedule']),from:schedule,to:schedule});
export const SCHEMA={...Series.SCHEMA,properties:{...Series.SCHEMA.properties,schema_version:en([SCHEMA_VERSION]),checkin_signals:{type:'array',maxItems:7,items:obj({field:en(Object.keys(SIGNAL_VALUES)),value:en([...new Set(Object.values(SIGNAL_VALUES).flat())])})},changes:{...Series.SCHEMA.properties.changes,items:{anyOf:[...Series.SCHEMA.properties.changes.items.anyOf,scheduleAction]}}},required:[...Series.SCHEMA.required,'checkin_signals']};
export const validate=(v,s=SCHEMA)=>Series.validate(v,s);
export function checkinSignals(ctx){
 if(ctx.checkin_missing||!ctx.checkin)return [];
 const c=ctx.checkin;return Object.keys(SIGNAL_VALUES).map(field=>({field,value:field==='availability'?(c.availability.changed?'changed':'unchanged'):field==='review'?c.review.topic:c[field]}));
}
function scheduleEqual(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every(s=>b.some(t=>s.day_ref===t.day_ref&&s.weekday===t.weekday&&s.minutes===t.minutes));}
function scheduleCapturedEqual(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((s,i)=>s.day_ref===b[i].day_ref&&s.weekday===b[i].weekday&&s.minutes===b[i].minutes);}
export function contextQuality(ctx){
 const failures=[];
 if(!ctx||ctx.schema_version!==PROVIDER_VERSION||!Array.isArray(ctx.routine?.days)||!Array.isArray(ctx.routine?.exercises)||!Array.isArray(ctx.allowed_replacements)||typeof ctx.checkin_missing!=='boolean'||!Array.isArray(ctx.recent_weeks)||ctx.recent_weeks.length>4||!Array.isArray(ctx.week_schedule)||typeof ctx.week_schedule_source!=='string')failures.push('weekly_context_shape');
 if(failures.length)return {ok:false,failures};
 if(ctx.baseline_origin!==undefined&&!['inherited_basic','existing_owned_routine'].includes(ctx.baseline_origin)||ctx.history_origin!==undefined&&ctx.history_origin!=='shared_existing_training')failures.push('weekly_context_provenance_shape');
 if(ctx.routine.days.some(d=>!/^day_[1-9][0-9]*$/.test(d?.ref||''))||ctx.routine.exercises.some(e=>!/^exercise_[1-9][0-9]*$/.test(e?.ref||'')||!ctx.routine.days.some(d=>d.ref===e.day_ref)||!CLAIMS.includes(e.metrics?.trend)))failures.push('weekly_context_reference_shape');
 const text=JSON.stringify(ctx);if(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|PRIVATE CANARY/iu.test(text))failures.push('weekly_context_not_minimized');
 const c=ctx.checkin;
 if(ctx.checkin_missing){if(c!==null)failures.push('missing_checkin_not_null');}
 else if(!c||typeof c!=='object'||c.schema_version!=='premium-weekly-checkin-v1'||Object.keys(c).sort().join(',')!=='availability,fatigue,recovery,review,schema_version,session_perception,sleep,stress'||['recovery','sleep','fatigue','stress','session_perception'].some(k=>!SIGNAL_VALUES[k].includes(c[k]))||typeof c.availability?.changed!=='boolean'||!Array.isArray(c.availability.weekdays)||!c.availability.minutes_by_day||typeof c.availability.minutes_by_day!=='object'||Array.isArray(c.availability.minutes_by_day)||!SIGNAL_VALUES.review.includes(c.review?.topic))failures.push('weekly_checkin_shape');
 else{
  if(Object.keys(c.availability).sort().join(',')!=='changed,minutes_by_day,weekdays'||Object.keys(c.review).sort().join(',')!=='exercise_ref,topic')failures.push('weekly_checkin_extra_fields');
  if(c.review.topic==='exercise'&&(!c.review.exercise_ref||!ctx.routine.exercises.some(e=>e.ref===c.review.exercise_ref)))failures.push('weekly_review_target');
  if(c.review.topic!=='exercise'&&c.review.exercise_ref!==null)failures.push('weekly_review_target');
  const days=c.availability.weekdays,caps=c.availability.minutes_by_day;
  if(new Set(days).size!==days.length||days.some(d=>!WEEKDAYS.includes(d))||Object.keys(caps).some(d=>!days.includes(d))||days.some(d=>!Number.isInteger(caps[d])||caps[d]<15||caps[d]>120)||!c.availability.changed&&(days.length||Object.keys(caps).length))failures.push('weekly_availability_shape');
 }
 return {ok:!failures.length,failures:[...new Set(failures)]};
}
function projectedExercises(ctx,changes){
 const es=structuredClone(ctx.routine.exercises);
 for(const e of es)e.planned_sets=Series.sets(e);
 for(const c of changes){
  const e=es.find(e=>e.ref===c.exercise_ref);if(!e)continue;
  if(['change_set','remove_set','add_set'].includes(c.action)){if(e.planned_sets)e.planned_sets=Series.applySetChanges(e.planned_sets,[c]);continue;}
  if(c.action==='change_distribution')e.day_ref=c.to_day_ref;
  if(c.action==='replace_exercise')e.catalogue_id=c.to_catalogue_id;
  if(!e.planned_sets)continue;
  if(c.action==='change_sets')e.planned_sets=Array.from({length:c.to},(_,i)=>({...e.planned_sets[0],set_number:i+1}));
  if(c.action==='change_reps'){const r=/^(\d+)(?:-(\d+))?$/.exec(c.to);if(r)e.planned_sets=e.planned_sets.map(s=>({...s,reps_min:+r[1],reps_max:+(r[2]||r[1])}));}
  if(c.action==='change_rir')e.planned_sets=e.planned_sets.map(s=>({...s,rir:+c.to}));
  if(c.action==='change_rest')e.planned_sets=e.planned_sets.map(s=>({...s,rest_seconds:c.to}));
 }
 return es;
}
// Existing Basic V5 policy: warm-up, transitions, execution and every set's rest.
// This is a conservative duration estimate, not a physiological threshold.
export function estimatedSessionMinutes(ctx,changes=[]){
 const es=projectedExercises(ctx,changes),result={};
 for(const d of ctx.routine.days){let seconds=300;for(const e of es.filter(e=>e.day_ref===d.ref)){
  const ss=e.planned_sets,meta=globalThis.SimpleCoachProgrammingV5.byId.get(e.catalogue_id);
  if(!ss||!meta){result[d.ref]=null;seconds=null;break;}
  seconds+=120+ss.reduce((n,s)=>n+s.reps_max*4*(meta.unilateral?2:1)+s.rest_seconds+(meta.unilateral?15:0),0);
 }if(seconds!==null)result[d.ref]=Math.ceil(seconds/60);}
 return result;
}
export function semantic(v,ctx){
 if(!validate(v))return {ok:false,failures:['schema_invalid'],warnings:[]};
 const cq=contextQuality(ctx);if(!cq.ok)return {ok:false,failures:cq.failures,warnings:[]};
 const schedules=v.changes.filter(c=>c.action==='change_week_schedule'),rest=v.changes.filter(c=>c.action!=='change_week_schedule');
 const {checkin_signals,...base}=v;
 const result=Series.semantic({...base,schema_version:Series.SCHEMA_VERSION,kind:rest.length?'MODIFY':'KEEP',changes:rest},ctx),fail=x=>result.failures.push(x),warn=x=>result.warnings.push(x);
 const explanation=v.reason+' '+v.interpretation;
 if(/\b(salud|lesi[oó]n|dolor|molestia|s[ií]ntoma|diagn[oó]stico|medicaci[oó]n|tratamiento|nutrici[oó]n|dieta|calor[ií]as)\w*/iu.test(explanation))fail('outside_weekly_training_contract');
 for(const sentence of explanation.split(/[.!?]/))if(/\b(sue[nñ]o|estr[eé]s|recuperaci[oó]n)\b.{0,80}\b(ha causado|caus[oó]|provoc[oó]|es la causa|ha provocado)\b/iu.test(sentence)&&!/\b(no ha causado|no (?:se ha|est[aá]) demostrad[oa]|no hay (?:base|evidencia)|hip[oó]tesis|podr[ií]a|posible)\b/iu.test(sentence))fail('unproven_checkin_causality');
 if((v.kind==='MODIFY')!==(v.changes.length>0))fail('kind_changes');
 const supported=checkinSignals(ctx),seenSignals=new Set();
 for(const s of v.checkin_signals){if(seenSignals.has(s.field))fail('duplicate_checkin_signal');seenSignals.add(s.field);if(!supported.some(x=>x.field===s.field&&x.value===s.value))fail('unsupported_checkin_signal');}
 if(ctx.checkin_missing)warn('checkin_missing');
 const days=ctx.routine.days.map(d=>d.ref),uniqueRefs=new Set(days);
 if(uniqueRefs.size!==days.length)fail('ambiguous_logical_days');
 if(schedules.length>1)fail('duplicate_schedule_change');
 const effective=schedules[0]?.to||ctx.week_schedule||[];
 if(schedules.length){
  const c=schedules[0],a=ctx.checkin?.availability;
   if(ctx.week_schedule_source==='unresolved'||!scheduleCapturedEqual(c.from,ctx.week_schedule))fail('stale_or_unresolved_schedule');
  if(scheduleEqual(c.from,c.to))fail('empty_schedule_change');
  if(!a?.changed)fail('availability_change_not_declared');
  for(const list of [c.from,c.to])if(list.length!==days.length||new Set(list.map(s=>s.day_ref)).size!==days.length||list.some(s=>!uniqueRefs.has(s.day_ref)))fail('schedule_logical_days_changed');
  const totals={};for(const s of c.to){totals[s.weekday]=(totals[s.weekday]||0)+s.minutes;if(!a?.weekdays.includes(s.weekday))fail('schedule_weekday_unavailable');}
  for(const [day,total] of Object.entries(totals))if(total>(a?.minutes_by_day[day]??0))fail('schedule_exceeds_available_time');
  const estimates=estimatedSessionMinutes(ctx,rest);for(const s of c.to){if(estimates[s.day_ref]===null)fail('schedule_duration_unresolved');else if(s.minutes<estimates[s.day_ref])fail('schedule_duration_below_estimate');}
  if(rest.some(c=>c.action==='change_rest'&&c.to<c.from||c.action==='change_set'&&c.to.rest_seconds<c.from.rest_seconds))fail('schedule_rest_compression');
 }
 const a=ctx.checkin?.availability;
 if(a?.changed&&!schedules.length){const sums={};for(const s of effective)sums[s.weekday]=(sums[s.weekday]||0)+s.minutes;if(!effective.length||effective.some(s=>!a.weekdays.includes(s.weekday))||Object.entries(sums).some(([d,n])=>n>(a.minutes_by_day[d]??0))){warn('availability_not_resolved_requires_review');if(v.kind!=='REVIEW')fail('unresolved_availability_requires_review');}}
 for(const e of ctx.routine.exercises){const meta=globalThis.SimpleCoachProgrammingV5.byId.get(e.catalogue_id),hs=e.exposures||[];
  if(meta?.fatigue_cost==='high'&&hs.slice(0,2).length===2&&hs.slice(0,2).every(h=>h.sets?.filter(s=>s.rir===0).length>=2))warn('repeated_high_cost_failure:'+e.ref);
 }
 const touched=new Set(rest.map(c=>c.exercise_ref));
 if(ctx.routine.exercises.length>1&&touched.size===ctx.routine.exercises.length)warn('whole_program_adaptation_requires_review');
 const previous=ctx.recent_weeks[0];if(previous?.decision==='MODIFY'&&rest.some(c=>(previous.changes_applied||[]).some(p=>p.exercise_ref===c.exercise_ref)))warn('recent_target_changed_requires_review');
 if(schedules.length&&ctx.intake.activity?.type!=='none'&&ctx.intake.activity?.weekdays?.length){const sport=new Set(ctx.intake.activity.weekdays);for(const e of projectedExercises(ctx,rest)){const meta=globalThis.SimpleCoachProgrammingV5.byId.get(e.catalogue_id),s=effective.find(s=>s.day_ref===e.day_ref);if(meta?.primary?.some(g=>['quads','hamstrings','glutes','calves'].includes(g))&&s&&sport.has(s.weekday))warn('external_activity_overlap:'+e.ref);}}
 result.failures=[...new Set(result.failures)];result.warnings=[...new Set(result.warnings)];result.ok=!result.failures.length;return result;
}
export const PROMPT=Series.PROMPT.replaceAll(Series.SCHEMA_VERSION,SCHEMA_VERSION).replace(Series.PROMPT_VERSION,PROMPT_VERSION)+`
Contexto premium-weekly-provider-v1: checkin actual es declaración estructurada subjetiva; nunca sustituye workouts ni prueba causalidad. checkin_missing=true significa ausencia, no normalidad: checkin_signals debe ser []. Facts siguen siendo únicamente exercise_ref/metrics.trend existentes. checkin_signals cita solo pares field/value realmente presentes: recovery, sleep, fatigue, stress, session_perception; availability=changed/unchanged; review=topic. No síntomas, salud, diagnósticos, notas libres ni causalidad no demostrada. Una mala semana o fatiga alta aislada no exige bajar volumen; contrasta comparabilidad, adherencia, programación y recent_weeks. Si rendimiento y checkin discrepan, reconoce ambas observaciones sin elegir una causa inventada. Pedir revisar un ejercicio es contexto, no autorización automática para sustituirlo.
recent_weeks contiene hasta cuatro decisiones y changes_applied aceptados: respeta la revisión actual y evalúa qué pasó después; varios KEEP consecutivos son válidos. No alternes cambios por novedad ni reviertas una modificación reciente sin evidencia. Preferir cero o pocos cambios justificados; no regenerar rutina, borrar ejercicios/días ni tocar UUID/históricos.
change_week_schedule es un único cambio con from y to completos [{day_ref,weekday,minutes}], sin exercise_ref. from debe coincidir exactamente con week_schedule en valores y orden canónico; conserva todos los day_ref una vez. Si availability.changed=true puedes redistribuirlos por días permitidos. Dos sesiones lógicas en un weekday son posibles solo si la suma de minutos cabe en su minutes_by_day. Cada duración debe cubrir la estimación conservadora V5 del programa resultante (300s calentamiento +120s por ejercicio +por serie reps_max*4 segundos [doble unilateral]+descanso [+15s unilateral]). Es estimación operativa, no ley fisiológica. No comprimas descansos importantes para hacer caber volumen. Prescripción incompleta, schedule unresolved o falta de alternativa pequeña viable ⇒ REVIEW sin cambios; no inventes una correspondencia ni regeneres 5→4 días. Separa siempre observación, señal declarada e hipótesis. Mantén los contratos de series y aceptación humana anteriores.`;
export function requestBody(ctx){return {...Series.requestBody(ctx),instructions:PROMPT,text:{format:{type:'json_schema',name:'premium_weekly_analysis_v1',strict:true,schema:SCHEMA}}};}
export const cost=Series.cost;
export async function analyze(ctx,key,fetcher=fetch){
 const cq=contextQuality(ctx);if(!cq.ok)return {output:null,error:'invalid_weekly_context',quality:{...cq,warnings:[]},receipt:{model:MODEL,prompt_version:PROMPT_VERSION,response_schema_version:SCHEMA_VERSION,status:0,input_tokens:null,output_tokens:null,cached_input_tokens:null,cost_usd:null,latency_ms:0}};
 const r=await Series.analyze(ctx,key,(url,init)=>fetcher(url,{...init,body:JSON.stringify(requestBody(ctx))}));
 if(r.output&&[null,'invalid_recommendation'].includes(r.error)){r.quality=semantic(r.output,ctx);r.error=r.quality.ok?null:'invalid_recommendation';}
 r.receipt.prompt_version=PROMPT_VERSION;r.receipt.response_schema_version=SCHEMA_VERSION;r.receipt.schema_valid=r.output?validate(r.output):null;r.receipt.semantic_valid=r.output?!!r.quality?.ok:null;return r;
}
