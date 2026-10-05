const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{f,rpc,read,req,check,rows}=require('./live.cjs');const ids=require('./private/mock-ids.json'),dir=path.join(__dirname,'results');
const sets=(revision,eid)=>revision.snapshot.days.flatMap(d=>d.exercises).find(e=>e.id===eid).planned_sets;
async function main(){
for(const tag of ['L','M']){const rec=(await read('mock','coach_recommendations','id=eq.'+ids[tag])).data[0];check(tag+' persisted REVIEW',rec.state==='pending_review'&&rec.kind==='REVIEW'&&rec.patches.length===0);if(tag==='M')check('unsafe output routed to human problem',!!rec.analysis_trace.review_issue);check(tag+' owner cannot apply',(await rpc('mock','premium_accept_recommendation',{p_id:ids[tag]})).ok===false);check(tag+' reviewer must resolve first',!(await rpc('reviewer','premium_review_recommendation',{p_id:ids[tag],p_approve:true,p_reason:'Do not approve unresolved review.'})).ok);}
for(const w of ['mock','real','trainer',null])check((w||'anon')+' cannot resolve REVIEW',!(await rpc(w,'premium_resolve_review',{p_id:ids.L,p_kind:'KEEP',p_patches:[],p_reason:'Forbidden'})).ok);
check('scoped reviewer resolves L',(await rpc('reviewer','premium_resolve_review',{p_id:ids.L,p_kind:'KEEP',p_patches:[],p_reason:'Insufficient history; human chooses KEEP without claiming a trend.'})).ok);check('owner accepts human resolution',(await rpc('mock','premium_accept_recommendation',{p_id:ids.L})).ok);
for(const tag of ['I','J','K','N','O','P']){
const c=f.cases[tag],old=(await read('mock','routine_revisions','routine_id=eq.'+c.routine)).data;assert(old?.length===1);
for(const w of ['mock','real','trainer',null])check(tag+' '+(w||'anon')+' cannot approve',!(await rpc(w,'premium_review_recommendation',{p_id:ids[tag],p_approve:true,p_reason:'Forbidden'})).ok);
check(tag+' assigned reviewer approves',(await rpc('reviewer','premium_review_recommendation',{p_id:ids[tag],p_approve:true,p_reason:'Synthetic test: exact series and old history inspected.'})).ok);
const a=await Promise.all([1,2].map(()=>rpc('mock','premium_accept_recommendation',{p_id:ids[tag]})));if(!a.every(x=>x.ok))throw Error(tag+' accept '+JSON.stringify(a.map(x=>({ok:x.ok,message:x.data?.message}))));check(tag+' double acceptance same revision',a[0].data===a[1].data);
const revs=(await read('mock','routine_revisions','routine_id=eq.'+c.routine)).data;
check(tag+' old N byte-for-byte intact',require('util').isDeepStrictEqual(old[0],revs.find(r=>r.id===c.revision)));
check(tag+' revision count',revs.length===(tag==='N'?1:2));
if(['I','J','K'].includes(tag)){
const next=revs.find(r=>r.id!==c.revision),expected=structuredClone(c.plans[0]);if(tag==='I'){expected.splice(1,1);expected[1].set_number=2;}if(tag==='J')expected.push({set_number:3,reps_min:10,reps_max:12,rir:1,rest_seconds:240});if(tag==='K')expected[1].rest_seconds=240;
check(tag+' exact persisted per-set result',require('util').isDeepStrictEqual(sets(next,c.exercises[0]),expected));
for(let i=1;i<4;i++)check(tag+' untouched exercise '+(i+1),require('util').isDeepStrictEqual(sets(next,c.exercises[i]),c.plans[i]));
check(tag+' UUID day order retained',next.snapshot.days.every((d,i)=>d.id===c.days[i]&&d.exercises.every((e,z)=>e.id===c.exercises[i*2+z]&&e.exercise_order===z)));
check(tag+' top/back-off scheme retained',next.snapshot.days[0].exercises[0].scheme==='top_backoff');
const ctx=(await rpc('mock','premium_provider_context',{p_mesocycle:c.mesocycle})).data;check(tag+' Premium over V5 continues exact plan',require('util').isDeepStrictEqual(ctx.routine.exercises[0].planned_sets,expected));check(tag+' old workout targets remain old revision',ctx.routine.exercises[0].exposures[0].sets[1].planned.rest_seconds===c.plans[0][1].rest_seconds);
}
check(tag+' workout UUID count preserved',(await read('mock','workouts','id=in.('+c.workouts.join(',')+')')).data.length===c.workouts.length);
}
check('reviewer no global workouts',(await read('reviewer','workouts','user_id=eq.'+f.users.mock.id)).data.length===0);
check('other client cannot see recommendations',(await read('real','coach_recommendations','id=eq.'+ids.M)).data.length===0);
check('trainer cannot see recommendations',(await read('trainer','coach_recommendations','id=eq.'+ids.M)).data.length===0);
check('owner cannot rewrite N',!(await req('mock','/rest/v1/routine_revisions?id=eq.'+f.cases.I.revision,{reason:'overwrite'},'PATCH')).ok);
check('owner cannot edit managed scalar',!(await req('mock','/rest/v1/routine_exercises?id=eq.'+f.cases.I.exercises[0],{sets:9},'PATCH')).ok);
check('owner cannot forge analysis finish',!(await rpc('mock','premium_analysis_finish',{p_user:f.users.mock.id,p_id:ids.M,p_output:null,p_error:null,p_receipt:{},p_warnings:[]})).ok);
}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>{fs.writeFileSync(path.join(dir,'functional.json'),JSON.stringify({rows,total:rows.length,completed:!process.exitCode},null,2));console.log(rows.filter(r=>r.pass).length+'/'+rows.length+' per-set JWT and persistence checks');});
