-- One atomic change to the three existing read-only cycle functions.
-- Keep their historical mappings, authorization, owner and grants in place.
DO $cycle$
DECLARE
  target record;
  definition text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('public.get_client_custom_routine_cycle_progress(uuid,uuid)'::regprocedure,
       'a936e5595f93366d74d41dcdbe0b6ea7', '2c954014d6e7a698b917dcfc745d2418'),
      ('public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure,
       '2a8197e876ca69d5bb54124f40c06107', '6763f63a60aac47ea48d85b7df5a5955'),
      ('public.get_client_routine_stage_cycle_progress(uuid,uuid)'::regprocedure,
       '5c6c56ae1ca187aefb37891e8664b9fb', '85bd13998be1bf5591facdef6b0b1ea0')
    ) AS changes(fn, expected_hash, result_hash)
  LOOP
    definition := pg_get_functiondef(target.fn);
    IF md5(definition) <> target.expected_hash THEN
      RAISE EXCEPTION 'Unexpected starting definition for %', target.fn;
    END IF;
    definition := replace(definition, $old$  v_last_completion_date date := null;$old$, $new$  v_previous_workout_date date;
  v_last_completion_date date := null;$new$);
    definition := replace(definition, $old$    if v_key='' then continue; end if;$old$, $new$    if v_key='' then continue; end if;

    -- Count the calendar dates strictly between two saved days of this routine.
    if r.workout_date - v_previous_workout_date > 3 then
      v_seen:='{}';
      v_done:=0;
    end if;
    v_previous_workout_date:=r.workout_date;$new$);
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
