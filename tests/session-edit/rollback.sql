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
  change jsonb; original jsonb; entity text; table_name text; allowed text[]; field text; assignments_sql text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'No autenticado'; END IF;
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

  UPDATE public.routines SET name=trim(p_name),description=trim(coalesce(p_description,'')),updated_at=now()
  WHERE id=p_routine_id;
  FOR d IN SELECT value AS item,ordinality AS pos FROM jsonb_array_elements(p_days) WITH ORDINALITY LOOP
    did:=nullif(d.item->>'id','')::uuid;
    IF did IS NULL THEN
      INSERT INTO public.routine_days(routine_id,name,day_order)
      VALUES(p_routine_id,trim(d.item->>'name'),d.pos-1) RETURNING id INTO did;
    ELSE
      UPDATE public.routine_days SET name=trim(d.item->>'name'),day_order=d.pos-1 WHERE id=did;
    END IF;
    kept_days:=array_append(kept_days,did);
    FOR e IN SELECT value AS item,ordinality AS pos FROM jsonb_array_elements(d.item->'exercises') WITH ORDINALITY LOOP
      eid:=nullif(e.item->>'id','')::uuid;
      IF eid IS NULL THEN
        INSERT INTO public.routine_exercises(day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)
        VALUES(did,trim(e.item->>'name'),greatest(1,coalesce((e.item->>'sets')::integer,1)),
          coalesce(e.item->>'target',''),nullif(e.item->>'rir',''),
          greatest(0,coalesce((e.item->>'rest_seconds')::integer,0)),e.pos-1,nullif(e.item->>'notes',''))
        RETURNING id INTO eid;
      ELSE
        UPDATE public.routine_exercises SET day_id=did,name=trim(e.item->>'name'),
          sets=greatest(1,coalesce((e.item->>'sets')::integer,1)),target=coalesce(e.item->>'target',''),
          rir=nullif(e.item->>'rir',''),rest_seconds=greatest(0,coalesce((e.item->>'rest_seconds')::integer,0)),
          exercise_order=e.pos-1,notes=nullif(e.item->>'notes',''),updated_at=now()
        WHERE id=eid;
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