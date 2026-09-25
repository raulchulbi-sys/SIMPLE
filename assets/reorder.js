/* Compact reorder modes share one pointer interaction; existing order-only RPCs persist moves. */
(()=>{
  let routineMode=false,openMode=false,selected={},drag=null,scrollFrame=0,scheduled=false;
  const definitions={
    routine:{root:'#mine',row:'.routine-sortable',handle:'.routine-drag-handle',mode:()=>routineMode,rows:()=>routines,index:r=>Number(r.dataset.routineIndex),save:(from,to)=>reorderRoutine(from,to)},
    day:{root:'#clientSessionList',row:'.routine-editor-day',handle:'.editor-drag-handle',mode:()=>!!window.__clientRoutineEdit?.reorder,rows:()=>editDays,index:r=>Number(r.dataset.dayIndex),save:(from,to)=>moveEditorDay(from,to)},
    open:{root:'#trainBody',row:'.open-day-row',handle:'.open-day-handle',mode:()=>openMode,rows:()=>window.__openRoutineDays||[],index:r=>Number(r.dataset.openDayIndex),save:(from,to)=>reorderOpenDay(window.__openRoutineId,from,to)}
  };
  const busy=()=>!!window.__routineReordering||!!window.__openDayReordering||typeof __editorOrderSaving!=='undefined'&&__editorOrderSaving;
  const idAt=(d,i)=>String(d.rows()[i]?.id||'pending-'+i);
  function decorate(){
    scheduled=false;if(drag)return;
    for(const [kind,d] of Object.entries(definitions)){
      const root=document.querySelector(d.root);if(!root)continue;
      const rows=[...root.querySelectorAll(d.row)],active=d.mode();
      const flag=kind==='routine'?'routine-compact-mode':kind==='day'?'day-compact-mode':'open-compact-mode';
      if(root.classList.contains(flag)!==active)root.classList.toggle(flag,active);
      for(const row of rows){
        const i=d.index(row),id=idAt(d,i),handle=row.querySelector(d.handle);
        if(active){
          if(row.tabIndex!==0)row.tabIndex=0;
          if(row.getAttribute('role')!=='button')row.setAttribute('role','button');
          const label='Seleccionar '+(d.rows()[i]?.name||'Sin nombre');if(row.getAttribute('aria-label')!==label)row.setAttribute('aria-label',label);
        }else{row.removeAttribute('tabindex');row.removeAttribute('role');row.removeAttribute('aria-label');}
        const isSelected=active&&selected[kind]===id;if(row.classList.contains('reorder-selected')!==isSelected)row.classList.toggle('reorder-selected',isSelected);
        if(handle){handle.draggable=false;handle.style.touchAction='none';}
      }
      let panel=root.querySelector(':scope > .reorder-tools');
      if(!active||!rows.length){panel?.remove();continue;}
      if(!panel){panel=document.createElement('div');panel.className='reorder-tools';panel.innerHTML='<p>El orden se guarda automáticamente.</p><div class="buttons"><button type="button" class="btn" data-move="-1">Subir</button><button type="button" class="btn" data-move="1">Bajar</button></div>';if(kind==='routine')root.firstElementChild.after(panel);else root.prepend(panel);
        if(kind==='day')panel.querySelector('p').textContent='El orden se guarda automáticamente. Los cambios de estructura pendientes requieren Guardar cambios.';
        panel.addEventListener('click',e=>{const button=e.target.closest('[data-move]');if(!button)return;moveSelected(kind,Number(button.dataset.move));});
      }
      const i=d.rows().findIndex((r,n)=>idAt(d,n)===selected[kind]);
      for(const button of panel.querySelectorAll('button')){const delta=Number(button.dataset.move);button.disabled=busy()||i<0||i+delta<0||i+delta>=rows.length;}
    }
    const button=document.getElementById('routineReorderToggle');if(button){const text=routineMode?'Listo':'Reordenar';if(button.textContent!==text)button.textContent=text;button.disabled=busy();button.setAttribute('aria-pressed',String(routineMode));}
    const open=document.getElementById('openReorderToggle');if(open){const text=openMode?'Listo':'Reordenar';if(open.textContent!==text)open.textContent=text;open.disabled=busy();open.setAttribute('aria-pressed',String(openMode));}
  }
  function schedule(){if(!scheduled){scheduled=true;requestAnimationFrame(decorate);}}
  async function moveSelected(kind,delta){
    if(drag||busy())return;const d=definitions[kind],i=d.rows().findIndex((r,n)=>idAt(d,n)===selected[kind]),target=i+delta;
    if(i<0||target<0||target>=d.rows().length)return;
    await d.save(i,delta>0?target+1:target);schedule();
  }
  function cancel(){
    if(scrollFrame)cancelAnimationFrame(scrollFrame);scrollFrame=0;
    const state=drag;drag=null;if(!state)return;
    state.ghost?.remove();state.placeholder?.remove();state.row.style.display=state.display;
    document.body.classList.remove('compact-pointer-dragging');
    try{state.root.releasePointerCapture(state.pointerId)}catch(_){}
    document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',cancel);schedule();
  }
  function start(e,kind,index){
    const d=definitions[kind];if(!d.mode()||drag||busy()||profile?.role!=='trainer'||e.button>0||e.isPrimary===false)return;
    const row=e.currentTarget.closest(d.row),root=document.querySelector(d.root);if(!row||!root)return;
    e.preventDefault();e.stopPropagation();selected[kind]=idAt(d,index);decorate();
    drag={kind,d,index:Number(index),row,root,pointerId:e.pointerId,x:e.clientX,y:e.clientY,lastY:e.clientY,active:false,display:row.style.display};
    try{root.setPointerCapture(e.pointerId)}catch(_){}
    document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',up,{passive:false});document.addEventListener('pointercancel',cancel,{passive:false});
  }
  function target(y){
    const state=drag;if(!state?.active)return;
    const rows=[...state.root.querySelectorAll(state.d.row)].filter(row=>row!==state.row);
    const before=rows.find(row=>{const r=row.getBoundingClientRect();return y<r.top+r.height/2;});
    if(before)before.before(state.placeholder);else if(rows.length)rows.at(-1).after(state.placeholder);
    state.to=before?state.d.index(before):state.d.rows().length;
    state.ghost.style.top=(y-state.offsetY)+'px';
  }
  function autoScroll(){
    scrollFrame=0;const state=drag;if(!state?.active)return;
    const sheet=state.root.closest('.sheet'),scroller=sheet||document.scrollingElement;
    const rect=sheet?sheet.getBoundingClientRect():{top:0,bottom:innerHeight};
    const top=Math.max(0,rect.top),bottom=Math.min(innerHeight,rect.bottom),edge=44;
    const speed=state.lastY<top+edge?-Math.min(12,(top+edge-state.lastY)/3):state.lastY>bottom-edge?Math.min(12,(state.lastY-bottom+edge)/3):0;
    if(speed){scroller.scrollTop+=speed;target(state.lastY);}
    scrollFrame=requestAnimationFrame(autoScroll);
  }
  function move(e){
    const state=drag;if(!state||state.pointerId!==e.pointerId)return;e.preventDefault();state.lastY=e.clientY;
    if(!state.active){
      if(Math.hypot(e.clientX-state.x,e.clientY-state.y)<7)return;
      const rect=state.row.getBoundingClientRect(),style=getComputedStyle(state.row);state.offsetY=state.y-rect.top;
      const placeholder=document.createElement('div');placeholder.className='compact-reorder-placeholder';Object.assign(placeholder.style,{height:rect.height+'px',margin:style.margin});
      const ghost=state.row.cloneNode(true);ghost.className+=' compact-reorder-ghost';ghost.removeAttribute('id');ghost.querySelectorAll('[id]').forEach(e=>e.removeAttribute('id'));
      Object.assign(ghost.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',fontFamily:style.fontFamily,pointerEvents:'none',zIndex:'2147483646'});
      state.placeholder=placeholder;state.ghost=ghost;state.row.before(placeholder);state.row.style.display='none';document.body.append(ghost);state.active=true;document.body.classList.add('compact-pointer-dragging');
      scrollFrame=requestAnimationFrame(autoScroll);
    }
    target(e.clientY);
  }
  async function up(e){const state=drag;if(!state||state.pointerId!==e.pointerId)return;e.preventDefault();if(state.active)target(e.clientY);const {d,index,to,active}=state;cancel();if(active){window.__compactSuppressClickUntil=performance.now()+450;await d.save(index,to);}schedule();}
  window.simpleReorder={get dragging(){return !!drag;},cancel,refresh:schedule,toggle(kind){if(busy())return;cancel();if(kind==='routine')routineMode=!routineMode;else if(kind==='open')openMode=!openMode;schedule();}};
  startRoutinePointerDrag=(e,i)=>start(e,'routine',i);
  const originalEditor=startEditorPointerDrag;
  startEditorPointerDrag=(e,type,di,ei)=>type==='day'&&e.currentTarget.closest('#clientSessionList')?start(e,'day',di):originalEditor(e,type,di,ei);
  startOpenDayPointerDrag=(e,i)=>start(e,'open',i);
  document.addEventListener('click',e=>{if(performance.now()<(window.__compactSuppressClickUntil||0)){e.preventDefault();e.stopImmediatePropagation();return;}
    for(const [kind,d] of Object.entries(definitions)){if(!d.mode())continue;const row=e.target.closest(d.root+' '+d.row);if(!row)continue;e.preventDefault();e.stopImmediatePropagation();selected[kind]=idAt(d,d.index(row));schedule();return;}
  },true);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&drag){e.preventDefault();e.stopImmediatePropagation();cancel();return;}if(!['Enter',' '].includes(e.key))return;for(const [kind,d] of Object.entries(definitions)){if(d.mode()&&e.target.matches(d.root+' '+d.row)){e.preventDefault();selected[kind]=idAt(d,d.index(e.target));schedule();}}},true);
  window.addEventListener('blur',cancel);document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();});
  new MutationObserver(schedule).observe(document.getElementById('app'),{childList:true,subtree:true});
  for(const id of ['editor','trainBody']){const root=document.getElementById(id);if(root)new MutationObserver(schedule).observe(root,{childList:true,subtree:true});}
  decorate();
})();
