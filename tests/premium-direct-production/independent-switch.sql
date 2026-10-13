-- SIMPLE Security Test only. A retained synthetic audit account, no provider traffic.
-- All temporary entitlement/config changes are rolled back; no Auth modification.
begin;
set local statement_timeout='15s';
set local lock_timeout='3s';
create temporary table closed_switch_checks(name text primary key,pass boolean not null);
do $test$
declare a uuid:='3bda622a-99da-4ecf-b00e-431abefd3760';reviewer uuid:='6b47ae02-6574-46db-acdb-f00925efdd74';
 s jsonb;failed boolean;i uuid;o uuid;
begin
 if not exists(select 1 from auth.users x join public.profiles p on p.id=x.id where x.id=a and x.raw_app_meta_data->>'synthetic_task'='premium_close_20261013' and x.raw_app_meta_data->>'synthetic_slot'='A' and p.role='client') then raise exception 'synthetic_scope_mismatch';end if;
 if not exists(select 1 from public.profiles where id=reviewer and role='trainer') then raise exception 'reviewer_fixture_missing';end if;
 if exists(select 1 from coach_private.premium_initial_budget where enabled or reserved_usd<>0) or exists(select 1 from coach_private.premium_analysis_budget where enabled or chat_enabled or shared_enabled or reserved_usd<>0 or chat_reserved_usd<>0) then raise exception 'staging_not_quiescent';end if;
 execute 'create or replace function coach_private.reviewer_config() returns jsonb language sql stable set search_path=pg_catalog as $f$select '||quote_literal(jsonb_build_object(reviewer::text,jsonb_build_object('enabled',true,'expires_at',(clock_timestamp()+interval '1 day')::text))::text)||'::jsonb$f$';
 update coach_private.premium_entitlements set enabled=true,expires_at=clock_timestamp()+interval '1 day',initial_reviewer_id=reviewer where user_id=a;
 update coach_private.premium_analysis_budget set enabled=true,chat_enabled=true,shared_enabled=true,premium_enabled=true where id;
 update coach_private.premium_initial_budget set enabled=true where id;
 if not coach_private.premium_initial_eligible(a) then raise exception 'FAIL eligible positive control';end if;
 insert into closed_switch_checks values('eligible positive control with authorized synthetic reviewer',true);
 update coach_private.premium_initial_budget set enabled=false where id;
 if coach_private.premium_initial_eligible(a) then raise exception 'FAIL independent closed switch';end if;
 insert into closed_switch_checks values('initial OFF denies eligible while legacy flags ON',true);
 if not (select enabled and chat_enabled and shared_enabled and premium_enabled from coach_private.premium_analysis_budget where id) then raise exception 'FAIL legacy unchanged';end if;
 insert into closed_switch_checks values('initial OFF preserves legacy flags',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claim.role','authenticated',true);
 s:=public.premium_initial_my_state();
 if (s->>'enabled')::boolean or (s->>'can_generate')::boolean or s->>'blocker'<>'premium_initial_not_authorized' then raise exception 'FAIL owner state closed';end if;
 insert into closed_switch_checks values('owner state hidden and cannot generate',true);
 select id into i from public.premium_initial_intakes where user_id=a;select id into o from public.premium_initial_operations where user_id=a;
 failed:=false;begin perform public.premium_initial_permission(true,'premium-initial-v1');exception when insufficient_privilege then failed:=sqlerrm='premium_initial_not_authorized';end;
 if not failed then raise exception 'FAIL grant mutation';end if;
 insert into closed_switch_checks values('grant cannot enable initial OFF',true);
 failed:=false;begin perform public.premium_initial_save_intake(0,'{}',false);exception when insufficient_privilege then failed:=sqlerrm='premium_initial_not_authorized';end;
 if not failed then raise exception 'FAIL intake mutation';end if;
 insert into closed_switch_checks values('intake cannot bypass initial OFF',true);
 failed:=false;begin perform public.premium_initial_reserve(i,gen_random_uuid());exception when insufficient_privilege then failed:=sqlerrm='premium_initial_not_authorized';end;
 if not failed then raise exception 'FAIL reserve mutation';end if;
 insert into closed_switch_checks values('reserve cannot bypass initial OFF',true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated')::text,true);perform set_config('request.jwt.claim.sub',reviewer::text,true);
 if public.premium_initial_review_queue()<>'[]'::jsonb then raise exception 'FAIL reviewer queue';end if;
 insert into closed_switch_checks values('reviewer queue omits closed initial proposals',true);
 -- Delivered management remains protective even while provider calls are OFF.
 if not exists(select 1 from public.premium_initial_operations x join public.routine_management m on m.routine_id=x.routine_id and m.user_id=x.user_id where x.user_id=a and x.state='accepted') then raise exception 'FAIL delivered management';end if;
 insert into closed_switch_checks values('delivered initial management preserved',true);
end $test$;
select jsonb_build_object('checks',count(*),'passed',count(*)filter(where pass),'rows',jsonb_agg(to_jsonb(c)),'mode','rollback-only SQL; not a new JWT/provider test') result from closed_switch_checks c;
rollback;
