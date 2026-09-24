/* Settings are local UI only. Existing auth, profiles and logout stay authoritative. */
(()=>{
 const dialog=document.getElementById('settingsDialog');
 const gear='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.4 3-.5 2a8 8 0 0 0-1.7 1L5.2 5.5 3 9.3l1.5 1.4a8 8 0 0 0 0 2.6L3 14.7l2.2 3.8 2-.5a8 8 0 0 0 1.7 1l.5 2h5.2l.5-2a8 8 0 0 0 1.7-1l2 .5 2.2-3.8-1.5-1.4a8 8 0 0 0 0-2.6L21 9.3l-2.2-3.8-2 .5a8 8 0 0 0-1.7-1l-.5-2Z"/><circle cx="12" cy="12" r="3"/></svg>';
 const sync=()=>dialog.querySelectorAll('[name="simpleTheme"]').forEach(input=>input.checked=input.value===simpleTheme.choice);
 let opener=null;
 function open(event){if(!user||!profile)return;opener=event?.currentTarget||document.activeElement;document.getElementById('settingsEmail').textContent=user.email||'—';document.getElementById('settingsRole').textContent=profile.role==='trainer'?'Entrenador':'Atleta';sync();if(!dialog.open)dialog.showModal();}
 function trigger(){const button=document.createElement('button');button.type='button';button.className='btn settings-trigger';button.setAttribute('aria-label','Ajustes');button.setAttribute('aria-haspopup','dialog');button.innerHTML=gear;button.addEventListener('click',open);return button;}
 document.querySelector('#app header .actions').append(trigger());
 // Modal headers get the same small entry point so theme changes never require leaving an edit/workout.
 for(const id of ['editModal','trainModal','clientModal','clientProgressModal','viewModal','routineNoteModal']){
  const header=document.querySelector('#'+id+' .sheet>div:first-child');if(!header)continue;header.classList.add('settings-has-access');
  const slot=document.createElement('span');slot.className='settings-modal-access';slot.append(trigger());header.append(slot);
 }
 dialog.querySelector('[data-settings-close]').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{if(opener?.isConnected&&document.getElementById('app').style.display!=='none')opener.focus({preventScroll:true});});
 dialog.querySelectorAll('[name="simpleTheme"]').forEach(input=>input.addEventListener('change',()=>{simpleTheme.set(input.value);input.focus({preventScroll:true});}));
 dialog.addEventListener('keydown',event=>{
  if(event.key!=='Tab')return;
  const controls=[...dialog.querySelectorAll('button,input,a[href]')].filter(el=>!el.disabled&&el.getClientRects().length&&(el.type!=='radio'||el.checked));
  const first=controls[0],last=controls[controls.length-1];
  if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
  else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 });
 dialog.querySelector('[data-settings-logout]').addEventListener('click',()=>{dialog.close();logout();});
 window.addEventListener('simple-theme-change',sync);
 // Close local read-only details if another tab signs out; never interfere with auth or workout state.
 new MutationObserver(()=>{if(document.getElementById('app').style.display==='none'&&dialog.open)dialog.close();}).observe(document.getElementById('app'),{attributes:true,attributeFilter:['style']});
 for(const [name,url] of Object.entries(SIMPLE_AUTH_LINKS)){const el=dialog.querySelector('[data-legal="'+name+'"]');if(url&&el){const a=document.createElement('a');a.href=url;a.textContent=el.textContent;a.target='_blank';a.rel='noopener';el.replaceWith(a);}}
 if(SIMPLE_AUTH_LINKS.terms&&SIMPLE_AUTH_LINKS.privacy)dialog.querySelector('.settings-legal-note').hidden=true;
 const toast=document.getElementById('toast');
 function presentToast(){const text=toast.textContent||'';
  const error=/no se (?:pud|ha |han )|error|fall[oó]|no encontr|no tiene|no existe|sin permiso|revisa los permisos|cambi[oó] en otra|no es v[aá]lid|no devolvi[oó]/i.test(text);
  const success=!error&&/guardad|cread[ao]|restaurad|eliminad|movid[ao]|a[nñ]adid|recuperad|renombrad|revocad|copiad|actualizad|vinculad/.test(text.toLowerCase());
  toast.dataset.tone=error?'error':success?'success':'info';toast.setAttribute('aria-live',error?'assertive':'polite');toast.setAttribute('aria-atomic','true');
 }
 new MutationObserver(presentToast).observe(toast,{childList:true,subtree:true,characterData:true});
 presentToast();
})();
