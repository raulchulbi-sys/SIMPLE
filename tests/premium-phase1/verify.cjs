// Build read-only invariants and the exact-ID cleanup from the private manifest.
const fs=require('fs'),path=require('path');const dir=path.join(__dirname,'private'),f=require('./private/fixture.json');
const r=f.routine,m=f.mesocycle,u=f.users.mock.id;
const items={
 'four revisions exactly':`(select count(*)=4 from public.routine_revisions where routine_id='${r}')`,
 'revision one unchanged prescription':`(select bool_and((e->>'sets')::int=3 and e->>'target'='8-12' and e->>'rir'='2' and (e->>'rest_seconds')::int=180 and e->>'notes'='PRIVATE NOTE CANARY') from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where v.routine_id='${r}' and v.revision_no=1)`,
 'snapshot hashes valid':`(select bool_and(snapshot_hash=md5(snapshot::text)) from public.routine_revisions where routine_id='${r}')`,
 'revision2 reduces only target sets':`(select bool_and((e->>'sets')::int=case when e->>'id'='${f.exercises[2]}' then 2 else 3 end) from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where v.routine_id='${r}' and v.revision_no=2)`,
 'two days no duplication':`(select count(*)=2 from public.routine_days where routine_id='${r}')`,
 'four exercises no duplication':`(select count(*)=4 from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id='${r}')`,
 'eight workouts retained':`(select count(*)=8 from public.workouts where id in (${f.workouts.map(x=>"'"+x+"'").join(',')}))`,
 'historical old exercise UUID retained':`(select count(*)=1 from public.workouts w cross join lateral jsonb_array_elements(w.data->'exercises')e where w.data->>'routine_id'='${r}' and e->>'exercise_id'='${f.exercises[3]}')`,
 'replacement old UUID absent live':`not exists(select 1 from public.routine_exercises where id='${f.exercises[3]}')`,
 'replacement fresh UUID present':`exists(select 1 from public.routine_exercises where id='${f.replacement}' and name='Puente de glúteos')`,
 'no inherited history for replacement':`not exists(select 1 from public.workouts w cross join lateral jsonb_array_elements(w.data->'exercises')e where e->>'exercise_id'='${f.replacement}')`,
 'management pointer revision4':`exists(select 1 from public.routine_management g join public.routine_revisions v on v.id=g.current_revision_id where g.routine_id='${r}' and v.revision_no=4)`,
 'previous weeks retain initial revision':`(select bool_and(revision_id='${f.initial_revision}'::uuid) from public.coach_mesocycle_weeks where mesocycle_id='${m}' and week_number<=3)`,
 'future weeks share current revision':`(select count(distinct revision_id)=1 from public.coach_mesocycle_weeks where mesocycle_id='${m}' and week_number>=4)`,
 'failed atomic apply recommendation not accepted':`(select state='superseded' and apply_txid is null from public.coach_recommendations where id='${f.atomic_rec}')`,
 'no committed transaction bypass':`not exists(select 1 from public.coach_recommendations where apply_txid is not null)`,
 'old snapshots preserved after revocation':`(select count(*)>0 from public.coach_recommendations where mesocycle_id='${m}' and context_snapshot->>'schema_version'='premium-history-v1')`,
 'UI intake actually submitted':`exists(select 1 from public.coach_mesocycles where id='${f.ui_mesocycle}' and intake->>'schema_version'='premium-intake-v1' and intake_submitted_at is not null)`,
 'UI five variable weeks':`(select count(*)=5 from public.coach_mesocycle_weeks where mesocycle_id='${f.ui_mesocycle}')`,
 'backend service table access':`has_table_privilege('service_role','public.coach_mesocycles','SELECT') and has_table_privilege('service_role','public.coach_recommendations','INSERT')`,
 'no authenticated DML new tables':`not has_table_privilege('authenticated','public.coach_mesocycles','UPDATE') and not has_table_privilege('authenticated','public.coach_recommendations','INSERT')`,
 'anonymous cannot execute acceptance':`not has_function_privilege('anon','public.premium_accept_recommendation(uuid)','EXECUTE')`,
 'client cannot provision entitlement':`not has_function_privilege('authenticated','public.premium_provision(uuid,uuid,date,integer,timestamptz)','EXECUTE')`,
 'six aliases remain exact and scoped':`(select bool_and(coach_private.premium_exercise_identity(a.o,a.n::uuid,'b7ee910d-bc34-402c-b1a3-5cacceb29519','ba2d0a25-1844-45c1-9777-f0e1aa7aa392') and not coach_private.premium_exercise_identity(a.o,a.n::uuid,'${u}','${r}')) from (values ('9740243b-0928-4c5a-b9dc-8ebd09e4d256','8f5b1173-dbb8-4f0f-9eab-a3058dcca969'),('ce87cfe5-4424-4645-92b6-091802f0153d','78bc6c44-1c7a-4f49-8983-4c731894534e'),('6bc9d317-1511-48f0-b126-1c307de41622','21dd0c95-6ae8-403f-91b7-08c51cd4b237'),('056f44c2-0914-479c-814b-75046654cb45','1207ebbd-6878-41d9-a955-10cd5b59cb9e'),('302dea2d-25ef-416a-a85d-8bc1b8a920db','fb36a1d3-a8bc-4cbc-97d1-45decc47bb67'),('bd31394a-5ee9-4f21-b90e-0c759781585f','37eedaee-ac32-4308-9194-5aae01c69ca3'))a(o,n))`,
 'no unconfirmed alias':`not coach_private.premium_exercise_identity('${f.exercises[3]}','${f.replacement}','${u}','${r}')`,
 'weight increase not automatic progress':`coach_private.premium_metrics('[{"sets":[{"kg":30,"reps":8,"rir":2}]},{"sets":[{"kg":25,"reps":10,"rir":2}]},{"sets":[{"kg":20,"reps":12,"rir":2}]}]'::jsonb)->>'trend'='context_changed_or_incomplete'`,
 'unknown RIR not interpreted as zero':`coach_private.premium_metrics('[{"sets":[{"kg":30,"reps":8,"rir":null}]},{"sets":[{"kg":30,"reps":8,"rir":null}]},{"sets":[{"kg":30,"reps":8,"rir":null}]}]'::jsonb)->>'trend'='context_changed_or_incomplete'`,
 'zero load and RIR retained':`coach_private.premium_number('0')=0 and coach_private.premium_number('') is null`,
 'all new tables RLS enabled':`(select bool_and(relrowsecurity) from pg_class where oid in ('public.coach_mesocycles'::regclass,'public.coach_mesocycle_weeks'::regclass,'public.coach_recommendations'::regclass))`
};
fs.writeFileSync(path.join(dir,'verify.sql'),'select jsonb_build_object('+Object.entries(items).map(([k,v])=>"'"+k.replaceAll("'","''")+"',("+v+')').join(',\n')+') as checks;');
fs.writeFileSync(path.join(dir,'immutable.sql'),`begin;set local role service_role;do $test$ begin begin update public.routine_revisions set reason='overwrite' where id='${f.initial_revision}';raise exception 'immutable_guard_failed';exception when insufficient_privilege then null;end;end $test$;select true as immutable_backend_protected;rollback;`);
// Do not execute cleanup until all expected IDs have been verified in Supabase.
const routines=[f.routine,f.ui_routine].map(x=>"'"+x+"'").join(',');
fs.writeFileSync(path.join(dir,'cleanup.sql'),`begin;
 set constraints premium_revision_rec_fk deferred;
 delete from public.coach_mesocycle_weeks where routine_id in (${routines});
 delete from public.coach_recommendations where routine_id in (${routines});
 delete from public.coach_mesocycles where routine_id in (${routines});
 delete from public.routine_management where routine_id in (${routines}) and plan_kind='premium';
 delete from public.routine_revisions where routine_id in (${routines}) and origin<>'basic';
 delete from public.workouts where id in (${f.workouts.map(x=>"'"+x+"'").join(',')}) and user_id='${u}' and data->>'routine_id'='${r}';
 delete from public.routine_exercises where day_id in (${[...f.days,...f.ui_days].map(x=>"'"+x+"'").join(',')});
 delete from public.routine_days where routine_id in (${routines});
 delete from public.routines where id in (${routines}) and owner_id='${u}' and name like 'SYNTHETIC Premium%';
 ${f.grants?.length?"delete from public.context_grants where id in ("+f.grants.map(x=>"'"+x+"'").join(',')+") and user_id='"+u+"' and scope='premium_training_history';":'-- Add verified grant UUID manifest before cleanup.'}
commit;`);
