/* Shared, closed questionnaire vocabulary. No credentials, participant data or network. */
(function(root){
'use strict';
const pairs=rows=>rows.map(([id,label])=>({id,label}));
const experience=pairs([['lt6','Menos de 6 meses'],['m6_12','6–12 meses'],['y1_2','1–2 años'],['y2_4','2–4 años'],['gt4','Más de 4 años']]);
const goals=pairs([['balanced_mass','Ganar masa muscular y desarrollar el físico de forma equilibrada'],['regain_mass','Ganar masa muscular después de una etapa de poco entrenamiento'],['structured_return','Volver a entrenar de forma estructurada']]);
const weekdays=pairs([['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes'],['sat','Sábado'],['sun','Domingo']]);
const effort=pairs([['unknown','No sé estimarlo'],['learning','Entiendo el concepto, pero me cuesta'],['confident','Normalmente puedo estimarlo'],['habitual','Utilizo RIR/RPE habitualmente']]);
const activities=pairs([['none','No'],['football','Fútbol'],['running','Running'],['cycling','Ciclismo'],['crossfit','CrossFit'],['martial_arts','Artes marciales'],['other_sport','Otro deporte'],['physical_work','Trabajo físicamente exigente']]);
const minutes=[30,45,60,75,90];
const categories=pairs([['push','Pecho / empuje'],['pull','Espalda'],['legs','Pierna'],['arms','Hombro / brazos'],['shared','Material común']]);
// Shared equipment appears once, even if several movement categories use it.
const equipment=[
 ['chest_press','Press horizontal máquina','push'],['incline_press','Press inclinado máquina','push'],['convergent_press','Press convergente','push'],['pec_deck','Peck deck / contractora','push'],
 ['pulldown','Jalón','pull'],['horizontal_row','Remo horizontal','pull'],['convergent_row','Remo convergente','pull'],['supported_row','Remo pecho apoyado','pull'],['high_row','High row','pull'],['low_row','Low row','pull'],['pullover','Pullover máquina','pull'],['pullup','Dominadas','pull'],
 ['hack','Hack squat','legs'],['pendulum','Pendular','legs'],['press45','Prensa 45º','legs'],['horizontal_press','Prensa horizontal','legs'],['leg_extension','Extensión de cuádriceps','legs'],['seated_curl','Curl femoral sentado','legs'],['lying_curl','Curl femoral tumbado','legs'],['adductor','Aductor','legs'],['abductor','Abductor','legs'],['hip_thrust','Hip thrust','legs'],['seated_calf','Gemelo sentado','legs'],['standing_calf','Gemelo de pie','legs'],
 ['shoulder_press','Press hombro máquina','arms'],['lateral','Laterales máquina','arms'],['rear_delt','Rear delt / pájaros','arms'],['preacher','Scott máquina','arms'],['curl','Curl máquina','arms'],['triceps','Extensión tríceps máquina','arms'],
 ['smith','Multipower','shared'],['bench','Banco','shared'],['barbell','Barra','shared'],['rack','Rack con soportes de seguridad','shared'],['dumbbells','Mancuernas','shared'],['cables','Poleas regulables','shared'],['bands','Bandas','shared']
].map(([id,label,category])=>({id,label,category}));
// Catalogue IDs describe new prescriptions, never existing workout/exercise UUIDs.
const exercises=[
 ['body_squat','Sentadilla con peso corporal',[],'knee'],['reverse_lunge','Zancada atrás',[],'knee'],['glute_bridge','Puente de glúteos',[],'hip'],['pushup','Flexiones',[],'push'],['knee_pushup','Flexiones de rodillas',[],'push'],['dead_bug','Dead bug',[],'core'],['bird_dog','Bird dog',[],'core'],['calf_raise','Elevación de talones',[],'calf'],
 ['goblet','Sentadilla goblet',['dumbbells'],'knee'],['db_rdl','Peso muerto rumano con mancuernas',['dumbbells'],'hip'],['db_row','Remo con mancuerna',['dumbbells'],'pull'],['floor_press','Press de suelo con mancuernas',['dumbbells'],'push'],['db_shoulder','Press de hombros con mancuernas',['dumbbells'],'push'],['db_lateral','Elevaciones laterales',['dumbbells'],'shoulder'],['db_curl','Curl con mancuernas',['dumbbells'],'arms'],['band_row','Remo con banda',['bands'],'pull'],['band_curl','Curl con banda',['bands'],'arms'],
 ['bar_squat','Sentadilla con barra',['barbell','rack'],'knee'],['bar_rdl','Peso muerto rumano con barra',['barbell'],'hip'],['bar_row','Remo con barra',['barbell'],'pull'],['leg_press','Prensa de piernas',['press45'],'knee'],['leg_curl','Curl femoral',['lying_curl'],'hip'],['pulldown','Jalón al pecho',['pulldown'],'pull'],['cable_row','Remo en polea',['cables'],'pull'],['chest_press','Press de pecho en máquina',['chest_press'],'push'],['cable_triceps','Extensión de tríceps en polea',['cables'],'arms'],
 ['incline_press','Press inclinado en máquina',['incline_press'],'push'],['convergent_press','Press convergente',['convergent_press'],'push'],['pec_deck','Aperturas en contractora',['pec_deck'],'push'],['horizontal_row','Remo horizontal en máquina',['horizontal_row'],'pull'],['convergent_row','Remo convergente',['convergent_row'],'pull'],['supported_row','Remo con pecho apoyado',['supported_row'],'pull'],['high_row','High row',['high_row'],'pull'],['low_row','Low row',['low_row'],'pull'],['pullover','Pullover en máquina',['pullover'],'pull'],['pullup','Dominadas',['pullup'],'pull'],
 ['hack','Sentadilla hack',['hack'],'knee'],['pendulum','Sentadilla pendular',['pendulum'],'knee'],['horizontal_press','Prensa horizontal',['horizontal_press'],'knee'],['leg_extension','Extensión de cuádriceps',['leg_extension'],'knee'],['seated_curl','Curl femoral sentado',['seated_curl'],'hip'],['adductor','Aductor en máquina',['adductor'],'adductor'],['abductor','Abductor en máquina',['abductor'],'abductor'],['hip_thrust','Hip thrust en máquina',['hip_thrust'],'hip'],['seated_calf','Gemelo sentado',['seated_calf'],'calf'],['standing_calf','Gemelo de pie en máquina',['standing_calf'],'calf'],['shoulder_press','Press de hombro en máquina',['shoulder_press'],'push'],['lateral','Elevaciones laterales en máquina',['lateral'],'shoulder'],['rear_delt','Pájaros en máquina',['rear_delt'],'shoulder'],['preacher','Curl Scott en máquina',['preacher'],'arms'],['curl','Curl en máquina',['curl'],'arms'],['triceps','Extensión de tríceps en máquina',['triceps'],'arms'],['smith_squat','Sentadilla en multipower',['smith'],'knee'],['bench_press','Press de banca con barra',['bench','barbell','rack'],'push']
].map(([id,name,requires,group])=>({id,name,requires,group}));
const weakPoints=pairs([['chest','Pectoral'],['lats','Dorsal'],['upper_back','Espalda alta'],['side_delt','Deltoide lateral'],['rear_delt','Deltoide posterior'],['biceps','Bíceps'],['triceps','Tríceps'],['quads','Cuádriceps'],['hamstrings','Femoral'],['glutes','Glúteo'],['calves','Gemelos'],['unsure','No estoy seguro']]);
const premiumGoals=pairs([['maximize_mass','Maximizar ganancia de masa muscular'],['balanced','Mejorar mi físico de manera equilibrada'],['regain','Recuperar nivel después de una etapa irregular']]);
const levels=pairs([['low','Baja'],['medium','Media'],['high','Alta']]);
const recovery=pairs([['full','Totalmente recuperado'],['mostly','Recuperado en general'],['sometimes_tired','A veces todavía fatigado'],['often_tired','Frecuentemente fatigado'],['unknown','No sé valorarlo']]);
const sleep=pairs([['lt6','Menos de 6 horas'],['h6_7','6–7 horas'],['h7_8','7–8 horas'],['gt8','Más de 8 horas']]);
const stability=pairs([['yes','Sí'],['somewhat','Más o menos'],['no','No']]);
const distribution=pairs([['more_short','Entrenar más días con sesiones más cortas'],['fewer_long','Entrenar menos días con sesiones algo más largas'],['coach','Me da igual, decide SIMPLE Coach']]);
const ids=list=>list.map(x=>x.id),enumOK=(v,list,full)=>ids(list).includes(v)||(!full&&v===null),unique=(a,list,max=list.length)=>Array.isArray(a)&&a.length<=max&&new Set(a).size===a.length&&a.every(x=>list.includes(x));
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const customName=s=>typeof s==='string'&&s.length>=2&&s.length<=40&&/^[\p{L}\p{N} ()º°+./-]+$/u.test(s)&&!/\d{5}|https?|www\.|dolor|lesi[oó]n|diagn[oó]st|medic|cirug|@/iu.test(s);
function emptyBasic(){return {schema_version:'basic-intake-v2',experience:null,goal:null,days:null,weekdays:[],minutes:null,effort:null,excluded:[],activity:{type:null,weekdays:[]},inventory:{equipment:[],custom:[]}};}
function basicErrors(t,full=true){
 const errors=[];if(!exact(t,Object.keys(emptyBasic()))||t.schema_version!=='basic-intake-v2')return ['schema'];
 for(const [k,list] of [['experience',experience],['goal',goals],['effort',effort]])if(!enumOK(t[k],list,full))errors.push(k);
 if(!([2,3,4,5,6].includes(t.days)||(!full&&t.days===null)))errors.push('days');
 if(!unique(t.weekdays,ids(weekdays))||(full?t.weekdays.length!==t.days:t.weekdays.length>(t.days||0)))errors.push('weekdays');
 if(!(minutes.includes(t.minutes)||(!full&&t.minutes===null)))errors.push('minutes');
 if(!unique(t.excluded,ids(exercises),20))errors.push('excluded');
 if(!exact(t.activity,['type','weekdays'])||!enumOK(t.activity.type,activities,full)||!unique(t.activity.weekdays,ids(weekdays))||((t.activity.type===null||t.activity.type==='none')&&t.activity.weekdays.length)||(full&&t.activity.type!=='none'&&!t.activity.weekdays.length))errors.push('activity');
 if(!exact(t.inventory,['equipment','custom'])||!unique(t.inventory.equipment,ids(equipment))||!Array.isArray(t.inventory.custom)||t.inventory.custom.length>10||!t.inventory.custom.every(customName)||new Set(t.inventory.custom.map(x=>x.toLocaleLowerCase())).size!==t.inventory.custom.length)errors.push('inventory');
 return errors;
}
function assertBasic(t,full=true){if(basicErrors(t,full).length)throw Error('coach_invalid_training');return structuredClone(t);}
function emptyPremium(){const b=emptyBasic();return {...b,schema_version:'premium-intake-v1',pause:null,weak_points:[],minutes_by_day:{},confidence:null,recovery:null,sleep:null,sleep_stability:null,stress:null,distribution:null,activity:{type:null,weekdays:[],minutes:null,intensity:null}};}
function premiumSteps(t){return ['experience','pause','goal',...(['y1_2','y2_4','gt4'].includes(t.experience)?['weak_points']:[]),'days','weekdays','minutes_by_day','activity','effort',...(t.effort&&t.effort!=='unknown'?['confidence']:[]),'recovery','sleep','stress','excluded','distribution'];}
function normalizePremium(t){
 if(!['y1_2','y2_4','gt4'].includes(t.experience))t.weak_points=[];
 if(t.effort===null||t.effort==='unknown')t.confidence=null;
 if(t.activity.type===null||t.activity.type==='none'){t.activity.weekdays=[];t.activity.minutes=null;t.activity.intensity=null;}
 for(const d of Object.keys(t.minutes_by_day))if(!t.weekdays.includes(d))delete t.minutes_by_day[d];
 return t;
}
function premiumErrors(t,full=true){
 if(!exact(t,Object.keys(emptyPremium()))||t.schema_version!=='premium-intake-v1')return ['schema'];
 const b={};for(const k of Object.keys(emptyBasic()))b[k]=t[k];b.schema_version='basic-intake-v2';b.goal=t.goal===null?null:'balanced_mass';b.minutes=t.minutes===null?60:t.minutes;b.activity={type:t.activity?.type,weekdays:t.activity?.weekdays};
 const e=basicErrors(b,full);if(t.minutes!==null)e.push('minutes');
 if(!enumOK(t.goal,premiumGoals,full))e.push('goal');if(!(typeof t.pause==='boolean'||(!full&&t.pause===null)))e.push('pause');
 if(!unique(t.weak_points,ids(weakPoints),2)||(t.weak_points.includes('unsure')&&t.weak_points.length!==1)||(!['y1_2','y2_4','gt4'].includes(t.experience)&&t.weak_points.length)||(full&&['y2_4','gt4'].includes(t.experience)&&!t.weak_points.length))e.push('weak_points');
 if(!t.minutes_by_day||Array.isArray(t.minutes_by_day)||typeof t.minutes_by_day!=='object'||Object.keys(t.minutes_by_day).some(d=>!t.weekdays.includes(d)||!minutes.includes(t.minutes_by_day[d]))||(full&&t.weekdays.some(d=>!minutes.includes(t.minutes_by_day[d]))))e.push('minutes_by_day');
 if(!exact(t.activity,['type','weekdays','minutes','intensity'])||((t.activity.type===null||t.activity.type==='none')?(t.activity.minutes!==null||t.activity.intensity!==null):(!(minutes.includes(t.activity.minutes)||(!full&&t.activity.minutes===null))||!enumOK(t.activity.intensity,levels,full))))e.push('activity');
 if((!t.effort||t.effort==='unknown')?t.confidence!==null:!enumOK(t.confidence,levels,full))e.push('confidence');
 for(const [k,list] of [['recovery',recovery],['sleep',sleep],['stress',levels],['distribution',distribution]])if(!enumOK(t[k],list,full))e.push(k);
 if(t.sleep_stability!==null&&!ids(stability).includes(t.sleep_stability))e.push('sleep_stability');return [...new Set(e)];
}
function providerTraining(t){const v=assertBasic(t);v.inventory={equipment:v.inventory.equipment,custom:[]};return v;}
function allowedExercises(t){return exercises.filter(e=>!t.excluded.includes(e.id)&&e.requires.every(id=>t.inventory.equipment.includes(id)));}
const effortInstruction=t=>t.effort==='unknown'?'Termina cada serie antes de perder la técnica, sin llegar al fallo. El RIR indica las repeticiones que podrías hacer todavía; empieza dejando 3–4.':t.effort==='learning'?'Usa el RIR como una estimación orientativa de las repeticiones que podrías hacer todavía. Mantén la técnica y evita llegar al fallo.':'Respeta el RIR indicado en cada ejercicio: son las repeticiones que podrías hacer todavía. No entrenes al fallo.';
root.SimpleCoachIntake=Object.freeze({experience,goals,weekdays,effort,activities,minutes,categories,equipment,exercises,weakPoints,premiumGoals,levels,recovery,sleep,stability,distribution,emptyBasic,basicErrors,assertBasic,emptyPremium,premiumSteps,normalizePremium,premiumErrors,customName,providerTraining,allowedExercises,effortInstruction});
if(typeof module!=='undefined'&&module.exports)module.exports=root.SimpleCoachIntake;
})(globalThis);
