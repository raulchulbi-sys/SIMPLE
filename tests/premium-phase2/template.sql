-- STAGING ONLY. Additive Premium orchestration; no Basic or Auth edits.
begin;
create table coach_private.premium_analysis_budget(
 id boolean primary key default true check(id),enabled boolean not null default true,
 max_calls int not null default 12 check(max_calls between 0 and 12),max_usd numeric not null default .50 check(max_usd between 0 and .50),
 dispatched int not null default 0 check(dispatched>=0),charged_usd numeric not null default 0 check(charged_usd>=0),reserved_usd numeric not null default 0 check(reserved_usd>=0),
 history_config jsonb not null default '{"version":"premium-history-context-v1","exposures":4,"window_days":56,"sessions":112,"exercises":40,"sets":12}',
 check((history_config->>'exposures')::int between 1 and 4 and (history_config->>'window_days')::int between 1 and 56 and (history_config->>'sessions')::int between 1 and 112 and (history_config->>'exercises')::int between 1 and 40 and (history_config->>'sets')::int between 1 and 12));
alter table coach_private.premium_analysis_budget enable row level security;
revoke all on coach_private.premium_analysis_budget from public,anon,authenticated;
insert into coach_private.premium_analysis_budget(id) values(true);
alter table public.coach_mesocycles add column catalogue_bindings jsonb not null default '{}'::jsonb,
 add column tracking_week int not null default 1 check(tracking_week between 1 and 26);
alter table public.coach_recommendations drop constraint coach_recommendations_state_check;
alter table public.coach_recommendations add constraint coach_recommendations_state_check check(state in ('analyzing','failed','invalid','pending_review','ready','rejected','accepted','superseded'));
alter table public.coach_recommendations add column analysis_key uuid,add column analysis_week int,
 add column analysis_trace jsonb not null default '{}'::jsonb,add column analysis_bundle jsonb,
 add column provider_state text,add column reserved_usd numeric not null default 0;
create unique index premium_analysis_key on public.coach_recommendations(user_id,analysis_key) where analysis_key is not null;
create unique index premium_analysis_week_pending on public.coach_recommendations(mesocycle_id,analysis_week) where analysis_key is not null and state in ('analyzing','pending_review','ready');
create function coach_private.premium_backend() returns void language plpgsql set search_path=pg_catalog as $$ begin
 if current_setting('role',true) not in ('none','postgres','service_role') then raise exception 'premium_backend_only' using errcode='42501';end if;
end $$;
__HISTORY__

create function public.premium_bind_catalogue(p_mesocycle uuid,p_revision uuid,p_bindings jsonb) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;k text;v jsonb;
begin
 perform coach_private.premium_backend();select * into c from public.coach_mesocycles where id=p_mesocycle for update;
 if not found or c.current_revision_id is distinct from p_revision or c.state<>'active' or c.intake_submitted_at is null then raise exception 'premium_stale_revision';end if;
 if jsonb_typeof(p_bindings) is distinct from 'object' then raise exception 'premium_invalid_mapping';end if;
 for k,v in select * from jsonb_each(p_bindings) loop
  if jsonb_typeof(v)<>'string' or not exists(select 1 from public.routine_exercises e join public.routine_days d on d.id=e.day_id where e.id=k::uuid and d.routine_id=c.routine_id)
   or not exists(select 1 from jsonb_array_elements(coach_private.premium_catalogue()) e where e->>'id'=v#>>'{}') then raise exception 'premium_invalid_mapping';end if;
 end loop;
 update public.coach_mesocycles set catalogue_bindings=p_bindings,row_version=row_version+1,updated_at=now() where id=c.id;
end $$;

create function coach_private.premium_bundle(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare c public.coach_mesocycles;h jsonb;p jsonb;days jsonb:='[]';exes jsonb:='[]';bindings jsonb:='[]';d record;e jsonb;er text;dr text;cat jsonb;i int:=0;j int:=0;allowed jsonb;pres jsonb;planned jsonb;
begin
 h:=coach_private.premium_history_context(m,u);select * into c from public.coach_mesocycles where id=m;
 if c.intake_submitted_at is null or c.state<>'active' then raise exception 'premium_intake_required';end if;
 for d in select * from public.routine_days where routine_id=c.routine_id order by day_order,id loop
  j:=j+1;dr:='day_'||j;days:=days||jsonb_build_array(jsonb_build_object('ref',dr,'order',d.day_order));
  for e in select value from jsonb_array_elements(h->'exercises') where value->>'day_id'=d.id::text order by (select exercise_order from public.routine_exercises where id=(value->>'exercise_id')::uuid),value->>'exercise_id' loop
   i:=i+1;er:='exercise_'||i;select x into cat from jsonb_array_elements(coach_private.premium_catalogue()) x where x->>'id'=c.catalogue_bindings->>(e->>'exercise_id');
   pres:=e->'prescription';pres:=pres||jsonb_build_object('rir',case when pres->>'rir' ~ '^[0-5]$' then pres->'rir' else 'null'::jsonb end,'reps',case when pres->>'reps' ~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' then pres->'reps' else 'null'::jsonb end);
   select coalesce(jsonb_agg(jsonb_build_object('set_number',n,'reps',pres->'reps','rir',pres->'rir','rest_seconds',pres->'rest_seconds')),'[]'::jsonb) into planned from generate_series(1,least(coalesce((pres->>'sets')::int,0),12))n;
   exes:=exes||jsonb_build_array(jsonb_build_object('ref',er,'day_ref',dr,'catalogue_id',cat->'id','prescription',pres,'planned_sets',planned,'prescription_format','legacy_uniform_projection','metrics',e->'metrics','exposures',(select coalesce(jsonb_agg(jsonb_build_object('date',x->'date','sets',x->'sets')),'[]'::jsonb) from jsonb_array_elements(e->'exposures') x)));
   bindings:=bindings||jsonb_build_array(jsonb_build_object('ref',er,'exercise_id',e->'exercise_id','day_ref',dr,'day_id',e->'day_id','catalogue_id',cat->'id'));
  end loop;
 end loop;
 select coalesce(jsonb_agg(x),'[]'::jsonb) into allowed from jsonb_array_elements(coach_private.premium_catalogue()) x
  where not(c.intake->'excluded' ? (x->>'id')) and not exists(select 1 from jsonb_array_elements_text(x->'requires') z where not(c.intake#>'{inventory,equipment}' ? z));
 p:=jsonb_build_object('schema_version','premium-provider-v1','history_context_version',h->'history_context_version','intake',jsonb_set(c.intake,'{inventory,custom}','[]'::jsonb),
 'mesocycle',jsonb_build_object('number',c.number,'week',c.tracking_week,'planned_weeks',c.planned_weeks,'objective',c.objective,'current_revision',(select revision_no from public.routine_revisions where id=c.current_revision_id)),
 'routine',jsonb_build_object('days',days,'exercises',exes),'weekly_summary',h->'weekly_summary','allowed_replacements',allowed,'limits',h->'limits');
 return jsonb_build_object('provider',p,'bindings',bindings,'history',h);
end $$;

create or replace function public.premium_provider_context(p_mesocycle uuid) returns jsonb language sql stable security definer set search_path=pg_catalog,public as $$
 select coach_private.premium_bundle(p_mesocycle,coach_private.actor())->'provider'
$$;
create function public.premium_reserve_analysis(p_mesocycle uuid,p_key uuid) returns public.coach_recommendations language plpgsql security definer set search_path=pg_catalog,public as $$
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
 jsonb_build_object('history_context_version',b#>'{provider,history_context_version}','provider_context_version','premium-provider-v1','mapping_version','premium-exercise-map-v1','prompt_version','premium-analysis-v1','response_schema_version','premium-recommendation-v1','provider_context_hash',md5((b->'provider')::text))) returning * into r;
 return r;
end $$;

create function public.premium_analysis_claim(p_user uuid,p_id uuid,p_input_bound int,p_mode text default 'openai') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;

create function coach_private.premium_output_patches(r public.coach_recommendations,v jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare ch jsonb;fact jsonb;e jsonb;b jsonb;cat jsonb;patch jsonb;patches jsonb:='[]';field text;raw jsonb;dest jsonb;k text;expected text[];
begin
 if jsonb_typeof(v) is distinct from 'object' or (select array_agg(x order by x) from jsonb_object_keys(v)x) is distinct from array['changes','confidence','facts','interpretation','kind','reason','schema_version'] or
  v->>'schema_version' is distinct from 'premium-recommendation-v1' or not coalesce(v->>'kind' in ('KEEP','MODIFY','REVIEW'),false) or not coalesce(v->>'confidence' in ('low','medium','high'),false) or
  jsonb_typeof(v->'changes') is distinct from 'array' or jsonb_typeof(v->'facts') is distinct from 'array' or jsonb_array_length(v->'facts') not between 1 and 8 or jsonb_array_length(v->'changes')>3 or
  ((v->>'kind'='MODIFY') is distinct from (jsonb_array_length(v->'changes')>0)) then raise exception 'premium_invalid_output';end if;
 for k in select unnest(array['reason','interpretation']) loop
  if jsonb_typeof(v->k) is distinct from 'string' or char_length(v->>k) not between 1 and 800 or v->>k ~* '(@|https?://|[0-9a-f]{8}-[0-9a-f]{4}|diagn[oó]st|patolog|lesi[oó]n|medicaci[oó]n)' then raise exception 'premium_invalid_output';end if;
 end loop;
 for fact in select value from jsonb_array_elements(v->'facts') loop
  if jsonb_typeof(fact)<>'object' or (select array_agg(x order by x) from jsonb_object_keys(fact)x) is distinct from array['claim','exercise_ref'] then raise exception 'premium_unsupported_fact';end if;
  select x into e from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')x where x->>'ref'=fact->>'exercise_ref';
  if e is null or fact->>'claim' is distinct from e#>>'{metrics,trend}' then raise exception 'premium_unsupported_fact';end if;
 end loop;
 for ch in select value from jsonb_array_elements(v->'changes') loop
  select x into b from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'ref'=ch->>'exercise_ref';
  select x into e from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}')x where x->>'ref'=ch->>'exercise_ref';
  if b is null or b->'catalogue_id'='null'::jsonb or not exists(select 1 from jsonb_array_elements(v->'facts') f where f->>'exercise_ref'=ch->>'exercise_ref') then raise exception 'premium_unmapped_target';end if;
  if ch->>'action'='replace_exercise' then
   expected:=array['action','exercise_ref','from_catalogue_id','to_catalogue_id'];
   if ch->>'from_catalogue_id' is distinct from b->>'catalogue_id' or ch->>'to_catalogue_id'=b->>'catalogue_id' or not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,allowed_replacements}') x where x->>'id'=ch->>'to_catalogue_id') then raise exception 'premium_invalid_replacement';end if;
   patch:=jsonb_build_object('target_id',b->'exercise_id','field','replace_exercise','from',b->'exercise_id','to',jsonb_build_object('id',gen_random_uuid(),'catalogue_id',ch->'to_catalogue_id','sets',e#>'{prescription,sets}','target',e#>'{prescription,reps}','rir',e#>'{prescription,rir}','rest_seconds',e#>'{prescription,rest_seconds}'));
  elsif ch->>'action'='change_distribution' then
   expected:=array['action','exercise_ref','from_day_ref','to_day_ref'];
   if ch->>'from_day_ref' is distinct from b->>'day_ref' or ch->>'to_day_ref'=b->>'day_ref' then raise exception 'premium_invalid_distribution';end if;
   select x->'day_id' into dest from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'day_ref'=ch->>'to_day_ref' limit 1;
   if dest is null then raise exception 'premium_invalid_distribution';end if;
   patch:=jsonb_build_object('target_id',b->'exercise_id','field','day_id','from',b->'day_id','to',dest);
  else
   expected:=array['action','exercise_ref','from','to'];field:=case ch->>'action' when 'change_sets' then 'sets' when 'change_reps' then 'target' when 'change_rir' then 'rir' when 'change_rest' then 'rest_seconds' end;
   k:=case field when 'target' then 'reps' else field end;
   if field is null or ch->'from' is distinct from e#>array['prescription',k] or ch->'from'=ch->'to' then raise exception 'premium_stale_output';end if;
   if field='sets' and abs((ch->>'to')::int-(ch->>'from')::int)<>1 then raise exception 'premium_large_volume_change';end if;
   if field='rir' and r.analysis_bundle#>>'{provider,intake,experience}' in ('lt6','m6_12') and (ch->>'to')::int<2 then raise exception 'premium_beginner_rir';end if;
   if field='target' and (ch->>'to' !~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' or split_part(ch->>'to','-',1)::int<5 or coalesce(nullif(split_part(ch->>'to','-',2),''),split_part(ch->>'to','-',1))::int>20 or split_part(ch->>'to','-',1)::int>coalesce(nullif(split_part(ch->>'to','-',2),''),split_part(ch->>'to','-',1))::int) then raise exception 'premium_invalid_reps';end if;
   patch:=jsonb_build_object('target_id',b->'exercise_id','field',field,'from',ch->'from','to',ch->'to');
  end if;
  if jsonb_typeof(ch) is distinct from 'object' or (select array_agg(x order by x) from jsonb_object_keys(ch)x) is distinct from expected then raise exception 'premium_invalid_change';end if;
  perform coach_private.premium_check_patch(patch,r.routine_id,false);patches:=patches||jsonb_build_array(patch);
 end loop;
 if exists(select 1 from jsonb_array_elements(patches)x group by x->>'target_id',x->>'field' having count(*)>1) or exists(select 1 from jsonb_array_elements(patches)x where x->>'field'='replace_exercise' and exists(select 1 from jsonb_array_elements(patches)y where y->>'target_id'=x->>'target_id' and y<>x)) then raise exception 'premium_duplicate_change';end if;
 return patches;
end $$;

create function public.premium_analysis_finish(p_user uuid,p_id uuid,p_output jsonb,p_error text,p_receipt jsonb,p_warnings jsonb) returns public.coach_recommendations language plpgsql security definer set search_path=pg_catalog,public as $$
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
 state=case when err in ('stale_revision','consent_revoked_or_inactive') then 'superseded' when err is null then 'pending_review' when err in ('semantic_invalid','invalid_recommendation','invalid_json') then 'invalid' else 'failed' end,
 patches=case when err is null then vpatches else '[]'::jsonb end,facts=vfacts,interpretation=case when err is null then p_output->>'interpretation' else 'El análisis no produjo una recomendación aplicable.' end,
 provider_state='finished',analysis_trace=analysis_trace||jsonb_build_object('output',p_output,'reason',p_output->'reason','confidence',p_output->'confidence','receipt',p_receipt,'charged_usd',charge,'error',err,'quality_warnings',p_warnings,'finished_at',now()) where id=r.id returning * into r;
 return r;
end $$;

-- Reuse Phase 1 atomic apply; add real model provenance in the private copy.
__ACCEPT_ORIGINAL__
create or replace function public.premium_accept_recommendation(p_id uuid) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;

create function public.premium_resolve_review(p_id uuid,p_kind text,p_patches jsonb,p_reason text) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare c public.coach_recommendations;m public.coach_mesocycles;p jsonb;
begin
 select * into c from public.coach_recommendations where id=p_id for update;
 if not found or not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select * into m from public.coach_mesocycles where id=c.mesocycle_id;
 if c.kind<>'REVIEW' or c.state<>'pending_review' or m.state<>'active' or m.current_revision_id<>c.base_revision_id or (c.analysis_week is not null and c.analysis_week<>m.tracking_week) then raise exception 'premium_invalid_state';end if;
 if p_kind not in ('KEEP','MODIFY') or jsonb_typeof(p_patches) is distinct from 'array' or jsonb_array_length(p_patches)>3 or (p_kind='MODIFY') is distinct from (jsonb_array_length(p_patches)>0) or p_reason is null or char_length(p_reason) not between 1 and 800 then raise exception 'premium_invalid_resolution';end if;
 for p in select value from jsonb_array_elements(p_patches) loop perform coach_private.premium_check_patch(p,c.routine_id,false);end loop;
 update public.coach_recommendations set kind=p_kind,patches=p_patches,state='ready',review_reason=p_reason,reviewed_at=now(),analysis_trace=analysis_trace||jsonb_build_object('manual_resolution',p_kind,'resolution_at',now()) where id=c.id;
end $$;

revoke all on function coach_private.premium_backend(),coach_private.premium_history_context(uuid,uuid),coach_private.premium_bundle(uuid,uuid),coach_private.premium_output_patches(public.coach_recommendations,jsonb),coach_private.premium_accept_phase1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.premium_bind_catalogue(uuid,uuid,jsonb),public.premium_analysis_claim(uuid,uuid,int,text),public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.premium_bind_catalogue(uuid,uuid,jsonb),public.premium_analysis_claim(uuid,uuid,int,text),public.premium_analysis_finish(uuid,uuid,jsonb,text,jsonb,jsonb) to service_role;
revoke all on function public.premium_reserve_analysis(uuid,uuid),public.premium_resolve_review(uuid,text,jsonb,text) from public,anon;
grant execute on function public.premium_reserve_analysis(uuid,uuid),public.premium_resolve_review(uuid,text,jsonb,text) to authenticated;
commit;
