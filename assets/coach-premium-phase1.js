/* Internal staging preview adapter. Never loaded by the public application. */
(function(){
'use strict';
const originalRender=coachRenderQuestionnaire,originalReview=coachWizardReview;
let workspace=null,busy=false,viewEpoch=0;
const labels={draft:'Borrador',active:'Activo',completed:'Completado',cancelled:'Cancelado',ready:'Validada',pending_review:'Pendiente de revisión',accepted:'Aceptada',rejected:'Rechazada',superseded:'Sustituida por otra recomendación',reps_increasing_comparable:'Aumentan las repeticiones con carga y RIR comparables',stable_comparable:'Rendimiento estable con carga y RIR comparables',reps_decreasing_comparable:'Bajan las repeticiones con carga y RIR comparables',mixed_comparable:'Evolución variable entre exposiciones comparables',context_changed_or_incomplete:'Cambió el contexto o faltan datos para comparar',insufficient_data:'No hay suficientes exposiciones para comparar'};
const api=async(action,data={})=>{const r=await fetch('/premium-api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,data})});const v=await r.json();if(!r.ok)throw Error(v.error||'No se pudo completar la acción.');return v;};
const feedback=(message,error=false)=>{const e=$('coachError');e.setAttribute('role',error?'alert':'status');e.textContent=message;};
async function run(button,task){if(busy)return;busy=true;button.disabled=true;button.setAttribute('aria-busy','true');try{await task();}catch(e){feedback(e.message,true);}finally{busy=false;button.disabled=false;button.removeAttribute('aria-busy');}}
function nav(){const n=document.createElement('nav');n.className='premium-nav';n.setAttribute('aria-label','Seguimiento Premium');n.innerHTML=['Anamnesis','Historial autorizado','Mesociclo','Recomendaciones'].map((x,i)=>'<button class="btn" type="button" data-premium-page="'+i+'">'+x+'</button>').join('');n.onclick=e=>{if(!busy&&e.target.dataset.premiumPage!==undefined)show(Number(e.target.dataset.premiumPage)).catch(error=>feedback(error.message,true));};return n;}
function heading(title){$('coachForm').hidden=true;$('coachQuestion').hidden=true;$('coachStep').hidden=true;$('coachProposal').innerHTML='<h3 tabindex="-1" id="premiumHeading">'+esc(title)+'</h3>';$('coachProposal').prepend(nav());$('premiumHeading').focus();}
async function show(page){
 const epoch=++viewEpoch;
 if(page===0){coachStartQuestionnaire(workspace?.intake?.schema_version?workspace.intake:null,true);return;}
 heading(['','Historial autorizado','Mesociclo','Recomendaciones'][page]);
 const area=document.createElement('div');$('coachProposal').append(area);
 if(page===1){area.innerHTML='<p>Permito a SIMPLE Coach utilizar mi historial de entrenamiento en SIMPLE para analizar mi evolución y personalizar mi programación.</p><button class="btn" id="premiumPermission">'+(workspace.allowed?'Revocar permiso':'Autorizar historial')+'</button><div id="premiumHistory" aria-live="polite"></div>';
  $('premiumPermission').onclick=e=>run(e.target,async()=>{const value=await api('permission',{allow:!workspace.allowed});workspace.allowed=value.allowed;await show(1);});
  if(workspace.allowed){try{const h=await api('history');if(epoch!==viewEpoch)return;$('premiumHistory').innerHTML='<p class="muted">Últimas 4 exposiciones por ejercicio · ventana de 8 semanas. Sin notas personales ni datos de otras cuentas.</p>'+h.exercises.map(e=>'<section class="premium-row"><strong>'+esc(e.name)+'</strong><p>'+esc(String(e.metrics.exposures))+' exposiciones · '+esc(labels[e.metrics.trend]||'Datos registrados')+'</p><p>'+e.exposures.map(x=>esc(x.date)+' · '+x.sets.map(s=>esc(s.kg??'—')+' kg / '+esc(s.reps??'—')+' reps / RIR '+esc(s.rir??'—')).join('; ')).join('<br>')+'</p></section>').join('');}catch(e){if(epoch===viewEpoch)feedback(e.message,true);}}
  else $('premiumHistory').textContent='Sin permiso no se realizan nuevos análisis. Revocar no borra recomendaciones previas.';
 }
 if(page===2){const m=await api('mesocycle');if(epoch!==viewEpoch)return;area.innerHTML='<p>Mesociclo '+esc(String(m.number))+' · '+esc(labels[m.state]||m.state)+' · '+esc(String(m.planned_weeks))+' semanas</p><p>Las semanas pueden compartir revisión. No se cambia la rutina automáticamente cada semana.</p><ol class="premium-weeks">'+m.weeks.map(w=>'<li>Semana '+esc(String(w.week_number))+' <span>Revisión '+esc(String(w.revision_no))+'</span></li>').join('')+'</ol>';}
 if(page===3){const rows=await api('recommendations');if(epoch!==viewEpoch)return;area.innerHTML=rows.length?rows.map(r=>'<section class="premium-row"><h4>'+esc(r.kind==='KEEP'?'Mantener':r.kind==='MODIFY'?'Modificar':'Revisar manualmente')+'</h4><p>'+esc(labels[r.state]||r.state)+'</p><p><strong>Hechos:</strong> '+r.facts.map(esc).join(' · ')+'</p><p><strong>Interpretación:</strong> '+esc(r.interpretation)+'</p>'+(r.patches.length?'<pre>'+esc(JSON.stringify(r.patches,null,2))+'</pre>':'')+'<p>Solo una recomendación validada admite aceptación explícita. La fase actual no aplica cambios desde esta preview.</p></section>').join(''):'<p>No hay recomendaciones. Se puede mantener la rutina sin crear una revisión.</p>';}
}
coachRenderQuestionnaire=function(){originalRender();if(!simpleCoach.wizard?.premium)return;
 $('coachDialog').querySelector('.coach-heading + p').textContent='Premium · entorno interno. Anamnesis y seguimiento, sin generación IA ni contratación.';
 $('coachForm').prepend(nav());const b=$('coachDraft');if(b){b.hidden=false;b.onclick=()=>run(b,async()=>{const r=await api('save',{training:simpleCoach.wizard.data,expected:workspace.row_version,submit:false});workspace=r;feedback('Borrador Premium guardado.');});}
};
coachWizardReview=function(){if(!simpleCoach.wizard?.premium)return originalReview();originalReview();
 const paragraphs=$('coachProposal').querySelectorAll(':scope > p');paragraphs.forEach(p=>{if(p.textContent.startsWith('Preview terminada'))p.textContent='Se guardará la anamnesis Premium. Esta fase no genera ninguna rutina ni envía información a OpenAI.';});
 const b=document.createElement('button');b.className='btn primary';b.textContent='Guardar anamnesis Premium';b.id='premiumSubmit';b.type='button';
 b.onclick=()=>run(b,async()=>{workspace=await api('save',{training:simpleCoach.wizard.data,expected:workspace.row_version,submit:true});feedback('Anamnesis guardada. Puedes revisar el permiso de historial.');b.hidden=true;});$('coachProposal').append(b);$('coachProposal').prepend(nav());
};
addEventListener('message',async event=>{if(event.origin!==location.origin||event.data!=='premium-phase1')return;try{workspace=await api('state');simpleCoach.intake=null;simpleCoach.accepted=false;coachStartQuestionnaire(workspace.intake?.schema_version?workspace.intake:null,true);}catch(e){console.error('Premium preview unavailable');}});
})();
