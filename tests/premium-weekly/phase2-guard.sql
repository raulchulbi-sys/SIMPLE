-- STAGING ONLY: independent transient fixture. No OpenAI, Auth mutation or persistent test data.
begin;
do $test$
declare
 u uuid:='495fa022-d51b-4bdd-a2f8-e031409b69f5';
 r uuid:=gen_random_uuid();d uuid:=gen_random_uuid();a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();new_b uuid:=gen_random_uuid();
 m uuid;rev uuid;next_rev uuid;rec uuid;ss jsonb;ss_b jsonb;base jsonb;raw_a jsonb;snap jsonb;bad jsonb;patch jsonb;expected jsonb;
 checks jsonb:='{}';denied boolean;mode text;prior_count int;equipment jsonb;
begin
 if current_setting('role',true) not in ('none','postgres') then raise exception 'guard_test_admin_context_required';end if;
 if not exists(select 1 from public.profiles where id=u and role='client') then raise exception 'guard_test_controlled_client_missing';end if;
 perform set_config('request.jwt.claim.sub','',true);
 insert into public.routines(id,owner_id,name) values(r,u,'Synthetic Premium Phase2 canonical guard transaction');
 insert into public.routine_days(id,routine_id,name,day_order) values(d,r,'Synthetic guard day',0);
 insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order) values
 (a,d,'Synthetic individualized guard A',3,'6-8','2',240,0),
 (b,d,'Synthetic uniform guard B',3,'8-12','2',180,1);
 m:=public.premium_provision(u,r,current_date,4,now()+interval '1 day');
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 select coalesce(jsonb_agg(distinct req),'[]') into equipment from jsonb_array_elements(coach_private.premium_catalogue()) c cross join lateral jsonb_array_elements(c->'requires') req;
 update public.coach_mesocycles set state='active',intake=jsonb_build_object('experience','gt4','excluded','[]'::jsonb,'inventory',jsonb_build_object('equipment',equipment)),intake_submitted_at=now() where id=m;
 insert into public.context_grants(user_id,scope,notice_version)
 select u,'premium_training_history','premium-tracking-v1' where not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and revoked_at is null);
 ss:='[{"set_number":1,"reps_min":6,"reps_max":8,"rir":2,"rest_seconds":240},{"set_number":2,"reps_min":8,"reps_max":10,"rir":1,"rest_seconds":240},{"set_number":3,"reps_min":10,"reps_max":12,"rir":1,"rest_seconds":240}]';
 select jsonb_set(snapshot,'{days,0,exercises,0,planned_sets}',ss) into base from public.routine_revisions where id=rev;
 update public.routine_revisions set snapshot=base,snapshot_hash=md5(base::text) where id=rev;
 patch:=jsonb_build_object('target_id',b,'field','rest_seconds','from',180,'to',240);
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,review_reason,reviewed_at)
values(m,r,u,rev,'MODIFY','ready',jsonb_build_array(patch),'[]','Synthetic guard acceptance.','{}','Synthetic explicit guard review.',now()) returning id into rec;

 -- NULL or absent field must never enter the canonical planned_sets branch.
 foreach mode in array array['null_field','missing_field'] loop
  bad:=jsonb_build_object('target_id',a,'field',null,'from',ss,'to',jsonb_set(ss,'{1,rir}','2'));
  if mode='missing_field' then bad:=bad-'field';end if;
  perform set_config('request.jwt.claim.sub',u::text,true);
  denied:=false;begin perform coach_private.premium_check_patch(bad,r,false);exception when others then denied:=sqlerrm='premium_invalid_patch';end;
  if not denied then raise exception 'failed malformed field validation %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' validation rejected',true);
  denied:=false;begin perform coach_private.premium_check_patch(bad,r,true);exception when others then denied:=sqlerrm='premium_invalid_patch';end;
  if not denied then raise exception 'failed malformed field apply %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' direct apply rejected',true);
  perform set_config('request.jwt.claim.sub','',true);update public.coach_recommendations set patches=jsonb_build_array(bad) where id=rec;
  perform set_config('request.jwt.claim.sub',u::text,true);
  denied:=false;begin perform public.premium_accept_recommendation(rec);exception when others then denied:=sqlerrm='premium_invalid_patch';end;
  if not denied then raise exception 'failed malformed field acceptance %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' acceptance rejected',true);
  if not ((select target='6-8' and rir='2' and rest_seconds=240 from public.routine_exercises where id=a) and
   (select current_revision_id=rev from public.routine_management where routine_id=r) and
   (select count(*)=1 from public.routine_revisions where routine_id=r) and
   (select state='ready' and apply_txid is null and accepted_at is null from public.coach_recommendations where id=rec) and
   (select snapshot=base from public.routine_revisions where id=rev)) then raise exception 'failed malformed field atomicity %',mode;end if;
  checks:=checks||jsonb_build_object(mode||' live and canonical state unchanged',true);
 end loop;
 perform set_config('request.jwt.claim.sub','',true);update public.coach_recommendations set patches=jsonb_build_array(patch) where id=rec;

 -- Invalid canonical prescriptions must fail before any silent projection, even on an untouched exercise.
 foreach mode in array array['empty','null','missing_rir','ordinal'] loop
  bad:=case mode when 'empty' then '[]'::jsonb when 'null' then 'null'::jsonb when 'missing_rir' then jsonb_set(ss,'{0}',(ss->0)-'rir') else jsonb_set(ss,'{1,set_number}','3') end;
  perform set_config('request.jwt.claim.sub','',true);
  snap:=jsonb_set(base,'{days,0,exercises,0,planned_sets}',bad);
  update public.routine_revisions set snapshot=snap,snapshot_hash=md5(snap::text) where id=rev;
  perform set_config('request.jwt.claim.sub',u::text,true);
  denied:=false;begin perform coach_private.premium_check_patch(jsonb_build_object('target_id',a,'field','rir','from','2','to','3'),r,false);exception when others then denied:=sqlerrm='premium_current_prescription_unresolved';end;
  if not denied then raise exception 'failed malformed scalar denial %',mode;end if;
  checks:=checks||jsonb_build_object('invalid '||mode||' scalar denied',true);
  denied:=false;begin perform public.premium_accept_recommendation(rec);exception when others then denied:=sqlerrm='premium_current_prescription_unresolved';end;
  if not denied then raise exception 'failed malformed untouched canonical denial %',mode;end if;
  checks:=checks||jsonb_build_object('invalid '||mode||' untouched acceptance denied',true);
  if not ((select rest_seconds=180 from public.routine_exercises where id=b) and
   (select current_revision_id=rev from public.routine_management where routine_id=r) and
   (select count(*)=1 from public.routine_revisions where routine_id=r) and
   (select state='ready' and apply_txid is null and accepted_at is null from public.coach_recommendations where id=rec) and
   (select snapshot=snap from public.routine_revisions where id=rev)) then raise exception 'failed atomic rollback %',mode;end if;
  checks:=checks||jsonb_build_object('invalid '||mode||' complete apply rollback',true);
 end loop;

 -- Legitimate unresolved legacy is retained verbatim while a different valid exercise changes.
 perform set_config('request.jwt.claim.sub','',true);
 raw_a:=((base#>'{days,0,exercises,0}')-'planned_sets')||'{"target":"AMRAP","rir":null,"legacy_note":"Preserve unknown canonical objectives"}'::jsonb;
 snap:=jsonb_set(base,'{days,0,exercises,0}',raw_a);
 update public.routine_revisions set snapshot=snap,snapshot_hash=md5(snap::text) where id=rev;
 update public.routine_exercises set target='AMRAP',rir=null where id=a;
 perform set_config('request.jwt.claim.sub',u::text,true);
 denied:=false;begin perform coach_private.premium_check_patch(jsonb_build_object('target_id',a,'field','sets','from',3,'to',2),r,false);exception when others then denied:=sqlerrm='premium_current_prescription_unresolved';end;
 if not denied then raise exception 'failed legacy unresolved scalar denial';end if;
 checks:=checks||'{"legacy unresolved prescription mutation denied":true}'::jsonb;
 next_rev:=public.premium_accept_recommendation(rec);
 select snapshot into snap from public.routine_revisions where id=next_rev;
 if snap#>>'{days,0,exercises,0,target}'<>'AMRAP' or snap#>'{days,0,exercises,0,rir}' is distinct from 'null'::jsonb or
  snap#>>'{days,0,exercises,0,legacy_note}'<>'Preserve unknown canonical objectives' or snap#>'{days,0,exercises,0}' ? 'planned_sets' then raise exception 'failed legacy raw preservation';end if;
 checks:=checks||'{"unknown legacy raw preserved without invented series":true}'::jsonb;
 if coach_private.premium_revision_sets(next_rev,a) is not null or (select target<>'AMRAP' or rir is not null from public.routine_exercises where id=a) then raise exception 'failed legacy remains unresolved';end if;
 checks:=checks||'{"unknown legacy remains unresolved and live intact":true}'::jsonb;
 if coach_private.premium_revision_sets(next_rev,b)#>>'{0,rest_seconds}'<>'240' or (select revision_no from public.routine_revisions where id=next_rev)<>2 then raise exception 'failed valid different exercise accepted';end if;
 checks:=checks||'{"different valid exercise accepted to exact N+1":true}'::jsonb;
 if (select snapshot#>'{days,0,exercises,0}' from public.routine_revisions where id=rev) is distinct from raw_a then raise exception 'failed legacy N immutable';end if;
 checks:=checks||'{"legacy original revision intact":true}'::jsonb;

 -- Valid individualized plans and idempotent acceptance retain their previous behavior.
 rev:=next_rev;
 perform set_config('request.jwt.claim.sub','',true);
 select jsonb_set(snapshot,'{days,0,exercises,0}',(snapshot#>'{days,0,exercises,0}')||jsonb_build_object('target','6-8','rir','2','planned_sets',ss)) into base from public.routine_revisions where id=rev;
 update public.routine_revisions set snapshot=base,snapshot_hash=md5(base::text) where id=rev;
 update public.routine_exercises set target='6-8',rir='2' where id=a;
 expected:=jsonb_set(ss,'{1,rir}','2');
 patch:=jsonb_build_object('target_id',a,'field','planned_sets','from',ss,'to',expected);
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,review_reason,reviewed_at)
 values(m,r,u,rev,'MODIFY','ready',jsonb_build_array(patch),'[]','Synthetic valid series guard.','{}','Synthetic explicit guard review.',now()) returning id into rec;
 ss_b:=coach_private.premium_revision_sets(rev,b);
 perform set_config('request.jwt.claim.sub',u::text,true);
 next_rev:=public.premium_accept_recommendation(rec);
 if coach_private.premium_revision_sets(next_rev,a) is distinct from expected then raise exception 'failed valid individualized change';end if;
 checks:=checks||'{"valid per-set change accepted exactly":true}'::jsonb;
 if coach_private.premium_revision_sets(next_rev,b) is distinct from ss_b then raise exception 'failed untouched valid uniform plan';end if;
 checks:=checks||'{"unaffected valid exercise exact canonical plan":true}'::jsonb;
 if (select snapshot from public.routine_revisions where id=rev) is distinct from base then raise exception 'failed valid N intact';end if;
 checks:=checks||'{"valid original revision intact":true}'::jsonb;
 if public.premium_accept_recommendation(rec)<>next_rev or (select count(*) from public.routine_revisions where routine_id=r)<>3 then raise exception 'failed accept replay';end if;
 checks:=checks||'{"same recommendation replay returns same revision":true}'::jsonb;

 -- Missing and duplicate UUIDs in the baseline are errors, never replacement exemptions.
 rev:=next_rev;select snapshot into base from public.routine_revisions where id=rev;
 foreach mode in array array['missing_uuid','duplicate_uuid'] loop
  perform set_config('request.jwt.claim.sub','',true);
  snap:=case mode when 'missing_uuid' then jsonb_set(base,'{days,0,exercises,0,id}',to_jsonb(gen_random_uuid()::text)) else jsonb_set(base,'{days,0,exercises}',(base#>'{days,0,exercises}')||jsonb_build_array(base#>'{days,0,exercises,0}')) end;
  update public.routine_revisions set snapshot=snap,snapshot_hash=md5(snap::text) where id=rev;
  patch:=jsonb_build_object('target_id',b,'field','rest_seconds','from',240,'to',300);
  insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,review_reason,reviewed_at)
  values(m,r,u,rev,'MODIFY','ready',jsonb_build_array(patch),'[]','Synthetic malformed UUID guard.','{}','Synthetic explicit guard review.',now()) returning id into rec;
  perform set_config('request.jwt.claim.sub',u::text,true);
  denied:=false;begin perform public.premium_accept_recommendation(rec);exception when others then denied:=sqlerrm='premium_malformed_baseline';end;
  if not denied then raise exception 'failed baseline UUID guard %',mode;end if;
  checks:=checks||jsonb_build_object('baseline '||mode||' acceptance denied',true);
  if (select rest_seconds<>240 from public.routine_exercises where id=b) or (select count(*) from public.routine_revisions where routine_id=r)<>3 or
   (select current_revision_id from public.routine_management where routine_id=r)<>rev then raise exception 'failed baseline atomic UUID guard %',mode;end if;
  checks:=checks||jsonb_build_object('baseline '||mode||' atomic rollback',true);
 end loop;

 -- A validated replacement has a genuinely new UUID and must still work.
 perform set_config('request.jwt.claim.sub','',true);
 update public.routine_revisions set snapshot=base,snapshot_hash=md5(base::text) where id=rev;
 patch:=jsonb_build_object('target_id',b,'field','replace_exercise','from',b,'to',jsonb_build_object('id',new_b,'catalogue_id','band_row','sets',3,'target','8-12','rir','2','rest_seconds',180));
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,review_reason,reviewed_at)
 values(m,r,u,rev,'MODIFY','ready',jsonb_build_array(patch),'[]','Synthetic replacement guard.','{}','Synthetic explicit guard review.',now()) returning id into rec;
 perform set_config('request.jwt.claim.sub',u::text,true);
 next_rev:=public.premium_accept_recommendation(rec);
 if exists(select 1 from public.routine_exercises where id=b) or not exists(select 1 from public.routine_exercises where id=new_b and day_id=d) or coach_private.premium_revision_sets(next_rev,new_b) is null then raise exception 'failed new replacement UUID';end if;
 checks:=checks||'{"validated replacement new UUID accepted":true}'::jsonb;
 if coach_private.premium_revision_sets(next_rev,a) is distinct from expected or (select snapshot from public.routine_revisions where id=rev) is distinct from base then raise exception 'failed replacement other plan preservation';end if;
 checks:=checks||'{"replacement preserves old revision and unaffected individualized plan":true}'::jsonb;
 if (select count(*) from public.routine_revisions where routine_id=r)<>4 then raise exception 'failed replacement exact N+1';end if;
 checks:=checks||'{"replacement creates exactly one new revision":true}'::jsonb;
 perform set_config('test.phase2_guard_result',jsonb_build_object('checks',checks,'total',(select count(*) from jsonb_object_keys(checks)),'pass',(select count(*) from jsonb_each(checks) x where x.value='true'::jsonb),'fixture_routine',r,'transaction','rollback')::text,true);
end $test$;
select current_setting('test.phase2_guard_result')::jsonb result;
rollback;
