import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { PGlite } = await import(process.argv[2] || '@electric-sql/pglite');
const db = await PGlite.create();
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8');

async function regression(file) {
  await db.exec('begin');
  try {
    await db.exec(read(file));
  } finally {
    await db.exec('rollback');
  }
}

async function definitions() {
  return (await db.query(`
    select proname, md5(pg_get_functiondef(oid)) as digest, proacl::text
    from pg_proc where proname like 'get_client_%cycle_progress' order by 1
  `)).rows;
}

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table auth.users(id uuid primary key);
    create table routines(id uuid primary key,owner_id uuid,deleted_at timestamptz);
    create table routine_days(id uuid primary key,routine_id uuid,name text,day_order int,created_at timestamptz);
    create table routine_assignments(id uuid primary key,client_id uuid,trainer_id uuid,trainer_routine_id uuid,client_routine_id uuid,client_deleted_at timestamptz);
    create table client_routine_customizations(assignment_id uuid,structure jsonb);
    create table client_routine_statistics_stages(id uuid,client_id uuid,routine_id uuid,started_at timestamptz);
    create table workouts(id uuid primary key,user_id uuid,workout_date date not null,created_at timestamptz,data jsonb);
    create function get_client_routine_structure(c uuid,r uuid) returns jsonb language sql as $$select s.structure from client_routine_customizations s join routine_assignments a on a.id=s.assignment_id where a.client_id=c and a.trainer_routine_id=r$$;
  `);

  const previous = read('../cycle-start/candidate.sql').match(/CREATE OR REPLACE FUNCTION public\.[\s\S]*?\$function\$;/g);
  assert.equal(previous.length, 3);
  for (const source of previous) {
    await db.exec(source);
    const name = source.match(/FUNCTION (public\.\w+)/)[1];
    const roles = name.includes('_stage_') ? 'authenticated' : 'authenticated, service_role';
    await db.exec(`revoke all on function ${name}(uuid,uuid) from public;
      grant execute on function ${name}(uuid,uuid) to ${roles}`);
  }

  const before = await definitions();
  await assert.rejects(regression('regression.sql'), /expected 1\/5, got 3\/5/);
  await db.exec(read('apply.sql'));
  const intermediate = await definitions();
  await db.exec(read('manual.sql'));

  await regression('regression.sql');
  await regression('manual-regression.sql');
  const permissions = await db.query(`
    select role, has_function_privilege(role,'public.reset_my_routine_cycle(uuid,uuid,uuid)','execute') as execute,
      has_schema_privilege(role,'simple_workout_cycle','usage') as schema_access,
      has_table_privilege(role,'simple_workout_cycle.resets','select,insert,update,delete,truncate,references,trigger') as table_access
    from unnest(array['anon','authenticated','service_role']) as roles(role)
  `);
  for (const row of permissions.rows) {
    assert.equal(row.execute, row.role === 'authenticated');
    assert.equal(row.schema_access, false);
    assert.equal(row.table_access, false);
  }
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='simple_workout_cycle.resets'::regclass")).rows[0].relrowsecurity, true);

  await db.exec(read('rollback-manual.sql'));
  assert.deepEqual(await definitions(), intermediate);
  assert.equal((await db.query("select to_regprocedure('public.reset_my_routine_cycle(uuid,uuid,uuid)') is null as removed")).rows[0].removed, true);
  await db.exec(read('manual.sql'));
  await regression('manual-regression.sql');
  await db.exec(read('rollback-manual.sql'));
  await db.exec(read('rollback.sql'));
  assert.deepEqual(await definitions(), before);
  console.log('Caso original reproducido. Pasan las tres rutas, el reinicio personal, los permisos y la reversión.');
} finally {
  await db.close();
}
