-- Additive staging-only projection. No customer/lease/resource is created by a read.
begin;
create or replace function public.billing_test_read_customer(p_user uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$
 select jsonb_build_object('customer_id',c.customer_id,'hold',c.hold,
   'checkout',(select jsonb_build_object('status',j.status,'expires_at',j.expires_at)
     from billing_test.checkouts j where j.user_id=c.user_id order by j.created_at desc,j.id desc limit 1))
 from billing_test.customers c where c.user_id=p_user
$$;
revoke all on function public.billing_test_read_customer(uuid) from public,anon,authenticated;
grant execute on function public.billing_test_read_customer(uuid) to service_role;
commit;
