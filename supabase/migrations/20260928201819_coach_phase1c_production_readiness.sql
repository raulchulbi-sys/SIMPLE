-- Production readiness, validated first in SIMPLE Security Test. No legacy table changes.
CREATE OR REPLACE FUNCTION coach_private.allowed(u uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
 select coalesce((coach_private.pilot_config()->u::text->>'enabled')::boolean,false)
 and coalesce((coach_private.pilot_config()->u::text->>'activated_at')::timestamptz<=now(),true)
 and coalesce((coach_private.pilot_config()->u::text->>'adult_confirmed')::boolean,false)
 and coalesce((coach_private.pilot_config()->u::text->>'expires_at')::timestamptz>now(),false)
 and exists(select 1 from public.profiles where id=u and role='client')
$function$
;
CREATE OR REPLACE FUNCTION public.get_my_coach_access()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
declare u uuid:=coach_private.actor();o public.coach_operations;
begin
 select * into o from public.coach_operations where user_id=u order by created_at desc,id desc limit 1;
 return jsonb_build_object('authorized',coach_private.allowed(u),'plan','basic_pilot','premium',false,
 'generation_consumed',o.id is not null,
 'can_feedback',exists(select 1 from public.routine_management m join public.workouts w on w.user_id=m.user_id and w.data->>'routine_id'=m.routine_id::text where m.user_id=u),
 'can_generate',coach_private.allowed(u) and (o.id is null or (o.state in ('failed','stale','rejected','athlete_declined') and o.retry_authorized_at is not null and not exists(select 1 from public.coach_operations where retry_source=o.id))),
 'routine_id',(select routine_id from public.coach_operations where user_id=u and state='accepted'));
end $function$
;
CREATE OR REPLACE FUNCTION public.get_coach_review_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',to_jsonb(o),'athlete',jsonb_build_object('user_id',o.user_id,'name',(select p.name from public.profiles p where p.id=o.user_id)),'training',i.training,'health',h.declarations,
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id join public.intake_health h on h.intake_id=i.id
 where o.user_id<>auth.uid() and o.grant_ids <@ coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and revoked_at is null and notice_version='pilot-supervised-v1'),'{}'::uuid[])),'[]'::jsonb);
end $function$
;
