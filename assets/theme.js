/* Runs synchronously before styles/SDK: no incorrect-theme first paint. */
(()=>{
  const key='simple_theme_v1',valid=v=>['light','dark'].includes(v);
  const normalize=value=>valid(value)?value:'light';
  const migrate=value=>{if(value==='system')try{localStorage.setItem(key,'light');}catch(_){}};
  let choice='light';try{const saved=localStorage.getItem(key);choice=normalize(saved);migrate(saved);}catch(_){}
  const apply=()=>{document.documentElement.dataset.theme=choice;document.documentElement.dataset.themeChoice=choice;document.documentElement.style.colorScheme=choice;let meta=document.querySelector('meta[name="theme-color"]');if(!meta){meta=document.createElement('meta');meta.name='theme-color';document.head.append(meta);}meta.content=choice==='dark'?'#202423':'#f7f5f1';window.dispatchEvent(new CustomEvent('simple-theme-change',{detail:{choice,resolved:choice}}));};
  window.simpleTheme=Object.freeze({get choice(){return choice;},set(value){if(!valid(value))return;choice=value;try{localStorage.setItem(key,choice);}catch(_){}apply();}});
  window.addEventListener('storage',event=>{if(event.key===key||event.key===null){choice=normalize(event.newValue);migrate(event.newValue);apply();}});
  window.addEventListener('pageshow',apply);
  apply();
})();
