-- New statistical stages retain every workout, UUID, note and assignment.
-- Existing cycle RPC and its confirmed aliases remain untouched.
CREATE TABLE public.client_routine_statistics_stages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 routine_id uuid NOT NULL REFERENCES public.routines(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
 request_id uuid NOT NULL,
 UNIQUE(client_id,routine_id,request_id)
);
CREATE INDEX client_routine_statistics_stages_latest ON public.client_routine_statistics_stages(client_id,routine_id,started_at DESC,id DESC);
ALTER TABLE public.client_routine_statistics_stages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_routine_statistics_stages FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.get_client_routine_statistics_stage(p_client_id uuid,p_routine_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.client_routine_statistics_stages;
BEGIN
 IF auth.uid() IS NULL OR p_client_id IS NULL OR p_routine_id IS NULL THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.routines r WHERE r.id=p_routine_id AND r.deleted_at IS NULL AND
  ((auth.uid()=p_client_id AND r.owner_id=p_client_id) OR EXISTS(
    SELECT 1 FROM public.routine_assignments a WHERE a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id AND a.client_deleted_at IS NULL
      AND (auth.uid()=p_client_id OR a.trainer_id=auth.uid()))))
 THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id ORDER BY started_at DESC,id DESC LIMIT 1;
 RETURN jsonb_build_object('id',s.id,'started_at',s.started_at);
END $$;

CREATE FUNCTION public.reset_client_routine_statistics(p_client_id uuid,p_routine_id uuid,p_expected_stage uuid,p_request_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE s public.client_routine_statistics_stages; latest uuid;
BEGIN
 IF auth.uid() IS NULL OR p_request_id IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='trainer')
    OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=p_client_id AND role='client')
    OR NOT EXISTS(SELECT 1 FROM public.routine_assignments a JOIN public.routines r ON r.id=a.trainer_routine_id
      WHERE a.trainer_id=auth.uid() AND a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id AND a.client_deleted_at IS NULL AND r.deleted_at IS NULL)
 THEN RAISE EXCEPTION 'statistics_not_authorized' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.coach_mesocycles WHERE routine_id=p_routine_id AND user_id=p_client_id AND state='active')
 THEN RAISE EXCEPTION 'statistics_coach_managed'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_client_id::text||':'||p_routine_id::text||':statistics',0));
 SELECT * INTO s FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id AND request_id=p_request_id;
 IF s.id IS NOT NULL THEN RETURN jsonb_build_object('id',s.id,'started_at',s.started_at); END IF;
 SELECT id INTO latest FROM public.client_routine_statistics_stages WHERE client_id=p_client_id AND routine_id=p_routine_id ORDER BY started_at DESC,id DESC LIMIT 1;
 IF latest IS DISTINCT FROM p_expected_stage THEN RAISE EXCEPTION 'statistics_stage_conflict' USING ERRCODE='40001'; END IF;
 INSERT INTO public.client_routine_statistics_stages(client_id,routine_id,created_by,request_id) VALUES(p_client_id,p_routine_id,auth.uid(),p_request_id) RETURNING * INTO s;
 RETURN jsonb_build_object('id',s.id,'started_at',s.started_at);
END $$;

CREATE OR REPLACE FUNCTION public.get_client_routine_stage_cycle_progress(p_client_id uuid, p_routine_id uuid)
 RETURNS TABLE(total_days bigint, completed_days bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_total bigint;
  v_stage timestamptz;
  v_done bigint := 0;
  v_seen text[] := '{}';
  v_last_completion_date date := null;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_key text;
  r record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_client_id is null or p_routine_id is null then raise exception 'Not authorized'; end if;
  if auth.uid() = p_client_id and not (
    exists(select 1 from public.routines own_routine
      where own_routine.id=p_routine_id and own_routine.owner_id=auth.uid())
    or exists(select 1 from public.routine_assignments a
      where a.client_id=auth.uid() and a.trainer_routine_id=p_routine_id
        and a.client_deleted_at is null)
  ) then raise exception 'Not authorized'; end if;

  if auth.uid() <> p_client_id and not exists (
    select 1 from public.routine_assignments a
    where a.trainer_id=auth.uid()
      and a.client_id=p_client_id
      and a.trainer_routine_id=p_routine_id
      and a.client_deleted_at is null
  ) then raise exception 'Not authorized'; end if;

  select s.started_at into v_stage from public.client_routine_statistics_stages s
    where s.client_id=p_client_id and s.routine_id=p_routine_id order by s.started_at desc,s.id desc limit 1;
  if v_stage is null then
    return query select * from public.get_client_routine_cycle_progress(p_client_id,p_routine_id);
    return;
  end if;

  select count(*) into v_total
  from public.routine_days d
  where d.routine_id=p_routine_id;

  if v_total=0 then
    return query select 0::bigint,0::bigint;
    return;
  end if;

  for r in
    -- Historical day continuity confirmed by the owner on 2026-09-21.
    -- Scope is this client AND routine only. These aliases affect cycle counting,
    -- never workout JSON, exercises, notes, charts or historical identity.
    with confirmed_day_aliases(client_id,routine_id,old_day_id,current_day_id) as (
      values
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'05b6c573-abcb-4259-9c0a-93459ddd5a24'::uuid,'1f9fbb95-9941-4cc4-989c-bfc1d590977b'::uuid),
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'879e13f3-9c0d-4020-b10d-d7f753fedb6b'::uuid,'21a2160e-8822-423a-933f-e0413136983c'::uuid),
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'0e4e1c85-3612-481c-9f67-41345b0afa20'::uuid,'950d5458-270f-4f9a-a16a-be4c7d346ca7'::uuid),
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'041166f2-4306-45c1-b86f-0eb4aca27ed1'::uuid,'7f929817-c4cf-447b-b7f1-0353f73d6659'::uuid)
    )
    select w.workout_date,
           w.created_at,
           case
             when nullif(w.data->>'routine_day_id','') is not null then
               coalesce(
                 (select d.id::text from public.routine_days d
                  where d.routine_id=p_routine_id
                    and d.id::text=w.data->>'routine_day_id'),
                 (select d.id::text from confirmed_day_aliases a
                  join public.routine_days d
                    on d.id=a.current_day_id and d.routine_id=a.routine_id
                  where a.client_id=p_client_id and a.routine_id=p_routine_id
                    and a.old_day_id::text=w.data->>'routine_day_id')
               )
             else
               (select min(d.id::text) from public.routine_days d
                where d.routine_id=p_routine_id
                  and lower(trim(d.name))=lower(trim(coalesce(w.data->>'day_name','')))
                having count(*)=1)
           end as resolved_day_id
    from public.workouts w
    where w.user_id=p_client_id
      and (w.data->>'routine_id')=p_routine_id::text
      and w.created_at>=v_stage
    order by w.workout_date asc, w.created_at asc, w.id asc
  loop
    v_key:=coalesce(r.resolved_day_id,'');
    if v_key='' then continue; end if;

    -- A repeated day before completing the cycle means the client has
    -- started a new turn of the routine. The repeated day is day 1.
    if v_key=any(v_seen) and v_done<v_total then
      v_seen:=array[v_key];
      v_done:=1;
    else
      v_seen:=array_append(v_seen,v_key);
      v_done:=v_done+1;
    end if;

    if v_done>=v_total then
      v_last_completion_date:=r.workout_date;
      v_seen:='{}';
      v_done:=0;
    end if;
  end loop;

  -- A cycle completed today remains at 100% for today. After that day,
  -- the new cycle starts from zero unless workouts have already been done.
  if v_last_completion_date=v_today then
    return query select v_total,v_total;
    return;
  end if;

  return query select v_total,v_done;
end
$function$
;
REVOKE ALL ON FUNCTION public.get_client_routine_statistics_stage(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.reset_client_routine_statistics(uuid,uuid,uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.get_client_routine_stage_cycle_progress(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_client_routine_statistics_stage(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_client_routine_statistics(uuid,uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_client_routine_stage_cycle_progress(uuid,uuid) TO authenticated;
