/* Provider release gate. Turn a flag on only after the real provider flow has
   been configured and verified in that environment. No credentials live here. */
const SIMPLE_OAUTH_VERIFIED=Object.freeze({google:false,apple:false,facebook:false});
const simpleOAuth={available:new Set(),loading:null};
const oauthNames=Object.freeze({google:'Google',apple:'Apple',facebook:'Facebook'});

async function loadOAuthAvailability(){
  if(!Object.values(SIMPLE_OAUTH_VERIFIED).some(Boolean))return;
  if(simpleOAuth.loading)return simpleOAuth.loading;
  simpleOAuth.loading=(async()=>{
    try{
      const response=await fetch(SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:SUPABASE_KEY}});
      if(!response.ok)throw new Error('OAUTH_SETTINGS');
      const settings=await response.json();
      simpleOAuth.available=new Set(Object.keys(oauthNames).filter(p=>SIMPLE_OAUTH_VERIFIED[p]&&settings.external?.[p]===true));
    }catch(_){simpleOAuth.available.clear();}
    renderOAuthButtons();
  })();
  return simpleOAuth.loading;
}
function renderOAuthButtons(preview=false){
  let group=document.getElementById('authOAuth');
  const providers=preview?Object.keys(oauthNames):[...simpleOAuth.available];
  if(!group&&!providers.length)return;
  if(!group){
    group=document.createElement('div');group.id='authOAuth';group.className='auth-oauth';
    document.querySelector('#authCredentials .auth-footnote').before(group);
  }
  group.hidden=!['login','signup'].includes(simpleAuth.screen)||!providers.length;
  group.replaceChildren();
  for(const provider of providers){
    const button=document.createElement('button');button.type='button';button.className='auth-oauth-button';
    button.textContent='Continuar con '+oauthNames[provider];
    button.disabled=preview||simpleAuth.busy||!simpleOAuth.available.has(provider);
    button.addEventListener('click',()=>beginOAuth(provider));group.append(button);
  }
  if(preview){const note=document.createElement('p');note.textContent='Vista previa · proveedores sin configurar. Estos botones no inician sesión.';note.className='auth-oauth-note';group.append(note);}
}
async function beginOAuth(provider){
  if(simpleAuth.busy||!['login','signup'].includes(simpleAuth.screen))return;
  if(!SIMPLE_OAUTH_VERIFIED[provider]||!simpleOAuth.available.has(provider)){
    msg('Este método de acceso todavía no está disponible. Puedes usar tu correo electrónico.');return;
  }
  if(simpleAuth.screen==='signup'&&!['client','trainer'].includes(simpleAuth.role)){setAuthScreen('role');return;}
  const epoch=++simpleAuth.epoch;setAuthBusy(true);msg('');
  try{
    // Supabase owns OAuth state, tokens and account linking. No profile is
    // created here. On return, existing profiles win; new users confirm a role
    // in the existing "Completar registro" screen before any profile insert.
    const result=await db.auth.signInWithOAuth({provider,options:{redirectTo:APP_URL}});
    if(epoch!==simpleAuth.epoch)return;
    if(result.error||!result.data?.url)throw new Error('OAUTH_START');
  }catch(_){if(epoch===simpleAuth.epoch)msg('No se pudo abrir '+oauthNames[provider]+'. Inténtalo de nuevo o usa tu correo electrónico.');}
  finally{if(epoch===simpleAuth.epoch)setAuthBusy(false);}
}
// Returning with the browser Back button must not retain disabled controls.
window.addEventListener('pageshow',event=>{if(event.persisted&&typeof simpleAuth!=='undefined')setAuthBusy(false);});
