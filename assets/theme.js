/* Runs synchronously before styles/SDK: no incorrect-theme first paint. */
(()=>{
  const key='simple_theme_v1',media=matchMedia('(prefers-color-scheme: dark)'),valid=v=>['system','light','dark'].includes(v);
  let choice='system';try{const saved=localStorage.getItem(key);if(valid(saved))choice=saved;}catch(_){}
  const apply=()=>{const resolved=choice==='system'?(media.matches?'dark':'light'):choice;document.documentElement.dataset.theme=resolved;document.documentElement.dataset.themeChoice=choice;document.documentElement.style.colorScheme=resolved;window.dispatchEvent(new CustomEvent('simple-theme-change',{detail:{choice,resolved}}));};
  window.simpleTheme=Object.freeze({get choice(){return choice;},set(value){if(!valid(value))return;choice=value;try{localStorage.setItem(key,choice);}catch(_){}apply();}});
  media.addEventListener('change',()=>{if(choice==='system')apply();});
  window.addEventListener('storage',event=>{if(event.key===key){choice=valid(event.newValue)?event.newValue:'system';apply();}});
  apply();
})();
