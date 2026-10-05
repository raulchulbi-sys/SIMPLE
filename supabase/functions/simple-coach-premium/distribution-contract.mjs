/* Atomic weekly topology extension. Historical weekly/series contracts stay supported. */
import * as Weekly from './weekly-contract.mjs';
import * as Series from './series-contract.mjs';
export const MODEL=Weekly.MODEL,MAX_OUTPUT=Weekly.MAX_OUTPUT,PROVIDER_VERSION=Weekly.PROVIDER_VERSION,CATALOGUE=Weekly.CATALOGUE;
export const VERSION='premium-session-distribution-v1',SCHEMA_VERSION='premium-weekly-distribution-v1',PROMPT_VERSION=SCHEMA_VERSION;
const obj=p=>({type:'object',properties:p,required:Object.keys(p),additionalProperties:false});
const ref={type:'string',minLength:1,maxLength:32},text={type:'string',minLength:1,maxLength:400};
const nullable=s=>({anyOf:[s,{type:'null'}]}),list=(items,maxItems=64,minItems=0)=>({type:'array',items,minItems,maxItems});
const sets=obj({...Series.SET_SCHEMA.properties,set_number:{type:'integer',minimum:1,maximum:12}});
export const DISTRIBUTION=obj({action:{type:'string',enum:['change_session_distribution']},
 sessions:list(obj({action:{type:'string',enum:['keep_session','move_session','add_session']},session_ref:ref,weekday:{type:'string',enum:Weekly.WEEKDAYS},minutes:{type:'integer',minimum:15,maximum:120},
 exercises:list(obj({exercise_ref:ref,catalogue_id:{type:'string',enum:Weekly.CATALOGUE.map(x=>x.id)},planned_sets:list(sets,12,1)}),40,1)}),7,1),
 removed_sessions:list(ref,7),removed_exercises:list(obj({exercise_ref:ref,reason:text}),40),volume_reason:nullable(text)});
export const SCHEMA={...Weekly.SCHEMA,properties:{...Weekly.SCHEMA.properties,schema_version:{type:'string',enum:[SCHEMA_VERSION]},changes:{...Weekly.SCHEMA.properties.changes,items:{anyOf:[...Weekly.SCHEMA.properties.changes.items.anyOf,DISTRIBUTION]}}}};
export function validate(v,s=SCHEMA){if(s.anyOf)return s.anyOf.some(x=>validate(v,x));if(s.type==='null')return v===null;if(s.type==='object')return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===s.required.length&&s.required.every(k=>Object.hasOwn(v,k)&&validate(v[k],s.properties[k]));if(s.type==='array')return Array.isArray(v)&&v.length>=(s.minItems||0)&&v.length<=(s.maxItems??Infinity)&&v.every(x=>validate(x,s.items));return Weekly.validate(v,s);}
export function contextQuality(ctx){const q=Weekly.contextQuality(ctx);if(ctx?.session_distribution_version!==VERSION||!Array.isArray(ctx?.distribution_availability?.weekdays)||!ctx?.distribution_availability?.minutes_by_day)q.failures.push('distribution_context_shape');q.ok=!q.failures.length;return q;}
export function inspect(change,ctx){
 const failures=[],warnings=[],fail=s=>failures.push(s),warn=s=>warnings.push(s);
 const oldDays=ctx.routine.days,old=ctx.routine.exercises,available=ctx.distribution_availability;
 const used=new Set(),dayRefs=new Set(),weekdays=new Set(),catalogues=new Set();let before=0,after=0;
 const frequency={},groupsBefore={},groupsAfter={},durations={};
 for(const e of old){const ss=Series.sets(e);if(!ss){fail('distribution_prescription_unresolved');continue;}before+=ss.length;
  for(const g of globalThis.SimpleCoachProgrammingV5.byId.get(e.catalogue_id)?.primary||[])groupsBefore[g]=(groupsBefore[g]||0)+ss.length;}
 for(const [i,d] of change.sessions.entries()){
  if(dayRefs.has(d.session_ref)||weekdays.has(d.weekday))fail('distribution_duplicate_session');dayRefs.add(d.session_ref);weekdays.add(d.weekday);
  const existing=oldDays.find(x=>x.ref===d.session_ref);
  if(d.action==='add_session'?existing||!/^new_day_[1-9][0-9]*$/.test(d.session_ref):!existing)fail('distribution_session_identity');
  if(!available.weekdays.includes(d.weekday)||d.minutes>(available.minutes_by_day[d.weekday]||0))fail('distribution_weekday_unavailable');
  let seconds=300;const dayGroups=new Set(),costlyFailures=[];
  for(const e of d.exercises){
   if(used.has(e.exercise_ref))fail('distribution_duplicate_exercise');used.add(e.exercise_ref);
   const previous=old.find(x=>x.ref===e.exercise_ref),meta=globalThis.SimpleCoachProgrammingV5.byId.get(e.catalogue_id);
   if(previous?previous.catalogue_id!==e.catalogue_id:!/^new_exercise_[1-9][0-9]*$/.test(e.exercise_ref))fail('distribution_exercise_identity');
   if(!meta||!ctx.allowed_replacements.some(x=>x.id===e.catalogue_id)||ctx.intake.excluded?.includes(e.catalogue_id))fail('distribution_excluded_or_unavailable');
   if(catalogues.has(e.catalogue_id))warn('repeated_catalogue_requires_reason:'+e.catalogue_id);catalogues.add(e.catalogue_id);
   if(!Weekly.validate(e.planned_sets,list(sets,12,1))||!e.planned_sets.every((s,n)=>s.set_number===n+1&&s.reps_max>=s.reps_min))fail('distribution_invalid_sets');
   if(['lt6','m6_12'].includes(ctx.intake.experience)&&e.planned_sets.some(s=>s.rir<2))fail('beginner_failure');
   if(meta)for(const s of e.planned_sets){const bounds=globalThis.SimpleCoachProgrammingV5.bounds(meta),rest=globalThis.SimpleCoachProgrammingV5.restGuidance(meta,s);if(s.reps_min<bounds.reps[0]||s.reps_max>bounds.reps[1])fail('catalogue_reps_bounds');if(s.rest_seconds<rest.minimum)warn('rest_below_demand:'+e.exercise_ref+':set_'+s.set_number);if(s.rir===0&&globalThis.SimpleCoachProgrammingV5.costly(meta))costlyFailures.push({ref:e.exercise_ref,set:s.set_number,primary:meta.primary,all:e.planned_sets.every(x=>x.rir===0),short:s.rest_seconds<rest.preferred});}
   if(previous){const prior=Series.sets(previous);if(prior?.some((s,n)=>e.planned_sets[n]&&e.planned_sets[n].rest_seconds<s.rest_seconds))fail('distribution_rest_compression');}
   after+=e.planned_sets.length;
   for(const g of meta?.primary||[]){groupsAfter[g]=(groupsAfter[g]||0)+e.planned_sets.length;dayGroups.add(g);}
   seconds+=120+e.planned_sets.reduce((n,s)=>n+s.reps_max*4*(meta?.unilateral?2:1)+s.rest_seconds+(meta?.unilateral?15:0),0);
  }
  const overlap=costlyFailures.some((s,n)=>costlyFailures.some((t,k)=>k!==n&&s.primary.some(g=>t.primary.includes(g))));
  if(costlyFailures.length>1&&(overlap||costlyFailures.some(s=>s.all||s.short)))warn('demanding_failure:'+d.session_ref+':'+costlyFailures.map(s=>s.ref+'/S'+s.set).join(','));
  for(const g of dayGroups)frequency[g]=(frequency[g]||0)+1;
  durations[d.session_ref]=Math.ceil(seconds/60);if(durations[d.session_ref]>d.minutes)fail('distribution_session_too_short');
 }
 const removed=new Set();for(const e of change.removed_exercises){if(used.has(e.exercise_ref)||removed.has(e.exercise_ref)||!old.some(x=>x.ref===e.exercise_ref))fail('distribution_invalid_removal');removed.add(e.exercise_ref);}
 if(old.some(e=>!used.has(e.ref)&&!removed.has(e.ref)))fail('distribution_silent_exercise_loss');
 const omitted=oldDays.filter(d=>!dayRefs.has(d.ref)).map(d=>d.ref).sort();if(JSON.stringify([...change.removed_sessions].sort())!==JSON.stringify(omitted)||new Set(change.removed_sessions).size!==change.removed_sessions.length)fail('distribution_silent_session_loss');
 if(after>before&&!change.volume_reason?.trim())fail('distribution_volume_increase_unjustified');
 if(after!==before)warn('weekly_volume_changed:'+before+'->'+after);
 for(const g of Object.keys(groupsBefore))if(!groupsAfter[g])warn('muscle_coverage_removed:'+g);
 for(const g of Object.keys(frequency))if(frequency[g]===1)warn('single_weekly_exposure:'+g);
 warn('whole_program_distribution_requires_review');
 return {ok:!failures.length,failures:[...new Set(failures)],warnings:[...new Set(warnings)],before,after,durations,groupsBefore,groupsAfter,frequency};
}
export function semantic(v,ctx){
 if(!validate(v))return {ok:false,failures:['schema_invalid'],warnings:[]};
 const q=contextQuality(ctx);if(!q.ok)return {...q,warnings:[]};
 const changes=v.changes.filter(c=>c.action==='change_session_distribution');
 if(!changes.length){const result=Weekly.semantic({...v,schema_version:Weekly.SCHEMA_VERSION},ctx);for(const c of v.changes){const e=ctx.routine.exercises.find(e=>e.ref===c.exercise_ref);if(e&&ctx.intake.excluded?.includes(e.catalogue_id)&&c.action!=='replace_exercise')result.failures.push('excluded_current_exercise_requires_replacement_or_removal');}result.ok=!result.failures.length;return result;}
 if(changes.length!==1||v.changes.length!==1||v.kind!=='MODIFY')return {ok:false,failures:['distribution_must_be_atomic'],warnings:[]};
 // Validate factual claims, supported signals and training-only explanation with the old contract.
 const base=Weekly.semantic({...v,schema_version:Weekly.SCHEMA_VERSION,kind:'REVIEW',changes:[]},ctx),result=inspect(changes[0],ctx);
 result.failures=[...new Set([...base.failures,...result.failures])];result.warnings=[...new Set([...base.warnings,...result.warnings])];result.ok=!result.failures.length;return result;
}
export const PROMPT=Weekly.PROMPT+`\nExtensión premium-session-distribution-v1: devuelve schema_version premium-weekly-distribution-v1. Una disponibilidad de cuatro días NO exige cuatro sesiones. KEEP y REVIEW siguen siendo válidos. Si hay una justificación para añadir, eliminar o mover sesiones, usa un único change_session_distribution; no mezcles otros changes. sessions describe el resultado COMPLETO, en orden; cada sesión declara keep_session/move_session/add_session, session_ref, weekday, minutes y todos sus ejercicios con catalogue_id y planned_sets completos. day_N y exercise_N existentes conservan identidad; nuevos usan new_day_N/new_exercise_N. removed_sessions enumera cada sesión omitida; removed_exercises enumera cada ejercicio omitido y su motivo. Nunca pierdas ni dupliques ejercicios silenciosamente. El contenido de una sesión eliminada debe redistribuirse o eliminarse expresamente. Usa solo distribution_availability y allowed_replacements; excluidos no pueden seleccionarse aunque existan en el baseline histórico. Añadir un día puede redistribuir exactamente el volumen. Un aumento de series debe tener volume_reason separado y explícito; null si no aumenta. No reduzcas descansos para encajar volumen: reduce redundancias explícitamente. La propuesta no aplica nada; requiere reviewer y aceptación humana. Conserva facts/historial insuficiente, no inventes tendencias.`;
export function requestBody(ctx){return {...Weekly.requestBody(ctx),instructions:PROMPT,text:{format:{type:'json_schema',name:'premium_weekly_distribution_v1',strict:true,schema:SCHEMA}}};}
export const cost=Weekly.cost;
export async function analyze(ctx,key,fetcher=fetch){
 const q=contextQuality(ctx);if(!q.ok)return {output:null,error:'invalid_weekly_context',quality:{...q,warnings:[]},receipt:{model:MODEL,prompt_version:PROMPT_VERSION,response_schema_version:SCHEMA_VERSION,status:0}};
 const r=await Weekly.analyze(ctx,key,(url,init)=>fetcher(url,{...init,body:JSON.stringify(requestBody(ctx))}));
 if(r.output&&[null,'invalid_recommendation'].includes(r.error)){r.quality=semantic(r.output,ctx);r.error=r.quality.ok?null:'invalid_recommendation';}
 r.receipt.prompt_version=PROMPT_VERSION;r.receipt.response_schema_version=SCHEMA_VERSION;r.receipt.schema_valid=r.output?validate(r.output):null;r.receipt.semantic_valid=r.output?!!r.quality?.ok:null;return r;
}
