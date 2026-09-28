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
// Presentation choices mirror the server allowlist; only the server authorizes requests.
const coachChoices={
 goal:['Fuerza general','Ganar masa muscular','Mejorar condición física'],
 experience:{beginner:'Principiante',intermediate:'Intermedio',experienced:'Avanzado'},
 minutes:[30,45,60,75,90],equipment:['Gimnasio','Mancuernas','Bandas','Barra','Peso corporal'],
 exercises:[['Sentadilla con peso corporal','body'],['Zancada atrás','body'],['Puente de glúteos','body'],['Flexiones','body'],['Flexiones de rodillas','body'],['Dead bug','body'],['Bird dog','body'],['Elevación de talones','body'],['Sentadilla goblet','dumbbells'],['Peso muerto rumano con mancuernas','dumbbells'],['Remo con mancuerna','dumbbells'],['Press de suelo con mancuernas','dumbbells'],['Press de hombros con mancuernas','dumbbells'],['Elevaciones laterales','dumbbells'],['Curl con mancuernas','dumbbells'],['Remo con banda','bands'],['Curl con banda','bands'],['Sentadilla con barra','barbell'],['Peso muerto rumano con barra','barbell'],['Remo con barra','barbell'],['Prensa de piernas','gym'],['Curl femoral','gym'],['Jalón al pecho','gym'],['Remo en polea','gym'],['Press de pecho en máquina','gym'],['Extensión de tríceps en polea','gym']]
};
function coachCurrent(epoch,owner){return epoch===simpleCoach.epoch&&owner===user?.id&&simpleCoach.pageActive&&$('coachDialog')?.open;}
function coachDialog(){
 let d=$('coachDialog');if(!d){d=document.createElement('dialog');d.id='coachDialog';d.className='coach-dialog';d.setAttribute('aria-labelledby','coachTitle');document.body.append(d);d.addEventListener('close',()=>{simpleCoach.epoch++;simpleCoach.busy=false;});}return d;
}
function coachShell(content){
 const d=coachDialog();simpleCoach.busy=false;d.setAttribute('aria-busy','false');
 d.innerHTML='<div class="coach-heading"><h2 id="coachTitle" tabindex="-1">SIMPLE Coach</h2><button data-keep-enabled="true" class="btn" aria-label="Cerrar SIMPLE Coach" onclick="document.getElementById(\'coachDialog\').close()">Cerrar</button></div><p class="muted">Basic · piloto sin cobro. Tu propuesta tendrá revisión humana antes de que puedas aceptarla.</p><div id="coachError" role="alert"></div><div id="coachStatus" role="status" aria-live="polite"></div>'+content;
 if(!d.open)d.showModal();d.scrollTop=0;$('coachTitle').focus();
}
function coachMessage(code){
 const messages={coach_retry_review_required:'Ya se ha utilizado el intento disponible. Solicita al reviewer autorización para otro intento.',coach_review_required:'La propuesta necesita aprobación del reviewer.',coach_reviewer_required:'No tienes permiso para revisar propuestas.',coach_feedback_workout_required:'Podrás valorar esta rutina después de guardar tu primer entrenamiento.',coach_invalid_feedback:'Elige una valoración de 1 a 5 y un comentario de hasta 1.000 caracteres.',coach_pilot_required:'Esta cuenta todavía no tiene acceso al piloto.',coach_context_required:'Acepta el permiso de entrenamiento para continuar.',coach_health_disabled:'Este piloto no admite información de salud.',coach_invalid_intake:'Elige únicamente las opciones de entrenamiento disponibles.',coach_invalid_training:'Elige únicamente las opciones de entrenamiento disponibles.',coach_intake_conflict:'El formulario cambió en otra pestaña. Vuelve a abrirlo para cargar la versión actual.',coach_draft_delete_unavailable:'Solo se puede borrar un borrador propio que no se haya enviado ni utilizado.',coach_draft_required:'Solo se puede borrar un borrador que no se haya enviado.',coach_intake_in_use:'Este contexto ya se utilizó en una operación y se conserva para su trazabilidad.',coach_current_intake_required:'Guarda y envía la anamnesis actual antes de generar.',coach_proposal_not_ready:'La propuesta ya no está vigente. Revisa el formulario y solicita otro intento.',coach_intake_changed:'La anamnesis ha cambiado. Esta propuesta no se puede aceptar.',coach_context_changed:'Los permisos cambiaron. Revisa el consentimiento antes de continuar.',coach_rate_limit:'Se ha alcanzado el límite de intentos. Espera antes de reintentar.',safety_review_required:'No podemos preparar una propuesta con estas opciones. Solicita revisión profesional antes de continuar.'};
 return messages[code]||'No se pudo completar la acción. Tus datos guardados se conservan; puedes reintentar.';
}
async function coachCall(name,args){const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data;}
function coachBusy(value,label='Procesando…'){
 simpleCoach.busy=value;const d=coachDialog();d.setAttribute('aria-busy',String(value));
 d.querySelectorAll('form button,form input,form textarea,form select,[data-coach-action]').forEach(x=>x.disabled=value);
 if($('coachStatus'))$('coachStatus').textContent=value?label:'';
}
async function openSimpleCoach(){
 if(!coachEnabled()||profile?.role!=='client')return;
 const owner=user.id,epoch=++simpleCoach.epoch;simpleCoach.intake=null;simpleCoach.operation=null;coachShell('<p>Cargando tu acceso…</p>');
 try{const access=await coachCall('get_my_coach_access',{});if(!coachCurrent(epoch,owner))return;simpleCoach.accepted=!!access.routine_id;
 if(access.routine_id){coachShell('<p>Ya tienes tu primera rutina Basic.</p><div class="buttons"><button data-keep-enabled="true" class="btn primary" id="coachOpen">Abrir rutina</button><button data-keep-enabled="true" class="btn" id="coachContext">Anamnesis y permisos</button>'+(access.can_feedback?'<button data-keep-enabled="true" class="btn" id="coachFeedback">'+(access.has_feedback?'Ver o actualizar valoración':'Valorar rutina')+'</button>':'')+'</div>');$('coachOpen').onclick=()=>{coachDialog().close();openCoachRoutine(access.routine_id)};$('coachContext').onclick=()=>coachLoadIntake(true);if($('coachFeedback'))$('coachFeedback').onclick=()=>coachFeedback(access.routine_id);return;}
 if(!access.authorized){coachShell('<p>Esta cuenta todavía no está autorizada para el piloto.</p>');return;}
 coachShell('<h3>Basic · piloto</h3><p>Indica tus preferencias de entrenamiento, revisa la propuesta y acepta tu primera rutina cuando esté aprobada.</p><button data-keep-enabled="true" class="btn primary" id="coachBegin">Elegir Basic</button>');$('coachBegin').onclick=()=>coachLoadIntake();
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
}
async function coachLoadIntake(permissions=false){
 const owner=user.id,epoch=++simpleCoach.epoch;coachShell('<p>Cargando tu anamnesis…</p>');
 try{
 const [ir,gr,or]=await Promise.all([
 db.from('training_intakes').select('id,revision,row_version,state,training').order('revision',{ascending:false}).limit(1).maybeSingle(),
 db.from('context_grants').select('scope').eq('notice_version','pilot-supervised-v2').is('revoked_at',null),
 db.from('coach_operations').select('*').order('created_at',{ascending:false}).limit(1).maybeSingle()]);
 if(ir.error||gr.error||or.error)throw Error('load');if(!coachCurrent(epoch,owner))return;
 simpleCoach.intake=ir.data;simpleCoach.operation=or.data;simpleCoach.granted=(gr.data||[]).some(x=>x.scope==='training_intake');simpleCoach.reviewed=false;
 if(!permissions&&simpleCoach.granted&&['reserved','pending_review','ready','rejected','athlete_declined','failed','stale'].includes(or.data?.state)){
 coachShell('<div id="coachProposal"></div><button data-coach-action data-keep-enabled="true" class="btn" id="coachPermissions">Anamnesis y permisos</button>');$('coachPermissions').onclick=()=>coachLoadIntake(true);coachRenderOperation(or.data);
 if(or.data.state==='reserved'){coachBusy(true,'Estamos preparando tu rutina…');try{await coachPollOperation(or.data.id,epoch,owner);}finally{if(coachCurrent(epoch,owner))coachBusy(false);}}return;
 }
 coachShowConsent();
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
}
function coachConsentNotice(){return '<aside class="coach-notice"><strong>Piloto supervisado · versión pendiente de revisión legal final</strong><p>SIMPLE Coach Basic utiliza inteligencia artificial de OpenAI para crear una propuesta inicial de entrenamiento.</p><p>Utilizaremos únicamente tu objetivo, experiencia, disponibilidad, material y preferencias de ejercicios. OpenAI procesa esa información mediante su API. Antes de que puedas aceptar la propuesta, una persona autorizada la revisará.</p><p>No enviamos automáticamente tu nombre, correo, UUID, historial de entrenamientos, notas personales, información de otras personas ni datos administrativos. En este piloto no utilizaremos molestias, limitaciones ni información médica.</p><p>No incluyas información identificativa o médica en campos libres. SIMPLE Coach no diagnostica ni trata lesiones y no sustituye a un profesional sanitario.</p><p>Puedes retirar este permiso para impedir nuevas generaciones e invalidar propuestas pendientes. La rutina ya aceptada seguirá disponible. Retirar el permiso no deshace un procesamiento que ya haya ocurrido ni elimina automáticamente los registros de trazabilidad.</p><small>Versión pilot-supervised-v2. Este aviso del piloto no sustituye a la información legal definitiva.</small></aside>';}
function coachShowConsent(){
 const owner=user.id,epoch=simpleCoach.epoch;
 coachShell('<h3>Información y permiso</h3>'+coachConsentNotice()+'<form id="coachConsentForm"><label class="coach-consent"><input type="checkbox" id="coachGrantTraining" '+(simpleCoach.granted?'checked':'')+'>Consiento el tratamiento del contexto de entrenamiento indicado para generar y revisar mi propuesta de SIMPLE Coach.</label><div class="buttons"><button data-keep-enabled="true" class="btn primary" type="submit">Continuar</button></div></form>');
 $('coachGrantTraining').onchange=async()=>{if(simpleCoach.busy)return;const input=$('coachGrantTraining'),allow=input.checked;coachBusy(true,'Guardando permiso…');$('coachError').textContent='';
 try{await coachCall('set_my_coach_context_permission',{p_scope:'training_intake',p_allow:allow});if(!coachCurrent(epoch,owner))return;simpleCoach.granted=allow;if(!allow){simpleCoach.operation=null;simpleCoach.reviewed=false;}}
 catch(e){if(coachCurrent(epoch,owner)){input.checked=!allow;$('coachError').textContent=coachMessage(e.message);}}
 finally{if(coachCurrent(epoch,owner)){coachBusy(false);if(!allow&&!simpleCoach.granted)$('coachStatus').textContent='Permiso retirado. Tu rutina aceptada se conserva.';}}};
 $('coachConsentForm').onsubmit=e=>{e.preventDefault();if(simpleCoach.busy)return;if(!simpleCoach.granted){$('coachError').textContent=coachMessage('coach_context_required');$('coachGrantTraining').focus();return;}coachShowIntake();};
}
function coachSelected(id){return [...$(id).querySelectorAll('input:checked')].map(x=>x.value);}
function coachExerciseGroup(equipment){const groups=new Set(['body']);if(equipment.includes('Gimnasio'))['gym','dumbbells','bands','barbell'].forEach(x=>groups.add(x));if(equipment.includes('Mancuernas'))groups.add('dumbbells');if(equipment.includes('Bandas'))groups.add('bands');if(equipment.includes('Barra'))groups.add('barbell');return groups;}
function coachShowIntake(){
 const raw=simpleCoach.intake?.training,valid=raw&&coachChoices.goal.includes(raw.goal)&&Object.hasOwn(coachChoices.experience,raw.experience)&&Number.isInteger(raw.days)&&raw.days>=1&&raw.days<=5&&coachChoices.minutes.includes(raw.minutes)&&Array.isArray(raw.equipment)&&raw.equipment.length&&raw.equipment.every(x=>coachChoices.equipment.includes(x))&&raw.preferences===''&&[raw.preferred,raw.avoided].every(v=>typeof v==='string'&&(!v||v.split(', ').every(x=>coachChoices.exercises.some(([n])=>n===x))));
 const t=valid?raw:{goal:'',experience:'beginner',days:3,minutes:45,equipment:['Gimnasio'],preferred:'',avoided:'',preferences:''};
 const options=(list,value,placeholder='')=>(placeholder?'<option value="">'+placeholder+'</option>':'')+list.map(x=>'<option value="'+esc(String(x))+'" '+(x===value?'selected':'')+'>'+esc(String(x))+'</option>').join('');
 const checklist=(id,list,selected)=>'<fieldset id="'+id+'" class="coach-options">'+list.map((value,n)=>'<label class="coach-choice"><input type="checkbox" value="'+esc(value)+'" '+(selected.includes(value)?'checked':'')+'>'+esc(value)+'</label>').join('')+'</fieldset>';
 coachShell('<h3>Anamnesis de entrenamiento</h3>'+(raw&&!valid?'<p role="status">El formulario anterior contiene opciones de otra versión. Elige de nuevo las opciones del piloto; no se reenviará aquel texto.</p>':'')+'<form id="coachForm"><label>Objetivo principal<select id="coachGoal" required>'+options(coachChoices.goal,t.goal,'Elige tu objetivo')+'</select></label><label>Experiencia<select id="coachExperience">'+Object.entries(coachChoices.experience).map(([k,v])=>'<option value="'+k+'" '+(k===t.experience?'selected':'')+'>'+v+'</option>').join('')+'</select></label><div class="coach-grid"><label>Días disponibles<select id="coachDays">'+options([1,2,3,4,5],t.days)+'</select></label><label>Minutos por sesión<select id="coachMinutes">'+options(coachChoices.minutes,t.minutes)+'</select></label></div><h4 id="coachEquipmentLabel">Material disponible</h4>'+checklist('coachEquipment',coachChoices.equipment,t.equipment)+'<p class="muted" id="coachPrivacyHint">No incluyas nombres, correos, teléfonos, direcciones, información de otras personas ni información médica. Describe únicamente tus preferencias de entrenamiento.</p><p class="muted">En este piloto las preferencias se eligen entre opciones; no hay un campo de texto libre.</p><details id="coachPreferredDetails"><summary>Ejercicios preferidos <span id="coachPreferredCount"></span></summary>'+checklist('coachPreferred',coachChoices.exercises.map(([n])=>n),t.preferred?t.preferred.split(', '):[])+'</details><details><summary>Ejercicios que quieres evitar <span id="coachAvoidedCount"></span></summary>'+checklist('coachAvoided',coachChoices.exercises.map(([n])=>n),t.avoided?t.avoided.split(', '):[])+'</details><div class="buttons"><button data-keep-enabled="true" class="btn" type="button" id="coachDraft">Guardar borrador</button>'+(simpleCoach.accepted?'':'<button data-keep-enabled="true" class="btn primary" type="submit">Revisar antes de enviar</button>')+'</div>'+(simpleCoach.accepted?'<p class="muted">Estos datos no modifican la estructura de tu rutina aceptada.</p>':'')+'</form><div class="buttons"><button data-coach-action data-keep-enabled="true" class="btn" id="coachPermissions">Ver o retirar permiso</button>'+(simpleCoach.intake?.state==='draft'?'<button data-coach-action data-keep-enabled="true" class="btn" id="coachDeleteDraft">Borrar borrador</button>':'')+'</div><div id="coachDeleteConfirm"></div><div id="coachProposal"></div>');
 $('coachEquipment').setAttribute('aria-labelledby','coachEquipmentLabel');$('coachPreferred').setAttribute('aria-label','Ejercicios preferidos');$('coachAvoided').setAttribute('aria-label','Ejercicios que quieres evitar');
 $('coachPermissions').onclick=coachShowConsent;$('coachDraft').onclick=()=>coachSave(false);$('coachForm').onsubmit=e=>{e.preventDefault();coachReviewIntake();};
 $('coachForm').oninput=()=>{simpleCoach.reviewed=false;coachUpdateChoices();};coachUpdateChoices();
 if($('coachDeleteDraft'))$('coachDeleteDraft').onclick=coachDeleteDraft;
}
function coachUpdateChoices(){
 const equipment=coachSelected('coachEquipment'),groups=coachExerciseGroup(equipment),preferred=coachSelected('coachPreferred'),avoided=coachSelected('coachAvoided');
 for(const input of $('coachPreferred').querySelectorAll('input')){const group=coachChoices.exercises.find(([n])=>n===input.value)?.[1];input.disabled=!groups.has(group)||avoided.includes(input.value);if(input.disabled)input.checked=false;input.closest('label').hidden=!groups.has(group);}
 for(const input of $('coachAvoided').querySelectorAll('input'))input.disabled=coachSelected('coachPreferred').includes(input.value);
 for(const id of ['coachPreferred','coachAvoided'])$(id+'Count').textContent='('+coachSelected(id).length+')';
}
function coachTraining(){
 const t={goal:$('coachGoal').value,experience:$('coachExperience').value,days:Number($('coachDays').value),minutes:Number($('coachMinutes').value),equipment:coachSelected('coachEquipment'),preferred:coachSelected('coachPreferred').join(', '),avoided:coachSelected('coachAvoided').join(', '),preferences:''};
 if(!coachChoices.goal.includes(t.goal)||!Object.hasOwn(coachChoices.experience,t.experience)||!Number.isInteger(t.days)||t.days<1||t.days>5||!coachChoices.minutes.includes(t.minutes)||!t.equipment.length||t.equipment.some(x=>!coachChoices.equipment.includes(x))||t.preferred.length>600||t.avoided.length>600||[t.preferred,t.avoided].some(s=>s&&s.split(', ').some(x=>!coachChoices.exercises.some(([n])=>n===x)))||coachSelected('coachPreferred').some(x=>coachSelected('coachAvoided').includes(x)))throw Error('coach_invalid_training');return t;
}
function coachTrainingMarkup(t){const fields=[['Objetivo',t.goal],['Experiencia',coachChoices.experience[t.experience]||t.experience],['Días',t.days],['Minutos por sesión',t.minutes],['Material',t.equipment.join(', ')],['Preferidos',t.preferred||'Sin preferencia'],['Evitar',t.avoided||'Ninguno seleccionado']];return '<dl class="coach-context">'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(String(v))+'</dd>').join('')+'</dl>';}
function coachReviewIntake(){
 if(simpleCoach.busy||!$('coachForm').reportValidity())return;$('coachError').textContent='';
 try{if(!simpleCoach.granted)throw Error('coach_context_required');const t=coachTraining();simpleCoach.reviewed=true;$('coachForm').hidden=true;
 $('coachProposal').innerHTML='<h3 tabindex="-1" id="coachReviewHeading">Revisa antes de enviar</h3>'+coachTrainingMarkup(t)+'<p>Se enviará únicamente esta información de entrenamiento a OpenAI. No se enviará información de salud. La propuesta pasará por revisión humana.</p><div class="buttons"><button data-coach-action data-keep-enabled="true" class="btn" id="coachReviewBack">Volver y editar</button><button data-coach-action data-keep-enabled="true" class="btn primary" id="coachConfirmSend">Enviar y generar propuesta</button></div>';
 $('coachReviewBack').onclick=()=>{simpleCoach.reviewed=false;$('coachForm').hidden=false;$('coachProposal').replaceChildren();$('coachGoal').focus();};$('coachConfirmSend').onclick=()=>coachSave(true);$('coachReviewHeading').focus();
 }catch(e){$('coachError').textContent=coachMessage(e.message);}
}
async function coachSave(generate){
 if(simpleCoach.busy||(generate&&(!simpleCoach.reviewed||simpleCoach.accepted))||!$('coachForm').reportValidity())return;
 const owner=user.id,epoch=simpleCoach.epoch;let training;
 try{if(!simpleCoach.granted)throw Error('coach_context_required');training=coachTraining();}catch(e){$('coachError').textContent=coachMessage(e.message);return;}
 coachBusy(true,generate?'Estamos preparando tu rutina…':'Guardando borrador…');$('coachError').textContent='';
 try{const i=simpleCoach.intake;
 const intake=await coachCall('save_my_training_intake',{p_id:i?.id||null,p_expected:i?.row_version||null,p_training:training,p_submit:generate});
 if(!coachCurrent(epoch,owner))return;simpleCoach.intake=intake;
 if(!generate){coachShowIntake();$('coachStatus').textContent='Borrador guardado.';return;}
 // Closing/signing out while saving must never dispatch the provider request afterward.
 const result=await db.functions.invoke('simple-coach-mock',{body:{intake_id:intake.id,key:crypto.randomUUID()}});
 if(!coachCurrent(epoch,owner))return;if(result.error||result.data?.error)throw Error(result.data?.error||'coach_request_failed');
 const op=result.data.operation;simpleCoach.operation=op;if(op.state==='failed')throw Error(op.error_code);
 if(op.state==='reserved'){await coachPollOperation(op.id,epoch,owner);return;}coachRenderOperation(op);
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
 finally{if(coachCurrent(epoch,owner)){const status=$('coachStatus')?.textContent;coachBusy(false);if($('coachForm'))coachUpdateChoices();if(!generate&&status==='Borrador guardado.')$('coachStatus').textContent=status;}}
}
function coachDeleteDraft(){
 if(simpleCoach.busy||simpleCoach.intake?.state!=='draft')return;
 $('coachDeleteConfirm').innerHTML='<p id="coachDeleteTitle">¿Borrar este borrador no enviado? Esta acción no elimina rutinas aceptadas ni entrenamientos.</p><div class="buttons"><button data-coach-action data-keep-enabled="true" class="btn" id="coachCancelDelete">Conservar borrador</button><button data-coach-action data-keep-enabled="true" class="btn danger" id="coachConfirmDelete">Borrar borrador</button></div>';$('coachCancelDelete').focus();$('coachCancelDelete').onclick=()=>$('coachDeleteConfirm').replaceChildren();
 $('coachConfirmDelete').onclick=async()=>{if(simpleCoach.busy)return;const owner=user.id,epoch=simpleCoach.epoch,i=simpleCoach.intake;coachBusy(true,'Borrando borrador…');try{await coachCall('delete_my_training_intake',{p_id:i.id,p_expected:i.row_version});if(!coachCurrent(epoch,owner))return;simpleCoach.intake=null;coachShowIntake();$('coachStatus').textContent='Borrador borrado.';}catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}finally{if(coachCurrent(epoch,owner)){const deleted=$('coachStatus')?.textContent==='Borrador borrado.';coachBusy(false);if(deleted)$('coachStatus').textContent='Borrador borrado.';}}};
}
async function coachPollOperation(id,epoch,owner){
 for(let n=0;n<60;n++){if(!coachCurrent(epoch,owner))return;const r=await db.from('coach_operations').select('*').eq('id',id).single();if(!coachCurrent(epoch,owner))return;if(r.error)throw Error('coach_request_failed');
 if(['ready','pending_review','rejected','athlete_declined'].includes(r.data.state)){coachRenderOperation(r.data);return;}
 if(r.data.state!=='reserved')throw Error(r.data.error_code||'coach_proposal_not_ready');if(Date.parse(r.data.expires_at)<=Date.now())throw Error('reservation_expired');await new Promise(resolve=>setTimeout(resolve,2000));}
 throw Error('coach_request_failed');
}
function coachRenderOperation(op){
 simpleCoach.operation=op;if($('coachForm'))$('coachForm').hidden=true;
 if(op.state==='ready'){coachRenderProposal(op);return;}
 const p=$('coachProposal');if(op.state==='pending_review')p.innerHTML='<h3 tabindex="-1" id="coachOperationHeading">Tu rutina está siendo revisada</h3><p>Antes de que puedas utilizarla, revisaremos que la propuesta sea coherente con la información que nos has proporcionado.</p><p>Puedes cerrar SIMPLE y volver después; tu solicitud se conserva.</p><button data-coach-action data-keep-enabled="true" class="btn" id="coachRefresh">Actualizar estado</button>';
 else if(op.state==='reserved')p.innerHTML='<h3>Estamos preparando tu rutina</h3><p>La solicitud ya está registrada. Puedes cerrar SIMPLE y volver después sin generar otra propuesta.</p>';
 else if(['rejected','athlete_declined','failed','stale'].includes(op.state))p.innerHTML='<h3>Propuesta no disponible</h3><p>'+esc(op.review_reason||op.athlete_comment||coachMessage(op.error_code||'coach_context_changed'))+'</p><p>Un nuevo intento requiere autorización del reviewer.</p>'+(op.retry_authorized_at?'<button data-coach-action data-keep-enabled="true" class="btn" id="coachRetry">Revisar formulario para el nuevo intento</button>':'');
 if($('coachRefresh'))$('coachRefresh').onclick=()=>coachLoadIntake();if($('coachRetry'))$('coachRetry').onclick=()=>coachLoadIntake(true);$('coachOperationHeading')?.focus();
}
function coachProposalMarkup(p){
 return '<h3>'+esc(p.name)+'</h3><p>'+p.days.length+' días · duración orientativa, no medida</p>'+p.days.map(d=>{const minutes=Math.ceil((300+d.exercises.reduce((n,e)=>n+120+e.sets*(e.reps_max*4+e.rest_seconds),0))/60);return '<section class="coach-day"><h4>'+esc(d.name)+' · ≈ '+minutes+' min</h4>'+d.exercises.map(e=>'<p><b>'+esc(e.name)+'</b><br>'+e.sets+' series · '+e.reps_min+'–'+e.reps_max+' reps · RIR '+e.rir+' · '+e.rest_seconds+' s de descanso</p>').join('')+'</section>';}).join('');
}
function coachRenderProposal(op){
 simpleCoach.operation=op;if($('coachForm'))$('coachForm').hidden=true;
 $('coachProposal').innerHTML='<h3 id="coachReadyHeading" tabindex="-1">Tu rutina está lista</h3><p class="muted">Revisada y aprobada. Puedes leerla completa antes de aceptarla.</p>'+coachProposalMarkup(op.proposal)+'<div class="buttons"><button data-coach-action data-keep-enabled="true" class="btn primary" id="coachAccept">Aceptar rutina</button><button data-coach-action data-keep-enabled="true" class="btn" id="coachDecline">No me convence</button></div><div id="coachDeclineForm"></div>';
 $('coachAccept').onclick=coachAccept;$('coachDecline').onclick=()=>{$('coachDeclineForm').innerHTML='<form id="coachDeclineReason"><label>Indica qué no te convence<textarea id="coachComment" required maxlength="1000" aria-describedby="coachCommentHint"></textarea></label><p id="coachCommentHint" class="muted">Describe la propuesta de entrenamiento, sin información personal ni médica.</p><button data-keep-enabled="true" class="btn" type="submit">Enviar comentario y rechazar</button></form>';$('coachComment').focus();$('coachDeclineReason').onsubmit=async e=>{e.preventDefault();if(simpleCoach.busy)return;const epoch=simpleCoach.epoch,owner=user.id;coachBusy(true);try{await coachCall('decline_my_coach_proposal',{p_operation:op.id,p_comment:$('coachComment').value});if(coachCurrent(epoch,owner))await coachLoadIntake();}catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}finally{if(coachCurrent(epoch,owner))coachBusy(false);}};};$('coachReadyHeading').focus();
}
async function coachFeedback(routine){
 const owner=user.id,epoch=++simpleCoach.epoch;coachShell('<p>Cargando valoración…</p>');
 try{const result=await db.from('coach_pilot_feedback').select('*').eq('routine_id',routine).maybeSingle();if(result.error)throw result.error;if(!coachCurrent(epoch,owner))return;const f=result.data;
 coachShell('<h3>¿Qué te está pareciendo tu rutina?</h3><p>Disponible después de guardar al menos un entrenamiento de esta rutina.</p><form id="coachFeedbackForm"><label>Valoración<select id="coachRating" required><option value="">Elige de 1 a 5</option>'+[1,2,3,4,5].map(n=>'<option value="'+n+'">'+n+(n===1?' · Nada útil':n===5?' · Muy útil':'')+'</option>').join('')+'</select></label><label>¿Hay algo que cambiarías? (opcional)<textarea id="coachFeedbackComment" maxlength="1000" aria-describedby="coachFeedbackHint"></textarea></label><p id="coachFeedbackHint" class="muted">No incluyas información personal ni médica. Este comentario no se envía a OpenAI.</p><button data-keep-enabled="true" class="btn primary" type="submit">Guardar valoración</button></form>');$('coachRating').value=f?.rating||'';$('coachFeedbackComment').value=f?.comment||'';
 $('coachFeedbackForm').onsubmit=async e=>{e.preventDefault();if(simpleCoach.busy)return;coachBusy(true);$('coachError').textContent='';try{await coachCall('save_my_coach_feedback',{p_routine:routine,p_rating:Number($('coachRating').value),p_comment:$('coachFeedbackComment').value});if(coachCurrent(epoch,owner)){coachBusy(false);$('coachStatus').textContent='Valoración guardada.';}}catch(e){if(coachCurrent(epoch,owner)){coachBusy(false);$('coachError').textContent=coachMessage(e.message);}}};
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
}
async function coachAccept(){
 if(simpleCoach.busy||!simpleCoach.operation)return;const epoch=simpleCoach.epoch,owner=user.id;coachBusy(true,'Creando tu rutina…');$('coachError').textContent='';
 try{const id=await coachCall('accept_basic_plan',{p_operation:simpleCoach.operation.id});if(!coachCurrent(epoch,owner))return;await reload();if(!coachCurrent(epoch,owner))return;await renderShared();if(!coachCurrent(epoch,owner))return;simpleCoach.accepted=true;coachShell('<h3>Rutina creada</h3><p>Ya puedes abrir las sesiones. La estructura queda fija durante el piloto.</p><button data-keep-enabled="true" class="btn primary" id="coachOpen">Abrir rutina</button>');$('coachOpen').onclick=()=>{coachDialog().close();openCoachRoutine(id);};}
 catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}finally{if(coachCurrent(epoch,owner))coachBusy(false);}
}
if(coachEnabled())db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){simpleCoach.epoch++;simpleCoach.intake=null;simpleCoach.operation=null;simpleCoach.accepted=false;simpleCoach.granted=false;const d=$('coachDialog');if(d){d.close();d.replaceChildren();}}});
