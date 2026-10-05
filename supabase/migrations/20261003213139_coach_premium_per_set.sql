-- STAGING ONLY: additive per-set extension. No Basic, Auth, policies or training history rewrites.
begin;
CREATE OR REPLACE FUNCTION coach_private.premium_bundle_v1(m uuid, u uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_output_patches_v1(r coach_recommendations, v jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_check_patch_v1(p jsonb, r uuid, apply_patch boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
declare e public.routine_exercises;d public.routine_days;f text:=p->>'field';v jsonb:=p->'to';target_uuid uuid;new_id uuid;catalogue jsonb;intake jsonb;
begin
 if jsonb_typeof(p)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(p)k)<>array['field','from','target_id','to'] then raise exception 'premium_invalid_patch';end if;
 target_uuid:=(p->>'target_id')::uuid;
 if f='day_order' then
  select * into d from public.routine_days where id=target_uuid and routine_id=r;
  if not found or to_jsonb(d.day_order) is distinct from p->'from' or jsonb_typeof(v)<>'number' or (v#>>'{}')!~'^[0-9]{1,2}$' then raise exception 'premium_stale_patch';end if;
  if apply_patch then update public.routine_days set day_order=(v#>>'{}')::int where id=target_uuid;end if;return;
 end if;
 select x.* into e from public.routine_exercises x join public.routine_days y on y.id=x.day_id where x.id=target_uuid and y.routine_id=r;
 if not found then raise exception 'premium_invalid_target';end if;
 if f='replace_exercise' then
  if p->'from'<>to_jsonb(e.id::text) or jsonb_typeof(v)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(v)k)<>array['catalogue_id','id','rest_seconds','rir','sets','target'] then raise exception 'premium_invalid_replacement';end if;
  select x into catalogue from jsonb_array_elements(coach_private.premium_catalogue()) x where x->>'id'=v->>'catalogue_id';
  select c.intake into intake from public.coach_mesocycles c where c.routine_id=r and c.state='active';
  if catalogue is null or intake is null or intake->'excluded' ? (v->>'catalogue_id') or exists(select 1 from jsonb_array_elements_text(catalogue->'requires') req where not(intake#>'{inventory,equipment}' ? req)) then raise exception 'premium_invalid_equipment_or_exclusion';end if;
  new_id:=(v->>'id')::uuid;
  if new_id is null or exists(select 1 from public.routine_exercises where id=new_id) or jsonb_typeof(v->'sets') is distinct from 'number' or jsonb_typeof(v->'rest_seconds') is distinct from 'number' or jsonb_typeof(v->'rir') is distinct from 'string' or jsonb_typeof(v->'target') is distinct from 'string' then raise exception 'premium_invalid_replacement';end if;
  -- All replacement prescription fields receive the same bounds as ordinary patches.
  if (v->>'sets')!~'^[1-9][0-9]?$' or (v->>'sets')::int>12 or (v->>'rest_seconds')!~'^[0-9]{1,3}$' or (v->>'rest_seconds')::int not between 30 and 300
   or (v->>'rir')!~'^[0-5]$' or (v->>'target')!~'^[0-9]{1,2}(-[0-9]{1,2})?$' then raise exception 'premium_invalid_replacement';end if;
  if apply_patch then
   delete from public.routine_exercises where id=e.id;
   insert into public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) values(new_id,e.day_id,catalogue->>'name',(v->>'sets')::int,v->>'target',v->>'rir',(v->>'rest_seconds')::int,e.exercise_order,null);
  end if;return;
 end if;
 if f not in ('sets','target','rir','rest_seconds','exercise_order','day_id') or coalesce(to_jsonb(e)->f,'null'::jsonb) is distinct from p->'from' then raise exception 'premium_stale_patch';end if;
 if f in ('sets','rest_seconds','exercise_order') then
  if jsonb_typeof(v)<>'number' or (v#>>'{}')!~'^[0-9]{1,3}$' then raise exception 'premium_invalid_prescription';end if;
  if f='sets' and (v#>>'{}')::int not between 1 and 12 or f='rest_seconds' and (v#>>'{}')::int not between 30 and 300 or f='exercise_order' and (v#>>'{}')::int>99 then raise exception 'premium_invalid_prescription';end if;
 elsif f='rir' and (jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^[0-5]$') or f='target' and (jsonb_typeof(v)<>'string' or (v#>>'{}')!~'^[0-9]{1,2}(-[0-9]{1,2})?$') then raise exception 'premium_invalid_prescription';
 elsif f='day_id' and not exists(select 1 from public.routine_days where id=(v#>>'{}')::uuid and routine_id=r) then raise exception 'premium_invalid_target';end if;
 if apply_patch then execute format('update public.routine_exercises set %I=$1::%s where id=$2',f,case when f in ('sets','rest_seconds','exercise_order') then 'integer' when f='day_id' then 'uuid' else 'text' end) using v#>>'{}',e.id;end if;
end $function$
;
CREATE OR REPLACE FUNCTION coach_private.premium_snapshot_v1(r uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
 select jsonb_build_object('routine',to_jsonb(a),'days',coalesce((select jsonb_agg(to_jsonb(d)||jsonb_build_object('exercises',coalesce((select jsonb_agg(to_jsonb(e) order by e.exercise_order,e.id) from public.routine_exercises e where e.day_id=d.id),'[]'::jsonb)) order by d.day_order,d.id) from public.routine_days d where d.routine_id=a.id),'[]'::jsonb)) from public.routines a where a.id=r
$function$
;
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
end $function$
;
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
end $function$
;
alter table coach_private.premium_analysis_budget drop constraint premium_analysis_budget_max_calls_check;
alter table coach_private.premium_analysis_budget add constraint premium_analysis_budget_max_calls_check check(max_calls between 0 and 16);
revoke all on function coach_private.premium_sets_valid(jsonb,boolean),coach_private.premium_revision_sets(uuid,uuid),coach_private.premium_series_uniform(jsonb),coach_private.premium_bundle_v1(uuid,uuid),coach_private.premium_output_patches_v1(public.coach_recommendations,jsonb),coach_private.premium_check_patch_v1(jsonb,uuid,boolean),coach_private.premium_snapshot_v1(uuid) from public,anon,authenticated,service_role;
commit;
