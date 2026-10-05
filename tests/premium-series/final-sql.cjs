const {f,q,j,write}=require('./live.cjs');const u=f.users.mock.id,K=f.cases.K,M=f.cases.M,I=f.cases.I;
const check=(name,sql)=>`if not coalesce((${sql}),false) then raise exception 'failed ${name}';end if;checks:=checks||jsonb_build_object(${q(name)},true);\n`;
let sql=`begin;do $test$ declare r public.coach_recommendations;s public.coach_recommendations;v jsonb;c jsonb;checks jsonb:='{}';denied boolean;cost_before numeric;calls_before int;begin
select charged_usd,dispatched into cost_before,calls_before from coach_private.premium_analysis_budget where id;
perform set_config('request.jwt.claim.sub','${u}',true);r:=public.premium_reserve_analysis('${K.mesocycle}',gen_random_uuid());
`+check('first mock dispatch claimed',`(public.premium_analysis_claim('${u}',r.id,100,'mock')->>'claimed')::boolean`)+check('duplicate mock dispatch not claimed',`not (public.premium_analysis_claim('${u}',r.id,100,'mock')->>'claimed')::boolean`)+`
v:=jsonb_build_object('schema_version','premium-recommendation-v2','kind','KEEP','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',r.analysis_bundle#>>'{provider,routine,exercises,0,metrics,trend}')),'interpretation','Controlled lifecycle test.','reason','No unsupported causal inference.','confidence','low','changes','[]'::jsonb);
update public.coach_mesocycles set tracking_week=tracking_week+1 where id='${K.mesocycle}';s:=public.premium_analysis_finish('${u}',r.id,v,null,'{}','[]');
`+check('late stale week response superseded',`s.state='superseded' and s.patches='[]'::jsonb and s.analysis_trace->>'error'='stale_revision'`)+`
r:=public.premium_reserve_analysis('${K.mesocycle}',gen_random_uuid());perform public.premium_analysis_claim('${u}',r.id,100,'mock');update public.context_grants set revoked_at=now() where id='${f.grants[0].id}';s:=public.premium_analysis_finish('${u}',r.id,v,null,'{}','[]');
`+check('late revoked consent response superseded',`s.state='superseded' and s.analysis_trace->>'error'='consent_revoked_or_inactive'`)+`
update public.context_grants set revoked_at=null where id='${f.grants[0].id}';r:=public.premium_reserve_analysis('${K.mesocycle}',gen_random_uuid());update coach_private.premium_analysis_budget set dispatched=16 where id;denied:=false;begin perform public.premium_analysis_claim('${u}',r.id,100,'openai');exception when others then denied:=sqlerrm='premium_budget_exhausted';end;
`+check('additional six call ceiling server enforced','denied')+`
update coach_private.premium_analysis_budget set dispatched=calls_before,charged_usd=max_usd-.001 where id;denied:=false;begin perform public.premium_analysis_claim('${u}',r.id,100,'openai');exception when others then denied:=sqlerrm='premium_budget_exhausted';end;
`+check('cost reserve blocks overspend without HTTP dispatch','denied')+`
update coach_private.premium_analysis_budget set charged_usd=cost_before,enabled=false where id;denied:=false;begin perform public.premium_reserve_analysis('${M.mesocycle}',gen_random_uuid());exception when others then denied:=sqlerrm='premium_pilot_closed';end;
`+check('closed budget blocks new analysis','denied')+`
update public.workouts set data=jsonb_set(data,'{exercises,0,sets}',jsonb_build_array(data#>'{exercises,0,sets,2}',data#>'{exercises,0,sets,0}')) where id='${I.workouts.at(-2)}';c:=coach_private.premium_bundle('${I.mesocycle}','${u}')#>'{provider,routine,exercises,0,exposures,0}';
`+check('sparse reordered performed S3 maps historical S3',`c#>>'{sets,0,set_number}'='3' and c#>>'{sets,0,planned,reps_min}'='10'`)+check('missing performed set recognized',`c->>'prescription_source'='set_count_mismatch'`)+`
update public.workouts set data=jsonb_set(data,'{exercises,0,sets,0,set}','1') where id='${I.workouts.at(-2)}';c:=coach_private.premium_bundle('${I.mesocycle}','${u}')#>'{provider,routine,exercises,0,exposures,0}';
`+check('duplicate set identity never arbitrarily aligned',`c#>'{sets,0,planned}'='null'::jsonb and c#>'{sets,1,planned}'='null'::jsonb`)+check('strict unknown structure validator',`not coach_private.premium_sets_valid('[{"set_number":1,"reps_min":8}]')`)+check('numeric integer closed schema',`not coach_private.premium_sets_valid('[{"set_number":1,"reps_min":"8","reps_max":12,"rir":2,"rest_seconds":120}]')`)+check('mock lifecycle no additional charge',`(select charged_usd=cost_before and dispatched=calls_before and reserved_usd=0 from coach_private.premium_analysis_budget where id)`)+`
perform set_config('test.series_lifecycle',checks::text,true);end $test$;select current_setting('test.series_lifecycle')::jsonb checks;rollback;`;write('lifecycle.sql',sql);
const routines=Object.values(f.cases).map(c=>q(c.routine)).join(','),days=Object.values(f.cases).flatMap(c=>c.days).map(q).join(','),workouts=Object.values(f.cases).flatMap(c=>c.workouts).map(q).join(',');
const invariants={
'original workout UUID count retained':`(select count(*)=58 from public.workouts where id in(${workouts}))`,
'all snapshot hashes consistent':`(select bool_and(snapshot_hash=md5(snapshot::text)) from public.routine_revisions where routine_id in(${routines}))`,
'all initial individualized plans retained':`(select count(*)=8 from public.routine_revisions where routine_id in(${routines}) and revision_no=1)`,
'no transaction flag leaked':`not exists(select 1 from public.coach_recommendations where routine_id in(${routines}) and apply_txid is not null)`,
'no active analysis reservation':`(select reserved_usd=0 and dispatched=14 and charged_usd=.194317 from coach_private.premium_analysis_budget where id)`,
'no client private helper execution':`not has_function_privilege('authenticated','coach_private.premium_revision_sets(uuid,uuid)','EXECUTE') and not has_function_privilege('anon','coach_private.premium_output_patches(public.coach_recommendations,jsonb)','EXECUTE')`,
'no global reviewer workout policy change':`not has_table_privilege('authenticated','coach_private.premium_analysis_budget','SELECT')`,
'new wrappers secured fixed path':`(select bool_and(prosecdef and proconfig @> array['search_path=pg_catalog, public']) from pg_proc where oid in('coach_private.premium_bundle(uuid,uuid)'::regprocedure,'coach_private.premium_output_patches(public.coach_recommendations,jsonb)'::regprocedure,'coach_private.premium_check_patch(jsonb,uuid,boolean)'::regprocedure,'coach_private.premium_snapshot(uuid)'::regprocedure))`
};write('invariants.sql','select jsonb_build_object('+Object.entries(invariants).map(([k,v])=>q(k)+',('+v+')').join(',')+') checks;');
write('cleanup.sql',`begin;do $$ begin if(select count(*) from public.routines where id in(${routines}) and owner_id='${u}' and name like 'SYNTHETIC Premium Series %')<>8 then raise exception 'fixture_identity_mismatch';end if;end $$;
set constraints premium_revision_rec_fk deferred;
delete from public.coach_mesocycle_weeks where routine_id in(${routines});
delete from public.coach_recommendations where routine_id in(${routines});
delete from public.coach_mesocycles where routine_id in(${routines});
delete from public.routine_management where routine_id in(${routines}) and plan_kind='premium';
delete from public.routine_revisions where routine_id in(${routines}) and origin<>'basic';
delete from public.workouts where id in(${workouts}) and user_id='${u}';
delete from public.routine_exercises where day_id in(${days});delete from public.routine_days where routine_id in(${routines});delete from public.routines where id in(${routines}) and owner_id='${u}';
delete from public.context_grants where id='${f.grants[0].id}' and user_id='${u}' and scope='premium_training_history' and created_at='${f.grants[0].created_at}';
update coach_private.premium_analysis_budget set enabled=false where id;commit;`);
console.log('Generated lifecycle and guarded exact-ID cleanup; not executed');
