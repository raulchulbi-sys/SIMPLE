/* Premium chat view. Adapters own authorization, quotas and recommendation actions. */
(function(scope){
'use strict';
const NOTICE='Utiliza SIMPLE Coach para cuestiones relacionadas con tu entrenamiento. No incluyas información médica, lesiones, diagnósticos ni datos personales sensibles.';
const NOTICE_VERSION='premium-chat-v1';
const PENDING=new Set(['pending','reserved','dispatched','generating']);
const MAX_MESSAGE=4000;
const countLabel=value=>String(value).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' / 4.000';
const errors={
 premium_chat_consent_required:'Activa el permiso del chat antes de enviar un mensaje.',
 premium_chat_stale:'La revisión de tu rutina ha cambiado. Carga el contexto actual antes de enviar.',
 premium_chat_stale_context:'La revisión de tu rutina ha cambiado. Carga el contexto actual antes de enviar.',
 premium_chat_busy:'Hay una respuesta en curso. Espera a que termine.',
 premium_chat_daily_limit:'Has alcanzado el límite de mensajes del piloto. Vuelve a intentarlo más adelante.',
 premium_chat_quota:'Has alcanzado el límite de mensajes del piloto. Vuelve a intentarlo más adelante.',
 premium_chat_rate_limit:'Hay demasiadas solicitudes. Espera antes de volver a intentarlo.',
 premium_chat_rejected:'Este mensaje queda fuera del alcance del chat. Pregunta sobre tu programación de entrenamiento.',
 premium_chat_scope_denied:'Este mensaje queda fuera del alcance del chat. Pregunta sobre tu programación de entrenamiento.',
 premium_chat_outside_scope:'SIMPLE Coach se limita al entrenamiento. No incluyas información médica ni nutricional. Este mensaje no se ha guardado ni enviado al proveedor.',
 premium_chat_inactive:'El chat no está disponible para este mesociclo.',
 premium_chat_invalid_message:'Escribe entre 2 y 4.000 caracteres para enviar tu pregunta.',
 premium_chat_invalid_input:'Escribe entre 2 y 4.000 caracteres y evita incluir datos personales sensibles.',
 premium_chat_sensitive_input:'SIMPLE Coach se limita al entrenamiento. No incluyas información médica, nutricional ni datos personales sensibles. Este mensaje no se ha guardado ni enviado al proveedor.',
 premium_chat_message_pending:'Hay una respuesta en curso. Espera a que termine.',
 premium_chat_pilot_closed:'El chat no está disponible en este momento.',
 premium_chat_not_authorized:'No tienes acceso a esta conversación.',
 premium_history_consent_required:'Activa el permiso de historial desde SIMPLE Coach antes de utilizar el chat.',
 premium_chat_key_conflict:'Esta solicitud ya pertenece a otro mensaje. Actualiza la conversación antes de volver a intentarlo.',
 premium_chat_provider_failed:'La respuesta no se ha podido completar. Puedes reintentarlo manualmente.',
 premium_chat_invalid_output:'La respuesta no ha superado las comprobaciones del chat. Puedes reintentarlo manualmente.',
 premium_chat_context_revoked:'El contexto autorizado ha cambiado. Revisa los permisos desde SIMPLE Coach.',
 premium_chat_stale_revision:'La revisión de tu rutina ha cambiado. Carga el contexto actual antes de enviar.',
 premium_chat_stale_or_revoked:'La revisión o los permisos han cambiado. Carga el contexto actual.',
 premium_chat_stale_checkin:'El check-in ha cambiado. Carga el contexto actual antes de enviar.',
 premium_chat_timeout:'La respuesta no se ha completado a tiempo. Puedes reintentarlo manualmente.',
 premium_chat_budget_exhausted:'El chat no está disponible hasta que se amplíe el presupuesto del piloto.',
 premium_chat_forbidden:'No tienes acceso a esta conversación.',
 provider_network_or_timeout:'No se ha podido completar la respuesta. Puedes reintentarlo manualmente.',
 preview_error:'No se ha podido enviar. Tu pregunta sigue aquí; vuelve a intentarlo.',
 preview_offline:'No se ha podido conectar. Vuelve a intentarlo cuando tengas conexión.'
};
const text=(tag,value,cls)=>{const e=document.createElement(tag);if(value!==undefined)e.textContent=String(value??'');if(cls)e.className=cls;return e;};
const button=(label,action,cls)=>{const e=text('button',label,cls);e.type='button';e.dataset.action=action;return e;};
function errorText(error){return errors[error?.code||error?.message]||'No se ha podido completar la acción. Vuelve a intentarlo.';}
function sequence(s){return Math.max(0,...(s?.messages||[]).map(m=>Number(m.sequence)||0));}
function pending(s){return (s?.messages||[]).some(m=>PENDING.has(m.state));}
function mayRetry(m){return m?.state==='failed'&&m.retryable!==false&&!['premium_chat_stale_or_revoked','premium_chat_context_revoked','premium_chat_budget_exhausted'].includes(m.error);}
function uuid(){if(!scope.crypto?.randomUUID)throw Error('secure_browser_required');return scope.crypto.randomUUID();}
// Presentation projection only. Ownership, consent and availability stay distinct.
function fromBackend(s,recommendations={}){
 if(!s||typeof s!=='object'||!Array.isArray(s.messages))throw Error('invalid_chat_state');
 const messages=s.messages.map(m=>{if(!m||!Number.isSafeInteger(m.sequence_no)||m.sequence_no<1)throw Error('invalid_chat_state');return {id:m.id,sequence:m.sequence_no,state:m.state,user_content:typeof m.user_message==='string'?m.user_message:'',assistant_answer:typeof m.answer==='string'?m.answer:null,recommendation_id:m.recommendation_id||null,revision_id:m.revision_id,revision_no:m.revision_no,week:m.week,error:m.error||null,retryable:mayRetry(m),...(m.recommendation_id&&recommendations[m.recommendation_id]?{recommendation:recommendations[m.recommendation_id]}:{})};});
 return {permission:s.permission===true,history_permission:s.history_permission===true,available:s.available===true,week:s.week,revision_no:s.revision_no,revision_id:s.revision_id,mesocycle_id:s.mesocycle_id,conversation:s.conversation_id?{id:s.conversation_id}:null,messages};
}
function mount(root,adapter,options={}){
 if(!root||typeof adapter!=='function')throw Error('chat_adapter_required');
 root.classList.add('premium-chat');root.replaceChildren();
 const header=text('header',undefined,'chat-header'),back=button('← SIMPLE Coach','back','chat-back');
 const headings=text('div',undefined,'chat-headings'),heading=text('h1','Chat'),context=text('p','SIMPLE Coach', 'chat-context');
 headings.append(heading,context);header.append(back,headings);
 const transcript=text('main',undefined,'chat-transcript');transcript.setAttribute('aria-label','Conversación con SIMPLE Coach');
 const status=text('p','', 'chat-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');
 const footer=text('footer',undefined,'chat-footer'),notice=text('p',NOTICE,'chat-notice');notice.id='premium-chat-notice';
 const consent=text('div',undefined,'chat-consent');
 const form=text('form',undefined,'chat-form'),label=text('label','Pregunta sobre tu entrenamiento','chat-input-label');
 const input=text('textarea');input.id='premium-chat-input';input.name='message';input.rows=2;input.maxLength=MAX_MESSAGE;input.placeholder='Escribe tu pregunta';input.setAttribute('aria-describedby',notice.id);label.htmlFor=input.id;
 const send=button('Enviar','send','chat-send');send.type='submit';
 const counter=text('small','0 / 4.000','chat-counter');counter.setAttribute('aria-live','off');
 form.append(label,input,send,counter);footer.append(status,consent,form,notice);root.append(header,transcript,footer);
 let view=null,alive=true,epoch=0,serial=0,appliedSerial=0,requestActive=false,screen='chat',pollTimer=null,cooldownTimer=null,blockedUntil=0,outstanding=null,proposal=null;
 const storageKey=()=>view?.mesocycle_id?'simple-premium-chat-pending:'+view.mesocycle_id:null;
 function remember(value){outstanding=value;try{const k=storageKey();if(k){if(value)sessionStorage.setItem(k,JSON.stringify(value));else sessionStorage.removeItem(k);}}catch{}}
 function restore(){try{const k=storageKey(),v=k&&JSON.parse(sessionStorage.getItem(k)||'null');if(v&&typeof v.key==='string'&&v.revision_id===view.revision_id)outstanding=v;else if(k)sessionStorage.removeItem(k);}catch{}}
 function message(value='',isError=false){status.textContent=value;status.classList.toggle('chat-error',isError);status.setAttribute('role',isError?'alert':'status');}
 function resize(){if(!alive)return;const vp=scope.visualViewport;const visible=(vp?.height||scope.innerHeight)+(vp?.offsetTop||0),top=root.getBoundingClientRect().top;root.style.setProperty('--chat-offset',Math.max(0,top)+'px');root.style.setProperty('--chat-height',Math.max(180,visible-top)+'px');}
 function permitted(){return view?.permission&&view.history_permission!==false&&view.available!==false;}
 function updateControls(){const isPending=pending(view),disabled=requestActive||isPending||Date.now()<blockedUntil||!permitted()||!input.value.trim();send.disabled=disabled;send.textContent=requestActive||isPending?'Enviando…':'Enviar';input.disabled=!permitted();transcript.setAttribute('aria-busy',String(requestActive||isPending));root.querySelectorAll('[data-action="retry"]').forEach(b=>b.disabled=requestActive||isPending||!permitted()||Date.now()<blockedUntil);root.querySelectorAll('[data-action="proposal"]').forEach(b=>b.disabled=requestActive);root.querySelectorAll('[data-action="permission"]').forEach(b=>b.disabled=requestActive||!root.querySelector('#premium-chat-allow')?.checked);counter.textContent=countLabel(input.value.length);}
 function scrollBottom(){requestAnimationFrame(()=>{if(alive&&screen==='chat')transcript.scrollTop=transcript.scrollHeight;});}
 function setCooldown(e){if(!Number.isFinite(e?.retry_after)||e.retry_after<=0)return;blockedUntil=Date.now()+Math.min(e.retry_after,86400)*1000;clearTimeout(cooldownTimer);cooldownTimer=setTimeout(updateControls,Math.min(e.retry_after,86400)*1000+10);}
 function safeChanges(r){return Array.isArray(r?.changes)?r.changes:[];}
 function proposalCard(r,id){const card=text('section',undefined,'chat-proposal-card');card.setAttribute('aria-label','Propuesta de entrenamiento');card.append(text('h3','Propuesta'));
  if(r?.summary)card.append(text('p',r.summary));
  const changes=safeChanges(r);if(changes.length){const c=changes[0];if(c.exercise_name)card.append(text('p',c.exercise_name,'chat-exercise-ref'));const dl=text('dl',undefined,'chat-before-after');for(const [label,value] of [['Antes',c.before],['Después',c.after]]){const row=text('div');row.append(text('dt',label),text('dd',typeof value==='string'?value:c[label==='Antes'?'before_summary':'after_summary']||'Consultar prescripción en la propuesta'));dl.append(row);}card.append(dl);}
  card.append(text('p','Requiere revisión y aceptación; no cambia tu rutina desde el chat.','chat-secondary'));
  const open=button('Ver propuesta','proposal','chat-secondary-button');open.dataset.id=id;card.append(open);return card;
 }
 function renderProposal(){transcript.replaceChildren();const backChat=button('← Volver al chat','chat','chat-back');transcript.append(backChat,text('h2','Propuesta'));if(!proposal){transcript.append(text('p','Cargando propuesta…'));return;}
  if(proposal.reason)transcript.append(text('p',proposal.reason));
  for(const c of safeChanges(proposal)){const section=text('section',undefined,'chat-proposal-detail');if(c.exercise_name)section.append(text('h3',c.exercise_name));const dl=text('dl',undefined,'chat-before-after');for(const [label,key] of [['Antes','before'],['Después','after']]){const row=text('div');row.append(text('dt',label),text('dd',typeof c[key]==='string'?c[key]:c[key+'_summary']||'Prescripción detallada disponible en el flujo de revisión'));dl.append(row);}section.append(dl);transcript.append(section);}
  const warnings=proposal.quality_warnings||[];if(warnings.length){const section=text('section',undefined,'chat-warning');section.append(text('h3','Aspectos que debe revisar el reviewer'));const list=text('ul');for(const w of warnings)list.append(text('li',typeof w==='string'?w:w.message||w.code));section.append(list);transcript.append(section);}
  transcript.append(text('p',proposal.state==='pending_review'?'Pendiente de revisión. Todavía no puedes aceptarla.':'Continúa en el flujo de propuestas para revisar y aceptar los cambios.','chat-secondary'));
 }
 function render(){if(!alive)return;context.textContent=view?'SIMPLE Coach · Semana '+view.week+' · Revisión '+view.revision_no:'SIMPLE Coach';consent.replaceChildren();
  if(view&&!view.permission&&view.history_permission!==false&&view.available!==false){const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.id='premium-chat-allow';const label=text('label',undefined,'chat-consent-label');label.htmlFor=checkbox.id;label.append(checkbox,text('span','Permitir que el chat utilice el contexto de entrenamiento autorizado para este mesociclo.'));const allow=button('Activar chat','permission','chat-secondary-button');allow.disabled=true;checkbox.addEventListener('change',()=>allow.disabled=!checkbox.checked||requestActive);consent.append(label,allow);}
  if(screen==='proposal')renderProposal();else{const previousBottom=transcript.scrollHeight-transcript.scrollTop-transcript.clientHeight<80;transcript.replaceChildren();
   if(!view){transcript.append(text('p','Cargando conversación…','chat-empty'));}
   else if(view.history_permission===false){transcript.append(text('p','Activa el permiso de historial desde SIMPLE Coach.','chat-empty'));}
   else if(view.available===false){transcript.append(text('p','El chat no está disponible en este momento.','chat-empty'));}
   else if(!view.permission){transcript.append(text('p','El chat está desactivado. Puedes activarlo con el permiso de abajo.','chat-empty'));}
   else if(!view.messages?.length){const empty=text('section',undefined,'chat-empty');empty.append(text('h2','Tu programación, en contexto'),text('p','Pregunta sobre tus ejercicios, las series de tu rutina o tu evolución registrada.'));transcript.append(empty);}
   else for(const m of view.messages){const exchange=text('section',undefined,'chat-exchange');exchange.dataset.messageId=m.id;const user=text('div',undefined,'chat-user');user.append(text('span','Tu pregunta','chat-speaker'),text('p',m.user_content));exchange.append(user);
    const assistant=text('div',undefined,'chat-assistant');assistant.append(text('span','SIMPLE Coach','chat-speaker'));if(m.assistant_answer)assistant.append(text('p',m.assistant_answer));else if(PENDING.has(m.state))assistant.append(text('p','Preparando respuesta…','chat-secondary'));else if(m.state==='failed'){assistant.append(text('p',errorText({code:m.error||'premium_chat_timeout'}),'chat-secondary'));if(mayRetry(m)){const retry=button('Reintentar respuesta','retry','chat-secondary-button');retry.dataset.id=m.id;assistant.append(retry);}}else if(m.state==='superseded')assistant.append(text('p','La revisión o los permisos cambiaron antes de completar la respuesta. No se ha aplicado ningún cambio desde este mensaje.','chat-secondary'));else if(m.state==='rejected')assistant.append(text('p',m.safe_response||'Este mensaje queda fuera del alcance del chat.','chat-secondary'));
    if(m.recommendation_id){const r=m.recommendation||(view.recommendation?.id===m.recommendation_id?view.recommendation:null);assistant.append(proposalCard(r,m.recommendation_id));}exchange.append(assistant);transcript.append(exchange);}
   if(previousBottom)scrollBottom();
  }
  form.hidden=screen!=='chat';notice.hidden=screen!=='chat';consent.hidden=screen!=='chat';updateControls();resize();schedulePoll();
 }
 function applyState(next){if(!next||!Array.isArray(next.messages))throw Error('invalid_chat_state');if(view&&next.permission&&next.history_permission!==false&&next.available!==false&&view.mesocycle_id===next.mesocycle_id&&(Number(next.revision_no)<Number(view.revision_no)||next.conversation?.id===view.conversation?.id&&sequence(next)<sequence(view)))return false;
  const lostPermission=view?.permission&&!next.permission,lostHistory=view?.history_permission!==false&&next.history_permission===false;view=next;if(lostPermission||lostHistory){input.value='';remember(null);message(lostHistory?'Activa el permiso de historial desde SIMPLE Coach.':'El permiso del chat está desactivado.');}if(!pending(view)){remember(null);}render();return true;
 }
 function schedulePoll(){clearTimeout(pollTimer);pollTimer=null;if(alive&&screen==='chat'&&view?.permission&&pending(view))pollTimer=setTimeout(()=>load(false),options.pollMs||1500);}
 async function load(reset=false){if(!alive)return false;const ticket=reset?++epoch:epoch,request=++serial;if(reset){requestActive=false;screen='chat';proposal=null;message('');}try{const s=await adapter('state',{});if(!alive||ticket!==epoch||request<appliedSerial)return false;appliedSerial=request;const applied=applyState(s);restore();return applied;}catch(e){if(alive&&ticket===epoch){message(errorText(e),true);status.append(document.createTextNode(' '),button('Actualizar conversación','reload','chat-secondary-button'));updateControls();}return false;}}
 async function act(action,data,after){if(!alive||requestActive)return false;const ticket=epoch;requestActive=true;message(action==='proposal'?'Cargando propuesta…':action==='permission'?'Activando chat…':'Enviando pregunta…');updateControls();try{const value=await adapter(action,data);if(!alive||ticket!==epoch)return false;if(after)await after(value);return true;}catch(e){if(alive&&ticket===epoch){setCooldown(e);message(errorText(e),true);if(/stale/.test(e.code||e.message))await load(false);}return false;}finally{if(alive&&ticket===epoch){requestActive=false;updateControls();schedulePoll();}}}
 async function submit(retryMessage=null){if(!permitted()||pending(view)||Date.now()<blockedUntil||requestActive||retryMessage&&!mayRetry(retryMessage))return;const content=(retryMessage?.user_content??input.value).trim();if(Array.from(content).length<2||content.length>MAX_MESSAGE){message(errors.premium_chat_invalid_message,true);return;}
  const key=uuid(),messageId=uuid(),data={mesocycle_id:view.mesocycle_id,conversation_id:view.conversation?.id||null,revision_id:view.revision_id,key,message_id:messageId,message:content};if(retryMessage)data.retry_of=retryMessage.id;remember({key,message_id:messageId,revision_id:view.revision_id});
  await act(retryMessage?'retry':'send',data,async value=>{if(Array.isArray(value?.messages)){if(!applyState(value)){await load(false);message(errors.premium_chat_stale_context,true);return;}}else if(!await load(false))return;if(!view?.permission){message(errors.premium_chat_consent_required,true);return;}
   const direct=value?.message||value,response=typeof direct?.state==='string'?direct:[...(view.messages||[])].reverse().find(m=>m.revision_id===data.revision_id&&typeof m.user_content==='string'&&m.user_content.normalize('NFC')===content.normalize('NFC'));
   if(['failed','rejected','superseded'].includes(response?.state)){message(errorText({code:response.error||(response.state==='superseded'?'premium_chat_stale_or_revoked':response.state==='rejected'?'premium_chat_rejected':'premium_chat_provider_failed')}),true);scrollBottom();return;}
   const accepted=PENDING.has(response?.state)||response?.state==='completed'&&!!(response.assistant_answer||response.answer);
   if(!accepted){message('No se ha podido confirmar la respuesta. Tu pregunta sigue aquí; actualiza la conversación.',true);status.append(document.createTextNode(' '),button('Actualizar conversación','reload','chat-secondary-button'));return;}
   if(!retryMessage&&input.value.trim()===content)input.value='';message(PENDING.has(response.state)?'Tu pregunta está enviada. Preparando respuesta…':'Respuesta disponible.');scrollBottom();});
 }
 input.addEventListener('input',updateControls);
 input.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();submit();}});
 form.addEventListener('submit',e=>{e.preventDefault();submit();});
 const onClick=async e=>{if(!alive)return;const b=e.target.closest('button[data-action]');if(!b||!root.contains(b)||b.disabled)return;switch(b.dataset.action){case 'reload':await load(true);break;case 'back':++epoch;requestActive=false;clearTimeout(pollTimer);try{await adapter('navigate',{destination:'coach'});}catch(error){message(errorText(error),true);updateControls();schedulePoll();}break;case 'permission':if(!root.querySelector('#premium-chat-allow')?.checked)return;await act('permission',{allow:true,notice_version:NOTICE_VERSION},async v=>{if(Array.isArray(v?.messages))applyState(v);else await load(false);message('Chat activado.');});break;case 'retry':{const m=view.messages.find(m=>m.id===b.dataset.id);if(m?.state==='failed')await submit(m);break;}case 'proposal':{const id=b.dataset.id;await act('proposal',{id},v=>{message('');if(v?.handled)return;proposal=v;screen='proposal';render();transcript.scrollTop=0;transcript.querySelector('h2')?.setAttribute('tabindex','-1');transcript.querySelector('h2')?.focus();});break;}case 'chat':screen='chat';proposal=null;render();scrollBottom();break;}};
 root.addEventListener('click',onClick);
 scope.addEventListener('resize',resize);scope.visualViewport?.addEventListener('resize',resize);scope.visualViewport?.addEventListener('scroll',resize);resize();render();load();
 return {load:()=>load(true),destroy(){alive=false;++epoch;clearTimeout(pollTimer);clearTimeout(cooldownTimer);root.removeEventListener('click',onClick);scope.removeEventListener('resize',resize);scope.visualViewport?.removeEventListener('resize',resize);scope.visualViewport?.removeEventListener('scroll',resize);},snapshot:()=>({view,screen,outstanding,busy:requestActive}),input};
}
const API={NOTICE,NOTICE_VERSION,MAX_MESSAGE,fromBackend,mount};scope.PremiumChat=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
