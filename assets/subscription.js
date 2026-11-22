/* Staging subscription view. URL parameters are navigation hints, never entitlements. */
((w)=>{'use strict';
 const messages={none:['Elige tu plan','Todavía no tienes una suscripción.'],open:['Compra sin terminar','Puedes comprobar el estado antes de continuar.'],pending:['Pago pendiente','Todavía no se ha confirmado el pago. No vuelvas a comprar.'],payment_failed:['Revisa tu pago','El último pago necesita atención. Puedes gestionar tu método de pago.'],reconciling:['Confirmando tu suscripción','Estamos comprobando el pago. Actualiza el estado dentro de unos instantes.'],active:['Tu plan está activo','El pago y los derechos se han verificado.'],scheduled_cancel:['Cancelación programada','Conservas el acceso durante el periodo ya pagado.'],expired:['Suscripción finalizada','No hay un periodo pagado vigente. Tus rutinas e historial se conservan.'],review_required:['Comprobación pendiente','No podemos confirmar tus derechos en este momento. Actualiza el estado; si continúa, contacta con soporte.']};
 const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
 const date=x=>{const d=new Date(x);return x&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('es-ES',{dateStyle:'long'}).format(d):'Pendiente de confirmar';};
 function mount(root,{db,onAuthNeeded=()=>{},navigate=url=>location.assign(url),onCoach=null}={}){
  let generation=0,busy=false,disposed=false,status=null,capabilities=null,owner=null,uncertain=false;
  const header=node('div',null,'subscription-heading');header.append(node('p','SIMPLE · Entorno de pruebas','subscription-eyebrow'),node('h2','Mi suscripción'));
  const content=node('div');content.setAttribute('aria-live','polite');content.setAttribute('aria-atomic','true');
  const notice=node('p',null,'subscription-notice');notice.setAttribute('role','status');
  const actions=node('div',null,'subscription-actions');root.classList.add('subscription');root.replaceChildren(header,content,notice,actions);
  function button(text,action,primary=false){const b=node('button',text,'btn'+(primary?' primary':''));b.type='button';b.disabled=busy;b.onclick=action;actions.append(b);return b;}
  function loading(value){busy=value;root.setAttribute('aria-busy',String(value));for(const b of root.querySelectorAll('button'))b.disabled=value;}
  function render(){
   content.replaceChildren();actions.replaceChildren();if(!status)return;
   const info=messages[status.state];if(!info)throw Error('invalid_status');
   content.append(node('h3',info[0]),node('p',info[1]));
   if(status.plan){const details=node('dl',null,'subscription-details');for(const [title,value] of [
    ['Plan',status.plan==='basic'?'Basic':'Premium'],['Precio mensual',status.plan==='basic'?'4,99 €':'12,99 €'],
    ['Acceso pagado hasta',date(status.paidUntil)],['Próxima facturación',status.cancelAtPeriodEnd?'No se renovará al finalizar el periodo':date(status.nextBillingAt)]
   ]){const row=node('div');row.append(node('dt',title),node('dd',value));details.append(row);}content.append(details);}
   if(status.accessActive&&status.state==='payment_failed')content.append(node('p','Tu periodo ya pagado sigue disponible hasta la fecha indicada.'));
   if(!status.accessActive)content.append(node('p','El retorno del pago no activa el plan: SIMPLE espera la confirmación verificada.','muted'));
   if(status.canCheckout&&!uncertain){const plans=node('div',null,'subscription-plans');
    for(const [plan,label,price] of [['basic','Basic','4,99 €']]){
     const card=node('section',null,'subscription-plan');card.append(node('h3',label),node('p',price+' / mes','subscription-price'));
     card.append(node('p',plan==='basic'?'Preparación del entrenamiento con revisión humana.':'Seguimiento asistido.'));
     card.append(node('p','Prueba de facturación. Prestaciones y límites comerciales pendientes de aprobación.','muted'));
     const b=node('button','Probar '+label+' en TEST','btn');b.type='button';b.disabled=busy;b.onclick=()=>run('checkout',{plan});card.append(b);plans.append(card);
    }content.append(plans);content.append(node('p','Premium todavía no está disponible para contratar.','muted'));content.append(node('p','Coaching humano es un servicio separado y no está incluido.','muted'));
   }
   if(status.portalAvailable)button('Gestionar suscripción y facturas',()=>run('portal'),true);
   button('Actualizar estado',()=>refresh());
   if(['open','pending','reconciling','review_required'].includes(status.state)||uncertain)button('Comprobar pago',()=>run('reconcile'));
   if(onCoach&&status.accessActive&&status.plan==='basic'){
    if(capabilities?.basicActive===true && capabilities?.basicGenerationEnabled===true && capabilities?.premiumEnabled===false && capabilities?.quotasChanged===false && capabilities?.humanReviewRequired===true)button('Abrir SIMPLE Coach',()=>onCoach());
    else content.append(node('p','Basic figura activo. La generación de nuevas propuestas todavía no está habilitada en esta prueba.','muted'));
   }
  }
  async function verifiedUser(){const r=await db.auth.getUser();if(r.error||!r.data?.user||r.data.user.is_anonymous)throw Error('auth_required');return r.data.user.id;}
  async function request(action,body={}){const r=await db.functions.invoke('billing-test',{body:{action,...body}});if(r.error?.context?.status===401 || r.data?.error==='billing_auth_required')throw Error('auth_required');if(r.error||r.data?.error)throw Error(r.data?.error||'backend_error');return r.data;}
  function valid(s){return s?.environment==='STRIPE_TEST' && Object.hasOwn(messages,s.state) && typeof s.accessActive==='boolean' && ['canCheckout','portalAvailable','cancelAtPeriodEnd'].every(k=>typeof s[k]==='boolean') && s.currency==='eur' && s.aiQuotaChanged===false
   && (s.accessActive ? ['basic','premium'].includes(s.plan) && s.monthlyCents===(s.plan==='basic'?499:1299) && typeof s.paidUntil==='string' && Date.parse(s.paidUntil)>Date.now() : s.plan===null && s.monthlyCents===null)
   && (!s.canCheckout || !s.accessActive && ['none','expired'].includes(s.state))
   && (!['active','scheduled_cancel'].includes(s.state) || s.accessActive);}
  function error(e,mutating=false,readFailure=false){
   if(e.message==='auth_required'){status=null;capabilities=null;owner=null;notice.textContent='';content.replaceChildren(node('h3','Inicia sesión para ver tu suscripción'),node('p','Usa la misma cuenta con la que realizaste la compra.'));actions.replaceChildren();onAuthNeeded();return;}
   if(mutating)uncertain=true;
   if(readFailure){status=null;capabilities=null;}
   notice.textContent=mutating?'No pudimos confirmar el resultado. Comprueba el estado antes de volver a intentarlo.':e.message==='billing_test_user_not_enabled'?'Esta cuenta no está autorizada para la prueba.':'No se pudo comprobar la suscripción. Revisa tu conexión y vuelve a actualizar.';
   notice.setAttribute('role','alert');
   if(!status){content.replaceChildren(node('h3','No se pudo cargar tu suscripción'));actions.replaceChildren();button('Actualizar estado',()=>refresh());}
   else render();
  }
  async function refresh(){
   if(disposed||busy)return;const ticket=++generation;loading(true);notice.textContent='Consultando tu suscripción…';
   try{const who=await verifiedUser();if(ticket!==generation)return;if(owner!==who){owner=who;status=null;capabilities=null;content.replaceChildren();actions.replaceChildren();}
    const s=await request('status');if(ticket!==generation||disposed)return;
    if(await verifiedUser()!==who)throw Error('auth_required');if(ticket!==generation)return;
    if(!valid(s))throw Error('invalid_status');status=s;
    try{const cap=await db.rpc('billing_test_capabilities',{});capabilities=cap.error?null:cap.data;}catch{capabilities=null;}
    if(ticket!==generation||disposed)return;notice.textContent='';notice.setAttribute('role','status');render();
   }catch(e){if(ticket===generation&&!disposed)error(e,false,true);}finally{if(ticket===generation&&!disposed)loading(false);}
  }
  async function run(action,body={}){
   if(disposed||busy||!owner)return;const ticket=++generation,who=owner;loading(true);notice.textContent=action==='reconcile'?'Comprobando el pago…':'Preparando acceso seguro…';
   try{
    if(await verifiedUser()!==who)throw Error('auth_required');if(ticket!==generation||disposed)return;
    const response=await request(action,body);if(ticket!==generation||disposed)return;
    if(await verifiedUser()!==who)throw Error('auth_required');if(ticket!==generation||disposed)return;
    if(action==='reconcile'){uncertain=false;loading(false);await refresh();return;}
    const target=new URL(response?.url);const expected=action==='portal'?'https://billing.stripe.com':'https://checkout.stripe.com';
    if(target.origin!==expected || target.username || target.password)throw Error('invalid_redirect');
    navigate(target.href); // Never retain or cache a sensitive Portal URL.
   }catch(e){if(ticket===generation&&!disposed)error(e,action==='checkout');}finally{if(ticket===generation&&!disposed)loading(false);}
  }
  const auth=db.auth.onAuthStateChange?.(()=>{if(disposed)return;generation++;status=null;capabilities=null;owner=null;busy=false;content.replaceChildren();actions.replaceChildren();queueMicrotask(()=>refresh());});
  refresh();return {refresh,destroy(){disposed=true;generation++;auth?.data?.subscription?.unsubscribe();root.replaceChildren();}};
 }
 w.SimpleSubscription=Object.freeze({mount});
})(window);
