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
 update public.coach_mesocycles set state='active',intake_submitted_at=now(),intake='{"experience":"gt4","goal":"maximize_mass","days":4,"weekdays":["mon","tue","thu","fri"],"minutes_by_day":{"mon":75,"tue":75,"thu":75,"fri":75},"activity":{"type":"none","weekdays":[]},"excluded":[],"inventory":{"equipment":["dumbbells","press45","chest_press","pulldown","seated_curl","cables"],"custom":[]}}'::jsonb where id=m;
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 perform public.premium_bind_catalogue(m,rev,mapping);perform public.premium_assign_reviewer(m,reviewer);
 perform set_config('request.jwt.claim.sub',u::text,true);perform public.premium_permission(m,true);perform public.premium_weekly_permission(m,true);
 select current_revision_id into rev from public.coach_mesocycles where id=m;
 update public.coach_mesocycles set intake=jsonb_set(intake,'{excluded}','["dead_bug","bird_dog"]') where id=m;
 return jsonb_build_object('user',u,'reviewer',reviewer,'routine',rid,'mesocycle',m,'revision',rev,'workout',workout);
end $test$;
create temporary table selection_checks(name text primary key,pass boolean not null check(pass)) on commit drop;
create temporary table selection_samples(name text primary key,context jsonb,output jsonb,patches jsonb) on commit drop;
create function pg_temp.ck(n text,ok boolean)returns void language plpgsql as $t$ begin if ok is distinct from true then raise exception 'check failed: %',n;end if;insert into selection_checks values(n,true);end $t$;
do $t$
declare f jsonb;b jsonb;ctx jsonb;co uuid;r public.coach_recommendations;v jsonb;p jsonb;bad jsonb;denied boolean;first_id uuid;second_id uuid;before_snap jsonb;after_snap jsonb;ss jsonb;rv uuid;before_workout jsonb;jday jsonb;jexercise jsonb;ds jsonb:='[]';es jsonb;
begin
 f:=pg_temp.fixture();perform set_config('request.jwt.claim.sub',f->>'user',true);perform public.premium_chat_permission((f->>'mesocycle')::uuid,true);
 insert into public.coach_conversations(user_id,routine_id,mesocycle_id)values((f->>'user')::uuid,(f->>'routine')::uuid,(f->>'mesocycle')::uuid)returning id into co;
 b:=coach_private.premium_chat_bundle((f->>'mesocycle')::uuid,(f->>'user')::uuid,co,'Quiero revisar estos ejercicios porque están excluidos. ¿Tiene sentido cambiarlos?');ctx:=b->'chat_provider';
 first_id:=(b#>>'{bindings,0,exercise_id}')::uuid;second_id:=(b#>>'{bindings,1,exercise_id}')::uuid;
 perform pg_temp.ck('catalogue metadata and six existing V5 identities available',jsonb_array_length(coach_private.premium_chat_catalogue())=60 and exists(select 1 from jsonb_array_elements(ctx#>'{training,allowed_replacements}')x where x->>'id'='floor_crunch' and x->>'pattern'='trunk_flexion'));
 perform pg_temp.ck('excluded and unavailable identities not allowed',not exists(select 1 from jsonb_array_elements(ctx#>'{training,allowed_replacements}')x where x->>'id' in ('dead_bug','bird_dog','machine_crunch','ab_wheel')));
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,facts,interpretation,analysis_bundle,context_snapshot,analysis_trace,provider_state)
 values((f->>'mesocycle')::uuid,(f->>'routine')::uuid,(f->>'user')::uuid,(f->>'revision')::uuid,'REVIEW','pending_review','[]','Propuesta sintética acotada',b,b,'{"model":"mock"}','finished')returning * into r;
 v:=jsonb_build_object('schema_version','premium-recommendation-v2','kind','MODIFY','facts',jsonb_build_array(jsonb_build_object('exercise_ref','exercise_1','claim',ctx#>'{training,routine,exercises,0,metrics,trend}')),'interpretation','La exclusión declarada afecta al ejercicio heredado.','reason','Sustitución compatible con el material y el objetivo.','confidence','medium','changes',jsonb_build_array(jsonb_build_object('action','replace_exercise','exercise_ref','exercise_1','from_catalogue_id','dead_bug','to_catalogue_id','floor_crunch')));
 p:=coach_private.premium_output_patches(r,v);perform pg_temp.ck('A one compatible replacement compiles MODIFY',jsonb_array_length(p)=1 and p#>>'{0,to,catalogue_id}'='floor_crunch');
 perform pg_temp.ck('I complete per-set prescription captured exactly',p#>'{0,to,planned_sets}'=ctx#>'{training,routine,exercises,0,planned_sets}' and (p#>>'{0,to,sets}')::int=2);
 insert into selection_samples values('multiple alternatives',ctx,jsonb_build_object('schema_version','premium-chat-v1','answer','Los ejercicios están excluidos en el contexto actual; una alternativa del catálogo conserva el volumen y queda para revisión.','facts_used','["intake","exercise_1.prescription"]'::jsonb,'suggested_action','propose_recommendation','recommendation_candidate',v),p);
 bad:=jsonb_set(v,'{changes,0,to_catalogue_id}','"reverse_crunch"');p:=coach_private.premium_output_patches(r,bad);perform pg_temp.ck('B multiple alternatives do not prevent selection',p#>>'{0,to,catalogue_id}'='reverse_crunch');
 insert into selection_samples select 'one alternative',jsonb_set(ctx,'{training,allowed_replacements}',(select jsonb_agg(x) from jsonb_array_elements(ctx#>'{training,allowed_replacements}')x where x->>'id'='floor_crunch')),output,patches from selection_samples where name='multiple alternatives';
 bad:=v||'{"kind":"REVIEW","changes":[]}';p:=coach_private.premium_output_patches(r,bad);perform pg_temp.ck('C no compatible replacement permits REVIEW without patches',p='[]');
 insert into selection_samples select 'no alternatives',jsonb_set(ctx,'{training,allowed_replacements}','[]'),jsonb_set(output,'{recommendation_candidate}',bad),'[]' from selection_samples where name='multiple alternatives';
 bad:=jsonb_set(v,'{changes,0,to_catalogue_id}','"bird_dog"');denied:=false;begin perform coach_private.premium_output_patches(r,bad);exception when others then denied:=true;end;perform pg_temp.ck('D excluded replacement rejected',denied);
 bad:=jsonb_set(v,'{changes,0,to_catalogue_id}','"machine_crunch"');denied:=false;begin perform coach_private.premium_output_patches(r,bad);exception when others then denied:=true;end;perform pg_temp.ck('E unavailable material rejected',denied);
 bad:=jsonb_set(v,'{changes,0,exercise_ref}','"exercise_999"');denied:=false;begin perform coach_private.premium_output_patches(r,bad);exception when others then denied:=true;end;perform pg_temp.ck('F foreign target rejected',denied);
 bad:=jsonb_set(v,'{changes,0,from_catalogue_id}','"db_curl"');denied:=false;begin perform coach_private.premium_output_patches(r,bad);exception when others then denied:=true;end;perform pg_temp.ck('stale from identity rejected',denied);
 bad:=jsonb_set(v,'{changes,0,to_catalogue_id}','"db_curl"');denied:=false;begin perform coach_private.premium_output_patches(r,bad);exception when others then denied:=true;end;perform pg_temp.ck('different muscle/function rejected',denied);
 -- Synthetic baseline contains heterogeneous sets, created before compiling the proposal.
 ss:='[{"set_number":1,"reps_min":8,"reps_max":10,"rir":2,"rest_seconds":120},{"set_number":2,"reps_min":10,"reps_max":12,"rir":3,"rest_seconds":150}]';
 select snapshot into before_snap from public.routine_revisions where id=(f->>'revision')::uuid;
 for jday in select value from jsonb_array_elements(before_snap->'days')loop es:='[]';for jexercise in select value from jsonb_array_elements(jday->'exercises')loop if jexercise->>'id'=first_id::text then jexercise:=jexercise||jsonb_build_object('planned_sets',ss,'scheme','top_backoff','target','8-10','reps_min',8,'reps_max',10,'rir','2','rest_seconds',120);end if;es:=es||jsonb_build_array(jexercise);end loop;ds:=ds||jsonb_build_array(jday||jsonb_build_object('exercises',es));end loop;
 before_snap:=before_snap||jsonb_build_object('days',ds);update public.routine_revisions set snapshot=before_snap,snapshot_hash=md5(before_snap::text) where id=(f->>'revision')::uuid;
 perform set_config('request.jwt.claim.sub','',true);update public.routine_exercises set target='8-10',rir='2',rest_seconds=120 where id=first_id;perform set_config('request.jwt.claim.sub',f->>'user',true);
 b:=coach_private.premium_chat_bundle((f->>'mesocycle')::uuid,(f->>'user')::uuid,co,'Quiero revisar estos ejercicios porque están excluidos. ¿Tiene sentido cambiarlos?');ctx:=b->'chat_provider';r.analysis_bundle:=b;
 v:=v||jsonb_build_object('facts',(v->'facts')||jsonb_build_array(jsonb_build_object('exercise_ref','exercise_2','claim',ctx#>'{training,routine,exercises,1,metrics,trend}')),'changes',(v->'changes')||jsonb_build_array(jsonb_build_object('action','replace_exercise','exercise_ref','exercise_2','from_catalogue_id','bird_dog','to_catalogue_id','reverse_crunch')));
 p:=coach_private.premium_output_patches(r,v);perform pg_temp.ck('H two excluded exercises compile independent targets',jsonb_array_length(p)=2 and p#>>'{0,target_id}'<>p#>>'{1,target_id}');perform pg_temp.ck('J top back-off retains every prescription and scheme',p#>'{0,to,planned_sets}'=ss and p#>>'{0,to,scheme}'='top_backoff');
 update public.coach_recommendations set kind='MODIFY',patches=p,analysis_bundle=b,context_snapshot=b,facts=v->'facts',analysis_trace=analysis_trace||jsonb_build_object('output',v) where id=r.id;
 insert into selection_samples values('top backoff two replacements',ctx,jsonb_build_object('schema_version','premium-chat-v1','answer','Los dos ejercicios excluidos pueden sustituirse conservando sus series individuales; la propuesta requiere revisión.','facts_used','["intake","exercise_1.prescription","exercise_2.prescription"]'::jsonb,'suggested_action','propose_recommendation','recommendation_candidate',v),p);
 denied:=false;begin perform public.premium_accept_recommendation(r.id);exception when others then denied:=sqlerrm='premium_not_ready';end;perform pg_temp.ck('athlete cannot accept pending review',denied);
 perform set_config('request.jwt.claim.sub',f->>'reviewer',true);bad:=public.premium_recommendation_view(r.id);perform pg_temp.ck('reviewer gets concrete names and full prescriptions without private revision read',bad#>>'{patches,0,exercise_name}'='Dead bug' and bad#>'{patches,0,to,planned_sets}'=ss);
 perform public.premium_review_recommendation(r.id,true,'Synthetic controlled review');perform set_config('request.jwt.claim.sub',f->>'user',true);
 perform set_config('request.jwt.claim.sub','',true);update public.routine_exercises set rest_seconds=121 where id=first_id;perform set_config('request.jwt.claim.sub',f->>'user',true);denied:=false;begin perform public.premium_accept_recommendation(r.id);exception when others then denied:=sqlerrm='premium_stale_live_projection';end;perform pg_temp.ck('G changed live prescription safely rejects acceptance',denied);perform set_config('request.jwt.claim.sub','',true);update public.routine_exercises set rest_seconds=120 where id=first_id;perform set_config('request.jwt.claim.sub',f->>'user',true);
 select to_jsonb(w) into before_workout from public.workouts w where id=(f->>'workout')::uuid;
 rv:=public.premium_accept_recommendation(r.id);select snapshot into after_snap from public.routine_revisions where id=rv;
 perform pg_temp.ck('accepted synthetic replacement preserves top back-off in new revision',coach_private.premium_revision_sets(rv,(p#>>'{0,to,id}')::uuid)=ss and exists(select 1 from jsonb_array_elements(after_snap->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where e->>'id'=p#>>'{0,to,id}' and e->>'scheme'='top_backoff'));
 perform pg_temp.ck('replacement catalogue identity survives acceptance and next context',exists(select 1 from jsonb_array_elements((coach_private.premium_chat_bundle((f->>'mesocycle')::uuid,(f->>'user')::uuid,co,'¿Qué cambió?'))#>'{provider,routine,exercises}')x where x->>'catalogue_id'='floor_crunch'));
 perform pg_temp.ck('same routine and remaining ten exercises preserved',(select routine_id=(f->>'routine')::uuid from public.routine_revisions where id=rv) and (select count(*) from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id=(f->>'routine')::uuid)=12 and (select count(*) from jsonb_array_elements(before_snap->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where e->>'id' not in (first_id::text,second_id::text) and exists(select 1 from jsonb_array_elements(after_snap->'days')nd cross join lateral jsonb_array_elements(nd->'exercises')ne where ne->>'id'=e->>'id' and (ne-array['planned_sets','scheme','reps_min','reps_max'])=(e-array['planned_sets','scheme','reps_min','reps_max']) and coach_private.premium_revision_sets(rv,(e->>'id')::uuid)=coach_private.premium_revision_sets((f->>'revision')::uuid,(e->>'id')::uuid)))=10);
 perform pg_temp.ck('R1 immutable and workout unchanged',(select snapshot=before_snap from public.routine_revisions where id=(f->>'revision')::uuid) and (select to_jsonb(w)=before_workout from public.workouts w where id=(f->>'workout')::uuid));
 perform pg_temp.ck('acceptance idempotent same new revision',public.premium_accept_recommendation(r.id)=rv);
 denied:=false;begin perform coach_private.premium_output_patches(r,v);exception when others then denied:=true;end;perform pg_temp.ck('G old proposal cannot recompile against new R2',denied);
end $t$;
select jsonb_build_object('checks',(select jsonb_agg(to_jsonb(c)order by name) from selection_checks c),'samples',(select jsonb_agg(to_jsonb(s)order by name)from selection_samples s)) as result;

ROLLBACK;
