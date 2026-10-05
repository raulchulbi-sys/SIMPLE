do $guard$ begin
if md5(pg_get_functiondef('coach_private.premium_output_patches(coach_recommendations,jsonb)'::regprocedure))<>'079a69cfbb646018b0009df3fb633190' then raise exception 'distribution_source_contract_changed: coach_private.premium_output_patches(coach_recommendations,jsonb)'; end if;
if md5(pg_get_functiondef('coach_private.premium_weekly_bundle(uuid,uuid)'::regprocedure))<>'b29ab233af9004b7cfef2c74f7051753' then raise exception 'distribution_source_contract_changed: coach_private.premium_weekly_bundle(uuid,uuid)'; end if;
if md5(pg_get_functiondef('coach_private.premium_check_patch(jsonb,uuid,boolean)'::regprocedure))<>'a9fd53a7a6bdc75c6de9a458917340c9' then raise exception 'distribution_source_contract_changed: coach_private.premium_check_patch(jsonb,uuid,boolean)'; end if;
if md5(pg_get_functiondef('coach_private.premium_snapshot(uuid)'::regprocedure))<>'0cf19164da62a12361b3711ae6e41783' then raise exception 'distribution_source_contract_changed: coach_private.premium_snapshot(uuid)'; end if;
if md5(pg_get_functiondef('coach_private.premium_weekly_assert(coach_recommendations,boolean)'::regprocedure))<>'39c0434260c86a3262adf80997cde8f0' then raise exception 'distribution_source_contract_changed: coach_private.premium_weekly_assert(coach_recommendations,boolean)'; end if;
if md5(pg_get_functiondef('premium_recommendation_view(uuid)'::regprocedure))<>'ce10c6e8fdcc9f62bcd5f5e4876ed0f4' then raise exception 'distribution_source_contract_changed: premium_recommendation_view(uuid)'; end if;
end $guard$;
-- Atomic weekly session distribution. No data, tables, policies or Auth mutations.
-- Captured compatible definitions are kept private for legacy contracts and rollback.
CREATE OR REPLACE FUNCTION coach_private.premium_output_patches_distribution_previous(r coach_recommendations, v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare legacy jsonb;patches jsonb;normal_changes jsonb;ch jsonb;s jsonb;sig jsonb;k text;want text;ss jsonb;d jsonb;internal_from jsonb;internal_to jsonb;p jsonb;caps jsonb;current_fits boolean;ex jsonb;binding jsonb;pc jsonb;day_id text;cat text;uni boolean;duration jsonb;seconds numeric;
begin
 if r.analysis_bundle#>>'{provider,schema_version}' is distinct from 'premium-weekly-provider-v1' then return coach_private.premium_output_patches_phase2(r,v);end if;
 if coach_private.keys_exact(v,array['schema_version','kind','facts','checkin_signals','interpretation','changes','reason','confidence']) is not true or v->>'schema_version' is distinct from 'premium-weekly-analysis-v1' or
  not coalesce(v->>'kind' in ('KEEP','MODIFY','REVIEW'),false) or jsonb_typeof(v->'changes') is distinct from 'array' or jsonb_array_length(v->'changes')>3 or (v->>'kind'='MODIFY') is distinct from (jsonb_array_length(v->'changes')>0) or
  jsonb_typeof(v->'checkin_signals') is distinct from 'array' or jsonb_array_length(v->'checkin_signals')>7 then raise exception 'premium_weekly_invalid_output';end if;
 if r.analysis_bundle#>'{provider,checkin_missing}'='true'::jsonb and v->'checkin_signals'<>'[]'::jsonb then raise exception 'premium_weekly_invented_checkin';end if;
 if (select count(distinct x->>'field') from jsonb_array_elements(v->'checkin_signals')x)<>jsonb_array_length(v->'checkin_signals') then raise exception 'premium_weekly_duplicate_signal';end if;
 for sig in select value from jsonb_array_elements(v->'checkin_signals') loop
  if coach_private.keys_exact(sig,array['field','value']) is not true or jsonb_typeof(sig->'field') is distinct from 'string' or jsonb_typeof(sig->'value') is distinct from 'string' then raise exception 'premium_weekly_invalid_signal';end if;
  k:=sig->>'field';want:=case when k in ('recovery','sleep','fatigue','stress','session_perception') then r.analysis_bundle#>>array['provider','checkin',k]
   when k='availability' then case r.analysis_bundle#>>'{provider,checkin,availability,changed}' when 'true' then 'changed' when 'false' then 'unchanged' end
   when k='review' then r.analysis_bundle#>>'{provider,checkin,review,topic}' end;
  if want is null or sig->>'value' is distinct from want then raise exception 'premium_weekly_invented_checkin';end if;
 end loop;
 select coalesce(jsonb_agg(x),'[]') into normal_changes from jsonb_array_elements(v->'changes')x where x->>'action' is distinct from 'change_week_schedule';
 legacy:=(v-'checkin_signals')||jsonb_build_object('schema_version','premium-recommendation-v2','changes',normal_changes,'kind',case when normal_changes<>'[]'::jsonb then 'MODIFY' else 'KEEP' end);
 patches:=coach_private.premium_output_patches_phase2(r,legacy);
 if (select count(*) from jsonb_array_elements(v->'changes')x where x->>'action'='change_week_schedule')>1 then raise exception 'premium_weekly_duplicate_schedule';end if;
 for ch in select value from jsonb_array_elements(v->'changes') where value->>'action'='change_week_schedule' loop
  if coach_private.keys_exact(ch,array['action','from','to']) is not true or ch->'from' is distinct from r.analysis_bundle#>'{provider,week_schedule}' or ch->'from'=ch->'to' or r.analysis_bundle#>>'{provider,week_schedule_source}'='unresolved' or
   jsonb_typeof(ch->'to') is distinct from 'array' or jsonb_array_length(ch->'to') is distinct from jsonb_array_length(ch->'from') or
   (select count(distinct x->>'day_ref') from jsonb_array_elements(ch->'to')x)<>jsonb_array_length(ch->'to') then raise exception 'premium_weekly_invalid_schedule';end if;
  for d in select value from jsonb_array_elements(ch->'to') loop
   if coach_private.keys_exact(d,array['day_ref','weekday','minutes']) is not true or not exists(select 1 from jsonb_array_elements(r.analysis_bundle->'weekly_days')x where x->>'day_ref'=d->>'day_ref') then raise exception 'premium_weekly_invalid_schedule';end if;
  end loop;
  select jsonb_agg(jsonb_build_object('day_id',b->'day_id','weekday',x->'weekday','minutes',x->'minutes') order by b->>'day_ref') into internal_from from jsonb_array_elements(ch->'from')x join jsonb_array_elements(r.analysis_bundle->'weekly_days')b on b->>'day_ref'=x->>'day_ref';
  select jsonb_agg(jsonb_build_object('day_id',b->'day_id','weekday',x->'weekday','minutes',x->'minutes') order by b->>'day_ref') into internal_to from jsonb_array_elements(ch->'to')x join jsonb_array_elements(r.analysis_bundle->'weekly_days')b on b->>'day_ref'=x->>'day_ref';
  if exists(select 1 from jsonb_array_elements(patches)x where x->>'field'='rest_seconds' and (x->>'to')::int<(x->>'from')::int) or
   exists(select 1 from jsonb_array_elements(patches)x cross join lateral jsonb_array_elements(case when x->>'field'='planned_sets' then x->'to' else '[]'::jsonb end) with ordinality a(t,n) where x->>'field'='planned_sets' and (t->>'rest_seconds')::int<(x->'from'->(n-1)::int->>'rest_seconds')::int) then raise exception 'premium_weekly_rest_compression';end if;
  p:=jsonb_build_object('target_id',r.routine_id,'field','weekly_schedule','from',internal_from,'to',internal_to);
  perform coach_private.premium_weekly_schedule_check(p,r.routine_id);
  select jsonb_object_agg(x->>'day_id',300) into duration from jsonb_array_elements(r.analysis_bundle->'weekly_days')x;
  for ex in select value from jsonb_array_elements(r.analysis_bundle#>'{provider,routine,exercises}') loop
   select x into binding from jsonb_array_elements(r.analysis_bundle->'bindings')x where x->>'ref'=ex->>'ref';
   day_id:=binding->>'day_id';cat:=binding->>'catalogue_id';ss:=ex->'planned_sets';
   if not coach_private.premium_sets_valid(ss) or cat is null then raise exception 'premium_weekly_duration_unresolved';end if;
   for pc in select value from jsonb_array_elements(patches) where value->>'target_id'=binding->>'exercise_id' loop
    if pc->>'field'='planned_sets' then ss:=pc->'to';
    elsif pc->>'field'='day_id' then day_id:=pc->>'to';
    elsif pc->>'field'='replace_exercise' then
     cat:=pc#>>'{to,catalogue_id}';select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',split_part(pc#>>'{to,target}','-',1)::int,'reps_max',coalesce(nullif(split_part(pc#>>'{to,target}','-',2),''),split_part(pc#>>'{to,target}','-',1))::int,'rir',(pc#>>'{to,rir}')::int,'rest_seconds',(pc#>>'{to,rest_seconds}')::int)) into ss from generate_series(1,(pc#>>'{to,sets}')::int)n;
    elsif pc->>'field'='sets' then select jsonb_agg((ss->0)||jsonb_build_object('set_number',n)) into ss from generate_series(1,(pc->>'to')::int)n;
    elsif pc->>'field'='target' then select jsonb_agg(x||jsonb_build_object('reps_min',split_part(pc->>'to','-',1)::int,'reps_max',coalesce(nullif(split_part(pc->>'to','-',2),''),split_part(pc->>'to','-',1))::int)) into ss from jsonb_array_elements(ss)x;
    elsif pc->>'field' in ('rir','rest_seconds') then select jsonb_agg(x||jsonb_build_object(pc->>'field',(pc->>'to')::int)) into ss from jsonb_array_elements(ss)x;
    end if;
   end loop;
   uni:=cat in ('reverse_lunge','dead_bug','bird_dog','db_row');
   seconds:=120+(select sum((x->>'reps_max')::int*4*(case when uni then 2 else 1 end)+(x->>'rest_seconds')::int+(case when uni then 15 else 0 end)) from jsonb_array_elements(ss)x);
   duration:=jsonb_set(duration,array[day_id],to_jsonb((duration->>day_id)::numeric+seconds));
  end loop;
  if exists(select 1 from jsonb_array_elements(internal_to)x where ceil((duration->>(x->>'day_id'))::numeric/60)>(x->>'minutes')::int) then raise exception 'premium_weekly_schedule_too_short';end if;
  patches:=patches||jsonb_build_array(p);
 end loop;
 if r.analysis_bundle#>'{provider,checkin,availability,changed}'='true'::jsonb and v->>'kind'<>'REVIEW' and not exists(select 1 from jsonb_array_elements(patches)x where x->>'field'='weekly_schedule') then
  caps:=r.analysis_bundle#>'{provider,checkin,availability}';current_fits:=r.analysis_bundle#>>'{provider,week_schedule_source}'<>'unresolved' and not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,week_schedule}')x where not(caps->'weekdays' ? (x->>'weekday')));
  if current_fits then current_fits:=not exists(select 1 from jsonb_array_elements(r.analysis_bundle#>'{provider,week_schedule}')x group by x->>'weekday' having sum((x->>'minutes')::int)>coalesce((caps->'minutes_by_day'->>(x->>'weekday'))::int,0));end if;
  if not coalesce(current_fits,false) then raise exception 'premium_weekly_unresolved_availability';end if;
 end if;
 return patches;
end $function$
;
revoke all on function coach_private.premium_output_patches_distribution_previous(coach_recommendations,jsonb) from public, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION coach_private.premium_weekly_bundle_distribution_previous(m uuid, u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
 SET "TimeZone" TO 'Europe/Madrid'
AS $function$
declare b jsonb;c public.coach_mesocycles;q public.coach_weekly_checkins;ci jsonb;s jsonb;source text;recent jsonb:='[]';previous record;changes jsonb;ch jsonb;ref jsonb;summary jsonb;days jsonb;hg uuid;g uuid;metadata jsonb;
begin
 b:=coach_private.premium_bundle(m,u);select * into c from public.coach_mesocycles where id=m;
 g:=coach_private.premium_weekly_grant(m,u);if g is null then raise exception 'premium_weekly_consent_required' using errcode='42501';end if;
 select id into hg from public.context_grants where user_id=u and scope='premium_training_history' and notice_version='premium-tracking-v1' and revoked_at is null order by granted_at desc,id desc limit 1;
 select * into q from public.coach_weekly_checkins where mesocycle_id=m and week_number=c.tracking_week and submitted_at is not null;
 if q.id is not null and q.routine_revision_id is distinct from c.current_revision_id then raise exception 'premium_weekly_stale_checkin';end if;
 ci:=q.answers;
 if ci is not null then
  select x->'ref' into ref from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=ci#>>'{review,exercise_id}';
  ci:=jsonb_set(ci,'{review}',((ci->'review')-'exercise_id')||jsonb_build_object('exercise_ref',ref));
 end if;
 select jsonb_agg(jsonb_build_object('day_id',id,'day_ref','day_'||n) order by n) into days from (select id,row_number() over(order by day_order,id)n from public.routine_days where routine_id=c.routine_id)x;
 s:=coach_private.premium_weekly_schedule(c.routine_id);
 select case when v.snapshot ? 'weekly_schedule' then 'accepted_revision' when s='[]'::jsonb then 'unresolved' else 'intake_order_projection' end into source from public.routine_revisions v where v.id=c.current_revision_id;
 select coalesce(jsonb_agg(jsonb_build_object('day_ref',d->'day_ref','weekday',x->'weekday','minutes',x->'minutes') order by d->>'day_ref'),'[]') into s from jsonb_array_elements(s)x join jsonb_array_elements(days)d on d->>'day_id'=x->>'day_id';
 for previous in select w.week_number,rec.kind,rec.patches,rec.analysis_trace,wc.answers from public.coach_mesocycle_weeks w left join lateral (select * from public.coach_recommendations rr where rr.mesocycle_id=m and rr.analysis_week=w.week_number and rr.state='accepted' order by rr.accepted_at desc,rr.id desc limit 1) rec on true left join public.coach_weekly_checkins wc on wc.mesocycle_id=m and wc.week_number=w.week_number and wc.submitted_at is not null where w.mesocycle_id=m and w.week_number<c.tracking_week order by w.week_number desc limit 4 loop
  changes:='[]';for ch in select value from jsonb_array_elements(coalesce(previous.patches,'[]')) loop
   if ch->>'field'='weekly_schedule' then
    select coalesce(jsonb_agg(jsonb_build_object('day_ref',d->'day_ref','weekday',x->'weekday','minutes',x->'minutes') order by d->>'day_ref'),'[]') into summary from jsonb_array_elements(ch->'to')x left join jsonb_array_elements(days)d on d->>'day_id'=x->>'day_id';
    changes:=changes||jsonb_build_array(jsonb_build_object('action','change_week_schedule','to',summary));
   else
    select x->'ref' into ref from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=ch->>'target_id';
    changes:=changes||jsonb_build_array(jsonb_build_object('action',case ch->>'field' when 'planned_sets' then 'per_set_prescription' when 'replace_exercise' then 'replace_exercise' when 'day_id' then 'change_distribution' else 'change_'||(ch->>'field') end,'exercise_ref',ref,'historical_target',ref is null,'from',case when ch->>'field' in ('replace_exercise','day_id') then 'null'::jsonb else ch->'from' end,'to',case when ch->>'field'='replace_exercise' then jsonb_build_object('catalogue_id',ch#>'{to,catalogue_id}') when ch->>'field'='day_id' then (select x->'day_ref' from jsonb_array_elements(days)x where x->>'day_id'=ch->>'to') else ch->'to' end));
   end if;
  end loop;
  summary:=previous.answers;if summary is not null then summary:=jsonb_set(summary,'{review}',((summary->'review')-'exercise_id')||jsonb_build_object('exercise_ref',(select x->'ref' from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=summary#>>'{review,exercise_id}')));end if;
  recent:=recent||jsonb_build_array(jsonb_build_object('week',previous.week_number,'decision',previous.kind,'changes_applied',changes,'checkin_summary',summary));
 end loop;
 metadata:=jsonb_build_object('weekly_context_version','premium-weekly-provider-v1','weekly_grant_id',g,'weekly_history_grant_id',hg,'weekly_checkin_id',q.id,'weekly_checkin_version',q.row_version,'weekly_checkin_hash',case when q.id is null then null else md5(q.answers::text) end);
 return jsonb_set(b,'{provider}',(b->'provider')||jsonb_build_object('schema_version','premium-weekly-provider-v1','checkin_missing',q.id is null,'checkin',ci,'recent_weeks',recent,'week_schedule',s,'week_schedule_source',source,'timezone','Europe/Madrid'))||jsonb_build_object('weekly_metadata',metadata,'weekly_days',days);
end $function$
;
revoke all on function coach_private.premium_weekly_bundle_distribution_previous(uuid,uuid) from public, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION coach_private.premium_check_patch_distribution_previous(p jsonb, r uuid, apply_patch boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare rev uuid;ss jsonb;e public.routine_exercises;c public.coach_mesocycles;first_set jsonb;
begin
 if p->>'field' is null then raise exception 'premium_invalid_patch';end if;
 select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if p->>'field'='weekly_schedule' then perform coach_private.premium_weekly_schedule_check(p,r);return;end if;
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
end $function$
;
revoke all on function coach_private.premium_check_patch_distribution_previous(jsonb,uuid,boolean) from public, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION coach_private.premium_snapshot_distribution_previous(r uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare snap jsonb;rev uuid;day jsonb;e jsonb;ss jsonb;patch jsonb;new_ex jsonb;new_days jsonb:='[]';first_set jsonb;base_ex jsonb;base_count int;schedule_patch jsonb;stored_schedule jsonb;result jsonb;
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
 end loop;
 result:=snap||jsonb_build_object('days',new_days,'prescription_context_version','premium-prescription-v2');
 select p into schedule_patch from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='weekly_schedule';
 if schedule_patch is not null then
  if exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='rest_seconds' and (p->>'to')::int<(p->>'from')::int) or
   exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p cross join lateral jsonb_array_elements(case when p->>'field'='planned_sets' then p->'to' else '[]'::jsonb end) with ordinality a(t,n) where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and (t->>'rest_seconds')::int<(p->'from'->(n-1)::int->>'rest_seconds')::int) then raise exception 'premium_weekly_rest_compression';end if;
  perform coach_private.premium_weekly_schedule_check(schedule_patch,r,result);
  result:=result||jsonb_build_object('weekly_schedule',schedule_patch->'to','weekly_schedule_source','accepted_revision');
 else
  select v.snapshot->'weekly_schedule' into stored_schedule from public.routine_revisions v where v.id=rev;
  if stored_schedule is not null then result:=result||jsonb_build_object('weekly_schedule',stored_schedule,'weekly_schedule_source','accepted_revision');end if;
 end if;
 return result;
end $function$
;
revoke all on function coach_private.premium_snapshot_distribution_previous(uuid) from public, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION coach_private.premium_weekly_assert_distribution_previous(r coach_recommendations, require_current boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
 perform coach_private.premium_assert_admission(r.analysis_bundle->'admission_guard',r.user_id);
 perform coach_private.premium_upgrade_prior_premium_weekly_assert(r,require_current);
end $function$
;
revoke all on function coach_private.premium_weekly_assert_distribution_previous(coach_recommendations,boolean) from public, anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION coach_private.premium_recommendation_view_distribution_previous(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare u uuid:=auth.uid();r public.coach_recommendations;fs jsonb;ps jsonb;
begin
 select * into r from public.coach_recommendations where id=p_id;
 if u is null or r.id is null or not((r.user_id=u and exists(select 1 from public.profiles where id=u and role='client')) or coach_private.premium_review_access(r.mesocycle_id)) then raise exception 'premium_not_authorized' using errcode='42501';end if;
 perform coach_private.premium_weekly_assert(r,false);
 select coalesce(jsonb_agg(f||jsonb_build_object('exercise_name',(
 select je->>'name' from public.routine_revisions rv cross join lateral jsonb_array_elements(rv.snapshot->'days') jd cross join lateral jsonb_array_elements(jd->'exercises') je
 where rv.id=r.base_revision_id and je->>'id'=(select b->>'exercise_id' from jsonb_array_elements(r.analysis_bundle->'bindings') b where b->>'ref'=f->>'exercise_ref')))),'[]'::jsonb) into fs from jsonb_array_elements(r.facts) f;
 select coalesce(jsonb_agg(p||jsonb_build_object('exercise_name',(
 select je->>'name' from public.routine_revisions rv cross join lateral jsonb_array_elements(rv.snapshot->'days') jd cross join lateral jsonb_array_elements(jd->'exercises') je where rv.id=r.base_revision_id and je->>'id'=p->>'target_id'))),'[]'::jsonb) into ps from jsonb_array_elements(r.patches) p;
 return jsonb_build_object('id',r.id,'mesocycle_id',r.mesocycle_id,'routine_id',r.routine_id,'kind',r.kind,'state',r.state,'base_revision_id',r.base_revision_id,'result_revision_id',r.result_revision_id,'analysis_week',r.analysis_week,'interpretation',r.interpretation,'review_reason',r.review_reason,'facts',fs,'patches',ps,'quality_warnings',coalesce(r.analysis_trace->'quality_warnings','[]'::jsonb),'created_at',r.created_at,'reviewed_at',r.reviewed_at,'accepted_at',r.accepted_at);
end $function$
;
revoke all on function coach_private.premium_recommendation_view_distribution_previous(uuid) from public, anon, authenticated, service_role;

create or replace function coach_private.premium_distribution_metadata() returns jsonb language sql immutable set search_path=pg_catalog as $meta$
select '[{"id":"body_squat","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"reverse_lunge","primary":["quads","glutes"],"unilateral":true,"fatigue_cost":"high","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"glute_bridge","primary":["glutes"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"accessory","rep_range_category":"accessory"},{"id":"pushup","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"knee_pushup","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"dead_bug","primary":["core"],"unilateral":true,"fatigue_cost":"low","stable":true,"type":"core","rep_range_category":"control"},{"id":"bird_dog","primary":["core"],"unilateral":true,"fatigue_cost":"low","stable":true,"type":"core","rep_range_category":"control"},{"id":"calf_raise","primary":["calves"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"calf","rep_range_category":"accessory"},{"id":"goblet","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"db_rdl","primary":["hamstrings","glutes"],"unilateral":false,"fatigue_cost":"high","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"db_row","primary":["back","upper_back"],"unilateral":true,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"floor_press","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"db_shoulder","primary":["deltoids"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"db_lateral","primary":["deltoids"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"db_curl","primary":["biceps"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"band_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"band_curl","primary":["biceps"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"bar_squat","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"high","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"bar_rdl","primary":["hamstrings","glutes"],"unilateral":false,"fatigue_cost":"high","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"bar_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"leg_press","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"high","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"leg_curl","primary":["hamstrings"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"pulldown","primary":["back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"cable_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"chest_press","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"cable_triceps","primary":["triceps"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"incline_press","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"convergent_press","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"pec_deck","primary":["chest"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"horizontal_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"convergent_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"supported_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"high_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"low_row","primary":["back","upper_back"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"pullover","primary":["back"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"pullup","primary":["back"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"hack","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"high","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"pendulum","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"high","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"horizontal_press","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"high","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"leg_extension","primary":["quads"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"seated_curl","primary":["hamstrings"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"adductor","primary":["adductors"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"abductor","primary":["glutes"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"hip_thrust","primary":["glutes"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"accessory","rep_range_category":"accessory"},{"id":"seated_calf","primary":["calves"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"calf","rep_range_category":"accessory"},{"id":"standing_calf","primary":["calves"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"calf","rep_range_category":"accessory"},{"id":"shoulder_press","primary":["deltoids"],"unilateral":false,"fatigue_cost":"moderate","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"lateral","primary":["deltoids"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"rear_delt","primary":["deltoids"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"preacher","primary":["biceps"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"curl","primary":["biceps"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"triceps","primary":["triceps"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"accessory"},{"id":"smith_squat","primary":["quads","glutes"],"unilateral":false,"fatigue_cost":"high","stable":true,"type":"machine_compound","rep_range_category":"compound"},{"id":"bench_press","primary":["chest"],"unilateral":false,"fatigue_cost":"moderate","stable":false,"type":"compound","rep_range_category":"compound"},{"id":"floor_crunch","primary":["core"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"dynamic_abs"},{"id":"reverse_crunch","primary":["core"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"dynamic_abs"},{"id":"weighted_crunch","primary":["core"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"dynamic_abs"},{"id":"cable_crunch","primary":["core"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"dynamic_abs"},{"id":"machine_crunch","primary":["core"],"unilateral":false,"fatigue_cost":"low","stable":true,"type":"isolation","rep_range_category":"dynamic_abs"},{"id":"ab_wheel","primary":["core"],"unilateral":false,"fatigue_cost":"low","stable":false,"type":"isolation","rep_range_category":"control"}]'::jsonb
$meta$;

-- Only training identity, order and prescription take part in the source fingerprint.
create or replace function coach_private.premium_distribution_base(r uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $fn$
declare s jsonb;d jsonb;e jsonb;ds jsonb:='[]';es jsonb;
begin
 s:=coach_private.premium_snapshot_distribution_previous(r);
 for d in select value from jsonb_array_elements(s->'days') loop
  es:='[]';for e in select value from jsonb_array_elements(d->'exercises') loop
   es:=es||jsonb_build_array(e-array['created_at','updated_at','notes']);
  end loop;
  ds:=ds||jsonb_build_array((d-'created_at')||jsonb_build_object('exercises',es));
 end loop;
 return jsonb_build_object('routine',jsonb_build_object('id',s#>'{routine,id}','name',s#>'{routine,name}'),'prescription_context_version','premium-prescription-v2','days',ds);
end $fn$;

create or replace function coach_private.premium_weekly_bundle(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $fn$
declare b jsonb;a jsonb;c public.coach_mesocycles;recent jsonb:='[]';week jsonb;changes jsonb;ch jsonb;
begin
 b:=coach_private.premium_weekly_bundle_distribution_previous(m,u);select * into c from public.coach_mesocycles where id=m;
 a:=case when b#>'{provider,checkin,availability,changed}'='true'::jsonb then b#>'{provider,checkin,availability}' else c.intake end;
 for week in select value from jsonb_array_elements(b#>'{provider,recent_weeks}') loop
  changes:='[]';for ch in select value from jsonb_array_elements(week->'changes_applied') loop
   if ch->>'action'='change_session_distribution' then ch:=jsonb_build_object('action','change_session_distribution','sessions_after',jsonb_array_length(ch#>'{to,snapshot,days}'),'sets_before',ch#>'{to,quality,sets_before}','sets_after',ch#>'{to,quality,sets_after}');end if;
   changes:=changes||jsonb_build_array(ch);
  end loop;recent:=recent||jsonb_build_array(week||jsonb_build_object('changes_applied',changes));
 end loop;
 b:=jsonb_set(b,'{provider,recent_weeks}',recent);
 b:=jsonb_set(b,'{weekly_metadata}',b->'weekly_metadata'||jsonb_build_object('prompt_version','premium-weekly-distribution-v1','response_schema_version','premium-weekly-distribution-v1'));
 return jsonb_set(b,'{provider}',(b->'provider')||jsonb_build_object('session_distribution_version','premium-session-distribution-v1',
  'distribution_availability',jsonb_build_object('weekdays',a->'weekdays','minutes_by_day',a->'minutes_by_day')))||
  jsonb_build_object('distribution_guard',jsonb_build_object('intake_hash',md5(c.intake::text),'bindings_hash',md5(c.catalogue_bindings::text),'source_hash',md5(coach_private.premium_distribution_base(c.routine_id)::text)));
end $fn$;

create or replace function coach_private.premium_weekly_assert(r public.coach_recommendations,require_current boolean default true) returns void language plpgsql stable security definer set search_path=pg_catalog,public as $fn$
declare c public.coach_mesocycles;g jsonb;
begin
 perform coach_private.premium_weekly_assert_distribution_previous(r,require_current);
 if require_current and r.analysis_bundle#>>'{provider,session_distribution_version}'='premium-session-distribution-v1' then
  select * into c from public.coach_mesocycles where id=r.mesocycle_id;g:=r.analysis_bundle->'distribution_guard';
  if g->>'intake_hash' is distinct from md5(c.intake::text) or g->>'bindings_hash' is distinct from md5(c.catalogue_bindings::text) or
   g->>'source_hash' is distinct from md5(coach_private.premium_distribution_base(r.routine_id)::text) then raise exception 'premium_weekly_stale_context';end if;
 end if;
end $fn$;

-- Full result is compiled from private UUID bindings; model output never contains UUIDs.
-- Allocations are generated once when capturing the proposal, not on every acceptance.
create or replace function coach_private.premium_compile_distribution(r public.coach_recommendations,ch jsonb,alloc jsonb default '{}') returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare b jsonb:=r.analysis_bundle;p jsonb:=b->'provider';base jsonb;available jsonb;session jsonb;item jsonb;binding jsonb;old_day jsonb;old_ex jsonb;
 did uuid;eid uuid;ref text;cat jsonb;meta jsonb;ss jsonb;first_set jsonb;days jsonb:='[]';exercises jsonb;schedule jsonb:='[]';bindings jsonb:='{}';
 used text[]:='{}';removed text[]:='{}';used_days text[]:='{}';weekdays text[]:='{}';used_cat text[]:='{}';omitted text[]:='{}';
 n int:=0;k int;before_sets int:=0;after_sets int:=0;seconds numeric;warnings jsonb:='[]';groups_before jsonb:='{}';groups_after jsonb:='{}';frequency jsonb:='{}';day_groups text[];g text;
 original_schedule jsonb;declared_action text;reason text;compiled jsonb;
begin
 if p->>'session_distribution_version' is distinct from 'premium-session-distribution-v1' or
  coach_private.keys_exact(ch,array['action','sessions','removed_sessions','removed_exercises','volume_reason']) is not true or ch->>'action'<>'change_session_distribution' or
  jsonb_typeof(ch->'sessions') is distinct from 'array' or jsonb_array_length(ch->'sessions') not between 1 and 7 or
  jsonb_typeof(ch->'removed_sessions') is distinct from 'array' or jsonb_typeof(ch->'removed_exercises') is distinct from 'array' or
  jsonb_array_length(ch->'removed_sessions')>7 or jsonb_array_length(ch->'removed_exercises')>40 or
  not (ch->'volume_reason'='null'::jsonb or (jsonb_typeof(ch->'volume_reason')='string' and length(ch->>'volume_reason') between 1 and 400)) then raise exception 'premium_distribution_invalid_shape';end if;
 if r.base_revision_id is distinct from (select current_revision_id from public.routine_management where routine_id=r.routine_id and plan_kind='premium') then raise exception 'premium_stale_revision';end if;
 perform coach_private.premium_weekly_assert(r,true);
 base:=coach_private.premium_distribution_base(r.routine_id);available:=p->'distribution_availability';
 if jsonb_typeof(available->'weekdays') is distinct from 'array' or jsonb_typeof(available->'minutes_by_day') is distinct from 'object' then raise exception 'premium_distribution_availability_missing';end if;
 for old_ex in select x from jsonb_array_elements(base->'days')d cross join lateral jsonb_array_elements(d->'exercises')x loop
  ss:=old_ex->'planned_sets';if not coach_private.premium_sets_valid(ss) then raise exception 'premium_current_prescription_unresolved';end if;
  before_sets:=before_sets+jsonb_array_length(ss);
  select x into binding from jsonb_array_elements(b->'bindings')x where x->>'exercise_id'=old_ex->>'id';
  if binding is null or binding->>'catalogue_id' is null then raise exception 'premium_distribution_unmapped';end if;
  select x into meta from jsonb_array_elements(coach_private.premium_distribution_metadata())x where x->>'id'=binding->>'catalogue_id';
  for g in select jsonb_array_elements_text(meta->'primary') loop groups_before:=jsonb_set(groups_before,array[g],to_jsonb(coalesce((groups_before->>g)::int,0)+jsonb_array_length(ss)));end loop;
 end loop;
 original_schedule:=coach_private.premium_weekly_schedule(r.routine_id);
 for session in select value from jsonb_array_elements(ch->'sessions') loop
  if coach_private.keys_exact(session,array['action','session_ref','weekday','minutes','exercises']) is not true or
   jsonb_typeof(session->'session_ref') is distinct from 'string' or length(session->>'session_ref')>32 or
   jsonb_typeof(session->'weekday') is distinct from 'string' or not(session->>'weekday'=any(array['mon','tue','wed','thu','fri','sat','sun'])) or
   jsonb_typeof(session->'minutes') is distinct from 'number' or not(session->>'minutes' ~ '^[0-9]+$') or
   (session->>'minutes')::int not between 15 and 120 or jsonb_typeof(session->'exercises') is distinct from 'array' or jsonb_array_length(session->'exercises') not between 1 and 40 then raise exception 'premium_distribution_invalid_session';end if;
  ref:=session->>'session_ref';declared_action:=session->>'action';
  if ref=any(used_days) or session->>'weekday'=any(weekdays) then raise exception 'premium_distribution_duplicate_session';end if;
  used_days:=array_append(used_days,ref);weekdays:=array_append(weekdays,session->>'weekday');
  if not(available->'weekdays' ? (session->>'weekday')) or (session->>'minutes')::int>coalesce((available->'minutes_by_day'->>(session->>'weekday'))::int,0) then raise exception 'premium_distribution_weekday_unavailable';end if;
  select x into binding from jsonb_array_elements(b->'weekly_days')x where x->>'day_ref'=ref;
  old_day:=null;
  if binding is not null then
   if declared_action not in ('keep_session','move_session') then raise exception 'premium_distribution_session_identity';end if;
   did:=(binding->>'day_id')::uuid;select x into old_day from jsonb_array_elements(base->'days')x where x->>'id'=did::text;
   if old_day is null then raise exception 'premium_distribution_session_identity';end if;
   if declared_action='keep_session' and (old_day->>'day_order')::int<>n then raise exception 'premium_distribution_move_not_declared';end if;
   if declared_action='keep_session' and exists(select 1 from jsonb_array_elements(original_schedule)x where x->>'day_id'=did::text and x->>'weekday'<>session->>'weekday') then raise exception 'premium_distribution_move_not_declared';end if;
  else
   if declared_action<>'add_session' or not(ref ~ '^new_day_[1-9][0-9]*$') then raise exception 'premium_distribution_session_identity';end if;
   did:=coalesce((alloc->>ref)::uuid,gen_random_uuid());alloc:=alloc||jsonb_build_object(ref,did);
   if exists(select 1 from public.routine_days where id=did) then raise exception 'premium_distribution_identity_collision';end if;
   old_day:=jsonb_build_object('id',did,'routine_id',r.routine_id,'name','Sesión '||(n+1),'day_order',n);
  end if;
  exercises:='[]';seconds:=300;k:=0;day_groups:='{}';
  for item in select value from jsonb_array_elements(session->'exercises') loop
   if coach_private.keys_exact(item,array['exercise_ref','catalogue_id','planned_sets']) is not true or jsonb_typeof(item->'exercise_ref') is distinct from 'string' or
    length(item->>'exercise_ref')>32 or jsonb_typeof(item->'catalogue_id') is distinct from 'string' or not coach_private.premium_sets_valid(item->'planned_sets') then raise exception 'premium_distribution_invalid_exercise';end if;
   ref:=item->>'exercise_ref';ss:=item->'planned_sets';first_set:=ss->0;
   if ref=any(used) then raise exception 'premium_distribution_duplicate_exercise';end if;used:=array_append(used,ref);
   select x into binding from jsonb_array_elements(b->'bindings')x where x->>'ref'=ref;
   old_ex:=null;
   if binding is not null then
    if binding->>'catalogue_id' is distinct from item->>'catalogue_id' then raise exception 'premium_distribution_exercise_identity';end if;
    eid:=(binding->>'exercise_id')::uuid;
    select x into old_ex from jsonb_array_elements(base->'days')d cross join lateral jsonb_array_elements(d->'exercises')x where x->>'id'=eid::text;
    if old_ex is null then raise exception 'premium_distribution_exercise_identity';end if;
    if exists(select 1 from jsonb_array_elements(ss) with ordinality a(t,i) where (t->>'rest_seconds')::int<(old_ex->'planned_sets'->(i-1)::int->>'rest_seconds')::int) then raise exception 'premium_distribution_rest_compression';end if;
   else
    if not(ref ~ '^new_exercise_[1-9][0-9]*$') then raise exception 'premium_distribution_exercise_identity';end if;
    eid:=coalesce((alloc->>ref)::uuid,gen_random_uuid());alloc:=alloc||jsonb_build_object(ref,eid);
    if exists(select 1 from public.routine_exercises where id=eid) then raise exception 'premium_distribution_identity_collision';end if;
   end if;
   select x into cat from jsonb_array_elements(coach_private.premium_catalogue())x where x->>'id'=item->>'catalogue_id';
   select x into meta from jsonb_array_elements(coach_private.premium_distribution_metadata())x where x->>'id'=item->>'catalogue_id';
 if cat is null or meta is null or p#>'{intake,excluded}' ? (item->>'catalogue_id') or
    not exists(select 1 from jsonb_array_elements(p->'allowed_replacements')x where x->>'id'=item->>'catalogue_id') or
    exists(select 1 from jsonb_array_elements_text(cat->'requires')req where not(p#>'{intake,inventory,equipment}' ? req)) then raise exception 'premium_distribution_excluded_or_unavailable';end if;
   if old_ex is null or ss is distinct from old_ex->'planned_sets' then
    if not coach_private.premium_sets_valid(ss,true) or exists(select 1 from jsonb_array_elements(ss)x where (x->>'reps_min')::int < case when meta->>'rep_range_category'='control' then 6 when meta->>'rep_range_category' in ('accessory','dynamic_abs') then 8 else 5 end or (x->>'reps_max')::int > case when meta->>'rep_range_category' in ('accessory','dynamic_abs') then 20 else 15 end) then raise exception 'premium_distribution_catalogue_prescription_bounds';end if;
   end if;
   if p#>>'{intake,experience}' in ('lt6','m6_12') and exists(select 1 from jsonb_array_elements(ss)x where (x->>'rir')::int<2) then raise exception 'premium_beginner_rir';end if;
   if item->>'catalogue_id'=any(used_cat) then warnings:=warnings||jsonb_build_array('repeated_catalogue_requires_reason:'||(item->>'catalogue_id'));end if;used_cat:=array_append(used_cat,item->>'catalogue_id');
   if old_ex is null then old_ex:=jsonb_build_object('id',eid,'name',cat->>'name');end if;
   old_ex:=old_ex||jsonb_build_object('day_id',did,'exercise_order',k,'sets',jsonb_array_length(ss),'target',(first_set->>'reps_min')||'-'||(first_set->>'reps_max'),'rir',first_set->>'rir','rest_seconds',first_set->'rest_seconds',
    'reps_min',first_set->'reps_min','reps_max',first_set->'reps_max','planned_sets',ss,'scheme',case when coach_private.premium_series_uniform(ss) then 'straight' else 'variable' end);
   exercises:=exercises||jsonb_build_array(old_ex);bindings:=bindings||jsonb_build_object(eid,item->'catalogue_id');
   after_sets:=after_sets+jsonb_array_length(ss);seconds:=seconds+120+(select sum((x->>'reps_max')::int*4*case when (meta->>'unilateral')::boolean then 2 else 1 end+(x->>'rest_seconds')::int+case when (meta->>'unilateral')::boolean then 15 else 0 end) from jsonb_array_elements(ss)x);
   for g in select jsonb_array_elements_text(meta->'primary') loop groups_after:=jsonb_set(groups_after,array[g],to_jsonb(coalesce((groups_after->>g)::int,0)+jsonb_array_length(ss)));if not(g=any(day_groups)) then day_groups:=array_append(day_groups,g);end if;end loop;
   if meta->>'fatigue_cost'='high' and exists(select 1 from jsonb_array_elements(ss)x where (x->>'rir')::int=0) then warnings:=warnings||jsonb_build_array('high_cost_failure:'||ref);end if;
   k:=k+1;
  end loop;
  for g in select unnest(day_groups) loop frequency:=jsonb_set(frequency,array[g],to_jsonb(coalesce((frequency->>g)::int,0)+1));end loop;
  if ceil(seconds/60)>(session->>'minutes')::int then raise exception 'premium_distribution_session_too_short';end if;
  if p#>>'{intake,activity,type}' is distinct from 'none' and p#>'{intake,activity,weekdays}' ? (session->>'weekday') and day_groups && array['quads','glutes','hamstrings','calves'] then warnings:=warnings||jsonb_build_array('external_activity_overlap:'||(session->>'session_ref'));end if;
  days:=days||jsonb_build_array(old_day||jsonb_build_object('day_order',n,'exercises',exercises));
  schedule:=schedule||jsonb_build_array(jsonb_build_object('day_id',did,'weekday',session->'weekday','minutes',session->'minutes','estimated_minutes',ceil(seconds/60)));
  n:=n+1;
 end loop;
 for item in select value from jsonb_array_elements(ch->'removed_exercises') loop
  if coach_private.keys_exact(item,array['exercise_ref','reason']) is not true or jsonb_typeof(item->'reason') is distinct from 'string' or length(btrim(item->>'reason')) not between 1 and 400 or
   item->>'exercise_ref'=any(used) or item->>'exercise_ref'=any(removed) or not exists(select 1 from jsonb_array_elements(b->'bindings')x where x->>'ref'=item->>'exercise_ref') then raise exception 'premium_distribution_invalid_removal';end if;
  removed:=array_append(removed,item->>'exercise_ref');
 end loop;
 if exists(select 1 from jsonb_array_elements(b->'bindings')x where not(x->>'ref'=any(used)) and not(x->>'ref'=any(removed))) then raise exception 'premium_distribution_silent_exercise_loss';end if;
 select coalesce(array_agg(x->>'day_ref' order by x->>'day_ref'),'{}') into omitted from jsonb_array_elements(b->'weekly_days')x where not(x->>'day_ref'=any(used_days));
 if (select coalesce(array_agg(x order by x),'{}') from jsonb_array_elements_text(ch->'removed_sessions')x) is distinct from omitted then raise exception 'premium_distribution_silent_session_loss';end if;
 if (select count(distinct value) from jsonb_each_text(alloc))<>(select count(*) from jsonb_each_text(alloc)) then raise exception 'premium_distribution_identity_collision';end if;
 reason:=nullif(btrim(ch->>'volume_reason'),'');
 if after_sets>before_sets and reason is null then raise exception 'premium_distribution_volume_increase_unjustified';end if;
 if after_sets<>before_sets then warnings:=warnings||jsonb_build_array('weekly_volume_changed:'||before_sets||'->'||after_sets);end if;
 for g in select jsonb_object_keys(groups_before) loop if not(groups_after ? g) then warnings:=warnings||jsonb_build_array('muscle_coverage_removed:'||g);end if;end loop;
 for g in select jsonb_object_keys(frequency) loop if (frequency->>g)::int=1 then warnings:=warnings||jsonb_build_array('single_weekly_exposure:'||g);end if;end loop;
 warnings:=warnings||'["whole_program_distribution_requires_review"]'::jsonb;
 compiled:=base||jsonb_build_object('days',days,'weekly_schedule',(select jsonb_agg(x-'estimated_minutes') from jsonb_array_elements(schedule)x),'weekly_schedule_source','accepted_revision','session_distribution_version','premium-session-distribution-v1');
 return jsonb_build_object('change',ch,'allocations',alloc,'snapshot',compiled,'bindings',bindings,'quality',jsonb_build_object('sets_before',before_sets,'sets_after',after_sets,'muscle_sets_before',groups_before,'muscle_sets_after',groups_after,'frequency_after',frequency,'schedule',schedule,'volume_reason',reason,'warnings',warnings));
end $fn$;

create or replace function coach_private.premium_output_patches(r public.coach_recommendations,v jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare changes jsonb;legacy jsonb;compiled jsonb;validation jsonb;
begin
 if v->>'schema_version' is distinct from 'premium-weekly-distribution-v1' then return coach_private.premium_output_patches_distribution_previous(r,v);end if;
 if r.analysis_bundle#>>'{provider,session_distribution_version}' is distinct from 'premium-session-distribution-v1' then raise exception 'premium_distribution_context_required';end if;
 select coalesce(jsonb_agg(x),'[]') into changes from jsonb_array_elements(v->'changes')x where x->>'action'='change_session_distribution';
 legacy:=v||jsonb_build_object('schema_version','premium-weekly-analysis-v1');
 if changes='[]'::jsonb then
  if exists(select 1 from jsonb_array_elements(v->'changes')x join jsonb_array_elements(r.analysis_bundle->'bindings')b on b->>'ref'=x->>'exercise_ref' where x->>'action'<>'replace_exercise' and r.analysis_bundle#>'{provider,intake,excluded}' ? (b->>'catalogue_id')) then raise exception 'premium_distribution_excluded_target';end if;
  return coach_private.premium_output_patches_distribution_previous(r,legacy);
 end if;
 if v->>'kind'<>'MODIFY' or jsonb_array_length(changes)<>1 or jsonb_array_length(v->'changes')<>1 then raise exception 'premium_distribution_must_be_atomic';end if;
 -- Existing server validation of facts, signals, language and shape is retained.
 validation:=coach_private.premium_output_patches_distribution_previous(r,legacy||jsonb_build_object('kind','REVIEW','changes','[]'::jsonb));
 compiled:=coach_private.premium_compile_distribution(r,changes->0);
 return jsonb_build_array(jsonb_build_object('target_id',r.routine_id,'field','session_distribution',
  'from',r.analysis_bundle#>'{distribution_guard,source_hash}','to',compiled));
end $fn$;

create or replace function coach_private.premium_check_patch(p jsonb,r uuid,apply_patch boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare rec public.coach_recommendations;compiled jsonb;d jsonb;e jsonb;s jsonb;parent uuid;old_id uuid;
begin
 if p->>'field' is distinct from 'session_distribution' then perform coach_private.premium_check_patch_distribution_previous(p,r,apply_patch);return;end if;
 if coach_private.keys_exact(p,array['field','from','target_id','to']) is not true or p->>'target_id' is distinct from r::text then raise exception 'premium_distribution_invalid_patch';end if;
 select * into rec from public.coach_recommendations c where c.routine_id=r and c.state in ('pending_review','ready') and c.base_revision_id=(select current_revision_id from public.routine_management where routine_id=r) and c.patches=jsonb_build_array(p);
 if rec.id is null then raise exception 'premium_distribution_untrusted_patch';end if;
 if p->>'from' is distinct from md5(coach_private.premium_distribution_base(r)::text) then raise exception 'premium_stale_revision';end if;
 compiled:=coach_private.premium_compile_distribution(rec,p#>'{to,change}',p#>'{to,allocations}');
 if compiled is distinct from p->'to' then raise exception 'premium_distribution_stale_or_tampered';end if;
 if not apply_patch then return;end if;
 if rec.state<>'ready' or rec.apply_txid is distinct from txid_current() then raise exception 'premium_distribution_acceptance_required';end if;
 -- Existing management/recommendation locks and guard_structure enclose every write.
 for d in select value from jsonb_array_elements(compiled#>'{snapshot,days}') loop
  parent:=(d->>'id')::uuid;
  insert into public.routine_days(id,routine_id,name,day_order) values(parent,r,d->>'name',(d->>'day_order')::int)
   on conflict(id) do update set day_order=excluded.day_order;
 end loop;
 for d in select value from jsonb_array_elements(compiled#>'{snapshot,days}') loop
  parent:=(d->>'id')::uuid;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order)
   values((e->>'id')::uuid,parent,e->>'name',(e->>'sets')::int,e->>'target',e->>'rir',(e->>'rest_seconds')::int,(e->>'exercise_order')::int)
   on conflict(id) do update set day_id=excluded.day_id,sets=excluded.sets,target=excluded.target,rir=excluded.rir,rest_seconds=excluded.rest_seconds,exercise_order=excluded.exercise_order
   where (routine_exercises.day_id,routine_exercises.sets,routine_exercises.target,routine_exercises.rir,routine_exercises.rest_seconds,routine_exercises.exercise_order)
   is distinct from (excluded.day_id,excluded.sets,excluded.target,excluded.rir,excluded.rest_seconds,excluded.exercise_order);
  end loop;
 end loop;
 -- Every deletion was explicitly enumerated and validated; never rely on cascading content loss.
 for old_id in select x.id from public.routine_exercises x join public.routine_days d on d.id=x.day_id where d.routine_id=r and not(compiled->'bindings' ? x.id::text) loop
  delete from public.routine_exercises where id=old_id;
 end loop;
 for old_id in select x.id from public.routine_days x where x.routine_id=r and not exists(select 1 from jsonb_array_elements(compiled#>'{snapshot,days}')jd where jd->>'id'=x.id::text) loop
  if exists(select 1 from public.routine_exercises where day_id=old_id) then raise exception 'premium_distribution_nonempty_session';end if;
  delete from public.routine_days where id=old_id;
 end loop;
 update public.coach_mesocycles set catalogue_bindings=compiled->'bindings' where id=rec.mesocycle_id;
end $fn$;

create or replace function coach_private.premium_snapshot(r uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $fn$
declare p jsonb;d jsonb;e jsonb;s jsonb;
begin
 select x into p from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)x where rec.routine_id=r and rec.state='ready' and rec.apply_txid=txid_current() and x->>'field'='session_distribution';
 if p is null then return coach_private.premium_snapshot_distribution_previous(r);end if;
 s:=p#>'{to,snapshot}';
 if (select count(*) from public.routine_days where routine_id=r)<>jsonb_array_length(s->'days') or
  (select count(*) from public.routine_exercises x join public.routine_days d on d.id=x.day_id where d.routine_id=r)<>(select count(*) from jsonb_array_elements(s->'days')jd cross join lateral jsonb_array_elements(jd->'exercises')x) then raise exception 'premium_distribution_live_mismatch';end if;
 for d in select value from jsonb_array_elements(s->'days') loop
  if not exists(select 1 from public.routine_days x where x.id=(d->>'id')::uuid and x.routine_id=r and x.name=d->>'name' and x.day_order=(d->>'day_order')::int) then raise exception 'premium_distribution_live_mismatch';end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if not exists(select 1 from public.routine_exercises x where x.id=(e->>'id')::uuid and x.day_id=(d->>'id')::uuid and x.name=e->>'name' and x.sets=(e->>'sets')::int and x.target=e->>'target' and x.rir=e->>'rir' and x.rest_seconds=(e->>'rest_seconds')::int and x.exercise_order=(e->>'exercise_order')::int) then raise exception 'premium_distribution_live_mismatch';end if;
  end loop;
 end loop;
 return s;
end $fn$;

-- Safe proposal projection: full training prescriptions, but no notes, tokens, private history or conversations.
create or replace function coach_private.premium_distribution_projection(s jsonb,schedule jsonb,rev uuid default null) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $fn$
declare d jsonb;e jsonb;es jsonb;ds jsonb:='[]';ss jsonb;w jsonb;
begin
 for d in select value from jsonb_array_elements(s->'days') loop
  es:='[]';
  for e in select value from jsonb_array_elements(d->'exercises') loop
   ss:=e->'planned_sets';if ss is null and rev is not null then ss:=coach_private.premium_revision_sets(rev,(e->>'id')::uuid);end if;
   es:=es||jsonb_build_array(jsonb_build_object('name',e->'name','planned_sets',ss));
  end loop;
  select x into w from jsonb_array_elements(coalesce(schedule,'[]'))x where x->>'day_id'=d->>'id';
  ds:=ds||jsonb_build_array(jsonb_build_object('name',d->'name','weekday',w->'weekday','minutes',w->'minutes','estimated_minutes',w->'estimated_minutes','exercises',es));
 end loop;
 return jsonb_build_object('sessions',ds);
end $fn$;

create or replace function public.premium_recommendation_view(p_id uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $fn$
declare result jsonb;rec public.coach_recommendations;p jsonb;ps jsonb:='[]';before_s jsonb;after_s jsonb;removed jsonb;
begin
 -- Existing per-user or assigned-reviewer authorization remains authoritative.
 result:=coach_private.premium_recommendation_view_distribution_previous(p_id);
 select * into rec from public.coach_recommendations where id=p_id;
 for p in select value from jsonb_array_elements(result->'patches') loop
  if p->>'field'='session_distribution' then
   select snapshot into before_s from public.routine_revisions where id=rec.base_revision_id;
   before_s:=coach_private.premium_distribution_projection(before_s,before_s->'weekly_schedule',rec.base_revision_id);
   after_s:=coach_private.premium_distribution_projection(p#>'{to,snapshot}',p#>'{to,quality,schedule}');
   select coalesce(jsonb_agg(jsonb_build_object('name',e->'name','reason',x->'reason')),'[]') into removed
    from jsonb_array_elements(p#>'{to,change,removed_exercises}')x join lateral (select b->>'exercise_id' id from jsonb_array_elements(rec.analysis_bundle->'bindings')b where b->>'ref'=x->>'exercise_ref')b on true
    join lateral (select e from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')e where v.id=rec.base_revision_id and e->>'id'=b.id)t on true;
   after_s:=after_s||jsonb_build_object('quality',p#>'{to,quality}','removed_exercises',removed,'actions',(select jsonb_agg(jsonb_build_object('action',x->'action','weekday',x->'weekday')) from jsonb_array_elements(p#>'{to,change,sessions}')x),'removed_sessions',p#>'{to,change,removed_sessions}');
   p:=jsonb_build_object('field','session_distribution','exercise_name','Distribución de sesiones','from',before_s,'to',after_s);
   result:=jsonb_set(result,'{quality_warnings}',coalesce(result->'quality_warnings','[]')||coalesce(after_s#>'{quality,warnings}','[]'));
  end if;
  ps:=ps||jsonb_build_array(p);
 end loop;
 return jsonb_set(result,'{patches}',ps);
end $fn$;
revoke all on function coach_private.premium_distribution_metadata() from public,anon,authenticated,service_role;
revoke all on function coach_private.premium_distribution_base(uuid) from public,anon,authenticated,service_role;
revoke all on function coach_private.premium_compile_distribution(public.coach_recommendations,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function coach_private.premium_distribution_projection(jsonb,jsonb,uuid) from public,anon,authenticated,service_role;
