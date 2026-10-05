// Loopback-only synthetic preview. It makes no model or database calls by default.
const http=require('http'),fs=require('fs'),path=require('path');
const C=require('../../assets/coach-premium-weekly.js');
const root=path.resolve(__dirname,'../..'),port=Number(process.env.PREMIUM_WEEKLY_PORT||4241);
const uuid=n=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
const cases=[['normal','Check-in pendiente'],['progress','Progreso + check-in bueno'],['stable','Estable + check-in normal'],['fatigue','Fatiga alta aislada'],['decline','Descenso repetido + recuperación peor'],['discrepancy','Descenso + check-in bueno'],['insufficient','Historial insuficiente'],['schedule','Disponibilidad 5 → 4 días'],['exercise','Revisar un ejercicio'],['longname','Nombre de ejercicio largo'],['blank','Sin entrenamientos'],['missing','Análisis sin check-in'],['stale','Propuesta de revisión anterior'],['closed','Mesociclo completado'],['revoked','Permiso revocado'],['error','Error al guardar'],['slow','Respuesta lenta']];
const copy=v=>structuredClone(v),normal={...C.emptyAnswers(),recovery:'normal',sleep:'normal',fatigue:'normal',stress:'moderate',session_perception:'similar',availability:{changed:false,weekdays:[],minutes_by_day:{}},review:{topic:'none',exercise_id:null}};
function fixture(tag){
 const index=cases.findIndex(c=>c[0]===tag),answers=copy(normal),exercises=[{id:uuid(10),ref:'e1',name:tag==='longname'?'Remo unilateral en máquina con apoyo de pecho y agarre neutro para el trabajo de espalda superior de la rutina actual':'Remo unilateral',day_name:'PULL'},{id:uuid(11),ref:'e2',name:'Press inclinado',day_name:'PUSH'}];
 if(['progress','discrepancy'].includes(tag)){answers.recovery='good';answers.sleep='good';answers.fatigue='low';}
 if(tag==='fatigue')answers.fatigue='high';
 if(['decline','insufficient'].includes(tag)){answers.recovery='worse';answers.sleep='bad';answers.fatigue='high';answers.session_perception='harder';}
 if(tag==='schedule')answers.availability={changed:true,weekdays:['mon','wed','fri','sun'],minutes_by_day:{mon:60,wed:60,fri:60,sun:75}};
 if(tag==='exercise')answers.review={topic:'exercise',exercise_id:uuid(10)};
 const submitted=!['normal','blank','missing','closed','error','slow'].includes(tag),permission=!['normal','revoked'].includes(tag);
 const s={mode:'offline',actor:'athlete',user_id:uuid(100+index),permission,exercises,mesocycle:{id:uuid(200+index),number:1,planned_weeks:6,revision_id:uuid(300+index),revision_no:2,state:tag==='closed'?'completed':'active'},week:{id:uuid(400+index),number:3},session_summary:tag==='blank'?'No hay entrenamientos registrados esta semana.':'4 de 5 sesiones registradas · Historial de 3 semanas',checkin:submitted?{id:uuid(500+index),answers,row_version:1,submitted_at:'2026-10-04T12:00:00Z'}:null,recommendation:null,tag};
 if(tag==='stale'){s.recommendation=recommendation(s);s.recommendation.state='stale';}return s;
}
function recommendation(s){
 const tag=s.tag,insufficient=['insufficient','blank'].includes(tag),decline=['decline','discrepancy'].includes(tag);
 const kind=tag==='decline'||tag==='schedule'?'MODIFY':['discrepancy','insufficient','exercise'].includes(tag)?'REVIEW':'KEEP';
 const before=[{set_number:1,reps_min:8,reps_max:10,rir:2,rest_seconds:180},{set_number:2,reps_min:10,reps_max:12,rir:1,rest_seconds:180},{set_number:3,reps_min:10,reps_max:12,rir:1,rest_seconds:180}];
 const changes=tag==='decline'?[{action:'remove_set',exercise_name:s.exercises[0].name,before,after:[before[0],{...before[2],set_number:2}],removed_set:2}]:tag==='schedule'?[{action:'weekly_schedule',days:[{logical_day_ref:'d1',logical_day_name:'PUSH',from_weekday:'mon',to_weekday:'mon',minutes:60},{logical_day_ref:'d2',logical_day_name:'PULL',from_weekday:'tue',to_weekday:'wed',minutes:60},{logical_day_ref:'d3',logical_day_name:'LEG',from_weekday:'wed',to_weekday:'fri',minutes:60},{logical_day_ref:'d4',logical_day_name:'UPPER',from_weekday:'fri',to_weekday:'sun',minutes:75},{logical_day_ref:'d5',logical_day_name:'LOWER',from_weekday:'sat',to_weekday:'sun',minutes:75}]}]:[];
 const reasons={fatigue:'El rendimiento registrado se mantiene estable. Una semana de fatiga alta no obliga a cambiar la programación.',decline:'El rendimiento ha descendido en exposiciones comparables y esta semana has informado de peor recuperación. Proponemos retirar una serie y revisar la respuesta la próxima semana.',discrepancy:'El rendimiento registrado ha descendido, mientras que tu check-in indica buena recuperación. El reviewer debe valorar esta discrepancia antes de proponer cambios.',insufficient:'El historial disponible no permite comparar una tendencia. La peor recuperación percibida se conserva como contexto; no justifica un ajuste amplio.',schedule:'Redistribuir los días de la rutina entre los cuatro días disponibles. PUSH, PULL, LEG, UPPER y LOWER conservan su identidad y sus ejercicios.',exercise:'Has pedido revisar un ejercicio. Se necesita revisar sus exposiciones antes de decidir una sustitución; tu solicitud no cambia el ejercicio automáticamente.',progress:'Las exposiciones comparables muestran progreso y tu check-in es favorable. Recomendamos mantener la programación.',blank:'No hay entrenamientos suficientes para comparar. No se propone cambiar la rutina.',missing:'Los entrenamientos registrados muestran estabilidad. Falta el check-in de esta semana; recomendamos mantener la programación con ese límite explícito.'};
 return {id:uuid(600+cases.findIndex(c=>c[0]===tag)),kind,state:'pending_review',facts:insufficient?[]:[{exercise_name:s.exercises[0].name,summary:decline?'Las repeticiones han descendido en tres exposiciones con carga y RIR comparables.':tag==='progress'?'Aumentan las repeticiones con carga y RIR comparables.':'Rendimiento estable con carga y RIR comparables.',sets:[{set_number:1,kg:40,reps:decline?8:10,rir:2},{set_number:2,kg:40,reps:decline?8:11,rir:1}]}],reason:reasons[tag]||'Los datos registrados y el check-in permiten mantener la programación actual. Revisaremos su evolución la próxima semana.',changes,analysis_week:s.week.number,revision_id:s.mesocycle.revision_id,checkin_missing:!s.checkin?.submitted_at};
}
function createOfflineAdapter(){
 const states=new Map(cases.map(([tag])=>[tag,fixture(tag)]));let calls={};
 return {mode:'offline',async handle({action,tag,actor,data={}}){
  if(!states.has(tag)||!['athlete','reviewer'].includes(actor))throw Error('invalid_request');
  if(action==='reset'){states.set(tag,fixture(tag));calls[tag]={};return true;}
  const s=states.get(tag);if(action==='state')return {...copy(s),actor};
  await new Promise(r=>setTimeout(r,tag==='slow'?1200:100));
  calls[tag]??={};calls[tag][action]=(calls[tag][action]||0)+1;
  if(action==='permission'){if(actor!=='athlete')throw Error('not_owned');s.permission=data.allow===true;return s.permission;}
  if(action==='save'){
   if(actor!=='athlete')throw Error('not_owned');if(s.mesocycle.state!=='active')throw Error('premium_weekly_inactive');
   if(data.week!==s.week.number||data.revision!==s.mesocycle.revision_id)throw Error('premium_weekly_stale_context');
   if(tag==='error')throw Error('preview_error');
   if(s.checkin?.submitted_at){if(data.submit&&JSON.stringify(data.answers)===JSON.stringify(s.checkin.answers))return copy(s.checkin);throw Error('premium_weekly_already_submitted');}
   if(data.expected!==(s.checkin?.row_version||0))throw Error('premium_weekly_conflict');
   if(data.submit&&C.validateAnswers(data.answers,s.exercises))throw Error('premium_weekly_invalid_answers');
   if(data.answers?.schema_version!==C.SCHEMA)throw Error('premium_weekly_invalid_answers');
   s.checkin={id:uuid(500+cases.findIndex(c=>c[0]===tag)),answers:copy(data.answers),row_version:(s.checkin?.row_version||0)+1,submitted_at:data.submit?new Date().toISOString():null};return copy(s.checkin);
  }
  if(action==='analyze'){if(actor!=='athlete'||s.mesocycle.state!=='active')throw Error('action_unavailable');if(!s.permission)throw Error('premium_weekly_consent_required');if(s.recommendation)return copy(s.recommendation);s.recommendation=recommendation(s);return copy(s.recommendation);}
  const r=s.recommendation;if(!r||r.id!==data.id)throw Error('action_unavailable');
  if(action==='accept'){
   if(actor!=='athlete')throw Error('not_owned');if(r.state==='accepted')return {...copy(s),actor};if(r.state==='stale')throw Error('premium_weekly_stale');if(r.state!=='ready'||r.kind==='REVIEW')throw Error('action_unavailable');
   r.state='accepted';if(r.kind==='MODIFY'){s.mesocycle.revision_no++;s.mesocycle.revision_id=uuid(800+cases.findIndex(c=>c[0]===tag));}return {...copy(s),actor};
  }
  if(actor!=='reviewer'||r.state!=='pending_review')throw Error('action_unavailable');
  if(action==='review'&&r.kind!=='REVIEW')r.state='ready';
  else if(action==='resolve'&&r.kind==='REVIEW'){r.kind='KEEP';r.changes=[];r.state='ready';r.reason='Revisión humana simulada: conservar la rutina y ampliar las exposiciones comparables antes de decidir un cambio.';}
  else if(action==='reject')r.state='rejected';else throw Error('action_unavailable');
  return {...copy(s),actor};
 },snapshot:()=>({states:copy([...states]),calls:copy(calls)})};
}
const html=(mode,visibleCases=cases)=>`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIMPLE Premium · check-in semanal</title><script>document.documentElement.dataset.theme=localStorage.getItem('premium-weekly-theme')==='dark'?'dark':'light'</script><link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="/assets/coach-premium-weekly.css"></head><body><header><strong><svg viewBox="0 0 100 70" aria-hidden="true"><path d="M0 25h6v20H0zM13 12h6v46h-6zM26 0h6v70h-6zM68 0h6v70h-6zM81 12h6v46h-6zM94 25h6v20h-6z"/></svg>SIMPLE</strong><button id="theme" type="button">Oscuro</button></header><div class="preview-tools"><p class="preview-label">Vista previa interna. ${mode==='offline'?'Datos y acciones simulados localmente. Sin llamadas a OpenAI ni a bases de datos.':'JWT real contra fixtures sintéticas de staging. Credenciales solo en el servidor. Esta vista no llama a OpenAI.'}</p><p>Premium comercial cerrado.</p><details><summary>Opciones de la vista previa</summary><div class="settings-row"><label for="case">Caso</label><select id="case">${visibleCases.map(([value,label])=>'<option value="'+value+'">'+label+'</option>').join('')}</select><label for="actor">Vista</label><select id="actor"><option value="athlete">Atleta</option><option value="reviewer">Reviewer asignado · ${mode==='offline'?'simulación':'staging'}</option></select><button id="reset" type="button" ${mode==='offline'?'':'hidden'}>Reiniciar simulación</button></div></details></div><main><p id="breadcrumb" class="breadcrumb"></p><div class="week-bar"><h2 id="week-heading">Semana 3 de 6</h2><ol id="weeks" class="weeks" aria-label="Semanas del mesociclo"></ol></div><p id="week-facts"></p><article id="weekly-app" aria-busy="true"></article><p id="message" role="status" aria-live="polite" aria-atomic="true"></p></main><script src="/assets/coach-premium-weekly.js"></script></body></html>`;
function rejectCredentials(value){if(value&&typeof value==='object')for(const[k,v]of Object.entries(value)){if(/^(access_token|refresh_token|service_role|authorization|apikey|secret|password)$/i.test(k))throw Error('unsafe_adapter_output');rejectCredentials(v);}}
function createServer(adapter=createOfflineAdapter(),serverPort=port){
 return http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');try{
  if(req.url==='/weekly-api'&&req.method==='POST'){
   if(req.headers.origin!==`http://127.0.0.1:${serverPort}`)throw Error('origin_denied');let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>6000)throw Error('invalid_request');}
   const body=JSON.parse(raw);if(!body||!['state','permission','save','analyze','review','reject','resolve','accept','reset'].includes(body.action))throw Error('invalid_request');
   const data=await adapter.handle(body);rejectCredentials(data);res.setHeader('Content-Type','application/json;charset=utf-8');return res.end(JSON.stringify(data));
  }
  if(req.method!=='GET'){res.writeHead(405);return res.end();}
  if(req.url==='/review'||req.url==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html(adapter.mode,adapter.cases||cases));}
  const allowed=['/assets/theme.css','/assets/coach-premium-weekly.css','/assets/coach-premium-weekly.js'];if(!allowed.includes(req.url)){res.writeHead(404);return res.end();}
  res.setHeader('Content-Type',req.url.endsWith('.css')?'text/css;charset=utf-8':'application/javascript;charset=utf-8');res.end(fs.readFileSync(path.join(root,req.url)));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json;charset=utf-8'});res.end(JSON.stringify({error:/^[a-z_]+$/.test(e.message)?e.message:'invalid_request'}));}});
}
if(require.main===module){const adapter=process.env.PREMIUM_WEEKLY_ADAPTER?require(path.resolve(process.env.PREMIUM_WEEKLY_ADAPTER)):createOfflineAdapter();createServer(adapter).listen(port,'127.0.0.1',()=>console.log('Premium weekly preview http://127.0.0.1:'+port+'/review ('+adapter.mode+')'));}
module.exports={createServer,createOfflineAdapter,cases,fixture,recommendation};
