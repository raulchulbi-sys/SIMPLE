// Synthetic local data only. Used by the review server, never by production.
window.mock={tables:{},calls:[],scenario:'normal',role:'client'};
(function(){
const query=(rows,table)=>{
 const filters=[],sorts=[];let single=false,offset=0,limit=Infinity,write=false;
 const q={select(){return q},gte(k,v){filters.push(x=>String(x[k])>=String(v));return q},eq(k,v){filters.push(x=>String(k.includes('->>')?x[k.split('->>')[0]]?.[k.split('->>')[1]]:x[k])===String(v));return q},is(k,v){filters.push(x=>x[k]==v);return q},in(k,v){filters.push(x=>v.includes(x[k]));return q},not(k,op,v){filters.push(x=>x[k]!=v);return q},order(k,opts){sorts.push([k,opts?.ascending===false]);return q},range(a,b){offset=a;limit=b-a+1;return q},limit(n){limit=n;return q},single(){single=true;return q},maybeSingle(){single=true;return q},insert(){write=true;return q},update(){write=true;return q},upsert(){write=true;return q},delete(){write=true;return q},
 async then(resolve,reject){try{
  mock.calls.push({table,write});
  if(mock.scenario==='loading'&&table==='routine_assignments')await new Promise(()=>{});
  if(mock.scenario==='error'&&table==='routine_assignments')return resolve({data:null,error:{message:'No se pudo conectar. Comprueba tu conexión.'}});
  if(write)return resolve({data:null,error:{message:'Vista local: los cambios no se guardan.'}});
  let list=rows().filter(x=>filters.every(f=>f(x)));if(sorts.length)list=list.slice().sort((a,b)=>{for(const [key,desc] of sorts){const order=(typeof a[key]==='number'&&typeof b[key]==='number'?a[key]-b[key]:String(a[key]).localeCompare(String(b[key])))*(desc?-1:1);if(order)return order;}return 0;});
  list=list.slice(offset,offset+limit);return resolve({data:structuredClone(single?list[0]||null:list),count:list.length,error:null});
 }catch(e){return reject?.(e)}}};return q;
};
window.supabase={createClient:()=>({
auth:{getSession:async()=>{if(new URLSearchParams(location.search).get('state')==='auth-loading')await new Promise(()=>{});return {data:{session:null}}},getUser:async()=>({data:{user:typeof user==='undefined'?null:user}}),onAuthStateChange:()=>({}),signOut:async()=>({error:null})},
from:table=>query(()=>mock.tables[table]||[],table),
rpc:(name,args)=>{mock.calls.push({rpc:name,args});let rows=[];
 if(name==='get_client_routine_structure'){
  const a=(mock.tables.routine_assignments||[]).find(x=>x.client_id===args.p_client_id&&x.trainer_routine_id===args.p_routine_id&&!x.client_deleted_at),r=(mock.tables.routines||[]).find(x=>x.id===args.p_routine_id);
  if(!a||!r)return Promise.resolve({error:{message:'client_routine_not_authorized'}});
  return Promise.resolve({data:structuredClone({assignment_id:a.id,client_id:a.client_id,routine_id:r.id,version:1,name:r.name,description:r.description??null,
   days:(mock.tables.routine_days||[]).filter(d=>d.routine_id===r.id).sort((a,b)=>a.day_order-b.day_order).map(d=>({id:d.id,name:d.name,day_order:d.day_order,
    exercises:(mock.tables.routine_exercises||[]).filter(e=>e.day_id===d.id).sort((a,b)=>a.exercise_order-b.exercise_order).map(e=>({...e,target:e.target??null,rir:e.rir??null,notes:e.notes??null}))}))}),error:null});
 }
 if(name==='get_client_routine_statistics_stage')return Promise.resolve({data:{id:null,started_at:null},error:null});
 if(['get_client_routine_cycle_progress','get_client_custom_routine_cycle_progress'].includes(name)){const total=(mock.tables.routine_days||[]).filter(d=>d.routine_id===args.p_routine_id).length;rows=[{total_days:total,completed_days:Math.min(total,args.p_client_id.endsWith('3')?1:2)}]}
 else if(name==='get_client_routine_history')rows=(mock.tables.workouts||[]).filter(w=>w.user_id===args.p_client_id&&w.data.routine_id===args.p_routine_id).sort((a,b)=>b.workout_date.localeCompare(a.workout_date));
 else if(name==='get_client_routine_notes')rows=[];
 else if(!name.startsWith('get_'))return Promise.resolve({data:null,error:{message:'Vista local: los cambios no se guardan.'}});
 return query(()=>rows,name);
}
})};
})();
