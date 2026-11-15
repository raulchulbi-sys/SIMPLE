CREATE OR REPLACE FUNCTION public.billing_test_change(p_user uuid, p_lease uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
declare c billing_test.customers; s jsonb; i jsonb; old_i billing_test.invoices; old_s billing_test.subscriptions;
  k jsonb; j billing_test.checkouts; completed jsonb:='[]'::jsonb; seen uuid[]:='{}'::uuid[];
begin
  select * into c from billing_test.customers where user_id=p_user for update;
  if not found or p_lease is null or c.lease is distinct from p_lease
    or c.lease_until is null or c.lease_until<=clock_timestamp() then raise exception 'billing_stale_lease'; end if;
  if p_action='customer' then
    if c.customer_id is not null and c.customer_id<>p_data->>'customer_id' then raise exception 'billing_identity_conflict'; end if;
    update billing_test.customers set customer_id=p_data->>'customer_id' where user_id=p_user;
  elsif p_action='checkout' then
    -- A session status alone is insufficient proof of payment.
    if coalesce(p_data->>'status','') not in ('open','expired') then raise exception 'billing_checkout_requires_snapshot'; end if;
    update billing_test.checkouts set session_id=p_data->>'session_id',status=p_data->>'status'
      where id=(p_data->>'id')::uuid and user_id=p_user
      and (session_id is null or session_id=p_data->>'session_id')
      and (status in ('reserved','open') or status=p_data->>'status');
    if not found then raise exception 'billing_checkout_conflict'; end if;
  elsif p_action='snapshot' then
    if c.customer_id is null or c.customer_id is distinct from p_data->>'customer_id'
      or jsonb_typeof(p_data->'subscriptions') is distinct from 'array'
      or jsonb_typeof(p_data->'invoices') is distinct from 'array'
      or (p_data ? 'checkouts' and jsonb_typeof(p_data->'checkouts') is distinct from 'array')
      then raise exception 'billing_snapshot_invalid'; end if;
    if exists(select 1 from billing_test.subscriptions b where b.user_id=p_user and not exists(
      select 1 from jsonb_array_elements(p_data->'subscriptions') x where x->>'subscription_id'=b.subscription_id))
      then raise exception 'billing_snapshot_missing_history'; end if;
    for s in select * from jsonb_array_elements(p_data->'subscriptions') loop
      select * into old_s from billing_test.subscriptions where subscription_id=s->>'subscription_id';
      if found and (old_s.user_id<>p_user or old_s.plan<>s->>'plan'
        or (old_s.status='canceled' and s->>'status'<>'canceled')) then raise exception 'billing_subscription_conflict'; end if;
      insert into billing_test.subscriptions(subscription_id,user_id,plan,status,cancel_at_period_end)
        values(s->>'subscription_id',p_user,s->>'plan',s->>'status',(s->>'cancel_at_period_end')::boolean)
      on conflict(subscription_id) do update set status=excluded.status,cancel_at_period_end=excluded.cancel_at_period_end,verified_at=now()
        where billing_test.subscriptions.user_id=excluded.user_id and billing_test.subscriptions.plan=excluded.plan
          and (billing_test.subscriptions.status<>'canceled' or excluded.status='canceled');
      if not found then raise exception 'billing_subscription_conflict'; end if;
    end loop;
    for i in select * from jsonb_array_elements(p_data->'invoices') loop
      if not exists(select 1 from billing_test.subscriptions where subscription_id=i->>'subscription_id' and user_id=p_user and plan=i->>'plan')
        then raise exception 'billing_invoice_binding'; end if;
      select * into old_i from billing_test.invoices where invoice_id=i->>'invoice_id';
      if found and ((to_jsonb(old_i)-'user_id'-'refunded'-'disputed')<>(i-'refunded'-'disputed') or old_i.user_id<>p_user
        or old_i.refunded>(i->>'refunded')::int) then raise exception 'billing_invoice_conflict'; end if;
      insert into billing_test.invoices as persisted select r.* from jsonb_populate_record(null::billing_test.invoices,i||jsonb_build_object('user_id',p_user)) r
      on conflict(invoice_id) do update set refunded=excluded.refunded,disputed=excluded.disputed
        where persisted.user_id=excluded.user_id
          and (to_jsonb(persisted)-'refunded'-'disputed')=(to_jsonb(excluded)-'refunded'-'disputed')
          and persisted.refunded<=excluded.refunded;
      if not found then raise exception 'billing_invoice_conflict'; end if;
    end loop;
    -- Same transaction: invoice evidence, Checkout finalization and event receipt.
    -- Missing field is temporarily compatible with the old runtime during rollout.
    for k in select * from jsonb_array_elements(coalesce(p_data->'checkouts','[]'::jsonb)) loop
      if k->>'status' is distinct from 'complete' or k->>'payment_status' is distinct from 'paid'
        or k->>'customer_id' is distinct from c.customer_id
        or coalesce(k->>'id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        or coalesce(k->>'session_id','') !~ '^cs_test_[A-Za-z0-9]+$'
        then raise exception 'billing_checkout_proof_invalid'; end if;
      if (k->>'id')::uuid=any(seen) then raise exception 'billing_checkout_duplicate'; end if;
      seen:=array_append(seen,(k->>'id')::uuid);
      select * into j from billing_test.checkouts where id=(k->>'id')::uuid and user_id=p_user for update;
      if not found or j.plan is distinct from k->>'plan'
        or j.status not in ('reserved','open','complete')
        or (j.session_id is not null and j.session_id is distinct from k->>'session_id')
        or (j.session_id is null and j.status<>'reserved')
        then raise exception 'billing_checkout_conflict'; end if;
      -- Both objects must occur in THIS verified snapshot, not merely in old rows.
      if not exists(select 1 from jsonb_array_elements(p_data->'subscriptions') x
          where x->>'subscription_id'=k->>'subscription_id' and x->>'plan'=j.plan)
        or not exists(select 1 from jsonb_array_elements(p_data->'invoices') x
          where x->>'invoice_id'=k->>'invoice_id' and x->>'subscription_id'=k->>'subscription_id' and x->>'plan'=j.plan)
        or not exists(select 1 from billing_test.subscriptions b join billing_test.invoices v
          on v.subscription_id=b.subscription_id and v.user_id=b.user_id
          where b.user_id=p_user and b.subscription_id=k->>'subscription_id' and b.plan=j.plan
            and v.invoice_id=k->>'invoice_id' and v.plan=j.plan
            and v.amount=case j.plan when 'basic' then 499 else 1299 end)
        then raise exception 'billing_checkout_paid_invoice_required'; end if;
      if j.status<>'complete' then
        -- Also recovers a lost initial session-binding response, without creating anything.
        update billing_test.checkouts set status='complete',session_id=k->>'session_id'
          where id=j.id and user_id=p_user and status=j.status and session_id is not distinct from j.session_id;
        if not found then raise exception 'billing_checkout_conflict'; end if;
      end if;
      completed:=completed||jsonb_build_array(k->>'session_id');
    end loop;
    update billing_test.customers set hold=false where user_id=p_user;
    if p_data->>'event_id' is not null then
      update billing_test.events set processed_at=coalesce(processed_at,now()) where event_id=p_data->>'event_id' and customer_id=c.customer_id;
      if not found then raise exception 'billing_event_binding'; end if;
    end if;
  elsif p_action='hold' then update billing_test.customers set hold=true where user_id=p_user;
  elsif p_action<>'release' then raise exception 'billing_action_invalid'; end if;
  if p_action in ('snapshot','hold','release') then
    update billing_test.customers set lease=null,lease_until=null where user_id=p_user;
  end if;
  return jsonb_build_object('ok',true,'checkout_protocol',1,'completed_checkouts',completed);
end $function$
