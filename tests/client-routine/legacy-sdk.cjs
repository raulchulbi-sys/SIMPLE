// Adds the new read endpoints to archived SDK doubles. No production code.
module.exports=function installLegacyClientReads(){
 const create=window.supabase.createClient;
 window.supabase.createClient=(...args)=>{const db=create(...args);let rpc=db.rpc;
  Object.defineProperty(db,'rpc',{configurable:true,get:()=>(name,a)=>{
   if(name==='get_client_routine_statistics_stage')return Promise.resolve({data:{id:null,started_at:null},error:null});
   if(name==='get_client_routine_structure'){
    const r=(mock.tables.routines||[]).find(r=>String(r.id)===String(a.p_routine_id)),assignment=(mock.tables.routine_assignments||[]).find(x=>String(x.client_id)===String(a.p_client_id)&&String(x.trainer_routine_id)===String(a.p_routine_id));
    if(!r||!assignment)return Promise.resolve({error:{message:'client_routine_not_authorized'}});
    return Promise.resolve({data:{assignment_id:assignment.id,client_id:a.p_client_id,routine_id:a.p_routine_id,version:1,name:r.name,description:r.description??null,
     days:(mock.tables.routine_days||[]).filter(d=>String(d.routine_id)===String(r.id)).sort((a,b)=>a.day_order-b.day_order).map((d,i)=>({id:d.id,name:d.name,day_order:d.day_order??i,
      exercises:(mock.tables.routine_exercises||[]).filter(e=>String(e.day_id)===String(d.id)).sort((a,b)=>a.exercise_order-b.exercise_order).map((e,j)=>({...e,sets:e.sets??1,target:e.target??null,rir:e.rir==null?null:String(e.rir),rest_seconds:e.rest_seconds??120,notes:e.notes??null,exercise_order:e.exercise_order??j}))}))},error:null});
   }
   if(name==='get_client_custom_routine_cycle_progress')name='get_client_routine_cycle_progress';
   if(name==='reorder_template_routine_structure'){const p=a.p_order;name=p.kind==='day'?'reorder_my_routine_days_atomic':'reorder_my_routine_exercises_atomic';a=p.kind==='day'?{p_routine_id:a.p_routine_id,p_day_ids:p.ids}:{p_day_id:p.day_id,p_exercise_ids:p.ids};}
   return rpc.call(db,name,a);
  },set:value=>rpc=value});return db;
 };
};
