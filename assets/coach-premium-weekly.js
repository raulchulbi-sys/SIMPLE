/* Internal Premium weekly preview. The default adapter is synthetic and offline. */
(function (scope) {
'use strict';
const SCHEMA = 'premium-weekly-checkin-v1';
const NOTICE = 'premium-checkin-v1';
const days = [['mon','Lunes'],['tue','Martes'],['wed','Miércoles'],['thu','Jueves'],['fri','Viernes'],['sat','Sábado'],['sun','Domingo']];
const questions = [
 {key:'recovery',title:'¿Cómo te has recuperado esta semana de tus entrenamientos?',options:[['very_good','Muy bien'],['good','Bien'],['normal','Normal'],['worse','Algo peor'],['bad','Mal']]},
 {key:'sleep',title:'En general, ¿cómo ha sido tu descanso esta semana?',options:[['very_good','Muy bueno'],['good','Bueno'],['normal','Normal'],['bad','Malo'],['very_bad','Muy malo']]},
 {key:'fatigue',title:'¿Cómo has notado la fatiga acumulada del entrenamiento?',options:[['very_low','Muy baja'],['low','Baja'],['normal','Normal'],['high','Alta'],['very_high','Muy alta']]},
 {key:'stress',title:'¿Cómo ha sido tu estrés general esta semana?',options:[['low','Bajo'],['moderate','Moderado'],['high','Alto'],['very_high','Muy alto']]},
 {key:'session_perception',title:'En comparación con semanas anteriores, entrenar esta semana te ha resultado…',options:[['easier','Más fácil'],['similar','Similar'],['harder','Más exigente'],['much_harder','Mucho más exigente']]},
 {key:'availability',title:'¿Tu disponibilidad para entrenar la próxima semana cambia?',options:[['false','No'],['true','Sí']]},
 {key:'review',title:'¿Hay algo de tu programación que te gustaría que SIMPLE Coach revisara especialmente?',options:[['none','No'],['volume','Volumen'],['effort','Intensidad / esfuerzo'],['duration','Duración de sesiones'],['distribution','Distribución semanal'],['exercise','Un ejercicio']]}
];
const clone = value => JSON.parse(JSON.stringify(value));
function emptyAnswers(){return {schema_version:SCHEMA,recovery:null,sleep:null,fatigue:null,stress:null,session_perception:null,availability:{changed:null,weekdays:[],minutes_by_day:{}},review:{topic:null,exercise_id:null}};}
function normalizeDraft(value){
 const a=emptyAnswers();if(!value||typeof value!=='object')return a;
 for(const q of questions.slice(0,5))if(q.options.some(o=>o[0]===value[q.key]))a[q.key]=value[q.key];
 const v=value.availability;if(v&&typeof v.changed==='boolean'){a.availability.changed=v.changed;if(v.changed){a.availability.weekdays=days.map(d=>d[0]).filter(d=>Array.isArray(v.weekdays)&&v.weekdays.includes(d));for(const d of a.availability.weekdays)a.availability.minutes_by_day[d]=Number.isInteger(v.minutes_by_day?.[d])?v.minutes_by_day[d]:null;}}
 if(questions[6].options.some(o=>o[0]===value.review?.topic)){a.review.topic=value.review.topic;if(a.review.topic==='exercise'&&typeof value.review.exercise_id==='string')a.review.exercise_id=value.review.exercise_id;}
 return a;
}
function draftKey(s){return ['simple-premium-weekly',s.user_id,s.mesocycle.id,s.week.id,s.mesocycle.revision_id].join(':');}
function validateStep(a,index,exercises){
 const q=questions[index];
 if(index<5)return q.options.some(o=>o[0]===a[q.key])?null:'Elige una respuesta para continuar.';
 if(index===5){
  const v=a.availability;
  if(typeof v?.changed!=='boolean')return 'Indica si tu disponibilidad cambia.';
  if(!Array.isArray(v.weekdays)||!v.minutes_by_day||typeof v.minutes_by_day!=='object'||Array.isArray(v.minutes_by_day))return 'Revisa los días disponibles.';
  if(!v.changed)return v.weekdays.length===0&&Object.keys(v.minutes_by_day).length===0?null:'Revisa la disponibilidad.';
  if(!Array.isArray(v.weekdays)||!v.weekdays.length)return 'Selecciona al menos un día disponible.';
  if(new Set(v.weekdays).size!==v.weekdays.length||v.weekdays.some(d=>!days.some(x=>x[0]===d)))return 'Revisa los días disponibles.';
  if(Object.keys(v.minutes_by_day).some(d=>!v.weekdays.includes(d)))return 'Revisa los días disponibles.';
  return v.weekdays.every(d=>Number.isInteger(v.minutes_by_day[d])&&v.minutes_by_day[d]>=15&&v.minutes_by_day[d]<=120)?null:'Indica entre 15 y 120 minutos para cada día.';
 }
 if(!q.options.some(o=>o[0]===a.review?.topic))return 'Elige un aspecto para continuar.';
 if(a.review.topic==='exercise')return exercises.some(e=>e.id===a.review.exercise_id)?null:'Selecciona un ejercicio de tu rutina actual.';
 return a.review.exercise_id===null?null:'Revisa el ejercicio seleccionado.';
}
function validateAnswers(a,exercises=[]){
 if(!a||a.schema_version!==SCHEMA)return 'El formato del check-in no es válido.';
 for(let i=0;i<7;i++){const e=validateStep(a,i,exercises);if(e)return e;}
 return null;
}
function summaries(a,exercises=[]){
 if(!a)return [];
 const labels=['Recuperación','Descanso','Fatiga','Estrés','Sesiones'];
 const rows=questions.slice(0,5).map((q,i)=>[labels[i],q.options.find(o=>o[0]===a[q.key])?.[1]||'Sin respuesta']);
 rows.push(['Disponibilidad',a.availability?.changed===false?'Sin cambios':a.availability?.changed===true?days.filter(d=>a.availability.weekdays.includes(d[0])).map(d=>d[1]+' '+a.availability.minutes_by_day[d[0]]+' min').join(', '):'Sin respuesta']);
 const t=questions[6].options.find(o=>o[0]===a.review?.topic)?.[1]||'Sin respuesta';
 rows.push(['Revisar',a.review?.topic==='exercise'?(exercises.find(e=>e.id===a.review.exercise_id)?.name||'Ejercicio no disponible'):t]);return rows;
}
const contract={SCHEMA,NOTICE,days,questions,emptyAnswers,normalizeDraft,draftKey,validateStep,validateAnswers,summaries};
if(typeof module!=='undefined'&&module.exports)module.exports=contract;
scope.PremiumWeekly=contract;
if(typeof document==='undefined'||!document.getElementById('weekly-app'))return;
const $=id=>document.getElementById(id), escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tabId=typeof crypto?.randomUUID==='function'?crypto.randomUUID():String(Date.now())+Math.random();
let view=null,answers=emptyAnswers(),step=0,screen='home',epoch=0,busy=false,conflict=false,localKey=null,dirty=false;
const errors={premium_weekly_conflict:'El check-in ha cambiado en otra pestaña. Carga la versión actual antes de continuar.',premium_weekly_already_submitted:'Este check-in ya está enviado y no se puede cambiar.',premium_weekly_consent_required:'Activa el permiso para usar el check-in junto con tu historial.',premium_weekly_inactive:'Esta semana está cerrada. El check-in ya no admite cambios.',premium_weekly_invalid_answers:'Revisa las respuestas del check-in.',premium_weekly_stale:'La rutina ha cambiado. Carga la versión actual para revisar la propuesta.',premium_weekly_stale_context:'La semana o la revisión de tu rutina ha cambiado. Carga la versión actual antes de continuar.',action_unavailable:'Esta acción ya no está disponible. Carga la versión actual.',preview_error:'No se ha podido guardar. Tus respuestas siguen en este dispositivo. Vuelve a intentarlo.'};
function message(text,error=false){$('message').textContent=text||'';$('message').setAttribute('role',error?'alert':'status');$('message').classList.toggle('error',error);}
async function api(action,data={}){
 const response=await fetch('/weekly-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,tag:$('case').value,actor:$('actor').value,data})});
 let value;try{value=await response.json();}catch{throw Error('preview_error');}
 if(!response.ok)throw Error(value.error||'preview_error');return value;
}
function localSave(){
 if(!localKey||view.checkin?.submitted_at||conflict)return;
 try{localStorage.setItem(localKey,JSON.stringify({schema_version:SCHEMA,answers,step,row_version:view.checkin?.row_version||0,writer:tabId,updated_at:new Date().toISOString()}));dirty=true;$('draft-status').textContent='Borrador guardado en este dispositivo.';}catch{$('draft-status').textContent='No se ha podido guardar el borrador en este dispositivo.';}
}
function restoreDraft(){
 localKey=draftKey(view);conflict=false;dirty=false;answers=normalizeDraft(view.checkin?.answers);step=0;
 if(view.checkin?.submitted_at){try{localStorage.removeItem(localKey);}catch{}return;}
 try{const saved=JSON.parse(localStorage.getItem(localKey)||'null');if(saved?.schema_version===SCHEMA&&saved.row_version===(view.checkin?.row_version||0)){answers=normalizeDraft(saved.answers);step=Number.isInteger(saved.step)?Math.min(6,Math.max(0,saved.step)):0;}else if(saved){conflict=true;}}catch{}
}
function setBusy(value){busy=value;$('weekly-app').setAttribute('aria-busy',String(value));document.querySelectorAll('#weekly-app button,#weekly-app input,#weekly-app select').forEach(b=>b.disabled=value||conflict&&b.dataset.action!=='reload');}
function focusTitle(){requestAnimationFrame(()=>{$('screen-title')?.focus({preventScroll:true});});}
async function run(action,data={},after){
 if(busy||conflict&&action!=='reload')return false;
 const ticket=epoch;setBusy(true);message('');
 try{const value=await api(action,data);if(ticket!==epoch)return false;if(after)after(value);return true;}
 catch(e){if(ticket===epoch){if(['premium_weekly_conflict','premium_weekly_already_submitted','premium_weekly_stale','premium_weekly_stale_context'].includes(e.message))conflict=true;render();message(errors[e.message]||'No se ha podido completar la acción. Vuelve a intentarlo.',true);}}
 finally{if(ticket===epoch)setBusy(false);}
 return false;
}
async function load(resetScreen=true){
 const ticket=++epoch;setBusy(true);message('');
 try{const data=await api('state');if(ticket!==epoch)return;view=data;restoreDraft();if(resetScreen)screen='home';render();if(conflict)message(errors.premium_weekly_conflict,true);}
 catch(e){if(ticket===epoch)message('No se ha podido cargar la semana. Vuelve a cargar la vista.',true);}
 finally{if(ticket===epoch)setBusy(false);}
}
function button(label,action,primary=false){return '<button type="button" data-action="'+action+'"'+(primary?' class="primary"':'')+'>'+escape(label)+'</button>';}
function summaryHTML(a){return '<dl class="checkin-summary">'+summaries(a,view.exercises).map(([k,v])=>'<div><dt>'+escape(k)+'</dt><dd>'+escape(v)+'</dd></div>').join('')+'</dl>';}
function noticeHTML(){return '<div class="context-notice"><p>Tus respuestas se usarán junto con tu historial de entrenamiento para personalizar las recomendaciones Premium.</p><p class="muted">Este check-in trata sobre tu entrenamiento. No evalúa ni diagnostica tu salud.</p><label class="checkbox-row"><input id="permission" type="checkbox" '+(view.permission?'checked':'')+'><span>Permito usar mi check-in junto con mi historial de entrenamiento.</span></label><small>Aviso '+NOTICE+'</small></div>';}
function home(){
 const m=view.mesocycle,c=view.checkin,r=view.recommendation;
 let result='<h1 id="screen-title" tabindex="-1">Check-in de la semana</h1><p class="muted">Siete preguntas rápidas. Aproximadamente 1–2 minutos.</p>';
 if(view.actor==='reviewer')return r?analysisHTML():'<h1 id="screen-title" tabindex="-1">Revisión semanal</h1><p>Vista del reviewer asignado '+(view.mode==='offline'?'en esta simulación.':'en staging.')+'</p><p class="empty">Aún no hay una recomendación para revisar. El atleta debe analizar la semana primero.</p>';
 if(r)return analysisHTML();
 if(m.state!=='active')return result+'<p class="empty">Este mesociclo está completado. Las respuestas de semanas cerradas se conservan.</p>';
 if(c?.submitted_at)result+=(view.permission?'':noticeHTML())+'<p class="submitted">Check-in enviado. Las respuestas ya no se pueden editar.</p>'+summaryHTML(c.answers)+'<div class="actions">'+button('Analizar semana','analyze',true)+'</div>';
 else result+=(view.permission?'':noticeHTML())+'<p id="draft-status" class="draft-status">'+(conflict?'Hay un borrador de otra versión.':c?'Borrador disponible.':'Tu borrador se guardará en este dispositivo.')+'</p><div class="actions">'+button(c||dirty?'Continuar check-in':'Empezar check-in','start',true)+button('Analizar solo entrenamientos','analyze-missing')+'</div><p class="muted small">Si analizas sin check-in, se indicará que faltan tus respuestas; no se asumirán valores normales.</p>';
 return result;
}
function questionHTML(){
 const q=questions[step],value=step<5?answers[q.key]:step===5?String(answers.availability.changed):answers.review.topic;
 let html='<div class="question-progress"><span>Pregunta '+(step+1)+' de 7</span><span id="draft-status" class="draft-status">Borrador guardado en este dispositivo.</span></div><form id="checkin-form"><fieldset><legend id="screen-title" tabindex="-1">'+escape(q.title)+'</legend><div class="answer-options">'+q.options.map(([v,label])=>'<label class="answer-row"><input type="radio" name="answer" value="'+v+'" '+(value===v?'checked':'')+'><span>'+escape(label)+'</span></label>').join('')+'</div></fieldset>';
 if(step===5&&answers.availability.changed===true){html+='<fieldset class="availability"><legend>Días y tiempo disponible</legend><p class="muted small">Selecciona tus días y el tiempo disponible para cada uno.</p>'+days.map(([d,label])=>{const selected=answers.availability.weekdays.includes(d);return '<div class="day-row"><label class="checkbox-row"><input name="weekday" type="checkbox" value="'+d+'" '+(selected?'checked':'')+'><span>'+label+'</span></label>'+(selected?'<label class="minutes-label" for="minutes-'+d+'"><span class="sr-only">Tiempo del '+label+'</span><select id="minutes-'+d+'" data-day="'+d+'" aria-label="Minutos del '+label+'"><option value="">Tiempo</option>'+[15,20,25,30,35,40,45,50,55,60,65,70,75,80,85,90,95,100,105,110,115,120].map(n=>'<option value="'+n+'" '+(answers.availability.minutes_by_day[d]===n?'selected':'')+'>'+n+' min</option>').join('')+'</select></label>':'')+'</div>';}).join('')+'</fieldset>';}
 if(step===6&&answers.review.topic==='exercise')html+='<label class="exercise-label" for="exercise">Ejercicio de tu rutina actual</label><select id="exercise"><option value="">Selecciona un ejercicio</option>'+view.exercises.map(e=>'<option value="'+escape(e.id)+'" '+(answers.review.exercise_id===e.id?'selected':'')+'>'+escape(e.name)+' · '+escape(e.day_name)+'</option>').join('')+'</select>';
 html+='<div class="actions">'+button('Atrás','back')+'<button type="submit" class="primary">'+(step===6?'Revisar check-in':'Continuar')+'</button></div></form>';return html;
}
function confirmHTML(){return '<h1 id="screen-title" tabindex="-1">Revisa tu check-in</h1><p>Comprueba tus respuestas antes de enviarlas.</p>'+summaryHTML(answers)+'<p class="muted small">Después de enviarlo, el check-in de esta semana no se podrá editar.</p><p id="draft-status" class="draft-status">Borrador guardado en este dispositivo.</p><div class="actions">'+button('Atrás','back')+button('Enviar check-in','submit',true)+'</div>';}
function factHTML(f){return '<li><strong>'+escape(f.exercise_name||'Entrenamientos registrados')+'</strong><p>'+escape(f.summary)+'</p>'+(f.sets?.length?'<small>'+f.sets.map(s=>'S'+escape(s.set_number)+' · '+escape(s.kg??'—')+' kg / '+escape(s.reps??'—')+' reps / RIR '+escape(s.rir??'—')).join('<br>')+'</small>':'')+'</li>';}
function setText(s){return 'S'+s.set_number+' · '+s.reps_min+(s.reps_max!==s.reps_min?'–'+s.reps_max:'')+' reps · RIR '+s.rir+' · '+String(s.rest_seconds/60).replace('.',',')+' min';}
function changesHTML(changes){return changes.map(c=>{
 if(c.action==='weekly_schedule')return '<li><strong>Distribución de la próxima semana</strong><p class="muted small">Se conservan los días de la rutina y sus ejercicios.</p><div class="schedule">'+c.days.map(d=>'<div><strong>'+escape(d.logical_day_name)+'</strong><span>'+escape(days.find(x=>x[0]===d.from_weekday)?.[1]||'Sin día')+' → '+escape(days.find(x=>x[0]===d.to_weekday)?.[1]||'Sin día')+'</span><span>'+escape(d.minutes)+' min disponibles</span></div>').join('')+'</div></li>';
 return '<li><strong>'+escape(c.exercise_name)+'</strong><div class="series-comparison"><div><span class="series-label">Antes</span>'+c.before.map(s=>'<div>'+escape(setText(s))+'</div>').join('')+'</div><div><span class="series-label">Después</span>'+c.after.map(s=>'<div>'+escape(setText(s))+'</div>').join('')+'</div></div>'+(c.removed_set?'<small>Se elimina la serie '+escape(c.removed_set)+' original. Las restantes conservan su orden relativo.</small>':'')+'</li>';
 }).join('');}
function analysisHTML(){
 const r=view.recommendation,c=view.checkin;const titles={KEEP:'Mantener la rutina',MODIFY:'Propuesta de ajuste',REVIEW:'Revisión necesaria'};
 const states={pending_review:'Pendiente de revisión humana',ready:'Revisada y lista para aceptar',accepted:'Aceptada',rejected:'Propuesta rechazada',stale:'La propuesta pertenece a una revisión anterior'};
 let html='<p class="status">'+escape(states[r.state]||r.state)+'</p><h1 id="screen-title" tabindex="-1">'+titles[r.kind]+'</h1><section><h2>Qué observamos</h2>'+(r.facts.length?'<ul class="facts">'+r.facts.map(factHTML).join('')+'</ul>':'<p class="empty">Aún no hay suficientes entrenamientos comparables para establecer una tendencia.</p>')+'</section><section><h2>Tu check-in</h2>'+(c?.submitted_at?summaryHTML(c.answers):'<p class="missing">No hay check-in enviado para esta semana. El análisis utiliza solo los entrenamientos registrados.</p>')+'</section><section><h2>Qué recomendamos</h2><p>'+escape(r.reason)+'</p></section>';
 if(r.changes.length&&r.kind!=='REVIEW')html+='<section id="before-after"><h2>Antes → Después</h2><ul class="changes">'+changesHTML(r.changes)+'</ul></section>';
 if(r.kind==='REVIEW')html+='<p class="review-required">Esta revisión no se aplica a la rutina. El reviewer debe resolverla antes de que puedas aceptar una decisión.</p>';
 html+='<div class="actions">';
 if(r.state==='pending_review'&&view.actor==='reviewer'){html+=r.kind==='REVIEW'?button('Resolver sin cambios','resolve',true):button('Validar propuesta','review',true);html+=button('Rechazar','reject');}
 if(r.state==='pending_review'&&view.actor==='athlete')html+='<p>Podrás aceptar la recomendación después de la revisión humana.</p>';
 if(r.state==='ready'&&view.actor==='athlete'&&r.kind!=='REVIEW')html+=button(r.kind==='KEEP'?'Aceptar mantener':'Aceptar ajuste','accept',true);
 if(r.state==='accepted')html+='<p>'+escape(r.kind==='KEEP'?'Se mantiene tu rutina.':'El ajuste está aplicado en una nueva revisión de tu rutina.')+'</p>';
 if(r.state==='stale')html+=button('Cargar semana actual','reload',true);
 return html+'</div>';
}
function render(){
 if(!view)return;
 $('breadcrumb').textContent='Premium · Mesociclo '+view.mesocycle.number+' · Semana '+view.week.number+' de '+view.mesocycle.planned_weeks+' · Revisión '+view.mesocycle.revision_no;
 $('weeks').innerHTML=Array.from({length:view.mesocycle.planned_weeks},(_,i)=>'<li '+(i+1===view.week.number?'aria-current="step"':'')+'><span class="sr-only">Semana </span>'+(i+1)+'</li>').join('');
 $('week-heading').textContent='Semana '+view.week.number+' de '+view.mesocycle.planned_weeks;
 $('week-facts').textContent=view.session_summary;
 $('weekly-app').innerHTML=screen==='question'?questionHTML():screen==='confirm'?confirmHTML():home();
 if(conflict)$('weekly-app').insertAdjacentHTML('beforeend','<div class="actions">'+button('Cargar borrador actualizado','reload',true)+'</div>');
 bind();setBusy(busy);
}
function bind(){
 document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>action(b.dataset.action));
 const form=$('checkin-form');if(!form)return;
 form.onsubmit=e=>{e.preventDefault();action('next');};
 form.querySelectorAll('[name=answer]').forEach(input=>input.onchange=()=>{
  if(step<5)answers[questions[step].key]=input.value;
  else if(step===5){answers.availability.changed=input.value==='true';if(!answers.availability.changed){answers.availability.weekdays=[];answers.availability.minutes_by_day={};}}
  else {answers.review.topic=input.value;if(input.value!=='exercise')answers.review.exercise_id=null;}
  localSave();message('');if(step>=5){const id=input.value;render();document.querySelector('[name=answer][value="'+id+'"]').focus();}
 });
 form.querySelectorAll('[name=weekday]').forEach(input=>input.onchange=()=>{const d=input.value;if(input.checked)answers.availability.weekdays=days.map(x=>x[0]).filter(x=>x===d||answers.availability.weekdays.includes(x));else{answers.availability.weekdays=answers.availability.weekdays.filter(x=>x!==d);delete answers.availability.minutes_by_day[d];}localSave();render();document.querySelector('[name=weekday][value="'+d+'"]').focus();});
 form.querySelectorAll('[data-day]').forEach(input=>input.onchange=()=>{answers.availability.minutes_by_day[input.dataset.day]=input.value?Number(input.value):null;localSave();message('');});
 if($('exercise'))$('exercise').onchange=e=>{answers.review.exercise_id=e.target.value||null;localSave();message('');};
}
async function ensurePermission(){
 if(view.permission)return true;
 if(!$('permission')?.checked){message('Marca el permiso para usar tus respuestas junto con tu historial de entrenamiento.',true);$('permission')?.focus();return false;}
 return run('permission',{allow:true},()=>{view.permission=true;});
}
async function persist(submit){
 return run('save',{week:view.week.number,revision:view.mesocycle.revision_id,expected:view.checkin?.row_version||0,answers:clone(answers),submit},c=>{view.checkin=c;dirty=false;if(submit){try{localStorage.removeItem(localKey);}catch{}}else localSave();});
}
async function action(which){
 if(which==='reload'){try{localStorage.removeItem(localKey);}catch{}await load();return;}
 if(busy||conflict)return;
 if(which==='start'){if(!await ensurePermission())return;screen='question';render();focusTitle();return;}
 if(which==='back'){epoch++;message('');if(screen==='confirm'){screen='question';step=6;}else if(step>0)step--;else screen='home';localSave();render();focusTitle();return;}
 if(which==='next'){const error=validateStep(answers,step,view.exercises);if(error){message(error,true);return;}if(!await persist(false))return;if(step===6)screen='confirm';else step++;localSave();render();focusTitle();return;}
 if(which==='submit'){const error=validateAnswers(answers,view.exercises);if(error){message(error,true);return;}if(await persist(true)){screen='home';render();message('Check-in enviado. Ya puedes analizar esta semana.');focusTitle();}return;}
 if(which==='analyze'||which==='analyze-missing'){if(!await ensurePermission())return;await run('analyze',{},r=>{view.recommendation=r;render();focusTitle();});return;}
 if(['review','reject','resolve','accept'].includes(which))await run(which,{id:view.recommendation.id},s=>{view=s;render();focusTitle();});
}
window.addEventListener('storage',e=>{if(e.key===localKey&&e.newValue&&view&&!view.checkin?.submitted_at){try{const v=JSON.parse(e.newValue);if(v.writer!==tabId){epoch++;busy=false;conflict=true;render();message(errors.premium_weekly_conflict,true);}}catch{}}});
$('case').onchange=()=>load();$('actor').onchange=()=>load();
$('reset').onclick=async()=>{++epoch;busy=false;try{await api('reset');if(localKey)localStorage.removeItem(localKey);await load();}catch{message('No se ha podido reiniciar la simulación.',true);}};
$('theme').onclick=()=>{const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';localStorage.setItem('premium-weekly-theme',dark?'dark':'light');$('theme').textContent=dark?'Claro':'Oscuro';};
$('theme').textContent=document.documentElement.dataset.theme==='dark'?'Claro':'Oscuro';
scope.PremiumWeeklyUI={load,inspect:()=>({screen,step,answers:clone(answers),busy,conflict,view:clone(view),epoch})};load();
})(typeof window==='undefined'?globalThis:window);
