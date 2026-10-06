(function(scope){
 'use strict';
 const stages=new Map(),key=(client,routine)=>String(client)+'|'+String(routine);
 function instant(value){
  if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))return null;
  const fraction=value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/i)?.[1]||'';
  return BigInt(Date.parse(value))*1000n+BigInt(fraction.slice(3,6).padEnd(3,'0'));
 }
 function validate(stage){
  if(!stage||!Object.hasOwn(stage,'id')||!Object.hasOwn(stage,'started_at')||
   (stage.id===null)!==(stage.started_at===null)||
   (stage.id!==null&&(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stage.id)||typeof stage.started_at!=='string'||!Number.isFinite(Date.parse(stage.started_at)))))throw Error('statistics_invalid_stage');
  return {id:stage.id,started_at:stage.started_at};
 }
 async function read(db,client,routine,isCurrent=()=>true){
  const result=await db.rpc('get_client_routine_statistics_stage',{p_client_id:String(client),p_routine_id:String(routine)});
  if(!isCurrent())return null;
  if(result.error)throw result.error;
  const stage=validate(result.data);stages.set(key(client,routine),stage);return stage;
 }
 function filter(rows,stage){
  validate(stage);if(stage.started_at===null)return rows||[];
  const start=instant(stage.started_at);
  return (rows||[]).filter(row=>{const at=instant(row.created_at);return at!==null&&at>=start;});
 }
 function previous(rows,client,routine){const stage=stages.get(key(client,routine));return stage?filter(rows,stage):[];}
 async function cycle(db,client,routine){const stage=await read(db,client,routine);return db.rpc(stage.id?'get_client_routine_stage_cycle_progress':'get_client_routine_cycle_progress',{p_client_id:String(client),p_routine_id:String(routine)});}
 let busy=false;
 async function reset(db,client,routine,stage,requestId){
  if(busy)throw Error('statistics_reset_busy');validate(stage);busy=true;
  try{
   const result=await db.rpc('reset_client_routine_statistics',{p_client_id:String(client),p_routine_id:String(routine),p_expected_stage:stage.id,p_request_id:requestId});
   if(result.error)throw result.error;const saved=validate(result.data),check=await read(db,client,routine);
   if(saved.id!==check.id||saved.started_at!==check.started_at)throw Error('statistics_reset_not_verified');return check;
  }finally{busy=false;}
 }
 scope.simpleStatisticsStage={read,filter,previous,cycle,reset};
})(globalThis);
