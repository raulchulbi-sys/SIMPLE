-- STAGING ONLY. One independent UTC/Madrid date-bound fixture, entirely rolled back.
begin;
do $test$
declare
 u uuid:='495fa022-d51b-4bdd-a2f8-e031409b69f5';r uuid:=gen_random_uuid();d uuid:=gen_random_uuid();e uuid:=gen_random_uuid();m uuid;rev uuid;
 today_madrid date:=(now() at time zone 'Europe/Madrid')::date;utc_today date;b jsonb;old_b jsonb;checks jsonb:='{}';boundary boolean;secondary_boundary boolean;
begin
 if current_setting('role',true) not in ('none','postgres') then raise exception 'timezone_test_admin_required';end if;
 perform set_config('TimeZone','UTC',true);utc_today:=current_date;boundary:=utc_today<>today_madrid;
 perform set_config('request.jwt.claim.sub','',true);
 insert into public.routines(id,owner_id,name)values(r,u,'Synthetic Premium Phase3 timezone transaction');
 insert into public.routine_days(id,routine_id,name,day_order)values(d,r,'Synthetic timezone day',0);
 insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order)values(e,d,'Synthetic exact timezone exercise',3,'8-12','2',180,0);
 m:=public.premium_provision(u,r,utc_today,4,now()+interval '1 day');select current_revision_id into rev from public.coach_mesocycles where id=m;
 update public.coach_mesocycles set state='active',intake_submitted_at=now(),intake='{"experience":"gt4","excluded":[],"inventory":{"equipment":["bands"]},"weekdays":["mon"],"minutes_by_day":{"mon":30}}',catalogue_bindings=jsonb_build_object(e::text,'band_row') where id=m;
 insert into public.workouts(user_id,variant,day,workout_date,data)values(u,'Synthetic Premium timezone','Synthetic day',today_madrid,jsonb_build_object('routine_id',r,'routine_day_id',d,'routine_revision_id',rev,'exercises',jsonb_build_array(jsonb_build_object('exercise_id',e,'sets','[{"set":1,"kg":10,"reps":10,"rir":2},{"set":2,"kg":10,"reps":10,"rir":2},{"set":3,"kg":10,"reps":10,"rir":2}]'::jsonb))));
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_permission(m,true);perform public.premium_weekly_permission(m,true);
 old_b:=coach_private.premium_bundle(m,u)->'provider';
 if current_setting('TimeZone')<>'UTC' then raise exception 'failed initial caller UTC';end if;checks:=checks||'{"caller begins UTC":true}';
 b:=public.premium_weekly_provider_context(m);
 if jsonb_array_length(b#>'{routine,exercises,0,exposures}')<>1 or b#>>'{routine,exercises,0,exposures,0,date}'<>today_madrid::text then raise exception 'failed Madrid today exposure captured';end if;checks:=checks||'{"weekly provider includes Madrid today exposure":true}';
 if b#>>'{routine,exercises,0,exposures,0,prescription_source}'<>'exact_revision' then raise exception 'failed Madrid exact revision source';end if;checks:=checks||'{"Madrid today keeps exact revision prescription":true}';
 if current_setting('TimeZone')<>'UTC' then raise exception 'failed caller timezone restored';end if;checks:=checks||'{"caller UTC restored after weekly helper return":true}';
 if boundary and jsonb_array_length(old_b#>'{routine,exercises,0,exposures}')<>0 then raise exception 'failed old Phase2 UTC cutoff unchanged';end if;checks:=checks||'{"existing Phase2 UTC behavior retained":true}';
 if b->>'timezone'<>'Europe/Madrid' or not exists(select 1 from pg_proc where oid='coach_private.premium_weekly_bundle(uuid,uuid)'::regprocedure and 'TimeZone=Europe/Madrid'=any(proconfig) and 'search_path=pg_catalog, public'=any(proconfig)) then raise exception 'failed weekly function timezone config';end if;checks:=checks||'{"weekly helper declares Madrid with existing search path":true}';
 -- A second caller timezone demonstrates the boundary after the real UTC midnight has passed.
 perform set_config('TimeZone','Etc/GMT+12',true);secondary_boundary:=current_date<today_madrid;
 old_b:=coach_private.premium_bundle(m,u)->'provider';b:=public.premium_weekly_provider_context(m);
 if secondary_boundary and (jsonb_array_length(old_b#>'{routine,exercises,0,exposures}')<>0 or jsonb_array_length(b#>'{routine,exercises,0,exposures}')<>1) then raise exception 'failed nested weekly timezone cutoff';end if;checks:=checks||'{"different caller date uses nested Madrid bounds":true}';
 if current_setting('TimeZone')<>'Etc/GMT+12' then raise exception 'failed secondary caller timezone restore';end if;checks:=checks||'{"secondary caller timezone restored after helper":true}';
 perform set_config('TimeZone','UTC',true);if current_setting('TimeZone')<>'UTC' then raise exception 'failed final UTC restore';end if;checks:=checks||'{"test returns to UTC after secondary boundary":true}';
 perform set_config('test.phase3_timezone_result',jsonb_build_object('project_id','dmqjexigdnfzobarhnib','checks',checks,'pass',(select count(*) from jsonb_each(checks)x where x.value='true'::jsonb),'total',(select count(*) from jsonb_object_keys(checks)),'utc_today',utc_today,'madrid_today',today_madrid,'actual_boundary_exercised',boundary,'secondary_boundary_exercised',secondary_boundary,'transaction','rollback')::text,true);
end $test$;
select current_setting('test.phase3_timezone_result')::jsonb result;
rollback;
