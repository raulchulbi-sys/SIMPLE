-- STAGING ONLY. Fixture owner must be an existing synthetic client. All writes roll back.
begin;
create temp table finance_checks(name text primary key,passed boolean) on commit drop;
do $tests$
declare u uuid:=nullif(current_setting('finance.test_user',true),'')::uuid;rt uuid:=gen_random_uuid();rv uuid:=gen_random_uuid();m uuid:=gen_random_uuid();i uuid;r public.coach_recommendations;v public.coach_recommendations;raw jsonb;x jsonb;old_b jsonb;start_charge numeric;expect numeric;n int:=0;key uuid;denied boolean;
begin
 if current_setting('finance.controlled_test',true) is distinct from 'dmqjexigdnfzobarhnib' or u is null then raise exception 'staging_required';end if;
 perform set_config('finance.test_run',gen_random_uuid()::text,true);
 select to_jsonb(b),charged_usd into old_b,start_charge from coach_private.premium_analysis_budget b where id;
 insert into public.routines(id,owner_id,name) values(rt,u,'SYNTHETIC FINANCE rollback-only');
 insert into public.routine_revisions(id,routine_id,user_id,snapshot,snapshot_hash,accepted_by,origin) values(rv,rt,u,'{}','rollback-only',u,'premium_baseline');
 insert into public.routine_management(routine_id,user_id,current_revision_id,plan_kind) values(rt,u,rv,'premium');
 insert into public.coach_mesocycles(id,user_id,routine_id,number,start_date,planned_weeks,objective,initial_revision_id,current_revision_id,access_until) values(m,u,rt,987654,current_date,6,'financial tests',rv,rv,now()+interval '1 day');
 for raw,expect in select j->'receipt',nullif(j->>'expected','null')::numeric from jsonb_array_elements('[
 {"receipt":{"input_tokens":500,"output_tokens":200,"cached_input_tokens":0},"expected":0.00425},
 {"receipt":{"input_tokens":1000,"output_tokens":1800,"cached_input_tokens":0},"expected":0.0295},
 {"receipt":{"input_tokens":1000,"output_tokens":1800,"cached_input_tokens":1000},"expected":0.02725},
 {"receipt":{"input_tokens":1001,"output_tokens":0,"cached_input_tokens":0},"expected":null},
 {"receipt":{"input_tokens":500,"output_tokens":1801,"cached_input_tokens":0},"expected":null},
 {"receipt":{"input_tokens":500,"output_tokens":200,"cached_input_tokens":501},"expected":null},
 {"receipt":{"input_tokens":-1,"output_tokens":200,"cached_input_tokens":0},"expected":null},
 {"receipt":{"input_tokens":500,"output_tokens":200,"cached_input_tokens":"bad"},"expected":null},
 {"receipt":{"input_tokens":500,"output_tokens":"999999999999999999999999999","cached_input_tokens":0},"expected":null},
 {"receipt":{},"expected":null},
 {"receipt":{"input_tokens":"500","output_tokens":"200","cached_input_tokens":"0"},"expected":null}
 ]'::jsonb) j loop
 begin
  i:=gen_random_uuid();
  raw:=raw||jsonb_build_object('source','openai_response','response_id','resp_test_'||replace(i::text,'-',''),'model','gpt-5.4-2026-03-05','service_tier','default','dispatch_id',i,'status',200);
  insert into public.coach_recommendations(id,mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,analysis_week,provider_state,reserved_usd,analysis_trace)
   values(i,m,rt,u,rv,'REVIEW','analyzing','[]','[]','QA receipt','{}',1,'dispatched',.0295,'{"model":"gpt-5.4-2026-03-05","input_token_bound":1000}');
  update coach_private.premium_analysis_budget set reserved_usd=reserved_usd+.0295 where id;
  perform coach_private.premium_finance_capture('analysis',i,u,1000,1800);
  r:=public.premium_analysis_finish(u,i,null,'provider_network',raw,'[]');
  if (select verified_usd from coach_private.premium_financial_items where item_id=i) is distinct from expect then raise exception 'receipt_verification';end if;
  if (select charged_usd from coach_private.premium_analysis_budget where id)<>start_charge+coalesce(expect,0) then raise exception 'incorrect_charge';end if;
  if (select reserved_usd from coach_private.premium_analysis_budget where id)<>(old_b->>'reserved_usd')::numeric+(case when expect is null then .0295 else 0 end) then raise exception 'incorrect_exposure';end if;
  v:=public.premium_analysis_finish(u,i,null,null,'{}','[]');
  if to_jsonb(v) is distinct from to_jsonb(r) then raise exception 'finish_not_idempotent';end if;
  if expect is null then
   if not exists(select 1 from coach_private.premium_financial_items where item_id=i and incident_open and state='unverified' and receipt=raw) then raise exception 'incident_missing';end if;
   denied:=false;begin perform public.premium_finance_resume('analysis',i,'operator','authorized-test','Cannot resume unresolved',gen_random_uuid());exception when others then denied:=sqlerrm='premium_finance_unresolved';end;
   if not denied then raise exception 'unresolved_resumed';end if;
   key:=gen_random_uuid();
   x:=public.premium_finance_reconcile('analysis',i,.04,'{"type":"controlled_test","reference":"synthetic-statement:no-provider-call"}','operator','authorized-staging-test','Controlled verified excess',key);
   perform public.premium_finance_reconcile('analysis',i,.04,'{"type":"controlled_test","reference":"synthetic-statement:no-provider-call"}','operator','authorized-staging-test','Controlled verified excess',key);
   if (select charged_usd from coach_private.premium_analysis_budget where id)<>start_charge+.04 or (x->>'excess_usd')::numeric<>.0105 then raise exception 'excess_hidden_or_double_charge';end if;
   if not exists(select 1 from coach_private.premium_financial_items where item_id=i and incident_open and receipt=raw) then raise exception 'reconcile_erased_original_or_reopened';end if;
   perform public.premium_finance_resume('analysis',i,'operator','resume-authorized-test','Resolved with controlled evidence',gen_random_uuid());
   if exists(select 1 from coach_private.premium_financial_items where item_id=i and incident_open) then raise exception 'resume_failed';end if;
  end if;
  raise exception using errcode='PZ002',message='rollback_case';
 exception when sqlstate 'PZ002' then n:=n+1;end;
 end loop;
 insert into finance_checks values('11 receipts / finish idempotence / exposure / excess reconciliation',n=11);
 if (select to_jsonb(b) from coach_private.premium_analysis_budget b where id) is distinct from old_b then raise exception 'budget_changed';end if;
 insert into finance_checks values('budget exact after rollback-only cases',true);
end $tests$;
select * from finance_checks;
rollback;
