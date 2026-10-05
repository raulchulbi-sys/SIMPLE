/* Internal staging preview only. The published application does not load this file. */
(function(){'use strict';
const $=id=>document.getElementById(id),escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={pending_review:'Pendiente de revisión humana',ready:'Validada; pendiente de tu aceptación',accepted:'Aceptada',superseded:'La propuesta ya no corresponde a la revisión o semana actual',analyzing:'Analizando…',invalid:'Respuesta no aplicable',failed:'El análisis no pudo completarse',rejected:'Rechazada'};
let view=null,busy=false,epoch=0;
async function api(action,data={}){const r=await fetch('/analysis-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,tag:$('case').value,actor:$('actor').value,data})});const v=await r.json();if(!r.ok)throw Error(v.error||'No se pudo completar la solicitud.');return v;}
function message(text,error=false){$('message').setAttribute('role',error?'alert':'status');$('message').textContent=text;}
async function run(action,data={}){if(busy)return;busy=true;document.querySelectorAll('.actions button,.review-tools select').forEach(b=>b.disabled=true);$('actions').setAttribute('aria-busy','true');message('Procesando…');try{await api(action,data);if(!await load())throw Error('La acción terminó, pero no se pudo actualizar la vista.');message('Acción completada.');}catch(e){message(e.message,true);}finally{busy=false;$('actions').removeAttribute('aria-busy');document.querySelectorAll('.actions button,.review-tools select').forEach(b=>b.disabled=false);}}
function exercise(ref){return view.context.routine.exercises.find(e=>e.ref===ref);}
function name(ref){const e=exercise(ref);return view.catalogue.find(c=>c.id===e?.catalogue_id)?.name||'Ejercicio sin vinculación de catálogo';}
function factText(f){const e=exercise(f.exercise_ref),trend=f.claim||e?.metrics.trend;const t={reps_increasing_comparable:'Aumentan las repeticiones con carga y RIR comparables.',stable_comparable:'Rendimiento estable con carga y RIR comparables.',reps_decreasing_comparable:'Bajan las repeticiones con carga y RIR comparables.',mixed_comparable:'Las exposiciones comparables muestran una evolución variable.',insufficient_data:'No hay suficientes exposiciones para establecer una tendencia.',context_changed_or_incomplete:'Cambió el contexto o faltan datos para comparar.'}[trend]||'Datos registrados.';
 const observations=f.observations||e?.exposures||[];return '<li><strong>'+escape(name(f.exercise_ref))+'</strong> — '+escape(t)+'<small>'+observations.slice(0,3).map(x=>escape(x.date)+' · '+x.sets.map((s,i)=>'S'+escape(s.set_number??i+1)+' '+escape(s.kg??'—')+' kg / '+escape(s.reps??'—')+' reps / RIR '+escape(s.rir??'—')).join('; ')+(x.prescription_source==='unknown'?' · Prescripción histórica no identificada.':'')).join('<br>')+'</small></li>';}
function changeText(c){const label={change_sets:'series',change_reps:'reps',change_rir:'RIR',change_rest:'descanso (s)',change_distribution:'día'}[c.action];let a=c.from,b=c.to;
 if(c.action==='replace_exercise'){a=view.catalogue.find(e=>e.id===c.from_catalogue_id)?.name||c.from_catalogue_id;b=view.catalogue.find(e=>e.id===c.to_catalogue_id)?.name||c.to_catalogue_id;}
 if(c.action==='change_distribution'){a=c.from_day_ref;b=c.to_day_ref;}
 return '<li><strong>'+escape(name(c.exercise_ref))+'</strong>'+escape(a)+' → '+escape(b)+(label?' '+escape(label):'')+'</li>';}
function seriesText(s){const minutes=String(s.rest_seconds/60).replace('.',',');return 'S'+s.set_number+' · '+s.reps_min+(s.reps_max!==s.reps_min?'–'+s.reps_max:'')+' reps · RIR '+s.rir+' · '+minutes+' min';}
function seriesChanges(changes){const per=changes.filter(c=>['change_set','remove_set','add_set'].includes(c.action));const refs=[...new Set(per.map(c=>c.exercise_ref))];
 return changes.filter(c=>!per.includes(c)).map(changeText).join('')+refs.map(ref=>{const before=exercise(ref)?.planned_sets||[],cs=per.filter(c=>c.exercise_ref===ref);let after=before.map(s=>({...s}));
 for(const c of cs){if(c.action==='change_set')after[c.set_number-1]={...c.to,set_number:c.set_number};if(c.action==='remove_set')after=after.filter(s=>s.set_number!==c.set_number).map((s,i)=>({...s,set_number:i+1}));if(c.action==='add_set')after.push({...c.to,set_number:c.set_number});}
 const column=(title,sets)=>'<div><span class="series-label">'+title+'</span>'+sets.map(s=>'<div>'+escape(seriesText(s))+'</div>').join('')+'</div>';
 return '<li><strong>'+escape(name(ref))+'</strong><div class="series-comparison">'+column('Antes',before)+column('Después',after)+'</div>'+cs.filter(c=>c.action==='remove_set').map(c=>'<small>Se elimina la serie '+escape(c.set_number)+' original. Las restantes conservan su orden relativo.</small>').join('')+'</li>';}).join('');}
function button(text,action,data,primary=false){const b=document.createElement('button');b.type='button';b.textContent=text;if(primary)b.className='primary';b.onclick=()=>run(action,data);$('actions').append(b);}
function render(){const m=view.mesocycle,r=view.recommendation,o=r?.analysis_trace?.output;
 $('breadcrumb').textContent='Premium · Mesociclo '+m.number+' · Semana '+m.tracking_week+' de '+m.planned_weeks+' · Revisión '+m.revision_no;
 $('weeks').innerHTML=view.weeks.map(w=>'<li '+(w.week_number===m.tracking_week?'aria-current="step"':'')+'>Semana '+w.week_number+'<br><small>Revisión '+w.revision_no+'</small></li>').join('');
 $('title').textContent=!r?'Análisis de la semana':r.kind==='KEEP'?'Mantener la rutina':r.kind==='MODIFY'?'Propuesta de cambio':'Revisión manual';$('status').textContent=r?labels[r.state]||r.state:'Aún no hay un análisis de esta semana.';
 const unsafe=!!r?.analysis_trace?.error,changes=unsafe?[]:o?.changes||[];
 $('facts').innerHTML=r?(r.facts?.length?r.facts:unsafe?view.context.routine.exercises.map(e=>({exercise_ref:e.ref,claim:e.metrics.trend})):o?.facts||[]).map(factText).join(''):'';$('interpretation').textContent=r?.interpretation||'';$('reason').textContent=r?.analysis_trace?.review_issue||o?.reason||'';
 $('changes').innerHTML=seriesChanges(changes);$('changes-section').hidden=!changes.length;$('observations-section').hidden=!r;
 $('warning').textContent=(r?.analysis_trace?.quality_warnings||[]).join(' · ');$('actions').replaceChildren();
 if(view.can_analyze)button('Analizar semana actual','analyze',{},true);
 if(r&&view.actor==='reviewer'&&r.state==='pending_review'){
  if(r.kind==='REVIEW')button('Resolver sin cambios','resolve',{id:r.id},true);else button('Validar propuesta','review',{id:r.id,approve:true},true);
  button('Rechazar','review',{id:r.id,approve:false});
 }
 if(r&&view.actor==='athlete'&&r.state==='ready')button(r.kind==='KEEP'?'Aceptar mantener':'Aceptar cambios','accept',{id:r.id},true);
 if(r&&r.state==='pending_review'&&view.actor==='athlete')$('actions').textContent='Podrás aceptar después de la revisión humana.';
 if(r?.state==='accepted')$('actions').textContent=r.kind==='KEEP'?'Se mantiene la revisión de rutina.':'La nueva revisión está activa.';
}
async function load(){const ticket=++epoch;try{const data=await api('state');if(ticket!==epoch)return false;view=data;render();return true;}catch(e){if(ticket===epoch)message(e.message,true);return false;}}
$('case').onchange=()=>{message('');load();};$('actor').onchange=()=>{message('');load();};$('theme').onclick=()=>{const t=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=t;localStorage.setItem('premium-preview-theme',t);$('theme').textContent=t==='dark'?'Claro':'Oscuro';};
$('theme').textContent=document.documentElement.dataset.theme==='dark'?'Claro':'Oscuro';load();
})();
