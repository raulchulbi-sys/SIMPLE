const fs=require('fs'),path=require('path'),f=require('./private/fixture.json'),dir=path.join(__dirname,'private'),q=x=>"'"+x+"'";
const u=f.users.mock.id,F=f.cases.F,H=f.cases.H;
const checks=[];const check=(name,sql)=>{checks.push(name);return `if not coalesce((${sql}),false) then raise exception 'failed ${name}';end if;checks:=checks||jsonb_build_object('${name}',true);\n`;};
let sql=`begin;do $test$ declare r public.coach_recommendations;h public.coach_recommendations;v jsonb;checks jsonb:='{}';denied boolean;begin
perform set_config('request.jwt.claim.sub','${u}',true);
r:=public.premium_reserve_analysis('${F.mesocycle}',gen_random_uuid());
`+check('mock claim succeeds',`(public.premium_analysis_claim('${u}',r.id,100,'mock')->>'claimed')::boolean`)+check('second dispatch claim refused',`not(public.premium_analysis_claim('${u}',r.id,100,'mock')->>'claimed')::boolean`)+`
h:=public.premium_reserve_analysis('${H.mesocycle}',gen_random_uuid());
update coach_private.premium_analysis_budget set dispatched=12 where id;
denied:=false;begin perform public.premium_analysis_claim('${u}',h.id,100,'openai');exception when others then denied:=sqlerrm='premium_budget_exhausted';end;
`+check('call quota exhausted blocks dispatch','denied')+`
update coach_private.premium_analysis_budget set dispatched=10,charged_usd=.499 where id;
denied:=false;begin perform public.premium_analysis_claim('${u}',h.id,100,'openai');exception when others then denied:=sqlerrm='premium_budget_exhausted';end;
`+check('cost reservation blocks overspend','denied')+`
update coach_private.premium_analysis_budget set charged_usd=.1077695 where id;
perform public.premium_analysis_claim('${u}',h.id,100,'mock');
v:=jsonb_build_object('schema_version','premium-recommendation-v1','kind','KEEP','facts',jsonb_build_array(jsonb_build_object('exercise_ref',r.analysis_bundle#>'{provider,routine,exercises,0,ref}','claim',r.analysis_bundle#>'{provider,routine,exercises,0,metrics,trend}')), 'interpretation','Synthetic controlled validation.','reason','Keep without changes.','confidence','low','changes','[]'::jsonb);
update public.context_grants set revoked_at=now() where user_id='${u}' and scope='premium_training_history';
r:=public.premium_analysis_finish('${u}',r.id,v,null,'{}','[]');
`+check('late response after consent revocation superseded',`r.state='superseded' and r.analysis_trace->>'error'='consent_revoked_or_inactive'`)+check('revocation retains context snapshot',`r.analysis_bundle#>>'{provider,schema_version}'='premium-provider-v1'`)+`
denied:=false;begin perform public.premium_provider_context('${F.mesocycle}');exception when others then denied:=true;end;
`+check('new context denied after revocation','denied')+`
update public.context_grants set revoked_at=null where user_id='${u}' and scope='premium_training_history';
update public.coach_mesocycles set tracking_week=5 where id='${H.mesocycle}';
h:=public.premium_analysis_finish('${u}',h.id,v,null,'{}','[]');
`+check('late response stale week superseded',`h.state='superseded' and h.analysis_trace->>'error'='stale_revision'`)+check('mock finishes do not add cost',`(select dispatched=10 and charged_usd=.1077695 and reserved_usd=0 from coach_private.premium_analysis_budget where id)`)+`
update coach_private.premium_analysis_budget set enabled=false where id;
denied:=false;begin perform public.premium_reserve_analysis('${F.mesocycle}',gen_random_uuid());exception when others then denied:=sqlerrm='premium_pilot_closed';end;
`+check('closed pilot prevents reservation','denied')+`
perform set_config('test.premium_results',checks::text,true);end $test$;
select current_setting('test.premium_results')::jsonb checks;rollback;`;
fs.writeFileSync(path.join(dir,'lifecycle.sql'),sql);
const items={
 'all 58 fixture workouts retained':`(select count(*)=58 from public.workouts where id in (${Object.values(f.cases).flatMap(x=>x.workouts).map(q).join(',')}))`,
 'all original snapshot hashes valid':`(select bool_and(snapshot_hash=md5(snapshot::text)) from public.routine_revisions where routine_id in (${Object.values(f.cases).map(x=>q(x.routine)).join(',')}))`,
 'original snapshots preserve 3 sets':`(select bool_and((e->>'sets')::int=3 and e->>'target'='8-12' and e->>'rir'='2') from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where v.routine_id in (${Object.values(f.cases).map(x=>q(x.routine)).join(',')}) and v.revision_no=1)`,
 'replacement model provenance':`exists(select 1 from public.routine_revisions where routine_id='${F.routine}' and revision_no=2 and author_kind='model')`,
 'replacement old UUID absent live':`not exists(select 1 from public.routine_exercises where id='${F.exercises[0]}')`,
 'replacement old UUID retained history':`(select count(*)=4 from public.workouts w cross join lateral jsonb_array_elements(w.data->'exercises')e where w.data->>'routine_id'='${F.routine}' and e->>'exercise_id'='${F.exercises[0]}')`,
 'replacement no inherited history':`not exists(select 1 from public.workouts w cross join lateral jsonb_array_elements(w.data->'exercises')e where e->>'exercise_id' in (select id::text from public.routine_exercises where day_id='${F.days[0]}' and id<>'${F.exercises[1]}'))`,
 'KEEP three weeks completed no new revision':`(select tracking_week=4 and current_revision_id=initial_revision_id from public.coach_mesocycles where id='${H.mesocycle}') and (select count(*)=3 from public.coach_mesocycle_weeks where mesocycle_id='${H.mesocycle}' and state='completed')`,
 'old F week preserves baseline':`(select revision_id='${F.revision}'::uuid from public.coach_mesocycle_weeks where mesocycle_id='${F.mesocycle}' and week_number=1)`,
 'legacy calendar F future weeks new revision':`(select bool_and(w.revision_id=m.current_revision_id) from public.coach_mesocycle_weeks w join public.coach_mesocycles m on m.id=w.mesocycle_id where m.id='${F.mesocycle}' and w.week_number>=4)`,
 'replacement catalogue mapping updated':`(select not(catalogue_bindings ? '${F.exercises[0]}') and catalogue_bindings @> (select jsonb_object_agg(id,'band_curl') from public.routine_exercises where day_id='${F.days[0]}' and id<>'${F.exercises[1]}') from public.coach_mesocycles where id='${F.mesocycle}')`,
 'no apply transaction flag leaked':`not exists(select 1 from public.coach_recommendations where apply_txid is not null)`,
 'private budget no client privileges':`not has_table_privilege('authenticated','coach_private.premium_analysis_budget','SELECT') and not has_table_privilege('anon','coach_private.premium_analysis_budget','SELECT')`,
 'private helpers no client execute':`not has_function_privilege('authenticated','coach_private.premium_output_patches(public.coach_recommendations,jsonb)','EXECUTE')`,
 'public RPCs fixed SECURITY DEFINER path':`(select bool_and(prosecdef and proconfig @> array['search_path=pg_catalog, public']) from pg_proc where oid in ('public.premium_analysis_claim(uuid,uuid,integer,text)'::regprocedure,'public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb)'::regprocedure,'public.premium_reserve_analysis(uuid,uuid)'::regprocedure))`
};
fs.writeFileSync(path.join(dir,'invariants.sql'),'select jsonb_build_object('+Object.entries(items).map(([k,v])=>q(k)+',('+v+')').join(',\n')+') checks;');
const routines=Object.values(f.cases).map(x=>q(x.routine)).join(','),days=Object.values(f.cases).flatMap(x=>x.days).map(q).join(','),workouts=Object.values(f.cases).flatMap(x=>x.workouts).map(q).join(',');
fs.writeFileSync(path.join(dir,'cleanup.sql'),`begin;
do $$ begin if (select count(*) from public.routines where id in (${routines}) and owner_id='${u}' and name like 'SYNTHETIC Premium Phase2%')<>8 then raise exception 'cleanup_fixture_identity_mismatch';end if;end $$;
set constraints premium_revision_rec_fk deferred;
delete from public.coach_mesocycle_weeks where routine_id in (${routines});
delete from public.coach_recommendations where routine_id in (${routines});
delete from public.coach_mesocycles where routine_id in (${routines});
delete from public.routine_management where routine_id in (${routines}) and plan_kind='premium';
delete from public.routine_revisions where routine_id in (${routines}) and origin<>'basic';
delete from public.workouts where id in (${workouts}) and user_id='${u}';
delete from public.routine_exercises where day_id in (${days});
delete from public.routine_days where routine_id in (${routines});
delete from public.routines where id in (${routines}) and owner_id='${u}' and name like 'SYNTHETIC Premium Phase2%';
delete from public.context_grants where id in (${f.grants.map(q).join(',')}) and user_id='${u}' and scope='premium_training_history';
update coach_private.premium_analysis_budget set enabled=false where id;
commit;`);
console.log('Generated lifecycle, invariants and guarded exact-ID cleanup.');
