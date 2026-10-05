/* Closed supervised pilot. UI choices never grant server capabilities. */
const simpleCoach={epoch:0,intake:null,operation:null,busy:false,accepted:false,newGeneration:false,pageActive:true};
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
 const owner=user?.id;let premium;try{premium=await db.rpc('premium_my_access',{});}catch{premium={error:true};}
 if(!isCurrent()||!coachEnabled()||user?.id!==owner)return;
 const premiumEnabled=!premium.error&&premium.data?.enabled===true;
 const basicVisible=(access.data?.authorized||(result.data||[]).length)&&!(!result.error&&(assignments||[]).length&&!(result.data||[]).length);
 if(!basicVisible&&!premiumEnabled)return;
 const host=document.createElement('div');host.id='coachHome';$('shared').append(host);
 if(basicVisible)host.innerHTML='<div class="card"><h2>¿Cómo quieres entrenar?</h2><div class="buttons"><button data-keep-enabled="true" class="btn" onclick="openRedeemRoutine()">Vincularme con un entrenador</button><button data-keep-enabled="true" class="btn primary" onclick="openSimpleCoach()">Entrenar con SIMPLE Coach</button></div></div>';
 // A missing RPC (including pre-Premium deployments) or an error grants no UI access.
 if(premiumEnabled){const card=document.createElement('div');card.className='card';const title=document.createElement('h3');title.textContent='Seguimiento Premium';const action=document.createElement('button');action.type='button';action.className='btn';action.dataset.keepEnabled='true';action.textContent='Abrir seguimiento Premium';action.onclick=()=>openPremiumCoach();card.append(title,action);host.append(card);}
 if(result.error){host.insertAdjacentHTML('beforeend','<p role="status">No se pudo cargar SIMPLE Coach. Vuelve a abrir Inicio para reintentar.</p>');return;}
 for(const item of result.data||[]){
  const r=routines.find(x=>x.id===item.routine_id);if(!r)continue;
  const cycle=await getWeeklyRoutineProgressForUser(user.id,[r.id]);
  if(!isCurrent())return;
  const p=cycle.get(r.id)||{done:0,total:0};
  host.insertAdjacentHTML('beforeend','<div class="card"><h3>'+esc(r.name)+'</h3><p class="muted">SIMPLE Coach · piloto</p>'+renderWeeklyRoutineProgress(p.total,p.done,user.id+'|'+r.id)+'<div class="buttons"><button data-keep-enabled="true" class="btn primary" onclick="openCoachRoutine(\''+r.id+'\')">Entrenar</button><button data-keep-enabled="true" class="btn" onclick="openRoutineProgress(\''+r.id+'\')">Progreso</button></div></div>');
 }
}
// Premium uses the existing SDK/session. Its dialog owns no Auth or Basic state.
const simpleCoachPremium={epoch:0,controller:null};
function premiumCoachDialog(){
 let d=$('premiumCoachDialog');if(d)return d;
 d=document.createElement('dialog');d.id='premiumCoachDialog';d.className='premium-coach-dialog';d.setAttribute('aria-label','SIMPLE Coach Premium');document.body.append(d);
 d.addEventListener('close',()=>{if(d.open)return;simpleCoachPremium.epoch++;simpleCoachPremium.controller?.destroy();simpleCoachPremium.controller=null;d.replaceChildren();});return d;
}
async function openPremiumCoach(options={}){
 const mesocycleId=profile?.role==='trainer'?options.mesocycleId:null;
 if(!coachEnabled()||!window.PremiumApp||profile?.role!=='client'&&!(profile?.role==='trainer'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mesocycleId||'')))return;
 const owner=user?.id,epoch=++simpleCoachPremium.epoch,d=premiumCoachDialog();simpleCoachPremium.controller?.destroy();simpleCoachPremium.controller=null;
 const host=document.createElement('div');host.id='premiumCoachHost';const loading=document.createElement('p');loading.textContent='Cargando seguimiento…';loading.setAttribute('role','status');const close=document.createElement('button');close.type='button';close.textContent='← Volver';close.onclick=()=>d.close();host.append(loading,close);d.replaceChildren(host);if(!d.open)d.showModal();
 const current=()=>d.open&&epoch===simpleCoachPremium.epoch&&owner===user?.id;
 try{
  if(mesocycleId){const assigned=await db.from('coach_mesocycles').select('id').eq('id',mesocycleId).eq('reviewer_id',owner).maybeSingle();if(!current())return;if(assigned.error||!assigned.data)throw Error('premium_not_authorized');}
  const controller=await PremiumApp.attach(host,{db,mesocycleId,onNavigate:(to,data)=>{if(!d.open||epoch!==simpleCoachPremium.epoch)return;d.close();if(to==='train'&&profile?.role==='client'&&owner===user?.id&&data?.routine_id)openCoachRoutine(data.routine_id);}});
  if(!current()){controller.destroy();if(d.open&&epoch===simpleCoachPremium.epoch)d.close();return;}
  if(!controller.enabled){controller.destroy();loading.textContent='El seguimiento Premium no está disponible para esta cuenta.';return;}
  simpleCoachPremium.controller=controller;host.querySelector('h1')?.setAttribute('tabindex','-1');host.querySelector('h1')?.focus({preventScroll:true});
 }catch(e){if(!current())return;loading.textContent=PremiumApp.errorText(e);loading.setAttribute('role','alert');const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar';retry.onclick=()=>openPremiumCoach(options);host.className='';host.replaceChildren(loading,close,retry);}
}
async function openCoachRoutine(id){
 const owner=user?.id,epoch=(simpleCoach.hintsEpoch||0)+1;simpleCoach.hintsEpoch=epoch;simpleCoach.routineHints=null;
 let hints;try{hints=await coachReadRoutineHints(id,owner);if(hints===null)throw Error('invalid_revision');}catch{if(user?.id===owner&&simpleCoach.hintsEpoch===epoch)toast('No se pudo cargar la prescripción. Vuelve a abrir la rutina.');return;}
 if(user?.id!==owner||simpleCoach.hintsEpoch!==epoch)return;
 simpleCoach.routineHints={owner,routine:id,byId:hints};
 await openSharedRoutine(id);
 if(workoutRoutine?.id===id)$('trainSubtitle').textContent='SIMPLE Coach · prescripción fija del piloto'+(hints===null?' · No se pudo comprobar la indicación por lado. Vuelve a abrir la rutina.':'');
}
function coachRevisionHints(revision,operation,routine,owner){
 if(operation?.prompt_version==='basic-initial-v5')return coachV5RevisionHints(revision,operation,routine,owner);
 if(operation?.prompt_version!=='basic-initial-v4')return new Map();
 const s=revision?.snapshot;
 if(operation.state!=='accepted'||operation.routine_id!==routine||operation.user_id!==owner||revision?.routine_id!==routine||revision.user_id!==owner||revision.operation_id!==operation.id||s?.id!==routine||s?.owner_id!==owner||!Array.isArray(s.days))return null;
 const hints=new Map(),seen=new Set(),uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
 for(const d of s.days){if(!Array.isArray(d.exercises))return null;for(const e of d.exercises){
  if(!uuid.test(e.id||'')||seen.has(e.id))return null;seen.add(e.id);
  const metadata=globalThis.SimpleCoachProgrammingV4.byName.get(e.name);if(!metadata)return null;
  if(metadata.unilateral)hints.set(e.id,true);
 }}return hints;
}
async function coachReadRoutineHints(routine,owner){
 if(globalThis.PremiumPrescription){const premium=await PremiumPrescription.read(db,routine,owner);if(premium.handled)return premium.hints;}
 const m=await db.from('routine_management').select('routine_id,operation_id,current_revision_id').eq('routine_id',routine).maybeSingle();if(m.error)throw m.error;if(!m.data)return new Map();
 const o=await db.from('coach_operations').select('id,user_id,routine_id,state,prompt_version').eq('id',m.data.operation_id).single();if(o.error)throw o.error;
 if(!['basic-initial-v4','basic-initial-v5'].includes(o.data.prompt_version))return new Map();
 const r=await db.from('routine_revisions').select('id,routine_id,user_id,operation_id,snapshot').eq('id',m.data.current_revision_id).single();if(r.error)throw r.error;
 if(r.data?.id!==m.data.current_revision_id||o.data?.routine_id!==routine||o.data?.user_id!==owner)return null;
 return coachRevisionHints(r.data,o.data,routine,owner);
}
function coachRepetitionSuffix(exercise,routine,locked=false){
 const h=simpleCoach.routineHints;
 const value=h?.byId?.get(exercise.id);
 return !locked&&h?.owner===user?.id&&h?.routine===routine&&(value===true||value?.unilateral)?' por lado':'';
}
// Historical labels only; the active questionnaire catalogue lives in coach-intake.js.
const coachChoices={experience:{beginner:'Principiante',intermediate:'Intermedio',experienced:'Avanzado'}};
function coachCurrent(epoch,owner){return epoch===simpleCoach.epoch&&owner===user?.id&&simpleCoach.pageActive&&$('coachDialog')?.open;}
function coachDialog(){
 let d=$('coachDialog');if(!d){d=document.createElement('dialog');d.id='coachDialog';d.className='coach-dialog';d.setAttribute('aria-labelledby','coachTitle');document.body.append(d);d.addEventListener('close',()=>{simpleCoach.epoch++;simpleCoach.busy=false;});}return d;
}
function coachShell(content){
 const d=coachDialog();simpleCoach.busy=false;d.setAttribute('aria-busy','false');
 d.innerHTML='<div class="coach-heading"><h2 id="coachTitle" tabindex="-1">'+(simpleCoach.newGeneration?'Nueva propuesta':'SIMPLE Coach')+'</h2><button data-keep-enabled="true" class="btn" aria-label="Cerrar SIMPLE Coach" onclick="document.getElementById(\'coachDialog\').close()">Cerrar</button></div><p class="muted">Basic · piloto sin cobro. Tu propuesta tendrá revisión humana antes de que puedas aceptarla.</p><div id="coachError" role="alert"></div><div id="coachStatus" role="status" aria-live="polite"></div>'+content;
 if(!d.open)d.showModal();d.scrollTop=0;$('coachTitle').focus();
}
function coachMessage(code){
 if(code==='coach_generation_limit')return 'No quedan nuevas generaciones autorizadas. Tus rutinas se conservan.';
 if(code==='coach_new_intake_required')return 'Completa el nuevo cuestionario Basic antes de generar otra propuesta.';
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
 const owner=user.id,epoch=++simpleCoach.epoch;simpleCoach.intake=null;simpleCoach.operation=null;simpleCoach.wizard=null;simpleCoach.newGeneration=false;coachShell('<p>Cargando tu acceso…</p>');
 try{const access=await coachCall('get_my_coach_access',{});if(!coachCurrent(epoch,owner))return;simpleCoach.accepted=!!access.routine_id;
 if(access.routine_id){
  const saved=access.accepted_routines?.length?access.accepted_routines:[{routine_id:access.routine_id,name:'Tu rutina Basic'}];
  const pending=access.latest_operation_state&&access.latest_operation_state!=='accepted';
  coachShell('<h3>Tus rutinas Basic</h3><p>Las rutinas aceptadas y sus entrenamientos se conservan.</p>'+saved.map((r,n)=>'<p>'+esc(r.name)+' <button data-keep-enabled="true" class="btn" data-coach-routine="'+esc(r.routine_id)+'"'+(n===0?' id="coachOpen"':'')+'>Abrir rutina</button></p>').join('')+'<div class="buttons">'+(pending?'<button data-keep-enabled="true" class="btn primary" id="coachPending">Ver nueva propuesta</button>':access.can_generate?'<button data-keep-enabled="true" class="btn primary" id="coachNewGeneration">Nueva propuesta</button>':'')+'<button data-keep-enabled="true" class="btn" id="coachContext">Anamnesis y permisos</button>'+(access.can_feedback?'<button data-keep-enabled="true" class="btn" id="coachFeedback">'+(access.has_feedback?'Ver o actualizar valoración':'Valorar rutina')+'</button>':'')+'</div>');
  coachDialog().querySelectorAll('[data-coach-routine]').forEach(b=>b.onclick=()=>{coachDialog().close();openCoachRoutine(b.dataset.coachRoutine);});
  $('coachContext').onclick=()=>{simpleCoach.newGeneration=false;simpleCoach.accepted=true;coachLoadIntake(true);};
  if($('coachNewGeneration'))$('coachNewGeneration').onclick=coachBeginNewGeneration;
  if($('coachPending'))$('coachPending').onclick=()=>{simpleCoach.accepted=false;coachLoadIntake();};
  if($('coachFeedback'))$('coachFeedback').onclick=()=>coachFeedback(access.routine_id);return;
 }
 if(!access.authorized){coachShell('<p>Esta cuenta todavía no está autorizada para el piloto.</p>');return;}
 coachShell('<h3>Basic · piloto</h3><p>Describe tu contexto de entrenamiento, revisa la propuesta y acepta tu primera rutina cuando esté aprobada.</p><button data-keep-enabled="true" class="btn primary" id="coachBegin">Elegir Basic</button>');$('coachBegin').onclick=()=>coachLoadIntake();
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
}
async function coachBeginNewGeneration(){
 if(simpleCoach.busy)return;
 const owner=user.id,epoch=++simpleCoach.epoch;coachShell('<p>Cargando tu acceso…</p>');
 try{const access=await coachCall('get_my_coach_access',{});if(!coachCurrent(epoch,owner))return;
  if(!access.authorized||!access.can_generate||access.latest_operation_state!=='accepted')throw Error('coach_generation_limit');
  simpleCoach.newGeneration=true;simpleCoach.accepted=false;simpleCoach.wizard=null;
  coachShell('<h3>Nueva propuesta</h3><p>Crearás una nueva rutina Basic independiente. Tu rutina anterior y sus entrenamientos se conservan; esta propuesta necesitará revisión y aceptación.</p><button data-keep-enabled="true" class="btn primary" id="coachBegin">Elegir Basic</button>');
  $('coachBegin').onclick=()=>coachLoadIntake(true);
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
}
async function coachLoadIntake(permissions=false){
 const owner=user.id,epoch=++simpleCoach.epoch;coachShell('<p>Cargando tu anamnesis…</p>');
 try{
 const [ir,gr,or]=await Promise.all([
 db.from('training_intakes').select('id,revision,schema_version,row_version,state,training').order('revision',{ascending:false}).limit(1).maybeSingle(),
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
function coachConsentNotice(){return '<aside class="coach-notice"><strong>Piloto supervisado · versión pendiente de revisión legal final</strong><p>SIMPLE Coach Basic utiliza inteligencia artificial de OpenAI para crear una propuesta inicial de entrenamiento.</p><p>Utilizaremos únicamente tu objetivo, experiencia, disponibilidad, estimación del esfuerzo, material, ejercicios excluidos y otras actividades. OpenAI procesa esa información mediante su API. Antes de que puedas aceptar la propuesta, una persona autorizada la revisará.</p><p>No enviamos automáticamente tu nombre, correo, UUID, historial de entrenamientos, notas personales, información de otras personas ni datos administrativos. En este piloto no utilizaremos molestias, limitaciones ni información médica.</p><p>No incluyas información identificativa o médica en campos libres. SIMPLE Coach no diagnostica ni trata lesiones y no sustituye a un profesional sanitario.</p><p>Puedes retirar este permiso para impedir nuevas generaciones e invalidar propuestas pendientes. La rutina ya aceptada seguirá disponible. Retirar el permiso no deshace un procesamiento que ya haya ocurrido ni elimina automáticamente los registros de trazabilidad.</p><small>Versión pilot-supervised-v2. Este aviso del piloto no sustituye a la información legal definitiva.</small></aside>';}
function coachShowConsent(){
 const owner=user.id,epoch=simpleCoach.epoch;
 coachShell('<h3>Información y permiso</h3>'+coachConsentNotice()+'<form id="coachConsentForm"><label class="coach-consent"><input type="checkbox" id="coachGrantTraining" '+(simpleCoach.granted?'checked':'')+'>Consiento el tratamiento del contexto de entrenamiento indicado para generar y revisar mi propuesta de SIMPLE Coach.</label><div class="buttons"><button data-keep-enabled="true" class="btn primary" type="submit">Continuar</button></div></form>');
 $('coachGrantTraining').onchange=async()=>{if(simpleCoach.busy)return;const input=$('coachGrantTraining'),allow=input.checked;coachBusy(true,'Guardando permiso…');$('coachError').textContent='';
 try{await coachCall('set_my_coach_context_permission',{p_scope:'training_intake',p_allow:allow});if(!coachCurrent(epoch,owner))return;simpleCoach.granted=allow;if(!allow){simpleCoach.operation=null;simpleCoach.reviewed=false;}}
 catch(e){if(coachCurrent(epoch,owner)){input.checked=!allow;$('coachError').textContent=coachMessage(e.message);}}
 finally{if(coachCurrent(epoch,owner)){coachBusy(false);if(!allow&&!simpleCoach.granted)$('coachStatus').textContent='Permiso retirado. Tu rutina aceptada se conserva.';}}};
 $('coachConsentForm').onsubmit=e=>{e.preventDefault();if(simpleCoach.busy)return;if(!simpleCoach.granted){$('coachError').textContent=coachMessage('coach_context_required');$('coachGrantTraining').focus();return;}coachShowIntake();};
}
function coachShowIntake(){if(simpleCoach.wizard?.owner===user?.id&&!simpleCoach.wizard.premium)return coachRenderQuestionnaire();coachStartQuestionnaire(simpleCoach.newGeneration&&simpleCoach.intake?.state!=='draft'?null:simpleCoach.intake?.training||null);}
function coachTraining(complete=true){return coachWizardTraining(complete);}
function coachTrainingMarkup(t){t=t||{};if(t?.schema_version==='basic-intake-v2')return coachWizardMarkup(t);const fields=[['Objetivo',t.goal],['Experiencia',coachChoices.experience[t?.experience]||t?.experience||'No indicado'],['Días',t.days],['Minutos por sesión',t.minutes],['Material',(Array.isArray(t?.equipment)?t.equipment:[]).join(', ')||'No indicado'],['Preferidos',t.preferred||'Sin preferencia'],['Evitar',t.avoided||'Ninguno seleccionado']];return '<dl class="coach-context">'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(String(v??'No indicado'))+'</dd>').join('')+'</dl>';}
async function coachSave(generate){
 if(simpleCoach.busy||(generate&&(!simpleCoach.reviewed||simpleCoach.accepted))||!$('coachForm').reportValidity())return;
 const owner=user.id,epoch=simpleCoach.epoch;let training;
 try{if(!simpleCoach.granted)throw Error('coach_context_required');training=coachTraining(generate);}catch(e){$('coachError').textContent=coachMessage(e.message);return;}
 coachBusy(true,generate?'Estamos preparando tu rutina…':'Guardando borrador…');$('coachError').textContent='';
 try{const i=simpleCoach.intake;
 const intake=await coachCall('save_my_training_intake',{p_id:i?.id||null,p_expected:i?.row_version||null,p_training:training,p_submit:generate});
 if(!coachCurrent(epoch,owner))return;simpleCoach.intake=intake;
 if(!generate){coachRenderQuestionnaire();$('coachStatus').textContent='Borrador guardado.';return;}
 // Closing/signing out while saving must never dispatch the provider request afterward.
 const result=await db.functions.invoke('simple-coach-mock',{body:{intake_id:intake.id,key:crypto.randomUUID()}});
 if(!coachCurrent(epoch,owner))return;if(result.error||result.data?.error)throw Error(result.data?.error||'coach_request_failed');
 const op=result.data.operation;simpleCoach.operation=op;if(op.state==='failed')throw Error(op.error_code);
 if(op.state==='reserved'){await coachPollOperation(op.id,epoch,owner);return;}coachRenderOperation(op);
 }catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}
 finally{if(coachCurrent(epoch,owner)){const status=$('coachStatus')?.textContent;coachBusy(false);if(!generate&&status==='Borrador guardado.')$('coachStatus').textContent=status;}}
}
function coachDeleteDraft(){
 if(simpleCoach.busy||simpleCoach.intake?.state!=='draft')return;
 $('coachDeleteConfirm').innerHTML='<p id="coachDeleteTitle">¿Borrar este borrador no enviado? Esta acción no elimina rutinas aceptadas ni entrenamientos.</p><div class="buttons"><button data-coach-action data-keep-enabled="true" class="btn" id="coachCancelDelete">Conservar borrador</button><button data-coach-action data-keep-enabled="true" class="btn danger" id="coachConfirmDelete">Borrar borrador</button></div>';$('coachCancelDelete').focus();$('coachCancelDelete').onclick=()=>$('coachDeleteConfirm').replaceChildren();
 $('coachConfirmDelete').onclick=async()=>{if(simpleCoach.busy)return;const owner=user.id,epoch=simpleCoach.epoch,i=simpleCoach.intake;coachBusy(true,'Borrando borrador…');try{await coachCall('delete_my_training_intake',{p_id:i.id,p_expected:i.row_version});if(!coachCurrent(epoch,owner))return;simpleCoach.intake=null;simpleCoach.wizard=null;coachShowIntake();$('coachStatus').textContent='Borrador borrado.';}catch(e){if(coachCurrent(epoch,owner))$('coachError').textContent=coachMessage(e.message);}finally{if(coachCurrent(epoch,owner)){const deleted=$('coachStatus')?.textContent==='Borrador borrado.';coachBusy(false);if(deleted)$('coachStatus').textContent='Borrador borrado.';}}};
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
function coachProposalMarkup(p,promptVersion){
 if(promptVersion==='basic-initial-v5')return coachV5ProposalMarkup(p);
 const v4=promptVersion==='basic-initial-v4',q=globalThis.SimpleCoachProgrammingV4;
 return '<h3>'+esc(p.name)+'</h3>'+(p.description?'<p>'+esc(p.description)+'</p>':'')+'<p>'+p.days.length+' días · duración orientativa, no medida</p>'+p.days.map(d=>{const minutes=Math.ceil((300+d.exercises.reduce((n,e)=>n+(v4?q.seconds(e):120+e.sets*(e.reps_max*4+e.rest_seconds)),0))/60);return '<section class="coach-day"><h4>'+esc(d.name)+' · ≈ '+minutes+' min</h4>'+d.exercises.map(e=>'<p><b>'+esc(e.name)+'</b><br>'+e.sets+' series · '+e.reps_min+'–'+e.reps_max+' reps'+(v4&&q.byName.get(e.name)?.unilateral?' por lado':'')+' · RIR '+e.rir+' · '+SimpleCoachProgrammingV5.minutes(e.rest_seconds)+' de descanso</p>').join('')+'</section>';}).join('');
}
function coachRenderProposal(op){
 simpleCoach.operation=op;if($('coachForm'))$('coachForm').hidden=true;
 $('coachProposal').innerHTML='<h3 id="coachReadyHeading" tabindex="-1">Tu rutina está lista</h3><p class="muted">Revisada y aprobada. Puedes leerla completa antes de aceptarla.</p>'+coachProposalMarkup(op.proposal,op.prompt_version)+'<div class="buttons"><button data-coach-action data-keep-enabled="true" class="btn primary" id="coachAccept">Aceptar rutina</button><button data-coach-action data-keep-enabled="true" class="btn" id="coachDecline">No me convence</button></div><div id="coachDeclineForm"></div>';
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
if(coachEnabled())db.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){simpleCoach.hintsEpoch=(simpleCoach.hintsEpoch||0)+1;simpleCoach.routineHints=null;simpleCoach.epoch++;simpleCoach.intake=null;simpleCoach.operation=null;simpleCoach.wizard=null;simpleCoach.accepted=false;simpleCoach.granted=false;const d=$('coachDialog');if(d){d.close();d.replaceChildren();}}});
