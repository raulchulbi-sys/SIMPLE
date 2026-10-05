const fs=require('fs'),path=require('path'),{f,j,q,write}=require('./live.cjs');
const contexts=require('./private/contexts.json');const outputs={};
function base(tag,kind,changes=[]){return{schema_version:'premium-recommendation-v2',kind,facts:[{exercise_ref:'exercise_1',claim:contexts[tag].routine.exercises[0].metrics.trend}],interpretation:'Comprobación sintética controlada; no inferir causas.',reason:'Contexto y series inspeccionados explícitamente.',confidence:'low',changes};}
const strip=s=>{s={...s};delete s.set_number;return s;};
outputs.I=base('I','MODIFY',[{action:'remove_set',exercise_ref:'exercise_1',set_number:2,from:strip(f.cases.I.plans[0][1])}]);
outputs.J=base('J','MODIFY',[{action:'add_set',exercise_ref:'exercise_1',set_number:3,to:{reps_min:10,reps_max:12,rir:1,rest_seconds:240}}]);
outputs.K=base('K','MODIFY',[{action:'change_set',exercise_ref:'exercise_1',set_number:2,from:strip(f.cases.K.plans[0][1]),to:{...strip(f.cases.K.plans[0][1]),rest_seconds:240}}]);
for(const tag of ['L','M'])outputs[tag]=base(tag,'REVIEW');outputs.N=base('N','KEEP');outputs.O={...base('O','MODIFY',[{action:'change_sets',exercise_ref:'exercise_1',from:3,to:2}]),schema_version:'premium-recommendation-v1'};outputs.P=base('P','MODIFY',[{action:'change_set',exercise_ref:'exercise_1',set_number:1,from:strip(f.cases.P.plans[0][0]),to:{...strip(f.cases.P.plans[0][0]),rir:2}}]);
write('outputs.json',outputs);
let sql=`begin;do $test$ declare rec public.coach_recommendations;res public.coach_recommendations;v jsonb;patch jsonb;before jsonb;after jsonb;rev uuid;checks jsonb:='{}';denied boolean;begin\n`;
const check=(name,expr)=>`if not coalesce((${expr}),false) then raise exception 'failed ${name}';end if;checks:=checks||jsonb_build_object(${q(name)},true);\n`;
for(const[tag,v]of Object.entries(outputs)){
const c=f.cases[tag];sql+=`perform set_config('request.jwt.claim.sub','${f.users.mock.id}',true);rec:=public.premium_reserve_analysis('${c.mesocycle}',gen_random_uuid());v:=${j(v)};patch:=coach_private.premium_output_patches(rec,v);\n`+check(tag+' deterministic output contract','jsonb_typeof(patch)=\'array\'');
if(['I','J','K'].includes(tag)){
const invalid=structuredClone(v);if(tag==='I')invalid.changes[0].set_number=8;if(tag==='J')delete invalid.changes[0].to.rest_seconds;if(tag==='K')invalid.changes[0].from.rir=4;
sql+=`denied:=false;begin perform coach_private.premium_output_patches(rec,${j(invalid)});exception when others then denied:=true;end;\n`+check(tag+' malformed missing stale set denied','denied');
}
sql+=`perform public.premium_analysis_claim('${f.users.mock.id}',rec.id,100,'mock');res:=public.premium_analysis_finish('${f.users.mock.id}',rec.id,v,null,'{}','[]');\n`+check(tag+' persisted pending human review',`res.state='pending_review' and res.kind=${q(v.kind)}`);
if(v.kind==='REVIEW'){
sql+=`denied:=false;begin perform public.premium_accept_recommendation(res.id);exception when others then denied:=true;end;\n`+check(tag+' REVIEW owner cannot apply','denied');continue;
}
sql+=`select snapshot into before from public.routine_revisions where id='${c.revision}';perform set_config('request.jwt.claim.sub','${f.users.reviewer.id}',true);perform public.premium_review_recommendation(res.id,true,'Synthetic series check');perform set_config('request.jwt.claim.sub','${f.users.mock.id}',true);rev:=public.premium_accept_recommendation(res.id);select snapshot into after from public.routine_revisions where id=rev;\n`+check(tag+' N intact',`(select snapshot=before from public.routine_revisions where id='${c.revision}')`);
if(v.kind==='KEEP')sql+=check(tag+' KEEP no new revision',`rev='${c.revision}'::uuid`);else sql+=check(tag+' MODIFY exactly N+1',`rev<>'${c.revision}'::uuid and (select revision_no=2 from public.routine_revisions where id=rev)`);
if(['I','J','K'].includes(tag)){
const C=(ss,cs)=>{let out=structuredClone(ss);for(const x of cs){if(x.action==='remove_set')out=out.filter(s=>s.set_number!==x.set_number).map((s,i)=>({...s,set_number:i+1}));if(x.action==='add_set')out.push({...x.to,set_number:x.set_number});if(x.action==='change_set')out[x.set_number-1]={...x.to,set_number:x.set_number};}return out;};
sql+=check(tag+' exact resulting sets',`coach_private.premium_revision_sets(rev,'${c.exercises[0]}')=${j(C(c.plans[0],v.changes))}`)+check(tag+' untouched exercise exact plan',`coach_private.premium_revision_sets(rev,'${c.exercises[1]}')=${j(c.plans[1])}`);
}
}
sql+=`perform set_config('test.series_results',checks::text,true);end $test$;select current_setting('test.series_results')::jsonb checks;rollback;`;write('deterministic.sql',sql);
// Persistence/JWT stage after new real calls: existing real recommendations are explicitly rejected, never silently accepted.
let persisted='begin;do $test$ declare rec public.coach_recommendations;res public.coach_recommendations;ids jsonb:=\'{}\';begin\n';
for(const[tag,v0]of Object.entries(outputs)){const c=f.cases[tag];const v=tag==='M'?{...v0,kind:'MODIFY',changes:[{action:'change_set',exercise_ref:'exercise_1',set_number:99,from:strip(c.plans[0][0]),to:{...strip(c.plans[0][0]),rir:2}}]}:v0;
persisted+=`update public.coach_recommendations set state='rejected',review_reason='Real output retained; deterministic structural acceptance test follows.' where mesocycle_id='${c.mesocycle}' and state='pending_review';perform set_config('request.jwt.claim.sub','${f.users.mock.id}',true);rec:=public.premium_reserve_analysis('${c.mesocycle}',gen_random_uuid());perform public.premium_analysis_claim('${f.users.mock.id}',rec.id,100,'mock');res:=public.premium_analysis_finish('${f.users.mock.id}',rec.id,${j(v)},null,'{}','[]');ids:=ids||jsonb_build_object('${tag}',res.id);\n`;
}persisted+=`perform set_config('test.series_ids',ids::text,true);end $test$;select current_setting('test.series_ids')::jsonb ids;commit;`;write('persisted.sql',persisted);
console.log('Generated deterministic transaction rollback and persisted mock tests');
