-- STAGING rollback. Restores the captured read projection only.
BEGIN;
DO $$ BEGIN
 IF md5(pg_get_functiondef('public.premium_recommendation_view(uuid)'::regprocedure)) <> 'f5fa7ddec2885817db5ef03ba2520313' THEN
  RAISE EXCEPTION 'before_projection_rollback_source_changed';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.premium_recommendation_view(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public'
AS $function$
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
end $function$
;
COMMIT;
