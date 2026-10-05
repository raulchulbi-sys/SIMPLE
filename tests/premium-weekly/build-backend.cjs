const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..');
const original=JSON.parse(fs.readFileSync(path.join(__dirname,'private/phase3-originals.json'),'utf8'));
assert.equal(original.length,10);
const get=name=>original.find(x=>x.proname===name).definition.trim();
assert(get('premium_check_patch').includes("if p->>'field' is null then raise exception 'premium_invalid_patch';end if;"),'Phase 3 must inherit the NULL-field guard');
function replace(text,from,to){assert(text.includes(from),'Required original fragment: '+from.slice(0,70));return text.replace(from,()=>to);}
const defs=[];
let permission=get('premium_permission');
permission=replace(permission,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));\n");
defs.push(permission+';');
let reserve=get('premium_reserve_analysis');
reserve=replace(reserve,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));\n");
reserve=replace(reserve,"if found then if r.mesocycle_id<>p_mesocycle then raise exception 'premium_key_conflict';end if;return r;end if;","if found then if r.mesocycle_id<>p_mesocycle then raise exception 'premium_key_conflict';end if;perform coach_private.premium_weekly_assert(r,r.state<>'accepted');return r;end if;");
reserve=replace(reserve,"select * into r from public.coach_recommendations where user_id=u and analysis_key=p_key;if found then return r;end if;","select * into r from public.coach_recommendations where user_id=u and analysis_key=p_key;if found then perform coach_private.premium_weekly_assert(r,r.state<>'accepted');return r;end if;");
reserve=replace(reserve,'b:=coach_private.premium_bundle(c.id,u);',`if coach_private.premium_weekly_grant(c.id,u) is not null then b:=coach_private.premium_weekly_bundle(c.id,u);
 else
  if exists(select 1 from public.coach_weekly_checkins where mesocycle_id=c.id) or exists(select 1 from public.coach_recommendations where mesocycle_id=c.id and analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1') then raise exception 'premium_weekly_consent_required';end if;
  b:=coach_private.premium_bundle(c.id,u);
 end if;`);
reserve=replace(reserve,"'prompt_version','premium-analysis-v1.1','response_schema_version','premium-recommendation-v2'", "'prompt_version',case when b ? 'weekly_metadata' then 'premium-weekly-analysis-v1' else 'premium-analysis-v1.1' end,'response_schema_version',case when b ? 'weekly_metadata' then 'premium-weekly-analysis-v1' else 'premium-recommendation-v2' end");
reserve=replace(reserve,"'provider_context_hash',md5((b->'provider')::text))) returning", "'provider_context_hash',md5((b->'provider')::text))||coalesce(b->'weekly_metadata','{}'::jsonb)) returning");
defs.push(reserve+';');
let claim=get('premium_analysis_claim');
claim=replace(claim,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));\n");
claim=replace(claim,"if r.provider_state<>'reserved' or r.state<>'analyzing' then return jsonb_build_object('claimed',false);end if;", "if r.provider_state<>'reserved' or r.state<>'analyzing' then return jsonb_build_object('claimed',false);end if;\n perform coach_private.premium_weekly_assert(r);");
defs.push(claim+';');
let finish=get('premium_analysis_finish');
finish=replace(finish,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended(p_user::text||':premium-weekly-grant',0));\n");
finish=replace(finish,'if err is null then begin vpatches:=coach_private.premium_output_patches(r,p_output);', "if err is null then begin perform coach_private.premium_weekly_assert(r);exception when others then err:='weekly_context_stale_or_revoked';end;end if;\n if err is null then begin vpatches:=coach_private.premium_output_patches(r,p_output);");
finish=finish.replace("err in ('stale_revision','consent_revoked_or_inactive')", "err in ('stale_revision','consent_revoked_or_inactive','weekly_context_stale_or_revoked')");
defs.push(finish+';');
let review=get('premium_review_recommendation');
review=replace(review,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended((select user_id::text from public.coach_recommendations where id=p_id)||':premium-weekly-grant',0));\n");
review=replace(review,"if not found or c.state<>'pending_review' then raise exception 'premium_invalid_state';end if;", "if not found or c.state<>'pending_review' then raise exception 'premium_invalid_state';end if;\n perform coach_private.premium_weekly_assert(c);");
defs.push(review+';');
let resolve=get('premium_resolve_review');
resolve=replace(resolve,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended((select user_id::text from public.coach_recommendations where id=p_id)||':premium-weekly-grant',0));\n");
resolve=replace(resolve,"if not found or not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_not_authorized' using errcode='42501';end if;", "if not found or not coach_private.premium_review_access(c.mesocycle_id) then raise exception 'premium_not_authorized' using errcode='42501';end if;\n perform coach_private.premium_weekly_assert(c);");
defs.push(resolve+';');
let accept=get('premium_accept_recommendation');
accept=replace(accept,'begin\n',"begin\n perform pg_advisory_xact_lock(hashtextextended(u::text||':premium-weekly-grant',0));\n");
accept=replace(accept,"if c.state='accepted' then return c.result_revision_id;end if;", "perform coach_private.premium_weekly_assert(c,c.state<>'accepted');\n if c.state='accepted' then return c.result_revision_id;end if;");
defs.push(accept+';');
const copiedOutput=get('premium_output_patches').replaceAll('coach_private.premium_output_patches(', 'coach_private.premium_output_patches_phase2(');
defs.push(copiedOutput+';');
defs.push(`create or replace function coach_private.premium_output_patches(r public.coach_recommendations,v jsonb) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
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
end $$;`);
let check=get('premium_check_patch');
check=replace(check,"if p->>'field'<>'planned_sets' then", "if p->>'field'='weekly_schedule' then perform coach_private.premium_weekly_schedule_check(p,r);return;end if;\n if p->>'field'<>'planned_sets' then");
defs.push(check+';');
let snapshot=get('premium_snapshot');
snapshot=replace(snapshot,'base_count int;', 'base_count int;schedule_patch jsonb;stored_schedule jsonb;result jsonb;');
snapshot=replace(snapshot,"end loop;return snap||jsonb_build_object('days',new_days,'prescription_context_version','premium-prescription-v2');", `end loop;
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
 return result;`);
defs.push(snapshot+';');
const newSigs=[
 'coach_private.premium_weekly_grant(uuid,uuid)','coach_private.premium_weekly_visible(uuid)','coach_private.premium_weekly_validate(jsonb,boolean,uuid)','coach_private.premium_weekly_checkin_guard()',
 'coach_private.premium_weekly_assert(public.coach_recommendations,boolean)','coach_private.premium_weekly_schedule(uuid)','coach_private.premium_weekly_bundle(uuid,uuid)','coach_private.premium_weekly_schedule_check(jsonb,uuid,jsonb)','coach_private.premium_output_patches_phase2(public.coach_recommendations,jsonb)',
 'public.premium_weekly_permission(uuid,boolean)','public.premium_save_weekly_checkin(uuid,integer,uuid,bigint,jsonb,boolean)','public.premium_weekly_provider_context(uuid)','public.premium_weekly_reserve_analysis(uuid,uuid)'];
const publicSigs=newSigs.filter(x=>x.startsWith('public.'));
const privateSigs=newSigs.filter(x=>x.startsWith('coach_private.'));
const revokes=`revoke all on function ${privateSigs.join(',')} from public,anon,authenticated,service_role;
grant execute on function coach_private.premium_weekly_visible(uuid) to authenticated;
revoke all on function ${publicSigs.join(',')} from public,anon,authenticated;
grant execute on function ${publicSigs.join(',')} to authenticated;`;
const template=fs.readFileSync(path.join(__dirname,'backend-template.sql'),'utf8');
const candidate=template.replace('__EXISTING_FUNCTIONS__',()=>defs.join('\n\n')).replace('__REVOKES__',()=>revokes).replaceAll('\r\n','\n');
assert(!candidate.includes('__EXISTING_FUNCTIONS__')&&!candidate.includes('__REVOKES__'));
assert.equal((candidate.match(/create (?:or replace )?function public\.premium_weekly_reserve_analysis\(/gi)||[]).length,1);
const file=fs.readdirSync(path.join(root,'supabase/migrations')).find(x=>x.endsWith('_coach_premium_weekly.sql'));assert(file);
fs.writeFileSync(path.join(root,'supabase/migrations',file),candidate);
const rollback=`-- STAGING ONLY. Reject a blind rollback with Phase 3 data or weekly schedule revisions.
begin;
do $$ begin
 if exists(select 1 from public.coach_weekly_checkins) or exists(select 1 from public.coach_recommendations where analysis_bundle#>>'{provider,schema_version}'='premium-weekly-provider-v1') or exists(select 1 from public.routine_revisions where snapshot ? 'weekly_schedule') or exists(select 1 from public.context_grants where scope='premium_weekly_checkin' or notice_version='premium-checkin-v1') then raise exception 'premium_weekly_rollback_requires_clean_phase3_state';end if;
end $$;
${original.map(x=>x.definition.trim()+';').join('\n\n')}
drop policy premium_owner on public.coach_recommendations;
create policy premium_owner on public.coach_recommendations for select to authenticated using(user_id=(select auth.uid()));
drop policy premium_explicit_reviewer on public.coach_recommendations;
create policy premium_explicit_reviewer on public.coach_recommendations for select to authenticated using(coach_private.premium_review_access(mesocycle_id));
drop function public.premium_save_weekly_checkin(uuid,integer,uuid,bigint,jsonb,boolean);
drop table public.coach_weekly_checkins;
drop function ${newSigs.filter(x=>!x.startsWith('public.premium_save_weekly_checkin(')).join(',')};
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
commit;\n`;
fs.writeFileSync(path.join(__dirname,'phase3-rollback.sql'),rollback.replaceAll('\r\n','\n'));
console.log(JSON.stringify({migration:file,changed:original.map(x=>x.proname),newFunctions:newSigs.length,rollback:'phase3-rollback.sql'}));
