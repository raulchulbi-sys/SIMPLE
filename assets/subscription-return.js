(()=>{'use strict';
 const root=document.getElementById('subscriptionReturn'),form=document.getElementById('subscriptionLogin'),notice=document.getElementById('subscriptionLoginError');
 const config=window.SimpleAppRuntime;
 if(config?.billingTest!==true || config.supabaseUrl!=='https://dmqjexigdnfzobarhnib.supabase.co' || !window.supabase || !window.SimpleSubscription){root.textContent='Esta página todavía no está disponible. Vuelve a SIMPLE para consultar tu cuenta.';return;}
 // No token/plan/customer/session is accepted from the return URL; auth is checked with getUser.
 history.replaceState(null,'',location.pathname);
 const client=window.supabase.createClient(config.supabaseUrl,config.supabasePublicKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 const view=SimpleSubscription.mount(root,{db:client,onAuthNeeded:()=>{form.hidden=false;}});
 form.onsubmit=async e=>{e.preventDefault();if(form.dataset.busy)return;form.dataset.busy='true';const b=form.querySelector('button');b.disabled=true;notice.textContent='';
  try{const r=await client.auth.signInWithPassword({email:form.elements.email.value.trim(),password:form.elements.password.value});if(r.error)throw Error('login');
   form.reset();form.hidden=true;await view.refresh();
  }catch{notice.textContent='No se pudo iniciar sesión. Comprueba tus datos y vuelve a intentarlo.';}finally{delete form.dataset.busy;b.disabled=false;}
 };
 addEventListener('pagehide',()=>view.destroy(),{once:true});
})();
