-- PREPARED ONLY. Not executed. Target must be verified through the project-scoped connector.
-- The operator must supply SET LOCAL simple.approved_project inside this transaction
-- after separate explicit staging authorization. This attestation is not project discovery.
BEGIN;
SET LOCAL lock_timeout='5s';
DO $guard$
BEGIN
  IF current_setting('simple.approved_project',true) IS DISTINCT FROM 'dmqjexigdnfzobarhnib' THEN
    RAISE EXCEPTION 'billing_staging_authorization_required';
  END IF;
  IF md5(pg_get_functiondef('public.billing_test_change(uuid,uuid,text,jsonb)'::regprocedure)) <> '725010c6affa7bd961af76090115e296' THEN
    RAISE EXCEPTION 'billing_definition_drift';
  END IF;
  IF (SELECT prosecdef FROM pg_proc WHERE oid='public.billing_test_change(uuid,uuid,text,jsonb)'::regprocedure)
    OR has_function_privilege('anon','public.billing_test_change(uuid,uuid,text,jsonb)','execute')
    OR has_function_privilege('authenticated','public.billing_test_change(uuid,uuid,text,jsonb)','execute')
    OR NOT has_function_privilege('service_role','public.billing_test_change(uuid,uuid,text,jsonb)','execute') THEN
    RAISE EXCEPTION 'billing_privilege_drift';
  END IF;
END $guard$;
CREATE OR REPLACE FUNCTION public.billing_test_change(p_user uuid, p_lease uuid, p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
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
end $function$;
COMMIT;
