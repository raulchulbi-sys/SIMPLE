-- STAGING ONLY, isolated schemas. Temporary authenticated transport; no provider.
begin;
create table finance_compat_private.qa_window(expires_at timestamptz not null);
insert into finance_compat_private.qa_window values(clock_timestamp()+interval '2 hours');
revoke all on finance_compat_private.qa_window from public,anon,authenticated,service_role;
create function finance_compat_private.qa(u uuid,i uuid,k text,a text) returns jsonb language plpgsql security definer set search_path=pg_catalog,finance_compat_public as $qa$
declare amount numeric;started timestamptz:=clock_timestamp();r record;err text;
begin
 if u not in ('c7bbe50b-d349-4f7e-8fdc-476f17c22674','c14a2a6d-9853-431d-856c-4d742002187e') or k not in ('analysis','chat') or a not in ('claim','finish','unknown') then raise exception 'qa_not_authorized';end if;
 perform pg_sleep(.4);
 perform 1 from finance_compat_private.premium_analysis_budget where id for update;
 perform set_config('finance.test_run','b8356a2d-df56-4a60-afae-d2c6803cfa02',true);
 if a='claim' then
  if exists(select 1 from finance_compat_private.premium_financial_items where kind=k and item_id=i and user_id=u) then return jsonb_build_object('claimed',false,'duplicate',true,'txid',txid_current(),'start',started,'finish',clock_timestamp());end if;
  begin perform finance_compat_private.premium_check_dispatch(u,k,1000,case when k='analysis' then 1800 else 1000 end);exception when others then err:=sqlerrm;end;
  if err is not null then return jsonb_build_object('claimed',false,'error',err,'txid',txid_current(),'start',started,'finish',clock_timestamp());end if;
  amount:=case when k='analysis' then .0295 else .0175 end;
  insert into finance_compat_public.routines(id,owner_id,name) values(i,u,'SYNTHETIC COMPAT concurrency');
  insert into finance_compat_public.routine_revisions(id,routine_id,user_id,snapshot,snapshot_hash,accepted_by,origin) values(i,i,u,'{}','synthetic-only',u,'premium_baseline');
  insert into finance_compat_public.routine_management(routine_id,user_id,current_revision_id,plan_kind) values(i,u,i,'premium');
  insert into finance_compat_public.coach_mesocycles(id,user_id,routine_id,number,start_date,planned_weeks,objective,initial_revision_id,current_revision_id,access_until) values(i,u,i,(select coalesce(max(number),0)+1 from finance_compat_public.coach_mesocycles where user_id=u),current_date,6,'SYNTHETIC COMPAT',i,i,now()+interval '1 day');
  if k='analysis' then
   insert into finance_compat_public.coach_recommendations(id,mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,analysis_week,provider_state,reserved_usd,analysis_trace) values(i,i,i,u,i,'REVIEW','analyzing','[]','[]','SYNTHETIC','{}',1,'dispatched',amount,'{}');
   update finance_compat_private.premium_analysis_budget set dispatched=dispatched+1,reserved_usd=reserved_usd+amount where id;
   update finance_compat_private.premium_entitlements set analysis_consumed=analysis_consumed+1 where user_id=u;
  else
   insert into finance_compat_public.coach_messages(id,conversation_id,user_id,routine_id,mesocycle_id,idempotency_key,sequence_no,user_message,message_digest,state,revision_id,revision_no,week,context_bundle,reserved_usd,provider_mode,input_bound,output_bound,expires_at) values(i,i,u,i,i,i,1,'SYNTHETIC COMPAT','synthetic','dispatched',i,1,1,'{}',amount,'openai',1000,1000,now()+interval '1 day');
   update finance_compat_private.premium_analysis_budget set chat_dispatched=chat_dispatched+1,chat_reserved_usd=chat_reserved_usd+amount where id;
   update finance_compat_private.premium_entitlements set chat_consumed=chat_consumed+1 where user_id=u;
  end if;
  perform finance_compat_private.premium_finance_capture(k,i,u,1000,case when k='analysis' then 1800 else 1000 end);
  perform pg_sleep(.8);
  return jsonb_build_object('claimed',true,'reserved',amount,'txid',txid_current(),'start',started,'finish',clock_timestamp());
 end if;
 select * into r from finance_compat_private.premium_financial_items where kind=k and item_id=i and user_id=u;
 if not found then raise exception 'qa_item_missing';end if;
 amount:=finance_compat_private.premium_finance_settle(k,i,u,r.reserved_usd,case when a='unknown' then '{"transport":"synthetic_unknown"}'::jsonb else jsonb_build_object('source','openai_response','response_id','resp_compat_'||replace(i::text,'-',''),'model','gpt-5.4-2026-03-05','service_tier','default','dispatch_id',i,'status',200,'input_tokens',500,'output_tokens',200,'cached_input_tokens',0) end,false);
 return jsonb_build_object('charged',amount,'txid',txid_current(),'start',started,'finish',clock_timestamp());
end $qa$;
revoke all on function finance_compat_private.qa(uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function public.premium_finance_compat_qa(p_id uuid,p_kind text,p_action text) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $api$
declare u uuid:=auth.uid();
begin
 if u is null or u not in ('c7bbe50b-d349-4f7e-8fdc-476f17c22674','c14a2a6d-9853-431d-856c-4d742002187e') or not exists(select 1 from finance_compat_private.qa_window where expires_at>clock_timestamp()) then raise exception 'qa_not_authorized' using errcode='42501';end if;
 return finance_compat_private.qa(u,p_id,p_kind,p_action);
end $api$;
revoke all on function public.premium_finance_compat_qa(uuid,text,text) from public,anon,service_role;
grant execute on function public.premium_finance_compat_qa(uuid,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
