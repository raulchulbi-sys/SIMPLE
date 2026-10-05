
-- Staging only, controlled synthetic actors. Each suite ends with ROLLBACK.
begin;
set local timezone='Europe/Madrid';
create temporary table distribution_results(result jsonb) on commit drop;
create function pg_temp.fixture() returns jsonb language plpgsql as $test$
declare u uuid:='495fa022-d51b-4bdd-a2f8-e031409b69f5';reviewer uuid;rid uuid:=gen_random_uuid();did uuid;eid uuid;m uuid;rev uuid;i int;j int;cats text[]:=array['leg_press','chest_press','pulldown','db_curl','db_rdl','goblet','cable_row','db_shoulder','seated_curl','db_row','floor_press','db_lateral'];mapping jsonb:='{}';c jsonb;workout uuid;
begin
 if not exists(select 1 from public.profiles where id=u and role='client') then raise exception 'controlled_owner_missing';end if;
 select id into reviewer from public.profiles where role='trainer' order by id limit 1;
 perform set_config('request.jwt.claim.sub','',true);
 perform public.premium_set_entitlement(u,true,clock_timestamp()+interval '14 days',array['tracking','weekly','analysis','chat','upgrade'],0,8,8);
 insert into public.routines(id,owner_id,name)values(rid,u,'SYNTHETIC distribution rollback');
 for i in 0..2 loop
  did:=gen_random_uuid();insert into public.routine_days(id,routine_id,name,day_order)values(did,rid,'Sesión '||(i+1),i);
  for j in 0..3 loop
   eid:=gen_random_uuid();select x into c from jsonb_array_elements(coach_private.premium_catalogue())x where x->>'id'=cats[i*4+j+1];
   insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)values(eid,did,c->>'name',2,'8-12','2',180,j,'PRIVATE CANARY note');
   mapping:=mapping||jsonb_build_object(eid,c->>'id');
  end loop;
 end loop;
 insert into public.workouts(user_id,variant,day,workout_date,data) values(u,'SYNTHETIC retained','Sesión 1',current_date,jsonb_build_object('routine_id',rid,'routine_day_id',(select id from public.routine_days where routine_id=rid order by day_order limit 1),'exercises','[]'::jsonb))returning id into workout;
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_admission_permission(true,'premium-followup-v1');
 m:=public.premium_start_followup(rid,gen_random_uuid(),current_date,6);
 perform set_config('request.jwt.claim.sub','',true);
 update public.coach_mesocycles set state='active',intake_submitted_at=now(),intake='{"experience":"gt4","goal":"maximize_mass","days":4,"weekdays":["mon","tue","thu","fri"],"minutes_by_day":{"mon":75,"tue":75,"thu":75,"fri":75},"activity":{"type":"none","weekdays":[]},"excluded":[],"inventory":{"equipment":["dumbbells","press45","chest_press","pulldown","seated_curl","cables"],"custom":[]}}'::jsonb where id=m;
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 perform public.premium_bind_catalogue(m,rev,mapping);perform public.premium_assign_reviewer(m,reviewer);
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_permission(m,true);perform public.premium_weekly_permission(m,true);
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 return jsonb_build_object('user',u,'reviewer',reviewer,'routine',rid,'mesocycle',m,'revision',rev,'workout',workout);
end $test$;
create function pg_temp.proposal(f jsonb) returns public.coach_recommendations language plpgsql as $test$
declare b jsonb;rec public.coach_recommendations;
begin
 perform set_config('request.jwt.claim.sub',f->>'user',true);
 b:=coach_private.premium_weekly_bundle((f->>'mesocycle')::uuid,(f->>'user')::uuid);
 update public.coach_recommendations set state='superseded' where mesocycle_id=(f->>'mesocycle')::uuid and state in ('analyzing','pending_review','ready');
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,facts,interpretation,context_snapshot,analysis_key,analysis_week,analysis_bundle,analysis_trace,provider_state)
 values((f->>'mesocycle')::uuid,(f->>'routine')::uuid,(f->>'user')::uuid,(select current_revision_id from public.coach_mesocycles where id=(f->>'mesocycle')::uuid),'REVIEW','pending_review','[]','Synthetic structured proposal',b,gen_random_uuid(),(select tracking_week from public.coach_mesocycles where id=(f->>'mesocycle')::uuid),b,b->'weekly_metadata'||jsonb_build_object('model','mock'),'finished') returning * into rec;
 return rec;
end $test$;
create function pg_temp.layout(rec public.coach_recommendations,n int) returns jsonb language plpgsql as $test$
declare ss jsonb:='[]';es jsonb;e jsonb;d jsonb;dref text;i int;weekdays text[]:=array['mon','tue','thu','fri'];removed jsonb:='[]';
begin
 for i in 1..n loop
  es:='[]';
  for e in select x from jsonb_array_elements(rec.analysis_bundle#>'{provider,routine,exercises}') with ordinality a(x,j) where mod(j-1,n)=i-1 loop
   es:=es||jsonb_build_array(jsonb_build_object('exercise_ref',e->'ref','catalogue_id',e->'catalogue_id','planned_sets',e->'planned_sets'));
  end loop;
  dref:=case when i<=jsonb_array_length(rec.analysis_bundle->'weekly_days') then 'day_'||i else 'new_day_'||(i-jsonb_array_length(rec.analysis_bundle->'weekly_days')) end;
  ss:=ss||jsonb_build_array(jsonb_build_object('action',case when dref like 'new_%' then 'add_session' else 'move_session' end,'session_ref',dref,'weekday',weekdays[i],'minutes',75,'exercises',es));
 end loop;
 select coalesce(jsonb_agg(x->'day_ref'),'[]') into removed from jsonb_array_elements(rec.analysis_bundle->'weekly_days')x where (substring(x->>'day_ref' from 5))::int>n;
 return jsonb_build_object('action','change_session_distribution','sessions',ss,'removed_sessions',removed,'removed_exercises','[]'::jsonb,'volume_reason',null);
end $test$;
create function pg_temp.output(rec public.coach_recommendations,ch jsonb) returns jsonb language sql as $test$
 select jsonb_build_object('schema_version','premium-weekly-distribution-v1','kind','MODIFY','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',rec.analysis_bundle#>>'{provider,routine,exercises,0,metrics,trend}')),'checkin_signals','[]'::jsonb,'changes',jsonb_build_array(ch),'reason','Redistribución explícita sin aumento de volumen.','interpretation','Datos insuficientes para inferir una tendencia.','confidence','low');
$test$;
create function pg_temp.prepare(rec public.coach_recommendations,ch jsonb) returns public.coach_recommendations language plpgsql as $test$
declare vpatches jsonb;
begin
 vpatches:=coach_private.premium_output_patches(rec,pg_temp.output(rec,ch));
 perform set_config('request.jwt.claim.sub','',true);
 update public.coach_recommendations set kind='MODIFY',patches=vpatches where id=rec.id returning * into rec;
 perform set_config('request.jwt.claim.sub',(select reviewer_id::text from public.coach_mesocycles where id=rec.mesocycle_id),true);
 perform set_config('role','authenticated',true);
 perform public.premium_review_recommendation(rec.id,true,'Synthetic reviewer decision');
 perform set_config('role','none',true);perform set_config('request.jwt.claim.sub',rec.user_id::text,true);
 select * into rec from public.coach_recommendations where id=rec.id;
 return rec;
end $test$;
do $test$
declare f jsonb;f2 jsonb;rec public.coach_recommendations;rec2 public.coach_recommendations;ch jsonb;bad jsonb;p jsonb;rev uuid;new_id uuid;old_id uuid;old_rev jsonb;old_workout jsonb;before_state jsonb;checks jsonb:='{}';denied boolean;case_name text;safe jsonb;source_snapshot jsonb;
begin
 f:=pg_temp.fixture();select to_jsonb(x) into old_rev from public.routine_revisions x where id=(f->>'revision')::uuid;select to_jsonb(x) into old_workout from public.workouts x where id=(f->>'workout')::uuid;
 rec:=pg_temp.proposal(f);ch:=pg_temp.layout(rec,4);
 p:=coach_private.premium_output_patches(rec,pg_temp.output(rec,ch));
 if p#>>'{0,to,quality,sets_before}'<>'24' or p#>>'{0,to,quality,sets_after}'<>'24' or jsonb_array_length(p#>'{0,to,snapshot,days}')<>4 then raise exception '3 to 4 compilation';end if;
 checks:=checks||'{"A 3→4 fully prescribed sessions, 24→24 weekly sets":true}';
 foreach case_name in array array['unavailable','excluded','equipment','duplicate','loss','short','unjustified_volume'] loop
  bad:=ch;
  if case_name='unavailable' then bad:=jsonb_set(bad,'{sessions,3,weekday}','"wed"');
  elsif case_name='excluded' then
   perform set_config('request.jwt.claim.sub','',true);update public.coach_mesocycles set intake=jsonb_set(intake,'{excluded}','["db_curl"]') where id=rec.mesocycle_id;
   rec:=pg_temp.proposal(f);bad:=pg_temp.layout(rec,4);
  elsif case_name='equipment' then bad:=jsonb_set(bad,'{sessions,3,exercises,0,catalogue_id}','"bar_squat"');
  elsif case_name='duplicate' then bad:=jsonb_set(bad,'{sessions,3,exercises,0}',bad#>'{sessions,0,exercises,0}');
  elsif case_name='loss' then bad:=jsonb_set(bad,'{sessions,3,exercises}',(bad#>'{sessions,3,exercises}')-0);
  elsif case_name='short' then bad:=jsonb_set(bad,'{sessions,0,minutes}','15');
  elsif case_name='unjustified_volume' then bad:=jsonb_set(bad,'{sessions,0,exercises,0,planned_sets}',(bad#>'{sessions,0,exercises,0,planned_sets}')||jsonb_build_array((bad#>'{sessions,0,exercises,0,planned_sets,0}')||'{"set_number":3}'));
  end if;
  denied:=false;begin perform coach_private.premium_output_patches(rec,pg_temp.output(rec,bad));exception when others then denied=true;end;
  if not denied then raise exception 'negative test % accepted',case_name;end if;checks:=checks||jsonb_build_object('rejected '||case_name,true);
  if case_name='excluded' then perform set_config('request.jwt.claim.sub','',true);update public.coach_mesocycles set intake=jsonb_set(intake,'{excluded}','[]') where id=rec.mesocycle_id;rec:=pg_temp.proposal(f);ch:=pg_temp.layout(rec,4);end if;
 end loop;
 rec:=pg_temp.prepare(rec,ch);safe:=public.premium_recommendation_view(rec.id);
 if safe::text like '%PRIVATE CANARY%' or safe::text like '%allocations%' or safe::text like '%distribution_guard%' or jsonb_array_length(safe#>'{patches,0,to,sessions}')<>4 then raise exception 'unsafe reviewer projection';end if;
 checks:=checks||'{"safe before/after projection includes complete training prescription and no private notes":true}';
 perform set_config('request.jwt.claim.sub',(f->>'reviewer'),true);perform set_config('role','authenticated',true);
 safe:=public.premium_recommendation_view(rec.id);
 if (select count(*) from public.routine_revisions where routine_id=rec.routine_id)<>0 or (select count(*) from public.workouts where user_id=rec.user_id)<>0 or (select count(*) from public.coach_messages where user_id=rec.user_id)<>0 then raise exception 'reviewer private access expanded';end if;
 perform set_config('role','none',true);perform set_config('request.jwt.claim.sub',rec.user_id::text,true);
 checks:=checks||'{"assigned reviewer reads projection with zero private revisions, workouts and messages":true}';
 perform set_config('request.jwt.claim.sub',(select id::text from public.profiles where role='client' and id<>rec.user_id order by id limit 1),true);perform set_config('role','authenticated',true);
 denied:=false;begin perform public.premium_recommendation_view(rec.id);exception when others then denied:=sqlerrm='premium_not_authorized';end;
 perform set_config('role','none',true);perform set_config('request.jwt.claim.sub',rec.user_id::text,true);
 if not denied then raise exception 'other client view';end if;
 checks:=checks||'{"other client cannot read the distribution proposal":true}';
 if has_function_privilege('authenticated','coach_private.premium_compile_distribution(public.coach_recommendations,jsonb,jsonb)','EXECUTE') or has_function_privilege('anon','coach_private.premium_distribution_base(uuid)','EXECUTE') then raise exception 'private compiler grants';end if;
 checks:=checks||'{"private compiler and source snapshot remain inaccessible to API roles":true}';
 -- Inject a failure after writes: an invalid snapshot checks the post-apply guard, and rolls back all preceding writes.
 before_state:=coach_private.premium_distribution_base(rec.routine_id);
 denied:=false;begin
  perform set_config('request.jwt.claim.sub','',true);
  update public.coach_recommendations set apply_txid=txid_current() where id=rec.id;
  perform set_config('request.jwt.claim.sub',rec.user_id::text,true);
  perform coach_private.premium_check_patch(rec.patches->0,rec.routine_id,true);
  raise exception 'synthetic_intermediate_failure';
 exception when others then if sqlerrm<>'synthetic_intermediate_failure' then raise;end if;denied:=true;end;
 if not denied or before_state is distinct from coach_private.premium_distribution_base(rec.routine_id) or exists(select 1 from public.routine_days where id=(rec.patches#>>'{0,to,allocations,new_day_1}')::uuid) then raise exception 'incomplete rollback';end if;
 checks:=checks||'{"H intermediate failure rolls back sessions, exercises, bindings and apply marker":true}';
 -- The existing unique pending-week guard forbids a second pending proposal.
 rec2:=rec;rec2.id:=gen_random_uuid();rec2.analysis_key:=gen_random_uuid();
 denied:=false;begin insert into public.coach_recommendations select (rec2).*;exception when unique_violation then denied:=true;end;
 if not denied then raise exception 'parallel pending proposal admitted';end if;
 checks:=checks||'{"two pending distribution recommendations cannot coexist":true}';
 rev:=public.premium_accept_recommendation(rec.id);
 if rev=(f->>'revision')::uuid or (select count(*) from public.routine_days where routine_id=rec.routine_id)<>4 or (select count(*) from public.routine_revisions where routine_id=rec.routine_id)<>2 then raise exception 'A acceptance not atomic';end if;
 checks:=checks||'{"A acceptance creates exactly one N+1, four sessions, unchanged IDs/prescription and bindings":true}';
 if old_rev is distinct from (select to_jsonb(x) from public.routine_revisions x where id=(f->>'revision')::uuid) or old_workout is distinct from (select to_jsonb(x) from public.workouts x where id=(f->>'workout')::uuid) then raise exception 'immutable history lost';end if;
 checks:=checks||'{"original revision and workout are byte-identical":true}';
 if public.premium_accept_recommendation(rec.id)<>rev or (select count(*) from public.routine_revisions where routine_id=rec.routine_id)<>2 then raise exception 'duplicate acceptance';end if;
 checks:=checks||'{"G double acceptance returns the same revision and no duplicate volume":true}';
 rec2.state:='superseded';insert into public.coach_recommendations select (rec2).*;
 denied:=false;begin perform public.premium_accept_recommendation(rec2.id);exception when others then denied=true;end;
 if not denied then raise exception 'stale competitor';end if;
 checks:=checks||'{"F competing old-baseline recommendation rejected":true}';
 rec:=pg_temp.proposal(f);
 if (rec.analysis_bundle->'provider')::text ~* '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|PRIVATE CANARY|@' then raise exception 'future weekly provider leaked';end if;
 checks:=checks||'{"future weekly context after N+1 remains minimized and contains no UUID or private notes":true}';
 ch:=pg_temp.layout(rec,3);rec:=pg_temp.prepare(rec,ch);rev:=public.premium_accept_recommendation(rec.id);
 if (select count(*) from public.routine_days where routine_id=rec.routine_id)<>3 or rec.patches#>>'{0,to,quality,sets_after}'<>'24' then raise exception '4 to 3';end if;
 checks:=checks||'{"B 4→3 redistributes every exercise, 24→24 sets, no silent cascade":true}';
 rec:=pg_temp.proposal(f);ch:=pg_temp.layout(rec,3);ch:=jsonb_set(ch,'{sessions,0,weekday}','"fri"');ch:=jsonb_set(ch,'{sessions,2,weekday}','"mon"');rec:=pg_temp.prepare(rec,ch);rev:=public.premium_accept_recommendation(rec.id);
 checks:=checks||'{"C same count with explicit weekday redistribution":true}';
 rec:=pg_temp.proposal(f);ch:=pg_temp.layout(rec,4);rec:=pg_temp.prepare(rec,ch);
 perform set_config('request.jwt.claim.sub','',true);update public.coach_mesocycles set intake=jsonb_set(intake,'{minutes_by_day,mon}','60') where id=rec.mesocycle_id;
 perform set_config('request.jwt.claim.sub',rec.user_id::text,true);
 denied:=false;begin perform public.premium_accept_recommendation(rec.id);exception when others then denied:=sqlerrm='premium_weekly_stale_context';end;
 if not denied then raise exception 'availability staleness';end if;checks:=checks||'{"availability changed after capture rejects safely without writes":true}';
 -- Exercise additions/removals are explicit and use the same atomic acceptance pipeline.
 f2:=pg_temp.fixture();rec:=pg_temp.proposal(f2);ch:=pg_temp.layout(rec,4);
 ch:=jsonb_set(ch,'{sessions,0,exercises}',(ch#>'{sessions,0,exercises}')||jsonb_build_array(jsonb_build_object('exercise_ref','new_exercise_1','catalogue_id','band_curl','planned_sets',ch#>'{sessions,0,exercises,0,planned_sets}')));
 -- Only make the exact required equipment available in this controlled fixture.
 perform set_config('request.jwt.claim.sub','',true);
 update public.coach_mesocycles set intake=jsonb_set(intake,'{inventory,equipment}',(intake#>'{inventory,equipment}')||'["bands"]'::jsonb) where id=rec.mesocycle_id;
 rec:=pg_temp.proposal(f2);ch:=jsonb_set(ch,'{volume_reason}','"Dos series adicionales explícitas para revisión, separadas de añadir una sesión."');
 rec:=pg_temp.prepare(rec,ch);new_id:=(rec.patches#>>'{0,to,allocations,new_exercise_1}')::uuid;rev:=public.premium_accept_recommendation(rec.id);
 if not exists(select 1 from public.routine_exercises where id=new_id and sets=2) or (select catalogue_bindings->>new_id::text from public.coach_mesocycles where id=rec.mesocycle_id)<>'band_curl' or rec.patches#>>'{0,to,quality,sets_after}'<>'26' then raise exception 'new exercise identity not persisted';end if;
 checks:=checks||'{"new exercise gets one stable UUID, explicit prescription and exact catalogue binding":true}';
 if public.premium_accept_recommendation(rec.id)<>rev or (select count(*) from public.routine_exercises where id=new_id)<>1 then raise exception 'new exercise duplicated';end if;
 checks:=checks||'{"repeat acceptance does not allocate a second exercise UUID":true}';
 rec:=pg_temp.proposal(f2);ch:=pg_temp.layout(rec,4);
 select x->>'ref' into case_name from jsonb_array_elements(rec.analysis_bundle#>'{provider,routine,exercises}')x where x->>'catalogue_id'='band_curl';
 select (x->>'exercise_id')::uuid into old_id from jsonb_array_elements(rec.analysis_bundle->'bindings')x where x->>'ref'=case_name;
 ch:=jsonb_set(ch,'{sessions}',(select jsonb_agg(d||jsonb_build_object('exercises',(select jsonb_agg(x) from jsonb_array_elements(d->'exercises')x where x->>'exercise_ref'<>case_name))) from jsonb_array_elements(ch->'sessions')d));
 ch:=jsonb_set(ch,'{removed_exercises}',jsonb_build_array(jsonb_build_object('exercise_ref',case_name,'reason','Retirada explícita del accesorio añadido.')));
 rec:=pg_temp.prepare(rec,ch);rev:=public.premium_accept_recommendation(rec.id);
 if exists(select 1 from public.routine_exercises where id=old_id) or (select count(*) from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id=rec.routine_id)<>12 or (select catalogue_bindings ? old_id::text from public.coach_mesocycles where id=rec.mesocycle_id) then raise exception 'explicit removal not applied exactly';end if;
 checks:=checks||'{"explicit exercise removal deletes only its UUID and binding, preserving all twelve original exercises":true}';
 -- Exercise the real SQL reserve/claim/finish path with a local mock receipt, not OpenAI.
 perform set_config('request.jwt.claim.sub','',true);
 update coach_private.premium_analysis_budget set enabled=true where id;
 perform set_config('request.jwt.claim.sub',f2->>'user',true);
 rec:=public.premium_weekly_reserve_analysis((f2->>'mesocycle')::uuid,gen_random_uuid());ch:=pg_temp.layout(rec,4);
 perform set_config('request.jwt.claim.sub','',true);
 p:=public.premium_analysis_claim(rec.user_id,rec.id,100,'mock');
 if p->>'claimed'<>'true' or p#>>'{provider,session_distribution_version}'<>'premium-session-distribution-v1' then raise exception 'distribution claim route';end if;
 rec:=public.premium_analysis_finish(rec.user_id,rec.id,pg_temp.output(rec,ch),null,'{"model":"mock","input_tokens":0,"output_tokens":0,"cost_usd":0,"response_schema_version":"premium-weekly-distribution-v1"}','[]');
 if rec.state<>'pending_review' or rec.kind<>'MODIFY' or rec.patches#>>'{0,field}'<>'session_distribution' or rec.analysis_trace#>>'{receipt,response_schema_version}'<>'premium-weekly-distribution-v1' or rec.analysis_trace->>'error' is not null then raise exception 'distribution SQL finish route';end if;
 checks:=checks||'{"real staging reserve/claim/finish persists a structured pending-review proposal with mock receipt and zero provider calls":true}';
 insert into distribution_results values(jsonb_build_object('suite','distribution transactional staging','passed',(select count(*) from jsonb_each(checks)),'checks',checks,'production_writes',0,'openai_calls',0));
end $test$;
select result from distribution_results;
rollback;
