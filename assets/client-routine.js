(function(scope){
 'use strict';
 function validate(value,client,routine){
  if(!value||String(value.client_id)!==String(client)||String(value.routine_id)!==String(routine)||
   !value.assignment_id||!Number.isSafeInteger(value.version)||value.version<1||typeof value.name!=='string'||
   !Object.hasOwn(value,'description')||!(value.description===null||typeof value.description==='string')||!Array.isArray(value.days))throw Error('client_routine_invalid_response');
  const days=new Set(),exercises=new Set();
  for(const d of value.days){
   if(!d.id||days.has(String(d.id))||typeof d.name!=='string'||!Number.isInteger(d.day_order)||!Array.isArray(d.exercises))throw Error('client_routine_invalid_response');days.add(String(d.id));
   for(const e of d.exercises){
    if(!e.id||exercises.has(String(e.id))||String(e.day_id)!==String(d.id)||typeof e.name!=='string'||
     !Number.isInteger(e.sets)||e.sets<1||!Number.isInteger(e.rest_seconds)||e.rest_seconds<0||!Number.isInteger(e.exercise_order)||
     ['target','rir','notes'].some(k=>!Object.hasOwn(e,k)||!(e[k]===null||typeof e[k]==='string')))throw Error('client_routine_invalid_response');exercises.add(String(e.id));
   }
  }
  return value;
 }
 async function read(db,client,routine){
  const r=await db.rpc('get_client_routine_structure',{p_client_id:String(client),p_routine_id:String(routine)});
  if(r.error)throw r.error;return validate(r.data,client,routine);
 }
 async function save(db,state,args){
  const r=await db.rpc('save_client_routine_structure',{...args,p_client_id:String(state.clientId),p_expected_version:state.clientVersion});
  if(r.error)throw r.error;return validate(r.data,state.clientId,state.routineId);
 }
 async function reorder(db,state,order){
  const r=await db.rpc('reorder_client_routine_structure',{p_client_id:String(state.clientId),p_routine_id:String(state.routineId),p_expected_version:state.clientVersion,p_order:order});
  if(r.error)throw r.error;const saved=validate(r.data,state.clientId,state.routineId),verify=await read(db,state.clientId,state.routineId);
  if(saved.version!==verify.version||JSON.stringify(saved.days)!==JSON.stringify(verify.days))throw Error('client_routine_order_not_verified');return verify;
 }
 function templateOrder(db,routine,kind,ids,day){
  return db.rpc('reorder_template_routine_structure',{p_routine_id:String(routine),p_order:{kind,ids,...(day?{day_id:String(day)}:{})}});
 }
 scope.simpleClientRoutine={validate,read,save,reorder,templateOrder};
})(globalThis);
