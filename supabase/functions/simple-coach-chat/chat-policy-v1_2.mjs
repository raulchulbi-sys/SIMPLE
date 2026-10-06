// Additive v1.2. Historical v1/v1.1 remain unchanged.
import * as Legacy from './chat-contract.mjs';
import * as V11 from './chat-policy-v1_1.mjs';
import * as Series from '../simple-coach-premium/series-contract.mjs';
import * as Rx from './replacement-prescription-v1.mjs';
export * from './chat-policy-v1_1.mjs';
export const PROMPT_VERSION='premium-chat-v1.2',SELECTION_VERSION='premium-chat-selection-v1.2';
export const SCHEMA=V11.SCHEMA,validate=V11.validate;
const Q=globalThis.SimpleCoachProgrammingV5;
export function semantic(v,ctx){
 if(!validate(v))return {ok:false,failures:['schema_invalid'],warnings:[]};
 const result=Legacy.semantic({...v,suggested_action:'none',recommendation_candidate:null},ctx),c=v.recommendation_candidate;
 if((v.suggested_action==='propose_recommendation')!==(c!==null))result.failures.push('action_candidate_mismatch');
 if(c){
  const replacements=c.changes.filter(x=>x.action==='replace_exercise'),other=c.changes.filter(x=>x.action!=='replace_exercise');
  const q=Series.semantic({...c,changes:other,kind:other.length?'MODIFY':'KEEP'},ctx.training);result.failures.push(...q.failures);result.warnings.push(...q.warnings);
  if(!['MODIFY','REVIEW'].includes(c.kind)||(c.kind==='MODIFY')!==(c.changes.length>0))result.failures.push('kind_changes');
  const seen=new Set();
  for(const ch of replacements){
   const e=ctx.training.routine.exercises.find(x=>x.ref===ch.exercise_ref);
   if(!e||!e.catalogue_id||ch.from_catalogue_id!==e.catalogue_id){result.failures.push('unmapped_or_stale_target');continue;}
   if(seen.has(e.ref)||other.some(x=>x.exercise_ref===e.ref))result.failures.push('duplicate_or_conflicting_change');seen.add(e.ref);
   if(!c.facts.some(f=>f.exercise_ref===e.ref&&f.claim===e.metrics.trend))result.failures.push('missing_target_evidence');
   if(ctx.training.chat_selection_version!==SELECTION_VERSION||!ctx.training.allowed_replacements.some(x=>x.id===ch.to_catalogue_id))result.failures.push('replacement_denied');
   try{
    const p=Rx.plan(e.catalogue_id,ch.to_catalogue_id,Series.sets(e),e.scheme||'straight',ctx.training.intake),m=Q.byId.get(ch.to_catalogue_id),source=Q.byId.get(e.catalogue_id);
    if(e.prescription_format==='unresolved')throw Error('unresolved_prescription');
    if(p.scheme!==(e.scheme||'straight'))result.warnings.push('replacement_structure_recalculated:'+e.ref);
    if(m.fatigue_cost==='high'&&source.fatigue_cost!=='high')result.warnings.push('replacement_fatigue_increased:'+e.ref);
    for(const s of p.planned_sets){if(s.rir===0&&Q.costly(m))result.warnings.push('high_cost_failure:'+e.ref+':set_'+s.set_number);if(Q.uncertain(ctx.training.intake)&&s.rir<3)result.warnings.push('effort_uncertain:'+e.ref);}
   }catch(err){result.failures.push(err.message);}
  }
  if(replacements.length){if(other.length)result.failures.push('replacement_must_be_atomic');try{Rx.duration(ctx.training,replacements);}catch(err){result.failures.push(err.message);}}
  if(c.changes.length>1)result.warnings.push('multiple_changes_require_review');
 }
 result.failures=[...new Set(result.failures)];result.warnings=[...new Set(result.warnings)];result.ok=!result.failures.length;return result;
}
export const PROMPT=Legacy.PROMPT+`
premium-chat-v1.2: Coach elige de allowed_replacements, sin exigir preferencias ni forzar MODIFY. Material no es preferencia; varias opciones razonables no implican REVIEW. Conserva función/músculos/semana/series, sin aliases por nombre.
replace_exercise NO copia ciegamente: servidor premium-replacement-prescription-v1 revalida. Equivalente = mismo patrón/tipo/estabilidad/fatiga: conserva objetivos válidos; top_backoff/variable solo en compound equivalente, no principiante ni esfuerzo incierto; si no, straight. Recalcular objetivos inválidos/no equivalentes: accesorio/abdomen 10–15, otros 8–12 dentro del catálogo; RIR3 <1 año/incierto, RIR2 resto. Mínimo RIR2 <1 año, RIR3 incierto; RIR0 solo fallo controlable.
Descanso V5 nuevo: alto coste180s,240s si RIR<=1 o reps_min<=8; compound150s,180s si RIR<=1 o reps_min<=8 o inestable; accesorio90s,150s a RIR0,120s si reps_max>=15 o inestable o RIR1. Equivalente conserva descanso válido (mínimos180/150/90s; accesorio RIR0:120s); compound RIR<=1 exige preferido. Explica la NUEVA prescripción, no objetivos antiguos recalculados. No acortar descanso para encajar volumen. Backend valida material/exclusiones/reps/RIR/descanso/series/duración/fatiga; conserva warnings.
No mezclar reemplazos y otras acciones. REVIEW sin cambios ante bloqueo real de identidad/prescripción/material/contexto/tiempo: explica qué falta. No aplicar ni aprobar; propuesta pendiente.`;
export function requestBody(ctx,tokens=Legacy.MAX_OUTPUT){return {...Legacy.requestBody(ctx,tokens),instructions:PROMPT,text:{format:{type:'json_schema',name:'premium_chat_v1_2',strict:true,schema:SCHEMA}}};}
export const analyze=(ctx,key,fetcher=fetch,tokens=Legacy.MAX_OUTPUT)=>Legacy.analyze(ctx,key,fetcher,tokens,{requestBody,semantic,promptVersion:PROMPT_VERSION});
