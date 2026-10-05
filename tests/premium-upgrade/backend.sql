-- STAGING ONLY. Controlled actors already exist; all synthetic rows roll back.
-- SQL mocks below do not contact Edge or OpenAI and cannot be reported as real AI calls.
begin;
set local timezone='Europe/Madrid';
create temporary table upgrade_result(result jsonb) on commit drop;
create function pg_temp.basic_fixture(u uuid,prompt text,per_set boolean) returns jsonb language plpgsql as $$
declare r uuid:=gen_random_uuid();d uuid:=gen_random_uuid();e uuid:=gen_random_uuid();v uuid:=gen_random_uuid();i uuid:=gen_random_uuid();o uuid:=gen_random_uuid();snap jsonb;ex jsonb;ss jsonb;proposal jsonb;n int;
begin
 select coalesce(max(revision),0)+1 into n from public.training_intakes where user_id=u;
 insert into public.training_intakes(id,user_id,revision,state,training,submitted_at) values(i,u,n,'submitted','{}',now());
 insert into public.routines(id,owner_id,name,description) values(r,u,'SYNTHETIC accepted Basic '||prompt,'Controlled rollback fixture');
 insert into public.routine_days(id,routine_id,name,day_order) values(d,r,'Synthetic day',0);
 insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values(e,d,'Curl con mancuernas',3,'8-10','2',120,0,'SYNTHETIC note preserved');
 ss:='[{"set_number":1,"reps_min":8,"reps_max":10,"rir":2,"rest_seconds":120},{"set_number":2,"reps_min":10,"reps_max":12,"rir":1,"rest_seconds":150},{"set_number":3,"reps_min":12,"reps_max":15,"rir":0,"rest_seconds":150}]';
 ex:=jsonb_build_object('id',e,'day_id',d,'exercise_order',0,'name','Curl con mancuernas','sets',3,'reps_min',8,'reps_max',10,'rir',2,'rest_seconds',120);
 if per_set then ex:=ex||jsonb_build_object('planned_sets',ss,'scheme','top_backoff');end if;
 proposal:=jsonb_build_object('name','SYNTHETIC accepted Basic '||prompt,'description','Controlled rollback fixture','days',jsonb_build_array(jsonb_build_object('name','Synthetic day','exercises',jsonb_build_array(ex-array['id','day_id','exercise_order']))));
 insert into public.coach_operations(id,user_id,intake_id,intake_version,idempotency_key,state,proposal,grant_ids,prompt_version,output_schema_version,routine_id,accepted_at,model_provider)
 values(o,u,i,1,gen_random_uuid(),'accepted',proposal,'{}',prompt,case when per_set then 2 else 1 end,r,now(),'mock');
 snap:=jsonb_build_object('id',r,'owner_id',u,'name','SYNTHETIC accepted Basic '||prompt,'description','Controlled rollback fixture','days',jsonb_build_array(jsonb_build_object('id',d,'routine_id',r,'name','Synthetic day','day_order',0,'exercises',jsonb_build_array(ex))));
 insert into public.routine_revisions(id,routine_id,user_id,operation_id,snapshot,snapshot_hash,accepted_by,author_kind,reason) values(v,r,u,o,snap,md5(snap::text),u,'mock','Synthetic accepted Basic fixture');
 insert into public.routine_management(routine_id,user_id,operation_id,current_revision_id) values(r,u,o,v);
 insert into public.workouts(user_id,variant,day,workout_date,data) values(u,'SYNTHETIC Basic retained','Synthetic day',(clock_timestamp() at time zone 'Europe/Madrid')::date,jsonb_build_object('routine_id',r,'routine_day_id',d,'routine_revision_id',v,'exercises',jsonb_build_array(jsonb_build_object('exercise_id',e,'sets','[{"set":1,"kg":0,"reps":9,"rir":0},{"set":2,"kg":12,"reps":11,"rir":1}]'::jsonb))));
 return jsonb_build_object('routine',r,'day',d,'exercise',e,'revision',v,'operation',o,'intake',i,'sets',ss);
end $$;
do $test$
-- Root runner supplies UUIDs from its existing controlled fixture manifest only.
declare u uuid:=nullif(current_setting('simple.test.owner',true),'')::uuid;other uuid:=nullif(current_setting('simple.test.other_client',true),'')::uuid;reviewer uuid:=nullif(current_setting('simple.test.reviewer',true),'')::uuid;fixture jsonb;legacy jsonb;
 r uuid;rev uuid;m uuid;m2 uuid;key uuid:=gen_random_uuid();snap_before jsonb;op_before jsonb;ex_before jsonb;workouts_before jsonb;sets jsonb;access jsonb;guard jsonb;denied boolean;checks jsonb:='{}';ver text;msg jsonb;t uuid;claim jsonb;ledger_before jsonb;ent_before jsonb;new_r uuid;new_d uuid;new_e uuid;history jsonb;provider jsonb;pending uuid:=gen_random_uuid();pending_intake uuid:=gen_random_uuid();pending_intake_revision int;today date:=(clock_timestamp() at time zone 'Europe/Madrid')::date;
begin
 if current_setting('role',true) not in ('none','postgres') or not exists(select 1 from public.profiles where id=u and role='client') or not exists(select 1 from public.profiles where id=other and role='client') or not exists(select 1 from public.profiles where id=reviewer and role='trainer') then raise exception 'upgrade_controlled_actor_missing';end if;
 perform set_config('request.jwt.claim.sub','',true);
 update public.context_grants set revoked_at=clock_timestamp() where user_id=u and scope like 'premium_%' and revoked_at is null;
 insert into coach_private.premium_entitlements(user_id) values(u) on conflict(user_id) do nothing;
 update coach_private.premium_entitlements set enabled=false where user_id=u;
 fixture:=pg_temp.basic_fixture(u,'basic-initial-v5',true);r:=(fixture->>'routine')::uuid;rev:=(fixture->>'revision')::uuid;
 perform set_config('request.jwt.claim.sub',u::text,true);
 access:=public.premium_my_access();if access->'enabled'<>'false'::jsonb or access->>'plan'<>'basic' then raise exception 'default off';end if;checks:=checks||'{"Premium is OFF by default and role remains client":true}';
 denied:=false;begin perform public.upgrade_basic_routine_to_premium(r,rev,key,today,6);exception when others then denied:=sqlerrm='premium_not_authorized';end;if not denied then raise exception 'upgrade gate';end if;checks:=checks||'{"upgrade without server entitlement denied":true}';
 perform set_config('request.jwt.claim.sub','',true);
 perform public.premium_set_entitlement(u,true,clock_timestamp()+interval '14 days',array['upgrade','tracking','weekly','analysis','chat'],0,8,8);
 perform set_config('request.jwt.claim.sub',u::text,true);
 denied:=false;begin perform public.premium_admission_permission(true,'invented-notice');exception when others then denied:=sqlerrm='premium_notice_required';end;if not denied then raise exception 'wrong notice';end if;checks:=checks||'{"exact admission notice required":true}';
 denied:=false;begin perform public.upgrade_basic_routine_to_premium(r,rev,key,today,6);exception when others then denied:=sqlerrm='premium_not_authorized';end;if not denied then raise exception 'upgrade consent gate';end if;checks:=checks||'{"server access does not imply user consent":true}';
 perform public.premium_admission_permission(true,'premium-followup-v1');
 -- A genuinely pending independent Basic operation must win the conflict check.
 select coalesce(max(revision),0)+1 into pending_intake_revision from public.training_intakes where user_id=u;
 insert into public.training_intakes(id,user_id,revision,state,training,submitted_at)
 values(pending_intake,u,pending_intake_revision,'submitted','{}',now());
 insert into public.coach_operations(id,user_id,intake_id,intake_version,idempotency_key,state,grant_ids,prompt_version,output_schema_version,model_provider)
 values(pending,u,pending_intake,pending_intake_revision,gen_random_uuid(),'reserved','{}','basic-initial-v5',2,'mock');
 denied:=false;begin perform public.upgrade_basic_routine_to_premium(r,rev,key,today,6);exception when others then denied:=sqlerrm='premium_basic_operation_pending';end;
 if not denied or exists(select 1 from public.coach_mesocycles where routine_id=r) or (select plan_kind from public.routine_management where routine_id=r)<>'basic' then raise exception 'pending Basic upgrade conflict';end if;
 checks:=checks||'{"pending independent Basic reservation blocks upgrade atomically":true}';
 delete from public.coach_operations where id=pending and user_id=u;
 delete from public.training_intakes where id=pending_intake and user_id=u;
 select to_jsonb(x) into op_before from public.coach_operations x where id=(fixture->>'operation')::uuid;
 select to_jsonb(x) into snap_before from public.routine_revisions x where id=rev;
 select to_jsonb(x) into ex_before from public.routine_exercises x where id=(fixture->>'exercise')::uuid;
 select jsonb_agg(to_jsonb(x) order by x.id) into workouts_before from public.workouts x where x.data->>'routine_id'=r::text;
 m:=public.upgrade_basic_routine_to_premium(r,rev,key,today,6);
 denied:=false;begin update public.routine_exercises set target='1-2' where id=(fixture->>'exercise')::uuid;exception when others then denied:=sqlerrm='coach_structure_locked' and sqlstate='42501';end;
 if not denied then raise exception 'managed direct edit';end if;checks:=checks||'{"ordinary owner-context direct structural edit is denied after upgrade":true}';
 denied:=false;begin perform public.premium_provision(u,r,today,6,clock_timestamp()+interval '1 day');exception when others then denied:=sqlerrm='premium_already_managed';end;
 if not denied or (select count(*) from public.coach_mesocycles where routine_id=r)<>1 then raise exception 'parallel provision duplicates';end if;checks:=checks||'{"server provision cannot duplicate or re-adopt the upgraded routine":true}';
 if (select plan_kind from public.routine_management where routine_id=r)<>'premium' or (select operation_id from public.routine_management where routine_id=r)<>(fixture->>'operation')::uuid then raise exception 'management provenance';end if;checks:=checks||'{"upgrade changes only active management and retains Basic operation_id":true}';
 if (select initial_revision_id from public.coach_mesocycles where id=m)<>rev or (select current_revision_id from public.coach_mesocycles where id=m)<>rev or (select count(*) from public.routine_revisions where routine_id=r)<>1 then raise exception 'baseline duplication';end if;checks:=checks||'{"same faithful Basic baseline revision reused without new revision or routine":true}';
 if (select count(*) from public.coach_mesocycle_weeks where mesocycle_id=m)<>6 or exists(select 1 from public.coach_mesocycle_weeks where mesocycle_id=m and revision_id<>rev) then raise exception 'weeks baseline';end if;checks:=checks||'{"all six weeks reference the inherited exact baseline":true}';
 if snap_before is distinct from (select to_jsonb(x) from public.routine_revisions x where id=rev) or op_before is distinct from (select to_jsonb(x) from public.coach_operations x where id=(fixture->>'operation')::uuid) then raise exception 'Basic history mutated';end if;checks:=checks||'{"original Basic operation and revision are byte-identical after upgrade":true}';
 if ex_before is distinct from (select to_jsonb(x) from public.routine_exercises x where id=(fixture->>'exercise')::uuid) or workouts_before is distinct from (select jsonb_agg(to_jsonb(x) order by x.id) from public.workouts x where x.data->>'routine_id'=r::text) then raise exception 'training mutated';end if;checks:=checks||'{"exercise identity notes order prescription and previous workout remain exact":true}';
 sets:=coach_private.premium_revision_sets(rev,(fixture->>'exercise')::uuid);if sets is distinct from fixture->'sets' or sets#>'{2,rir}'<>'0'::jsonb then raise exception 'individualized sets lost';end if;checks:=checks||'{"v5 individual series and RIR zero are preserved exactly":true}';
 if public.upgrade_basic_routine_to_premium(r,rev,key,today,6)<>m or public.upgrade_basic_routine_to_premium(r,rev,gen_random_uuid(),today,6)<>m or (select count(*) from coach_private.premium_admissions where routine_id=r)<>1 then raise exception 'upgrade idempotence';end if;checks:=checks||'{"same-key and second-tab retry return the one mesocycle":true}';
 denied:=false;begin perform public.upgrade_basic_routine_to_premium(r,gen_random_uuid(),key,today,6);exception when others then denied:=sqlerrm='premium_upgrade_conflict';end;if not denied then raise exception 'stale upgrade';end if;checks:=checks||'{"stale revision or changed admission parameters rejected":true}';
 if public.accept_basic_plan((fixture->>'operation')::uuid)<>r then raise exception 'Basic historical idempotence';end if;checks:=checks||'{"old accepted Basic RPC remains a read-only idempotent return":true}';
 denied:=false;begin perform public.reserve_basic_generation((fixture->>'intake')::uuid,gen_random_uuid());exception when others then denied:=sqlerrm='coach_premium_management_active';end;if not denied then raise exception 'parallel Basic';end if;checks:=checks||'{"no new Basic structural generation pipeline on Premium-managed user":true}';
 guard:=coach_private.premium_admission_guard(m,u);
 perform public.premium_admission_permission(false,'premium-followup-v1');
 if coach_private.premium_access(m,u) then raise exception 'revoked access';end if;checks:=checks||'{"admission consent revocation blocks Premium future access":true}';
 denied:=false;begin perform coach_private.premium_assert_admission(guard,u);exception when others then denied:=sqlerrm='premium_admission_stale_or_revoked';end;if not denied then raise exception 'old guard survived revoke';end if;
 perform public.premium_admission_permission(true,'premium-followup-v1');
 denied:=false;begin perform coach_private.premium_assert_admission(guard,u);exception when others then denied:=sqlerrm='premium_admission_stale_or_revoked';end;if not denied then raise exception 'old guard revived';end if;checks:=checks||'{"regrant produces new consent and cannot revive captured operations":true}';
 guard:=coach_private.premium_admission_guard(m,u);
 perform set_config('request.jwt.claim.sub','',true);perform public.premium_set_entitlement(u,false,null,'{}',0,8,8);
 if coach_private.premium_access(m,u) then raise exception 'entitlement revocation';end if;
 if snap_before is distinct from (select to_jsonb(x) from public.routine_revisions x where id=rev) or ex_before is distinct from (select to_jsonb(x) from public.routine_exercises x where id=(fixture->>'exercise')::uuid) or workouts_before is distinct from (select jsonb_agg(to_jsonb(x) order by x.id) from public.workouts x where x.data->>'routine_id'=r::text) then raise exception 'revoke deletes training';end if;checks:=checks||'{"revoking Premium retains inherited routine history notes and per-set data":true}';
 perform public.premium_set_entitlement(u,true,clock_timestamp()+interval '14 days',array['upgrade','tracking','weekly','analysis','chat'],0,8,8);
 denied:=false;begin perform coach_private.premium_assert_admission(guard,u);exception when others then denied:=sqlerrm='premium_admission_stale_or_revoked';end;if not denied then raise exception 'renew stale';end if;checks:=checks||'{"entitlement renewal version invalidates old captured operations":true}';
 foreach ver in array array['basic-initial-v2','basic-initial-v3','basic-initial-v4'] loop
  legacy:=pg_temp.basic_fixture(u,ver,false);sets:=coach_private.premium_revision_sets((legacy->>'revision')::uuid,(legacy->>'exercise')::uuid);
  if not coach_private.premium_sets_valid(sets) or jsonb_array_length(sets)<>3 or sets#>>'{0,reps_min}'<>'8' or sets#>>'{2,rir}'<>'2' or sets#>>'{2,rest_seconds}'<>'120' then raise exception 'legacy accepted canonical prescription';end if;
  perform set_config('request.jwt.claim.sub',u::text,true);m2:=public.upgrade_basic_routine_to_premium((legacy->>'routine')::uuid,(legacy->>'revision')::uuid,gen_random_uuid(),today,4);perform set_config('request.jwt.claim.sub','',true);
  if (select initial_revision_id from public.coach_mesocycles where id=m2)<>(legacy->>'revision')::uuid then raise exception 'legacy baseline';end if;
  checks:=checks||jsonb_build_object(ver||' accepted canonical ranges migrate in reading without snapshot rewriting',true);
 end loop;
 -- Corruption is rejected; no fallback baseline is fabricated from live values.
 legacy:=pg_temp.basic_fixture(u,'basic-initial-v2',false);
 update public.routine_exercises set target='10-12' where id=(legacy->>'exercise')::uuid;
 perform set_config('request.jwt.claim.sub',u::text,true);denied:=false;begin perform public.upgrade_basic_routine_to_premium((legacy->>'routine')::uuid,(legacy->>'revision')::uuid,gen_random_uuid(),today,4);exception when others then denied:=sqlerrm='premium_basic_baseline_mismatch';end;
 if not denied or exists(select 1 from public.coach_mesocycles where routine_id=(legacy->>'routine')::uuid) or (select plan_kind from public.routine_management where routine_id=(legacy->>'routine')::uuid)<>'basic' then raise exception 'mismatch non-atomic';end if;checks:=checks||'{"functional baseline mismatch rejects atomically without reconstructed revision":true}';
 -- Cross-owner access fails before returning any source data.
 perform set_config('request.jwt.claim.sub',other::text,true);denied:=false;begin perform public.upgrade_basic_routine_to_premium(r,rev,key,today,6);exception when others then denied:=sqlerrm='premium_not_authorized';end;if not denied then raise exception 'other owner';end if;checks:=checks||'{"another client cannot adopt the owner routine":true}';
 perform set_config('request.jwt.claim.sub','',true);
 new_r:=gen_random_uuid();new_d:=gen_random_uuid();new_e:=gen_random_uuid();
 insert into public.routines(id,owner_id,name)values(new_r,u,'SYNTHETIC existing owned routine');insert into public.routine_days(id,routine_id,name,day_order)values(new_d,new_r,'Synthetic own',0);
 insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order)values(new_e,new_d,'Curl con mancuernas',3,'10-12','2',120,0);
 perform set_config('request.jwt.claim.sub',u::text,true);key:=gen_random_uuid();m2:=public.premium_start_followup(new_r,key,today,4);
 if public.premium_start_followup(new_r,key,today,4)<>m2 or (select origin from public.routine_revisions where id=(select current_revision_id from public.coach_mesocycles where id=m2))<>'premium_baseline' then raise exception 'ordinary provisioning';end if;checks:=checks||'{"non-Basic owned routine path uses gated idempotent normal provisioning":true}';
 denied:=false;begin perform public.premium_start_followup(r,gen_random_uuid(),today,4);exception when others then denied:=sqlerrm='premium_upgrade_conflict';end;if not denied then raise exception 'path mix';end if;checks:=checks||'{"normal provision cannot silently adopt an already upgraded Basic routine":true}';
 perform set_config('request.jwt.claim.sub','',true);
 select jsonb_build_object('analysis',analysis_consumed,'chat',chat_consumed) into ent_before from coach_private.premium_entitlements where user_id=u;
 perform public.premium_set_entitlement(u,false,null,'{}',0,0,0);perform public.premium_set_entitlement(u,true,clock_timestamp()+interval '14 days',array['upgrade','tracking','weekly','analysis','chat'],0,8,8);
 if ent_before is distinct from (select jsonb_build_object('analysis',analysis_consumed,'chat',chat_consumed) from coach_private.premium_entitlements where user_id=u) then raise exception 'reset owner budget';end if;checks:=checks||'{"renewal does not reset owner usage counters":true}';
 -- Isolated seed activates only this rollback fixture for reading the existing history;
 -- the primary JWT E2E tests exercise real intake submission separately.
 update public.coach_mesocycles set state='active',intake_submitted_at=now(),intake='{"experience":"gt4","excluded":[],"inventory":{"equipment":["dumbbells"],"custom":[]},"weekdays":["mon"],"minutes_by_day":{"mon":90}}',catalogue_bindings=jsonb_build_object(fixture->>'exercise','db_curl') where id=m;
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_permission(m,true);
 perform set_config('TimeZone','UTC',true);history:=public.premium_training_history(m);
 if jsonb_array_length(history#>'{exercises,0,exposures}')<>1 or history#>>'{exercises,0,exposures,0,date}'<>today::text then raise exception 'Madrid history cutoff';end if;checks:=checks||'{"Madrid workout date remains included when caller timezone is UTC":true}';
 history:=coach_private.premium_history_context(m,u);
 if history#>'{exercises,0,exposures,0,sets,0,kg}'<>'0'::jsonb or history#>'{exercises,0,exposures,0,sets,0,rir}'<>'0'::jsonb then raise exception 'zero history lost';end if;checks:=checks||'{"inherited training zero kg and RIR remain zero rather than missing":true}';
 provider:=public.premium_provider_context(m);
 if provider->>'baseline_origin'<>'inherited_basic' or provider->>'history_origin'<>'shared_existing_training' or provider#>'{routine,exercises,0,planned_sets}' is distinct from fixture->'sets' then raise exception 'inherited provider provenance';end if;checks:=checks||'{"provider labels inherited Basic baseline and uses its exact individualized sets":true}';
 perform set_config('TimeZone','Europe/Madrid',true);perform set_config('request.jwt.claim.sub','',true);
 if has_table_privilege('authenticated','coach_private.premium_entitlements','SELECT') or has_table_privilege('authenticated','coach_private.premium_admissions','SELECT') or has_table_privilege('service_role','coach_private.premium_entitlements','UPDATE') then raise exception 'private access exposed';end if;checks:=checks||'{"private entitlement and admission tables have no API grants":true}';
 if has_function_privilege('authenticated','public.premium_set_entitlement(uuid,boolean,timestamptz,text[],integer,integer,integer)','EXECUTE') or has_function_privilege('anon','public.upgrade_basic_routine_to_premium(uuid,uuid,uuid,date,integer)','EXECUTE') then raise exception 'server capability exposed';end if;checks:=checks||'{"only server can configure access and anon cannot upgrade":true}';
 if (select role from public.profiles where id=u)<>'client' then raise exception 'role changed';end if;checks:=checks||'{"entitlement is independent of Auth identity and profile role":true}';
 if (select shared_enabled from coach_private.premium_analysis_budget where id) then raise exception 'shared provider gate must be closed during tests';end if;checks:=checks||'{"shared real-provider budget remains OFF during SQL tests":true}';
 insert into upgrade_result values(jsonb_build_object('suite','Premium upgrade transactional backend','passed',(select count(*) from jsonb_each(checks)),'checks',checks));
end $test$;
select result from upgrade_result;
rollback;
