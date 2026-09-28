// MOCKS: browser UX/resilience tests only, never proof of server permissions or AI quality.
const v2DemoRpc=demoClient.rpc,v2DemoFrom=demoClient.from;
let pilotDemoReviewer=false;
window.coachDemo={rpcCalls:[],reads:[],invokeCalls:[],delays:{},errors:{},expires:new Date(Date.now()+30*86400000).toISOString(),invokeState:'pending_review',authCallbacks:[]};
const demoPause=async key=>{if(coachDemo.delays[key])await new Promise(r=>setTimeout(r,coachDemo.delays[key]));};
const demoPersist=()=>sessionStorage.setItem('coach-v2-synthetic',JSON.stringify(mock.tables));
demoClient.auth.onAuthStateChange=cb=>{coachDemo.authCallbacks.push(cb);return {data:{subscription:{unsubscribe(){}}}};};
demoClient.from=table=>{coachDemo.reads.push(table);return v2DemoFrom(table);};
demoClient.rpc=async(name,p={})=>{
 coachDemo.rpcCalls.push({name,args:structuredClone(p)});await demoPause(name);if(coachDemo.errors[name])return demoResult(null,{message:coachDemo.errors[name]});
 const t=mock.tables,now=new Date().toISOString();let r;
 if(name==='get_coach_reviewer_access')return demoResult(pilotDemoReviewer);
 if(name==='get_coach_reviewer_status')return demoResult({authorized:pilotDemoReviewer,expires_at:pilotDemoReviewer?coachDemo.expires:null});
 if(name==='get_coach_review_queue')return pilotDemoReviewer?demoResult(t.coach_operations.map(o=>({operation:o,athlete:{name:'Atleta ficticio con un nombre deliberadamente largo para comprobar la lectura móvil'},training:t.training_intakes.find(i=>i.id===o.intake_id)?.training,health:{discomfort:'SHOULD_NEVER_RENDER',limitations:'SHOULD_NEVER_RENDER'}}))):demoResult(null,{message:'coach_reviewer_required'});
 if(name==='get_coach_pilot_metrics')return pilotDemoReviewer?demoResult({authorized:1,generations:t.coach_operations.length}):demoResult(null,{message:'coach_reviewer_required'});
 if(name==='get_my_coach_access'){const o=t.coach_operations.find(x=>x.state==='accepted'),workout=t.workouts.some(w=>w.data?.routine_id===o?.routine_id);return demoResult({authorized:true,can_generate:!o,routine_id:o?.routine_id,can_feedback:!!o&&workout,has_feedback:t.coach_pilot_feedback.some(f=>f.routine_id===o?.routine_id)});}
 if(name==='save_my_training_intake'){
  if(Object.hasOwn(p,'p_health'))return demoResult(null,{message:'coach_health_disabled'});
  const old=t.training_intakes.find(x=>x.id===p.p_id);let row;
  if(old&&p.p_expected!==old.row_version)return demoResult(null,{message:'coach_intake_conflict'});
  if(old?.state==='draft'){row=old;Object.assign(row,{training:p.p_training,state:p.p_submit?'submitted':'draft',row_version:row.row_version+1});}
  else{row={id:crypto.randomUUID(),user_id:demoUser,revision:t.training_intakes.length+1,row_version:1,state:p.p_submit?'submitted':'draft',training:p.p_training};t.training_intakes.push(row);}
  r=demoResult(row);
 }else if(name==='set_my_coach_context_permission'){
  const g=t.context_grants.find(x=>x.scope===p.p_scope&&x.notice_version==='pilot-supervised-v2'&&!x.revoked_at);
  if(p.p_allow&&!g)t.context_grants.push({id:crypto.randomUUID(),user_id:demoUser,scope:p.p_scope,notice_version:'pilot-supervised-v2',revoked_at:null});
  if(!p.p_allow&&g){g.revoked_at=now;for(const o of t.coach_operations)if(['ready','reserved','pending_review'].includes(o.state))o.state='stale';}
  r=demoResult(p.p_allow);
 }else if(name==='delete_my_training_intake'){
  const i=t.training_intakes.find(x=>x.id===p.p_id);if(i?.state!=='draft')return demoResult(null,{message:'coach_draft_required'});if(i.row_version!==p.p_expected)return demoResult(null,{message:'coach_intake_conflict'});t.training_intakes=t.training_intakes.filter(x=>x.id!==p.p_id);r=demoResult(true);
 }else if(name==='review_coach_proposal'){
  if(!pilotDemoReviewer)return demoResult(null,{message:'coach_reviewer_required'});if(!p.p_reason?.trim())return demoResult(null,{message:'coach_review_reason_required'});const o=t.coach_operations.find(x=>x.id===p.p_operation);o.state=p.p_approve?'ready':'rejected';o.review_reason=p.p_reason;o.reviewed_at=now;r=demoResult(o);
 }else if(name==='authorize_coach_retry'){const o=t.coach_operations.find(x=>x.id===p.p_operation);if(o.state==='reserved'&&Date.parse(o.expires_at)<=Date.now()){o.state='failed';o.error_code='reservation_expired';}if(!['failed','stale','rejected','athlete_declined'].includes(o.state))return demoResult(null,{message:'coach_retry_unavailable'});o.retry_authorized_at=now;r=demoResult(true);}
 else if(name==='decline_my_coach_proposal'){const o=t.coach_operations.find(x=>x.id===p.p_operation);o.state='athlete_declined';o.athlete_comment=p.p_comment;r=demoResult(true);}
 else if(name==='save_my_coach_feedback'){
  if(!t.workouts.some(w=>w.data?.routine_id===p.p_routine))return demoResult(null,{message:'coach_feedback_workout_required'});
  const old=t.coach_pilot_feedback.find(x=>x.routine_id===p.p_routine),f={...(old||{id:crypto.randomUUID()}),user_id:demoUser,routine_id:p.p_routine,rating:p.p_rating,comment:p.p_comment};if(old)Object.assign(old,f);else t.coach_pilot_feedback.push(f);r=demoResult(f);
 }else r=await v2DemoRpc(name,p);
 demoPersist();return r;
};
demoClient.functions.invoke=async(name,{body})=>{
 coachDemo.invokeCalls.push({name,body});await demoPause('invoke');if(coachDemo.errors.invoke)return demoResult(null,{message:coachDemo.errors.invoke});
 const t=mock.tables,i=t.training_intakes.find(x=>x.id===body.intake_id);if(!t.context_grants.some(g=>g.scope==='training_intake'&&g.notice_version==='pilot-supervised-v2'&&!g.revoked_at))return demoResult({error:'coach_context_required'});
 const existing=t.coach_operations.find(x=>x.intake_id===i.id);if(existing)return demoResult({operation:existing});
 const o={id:crypto.randomUUID(),user_id:demoUser,intake_id:i.id,state:coachDemo.invokeState,created_at:new Date().toISOString(),expires_at:new Date(Date.now()+300000).toISOString(),proposal:{schema_version:1,name:'Basic · rutina inicial',description:'',days:Array.from({length:i.training.days},(_,n)=>({name:'Sesión '+(n+1),exercises:[{name:'Sentadilla con peso corporal',sets:2,reps_min:8,reps_max:12,rir:3,rest_seconds:90},{name:'Peso muerto rumano con mancuernas',sets:2,reps_min:10,reps_max:12,rir:3,rest_seconds:90}]}))}};t.coach_operations.push(o);demoPersist();return demoResult({operation:o});
};
addEventListener('message',async event=>{if(event.origin!==location.origin)return;if(event.data==='demo-reviewer'){pilotDemoReviewer=true;await openCoachReviewer();}if(event.data==='demo-athlete'){pilotDemoReviewer=false;await openSimpleCoach();}if(event.data==='demo-reset'){sessionStorage.removeItem('coach-v2-synthetic');location.reload();}});
