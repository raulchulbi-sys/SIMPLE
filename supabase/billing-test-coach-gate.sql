-- Separate optional staging block. Existing admission/consent/quota code is retained verbatim.
-- Commercial generation is CLOSED by default. No plan's quota is invented here.
begin;
create table billing_test.commercial_policy (
 singleton boolean primary key default true check(singleton), basic_generation_enabled boolean not null default false
);
insert into billing_test.commercial_policy values(true,false);
alter table billing_test.commercial_policy enable row level security;
revoke all on billing_test.commercial_policy from public,anon,authenticated,service_role;

create function public.billing_test_capabilities() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a jsonb; enabled boolean; active boolean;
begin
 if auth.uid() is null then raise exception 'billing_auth_required' using errcode='42501';end if;
 a:=public.billing_test_my_access();
 active:=coalesce(a->>'state'='active' and a->>'plan'='basic' and (a->>'paidUntil')::timestamptz>clock_timestamp(),false);
 select basic_generation_enabled into enabled from billing_test.commercial_policy where singleton;
 return jsonb_build_object('basicActive',active,
 'basicGenerationEnabled',coalesce(enabled,false) and active,
 'premiumEnabled',false,'quotasChanged',false,'humanReviewRequired',true);
end $$;
revoke all on function public.billing_test_capabilities() from public,anon,service_role;
grant execute on function public.billing_test_capabilities() to authenticated;

-- Moving the existing function preserves its complete implementation and dependencies.
-- A second apply intentionally fails transactionally rather than wrapping it twice.
alter function public.reserve_basic_generation(uuid,uuid) set schema coach_private;
alter function coach_private.reserve_basic_generation(uuid,uuid) rename to commercial_prior_reserve_basic_generation;
revoke all on function coach_private.commercial_prior_reserve_basic_generation(uuid,uuid) from public,anon,authenticated,service_role;
alter function public.get_my_coach_access() set schema coach_private;
alter function coach_private.get_my_coach_access() rename to commercial_prior_get_my_coach_access;
revoke all on function coach_private.commercial_prior_get_my_coach_access() from public,anon,authenticated,service_role;

create function public.reserve_basic_generation(p_intake_id uuid,p_key uuid) returns public.coach_operations
language plpgsql security definer set search_path=pg_catalog as $$
declare u uuid:=auth.uid(); c jsonb;
begin
 if u is null then raise exception 'billing_auth_required' using errcode='42501';end if;
 perform coach_private.premium_upgrade_lock(u);
 -- Serialize against entitlement snapshots; concurrent revocation cannot race this reservation.
 perform 1 from billing_test.customers where user_id=u for update;
 perform 1 from billing_test.commercial_policy where singleton for share;
 c:=public.billing_test_capabilities();
 if not coalesce((c->>'basicGenerationEnabled')::boolean,false) then
  raise exception 'billing_basic_generation_unavailable' using errcode='42501';
 end if;
 if not coalesce(coach_private.review_required(),false) then
  raise exception 'billing_basic_generation_unavailable' using errcode='42501';end if;
 -- Original function still owns consent, intake validation, quotas, idempotency and review.
 return coach_private.commercial_prior_reserve_basic_generation(p_intake_id,p_key);
end $$;
create function public.get_my_coach_access() returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare a jsonb; c jsonb;
begin
 a:=coach_private.commercial_prior_get_my_coach_access();c:=public.billing_test_capabilities();
 return a||jsonb_build_object('commercial',true,'paidBasic',c->'basicActive',
 'can_generate',coalesce((a->>'can_generate')::boolean,false) and coalesce((c->>'basicGenerationEnabled')::boolean,false));
end $$;
revoke all on function public.reserve_basic_generation(uuid,uuid),public.get_my_coach_access() from public,anon,service_role;
grant execute on function public.reserve_basic_generation(uuid,uuid),public.get_my_coach_access() to authenticated;
commit;
