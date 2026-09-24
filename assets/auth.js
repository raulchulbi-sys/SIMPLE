/* SIMPLE onboarding. Roles are read from profiles, never authorized by metadata. */
const simpleAuth={screen:'boot',busy:false,epoch:0,role:null,failed:false,recovery:SIMPLE_AUTH_CALLBACK.recovery,callbackError:SIMPLE_AUTH_CALLBACK.error,startedAt:performance.now()};
// No social provider is configured in production (verified 2026-09-23).
// Do not enable a provider until its external config and complete redirect flow are tested.
const SIMPLE_AUTH_LINKS=Object.freeze({terms:null,privacy:null});

function msg(text,ok=false){const el=$('authMsg');el.textContent=text;el.className='auth-message'+(ok?' ok':'');}
function setAuthScreen(screen,focus=true){
  simpleAuth.screen=screen;
  $('auth').dataset.screen=screen;
  $('auth').style.display='flex';
  $('app').style.display='none';
  const panels={welcome:'authWelcome',role:'authRoles',complete:'authRoles',login:'authCredentials',signup:'authCredentials',confirmation:'authConfirmation',error:'authProblem'};
  ['authWelcome','authRoles','authCredentials','authConfirmation','authProblem'].forEach(id=>$(id).hidden=id!==panels[screen]);
  $('authLoading').hidden=!['boot','loading'].includes(screen);
  $('authLegal').hidden=!['welcome','signup'].includes(screen);
  $('authRoleTitle').textContent=screen==='complete'?'Completar registro':'¿Cómo vas a usar SIMPLE?';
  if(screen==='login'||screen==='signup'){
    mode=screen;
    $('authText').textContent=screen==='signup'?'Crear cuenta':'Iniciar sesión';
    $('authBtn').textContent=screen==='signup'?'Crear cuenta':'Iniciar sesión';
    $('authSelectedRole').hidden=screen!=='signup';
    $('authSelectedRoleText').textContent=simpleAuth.role==='trainer'?'Entrenador':'Atleta';
    $('authSwitchPrompt').textContent=screen==='signup'?'¿Ya tienes una cuenta?':'¿Todavía no te has registrado?';
    $('authSwitch').textContent=screen==='signup'?'Inicia sesión':'Crea tu cuenta';
    $('password').autocomplete=screen==='signup'?'new-password':'current-password';
    $('email').autocomplete=screen==='signup'?'email':'username';
    if(screen==='signup')$('password').setAttribute('minlength','6');else $('password').removeAttribute('minlength');
    $('forgotBtn').hidden=screen!=='login'||!simpleAuth.failed;
  }
  if(focus){const heading=$(panels[screen])?.querySelector('h1');heading?.focus({preventScroll:true});}
  renderOAuthButtons();
}
function authNavigate(screen){
  if(simpleAuth.busy)return;
  if(user&&!profile&&['login','welcome'].includes(screen)){authLogout();return;}
  simpleAuth.epoch++;
  simpleAuth.failed=false;
  if(screen==='role'||screen==='welcome')simpleAuth.role=null;
  $('password').value='';resetPasswordVisibility();msg('');
  setAuthScreen(screen);
}
function setAuthBusy(busy){
  simpleAuth.busy=busy;
  $('auth').setAttribute('aria-busy',String(busy));
  $('auth').querySelectorAll('button,input').forEach(el=>el.disabled=busy);
  renderOAuthButtons();
}
function chooseRegistrationRole(role){
  if(simpleAuth.busy||!['client','trainer'].includes(role))return;
  simpleAuth.role=role;
  if(simpleAuth.screen==='complete'){completeRegistration(role);return;}
  msg('');setAuthScreen('signup');
}
function selectRole(role){chooseRegistrationRole(role);}
function getPendingRole(){
  // Email signup metadata records an initial public role selection only.
  // Existing profiles always win; foreign-provider metadata and unbound local
  // storage never select roles. Both public signup roles remain server-validated.
  const provider=user?.app_metadata?.provider;
  const role=user?.user_metadata?.simple_role;
  return provider==='email'&&['client','trainer'].includes(role)?role:null;
}
async function ensureProfile(chosenRole=null){
  const ownerId=user?.id;
  if(!ownerId)throw new Error('AUTH_NO_USER');
  const p=await db.from('profiles').select('id,name,role').eq('id',ownerId).maybeSingle();
  if(p.error)throw p.error;
  if(user?.id!==ownerId)throw new Error('AUTH_STALE');
  if(p.data)return p.data; // No update/upsert; a stale choice cannot overwrite a role.
  if(!['client','trainer'].includes(chosenRole))return null;
  const name=user.user_metadata?.name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Usuario';
  const q=await db.from('profiles').insert({id:ownerId,name,role:chosenRole}).select('id,name,role').single();
  if(q.error?.code==='23505'){
    const retry=await db.from('profiles').select('id,name,role').eq('id',ownerId).maybeSingle();
    if(retry.error)throw retry.error;
    return retry.data;
  }
  if(q.error)throw q.error;
  return q.data;
}
async function finishConfirmedSignup(){return ensureProfile(getPendingRole());}
async function getProfileStable(){
  const current=await db.auth.getUser();
  if(current.error||!current.data?.user)throw new Error('AUTH_NO_USER');
  if(user?.id!==current.data.user.id)throw new Error('AUTH_STALE');
  const p=await db.from('profiles').select('id,name,role').eq('id',current.data.user.id).maybeSingle();
  if(p.error)throw p.error;
  if(!p.data||!['client','trainer'].includes(p.data.role))throw new Error('AUTH_PROFILE');
  return p.data;
}
async function start(){
  if(!user||window.__simpleStartBusy)return false;
  const epoch=simpleAuth.epoch,ownerId=user.id;
  window.__simpleStartBusy=true;
  try{
    const currentProfile=await getProfileStable();
    if(epoch!==simpleAuth.epoch||user?.id!==ownerId)return false;
    profile=currentProfile;
    $('mail').textContent=user.email||'';
    $('role').textContent=profile.role==='trainer'?'Entrenador':'Cliente';
    document.querySelector('header .actions .btn').style.display=profile.role==='trainer'?'inline-flex':'none';
    renderTabs();
    await reload();
    if(epoch!==simpleAuth.epoch||user?.id!==ownerId)return false;
    view(profile.role==='trainer'?'clients':'shared');
    $('auth').style.display='none';$('app').style.display='block';
    window.__simpleStarted=true;
    return true;
  }finally{window.__simpleStartBusy=false;}
}
function isRecoveryLocation(){
  return new URLSearchParams(location.search).get('reset')==='1'||new URLSearchParams(location.hash.slice(1)).get('type')==='recovery';
}
async function prepareAuthenticatedUser(chosenRole=null){
  const epoch=simpleAuth.epoch;
  const checked=await db.auth.getUser();
  if(epoch!==simpleAuth.epoch)return false;
  if(checked.error||!checked.data?.user)throw new Error('AUTH_NO_USER');
  user=checked.data.user;
  if(simpleAuth.recovery||isRecoveryLocation()){openPasswordReset();return true;}
  profile=await ensureProfile(chosenRole||getPendingRole());
  if(epoch!==simpleAuth.epoch)return false;
  if(!profile){setAuthScreen('complete');return false;}
  if(!['client','trainer'].includes(profile.role))throw new Error('AUTH_PROFILE');
  try{localStorage.removeItem('simple_pending_role');}catch(_){}
  return start();
}
async function completeRegistration(role){
  if(simpleAuth.busy)return;
  setAuthBusy(true);msg('');
  try{await prepareAuthenticatedUser(role);}
  catch(e){console.error('Complete registration:',e?.code||e?.message);msg('No se pudo completar el registro. Inténtalo de nuevo.');}
  finally{setAuthBusy(false);}
}
function resetPasswordVisibility(){
  const input=$('password'),button=$('passwordToggle');
  input.type='password';button.setAttribute('aria-pressed','false');button.setAttribute('aria-label','Mostrar contraseña');
  button.innerHTML='<svg class="password-eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10 5h2c6 0 10 7 10 7a21 21 0 0 1-3 4M6 6C3 8 2 12 2 12s4 7 10 7a13 13 0 0 0 5-1"/></svg>';
}
function toggleLoginPassword(){
  const visible=$('password').type==='password';$('password').type=visible?'text':'password';
  $('passwordToggle').setAttribute('aria-pressed',String(visible));$('passwordToggle').setAttribute('aria-label',visible?'Ocultar contraseña':'Mostrar contraseña');
  $('passwordToggle').innerHTML=visible?'<svg class="password-eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>':'<svg class="password-eye-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10 5h2c6 0 10 7 10 7a21 21 0 0 1-3 4M6 6C3 8 2 12 2 12s4 7 10 7a13 13 0 0 0 5-1"/></svg>';
}
async function authSubmit(event){
  event?.preventDefault();
  if(simpleAuth.busy||!['login','signup'].includes(simpleAuth.screen))return;
  const email=$('email').value.trim(),password=$('password').value,submittingMode=mode,role=simpleAuth.role;
  if(!$('authForm').reportValidity())return;
  if(submittingMode==='signup'&&!['client','trainer'].includes(role)){setAuthScreen('role');return;}
  const epoch=++simpleAuth.epoch;
  setAuthBusy(true);msg('');$('authBtn').textContent='Conectando…';
  try{
    const r=submittingMode==='login'?await db.auth.signInWithPassword({email,password}):await db.auth.signUp({email,password,options:{emailRedirectTo:APP_URL,data:{simple_role:role,name:email.split('@')[0]}}});
    if(epoch!==simpleAuth.epoch)return;
    if(r.error){
      if(submittingMode==='signup'&&r.error.code==='user_already_exists'){setAuthScreen('confirmation');return;}
      if(submittingMode==='login'){simpleAuth.failed=true;$('forgotBtn').hidden=false;msg('No se ha podido iniciar sesión. Revisa el correo y la contraseña e inténtalo de nuevo.');}
      else msg('No se ha podido completar el registro. Revisa los datos e inténtalo de nuevo.');
      return;
    }
    $('password').value='';resetPasswordVisibility();
    if(submittingMode==='signup'&&!r.data?.session){setAuthScreen('confirmation');return;}
    setAuthScreen('loading',false);
    await prepareAuthenticatedUser(submittingMode==='signup'?role:null);
  }catch(e){
    console.error('Auth submit:',e?.code||e?.message);
    if(epoch!==simpleAuth.epoch)return;
    if(simpleAuth.screen==='loading'){setAuthScreen('error');msg('No se pudo abrir tu cuenta. Puedes volver a intentarlo.');}
    else{if(submittingMode==='login'){simpleAuth.failed=true;$('forgotBtn').hidden=false;}msg('No se ha podido conectar. Comprueba tu conexión e inténtalo de nuevo.');}
  }finally{
    setAuthBusy(false);
    $('authBtn').textContent=mode==='signup'?'Crear cuenta':'Iniciar sesión';
  }
}
async function requestPasswordReset(){
  if(simpleAuth.busy||!simpleAuth.failed||simpleAuth.screen!=='login')return;
  if(!$('email').reportValidity())return;
  const email=$('email').value.trim();setAuthBusy(true);msg('');
  try{
    const result=await db.auth.resetPasswordForEmail(email,{redirectTo:APP_URL+'?reset=1'});
    if(result.error&&[429,500,502,503].includes(result.error.status))throw result.error;
    msg('Si existe una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña.',true);
  }catch(_){msg('No se pudo enviar la solicitud. Inténtalo de nuevo más tarde.');}
  finally{setAuthBusy(false);}
}
function setResetMsg(text,ok=false){const el=$('resetMsg');el.textContent=text;el.className='msg '+(ok?'ok':'error');el.setAttribute('role','status');}
function openPasswordReset(){
  simpleAuth.recovery=true;setAuthScreen('recovery',false);$('newPassword').value='';$('newPassword2').value='';setResetMsg('');openM('resetModal');
  try{history.replaceState({},document.title,location.origin+location.pathname);}catch(_){}
  $('newPassword').focus({preventScroll:true});
}
async function updatePassword(){
  if(!simpleAuth.recovery||simpleAuth.busy)return;
  const p1=$('newPassword').value,p2=$('newPassword2').value,btn=$('resetPasswordBtn');
  if(p1.length<6){setResetMsg('La contraseña debe tener al menos 6 caracteres.');return;}
  if(p1!==p2){setResetMsg('Las contraseñas no coinciden.');return;}
  const epoch=simpleAuth.epoch,ownerId=user?.id;
  setAuthBusy(true);btn.disabled=true;btn.textContent='Guardando…';
  try{
    const check=await db.auth.getUser();
    if(epoch!==simpleAuth.epoch||user?.id!==ownerId)return;
    if(check.error||!check.data?.user||check.data.user.id!==ownerId)throw new Error('AUTH_NO_USER');
    const r=await db.auth.updateUser({password:p1});if(r.error)throw r.error;
    if(epoch!==simpleAuth.epoch||user?.id!==ownerId)return;
    const out=await db.auth.signOut();if(out.error)throw out.error;
    resetAuthSession();setAuthScreen('login');msg('Contraseña actualizada. Ya puedes iniciar sesión.',true);
  }catch(_){setResetMsg('No se pudo cambiar la contraseña. Solicita un nuevo enlace o inténtalo más tarde.');}
  finally{setAuthBusy(false);btn.disabled=false;btn.textContent='Cambiar contraseña';}
}
function resetAuthSession(){
  simpleAuth.epoch++;simpleAuth.role=null;simpleAuth.recovery=false;simpleAuth.callbackError=false;simpleAuth.failed=false;
  window.__workoutContextVersion=(window.__workoutContextVersion||0)+1;
  window.__simpleStarted=false;window.__simpleStartBusy=false;
  document.querySelectorAll('.modal.show').forEach(el=>closeM(el.id));
  user=null;profile=null;routines=[];assignments=[];activeWorkout=null;workoutRoutine=null;
  ['mine','shared','clients','new','trash','tabs'].forEach(id=>{if($(id))$(id).innerHTML='';});
  $('password').value='';$('email').value='';resetPasswordVisibility();msg('');
  $('newPassword').value='';$('newPassword2').value='';
  setAuthScreen('welcome',false);
}
async function authLogout(){
  if(simpleAuth.busy)return;
  // Invalidate pending workout reads/writes before awaiting network sign-out.
  window.__workoutContextVersion=(window.__workoutContextVersion||0)+1;
  if(typeof activeWorkout!=='undefined'&&activeWorkout&&!activeWorkout.locked){try{saveWorkoutDraft();}catch(_){} }
  simpleAuth.epoch++;setAuthBusy(true);
  try{const r=await db.auth.signOut();if(r.error)throw r.error;resetAuthSession();}
  catch(_){if($('app').style.display!=='none')toast('No se pudo cerrar la sesión. Inténtalo de nuevo.');else msg('No se pudo cerrar la sesión. Inténtalo de nuevo.');}
  finally{setAuthBusy(false);}
}
async function bootstrapAuthSession(){
  if(simpleAuth.busy||window.__simpleStarted)return false;
  const epoch=++simpleAuth.epoch;setAuthBusy(true);
  if(simpleAuth.screen!=='boot')setAuthScreen('loading',false);
  try{
    const result=await db.auth.getSession();
    if(epoch!==simpleAuth.epoch)return false;
    // An expired callback must not become a reset form merely because another
    // valid session already exists in this browser.
    if(simpleAuth.callbackError){
      simpleAuth.callbackError=false;simpleAuth.recovery=false;
      setAuthScreen('login');msg('El enlace no es válido o ha caducado. Inicia sesión o solicita un nuevo enlace.');
      history.replaceState({},document.title,location.origin+location.pathname);
      return false;
    }
    if(result.error)throw result.error;
    if(result.data?.session?.user){setAuthScreen('loading',false);await prepareAuthenticatedUser();return true;}
    setAuthScreen('welcome',false);
    const hash=new URLSearchParams(location.hash.slice(1)),query=new URLSearchParams(location.search);
    if(SIMPLE_AUTH_CALLBACK.access||hash.has('error')||query.has('error')||query.has('code')||isRecoveryLocation()){
      simpleAuth.recovery=false;
      setAuthScreen('login');msg('No se pudo completar el acceso con ese enlace. Inténtalo de nuevo.');
      history.replaceState({},document.title,location.origin+location.pathname);
    }
    return false;
  }catch(e){if(epoch!==simpleAuth.epoch)return false;console.error('Session bootstrap:',e?.code||e?.message);setAuthScreen('error');msg('No se pudo comprobar tu sesión. Comprueba tu conexión y vuelve a intentarlo.');return false;}
  finally{setAuthBusy(false);}
}
async function handleAuthStateChange(event,session){
  if(event==='SIGNED_OUT'){resetAuthSession();return;}
  if(!session?.user||simpleAuth.busy)return;
  if(!['SIGNED_IN','INITIAL_SESSION','PASSWORD_RECOVERY'].includes(event))return;
  // SDK events can be queued before sign-out and delivered after it. Check
  // current SDK storage before applying the event's session or recovery flag.
  const observedEpoch=simpleAuth.epoch;
  const current=await db.auth.getSession();
  if(observedEpoch!==simpleAuth.epoch||current.error||!current.data?.session||current.data.session.access_token!==session.access_token)return;
  if(event==='PASSWORD_RECOVERY')simpleAuth.recovery=true;
  if(window.__simpleStarted&&user?.id===session.user.id&&!simpleAuth.recovery)return;
  const epoch=++simpleAuth.epoch;setAuthBusy(true);setAuthScreen('loading',false);
  try{await prepareAuthenticatedUser();}
  catch(_){if(epoch===simpleAuth.epoch){setAuthScreen('error');msg('No se pudo abrir tu cuenta. Vuelve a intentarlo.');}}
  finally{setAuthBusy(false);}
}
$('authForm').addEventListener('submit',authSubmit);
$('forgotBtn').addEventListener('click',requestPasswordReset);
$('authSwitch').addEventListener('click',()=>authNavigate(mode==='signup'?'login':'role'));
for(const [id,url] of [['authTerms',SIMPLE_AUTH_LINKS.terms],['authPrivacy',SIMPLE_AUTH_LINKS.privacy]]){
  if(url){const a=document.createElement('a');a.href=url;a.textContent=$(id).textContent;a.target='_blank';a.rel='noopener';$(id).replaceWith(a);}
}
try{localStorage.removeItem('simple_pending_role');}catch(_){}
resetPasswordVisibility();
db.auth.onAuthStateChange((event,session)=>{
  // Bootstrap owns an invalid callback. A late initial SDK snapshot must not
  // replace its expired-link message with the browser's previously stored session.
  if(event==='INITIAL_SESSION'&&SIMPLE_AUTH_CALLBACK.error)return;
  // Never await a Supabase call inside the SDK's synchronous auth callback.
  // Clear synchronously so a queued SIGNED_OUT cannot erase the success screen
  // shown by updatePassword after signOut has resolved.
  if(event==='SIGNED_OUT'){resetAuthSession();return;}
  const epoch=simpleAuth.epoch;
  setTimeout(()=>{if(epoch===simpleAuth.epoch)handleAuthStateChange(event,session);},0);
});
bootstrapAuthSession();
loadOAuthAvailability();
