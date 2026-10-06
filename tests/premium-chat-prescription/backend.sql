-- Controlled STAGING fixtures, all rolled back. No providers.
BEGIN;
create function pg_temp.fixture() returns jsonb language plpgsql as $test$
declare u uuid:='495fa022-d51b-4bdd-a2f8-e031409b69f5';reviewer uuid;rid uuid:=gen_random_uuid();did uuid;eid uuid;m uuid;rev uuid;i int;j int;cats text[]:=array['dead_bug','bird_dog','pulldown','db_curl','db_rdl','goblet','cable_row','db_shoulder','seated_curl','db_row','floor_press','db_lateral'];mapping jsonb:='{}';c jsonb;workout uuid;
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
 update public.coach_mesocycles set state='active',intake_submitted_at=now(),intake='{"experience":"gt4","goal":"maximize_mass","days":4,"weekdays":["mon","tue","thu","fri"],"minutes_by_day":{"mon":75,"tue":75,"thu":75,"fri":75},"activity":{"type":"none","weekdays":[]},"excluded":[],"inventory":{"equipment":["dumbbells","press45","chest_press","pulldown","seated_curl","cables","barbell","rack"],"custom":[]}}'::jsonb where id=m;
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 perform public.premium_bind_catalogue(m,rev,mapping);perform public.premium_assign_reviewer(m,reviewer);
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_permission(m,true);perform public.premium_weekly_permission(m,true);
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 update public.coach_mesocycles set intake=jsonb_set(intake,'{excluded}','["dead_bug","bird_dog"]') where id=m;
 return jsonb_build_object('user',u,'reviewer',reviewer,'routine',rid,'mesocycle',m,'revision',rev,'workout',workout);
end $test$;
create temporary table rx_checks(name text primary key,pass boolean not null check(pass)) on commit drop;
create temporary table rx_samples(name text primary key,source text,destination text,old_sets jsonb,scheme text,intake jsonb,plan jsonb) on commit drop;
create function pg_temp.ck(n text,ok boolean)returns void language plpgsql as $t$ begin if ok is distinct from true then raise exception 'check failed: %',n;end if;insert into rx_checks values(n,true);end $t$;
create function pg_temp.sample(n text,a text,b text,ss jsonb,scheme text,t jsonb)returns jsonb language plpgsql as $t$ declare p jsonb;begin p:=coach_private.premium_replacement_plan(a,b,ss,scheme,t);insert into rx_samples values(n,a,b,ss,scheme,t,p);return p;end $t$;
do $t$
declare f jsonb;b jsonb;ctx jsonb;co uuid;r public.coach_recommendations;v jsonb;p jsonb;bad jsonb;denied boolean;first_id uuid;second_id uuid;old_snapshot jsonb;old_workout jsonb;new_rev uuid;ss jsonb;rx jsonb;t jsonb;accepted jsonb;
begin
 t:='{"experience":"m6_12","effort":"confident","inventory":{"equipment":["cables","chest_press","incline_press","dumbbells","curl"]},"excluded":[]}';
 ss:='[{"set_number":1,"reps_min":10,"reps_max":12,"rir":3,"rest_seconds":60},{"set_number":2,"reps_min":10,"reps_max":12,"rir":3,"rest_seconds":60}]';
 rx:=pg_temp.sample('A stability to dynamic','dead_bug','cable_crunch',ss,'straight',t);
 perform pg_temp.ck('A recalculates 10-15 RIR3 120s without volume increase',rx#>>'{planned_sets,0,reps_max}'='15' and rx#>>'{planned_sets,0,rest_seconds}'='120' and jsonb_array_length(rx->'planned_sets')=2);
 rx:=pg_temp.sample('A second stability to dynamic','bird_dog','reverse_crunch',ss,'straight',t);
 perform pg_temp.ck('A second independent target same policy',rx#>>'{planned_sets,0,rir}'='3' and rx#>>'{planned_sets,1,rest_seconds}'='120');
 ss:='[{"set_number":1,"reps_min":8,"reps_max":12,"rir":2,"rest_seconds":180},{"set_number":2,"reps_min":8,"reps_max":12,"rir":2,"rest_seconds":180}]';
 rx:=pg_temp.sample('B machine equivalent','chest_press','incline_press',ss,'straight',t);
 perform pg_temp.ck('B valid machine prescription retained',rx->'planned_sets'=ss);
 rx:=pg_temp.sample('C compound equivalent','goblet','body_squat',ss,'straight',t);
 perform pg_temp.ck('C valid compound prescription retained',rx->'planned_sets'=ss);
 denied:=false;begin perform coach_private.premium_replacement_plan('dead_bug','machine_crunch',ss,'straight',t);exception when others then denied:=sqlerrm='replacement_denied';end;
 perform pg_temp.ck('D different requirements unavailable denied',denied);
 rx:=pg_temp.sample('D available different requirements','dead_bug','machine_crunch',ss,'straight',jsonb_set(t,'{inventory,equipment}','["ab_machine"]'));
 perform pg_temp.ck('D available requirement permits reassessment',rx#>>'{planned_sets,0,reps_min}'='10');
 ss:='[{"set_number":1,"reps_min":10,"reps_max":15,"rir":2,"rest_seconds":120},{"set_number":2,"reps_min":10,"reps_max":15,"rir":2,"rest_seconds":120}]';
 rx:=pg_temp.sample('E old prescription valid','db_curl','curl',ss,'straight',jsonb_set(t,'{inventory,equipment}','["curl","dumbbells"]'));
 perform pg_temp.ck('E valid prescription remains identical',rx->'planned_sets'=ss);
 ss:=jsonb_set(jsonb_set(ss,'{0,rir}','1'),'{0,rest_seconds}','60');
 rx:=pg_temp.sample('F invalid old effort rest','chest_press','incline_press',ss,'straight',t);
 perform pg_temp.ck('F novice effort and insufficient rest repaired',rx#>>'{planned_sets,0,rir}'='3' and (rx#>>'{planned_sets,0,rest_seconds}')::int>=150);
 ss:='[{"set_number":1,"reps_min":8,"reps_max":10,"rir":1,"rest_seconds":90},{"set_number":2,"reps_min":10,"reps_max":12,"rir":2,"rest_seconds":90}]';
 rx:=pg_temp.sample('G incompatible top backoff','floor_crunch','reverse_crunch',ss,'top_backoff',jsonb_set(t,'{experience}','"gt4"'));
 perform pg_temp.ck('G top backoff not copied to accessory',rx->>'scheme'='straight' and rx#>>'{planned_sets,0,reps_max}'=rx#>>'{planned_sets,1,reps_max}');
 ss:='[{"set_number":1,"reps_min":8,"reps_max":10,"rir":1,"rest_seconds":180},{"set_number":2,"reps_min":10,"reps_max":12,"rir":2,"rest_seconds":180}]';
 rx:=pg_temp.sample('G compatible compound top backoff','chest_press','incline_press',ss,'top_backoff',jsonb_set(t,'{experience}','"gt4"'));
 perform pg_temp.ck('G suitable advanced compound retains individual sets',rx->>'scheme'='top_backoff' and rx->'planned_sets'=ss);
 denied:=false;begin perform coach_private.premium_replacement_plan('dead_bug','reverse_crunch',ss,'straight',jsonb_set(t,'{excluded}','["reverse_crunch"]'));exception when others then denied:=sqlerrm='replacement_denied';end;
 perform pg_temp.ck('H excluded destination denied',denied);
 denied:=false;begin perform coach_private.premium_replacement_plan('db_curl','triceps',ss,'straight',jsonb_set(t,'{inventory,equipment}','["triceps"]'));exception when others then denied:=sqlerrm='replacement_function_mismatch';end;
 perform pg_temp.ck('different primary muscle rejected despite group arms',denied);
 f:=pg_temp.fixture();perform set_config('request.jwt.claim.sub',f->>'user',true);perform public.premium_chat_permission((f->>'mesocycle')::uuid,true);
 insert into public.coach_conversations(user_id,routine_id,mesocycle_id)values((f->>'user')::uuid,(f->>'routine')::uuid,(f->>'mesocycle')::uuid)returning id into co;
 b:=coach_private.premium_chat_bundle((f->>'mesocycle')::uuid,(f->>'user')::uuid,co,'Quiero revisar estos ejercicios excluidos.');ctx:=b->'chat_provider';
 first_id:=(b#>>'{bindings,0,exercise_id}')::uuid;second_id:=(b#>>'{bindings,1,exercise_id}')::uuid;
 select snapshot into old_snapshot from public.routine_revisions where id=(f->>'revision')::uuid;
 select to_jsonb(w) into old_workout from public.workouts w where id=(f->>'workout')::uuid;
 perform pg_temp.ck('new bundle captured v1.2 only',b#>>'{provider,chat_selection_version}'='premium-chat-selection-v1.2');
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,facts,interpretation,analysis_bundle,context_snapshot,analysis_trace,provider_state)
 values((f->>'mesocycle')::uuid,(f->>'routine')::uuid,(f->>'user')::uuid,(f->>'revision')::uuid,'REVIEW','pending_review','[]','Synthetic prescription',b,b,'{"model":"mock"}','finished')returning * into r;
 v:=jsonb_build_object('schema_version','premium-recommendation-v2','kind','MODIFY','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',ctx#>'{training,routine,exercises,0,metrics,trend}'),jsonb_build_object('exercise_ref','exercise_2','claim',ctx#>'{training,routine,exercises,1,metrics,trend}')),'interpretation','Las exclusiones afectan a los ejercicios heredados.','reason','Sustitución con prescripción reevaluada y volumen conservado.','confidence','medium','changes','[{"action":"replace_exercise","exercise_ref":"exercise_1","from_catalogue_id":"dead_bug","to_catalogue_id":"cable_crunch"},{"action":"replace_exercise","exercise_ref":"exercise_2","from_catalogue_id":"bird_dog","to_catalogue_id":"reverse_crunch"}]'::jsonb);
 p:=coach_private.premium_output_patches(r,v);
 perform pg_temp.ck('server mapper recalculates both targets and 4 series',jsonb_array_length(p)=2 and p#>>'{0,to,rest_seconds}'='120' and p#>>'{1,to,target}'='10-15' and p#>>'{0,to,sets}'='2' and p#>>'{1,to,sets}'='2');
 bad:=jsonb_set(p->0,'{to,rest_seconds}','60');denied:=false;begin perform coach_private.premium_check_patch(bad,(f->>'routine')::uuid,false);exception when others then denied:=true;end;perform pg_temp.ck('server rejects tampered prescription despite valid model selection',denied);
 bad:=r.analysis_bundle;r.analysis_bundle:=jsonb_set(r.analysis_bundle,'{provider,intake,minutes_by_day}','{"mon":1,"tue":1,"thu":1,"fri":1}');r.analysis_bundle:=jsonb_set(r.analysis_bundle,'{provider,replacement_schedule}','[]');
-- Same valid live baseline; only available time is constrained in this synthetic context.
 accepted:=v||jsonb_build_object('facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_6','claim',ctx#>'{training,routine,exercises,5,metrics,trend}')),'changes','[{"action":"replace_exercise","exercise_ref":"exercise_6","from_catalogue_id":"goblet","to_catalogue_id":"bar_squat"}]'::jsonb);
 denied:=false;begin perform coach_private.premium_output_patches(r,accepted);exception when others then denied:=sqlerrm='replacement_duration_exceeded';end;perform pg_temp.ck('higher demand cannot fit by compressing rest',denied);r.analysis_bundle:=bad;
 update public.coach_recommendations set kind='MODIFY',patches=p,analysis_bundle=b,context_snapshot=b,facts=v->'facts',analysis_trace=analysis_trace||jsonb_build_object('output',v) where id=r.id;
 denied:=false;begin perform public.premium_accept_recommendation(r.id);exception when others then denied:=sqlerrm='premium_not_ready';end;perform pg_temp.ck('pending review cannot accept',denied);
 perform set_config('request.jwt.claim.sub',f->>'reviewer',true);bad:=public.premium_recommendation_view(r.id);perform pg_temp.ck('reviewer receives new per-set prescriptions',bad#>>'{patches,0,to,planned_sets,0,rest_seconds}'='120');
 perform public.premium_review_recommendation(r.id,true,'Synthetic rollback-only review');perform set_config('request.jwt.claim.sub',f->>'user',true);
 new_rev:=public.premium_accept_recommendation(r.id);
 perform pg_temp.ck('acceptance uses validated new prescription',coach_private.premium_revision_sets(new_rev,(p#>>'{0,to,id}')::uuid)=p#>'{0,to,planned_sets}');
 perform pg_temp.ck('R1 unchanged',old_snapshot=(select snapshot from public.routine_revisions where id=(f->>'revision')::uuid));
 perform pg_temp.ck('workout unchanged',old_workout=(select to_jsonb(w) from public.workouts w where id=(f->>'workout')::uuid));
 perform pg_temp.ck('same routine 12 exercises and other ten UUIDs retained',(select count(*) from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id=(f->>'routine')::uuid)=12 and (select count(*) from jsonb_array_elements(old_snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where e->>'id' not in (first_id::text,second_id::text) and exists(select 1 from public.routine_exercises n where n.id=(e->>'id')::uuid))=10);
 perform pg_temp.ck('acceptance idempotent same R2',public.premium_accept_recommendation(r.id)=new_rev);
 insert into rx_samples values('pipeline',null,null,null,null,ctx,jsonb_build_object('output',jsonb_build_object('schema_version','premium-chat-v1','answer','La propuesta sustituye los ejercicios excluidos con series reevaluadas para revisión.','facts_used','["intake","exercise_1.prescription","exercise_2.prescription"]'::jsonb,'suggested_action','propose_recommendation','recommendation_candidate',v),'patches',p));
end $t$;
select jsonb_build_object('checks',(select jsonb_agg(to_jsonb(x) order by name) from rx_checks x),'samples',(select jsonb_agg(to_jsonb(x) order by name) from rx_samples x)) result;
ROLLBACK;
