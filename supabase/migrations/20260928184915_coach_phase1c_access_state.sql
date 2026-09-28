create or replace function public.get_my_coach_access() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();o public.coach_operations;
begin
 select * into o from public.coach_operations where user_id=u order by created_at desc,id desc limit 1;
 return jsonb_build_object('authorized',coach_private.allowed(u),'plan','basic_pilot','premium',false,
 'generation_consumed',o.id is not null,
 'can_generate',coach_private.allowed(u) and (o.id is null or (o.state in ('failed','stale','rejected','athlete_declined') and o.retry_authorized_at is not null and not exists(select 1 from public.coach_operations where retry_source=o.id))),
 'routine_id',(select routine_id from public.coach_operations where user_id=u and state='accepted'));
end $$;
