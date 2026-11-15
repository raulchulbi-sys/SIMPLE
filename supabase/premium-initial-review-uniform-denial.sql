-- LOCAL CANDIDATE. Independent, narrow delta; never reinstall the initial migration.
-- Before any authorized installation, verify the effective preimage, dependencies,
-- owner, OID, ACL and closed switches. This file changes no permissions or data.
begin;
create or replace function public.premium_initial_review(p_operation uuid,p_approve boolean,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=auth.uid();locked_owner uuid;o public.premium_initial_operations;ctx jsonb;phase integer;
 error_message text;error_detail text;error_hint text;
begin
 -- A historical reviewer_id is not a current authorization. Do not look up a
 -- target or lock its owner on behalf of an unauthenticated/disabled reviewer.
 if u is null or coach_private.is_reviewer(u) is not true
    or not coalesce((select enabled from coach_private.premium_initial_budget where id),false) then
  raise exception 'premium_initial_reviewer_required' using errcode='42501';
 end if;
 -- Re-evaluate using fresh statements after owner locks, row locks and validation.
 -- Private helpers retain their existing ACLs; no new externally callable oracle.
 for phase in 0..3 loop
  select x.* into o from public.premium_initial_operations x
  join coach_private.premium_entitlements e on e.user_id=x.user_id
   and e.version=x.entitlement_version and e.initial_reviewer_id=x.reviewer_id
  join public.premium_initial_intakes i on i.id=x.intake_id and i.user_id=x.user_id
   and i.row_version=x.intake_version and i.state='submitted'
  where x.id=p_operation and x.reviewer_id=u and x.user_id<>u
   and (phase=0 or x.user_id=locked_owner)
   and x.state in ('pending_review','ready')
   and coach_private.is_reviewer(u) is true
   and coach_private.premium_initial_eligible(x.user_id) is true
   and coach_private.premium_initial_grant(x.user_id)=x.consent_id
   and coach_private.premium_admission_grant(x.user_id) is not null
   and not exists(select 1 from public.routine_assignments a where a.client_id=x.user_id and a.client_deleted_at is null)
   and not exists(select 1 from public.routines r where r.owner_id=x.user_id and r.deleted_at is null)
   and not exists(select 1 from public.routine_management m where m.user_id=x.user_id);
  if not found then
   raise exception 'premium_initial_reviewer_required' using errcode='42501';
  end if;
  if phase=0 then
   -- Same owner lock order as allowance, permission, intake and acceptance RPCs.
   locked_owner:=o.user_id;
   perform coach_private.premium_upgrade_lock(o.user_id);
  elsif phase=1 then
   -- Stabilize the exact operation and authorization rows. A change committed
   -- while any lock is awaited must pass the complete guard on the next loop.
   perform 1 from public.premium_initial_operations where id=o.id for update;
   perform 1 from coach_private.premium_entitlements where user_id=o.user_id for share;
   perform 1 from public.premium_initial_intakes where id=o.intake_id for share;
   perform 1 from public.context_grants
    where user_id=o.user_id and (id=o.consent_id or id=coach_private.premium_admission_grant(o.user_id))
    order by id for share;
   perform 1 from coach_private.premium_initial_budget where id for share;
  elsif phase=2 then
   begin
   if p_approve is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'premium_initial_review_invalid';
   end if;
   begin
    ctx:=coach_private.premium_initial_assert(o);
   exception when raise_exception then
    -- Expiry or context changes can occur between the guard and this assertion.
    -- Map only these known authorization errors, never validation/schema failures.
    if sqlerrm in ('premium_initial_stale_or_revoked','premium_initial_existing_routine','premium_initial_stale_intake') then
     raise exception 'premium_initial_reviewer_required' using errcode='42501';
    end if;
    raise;
   end;
   -- Preserve ready/approve replay semantics without revalidating its proposal.
   if not (o.state='ready' and p_approve) then
    if o.state<>'pending_review' then raise exception 'premium_initial_review_not_pending';end if;
    perform coach_private.premium_initial_validate(o.proposal,ctx->'training');
   end if;
   exception when raise_exception then
    -- Defer only known domain errors until the SAME final authorization guard.
    -- Locks were acquired outside this subtransaction and remain held. Unknown
    -- P0001 errors and all other SQLSTATEs propagate; no catch-all suppression.
    if sqlerrm not in (
     -- BEGIN DEFERRED DOMAIN ERRORS
     'premium_initial_review_invalid','premium_initial_review_not_pending',
     'coach_invalid_proposal','premium_invalid_intake','premium_invalid_availability',
     'premium_invalid_weak_points','premium_invalid_confidence','premium_invalid_activity',
     'premium_invalid_inventory','premium_initial_invalid_proposal','premium_initial_invalid_day',
     'premium_initial_exercise_not_permitted','premium_initial_invalid_prescription',
     'premium_initial_duration_exceeded'
     -- END DEFERRED DOMAIN ERRORS
    ) then raise;end if;
    get stacked diagnostics error_message=message_text,error_detail=pg_exception_detail,error_hint=pg_exception_hint;
   end;
  end if;
 end loop;
 -- No domain diagnostic can bypass phase 3. A still-authorized caller receives
 -- the original SQLSTATE/message/detail/hint; an expired/revoked caller never does.
 if error_message is not null then
  raise exception using errcode='P0001',message=error_message,detail=error_detail,hint=error_hint;
 end if;
 if o.state='ready' and p_approve then return coach_private.premium_initial_review_projection(o);end if;
 update public.premium_initial_operations
 set state=case when p_approve then 'ready' else 'rejected' end,
     reviewed_at=clock_timestamp(),review_reason=btrim(p_reason),reviewed_by=u,updated_at=clock_timestamp()
 where id=o.id returning * into o;
 return coach_private.premium_initial_review_projection(o);
end $$;
commit;
