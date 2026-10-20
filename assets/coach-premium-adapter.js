/* Premium host adapter. Uses the application's existing Supabase SDK/client and session. */
(function(scope){
'use strict';
const M='id,user_id,routine_id,number,start_date,planned_weeks,state,current_revision_id,initial_revision_id,intake,intake_submitted_at,access_until,row_version,tracking_week';
const R='id,mesocycle_id,base_revision_id,kind,state,patches,facts,interpretation,review_reason,analysis_week,created_at,quality_warnings:analysis_trace->quality_warnings';
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
function failure(value){const code=[value?.code,value?.error,value?.message].find(s=>/^(premium_[a-z_]+|not_authenticated|network_error|configuration_error|invalid_request|origin_denied|action_unavailable)$/.test(s||''))||'premium_request_failed';const e=Error(code);e.code=code;return e;}
function recommendation(row,days=[]){
 if(!row)return null;
 const exercise=id=>days.flatMap(d=>d.exercises||[]).find(e=>e.id===id);
 const changes=(row.patches||[]).map(p=>{
  const name=p.exercise_name||exercise(p.target_id)?.name||'Programación actual',change={action:p.field,exercise_name:name,before:clone(p.from),after:clone(p.to)};
  if(p.field==='replace_exercise'&&Array.isArray(p.to?.planned_sets)&&p.to.source_catalogue_id){
   // Only the authorized base-revision projection describes the old series.
   // Never copy the replacement or infer historical series from current days.
   change.before=Array.isArray(p.before_prescription?.planned_sets)?clone(p.before_prescription):'Prescripción anterior no disponible en esta proyección';
   change.after={name:scope.SimpleCoachProgrammingV5?.byId.get(p.to.catalogue_id)?.name||'Sustituto del catálogo',scheme:p.to.scheme,planned_sets:clone(p.to.planned_sets)};
  }
  return change;
 });
 return {id:row.id,kind:row.kind,state:row.state,revision_id:row.base_revision_id,analysis_week:row.analysis_week,reason:row.review_reason||row.interpretation||'',facts:clone(row.facts||[]),changes,quality_warnings:clone(row.quality_warnings||[])};
}
function create(db,options={}){
 if(!db?.auth?.getSession||!db.rpc||!db.from)throw Error('premium_existing_sdk_required');
 let chosen=options.mesocycleId||null,last=null;
 async function session(){const r=await db.auth.getSession();if(r.error)throw failure(r.error);if(!r.data?.session?.user?.id)throw failure({code:'not_authenticated'});return r.data.session;}
 async function must(p){const r=await p;if(r?.error)throw failure(r.error);return r?.data;}
 async function rpc(name,args={}){await session();return must(db.rpc(name,args));}
 async function invoke(name,body){await session();if(!db.functions?.invoke)throw failure({code:'configuration_error'});const r=await db.functions.invoke(name,{body});if(r.error){let v;try{v=await r.error.context?.json();}catch{}throw failure(v||r.error);}if(r.data?.error)throw failure(r.data);return r.data;}
 async function read(table,columns,filters={},sort){let q=db.from(table).select(columns);for(const [k,v]of Object.entries(filters))q=v===null?q.is(k,null):q.eq(k,v);if(sort)q=q.order(sort,{ascending:false});return must(q);}
 async function reviewerState(s){
  const response=await db.rpc('premium_reviewer_state',{p_mesocycle:chosen});
  if(response.error?.code==='PGRST202')throw failure({code:'premium_reviewer_api_unavailable'});
  if(response.error)throw failure(response.error);
  const v=response.data,m=v?.mesocycle;
  if(v?.actor!=='reviewer'||m?.id!==chosen||!Array.isArray(v.weeks)||!Array.isArray(v.recommendations))throw failure({code:'premium_not_authorized'});
  // The server supplies the complete reviewer projection. No table or owner fallback.
  const result={user_id:s.user.id,access:{enabled:false,consent:false,capabilities:[]},mesocycle:{...clone(m),revision_id:m.current_revision_id,revision_no:'actual'},week:clone(v.weeks.find(w=>w.week_number===m.tracking_week)||null),days:[],checkin:null,recommendations:v.recommendations.map(r=>recommendation(r)),permission:false,weekly_permission:false,actor:'reviewer'};
  last=result;return result;
 }
 async function state(){
  const s=await session();
  if(chosen){
   // Own profile selects a consumer path; the reviewer RPC authorizes its scope.
   const profiles=await read('profiles','id,role',{id:s.user.id});
   if(profiles?.[0]?.role==='trainer')return reviewerState(s);
   if(profiles?.[0]?.role!=='client')throw failure({code:'premium_not_authorized'});
  }
  const access=await rpc('premium_my_access');
  const result={user_id:s.user.id,access:clone(access),mesocycle:null,week:null,days:[],checkin:null,recommendations:[],permission:false,weekly_permission:false,actor:'athlete'};
  // Availability is server supplied. No browser entitlement or user_metadata authorization.
  if(!access?.enabled&&!chosen){last=result;return result;}
  const rows=await read('coach_mesocycles',M,chosen?{id:chosen,user_id:s.user.id}:{user_id:s.user.id},'created_at');
  const m=rows?.find(x=>['active','draft'].includes(x.state))||rows?.[0];if(!m){last=result;return result;}
  if(m.user_id!==s.user.id)throw failure({code:'premium_not_authorized'});chosen=m.id;
  const [weeks,revisions,recs]=await Promise.all([
   read('coach_mesocycle_weeks','id,week_number,state,planned_date,revision_id',{mesocycle_id:m.id}),
   read('routine_revisions','id,revision_no,snapshot',{id:m.current_revision_id}),
   read('coach_recommendations',R,{mesocycle_id:m.id},'created_at')
  ]);
  const revision=revisions?.[0];if(!revision)throw failure({code:'premium_current_prescription_unresolved'});
  result.mesocycle={...clone(m),revision_id:m.current_revision_id,revision_no:revision.revision_no};
  result.week=weeks?.find(w=>w.week_number===m.tracking_week)||null;result.days=clone(revision.snapshot?.days||[]);
  const [grants,checkins]=await Promise.all([
   read('context_grants','scope,notice_version,revoked_at',{user_id:s.user.id,revoked_at:null}),
   result.week?read('coach_weekly_checkins','id,week_number,routine_revision_id,row_version,answers,submitted_at',{mesocycle_id:m.id,week_number:result.week.week_number}):Promise.resolve([])
  ]);
  result.permission=(grants||[]).some(g=>g.scope==='premium_training_history'&&g.notice_version==='premium-tracking-v1');
  result.weekly_permission=(grants||[]).some(g=>g.scope==='premium_weekly_checkin'&&g.notice_version==='premium-checkin-v1');
  result.checkin=clone(checkins?.[0]||null);
  for(const r of recs||[]){let safe=r;
   // Revoked/stale owners retain the historical listing, without a private-context fallback.
   if(access?.enabled&&access?.consent&&result.permission){
    try{safe=await rpc('premium_recommendation_view',{p_id:r.id});}
    catch(e){if(!/^premium_.*(not_authorized|consent_required|revoked|stale)/.test(e.code||''))throw e;}
   }
   result.recommendations.push(recommendation(safe,result.days));
  }
  last=result;return result;
 }
 async function current(){return last||state();}
 async function handle(action,data={}){
  if(action==='state')return state();
  const v=await current(),id=v.mesocycle?.id;
  if(action==='admission_permission'){await rpc('premium_admission_permission',{p_allow:data.allow===true,p_notice:v.access.notice_version});return state();}
  if(action==='upgrade'||action==='start'){
   const name=action==='upgrade'?'upgrade_basic_routine_to_premium':'premium_start_followup';
   const args={p_routine:data.routine_id,p_key:data.key,p_start:data.start,p_weeks:data.weeks};if(action==='upgrade')args.p_revision=data.revision_id;
   chosen=await rpc(name,args);return state();
  }
  if(!id)throw failure({code:'premium_not_authorized'});
  if(action==='history_permission'){await rpc('premium_permission',{p_mesocycle:id,p_allow:data.allow===true});return state();}
  if(action==='weekly_permission'){await rpc('premium_weekly_permission',{p_mesocycle:id,p_allow:data.allow===true});return state();}
  if(action==='intake_save'){await rpc('premium_save_intake',{p_mesocycle:id,p_expected:data.expected,p_training:data.training,p_submit:data.submit===true});return state();}
  if(action==='checkin_save'){await rpc('premium_save_weekly_checkin',{p_mesocycle:id,p_week:data.week,p_revision:data.revision_id,p_expected:data.expected,p_answers:data.answers,p_submit:data.submit===true});return state();}
  if(action==='analyze'){await invoke('simple-coach-premium',{mesocycle_id:id,key:data.key,mode:'weekly'});return state();}
  if(action==='accept'){await rpc('premium_accept_recommendation',{p_id:data.id});return state();}
  if(action==='review'||action==='reject'){await rpc('premium_review_recommendation',{p_id:data.id,p_approve:action==='review',p_reason:data.reason});return state();}
  if(action==='resolve'){await rpc('premium_resolve_review',{p_id:data.id,p_kind:'KEEP',p_patches:[],p_reason:data.reason});return state();}
  if(action==='chat_state')return rpc('premium_chat_load',{p_mesocycle:id});
  if(action==='chat_permission'){await rpc('premium_chat_permission',{p_mesocycle:id,p_allow:data.allow===true});return rpc('premium_chat_load',{p_mesocycle:id});}
  if(action==='chat_send'||action==='chat_retry')return invoke('simple-coach-chat',{mesocycle_id:id,revision_id:data.revision_id,key:data.key,message:data.message});
  throw failure({code:'action_unavailable'});
 }
 return {handle,load:state,selectMesocycle(id){chosen=id;last=null;},snapshot:()=>clone(last)};
}
const API={create,failure,recommendation};scope.PremiumAdapter=API;if(typeof module!=='undefined'&&module.exports)module.exports=API;
})(typeof window!=='undefined'?window:globalThis);
