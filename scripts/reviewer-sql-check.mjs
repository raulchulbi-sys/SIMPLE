// Offline release check only. Never connects to a database or executes SQL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const digest = (algorithm, text) => crypto.createHash(algorithm).update(text).digest('hex');
export const approved = Object.freeze({
  review_coach_proposal: 'd94b96ae65e69997a37ae83b521ec16b',
  authorize_coach_retry: 'cdf6200bb140563a96ddc472cc0ac9b7',
  premium_initial_review: 'c16541b25d191997fce42c2024784c7d',
});
export const basic = 'supabase/coach-reviewer-scope.sql';
export const premium = 'supabase/premium-initial-review-uniform-denial.sql';
const rollback = 'supabase/rollback-premium-initial-review-uniform-denial.sql';
const writers = new Set([
  basic, premium, rollback,
  'supabase/rollback-coach-reviewer-uniform-denial.sql',
  'supabase/rollback-coach-reviewer-scope.sql',
  'supabase/rollback-coach-generation-allowance.sql',
  'supabase/rollback-coach-pilot-v2.sql',
  'supabase/migrations/20260928182139_coach_phase1c_supervised_pilot.sql',
  'supabase/migrations/20260928223506_coach_pilot_training_only_v2.sql',
  'supabase/migrations/20261001180800_coach_generation_allowance.sql',
  'supabase/migrations/20261011154036_coach_premium_initial.sql',
]);
const lf = text => text.replaceAll('\r\n', '\n');

// This deliberately supports only the versioned dollar-quoted declarations.
// It is a source inventory, not a general PostgreSQL parser or SQL executor.
export function bodies(text) {
  return [...lf(text).matchAll(/create\s+(?:or\s+replace\s+)?function\s+public\.(review_coach_proposal|authorize_coach_retry|premium_initial_review)\s*\([\s\S]*?\bas\s+(\$[a-z_]*\$)([\s\S]*?)\2\s*;/gi)]
    .map(match => ({name: match[1].toLowerCase(), md5: digest('md5', match[3])}));
}
function requireThat(condition, reason) { if (!condition) throw Error(reason); }
export function verifySources(readFile = read) {
  const found = [...bodies(readFile(basic)), ...bodies(readFile(premium))];
  requireThat(found.length === 3, 'Exactly three approved RPC definitions required');
  for (const [name, md5] of Object.entries(approved)) {
    const matches = found.filter(row => row.name === name);
    requireThat(matches.length === 1 && matches[0].md5 === md5, 'Unapproved body: ' + name);
  }
  for (const [file, sha256] of [
    [premium, '1dd35ba1a36dfcf1d11f6d0a07ec53540c20326ca1818cf89010a26890ad2458'],
    [rollback, '4d2b33ed2b6770dfc1eb76dd17581ab004f6779334219a1a022e433819604428'],
  ]) requireThat(digest('sha256', lf(readFile(file))) === sha256, 'Unapproved LF artifact: ' + file);
  return found;
}
export function auditWriters(files, readFile = read) {
  const found = [];
  for (const file of files) {
    const rows = bodies(readFile(file));
    if (!rows.length) continue;
    requireThat(writers.has(file), 'Unreviewed RPC writer: ' + file);
    found.push({file, bodies: rows});
  }
  return found;
}
export function verifyPlan(plan, readFile = read) {
  verifySources(readFile);
  requireThat(plan && ['configured', 'bootstrap'].includes(plan.mode) && Array.isArray(plan.files), 'Invalid plan');
  requireThat(Object.keys(plan).sort().join(',') === 'files,mode', 'Unknown plan fields');
  requireThat(new Set(plan.files).size === plan.files.length, 'Duplicate SQL file');
  // Configured staging already has A/B. Only the narrow Premium delta or a no-op
  // belongs in this plan. A matching live body means skip even that delta.
  const state = plan.mode === 'configured' ? {...approved} : {};
  const knownMigrations = new Set(sqlFiles().filter(file => file.startsWith('supabase/migrations/')));
  for (const file of plan.files) {
    requireThat(typeof file === 'string' && !file.includes('..') && !file.includes('\\'), 'Invalid SQL path');
    requireThat(plan.mode === 'configured' ? file === premium : knownMigrations.has(file) || file === basic || file === premium, 'File forbidden for this forward plan: ' + file);
    for (const row of bodies(readFile(file))) state[row.name] = row.md5;
  }
  for (const [name, md5] of Object.entries(approved)) requireThat(state[name] === md5, 'Final RPC is missing or vulnerable: ' + name);
  return {mode: plan.mode, files: plan.files, finalBodies: state,
    limitation: 'Source/order check only; not a dependency, permission, live preimage or deployment authorization.'};
}
function sqlFiles(directory = 'supabase') {
  return fs.readdirSync(path.join(root, directory), {withFileTypes: true}).sort((a,b) => a.name.localeCompare(b.name))
    .flatMap(entry => {
      const file = directory + '/' + entry.name;
      if (entry.isDirectory() && !entry.name.startsWith('.')) return sqlFiles(file);
      return entry.isFile() && entry.name.endsWith('.sql') ? [file] : [];
    });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  requireThat(!args.length || (args.length === 2 && args[0] === '--plan'), 'Usage: node scripts/reviewer-sql-check.mjs [--plan local-plan.json]');
  const result = {approved: verifySources(), inventory: auditWriters(sqlFiles())};
  if (args.length) result.plan = verifyPlan(JSON.parse(fs.readFileSync(args[1], 'utf8')));
  console.log(JSON.stringify(result, null, 2));
}
