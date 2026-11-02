-- Synthetic minimal dependency schema. Auth/provider/intake-validator adapters are doubles.
-- Reservation, quota, retry, review, entitlement and RLS functions under test are real SQL.
create schema coach_private;
create table coach_private.local_config(singleton bool primary key default true,pilot jsonb not null default '{}',reviewers jsonb not null default '{}');
insert into coach_private.local_config(singleton) values(true);
create function coach_private.pilot_config() returns jsonb language sql security definer as $$select pilot from coach_private.local_config$$;
create function coach_private.reviewer_config() returns jsonb language sql security definer as $$select reviewers from coach_private.local_config$$;
create function coach_private.is_reviewer(u uuid) returns boolean language sql security definer as $$select coalesce((coach_private.reviewer_config()->u::text->>'enabled')::boolean,false) and coalesce((coach_private.reviewer_config()->u::text->>'expires_at')::timestamptz>now(),false)$$;
create function coach_private.allowed(u uuid) returns boolean language sql security definer as $$select coalesce((coach_private.pilot_config()->u::text->>'enabled')::boolean,false) and coalesce((coach_private.pilot_config()->u::text->>'expires_at')::timestamptz>now(),false) and exists(select 1 from public.profiles where id=u and role='client')$$;
create function coach_private.actor() returns uuid language plpgsql security definer as $$begin if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='client') then raise exception 'coach_not_authorized';end if;return auth.uid();end$$;
create function coach_private.generation_limit(u uuid) returns integer language sql security definer as $$select case coalesce(coach_private.pilot_config()->u::text->>'generation_limit','1') when '1' then 1 when '2' then 2 else 0 end$$;
create function coach_private.review_required() returns boolean language sql as $$select true$$;
create function coach_private.validate_intake(t jsonb,h jsonb) returns void language plpgsql as $$begin if t->>'invalid'='true' then raise exception 'coach_invalid_intake';end if;end$$;
create function coach_private.premium_upgrade_lock(u uuid) returns void language sql as $$select pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0))$$;
create table public.training_intakes(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),revision int not null default 1,schema_version int not null default 2,state text not null default 'submitted',training jsonb not null default '{}',row_version bigint not null default 1,unique(id,user_id));
create table public.context_grants(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),scope text not null default 'training_intake',notice_version text not null default 'pilot-supervised-v2',revoked_at timestamptz);
create function coach_private.require_context(u uuid) returns uuid[] language plpgsql security definer as $$declare ids uuid[];begin select array_agg(id) into ids from public.context_grants where user_id=u and scope='training_intake' and notice_version='pilot-supervised-v2' and revoked_at is null;if coalesce(cardinality(ids),0)<>1 then raise exception 'coach_context_required';end if;return ids;end$$;
create table public.routines(id uuid primary key default gen_random_uuid(),owner_id uuid not null,name text);
create table public.coach_operations(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),intake_id uuid not null,intake_version bigint not null default 1,
 idempotency_key uuid not null default gen_random_uuid(),state text not null,proposal jsonb,grant_ids uuid[] not null,prompt_version text,
 routine_id uuid references public.routines(id),error_code text,review_required boolean not null default true,review_decision text,review_reason text,reviewed_by uuid,reviewed_at timestamptz,
 retry_source uuid references public.coach_operations(id),retry_authorized_by uuid,retry_authorized_at timestamptz,retry_reason text,athlete_comment text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes',generation_started_at timestamptz,
 estimated_cost numeric,latency_ms int,raw_private_receipt jsonb,
 unique(id,user_id),unique(user_id,idempotency_key),foreign key(intake_id,user_id) references public.training_intakes(id,user_id));
create unique index coach_one_pending_operation on public.coach_operations(user_id) where state in ('reserved','pending_review','ready');
create unique index coach_one_generation_per_intake on public.coach_operations(user_id,intake_id) where retry_source is null;
create table public.routine_management(routine_id uuid primary key references public.routines(id),user_id uuid not null,plan_kind text not null default 'basic');
create table public.workouts(user_id uuid not null,data jsonb);
create table public.coach_pilot_feedback(user_id uuid not null,routine_id uuid not null,comment text,rating int);
alter table public.coach_operations enable row level security;
alter table public.coach_pilot_feedback enable row level security;
alter table public.training_intakes enable row level security;
grant select on public.coach_operations,public.coach_pilot_feedback,public.training_intakes to authenticated;
create policy coach_read_own on public.coach_operations for select to authenticated using(user_id=(select auth.uid()));
create policy coach_read_own on public.training_intakes for select to authenticated using(user_id=(select auth.uid()));
create policy coach_feedback_read on public.coach_pilot_feedback for select to authenticated using(user_id=(select auth.uid()) or coach_private.is_reviewer(auth.uid()));
create function public.get_coach_reviewer_access() returns boolean language sql security definer as $$select coach_private.is_reviewer(auth.uid())$$;
create function public.get_coach_reviewer_status() returns jsonb language sql security definer as $$select jsonb_build_object('authorized',coach_private.is_reviewer(auth.uid()))$$;
revoke all on all functions in schema coach_private from public,anon,authenticated,service_role;
