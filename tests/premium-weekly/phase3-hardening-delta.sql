-- STAGING ONLY. Reviewed two-function delta; exact previous-definition hashes required.
begin;
do $$ begin
 if md5(pg_get_functiondef('coach_private.premium_check_patch(jsonb,uuid,boolean)'::regprocedure)) is distinct from '1421bb007236c4834efe4ff6bbabc11a' then raise exception 'premium_hardening_definition_changed: premium_check_patch';end if;
 if md5(pg_get_functiondef('public.premium_weekly_permission(uuid,boolean)'::regprocedure)) is distinct from '5761b5c049b68208edd6128813016eae' then raise exception 'premium_hardening_definition_changed: premium_weekly_permission';end if;
end $$;

CREATE OR REPLACE FUNCTION coach_private.premium_check_patch(p jsonb, r uuid, apply_patch boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare rev uuid;ss jsonb;e public.routine_exercises;c public.coach_mesocycles;first_set jsonb;
begin
 if p->>'field' is null then raise exception 'premium_invalid_patch';end if;
 select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if p->>'field'='weekly_schedule' then perform coach_private.premium_weekly_schedule_check(p,r);return;end if;
 if p->>'field'<>'planned_sets' then
  ss:=coach_private.premium_revision_sets(rev,(p->>'target_id')::uuid);
  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is null then raise exception 'premium_current_prescription_unresolved';end if;
  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is not null and not coach_private.premium_series_uniform(ss) then raise exception 'premium_individualized_requires_set_target';end if;
  perform coach_private.premium_check_patch_v1(p,r,apply_patch);return;
 end if;
 if (select array_agg(x order by x) from jsonb_object_keys(p)x) is distinct from array['field','from','target_id','to'] then raise exception 'premium_invalid_patch';end if;
 select x.* into e from public.routine_exercises x join public.routine_days d on d.id=x.day_id where x.id=(p->>'target_id')::uuid and d.routine_id=r;
 ss:=coach_private.premium_revision_sets(rev,e.id);
 if e.id is null or ss is null or p->'from' is distinct from ss or not coach_private.premium_sets_valid(p->'to') or p->'from'=p->'to' or abs(jsonb_array_length(p->'to')-jsonb_array_length(ss))>1 then raise exception 'premium_stale_set_patch';end if;
 if not coalesce(e.target ~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' and e.rir ~ '^[0-5]$',false) then raise exception 'premium_stale_live_projection';end if;
 if e.sets is distinct from jsonb_array_length(ss) or e.rest_seconds is distinct from (ss#>>'{0,rest_seconds}')::int or e.rir::int is distinct from (ss#>>'{0,rir}')::int or split_part(e.target,'-',1)::int is distinct from (ss#>>'{0,reps_min}')::int or coalesce(nullif(split_part(e.target,'-',2),''),split_part(e.target,'-',1))::int is distinct from (ss#>>'{0,reps_max}')::int then raise exception 'premium_stale_live_projection';end if;
 select * into c from public.coach_mesocycles where routine_id=r and current_revision_id=rev and state='active';
 if c.id is null then raise exception 'premium_inactive';end if;
 if exists(select 1 from jsonb_array_elements(p->'to')s where s not in (select value from jsonb_array_elements(ss)) and not coach_private.premium_sets_valid(jsonb_build_array(s||jsonb_build_object('set_number',1)),true)) then raise exception 'premium_invalid_set_prescription';end if;
 if c.intake->>'experience' in ('lt6','m6_12') and exists(select 1 from jsonb_array_elements(p->'to')s where (s->>'rir')::int<2) then raise exception 'premium_beginner_rir';end if;
 if apply_patch then first_set:=p->'to'->0;update public.routine_exercises set sets=jsonb_array_length(p->'to'),target=(first_set->>'reps_min')||'-'||(first_set->>'reps_max'),rir=first_set->>'rir',rest_seconds=(first_set->>'rest_seconds')::int where id=e.id;end if;
end $function$;

create or replace function public.premium_weekly_permission(p_mesocycle uuid,p_allow boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 if p_allow is null or not exists(select 1 from public.coach_mesocycles where id=p_mesocycle and user_id=u) then raise exception 'premium_weekly_inactive';end if;
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 if p_allow then
  if not coach_private.premium_access(p_mesocycle,u) then raise exception 'premium_weekly_inactive';end if;
  if not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then raise exception 'premium_history_consent_required';end if;
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_weekly_checkin','premium-checkin-v1' where not exists(select 1 from public.context_grants where user_id=u and scope='premium_weekly_checkin' and notice_version='premium-checkin-v1' and revoked_at is null);
 else
  update public.context_grants set revoked_at=now() where user_id=u and scope='premium_weekly_checkin' and revoked_at is null;
  update public.coach_recommendations set state='superseded' where user_id=u and analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1' and state in ('pending_review','ready');
 end if;return p_allow;
end $$;
commit;
