-- Reviewed installer for SIMPLE Security Test ONLY. Not part of production migrations.
-- Apply once, transactionally; never run against another project.
begin;
create schema billing_test;
revoke all on schema billing_test from public,anon,authenticated;
grant usage on schema billing_test to service_role,authenticated;
create table billing_test.customers (
  user_id uuid primary key references auth.users(id), customer_id text unique,
  customer_key uuid not null default gen_random_uuid(), created_at timestamptz not null default now(),
  lease uuid, lease_until timestamptz, hold boolean not null default false,
  check(customer_id is null or customer_id ~ '^cus_[A-Za-z0-9]+$')
);
create table billing_test.checkouts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references billing_test.customers(user_id),
  plan text not null check(plan in ('basic','premium')), created_at timestamptz not null default now(),
  expires_at bigint not null default (extract(epoch from now())::bigint+3600),
  session_id text unique, status text not null default 'reserved' check(status in ('reserved','open','complete','expired')),
  check(session_id is null or session_id ~ '^cs_test_[A-Za-z0-9]+$')
);
create unique index billing_test_one_open_checkout on billing_test.checkouts(user_id) where status in ('reserved','open');
create table billing_test.subscriptions (
  subscription_id text primary key check(subscription_id ~ '^sub_[A-Za-z0-9]+$'),
  user_id uuid not null references billing_test.customers(user_id), plan text not null check(plan in ('basic','premium')),
  status text not null check(status in ('active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused','trialing')),
  cancel_at_period_end boolean not null, verified_at timestamptz not null default now()
);
create table billing_test.invoices (
  invoice_id text primary key check(invoice_id ~ '^in_[A-Za-z0-9]+$'),
  user_id uuid not null references billing_test.customers(user_id),
  subscription_id text not null references billing_test.subscriptions(subscription_id),
  plan text not null check(plan in ('basic','premium')), amount integer not null,
  period_start bigint not null, period_end bigint not null, paid_at bigint not null,
  payment_intent text not null unique, charge_id text not null unique,
  refunded integer not null check(refunded>=0), disputed boolean not null,
  check(period_end>period_start and period_end-period_start between 2332800 and 2764800),
  check(amount=case plan when 'basic' then 499 else 1299 end and refunded<=amount)
);
create table billing_test.events (
  event_id text primary key check(event_id ~ '^evt_[A-Za-z0-9]+$'),
  digest text not null check(digest ~ '^[a-f0-9]{64}$'), event_type text not null,
  customer_id text not null, received_at timestamptz not null default now(), processed_at timestamptz
);
alter table billing_test.customers enable row level security;
alter table billing_test.checkouts enable row level security;
alter table billing_test.subscriptions enable row level security;
alter table billing_test.invoices enable row level security;
alter table billing_test.events enable row level security;
revoke all on all tables in schema billing_test from public,anon,authenticated;
grant all on all tables in schema billing_test to service_role;
-- Authenticated users can read only their paid-period projection. No write policy exists.
grant select on billing_test.customers,billing_test.subscriptions,billing_test.invoices to authenticated;
create policy own_customer on billing_test.customers for select to authenticated using (user_id=(select auth.uid()));
create policy own_subscription on billing_test.subscriptions for select to authenticated using (user_id=(select auth.uid()));
create policy own_invoice on billing_test.invoices for select to authenticated using (user_id=(select auth.uid()));

create function public.billing_test_my_access() returns jsonb language plpgsql stable security invoker set search_path=pg_catalog as $$
declare p billing_test.invoices; h boolean; active boolean:=false; ambiguous boolean:=false;
begin
  if auth.uid() is null then raise exception 'billing_auth_required' using errcode='42501'; end if;
  select hold into h from billing_test.customers where user_id=auth.uid();
  select * into p from billing_test.invoices where user_id=auth.uid() and period_start<=extract(epoch from now())
    order by period_start desc,paid_at desc,invoice_id limit 1;
  if found then
    select exists(select 1 from billing_test.invoices where user_id=auth.uid() and period_start=p.period_start
      and paid_at=p.paid_at and plan<>p.plan) into ambiguous;
    active:=not coalesce(h,false) and not ambiguous and p.period_end>extract(epoch from now()) and not p.disputed and p.refunded<p.amount;
  end if;
  return jsonb_build_object('environment','STRIPE_TEST','plan',case when active then p.plan end,
    'state',case when coalesce(h,false) or ambiguous then 'review_required' when active then 'active'
      when p.invoice_id is not null then 'expired_or_revoked' else 'inactive' end,
    'paidUntil',to_timestamp(p.period_end),'cancelAtPeriodEnd',coalesce((select cancel_at_period_end from billing_test.subscriptions
      where user_id=auth.uid() and subscription_id=p.subscription_id),false),'aiQuotaChanged',false);
end $$;
revoke all on function public.billing_test_my_access() from public,anon;
grant execute on function public.billing_test_my_access() to authenticated;

-- All mutation RPCs are invoker/service_role-only. The Edge is the authentication boundary.
create function public.billing_test_begin(p_user uuid, p_plan text default null) returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare c billing_test.customers; j billing_test.checkouts; token uuid:=gen_random_uuid();
begin
  if p_plan is not null and p_plan not in ('basic','premium') then raise exception 'billing_plan_required'; end if;
  if not exists(select 1 from public.profiles where id=p_user and role='client') then raise exception 'billing_client_required'; end if;
  insert into billing_test.customers(user_id) values(p_user) on conflict do nothing;
  select * into c from billing_test.customers where user_id=p_user for update;
  if c.lease_until>clock_timestamp() then raise exception 'billing_busy'; end if;
  update billing_test.customers set lease=token,lease_until=clock_timestamp()+interval '120 seconds' where user_id=p_user;
  if p_plan is not null then
    if c.hold then raise exception 'billing_review_required'; end if;
    if exists(select 1 from billing_test.subscriptions where user_id=p_user and status not in ('canceled','incomplete_expired'))
      or exists(select 1 from billing_test.invoices where user_id=p_user and period_end>extract(epoch from now())
        and not disputed and refunded<amount) then raise exception 'billing_existing_subscription'; end if;
    select * into j from billing_test.checkouts where user_id=p_user and status in ('reserved','open');
    if found and j.plan<>p_plan then raise exception 'billing_checkout_plan_conflict'; end if;
    if not found then insert into billing_test.checkouts(user_id,plan) values(p_user,p_plan) returning * into j; end if;
  end if;
  return jsonb_build_object('customer',to_jsonb(c),'checkout',case when p_plan is not null then to_jsonb(j) end,'lease',token);
end $$;
create function public.billing_test_change(p_user uuid,p_lease uuid,p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path=pg_catalog as $$
declare c billing_test.customers; s jsonb; i jsonb; old_i billing_test.invoices; old_s billing_test.subscriptions;
begin
  select * into c from billing_test.customers where user_id=p_user for update;
  if not found or c.lease is distinct from p_lease or c.lease_until<=clock_timestamp() then raise exception 'billing_stale_lease'; end if;
  if p_action='customer' then
    if c.customer_id is not null and c.customer_id<>p_data->>'customer_id' then raise exception 'billing_identity_conflict'; end if;
    update billing_test.customers set customer_id=p_data->>'customer_id' where user_id=p_user;
  elsif p_action='checkout' then
    update billing_test.checkouts set session_id=p_data->>'session_id',status=p_data->>'status'
      where id=(p_data->>'id')::uuid and user_id=p_user
      and (session_id is null or session_id=p_data->>'session_id')
      and (status in ('reserved','open') or status=p_data->>'status');
    if not found then raise exception 'billing_checkout_conflict'; end if;
  elsif p_action='snapshot' then
    if c.customer_id is distinct from p_data->>'customer_id' or jsonb_typeof(p_data->'subscriptions')<>'array'
      or jsonb_typeof(p_data->'invoices')<>'array' then raise exception 'billing_snapshot_invalid'; end if;
    if exists(select 1 from billing_test.subscriptions b where b.user_id=p_user and not exists(
      select 1 from jsonb_array_elements(p_data->'subscriptions') x where x->>'subscription_id'=b.subscription_id))
      then raise exception 'billing_snapshot_missing_history'; end if;
    for s in select * from jsonb_array_elements(p_data->'subscriptions') loop
      select * into old_s from billing_test.subscriptions where subscription_id=s->>'subscription_id';
      if found and (old_s.user_id<>p_user or old_s.plan<>s->>'plan'
        or (old_s.status='canceled' and s->>'status'<>'canceled')) then raise exception 'billing_subscription_conflict'; end if;
      insert into billing_test.subscriptions(subscription_id,user_id,plan,status,cancel_at_period_end)
        values(s->>'subscription_id',p_user,s->>'plan',s->>'status',(s->>'cancel_at_period_end')::boolean)
      on conflict(subscription_id) do update set status=excluded.status,cancel_at_period_end=excluded.cancel_at_period_end,verified_at=now();
    end loop;
    for i in select * from jsonb_array_elements(p_data->'invoices') loop
      if not exists(select 1 from billing_test.subscriptions where subscription_id=i->>'subscription_id' and user_id=p_user and plan=i->>'plan')
        then raise exception 'billing_invoice_binding'; end if;
      select * into old_i from billing_test.invoices where invoice_id=i->>'invoice_id';
      if found and ((to_jsonb(old_i)-'user_id'-'refunded'-'disputed')<>(i-'refunded'-'disputed') or old_i.user_id<>p_user
        or old_i.refunded>(i->>'refunded')::int) then raise exception 'billing_invoice_conflict'; end if;
      insert into billing_test.invoices select r.* from jsonb_populate_record(null::billing_test.invoices,i||jsonb_build_object('user_id',p_user)) r
      on conflict(invoice_id) do update set refunded=excluded.refunded,disputed=excluded.disputed;
    end loop;
    update billing_test.customers set hold=false where user_id=p_user;
    if p_data->>'event_id' is not null then
      update billing_test.events set processed_at=now() where event_id=p_data->>'event_id' and customer_id=c.customer_id;
      if not found then raise exception 'billing_event_binding'; end if;
    end if;
  elsif p_action='hold' then update billing_test.customers set hold=true where user_id=p_user;
  elsif p_action<>'release' then raise exception 'billing_action_invalid'; end if;
  if p_action in ('snapshot','hold','release') then
    update billing_test.customers set lease=null,lease_until=null where user_id=p_user;
  end if;
  return jsonb_build_object('ok',true);
end $$;
create function public.billing_test_event(p_id text,p_digest text,p_type text,p_customer text) returns jsonb
language plpgsql security invoker set search_path=pg_catalog as $$
declare e billing_test.events; u uuid;
begin
  select user_id into u from billing_test.customers where customer_id=p_customer;
  if not found then return jsonb_build_object('ignored',true); end if;
  insert into billing_test.events(event_id,digest,event_type,customer_id) values(p_id,p_digest,p_type,p_customer) on conflict do nothing;
  select * into e from billing_test.events where event_id=p_id;
  if e.digest<>p_digest or e.customer_id<>p_customer or e.event_type<>p_type then raise exception 'billing_event_conflict'; end if;
  return jsonb_build_object('user_id',u,'processed',e.processed_at is not null);
end $$;
revoke all on function public.billing_test_begin(uuid,text),public.billing_test_change(uuid,uuid,text,jsonb),public.billing_test_event(text,text,text,text) from public,anon,authenticated;
grant execute on function public.billing_test_begin(uuid,text),public.billing_test_change(uuid,uuid,text,jsonb),public.billing_test_event(text,text,text,text) to service_role;
commit;
