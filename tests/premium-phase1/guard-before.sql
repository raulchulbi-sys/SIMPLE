CREATE OR REPLACE FUNCTION coach_private.guard_structure()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare old_r uuid;new_r uuid;
begin
 -- Explicit administrative maintenance only; end-user RPCs retain auth.uid.
 if auth.uid() is null and current_setting('role',true) in ('none','postgres','service_role') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_table_name='routines' then
  if tg_op<>'INSERT' then old_r:=old.id;end if;
  if tg_op<>'DELETE' then new_r:=new.id;end if;
  if tg_op='UPDATE' and old.id=new.id and
   (to_jsonb(old)-array['routine_order','deleted_at','updated_at'])=(to_jsonb(new)-array['routine_order','deleted_at','updated_at'])
   then return new;end if;
 elsif tg_table_name='routine_days' then
  if tg_op<>'INSERT' then old_r:=old.routine_id;end if;
  if tg_op<>'DELETE' then new_r:=new.routine_id;end if;
 else
  if tg_op<>'INSERT' then select routine_id into old_r from public.routine_days where id=old.day_id;end if;
  if tg_op<>'DELETE' then select routine_id into new_r from public.routine_days where id=new.day_id;end if;
 end if;
 if exists(select 1 from public.routine_management where routine_id in (old_r,new_r))
 then raise exception 'coach_structure_locked' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $function$;
