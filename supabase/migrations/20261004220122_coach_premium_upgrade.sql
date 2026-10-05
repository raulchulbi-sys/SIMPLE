-- STAGING ONLY. Phase 5: explicit access and adoption of the SAME accepted Basic routine.
-- No Auth, workout, note, assignment, exercise/day UUID or Basic operation/revision writes.
begin;
create table if not exists coach_private.premium_entitlements(
 user_id uuid primary key references auth.users(id) on delete restrict,
 enabled boolean not null default false,expires_at timestamptz,
 capabilities text[] not null default '{}',version uuid not null default gen_random_uuid(),
 generation_limit int not null default 0 check(generation_limit between 0 and 20),
 analysis_limit int not null default 0 check(analysis_limit between 0 and 1000),
 chat_limit int not null default 0 check(chat_limit between 0 and 1000),
 analysis_consumed int not null default 0 check(analysis_consumed>=0),
 chat_consumed int not null default 0 check(chat_consumed>=0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(capabilities <@ array['upgrade','tracking','weekly','analysis','chat']::text[]),
 check(not enabled or expires_at is not null));
alter table coach_private.premium_entitlements enable row level security;
revoke all on coach_private.premium_entitlements from public,anon,authenticated,service_role;

create table coach_private.premium_admissions(
 routine_id uuid primary key,user_id uuid not null,mesocycle_id uuid not null unique,
 baseline_revision_id uuid not null,basic_operation_id uuid,
 source_kind text not null check(source_kind in ('basic','existing')),
 consent_id uuid not null references public.context_grants(id) on delete restrict,
 entitlement_version uuid not null,idempotency_key uuid not null,
 start_date date not null,planned_weeks int not null check(planned_weeks between 1 and 26),
 created_at timestamptz not null default now(),
 foreign key(routine_id,user_id) references public.routine_management(routine_id,user_id) on delete restrict,
 foreign key(mesocycle_id,routine_id,user_id) references public.coach_mesocycles(id,routine_id,user_id) on delete restrict,
 foreign key(baseline_revision_id,routine_id,user_id) references public.routine_revisions(id,routine_id,user_id) on delete restrict,
 foreign key(basic_operation_id,user_id) references public.coach_operations(id,user_id) on delete restrict,
 unique(user_id,idempotency_key),check((source_kind='basic')=(basic_operation_id is not null)));
alter table coach_private.premium_admissions enable row level security;
revoke all on coach_private.premium_admissions from public,anon,authenticated,service_role;
create index premium_admissions_owner on coach_private.premium_admissions(user_id);

alter table public.routine_management drop constraint premium_management_origin;
-- operation_id remains the original Basic provenance; it is NEVER set to NULL by upgrade.
alter table public.routine_management add constraint premium_management_origin check(
 (plan_kind='basic' and operation_id is not null) or plan_kind='premium');
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history','premium_weekly_checkin','premium_chat','premium_admission'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1','premium-checkin-v1','premium-chat-v1','premium-followup-v1'));
alter table coach_private.premium_analysis_budget add column if not exists shared_enabled boolean not null default false,
 add column if not exists shared_max_calls int not null default 0 check(shared_max_calls>=0),
 add column if not exists shared_max_usd numeric not null default 0 check(shared_max_usd>=0);

-- Copy exact prior definitions to private helpers and KEEP all original OIDs/ACLs.
do $backup$
declare signature text;definition text;old_name text;new_name text;
begin
 foreach signature in array array[
 'coach_private.premium_access(uuid,uuid)','coach_private.premium_bundle(uuid,uuid)',
 'coach_private.premium_weekly_assert(public.coach_recommendations,boolean)',
 'coach_private.premium_chat_assert_bundle(jsonb,uuid,boolean)',
 'coach_private.premium_chat_expire(uuid)',
 'coach_private.premium_revision_sets(uuid,uuid)',
 'coach_private.premium_weekly_grant(uuid,uuid)','coach_private.premium_chat_grant(uuid,uuid)',
 'coach_private.premium_review_access(uuid)',
 'coach_private.guard_structure()',
 'coach_private.premium_history(uuid,uuid)','coach_private.premium_history_context(uuid,uuid)',
 'public.premium_weekly_permission(uuid,boolean)','public.premium_chat_permission(uuid,boolean)',
 'public.premium_reserve_analysis(uuid,uuid)',
 'public.premium_provision(uuid,uuid,date,integer,timestamp with time zone)',
 'public.premium_analysis_claim(uuid,uuid,integer,text)',
 'public.premium_chat_claim(uuid,uuid,integer,text)',
 'public.premium_chat_finish(uuid,uuid,jsonb,text,jsonb,jsonb)',
 'public.reserve_basic_generation(uuid,uuid)'] loop
  select n.nspname||'.'||p.proname, 'coach_private.premium_upgrade_prior_'||p.proname into old_name,new_name
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=signature::regprocedure;
  if to_regprocedure(new_name||substring(signature from position('(' in signature))) is not null then raise exception 'premium_upgrade_previous_install_exists';end if;
  definition:=pg_get_functiondef(signature::regprocedure);
  execute replace(definition,'FUNCTION '||old_name||'(','FUNCTION '||new_name||'(');
  execute 'revoke all on function '||new_name||substring(signature from position('(' in signature))||' from public,anon,authenticated,service_role';
 end loop;
end $backup$;
-- Workout dates are local Madrid dates; UTC midnight must not drop today's session.
alter function coach_private.premium_history(uuid,uuid) set timezone='Europe/Madrid';
alter function coach_private.premium_history_context(uuid,uuid) set timezone='Europe/Madrid';
-- Serialize existing unmanaged structure edits with parent-first admission.
-- Provision reads descendants with MVCC and never takes descendant row locks,
-- so a child UPDATE waiting here cannot create a parent/child lock inversion.
-- VOLATILE trigger queries recheck management after the parent-lock wait.
do $structure_guard$
declare definition text:=pg_get_functiondef('coach_private.premium_upgrade_prior_guard_structure()'::regprocedure);
 marker text:=' if exists(select 1 from public.routine_management m join public.coach_recommendations c on c.routine_id=m.routine_id';
begin
 if length(definition)-length(replace(definition,marker,''))<>length(marker) then raise exception 'premium_structure_guard_source_mismatch';end if;
 definition:=replace(definition,'FUNCTION coach_private.premium_upgrade_prior_guard_structure(','FUNCTION coach_private.guard_structure(');
 definition:=replace(definition,marker,E' perform 1 from public.routines where id in (old_r,new_r) order by id for update;\n'||marker);
 execute definition;
end $structure_guard$;
-- Internal adoption shares the original provision implementation. The original
-- public service guard is retained in the backup and in its public wrapper below.
do $provision_core$
declare definition text:=pg_get_functiondef('coach_private.premium_upgrade_prior_premium_provision(uuid,uuid,date,integer,timestamp with time zone)'::regprocedure);
begin
 definition:=replace(definition,'FUNCTION coach_private.premium_upgrade_prior_premium_provision(','FUNCTION coach_private.premium_upgrade_provision_admitted(');
 definition:=replace(definition,'if current_setting(''role'',true) not in (''none'',''postgres'',''service_role'') then raise exception ''premium_backend_only'' using errcode=''42501'';end if;','');
 execute definition;
 revoke all on function coach_private.premium_upgrade_provision_admitted(uuid,uuid,date,integer,timestamptz) from public,anon,authenticated,service_role;
end $provision_core$;

create function coach_private.premium_upgrade_lock(u uuid) returns void language plpgsql security definer set search_path=pg_catalog as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
end $$;
create function coach_private.premium_entitled(u uuid,cap text default 'tracking') returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select exists(select 1 from coach_private.premium_entitlements e join public.profiles p on p.id=e.user_id
 where e.user_id=u and p.role='client' and e.enabled and e.expires_at>clock_timestamp() and cap=any(e.capabilities))
$$;
create function coach_private.premium_admission_grant(u uuid) returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select id from public.context_grants where user_id=u and scope='premium_admission' and notice_version='premium-followup-v1' and revoked_at is null order by granted_at desc,id desc limit 1
$$;
create function public.premium_set_entitlement(p_user uuid,p_enabled boolean,p_until timestamptz,p_capabilities text[],p_generation_limit integer,p_analysis_limit integer,p_chat_limit integer) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare e coach_private.premium_entitlements;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 if not exists(select 1 from public.profiles where id=p_user and role='client') then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_enabled is null or p_capabilities is null or not(p_capabilities <@ array['upgrade','tracking','weekly','analysis','chat']::text[]) or
 p_generation_limit is distinct from 0 or p_analysis_limit is null or p_analysis_limit not between 0 and 1000 or p_chat_limit is null or p_chat_limit not between 0 and 1000 or
 p_enabled and (p_until is null or p_until<=clock_timestamp() or not('tracking'=any(p_capabilities))) then raise exception 'premium_invalid_entitlement';end if;
 insert into coach_private.premium_entitlements(user_id,enabled,expires_at,capabilities,generation_limit,analysis_limit,chat_limit)
 values(p_user,p_enabled,p_until,p_capabilities,p_generation_limit,p_analysis_limit,p_chat_limit)
 on conflict(user_id) do update set enabled=excluded.enabled,expires_at=excluded.expires_at,capabilities=excluded.capabilities,
 generation_limit=excluded.generation_limit,analysis_limit=excluded.analysis_limit,chat_limit=excluded.chat_limit,version=gen_random_uuid(),updated_at=clock_timestamp() returning * into e;
 -- Consumption is never reset by renewal, revoke/regrant or changing the allowance.
 return jsonb_build_object('enabled',e.enabled,'expires_at',e.expires_at,'version',e.version,'analysis_consumed',e.analysis_consumed,'chat_consumed',e.chat_consumed);
end $$;

create function public.premium_admission_permission(p_allow boolean,p_notice text default 'premium-followup-v1') returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 perform coach_private.premium_upgrade_lock(u);
 if p_allow is null or p_notice is distinct from 'premium-followup-v1' then raise exception 'premium_notice_required';end if;
 if p_allow then
  if not coach_private.premium_entitled(u) then raise exception 'premium_not_authorized' using errcode='42501';end if;
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_admission',p_notice where coach_private.premium_admission_grant(u) is null;
 else update public.context_grants set revoked_at=clock_timestamp() where user_id=u and scope='premium_admission' and revoked_at is null;end if;
 return p_allow;
end $$;

create or replace function coach_private.premium_access(m uuid,u uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coach_private.premium_upgrade_prior_premium_access(m,u) and coach_private.premium_entitled(u)
 and coach_private.premium_admission_grant(u) is not null
 and exists(select 1 from coach_private.premium_admissions a join public.routine_management g on g.routine_id=a.routine_id and g.user_id=a.user_id
 where a.mesocycle_id=m and a.user_id=u and g.plan_kind='premium')
$$;
create or replace function coach_private.premium_review_access(m uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coach_private.premium_upgrade_prior_premium_review_access(m) and exists(select 1 from public.coach_mesocycles c where c.id=m and coach_private.premium_access(m,c.user_id))
$$;

-- Canonical accepted Basic v2/v3/v4 use reps_min/reps_max, not the live projection's target.
-- Preserve v5 planned_sets and reject malformed/ambiguous historical prescriptions.
create or replace function coach_private.premium_revision_sets(rev uuid,eid uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare e jsonb;ss jsonb;v public.routine_revisions;
begin
 ss:=coach_private.premium_upgrade_prior_premium_revision_sets(rev,eid);if ss is not null then return ss;end if;
 select * into v from public.routine_revisions where id=rev and origin='basic' and snapshot_hash=md5(snapshot::text);
 if v.id is null or not exists(select 1 from public.coach_operations o where o.id=v.operation_id and o.user_id=v.user_id and o.routine_id=v.routine_id and o.state='accepted') then return null;end if;
 if (select count(*) from jsonb_array_elements(v.snapshot->'days') jd cross join lateral jsonb_array_elements(jd->'exercises') je where je->>'id'=eid::text)<>1 then return null;end if;
 select je into e from jsonb_array_elements(v.snapshot->'days') jd cross join lateral jsonb_array_elements(jd->'exercises') je where je->>'id'=eid::text;
 if e ? 'planned_sets' or not coalesce(e->>'sets' ~ '^[1-9][0-9]?$',false) or not coalesce(e->>'reps_min' ~ '^[1-9][0-9]?$',false) or not coalesce(e->>'reps_max' ~ '^[1-9][0-9]?$',false) or not coalesce(e->>'rir' ~ '^[0-5]$',false) or not coalesce(e->>'rest_seconds' ~ '^[0-9]{1,3}$',false) then return null;end if;
 select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',(e->>'reps_min')::int,'reps_max',(e->>'reps_max')::int,'rir',(e->>'rir')::int,'rest_seconds',(e->>'rest_seconds')::int) order by n) into ss from generate_series(1,(e->>'sets')::int)n;
 if not coach_private.premium_sets_valid(ss) then return null;end if;return ss;
end $$;

create function coach_private.premium_basic_faithful(r uuid,v uuid,u uuid) returns boolean language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare snap jsonb;rr public.routine_revisions;root public.routines;jday jsonb;jex jsonb;live_day public.routine_days;live_ex public.routine_exercises;ss jsonb;cnt int:=0;
begin
 select * into rr from public.routine_revisions where id=v and routine_id=r and user_id=u and origin='basic' and revision_no=1;
 select * into root from public.routines where id=r and owner_id=u and deleted_at is null;
 if rr.id is null or root.id is null or rr.snapshot_hash is distinct from md5(rr.snapshot::text) then return false;end if;
 snap:=rr.snapshot;
 if snap->>'id' is distinct from r::text or snap->>'owner_id' is distinct from u::text or snap->>'name' is distinct from root.name or coalesce(snap->>'description','') is distinct from coalesce(root.description,'') or jsonb_typeof(snap->'days') is distinct from 'array' or jsonb_array_length(snap->'days')<>(select count(*) from public.routine_days where routine_id=r) or jsonb_array_length(snap->'days')=0 then return false;end if;
 if (select count(distinct jd->>'id') from jsonb_array_elements(snap->'days') jd)<>jsonb_array_length(snap->'days') then return false;end if;
 for jday in select value from jsonb_array_elements(snap->'days') loop
  select * into live_day from public.routine_days where id=(jday->>'id')::uuid and routine_id=r;
  if live_day.id is null or jday->>'routine_id' is distinct from r::text or jday->>'name' is distinct from live_day.name or jday->>'day_order' is distinct from live_day.day_order::text or jsonb_typeof(jday->'exercises') is distinct from 'array' or jsonb_array_length(jday->'exercises')<>(select count(*) from public.routine_exercises where day_id=live_day.id) then return false;end if;
  if (select count(distinct je->>'id') from jsonb_array_elements(jday->'exercises') je)<>jsonb_array_length(jday->'exercises') then return false;end if;
  for jex in select value from jsonb_array_elements(jday->'exercises') loop
   select * into live_ex from public.routine_exercises where id=(jex->>'id')::uuid and day_id=live_day.id;
   ss:=coach_private.premium_revision_sets(v,live_ex.id);
   if live_ex.id is null or jex->>'day_id' is distinct from live_day.id::text or jex->>'name' is distinct from live_ex.name or jex->>'exercise_order' is distinct from live_ex.exercise_order::text or ss is null or
   jsonb_array_length(ss) is distinct from live_ex.sets or live_ex.target is distinct from (ss->0->>'reps_min')||'-'||(ss->0->>'reps_max') or live_ex.rir is distinct from ss->0->>'rir' or live_ex.rest_seconds is distinct from (ss->0->>'rest_seconds')::int then return false;end if;
   cnt:=cnt+1;
  end loop;
 end loop;
 return cnt>0 and cnt=(select count(*) from public.routine_exercises e join public.routine_days d on d.id=e.day_id where d.routine_id=r);
exception when invalid_text_representation or numeric_value_out_of_range then return false;
end $$;

create function public.upgrade_basic_routine_to_premium(p_routine uuid,p_revision uuid,p_key uuid,p_start date,p_weeks integer) returns uuid language plpgsql security definer set search_path=pg_catalog,public set timezone='Europe/Madrid' as $$
declare u uuid:=coach_private.actor();e coach_private.premium_entitlements;g public.routine_management;o public.coach_operations;a coach_private.premium_admissions;v public.routine_revisions;consent uuid;m uuid;n int;
begin
 perform coach_private.premium_upgrade_lock(u);
 select * into e from coach_private.premium_entitlements where user_id=u for update;
 if not coach_private.premium_entitled(u,'upgrade') or not coach_private.premium_entitled(u) or coach_private.premium_admission_grant(u) is null then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_key is null or p_revision is null or p_start is null or p_start not between (clock_timestamp() at time zone 'Europe/Madrid')::date-7 and (clock_timestamp() at time zone 'Europe/Madrid')::date+90 or p_weeks is null or p_weeks not between 1 and 26 then raise exception 'premium_invalid_period';end if;
 perform 1 from public.routines where id=p_routine and owner_id=u and deleted_at is null for update;if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select * into g from public.routine_management where routine_id=p_routine and user_id=u for update;
 select * into a from coach_private.premium_admissions where routine_id=p_routine;
 if a.routine_id is not null then
  if a.user_id<>u or a.source_kind<>'basic' or a.baseline_revision_id<>p_revision or a.start_date<>p_start or a.planned_weeks<>p_weeks then raise exception 'premium_upgrade_conflict';end if;
  if exists(select 1 from coach_private.premium_admissions where user_id=u and idempotency_key=p_key and routine_id<>p_routine) then raise exception 'premium_key_conflict';end if;
  return a.mesocycle_id;
 end if;
 if exists(select 1 from coach_private.premium_admissions where user_id=u and idempotency_key=p_key) then raise exception 'premium_key_conflict';end if;
 if g.routine_id is null or g.plan_kind<>'basic' or g.operation_id is null or g.current_revision_id<>p_revision or exists(select 1 from public.coach_mesocycles where routine_id=p_routine and state in ('draft','active')) then raise exception 'premium_upgrade_conflict';end if;
 select * into o from public.coach_operations where id=g.operation_id and user_id=u for update;
 select * into v from public.routine_revisions where id=p_revision and routine_id=p_routine and user_id=u;
 if o.id is null or o.state<>'accepted' or o.routine_id<>p_routine or o.accepted_at is null or v.operation_id is distinct from o.id or not coach_private.premium_basic_faithful(p_routine,p_revision,u) then raise exception 'premium_basic_baseline_mismatch';end if;
 if exists(select 1 from public.coach_operations where user_id=u and id<>o.id and state in ('reserved','ready','pending_review')) then raise exception 'premium_basic_operation_pending';end if;
 consent:=coach_private.premium_admission_grant(u);select coalesce(max(number),0)+1 into n from public.coach_mesocycles where user_id=u;
 insert into public.coach_mesocycles(user_id,routine_id,number,start_date,planned_weeks,objective,initial_revision_id,current_revision_id,access_until)
 values(u,p_routine,n,p_start,p_weeks,'Training follow-up',p_revision,p_revision,e.expires_at) returning id into m;
 insert into public.coach_mesocycle_weeks(mesocycle_id,routine_id,user_id,week_number,planned_date,revision_id)
 select m,p_routine,u,x,p_start+(x-1)*7,p_revision from generate_series(1,p_weeks)x;
 insert into coach_private.premium_admissions(routine_id,user_id,mesocycle_id,baseline_revision_id,basic_operation_id,source_kind,consent_id,entitlement_version,idempotency_key,start_date,planned_weeks)
 values(p_routine,u,m,p_revision,o.id,'basic',consent,e.version,p_key,p_start,p_weeks);
 update public.routine_management set plan_kind='premium' where routine_id=p_routine;
 return m;
end $$;

create or replace function public.premium_provision(p_user uuid,p_routine uuid,p_start date,p_weeks integer,p_until timestamptz) returns uuid language plpgsql security definer set search_path=pg_catalog,public set timezone='Europe/Madrid' as $$
declare e coach_private.premium_entitlements;m uuid;v uuid;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into e from coach_private.premium_entitlements where user_id=p_user for update;
 if not coach_private.premium_entitled(p_user) or coach_private.premium_admission_grant(p_user) is null then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_until is null or p_until>e.expires_at or p_start is null or p_start not between (clock_timestamp() at time zone 'Europe/Madrid')::date-7 and (clock_timestamp() at time zone 'Europe/Madrid')::date+90 then raise exception 'premium_invalid_period';end if;
 m:=coach_private.premium_upgrade_provision_admitted(p_user,p_routine,p_start,p_weeks,p_until);
 select current_revision_id into v from public.coach_mesocycles where id=m;
 insert into coach_private.premium_admissions(routine_id,user_id,mesocycle_id,baseline_revision_id,source_kind,consent_id,entitlement_version,idempotency_key,start_date,planned_weeks)
 values(p_routine,p_user,m,v,'existing',coach_private.premium_admission_grant(p_user),e.version,gen_random_uuid(),p_start,p_weeks);
 return m;
end $$;
create function public.premium_start_followup(p_routine uuid,p_key uuid,p_start date,p_weeks integer) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();e coach_private.premium_entitlements;a coach_private.premium_admissions;m uuid;
begin
 perform coach_private.premium_upgrade_lock(u);select * into e from coach_private.premium_entitlements where user_id=u for update;
 if not coach_private.premium_entitled(u) or coach_private.premium_admission_grant(u) is null then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_key is null then raise exception 'premium_invalid_request';end if;
 if p_start is null or p_start not between (clock_timestamp() at time zone 'Europe/Madrid')::date-7 and (clock_timestamp() at time zone 'Europe/Madrid')::date+90 or p_weeks is null or p_weeks not between 1 and 26 then raise exception 'premium_invalid_period';end if;
 perform 1 from public.routines where id=p_routine and owner_id=u and deleted_at is null for update;if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select * into a from coach_private.premium_admissions where routine_id=p_routine and user_id=u;
 if a.routine_id is not null then if a.source_kind<>'existing' or a.start_date is distinct from p_start or a.planned_weeks is distinct from p_weeks then raise exception 'premium_upgrade_conflict';end if;return a.mesocycle_id;end if;
 if exists(select 1 from coach_private.premium_admissions where user_id=u and idempotency_key=p_key) then raise exception 'premium_key_conflict';end if;
 -- Calls the gated provision body internally; authenticated callers never obtain backend EXECUTE.
 m:=coach_private.premium_upgrade_provision_admitted(u,p_routine,p_start,p_weeks,e.expires_at);
 insert into coach_private.premium_admissions(routine_id,user_id,mesocycle_id,baseline_revision_id,source_kind,consent_id,entitlement_version,idempotency_key,start_date,planned_weeks)
 select p_routine,u,m,current_revision_id,'existing',coach_private.premium_admission_grant(u),e.version,p_key,p_start,p_weeks from public.coach_mesocycles where id=m;
 return m;
end $$;

create or replace function coach_private.premium_weekly_grant(m uuid,u uuid) returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select case when coach_private.premium_entitled(u,'weekly') then coach_private.premium_upgrade_prior_premium_weekly_grant(m,u) else null end
$$;
create or replace function coach_private.premium_chat_grant(m uuid,u uuid) returns uuid language sql stable security definer set search_path=pg_catalog as $$
 select case when coach_private.premium_entitled(u,'chat') then coach_private.premium_upgrade_prior_premium_chat_grant(m,u) else null end
$$;
create or replace function public.premium_weekly_permission(p_mesocycle uuid,p_allow boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 perform coach_private.premium_upgrade_lock(u);
 if p_allow and not coach_private.premium_entitled(u,'weekly') then raise exception 'premium_not_authorized' using errcode='42501';end if;
 return coach_private.premium_upgrade_prior_premium_weekly_permission(p_mesocycle,p_allow);
end $$;
create or replace function public.premium_chat_permission(p_mesocycle uuid,p_allow boolean) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 perform coach_private.premium_upgrade_lock(u);
 if p_allow and not coach_private.premium_entitled(u,'chat') then raise exception 'premium_not_authorized' using errcode='42501';end if;
 return coach_private.premium_upgrade_prior_premium_chat_permission(p_mesocycle,p_allow);
end $$;
create or replace function public.premium_reserve_analysis(p_mesocycle uuid,p_key uuid) returns public.coach_recommendations language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();
begin
 perform coach_private.premium_upgrade_lock(u);
 if not coach_private.premium_entitled(u,'analysis') then raise exception 'premium_not_authorized' using errcode='42501';end if;
 return coach_private.premium_upgrade_prior_premium_reserve_analysis(p_mesocycle,p_key);
end $$;

create function coach_private.premium_admission_guard(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare a coach_private.premium_admissions;e coach_private.premium_entitlements;g uuid;
begin
 select * into a from coach_private.premium_admissions where mesocycle_id=m and user_id=u;
 select * into e from coach_private.premium_entitlements where user_id=u;g:=coach_private.premium_admission_grant(u);
 if a.routine_id is null or not coach_private.premium_access(m,u) then raise exception 'premium_admission_required' using errcode='42501';end if;
 return jsonb_build_object('mesocycle_id',m,'routine_id',a.routine_id,'baseline_revision_id',a.baseline_revision_id,'entitlement_version',e.version,'consent_id',g,'source_kind',a.source_kind);
end $$;
create function coach_private.premium_assert_admission(b jsonb,u uuid,cap text default 'tracking') returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare current_guard jsonb;
begin
 if b is null or jsonb_typeof(b)<>'object' or not coach_private.premium_entitled(u,cap) then raise exception 'premium_admission_stale_or_revoked' using errcode='42501';end if;
 begin current_guard:=coach_private.premium_admission_guard((b->>'mesocycle_id')::uuid,u);
 exception when sqlstate '42501' then raise exception 'premium_admission_stale_or_revoked' using errcode='42501';end;
 if b is distinct from current_guard then raise exception 'premium_admission_stale_or_revoked' using errcode='42501';end if;
end $$;
create or replace function coach_private.premium_bundle(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare b jsonb;a coach_private.premium_admissions;g jsonb;
begin
 g:=coach_private.premium_admission_guard(m,u);b:=coach_private.premium_upgrade_prior_premium_bundle(m,u);
 select * into a from coach_private.premium_admissions where mesocycle_id=m and user_id=u;
 -- Provider gets only a provenance label, never admission/consent/entitlement IDs.
 return jsonb_set(b,'{provider}',(b->'provider')||jsonb_build_object('baseline_origin',case when a.source_kind='basic' then 'inherited_basic' else 'existing_owned_routine' end,'history_origin','shared_existing_training'))||jsonb_build_object('admission_guard',g);
end $$;
create or replace function coach_private.premium_weekly_assert(r public.coach_recommendations,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 perform coach_private.premium_assert_admission(r.analysis_bundle->'admission_guard',r.user_id);
 perform coach_private.premium_upgrade_prior_premium_weekly_assert(r,require_current);
end $$;
create or replace function coach_private.premium_chat_assert_bundle(b jsonb,u uuid,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 perform coach_private.premium_assert_admission(b->'admission_guard',u,'chat');
 perform coach_private.premium_upgrade_prior_premium_chat_assert_bundle(b,u,require_current);
end $$;

create function coach_private.premium_check_dispatch(u uuid,kind text,input_bound int,output_bound int) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare e coach_private.premium_entitlements;b coach_private.premium_analysis_budget;allocation numeric;
begin
 select * into e from coach_private.premium_entitlements where user_id=u for update;
 if not coach_private.premium_entitled(u,kind) or (kind='analysis' and e.analysis_consumed>=e.analysis_limit) or (kind='chat' and e.chat_consumed>=e.chat_limit) then raise exception 'premium_owner_allowance_exhausted';end if;
 select * into b from coach_private.premium_analysis_budget where id for update;
 allocation:=(input_bound*2.5+output_bound*15)/1000000;
 if not b.shared_enabled or input_bound is null or output_bound is null or input_bound not between 1 and 100000 or output_bound not between 1 and 1800 or b.dispatched+b.chat_dispatched>=b.shared_max_calls or b.charged_usd+b.reserved_usd+b.chat_charged_usd+b.chat_reserved_usd+allocation>b.shared_max_usd then raise exception 'premium_shared_budget_exhausted';end if;
end $$;
create or replace function public.premium_analysis_claim(p_user uuid,p_id uuid,p_input_bound integer,p_mode text default 'openai') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare r public.coach_recommendations;v jsonb;err text;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user;
 if r.id is null then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if r.provider_state='reserved' and r.state='analyzing' then
  perform coach_private.premium_assert_admission(r.analysis_bundle->'admission_guard',p_user,'analysis');
  if p_mode='openai' then
   begin perform coach_private.premium_check_dispatch(p_user,'analysis',p_input_bound,1800);
   exception when others then
    if sqlerrm not in ('premium_owner_allowance_exhausted','premium_shared_budget_exhausted') then raise;end if;
    err:=sqlerrm;
   end;
   if err is not null then
    update public.coach_recommendations set state='failed',provider_state='finished',analysis_trace=analysis_trace||jsonb_build_object('error',err,'failure_category','budget','finished_at',clock_timestamp()) where id=r.id;
    return jsonb_build_object('claimed',false,'error',err);
   end if;
  end if;
 end if;
 v:=coach_private.premium_upgrade_prior_premium_analysis_claim(p_user,p_id,p_input_bound,p_mode);
 if v->>'claimed'='true' and p_mode='openai' then update coach_private.premium_entitlements set analysis_consumed=analysis_consumed+1 where user_id=p_user;end if;
 return v;
end $$;
create or replace function public.premium_chat_claim(p_user uuid,p_id uuid,p_input_bound integer,p_mode text default 'openai') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.coach_messages;v jsonb;out_limit int;err text;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into t from public.coach_messages where id=p_id and user_id=p_user;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state='reserved' and p_mode='openai' then
  begin
   perform coach_private.premium_chat_assert_bundle(t.context_bundle,p_user);
   select (chat_config->>'output_tokens')::int into out_limit from coach_private.premium_analysis_budget where id;
   perform coach_private.premium_check_dispatch(p_user,'chat',p_input_bound,out_limit);
  exception when others then
   err:=case when sqlerrm in ('premium_owner_allowance_exhausted','premium_shared_budget_exhausted') then 'premium_chat_budget_exhausted' else 'premium_chat_stale_or_revoked' end;
  end;
  if err is not null then
   update public.coach_messages set state=case when err='premium_chat_stale_or_revoked' then 'superseded' else 'failed' end,error=err,finished_at=clock_timestamp(),receipt=coach_private.premium_chat_telemetry(jsonb_build_object('timestamp',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),false,err) where id=t.id returning * into t;
   return jsonb_build_object('claimed',false,'message',coach_private.premium_chat_public(t));
  end if;
 end if;
 v:=coach_private.premium_upgrade_prior_premium_chat_claim(p_user,p_id,p_input_bound,p_mode);
 if t.state='reserved' and v#>>'{message,state}' in ('failed','superseded') then
  update public.coach_messages x set receipt=x.receipt||coach_private.premium_chat_telemetry(jsonb_build_object('timestamp',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),false,x.error) where id=t.id;
 end if;
 if v->>'claimed'='true' and p_mode='openai' then update coach_private.premium_entitlements set chat_consumed=chat_consumed+1 where user_id=p_user;end if;
 return v;
end $$;

create or replace function coach_private.premium_chat_expire(u uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare expired uuid[];
begin
 perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));
 select array_agg(id) into expired from public.coach_messages where user_id=u and state in ('reserved','dispatched') and expires_at<clock_timestamp();
 perform coach_private.premium_upgrade_prior_premium_chat_expire(u);
 if expired is not null then
  update public.coach_messages x set receipt=x.receipt||coach_private.premium_chat_telemetry(jsonb_build_object('timestamp',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),false,'premium_chat_timeout') where x.id=any(expired) and x.state='failed' and x.error='premium_chat_timeout';
 end if;
end $$;
create or replace function public.reserve_basic_generation(p_intake_id uuid,p_key uuid) returns public.coach_operations language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();o public.coach_operations;
begin
 perform coach_private.premium_upgrade_lock(u);
 select * into o from public.coach_operations where user_id=u and idempotency_key=p_key;
 if o.state='accepted' and o.intake_id=p_intake_id then return o;end if;
 if exists(select 1 from public.routine_management where user_id=u and plan_kind='premium') then raise exception 'coach_premium_management_active';end if;
 return coach_private.premium_upgrade_prior_reserve_basic_generation(p_intake_id,p_key);
end $$;

create function public.premium_my_access() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();e coach_private.premium_entitlements;rs jsonb;
begin
 select * into e from coach_private.premium_entitlements where user_id=u;
 select coalesce(jsonb_agg(jsonb_build_object('routine_id',r.id,'name',r.name,'management',coalesce(g.plan_kind,'unmanaged'),'current_revision_id',g.current_revision_id,'mesocycle_id',a.mesocycle_id,
 'upgradable',g.plan_kind='basic' and coach_private.premium_entitled(u,'upgrade') and coach_private.premium_basic_faithful(r.id,g.current_revision_id,u),
 'blocker',case when not coach_private.premium_entitled(u) then 'premium_not_authorized' when g.plan_kind='basic' and not coach_private.premium_basic_faithful(r.id,g.current_revision_id,u) then 'premium_basic_baseline_mismatch' when g.plan_kind='premium' then 'premium_already_managed' else null end) order by r.routine_order,r.id),'[]'::jsonb) into rs
 from public.routines r left join public.routine_management g on g.routine_id=r.id left join coach_private.premium_admissions a on a.routine_id=r.id where r.owner_id=u and r.deleted_at is null;
 return jsonb_build_object('plan',case when coach_private.premium_entitled(u) then 'premium' when exists(select 1 from public.routine_management where user_id=u) then 'basic' else 'free' end,
 'enabled',coach_private.premium_entitled(u),'expires_at',e.expires_at,'capabilities',case when coach_private.premium_entitled(u) then to_jsonb(e.capabilities) else '[]'::jsonb end,
 'notice_version','premium-followup-v1','consent',coach_private.premium_admission_grant(u) is not null,
 'allowances',jsonb_build_object('generation',jsonb_build_object('limit',coalesce(e.generation_limit,0),'consumed',0,'remaining',0),
 'analysis',jsonb_build_object('limit',coalesce(e.analysis_limit,0),'consumed',coalesce(e.analysis_consumed,0),'remaining',greatest(coalesce(e.analysis_limit-e.analysis_consumed,0),0)),
 'chat',jsonb_build_object('limit',coalesce(e.chat_limit,0),'consumed',coalesce(e.chat_consumed,0),'remaining',greatest(coalesce(e.chat_limit-e.chat_consumed,0),0))), 'routines',rs);
end $$;
create function public.premium_recommendation_view(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare u uuid:=auth.uid();r public.coach_recommendations;fs jsonb;ps jsonb;
begin
 select * into r from public.coach_recommendations where id=p_id;
 if u is null or r.id is null or not((r.user_id=u and exists(select 1 from public.profiles where id=u and role='client')) or coach_private.premium_review_access(r.mesocycle_id)) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 perform coach_private.premium_weekly_assert(r,false);
 select coalesce(jsonb_agg(f||jsonb_build_object('exercise_name',(
 select je->>'name' from public.routine_revisions rv cross join lateral jsonb_array_elements(rv.snapshot->'days') jd cross join lateral jsonb_array_elements(jd->'exercises') je
 where rv.id=r.base_revision_id and je->>'id'=(select b->>'exercise_id' from jsonb_array_elements(r.analysis_bundle->'bindings') b where b->>'ref'=f->>'exercise_ref')))),'[]'::jsonb) into fs from jsonb_array_elements(r.facts) f;
 select coalesce(jsonb_agg(p||jsonb_build_object('exercise_name',(
 select je->>'name' from public.routine_revisions rv cross join lateral jsonb_array_elements(rv.snapshot->'days') jd cross join lateral jsonb_array_elements(jd->'exercises') je where rv.id=r.base_revision_id and je->>'id'=p->>'target_id'))),'[]'::jsonb) into ps from jsonb_array_elements(r.patches) p;
 return jsonb_build_object('id',r.id,'mesocycle_id',r.mesocycle_id,'routine_id',r.routine_id,'kind',r.kind,'state',r.state,'base_revision_id',r.base_revision_id,'result_revision_id',r.result_revision_id,'analysis_week',r.analysis_week,'interpretation',r.interpretation,'review_reason',r.review_reason,'facts',fs,'patches',ps,'quality_warnings',coalesce(r.analysis_trace->'quality_warnings','[]'::jsonb),'created_at',r.created_at,'reviewed_at',r.reviewed_at,'accepted_at',r.accepted_at);
end $$;

-- Closed chat telemetry; completed safe output alone can retain a provider fingerprint.
create function coach_private.premium_chat_telemetry(v jsonb,ok boolean,backend_error text default null,stage text default null) returns jsonb language plpgsql immutable set search_path=pg_catalog as $$
declare category text;path text;schema_error text;index_value jsonb;
begin
 category:=case when backend_error='premium_chat_stale_or_revoked' then 'backend_stale' when backend_error='premium_chat_invalid_output' then 'backend_validation' when backend_error like '%timeout%' then 'backend_timeout' when backend_error like '%budget%' then 'budget' else v->>'failure_category' end;
 if category is null or not(category=any(array['none','context','configuration','transport_timeout','transport_network','rate_limit','http','size','protocol','incomplete','refusal','json','schema','scope','evidence','candidate','backend_validation','backend_stale','backend_timeout','budget','unknown'])) then category:='unknown';end if;
 schema_error:=v->>'schema_error';if schema_error is null or not(schema_error=any(array['none','type','required','object_keys','array_length','string_length','enum','number_range','any_of','context','unsafe','unsupported_evidence','action_mismatch','candidate','protocol','refusal','incomplete','json','transport','configuration'])) then schema_error:=null;end if;
 path:=v->>'schema_path';if path is not null and not(path=any(array['$','$.answer','$.facts_used','$.facts_used[]','$.recommendation_candidate','$.recommendation_candidate.changes','$.recommendation_candidate.changes[]','$.recommendation_candidate.changes[].action','$.recommendation_candidate.changes[].exercise_ref','$.recommendation_candidate.changes[].from','$.recommendation_candidate.changes[].from.reps_max','$.recommendation_candidate.changes[].from.reps_min','$.recommendation_candidate.changes[].from.rest_seconds','$.recommendation_candidate.changes[].from.rir','$.recommendation_candidate.changes[].from_catalogue_id','$.recommendation_candidate.changes[].from_day_ref','$.recommendation_candidate.changes[].set_number','$.recommendation_candidate.changes[].to','$.recommendation_candidate.changes[].to.reps_max','$.recommendation_candidate.changes[].to.reps_min','$.recommendation_candidate.changes[].to.rest_seconds','$.recommendation_candidate.changes[].to.rir','$.recommendation_candidate.changes[].to_catalogue_id','$.recommendation_candidate.changes[].to_day_ref','$.recommendation_candidate.confidence','$.recommendation_candidate.facts','$.recommendation_candidate.facts[]','$.recommendation_candidate.facts[].claim','$.recommendation_candidate.facts[].exercise_ref','$.recommendation_candidate.interpretation','$.recommendation_candidate.kind','$.recommendation_candidate.reason','$.recommendation_candidate.schema_version','$.schema_version','$.suggested_action'])) then path:=null;end if;
 index_value:=case when jsonb_typeof(v->'schema_index')='number' and coalesce(v->>'schema_index' ~ '^[0-7]$',false) then v->'schema_index' else 'null'::jsonb end;
 return jsonb_build_object('provider_context_version','premium-chat-context-v1','timestamp',case when v->>'timestamp' ~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$' then v->'timestamp' else null end,
 'failure_category',category,'schema_path',path,'schema_index',index_value,'schema_error',schema_error,
 'response_fingerprint',case when ok and backend_error is null and v->>'response_fingerprint' ~ '^[0-9a-f]{64}$' then v->'response_fingerprint' else 'null'::jsonb end,
 'backend_failure_category',case when backend_error is null then null else category end,
 'validation_stage',case when stage=any(array['schema','answer_text','evidence','action','candidate_text','candidate_mapping']) then stage else null end);
end $$;
create or replace function public.premium_chat_finish(p_user uuid,p_id uuid,p_output jsonb,p_error text,p_receipt jsonb,p_warnings jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare t public.coach_messages;v jsonb;safe_receipt jsonb;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into t from public.coach_messages where id=p_id and user_id=p_user;
 if t.id is null then raise exception 'premium_chat_not_authorized' using errcode='42501';end if;
 if t.state in ('completed','failed','superseded') then return coach_private.premium_chat_public(t);end if;
 -- Pass only the receipt fields actually used by the original accounting helper.
 safe_receipt:=jsonb_build_object('input_tokens',p_receipt->'input_tokens','output_tokens',p_receipt->'output_tokens','cached_input_tokens',p_receipt->'cached_input_tokens','status',p_receipt->'status','latency_ms',p_receipt->'latency_ms')||coach_private.premium_chat_telemetry(p_receipt,false);
 v:=coach_private.premium_upgrade_prior_premium_chat_finish(p_user,p_id,p_output,p_error,safe_receipt,p_warnings);
 select * into t from public.coach_messages where id=p_id and user_id=p_user;
 update public.coach_messages x set receipt=x.receipt||coach_private.premium_chat_telemetry(p_receipt,t.state='completed' and p_error is null,t.error,t.receipt->>'validation_stage') where id=t.id;
 return v;
end $$;

-- Public mutation signatures are explicitly granted; private internals remain unreachable.
do $acl$
declare f record;
begin
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='coach_private' and (p.proname like 'premium_upgrade_%' or p.proname in ('premium_entitled','premium_admission_grant','premium_basic_faithful','premium_admission_guard','premium_assert_admission','premium_check_dispatch','premium_chat_telemetry')) loop
 execute 'revoke all on function '||f.signature||' from public,anon,authenticated,service_role';end loop;
end $acl$;
revoke all on function public.premium_set_entitlement(uuid,boolean,timestamptz,text[],integer,integer,integer),public.premium_admission_permission(boolean,text),public.upgrade_basic_routine_to_premium(uuid,uuid,uuid,date,integer),public.premium_start_followup(uuid,uuid,date,integer),public.premium_my_access(),public.premium_recommendation_view(uuid) from public,anon,authenticated,service_role;
grant execute on function public.premium_set_entitlement(uuid,boolean,timestamptz,text[],integer,integer,integer) to service_role;
grant execute on function public.premium_admission_permission(boolean,text),public.upgrade_basic_routine_to_premium(uuid,uuid,uuid,date,integer),public.premium_start_followup(uuid,uuid,date,integer),public.premium_my_access(),public.premium_recommendation_view(uuid) to authenticated;
commit;
