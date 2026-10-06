// Chat-only deterministic prescription policy; Basic and historical v1.1 are immutable.
import * as Series from '../simple-coach-premium/series-contract.mjs';
export const VERSION='premium-replacement-prescription-v1';
const Q=globalThis.SimpleCoachProgrammingV5;
const compound=m=>['compound','machine_compound'].includes(m.type);
export function plan(sourceId,destinationId,oldSets,scheme,intake){
 const a=Q.byId.get(sourceId),b=Q.byId.get(destinationId);
 if(!a||!b||a.id===b.id||a.group!==b.group||!a.primary.some(g=>b.primary.includes(g)))throw Error('replacement_function_mismatch');
 if(intake.excluded?.includes(b.id)||!b.requires.every(k=>intake.inventory?.equipment?.includes(k)))throw Error('replacement_denied');
 if(!Array.isArray(oldSets)||!oldSets.length||oldSets.length>12)throw Error('unresolved_prescription');
 const beginner=Q.beginner(intake),uncertain=Q.uncertain(intake),bound=Q.bounds(b);
 if(oldSets.length>(beginner?3:4))throw Error('unresolved_prescription');
 const equivalent=a.pattern===b.pattern&&a.type===b.type&&a.stable===b.stable&&a.fatigue_cost===b.fatigue_cost;
 const keepStructure=equivalent&&(!['top_backoff','variable'].includes(scheme)||(compound(b)&&!beginner&&!uncertain));
 const floor=Math.max(beginner?2:0,uncertain?3:0);
 const baseRir=beginner||uncertain?3:2;
 const next=oldSets.map((s,i)=>{
  if(s.set_number!==i+1||!['reps_min','reps_max','rir','rest_seconds'].every(k=>Number.isInteger(s[k]))||s.reps_min>s.reps_max)throw Error('unresolved_prescription');
  const preserve=equivalent&&keepStructure;
  const validReps=preserve&&s.reps_min>=bound.reps[0]&&s.reps_max<=bound.reps[1];
  const accessory=['accessory','dynamic_abs'].includes(b.rep_range_category);
  const reps_min=validReps?s.reps_min:accessory?10:8,reps_max=validReps?s.reps_max:accessory?15:12;
  let rir=preserve&&s.rir>=floor&&s.rir<=4?s.rir:baseRir;
  if(rir===0&&!b.failure_suitable)rir=1;
  const reference=Q.restGuidance(b,{reps_min,reps_max,rir});
  const required=compound(b)&&rir<=1?reference.preferred:reference.minimum;
  const rest_seconds=preserve&&s.rest_seconds>=required&&s.rest_seconds<=300?s.rest_seconds:reference.preferred;
  return {set_number:i+1,reps_min,reps_max,rir,rest_seconds};
 });
 if(!Series.sets({planned_sets:next})||next.some(s=>s.reps_min<bound.reps[0]||s.reps_max>bound.reps[1]||s.rir<floor||s.rest_seconds<Q.restGuidance(b,s).minimum))throw Error('replacement_prescription_invalid');
 return {planned_sets:next,scheme:keepStructure?scheme:'straight',prescription_policy:VERSION};
}
export function duration(training,changes){
 const totals=new Map(),before=new Map(),cap=Object.values(training.intake.minutes_by_day||{}).filter(x=>Number.isFinite(x)&&x>0);
 const fallback=training.intake.minutes>0?training.intake.minutes:cap.length?Math.min(...cap):null;
 for(const e of training.routine.exercises){
  const old=Series.sets(e),m=Q.byId.get(e.catalogue_id);if(!old||!m)throw Error('replacement_duration_unresolved');
  const day=e.day_ref,patch=changes.find(x=>x.action==='replace_exercise'&&x.exercise_ref===e.ref);
  const n=patch?Q.byId.get(patch.to_catalogue_id):m;
  const ss=patch?plan(e.catalogue_id,n.id,old,e.scheme||'straight',training.intake).planned_sets:old;
  const seconds=(meta,sets)=>120+sets.reduce((sum,s)=>sum+s.reps_max*4*(meta.unilateral?2:1)+s.rest_seconds+(meta.unilateral?15:0),0);
  before.set(day,(before.get(day)||300)+seconds(m,old));totals.set(day,(totals.get(day)||300)+seconds(n,ss));
 }
 for(const [day,total] of totals){const minutes=training.replacement_schedule?.find(s=>s.day_ref===day)?.minutes||fallback;
  if(minutes===null)throw Error('replacement_duration_unresolved');
  if(total>minutes*60*.9&&total>before.get(day))throw Error('replacement_duration_exceeded');
 }
 return [...totals].map(([day_ref,seconds])=>({day_ref,seconds}));
}
