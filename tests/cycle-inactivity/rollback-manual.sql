BEGIN;

-- Revert the cycle calculation and disable the button endpoint. Retain existing reset records.
DO $cycle$
DECLARE
  target record;
  definition text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('public.get_client_custom_routine_cycle_progress(uuid,uuid)'::regprocedure,
       'f28446325418816d1d562f44541acdc3', '2c954014d6e7a698b917dcfc745d2418'),
      ('public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure,
       '59d4d6fd9e6a620dec68f132ab951af2', '6763f63a60aac47ea48d85b7df5a5955'),
      ('public.get_client_routine_stage_cycle_progress(uuid,uuid)'::regprocedure,
       'c1c019deb66815332459d33b3c002c19', '85bd13998be1bf5591facdef6b0b1ea0')
    ) AS changes(fn, expected_hash, result_hash)
  LOOP
    definition := pg_get_functiondef(target.fn);
    IF md5(definition) <> target.expected_hash THEN
      RAISE EXCEPTION 'Unexpected starting definition for %', target.fn;
    END IF;
    definition := replace(definition, $old$  if v_today - v_previous_workout_date > 4 then
    v_done:=0;
  end if;
  return query select v_total,v_done;$old$, $new$  return query select v_total,v_done;$new$);
    definition := replace(definition, $old$if r.workout_date - v_previous_workout_date > 4 then$old$, $new$if r.workout_date - v_previous_workout_date > 3 then$new$);
    definition := replace(definition, $old$    where w.user_id=p_client_id
      and not exists (
        select 1 from simple_workout_cycle.resets m
        where m.user_id=p_client_id and m.routine_id=p_routine_id
          and (w.created_at is null or w.created_at <= m.reset_at)
      )$old$, $new$    where w.user_id=p_client_id$new$);
    IF md5(definition) <> target.result_hash THEN
      RAISE EXCEPTION 'Unexpected replacement for %', target.fn;
    END IF;
    EXECUTE definition;
    IF md5(pg_get_functiondef(target.fn)) <> target.result_hash THEN
      RAISE EXCEPTION 'Verification failed for %', target.fn;
    END IF;
  END LOOP;
END
$cycle$;

DROP FUNCTION public.reset_my_routine_cycle(uuid,uuid,uuid);

COMMIT;
