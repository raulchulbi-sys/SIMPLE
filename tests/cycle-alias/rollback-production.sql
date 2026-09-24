-- Restore the exact pre-alias production RPC. No historical data mutation.
BEGIN;
DO $guard$
BEGIN
 IF md5(pg_get_functiondef('public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure)) <> '88c3564c3c49cf9c53fccba89a1e71b5' THEN RAISE EXCEPTION 'Unexpected RPC version; rollback aborted'; END IF;
END
$guard$;
CREATE OR REPLACE FUNCTION public.get_client_routine_cycle_progress(p_client_id uuid, p_routine_id uuid)
 RETURNS TABLE(total_days bigint, completed_days bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_total bigint;
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

  select count(*) into v_total
  from public.routine_days d
  where d.routine_id=p_routine_id;

  if v_total=0 then
    return query select 0::bigint,0::bigint;
    return;
  end if;

  for r in
    select w.workout_date,
           w.created_at,
           coalesce(
             (select d.id::text from public.routine_days d
              where d.routine_id=p_routine_id
                and lower(trim(d.name))=lower(trim(coalesce(w.data->>'day_name','')))
              order by d.day_order limit 1),
             nullif(w.data->>'routine_day_id','')
           ) as resolved_day_id
    from public.workouts w
    where w.user_id=p_client_id
      and (w.data->>'routine_id')=p_routine_id::text
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
COMMIT;
