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
 const changes=(row.patches||[]).map(p=>({action:p.field,exercise_name:p.exercise_name||exercise(p.target_id)?.name||'Programación actual',before:clone(p.from),after:clone(p.to)}));
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
 async function state(){
  const s=await session();
  // Identify an explicitly selected, RLS-visible reviewer scope before calling
  // athlete-only access. Do not request the athlete's private intake in this read.
  const selected=chosen?await read('coach_mesocycles',M.split(',').filter(c=>c!=='intake').join(','),{id:chosen},'created_at'):null;
  const selectedReviewer=selected?.[0]&&selected[0].user_id!==s.user.id;
  const access=selectedReviewer?{enabled:false,consent:false,capabilities:[]}:await rpc('premium_my_access');
  const result={user_id:s.user.id,access:clone(access),mesocycle:null,week:null,days:[],checkin:null,recommendations:[],permission:false,weekly_permission:false,actor:'athlete'};
  // Availability is server supplied. No browser entitlement or user_metadata authorization.
  if(!access?.enabled&&!chosen){last=result;return result;}
  const rows=selectedReviewer?selected:await read('coach_mesocycles',M,chosen?{id:chosen}:{user_id:s.user.id},'created_at');
  const m=rows?.find(x=>['active','draft'].includes(x.state))||rows?.[0];if(!m){last=result;return result;}chosen=m.id;
  const actor=m.user_id===s.user.id?'athlete':'reviewer';
  const [weeks,revisions,recs]=await Promise.all([
   read('coach_mesocycle_weeks','id,week_number,state,planned_date,revision_id',{mesocycle_id:m.id}),
   actor==='athlete'?read('routine_revisions','id,revision_no,snapshot',{id:m.current_revision_id}):Promise.resolve([]),
   read('coach_recommendations',R,{mesocycle_id:m.id},'created_at')
  ]);
  const revision=revisions?.[0];if(actor==='athlete'&&!revision)throw failure({code:'premium_current_prescription_unresolved'});
  // Assigned reviewers have a safe recommendation projection, not owner-only revision SELECT.
  // Keep the exact revision UUID; the permitted projection does not supply an ordinal or full program.
  result.actor=actor;result.mesocycle={...clone(m),revision_id:m.current_revision_id,revision_no:revision?.revision_no??'actual'};
  result.week=weeks?.find(w=>w.week_number===m.tracking_week)||null;result.days=clone(revision?.snapshot?.days||[]);
  // Reviewer never loads private revisions, transcript, context bundles, personal notes, or athlete fallback.
  if(actor==='athlete'){
   const [grants,checkins]=await Promise.all([
    read('context_grants','scope,notice_version,revoked_at',{user_id:s.user.id,revoked_at:null}),
    result.week?read('coach_weekly_checkins','id,week_number,routine_revision_id,row_version,answers,submitted_at',{mesocycle_id:m.id,week_number:result.week.week_number}):Promise.resolve([])
   ]);
   result.permission=(grants||[]).some(g=>g.scope==='premium_training_history'&&g.notice_version==='premium-tracking-v1');
   result.weekly_permission=(grants||[]).some(g=>g.scope==='premium_weekly_checkin'&&g.notice_version==='premium-checkin-v1');
   result.checkin=clone(checkins?.[0]||null);
  }else{delete result.mesocycle.intake;delete result.mesocycle.user_id;}
  result.recommendations=[];
  for(const r of recs||[]){let safe=r;
   // Revoked/stale owners retain the historical listing; no transcript or private context fallback.
   if(access?.enabled&&access?.consent&&result.permission||actor==='reviewer'){
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
