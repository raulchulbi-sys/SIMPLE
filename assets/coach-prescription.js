/* Schema-2 presentation uses accepted revision UUIDs, never names/indices as identity. */
async function coachPrepareTargets(routine,owner){
 if(!coachEnabled())return;
 const hints=await coachReadRoutineHints(routine,owner);
 if(hints===null)throw Error('No se pudo comprobar la prescripción por serie. Vuelve a abrir la sesión.');
 if(user?.id===owner)simpleCoach.routineHints={owner,routine,byId:hints};
}
function coachV5SetsValid(ss){return Array.isArray(ss)&&ss.length>=1&&ss.length<=4&&ss.every((s,i)=>s&&s.set_number===i+1&&['reps_min','reps_max','rir','rest_seconds'].every(k=>Number.isInteger(s[k]))&&s.reps_min>=5&&s.reps_max<=20&&s.reps_min<=s.reps_max&&s.rir>=0&&s.rir<=4&&s.rest_seconds>=60&&s.rest_seconds<=300);}
function coachV5RevisionHints(revision,operation,routine,owner){
 const s=revision?.snapshot;if(operation.state!=='accepted'||operation.routine_id!==routine||operation.user_id!==owner||revision?.routine_id!==routine||revision.user_id!==owner||revision.operation_id!==operation.id||s?.id!==routine||s?.owner_id!==owner||!Array.isArray(s.days))return null;
 const map=new Map(),seen=new Set(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 for(const d of s.days){if(!Array.isArray(d.exercises))return null;for(const e of d.exercises){
  if(!uuid.test(e.id||'')||!uuid.test(d.id||'')||e.day_id!==d.id||seen.has(e.id)||!coachV5SetsValid(e.planned_sets)||e.sets!==e.planned_sets.length)return null;seen.add(e.id);
  const m=SimpleCoachProgrammingV5.byName.get(e.name),first=e.planned_sets[0];if(!m||['reps_min','reps_max','rir','rest_seconds'].some(k=>first[k]!==e[k]))return null;
  map.set(e.id,Object.freeze({version:2,unilateral:m.unilateral,sets:structuredClone(e.planned_sets),target:first.reps_min+'-'+first.reps_max,rir:String(first.rir),rest:first.rest_seconds}));
 }}map.schemaVersion=2;return map;
}
function coachAssertTargets(exercises,routine){
 const h=simpleCoach.routineHints;if(h?.owner!==user?.id||h?.routine!==routine||h.byId?.schemaVersion!==2)return;
 if(!Array.isArray(exercises)||exercises.some(e=>!coachV5Prescription(e,routine)))throw Error('La estructura no coincide con la prescripción por serie. No se pueden mostrar objetivos seguros.');
}
function coachV5Prescription(e,routine,locked=false){
 if(locked)return null;const h=simpleCoach.routineHints;if(h?.owner!==user?.id||h?.routine!==routine)return null;
 const p=h.byId?.get(e.id);if(p?.version!==2)return null;
 // Caller checks mismatches before opening a v5 workout. Never override current fields from a stale revision.
 if(Number(e.sets)!==p.sets.length||String(e.target)!==p.target||String(e.rir)!==p.rir||Number(e.rest_seconds)!==p.rest)return null;
 return p.sets;
}
function coachV5Line(s,suffix=''){return s.reps_min+'–'+s.reps_max+' reps'+suffix+' · RIR '+s.rir+' · '+SimpleCoachProgrammingV5.minutes(s.rest_seconds);}
function coachV5SetTarget(e,routine,index,locked){const ss=coachV5Prescription(e,routine,locked);return ss?.[index]?'<div class="coach-set-target" id="coach-target-'+e.id+'-'+index+'">Serie '+(index+1)+' · '+esc(coachV5Line(ss[index],coachRepetitionSuffix(e,routine,locked)))+'</div>':'';}
function coachV5ProposalMarkup(p){
 const q=SimpleCoachProgrammingV5;if(p?.schema_version!==2||!Array.isArray(p.days))return '<p role="alert">No se pudo interpretar esta propuesta.</p>';
 return '<h3>'+esc(p.name)+'</h3><p>'+esc(p.description)+'</p><p>'+p.days.length+' días · duración orientativa, no medida</p>'+p.days.map(d=>'<section class="coach-day"><h4>'+esc(d.name)+' · ≈ '+Math.ceil((300+d.exercises.reduce((n,e)=>n+q.seconds(e),0))/60)+' min</h4>'+d.exercises.map(e=>'<div class="coach-prescription"><b>'+esc(e.name)+'</b>'+(e.scheme==='top_backoff'?'<span class="muted"> · Top set + back-off</span>':'')+'<ol>'+e.planned_sets.map(s=>'<li>'+esc(coachV5Line(s,q.byName.get(e.name)?.unilateral?' por lado':''))+'</li>').join('')+'</ol></div>').join('')+'</section>').join('');
}
