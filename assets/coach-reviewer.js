/* Restricted closed-pilot reviewer. Capability is checked by every server RPC. */
async function renderCoachReviewerEntry(){
 if(!coachEnabled()||!user)return;
 const owner=user.id,old=$('coachReviewerEntry');if(old)old.remove();
 try{const allowed=await coachCall('get_coach_reviewer_access',{});if(!allowed||owner!==user?.id)return;
 $('coachReviewerEntry')?.remove();
 const host=document.createElement('div');host.id='coachReviewerEntry';host.className='card';host.innerHTML='<button data-keep-enabled="true" class="btn" type="button">SIMPLE Coach · Revisiones</button>';
 host.querySelector('button').onclick=openCoachReviewer;
 (profile?.role==='client'?$('shared'):$('app')).append(host);
 }catch(_){/* A capability failure never grants reviewer access. */}
}
async function openCoachReviewer(){
 if(!coachEnabled())return;const owner=user?.id,epoch=++simpleCoach.epoch;
 coachShell('<p>Cargando revisión restringida…</p>');
 try{const [rows,metrics,feedback,status]=await Promise.all([coachCall('get_coach_review_queue',{}),coachCall('get_coach_pilot_metrics',{}),db.from('coach_pilot_feedback').select('*').order('updated_at',{ascending:false}),coachCall('get_coach_reviewer_status',{})]);
 if(feedback.error)throw feedback.error;
 if(!coachCurrent(epoch,owner))return;if(!status.authorized)throw Error('coach_reviewer_required');
 const names={authorized:'Autorizados',intakes_started:'Anamnesis iniciadas',intakes_completed:'Anamnesis enviadas',generations:'Generaciones',valid_proposals:'Propuestas válidas',blocked:'Bloqueadas por seguridad',reviewer_approved:'Aprobadas',reviewer_rejected:'Rechazadas',athlete_accepted:'Aceptadas por atleta',mean_cost:'Coste medio estimado (USD)',mean_latency_ms:'Latencia media (ms)',users_started_routine:'Atletas con entrenamiento guardado'};
 const remaining=Date.parse(status.expires_at)-Date.now(),expiryWarning=remaining>0&&remaining<=7*86400000?'<p role="status" class="coach-expiry">Tu permiso de reviewer caduca el '+esc(new Date(status.expires_at).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'}))+'.</p>':'';
 coachShell('<h3>SIMPLE Coach · Revisiones</h3>'+expiryWarning+'<p>Contexto de entrenamiento consentido, sin información de salud. Revisa la propuesta completa antes de decidir; no se puede editar desde esta pantalla.</p><details><summary>Métricas agregadas</summary><dl>'+Object.entries(names).map(([k,v])=>'<dt>'+v+'</dt><dd>'+esc(String(metrics[k]??'—'))+'</dd>').join('')+'</dl></details><div id="coachQueue"></div>');
 const queue=$('coachQueue');if(!rows.length)queue.innerHTML='<p>No hay propuestas con contexto autorizado para revisar.</p>';
 const comments=document.createElement('details');comments.innerHTML='<summary>Feedback del piloto ('+(feedback.data||[]).length+')</summary>'+(feedback.data||[]).map(f=>'<p><b>'+f.rating+'/5</b> · '+esc(f.comment||'Sin comentario')+'<br><small>Rutina '+esc(f.routine_id)+'</small></p>').join('');queue.before(comments);
 for(const row of rows){const o=row.operation,section=document.createElement('section');section.className='coach-day';
 const expired=o.state==='reserved'&&Number.isFinite(Date.parse(o.expires_at))&&Date.parse(o.expires_at)<=Date.now();
 const state=expired?'Generación interrumpida':({pending_review:'Pendiente de revisión',ready:'Aprobada',rejected:'Rechazada',accepted:'Aceptada por atleta',athlete_declined:'Rechazada por atleta',failed:'Generación bloqueada o fallida',stale:'Contexto cambiado',reserved:'Preparándose'}[o.state]||o.state);
 const statusMessage=expired?'La solicitud ha caducado sin confirmación. Puedes autorizar un nuevo intento; no se enviará automáticamente.':o.state==='reserved'?'La generación está en curso; todavía no hay una propuesta para revisar.':coachMessage(o.error_code);
 section.innerHTML='<h3>'+esc(state)+'</h3><p><b>Atleta: '+esc(row.athlete?.name||o.user_id)+'</b></p><details class="coach-operation-meta"><summary>Referencia de la operación</summary><p>'+esc(o.id)+'</p></details><details open><summary>Contexto de entrenamiento autorizado</summary>'+coachTrainingMarkup(row.training)+'</details>'+(o.proposal?coachProposalMarkup(o.proposal):'<p>'+esc(statusMessage)+'</p>')+(o.proposal?reviewerVolume(o.proposal):'')+(o.review_reason?'<p>Decisión: '+esc(o.review_reason)+' · '+esc(o.reviewed_at)+'</p>':'')+(o.athlete_comment?'<p>Comentario del atleta: '+esc(o.athlete_comment)+'</p>':'')+(row.feedback?'<p>Feedback: '+row.feedback.rating+'/5 · '+esc(row.feedback.comment||'Sin comentario')+'</p>':'');
 if(o.state==='pending_review'||((expired||['failed','stale','rejected','athlete_declined'].includes(o.state))&&!o.retry_authorized_at)){
 const form=document.createElement('form');form.innerHTML='<label>Motivo de la decisión<textarea required maxlength="1000"></textarea></label><div class="buttons">'+(o.state==='pending_review'?'<button data-keep-enabled="true" class="btn primary" type="submit" value="approve">Aprobar propuesta</button><button data-keep-enabled="true" class="btn" type="submit" value="reject">Rechazar propuesta</button>':'<button data-keep-enabled="true" class="btn" type="submit" value="retry">Autorizar un nuevo intento</button>')+'</div>';
 form.onsubmit=async e=>{e.preventDefault();if(simpleCoach.busy)return;const action=e.submitter?.value,reason=form.querySelector('textarea').value.trim();if(!['approve','reject','retry'].includes(action)||!reason)return;coachBusy(true);try{await coachCall(action==='retry'?'authorize_coach_retry':'review_coach_proposal',action==='retry'?{p_operation:o.id,p_reason:reason}:{p_operation:o.id,p_approve:action==='approve',p_reason:reason});if(coachCurrent(epoch,owner))await openCoachReviewer();}catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}finally{if(coachCurrent(epoch,owner))coachBusy(false);}};section.append(form);
 }
 queue.append(section);
 }
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
}
function reviewerVolume(p){
 const exercises=new Map();for(const d of p.days)for(const e of d.exercises){const v=exercises.get(e.name)||{sets:0,days:new Set()};v.sets+=e.sets;v.days.add(d);exercises.set(e.name,v);}
 return '<details><summary>Volumen y frecuencia por ejercicio</summary><ul>'+[...exercises].map(([name,v])=>'<li>'+esc(name)+': '+v.sets+' series / ciclo; '+v.days.size+' días</li>').join('')+'</ul><p class="muted">Revisa también la distribución muscular, recuperación y coherencia con la anamnesis. Estos totales no sustituyen el juicio profesional.</p></details>';
}
