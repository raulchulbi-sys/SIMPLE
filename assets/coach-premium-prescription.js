/* Read-only bridge from delivered Premium revisions to the existing training renderer. */
(function(scope){
'use strict';
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const integer=(v,lo,hi)=>Number.isInteger(v)&&v>=lo&&v<=hi;
const valid=ss=>Array.isArray(ss)&&ss.length>=1&&ss.length<=12&&ss.every((s,i)=>s&&Object.keys(s).sort().join(',')==='reps_max,reps_min,rest_seconds,rir,set_number'&&s.set_number===i+1&&integer(s.reps_min,5,20)&&integer(s.reps_max,s.reps_min,20)&&integer(s.rir,0,5)&&integer(s.rest_seconds,30,300));
function sets(e){
 if(Object.hasOwn(e,'planned_sets'))return valid(e.planned_sets)&&e.sets===e.planned_sets.length?structuredClone(e.planned_sets):null;
 let lo=e.reps_min,hi=e.reps_max;if(lo===undefined&&hi===undefined&&/^\d{1,2}(-\d{1,2})?$/.test(e.target||'')){[lo,hi]=String(e.target).split('-').map(Number);hi=hi??lo;}
 const rir=/^[0-5]$/.test(String(e.rir))?Number(e.rir):null;
 if(!integer(e.sets,1,12)||!integer(lo,5,20)||!integer(hi,lo,20)||!integer(rir,0,5)||!integer(e.rest_seconds,30,300))return null;
 return Array.from({length:e.sets},(_,i)=>({set_number:i+1,reps_min:lo,reps_max:hi,rir,rest_seconds:e.rest_seconds}));
}
function hints(revision,management,routine,owner,bindings={}){
 if(!uuid(routine)||!uuid(owner)||management?.plan_kind!=='premium'||management.routine_id!==routine||management.user_id!==owner||!uuid(management.current_revision_id)||revision?.id!==management.current_revision_id||revision.routine_id!==routine||revision.user_id!==owner||!['basic','premium_baseline','premium_recommendation'].includes(revision.origin))return null;
 if(revision.origin==='basic'&&(revision.operation_id!==management.operation_id||!uuid(revision.operation_id)))return null;
 if(revision.origin!=='basic'&&revision.operation_id!==null)return null;
 const s=revision.snapshot,base=s?.routine||s;if(base?.id!==routine||base.owner_id!==owner||!Array.isArray(s?.days)||!s.days.length)return null;
 const result=new Map(),seenDays=new Set();
 for(const d of s.days){if(!uuid(d.id)||seenDays.has(d.id)||d.routine_id!==routine||!Array.isArray(d.exercises)||!d.exercises.length)return null;seenDays.add(d.id);
  for(const e of d.exercises){const ss=sets(e),first=ss?.[0];if(!uuid(e.id)||e.day_id!==d.id||result.has(e.id)||!ss)return null;
   const target=first.reps_min+'-'+first.reps_max;
   if(e.sets!==ss.length||String(e.rir)!==String(first.rir)||e.rest_seconds!==first.rest_seconds||e.target!==undefined&&String(e.target)!==target||e.reps_min!==undefined&&e.reps_min!==first.reps_min||e.reps_max!==undefined&&e.reps_max!==first.reps_max)return null;
   // Exact catalogue bindings describe execution; names never resolve exercise identity.
   const metadata=scope.SimpleCoachProgrammingV5?.byId?.get(bindings[e.id]);
   result.set(e.id,Object.freeze({version:2,unilateral:metadata?.unilateral===true,sets:ss,target,rir:String(first.rir),rest:first.rest_seconds}));
  }
 }
 result.schemaVersion=2;result.premium=true;result.revisionId=revision.id;return result;
}
async function read(db,routine,owner){
 const m=await db.from('routine_management').select('routine_id,user_id,operation_id,current_revision_id,plan_kind').eq('routine_id',routine).maybeSingle();
 // The host can load this additive asset while the pre-Premium schema is still deployed.
 if(m.error){if(m.error.code==='42703')return {handled:false};throw m.error;}
 if(m.data?.plan_kind!=='premium')return {handled:false};
 const [r,c]=await Promise.all([db.from('routine_revisions').select('id,routine_id,user_id,operation_id,origin,snapshot').eq('id',m.data.current_revision_id).single(),db.from('coach_mesocycles').select('id,routine_id,user_id,current_revision_id,catalogue_bindings').eq('routine_id',routine).eq('current_revision_id',m.data.current_revision_id).order('created_at',{ascending:false}).limit(1).maybeSingle()]);
 if(r.error)throw r.error;if(c.error)throw c.error;
 if(c.data&&c.data.user_id!==owner)return {handled:true,hints:null};
 return {handled:true,hints:hints(r.data,m.data,routine,owner,c.data?.catalogue_bindings||{})};
}
function workoutRevision(value,owner,routine){return value?.owner===owner&&value.routine===routine&&value.byId?.premium===true&&uuid(value.byId.revisionId)?value.byId.revisionId:null;}
const API={valid,sets,hints,read,workoutRevision};scope.PremiumPrescription=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
