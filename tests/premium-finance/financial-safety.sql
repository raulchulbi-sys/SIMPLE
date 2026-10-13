-- Rollback-only staging tests. No provider, Auth or persistent fixture writes.
begin;
create temp table finance_safety(name text primary key,passed boolean) on commit drop;
do $$
declare u uuid:=nullif(current_setting('finance.test_user',true),'')::uuid;i uuid:=gen_random_uuid();tr uuid:=gen_random_uuid();k uuid:=gen_random_uuid();denied boolean;v jsonb;b jsonb;
begin
 if current_setting('finance.controlled_test',true) is distinct from 'dmqjexigdnfzobarhnib' or u is null then raise exception 'staging_required';end if;
 if u <> 'c7bbe50b-d349-4f7e-8fdc-476f17c22674' then raise exception 'synthetic_owner_required';end if;
 -- Establish only the synthetic owner's prerequisites inside this rollback-only transaction.
 update coach_private.premium_entitlements set enabled=true,expires_at=clock_timestamp()+interval '1 day',capabilities=array['tracking','analysis','chat'],analysis_consumed=0,chat_consumed=0 where user_id=u;
 if not found then raise exception 'synthetic_entitlement_missing';end if;
 select to_jsonb(x) into b from coach_private.premium_analysis_budget x where id;
 update coach_private.premium_analysis_budget set premium_enabled=true where id;
 insert into coach_private.premium_financial_items(kind,item_id,user_id,contract,reserved_usd,deadline,test_run) values('chat',i,u,'{}',.0175,clock_timestamp()-interval '1 second',tr);
 update coach_private.premium_analysis_budget set chat_reserved_usd=chat_reserved_usd+.0175 where id;
 perform coach_private.premium_finance_expire();
 if not exists(select 1 from coach_private.premium_financial_items where item_id=i and state='unverified' and incident_open and verified_usd is null) or (select chat_charged_usd from coach_private.premium_analysis_budget where id)<>(b->>'chat_charged_usd')::numeric then raise exception 'expiry_bad';end if;
 insert into finance_safety values('expired dispatch retains liability without fake charge',true);
 denied:=false;begin perform coach_private.premium_check_dispatch(u,'chat',1000,1000);exception when others then denied:=sqlerrm='premium_financial_blocked';end;
 if not denied then raise exception 'expiry_gate_failed';end if;
 insert into finance_safety values('expired liability blocks new spending',true);
 denied:=false;begin update coach_private.premium_financial_events set event='tampered' where item_id=i;exception when others then denied:=sqlerrm='premium_finance_audit_immutable';end;
 if not denied then raise exception 'audit_not_immutable';end if;
 insert into finance_safety values('audit cannot be rewritten',true);
 denied:=false;begin perform public.premium_finance_reconcile('chat',i,.04,'{"type":"provider_statement","reference":"missing evidence"}','operator','authorized-staging','Invalid evidence validation',gen_random_uuid());exception when others then denied:=sqlerrm='premium_finance_evidence_required';end;
 if not denied then raise exception 'evidence_not_bound';end if;
 insert into finance_safety values('external evidence requires currency, dispatch binding and SHA256',true);
 v:=public.premium_finance_reconcile('chat',i,.04,'{"type":"controlled_test","reference":"no-provider-call"}','operator','authorized-staging','Synthetic excess reconciliation',k);
 denied:=false;begin perform public.premium_finance_reconcile('chat',i,.05,'{"type":"controlled_test","reference":"no-provider-call"}','operator','authorized-staging','Synthetic excess reconciliation',k);exception when others then denied:=sqlerrm='premium_finance_idempotency_conflict';end;
 if not denied then raise exception 'key_conflict_not_rejected';end if;
 insert into finance_safety values('same reconciliation key with different amount rejected',true);
 perform public.premium_finance_resume('chat',i,'operator','authorized-resume','Explicit synthetic resume',gen_random_uuid());
 update coach_private.premium_analysis_budget set premium_enabled=false where id;
 denied:=false;begin perform coach_private.premium_check_dispatch(u,'chat',1000,1000);exception when others then denied:=sqlerrm in ('premium_shared_budget_exhausted','premium_owner_allowance_exhausted');end;
 if not denied then raise exception 'resume_bypassed_kill_switch';end if;
 insert into finance_safety values('resume cannot bypass global kill switch',true);
 if coach_private.premium_finance_settle('chat',i,u,.0175,'{"input_tokens":1}',false)<>.04 or (select receipt->>'transport' from coach_private.premium_financial_items where item_id=i)<>'expired_no_automatic_retry' then raise exception 'late_finish_rewrote_ledger';end if;
 insert into finance_safety values('late finish cannot erase expiry or reconciliation',true);
 denied:=false;begin delete from coach_private.premium_financial_events where item_id=i;exception when others then denied:=sqlerrm='premium_finance_audit_immutable';end;
 if not denied then raise exception 'audit_deleted';end if;
 insert into finance_safety values('audit cannot be deleted',true);
end$$;
select * from finance_safety;
rollback;
