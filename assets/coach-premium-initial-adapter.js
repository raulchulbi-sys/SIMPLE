/* Closed initial Premium flow. Existing session; server-side entitlement only. */
(function(scope){
'use strict';
const STAGING='https://dmqjexigdnfzobarhnib.supabase.co';
const PRODUCTION='https://yvguatdqncadkwewlepe.supabase.co';
const copy=v=>v==null?v:structuredClone(v);
function failure(e){const code=[e?.code,e?.error,e?.message].find(v=>/^(premium_[a-z_]+|not_authenticated|network_error|configuration_error)$/.test(v||''))||'premium_initial_request_failed';return Object.assign(Error(code),{code});}
function create(db,{projectUrl}={}){
 if(![STAGING,PRODUCTION].includes(projectUrl)||!db?.auth?.getSession||!db?.rpc)throw failure({code:'configuration_error'});
 let owner=null;
 async function session(){const r=await db.auth.getSession(),id=r.data?.session?.user?.id;if(r.error||!id)throw failure({code:'not_authenticated'});if(owner&&owner!==id)throw failure({code:'not_authenticated'});owner=id;return id;}
 async function rpc(name,args={}){await session();const r=await db.rpc(name,args);if(r.error)throw failure(r.error);return r.data;}
 async function state(){const id=await session(),v=await rpc('premium_initial_my_state');return {...copy(v),user_id:id};}
 async function handle(action,data={}){
  if(action==='state')return state();
  if(action==='save'){await rpc('premium_initial_save_intake',{p_expected:data.expected,p_training:copy(data.training),p_submit:data.submit===true});return state();}
  if(action==='permission'){await rpc('premium_initial_permission',{p_allow:data.allow===true,p_notice:data.notice});return state();}
  if(action==='followup_permission'){await rpc('premium_admission_permission',{p_allow:data.allow===true,p_notice:'premium-followup-v1'});return state();}
  if(action==='generate'){
   await session();if(!db.functions?.invoke)throw failure({code:'configuration_error'});
   const r=await db.functions.invoke('simple-coach-initial-premium',{body:{intake_id:data.intake_id,key:data.key}});
   if(r.error){let v;try{v=await r.error.context?.json();}catch{}throw failure(v||r.error);}if(r.data?.error)throw failure(r.data);
   return state();
  }
  if(action==='accept'){await rpc('premium_initial_accept',{p_operation:data.operation});return state();}
  if(action==='queue')return copy(await rpc('premium_initial_review_queue'));
  if(action==='review'){await rpc('premium_initial_review',{p_operation:data.operation,p_approve:data.approve===true,p_reason:data.reason});return copy(await rpc('premium_initial_review_queue'));}
  throw failure({code:'premium_initial_request_failed'});
 }
 return {handle,load:state};
}
const api={create,failure,STAGING,PRODUCTION};scope.PremiumInitialAdapter=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
