-- Synthetic data in the isolated PostgreSQL harness.
DO $test$
DECLARE
  owner_id uuid := gen_random_uuid();
  athlete uuid := gen_random_uuid();
  other_user uuid := gen_random_uuid();
  routine uuid := gen_random_uuid();
  copy_id uuid := gen_random_uuid();
  other_routine uuid := gen_random_uuid();
  assignment_id uuid := gen_random_uuid();
  days uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  request uuid := gen_random_uuid();
  today date := (now() at time zone 'Europe/Madrid')::date;
  template_id uuid := gen_random_uuid();
  copy_first uuid := gen_random_uuid();
  copy_second uuid := gen_random_uuid();
  cutoff timestamptz;
  got bigint;
  history_before jsonb;
  idx integer;
BEGIN
  INSERT INTO auth.users VALUES(owner_id),(athlete),(other_user);
  INSERT INTO public.routines(id,owner_id) VALUES(routine,owner_id),(other_routine,athlete),(copy_id,athlete),(template_id,owner_id);
  INSERT INTO public.routine_assignments(id,client_id,trainer_id,trainer_routine_id) VALUES(assignment_id,athlete,owner_id,routine);
  INSERT INTO public.routine_assignments(id,client_id,trainer_id,trainer_routine_id,client_routine_id)
  VALUES(gen_random_uuid(),athlete,owner_id,template_id,copy_id);
  INSERT INTO public.routine_days VALUES(copy_first,copy_id,'First',1,now()),(copy_second,copy_id,'Second',2,now());
  INSERT INTO public.workouts VALUES(gen_random_uuid(),athlete,today,NULL,
    jsonb_build_object('routine_id',copy_id,'routine_day_id',copy_first));
  PERFORM set_config('request.jwt.claim.sub',athlete::text,true);
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,copy_id);
  IF got<>1 THEN RAISE EXCEPTION 'legacy session without timestamp lost before a reset: %',got; END IF;
  PERFORM public.reset_my_routine_cycle(athlete,copy_id,gen_random_uuid());
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,copy_id);
  IF got<>0 THEN RAISE EXCEPTION 'copy reset did not exclude its legacy session: %',got; END IF;
  SELECT reset_at INTO STRICT cutoff FROM simple_workout_cycle.resets WHERE user_id=athlete AND routine_id=copy_id;
  INSERT INTO public.workouts VALUES(gen_random_uuid(),athlete,today,cutoff+interval '1 microsecond',
    jsonb_build_object('routine_id',copy_id,'routine_day_id',copy_second));
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,copy_id);
  IF got<>1 THEN RAISE EXCEPTION 'first session after own copy reset: %',got; END IF;
  FOR idx IN 1..5 LOOP
    INSERT INTO public.routine_days(id,routine_id,name,day_order,created_at) VALUES(days[idx],routine,'Day '||idx,idx,now());
    INSERT INTO public.workouts(id,user_id,workout_date,created_at,data) VALUES
      (gen_random_uuid(),athlete,today,clock_timestamp()-interval '2 hours'+idx*interval '1 minute',
       jsonb_build_object('routine_id',routine,'routine_day_id',days[idx],'notes','synthetic note'));
  END LOOP;
  PERFORM set_config('request.jwt.claim.sub',athlete::text,true);
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,routine);
  IF got<>5 THEN RAISE EXCEPTION 'initial completion %, expected 5',got; END IF;
  SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) INTO history_before FROM public.workouts w;
  PERFORM public.reset_my_routine_cycle(athlete,routine,request);
  SELECT reset_at INTO STRICT cutoff FROM simple_workout_cycle.resets WHERE user_id=athlete AND routine_id=routine;
  IF history_before IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(w) ORDER BY w.id) FROM public.workouts w) THEN
    RAISE EXCEPTION 'manual reset changed workout history';
  END IF;
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,routine);
  IF got<>0 THEN RAISE EXCEPTION 'completed today then reset %, expected 0',got; END IF;

  INSERT INTO public.workouts VALUES(gen_random_uuid(),athlete,today,cutoff+interval '1 microsecond',
    jsonb_build_object('routine_id',routine,'routine_day_id',days[3]));
  PERFORM public.reset_my_routine_cycle(athlete,routine,request);
  IF cutoff IS DISTINCT FROM (SELECT reset_at FROM simple_workout_cycle.resets WHERE user_id=athlete AND routine_id=routine) THEN
    RAISE EXCEPTION 'the same request moved the cutoff';
  END IF;
  FOR idx IN 1..3 LOOP
    IF idx=2 THEN
      INSERT INTO public.client_routine_statistics_stages(id,client_id,routine_id,started_at)
      VALUES(gen_random_uuid(),athlete,routine,now()-interval '7 days');
    ELSIF idx=3 THEN
      INSERT INTO public.client_routine_customizations(assignment_id,structure)
      SELECT assignment_id,jsonb_build_object('days',jsonb_agg(jsonb_build_object('id',d.id,'day_order',d.day_order,'name',d.name)))
        FROM public.routine_days d WHERE d.routine_id=routine;
    END IF;
    SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,routine);
    IF got<>1 THEN RAISE EXCEPTION 'session after reset in path %: %, expected 1',idx,got; END IF;
  END LOOP;
  PERFORM public.reset_my_routine_cycle(athlete,other_routine,gen_random_uuid());
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,routine);
  IF got<>1 THEN RAISE EXCEPTION 'reset of another routine changed progress'; END IF;

  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,routine);
  IF got<>1 THEN RAISE EXCEPTION 'trainer read differs from athlete'; END IF;
  BEGIN
    PERFORM public.reset_my_routine_cycle(athlete,routine,gen_random_uuid());
    RAISE EXCEPTION 'trainer reset an athlete cycle';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.reset_my_routine_cycle(owner_id,routine,gen_random_uuid());
  SELECT completed_days INTO STRICT got FROM public.get_client_custom_routine_cycle_progress(athlete,routine);
  IF got<>1 THEN RAISE EXCEPTION 'reset of another user changed progress'; END IF;
  PERFORM set_config('request.jwt.claim.sub',other_user::text,true);
  BEGIN
    PERFORM public.reset_my_routine_cycle(other_user,routine,gen_random_uuid());
    RAISE EXCEPTION 'unrelated user reset shared routine';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',athlete::text,true);
  UPDATE public.routine_assignments SET client_deleted_at=now() WHERE id=assignment_id;
  BEGIN
    PERFORM public.reset_my_routine_cycle(athlete,routine,gen_random_uuid());
    RAISE EXCEPTION 'retired assignment accepted a reset';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END
$test$;
