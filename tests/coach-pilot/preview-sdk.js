// Explicitly synthetic, offline preview. Never used by the live/staging application.
const pilotDemoRpc=demoClient.rpc,pilotDemoInvoke=demoClient.functions.invoke;
let pilotDemoReviewer=false;
demoClient.rpc=async(name,p={})=>{
 if(name==='get_coach_reviewer_access')return demoResult(pilotDemoReviewer);
 if(name==='get_coach_review_queue')return pilotDemoReviewer?demoResult(mock.tables.coach_operations.map(o=>({operation:o,athlete:{name:'Atleta ficticio'},training:mock.tables.training_intakes.find(i=>i.id===o.intake_id)?.training,health:mock.tables.intake_health.find(i=>i.intake_id===o.intake_id)?.declarations}))):demoResult(null,{message:'coach_reviewer_required'});
 if(name==='get_coach_pilot_metrics')return pilotDemoReviewer?demoResult({authorized:1,generations:mock.tables.coach_operations.length}):demoResult(null,{message:'coach_reviewer_required'});
 if(name==='review_coach_proposal'){
  if(!pilotDemoReviewer)return demoResult(null,{message:'coach_reviewer_required'});
  const o=mock.tables.coach_operations.find(x=>x.id===p.p_operation);o.state=p.p_approve?'ready':'rejected';o.review_reason=p.p_reason;o.reviewed_at=new Date().toISOString();return demoResult(o);
 }
 if(name==='authorize_coach_retry'){const o=mock.tables.coach_operations.find(x=>x.id===p.p_operation);o.retry_authorized_at=new Date().toISOString();return demoResult(true);}
 if(name==='decline_my_coach_proposal'){const o=mock.tables.coach_operations.find(x=>x.id===p.p_operation);o.state='athlete_declined';o.athlete_comment=p.p_comment;return demoResult(true);}
 if(name==='save_my_coach_feedback'){
  if(!mock.tables.workouts.some(w=>w.data?.routine_id===p.p_routine))return demoResult(null,{message:'coach_feedback_workout_required'});
  const all=mock.tables.coach_pilot_feedback??=[],old=all.find(x=>x.routine_id===p.p_routine),f={...(old||{id:crypto.randomUUID()}),user_id:demoUser,routine_id:p.p_routine,rating:p.p_rating,comment:p.p_comment};if(old)Object.assign(old,f);else all.push(f);return demoResult(f);
 }
 const r=await pilotDemoRpc(name,p);if(name==='get_my_coach_access'&&r.data)r.data.can_feedback=!!r.data.routine_id&&mock.tables.workouts.some(w=>w.user_id===demoUser&&w.data?.routine_id===r.data.routine_id);if(name==='set_my_coach_context_permission')for(const g of mock.tables.context_grants)g.notice_version='pilot-supervised-v1';return r;
};
demoClient.functions.invoke=async(...args)=>{const r=await pilotDemoInvoke(...args);if(r.data?.operation){r.data.operation.state='pending_review';mock.tables.coach_operations.find(x=>x.id===r.data.operation.id).state='pending_review';}return r;};
addEventListener('message',async event=>{if(event.origin!==location.origin)return;if(event.data==='demo-reviewer'){pilotDemoReviewer=true;await openCoachReviewer();}if(event.data==='demo-athlete'){pilotDemoReviewer=false;await openSimpleCoach();}});
