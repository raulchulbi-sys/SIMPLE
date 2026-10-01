/* Versioned programming metadata/evaluation. No network, UUID migration or training writes. */
(function(root){
'use strict';
const I=root.SimpleCoachIntake;
const rows=[];
function add(ids,pattern,primary,secondary,type,family,unilateral=false,stable=false){
 for(const id of ids.split(' '))rows.push({id,pattern,primary,secondary,type,family,unilateral,stable});
}
add('body_squat goblet bar_squat','squat',['quads','glutes'],['core'],'compound','squat');
add('reverse_lunge','lunge',['quads','glutes'],['core'],'compound','lunge',true);
add('hack pendulum leg_press horizontal_press smith_squat','squat',['quads','glutes'],[],'machine_compound','squat',false,true);
add('glute_bridge hip_thrust','hip_extension',['glutes'],[],'accessory','hip_extension',false,true);
add('db_rdl bar_rdl','hinge',['hamstrings','glutes'],['core'],'compound','hinge');
add('leg_curl seated_curl','knee_flexion',['hamstrings'],[],'isolation','knee_flexion',false,true);
add('leg_extension','knee_extension',['quads'],[],'isolation','knee_extension',false,true);
add('pushup knee_pushup floor_press bench_press','horizontal_push',['chest'],['triceps','deltoids'],'compound','horizontal_push');
add('chest_press incline_press convergent_press','horizontal_push',['chest'],['triceps','deltoids'],'machine_compound','horizontal_push',false,true);
add('pec_deck','horizontal_adduction',['chest'],[],'isolation','chest_fly',false,true);
add('db_shoulder','vertical_push',['deltoids'],['triceps'],'compound','vertical_push');
add('shoulder_press','vertical_push',['deltoids'],['triceps'],'machine_compound','vertical_push',false,true);
add('db_row','horizontal_pull',['back','upper_back'],['biceps','deltoids'],'compound','row',true);
add('bar_row band_row','horizontal_pull',['back','upper_back'],['biceps','deltoids'],'compound','row');
add('cable_row horizontal_row convergent_row supported_row high_row low_row','horizontal_pull',['back','upper_back'],['biceps','deltoids'],'machine_compound','row',false,true);
add('pulldown','vertical_pull',['back'],['biceps'],'machine_compound','vertical_pull',false,true);
add('pullup','vertical_pull',['back'],['biceps'],'compound','vertical_pull');
add('pullover','shoulder_extension',['back'],[],'isolation','pullover',false,true);
add('db_lateral lateral','shoulder_abduction',['deltoids'],[],'isolation','lateral_raise',false,true);
add('rear_delt','horizontal_abduction',['deltoids'],['upper_back'],'isolation','rear_delt',false,true);
add('db_curl band_curl preacher curl','elbow_flexion',['biceps'],[],'isolation','curl',false,true);
add('cable_triceps triceps','elbow_extension',['triceps'],[],'isolation','triceps',false,true);
add('calf_raise seated_calf standing_calf','plantar_flexion',['calves'],[],'calf','calf',false,true);
add('dead_bug bird_dog','anti_extension',['core'],[],'core','core',true,true);
add('adductor','hip_adduction',['adductors'],[],'isolation','adductor',false,true);
add('abductor','hip_abduction',['glutes'],[],'isolation','abductor',false,true);
const catalogue=I.exercises.map(e=>{
 const m=rows.find(x=>x.id===e.id);if(!m)throw Error('Missing programming metadata: '+e.id);
 return Object.freeze({...e,...m,requires:Object.freeze([...e.requires]),primary:Object.freeze([...m.primary]),secondary:Object.freeze([...m.secondary])});
});
if(rows.length!==catalogue.length||new Set(rows.map(e=>e.id)).size!==catalogue.length)throw Error('Invalid programming metadata');
const byName=new Map(catalogue.map(e=>[e.name,e])),byId=new Map(catalogue.map(e=>[e.id,e]));
const major=['chest','back','quads','hamstrings','glutes'];
const labels={chest:'Pectoral',back:'Espalda / dorsal',upper_back:'Espalda alta (subconjunto de espalda)',quads:'Cuádriceps',hamstrings:'Femorales',glutes:'Glúteos',deltoids:'Deltoides',biceps:'Bíceps',triceps:'Tríceps',calves:'Gemelos',core:'Core',adductors:'Aductores'};
const beginner=t=>['lt6','m6_12'].includes(t.experience);
const conservative=t=>beginner(t)||['unknown','learning'].includes(t.effort)||t.goal!=='balanced_mass';
function bounds(m){return m.type==='core'?{reps:[6,15],rest:[60,90]}:['isolation','calf','accessory'].includes(m.type)?{reps:[8,20],rest:[60,120]}:{reps:[6,15],rest:[60,180]};}
function seconds(e){const m=byName.get(e.name);return 120+e.sets*(e.reps_max*4*(m?.unilateral?2:1)+e.rest_seconds+(m?.unilateral?15:0));}
function instruction(t){
 const effort=t.effort==='unknown'?'No necesitas estimar el RIR con precisión: termina con técnica estable y unas 3–4 repeticiones posibles, sin llegar al fallo.':conservative(t)?'El RIR es orientativo. Empieza dejando unas 3–4 repeticiones posibles; prioriza técnica y repetición de movimientos, sin llegar al fallo.':'RIR: repeticiones que podrías completar todavía. Respeta el margen indicado sin llegar al fallo.';
 return effort+' Mantén el rango de repeticiones. Cuando completes todas las series en el extremo alto con el RIR previsto y buena técnica, aumenta ligeramente la carga disponible; no es un ajuste automático.';
}
function evaluate(p,t){
 const errors=[],warnings=[],muscles=Object.fromEntries(Object.keys(labels).map(k=>[k,{direct:0,secondary:0,frequency:0,secondary_frequency:0}])),patterns={},unique=new Set(),families=new Map(),days=[];
 const warn=(code,message,details={})=>warnings.push({code,message,...details});
 const allowed=new Set(I.allowedExercises(t).map(e=>e.id));
 const available=I.weekdays.filter(d=>t.weekdays.includes(d.id));
 if(p.days.length!==t.days)errors.push('day_count');
 p.days.forEach((d,i)=>{
  if(d.name!==available[i]?.label)errors.push('unauthorized_day');
  const seen=new Set(),direct=new Set(),secondary=new Set();let duration=300,sets=0,legSets=0;
  for(const e of d.exercises){
   const m=byName.get(e.name);if(!m||!allowed.has(m.id)){errors.push('equipment_or_avoidance');continue;}
   if(seen.has(m.id))errors.push('duplicate_exercise');seen.add(m.id);unique.add(m.id);
   if(!families.has(m.family))families.set(m.family,new Set());families.get(m.family).add(m.id);
   const b=bounds(m),minRIR=conservative(t)?3:2;
   if(e.reps_min<b.reps[0]||e.reps_max>b.reps[1]||e.reps_min>e.reps_max||e.rest_seconds<b.rest[0]||e.rest_seconds>b.rest[1]||e.sets<2||e.sets>(beginner(t)?3:4)||e.rir<minRIR||e.rir>4)errors.push('prescription_bounds');
   duration+=seconds(e);sets+=e.sets;
   if(m.primary.some(g=>['quads','hamstrings','glutes','calves','adductors'].includes(g)))legSets+=e.sets;
   patterns[m.pattern]=(patterns[m.pattern]||0)+e.sets;
   for(const g of m.primary){muscles[g].direct+=e.sets;direct.add(g);}
   for(const g of m.secondary){muscles[g].secondary+=e.sets;secondary.add(g);}
  }
  direct.forEach(g=>muscles[g].frequency++);secondary.forEach(g=>muscles[g].secondary_frequency++);
  const ratio=duration/(t.minutes*60);if(ratio>.9)errors.push('duration_over_90');else if(ratio>.8)warn('duration_80_90','Duración estimada entre el 80 y el 90 % del tiempo disponible.',{day:d.name,ratio});
  days.push({name:d.name,id:available[i]?.id,exercises:d.exercises.length,sets,legSets,seconds:duration,minutes:Math.ceil(duration/60),ratio});
 });
 for(const g of major){
  const possible=catalogue.some(e=>allowed.has(e.id)&&e.primary.includes(g));
  if(!muscles[g].direct){if(possible)errors.push('major_absent_'+g);else warn('coverage_exception','Material/exclusiones impiden cobertura directa: requiere revisión, no equivalencia por patrón.',{muscle:g});}
  else if(muscles[g].direct<(t.days>=3?4:2))warn('low_direct_volume','Cobertura directa inicial reducida; revisar su justificación.',{muscle:g,sets:muscles[g].direct});
  if(t.days>=3&&muscles[g].direct&&muscles[g].frequency<2)warn('low_muscle_frequency','Una única exposición del gran grupo; revisar tiempo, material y distribución.',{muscle:g});
  if(muscles[g].direct>18)warn('high_direct_volume','Más de 18 series directas: justificar en una rutina inicial.',{muscle:g,sets:muscles[g].direct});
 }
 if(muscles.hamstrings.direct<4&&t.days>=3)warn('hamstrings_sparse','Femorales: menos de cuatro series directas. Puente/hip thrust no sustituyen rumano/curl.',{sets:muscles.hamstrings.direct});
 if(!muscles.core.direct)warn('core_missing','No hay trabajo directo de core; revisar la priorización.');
 const actual=major.map(g=>muscles[g].direct).filter(Boolean);if(actual.length&&Math.max(...actual)>3*Math.min(...actual))warn('uneven_coverage','Relación superior a 3:1 entre grandes grupos; revisar sin sumar trabajo secundario como directo.');
 const ceiling=beginner(t)?12:t.experience==='y1_2'?16:18,target=beginner(t)?10:t.experience==='y1_2'?14:16;
 if(beginner(t)&&unique.size>ceiling)errors.push('beginner_variety_ceiling');
 if(unique.size>target)warn('excess_variety','Variedad superior a la referencia del nivel. Priorizar reutilización antes que variantes.',{unique:unique.size,target,ceiling});
 for(const [family,ids] of families)if(ids.size>(beginner(t)?2:3))warn('equivalent_variants','Varias variantes de una misma familia sin necesidad declarada.',{family,count:ids.size});
 const demanding=['football','running','crossfit','martial_arts','cycling','physical_work'].includes(t.activity.type),sport=new Set(t.activity.weekdays),week=I.weekdays.map(d=>d.id),maxLeg=Math.max(0,...days.map(d=>d.legSets));
 if(demanding){
  const before=d=>sport.has(week[(week.indexOf(d.id)+1)%7]);
  const alternatives=days.filter(d=>!before(d)&&!sport.has(d.id));
  for(const d of days){
   if(sport.has(d.id)&&d.legSets>0)warn('sport_same_day','Pierna y actividad externa el mismo día; intensidad/horario desconocidos.',{day:d.name,sets:d.legSets});
   if(before(d)&&d.legSets>=maxLeg&&d.legSets>4)warn(alternatives.length?'sport_before_heaviest':'sport_overlap_unavoidable',alternatives.length?'La sesión de pierna más cargada precede a la actividad; existen otros días que revisar.':'La disponibilidad no deja una alternativa libre evidente: conservar para revisión humana.',{day:d.name,sets:d.legSets,alternative_days:alternatives.map(x=>x.name)});
  }
 }
 const small=Object.fromEntries(['deltoids','biceps','triceps','calves'].map(g=>[g,{...muscles[g],note:muscles[g].direct?'Trabajo directo presente; no se exige añadir más aislamiento.':muscles[g].secondary?'Participación secundaria registrada por separado. Omitir aislamiento puede priorizar grandes grupos; no acredita una dosis equivalente.':beginner(t)||t.minutes===30?'Sin trabajo específico. El contexto inicial/corto permite priorizar grandes grupos; omisión visible al reviewer.':'Sin trabajo específico ni participación secundaria catalogada: revisar su omisión.'}]));
 return {version:'basic-initial-v4',ok:errors.length===0,failures:[...new Set(errors)],warnings,muscles,patterns,days,unique:unique.size,totalSets:days.reduce((s,d)=>s+d.sets,0),smallMuscles:small,limitations:['Recuentos de programación, no medición de estímulo.','Espalda alta es subconjunto: no sumar otra vez a espalda.','Tiempo estimado, incluida ejecución por lado; no mide ocupación ni respuesta individual.']};
}
root.SimpleCoachProgrammingV4=Object.freeze({catalogue:Object.freeze(catalogue),major:Object.freeze(major),labels:Object.freeze(labels),byName,byId,bounds,seconds,instruction,evaluate,beginner,conservative});
if(typeof module!=='undefined'&&module.exports)module.exports=root.SimpleCoachProgrammingV4;
})(globalThis);
