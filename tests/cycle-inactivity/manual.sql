BEGIN;

-- Run the entire file in one transaction. This stores personal cycle boundaries
-- independently from workout history and statistics stages.
CREATE SCHEMA IF NOT EXISTS simple_workout_cycle;
REVOKE ALL ON SCHEMA simple_workout_cycle FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS simple_workout_cycle.resets (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  reset_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (user_id, routine_id, request_id)
);
ALTER TABLE simple_workout_cycle.resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE simple_workout_cycle.resets FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS cycle_resets_latest ON simple_workout_cycle.resets (user_id, routine_id, reset_at DESC);

CREATE OR REPLACE FUNCTION public.reset_my_routine_cycle(
  p_expected_user_id uuid, p_routine_id uuid, p_request_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $reset$
DECLARE
  actor uuid := auth.uid();
BEGIN
  IF actor IS NULL OR actor IS DISTINCT FROM p_expected_user_id OR p_request_id IS NULL THEN
    RAISE EXCEPTION 'Unexpected cycle reset identity or request' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.routines r
    WHERE r.id=p_routine_id AND r.deleted_at IS NULL AND (
      r.owner_id=actor OR EXISTS (
        SELECT 1 FROM public.routine_assignments a
        WHERE a.client_id=actor AND a.trainer_routine_id=r.id AND a.client_deleted_at IS NULL
      )
    )
  ) THEN
    RAISE EXCEPTION 'Routine unavailable for cycle reset' USING ERRCODE = '42501';
  END IF;

  INSERT INTO simple_workout_cycle.resets(user_id,routine_id,request_id)
  VALUES (actor,p_routine_id,p_request_id)
  ON CONFLICT (user_id,routine_id,request_id) DO NOTHING;
END;
$reset$;
REVOKE ALL ON FUNCTION public.reset_my_routine_cycle(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_my_routine_cycle(uuid,uuid,uuid) TO authenticated;

DO $cycle$
DECLARE
  target record;
  definition text;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('public.get_client_custom_routine_cycle_progress(uuid,uuid)'::regprocedure,
       '2c954014d6e7a698b917dcfc745d2418', 'f28446325418816d1d562f44541acdc3'),
      ('public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure,
       '6763f63a60aac47ea48d85b7df5a5955', '59d4d6fd9e6a620dec68f132ab951af2'),
      ('public.get_client_routine_stage_cycle_progress(uuid,uuid)'::regprocedure,
       '85bd13998be1bf5591facdef6b0b1ea0', 'c1c019deb66815332459d33b3c002c19')
    ) AS changes(fn, expected_hash, result_hash)
  LOOP
    definition := pg_get_functiondef(target.fn);
    IF md5(definition) <> target.expected_hash THEN
      RAISE EXCEPTION 'Unexpected starting definition for %', target.fn;
    END IF;
    definition := replace(definition, $old$  return query select v_total,v_done;$old$, $new$  if v_today - v_previous_workout_date > 4 then
    v_done:=0;
  end if;
  return query select v_total,v_done;$new$);
    definition := replace(definition, $old$if r.workout_date - v_previous_workout_date > 3 then$old$, $new$if r.workout_date - v_previous_workout_date > 4 then$new$);
    definition := replace(definition, $old$    where w.user_id=p_client_id$old$, $new$    where w.user_id=p_client_id
      and not exists (
        select 1 from simple_workout_cycle.resets m
        where m.user_id=p_client_id and m.routine_id=p_routine_id
          and (w.created_at is null or w.created_at <= m.reset_at)
      )$new$);
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

COMMIT;
