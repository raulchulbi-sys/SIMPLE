-- STAGING ONLY. Retire only namespaces and transport created by compatibility.cjs.
-- The operator must first verify project dmqjexigdnfzobarhnib / SIMPLE Security Test.
begin;
do $$begin
 if (select count(*) from public.profiles where id in ('c7bbe50b-d349-4f7e-8fdc-476f17c22674','c14a2a6d-9853-431d-856c-4d742002187e'))<>2 then raise exception 'staging_synthetic_identity_required';end if;
 if exists(select 1 from finance_compat_private.premium_financial_items where incident_open or state='dispatched') then raise exception 'unresolved_test_liability';end if;
 if exists(select 1 from finance_compat_private.premium_analysis_budget where reserved_usd<>0 or chat_reserved_usd<>0) then raise exception 'test_reservation_open';end if;
end$$;
drop function public.premium_finance_compat_qa(uuid,text,text);
drop schema finance_compat_private cascade;
drop schema finance_compat_public cascade;
notify pgrst,'reload schema';
commit;
