const fs=require('fs'),path=require('path'),f=require('./private/fixture.json'),dir=path.join(__dirname,'private'),u=f.users.mock.id,reviewer=f.users.reviewer.id,G=f.cases.G,F=f.cases.F;
const check=(name,v)=>`if not coalesce((${v}),false) then raise exception '${name}';end if;checks:=checks||jsonb_build_object('${name}',true);\n`;
let sql=`begin;do $test$ declare r public.coach_recommendations;v jsonb;a uuid;b uuid;n int;denied boolean;checks jsonb:='{}';begin
perform set_config('request.jwt.claim.sub','${u}',true);
update public.coach_recommendations set state='rejected' where id='${G.real_rec}' and state='pending_review';
r:=public.premium_reserve_analysis('${G.mesocycle}',gen_random_uuid());perform public.premium_analysis_claim('${u}',r.id,100,'mock');
v:=jsonb_build_object('schema_version','premium-recommendation-v1','kind','MODIFY','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',r.analysis_bundle#>'{provider,routine,exercises,0,metrics,trend}')),'interpretation','Controlled volume test.','reason','Reduce one redundant series; no inferred causal diagnosis.','confidence','medium','changes','[{"action":"change_sets","exercise_ref":"exercise_1","from":3,"to":2}]'::jsonb);
r:=public.premium_analysis_finish('${u}',r.id,v,null,'{}','[]');
${check('mock G volume output pending human review',"r.kind='MODIFY' and r.state='pending_review'")}
perform set_config('request.jwt.claim.sub','${reviewer}',true);perform public.premium_review_recommendation(r.id,true,'Controlled synthetic volume review.');
perform set_config('request.jwt.claim.sub','${u}',true);a:=public.premium_accept_recommendation(r.id);b:=public.premium_accept_recommendation(r.id);
${check('final acceptance idempotent','a=b')}
${check('final MODIFY exactly one new revision',`(select count(*)=2 from public.routine_revisions where routine_id='${G.routine}')`)}
${check('past tracking week preserved',`(select revision_id='${G.revision}'::uuid and state='completed' from public.coach_mesocycle_weeks where mesocycle_id='${G.mesocycle}' and week_number=1)`)}
${check('future tracking weeks match active revision',`(select bool_and(revision_id=a) from public.coach_mesocycle_weeks where mesocycle_id='${G.mesocycle}' and week_number>1)`)}
${check('tracking advances exactly once',`(select tracking_week=2 and current_revision_id=a from public.coach_mesocycles where id='${G.mesocycle}')`)}
${check('volume persisted with same UUID',`(select sets=2 from public.routine_exercises where id='${G.exercises[0]}')`)}
${check('other exercise sets unchanged',`(select bool_and(sets=3) from public.routine_exercises where id in ('${G.exercises[1]}','${G.exercises[2]}','${G.exercises[3]}'))`)}
select count(*) into n from public.routine_revisions where routine_id='${F.routine}';
r:=public.premium_reserve_analysis('${F.mesocycle}',gen_random_uuid());perform public.premium_analysis_claim('${u}',r.id,100,'mock');
v:=jsonb_build_object('schema_version','premium-recommendation-v1','kind','REVIEW','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',r.analysis_bundle#>'{provider,routine,exercises,0,metrics,trend}')),'interpretation','Controlled manual review.','reason','Insufficient data; human resolution.','confidence','low','changes','[]'::jsonb);
r:=public.premium_analysis_finish('${u}',r.id,v,null,'{}','[]');
denied:=false;begin perform public.premium_accept_recommendation(r.id);exception when others then denied:=true;end;
${check('structured REVIEW cannot self accept','denied')}
perform set_config('request.jwt.claim.sub','${reviewer}',true);perform public.premium_resolve_review(r.id,'KEEP','[]','Human resolution: keep.');
perform set_config('request.jwt.claim.sub','${u}',true);a:=public.premium_accept_recommendation(r.id);
${check('REVIEW resolution KEEP no empty revision',`(select count(*)=n from public.routine_revisions where routine_id='${F.routine}')`)}
${check('original structured REVIEW retained',`(select analysis_trace#>>'{output,kind}'='REVIEW' and analysis_trace->>'manual_resolution'='KEEP' and state='accepted' from public.coach_recommendations where id=r.id)`)}
r:=public.premium_reserve_analysis('${F.mesocycle}',gen_random_uuid());perform public.premium_analysis_claim('${u}',r.id,100,'mock');
r:=public.premium_analysis_finish('${u}',r.id,v||'{"extra":"forged"}'::jsonb,null,'{}','[]');
${check('invalid output stored but not approvable',"r.state='invalid' and r.patches='[]'::jsonb")}
r:=public.premium_reserve_analysis('${F.mesocycle}',gen_random_uuid());perform public.premium_analysis_claim('${u}',r.id,100,'mock');
r:=public.premium_analysis_finish('${u}',r.id,null,'provider_http_500','{}','[]');
${check('provider failure cannot be a valid recommendation',"r.state='failed' and r.patches='[]'::jsonb")}
${check('final test never dispatches or charges AI',"(select dispatched=10 and charged_usd=.1077695 and reserved_usd=0 from coach_private.premium_analysis_budget where id)")}
perform set_config('test.premium_results',checks::text,true);end $test$;select current_setting('test.premium_results')::jsonb checks;rollback;`;
fs.writeFileSync(path.join(dir,'tracking.sql'),sql);
