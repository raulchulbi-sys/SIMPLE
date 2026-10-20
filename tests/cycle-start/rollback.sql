-- Exact inverse of candidate.sql; refuses unexpected definitions or metadata.
BEGIN;

DO $cycle_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.get_client_custom_routine_cycle_progress(uuid,uuid)'::regprocedure
      AND md5(pg_get_functiondef(p.oid))='a936e5595f93366d74d41dcdbe0b6ea7'
      AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef=true
      AND to_jsonb(p.proacl)='["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]'::jsonb
      AND to_jsonb(p.proconfig)='["search_path=public, pg_temp"]'::jsonb
  ) THEN RAISE EXCEPTION 'cycle_rollback_before_mismatch: public.get_client_custom_routine_cycle_progress(uuid,uuid)'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure
      AND md5(pg_get_functiondef(p.oid))='2a8197e876ca69d5bb54124f40c06107'
      AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef=true
      AND to_jsonb(p.proacl)='["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]'::jsonb
      AND to_jsonb(p.proconfig)='["search_path=public, pg_temp"]'::jsonb
  ) THEN RAISE EXCEPTION 'cycle_rollback_before_mismatch: public.get_client_routine_cycle_progress(uuid,uuid)'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.get_client_routine_stage_cycle_progress(uuid,uuid)'::regprocedure
      AND md5(pg_get_functiondef(p.oid))='5c6c56ae1ca187aefb37891e8664b9fb'
      AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef=true
      AND to_jsonb(p.proacl)='["postgres=X/postgres","authenticated=X/postgres"]'::jsonb
      AND to_jsonb(p.proconfig)='["search_path=public, pg_temp"]'::jsonb
  ) THEN RAISE EXCEPTION 'cycle_rollback_before_mismatch: public.get_client_routine_stage_cycle_progress(uuid,uuid)'; END IF;
END;
$cycle_guard$;

CREATE OR REPLACE FUNCTION public.get_client_custom_routine_cycle_progress(p_client_id uuid, p_routine_id uuid)
 RETURNS TABLE(total_days bigint, completed_days bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_total bigint;
  v_structure jsonb;
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

  IF NOT EXISTS(SELECT 1 FROM public.routine_assignments a JOIN public.client_routine_customizations c ON c.assignment_id=a.id WHERE a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id) THEN
    return query select * from public.get_client_routine_stage_cycle_progress(p_client_id,p_routine_id);return;
  END IF;
  v_structure:=public.get_client_routine_structure(p_client_id,p_routine_id);
  select s.started_at into v_stage from public.client_routine_statistics_stages s
    where s.client_id=p_client_id and s.routine_id=p_routine_id order by s.started_at desc,s.id desc limit 1;

  with effective_days as (select (value->>'id')::uuid id,p_routine_id routine_id,value->>'name' name from jsonb_array_elements(v_structure->'days'))
  select count(*) into v_total
  from effective_days d
  where d.routine_id=p_routine_id;

  if v_total=0 then
    return query select 0::bigint,0::bigint;
    return;
  end if;

  for r in
    -- Historical day continuity confirmed by the owner on 2026-09-21.
    -- Scope is this client AND routine only. These aliases affect cycle counting,
    -- never workout JSON, exercises, notes, charts or historical identity.
    with effective_days as (select (value->>'id')::uuid id,p_routine_id routine_id,value->>'name' name from jsonb_array_elements(v_structure->'days')),
    confirmed_day_aliases(client_id,routine_id,old_day_id,current_day_id) as (
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
                 (select d.id::text from effective_days d
                  where d.routine_id=p_routine_id
                    and d.id::text=w.data->>'routine_day_id'),
                 (select d.id::text from confirmed_day_aliases a
                  join effective_days d
                    on d.id=a.current_day_id and d.routine_id=a.routine_id
                  where a.client_id=p_client_id and a.routine_id=p_routine_id
                    and a.old_day_id::text=w.data->>'routine_day_id')
               )
             else
               (select min(d.id::text) from effective_days d
                where d.routine_id=p_routine_id
                  and lower(trim(d.name))=lower(trim(coalesce(w.data->>'day_name','')))
                having count(*)=1)
           end as resolved_day_id
    from public.workouts w
    where w.user_id=p_client_id
      and (w.data->>'routine_id')=p_routine_id::text
      and (v_stage is null or w.created_at>=v_stage)
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
$function$;

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
$function$;

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
$function$;

DO $cycle_guard$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.get_client_custom_routine_cycle_progress(uuid,uuid)'::regprocedure
      AND md5(pg_get_functiondef(p.oid))='0199a244143ccbf520a301a3f55f1bde'
      AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef=true
      AND to_jsonb(p.proacl)='["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]'::jsonb
      AND to_jsonb(p.proconfig)='["search_path=public, pg_temp"]'::jsonb
  ) THEN RAISE EXCEPTION 'cycle_rollback_after_mismatch: public.get_client_custom_routine_cycle_progress(uuid,uuid)'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.get_client_routine_cycle_progress(uuid,uuid)'::regprocedure
      AND md5(pg_get_functiondef(p.oid))='88c3564c3c49cf9c53fccba89a1e71b5'
      AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef=true
      AND to_jsonb(p.proacl)='["postgres=X/postgres","authenticated=X/postgres","service_role=X/postgres"]'::jsonb
      AND to_jsonb(p.proconfig)='["search_path=public, pg_temp"]'::jsonb
  ) THEN RAISE EXCEPTION 'cycle_rollback_after_mismatch: public.get_client_routine_cycle_progress(uuid,uuid)'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p WHERE p.oid='public.get_client_routine_stage_cycle_progress(uuid,uuid)'::regprocedure
      AND md5(pg_get_functiondef(p.oid))='33b792eb30c3303822c425b78c188af8'
      AND pg_get_userbyid(p.proowner)='postgres'
      AND p.prosecdef=true
      AND to_jsonb(p.proacl)='["postgres=X/postgres","authenticated=X/postgres"]'::jsonb
      AND to_jsonb(p.proconfig)='["search_path=public, pg_temp"]'::jsonb
  ) THEN RAISE EXCEPTION 'cycle_rollback_after_mismatch: public.get_client_routine_stage_cycle_progress(uuid,uuid)'; END IF;
END;
$cycle_guard$;

COMMIT;
