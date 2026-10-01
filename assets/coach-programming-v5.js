/* Versioned programming categories: heuristics, not physiological measurements. */
(function(root){
'use strict';
const I=root.SimpleCoachIntake,V4=root.SimpleCoachProgrammingV4;
const additions=[
 ['floor_crunch','Crunch en suelo',[]],['reverse_crunch','Crunch inverso',[]],
 ['weighted_crunch','Crunch lastrado',['dumbbells']],['cable_crunch','Crunch en polea',['cables']],
 ['machine_crunch','Crunch abdominal en máquina',['ab_machine']],['ab_wheel','Rueda abdominal',['ab_wheel']]
].map(([id,name,requires])=>({id,name,requires,group:'core',pattern:id==='ab_wheel'?'anti_extension':'trunk_flexion',primary:['core'],secondary:[],type:'isolation',family:id==='ab_wheel'?'rollout':'crunch',unilateral:false,stable:id!=='ab_wheel'}));
const newEquipment=[{id:'ab_machine',label:'Máquina abdominal',category:'shared'},{id:'ab_wheel',label:'Rueda abdominal',category:'shared'}];
const exercises=[...I.exercises,...additions],equipment=[...I.equipment,...newEquipment];
function basicErrors(t,full=true){
 if(!t||!Array.isArray(t.excluded)||!Array.isArray(t.inventory?.equipment))return I.basicErrors(t,full);
 const n=structuredClone(t);n.excluded=n.excluded.filter(x=>!additions.some(e=>e.id===x));n.inventory.equipment=n.inventory.equipment.filter(x=>!newEquipment.some(e=>e.id===x));
 const errors=I.basicErrors(n,full);
 if(new Set(t.excluded).size!==t.excluded.length||t.excluded.length>20)errors.push('excluded');
 if(new Set(t.inventory.equipment).size!==t.inventory.equipment.length)errors.push('inventory');
 return [...new Set(errors)];
}
function assertBasic(t,full=true){if(basicErrors(t,full).length)throw Error('coach_invalid_training');return structuredClone(t);}
function providerTraining(t){const n=assertBasic(t);n.inventory.custom=[];return n;}
const allowedExercises=t=>exercises.filter(e=>!t.excluded.includes(e.id)&&e.requires.every(k=>t.inventory.equipment.includes(k)));
root.SimpleCoachIntakeV5=Object.freeze({...I,exercises,equipment,basicErrors,assertBasic,providerTraining,allowedExercises});
const demanding=new Set(['bar_squat','bar_rdl','db_rdl','bar_row','bench_press','reverse_lunge','ab_wheel']);
const highFatigue=new Set(['bar_squat','bar_rdl','db_rdl','hack','pendulum','leg_press','horizontal_press','smith_squat','reverse_lunge']);
const catalogue=[...V4.catalogue,...additions].map(e=>Object.freeze({...e,
 technical_complexity:demanding.has(e.id)?'high':e.stable?'low':'moderate',
 fatigue_cost:highFatigue.has(e.id)?'high':['isolation','calf','core'].includes(e.type)?'low':'moderate',
 failure_suitable:!demanding.has(e.id)&&!['dead_bug','bird_dog','body_squat','glute_bridge'].includes(e.id)&&(e.stable||['isolation','calf'].includes(e.type)),
 rep_range_category:['dead_bug','bird_dog','ab_wheel'].includes(e.id)?'control':e.group==='core'?'dynamic_abs':['isolation','calf','accessory'].includes(e.type)?'accessory':'compound',
 hypertrophy_priority:['dead_bug','bird_dog'].includes(e.id)?'context_only':'normal'
}));
const byId=new Map(catalogue.map(e=>[e.id,e])),byName=new Map(catalogue.map(e=>[e.name,e]));
const beginner=t=>['lt6','m6_12'].includes(t.experience),uncertain=t=>['unknown','learning'].includes(t.effort);
function bounds(m){return {reps:m.rep_range_category==='control'?[6,15]:['accessory','dynamic_abs'].includes(m.rep_range_category)?[8,20]:[5,15],rest:[60,300]};}
// Review references, not physiological limits. Experience is deliberately not an input.
const costly=m=>m.fatigue_cost==='high'||m.id==='bench_press';
function restGuidance(m,s){
 const near=s.rir<=1,heavy=s.reps_min<=8;
 if(costly(m))return {minimum:180,preferred:near||heavy?240:180,upper:near&&heavy?300:240,reason:'high_cost'};
 if(['compound','machine_compound'].includes(m.type))return {minimum:150,preferred:near||heavy||!m.stable?180:150,upper:180,reason:'moderate_compound'};
 return {minimum:s.rir===0?120:90,preferred:s.rir===0?150:s.reps_max>=15||!m.stable||near?120:90,upper:150,reason:'accessory'};
}
const planned=e=>Array.isArray(e.planned_sets)?e.planned_sets:Array.from({length:e.sets},(_,i)=>({set_number:i+1,reps_min:e.reps_min,reps_max:e.reps_max,rir:e.rir,rest_seconds:e.rest_seconds}));
const signature=s=>[s.reps_min,s.reps_max,s.rir,s.rest_seconds].join('|');
const heterogeneous=e=>new Set(planned(e).map(signature)).size>1;
function seconds(e){const m=byName.get(e.name);return 120+planned(e).reduce((n,s)=>n+s.reps_max*4*(m?.unilateral?2:1)+s.rest_seconds+(m?.unilateral?15:0),0);}
const minutes=n=>Number.isFinite(Number(n))?new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(n)/60)+' min':'—';
function instruction(t){return (beginner(t)?'Prioriza técnica y constancia; empieza dejando 3–4 repeticiones posibles. ':uncertain(t)?'El RIR es orientativo; conserva margen mientras aprendes a estimarlo. ':'Respeta el RIR de cada serie. RIR 0 significa no poder completar otra repetición con técnica estable; no fuerces repeticiones. ')+
 'Progresa cada serie o bloque por separado: cuando alcances su techo de reps con el RIR indicado y técnica estable, aumenta ligeramente su carga. Ajusta la carga entre bloques si cambian los objetivos. No se automatizan pesos ni cambios de rutina.';}
function evaluate(p,t){
 const failures=[],warnings=[],muscles=Object.fromEntries(Object.keys(V4.labels).map(k=>[k,{direct:0,secondary:0,frequency:0,secondary_frequency:0}])),patterns={},unique=new Set(),families=new Map(),days=[];
 const allowed=new Set(allowedExercises(t).map(e=>e.id)),week=I.weekdays.filter(d=>t.weekdays.includes(d.id));
 const warn=(code,message,details={})=>warnings.push({code,message,...details});
 if(p.days.length!==t.days)failures.push('day_count');
 let rirSum=0,zero=0,one=0,variable=0;
 p.days.forEach((d,i)=>{
  if(d.name!==week[i]?.label)failures.push('unauthorized_day');
  const seen=new Set(),direct=new Set(),secondary=new Set(),costlyFailures=[];let duration=300,sets=0,legSets=0,zeros=0;
  for(const e of d.exercises){const m=byName.get(e.name);if(!m||!allowed.has(m.id)){failures.push('equipment_or_avoidance');continue;}
   if(seen.has(m.id))failures.push('duplicate_exercise');seen.add(m.id);unique.add(m.id);
   if(!families.has(m.family))families.set(m.family,new Set());families.get(m.family).add(m.id);
   const ss=planned(e),b=bounds(m);if(ss.length!==e.sets||ss.length<1||ss.length>(beginner(t)?3:4))failures.push('set_count');
   if(heterogeneous(e)){variable++;if(beginner(t))warn('beginner_complexity','Objetivos distintos entre series en principiante; revisar si aportan valor.',{day:d.name,exercise:e.name});}
   if(m.hypertrophy_priority==='context_only')warn('core_context_only','Core de estabilidad: justificar frente a una opción dinámica progresable.',{day:d.name,exercise:e.name});
   ss.forEach((s,j)=>{
    if(s.set_number!==j+1||!['reps_min','reps_max','rir','rest_seconds'].every(k=>Number.isInteger(s[k]))||s.reps_min<b.reps[0]||s.reps_max>b.reps[1]||s.reps_min>s.reps_max||s.rest_seconds<60||s.rest_seconds>300||s.rir<0||s.rir>4)failures.push('prescription_bounds');
    if(beginner(t)&&s.rir<2)failures.push('beginner_failure');
    if(beginner(t)&&s.rir===2)warn('beginner_effort','RIR 2 inicial: revisar aprendizaje y estimación del esfuerzo.',{day:d.name,exercise:e.name,set:s.set_number});
    if(uncertain(t)&&s.rir<3)warn('effort_uncertain','Esfuerzo exigente con estimación RIR insegura.',{day:d.name,exercise:e.name,set:s.set_number});
    if(s.rir===0){zero++;zeros++;if(costly(m))costlyFailures.push({exercise:e.name,set:s.set_number,primary:m.primary,allSetsToFailure:ss.length>1&&ss.every(x=>x.rir===0),shortRest:s.rest_seconds<restGuidance(m,s).preferred});if(!m.failure_suitable)warn('technical_failure','RIR 0 en movimiento con coste técnico elevado o contexto inadecuado.',{day:d.name,exercise:e.name,set:s.set_number});if(t.experience==='y1_2'&&j!==ss.length-1)warn('intermediate_failure_position','RIR 0 antes de la última serie en intermedio.',{day:d.name,exercise:e.name,set:s.set_number});}
    if(s.rir===1)one++;rirSum+=s.rir;
    const rest=restGuidance(m,s);
    if(s.rest_seconds<rest.minimum)warn('short_rest','Descanso inferior a la orientación práctica del ejercicio y la serie; reducir volumen redundante antes de comprimir la recuperación.',{day:d.name,exercise:e.name,set:s.set_number,reference_seconds:rest.minimum,preferred_seconds:rest.preferred,reason:rest.reason});
    else if(rest.reason!=='accessory'&&s.rir<=1&&s.rest_seconds<rest.preferred)warn('rest_performance_review','Revisar si conviene más descanso para conservar rendimiento y RIR en la siguiente serie.',{day:d.name,exercise:e.name,set:s.set_number,reference_seconds:rest.preferred,reason:rest.reason});
    if((m.rep_range_category==='accessory'||m.rep_range_category==='dynamic_abs')&&s.reps_min<10)warn('low_accessory_reps','Rango bajo para accesorio/abdomen; revisar contexto.',{day:d.name,exercise:e.name,set:s.set_number});
   });
   duration+=seconds(e);sets+=ss.length;if(m.primary.some(g=>['quads','hamstrings','glutes','calves','adductors'].includes(g)))legSets+=ss.length;
   patterns[m.pattern]=(patterns[m.pattern]||0)+ss.length;for(const g of m.primary){muscles[g].direct+=ss.length;direct.add(g);}for(const g of m.secondary){muscles[g].secondary+=ss.length;secondary.add(g);}
  }
  direct.forEach(g=>muscles[g].frequency++);secondary.forEach(g=>muscles[g].secondary_frequency++);
  if(zeros>4||zeros>sets*.5)warn('session_failure_density','Alta concentración de series RIR 0 en la sesión.',{day:d.name,sets:zeros,total:sets});
  // Repeated high-cost failure needs context: all work to failure, overlapping exercises,
  // or repeated failure with recovery below the practical preference. No universal quota.
  const overlap=costlyFailures.some(a=>costlyFailures.some(b=>a.exercise!==b.exercise&&a.primary.some(g=>b.primary.includes(g))));
  if(costlyFailures.length>1&&(overlap||costlyFailures.some(s=>s.allSetsToFailure)||costlyFailures.some(s=>s.shortRest)))warn('demanding_failure','Fallo repetido de alto coste con solapamiento muscular, todas las series al fallo o recuperación limitada: justificar o reducir exposición.',{day:d.name,sets:costlyFailures.length,overlap,allSetsToFailure:costlyFailures.some(s=>s.allSetsToFailure),recoveryLimited:costlyFailures.some(s=>s.shortRest),locations:costlyFailures.map(({exercise,set})=>({exercise,set}))});
  if(sets>14&&zeros>=3)warn('failure_volume','Volumen de sesión elevado combinado con RIR 0.',{day:d.name,sets,zero:zeros});
  const ratio=duration/(t.minutes*60);if(ratio>.9)failures.push('duration_over_90');else if(ratio>.8)warn('duration_80_90','Duración estimada entre el 80 y 90 % del tiempo disponible.',{day:d.name,ratio});
  days.push({name:d.name,id:week[i]?.id,exercises:d.exercises.length,sets,legSets,zero:zeros,seconds:duration,minutes:Math.ceil(duration/60),ratio});
 });
 for(const g of V4.major){const possible=catalogue.some(e=>allowed.has(e.id)&&e.primary.includes(g));if(!muscles[g].direct){if(possible)failures.push('major_absent_'+g);else warn('coverage_exception','Sin opción material para el grupo.',{muscle:g});}else if(muscles[g].direct<(t.days>=3?4:2))warn('low_direct_volume','Cobertura directa inicial reducida.',{muscle:g,sets:muscles[g].direct});if(t.days>=3&&muscles[g].frequency===1)warn('low_muscle_frequency','Una única exposición del gran grupo.',{muscle:g});if(muscles[g].direct>(beginner(t)?12:18))warn('high_direct_volume','Volumen inicial elevado para revisar.',{muscle:g,sets:muscles[g].direct});}
 if(!muscles.core.direct)warn('core_missing','Sin trabajo directo de abdomen.');
 const counts=V4.major.map(g=>muscles[g].direct).filter(Boolean);if(counts.length&&Math.max(...counts)>3*Math.min(...counts))warn('uneven_coverage','Relación superior a 3:1 entre grandes grupos.');
 if(beginner(t)&&unique.size>12)failures.push('beginner_variety_ceiling');const target=beginner(t)?10:t.experience==='y1_2'?14:16;if(unique.size>target)warn('excess_variety','Variedad superior a la referencia del nivel.',{unique:unique.size,target});
 for(const [family,ids] of families)if(ids.size>(beginner(t)?2:3))warn('equivalent_variants','Varias variantes de una misma familia.',{family,count:ids.size});
 const sport=new Set(t.activity.weekdays),weekIds=I.weekdays.map(d=>d.id),maxLeg=Math.max(0,...days.map(d=>d.legSets));
 if(['football','running','crossfit','martial_arts','cycling','physical_work'].includes(t.activity.type))for(const d of days){if(sport.has(d.id)&&d.legSets)warn('sport_same_day','Pierna y actividad externa el mismo día; intensidad/horario desconocidos.',{day:d.name,sets:d.legSets});if(d.legSets>4&&d.legSets===maxLeg&&sport.has(weekIds[(weekIds.indexOf(d.id)+1)%7]))warn('sport_before_heaviest','La sesión de pierna más cargada precede a la actividad externa.',{day:d.name});}
 const totalSets=days.reduce((n,d)=>n+d.sets,0);if(zero&&V4.major.some(g=>muscles[g].direct>18))warn('weekly_failure_volume','Volumen muscular elevado combinado con series RIR 0.');
 return {version:'basic-initial-v5',ok:failures.length===0,failures:[...new Set(failures)],warnings,muscles,patterns,days,totalSets,unique:unique.size,rirMean:totalSets?rirSum/totalSets:0,rirZero:zero,rirOne:one,variableExercises:variable,smallMuscles:Object.fromEntries(['deltoids','biceps','triceps','calves'].map(g=>[g,{...muscles[g],note:'Trabajo directo y secundario separados; no equivalencia automática.'}]))};
}
root.SimpleCoachProgrammingV5=Object.freeze({catalogue,byId,byName,major:V4.major,labels:V4.labels,bounds,restGuidance,costly,planned,heterogeneous,seconds,minutes,instruction,evaluate,beginner,uncertain});
if(typeof module!=='undefined'&&module.exports)module.exports=root.SimpleCoachProgrammingV5;
})(globalThis);
