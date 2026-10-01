CREATE OR REPLACE FUNCTION public.get_coach_review_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',to_jsonb(o),
 'athlete',jsonb_build_object('user_id',o.user_id,'name',(select p.name from public.profiles p where p.id=o.user_id)),
 'training',case when i.schema_version=2 then jsonb_build_object('schema_version','basic-intake-v2','experience',i.training->'experience','goal',i.training->'goal','days',i.training->'days','weekdays',i.training->'weekdays','minutes',i.training->'minutes','effort',i.training->'effort','excluded',i.training->'excluded','activity',jsonb_build_object('type',i.training->'activity'->'type','weekdays',i.training->'activity'->'weekdays'),'inventory',jsonb_build_object('equipment',i.training->'inventory'->'equipment','custom','[]'::jsonb)) else jsonb_build_object('goal',i.training->'goal','experience',i.training->'experience','days',i.training->'days',
 'minutes',i.training->'minutes','equipment',i.training->'equipment','preferred',i.training->'preferred','avoided',i.training->'avoided','preferences',i.training->'preferences') end,
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id
 where o.user_id<>auth.uid() and cardinality(o.grant_ids)=1
 and o.grant_ids=coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and scope='training_intake'
 and revoked_at is null and notice_version='pilot-supervised-v2'),'{}'::uuid[])),'[]'::jsonb);
end $function$
;
