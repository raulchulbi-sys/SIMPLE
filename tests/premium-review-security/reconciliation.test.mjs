import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {approved, basic, premium, bodies, verifySources, auditWriters, verifyPlan} from '../../scripts/reviewer-sql-check.mjs';
const root = new URL('../../', import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), 'utf8');
const oldBasic = 'supabase/migrations/20260928223506_coach_pilot_training_only_v2.sql';
const oldRetry = 'supabase/migrations/20261001180800_coach_generation_allowance.sql';
const oldPremium = 'supabase/migrations/20261011154036_coach_premium_initial.sql';
const initial = [oldBasic, oldRetry, oldPremium, basic, premium];

test('three exact approved bodies plus Premium SQL and closed rollback artifacts', () => {
  assert.deepEqual(Object.fromEntries(verifySources().map(x => [x.name, x.md5])), approved);
});
for (const name of Object.keys(approved)) test('reject source mutation of ' + name, () => {
  const file = name === 'premium_initial_review' ? premium : basic;
  const mutated = source => source.replace(new RegExp('(function public\\.' + name + '\\([\\s\\S]*?as \\$\\$)', 'i'), '$1\n-- changed body');
  assert.throws(() => verifySources(f => f === file ? mutated(read(f)) : read(f)), /Unapproved body/);
});
test('file SHA rejects changes outside the Premium body', () => {
  assert.throws(() => verifySources(f => read(f) + (f === premium ? '\n-- unapproved' : '')), /Unapproved LF artifact/);
});
test('exact closed rollback artifact cannot be silently replaced', () => {
  assert.throws(() => verifySources(f => read(f) + (f.includes('rollback-premium') ? '\n-- changed' : '')), /Unapproved LF artifact/);
});
test('configured plan allows a no-op, with explicit live-preimage limitation', () => {
  assert.deepEqual(verifyPlan({mode:'configured',files:[]}).finalBodies, approved);
});
test('configured plan permits only the exact narrow Premium delta', () => {
  assert.deepEqual(verifyPlan({mode:'configured',files:[premium]}).finalBodies, approved);
});
for (const file of [basic, oldBasic, oldRetry, oldPremium, 'supabase/billing-test-coach-gate.sql', 'supabase/rollback-coach-pilot-v2.sql', 'supabase/rollback-premium-initial-review-uniform-denial.sql']) {
  test('configured forward plan rejects reinstall/rollback ' + file, () => {
    assert.throws(() => verifyPlan({mode:'configured',files:[file]}), /forbidden/);
  });
}
test('bootstrap source ordering finishes with all three corrected bodies', () => {
  assert.deepEqual(verifyPlan({mode:'bootstrap',files:initial}).finalBodies, approved);
});
test('historical migration sequence alone fails the final checkpoint', () => {
  assert.throws(() => verifyPlan({mode:'bootstrap',files:initial.slice(0,3)}), /missing or vulnerable/);
});
for (const historical of [oldBasic, oldRetry, oldPremium]) test('reject historical overwrite after fixes: ' + historical, () => {
  assert.throws(() => verifyPlan({mode:'bootstrap',files:[basic,premium,historical]}), /missing or vulnerable/);
});
test('duplicate deltas, unknown plan fields and paths fail closed', () => {
  assert.throws(() => verifyPlan({mode:'configured',files:[premium,premium]}), /Duplicate/);
  assert.throws(() => verifyPlan({mode:'configured',files:[],skip:true}), /Unknown/);
  assert.throws(() => verifyPlan({mode:'configured',files:['../outside.sql']}), /Invalid SQL path/);
  assert.throws(() => verifyPlan({mode:'unknown',files:[]}), /Invalid plan/);
});
test('new SQL writer requires explicit inventory review', () => {
  assert.throws(() => auditWriters(['supabase/new.sql'], () => read(premium)), /Unreviewed RPC writer/);
});
test('inventory includes historical and corrected definitions without treating history as safe', () => {
  const rows = auditWriters(initial);
  assert.equal(rows.length, 5);
  assert.notEqual(bodies(read(oldPremium))[0].md5, approved.premium_initial_review);
});
test('read-only postcheck covers exact signatures, missing functions and approved hashes', () => {
  const check = read('supabase/verify-reviewer-security.sql');
  for (const hash of Object.values(approved)) assert(check.includes(hash));
  assert(check.includes('coalesce(md5(p.prosrc)=e.body_md5,false)'));
  assert(check.includes('left join pg_catalog.pg_proc'));
  assert(!/\b(create|update|insert|delete|drop|alter|grant|revoke|do)\b/i.test(check.replace(/^--.*$/gm, '')));
});
