-- Staging candidate, separate from billing. No reviewer or assignment is enabled by this file.
begin;
create table coach_private.review_assignments(
 operation_id uuid not null, reviewer_id uuid not null references auth.users(id), owner_id uuid not null,
 actions text[] not null check(cardinality(actions)>0 and actions <@ array['view','review','retry']::text[]),
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,revoked_at timestamptz,
 primary key(operation_id,reviewer_id),foreign key(operation_id,owner_id) references public.coach_operations(id,user_id),
 check(reviewer_id<>owner_id),check(expires_at>created_at)
);
create index review_assignment_reviewer on coach_private.review_assignments(reviewer_id,operation_id);
alter table coach_private.review_assignments enable row level security;
revoke all on coach_private.review_assignments from public,anon,authenticated,service_role;

create function coach_private.can_review_operation(actor uuid,operation uuid,action text) returns boolean
language sql security definer set search_path=pg_catalog as $$
 select actor is not null and coach_private.is_reviewer(actor)
 and coalesce((coach_private.reviewer_config()->actor::text->>'expires_at')::timestamptz>clock_timestamp(),false)
 and exists(select 1 from coach_private.review_assignments a join public.coach_operations o on o.id=a.operation_id and o.user_id=a.owner_id
 where a.operation_id=operation and a.reviewer_id=actor and a.owner_id<>actor
 and 'view'=any(a.actions) and action=any(a.actions) and a.revoked_at is null and a.expires_at>clock_timestamp()
 and cardinality(o.grant_ids)=1 and o.grant_ids=coalesce((select array_agg(g.id) from public.context_grants g
 where g.user_id=o.user_id and g.scope='training_intake' and g.notice_version='pilot-supervised-v2' and g.revoked_at is null),'{}'::uuid[]))
$$;
create function coach_private.lock_review_scope(operation uuid,action text) returns void
language plpgsql security definer set search_path=pg_catalog as $$
begin
 -- Called after the athlete advisory lock and before updating an operation.
 -- Hold the assignment row through commit so revocation cannot overtake a review.
 perform 1 from coach_private.review_assignments where operation_id=operation and reviewer_id=auth.uid() for share;
 if not coalesce(coach_private.can_review_operation(auth.uid(),operation,action),false) then
  raise exception 'coach_review_scope_required' using errcode='42501';end if;
end $$;
revoke all on function coach_private.can_review_operation(uuid,uuid,text),coach_private.lock_review_scope(uuid,text) from public,anon,authenticated,service_role;

create or replace function public.get_coach_reviewer_access() returns boolean language sql security definer set search_path=pg_catalog as $$
 select exists(select 1 from coach_private.review_assignments a where a.reviewer_id=auth.uid() and coach_private.can_review_operation(auth.uid(),a.operation_id,'view'))
$$;
create or replace function public.get_coach_reviewer_status() returns jsonb language sql security definer set search_path=pg_catalog as $$
 select jsonb_build_object('authorized',public.get_coach_reviewer_access(),'scope','assigned_operations','expires_at',
 (select least(min(a.expires_at),(coach_private.reviewer_config()->auth.uid()::text->>'expires_at')::timestamptz)
 from coach_private.review_assignments a where a.reviewer_id=auth.uid() and coach_private.can_review_operation(auth.uid(),a.operation_id,'view')))
$$;
create function public.coach_feedback_in_review_scope(owner_id uuid,routine uuid) returns boolean language sql security definer set search_path=pg_catalog as $$
 select exists(select 1 from public.coach_operations o where o.user_id=owner_id and o.routine_id=routine and coach_private.can_review_operation(auth.uid(),o.id,'view'))
$$;
revoke all on function public.get_coach_reviewer_access(),public.get_coach_reviewer_status(),public.coach_feedback_in_review_scope(uuid,uuid) from public,anon,service_role;
grant execute on function public.get_coach_reviewer_access(),public.get_coach_reviewer_status(),public.coach_feedback_in_review_scope(uuid,uuid) to authenticated;
drop policy if exists coach_feedback_read on public.coach_pilot_feedback;
drop policy if exists coach_feedback_reviewer_read on public.coach_pilot_feedback;
create policy coach_feedback_read on public.coach_pilot_feedback for select to authenticated
 using (user_id=(select auth.uid()) or public.coach_feedback_in_review_scope(user_id,routine_id));

CREATE OR REPLACE FUNCTION public.get_coach_review_queue()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'coach_private'
AS $function$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',jsonb_build_object('id',o.id,'user_id',o.user_id,'state',o.state,'proposal',o.proposal,'prompt_version',o.prompt_version,'routine_id',o.routine_id,'expires_at',o.expires_at,'error_code',o.error_code,'review_reason',o.review_reason,'reviewed_at',o.reviewed_at,'athlete_comment',o.athlete_comment,'retry_authorized_at',o.retry_authorized_at,'created_at',o.created_at),
 'athlete',jsonb_build_object('user_id',o.user_id,'name',(select p.name from public.profiles p where p.id=o.user_id)),
 'training',case when i.schema_version=2 then jsonb_build_object('schema_version','basic-intake-v2','experience',i.training->'experience','goal',i.training->'goal','days',i.training->'days','weekdays',i.training->'weekdays','minutes',i.training->'minutes','effort',i.training->'effort','excluded',i.training->'excluded','activity',jsonb_build_object('type',i.training->'activity'->'type','weekdays',i.training->'activity'->'weekdays'),'inventory',jsonb_build_object('equipment',i.training->'inventory'->'equipment','custom','[]'::jsonb)) else jsonb_build_object('goal',i.training->'goal','experience',i.training->'experience','days',i.training->'days',
 'minutes',i.training->'minutes','equipment',i.training->'equipment','preferred',i.training->'preferred','avoided',i.training->'avoided','preferences',i.training->'preferences') end,
 'feedback',(select to_jsonb(f) from public.coach_pilot_feedback f where f.user_id=o.user_id and f.routine_id=o.routine_id)) order by o.created_at desc)
 from public.coach_operations o join public.training_intakes i on i.id=o.intake_id
 where coach_private.can_review_operation(auth.uid(),o.id,'view') and o.user_id<>auth.uid() and cardinality(o.grant_ids)=1
 and o.grant_ids=coalesce((select array_agg(id) from public.context_grants where user_id=o.user_id and scope='training_intake'
 and revoked_at is null and notice_version='pilot-supervised-v2'),'{}'::uuid[])),'[]'::jsonb);
end $function$
;
create or replace function public.review_coach_proposal(p_operation uuid,p_approve boolean,p_reason text) returns public.coach_operations language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;u uuid;i public.training_intakes;
begin
 -- Check this operation/action before resolving its owner or taking owner locks.
 -- Missing, own and unassigned operations have the same public denial.
 if not coalesce(coach_private.can_review_operation(auth.uid(),p_operation,'review'),false) then
  raise exception 'coach_review_scope_required' using errcode='42501';end if;
 if p_approve is null or length(btrim(p_reason)) not between 1 and 1000 or p_reason is null then raise exception 'coach_review_reason_required';end if;
 select user_id into u from public.coach_operations where id=p_operation;
 if u is null or u=auth.uid() then raise exception 'coach_review_scope_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 -- Preserve lock order: owner advisory -> assignment SHARE -> operation UPDATE.
 -- The precheck is not a substitute for revalidation after either wait.
 perform coach_private.lock_review_scope(p_operation,'review');
 select * into o from public.coach_operations where id=p_operation for update;
 -- The row lock can wait beyond either expiry. Recheck wall-clock eligibility
 -- after the wait; retain the assignment lock until this transaction commits.
 perform coach_private.lock_review_scope(p_operation,'review');
 if o.id is null or o.user_id is distinct from u then
  raise exception 'coach_review_scope_required' using errcode='42501';end if;
 if o.state<>'pending_review' or o.review_decision is not null then raise exception 'coach_review_not_pending';end if;
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 if coach_private.require_context(u) is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id;
 if i.row_version<>o.intake_version or i.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_changed';end if;
 update public.coach_operations set state=case when p_approve then 'ready' else 'rejected' end,
 review_decision=case when p_approve then 'approved' else 'rejected' end,reviewed_by=auth.uid(),reviewed_at=now(),review_reason=btrim(p_reason),updated_at=now() where id=o.id returning * into o;
 -- Preserve the composite RPC contract, not the private contents of its row.
 -- An allowlist also excludes private columns introduced by future migrations.
 -- Storage and the owner's existing read policy remain unchanged.
 return jsonb_populate_record(null::public.coach_operations,jsonb_build_object(
  'id',o.id,'user_id',o.user_id,'state',o.state,'proposal',o.proposal,
  'prompt_version',o.prompt_version,'routine_id',o.routine_id,'expires_at',o.expires_at,
  'error_code',o.error_code,'review_required',o.review_required,
  'review_decision',o.review_decision,'review_reason',o.review_reason,
  'reviewed_by',o.reviewed_by,'reviewed_at',o.reviewed_at,
  'athlete_comment',o.athlete_comment,'retry_authorized_at',o.retry_authorized_at,
  'created_at',o.created_at,'updated_at',o.updated_at));
end $$;
CREATE OR REPLACE FUNCTION public.authorize_coach_retry(p_operation uuid,p_reason text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,coach_private AS $$
DECLARE o public.coach_operations;u uuid;
BEGIN
 -- No owner lookup or owner lock without this exact operation/action permission.
 IF NOT coalesce(coach_private.can_review_operation(auth.uid(),p_operation,'retry'),false)
 THEN RAISE EXCEPTION 'coach_review_scope_required' USING errcode='42501';END IF;
 IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'coach_review_reason_required';END IF;
 SELECT user_id INTO u FROM public.coach_operations WHERE id=p_operation;
 IF u IS NULL OR u=auth.uid() THEN RAISE EXCEPTION 'coach_review_scope_required' USING errcode='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 perform coach_private.lock_review_scope(p_operation,'retry');
 SELECT * INTO o FROM public.coach_operations WHERE id=p_operation FOR UPDATE;
 -- Do not authorize a retry with a scope that expired during the row-lock wait.
 perform coach_private.lock_review_scope(p_operation,'retry');
 IF o.id IS NULL OR o.user_id IS DISTINCT FROM u THEN
  RAISE EXCEPTION 'coach_review_scope_required' USING errcode='42501';END IF;
 IF o.state='reserved' AND o.expires_at<=clock_timestamp() THEN
  UPDATE public.coach_operations SET state='failed',error_code='provider_timeout',updated_at=clock_timestamp()
   WHERE id=o.id AND state='reserved' AND expires_at<=clock_timestamp() RETURNING * INTO o;
 END IF;
 IF o.state NOT IN ('failed','stale','rejected','athlete_declined') OR NOT coach_private.allowed(u)
 OR EXISTS(SELECT 1 FROM public.coach_operations WHERE user_id=u AND state IN ('reserved','pending_review','ready'))
 OR o.id IS DISTINCT FROM (SELECT id FROM public.coach_operations WHERE user_id=u ORDER BY created_at DESC,id DESC LIMIT 1)
 OR EXISTS(SELECT 1 FROM public.coach_operations WHERE retry_source=o.id)
 THEN RAISE EXCEPTION 'coach_retry_unavailable';END IF;
 PERFORM coach_private.require_context(u);
 IF o.retry_authorized_at IS NOT NULL THEN RETURN true;END IF;
 UPDATE public.coach_operations SET retry_authorized_by=auth.uid(),retry_authorized_at=now(),retry_reason=btrim(p_reason),updated_at=now() WHERE id=o.id;
 RETURN true;
END $$;
create or replace function public.get_coach_pilot_metrics() returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
 if not public.get_coach_reviewer_access() then raise exception 'coach_reviewer_required' using errcode='42501';end if;
 return (select jsonb_build_object('scope','assigned_operations','authorized',count(distinct user_id),'generations',count(*) filter(where generation_started_at is not null),
 'valid_proposals',count(*) filter(where proposal is not null),'blocked',count(*) filter(where error_code='safety_review_required'),
 'reviewer_approved',count(*) filter(where review_decision='approved'),'reviewer_rejected',count(*) filter(where review_decision='rejected'),
 'athlete_accepted',count(*) filter(where state='accepted')) from public.coach_operations o where coach_private.can_review_operation(auth.uid(),o.id,'view'));
end $$;
revoke all on function public.get_coach_review_queue(),public.get_coach_pilot_metrics(),public.review_coach_proposal(uuid,boolean,text),public.authorize_coach_retry(uuid,text) from public,anon,service_role;
grant execute on function public.get_coach_review_queue(),public.get_coach_pilot_metrics(),public.review_coach_proposal(uuid,boolean,text),public.authorize_coach_retry(uuid,text) to authenticated;
commit;
