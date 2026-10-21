// Task-only fixture transport. Root deploys and retires it; this file is not public dist.
import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.115.0';
const REF='dmqjexigdnfzobarhnib',REVIEWER='6b47ae02-6574-46db-acdb-f00925efdd74';
const TASK='cloudflare_hosting_20261014',END=Date.parse('__EXPIRES_AT__');
const slots=['trainer','client'],prefix='SYNTHETIC Cloudflare hosting ';
const emailFor=(slot:string)=>'simple-qa-'+TASK+'-'+slot+'@example.com';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async(req:Request)=>{
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(url!=='https://'+REF+'.supabase.co'||!key||req.method!=='POST'||req.headers.get('origin'))return reply({error:'qa_denied'},403);
 const token=req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1];if(!token)return reply({error:'qa_no_actor'},401);
 const db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const actor=await db.auth.getUser(token);if(actor.error||actor.data.user?.id!==REVIEWER)return reply({error:'qa_wrong_actor'},403);
 let body:any;try{body=await req.json();}catch{return reply({error:'qa_invalid_body'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'qa_invalid_body'},400);
 try{
  if(body.action==='create'&&Object.keys(body).sort().join(',')==='action,slot'&&slots.includes(body.slot)){
   if(!Number.isFinite(END)||Date.now()>END)return reply({error:'qa_expired'},410);
   const password=crypto.randomUUID()+crypto.randomUUID().slice(0,20)+'Aa1!';
   const created=await db.auth.admin.createUser({email:emailFor(body.slot),password,email_confirm:true,
    app_metadata:{synthetic_task:TASK,synthetic_slot:body.slot},user_metadata:{synthetic_task:TASK}});
   if(created.error||!created.data.user)return reply({error:'qa_create_failed'},409);
   const id=created.data.user.id,profile=await db.from('profiles').insert({id,name:prefix+body.slot,role:body.slot});
   if(profile.error)return reply({error:'qa_profile_failed',created_id:id,slot:body.slot},409);
   return reply({id,slot:body.slot,email:emailFor(body.slot),password}); // Caller RAM only. Never log this response.
  }
  // Expiry leaves only exact fixture cleanup available until root deploys the retired stub.
  if(body.action==='cleanup'&&Object.keys(body).sort().join(',')==='action,ids'&&Array.isArray(body.ids)&&body.ids.length>=1&&body.ids.length<=2&&new Set(body.ids).size===body.ids.length){
   const ids=body.ids;if(ids.some((id:any)=>typeof id!=='string'||!UUID.test(id)))return reply({error:'qa_invalid_ids'},400);
   const users:any[]=[];
   for(const id of ids){
    const found=await db.auth.admin.getUserById(id),u=found.data.user,slot=u?.app_metadata?.synthetic_slot;
    if(found.error||!u||u.id!==id||u.app_metadata?.synthetic_task!==TASK||!slots.includes(slot)||u.email!==emailFor(slot))return reply({error:'qa_scope_mismatch'},403);
    const profile=await db.from('profiles').select('id,name,role').eq('id',id);
    if(profile.error||profile.data.some((p:any)=>p.role!==slot||p.name!==prefix+slot))return reply({error:'qa_profile_mismatch'},409);
    users.push({id,slot});
   }
   const trainer=users.find(u=>u.slot==='trainer')?.id,client=users.find(u=>u.slot==='client')?.id;
   const routines=await db.from('routines').select('id,owner_id,name,source_routine_id').in('owner_id',ids);
   if(routines.error||routines.data.length>1||routines.data.some((r:any)=>r.owner_id!==trainer||r.name!==prefix+'routine'||r.source_routine_id!==null))return reply({error:'qa_routine_scope'},409);
   const routineIds=routines.data.map((r:any)=>r.id);
   const assignments=await db.from('routine_assignments').select('id,trainer_id,client_id,trainer_routine_id,client_routine_id').or('trainer_id.in.('+ids.join(',')+'),client_id.in.('+ids.join(',')+')');
   if(assignments.error||assignments.data.length>1||assignments.data.some((a:any)=>a.trainer_id!==trainer||a.client_id!==client||!routineIds.includes(a.trainer_routine_id)||a.client_routine_id!==null))return reply({error:'qa_assignment_scope'},409);
   const days=routineIds.length?await db.from('routine_days').select('id,routine_id').in('routine_id',routineIds):{data:[],error:null};
   if(days.error||days.data.length>1)return reply({error:'qa_day_scope'},409);
   const dayIds=days.data.map((d:any)=>d.id);
   const exercises=dayIds.length?await db.from('routine_exercises').select('id,day_id').in('day_id',dayIds):{data:[],error:null};
   if(exercises.error||exercises.data.length>1)return reply({error:'qa_exercise_scope'},409);
   const exerciseIds=exercises.data.map((e:any)=>e.id);
   const workouts=await db.from('workouts').select('id,user_id,data').in('user_id',ids);
   if(workouts.error||workouts.data.length>1||workouts.data.some((w:any)=>w.user_id!==client||!routineIds.includes(w.data?.routine_id)||!dayIds.includes(w.data?.routine_day_id)||w.data?.exercises?.some((e:any)=>!exerciseIds.includes(e.exercise_id))))return reply({error:'qa_workout_scope'},409);
   const notes=await db.from('routine_user_notes').select('id,user_id,routine_id,exercise_key,statistics_stage_id').in('user_id',ids);
   if(notes.error||notes.data.length>1||notes.data.some((n:any)=>n.user_id!==client||!routineIds.includes(n.routine_id)||!exerciseIds.some((id:string)=>n.exercise_key==='exercise:'+id)||n.statistics_stage_id!==null))return reply({error:'qa_note_scope'},409);
   // No coach tables, quotas, flags or old fixtures are changed. Unexpected protected
   // dependencies cause Auth/routine FK RESTRICT to reject removal; root verifies them first.
   for(const [table,rows] of [['workouts',workouts.data],['routine_user_notes',notes.data],['routine_assignments',assignments.data],['routine_exercises',exercises.data],['routine_days',days.data],['routines',routines.data]] as const){
    if(!rows.length)continue;
    const removed=await db.from(table).delete().in('id',rows.map((r:any)=>r.id));if(removed.error)return reply({error:'qa_app_cleanup_failed',table},409);
   }
   const deleted=[];
   for(const u of users){const removed=await db.auth.admin.deleteUser(u.id);if(removed.error)return reply({error:'qa_auth_cleanup_failed'},409);deleted.push(u.id);}
   return reply({deleted,app_rows_removed:workouts.data.length+notes.data.length+assignments.data.length+exercises.data.length+days.data.length+routines.data.length});
  }
  return reply({error:'qa_invalid_action'},400);
 }catch{return reply({error:'qa_failed'},500);}
});
