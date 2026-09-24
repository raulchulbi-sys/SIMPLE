// Synthetic local data only. Used by the review server, never by production.
window.mock={tables:{},calls:[],scenario:'normal',role:'client'};
(function(){
const query=(rows,table)=>{
 const filters=[];let single=false,sort=null,desc=false,limit=Infinity,write=false;
 const q={select(){return q},eq(k,v){filters.push(x=>String(k.includes('->>')?x[k.split('->>')[0]]?.[k.split('->>')[1]]:x[k])===String(v));return q},is(k,v){filters.push(x=>x[k]==v);return q},in(k,v){filters.push(x=>v.includes(x[k]));return q},not(k,op,v){filters.push(x=>x[k]!=v);return q},order(k,opts){sort=k;desc=opts?.ascending===false;return q},limit(n){limit=n;return q},single(){single=true;return q},maybeSingle(){single=true;return q},insert(){write=true;return q},update(){write=true;return q},upsert(){write=true;return q},delete(){write=true;return q},
 async then(resolve,reject){try{
  mock.calls.push({table,write});
  if(mock.scenario==='loading'&&table==='routine_assignments')await new Promise(()=>{});
  if(mock.scenario==='error'&&table==='routine_assignments')return resolve({data:null,error:{message:'No se pudo conectar. Comprueba tu conexión.'}});
  if(write)return resolve({data:null,error:{message:'Vista local: los cambios no se guardan.'}});
  let list=rows().filter(x=>filters.every(f=>f(x)));if(sort)list=list.slice().sort((a,b)=>String(a[sort]).localeCompare(String(b[sort]))*(desc?-1:1));
  list=list.slice(0,limit);return resolve({data:structuredClone(single?list[0]||null:list),count:list.length,error:null});
 }catch(e){return reject?.(e)}}};return q;
};
window.supabase={createClient:()=>({
auth:{getSession:async()=>{if(new URLSearchParams(location.search).get('state')==='auth-loading')await new Promise(()=>{});return {data:{session:null}}},getUser:async()=>({data:{user:typeof user==='undefined'?null:user}}),onAuthStateChange:()=>({}),signOut:async()=>({error:null})},
from:table=>query(()=>mock.tables[table]||[],table),
rpc:(name,args)=>{mock.calls.push({rpc:name,args});let rows=[];
 if(name==='get_client_routine_cycle_progress'){const total=(mock.tables.routine_days||[]).filter(d=>d.routine_id===args.p_routine_id).length;rows=[{total_days:total,completed_days:Math.min(total,args.p_client_id.endsWith('3')?1:2)}]}
 else if(name==='get_client_routine_history')rows=(mock.tables.workouts||[]).filter(w=>w.user_id===args.p_client_id&&w.data.routine_id===args.p_routine_id).sort((a,b)=>b.workout_date.localeCompare(a.workout_date));
 else if(name==='get_client_routine_notes')rows=[];
 else if(!name.startsWith('get_'))return Promise.resolve({data:null,error:{message:'Vista local: los cambios no se guardan.'}});
 return query(()=>rows,name);
}
})};
})();
