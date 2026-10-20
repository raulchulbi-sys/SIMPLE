-- PRIVATE DRAFT. Not applied by the reviewing agent.
-- Parent is sole staging writer; project/ref and isolated fixtures must be verified externally.
-- Default fail-closed gate: only after confirmed JWT reproduction + independent review set,
-- in this same transaction: SET LOCAL simple.reviewer_security_reviewed='privacy-contract-20261018-v1';
-- Do not publish this draft or use it against production.
begin;
set local search_path=pg_catalog,public;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $preflight$
declare expected jsonb;actual jsonb;g jsonb;fn oid;
begin
 if current_setting('simple.reviewer_security_reviewed',true) is distinct from 'privacy-contract-20261018-v1' then
  raise exception 'reviewed_staging_reproduction_and_source_review_required';
 end if;
 expected:='[{"cmd":"SELECT","name":"premium_explicit_reviewer","qual":"coach_private.premium_review_access(mesocycle_id)","roles":["authenticated"],"table":"coach_mesocycle_weeks","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"table":"coach_mesocycle_weeks","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_explicit_reviewer","qual":"coach_private.premium_review_access(id)","roles":["authenticated"],"table":"coach_mesocycles","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"(user_id = ( SELECT auth.uid() AS uid))","roles":["authenticated"],"table":"coach_mesocycles","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_explicit_reviewer","qual":"(coach_private.premium_review_access(mesocycle_id) AND (((analysis_bundle #>> ''{provider,schema_version}''::text[]) IS DISTINCT FROM ''premium-weekly-provider-v1''::text) OR coach_private.premium_weekly_visible(mesocycle_id)) AND (((analysis_trace ->> ''origin''::text) IS DISTINCT FROM ''premium_chat''::text) OR coach_private.premium_chat_recommendation_visible(id)))","roles":["authenticated"],"table":"coach_recommendations","permissive":"PERMISSIVE","with_check":null},{"cmd":"SELECT","name":"premium_owner","qual":"((user_id = ( SELECT auth.uid() AS uid)) AND (((analysis_bundle #>> ''{provider,schema_version}''::text[]) IS DISTINCT FROM ''premium-weekly-provider-v1''::text) OR coach_private.premium_weekly_visible(mesocycle_id)))","roles":["authenticated"],"table":"coach_recommendations","permissive":"PERMISSIVE","with_check":null}]'::jsonb;
 select jsonb_agg(jsonb_build_object('table',tablename,'name',policyname,'cmd',cmd,'roles',roles,'permissive',permissive,'qual',qual,'with_check',with_check) order by tablename,policyname)
 into actual from pg_policies where schemaname='public' and tablename in ('coach_mesocycles','coach_recommendations','coach_mesocycle_weeks');
 if actual is distinct from expected then raise exception 'reviewer_policy_drift';end if;
 expected:='[{"table":"coach_mesocycle_weeks","column":"id","type":"uuid"},{"table":"coach_mesocycle_weeks","column":"mesocycle_id","type":"uuid"},{"table":"coach_mesocycle_weeks","column":"planned_date","type":"date"},{"table":"coach_mesocycle_weeks","column":"revision_id","type":"uuid"},{"table":"coach_mesocycle_weeks","column":"routine_id","type":"uuid"},{"table":"coach_mesocycle_weeks","column":"state","type":"text"},{"table":"coach_mesocycle_weeks","column":"user_id","type":"uuid"},{"table":"coach_mesocycle_weeks","column":"week_number","type":"integer"},{"table":"coach_mesocycles","column":"access_until","type":"timestamp with time zone"},{"table":"coach_mesocycles","column":"catalogue_bindings","type":"jsonb"},{"table":"coach_mesocycles","column":"created_at","type":"timestamp with time zone"},{"table":"coach_mesocycles","column":"current_revision_id","type":"uuid"},{"table":"coach_mesocycles","column":"id","type":"uuid"},{"table":"coach_mesocycles","column":"initial_revision_id","type":"uuid"},{"table":"coach_mesocycles","column":"intake","type":"jsonb"},{"table":"coach_mesocycles","column":"intake_submitted_at","type":"timestamp with time zone"},{"table":"coach_mesocycles","column":"number","type":"integer"},{"table":"coach_mesocycles","column":"objective","type":"text"},{"table":"coach_mesocycles","column":"planned_weeks","type":"integer"},{"table":"coach_mesocycles","column":"reviewer_id","type":"uuid"},{"table":"coach_mesocycles","column":"routine_id","type":"uuid"},{"table":"coach_mesocycles","column":"row_version","type":"bigint"},{"table":"coach_mesocycles","column":"start_date","type":"date"},{"table":"coach_mesocycles","column":"state","type":"text"},{"table":"coach_mesocycles","column":"tracking_week","type":"integer"},{"table":"coach_mesocycles","column":"updated_at","type":"timestamp with time zone"},{"table":"coach_mesocycles","column":"user_id","type":"uuid"},{"table":"coach_recommendations","column":"accepted_at","type":"timestamp with time zone"},{"table":"coach_recommendations","column":"analysis_bundle","type":"jsonb"},{"table":"coach_recommendations","column":"analysis_key","type":"uuid"},{"table":"coach_recommendations","column":"analysis_trace","type":"jsonb"},{"table":"coach_recommendations","column":"analysis_week","type":"integer"},{"table":"coach_recommendations","column":"apply_txid","type":"bigint"},{"table":"coach_recommendations","column":"base_revision_id","type":"uuid"},{"table":"coach_recommendations","column":"context_snapshot","type":"jsonb"},{"table":"coach_recommendations","column":"created_at","type":"timestamp with time zone"},{"table":"coach_recommendations","column":"facts","type":"jsonb"},{"table":"coach_recommendations","column":"id","type":"uuid"},{"table":"coach_recommendations","column":"interpretation","type":"text"},{"table":"coach_recommendations","column":"kind","type":"text"},{"table":"coach_recommendations","column":"mesocycle_id","type":"uuid"},{"table":"coach_recommendations","column":"patches","type":"jsonb"},{"table":"coach_recommendations","column":"provider_state","type":"text"},{"table":"coach_recommendations","column":"reserved_usd","type":"numeric"},{"table":"coach_recommendations","column":"result_revision_id","type":"uuid"},{"table":"coach_recommendations","column":"review_reason","type":"text"},{"table":"coach_recommendations","column":"reviewed_at","type":"timestamp with time zone"},{"table":"coach_recommendations","column":"routine_id","type":"uuid"},{"table":"coach_recommendations","column":"state","type":"text"},{"table":"coach_recommendations","column":"user_id","type":"uuid"}]'::jsonb;
 select jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod)) order by c.relname,a.attname)
 into actual from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('coach_mesocycles','coach_recommendations','coach_mesocycle_weeks') and a.attnum>0 and not a.attisdropped;
 if actual is distinct from expected then raise exception 'reviewer_column_drift';end if;
 if exists(select 1 from pg_class where oid in ('public.coach_mesocycles'::regclass,'public.coach_recommendations'::regclass,'public.coach_mesocycle_weeks'::regclass) and not relrowsecurity) then raise exception 'reviewer_rls_disabled';end if;
 for g in select value from jsonb_array_elements('[{"signature":"coach_private.premium_chat_assert_bundle(jsonb,uuid,boolean)","hash":"5848624fdf3e045f39ea84800dd7293e","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"signature":"coach_private.premium_chat_assert(public.coach_recommendations,boolean)","hash":"666f58a812a1411a18bb8de38bd2c89d","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"acl":["postgres=X/postgres","authenticated=X/postgres"],"hash":"ad75fb1097c236986e2463dcdf6d399e","owner":"postgres","config":["search_path=pg_catalog, public"],"parallel":"u","signature":"coach_private.premium_chat_recommendation_visible(uuid)","volatility":"s"},{"signature":"coach_private.premium_distribution_projection(jsonb,jsonb,uuid)","hash":"70cdf4ff1a854813a5059bd8bcea4653","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"signature":"coach_private.premium_recommendation_view_distribution_previous(uuid)","hash":"cf9c86928d94796f661626643811a3fb","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"acl":["postgres=X/postgres","authenticated=X/postgres"],"hash":"69f1970458c3f93df56defff7a156c39","owner":"postgres","config":["search_path=pg_catalog, public"],"parallel":"u","signature":"coach_private.premium_review_access(uuid)","volatility":"s"},{"signature":"coach_private.premium_revision_sets(uuid,uuid)","hash":"5e19b8d7c3add09332a54a7c064be909","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"signature":"coach_private.premium_upgrade_prior_premium_weekly_assert(public.coach_recommendations,boolean)","hash":"2431155547d3e384d1b5bbb1a44cd6bb","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"signature":"coach_private.premium_weekly_assert_distribution_previous(public.coach_recommendations,boolean)","hash":"10b9094bd370d3d87d2127698a2d6d07","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"signature":"coach_private.premium_weekly_assert_phase3(public.coach_recommendations,boolean)","hash":"7aea6d3d25ff03ca86f744d9355e44b4","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"signature":"coach_private.premium_weekly_assert(public.coach_recommendations,boolean)","hash":"cd40e3dfba2de76cfcc914f553ae6fc3","owner":"postgres","config":["search_path=pg_catalog, public"],"acl":["postgres=X/postgres"],"volatility":"s","parallel":"u"},{"acl":["postgres=X/postgres","authenticated=X/postgres"],"hash":"54f490e9b7484289753245ad0455a083","owner":"postgres","config":["search_path=pg_catalog, public"],"parallel":"u","signature":"coach_private.premium_weekly_visible(uuid)","volatility":"s"},{"acl":["postgres=X/postgres","authenticated=X/postgres"],"hash":"f5fa7ddec2885817db5ef03ba2520313","owner":"postgres","config":["search_path=pg_catalog, public"],"parallel":"u","signature":"public.premium_recommendation_view(uuid)","volatility":"s"}]'::jsonb) loop
  fn:=to_regprocedure(g->>'signature');
  if fn is null or not exists(select 1 from pg_proc p where p.oid=fn and md5(pg_get_functiondef(p.oid))=g->>'hash'
   and pg_get_userbyid(p.proowner)=g->>'owner' and p.prosecdef and p.provolatile='s'
   and to_jsonb(p.proconfig)=g->'config' and to_jsonb(p.proacl)=g->'acl') then raise exception 'reviewer_helper_drift: %',g->>'signature';end if;
 end loop;
 if to_regprocedure('public.premium_reviewer_state(uuid)') is not null or to_regprocedure('coach_private.premium_reviewer_project(jsonb,jsonb)') is not null then raise exception 'reviewer_api_already_exists';end if;
end;
$preflight$;

-- Internal JSON allowlist. Its shape is supplied only by the fixed RPC below.
-- Unknown keys are discarded at every depth; scalar slots cannot copy objects.
create function coach_private.premium_reviewer_project(v jsonb, shape jsonb) returns jsonb
language plpgsql immutable parallel safe security invoker set search_path=pg_catalog as $project$
declare item record;out_value jsonb;key_name text;kind text;
begin
 if v is null or v='null'::jsonb then return v;end if;
 kind:=jsonb_typeof(shape);
 if kind='string' then
  if jsonb_typeof(v) is distinct from shape#>>'{}' then raise exception 'premium_reviewer_projection_invalid';end if;
  return v;
 elsif kind='object' then
  if jsonb_typeof(v)<>'object' then raise exception 'premium_reviewer_projection_invalid';end if;
  out_value:='{}'::jsonb;
  for item in select key,value from jsonb_each(shape) loop
   key_name:=item.key;
   if v ? key_name then out_value:=out_value||jsonb_build_object(key_name,coach_private.premium_reviewer_project(v->key_name,item.value));end if;
  end loop;
  return out_value;
 elsif kind='array' and jsonb_array_length(shape)=1 then
  if jsonb_typeof(v)<>'array' then raise exception 'premium_reviewer_projection_invalid';end if;
  out_value:='[]'::jsonb;
  for item in select value from jsonb_array_elements(v) loop
   out_value:=out_value||jsonb_build_array(coach_private.premium_reviewer_project(item.value,shape->0));
  end loop;
  return out_value;
 end if;
 raise exception 'premium_reviewer_projection_schema_invalid';
end;
$project$;
alter function coach_private.premium_reviewer_project(jsonb,jsonb) owner to postgres;
revoke all on function coach_private.premium_reviewer_project(jsonb,jsonb) from public,anon,authenticated,service_role;

create function public.premium_reviewer_state(p_mesocycle uuid default null) returns jsonb
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
alter function public.premium_reviewer_state(uuid) owner to postgres;
revoke all on function public.premium_reviewer_state(uuid) from public,anon,authenticated,service_role;
grant execute on function public.premium_reviewer_state(uuid) to authenticated;
comment on function public.premium_reviewer_state(uuid) is 'SIMPLE private draft reviewer contract 2026-10-18 v1; closed projection; owner API unchanged';

-- Keep all owner and weekly policies byte-for-byte; remove only these two routes.
drop policy premium_explicit_reviewer on public.coach_mesocycles;
drop policy premium_explicit_reviewer on public.coach_recommendations;
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
notify pgrst,'reload schema';
commit;

