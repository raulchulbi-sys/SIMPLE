import { accessMessage } from './billing-return-model.mjs';
const origin='https://simple-staging-raulchulbi.pages.dev';
if(location.origin!==origin)throw Error('staging_only');
// Remove all return parameters/fragments; none can establish identity or payment.
history.replaceState(null,'',location.pathname);
const db=window.supabase.createClient('https://dmqjexigdnfzobarhnib.supabase.co',
  'sb_publishable_GAqOb1_W3qiK8ka6EL1G7g_TutTPIVf',
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const el=id=>document.getElementById(id);
let busy=false;
async function task(work){
  if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);
  el('status').textContent='Consultando…';
  try{await work();}catch(e){
    el('state').textContent='Estado sin confirmar';el('detail').textContent='';
    el('status').textContent=e.message||'No se pudo consultar el estado. No repitas la compra.';
  }finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
}
async function refresh(){
  // Validate this in-memory session with Auth; the Edge also verifies the JWT.
  const user=await db.auth.getUser();
  if(user.error||!user.data?.user){
    el('account').hidden=true;el('login').hidden=false;
    throw Error('Inicia sesión de nuevo para consultar tu cuenta.');
  }
  const {data,error}=await db.functions.invoke('billing-test',{body:{action:'access'}});
  if(error||data?.error)throw Error('No se pudo confirmar el estado. Actualiza antes de repetir cualquier operación.');
  const message=accessMessage(data);
  el('state').textContent=message.title;el('detail').textContent=message.detail;
  el('status').textContent='Estado consultado en tu cuenta de pruebas.';
}
el('login').addEventListener('submit',event=>{event.preventDefault();task(async()=>{
  const email=el('email').value,password=el('password').value;el('password').value='';
  const result=await db.auth.signInWithPassword({email,password});
  if(result.error)throw Error('No se pudo iniciar sesión con esa cuenta de pruebas.');
  el('login').hidden=true;el('account').hidden=false;await refresh();
});});
el('refresh').addEventListener('click',()=>task(refresh));
el('logout').addEventListener('click',()=>task(async()=>{
  const result=await db.auth.signOut({scope:'local'});
  if(result.error)throw Error('No se pudo cerrar la sesión. Cierra esta pestaña.');
  el('account').hidden=true;el('login').hidden=false;el('email').value='';el('password').value='';
  el('state').textContent='';el('detail').textContent='';el('status').textContent='Sesión cerrada.';
}));
