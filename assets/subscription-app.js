(()=>{'use strict';
 if(window.SimpleAppRuntime?.billingTest!==true || SUPABASE_URL!=='https://dmqjexigdnfzobarhnib.supabase.co')return;
 if(typeof SimpleSubscription==='undefined')return;
 const settings=document.getElementById('settingsDialog');if(!settings || !settings.querySelector('[data-settings-logout]'))return;
 const open=document.createElement('button');open.type='button';open.className='btn';open.textContent='Mi suscripción';open.dataset.subscriptionOpen='';open.hidden=true;
 settings.querySelector('[data-settings-logout]').before(open);let view=null;
 const dialog=document.createElement('dialog');dialog.className='subscription-dialog';dialog.setAttribute('aria-label','Mi suscripción');
 const close=document.createElement('button');close.type='button';close.className='subscription-back';close.textContent='Cerrar';close.onclick=()=>dialog.close();const host=document.createElement('div');dialog.append(close,host);document.body.append(dialog);
 open.onclick=()=>{if(!user || profile?.role!=='client')return;settings.close();dialog.showModal();view?.destroy();view=SimpleSubscription.mount(host,{db,onAuthNeeded:()=>dialog.close(),onCoach:()=>{dialog.close();openSimpleCoach();}});};
 dialog.addEventListener('close',()=>{view?.destroy();view=null;document.querySelector('#app .settings-trigger')?.focus();});
 // Profiles are resolved by the application's existing authenticated flow.
 // Keep the client-only action out of trainer settings, including account switches.
 const sync=()=>{open.hidden=!user||profile?.role!=='client';if((open.hidden||document.getElementById('app')?.style.display==='none')&&dialog.open)dialog.close();};
 new MutationObserver(sync).observe(settings,{attributes:true,attributeFilter:['open']});
 const app=document.getElementById('app');if(app)new MutationObserver(sync).observe(app,{attributes:true,attributeFilter:['style']});
 sync();
})();
