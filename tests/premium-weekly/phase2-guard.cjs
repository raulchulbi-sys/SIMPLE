const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
if (process.argv[2] === 'verify') {
  const result = JSON.parse(fs.readFileSync(path.join(__dirname, 'results/phase2-guard.json'), 'utf8'));
  assert.equal(result.final.total, 36);
  assert.equal(result.final.pass, 36);
  assert(Object.values(result.final.checks).every(value => value === true));
  assert.equal(result.final.transaction, 'rollback');
  assert.equal(result.scope.project, 'dmqjexigdnfzobarhnib');
  for (const name of ['fixture_routines', 'final_fixture_management', 'final_fixture_revisions', 'final_fixture_recommendations', 'final_fixture_mesocycles', 'final_fixture_days']) assert.equal(result.after[name], 0);
  for (const current of result.after.functions) {
    const prior = result.before.find(original => original.proname === current.name);
    for (const field of ['owner', 'acl', 'settings']) assert.equal(current[field], prior[field]);
  }
  console.log('36/36 staging SQL assertions recorded; zero transient fixture residue; owner/ACL/search_path retained.');
  process.exit(0);
}
const source = fs.readFileSync(path.join(root, 'supabase/migrations/20261003213139_coach_premium_per_set.sql'), 'utf8').replaceAll('\r\n', '\n');
const names = ['premium_check_patch', 'premium_snapshot'];
const original = Object.fromEntries(names.map(name => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = source.match(new RegExp('create or replace function coach_private\\.' + escaped + '\\([^]*?end \\$\\$;', 'i'));
  assert(found, 'Original Phase 2 definition: ' + name);
  return [name, found[0]];
}));
let check = original.premium_check_patch;
assert(check.includes('begin\n select current_revision_id'));
check = check.replace('begin\n select current_revision_id', "begin\n if p->>'field' is null then raise exception 'premium_invalid_patch';end if;\n select current_revision_id");
check = check.replace("  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is not null", "  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is null then raise exception 'premium_current_prescription_unresolved';end if;\n  if p->>'field' in ('sets','target','rir','rest_seconds','replace_exercise') and ss is not null");
let snapshot = original.premium_snapshot;
snapshot = snapshot.replace('first_set jsonb;', 'first_set jsonb;base_ex jsonb;base_count int;');
snapshot = snapshot.replace("   ss:=coach_private.premium_revision_sets(rev,(e->>'id')::uuid);", `   ss:=coach_private.premium_revision_sets(rev,(e->>'id')::uuid);
   select count(*) into base_count from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where v.id=rev and x->>'id'=e->>'id';
   base_ex:=null;
   if base_count=1 then
    select x into base_ex from public.routine_revisions v cross join lateral jsonb_array_elements(v.snapshot->'days') d cross join lateral jsonb_array_elements(d->'exercises') x where v.id=rev and x->>'id'=e->>'id';
    if ss is null and base_ex ? 'planned_sets' then raise exception 'premium_current_prescription_unresolved';end if;
   elsif base_count<>0 or not exists(select 1 from public.coach_recommendations rec cross join lateral jsonb_array_elements(rec.patches) p where rec.routine_id=r and rec.apply_txid=txid_current() and rec.state='ready' and p->>'field'='replace_exercise' and p#>>'{to,id}'=e->>'id') then
    raise exception 'premium_malformed_baseline';
   end if;`);
snapshot = snapshot.replace("end);end if;\n   new_ex", "end);\n   elsif base_ex is not null then\n    -- Unresolved legacy remains canonical; do not silently reconstruct it from live scalars.\n    e:=base_ex||(e-array['sets','target','rir','rest_seconds','reps_min','reps_max','scheme','planned_sets']);\n   end if;\n   new_ex");
assert.notEqual(check, original.premium_check_patch);
assert(snapshot.includes('premium_malformed_baseline'));
assert(snapshot.includes('e:=base_ex||'));
const file = fs.readdirSync(path.join(root, 'supabase/migrations')).find(f => f.endsWith('_coach_premium_prescription_guard.sql'));
assert(file, 'Generate migration with Supabase CLI first');
const header = '-- STAGING ONLY: fail closed on malformed canonical per-set prescriptions. No Basic, data, policies, Auth or budget changes.\n';
fs.writeFileSync(path.join(root, 'supabase/migrations', file), header + 'begin;\n' + check + '\n\n' + snapshot + '\ncommit;\n');
fs.writeFileSync(path.join(__dirname, 'phase2-guard-rollback.sql'), '-- Restores the exact two Phase 2 definitions; no data or other functions are changed.\nbegin;\n' + names.map(name => original[name]).join('\n\n') + '\ncommit;\n');
console.log(JSON.stringify({migration:file, functions:names, rollback:'phase2-guard-rollback.sql'}));
