-- Run ONLY in SIMPLE Security Test. Synthetic users never commit or receive email.
-- Exercises the installed RPCs under the authenticated DB role, not an HTTP/JWT login.
BEGIN;
CREATE TEMP TABLE isolation_fixture AS SELECT gen_random_uuid() trainer,gen_random_uuid() client,
 gen_random_uuid() ra,gen_random_uuid() rb,gen_random_uuid() da,gen_random_uuid() db,
 gen_random_uuid() ea,gen_random_uuid() eb;
CREATE TEMP TABLE isolation_results(name text,passed boolean);
GRANT SELECT ON isolation_fixture TO authenticated;
GRANT SELECT,INSERT ON isolation_results TO authenticated;
INSERT INTO auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 SELECT trainer,'authenticated','authenticated','isolation-'||trainer||'@example.invalid','{}'::jsonb,'{}'::jsonb,now(),now() FROM isolation_fixture
 UNION ALL SELECT client,'authenticated','authenticated','isolation-'||client||'@example.invalid','{}'::jsonb,'{}'::jsonb,now(),now() FROM isolation_fixture;
INSERT INTO profiles(id,name,role) SELECT trainer,'Isolation test trainer','trainer' FROM isolation_fixture
 UNION ALL SELECT client,'Isolation test client','client' FROM isolation_fixture;
INSERT INTO routines(id,owner_id,name) SELECT ra,trainer,'Routine A' FROM isolation_fixture
 UNION ALL SELECT rb,trainer,'Routine B' FROM isolation_fixture;
INSERT INTO routine_days(id,routine_id,name,day_order) SELECT da,ra,'LEG',0 FROM isolation_fixture
 UNION ALL SELECT db,rb,'LEG',0 FROM isolation_fixture;
INSERT INTO routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes)
 SELECT ea,da,'Same exercise name',2,'2x8',null,120,0,null FROM isolation_fixture
 UNION ALL SELECT eb,db,'Hip thrust',2,'2x7-12','1-0',120,0,'DS' FROM isolation_fixture;
INSERT INTO routine_assignments(trainer_id,client_id,trainer_routine_id)
 SELECT trainer,client,rb FROM isolation_fixture;
SELECT set_config('request.jwt.claim.sub',trainer::text,true) FROM isolation_fixture;
SET LOCAL ROLE authenticated;
DO $$
DECLARE f record; before_b jsonb; original_b jsonb; actual jsonb; snapshot jsonb; payload jsonb; failed boolean;
BEGIN
 SELECT * INTO f FROM isolation_fixture;
 SELECT to_jsonb(e) INTO before_b FROM routine_exercises e WHERE id=f.eb;
 original_b:=before_b;
 payload:=jsonb_build_object('mode','field_patch_v1','changes',jsonb_build_array(jsonb_build_object(
  'entity','exercise','id',f.ea,'day_id',f.da,'expected',jsonb_build_object('name','Same exercise name'),
  'values',jsonb_build_object('name','Only routine A changes'))));
 PERFORM save_routine_atomic(f.ra,'Routine A',null,payload);
 IF (SELECT name FROM routine_exercises WHERE id=f.ea)<>'Only routine A changes' OR
  (SELECT to_jsonb(e) FROM routine_exercises e WHERE id=f.eb) IS DISTINCT FROM before_b THEN RAISE EXCEPTION 'patch isolation failed'; END IF;
 INSERT INTO isolation_results VALUES('Editing A preserves every field and UUID of assigned B',true);
 failed:=false;
 BEGIN PERFORM save_routine_atomic(f.ra,'Routine A',null,payload);
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'editor_conflict' THEN RAISE; END IF; failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'stale patch accepted'; END IF;
 INSERT INTO isolation_results VALUES('Stale expected values rejected',true);
 FOR payload IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('entity','exercise','id',f.eb,'day_id',f.db,'expected',jsonb_build_object('name','Hip thrust'),'values',jsonb_build_object('name','Wrong routine')),
  jsonb_build_object('entity','exercise','id',f.eb,'day_id',f.da,'expected',jsonb_build_object('name','Hip thrust'),'values',jsonb_build_object('name','Wrong day')),
  jsonb_build_object('entity','day','id',f.db,'expected',jsonb_build_object('name','LEG'),'values',jsonb_build_object('name','Wrong day'))
 )) LOOP
  failed:=false;
  BEGIN PERFORM save_routine_atomic(f.ra,'Routine A',null,jsonb_build_object('mode','field_patch_v1','changes',jsonb_build_array(payload)));
  EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'foreign_or_deleted_editor_record' THEN RAISE; END IF; failed:=true; END;
  IF NOT failed THEN RAISE EXCEPTION 'foreign patch accepted'; END IF;
  INSERT INTO isolation_results VALUES('Reject foreign '||(payload->>'entity')||' with day '||coalesce(payload->>'day_id','n/a'),true);
 END LOOP;
 SELECT jsonb_build_object('name','Routine A','description',null,'days',jsonb_build_array(jsonb_build_object(
  'id',f.da,'name','LEG','day_order',0,'exercises',jsonb_build_array(to_jsonb(e)-'created_at'-'updated_at'))))
 INTO snapshot FROM routine_exercises e WHERE e.id=f.ea;
 payload:=jsonb_build_object('mode','snapshot_v2','expected',snapshot,'days',snapshot->'days');
 failed:=false;
 BEGIN PERFORM save_routine_atomic(f.ra,'Routine A',null,jsonb_set(payload,'{days,0,exercises,0,id}',to_jsonb(f.eb)));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE 'Ejercicio ajeno%' THEN RAISE; END IF; failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'foreign snapshot accepted'; END IF;
 INSERT INTO isolation_results VALUES('Snapshot cannot borrow UUID from other owned routine',true);
 payload:=jsonb_set(payload,'{days,0,exercises}',(payload#>'{days,0,exercises}')||jsonb_build_array(jsonb_build_object(
  'id',null,'name','New exercise','sets',1,'target',null,'rir',null,'rest_seconds',0,'notes','')));
 PERFORM save_routine_atomic(f.ra,'Routine A',null,payload);
 IF (SELECT count(*) FROM routine_exercises WHERE day_id=f.da)<>2 OR
  (SELECT to_jsonb(e) FROM routine_exercises e WHERE id=f.eb) IS DISTINCT FROM before_b THEN RAISE EXCEPTION 'add isolation failed'; END IF;
 INSERT INTO isolation_results VALUES('Adding to A preserves B exactly',true);
 SELECT jsonb_build_object('name','Routine A','description',null,'days',jsonb_build_array(jsonb_build_object(
  'id',f.da,'name','LEG','day_order',0,'exercises',jsonb_agg(to_jsonb(e)-'created_at'-'updated_at' ORDER BY exercise_order,id))))
 INTO snapshot FROM routine_exercises e WHERE e.day_id=f.da;
 payload:=jsonb_build_object('mode','snapshot_v2','expected',snapshot,'days',jsonb_set(snapshot->'days','{0,exercises}',jsonb_build_array(snapshot#>'{days,0,exercises,0}')));
 PERFORM save_routine_atomic(f.ra,'Routine A',null,payload);
 IF (SELECT count(*) FROM routine_exercises WHERE day_id=f.da)<>1 OR
  (SELECT to_jsonb(e) FROM routine_exercises e WHERE id=f.eb) IS DISTINCT FROM before_b THEN RAISE EXCEPTION 'remove isolation failed'; END IF;
 INSERT INTO isolation_results VALUES('Removing from A preserves B exactly',true);
 failed:=false;
 BEGIN PERFORM save_workout_day_exercises_atomic(f.da,jsonb_build_array(before_b));
 EXCEPTION WHEN OTHERS THEN failed:=true; END;
 IF NOT failed OR (SELECT to_jsonb(e) FROM routine_exercises e WHERE id=f.eb) IS DISTINCT FROM before_b THEN RAISE EXCEPTION 'legacy day RPC crossed scope'; END IF;
 INSERT INTO isolation_results VALUES('Legacy day save rejects foreign exercise and leaves B intact',true);
 -- Rehearse the authorized field correction without touching UUID, order or notes.
 PERFORM save_routine_atomic(f.rb,'Routine B',null,jsonb_build_object('mode','field_patch_v1','changes',jsonb_build_array(
  jsonb_build_object('entity','exercise','id',f.eb,'day_id',f.db,
  'expected',jsonb_build_object('name','Hip thrust','target','2x7-12','rir','1-0'),
  'values',jsonb_build_object('name','Hiperextensiones de cadera','target','2x10-15 + DS','rir',null)))));
 SELECT to_jsonb(e) INTO actual FROM routine_exercises e WHERE id=f.eb;
 IF actual IS DISTINCT FROM original_b||jsonb_build_object('name','Hiperextensiones de cadera','target','2x10-15 + DS','rir',null)
 THEN RAISE EXCEPTION 'correction modified unrelated fields'; END IF;
 INSERT INTO isolation_results VALUES('Correction preserves UUID, order, sets, rest, notes and metadata',true);
 PERFORM set_config('request.jwt.claim.sub',f.client::text,true);
 failed:=false;
 BEGIN PERFORM save_routine_atomic(f.rb,'Routine B',null,jsonb_build_object('mode','field_patch_v1','changes','[]'::jsonb));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'Rutina no disponible' THEN RAISE; END IF; failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'client edited trainer routine'; END IF;
 INSERT INTO isolation_results VALUES('Assigned client cannot edit trainer structure',true);
 PERFORM set_config('request.jwt.claim.sub','',true);
 failed:=false;
 BEGIN PERFORM save_routine_atomic(f.rb,'Routine B',null,jsonb_build_object('mode','field_patch_v1','changes','[]'::jsonb));
 EXCEPTION WHEN OTHERS THEN IF SQLERRM<>'No autenticado' THEN RAISE; END IF; failed:=true; END;
 IF NOT failed THEN RAISE EXCEPTION 'missing identity accepted'; END IF;
 INSERT INTO isolation_results VALUES('Missing authenticated identity rejected',true);
END $$;
RESET ROLE;
SELECT jsonb_agg(to_jsonb(r)) AS results FROM isolation_results r;
ROLLBACK;
