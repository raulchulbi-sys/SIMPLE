/* Closed supervised pilot. UI choices never grant server capabilities. */
const simpleCoach={epoch:0,intake:null,operation:null,busy:false,accepted:false,pageActive:true};
function coachEnabled(){return simpleCoach.pageActive&&['https://dmqjexigdnfzobarhnib.supabase.co','https://yvguatdqncadkwewlepe.supabase.co'].includes(SUPABASE_URL);}
// A cancelled read must not start another request from an unloading document.
let coachPageHidden=false;
addEventListener('beforeunload',()=>{
 simpleCoach.pageActive=false;
 // If another existing handler cancels navigation, keep Coach usable.
 setTimeout(()=>{if(!coachPageHidden)simpleCoach.pageActive=true;},0);
});
addEventListener('pagehide',()=>{coachPageHidden=true;simpleCoach.pageActive=false;simpleCoach.epoch++;});
addEventListener('pageshow',()=>{coachPageHidden=false;simpleCoach.pageActive=true;});
async function renderCoachHome(isCurrent=()=>true){
 if(!coachEnabled()||profile?.role!=='client')return;
 const result=await db.from('routine_management').select('routine_id');
 if(!isCurrent()||!coachEnabled())return;
 const access=await db.rpc('get_my_coach_access',{});
 if(!isCurrent()||!coachEnabled())return;
 if(!access.data?.authorized&&!(result.data||[]).length)return;
 if(!result.error&&(assignments||[]).length&&!(result.data||[]).length)return;
 const host=document.createElement('div');host.id='coachHome';$('shared').append(host);
 host.innerHTML='<div class="card"><h2>¿Cómo quieres entrenar?</h2><div class="buttons"><button data-keep-enabled="true" class="btn" onclick="openRedeemRoutine()">Vincularme con un entrenador</button><button data-keep-enabled="true" class="btn primary" onclick="openSimpleCoach()">Entrenar con SIMPLE Coach</button></div></div>';
 if(result.error){host.insertAdjacentHTML('beforeend','<p role="status">No se pudo cargar SIMPLE Coach. Vuelve a abrir Inicio para reintentar.</p>');return;}
 for(const item of result.data||[]){
  const r=routines.find(x=>x.id===item.routine_id);if(!r)continue;
  const cycle=await getWeeklyRoutineProgressForUser(user.id,[r.id]);
  if(!isCurrent())return;
  const p=cycle.get(r.id)||{done:0,total:0};
  host.insertAdjacentHTML('beforeend','<div class="card"><h3>'+esc(r.name)+'</h3><p class="muted">SIMPLE Coach · piloto</p>'+renderWeeklyRoutineProgress(p.total,p.done,user.id+'|'+r.id)+'<div class="buttons"><button data-keep-enabled="true" class="btn primary" onclick="openCoachRoutine(\''+r.id+'\')">Entrenar</button><button data-keep-enabled="true" class="btn" onclick="openRoutineProgress(\''+r.id+'\')">Progreso</button></div></div>');
 }
}
async function openCoachRoutine(id){
 await openSharedRoutine(id);
 if(workoutRoutine?.id===id)$('trainSubtitle').textContent='SIMPLE Coach · prescripción fija del piloto';
}
function coachDialog(){
 let d=$('coachDialog');
 if(!d){d=document.createElement('dialog');d.id='coachDialog';d.className='coach-dialog';d.setAttribute('aria-labelledby','coachTitle');document.body.append(d);
 d.addEventListener('close',()=>{simpleCoach.epoch++;simpleCoach.busy=false;});}
 return d;
}
function coachShell(content){
 const d=coachDialog();
 simpleCoach.busy=false;d.setAttribute('aria-busy','false');
 d.innerHTML='<div class="coach-heading"><h2 id="coachTitle" tabindex="-1">SIMPLE Coach</h2><button data-keep-enabled="true" class="btn" aria-label="Cerrar SIMPLE Coach" onclick="document.getElementById(\'coachDialog\').close()">Cerrar</button></div><p class="muted">Basic · piloto sin cobro. Tu propuesta tendrá revisión humana antes de que puedas aceptarla.</p><div id="coachError" role="alert"></div><div id="coachStatus" role="status" aria-live="polite"></div>'+content;
 if(!d.open)d.showModal();$('coachTitle').focus();
}
function coachMessage(code){
 const messages={coach_retry_review_required:'Ya se ha utilizado el intento disponible. Solicita al reviewer autorización para otro intento.',coach_review_required:'La propuesta necesita aprobación del reviewer.',coach_reviewer_required:'No tienes permiso para revisar propuestas.',coach_feedback_workout_required:'Podrás valorar esta rutina después de guardar tu primer entrenamiento.',coach_invalid_feedback:'Elige una valoración de 1 a 5 y un comentario de hasta 1.000 caracteres.',coach_pilot_required:'Esta cuenta todavía no tiene acceso al piloto.',coach_context_required:'Autoriza los dos contextos para generar la propuesta.',coach_intake_conflict:'El formulario cambió en otra pestaña. Vuelve a abrirlo para cargar la versión actual.',coach_current_intake_required:'Guarda y envía la anamnesis actual antes de generar.',coach_proposal_not_ready:'La propuesta ya no está vigente. Revisa el formulario y genera otra.',coach_intake_changed:'La anamnesis ha cambiado. Esta propuesta no se puede aceptar.',coach_context_changed:'Los permisos cambiaron. Genera una nueva propuesta.',coach_rate_limit:'Se ha alcanzado el límite de intentos. Espera antes de reintentar.',safety_review_required:'SIMPLE Coach necesita aclarar esta situación antes de generar una planificación responsable. Solicita una revisión profesional.'};
 return messages[code]||'No se pudo completar la acción. Tus datos guardados se conservan; puedes reintentar.';
}
async function coachCall(name,args){const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
function coachBusy(value,label='Procesando…'){
 simpleCoach.busy=value;const d=coachDialog();d.setAttribute('aria-busy',String(value));
 d.querySelectorAll('form button,form input,form textarea,form select,#coachAccept,#coachConfirmSend,#coachDecline,#coachReviewBack').forEach(x=>x.disabled=value);
 if($('coachStatus'))$('coachStatus').textContent=value?label:'';
}
async function openSimpleCoach(){
 if(!coachEnabled()||profile?.role!=='client')return;
 const owner=user.id,epoch=++simpleCoach.epoch;simpleCoach.intake=null;simpleCoach.operation=null;
 coachShell('<p>Cargando tu acceso…</p>');
 try{
  const access=await coachCall('get_my_coach_access',{});
  if(epoch!==simpleCoach.epoch||user?.id!==owner)return;
  simpleCoach.accepted=!!access.routine_id;
  if(access.routine_id){coachShell('<p>Ya tienes tu primera rutina Basic.</p><div class="buttons"><button data-keep-enabled="true" class="btn primary" id="coachOpen">Abrir rutina</button><button data-keep-enabled="true" class="btn" id="coachContext">Anamnesis y permisos</button>'+(access.can_feedback?'<button data-keep-enabled="true" class="btn" id="coachFeedback">Valorar rutina</button>':'')+'</div>');$('coachOpen').onclick=()=>{coachDialog().close();openCoachRoutine(access.routine_id)};$('coachContext').onclick=coachLoadIntake;if($('coachFeedback'))$('coachFeedback').onclick=()=>coachFeedback(access.routine_id);return;}
  if(!access.authorized){coachShell('<p>Esta cuenta todavía no está autorizada para el piloto.</p>');return;}
  coachShell('<h3>Basic · piloto</h3><p>Completa tu anamnesis, revisa una propuesta y acepta tu primera rutina.</p><button data-keep-enabled="true" class="btn primary" id="coachBegin">Elegir Basic</button>');
  $('coachBegin').onclick=coachLoadIntake;
 }catch(e){if(epoch===simpleCoach.epoch)$('coachError').textContent=coachMessage(e.message);}
}
async function coachLoadIntake(){
 const owner=user.id,epoch=++simpleCoach.epoch;
 coachShell('<p>Cargando tu anamnesis…</p>');
 try{
  const ir=await db.from('training_intakes').select('*').order('revision',{ascending:false}).limit(1).maybeSingle();
  if(ir.error)throw ir.error;
  const hr=ir.data?await db.from('intake_health').select('declarations').eq('intake_id',ir.data.id).single():{data:null};
  const gr=await db.from('context_grants').select('scope').eq('notice_version','pilot-supervised-v1').is('revoked_at',null);
  const or=await db.from('coach_operations').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(hr.error||gr.error||or.error)throw Error('load');
  if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  simpleCoach.intake=ir.data;simpleCoach.operation=or.data;
  const t=ir.data?.training||{goal:'',experience:'beginner',days:3,minutes:45,equipment:['Gimnasio'],preferred:'',avoided:'',preferences:''};
  const h=hr.data?.declarations||{discomfort:'',limitations:''},grants=new Set((gr.data||[]).map(x=>x.scope));
  const field=(id,label,value,type='text',attrs='')=>'<label>'+label+'<input id="'+id+'" type="'+type+'" value="'+esc(String(value))+'" '+attrs+'></label>';
  const area=(id,label,value,max)=>'<label>'+label+'<textarea id="'+id+'" maxlength="'+max+'">'+esc(value)+'</textarea></label>';
  coachShell('<form id="coachForm"><h3>Anamnesis de entrenamiento</h3>'+field('coachGoal','Objetivo principal',t.goal,'text','required maxlength="120"')+
   '<label>Experiencia<select id="coachExperience"><option value="beginner">Principiante</option><option value="intermediate">Intermedia</option><option value="experienced">Experimentada</option></select></label><div class="coach-grid">'+field('coachDays','Días disponibles',t.days,'number','required min="1" max="7" step="1"')+field('coachMinutes','Minutos por sesión',t.minutes,'number','required min="15" max="120" step="1"')+'</div>'+
   field('coachEquipment','Material disponible (por ejemplo: gimnasio, mancuernas, bandas)',t.equipment.join(', '),'text','required maxlength="500"')+
   area('coachPreferred','Ejercicios preferidos',t.preferred,500)+area('coachAvoided','Ejercicios que quieres evitar',t.avoided,500)+area('coachPreferences','Otras preferencias',t.preferences,1000)+
   '<p class="muted">Separa el material por comas. Indica ejercicios concretos; evita nombres, correos u otros datos personales.</p><h3>Limitaciones declaradas</h3><p class="muted">Describe solo lo necesario para entrenar. Si hay dolor intenso, lesión reciente o síntomas relevantes, detén el ejercicio y consulta con un profesional sanitario.</p>'+area('coachDiscomfort','Molestias declaradas (opcional)',h.discomfort,1000)+area('coachLimitations','Limitaciones declaradas (opcional)',h.limitations,1000)+
   coachConsentNotice()+
   '<label class="coach-consent"><input type="checkbox" id="coachGrantTraining" '+(grants.has('training_intake')?'checked':'')+'>Autorizo usar mi anamnesis con OpenAI y el reviewer autorizado para generar y revisar mi planificación.</label>'+
   '<label class="coach-consent"><input type="checkbox" id="coachGrantHealth" '+(grants.has('declared_health')?'checked':'')+'>Autorizo usar las molestias y limitaciones que he declarado con OpenAI y el reviewer autorizado para esta propuesta.</label>'+
   '<div class="buttons"><button data-keep-enabled="true" class="btn" type="button" id="coachDraft">Guardar borrador</button>'+(simpleCoach.accepted?'':'<button data-keep-enabled="true" class="btn primary" type="submit">Revisar antes de enviar</button>')+'</div>'+(simpleCoach.accepted?'<p class="muted">La primera rutina ya está creada. Cambiar estos datos no modifica su estructura.</p>':'')+'</form><div id="coachProposal"></div>');
  $('coachExperience').value=t.experience;
  $('coachForm').oninput=()=>{simpleCoach.reviewed=false;$('coachProposal').replaceChildren();simpleCoach.operation=null;};
  for(const [id,scope] of [['coachGrantTraining','training_intake'],['coachGrantHealth','declared_health']]){
   $(id).onchange=async()=>{const input=$(id),allow=input.checked;coachBusy(true,'Guardando permiso…');try{await coachCall('set_my_coach_context_permission',{p_scope:scope,p_allow:allow});}catch(e){if(epoch===simpleCoach.epoch&&owner===user?.id){input.checked=!allow;$('coachError').textContent=coachMessage(e.message);}}finally{if(epoch===simpleCoach.epoch&&owner===user?.id)coachBusy(false);}};
  }
  $('coachDraft').onclick=()=>coachSave(false);
  $('coachForm').onsubmit=e=>{e.preventDefault();coachReviewIntake();};
  if(or.data)coachRenderOperation(or.data);
  if(or.data?.state==='failed')$('coachError').textContent=coachMessage(or.data.error_code);
  if(or.data?.state==='reserved'){coachBusy(true,'Estamos preparando tu rutina…');try{await coachPollOperation(or.data.id,epoch,owner);}finally{if(epoch===simpleCoach.epoch&&owner===user?.id)coachBusy(false);}}
 }catch(e){if(epoch===simpleCoach.epoch)$('coachError').textContent=coachMessage(e.message);}
}
async function coachSave(generate){
 if(generate&&(!simpleCoach.reviewed||!$('coachGrantTraining').checked||!$('coachGrantHealth').checked))return;
 if(simpleCoach.busy||(generate&&simpleCoach.accepted)||!$('coachForm').reportValidity())return;
 const owner=user.id,epoch=simpleCoach.epoch;
 const training={goal:$('coachGoal').value,experience:$('coachExperience').value,days:Number($('coachDays').value),minutes:Number($('coachMinutes').value),equipment:$('coachEquipment').value.split(',').map(x=>x.trim()).filter(Boolean),preferred:$('coachPreferred').value,avoided:$('coachAvoided').value,preferences:$('coachPreferences').value};
 const health={discomfort:$('coachDiscomfort').value,limitations:$('coachLimitations').value};
 const permits=[$('coachGrantTraining').checked,$('coachGrantHealth').checked];
 coachBusy(true,generate?'Estamos preparando tu rutina…':'Guardando borrador…');$('coachError').textContent='';
 try{
  const i=simpleCoach.intake;
  const intake=await coachCall('save_my_training_intake',{p_id:i?.id||null,p_expected:i?.row_version||null,p_training:training,p_health:health,p_submit:generate});
  if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  simpleCoach.intake=intake;
  if(!generate){$('coachStatus').textContent='Borrador guardado.';return;}
  for(const [n,scope] of ['training_intake','declared_health'].entries())await coachCall('set_my_coach_context_permission',{p_scope:scope,p_allow:permits[n]});
  const result=await db.functions.invoke('simple-coach-mock',{body:{intake_id:intake.id,key:crypto.randomUUID()}});
  if(result.error)throw Error(result.data?.error||'coach_request_failed');
  if(result.data?.error)throw Error(result.data.error);
  if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  const op=result.data.operation;simpleCoach.operation=op;
  if(op.state==='failed')throw Error(op.error_code);
  if(op.state==='reserved'){await coachPollOperation(op.id,epoch,owner);return;}
  coachRenderOperation(op);
 }catch(e){if(epoch===simpleCoach.epoch&&owner===user?.id)$('coachError').textContent=coachMessage(e.message);}
 finally{if(epoch===simpleCoach.epoch&&owner===user?.id){const status=$('coachStatus')?.textContent;coachBusy(false);if(!generate&&status==='Borrador guardado.')$('coachStatus').textContent=status;}}
}
async function coachPollOperation(id,epoch,owner){
 for(let n=0;n<60;n++){
  if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  const r=await db.from('coach_operations').select('*').eq('id',id).single();
  if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  if(r.error)throw Error('coach_request_failed');
  if(['ready','pending_review','rejected','athlete_declined'].includes(r.data.state)){coachRenderOperation(r.data);return;}
  if(r.data.state!=='reserved')throw Error(r.data.error_code||'coach_proposal_not_ready');
  if(Date.parse(r.data.expires_at)<=Date.now())throw Error('reservation_expired');
  await new Promise(resolve=>setTimeout(resolve,2000));
 }
 throw Error('coach_request_failed');
}
function coachConsentNotice(){return '<aside class="coach-notice"><strong>Consentimiento piloto · pendiente de revisión legal</strong><p>SIMPLE Coach utiliza inteligencia artificial. Enviaremos a OpenAI tu objetivo, experiencia, disponibilidad, material, preferencias y las molestias y limitaciones que autorices, para generar una propuesta de rutina. Una persona autorizada revisará esa información y la propuesta antes de que puedas aceptarla.</p><p>No enviamos a OpenAI datos de otros usuarios, tu nombre, correo, UUID, historial, notas personales ni datos administrativos. No incluyas información identificativa ni innecesaria en los campos libres. SIMPLE Coach no realiza diagnósticos médicos ni sustituye la atención médica.</p><p>Puedes retirar cualquiera de estos permisos desde Anamnesis y permisos. Se bloquearán nuevas generaciones y propuestas no aceptadas; tu rutina ya aceptada se conserva. No se borra retroactivamente una solicitud ya procesada.</p><small>Versión: pilot-supervised-v1. Pendiente de revisión legal final.</small></aside>';}
function coachReviewIntake(){
 if(simpleCoach.busy||!$('coachForm').reportValidity())return;
 $('coachError').textContent='';
 if(!$('coachGrantTraining').checked||!$('coachGrantHealth').checked){$('coachError').textContent=coachMessage('coach_context_required');return;}
 const labels=[['coachGoal','Objetivo'],['coachExperience','Experiencia'],['coachDays','Días'],['coachMinutes','Minutos por sesión'],['coachEquipment','Material'],['coachPreferred','Preferidos'],['coachAvoided','Evitar'],['coachPreferences','Preferencias'],['coachDiscomfort','Molestias'],['coachLimitations','Limitaciones']];
 simpleCoach.reviewed=true;$('coachForm').hidden=true;
 $('coachProposal').innerHTML='<h3 tabindex="-1" id="coachReviewHeading">Revisa antes de enviar</h3><dl>'+labels.map(([id,label])=>'<dt>'+label+'</dt><dd>'+esc(id==='coachExperience'?$(id).selectedOptions[0].textContent:$(id).value||'No indicado')+'</dd>').join('')+'</dl><p>Se enviará únicamente esta información autorizada a OpenAI. La propuesta pasará después por revisión humana.</p><div class="buttons"><button data-keep-enabled="true" class="btn" id="coachReviewBack">Volver y editar</button><button data-keep-enabled="true" class="btn primary" id="coachConfirmSend">Enviar y generar propuesta</button></div>';
 $('coachReviewBack').onclick=()=>{simpleCoach.reviewed=false;$('coachForm').hidden=false;$('coachProposal').replaceChildren();$('coachGoal').focus();};
 $('coachConfirmSend').onclick=()=>coachSave(true);$('coachReviewHeading').focus();
}
function coachRenderOperation(op){
 simpleCoach.operation=op;
 if(op.state==='ready'){coachRenderProposal(op);return;}
 if(op.state==='pending_review')$('coachProposal').innerHTML='<h3>Tu rutina está siendo revisada</h3><p>Antes de que puedas utilizarla, revisaremos que la propuesta sea coherente con la información que nos has proporcionado. Puedes cerrar SIMPLE y volver después; tu solicitud se conserva.</p><button data-keep-enabled="true" class="btn" id="coachRefresh">Actualizar estado</button>';
 else if(['rejected','athlete_declined'].includes(op.state))$('coachProposal').innerHTML='<h3>Propuesta no aceptada</h3><p>'+esc(op.review_reason||op.athlete_comment||'Solicita revisión antes de otro intento.')+'</p><p>Una nueva generación requiere autorización del reviewer.</p>';
 else if(op.state==='failed')$('coachError').textContent=coachMessage(op.error_code);
 if($('coachRefresh'))$('coachRefresh').onclick=coachLoadIntake;
}
function coachProposalMarkup(p){
 return '<h3>'+esc(p.name)+'</h3><p>'+p.days.length+' días · duración orientativa, no medida</p>'+p.days.map(d=>{const minutes=Math.ceil((300+d.exercises.reduce((n,e)=>n+120+e.sets*(e.reps_max*4+e.rest_seconds),0))/60);return '<section class="coach-day"><h4>'+esc(d.name)+' · ≈ '+minutes+' min</h4>'+d.exercises.map(e=>'<p><b>'+esc(e.name)+'</b><br>'+e.sets+' series · '+e.reps_min+'–'+e.reps_max+' reps · RIR '+e.rir+' · '+e.rest_seconds+' s de descanso</p>').join('')+'</section>';}).join('');
}
function coachRenderProposal(op){
 simpleCoach.operation=op;$('coachForm').hidden=true;
 $('coachProposal').innerHTML='<p class="muted">Propuesta aprobada para que la revises</p>'+coachProposalMarkup(op.proposal)+'<div class="buttons"><button data-keep-enabled="true" class="btn primary" id="coachAccept">Aceptar rutina</button><button data-keep-enabled="true" class="btn" id="coachDecline">No me convence</button></div><div id="coachDeclineForm"></div>';
 $('coachAccept').onclick=coachAccept;
 $('coachDecline').onclick=()=>{$('coachDeclineForm').innerHTML='<form id="coachDeclineReason"><label>Indica qué no te convence<textarea id="coachComment" required maxlength="1000"></textarea></label><button data-keep-enabled="true" class="btn" type="submit">Enviar comentario y rechazar</button></form>';$('coachComment').focus();$('coachDeclineReason').onsubmit=async e=>{e.preventDefault();if(simpleCoach.busy)return;const epoch=simpleCoach.epoch;coachBusy(true);try{await coachCall('decline_my_coach_proposal',{p_operation:op.id,p_comment:$('coachComment').value});if(epoch===simpleCoach.epoch)await coachLoadIntake();}catch(e){if(epoch===simpleCoach.epoch)$('coachError').textContent=coachMessage(e.message);}finally{if(epoch===simpleCoach.epoch)coachBusy(false);}};};
 $('coachProposal').scrollIntoView({block:'start',behavior:'instant'});
}
async function coachFeedback(routine){
 const owner=user.id,epoch=++simpleCoach.epoch;coachShell('<p>Cargando valoración…</p>');
 try{const result=await db.from('coach_pilot_feedback').select('*').eq('routine_id',routine).maybeSingle();if(result.error)throw result.error;if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
 const f=result.data;coachShell('<h3>¿Qué te está pareciendo tu rutina?</h3><p>Disponible después de guardar al menos un entrenamiento de esta rutina.</p><form id="coachFeedbackForm"><label>Valoración<select id="coachRating" required><option value="">Elige de 1 a 5</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+(n===1?' · Nada útil':n===5?' · Muy útil':'')+'</option>').join('')+'</select></label><label>¿Hay algo que cambiarías? (opcional)<textarea id="coachFeedbackComment" maxlength="1000"></textarea></label><button data-keep-enabled="true" class="btn primary" type="submit">Guardar valoración</button></form>');$('coachRating').value=f?.rating||'';$('coachFeedbackComment').value=f?.comment||'';
 $('coachFeedbackForm').onsubmit=async e=>{e.preventDefault();if(simpleCoach.busy)return;coachBusy(true);try{await coachCall('save_my_coach_feedback',{p_routine: routine,p_rating:Number($('coachRating').value),p_comment:$('coachFeedbackComment').value});if(epoch===simpleCoach.epoch){coachBusy(false);$('coachStatus').textContent='Valoración guardada.';}}catch(e){if(epoch===simpleCoach.epoch){coachBusy(false);$('coachError').textContent=coachMessage(e.message);}}};
 }catch(e){if(epoch===simpleCoach.epoch)$('coachError').textContent=coachMessage(e.message);}
}
async function coachAccept(){
 if(simpleCoach.busy||!simpleCoach.operation)return;
 const epoch=simpleCoach.epoch,owner=user.id;coachBusy(true,'Creando tu rutina…');$('coachError').textContent='';
 try{
  const id=await coachCall('accept_basic_plan',{p_operation:simpleCoach.operation.id});
  if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  await reload();if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  await renderShared();if(epoch!==simpleCoach.epoch||owner!==user?.id)return;
  simpleCoach.accepted=true;
  coachShell('<h3>Rutina creada</h3><p>Ya puedes abrir las sesiones de prueba. La estructura queda fija durante el piloto.</p><button data-keep-enabled="true" class="btn primary" id="coachOpen">Abrir rutina</button>');
  $('coachOpen').onclick=()=>{coachDialog().close();openCoachRoutine(id);};
 }catch(e){if(epoch===simpleCoach.epoch&&owner===user?.id)$('coachError').textContent=coachMessage(e.message);}
 finally{if(epoch===simpleCoach.epoch)coachBusy(false);}
}
if(coachEnabled())db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){simpleCoach.epoch++;simpleCoach.intake=null;simpleCoach.operation=null;simpleCoach.accepted=false;const d=$('coachDialog');if(d){d.close();d.replaceChildren();}}});
