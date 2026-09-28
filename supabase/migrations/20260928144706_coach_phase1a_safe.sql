-- SIMPLE Coach 1A. STAGING ONLY. Six additive tables; existing RPC definitions unchanged.
-- Closed pilot configuration is deliberately empty. Provision via reviewed server SQL, never frontend.
create schema coach_private;
revoke all on schema coach_private from public,anon,authenticated;
alter default privileges in schema coach_private revoke execute on functions from public;
create function coach_private.pilot_config() returns jsonb language sql stable
set search_path=pg_catalog as $$ select '{}'::jsonb $$;
create function coach_private.allowed(u uuid) returns boolean language sql stable security definer
set search_path=pg_catalog,public,coach_private as $$
 select coalesce(coach_private.pilot_config() ? u::text,false)
 and exists(select 1 from public.profiles where id=u and role='client')
 and (coach_private.pilot_config()->u::text->>'expires_at' is null
      or (coach_private.pilot_config()->u::text->>'expires_at')::timestamptz>now())
$$;
create function coach_private.actor() returns uuid language plpgsql stable security definer
set search_path=pg_catalog,public as $$
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='client')
 then raise exception 'coach_not_authorized' using errcode='42501'; end if;
 return auth.uid();
end $$;
create function coach_private.keys_exact(v jsonb,ks text[]) returns boolean language sql immutable
set search_path=pg_catalog as $$
 select jsonb_typeof(v)='object' and (select array_agg(k order by k) from jsonb_object_keys(v) k)
 = (select array_agg(k order by k) from unnest(ks) k)
$$;
create function coach_private.valid_int(v jsonb,lo int,hi int) returns boolean language sql immutable
set search_path=pg_catalog as $$
 select coalesce(jsonb_typeof(v)='number' and v::text ~ '^[0-9]+$'
 and (v::text)::numeric between lo and hi,false)
$$;
create function coach_private.valid_text(v jsonb,lo int,hi int) returns boolean language sql immutable
set search_path=pg_catalog as $$
 select coalesce(jsonb_typeof(v)='string' and length(btrim(v#>>'{}')) between lo and hi,false)
$$;
create function coach_private.validate_intake(t jsonb,h jsonb) returns void language plpgsql immutable
set search_path=pg_catalog,coach_private as $$
declare v jsonb;
begin
 if not coalesce(coach_private.keys_exact(t,array['goal','experience','days','minutes','equipment','preferred','avoided','preferences']),false)
 or not coalesce(coach_private.keys_exact(h,array['discomfort','limitations']),false)
 then raise exception 'coach_invalid_intake'; end if;
 if not coach_private.valid_text(t->'goal',1,120)
 or not coach_private.valid_text(t->'experience',1,30)
 or t->>'experience' not in ('beginner','intermediate','experienced')
 or not coach_private.valid_int(t->'days',1,7)
 or not coach_private.valid_int(t->'minutes',15,120)
 or not coach_private.valid_text(t->'preferred',0,500)
 or not coach_private.valid_text(t->'avoided',0,500)
 or not coach_private.valid_text(t->'preferences',0,1000)
 or not coach_private.valid_text(h->'discomfort',0,1000)
 or not coach_private.valid_text(h->'limitations',0,1000)
 or jsonb_typeof(t->'equipment') is distinct from 'array'
 then raise exception 'coach_invalid_intake'; end if;
 if jsonb_array_length(t->'equipment') not between 1 and 12 then raise exception 'coach_invalid_intake'; end if;
 for v in select value from jsonb_array_elements(t->'equipment') loop
  if not coach_private.valid_text(v,1,60) then raise exception 'coach_invalid_intake'; end if;
 end loop;
end $$;
create function coach_private.validate_proposal(p jsonb) returns void language plpgsql immutable
set search_path=pg_catalog,coach_private as $$
declare d jsonb;e jsonb;
begin
 if not coalesce(coach_private.keys_exact(p,array['schema_version','name','description','days']),false)
 or p->'schema_version' is distinct from '1'::jsonb
 or not coach_private.valid_text(p->'name',1,100)
 or not coach_private.valid_text(p->'description',0,500)
 or jsonb_typeof(p->'days') is distinct from 'array'
 then raise exception 'coach_invalid_proposal';end if;
 if jsonb_array_length(p->'days') not between 1 and 7 then raise exception 'coach_invalid_proposal';end if;
 for d in select value from jsonb_array_elements(p->'days') loop
  if not coalesce(coach_private.keys_exact(d,array['name','exercises']),false)
  or not coach_private.valid_text(d->'name',1,80)
  or jsonb_typeof(d->'exercises') is distinct from 'array'
  then raise exception 'coach_invalid_proposal';end if;
  if jsonb_array_length(d->'exercises') not between 1 and 8 then raise exception 'coach_invalid_proposal';end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if not coalesce(coach_private.keys_exact(e,array['name','sets','reps_min','reps_max','rir','rest_seconds']),false)
   or not coach_private.valid_text(e->'name',1,100)
   or not coach_private.valid_int(e->'sets',1,6)
   or not coach_private.valid_int(e->'reps_min',1,30)
   or not coach_private.valid_int(e->'reps_max',1,30)
   or (e->>'reps_min')::int>(e->>'reps_max')::int
   or not coach_private.valid_int(e->'rir',0,5)
   or not coach_private.valid_int(e->'rest_seconds',0,300)
   then raise exception 'coach_invalid_proposal';end if;
  end loop;
 end loop;
end $$;

create table public.training_intakes(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 revision int not null check(revision>0),
 schema_version int not null default 1 check(schema_version=1),
 state text not null check(state in ('draft','submitted')),
 training jsonb not null check(jsonb_typeof(training)='object'),
 row_version bigint not null default 1 check(row_version>0),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 submitted_at timestamptz,
 unique(user_id,revision),unique(id,user_id),
 check((state='submitted')=(submitted_at is not null))
);
create unique index coach_one_draft on public.training_intakes(user_id) where state='draft';
create table public.intake_health(
 intake_id uuid primary key,
 user_id uuid not null references auth.users(id) on delete restrict,
 schema_version int not null default 1 check(schema_version=1),
 declarations jsonb not null check(jsonb_typeof(declarations)='object'),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 foreign key(intake_id,user_id) references public.training_intakes(id,user_id) on delete restrict
);
create index coach_health_owner on public.intake_health(user_id);
create table public.context_grants(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 scope text not null check(scope in ('training_intake','declared_health')),
 notice_version text not null default 'pilot-mock-v1' check(notice_version='pilot-mock-v1'),
 granted_at timestamptz not null default now(),revoked_at timestamptz,
 created_at timestamptz not null default now(),
 check(revoked_at is null or revoked_at>=granted_at)
);
create unique index coach_active_grant on public.context_grants(user_id,scope) where revoked_at is null;
create table public.coach_operations(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete restrict,
 kind text not null default 'basic_initial' check(kind='basic_initial'),
 intake_id uuid not null,intake_version bigint not null,
 idempotency_key uuid not null,
 state text not null check(state in ('reserved','ready','failed','stale','accepted')),
 error_code text check(error_code is null or error_code in ('technical_error','reservation_expired','context_changed','intake_changed','safety_review_required')),
 proposal jsonb,
 grant_ids uuid[] not null,
 model_provider text,model_name text,prompt_version text,
 output_schema_version int check(output_schema_version is null or output_schema_version=1),
 input_tokens int check(input_tokens>=0),output_tokens int check(output_tokens>=0),
 estimated_cost numeric check(estimated_cost>=0),
 routine_id uuid unique references public.routines(id) on delete restrict,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '5 minutes',
 completed_at timestamptz,accepted_at timestamptz,
 foreign key(intake_id,user_id) references public.training_intakes(id,user_id) on delete restrict,
 unique(user_id,idempotency_key),unique(id,user_id),
 check((state='accepted')=(routine_id is not null and accepted_at is not null)),
 check(state not in ('ready','accepted') or proposal is not null),
 check(expires_at>created_at)
);
create unique index coach_one_initial_operation on public.coach_operations(user_id) where state in ('reserved','ready','accepted');
create index coach_operation_intake on public.coach_operations(intake_id);
create index coach_operation_state on public.coach_operations(state,expires_at);
create table public.routine_management(
 routine_id uuid primary key references public.routines(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 operation_id uuid not null unique,
 current_revision_id uuid not null,
 mode text not null default 'simple_coach' check(mode='simple_coach'),
 created_at timestamptz not null default now(),
 foreign key(operation_id,user_id) references public.coach_operations(id,user_id) on delete restrict,
 unique(routine_id,user_id)
);
create index coach_management_owner on public.routine_management(user_id);
create table public.routine_revisions(
 id uuid primary key default gen_random_uuid(),
 routine_id uuid not null references public.routines(id) on delete restrict,
 user_id uuid not null references auth.users(id) on delete restrict,
 operation_id uuid not null unique,
 revision_no int not null default 1 check(revision_no=1),
 snapshot_schema int not null default 1 check(snapshot_schema=1),
 snapshot jsonb not null check(jsonb_typeof(snapshot)='object'),
 snapshot_hash text not null,
 author_kind text not null default 'mock' check(author_kind='mock'),
 accepted_by uuid not null references auth.users(id) on delete restrict,
 reason text not null default 'Explicit acceptance of synthetic Basic pilot proposal',
 created_at timestamptz not null default now(),
 unique(routine_id,revision_no),unique(id,routine_id),
 foreign key(operation_id,user_id) references public.coach_operations(id,user_id) on delete restrict,
 check(accepted_by=user_id)
);
create index coach_revision_owner on public.routine_revisions(user_id);
alter table public.routine_management add constraint coach_current_revision_fk
 foreign key(current_revision_id,routine_id) references public.routine_revisions(id,routine_id) on delete restrict;

do $$
declare n text;
begin
 foreach n in array array['training_intakes','intake_health','context_grants','coach_operations','routine_management','routine_revisions'] loop
  execute format('alter table public.%I enable row level security',n);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',n);
  execute format('grant select on public.%I to authenticated',n);
  execute format('create policy coach_read_own on public.%I for select to authenticated using (user_id=(select auth.uid()))',n);
 end loop;
end $$;

create function coach_private.require_context(u uuid) returns uuid[] language plpgsql stable security definer
set search_path=pg_catalog,public as $$
declare ids uuid[];
begin
 select array_agg(id order by scope) into ids from public.context_grants where user_id=u and revoked_at is null;
 if coalesce(array_length(ids,1),0)<>2 then raise exception 'coach_context_required';end if;
 return ids;
end $$;
create function public.get_my_coach_access() returns jsonb language plpgsql stable security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();
begin
 return jsonb_build_object('authorized',coach_private.allowed(u),'plan','basic_pilot','premium',false,
 'can_generate',coach_private.allowed(u) and not exists(select 1 from public.coach_operations where user_id=u and state='accepted'),
 'routine_id',(select routine_id from public.coach_operations where user_id=u and state='accepted'));
end $$;

create function public.save_my_training_intake(p_id uuid,p_expected bigint,p_training jsonb,p_health jsonb,p_submit boolean)
returns public.training_intakes language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor(); r public.training_intakes; next_rev int;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 perform coach_private.validate_intake(p_training,p_health);
 if p_submit is null then raise exception 'coach_invalid_intake';end if;
 if p_id is not null then
  select * into r from public.training_intakes where id=p_id and user_id=u for update;
  if not found then raise exception 'coach_not_authorized';end if;
  if r.row_version is distinct from p_expected then raise exception 'coach_intake_conflict';end if;
 end if;
 if p_id is null or r.state='submitted' then
  if exists(select 1 from public.training_intakes where user_id=u and state='draft') then raise exception 'coach_intake_conflict';end if;
  select coalesce(max(revision),0)+1 into next_rev from public.training_intakes where user_id=u;
  insert into public.training_intakes(user_id,revision,state,training,submitted_at)
  values(u,next_rev,case when p_submit then 'submitted' else 'draft' end,p_training,case when p_submit then now() end) returning * into r;
 else
  update public.training_intakes set training=p_training,row_version=row_version+1,updated_at=now(),
   state=case when p_submit then 'submitted' else 'draft' end,submitted_at=case when p_submit then now() end
  where id=r.id returning * into r;
 end if;
 insert into public.intake_health(intake_id,user_id,declarations) values(r.id,u,p_health)
 on conflict(intake_id) do update set declarations=excluded.declarations,updated_at=now();
 update public.coach_operations set state='stale',error_code='intake_changed',updated_at=now()
 where user_id=u and state in ('reserved','ready');
 return r;
end $$;

create function public.set_my_coach_context_permission(p_scope text,p_allow boolean)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();
begin
 if p_scope not in ('training_intake','declared_health') or p_scope is null or p_allow is null then raise exception 'coach_invalid_scope';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if p_allow then
  insert into public.context_grants(user_id,scope) values(u,p_scope)
  on conflict(user_id,scope) where revoked_at is null do nothing;
 else
  update public.context_grants set revoked_at=now() where user_id=u and scope=p_scope and revoked_at is null;
  update public.coach_operations set state='stale',error_code='context_changed',updated_at=now()
   where user_id=u and state in ('reserved','ready');
 end if;
 return p_allow;
end $$;

create function public.reserve_basic_generation(p_intake_id uuid,p_key uuid)
returns public.coach_operations language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();i public.training_intakes;o public.coach_operations;g uuid[];
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required' using errcode='42501';end if;
 g:=coach_private.require_context(u);
 select * into i from public.training_intakes where id=p_intake_id and user_id=u;
 if not found or i.state<>'submitted' or i.revision<>(select max(revision) from public.training_intakes where user_id=u)
 then raise exception 'coach_current_intake_required';end if;
 if p_key is null then raise exception 'coach_key_required';end if;
 select * into o from public.coach_operations where user_id=u and idempotency_key=p_key;
 if found then
  if o.intake_id<>p_intake_id then raise exception 'coach_key_conflict';end if;
  return o;
 end if;
 update public.coach_operations set state='failed',error_code='reservation_expired',updated_at=now()
  where user_id=u and state='reserved' and expires_at<now();
 select * into o from public.coach_operations where user_id=u and state in ('reserved','ready','accepted');
 if found then return o;end if;
 if (select count(*) from public.coach_operations where user_id=u and created_at>now()-interval '1 hour')>=5 then raise exception 'coach_rate_limit';end if;
 insert into public.coach_operations(user_id,intake_id,intake_version,idempotency_key,state,grant_ids)
 values(u,i.id,i.row_version,p_key,'reserved',g) returning * into o;
 return o;
end $$;

-- Only the single verified Edge orchestrator uses these service-only entry points.
create function public.coach_backend_context(p_user uuid,p_operation uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;i public.training_intakes;g uuid[];
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 if not coach_private.allowed(p_user) then raise exception 'coach_pilot_required';end if;
 select * into o from public.coach_operations where id=p_operation and user_id=p_user and state='reserved' and expires_at>now();
 if not found then raise exception 'coach_operation_unavailable';end if;
 g:=coach_private.require_context(p_user);
 if g is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id and user_id=p_user and row_version=o.intake_version and state='submitted';
 if not found or i.revision<>(select max(revision) from public.training_intakes where user_id=p_user) then raise exception 'coach_intake_changed';end if;
 return jsonb_build_object('training',i.training,'health',(select declarations from public.intake_health where intake_id=i.id and user_id=p_user));
end $$;
create function public.coach_backend_finish(p_user uuid,p_operation uuid,p_proposal jsonb,p_error text default null)
returns public.coach_operations language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare o public.coach_operations;ctx jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'coach_backend_required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended('coach:'||p_user::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=p_user for update;
 if not found then raise exception 'coach_operation_unavailable';end if;
 if o.state<>'reserved' then return o;end if;
 ctx:=public.coach_backend_context(p_user,p_operation);
 if p_error is not null then
  if p_error not in ('technical_error','safety_review_required') then raise exception 'coach_invalid_error';end if;
  update public.coach_operations set state='failed',error_code=p_error,updated_at=now(),completed_at=now()
   where id=o.id returning * into o;return o;
 end if;
 perform coach_private.validate_proposal(p_proposal);
 if jsonb_array_length(p_proposal->'days')<>(ctx->'training'->>'days')::int then raise exception 'coach_days_mismatch';end if;
 update public.coach_operations set state='ready',proposal=p_proposal,completed_at=now(),updated_at=now(),
  model_provider='mock',model_name='deterministic-v1',prompt_version=null,output_schema_version=1
 where id=o.id returning * into o;
 return o;
end $$;

create function public.accept_basic_plan(p_operation uuid) returns uuid language plpgsql security definer
set search_path=pg_catalog,public,coach_private as $$
declare u uuid:=coach_private.actor();o public.coach_operations;i public.training_intakes;g uuid[];
 rid uuid;did uuid;eid uuid;rev uuid:=gen_random_uuid();d jsonb;e jsonb;dn int:=0;en int;
 snap jsonb;sdays jsonb:='[]';sex jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended('coach:'||u::text,0));
 select * into o from public.coach_operations where id=p_operation and user_id=u for update;
 if not found then raise exception 'coach_not_authorized' using errcode='42501';end if;
 if o.state='accepted' then return o.routine_id;end if;
 if not coach_private.allowed(u) then raise exception 'coach_pilot_required';end if;
 if o.state<>'ready' then raise exception 'coach_proposal_not_ready';end if;
 g:=coach_private.require_context(u);
 if g is distinct from o.grant_ids then raise exception 'coach_context_changed';end if;
 select * into i from public.training_intakes where id=o.intake_id and user_id=u and state='submitted' and row_version=o.intake_version;
 if not found or i.revision<>(select max(revision) from public.training_intakes where user_id=u) then raise exception 'coach_intake_changed';end if;
 perform coach_private.validate_proposal(o.proposal);
 perform pg_advisory_xact_lock(hashtextextended(u::text,0));
 insert into public.routines(owner_id,name,description,routine_order)
 values(u,o.proposal->>'name',o.proposal->>'description',
 coalesce((select max(routine_order)+1 from public.routines where owner_id=u),0)) returning id into rid;
 for d in select value from jsonb_array_elements(o.proposal->'days') loop
  insert into public.routine_days(routine_id,name,day_order) values(rid,d->>'name',dn) returning id into did;
  en:=0;sex:='[]';
  for e in select value from jsonb_array_elements(d->'exercises') loop
   insert into public.routine_exercises(day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)
   values(did,e->>'name',(e->>'sets')::int,(e->>'reps_min')||'-'||(e->>'reps_max'),e->>'rir',(e->>'rest_seconds')::int,en,null)
   returning id into eid;
   sex:=sex||jsonb_build_array(e||jsonb_build_object('id',eid,'day_id',did,'exercise_order',en));en:=en+1;
  end loop;
  sdays:=sdays||jsonb_build_array(jsonb_build_object('id',did,'routine_id',rid,'name',d->>'name','day_order',dn,'exercises',sex));dn:=dn+1;
 end loop;
 snap:=jsonb_build_object('id',rid,'owner_id',u,'name',o.proposal->>'name','description',o.proposal->>'description','days',sdays);
 insert into public.routine_revisions(id,routine_id,user_id,operation_id,snapshot,snapshot_hash,accepted_by)
 values(rev,rid,u,o.id,snap,md5(snap::text),u);
 insert into public.routine_management(routine_id,user_id,operation_id,current_revision_id) values(rid,u,o.id,rev);
 update public.coach_operations set state='accepted',routine_id=rid,accepted_at=now(),updated_at=now() where id=o.id;
 return rid;
end $$;

-- Prevent old SDK/RPC paths from mutating either side of a managed structure.
create function coach_private.guard_structure() returns trigger language plpgsql security definer
set search_path=pg_catalog,public as $$
declare old_r uuid;new_r uuid;
begin
 -- Explicit administrative maintenance only; end-user RPCs retain auth.uid.
 if auth.uid() is null and current_setting('role',true) in ('none','postgres','service_role') then
  if tg_op='DELETE' then return old;else return new;end if;
 end if;
 if tg_table_name='routines' then
  if tg_op<>'INSERT' then old_r:=old.id;end if;
  if tg_op<>'DELETE' then new_r:=new.id;end if;
  if tg_op='UPDATE' and old.id=new.id and
   (to_jsonb(old)-array['routine_order','deleted_at','updated_at'])=(to_jsonb(new)-array['routine_order','deleted_at','updated_at'])
   then return new;end if;
 elsif tg_table_name='routine_days' then
  if tg_op<>'INSERT' then old_r:=old.routine_id;end if;
  if tg_op<>'DELETE' then new_r:=new.routine_id;end if;
 else
  if tg_op<>'INSERT' then select routine_id into old_r from public.routine_days where id=old.day_id;end if;
  if tg_op<>'DELETE' then select routine_id into new_r from public.routine_days where id=new.day_id;end if;
 end if;
 if exists(select 1 from public.routine_management where routine_id in (old_r,new_r))
 then raise exception 'coach_structure_locked' using errcode='42501';end if;
 if tg_op='DELETE' then return old;else return new;end if;
end $$;
create trigger coach_guard_routines before insert or update or delete on public.routines for each row execute function coach_private.guard_structure();
create trigger coach_guard_days before insert or update or delete on public.routine_days for each row execute function coach_private.guard_structure();
create trigger coach_guard_exercises before insert or update or delete on public.routine_exercises for each row execute function coach_private.guard_structure();

revoke all on all functions in schema coach_private from public,anon,authenticated,service_role;
do $$
declare f record;
begin
 for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('get_my_coach_access','save_my_training_intake','set_my_coach_context_permission','reserve_basic_generation','accept_basic_plan','coach_backend_context','coach_backend_finish')
 loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  if f.sig::text like 'coach_backend_%' then
   execute format('grant execute on function %s to service_role',f.sig);
  else
   execute format('grant execute on function %s to authenticated',f.sig);
  end if;
 end loop;
end $$;
