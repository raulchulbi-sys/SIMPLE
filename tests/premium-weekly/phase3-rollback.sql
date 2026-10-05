-- STAGING ONLY. Reject a blind rollback with Phase 3 data or weekly schedule revisions.
begin;
do $$ begin
 if exists(select 1 from public.coach_weekly_checkins) or exists(select 1 from public.coach_recommendations where analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1') or exists(select 1 from public.routine_revisions where snapshot ? 'weekly_schedule') or exists(select 1 from public.context_grants where scope='premium_weekly_checkin' or notice_version='premium-checkin-v1') then raise exception 'premium_weekly_rollback_requires_clean_phase3_state';end if;
end $$;
CREATE OR REPLACE FUNCTION public.premium_accept_recommendation(p_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=coach_private.actor();c public.coach_recommendations;m public.coach_mesocycles;v uuid;p jsonb;
begin
 select * into c from public.coach_recommendations where id=p_id and user_id=u;if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 perform 1 from public.routine_management where routine_id=c.routine_id for update;select * into m from public.coach_mesocycles where id=c.mesocycle_id for update;select * into c from public.coach_recommendations where id=p_id for update;
 if c.state='accepted' then return c.result_revision_id;end if;
 if c.analysis_week is not null and c.analysis_week<>m.tracking_week then raise exception 'premium_stale_week';end if;
 v:=coach_private.premium_accept_phase1(p_id);
 for p in select value from jsonb_array_elements(c.patches) where value->>'field'='replace_exercise' loop
  update public.coach_mesocycles set catalogue_bindings=(catalogue_bindings-(p->>'target_id'))||jsonb_build_object(p#>>'{to,id}',p#>'{to,catalogue_id}') where id=m.id;
 end loop;
 if c.analysis_week is not null then
  if c.kind='MODIFY' then update public.coach_mesocycle_weeks set revision_id=v where mesocycle_id=m.id and week_number>c.analysis_week and state in ('planned','active');end if;
  update public.coach_mesocycle_weeks set state='completed' where mesocycle_id=m.id and week_number=c.analysis_week;
  update public.coach_mesocycles set tracking_week=least(planned_weeks,tracking_week+1),state=case when tracking_week>=planned_weeks then 'completed' else state end,updated_at=now() where id=m.id;
  update public.coach_recommendations set state='superseded' where mesocycle_id=m.id and analysis_week=c.analysis_week and id<>c.id and state in ('pending_review','ready');
 end if;return v;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_analysis_claim(p_user uuid, p_id uuid, p_input_bound integer, p_mode text DEFAULT 'openai'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.coach_recommendations;c public.coach_mesocycles;b coach_private.premium_analysis_budget;allocation numeric;
begin
 perform coach_private.premium_backend();select * into b from coach_private.premium_analysis_budget where id for update;
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user for update;
 if not found then raise exception 'premium_not_authorized';end if;
 if r.provider_state<>'reserved' or r.state<>'analyzing' then return jsonb_build_object('claimed',false);end if;
 select * into c from public.coach_mesocycles where id=r.mesocycle_id;
 if not coach_private.premium_access(c.id,p_user) or c.current_revision_id<>r.base_revision_id or c.tracking_week<>r.analysis_week or not exists(select 1 from public.context_grants where user_id=p_user and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then raise exception 'premium_stale_or_revoked';end if;
 if not b.enabled or p_mode not in ('openai','mock') or p_input_bound not between 1 and 100000 then raise exception 'premium_pilot_closed';end if;
 allocation:=case when p_mode='openai' then (p_input_bound*2.5+1800*15)/1000000 else 0 end;
 if p_mode='openai' and (b.dispatched>=b.max_calls or b.charged_usd+b.reserved_usd+allocation>b.max_usd) then raise exception 'premium_budget_exhausted';end if;
 update coach_private.premium_analysis_budget set dispatched=dispatched+case when p_mode='openai' then 1 else 0 end,reserved_usd=reserved_usd+allocation where id;
 update public.coach_recommendations set provider_state='dispatched',reserved_usd=allocation,analysis_trace=analysis_trace||jsonb_build_object('model',case when p_mode='openai' then 'gpt-5.4-2026-03-05' else 'mock' end,'input_token_bound',p_input_bound,'dispatch_at',now()) where id=r.id;
 return jsonb_build_object('claimed',true,'provider',r.analysis_bundle->'provider');
end $function$;

CREATE OR REPLACE FUNCTION public.premium_analysis_finish(p_user uuid, p_id uuid, p_output jsonb, p_error text, p_receipt jsonb, p_warnings jsonb)
 RETURNS coach_recommendations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare r public.coach_recommendations;c public.coach_mesocycles;vpatches jsonb;err text:=p_error;charge numeric;known boolean;vfacts jsonb;
begin
 perform coach_private.premium_backend();perform 1 from coach_private.premium_analysis_budget where id for update;
 select * into r from public.coach_recommendations where id=p_id and user_id=p_user for update;
 if not found then raise exception 'premium_not_authorized';end if;
 if r.provider_state='finished' then return r;end if;
 if r.provider_state<>'dispatched' or r.state<>'analyzing' then raise exception 'premium_invalid_state';end if;
 select * into c from public.coach_mesocycles where id=r.mesocycle_id;
 if c.current_revision_id<>r.base_revision_id or c.tracking_week<>r.analysis_week then err:='stale_revision';
 elsif not coach_private.premium_access(c.id,p_user) or not exists(select 1 from public.context_grants where user_id=p_user and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null) then err:='consent_revoked_or_inactive';end if;
 if err is null then begin vpatches:=coach_private.premium_output_patches(r,p_output);exception when others then err:='semantic_invalid';end;end if;
 known:=p_receipt->>'input_tokens' ~ '^[0-9]+$' and p_receipt->>'output_tokens' ~ '^[0-9]+$';
 charge:=case when r.analysis_trace->>'model'='mock' then 0 when coalesce(known,false) then (((p_receipt->>'input_tokens')::int-coalesce((p_receipt->>'cached_input_tokens')::int,0))*2.5+coalesce((p_receipt->>'cached_input_tokens')::int,0)*.25+(p_receipt->>'output_tokens')::int*15)/1000000 else r.reserved_usd end;
 if charge<0 then raise exception 'premium_invalid_receipt';end if;
 update coach_private.premium_analysis_budget set reserved_usd=greatest(0,reserved_usd-r.reserved_usd),charged_usd=charged_usd+charge where id;
 select coalesce(jsonb_agg(jsonb_build_object('exercise_ref',f->'exercise_ref','claim',f->'claim','observations',e->'exposures')),'[]'::jsonb) into vfacts
 from jsonb_array_elements(case when err is null then p_output->'facts' else '[]'::jsonb end) f join lateral (select x from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') x where x->>'ref'=f->>'exercise_ref') a(e) on true;
 update public.coach_recommendations set kind=case when err is null then p_output->>'kind' else 'REVIEW' end,
 state=case when err in ('stale_revision','consent_revoked_or_inactive') then 'superseded' when err is null then 'pending_review' when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'pending_review' else 'failed' end,
 patches=case when err is null then vpatches else '[]'::jsonb end,facts=vfacts,interpretation=case when err is null then p_output->>'interpretation' else 'El análisis no produjo una recomendación aplicable.' end,
 provider_state='finished',analysis_trace=analysis_trace||jsonb_build_object('output',p_output,'reason',p_output->'reason','confidence',p_output->'confidence','receipt',p_receipt,'charged_usd',charge,'error',err,'quality_warnings',p_warnings,'review_issue',case when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'La propuesta no es aplicable con seguridad. Requiere resolución humana; no se aplicará el output original.' else null end,'finished_at',now()) where id=r.id returning * into r;
 return r;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.premium_check_patch(p jsonb, r uuid, apply_patch boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare rev uuid;ss jsonb;e public.routine_exercises;c public.coach_mesocycles;first_set jsonb;
begin
 if p->>'field' is null then raise exception 'premium_invalid_patch';end if;
 select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if p->>'field'<>'planned_sets' then
  ss:=coach_private.premium_revision_sets(rev,(p->>'target_id')::uuid);
  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is null then raise exception 'premium_current_prescription_unresolved';end if;
  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is not null and not coach_private.premium_series_uniform(ss) then raise exception 'premium_individualized_requires_set_target';end if;
  perform coach_private.premium_check_patch_v1(p,r,apply_patch);return;
 end if;
 if (select array_agg(x order by x) from jsonb_object_keys(p)x) is distinct from array['field','from','target_id','to'] then raise exception 'premium_invalid_patch';end if;
 select x.* into e from public.routine_exercises x join public.routine_days d on d.id=x.day_id where x.id=(p->>'target_id')::uuid and d.routine_id=r;
 ss:=coach_private.premium_revision_sets(rev,e.id);
 if e.id is null or ss is null or p->'from' is distinct from ss or not coach_private.premium_sets_valid(p->'to') or p->'from'=p->'to' or abs(jsonb_array_length(p->'to')-jsonb_array_length(ss))>1 then raise exception 'premium_stale_set_patch';end if;
 if not coalesce(e.target ~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' and e.rir ~ '^[0-5]$',false) then raise exception 'premium_stale_live_projection';end if;
 if e.sets is distinct from jsonb_array_length(ss) or e.rest_seconds is distinct from (ss#>>'{0,rest_seconds}')::int or e.rir::int is distinct from (ss#>>'{0,rir}')::int or split_part(e.target,'-',1)::int is distinct from (ss#>>'{0,reps_min}')::int or coalesce(nullif(split_part(e.target,'-',2),''),split_part(e.target,'-',1))::int is distinct from (ss#>>'{0,reps_max}')::int then raise exception 'premium_stale_live_projection';end if;
 select * into c from public.coach_mesocycles where routine_id=r and current_revision_id=rev and state='active';
 if c.id is null then raise exception 'premium_inactive';end if;
 if exists(select 1 from jsonb_array_elements(p->'to')s where s not in (select value from jsonb_array_elements(ss)) and not coach_private.premium_sets_valid(jsonb_build_array(s||jsonb_build_object('set_number',1)),true)) then raise exception 'premium_invalid_set_prescription';end if;
 if c.intake->>'experience' in ('lt6','m6_12') and exists(select 1 from jsonb_array_elements(p->'to')s where (s->>'rir')::int<2) then raise exception 'premium_beginner_rir';end if;
 if apply_patch then first_set:=p->'to'->0;update public.routine_exercises set sets=jsonb_array_length(p->'to'),target=(first_set->>'reps_min')||'-'||(first_set->>'reps_max'),rir=first_set->>'rir',rest_seconds=(first_set->>'rest_seconds')::int where id=e.id;end if;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.premium_output_patches(r coach_recommendations, v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare legacy jsonb;patches jsonb;ch jsonb;oldch jsonb:='[]';newch jsonb:='[]';e jsonb;b jsonb;ss jsonb;next_ss jsonb;cur jsonb;n int;k text;changes jsonb;expected text[];seen int[];vol int;strict_set jsonb;
begin
 if v->>'schema_version'='premium-recommendation-v1' then
  for ch in select value from jsonb_array_elements(v->'changes') loop
   select x into e from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')x where x->>'ref'=ch->>'exercise_ref';
   if ch->>'action' in ('change_sets','change_reps','change_rir','change_rest','replace_exercise') and e->'planned_sets' is not null and not coach_private.premium_series_uniform(e->'planned_sets') then raise exception 'premium_individualized_requires_set_target';end if;
  end loop;return coach_private.premium_output_patches_v1(r,v);
 end if;
 if v->>'schema_version' is distinct from 'premium-recommendation-v2' or jsonb_typeof(v->'changes') is distinct from 'array' or jsonb_array_length(v->'changes')>3 or ((v->>'kind'='MODIFY') is distinct from (jsonb_array_length(v->'changes')>0)) then raise exception 'premium_invalid_output';end if;
 for ch in select value from jsonb_array_elements(v->'changes') loop
  if ch->>'action' in ('change_set','remove_set','add_set') then newch:=newch||jsonb_build_array(ch);else oldch:=oldch||jsonb_build_array(ch);end if;
 end loop;
 legacy:=v||jsonb_build_object('schema_version','premium-recommendation-v1','changes',oldch,'kind',case when jsonb_array_length(oldch)>0 then 'MODIFY' else 'KEEP' end);
 patches:=coach_private.premium_output_patches(r,legacy);
 for e in select value from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') loop
  select coalesce(jsonb_agg(x),'[]'::jsonb) into changes from jsonb_array_elements(newch)x where x->>'exercise_ref'=e->>'ref';if changes='[]'::jsonb then continue;end if;
  select x into b from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'ref'=e->>'ref';
  ss:=e->'planned_sets';next_ss:=ss;seen:='{}';vol:=0;
  if b is null or b->>'catalogue_id' is null or not coach_private.premium_sets_valid(ss) or not exists(select 1 from jsonb_array_elements(v->'facts')f where f->>'exercise_ref'=e->>'ref') then raise exception 'premium_unmapped_target';end if;
  if exists(select 1 from jsonb_array_elements(oldch)x where x->>'exercise_ref'=e->>'ref') then raise exception 'premium_conflicting_changes';end if;
  for ch in select value from jsonb_array_elements(changes) loop
   expected:=case ch->>'action' when 'change_set' then array['action','exercise_ref','from','set_number','to'] when 'remove_set' then array['action','exercise_ref','from','set_number'] else array['action','exercise_ref','set_number','to'] end;
   if jsonb_typeof(ch)<>'object' or (select array_agg(x order by x) from jsonb_object_keys(ch)x) is distinct from expected or jsonb_typeof(ch->'set_number') is distinct from 'number' or ch->>'set_number' !~ '^[1-9][0-9]?$' then raise exception 'premium_invalid_set_change';end if;
   n:=(ch->>'set_number')::int;if n=any(seen) then raise exception 'premium_duplicate_set_change';end if;seen:=array_append(seen,n);
   if ch->>'action'='add_set' then
    vol:=vol+1;if n<>jsonb_array_length(ss)+1 or jsonb_array_length(ss)>=4 then raise exception 'premium_invalid_set_append';end if;
   else
    cur:=(ss->(n-1))-'set_number';if cur is null or ch->'from' is distinct from cur then raise exception 'premium_stale_set';end if;
    if ch->>'action'='remove_set' then
     vol:=vol+1;if jsonb_array_length(ss)<=1 then raise exception 'premium_empty_volume';end if;
    elsif cur=ch->'to' then raise exception 'premium_empty_set_change';end if;
   end if;
   if ch ? 'to' then
    if jsonb_typeof(ch->'to') is distinct from 'object' or (select array_agg(x order by x) from jsonb_object_keys(ch->'to')x) is distinct from array['reps_max','reps_min','rest_seconds','rir'] then raise exception 'premium_invalid_set_prescription';end if;
    strict_set:=ch->'to'||jsonb_build_object('set_number',1);
    if not coach_private.premium_sets_valid(jsonb_build_array(strict_set),true) or r.analysis_bundle#>>'{provider,intake,experience}' in ('lt6','m6_12') and (ch#>>'{to,rir}')::int<2 then raise exception 'premium_invalid_set_prescription';end if;
   end if;
   if ch->>'action'='change_set' then next_ss:=jsonb_set(next_ss,array[(n-1)::text],ch->'to'||jsonb_build_object('set_number',n));
   elsif ch->>'action'='add_set' then next_ss:=next_ss||jsonb_build_array(ch->'to'||jsonb_build_object('set_number',n));
   else select jsonb_agg(s||jsonb_build_object('set_number',i) order by i) into next_ss from (select value s,row_number() over(order by ordinal) i from jsonb_array_elements(next_ss) with ordinality a(value,ordinal) where ordinal<>n)x;end if;
  end loop;
  if vol>0 and jsonb_array_length(changes)>1 then raise exception 'premium_conflicting_volume_changes';end if;
  patches:=patches||jsonb_build_array(jsonb_build_object('target_id',b->'exercise_id','field','planned_sets','from',ss,'to',next_ss));
 end loop;
 if exists(select 1 from jsonb_array_elements(newch)c where not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')pex where c->>'exercise_ref'=pex->>'ref')) then raise exception 'premium_invalid_target';end if;
 for ch in select value from jsonb_array_elements(patches) loop perform coach_private.premium_check_patch(ch,r.routine_id,false);end loop;return patches;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_reserve_analysis(p_mesocycle uuid, p_key uuid)
 RETURNS coach_recommendations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=coach_private.actor();c public.coach_mesocycles;r public.coach_recommendations;b jsonb;
begin
 if p_key is null then raise exception 'premium_invalid_request';end if;
 select * into r from public.coach_recommendations where user_id=u and analysis_key=p_key;
 if found then if r.mesocycle_id<>p_mesocycle then raise exception 'premium_key_conflict';end if;return r;end if;
 select * into c from public.coach_mesocycles where id=p_mesocycle and user_id=u for update;
 if not found or not coach_private.premium_access(c.id,u) or c.state<>'active' then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if not (select enabled from coach_private.premium_analysis_budget where id) then raise exception 'premium_pilot_closed';end if;
 select * into r from public.coach_recommendations where user_id=u and analysis_key=p_key;if found then return r;end if;
 if exists(select 1 from public.coach_recommendations where mesocycle_id=c.id and analysis_week=c.tracking_week and state in ('analyzing','pending_review','ready')) then raise exception 'premium_week_pending';end if;
 b:=coach_private.premium_bundle(c.id,u);
 insert into public.coach_recommendations(mesocycle_id,routine_id,user_id,base_revision_id,kind,state,patches,facts,interpretation,context_snapshot,analysis_key,analysis_week,analysis_bundle,provider_state,analysis_trace)
 values(c.id,c.routine_id,u,c.current_revision_id,'REVIEW','analyzing','[]','[]','Análisis pendiente.',b->'history',p_key,c.tracking_week,b,'reserved',
 jsonb_build_object('history_context_version',b#>'{provider,history_context_version}','provider_context_version','premium-provider-v1','prescription_context_version','premium-prescription-v2','mapping_version','premium-exercise-map-v1','prompt_version','premium-analysis-v1.1','response_schema_version','premium-recommendation-v2','provider_context_hash',md5((b->'provider')::text))) returning * into r;
 return r;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_resolve_review(p_id uuid, p_kind text, p_patches jsonb, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c public.coach_recommendations;m public.coach_mesocycles;p jsonb;
begin
 select * into c from public.coach_recommendations where id=p_id for update;
 if not found or not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select * into m from public.coach_mesocycles where id=c.mesocycle_id;
 if c.kind<>'REVIEW' or c.state<>'pending_review' or m.state<>'active' or m.current_revision_id<>c.base_revision_id or (c.analysis_week is not null and c.analysis_week<>m.tracking_week) then raise exception 'premium_invalid_state';end if;
 if p_kind not in ('KEEP','MODIFY') or jsonb_typeof(p_patches) is distinct from 'array' or jsonb_array_length(p_patches)>3 or (p_kind='MODIFY') is distinct from (jsonb_array_length(p_patches)>0) or p_reason is null or char_length(p_reason) not between 1 and 800 then raise exception 'premium_invalid_resolution';end if;
 for p in select value from jsonb_array_elements(p_patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set kind=p_kind,patches=p_patches,state='ready',review_reason=p_reason,reviewed_at=now(),analysis_trace=analysis_trace||jsonb_build_object('manual_resolution',p_kind,'resolution_at',now()) where id=c.id;
end $function$;

CREATE OR REPLACE FUNCTION public.premium_review_recommendation(p_id uuid, p_approve boolean, p_reason text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare c public.coach_recommendations;m public.coach_mesocycles;p jsonb;
begin
 select * into c from public.coach_recommendations where id=p_id for update;
 if current_setting('role',true) not in ('none','postgres','service_role') and not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_backend_only' using errcode='42501';end if;
 if not found or c.state<>'pending_review' then raise exception 'premium_invalid_state';end if;
 select * into m from public.coach_mesocycles where id=c.mesocycle_id;
 if m.state<>'active' or m.current_revision_id<>c.base_revision_id then raise exception 'premium_stale_revision';end if;
 if p_reason is null or char_length(p_reason) not between 1 and 800 then raise exception 'premium_review_reason_required';end if;
 if p_approve and c.kind='REVIEW' then raise exception 'premium_manual_resolution_required';end if;
 for p in select value from jsonb_array_elements(c.patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set state=case when p_approve then 'ready' else 'rejected' end,review_reason=p_reason,reviewed_at=now() where id=p_id;
 return case when p_approve then 'ready' else 'rejected' end;
end $function$;

CREATE OR REPLACE FUNCTION coach_private.premium_snapshot(r uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare snap jsonb;rev uuid;day jsonb;e jsonb;ss jsonb;patch jsonb;new_ex jsonb;new_days jsonb:='[]';first_set jsonb;base_ex jsonb;base_count int;
begin
 snap:=coach_private.premium_snapshot_v1(r);select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if rev is null then return snap;end if;
 for day in select value from jsonb_array_elements(snap->'days') loop
  new_ex:='[]';for e in select value from jsonb_array_elements(day->'exercises') loop
   ss:=coach_private.premium_revision_sets(rev,(e->>'id')::uuid);
   select count(*) into base_count from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where v.id=rev and x->>'id'=e->>'id';
   base_ex:=null;
   if base_count=1 then
    select x into base_ex from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where v.id=rev and x->>'id'=e->>'id';
    if ss is null and base_ex ? 'planned_sets' then raise exception 'premium_current_prescription_unresolved';end if;
   elsif base_count<>0 or not exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches) p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='replace_exercise' and p#>>'{to,id}'=e->>'id') then
    raise exception 'premium_malformed_baseline';
   end if;
   select p into patch from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'target_id'=e->>'id' and p->>'field'='planned_sets';
   if patch is not null then ss:=patch->'to';
   elsif ss is not null and exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'target_id'=e->>'id' and p->>'field' in ('sets','target','rir','rest_seconds')) then
    select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',split_part(e->>'target','-',1)::int,'reps_max',coalesce(nullif(split_part(e->>'target','-',2),''),split_part(e->>'target','-',1))::int,'rir',(e->>'rir')::int,'rest_seconds',(e->>'rest_seconds')::int) order by n) into ss from generate_series(1,(e->>'sets')::int)n;
   end if;
   if ss is not null then first_set:=ss->0;e:=e||jsonb_build_object('planned_sets',ss,'sets',jsonb_array_length(ss),'reps_min',first_set->'reps_min','reps_max',first_set->'reps_max','scheme',case when coach_private.premium_series_uniform(ss) then 'straight' when (select x->>'scheme' from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')x where v.id=rev and x->>'id'=e->>'id')='top_backoff' then 'top_backoff' else 'variable' end);
   elsif base_ex is not null then
    -- Unresolved legacy remains canonical; do not silently reconstruct it from live scalars.
    e:=base_ex||(e-array['sets','target','rir','rest_seconds','reps_min','reps_max','scheme','planned_sets']);
   end if;
   new_ex:=new_ex||jsonb_build_array(e);
  end loop;new_days:=new_days||jsonb_build_array(day||jsonb_build_object('exercises',new_ex));
 end loop;return snap||jsonb_build_object('days',new_days,'prescription_context_version','premium-prescription-v2');
end $function$;

CREATE OR REPLACE FUNCTION public.premium_permission(p_mesocycle uuid, p_allow boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=coach_private.actor();
begin
 if not coach_private.premium_access(p_mesocycle,u) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 if p_allow then
  insert into public.context_grants(user_id,scope,notice_version) select u,'premium_training_history','premium-tracking-v1'
  where not exists(select 1 from public.context_grants where user_id=u and scope='premium_training_history' and revoked_at is null);
 else update public.context_grants set revoked_at=now() where user_id=u and scope='premium_training_history' and revoked_at is null;
 end if;
 return p_allow;
end $function$;
drop policy premium_owner on public.coach_recommendations;
create policy premium_owner on public.coach_recommendations for select to authenticated using(user_id=(select auth.uid()));
drop policy premium_explicit_reviewer on public.coach_recommendations;
create policy premium_explicit_reviewer on public.coach_recommendations for select to authenticated using(coach_private.premium_review_access(mesocycle_id));
drop function public.premium_save_weekly_checkin(uuid,integer,uuid,bigint,jsonb,boolean);
drop table public.coach_weekly_checkins;
drop function coach_private.premium_weekly_grant(uuid,uuid),coach_private.premium_weekly_visible(uuid),coach_private.premium_weekly_validate(jsonb,boolean,uuid),coach_private.premium_weekly_checkin_guard(),coach_private.premium_weekly_assert(public.coach_recommendations,boolean),coach_private.premium_weekly_schedule(uuid),coach_private.premium_weekly_bundle(uuid,uuid),coach_private.premium_weekly_schedule_check(jsonb,uuid,jsonb),coach_private.premium_output_patches_phase2(public.coach_recommendations,jsonb),public.premium_weekly_permission(uuid,boolean),public.premium_weekly_provider_context(uuid),public.premium_weekly_reserve_analysis(uuid,uuid);
alter table public.context_grants drop constraint context_grants_scope_check;
alter table public.context_grants add constraint context_grants_scope_check check(scope in ('training_intake','declared_health','premium_training_history'));
alter table public.context_grants drop constraint context_grants_notice_version_check;
alter table public.context_grants add constraint context_grants_notice_version_check check(notice_version in ('pilot-mock-v1','pilot-openai-v1','pilot-supervised-v1','pilot-supervised-v2','premium-tracking-v1'));
-- Restore valid old configuration before narrowing its constraints; preserve usage and costs.
update coach_private.premium_analysis_budget set enabled=false,max_calls=16,max_usd=.3577695 where id;
alter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_calls_check;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_calls_check check(max_calls between 0 and 16);
alter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_usd_check;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_usd_check check(max_usd between 0 and .5);
commit;
