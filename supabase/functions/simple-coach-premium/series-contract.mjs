/* Additive per-set contract. Historical v1 validation remains unchanged. */
import * as V1 from './contract.mjs';
export const MODEL=V1.MODEL,MAX_OUTPUT=V1.MAX_OUTPUT,CATALOGUE=V1.CATALOGUE,CLAIMS=V1.CLAIMS;
export const PROMPT_VERSION='premium-analysis-v1.1',SCHEMA_VERSION='premium-recommendation-v2';
const obj=p=>({type:'object',properties:p,required:Object.keys(p),additionalProperties:false});
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const en=a=>({type:'string',enum:a}),ref={type:'string',minLength:1,maxLength:32};
export const SET_SCHEMA=obj({reps_min:integer(5,20),reps_max:integer(5,20),rir:integer(0,4),rest_seconds:integer(60,300)});
const FROM_SCHEMA=obj({...SET_SCHEMA.properties,rir:integer(0,5),rest_seconds:integer(30,300)});
const perSet=[
 obj({action:en(['change_set']),exercise_ref:ref,set_number:integer(1,12),from:FROM_SCHEMA,to:SET_SCHEMA}),
 obj({action:en(['remove_set']),exercise_ref:ref,set_number:integer(1,12),from:FROM_SCHEMA}),
 obj({action:en(['add_set']),exercise_ref:ref,set_number:integer(2,12),to:SET_SCHEMA})
];
export const SCHEMA={...V1.SCHEMA,properties:{...V1.SCHEMA.properties,schema_version:en([SCHEMA_VERSION]),changes:{...V1.SCHEMA.properties.changes,items:{anyOf:[...V1.SCHEMA.properties.changes.items.anyOf,...perSet]}}}};
export const validate=(v,s)=>V1.validate(v,s||(v?.schema_version===V1.SCHEMA_VERSION?V1.SCHEMA:SCHEMA));
const fields=['reps_min','reps_max','rir','rest_seconds'];
export const prescription=s=>Object.fromEntries(fields.map(k=>[k,s[k]]));
export function sets(e){
 if(Array.isArray(e.planned_sets))return e.planned_sets.length>0&&e.planned_sets.length<=12&&e.planned_sets.every((s,i)=>s.set_number===i+1&&fields.every(k=>Number.isInteger(s[k]))&&s.reps_min>=5&&s.reps_max<=20&&s.reps_min<=s.reps_max&&s.rir>=0&&s.rir<=5&&s.rest_seconds>=30&&s.rest_seconds<=300)?e.planned_sets:null;
 if(e.prescription_format&&e.prescription_format!=='legacy_uniform_projection')return null;
 const p=e.prescription,m=/^(\d+)(?:-(\d+))?$/.exec(p?.reps||'');
 if(!m||!Number.isInteger(p.sets)||p.sets<1||p.sets>12||!/^[0-5]$/.test(String(p.rir)))return null;
 return Array.from({length:p.sets},(_,i)=>({set_number:i+1,reps_min:+m[1],reps_max:+(m[2]||m[1]),rir:+p.rir,rest_seconds:p.rest_seconds}));
}
const same=(a,b)=>fields.every(k=>a?.[k]===b?.[k]);
export const heterogeneous=e=>{const ss=sets(e);return !ss||ss.some(s=>!same(s,ss[0]));};
export function applySetChanges(initial,changes){
 let ss=structuredClone(initial);
 for(const c of changes){
  if(c.action==='change_set')ss[c.set_number-1]={set_number:c.set_number,...c.to};
  if(c.action==='remove_set')ss=ss.filter(s=>s.set_number!==c.set_number).map((s,i)=>({...s,set_number:i+1}));
  if(c.action==='add_set')ss.push({set_number:c.set_number,...c.to});
 }
 return ss;
}
export function semantic(v,ctx){
 if(!validate(v))return {ok:false,failures:['schema_invalid'],warnings:[]};
 if(v.schema_version===V1.SCHEMA_VERSION){
  const result=V1.semantic(v,ctx);
  if(v.changes.some(c=>['change_sets','change_reps','change_rir','change_rest','replace_exercise'].includes(c.action)&&heterogeneous(ctx.routine.exercises.find(e=>e.ref===c.exercise_ref)||{})))result.failures.push('uniform_change_on_individual_sets');
  result.ok=result.failures.length===0;return result;
 }
 const old=v.changes.filter(c=>!['change_set','remove_set','add_set'].includes(c.action));
 const result=V1.semantic({...v,schema_version:V1.SCHEMA_VERSION,kind:old.length?'MODIFY':'KEEP',changes:old},ctx);
 const fail=x=>result.failures.push(x),warn=x=>result.warnings.push(x);
 if((v.kind==='MODIFY')!==(v.changes.length>0))fail('kind_changes');
 for(const c of old){const e=ctx.routine.exercises.find(e=>e.ref===c.exercise_ref);if(e&&['change_sets','change_reps','change_rir','change_rest','replace_exercise'].includes(c.action)&&heterogeneous(e))fail('uniform_change_on_individual_sets');}
 const byRef=new Map(ctx.routine.exercises.map(e=>[e.ref,e]));
 for(const [ref,e] of byRef){
  const changes=v.changes.filter(c=>c.exercise_ref===ref&&['change_set','remove_set','add_set'].includes(c.action));if(!changes.length)continue;
  const ss=sets(e),seen=new Set();
  if(!e.catalogue_id||!ss||e.prescription_format==='unresolved'){fail('unresolved_prescription');continue;}
  if(old.some(c=>c.exercise_ref===ref)){fail('conflicting_changes');continue;}
  if(!v.facts.some(f=>f.exercise_ref===ref))fail('missing_target_evidence');
  if(changes.filter(c=>c.action!=='change_set').length>1||changes.some(c=>c.action!=='change_set')&&changes.length>1)fail('conflicting_volume_changes');
  for(const c of changes){
   if(seen.has(c.set_number))fail('duplicate_set_target');seen.add(c.set_number);
   const current=ss.find(s=>s.set_number===c.set_number);
   if(c.action==='add_set'){
    if(c.set_number!==ss.length+1||ss.length>=4)fail('invalid_append');
   }else{
    if(!current||!same(c.from,current))fail('stale_set_from');
    if(c.action==='remove_set'&&ss.length<=1)fail('empty_volume');
   }
   if(c.to){
    if(c.to.reps_min>c.to.reps_max)fail('reps_bounds');
    if(c.action==='change_set'&&same(c.from,c.to))fail('empty_set_change');
    if(['lt6','m6_12'].includes(ctx.intake.experience)&&c.to.rir<2)fail('beginner_rir');
    const meta=globalThis.SimpleCoachProgrammingV5.byId.get(e.catalogue_id);
    if(meta){const b=globalThis.SimpleCoachProgrammingV5.bounds(meta);if(c.to.reps_min<b.reps[0]||c.to.reps_max>b.reps[1])fail('catalogue_reps_bounds');const g=globalThis.SimpleCoachProgrammingV5.restGuidance(meta,c.to);if(c.to.rest_seconds<g.minimum)warn('rest_below_demand:'+ref+':set_'+c.set_number);if(c.to.rir===0&&meta.fatigue_cost==='high')warn('high_cost_failure:'+ref+':set_'+c.set_number);}
   }
   if(['insufficient_data','context_changed_or_incomplete'].includes(e.metrics.trend))warn('limited_comparable_evidence:'+ref);
  }
 }
 for(const c of v.changes)if(!byRef.has(c.exercise_ref))fail('unmapped_target');
 if(v.changes.length>1)warn('multiple_changes_require_review');
 result.failures=[...new Set(result.failures)];result.warnings=[...new Set(result.warnings)];result.ok=!result.failures.length;return result;
}
export const PROMPT=V1.PROMPT.replace('premium-recommendation-v1',SCHEMA_VERSION).replace('Contexto contiene prescripción legacy uniforme por ejercicio, explícitamente proyectada a planned_sets. No alteres/escondas una arquitectura individualizada: si necesitas top set/back-off o un cambio por serie no representable aquí, REVIEW. No atribuir a estas proyecciones series históricas que no se registraron.',
 'Cada ejercicio contiene planned_sets numéricos por serie. Son la prescripción completa de la revisión base; el resumen prescription NO sustituye las series. Top set/back-off son objetivos distintos, no un tipo mágico. Compara cada serie por separado con el plan de su exposición cuando prescription_source lo permita; unknown o legacy_reported_uniform reconoce menor granularidad. No inventes prescripciones históricas ni compares pesos de top set y back-off como si fueran el mismo objetivo. Unmapped/unresolved o prescription_issue requiere REVIEW si impide decidir con seguridad.').replace('premium-analysis-v1.',PROMPT_VERSION+'.')+
 '\nCambios por serie: change_set apunta a set_number existente, from y to incluyen reps_min/reps_max/rir/rest_seconds completos. remove_set declara EXACTAMENTE la serie retirada y su from; las restantes conservan objetivos y su orden relativo, renumeradas 1..N en la NUEVA revisión. add_set solo añade al final, set_number=N+1 y to completo. Una sola adición/eliminación por ejercicio, +/-1; no mezclar volumen con otro cambio de ese ejercicio. Nunca asumir qué serie sobra. No destruir las demás series. Acciones uniformes v1 solo sobre legacy uniforme; no sobre objetivos distintos. REVIEW sin cambios para contradicciones o contexto ambiguo que impida una aplicación segura; evidencia escasa puede justificar KEEP sin atribuir tendencias. No fuerces MODIFY para satisfacer un caso de prueba.';
export function requestBody(ctx){return {...V1.requestBody(ctx),instructions:PROMPT,text:{format:{type:'json_schema',name:'premium_recommendation_v2',strict:true,schema:SCHEMA}}};}
export const cost=V1.cost;
export async function analyze(ctx,key,fetcher=fetch){
 const r=await V1.analyze(ctx,key,(url,init)=>fetcher(url,{...init,body:JSON.stringify(requestBody(ctx))}));
 if(r.output&&['invalid_recommendation',null].includes(r.error)){
  r.quality=semantic(r.output,ctx);r.error=r.quality.ok?null:'invalid_recommendation';
 }
 r.receipt.prompt_version=PROMPT_VERSION;r.receipt.response_schema_version=SCHEMA_VERSION;return r;
}
