-- Minimal synthetic schema only. Security SQL bodies are extracted from repository migrations.
create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
create schema auth;create schema coach_private;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema public,auth to anon,authenticated,service_role;
create table public.profiles(id uuid primary key,role text,name text);
create table public.context_grants(id uuid primary key,user_id uuid not null,scope text,notice_version text,granted_at timestamptz default clock_timestamp(),revoked_at timestamptz);
create table public.routines(id uuid primary key,owner_id uuid,deleted_at timestamptz);
create table public.routine_assignments(client_id uuid,client_deleted_at timestamptz);
create table public.routine_management(user_id uuid);
create table coach_private.local_config(id boolean primary key default true,reviewers jsonb not null default '{}');
insert into coach_private.local_config values(true,'{}');
create function coach_private.reviewer_config() returns jsonb language sql stable security definer set search_path=pg_catalog as $$select reviewers from coach_private.local_config where id$$;
create table coach_private.premium_initial_budget(id boolean primary key default true,enabled boolean not null default false);
insert into coach_private.premium_initial_budget values(true,false);
create table coach_private.premium_entitlements(user_id uuid primary key,enabled boolean not null,expires_at timestamptz not null,capabilities text[] not null,generation_limit integer not null,version uuid not null,initial_reviewer_id uuid);
create table public.premium_initial_intakes(id uuid primary key,user_id uuid not null,row_version bigint not null,state text not null,training jsonb not null);
create table public.premium_initial_operations(
 id uuid primary key,user_id uuid not null,kind text not null default 'premium_initial',intake_id uuid not null,intake_version bigint not null,
 idempotency_key uuid not null,state text not null,consent_id uuid not null,entitlement_version uuid not null,reviewer_id uuid not null,
 proposal jsonb,quality_warnings jsonb not null default '[]',prompt_version text not null default 'premium-initial-v1',provider_version text not null default 'premium-initial-context-v1',
 receipt jsonb,reviewed_at timestamptz,review_reason text,reviewed_by uuid,created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp());
alter table public.premium_initial_operations enable row level security;
alter table public.premium_initial_intakes enable row level security;
alter table public.context_grants enable row level security;
grant select on public.premium_initial_operations,public.premium_initial_intakes,public.context_grants to authenticated;
create policy premium_initial_operation_owner on public.premium_initial_operations for select to authenticated using(user_id=(select auth.uid()));
create policy premium_initial_intake_owner on public.premium_initial_intakes for select to authenticated using(user_id=(select auth.uid()));
create policy context_grant_owner on public.context_grants for select to authenticated using(user_id=(select auth.uid()));
