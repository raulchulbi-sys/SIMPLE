// Offline synthetic persistence. Never loaded by production.
(function(){
 const create=supabase.createClient;
 supabase.createClient=(...args)=>{const db=create(...args),old=db.rpc;
 async function read(a){const key='synthetic-client-structure:'+a.p_client_id+':'+a.p_routine_id;let data=JSON.parse(localStorage.getItem(key)||'null');
  if(!data){const r=await old('get_client_routine_structure',a);if(r.error)throw r.error;data=r.data;localStorage.setItem(key,JSON.stringify(data));}return {key,data};}
 db.rpc=(name,a)=>{
  if(!['get_client_routine_structure','save_client_routine_structure','reorder_client_routine_structure'].includes(name))return old(name,a);
  mock.calls.push({rpc:name,args:structuredClone(a)});
  return (async()=>{try{
   if(mock.clientReadError&&name==='get_client_routine_structure')throw Error('network');
   if(mock.clientDelay)await new Promise(resolve=>setTimeout(resolve,mock.clientDelay));
   const {key,data}=await read(a);
   if(name==='get_client_routine_structure')return {data:structuredClone(data),error:null};
   if(typeof profile==='undefined'||profile.role!=='trainer')throw Error('client_routine_not_authorized');
   if(data.version!==a.p_expected_version)throw Error('editor_conflict');
   const next=structuredClone(data),p=a.p_days;
   if(name==='reorder_client_routine_structure'){
    const rows=a.p_order.kind==='day'?next.days:next.days.find(d=>d.id===a.p_order.day_id)?.exercises;
    if(!rows||rows.length!==a.p_order.ids.length||new Set(a.p_order.ids).size!==rows.length||rows.some(r=>!a.p_order.ids.includes(r.id)))throw Error('invalid_order');
    const ordered=a.p_order.ids.map((id,i)=>({...rows.find(r=>r.id===id),[a.p_order.kind==='day'?'day_order':'exercise_order']:i}));
    if(a.p_order.kind==='day')next.days=ordered;else next.days.find(d=>d.id===a.p_order.day_id).exercises=ordered;
   }else if(p.mode==='field_patch_v1'){
    for(const change of p.changes){const row=change.entity==='routine'?next:change.entity==='day'?next.days.find(d=>d.id===change.id):next.days.find(d=>d.id===change.day_id)?.exercises.find(e=>e.id===change.id);
     if(!row||Object.entries(change.expected).some(([k,v])=>JSON.stringify(row[k])!==JSON.stringify(v)))throw Error('editor_conflict');Object.assign(row,change.values);}
   }else if(p.mode==='snapshot_v2'){
    const expected={name:data.name,description:data.description,days:data.days};if(JSON.stringify(p.expected)!==JSON.stringify(expected))throw Error('editor_conflict');
    next.name=a.p_name;next.description=a.p_description;next.days=p.days.map((d,i)=>{const id=d.id||crypto.randomUUID();return {...d,id,day_order:i,exercises:d.exercises.map((e,j)=>({...e,id:e.id||crypto.randomUUID(),day_id:id,exercise_order:j}))};});
   }else throw Error('invalid_editor_mode');
   next.version++;localStorage.setItem(key,JSON.stringify(next));return {data:structuredClone(next),error:null};
  }catch(e){return {data:null,error:{message:e.message}}}})();
 };return db;};
})();
