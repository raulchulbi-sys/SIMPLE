-- Use only before a distribution revision has been accepted. Never rewrite a historical revision.
do $$ begin if exists(select 1 from public.routine_revisions where snapshot->>'session_distribution_version'='premium-session-distribution-v1') then raise exception 'distribution_rollback_requires_forward_compatibility'; end if; end $$;
CREATE OR REPLACE FUNCTION coach_private.premium_output_patches(r coach_recommendations, v jsonb)
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

CREATE OR REPLACE FUNCTION coach_private.premium_weekly_bundle(m uuid, u uuid)
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

CREATE OR REPLACE FUNCTION coach_private.premium_snapshot(r uuid)
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

CREATE OR REPLACE FUNCTION coach_private.premium_weekly_assert(r coach_recommendations, require_current boolean DEFAULT true)
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

CREATE OR REPLACE FUNCTION public.premium_recommendation_view(p_id uuid)
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
drop function coach_private.premium_compile_distribution(public.coach_recommendations,jsonb,jsonb);
drop function coach_private.premium_distribution_base(uuid);
drop function coach_private.premium_distribution_projection(jsonb,jsonb,uuid);
drop function coach_private.premium_distribution_metadata();
drop function coach_private.premium_output_patches_distribution_previous(coach_recommendations,jsonb);
drop function coach_private.premium_weekly_bundle_distribution_previous(uuid,uuid);
drop function coach_private.premium_check_patch_distribution_previous(jsonb,uuid,boolean);
drop function coach_private.premium_snapshot_distribution_previous(uuid);
drop function coach_private.premium_weekly_assert_distribution_previous(coach_recommendations,boolean);
drop function coach_private.premium_recommendation_view_distribution_previous(uuid);
