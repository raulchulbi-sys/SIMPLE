-- STAGING ONLY: additive per-set extension. No Basic, Auth, policies or training history rewrites.
begin;
__BACKUPS__
create or replace function coach_private.premium_sets_valid(ss jsonb,strict boolean default false) returns boolean language plpgsql immutable set search_path=pg_catalog as $$
declare s jsonb;n int:=0;k text;
begin
 if jsonb_typeof(ss) is distinct from 'array' then return false;end if;
 if jsonb_array_length(ss) not between 1 and 12 then return false;end if;
 for s in select value from jsonb_array_elements(ss) loop
  n:=n+1;
  if jsonb_typeof(s) is distinct from 'object' or (select array_agg(x order by x) from jsonb_object_keys(s)x) is distinct from array['reps_max','reps_min','rest_seconds','rir','set_number'] then return false;end if;
  for k in select unnest(array['set_number','reps_min','reps_max','rir','rest_seconds']) loop
   if jsonb_typeof(s->k) is distinct from 'number' or s->>k !~ '^[0-9]{1,3}$' then return false;end if;
  end loop;
  if (s->>'set_number')::int<>n or (s->>'reps_min')::int<5 or (s->>'reps_max')::int>20 or (s->>'reps_min')::int>(s->>'reps_max')::int
   or (s->>'rir')::int>(case when strict then 4 else 5 end) or (s->>'rest_seconds')::int not between (case when strict then 60 else 30 end) and 300 then return false;end if;
 end loop;return true;
end $$;
create or replace function coach_private.premium_revision_sets(rev uuid,eid uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare e jsonb;ss jsonb;n int;lo int;hi int;
begin
 select x into e from public.routine_revisions r cross join lateral jsonb_array_elements(r.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where r.id=rev and x->>'id'=eid::text;
 if not found or (select count(*) from public.routine_revisions r cross join lateral jsonb_array_elements(r.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where r.id=rev and x->>'id'=eid::text)<>1 then return null;end if;
 if not coalesce(e->>'sets' ~ '^[1-9][0-9]?$',false) then return null;end if;
 if e ? 'planned_sets' then
  if not coach_private.premium_sets_valid(e->'planned_sets') or jsonb_array_length(e->'planned_sets') is distinct from (e->>'sets')::int then return null;end if;
  return e->'planned_sets';
 end if;
 if e->>'sets' !~ '^[1-9][0-9]?$' or (e->>'sets')::int>12 or e->>'target' !~ '^[1-9][0-9]?(-[1-9][0-9]?)?$' or e->>'rir' !~ '^[0-5]$' or e->>'rest_seconds' !~ '^[0-9]{1,3}$' then return null;end if;
 n:=(e->>'sets')::int;lo:=split_part(e->>'target','-',1)::int;hi:=coalesce(nullif(split_part(e->>'target','-',2),''),lo::text)::int;
 select jsonb_agg(jsonb_build_object('set_number',i,'reps_min',lo,'reps_max',hi,'rir',(e->>'rir')::int,'rest_seconds',(e->>'rest_seconds')::int) order by i) into ss from generate_series(1,n)i;
 if not coach_private.premium_sets_valid(ss) then return null;end if;return ss;
end $$;
create or replace function coach_private.premium_series_uniform(ss jsonb) returns boolean language sql immutable set search_path=pg_catalog as $$
 select coalesce(jsonb_typeof(ss)='array' and not exists(select 1 from jsonb_array_elements(ss) s where s-'set_number' is distinct from (ss->0)-'set_number'),false)
$$;

create or replace function coach_private.premium_bundle(m uuid,u uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare b jsonb;ctx jsonb;e jsonb;binding jsonb;hist jsonb;exposure jsonb;ss jsonb;hs jsonb;actual jsonb;out_ex jsonb:='[]';out_history jsonb;out_sets jsonb;w public.workouts;rid uuid;raw jsonb;source text;issue text;hss jsonb;hist_e jsonb;pn int;ps jsonb;fmt text;sn int;identity_ok boolean;
begin
 b:=coach_private.premium_bundle_v1(m,u);ctx:=b->'provider';
 for e in select value from jsonb_array_elements(ctx#>'{routine,exercises}') loop
  select x into binding from jsonb_array_elements(b->'bindings') x where x->>'ref'=e->>'ref';
  select current_revision_id into rid from public.coach_mesocycles where id=m;
  ss:=coach_private.premium_revision_sets(rid,(binding->>'exercise_id')::uuid);
  select x into raw from public.routine_revisions r cross join lateral jsonb_array_elements(r.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where r.id=rid and x->>'id'=binding->>'exercise_id';
  fmt:=case when ss is null then 'unresolved' when raw ? 'planned_sets' then 'individualized-v5' else 'legacy_uniform_projection' end;
  issue:=case when ss is null then 'current_prescription_unresolved' else null end;
  out_history:='[]';select x into hist from jsonb_array_elements(b#>'{history,exercises}') x where x->>'exercise_id'=binding->>'exercise_id';
  for exposure in select value from jsonb_array_elements(hist->'exposures') loop
   select * into w from public.workouts where id=(exposure->>'workout_id')::uuid and user_id=u and data->>'routine_id'=b#>>'{history,routine_id}';
   select x into hist_e from jsonb_array_elements(w.data->'exercises')x where x->>'exercise_id'=exposure->>'historical_exercise_id';
   hs:=null;source:='unknown';rid:=null;
   -- An explicit revision marker is trusted only after ownership/routine/date checks.
   if w.data->>'routine_revision_id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into rid from public.routine_revisions where id=(w.data->>'routine_revision_id')::uuid and user_id=u and routine_id=(b#>>'{history,routine_id}')::uuid and created_at<=w.created_at;
    if rid is not null then hs:=coach_private.premium_revision_sets(rid,(exposure->>'historical_exercise_id')::uuid);source:='exact_revision';end if;
   else
    -- Date-only legacy records cannot resolve same-day revision changes safely.
    select id into rid from public.routine_revisions r where user_id=u and routine_id=(b#>>'{history,routine_id}')::uuid and created_at::date<w.workout_date and not exists(select 1 from public.routine_revisions next_r where next_r.user_id=u and next_r.routine_id=r.routine_id and next_r.created_at>r.created_at and next_r.created_at::date<=w.workout_date) order by created_at desc limit 1;
    if rid is not null then hs:=coach_private.premium_revision_sets(rid,(exposure->>'historical_exercise_id')::uuid);source:='revision_date_unambiguous';end if;
   end if;
   if hs is null then source:='unknown';end if;
   out_sets:='[]';pn:=0;identity_ok:=not exists(select 1 from jsonb_array_elements(hist_e->'sets') with ordinality a(z,ord) where z ? 'set' and not coalesce(z->>'set' ~ '^[1-9][0-9]?$',false)) and (select count(*)=count(distinct coalesce(z->>'set',ord::text)) from jsonb_array_elements(hist_e->'sets') with ordinality a(z,ord));
   if not identity_ok then source:='set_identity_ambiguous';end if;
   if hs is not null and jsonb_array_length(exposure->'sets')<>jsonb_array_length(hs) then source:='set_count_mismatch';end if;
   for actual in select value from jsonb_array_elements(exposure->'sets') loop
    pn:=pn+1;sn:=case when identity_ok then coalesce((hist_e#>>array['sets',(pn-1)::text,'set'])::int,pn) else pn end;ps:=case when identity_ok then hs->(sn-1) else null end;
    if ps is null and hs is not null then source:='set_count_mismatch';end if;
    out_sets:=out_sets||jsonb_build_array(actual||jsonb_build_object('set_number',sn,'planned',ps,'reps_in_range',case when ps is not null and actual->>'reps' ~ '^[0-9]+$' then (actual->>'reps')::int between (ps->>'reps_min')::int and (ps->>'reps_max')::int else null end,'rir_delta',case when ps is not null and actual->>'rir' ~ '^[0-9]+$' then (actual->>'rir')::int-(ps->>'rir')::int else null end));
   end loop;
   out_history:=out_history||jsonb_build_array(jsonb_build_object('date',exposure->'date','sets',out_sets,'prescription_source',source));
  end loop;
  e:=e||jsonb_build_object('planned_sets',coalesce(ss,'[]'::jsonb),'prescription_format',fmt,'prescription_issue',issue,'exposures',out_history);
  -- Keep the already validated trend, but downgrade it if historical targets changed.
  if jsonb_array_length(out_history)>=3 and (select count(distinct x.sets) from (select jsonb_agg(s->'planned' order by (s->>'set_number')::int) sets from jsonb_array_elements(out_history) with ordinality a(h,n) cross join lateral jsonb_array_elements(h->'sets') s where n<=3 group by n)x)>1 then
   e:=jsonb_set(e,'{metrics,trend}','"context_changed_or_incomplete"'::jsonb);
  end if;
  out_ex:=out_ex||jsonb_build_array(e);
 end loop;
 ctx:=jsonb_set(ctx,'{routine,exercises}',out_ex)||jsonb_build_object('prescription_context_version','premium-prescription-v2');
 return jsonb_set(b,'{provider}',ctx);
end $$;

create or replace function coach_private.premium_output_patches(r public.coach_recommendations,v jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;

create or replace function coach_private.premium_check_patch(p jsonb,r uuid,apply_patch boolean) returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare rev uuid;ss jsonb;e public.routine_exercises;c public.coach_mesocycles;first_set jsonb;
begin
 select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if p->>'field'<>'planned_sets' then
  ss:=coach_private.premium_revision_sets(rev,(p->>'target_id')::uuid);
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
end $$;

create or replace function coach_private.premium_snapshot(r uuid) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare snap jsonb;rev uuid;day jsonb;e jsonb;ss jsonb;patch jsonb;new_ex jsonb;new_days jsonb:='[]';first_set jsonb;
begin
 snap:=coach_private.premium_snapshot_v1(r);select current_revision_id into rev from public.routine_management where routine_id=r and plan_kind='premium';
 if rev is null then return snap;end if;
 for day in select value from jsonb_array_elements(snap->'days') loop
  new_ex:='[]';for e in select value from jsonb_array_elements(day->'exercises') loop
   ss:=coach_private.premium_revision_sets(rev,(e->>'id')::uuid);
   select p into patch from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'target_id'=e->>'id' and p->>'field'='planned_sets';
   if patch is not null then ss:=patch->'to';
   elsif ss is not null and exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches)p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'target_id'=e->>'id' and p->>'field' in ('sets','target','rir','rest_seconds')) then
    select jsonb_agg(jsonb_build_object('set_number',n,'reps_min',split_part(e->>'target','-',1)::int,'reps_max',coalesce(nullif(split_part(e->>'target','-',2),''),split_part(e->>'target','-',1))::int,'rir',(e->>'rir')::int,'rest_seconds',(e->>'rest_seconds')::int) order by n) into ss from generate_series(1,(e->>'sets')::int)n;
   end if;
   if ss is not null then first_set:=ss->0;e:=e||jsonb_build_object('planned_sets',ss,'sets',jsonb_array_length(ss),'reps_min',first_set->'reps_min','reps_max',first_set->'reps_max','scheme',case when coach_private.premium_series_uniform(ss) then 'straight' when (select x->>'scheme' from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days')d cross join lateral jsonb_array_elements(d->'exercises')x where v.id=rev and x->>'id'=e->>'id')='top_backoff' then 'top_backoff' else 'variable' end);end if;
   new_ex:=new_ex||jsonb_build_array(e);
  end loop;new_days:=new_days||jsonb_build_array(day||jsonb_build_object('exercises',new_ex));
 end loop;return snap||jsonb_build_object('days',new_days,'prescription_context_version','premium-prescription-v2');
end $$;

__FINISH__
__RESERVE__
alter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_calls_check;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_calls_check check(max_calls between 0 and 16);
revoke all on function coach_private.premium_sets_valid(jsonb,boolean),coach_private.premium_revision_sets(uuid,uuid),coach_private.premium_series_uniform(jsonb),coach_private.premium_bundle_v1(uuid,uuid),coach_private.premium_output_patches_v1(public.coach_recommendations,jsonb),coach_private.premium_check_patch_v1(jsonb,uuid,boolean),coach_private.premium_snapshot_v1(uuid) from public,anon,authenticated,service_role;
commit;
