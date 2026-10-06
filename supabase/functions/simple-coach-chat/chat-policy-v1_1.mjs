// Additive Chat policy. Historical v1 prompt and weekly/Basic contracts remain unchanged.
import * as Legacy from './chat-contract.mjs';
import * as Series from '../simple-coach-premium/series-contract.mjs';
export * from './chat-contract.mjs';
export const PROMPT_VERSION='premium-chat-v1.1';
export const SELECTION_VERSION='premium-chat-selection-v1.1';
const Q=globalThis.SimpleCoachProgrammingV5;
export const SCHEMA=structuredClone(Legacy.SCHEMA);
const changes=SCHEMA.properties.recommendation_candidate.anyOf[0].properties.changes.items.anyOf;
changes.find(x=>x.properties.action.enum.includes('replace_exercise')).properties.to_catalogue_id.enum=Q.catalogue.map(x=>x.id);
function node(v,s){if(s.type==='null')return v===null;if(s.anyOf)return s.anyOf.some(x=>node(v,x));if(s.type==='object')return v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===s.required.length&&s.required.every(k=>Object.hasOwn(v,k)&&node(v[k],s.properties[k]));if(s.type==='array')return Array.isArray(v)&&v.length>=(s.minItems||0)&&v.length<=(s.maxItems??Infinity)&&v.every(x=>node(x,s.items));return Series.validate(v,s);}
export const validate=v=>node(v,SCHEMA);
export function semantic(v,ctx){
 if(!validate(v))return {ok:false,failures:['schema_invalid'],warnings:[]};
 const result=Legacy.semantic({...v,suggested_action:'none',recommendation_candidate:null},ctx);
 const fail=s=>result.failures.push(s),warn=s=>result.warnings.push(s),c=v.recommendation_candidate;
 if((v.suggested_action==='propose_recommendation')!==(c!==null))fail('action_candidate_mismatch');
 if(c){
  const replacements=c.changes.filter(x=>x.action==='replace_exercise'),other=c.changes.filter(x=>x.action!=='replace_exercise');
  const q=Series.semantic({...c,changes:other,kind:other.length?'MODIFY':'KEEP'},ctx.training);result.failures.push(...q.failures);result.warnings.push(...q.warnings);
  if(!['MODIFY','REVIEW'].includes(c.kind)||(c.kind==='MODIFY')!==(c.changes.length>0))fail('kind_changes');
  const seen=new Set();
  for(const ch of replacements){
   const e=ctx.training.routine.exercises.find(x=>x.ref===ch.exercise_ref),m=Q.byId.get(ch.to_catalogue_id),ss=e&&Series.sets(e),source=e&&Q.byId.get(e.catalogue_id);
   if(!e||!e.catalogue_id||ch.from_catalogue_id!==e.catalogue_id)fail('unmapped_or_stale_target');
   if(seen.has(ch.exercise_ref)||other.some(x=>x.exercise_ref===ch.exercise_ref))fail('duplicate_or_conflicting_change');seen.add(ch.exercise_ref);
   if(!c.facts.some(f=>f.exercise_ref===ch.exercise_ref&&f.claim===e?.metrics.trend))fail('missing_target_evidence');
   if(ctx.training.chat_selection_version!==SELECTION_VERSION||!m||!source||!ctx.training.allowed_replacements.some(x=>x.id===m.id)||ctx.training.intake.excluded?.includes(m.id)||!m.requires.every(k=>ctx.training.intake.inventory?.equipment?.includes(k))||m.id===e?.catalogue_id)fail('replacement_denied');
   if(m&&source&&m.group!==source.group)fail('replacement_function_mismatch');
   if(!ss||e.prescription_format==='unresolved')fail('unresolved_prescription');
   if(m&&ss){const b=Q.bounds(m);for(const s of ss){if(s.reps_min<b.reps[0]||s.reps_max>b.reps[1])fail('replacement_reps_bounds');if(['lt6','m6_12'].includes(ctx.training.intake.experience)&&s.rir<2)fail('beginner_rir');if(s.rest_seconds<Q.restGuidance(m,s).minimum)warn('rest_below_demand:'+ch.exercise_ref+':set_'+s.set_number);}}
  }
  if(c.changes.length>1)warn('multiple_changes_require_review');
 }
 result.failures=[...new Set(result.failures)];result.warnings=[...new Set(result.warnings)];result.ok=!result.failures.length;return result;
}
export const PROMPT=Legacy.PROMPT+`\nPolítica premium-chat-v1.1 de selección: SIMPLE Coach decide los ejercicios. El atleta aporta contexto, material y exclusiones; no elige qué incluir. No preguntes qué sustituto prefiere como requisito. La ausencia de preferencia o varias alternativas razonables NO justifican REVIEW por sí solas. El material disponible NO es una preferencia. Ante una petición concreta de revisar un ejercicio heredado actualmente excluido, evalúa allowed_replacements y metadata: función/grupo/patrón, objetivo de hipertrofia, experiencia, sesión, volumen semanal y fatiga. Puedes elegir una alternativa razonable y producir MODIFY para revisión humana; no estás obligado a cambiar. Para abdomen distingue estabilidad context_only de trabajo dinámico progresable, usando metadata, sin equivalencias fijas por nombre. Nunca propongas un excluido o material ausente. replace_exercise usa el target y from_catalogue_id exactos, y to_catalogue_id permitido. El servidor conserva automáticamente TODAS sus planned_sets completas y el scheme, incluida cada serie top set/back-off; no aplana series ni aumenta volumen. Elige una alternativa compatible con esas prescripciones; explica sets/reps/RIR/descansos heredados, sin inventar pesos. No mezcles otra modificación en el mismo target. REVIEW sin cambios si falta realmente mapping, prescripción, metadata o una alternativa compatible, hay conflicto o el contrato no permite una decisión segura; describe el dato que falta, no una preferencia inexistente. No sugieras que la revisión humana ya aprobó o aplicó la propuesta.`;
export function requestBody(ctx,tokens=Legacy.MAX_OUTPUT){return {...Legacy.requestBody(ctx,tokens),instructions:PROMPT,text:{format:{type:'json_schema',name:'premium_chat_v1_1',strict:true,schema:SCHEMA}}};}
export const analyze=(ctx,key,fetcher=fetch,tokens=Legacy.MAX_OUTPUT)=>Legacy.analyze(ctx,key,fetcher,tokens,{requestBody,semantic,promptVersion:PROMPT_VERSION});
