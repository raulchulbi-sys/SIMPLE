-- STAGING ONLY. Preserve Phase 1; never silently discard Premium data.
begin;
do $$ begin if exists(select 1 from public.coach_recommendations where analysis_key is not null) or exists(select 1 from public.coach_mesocycles where catalogue_bindings<>'{}'::jsonb or tracking_week<>1) then raise exception 'premium_phase2_rollback_requires_reviewed_cleanup';end if;end $$;
create or replace function public.premium_provider_context(p_mesocycle uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare h jsonb;t jsonb;e jsonb;out_ex jsonb:='[]';i int:=0;
begin
 h:=coach_private.premium_history(p_mesocycle,coach_private.actor());select intake into t from public.coach_mesocycles where id=p_mesocycle;
 if not exists(select 1 from public.coach_mesocycles where id=p_mesocycle and intake_submitted_at is not null) then raise exception 'premium_intake_required';end if;
 for e in select value from jsonb_array_elements(h->'exercises') loop
  i:=i+1;out_ex:=out_ex||jsonb_build_array(jsonb_build_object('ref','exercise_'||i,'metrics',e->'metrics','prescription',jsonb_build_object('sets',e#>'{prescription,sets}','rest_seconds',e#>'{prescription,rest_seconds}',
  'reps',case when e#>>'{prescription,reps}' ~ '^[0-9]{1,2}(-[0-9]{1,2})?$' then e#>'{prescription,reps}' else 'null'::jsonb end,
  'rir',case when e#>>'{prescription,rir}' ~ '^[0-5]$' then e#>'{prescription,rir}' else 'null'::jsonb end),
  'exposures',(select coalesce(jsonb_agg(jsonb_build_object('date',x->'date','sets',x->'sets')),'[]'::jsonb) from jsonb_array_elements(e->'exposures') x)));
 end loop;
 return jsonb_build_object('schema_version','premium-provider-v1','intake',jsonb_set(t,'{inventory,custom}','[]'::jsonb),
 'mesocycle',h->'mesocycle','weekly_summary',h->'weekly_summary','exercises',out_ex,'limits',h->'limits');
end $$;
create or replace function public.premium_accept_recommendation(p_id uuid) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare u uuid:=coach_private.actor();c public.coach_recommendations;m public.coach_mesocycles;g public.routine_management;p jsonb;s jsonb;v uuid;n int;
begin
 -- Lock management before recommendations to serialize concurrent changes.
 select * into c from public.coach_recommendations where id=p_id and user_id=u;
 if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select * into g from public.routine_management where routine_id=c.routine_id and user_id=u and plan_kind='premium' for update;
 select * into m from public.coach_mesocycles where id=c.mesocycle_id for update;
 select * into c from public.coach_recommendations where id=p_id for update;
 if c.state='accepted' then return c.result_revision_id;end if;
 if not coach_private.premium_access(m.id,u) or m.state<>'active' then raise exception 'premium_inactive';end if;
 if c.state<>'ready' then raise exception 'premium_not_ready';end if;
 if g.current_revision_id<>c.base_revision_id or m.current_revision_id<>c.base_revision_id then raise exception 'premium_stale_revision';end if;
 if not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and revoked_at is null) then raise exception 'premium_history_consent_required';end if;
 if c.kind='KEEP' then
  update public.coach_recommendations set state='accepted',accepted_at=now(),result_revision_id=g.current_revision_id where id=c.id;return g.current_revision_id;
 end if;
 if c.kind<>'MODIFY' then raise exception 'premium_manual_resolution_required';end if;
 if exists(select 1 from jsonb_array_elements(c.patches) item group by item->>'target_id',item->>'field' having count(*)>1) then raise exception 'premium_duplicate_patch';end if;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set apply_txid=txid_current() where id=c.id;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,true);end loop;
 s:=coach_private.premium_snapshot(c.routine_id);select revision_no+1 into n from public.routine_revisions where id=g.current_revision_id;
 insert into public.routine_revisions(routine_id,user_id,operation_id,origin,recommendation_id,revision_no,snapshot,snapshot_hash,author_kind,accepted_by,reason)
 values(c.routine_id,u,null,'premium_recommendation',c.id,n,s,md5(s::text),'mock',u,c.interpretation) returning id into v;
 update public.routine_management set current_revision_id=v where routine_id=c.routine_id;
 update public.coach_mesocycles set current_revision_id=v,row_version=row_version+1,updated_at=now() where id=m.id;
 update public.coach_mesocycle_weeks set revision_id=v where mesocycle_id=m.id and state in ('planned','active') and planned_date+6>=current_date;
 update public.coach_recommendations set state='accepted',accepted_at=now(),result_revision_id=v,apply_txid=null where id=c.id;
 update public.coach_recommendations set state='superseded' where routine_id=c.routine_id and base_revision_id=c.base_revision_id and state in ('ready','pending_review') and id<>c.id;
 return v;
end $$;
drop function public.premium_resolve_review(uuid,text,jsonb,text);
drop function public.premium_reserve_analysis(uuid,uuid);
drop function public.premium_bind_catalogue(uuid,uuid,jsonb);
drop function public.premium_analysis_claim(uuid,uuid,int,text);
drop function public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb);
drop function coach_private.premium_output_patches(public.coach_recommendations,jsonb);
drop function coach_private.premium_bundle(uuid,uuid);
drop function coach_private.premium_history_context(uuid,uuid);
drop function coach_private.premium_accept_phase1(uuid);
drop function coach_private.premium_backend();
drop table coach_private.premium_analysis_budget;
drop index public.premium_analysis_key;
drop index public.premium_analysis_week_pending;
alter table public.coach_mesocycles drop column catalogue_bindings,drop column tracking_week;
alter table public.coach_recommendations drop column analysis_key,drop column analysis_week,drop column analysis_trace,drop column analysis_bundle,drop column provider_state,drop column reserved_usd;
alter table public.coach_recommendations drop constraint coach_recommendations_state_check;
alter table public.coach_recommendations add constraint coach_recommendations_state_check check(state in ('pending_review','ready','rejected','accepted','superseded'));
commit;
