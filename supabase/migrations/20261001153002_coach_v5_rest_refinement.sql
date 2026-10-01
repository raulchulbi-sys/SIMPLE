-- Only schema-2 per-set rest ceiling changes, no owner/permissions alteration.
begin;
CREATE OR REPLACE FUNCTION coach_private.validate_proposal(p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'coach_private'
AS $function$
declare d jsonb;e jsonb;s jsonb;n int;v2 boolean:=p->'schema_version'='2'::jsonb;
begin
 if not coalesce(coach_private.keys_exact(p,array['schema_version','name','description','days']),false)
 or not coalesce(p->'schema_version' in ('1'::jsonb,'2'::jsonb),false)
 or not coach_private.valid_text(p->'name',1,100)
 or not coach_private.valid_text(p->'description',0,500)
 or jsonb_typeof(p->'days') is distinct from 'array'
 then raise exception 'coach_invalid_proposal';end if;
 if jsonb_array_length(p->'days') not between 1 and 7 then raise exception 'coach_invalid_proposal';end if;
 for d in select value from jsonb_array_elements(p->'days') loop
  if not coalesce(coach_private.keys_exact(d,array['name','exercises']),false)
  or not coach_private.valid_text(d->'name',1,80)
  or jsonb_typeof(d->'exercises') is distinct from 'array'
  then raise exception 'coach_invalid_proposal';end if;
  if jsonb_array_length(d->'exercises') not between 1 and 8 then raise exception 'coach_invalid_proposal';end if;
  for e in select value from jsonb_array_elements(d->'exercises') loop
   if not coalesce(coach_private.keys_exact(e,case when v2 then array['name','sets','reps_min','reps_max','rir','rest_seconds','scheme','planned_sets'] else array['name','sets','reps_min','reps_max','rir','rest_seconds'] end),false)
   or not coach_private.valid_text(e->'name',1,100)
   or not coach_private.valid_int(e->'sets',1,6)
   or not coach_private.valid_int(e->'reps_min',1,30)
   or not coach_private.valid_int(e->'reps_max',1,30)
   or (e->>'reps_min')::int>(e->>'reps_max')::int
   or not coach_private.valid_int(e->'rir',0,5)
   or not coach_private.valid_int(e->'rest_seconds',0,300)
   then raise exception 'coach_invalid_proposal';end if;
   if v2 then
    if e->>'scheme' not in ('straight','varied','top_backoff') or jsonb_typeof(e->'scheme') is distinct from 'string'
     or jsonb_typeof(e->'planned_sets') is distinct from 'array' then raise exception 'coach_invalid_proposal';end if;
    if jsonb_array_length(e->'planned_sets') not between 1 and 4 or jsonb_array_length(e->'planned_sets')<>(e->>'sets')::int then raise exception 'coach_invalid_proposal';end if;
    n:=0;
    for s in select value from jsonb_array_elements(e->'planned_sets') loop
     n:=n+1;
     if not coalesce(coach_private.keys_exact(s,array['set_number','reps_min','reps_max','rir','rest_seconds']),false)
      or s->'set_number' is distinct from to_jsonb(n)
      or not coach_private.valid_int(s->'reps_min',5,20) or not coach_private.valid_int(s->'reps_max',5,20)
      or (s->>'reps_min')::int>(s->>'reps_max')::int
      or not coach_private.valid_int(s->'rir',0,4) or not coach_private.valid_int(s->'rest_seconds',60,300)
      then raise exception 'coach_invalid_proposal';end if;
     if n=1 and exists(select 1 from unnest(array['reps_min','reps_max','rir','rest_seconds']) k where s->k is distinct from e->k)
      then raise exception 'coach_invalid_proposal';end if;
     if e->>'scheme'='straight' and s-'set_number' is distinct from (e->'planned_sets'->0)-'set_number'
      then raise exception 'coach_invalid_proposal';end if;
     if e->>'scheme'='top_backoff' and n>1 and ((s->>'reps_min')::int<=(e->'planned_sets'->0->>'reps_min')::int or (s->>'reps_max')::int<=(e->'planned_sets'->0->>'reps_max')::int)
      then raise exception 'coach_invalid_proposal';end if;
    end loop;
    if e->>'scheme'='top_backoff' and n<2 then raise exception 'coach_invalid_proposal';end if;
   end if;
  end loop;
 end loop;
end $function$;
commit;
