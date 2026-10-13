-- Closed direct Premium initial programming. No Basic, Auth or existing training writes.
begin;
do $preflight$ begin
 if current_setting('app.settings.project_ref',true) is not null and current_setting('app.settings.project_ref',true)<>'' and current_setting('app.settings.project_ref',true) not in('dmqjexigdnfzobarhnib','yvguatdqncadkwewlepe') then raise exception 'premium_initial_project_denied';end if;
 if to_regprocedure('coach_private.premium_finance_capture(text,uuid,uuid,integer,integer)') is null or to_regprocedure('coach_private.premium_upgrade_lock(uuid)') is null then raise exception 'premium_initial_missing_dependency';end if;
 if to_regclass('public.premium_initial_operations') is not null then raise exception 'premium_initial_already_installed';end if;
end $preflight$;

create table public.premium_initial_intakes(
 id uuid primary key default gen_random_uuid(),user_id uuid not null unique references auth.users(id) on delete restrict,
 training jsonb not null check(jsonb_typeof(training)='object'),state text not null check(state in ('draft','submitted')),
 row_version bigint not null default 1 check(row_version>0),submitted_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(id,user_id),check((state='submitted')=(submitted_at is not null)));
alter table public.premium_initial_intakes enable row level security;
revoke all on public.premium_initial_intakes from public,anon,authenticated,service_role;
grant select on public.premium_initial_intakes to authenticated;
create policy premium_initial_intake_owner on public.premium_initial_intakes for select to authenticated using(user_id=(select auth.uid()));

create table public.premium_initial_operations(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete restrict,
 kind text not null default 'premium_initial' check(kind='premium_initial'),intake_id uuid not null,intake_version bigint not null,
 idempotency_key uuid not null,state text not null check(state in ('reserved','pending_review','ready','failed','stale','rejected','accepted')),
 consent_id uuid not null references public.context_grants(id) on delete restrict,entitlement_version uuid not null,
 reviewer_id uuid not null references public.profiles(id) on delete restrict,
 proposal jsonb,quality_warnings jsonb not null default '[]'::jsonb check(jsonb_typeof(quality_warnings)='array'),
 prompt_version text not null default 'premium-initial-v1' check(prompt_version='premium-initial-v1'),provider_version text not null default 'premium-initial-context-v1',
 provider_mode text check(provider_mode in ('openai','mock')),model text,error_code text,
 started_at timestamptz,deadline timestamptz not null default (clock_timestamp()+interval '120 seconds'),completed_at timestamptz,
 reserved_usd numeric not null default 0 check(reserved_usd>=0),verified_usd numeric check(verified_usd>=0),receipt jsonb,
 latency_ms int check(latency_ms between 0 and 300000),reviewed_at timestamptz,review_reason text,reviewed_by uuid references public.profiles(id),
 routine_id uuid references public.routines(id) on delete restrict,revision_id uuid references public.routine_revisions(id) on delete restrict,
 mesocycle_id uuid references public.coach_mesocycles(id) on delete restrict,accepted_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 foreign key(intake_id,user_id) references public.premium_initial_intakes(id,user_id) on delete restrict,
 unique(user_id,idempotency_key),unique(id,user_id),check(user_id<>reviewer_id),check((state='accepted')=(accepted_at is not null)),
 check(state<>'accepted' or routine_id is not null and revision_id is not null and mesocycle_id is not null));
create index premium_initial_owner on public.premium_initial_operations(user_id,created_at desc);
create unique index premium_initial_single_live on public.premium_initial_operations(user_id) where state in ('reserved','pending_review','ready','accepted');
alter table public.premium_initial_operations enable row level security;
revoke all on public.premium_initial_operations from public,anon,authenticated,service_role;
grant select on public.premium_initial_operations to authenticated;
create policy premium_initial_operation_owner on public.premium_initial_operations for select to authenticated using(user_id=(select auth.uid()));
alter table coach_private.premium_admissions drop constraint premium_admissions_source_kind_check;
alter table coach_private.premium_admissions add constraint premium_admissions_source_kind_check check(source_kind in ('basic','existing','initial'));
alter table coach_private.premium_admissions add column initial_operation_id uuid;
alter table coach_private.premium_admissions add constraint premium_initial_admission_operation foreign key(initial_operation_id,user_id) references public.premium_initial_operations(id,user_id) on delete restrict;
alter table coach_private.premium_admissions add constraint premium_initial_admission_origin check((source_kind='initial')=(initial_operation_id is not null));
create index premium_initial_admission_operation on coach_private.premium_admissions(initial_operation_id);

alter table coach_private.premium_entitlements add column initial_reviewer_id uuid references public.profiles(id) on delete restrict;
create index premium_entitlements_initial_reviewer on coach_private.premium_entitlements(initial_reviewer_id);
create table coach_private.premium_initial_budget(
 id boolean primary key default true check(id),enabled boolean not null default false,
 max_calls int not null default 0 check(max_calls between 0 and 1000),max_usd numeric not null default 0 check(max_usd>=0 and max_usd::text not in ('NaN','Infinity','-Infinity')),
 dispatched int not null default 0 check(dispatched>=0),reserved_usd numeric not null default 0 check(reserved_usd>=0),charged_usd numeric not null default 0 check(charged_usd>=0));
alter table coach_private.premium_initial_budget enable row level security;
revoke all on coach_private.premium_initial_budget from public,anon,authenticated,service_role;
insert into coach_private.premium_initial_budget(id) values(true);
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history','premium_weekly_checkin','premium_chat','premium_admission','premium_initial'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1','premium-checkin-v1','premium-chat-v1','premium-followup-v1','premium-initial-v1'));

-- Copy existing definitions for exact rollback; public OIDs and ACLs remain unchanged.
do $backup$ declare sig text;def text;old text;new text;begin
 foreach sig in array array['coach_private.premium_check_dispatch(uuid,text,integer,integer)','coach_private.premium_finance_capture(text,uuid,uuid,integer,integer)','coach_private.premium_finance_settle(text,uuid,uuid,numeric,jsonb,boolean)','public.premium_finance_reconcile(text,uuid,numeric,jsonb,text,text,text,uuid)','coach_private.premium_bundle(uuid,uuid)'] loop
  select n.nspname||'.'||p.proname into old from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid=sig::regprocedure;
  new:='coach_private.premium_initial_prior_'||split_part(old,'.',2);def:=pg_get_functiondef(sig::regprocedure);
  execute replace(def,'FUNCTION '||old||'(','FUNCTION '||new||'(');
  execute 'revoke all on function '||new||substring(sig from position('(' in sig))||' from public,anon,authenticated,service_role';
 end loop;
end $backup$;
alter table coach_private.premium_financial_items drop constraint premium_financial_items_kind_check;
alter table coach_private.premium_financial_items add constraint premium_financial_items_kind_check check(kind in ('analysis','chat','initial'));

-- Existing analysis/chat admission sees initial reservations and settled costs atomically.
create or replace function coach_private.premium_check_dispatch(u uuid,kind text,input_bound int,output_bound int) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare b coach_private.premium_analysis_budget;ib coach_private.premium_initial_budget;
begin
 perform coach_private.premium_initial_prior_premium_check_dispatch(u,kind,input_bound,output_bound);
 select * into b from coach_private.premium_analysis_budget where id for update;
 select * into ib from coach_private.premium_initial_budget where id for update;
 if b.dispatched+b.chat_dispatched+ib.dispatched>=b.shared_max_calls or b.charged_usd+b.reserved_usd+b.chat_charged_usd+b.chat_reserved_usd+ib.charged_usd+ib.reserved_usd+(input_bound*2.5+output_bound*15)/1000000>b.shared_max_usd then raise exception 'premium_shared_budget_exhausted';end if;
end $$;

-- Reuse the validated receipt/event ledger. Only the initial account branch is new.
do $finance$ declare def text;marker text;begin
 def:=pg_get_functiondef('coach_private.premium_initial_prior_premium_finance_capture(text,uuid,uuid,integer,integer)'::regprocedure);
 def:=replace(def,'FUNCTION coach_private.premium_initial_prior_premium_finance_capture(','FUNCTION coach_private.premium_finance_capture(');
 marker:='k not in (''chat'',''analysis'') or ib not between 1 and 100000 or ob not between 1 and 1800';
 if position(marker in def)=0 then raise exception 'premium_initial_finance_source_changed';end if;
 def:=replace(def,marker,'k not in (''chat'',''analysis'',''initial'') or ib not between 1 and 100000 or ob not between 1 and (case when k=''initial'' then 5120 else 1800 end)');
 marker:=' if k=''analysis'' then';
 if position(marker in def)=0 then raise exception 'premium_initial_finance_source_changed';end if;
 def:=replace(def,marker,E' if k=''initial'' then\n  if not exists(select 1 from public.premium_initial_operations where id=i and user_id=u and started_at is not null and reserved_usd=r) then raise exception ''premium_finance_reservation_mismatch'';end if;\n elsif k=''analysis'' then');execute def;
 def:=pg_get_functiondef('coach_private.premium_initial_prior_premium_finance_settle(text,uuid,uuid,numeric,jsonb,boolean)'::regprocedure);
 def:=replace(def,'FUNCTION coach_private.premium_initial_prior_premium_finance_settle(','FUNCTION coach_private.premium_finance_settle(');
 marker:='  if k=''analysis'' then update';
 if position(marker in def)=0 then raise exception 'premium_initial_finance_source_changed';end if;
 def:=replace(def,marker,E'  if k=''initial'' then update coach_private.premium_initial_budget set reserved_usd=reserved_usd-r,charged_usd=charged_usd+amount where id;\n  elsif k=''analysis'' then update');execute def;
 def:=pg_get_functiondef('coach_private.premium_initial_prior_premium_finance_reconcile(text,uuid,numeric,jsonb,text,text,text,uuid)'::regprocedure);
 def:=replace(def,'FUNCTION coach_private.premium_initial_prior_premium_finance_reconcile(','FUNCTION public.premium_finance_reconcile(');
 marker:=' if p_kind=''analysis'' then update';
 if position(marker in def)=0 then raise exception 'premium_initial_finance_source_changed';end if;
 def:=replace(def,marker,E' if p_kind=''initial'' then update coach_private.premium_initial_budget set charged_usd=charged_usd+delta,reserved_usd=reserved_usd-case when x.state<>''verified'' then x.reserved_usd else 0 end where id;\n elsif p_kind=''analysis'' then update');execute def;
end $finance$;
create or replace function coach_private.premium_bundle(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare b jsonb;begin
 b:=coach_private.premium_initial_prior_premium_bundle(m,u);
 if exists(select 1 from coach_private.premium_admissions where mesocycle_id=m and user_id=u and source_kind='initial') then b:=jsonb_set(b,'{provider,baseline_origin}','"premium_initial"'::jsonb);end if;
 return b;
end $$;

create function coach_private.premium_initial_grant(u uuid) returns uuid language sql stable security definer set search_path=pg_catalog,public as $$
 select id from public.context_grants where user_id=u and scope='premium_initial' and notice_version='premium-initial-v1' and revoked_at is null order by granted_at desc,id desc limit 1
$$;
create function coach_private.premium_initial_eligible(u uuid) returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
 select coalesce((select enabled from coach_private.premium_initial_budget where id),false) and coach_private.premium_entitled(u) and exists(select 1 from coach_private.premium_entitlements e where user_id=u and generation_limit>0 and initial_reviewer_id is not null and initial_reviewer_id<>u and coach_private.is_reviewer(initial_reviewer_id))
$$;
create function coach_private.premium_initial_no_routine(u uuid) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if exists(select 1 from public.routine_assignments where client_id=u and client_deleted_at is null) or exists(select 1 from public.routines where owner_id=u and deleted_at is null) or exists(select 1 from public.routine_management where user_id=u) then raise exception 'premium_initial_existing_routine';end if;
end $$;
create function public.premium_initial_set_allowance(p_user uuid,p_reviewer uuid,p_limit int) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare e coach_private.premium_entitlements;
begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 if not exists(select 1 from public.profiles where id=p_user and role='client') or p_reviewer is null or p_reviewer=p_user or not coach_private.is_reviewer(p_reviewer) or p_limit is null or p_limit not between 0 and 20 then raise exception 'premium_initial_invalid_allowance';end if;
 select * into e from coach_private.premium_entitlements where user_id=p_user for update;if not found then raise exception 'premium_initial_entitlement_required';end if;
 if e.generation_limit=p_limit and e.initial_reviewer_id=p_reviewer then return;end if;
 update coach_private.premium_entitlements set generation_limit=p_limit,initial_reviewer_id=p_reviewer,version=gen_random_uuid(),updated_at=clock_timestamp() where user_id=p_user;
 update public.premium_initial_operations set state='stale',error_code='premium_initial_authorization_changed',updated_at=clock_timestamp() where user_id=p_user and state in ('reserved','pending_review','ready');
end $$;
create function public.premium_initial_permission(p_allow boolean,p_notice text) returns boolean language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();begin
 perform coach_private.premium_upgrade_lock(u);
 if p_allow is null or p_notice is distinct from 'premium-initial-v1' then raise exception 'premium_initial_notice_required';end if;
 if p_allow then
  if not coach_private.premium_initial_eligible(u) then raise exception 'premium_initial_not_authorized' using errcode='42501';end if;
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_initial',p_notice where coach_private.premium_initial_grant(u) is null;
 else
  update public.context_grants set revoked_at=clock_timestamp() where user_id=u and scope='premium_initial' and revoked_at is null;
  update public.premium_initial_operations set state='stale',error_code='premium_initial_context_revoked',updated_at=clock_timestamp() where user_id=u and state in ('reserved','pending_review','ready');
 end if;return p_allow;
end $$;
create function public.premium_initial_save_intake(p_expected bigint,p_training jsonb,p_submit boolean) returns public.premium_initial_intakes language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();i public.premium_initial_intakes;begin
 perform coach_private.premium_upgrade_lock(u);
 if not coach_private.premium_initial_eligible(u) then raise exception 'premium_initial_not_authorized' using errcode='42501';end if;
 perform coach_private.premium_initial_no_routine(u);
 if p_submit is null then raise exception 'premium_initial_invalid_intake';end if;
 perform coach_private.premium_validate_intake(p_training,p_submit);
 select * into i from public.premium_initial_intakes where user_id=u for update;
 if not found then
  if p_expected is distinct from 0::bigint then raise exception 'premium_initial_stale_intake';end if;
  insert into public.premium_initial_intakes(user_id,training,state,submitted_at) values(u,p_training,case when p_submit then 'submitted' else 'draft' end,case when p_submit then clock_timestamp() end) returning * into i;
 else
  if i.row_version is distinct from p_expected then raise exception 'premium_initial_stale_intake';end if;
  update public.premium_initial_operations set state='stale',error_code='premium_initial_intake_changed',updated_at=clock_timestamp() where user_id=u and state in ('reserved','pending_review','ready');
  update public.premium_initial_intakes set training=p_training,state=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then clock_timestamp() end,row_version=row_version+1,updated_at=clock_timestamp() where id=i.id returning * into i;
 end if;return i;
end $$;
create function public.premium_initial_reserve(p_intake uuid,p_key uuid) returns public.premium_initial_operations language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();i public.premium_initial_intakes;o public.premium_initial_operations;e coach_private.premium_entitlements;g uuid;begin
 perform coach_private.premium_upgrade_lock(u);
 if p_intake is null or p_key is null then raise exception 'premium_initial_invalid_request';end if;
 update public.premium_initial_operations set state='failed',error_code='premium_initial_expired',updated_at=clock_timestamp() where user_id=u and state='reserved' and deadline<=clock_timestamp();
 select * into o from public.premium_initial_operations where user_id=u and idempotency_key=p_key;
 if found then if o.intake_id<>p_intake then raise exception 'premium_initial_idempotency_conflict';end if;return o;end if;
 if not coach_private.premium_initial_eligible(u) then raise exception 'premium_initial_not_authorized' using errcode='42501';end if;
 perform coach_private.premium_initial_no_routine(u);g:=coach_private.premium_initial_grant(u);if g is null or coach_private.premium_admission_grant(u) is null then raise exception 'premium_initial_consent_required';end if;
 select * into e from coach_private.premium_entitlements where user_id=u for update;
 if (select count(*) from public.premium_initial_operations where user_id=u and started_at is not null)>=e.generation_limit then raise exception 'premium_initial_allowance_exhausted';end if;
 select * into i from public.premium_initial_intakes where id=p_intake and user_id=u and state='submitted';if not found then raise exception 'premium_initial_intake_required';end if;
 select * into o from public.premium_initial_operations where user_id=u and state in ('reserved','pending_review','ready','accepted');if found then return o;end if;
 insert into public.premium_initial_operations(user_id,intake_id,intake_version,idempotency_key,state,consent_id,entitlement_version,reviewer_id) values(u,i.id,i.row_version,p_key,'reserved',g,e.version,e.initial_reviewer_id) returning * into o;return o;
end $$;
create function coach_private.premium_initial_assert(o public.premium_initial_operations) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare i public.premium_initial_intakes;e coach_private.premium_entitlements;begin
 select * into e from coach_private.premium_entitlements where user_id=o.user_id;
 if not coach_private.premium_initial_eligible(o.user_id) or e.version is distinct from o.entitlement_version or e.initial_reviewer_id is distinct from o.reviewer_id or coach_private.premium_initial_grant(o.user_id) is distinct from o.consent_id or coach_private.premium_admission_grant(o.user_id) is null then raise exception 'premium_initial_stale_or_revoked';end if;
 perform coach_private.premium_initial_no_routine(o.user_id);
 select * into i from public.premium_initial_intakes where id=o.intake_id and user_id=o.user_id and row_version=o.intake_version and state='submitted';if not found then raise exception 'premium_initial_stale_intake';end if;
 return jsonb_build_object('provider_version','premium-initial-context-v1','prompt_version','premium-initial-v1','training',i.training);
end $$;
create function public.premium_initial_backend_context(p_user uuid,p_operation uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare o public.premium_initial_operations;begin
 perform coach_private.premium_backend();select * into o from public.premium_initial_operations where id=p_operation and user_id=p_user;if not found then raise exception 'premium_initial_not_authorized' using errcode='42501';end if;return coach_private.premium_initial_assert(o);
end $$;

create function coach_private.premium_initial_dispatch_budget(input_bound int) returns numeric language plpgsql security definer set search_path=pg_catalog,public as $$
declare b coach_private.premium_analysis_budget;ib coach_private.premium_initial_budget;r numeric;begin
 if input_bound is null or input_bound not between 1 and 100000 then raise exception 'premium_initial_invalid_dispatch';end if;
 select * into b from coach_private.premium_analysis_budget where id for update;select * into ib from coach_private.premium_initial_budget where id for update;
 perform coach_private.premium_finance_expire();
 if exists(select 1 from coach_private.premium_financial_items where incident_open) then raise exception 'premium_financial_blocked';end if;
 r:=(input_bound*2.5+5120*15)/1000000;
 if not ib.enabled or not b.shared_enabled or not coalesce((to_jsonb(b)->>'premium_enabled')::boolean,true) or ib.dispatched>=ib.max_calls or ib.charged_usd+ib.reserved_usd+r>ib.max_usd or b.dispatched+b.chat_dispatched+ib.dispatched>=b.shared_max_calls or b.charged_usd+b.reserved_usd+b.chat_charged_usd+b.chat_reserved_usd+ib.charged_usd+ib.reserved_usd+r>b.shared_max_usd then raise exception 'premium_initial_budget_exhausted';end if;
 return r;
end $$;

create function public.premium_initial_claim(p_user uuid,p_operation uuid,p_input_bound int,p_mode text default 'openai') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.premium_initial_operations;b coach_private.premium_analysis_budget;ib coach_private.premium_initial_budget;e coach_private.premium_entitlements;ctx jsonb;r numeric;begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into o from public.premium_initial_operations where id=p_operation and user_id=p_user for update;if not found then raise exception 'premium_initial_not_authorized' using errcode='42501';end if;
 if o.state<>'reserved' or o.started_at is not null then return jsonb_build_object('claimed',false);end if;
 if o.deadline<=clock_timestamp() then update public.premium_initial_operations set state='failed',error_code='premium_initial_expired' where id=o.id;return jsonb_build_object('claimed',false);end if;
 ctx:=coach_private.premium_initial_assert(o);select * into e from coach_private.premium_entitlements where user_id=p_user for update;
 if (select count(*) from public.premium_initial_operations where user_id=p_user and started_at is not null)>=e.generation_limit then raise exception 'premium_initial_allowance_exhausted';end if;
 if p_mode not in ('mock','openai') or p_mode is null or p_input_bound is null or p_input_bound not between 1 and 100000 then raise exception 'premium_initial_invalid_dispatch';end if;
 select * into b from coach_private.premium_analysis_budget where id for update;select * into ib from coach_private.premium_initial_budget where id for update;
 if not ib.enabled then raise exception 'premium_initial_disabled';end if;
 if p_mode='mock' then r:=0;else r:=coach_private.premium_initial_dispatch_budget(p_input_bound);end if;
 update public.premium_initial_operations set started_at=clock_timestamp(),deadline=clock_timestamp()+interval '120 seconds',provider_mode=p_mode,model=case when p_mode='openai' then 'gpt-5.4-2026-03-05' else 'mock' end,reserved_usd=r,updated_at=clock_timestamp() where id=o.id;
 if p_mode='openai' then update coach_private.premium_initial_budget set dispatched=dispatched+1,reserved_usd=reserved_usd+r where id;perform coach_private.premium_finance_capture('initial',o.id,p_user,p_input_bound,5120);end if;
 return jsonb_build_object('claimed',true,'context',ctx,'reserved_usd',r);
end $$;

-- Initial proposal validation delegates to the unchanged V5 shape and validates closed IDs.
create function coach_private.premium_initial_validate(p jsonb,t jsonb) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare d jsonb;e jsonb;s jsonb;cat jsonb;wd text;labels text[]:=array['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];ids text[]:=array['mon','tue','wed','thu','fri','sat','sun'];n int:=0;secs numeric;seen text[];begin
 perform coach_private.premium_validate_intake(t,true);perform coach_private.validate_proposal(p);
 if p->>'name'<>'Premium · programación inicial' or p->'schema_version'<>'2'::jsonb or jsonb_array_length(p->'days')<>(t->>'days')::int then raise exception 'premium_initial_invalid_proposal';end if;
 for d in select value from jsonb_array_elements(p->'days') loop
  n:=n+1;select value into wd from jsonb_array_elements_text(t->'weekdays') where value=ids[array_position(labels,d->>'name')];
  if wd is null or d->>'name'<>(select labels[x] from generate_series(1,7)x where t->'weekdays' ? ids[x] order by x offset n-1 limit 1) then raise exception 'premium_initial_invalid_day';end if;
  secs:=300;seen:='{}';
  for e in select value from jsonb_array_elements(d->'exercises') loop
   select value into cat from jsonb_array_elements(coach_private.premium_catalogue()) where value->>'name'=e->>'name';
   if cat is null or cat->>'id'=any(seen) or t->'excluded' ? (cat->>'id') or exists(select 1 from jsonb_array_elements_text(cat->'requires') q where not(t#>'{inventory,equipment}' ? q)) then raise exception 'premium_initial_exercise_not_permitted';end if;seen:=array_append(seen,cat->>'id');
   if (e->>'sets')::int>(case when t->>'experience' in ('lt6','m6_12') then 3 else 4 end) then raise exception 'premium_initial_invalid_prescription';end if;
   secs:=secs+120;
   for s in select value from jsonb_array_elements(e->'planned_sets') loop
    if t->>'experience' in ('lt6','m6_12') and (s->>'rir')::int<2 then raise exception 'premium_initial_invalid_prescription';end if;
    secs:=secs+(s->>'reps_max')::int*4*case when cat->>'id' in ('reverse_lunge','db_row','dead_bug','bird_dog') then 2 else 1 end+(s->>'rest_seconds')::int+case when cat->>'id' in ('reverse_lunge','db_row','dead_bug','bird_dog') then 15 else 0 end;
   end loop;
  end loop;
  if secs>(t->'minutes_by_day'->>wd)::numeric*60*.9 then raise exception 'premium_initial_duration_exceeded';end if;
 end loop;
end $$;
create function public.premium_initial_finish(p_user uuid,p_operation uuid,p_proposal jsonb,p_error text,p_receipt jsonb,p_quality jsonb,p_latency_ms int) returns public.premium_initial_operations language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.premium_initial_operations;ctx jsonb;err text:=p_error;cost numeric;begin
 perform coach_private.premium_backend();perform coach_private.premium_upgrade_lock(p_user);
 select * into o from public.premium_initial_operations where id=p_operation and user_id=p_user for update;
 if not found or o.started_at is null then raise exception 'premium_initial_not_dispatched';end if;
 if o.completed_at is not null then return o;end if;
 if p_latency_ms is null or p_latency_ms not between 0 and 300000 or p_receipt is null or jsonb_typeof(p_receipt)<>'object' or p_error is not null and p_error !~ '^[a-z_]{1,80}$' then raise exception 'premium_initial_invalid_receipt';end if;
 if o.provider_mode='openai' then cost:=coach_private.premium_finance_settle('initial',o.id,p_user,o.reserved_usd,p_receipt,false);if exists(select 1 from coach_private.premium_financial_items where kind='initial' and item_id=o.id and state='unverified') then err:='premium_initial_receipt_unverified';end if;else cost:=0;end if;
 if o.state<>'reserved' then update public.premium_initial_operations set completed_at=clock_timestamp(),receipt=p_receipt,verified_usd=case when provider_mode='mock' or exists(select 1 from coach_private.premium_financial_items where kind='initial' and item_id=o.id and state='verified') then cost end,latency_ms=p_latency_ms where id=o.id returning * into o;return o;end if;
 if o.deadline<=clock_timestamp() then err:='premium_initial_expired';end if;
 begin ctx:=coach_private.premium_initial_assert(o);exception when others then err:='premium_initial_stale_or_revoked';end;
 if err is null then
  begin perform coach_private.premium_initial_validate(p_proposal,ctx->'training');
   if p_quality is null or p_quality->'ok' is distinct from 'true'::jsonb or jsonb_typeof(p_quality->'warnings') is distinct from 'array' then raise exception 'premium_initial_quality_required';end if;
  exception when others then err:='premium_initial_invalid_output';end;
 end if;
 update public.premium_initial_operations set state=case when err is null then 'pending_review' else 'failed' end,error_code=err,proposal=case when err is null then p_proposal end,quality_warnings=coalesce(p_quality->'warnings','[]'::jsonb),receipt=p_receipt,verified_usd=case when provider_mode='mock' or exists(select 1 from coach_private.premium_financial_items where kind='initial' and item_id=o.id and state='verified') then cost end,latency_ms=p_latency_ms,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=o.id returning * into o;return o;
end $$;

create function coach_private.premium_initial_review_projection(o public.premium_initial_operations) returns jsonb language sql immutable set search_path=pg_catalog,public as $$
 select jsonb_build_object('id',o.id,'user_id',o.user_id,'kind',o.kind,'state',o.state,'proposal',o.proposal,'quality_warnings',o.quality_warnings,'prompt_version',o.prompt_version,'provider_version',o.provider_version,'reviewer_id',o.reviewer_id,'reviewed_at',o.reviewed_at,'review_reason',o.review_reason,'created_at',o.created_at)
$$;
create function public.premium_initial_review_queue() returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
begin
 if not coach_private.is_reviewer(auth.uid()) then raise exception 'premium_initial_reviewer_required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('operation',coach_private.premium_initial_review_projection(o),'training',i.training,'athlete',jsonb_build_object('user_id',o.user_id,'name',p.name)) order by o.created_at desc) from public.premium_initial_operations o join public.premium_initial_intakes i on i.id=o.intake_id and i.row_version=o.intake_version join public.profiles p on p.id=o.user_id join coach_private.premium_entitlements e on e.user_id=o.user_id and e.version=o.entitlement_version and e.initial_reviewer_id=o.reviewer_id where o.reviewer_id=auth.uid() and o.user_id<>auth.uid() and o.state='pending_review' and coach_private.premium_initial_eligible(o.user_id) and coach_private.premium_initial_grant(o.user_id)=o.consent_id and coach_private.premium_admission_grant(o.user_id) is not null),'[]'::jsonb);
end $$;
create function public.premium_initial_review(p_operation uuid,p_approve boolean,p_reason text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare o public.premium_initial_operations;ctx jsonb;begin
 select * into o from public.premium_initial_operations where id=p_operation;
 if not found or not coach_private.is_reviewer(auth.uid()) or o.reviewer_id is distinct from auth.uid() then raise exception 'premium_initial_reviewer_required' using errcode='42501';end if;
 perform coach_private.premium_upgrade_lock(o.user_id);select * into o from public.premium_initial_operations where id=p_operation for update;
 if not coach_private.is_reviewer(auth.uid()) or o.reviewer_id is distinct from auth.uid() or p_approve is null or p_reason is null or length(btrim(p_reason)) not between 1 and 1000 then raise exception 'premium_initial_review_invalid';end if;
 ctx:=coach_private.premium_initial_assert(o);
 if o.state='ready' and p_approve then return coach_private.premium_initial_review_projection(o);end if;if o.state<>'pending_review' then raise exception 'premium_initial_review_not_pending';end if;
 perform coach_private.premium_initial_validate(o.proposal,ctx->'training');
 update public.premium_initial_operations set state=case when p_approve then 'ready' else 'rejected' end,reviewed_at=clock_timestamp(),review_reason=btrim(p_reason),reviewed_by=auth.uid(),updated_at=clock_timestamp() where id=o.id returning * into o;return coach_private.premium_initial_review_projection(o);
end $$;

create function public.premium_initial_accept(p_operation uuid) returns jsonb language plpgsql security definer set search_path=pg_catalog,public set timezone='Europe/Madrid' as $$
declare u uuid:=coach_private.actor();o public.premium_initial_operations;ctx jsonb;rid uuid;did uuid;eid uuid;v uuid:=gen_random_uuid();m uuid:=gen_random_uuid();e jsonb;d jsonb;cat jsonb;ds jsonb:='[]';es jsonb;snap jsonb;bindings jsonb:='{}';dn int:=0;en int;n int;until_ timestamptz;begin
 perform coach_private.premium_upgrade_lock(u);
 select * into o from public.premium_initial_operations where id=p_operation and user_id=u for update;if not found then raise exception 'premium_initial_not_authorized' using errcode='42501';end if;
 if o.state='accepted' then return jsonb_build_object('routine_id',o.routine_id,'revision_id',o.revision_id,'mesocycle_id',o.mesocycle_id);end if;
 if o.state<>'ready' or o.reviewed_by is distinct from o.reviewer_id then raise exception 'premium_initial_review_required';end if;
 ctx:=coach_private.premium_initial_assert(o);perform coach_private.premium_initial_validate(o.proposal,ctx->'training');
 select expires_at into until_ from coach_private.premium_entitlements where user_id=u;
 insert into public.routines(owner_id,name,description,routine_order) values(u,o.proposal->>'name',o.proposal->>'description',coalesce((select max(routine_order)+1 from public.routines where owner_id=u),0)) returning id into rid;
 for d in select value from jsonb_array_elements(o.proposal->'days') loop
  insert into public.routine_days(routine_id,name,day_order) values(rid,d->>'name',dn) returning id into did;en:=0;es:='[]';
  for e in select value from jsonb_array_elements(d->'exercises') loop
   select value into cat from jsonb_array_elements(coach_private.premium_catalogue()) where value->>'name'=e->>'name';
   insert into public.routine_exercises(day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values(did,e->>'name',(e->>'sets')::int,(e->>'reps_min')||'-'||(e->>'reps_max'),e->>'rir',(e->>'rest_seconds')::int,en,null) returning id into eid;
   es:=es||jsonb_build_array(e||jsonb_build_object('id',eid,'day_id',did,'exercise_order',en,'target',(e->>'reps_min')||'-'||(e->>'reps_max'),'catalogue_id',cat->>'id'));bindings:=bindings||jsonb_build_object(eid::text,cat->>'id');en:=en+1;
  end loop;ds:=ds||jsonb_build_array(jsonb_build_object('id',did,'routine_id',rid,'name',d->>'name','day_order',dn,'exercises',es));dn:=dn+1;
 end loop;
 snap:=jsonb_build_object('id',rid,'owner_id',u,'name',o.proposal->>'name','description',o.proposal->>'description','days',ds);
 insert into public.routine_revisions(id,routine_id,user_id,origin,revision_no,snapshot_schema,snapshot,snapshot_hash,author_kind,accepted_by,reason) values(v,rid,u,'premium_baseline',1,1,snap,md5(snap::text),case when o.provider_mode='mock' then 'mock' else 'model' end,u,'Explicit acceptance of reviewed Premium initial proposal '||o.id::text);
 insert into public.routine_management(routine_id,user_id,current_revision_id,plan_kind) values(rid,u,v,'premium');
 select coalesce(max(number),0)+1 into n from public.coach_mesocycles where user_id=u;
 insert into public.coach_mesocycles(id,user_id,routine_id,number,start_date,planned_weeks,state,objective,initial_revision_id,current_revision_id,intake,intake_submitted_at,access_until,reviewer_id,catalogue_bindings) values(m,u,rid,n,current_date,4,'active',ctx->'training'->>'goal',v,v,ctx->'training',clock_timestamp(),until_,o.reviewer_id,bindings);
 insert into public.coach_mesocycle_weeks(mesocycle_id,routine_id,user_id,week_number,planned_date,revision_id,state) select m,rid,u,x,current_date+(x-1)*7,v,case when x=1 then 'active' else 'planned' end from generate_series(1,4)x;
 -- Explicit initial provenance, never a fictitious Basic or inherited routine operation.
 insert into coach_private.premium_admissions(routine_id,user_id,mesocycle_id,baseline_revision_id,source_kind,consent_id,entitlement_version,idempotency_key,start_date,planned_weeks,initial_operation_id) values(rid,u,m,v,'initial',coach_private.premium_admission_grant(u),o.entitlement_version,o.idempotency_key,current_date,4,o.id);
 update public.premium_initial_operations set state='accepted',routine_id=rid,revision_id=v,mesocycle_id=m,accepted_at=clock_timestamp(),updated_at=clock_timestamp() where id=o.id;
 return jsonb_build_object('routine_id',rid,'revision_id',v,'mesocycle_id',m);
end $$;
create function public.premium_initial_my_state() returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();e coach_private.premium_entitlements;i public.premium_initial_intakes;o public.premium_initial_operations;c int;enabled_ boolean;blocker text;begin
 perform coach_private.premium_upgrade_lock(u);
 -- Refresh recovers a failed/pre-dispatch request without another provider call. Any financial
 -- liability remains in its separate ledger; a late result cannot revive the expired proposal.
 update public.premium_initial_operations set state='failed',error_code='premium_initial_expired',updated_at=clock_timestamp() where user_id=u and state='reserved' and deadline<=clock_timestamp();
 select * into e from coach_private.premium_entitlements where user_id=u;select * into i from public.premium_initial_intakes where user_id=u;select * into o from public.premium_initial_operations where user_id=u order by created_at desc,id desc limit 1;
 if o.state in ('reserved','pending_review','ready') and (e.version is distinct from o.entitlement_version or e.initial_reviewer_id is distinct from o.reviewer_id or coach_private.premium_initial_grant(u) is distinct from o.consent_id or coach_private.premium_admission_grant(u) is null or i.row_version is distinct from o.intake_version or i.state is distinct from 'submitted') then
  update public.premium_initial_operations set state='stale',error_code='premium_initial_stale_or_revoked',updated_at=clock_timestamp() where id=o.id returning * into o;
 end if;
 select count(*) into c from public.premium_initial_operations where user_id=u and started_at is not null;enabled_:=coach_private.premium_initial_eligible(u);
 if not enabled_ then blocker:='premium_initial_not_authorized';elsif o.state='accepted' then blocker:='premium_initial_already_accepted';elsif exists(select 1 from public.routine_assignments where client_id=u and client_deleted_at is null) or exists(select 1 from public.routines where owner_id=u and deleted_at is null) then blocker:='premium_initial_existing_routine';elsif coach_private.premium_initial_grant(u) is null or coach_private.premium_admission_grant(u) is null then blocker:='premium_initial_consent_required';elsif i.state is distinct from 'submitted' then blocker:='premium_initial_intake_required';elsif o.state in ('reserved','pending_review','ready') then blocker:='premium_initial_operation_active';elsif c>=coalesce(e.generation_limit,0) then blocker:='premium_initial_allowance_exhausted';elsif not coalesce((select enabled from coach_private.premium_initial_budget where id),false) then blocker:='premium_initial_disabled';end if;
 return jsonb_build_object('enabled',enabled_,'can_generate',blocker is null,'blocker',blocker,'allowance',jsonb_build_object('limit',coalesce(e.generation_limit,0),'consumed',c,'remaining',greatest(0,coalesce(e.generation_limit,0)-c)),'notice_version','premium-initial-v1','consent',jsonb_build_object('id',coach_private.premium_initial_grant(u),'allowed',coach_private.premium_initial_grant(u) is not null),'intake',case when i.id is not null then to_jsonb(i) end,'operation',case when o.id is not null then to_jsonb(o) end,'routine_id',o.routine_id,'mesocycle_id',o.mesocycle_id);
end $$;

-- STAGING-only delta for the already-installed initial candidate.
-- New/reactivated client relationships and initial acceptance share the client lock.
create function coach_private.premium_initial_assignment_guard() returns trigger
language plpgsql volatile security definer set search_path=pg_catalog,public as $$
begin
 if new.client_deleted_at is not null or (tg_op='UPDATE' and old.client_deleted_at is null and new.client_id=old.client_id) then return new;end if;
 perform coach_private.premium_upgrade_lock(new.client_id);
 -- Provider/global kill switches stop AI calls, not delivered management.
 -- Expiry/revocation of this exact user's entitlement ends this conflict guard.
 if exists(select 1 from coach_private.premium_entitlements e where e.user_id=new.client_id and e.enabled and e.expires_at>clock_timestamp() and 'tracking'=any(e.capabilities)) and exists(
  select 1 from public.premium_initial_operations o
  join public.routine_management rm on rm.routine_id=o.routine_id and rm.user_id=o.user_id and rm.plan_kind='premium'
  -- Archiving is presentation metadata, not revocation of active management.
  join public.routines r on r.id=rm.routine_id
  join public.coach_mesocycles m on m.id=o.mesocycle_id and m.state='active'
  where o.user_id=new.client_id and o.state='accepted') then
  raise exception 'premium_initial_active_management_conflict' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function coach_private.premium_initial_assignment_guard() from public,anon,authenticated,service_role;
create trigger premium_initial_assignment_guard before insert or update of client_id,client_deleted_at
on public.routine_assignments for each row execute function coach_private.premium_initial_assignment_guard();

do $acl$ declare f record;begin
 for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','coach_private') and p.proname like 'premium_initial_%' loop execute 'revoke all on function '||f.sig||' from public,anon,authenticated,service_role';end loop;
end $acl$;
grant execute on function public.premium_initial_my_state(),public.premium_initial_save_intake(bigint,jsonb,boolean),public.premium_initial_permission(boolean,text),public.premium_initial_reserve(uuid,uuid),public.premium_initial_accept(uuid),public.premium_initial_review_queue(),public.premium_initial_review(uuid,boolean,text) to authenticated;
grant execute on function public.premium_initial_set_allowance(uuid,uuid,integer),public.premium_initial_backend_context(uuid,uuid),public.premium_initial_claim(uuid,uuid,integer,text),public.premium_initial_finish(uuid,uuid,jsonb,text,jsonb,jsonb,integer) to service_role;
notify pgrst,'reload schema';
commit;
