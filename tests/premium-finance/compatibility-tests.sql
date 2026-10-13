begin;set local search_path=finance_compat_public,public;
create temp table compat_checks(name text primary key,passed boolean);
do $faults$
declare q text:=$preflight_input$__PREFLIGHT__$preflight_input$;c jsonb;observed text;n int:=0;
begin
 for c in select value from jsonb_array_elements($cases$[
 {"name":"missing table","sql":"alter table finance_compat_public.coach_messages rename to missing_messages","error":"premium_finance_dependency_missing_table"},
 {"name":"missing column","sql":"alter table finance_compat_private.premium_analysis_budget rename column chat_config to missing_chat_config","error":"premium_finance_dependency_missing_column"},
 {"name":"wrong type","sql":"alter table finance_compat_private.premium_analysis_budget alter column max_calls type bigint","error":"premium_finance_dependency_missing_column"},
 {"name":"wrong default","sql":"alter table finance_compat_private.premium_analysis_budget alter column max_usd set default 999","error":"premium_finance_dependency_missing_column"},
 {"name":"missing constraint","sql":"alter table finance_compat_private.premium_analysis_budget drop constraint premium_analysis_budget_chat_max_usd_check","error":"premium_finance_dependency_constraint"},
 {"name":"missing function/order","sql":"alter function finance_compat_private.premium_backend() rename to missing_backend","error":"premium_finance_dependency_missing_function"},
 {"name":"unknown backend version","sql":"create or replace function finance_compat_private.premium_backend() returns void language plpgsql set search_path=pg_catalog as 'begin null;end'","error":"premium_finance_dependency_function_version_or_permissions"},
 {"name":"widened function grants","sql":"grant execute on function finance_compat_public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb) to authenticated","error":"premium_finance_dependency_function_version_or_permissions"},
 {"name":"invalid optional control","sql":"alter table finance_compat_private.premium_analysis_budget add column premium_enabled text not null default 'false'","error":"premium_finance_optional_control_invalid"}
 ]$cases$::jsonb) loop
 begin
  execute c->>'sql';observed:=null;begin execute q;exception when others then observed:=sqlerrm;end;
  if observed is null or position(c->>'error' in observed)<>1 then raise exception 'preflight_did_not_stop: % / %',c->>'name',observed;end if;
  raise exception using errcode='PZ003',message='rollback_fault';
 exception when sqlstate 'PZ003' then insert into compat_checks values(c->>'name',true);n:=n+1;end;
 end loop;
 if n<>9 then raise exception 'missing_fault_test';end if;
 execute q;
 insert into compat_checks values('preflight restored after each rejected drift',true);
end $faults$;
do $switches$
declare denied boolean;u uuid:='c7bbe50b-d349-4f7e-8fdc-476f17c22674';
begin
 update finance_compat_private.premium_analysis_budget set shared_enabled=true,shared_max_calls=16,shared_max_usd=1 where id;
 perform finance_compat_private.premium_check_dispatch(u,'analysis',1000,1800);
 insert into compat_checks values('no optional column: existing explicit entitlement/shared checks permit',true);
 update finance_compat_private.premium_analysis_budget set shared_enabled=false where id;
 denied:=false;begin perform finance_compat_private.premium_check_dispatch(u,'analysis',1000,1800);exception when others then denied:=sqlerrm='premium_shared_budget_exhausted';end;
 if not denied then raise exception 'shared_switch_bypassed';end if;
 insert into compat_checks values('existing shared OFF still blocks',true);
 update finance_compat_private.premium_analysis_budget set shared_enabled=true where id;
 alter table finance_compat_private.premium_analysis_budget add column premium_enabled boolean not null default false;
 denied:=false;begin perform finance_compat_private.premium_check_dispatch(u,'analysis',1000,1800);exception when others then denied:=sqlerrm='premium_shared_budget_exhausted';end;
 if not denied then raise exception 'optional_off_bypassed';end if;
 insert into compat_checks values('optional OFF still blocks',true);
 update finance_compat_private.premium_analysis_budget set premium_enabled=true where id;
 perform finance_compat_private.premium_check_dispatch(u,'analysis',1000,1800);
 insert into compat_checks values('optional ON does not replace entitlement/shared gates',true);
 update finance_compat_private.premium_entitlements set enabled=false where user_id=u;
 denied:=false;begin perform finance_compat_private.premium_check_dispatch(u,'analysis',1000,1800);exception when others then denied:=sqlerrm='premium_owner_allowance_exhausted';end;
 if not denied then raise exception 'owner_bypassed';end if;
 insert into compat_checks values('optional ON cannot grant a disabled owner',true);
end $switches$;
select * from compat_checks order by name;
rollback;
