-- UNPUBLISHED BUG CANDIDATE. SOURCE ONLY. No production execution authorized.
-- Operator alone verifies project/ref and reviews any future application.
-- AFTER BEGIN, same transaction, set simple.reviewer_admission_list_reviewed
-- and simple.reviewer_admission_list_target_md5 from the isolated-test receipt.
-- API rollback only; never restore the two broad SELECT policies.
-- Reviewed gate literal: historical-admission-list-rollback-v1
begin;
set local search_path=pg_catalog,public;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $candidate_gate$ begin
 if current_setting('simple.reviewer_admission_list_reviewed',true) is distinct from 'historical-admission-list-rollback-v1' or current_user<>'postgres' then raise exception 'unpublished_candidate_requires_reviewed_operator';end if;
 if current_setting('simple.reviewer_admission_list_target_md5',true) is null or current_setting('simple.reviewer_admission_list_target_md5',true) !~ '^[0-9a-f]{32}$' then raise exception 'independently_pinned_candidate_md5_required';end if;
 if md5(pg_get_functiondef('public.premium_reviewer_state(uuid)'::regprocedure)) is distinct from current_setting('simple.reviewer_admission_list_target_md5') or md5(pg_get_functiondef('coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure)) is distinct from 'fc89c86e5a6fb56069bfbf777d9dd3e1' then raise exception 'reviewer_admission_list_source_drift';end if;
end $candidate_gate$;
do $postflight$
declare expected jsonb;actual jsonb;
begin
 expected:='[{"cmd":"SELECT","name":"premium_explicit_reviewer","qual":"coach_private.premium_review_access(mesocycle_id)","roles":["authenticated"],"table":"coach_mesocycle_weeks","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"table":"coach_mesocycle_weeks","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"table":"coach_mesocycles","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"((user_id = ( SELECT auth.uid() AS uid)) AND (((analysis_bundle #>> ''{provider,schema_version}''::text[]) IS DISTINCT FROM ''premium-weekly-provider-v1''::text) OR coach_private.premium_weekly_visible(mesocycle_id)))","roles":["authenticated"],"table":"coach_recommendations","permissive":"PERMISSIVE","with_check":null}]'::jsonb;
 select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'cmd',cmd,'roles',roles,'permissive',permissive,'qual',qual,'with_check',with_check) order by tablename,policyname)
 into actual from pg_policies where schemaname='public' and tablename in ('coach_mesocycles','coach_recommendations','coach_mesocycle_weeks');
 if actual is distinct from expected then raise exception 'reviewer_postflight_policy_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.premium_reviewer_state(uuid)'::regprocedure and pg_get_userbyid(proowner)='postgres' and prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog, public'])
  or not exists(select 1 from pg_proc where oid='coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure and pg_get_userbyid(proowner)='postgres' and not prosecdef and provolatile='i' and proparallel='s' and proconfig=array['search_path=pg_catalog']) then raise exception 'reviewer_api_owner_path_or_stability_invalid';end if;
 if has_function_privilege('anon','public.premium_reviewer_state(uuid)','EXECUTE')
  or has_function_privilege('service_role','public.premium_reviewer_state(uuid)','EXECUTE')
  or not has_function_privilege('authenticated','public.premium_reviewer_state(uuid)','EXECUTE')
  or has_function_privilege('authenticated','coach_private.premium_reviewer_project(jsonb,jsonb)','EXECUTE')
  or has_function_privilege('anon','coach_private.premium_reviewer_project(jsonb,jsonb)','EXECUTE')
  or has_function_privilege('service_role','coach_private.premium_reviewer_project(jsonb,jsonb)','EXECUTE') then raise exception 'reviewer_api_acl_invalid';end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid in ('public.premium_reviewer_state(uuid)'::regprocedure,'coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure)
   and (a.grantee=0 or pg_get_userbyid(a.grantee) not in ('postgres','authenticated') or
    (p.oid='coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure and pg_get_userbyid(a.grantee)<>'postgres'))) then raise exception 'reviewer_api_unexpected_grantee';end if;
end;
$postflight$;
create or replace function public.premium_reviewer_state(p_mesocycle uuid default null) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog,public as $state$
declare u uuid:=auth.uid();c public.coach_mesocycles;r public.coach_recommendations;
 scopes jsonb;weeks jsonb;recs jsonb:='[]'::jsonb;v jsonb;projected jsonb;p jsonb;q jsonb;patches jsonb;
begin
 if u is null or not exists(select 1 from public.profiles where id=u and role='trainer') then
  raise exception 'premium_not_authorized' using errcode='42501';
 end if;
 if p_mesocycle is null then
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'number',m.number,'state',m.state) order by m.created_at desc,m.id),'[]'::jsonb)
   into scopes from public.coach_mesocycles m where m.state in ('draft','active') and coach_private.premium_review_access(m.id);
  return jsonb_build_object('actor','reviewer','scopes',scopes);
 end if;
 select * into c from public.coach_mesocycles where id=p_mesocycle and coach_private.premium_review_access(id);
 if not found then raise exception 'premium_not_authorized' using errcode='42501';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'week_number',w.week_number,'state',w.state,'planned_date',w.planned_date,'revision_id',w.revision_id) order by w.week_number,w.id),'[]'::jsonb)
  into weeks from public.coach_mesocycle_weeks w where w.mesocycle_id=c.id;
 for r in select rr.* from public.coach_recommendations rr where rr.mesocycle_id=c.id
  and ((rr.analysis_bundle#>>'{provider,schema_version}') is distinct from 'premium-weekly-provider-v1' or coach_private.premium_weekly_visible(rr.mesocycle_id))
  and ((rr.analysis_trace->>'origin') is distinct from 'premium_chat' or coach_private.premium_chat_recommendation_visible(rr.id))
  order by rr.created_at desc,rr.id
 loop
  begin
   -- Preserve the current grant/checkin/revision binding checks and named-series projection.
   v:=public.premium_recommendation_view(r.id);
  exception
   when sqlstate '42501' then
    if sqlerrm in ('premium_weekly_consent_required','premium_chat_consent_required','premium_chat_context_revoked') then continue;end if;
    raise;
   when raise_exception then
    if sqlerrm in ('premium_weekly_stale_context','premium_weekly_stale_checkin','premium_chat_stale_context','premium_chat_stale_checkin') then continue;end if;
    raise;
  end;
  projected:=coach_private.premium_reviewer_project(v,'{"id":"string","mesocycle_id":"string","routine_id":"string","kind":"string","state":"string","base_revision_id":"string","result_revision_id":"string","analysis_week":"number","interpretation":"string","review_reason":"string","facts":[{"exercise_ref":"string","exercise_name":"string","claim":"string","observations":[{"date":"string","sets":[{"set_number":"number","kg":"number","reps":"number","rir":"number"}]}]}],"quality_warnings":["string"],"created_at":"string","reviewed_at":"string","accepted_at":"string"}'::jsonb);
  patches:='[]'::jsonb;
  for p in select value from jsonb_array_elements(v->'patches') loop
   q:=coach_private.premium_reviewer_project(p,'{"field":"string","target_id":"string","exercise_name":"string"}'::jsonb);
   case p->>'field'
    when 'sets','rest_seconds','exercise_order','day_order' then
     q:=q||jsonb_build_object('from',coach_private.premium_reviewer_project(p->'from','"number"'::jsonb),'to',coach_private.premium_reviewer_project(p->'to','"number"'::jsonb));
    when 'target','rir','day_id' then
     q:=q||jsonb_build_object('from',coach_private.premium_reviewer_project(p->'from','"string"'::jsonb),'to',coach_private.premium_reviewer_project(p->'to','"string"'::jsonb));
    when 'planned_sets' then
     q:=q||jsonb_build_object('from',coach_private.premium_reviewer_project(p->'from','[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]'::jsonb),'to',coach_private.premium_reviewer_project(p->'to','[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]'::jsonb));
    when 'weekly_schedule' then
     q:=q||jsonb_build_object('from',coach_private.premium_reviewer_project(p->'from','[{"day_id":"string","weekday":"string","minutes":"number"}]'::jsonb),'to',coach_private.premium_reviewer_project(p->'to','[{"day_id":"string","weekday":"string","minutes":"number"}]'::jsonb));
    when 'replace_exercise' then
     q:=q||jsonb_build_object('from',coach_private.premium_reviewer_project(p->'from','"string"'::jsonb),'to',coach_private.premium_reviewer_project(p->'to','{"id":"string","catalogue_id":"string","source_catalogue_id":"string","prescription_policy":"string","scheme":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}],"sets":"number","target":"string","rir":"string","rest_seconds":"number"}'::jsonb));
     if p ? 'before_prescription' then q:=q||jsonb_build_object('before_prescription',coach_private.premium_reviewer_project(p->'before_prescription','{"name":"string","scheme":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}'::jsonb));end if;
    when 'session_distribution' then
     q:=q||jsonb_build_object('from',coach_private.premium_reviewer_project(p->'from','{"sessions":[{"name":"string","weekday":"string","minutes":"number","estimated_minutes":"number","exercises":[{"name":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}]}]}'::jsonb),'to',coach_private.premium_reviewer_project(p->'to','{"sessions":[{"name":"string","weekday":"string","minutes":"number","estimated_minutes":"number","exercises":[{"name":"string","planned_sets":[{"set_number":"number","reps_min":"number","reps_max":"number","rir":"number","rest_seconds":"number"}]}]}],"quality":{"sets_before":"number","sets_after":"number","muscle_sets_before":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"muscle_sets_after":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"frequency_after":{"chest":"number","back":"number","upper_back":"number","quads":"number","hamstrings":"number","glutes":"number","deltoids":"number","biceps":"number","triceps":"number","calves":"number","core":"number","adductors":"number"},"schedule":[{"day_id":"string","weekday":"string","minutes":"number"}],"volume_reason":"string","warnings":["string"]},"removed_exercises":[{"name":"string","reason":"string"}],"actions":[{"action":"string","weekday":"string"}],"removed_sessions":["string"]}'::jsonb));
    else raise exception 'premium_reviewer_projection_unknown_patch';
   end case;
   patches:=patches||jsonb_build_array(q);
  end loop;
  recs:=recs||jsonb_build_array(projected||jsonb_build_object('patches',patches));
 end loop;
 return jsonb_build_object('actor','reviewer',
  'mesocycle',jsonb_build_object('id',c.id,'number',c.number,'planned_weeks',c.planned_weeks,'state',c.state,'current_revision_id',c.current_revision_id,'tracking_week',c.tracking_week),
  'weeks',weeks,'recommendations',recs);
end;
$state$;
do $postflight$
declare expected jsonb;actual jsonb;
begin
 expected:='[{"cmd":"SELECT","name":"premium_explicit_reviewer","qual":"coach_private.premium_review_access(mesocycle_id)","roles":["authenticated"],"table":"coach_mesocycle_weeks","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"table":"coach_mesocycle_weeks","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"table":"coach_mesocycles","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"((user_id = ( SELECT auth.uid() AS uid)) AND (((analysis_bundle #>> ''{provider,schema_version}''::text[]) IS DISTINCT FROM ''premium-weekly-provider-v1''::text) OR coach_private.premium_weekly_visible(mesocycle_id)))","roles":["authenticated"],"table":"coach_recommendations","permissive":"PERMISSIVE","with_check":null}]'::jsonb;
 select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'cmd',cmd,'roles',roles,'permissive',permissive,'qual',qual,'with_check',with_check) order by tablename,policyname)
 into actual from pg_policies where schemaname='public' and tablename in ('coach_mesocycles','coach_recommendations','coach_mesocycle_weeks');
 if actual is distinct from expected then raise exception 'reviewer_postflight_policy_drift';end if;
 if not exists(select 1 from pg_proc where oid='public.premium_reviewer_state(uuid)'::regprocedure and pg_get_userbyid(proowner)='postgres' and prosecdef and provolatile='s' and proconfig=array['search_path=pg_catalog, public'])
  or not exists(select 1 from pg_proc where oid='coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure and pg_get_userbyid(proowner)='postgres' and not prosecdef and provolatile='i' and proparallel='s' and proconfig=array['search_path=pg_catalog']) then raise exception 'reviewer_api_owner_path_or_stability_invalid';end if;
 if has_function_privilege('anon','public.premium_reviewer_state(uuid)','EXECUTE')
  or has_function_privilege('service_role','public.premium_reviewer_state(uuid)','EXECUTE')
  or not has_function_privilege('authenticated','public.premium_reviewer_state(uuid)','EXECUTE')
  or has_function_privilege('authenticated','coach_private.premium_reviewer_project(jsonb,jsonb)','EXECUTE')
  or has_function_privilege('anon','coach_private.premium_reviewer_project(jsonb,jsonb)','EXECUTE')
  or has_function_privilege('service_role','coach_private.premium_reviewer_project(jsonb,jsonb)','EXECUTE') then raise exception 'reviewer_api_acl_invalid';end if;
 if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where p.oid in ('public.premium_reviewer_state(uuid)'::regprocedure,'coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure)
   and (a.grantee=0 or pg_get_userbyid(a.grantee) not in ('postgres','authenticated') or
    (p.oid='coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure and pg_get_userbyid(a.grantee)<>'postgres'))) then raise exception 'reviewer_api_unexpected_grantee';end if;
end;
$postflight$;
do $candidate_source_check$ begin
 if md5(pg_get_functiondef('public.premium_reviewer_state(uuid)'::regprocedure)) is distinct from 'fb4f1a322b8666a883184cfd04f1f017' or md5(pg_get_functiondef('coach_private.premium_reviewer_project(jsonb,jsonb)'::regprocedure)) is distinct from 'fc89c86e5a6fb56069bfbf777d9dd3e1' then raise exception 'reviewer_admission_list_result_drift';end if;
end $candidate_source_check$;
notify pgrst,'reload schema';
commit;
