-- Roll back the commercial Edge version first; urgent reconciliation remains installed.
begin;
drop function if exists public.billing_test_read_customer(uuid);
commit;
