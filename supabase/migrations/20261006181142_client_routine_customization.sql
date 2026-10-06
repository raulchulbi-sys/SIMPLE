-- Assignment-scoped prescriptions. Original routine/day/exercise UUIDs remain
-- logical identities; no workout, note, assignment binding or alias is rewritten.
CREATE TABLE public.client_routine_customizations (
  assignment_id uuid PRIMARY KEY REFERENCES public.routine_assignments(id) ON DELETE CASCADE,
  structure jsonb NOT NULL CHECK(jsonb_typeof(structure)='object'),
  version bigint NOT NULL DEFAULT 1 CHECK(version>0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_routine_customizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_routine_customizations FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.client_routine_template_snapshot(p_routine uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path='pg_catalog','public' AS $$
 SELECT jsonb_build_object('name',r.name,'description',r.description,'days',
  coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.id,'name',d.name,'day_order',d.day_order,'exercises',
   coalesce((SELECT jsonb_agg(jsonb_build_object('id',e.id,'day_id',e.day_id,'name',e.name,'sets',e.sets,
    'target',e.target,'rir',e.rir,'rest_seconds',e.rest_seconds,'exercise_order',e.exercise_order,'notes',e.notes)
    ORDER BY e.exercise_order,e.id) FROM public.routine_exercises e WHERE e.day_id=d.id),'[]'::jsonb))
   ORDER BY d.day_order,d.id) FROM public.routine_days d WHERE d.routine_id=r.id),'[]'::jsonb))
 FROM public.routines r WHERE r.id=p_routine;
$$;
REVOKE ALL ON FUNCTION public.client_routine_template_snapshot(uuid) FROM PUBLIC,anon,authenticated;
-- Workout inserts validate the exact assigned day, including client-only days.
-- This helper reveals no data and does not grant table access or change RLS.
CREATE FUNCTION public.client_routine_workout_day_allowed(p_user uuid,p_routine text,p_day text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
 SELECT p_user=auth.uid() AND EXISTS(
  SELECT 1 FROM public.routines r WHERE r.id::text=p_routine AND r.deleted_at IS NULL AND (
   (r.owner_id=p_user AND EXISTS(SELECT 1 FROM public.routine_days d WHERE d.routine_id=r.id AND d.id::text=p_day))
   OR EXISTS(SELECT 1 FROM public.routine_assignments a JOIN public.client_routine_customizations s ON s.assignment_id=a.id
    WHERE a.trainer_routine_id=r.id AND a.trainer_id=r.owner_id AND a.client_id=p_user AND a.client_deleted_at IS NULL
     AND a.client_routine_id IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(s.structure->'days') d WHERE d->>'id'=p_day))
  ));
$$;
REVOKE ALL ON FUNCTION public.client_routine_workout_day_allowed(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.client_routine_workout_day_allowed(uuid,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION public.simple_guard_workout_identity()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  -- Mantenimiento administrativo sin identidad de usuario final.
  IF current_user IN ('postgres','service_role') AND auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF jsonb_typeof(NEW.data) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'invalid_workout_data';
  END IF;
  IF TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.workout_date IS DISTINCT FROM OLD.workout_date
      OR (NEW.data->'routine_id') IS DISTINCT FROM (OLD.data->'routine_id')
      OR (NEW.data->'routineId') IS DISTINCT FROM (OLD.data->'routineId')
      OR (NEW.data->'routine_day_id') IS DISTINCT FROM (OLD.data->'routine_day_id')
      OR (NEW.data->'workout_date') IS DISTINCT FROM (OLD.data->'workout_date')
    THEN RAISE EXCEPTION 'workout_identity_cannot_change'; END IF;
  ELSIF TG_OP='INSERT' THEN
    IF NEW.user_id IS DISTINCT FROM auth.uid() OR NOT public.client_routine_workout_day_allowed(NEW.user_id,coalesce(NEW.data->>'routine_id',NEW.data->>'routineId'),NEW.data->>'routine_day_id') THEN RAISE EXCEPTION 'workout_context_not_authorized'; END IF;
    IF NEW.data?'routine_id' AND NEW.data?'routineId'
      AND (NEW.data->>'routine_id') IS DISTINCT FROM (NEW.data->>'routineId')
    THEN RAISE EXCEPTION 'workout_context_not_authorized'; END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE FUNCTION public.capture_client_routine_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.trainer_id,NEW.client_id,NEW.trainer_routine_id,NEW.client_routine_id)
    IS DISTINCT FROM (OLD.trainer_id,OLD.client_id,OLD.trainer_routine_id,OLD.client_routine_id) THEN
  RAISE EXCEPTION 'assignment_identity_immutable';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.trainer_id::text,0));
 INSERT INTO public.client_routine_customizations(assignment_id,structure)
 SELECT NEW.id,public.client_routine_template_snapshot(NEW.trainer_routine_id)
 WHERE NEW.client_routine_id IS NULL
 ON CONFLICT(assignment_id) DO NOTHING;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_client_routine_assignment() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER capture_client_routine_assignment AFTER INSERT OR UPDATE
 ON public.routine_assignments FOR EACH ROW EXECUTE FUNCTION public.capture_client_routine_assignment();
-- Existing assignments retain their CURRENT prescription exactly. This does
-- not claim to reconstruct an earlier template and does not restore any data.
INSERT INTO public.client_routine_customizations(assignment_id,structure)
 SELECT a.id,public.client_routine_template_snapshot(a.trainer_routine_id)
 FROM public.routine_assignments a WHERE a.client_routine_id IS NULL;

CREATE FUNCTION public.get_client_routine_structure(p_client_id uuid,p_routine_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
DECLARE a public.routine_assignments; s public.client_routine_customizations;
BEGIN
 SELECT x.* INTO a FROM public.routine_assignments x JOIN public.routines r ON r.id=x.trainer_routine_id
 WHERE x.client_id=p_client_id AND x.trainer_routine_id=p_routine_id AND x.client_deleted_at IS NULL
  AND r.owner_id=x.trainer_id AND r.deleted_at IS NULL
  AND auth.uid() IN (x.client_id,x.trainer_id);
 IF a.id IS NULL OR a.client_routine_id IS NOT NULL THEN RAISE EXCEPTION 'client_routine_not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.client_routine_customizations WHERE assignment_id=a.id;
 IF s.assignment_id IS NULL THEN RAISE EXCEPTION 'client_routine_structure_missing';END IF;
 RETURN s.structure||jsonb_build_object('assignment_id',a.id,'client_id',a.client_id,'routine_id',a.trainer_routine_id,'version',s.version);
END $$;
REVOKE ALL ON FUNCTION public.get_client_routine_structure(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_client_routine_structure(uuid,uuid) TO authenticated;

CREATE FUNCTION public.save_client_routine_structure(p_client_id uuid,p_routine_id uuid,p_expected_version bigint,
 p_name text,p_description text,p_days jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
DECLARE a public.routine_assignments; s public.client_routine_customizations; current jsonb; next jsonb;
 change jsonb; original jsonb; path text[]; allowed text[]; field text; entity text;
 d jsonb; e jsonb; did uuid; eid uuid; old_days uuid[]; old_exercises uuid[];
 seen_days uuid[]:='{}';seen_exercises uuid[]:='{}';output_days jsonb:='[]';output_exercises jsonb;di int;ei int;
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='trainer') THEN
  RAISE EXCEPTION 'client_routine_not_authorized' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 SELECT x.* INTO a FROM public.routine_assignments x JOIN public.routines r ON r.id=x.trainer_routine_id
 WHERE x.trainer_id=auth.uid() AND x.client_id=p_client_id AND x.trainer_routine_id=p_routine_id
  AND x.client_deleted_at IS NULL AND x.client_routine_id IS NULL AND r.owner_id=auth.uid() AND r.deleted_at IS NULL
 FOR UPDATE OF x;
 IF a.id IS NULL THEN RAISE EXCEPTION 'client_routine_not_authorized' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM public.client_routine_customizations WHERE assignment_id=a.id FOR UPDATE;
 IF s.assignment_id IS NULL OR s.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'editor_conflict' USING ERRCODE='40001';END IF;
 current:=s.structure;next:=current;
 IF p_days->>'mode'='field_patch_v1' THEN
  IF jsonb_typeof(p_days->'changes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_editor_patch';END IF;
  FOR change IN SELECT value FROM jsonb_array_elements(p_days->'changes') LOOP
   entity:=change->>'entity';path:=NULL;allowed:=NULL;
   IF entity='routine' AND (change->>'id')::uuid=p_routine_id THEN
    path:='{}';allowed:=ARRAY['name','description'];
   ELSIF entity='day' THEN
    SELECT ARRAY['days',(ordinality-1)::text] INTO path FROM jsonb_array_elements(next->'days') WITH ORDINALITY
     WHERE value->>'id'=change->>'id';allowed:=ARRAY['name'];
   ELSIF entity='exercise' THEN
    SELECT ARRAY['days',(dy.ordinality-1)::text,'exercises',(ex.ordinality-1)::text] INTO path
     FROM jsonb_array_elements(next->'days') WITH ORDINALITY dy,
      jsonb_array_elements(dy.value->'exercises') WITH ORDINALITY ex
     WHERE dy.value->>'id'=change->>'day_id' AND ex.value->>'id'=change->>'id';
    allowed:=ARRAY['name','sets','target','rir','rest_seconds','notes'];
   END IF;
   IF path IS NULL THEN RAISE EXCEPTION 'foreign_or_deleted_editor_record';END IF;
   original:=next#>path;
   IF jsonb_typeof(change->'values') IS DISTINCT FROM 'object' OR jsonb_typeof(change->'expected') IS DISTINCT FROM 'object'
    OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(change->'values') key)
       IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(change->'expected') key) THEN RAISE EXCEPTION 'invalid_editor_patch';END IF;
   FOR field IN SELECT jsonb_object_keys(change->'values') LOOP
    IF NOT(field=ANY(allowed)) THEN RAISE EXCEPTION 'invalid_editor_field';END IF;
    IF original->field IS DISTINCT FROM change->'expected'->field THEN RAISE EXCEPTION 'editor_conflict' USING ERRCODE='40001';END IF;
    next:=jsonb_set(next,path||field,change->'values'->field);
   END LOOP;
  END LOOP;
 ELSIF p_days->>'mode'='snapshot_v2' THEN
  IF p_days->'expected' IS DISTINCT FROM current THEN RAISE EXCEPTION 'editor_conflict' USING ERRCODE='40001';END IF;
  next:=jsonb_build_object('name',p_name,'description',p_description,'days',p_days->'days');
 ELSE RAISE EXCEPTION 'invalid_editor_mode';END IF;
 IF jsonb_typeof(next->'name') IS DISTINCT FROM 'string' OR nullif(trim(next->>'name'),'') IS NULL
  OR jsonb_typeof(next->'days') IS DISTINCT FROM 'array' OR jsonb_array_length(next->'days')>40
  OR octet_length(next::text)>262144 THEN RAISE EXCEPTION 'invalid_routine_structure';END IF;
 IF NOT(next ? 'description') OR jsonb_typeof(next->'description') NOT IN ('string','null') THEN RAISE EXCEPTION 'invalid_description';END IF;
 SELECT array_agg((value->>'id')::uuid) INTO old_days FROM jsonb_array_elements(current->'days');
 SELECT array_agg((ex.value->>'id')::uuid) INTO old_exercises FROM jsonb_array_elements(current->'days') dy,
  jsonb_array_elements(dy.value->'exercises') ex;
 di:=0;
 FOR d IN SELECT value FROM jsonb_array_elements(next->'days') LOOP
  IF NOT(d ? 'id') OR jsonb_typeof(d->'name') IS DISTINCT FROM 'string' OR nullif(trim(d->>'name'),'') IS NULL
   OR jsonb_typeof(d->'exercises') IS DISTINCT FROM 'array' OR jsonb_array_length(d->'exercises')>80 THEN RAISE EXCEPTION 'invalid_day';END IF;
  did:=nullif(d->>'id','')::uuid;
  IF did IS NOT NULL AND NOT(did=ANY(coalesce(old_days,'{}'))) THEN RAISE EXCEPTION 'foreign_editor_record';END IF;
  did:=coalesce(did,gen_random_uuid());IF did=ANY(seen_days) THEN RAISE EXCEPTION 'duplicate_day';END IF;seen_days:=array_append(seen_days,did);
  output_exercises:='[]';ei:=0;
  FOR e IN SELECT value FROM jsonb_array_elements(d->'exercises') LOOP
   IF NOT(e ? 'id') OR jsonb_typeof(e->'name') IS DISTINCT FROM 'string' OR nullif(trim(e->>'name'),'') IS NULL
    OR jsonb_typeof(e->'sets') IS DISTINCT FROM 'number' OR (e->>'sets')::numeric<>(e->>'sets')::integer
    OR (e->>'sets')::integer NOT BETWEEN 1 AND 100 OR jsonb_typeof(e->'rest_seconds') IS DISTINCT FROM 'number'
    OR (e->>'rest_seconds')::numeric<>(e->>'rest_seconds')::integer OR (e->>'rest_seconds')::integer NOT BETWEEN 0 AND 3600
    OR NOT(e ?& ARRAY['target','rir','notes']) OR jsonb_typeof(e->'target') NOT IN ('string','null') OR jsonb_typeof(e->'rir') NOT IN ('string','null')
    OR jsonb_typeof(e->'notes') NOT IN ('string','null') THEN RAISE EXCEPTION 'invalid_exercise';END IF;
   eid:=nullif(e->>'id','')::uuid;
   IF eid IS NOT NULL AND NOT(eid=ANY(coalesce(old_exercises,'{}'))) THEN RAISE EXCEPTION 'foreign_editor_record';END IF;
   eid:=coalesce(eid,gen_random_uuid());IF eid=ANY(seen_exercises) THEN RAISE EXCEPTION 'duplicate_exercise';END IF;seen_exercises:=array_append(seen_exercises,eid);
   output_exercises:=output_exercises||jsonb_build_array(jsonb_build_object('id',eid,'day_id',did,'name',e->'name','sets',(e->>'sets')::integer,
    'target',e->'target','rir',e->'rir','rest_seconds',(e->>'rest_seconds')::integer,
    'exercise_order',CASE WHEN p_days->>'mode'='field_patch_v1' THEN (e->>'exercise_order')::integer ELSE ei END,'notes',e->'notes'));ei:=ei+1;
  END LOOP;
  output_days:=output_days||jsonb_build_array(jsonb_build_object('id',did,'name',d->'name',
   'day_order',CASE WHEN p_days->>'mode'='field_patch_v1' THEN (d->>'day_order')::integer ELSE di END,'exercises',output_exercises));di:=di+1;
 END LOOP;
 next:=jsonb_build_object('name',next->'name','description',next->'description','days',output_days);
 IF next IS DISTINCT FROM current THEN UPDATE public.client_routine_customizations SET structure=next,version=version+1,updated_at=now() WHERE assignment_id=a.id;END IF;
 RETURN public.get_client_routine_structure(p_client_id,p_routine_id);
END $$;
REVOKE ALL ON FUNCTION public.save_client_routine_structure(uuid,uuid,bigint,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_client_routine_structure(uuid,uuid,bigint,text,text,jsonb) TO authenticated;

CREATE FUNCTION public.reorder_client_routine_structure(p_client_id uuid,p_routine_id uuid,p_expected_version bigint,p_order jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='pg_catalog','public' AS $$
DECLARE original jsonb; changed jsonb; ids text[]; old_ids text[]; ordered jsonb; path text[];
BEGIN
 original:=public.get_client_routine_structure(p_client_id,p_routine_id);
 IF original->>'version' IS DISTINCT FROM p_expected_version::text THEN RAISE EXCEPTION 'editor_conflict' USING ERRCODE='40001';END IF;
 changed:=original-'assignment_id'-'client_id'-'routine_id'-'version';
 IF p_order->>'kind'='day' THEN path:=ARRAY['days'];
 ELSIF p_order->>'kind'='exercise' THEN
  SELECT ARRAY['days',(ordinality-1)::text,'exercises'] INTO path FROM jsonb_array_elements(changed->'days') WITH ORDINALITY
   WHERE value->>'id'=p_order->>'day_id';
 END IF;
 IF path IS NULL OR jsonb_typeof(p_order->'ids') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid_order';END IF;
 SELECT array_agg(value ORDER BY value) INTO ids FROM jsonb_array_elements_text(p_order->'ids');
 SELECT array_agg(value->>'id' ORDER BY value->>'id') INTO old_ids FROM jsonb_array_elements(changed#>path);
 IF ids IS DISTINCT FROM old_ids OR cardinality(ids)<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_order->'ids')) THEN RAISE EXCEPTION 'invalid_order';END IF;
 SELECT coalesce(jsonb_agg(x.value ORDER BY p.ordinality),'[]'::jsonb) INTO ordered FROM jsonb_array_elements(changed#>path) x,
  jsonb_array_elements_text(p_order->'ids') WITH ORDINALITY p WHERE x.value->>'id'=p.value;
 changed:=jsonb_set(changed,path,ordered);
 RETURN public.save_client_routine_structure(p_client_id,p_routine_id,p_expected_version,changed->>'name',changed->>'description',
  jsonb_build_object('mode','snapshot_v2','expected',original-'assignment_id'-'client_id'-'routine_id'-'version','days',changed->'days'));
END $$;
REVOKE ALL ON FUNCTION public.reorder_client_routine_structure(uuid,uuid,bigint,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_client_routine_structure(uuid,uuid,bigint,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.save_routine_atomic(p_routine_id uuid, p_name text, p_description text, p_days jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid:=auth.uid(); d record; e record; did uuid; eid uuid;
  kept_days uuid[]:='{}'; kept_exercises uuid[]:='{}';
  input_days uuid[]:='{}'; input_exercises uuid[]:='{}';
  safe_snapshot boolean:=false; canonical jsonb;
  change jsonb; original jsonb; entity text; table_name text; allowed text[]; field text; assignments_sql text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
  IF EXISTS(SELECT 1 FROM public.routine_assignments WHERE trainer_routine_id=p_routine_id) AND (p_days->>'scope') IS DISTINCT FROM 'library' THEN RAISE EXCEPTION 'routine_scope_required: Actualiza SIMPLE y vuelve a abrir el editor'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
  PERFORM 1 FROM public.routines WHERE id=p_routine_id AND owner_id=uid
    AND deleted_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rutina no disponible'; END IF;

  -- Field-only editor: UUID identity, expected values, and one transaction.
  IF jsonb_typeof(p_days)='object' AND p_days->>'mode'='field_patch_v1' THEN
    IF jsonb_typeof(p_days->'changes') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'invalid_editor_patch';
    END IF;
    FOR change IN SELECT value FROM jsonb_array_elements(p_days->'changes') LOOP
      entity:=change->>'entity'; eid:=(change->>'id')::uuid;
      IF entity='routine' THEN
        IF eid IS DISTINCT FROM p_routine_id THEN RAISE EXCEPTION 'foreign_editor_record'; END IF;
        table_name:='routines'; allowed:=ARRAY['name','description'];
        SELECT to_jsonb(t) INTO original FROM public.routines t WHERE t.id=eid FOR UPDATE;
      ELSIF entity='day' THEN
        table_name:='routine_days'; allowed:=ARRAY['name'];
        SELECT to_jsonb(t) INTO original FROM public.routine_days t WHERE t.id=eid AND t.routine_id=p_routine_id FOR UPDATE;
      ELSIF entity='exercise' THEN
        table_name:='routine_exercises'; allowed:=ARRAY['name','sets','target','rir','rest_seconds','notes'];
        SELECT to_jsonb(t) INTO original FROM public.routine_exercises t
        WHERE t.id=eid AND t.day_id=(change->>'day_id')::uuid
          AND EXISTS(SELECT 1 FROM public.routine_days dy WHERE dy.id=t.day_id AND dy.routine_id=p_routine_id) FOR UPDATE;
      ELSE RAISE EXCEPTION 'invalid_editor_entity';
      END IF;
      IF original IS NULL THEN RAISE EXCEPTION 'foreign_or_deleted_editor_record'; END IF;
      IF jsonb_typeof(change->'values') IS DISTINCT FROM 'object'
        OR jsonb_typeof(change->'expected') IS DISTINCT FROM 'object'
        OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(change->'values') key)
          IS DISTINCT FROM (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(change->'expected') key)
      THEN RAISE EXCEPTION 'invalid_editor_patch'; END IF;
      assignments_sql:='';
      FOR field IN SELECT jsonb_object_keys(change->'values') LOOP
        IF NOT(field=ANY(allowed)) THEN RAISE EXCEPTION 'invalid_editor_field'; END IF;
        IF original->field IS DISTINCT FROM change->'expected'->field THEN RAISE EXCEPTION 'editor_conflict'; END IF;
        IF original->field IS NOT DISTINCT FROM change->'values'->field THEN CONTINUE; END IF;
        IF field='name' AND nullif(trim(change->'values'->>field),'') IS NULL THEN RAISE EXCEPTION 'Nombre obligatorio'; END IF;
        IF field='sets' AND ((change->'values'->>field) IS NULL OR (change->'values'->>field)::integer<1) THEN RAISE EXCEPTION 'invalid_sets'; END IF;
        IF field='rest_seconds' AND ((change->'values'->>field) IS NULL OR (change->'values'->>field)::integer<0) THEN RAISE EXCEPTION 'invalid_rest'; END IF;
        assignments_sql:=concat_ws(', ',nullif(assignments_sql,''),format('%I=(jsonb_populate_record(NULL::public.%I,$1)).%I',field,table_name,field));
      END LOOP;
      IF assignments_sql<>'' THEN
        EXECUTE format('UPDATE public.%I SET %s WHERE id=$2',table_name,assignments_sql) USING change->'values',eid;
      END IF;
    END LOOP;
    RETURN p_routine_id;
  END IF;

  IF jsonb_typeof(p_days)='object' AND p_days->>'mode'='snapshot_v2' THEN
    safe_snapshot:=true;
    -- All editor RPCs share the owner lock above. Lock rows against direct updates too.
    PERFORM 1 FROM public.routine_days WHERE routine_id=p_routine_id ORDER BY id FOR UPDATE;
    PERFORM 1 FROM public.routine_exercises WHERE day_id IN
      (SELECT id FROM public.routine_days WHERE routine_id=p_routine_id) ORDER BY id FOR UPDATE;
    SELECT jsonb_build_object('name',r.name,'description',r.description,'days',
      coalesce((SELECT jsonb_agg(jsonb_build_object('id',dy.id,'name',dy.name,'day_order',dy.day_order,
        'exercises',coalesce((SELECT jsonb_agg(jsonb_build_object('id',ex.id,'day_id',ex.day_id,'name',ex.name,
          'sets',ex.sets,'target',ex.target,'rir',ex.rir,'rest_seconds',ex.rest_seconds,
          'exercise_order',ex.exercise_order,'notes',ex.notes) ORDER BY ex.exercise_order,ex.id)
          FROM public.routine_exercises ex WHERE ex.day_id=dy.id),'[]'::jsonb)) ORDER BY dy.day_order,dy.id)
        FROM public.routine_days dy WHERE dy.routine_id=r.id),'[]'::jsonb)) INTO canonical
    FROM public.routines r WHERE r.id=p_routine_id;
    IF p_days->'expected' IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'editor_conflict'; END IF;
    p_days:=p_days->'days';
  END IF;

  -- Unversioned full-object saves from stale frontend tabs must fail closed.
  IF NOT safe_snapshot THEN RAISE EXCEPTION 'Actualiza SIMPLE y vuelve a abrir el editor'; END IF;

  IF nullif(trim(p_name),'') IS NULL THEN RAISE EXCEPTION 'Nombre obligatorio'; END IF;
  IF p_days IS NULL OR jsonb_typeof(p_days)<>'array' THEN RAISE EXCEPTION 'Días inválidos'; END IF;

  -- Validar TODO antes de mutar; un cliente anterior sin IDs falla explícitamente.
  FOR d IN SELECT value AS item FROM jsonb_array_elements(p_days) LOOP
    IF NOT (d.item ? 'id') THEN RAISE EXCEPTION 'Actualiza SIMPLE y vuelve a abrir el editor'; END IF;
    IF nullif(trim(d.item->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Día sin nombre'; END IF;
    IF jsonb_typeof(d.item->'exercises') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Ejercicios inválidos'; END IF;
    did:=nullif(d.item->>'id','')::uuid;
    IF did IS NOT NULL THEN
      IF did=ANY(input_days) THEN RAISE EXCEPTION 'Día duplicado'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.routine_days WHERE id=did AND routine_id=p_routine_id)
      THEN RAISE EXCEPTION 'Día ajeno o eliminado; vuelve a cargar'; END IF;
      input_days:=array_append(input_days,did);
    END IF;
    FOR e IN SELECT value AS item FROM jsonb_array_elements(d.item->'exercises') LOOP
      IF NOT (e.item ? 'id') THEN RAISE EXCEPTION 'Actualiza SIMPLE y vuelve a abrir el editor'; END IF;
      IF nullif(trim(e.item->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Ejercicio sin nombre'; END IF;
      eid:=nullif(e.item->>'id','')::uuid;
      IF eid IS NOT NULL THEN
        IF eid=ANY(input_exercises) THEN RAISE EXCEPTION 'Ejercicio duplicado'; END IF;
        IF NOT EXISTS(SELECT 1 FROM public.routine_exercises ex JOIN public.routine_days dy ON dy.id=ex.day_id
          WHERE ex.id=eid AND dy.routine_id=p_routine_id)
        THEN RAISE EXCEPTION 'Ejercicio ajeno o eliminado; vuelve a cargar'; END IF;
        input_exercises:=array_append(input_exercises,eid);
      END IF;
    END LOOP;
  END LOOP;

  IF safe_snapshot THEN
    UPDATE public.routines SET name=p_name,description=p_description
      WHERE id=p_routine_id AND (name,description) IS DISTINCT FROM (p_name,p_description);
  ELSE
    UPDATE public.routines SET name=trim(p_name),description=trim(coalesce(p_description,'')),updated_at=now()
      WHERE id=p_routine_id;
  END IF;
  FOR d IN SELECT value AS item,ordinality AS pos FROM jsonb_array_elements(p_days) WITH ORDINALITY LOOP
    did:=nullif(d.item->>'id','')::uuid;
    IF did IS NULL THEN
      INSERT INTO public.routine_days(routine_id,name,day_order)
      VALUES(p_routine_id,trim(d.item->>'name'),d.pos-1) RETURNING id INTO did;
    ELSE
      UPDATE public.routine_days SET name=CASE WHEN safe_snapshot THEN d.item->>'name' ELSE trim(d.item->>'name') END,day_order=d.pos-1
        WHERE id=did AND (NOT safe_snapshot OR (name,day_order) IS DISTINCT FROM (d.item->>'name',(d.pos-1)::integer));
    END IF;
    kept_days:=array_append(kept_days,did);
    FOR e IN SELECT value AS item,ordinality AS pos FROM jsonb_array_elements(d.item->'exercises') WITH ORDINALITY LOOP
      eid:=nullif(e.item->>'id','')::uuid;
      IF eid IS NULL THEN
        IF safe_snapshot THEN
          IF (e.item->>'sets') IS NULL OR (e.item->>'sets')::integer<1 THEN RAISE EXCEPTION 'invalid_sets'; END IF;
          IF (e.item->>'rest_seconds') IS NOT NULL AND (e.item->>'rest_seconds')::integer<0 THEN RAISE EXCEPTION 'invalid_rest'; END IF;
          INSERT INTO public.routine_exercises(day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)
          VALUES(did,e.item->>'name',(e.item->>'sets')::integer,e.item->>'target',e.item->>'rir',
            (e.item->>'rest_seconds')::integer,e.pos-1,e.item->>'notes') RETURNING id INTO eid;
        ELSE
        INSERT INTO public.routine_exercises(day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)
        VALUES(did,trim(e.item->>'name'),greatest(1,coalesce((e.item->>'sets')::integer,1)),
          coalesce(e.item->>'target',''),nullif(e.item->>'rir',''),
          greatest(0,coalesce((e.item->>'rest_seconds')::integer,0)),e.pos-1,nullif(e.item->>'notes',''))
        RETURNING id INTO eid;
        END IF;
      ELSE
        IF safe_snapshot THEN
          IF (e.item->>'sets') IS NULL OR (e.item->>'sets')::integer<1 THEN RAISE EXCEPTION 'invalid_sets'; END IF;
          IF (e.item->>'rest_seconds') IS NOT NULL AND (e.item->>'rest_seconds')::integer<0 THEN RAISE EXCEPTION 'invalid_rest'; END IF;
          UPDATE public.routine_exercises SET day_id=did,name=e.item->>'name',sets=(e.item->>'sets')::integer,
            target=e.item->>'target',rir=e.item->>'rir',rest_seconds=(e.item->>'rest_seconds')::integer,
            exercise_order=e.pos-1,notes=e.item->>'notes'
          WHERE id=eid AND (day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) IS DISTINCT FROM
            (did,e.item->>'name',(e.item->>'sets')::integer,e.item->>'target',e.item->>'rir',
             (e.item->>'rest_seconds')::integer,(e.pos-1)::integer,e.item->>'notes');
        ELSE
        UPDATE public.routine_exercises SET day_id=did,name=trim(e.item->>'name'),
          sets=greatest(1,coalesce((e.item->>'sets')::integer,1)),target=coalesce(e.item->>'target',''),
          rir=nullif(e.item->>'rir',''),rest_seconds=greatest(0,coalesce((e.item->>'rest_seconds')::integer,0)),
          exercise_order=e.pos-1,notes=nullif(e.item->>'notes',''),updated_at=now()
        WHERE id=eid;
        END IF;
      END IF;
      kept_exercises:=array_append(kept_exercises,eid);
    END LOOP;
  END LOOP;
  -- Se borran únicamente elementos omitidos intencionadamente por el editor.
  -- Los ejercicios trasladados ya apuntan a su nuevo día antes del borrado.
  DELETE FROM public.routine_exercises ex USING public.routine_days dy
  WHERE ex.day_id=dy.id AND dy.routine_id=p_routine_id AND NOT(ex.id=ANY(kept_exercises));
  DELETE FROM public.routine_days WHERE routine_id=p_routine_id AND NOT(id=ANY(kept_days));
  RETURN p_routine_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.reorder_my_routine_days_atomic(p_routine_id uuid, p_day_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  expected_count integer;
  actual_count integer;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if not exists(select 1 from public.routines where id=p_routine_id and owner_id=auth.uid() and deleted_at is null) then raise exception 'Rutina no disponible'; end if;
  IF EXISTS(SELECT 1 FROM public.routine_assignments WHERE trainer_routine_id=p_routine_id) AND current_setting('simple.template_order_scope',true) IS DISTINCT FROM ('day:'||p_routine_id::text) THEN RAISE EXCEPTION 'routine_scope_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  expected_count=coalesce(array_length(p_day_ids,1),0);
  if expected_count=0 then raise exception 'Lista de sesiones vacía'; end if;
  select count(*) into actual_count from public.routine_days where routine_id=p_routine_id and id=any(p_day_ids);
  if actual_count<>expected_count then raise exception 'La lista de sesiones no coincide con la rutina'; end if;
  if (select count(*) from unnest(p_day_ids) u(id))<>(select count(distinct id) from unnest(p_day_ids) u(id)) then raise exception 'Hay sesiones duplicadas'; end if;
  update public.routine_days d set day_order=1000000+x.ord from unnest(p_day_ids) with ordinality x(id,ord) where d.id=x.id and d.routine_id=p_routine_id;
  update public.routine_days d set day_order=x.ord-1 from unnest(p_day_ids) with ordinality x(id,ord) where d.id=x.id and d.routine_id=p_routine_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.reorder_my_routine_exercises_atomic(p_day_id uuid, p_exercise_ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  expected_count integer;
  actual_count integer;
  routine_owner uuid;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  select r.owner_id into routine_owner
  from public.routine_days d join public.routines r on r.id=d.routine_id
  where d.id=p_day_id and r.deleted_at is null;
  if routine_owner is distinct from auth.uid() then raise exception 'Sesión no disponible'; end if;
  IF EXISTS(SELECT 1 FROM public.routine_assignments a JOIN public.routine_days d ON d.routine_id=a.trainer_routine_id WHERE d.id=p_day_id) AND current_setting('simple.template_order_scope',true) IS DISTINCT FROM ('exercise:'||p_day_id::text) THEN RAISE EXCEPTION 'routine_scope_required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  expected_count=coalesce(array_length(p_exercise_ids,1),0);
  if expected_count=0 then raise exception 'Lista de ejercicios vacía'; end if;
  select count(*) into actual_count from public.routine_exercises where day_id=p_day_id and id=any(p_exercise_ids);
  if actual_count<>expected_count then raise exception 'La lista de ejercicios no coincide con la sesión'; end if;
  if (select count(*) from unnest(p_exercise_ids) u(id))<>(select count(distinct id) from unnest(p_exercise_ids) u(id)) then raise exception 'Hay ejercicios duplicados'; end if;
  update public.routine_exercises e set exercise_order=1000000+x.ord from unnest(p_exercise_ids) with ordinality x(id,ord) where e.id=x.id and e.day_id=p_day_id;
  update public.routine_exercises e set exercise_order=x.ord-1 from unnest(p_exercise_ids) with ordinality x(id,ord) where e.id=x.id and e.day_id=p_day_id;
end;
$function$
;

CREATE FUNCTION public.reorder_template_routine_structure(p_routine_id uuid,p_order jsonb) RETURNS void
LANGUAGE plpgsql SET search_path='pg_catalog','public' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.routines WHERE id=p_routine_id AND owner_id=auth.uid() AND deleted_at IS NULL) THEN RAISE EXCEPTION 'routine_not_authorized' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 IF p_order->>'kind'='day' THEN
  PERFORM set_config('simple.template_order_scope','day:'||p_routine_id::text,true);
  PERFORM public.reorder_my_routine_days_atomic(p_routine_id,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_order->'ids')));
 ELSIF p_order->>'kind'='exercise' AND EXISTS(SELECT 1 FROM public.routine_days WHERE id=(p_order->>'day_id')::uuid AND routine_id=p_routine_id) THEN
  PERFORM set_config('simple.template_order_scope','exercise:'||(p_order->>'day_id'),true);
  PERFORM public.reorder_my_routine_exercises_atomic((p_order->>'day_id')::uuid,ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(p_order->'ids')));
 ELSE RAISE EXCEPTION 'invalid_order';END IF;
 PERFORM set_config('simple.template_order_scope','',true);
EXCEPTION WHEN OTHERS THEN PERFORM set_config('simple.template_order_scope','',true);RAISE;
END $$;
REVOKE ALL ON FUNCTION public.reorder_template_routine_structure(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reorder_template_routine_structure(uuid,jsonb) TO authenticated;
;
CREATE OR REPLACE FUNCTION public.get_client_custom_routine_cycle_progress(p_client_id uuid, p_routine_id uuid)
 RETURNS TABLE(total_days bigint, completed_days bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_total bigint;
  v_structure jsonb;
  v_stage timestamptz;
  v_done bigint := 0;
  v_seen text[] := '{}';
  v_last_completion_date date := null;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_key text;
  r record;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_client_id is null or p_routine_id is null then raise exception 'Not authorized'; end if;
  if auth.uid() = p_client_id and not (
    exists(select 1 from public.routines own_routine
      where own_routine.id=p_routine_id and own_routine.owner_id=auth.uid())
    or exists(select 1 from public.routine_assignments a
      where a.client_id=auth.uid() and a.trainer_routine_id=p_routine_id
        and a.client_deleted_at is null)
  ) then raise exception 'Not authorized'; end if;

  if auth.uid() <> p_client_id and not exists (
    select 1 from public.routine_assignments a
    where a.trainer_id=auth.uid()
      and a.client_id=p_client_id
      and a.trainer_routine_id=p_routine_id
      and a.client_deleted_at is null
  ) then raise exception 'Not authorized'; end if;

  IF NOT EXISTS(SELECT 1 FROM public.routine_assignments a JOIN public.client_routine_customizations c ON c.assignment_id=a.id WHERE a.client_id=p_client_id AND a.trainer_routine_id=p_routine_id) THEN
    return query select * from public.get_client_routine_stage_cycle_progress(p_client_id,p_routine_id);return;
  END IF;
  v_structure:=public.get_client_routine_structure(p_client_id,p_routine_id);
  select s.started_at into v_stage from public.client_routine_statistics_stages s
    where s.client_id=p_client_id and s.routine_id=p_routine_id order by s.started_at desc,s.id desc limit 1;

  with effective_days as (select (value->>'id')::uuid id,p_routine_id routine_id,value->>'name' name from jsonb_array_elements(v_structure->'days'))
  select count(*) into v_total
  from effective_days d
  where d.routine_id=p_routine_id;

  if v_total=0 then
    return query select 0::bigint,0::bigint;
    return;
  end if;

  for r in
    -- Historical day continuity confirmed by the owner on 2026-09-21.
    -- Scope is this client AND routine only. These aliases affect cycle counting,
    -- never workout JSON, exercises, notes, charts or historical identity.
    with effective_days as (select (value->>'id')::uuid id,p_routine_id routine_id,value->>'name' name from jsonb_array_elements(v_structure->'days')),
    confirmed_day_aliases(client_id,routine_id,old_day_id,current_day_id) as (
      values
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'05b6c573-abcb-4259-9c0a-93459ddd5a24'::uuid,'1f9fbb95-9941-4cc4-989c-bfc1d590977b'::uuid),
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'879e13f3-9c0d-4020-b10d-d7f753fedb6b'::uuid,'21a2160e-8822-423a-933f-e0413136983c'::uuid),
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'0e4e1c85-3612-481c-9f67-41345b0afa20'::uuid,'950d5458-270f-4f9a-a16a-be4c7d346ca7'::uuid),
        ('b7ee910d-bc34-402c-b1a3-5cacceb29519'::uuid,'ba2d0a25-1844-45c1-9777-f0e1aa7aa392'::uuid,'041166f2-4306-45c1-b86f-0eb4aca27ed1'::uuid,'7f929817-c4cf-447b-b7f1-0353f73d6659'::uuid)
    )
    select w.workout_date,
           w.created_at,
           case
             when nullif(w.data->>'routine_day_id','') is not null then
               coalesce(
                 (select d.id::text from effective_days d
                  where d.routine_id=p_routine_id
                    and d.id::text=w.data->>'routine_day_id'),
                 (select d.id::text from confirmed_day_aliases a
                  join effective_days d
                    on d.id=a.current_day_id and d.routine_id=a.routine_id
                  where a.client_id=p_client_id and a.routine_id=p_routine_id
                    and a.old_day_id::text=w.data->>'routine_day_id')
               )
             else
               (select min(d.id::text) from effective_days d
                where d.routine_id=p_routine_id
                  and lower(trim(d.name))=lower(trim(coalesce(w.data->>'day_name','')))
                having count(*)=1)
           end as resolved_day_id
    from public.workouts w
    where w.user_id=p_client_id
      and (w.data->>'routine_id')=p_routine_id::text
      and (v_stage is null or w.created_at>=v_stage)
    order by w.workout_date asc, w.created_at asc, w.id asc
  loop
    v_key:=coalesce(r.resolved_day_id,'');
    if v_key='' then continue; end if;

    -- A repeated day before completing the cycle means the client has
    -- started a new turn of the routine. The repeated day is day 1.
    if v_key=any(v_seen) and v_done<v_total then
      v_seen:=array[v_key];
      v_done:=1;
    else
      v_seen:=array_append(v_seen,v_key);
      v_done:=v_done+1;
    end if;

    if v_done>=v_total then
      v_last_completion_date:=r.workout_date;
      v_seen:='{}';
      v_done:=0;
    end if;
  end loop;

  -- A cycle completed today remains at 100% for today. After that day,
  -- the new cycle starts from zero unless workouts have already been done.
  if v_last_completion_date=v_today then
    return query select v_total,v_total;
    return;
  end if;

  return query select v_total,v_done;
end
$function$
;
REVOKE ALL ON FUNCTION public.get_client_custom_routine_cycle_progress(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_client_custom_routine_cycle_progress(uuid,uuid) TO authenticated;
