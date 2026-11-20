-- Disposable PostgreSQL database only. Dates are Madrid calendar dates.
-- Invoke each real progress function with the same synthetic two-routine history.
DO $test$
DECLARE
  athlete uuid := gen_random_uuid();
  routine uuid := gen_random_uuid();
  other_routine uuid := gen_random_uuid();
  days uuid[] := array[gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid()];
  today date := (now() at time zone 'Europe/Madrid')::date;
  mode text;
  rpc regproc;
  result record;
  item record;
  stamp date;
  selected uuid;
  idx integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub',athlete::text,true);
  INSERT INTO auth.users(id) VALUES(athlete);
  INSERT INTO public.routines(id,owner_id) VALUES (routine,athlete),(other_routine,athlete);
  FOR idx IN 1..5 LOOP
    INSERT INTO public.routine_days(id,routine_id,name,day_order,created_at)
    VALUES (days[idx],routine,'Day '||idx,idx,now());
  END LOOP;
  FOR mode IN SELECT unnest(array['ordinary','stage','custom']) LOOP
    CASE mode
      WHEN 'ordinary' THEN rpc := 'public.get_client_routine_cycle_progress'::regproc;
      WHEN 'stage' THEN
        INSERT INTO public.client_routine_statistics_stages(id,client_id,routine_id,started_at)
        VALUES(gen_random_uuid(),athlete,routine,now()-interval '40 days');
        rpc := 'public.get_client_routine_stage_cycle_progress'::regproc;
      WHEN 'custom' THEN
        WITH a AS (
          INSERT INTO public.routine_assignments(id,client_id,trainer_id,trainer_routine_id)
          VALUES(gen_random_uuid(),athlete,gen_random_uuid(),routine) RETURNING id
        )
        INSERT INTO public.client_routine_customizations(assignment_id,structure)
        SELECT a.id,jsonb_build_object('days',(
          SELECT jsonb_agg(jsonb_build_object('id',d.id,'day_order',d.day_order,'name',d.name) ORDER BY d.day_order)
          FROM public.routine_days d WHERE d.routine_id=routine
        )) FROM a;
        rpc := 'public.get_client_custom_routine_cycle_progress'::regproc;
    END CASE;
    FOR item IN SELECT * FROM (VALUES
      ('return after Friday/Saturday and a workout elsewhere',array[-7,-6,-3,0],array[2,5,0,4],1),
      ('two full rest days continue',array[-3,0],array[2,4],2),
      ('three full rest days continue',array[-4,0],array[2,4],2),
      ('four full rest days restart',array[-5,0],array[2,4],1),
      ('another routine does not interrupt rest',array[-5,-1,0],array[2,0,4],1),
      ('unresolved day does not interrupt rest',array[-5,-1,0],array[2,6,4],1),
      ('four complete idle dates show zero before next save',array[-7,-5],array[2,4],0),
      ('three complete idle dates still show partial progress',array[-7,-4],array[2,4],2),
      ('first workout on return and next workout',array[-7,-6,-1,0],array[2,5,4,5],2),
      ('same date and repetitions retain restart semantics',array[0,0,0],array[2,3,2],1),
      ('initial day still restarts',array[-2,-1,0],array[2,4,1],1),
      ('all days complete today',array[-4,-3,-2,-1,0],array[1,2,3,4,5],5),
      ('completed yesterday',array[-5,-4,-3,-2,-1],array[1,2,3,4,5],0)
    ) AS cases(label,offsets,day_numbers,expected) LOOP
      DELETE FROM public.workouts WHERE user_id=athlete;
      FOR idx IN 1..cardinality(item.offsets) LOOP
        stamp:=today+item.offsets[idx];
        selected:=CASE WHEN item.day_numbers[idx] IN (0,6) THEN gen_random_uuid() ELSE days[item.day_numbers[idx]] END;
        INSERT INTO public.workouts(id,user_id,workout_date,created_at,data)
        VALUES(gen_random_uuid(),athlete,stamp,stamp+time '10:00'+idx*interval '1 minute',
          jsonb_build_object('routine_id',CASE WHEN item.day_numbers[idx]=0 THEN other_routine ELSE routine END,'routine_day_id',selected));
      END LOOP;
      EXECUTE format('select * from %s($1,$2)',rpc) INTO STRICT result USING athlete,routine;
      IF result.total_days IS DISTINCT FROM 5 OR result.completed_days IS DISTINCT FROM item.expected THEN
        RAISE EXCEPTION '%: %: expected %/5, got %/%',mode,item.label,item.expected,result.completed_days,result.total_days;
      END IF;
    END LOOP;
  END LOOP;
END
$test$;
