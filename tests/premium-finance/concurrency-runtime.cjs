/* STAGING HARNESS. No execution on import, no provider transport, no persisted tokens. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const readline = require('node:readline');
const STAGING = 'dmqjexigdnfzobarhnib';
const URL = 'https://' + STAGING + '.supabase.co';
const ROOT = path.resolve(__dirname, '../..');
const CONFIG = path.join(__dirname, 'private/config.json');
const CREDS = process.env.SIMPLE_FINANCE_CREDENTIALS_FILE || path.join(__dirname, 'private/credentials.json');
const CLIENTS = ['mock', 'real', 'retry'];
const ACTORS = [...CLIENTS, 'reviewer', 'trainer'];
const uuid = v => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const sessions = new Map();
let credentials;
function creds() {
  if (!credentials) credentials = JSON.parse(fs.readFileSync(CREDS, 'utf8'));
  if (credentials.ref !== STAGING || !credentials.key || ACTORS.some(k => !uuid(credentials.users?.[k]?.id))) throw Error('invalid_staging_fixture');
  return credentials;
}
function config() {
  const c = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (c.ref !== STAGING || !uuid(c.run_id) || !c.clients) throw Error('invalid_staging_config');
  for (const name of CLIENTS) if (c.clients[name]?.user !== creds().users[name].id || !uuid(c.clients[name]?.routine)) throw Error('fixture_identity_mismatch');
  return c;
}
const secretValue = /(?:Bearer\s+|eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]+\.|sk-(?:proj-)?[A-Za-z0-9_-]{12,})/i;
const secretKey = /(?:password|secret|authorization|api.?key|cookie|credential)|^(?:token|access_?token|refresh_?token|id_?token)$/i;
function safe(value, key = '') {
  if (secretKey.test(key)) return undefined;
  if (typeof value === 'string') return secretValue.test(value) || /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(value) ? '[redacted]' : value;
  if (Array.isArray(value)) return value.map(v => safe(v)).filter(v => v !== undefined);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, safe(v, k)]).filter(([, v]) => v !== undefined));
  return value;
}
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(safe(value), null, 2)); }
async function readResponse(response) {
  const raw = await response.text();
  if (raw.length > 1000000) throw Error('oversized_runtime_response');
  try { return JSON.parse(raw); } catch { return { error: 'non_json_response' }; }
}
async function session(actor) {
  if (!ACTORS.includes(actor)) throw Error('actor_not_allowlisted');
  const s = sessions.get(actor);
  if (s && s.expires > Date.now() + 90000) return s;
  const f = creds(), u = f.users[actor];
  const r = await fetch(URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: f.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: u.password }), signal: AbortSignal.timeout(15000) });
  const v = await readResponse(r);
  if (!r.ok || v.user?.id !== u.id || typeof v.access_token !== 'string') throw Error('synthetic_auth_failed_' + r.status);
  const access = v.access_token;
  // Supabase also returns a refresh token. Deliberately discard it immediately.
  delete v.refresh_token; delete v.access_token;
  const verify = await fetch(URL + '/auth/v1/user', { headers: { apikey: f.key, Authorization: 'Bearer ' + access }, signal: AbortSignal.timeout(15000) });
  const identity = await readResponse(verify);
  if (!verify.ok || identity.id !== u.id) throw Error('synthetic_identity_mismatch');
  const next = { access, id: u.id, expires: Date.now() + Math.max(0, Number(v.expires_in || 3600)) * 1000 };
  sessions.set(actor, next); return next;
}
async function api(actor, route, body, method = 'POST') {
  const f = creds(), s = await session(actor);
  // Destination and routes are closed; no arbitrary URL, headers, or provider calls.
  if (!/^\/rest\/v1\/(rpc\/premium_[a-z_]+|coach_mesocycles\?)/.test(route)) throw Error('runtime_route_denied');
  const r = await fetch(URL + route, { method, headers: { apikey: f.key, Authorization: 'Bearer ' + s.access, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
  const v = await readResponse(r);
  if (!r.ok) throw Error('staging_rpc_failed_' + r.status + '_' + (/^premium_[a-z_]+$/.test(v.message || '') ? v.message : 'request_failed'));
  return v;
}
const rpc = (actor, name, args = {}) => api(actor, '/rest/v1/rpc/' + name, args);
const localDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
function prepare() {
  if (fs.existsSync(CONFIG)) return { prepared: false, reused: true, config: safe(config()) };
  fs.mkdirSync(path.dirname(CONFIG), { recursive: true });
  const f = creds(), c = { ref: STAGING, run_id: crypto.randomUUID(), created_at: new Date().toISOString(), clients: {} };
  for (const name of CLIENTS) c.clients[name] = { user: f.users[name].id, routine: crypto.randomUUID(), days: [crypto.randomUUID(), crypto.randomUUID()], exercises: Array.from({ length: 4 }, () => crypto.randomUUID()), keys: { start: crypto.randomUUID() } };
  writeJson(CONFIG, c);
  const q = v => "'" + String(v).replaceAll("'", "''") + "'";
  const lines = ['-- PRIVATE STAGING FIXTURES ONLY. No Auth, allowance or financial configuration writes.', 'BEGIN;', "DO $$ BEGIN IF current_database() <> 'postgres' THEN RAISE EXCEPTION 'unexpected_database'; END IF; END $$;"];
  const cats = ['goblet', 'floor_press', 'db_row', 'db_curl'];
  for (const name of CLIENTS) {
    const a = c.clients[name];
    lines.push(`DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=${q(a.user)} AND role='client') THEN RAISE EXCEPTION 'synthetic_client_missing'; END IF; END $$;`);
    lines.push(`INSERT INTO public.routines(id,owner_id,name) VALUES(${q(a.routine)},${q(a.user)},${q('SYNTHETIC FINANCE ' + c.run_id + ' ' + name)});`);
    for (let d = 0; d < 2; d++) lines.push(`INSERT INTO public.routine_days(id,routine_id,name,day_order) VALUES(${q(a.days[d])},${q(a.routine)},${q('SYNTHETIC ' + (d + 1))},${d});`);
    for (let i = 0; i < 4; i++) lines.push(`INSERT INTO public.routine_exercises(id,day_id,name,sets,target,rir,rest_seconds,exercise_order,notes) SELECT ${q(a.exercises[i])},${q(a.days[Math.floor(i / 2)])},x->>'name',2,'8-12','2',180,${i % 2},NULL FROM jsonb_array_elements(coach_private.premium_catalogue())x WHERE x->>'id'=${q(cats[i])};`);
  }
  lines.push('COMMIT;');
  fs.writeFileSync(path.join(__dirname, 'private/fixture-setup.sql'), lines.join('\n') + '\n');
  return { prepared: true, config: safe(c), fixture_sql: 'tests/premium-finance/private/fixture-setup.sql', note: 'No SQL executed. Project check, gate, entitlement and ledger controls belong to the staging owner.' };
}
async function sync() {
  const c = config();
  for (const actor of CLIENTS) {
    const a = c.clients[actor];
    const rows = await api(actor, '/rest/v1/coach_mesocycles?select=id,current_revision_id,row_version,tracking_week&routine_id=eq.' + a.routine + '&user_id=eq.' + a.user, null, 'GET');
    if (!Array.isArray(rows) || rows.length > 1) throw Error('ambiguous_synthetic_mesocycle');
    if (rows[0]) Object.assign(a, { mesocycle: rows[0].id, revision: rows[0].current_revision_id, row_version: rows[0].row_version, week: rows[0].tracking_week });
  }
  writeJson(CONFIG, c); return safe(c);
}
async function start() {
  const c = config(), I = require(path.join(ROOT, 'assets/coach-intake.js'));
  const training = { ...I.emptyPremium(), experience: 'gt4', pause: false, goal: 'balanced', weak_points: ['unsure'], days: 2, weekdays: ['mon', 'thu'], minutes_by_day: { mon: 60, thu: 60 }, effort: 'confident', confidence: 'high', recovery: 'mostly', sleep: 'h7_8', stress: 'medium', distribution: 'coach', activity: { type: 'none', weekdays: [], minutes: null, intensity: null }, inventory: { equipment: I.equipment.map(e => e.id), custom: [] } };
  const weekly = { schema_version: 'premium-weekly-checkin-v1', recovery: 'good', sleep: 'normal', fatigue: 'normal', stress: 'moderate', session_perception: 'similar', availability: { changed: false, weekdays: [], minutes_by_day: {} }, review: { topic: 'none', exercise_id: null } };
  for (const actor of CLIENTS) {
    const a = c.clients[actor], access = await rpc(actor, 'premium_my_access');
    if (!access.enabled) throw Error('synthetic_entitlement_missing');
    await rpc(actor, 'premium_admission_permission', { p_allow: true, p_notice: access.notice_version });
    if (!a.start_date) { a.start_date = localDate(); writeJson(CONFIG, c); }
    a.mesocycle = await rpc(actor, 'premium_start_followup', { p_routine: a.routine, p_key: a.keys.start, p_start: a.start_date, p_weeks: 6 });
    writeJson(CONFIG, c);
    const rows = await api(actor, '/rest/v1/coach_mesocycles?select=id,current_revision_id,row_version,tracking_week,intake_submitted_at&routine_id=eq.' + a.routine + '&user_id=eq.' + a.user, null, 'GET');
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== a.mesocycle) throw Error('synthetic_mesocycle_mismatch');
    const m = rows[0]; a.revision = m.current_revision_id; a.row_version = m.row_version; a.week = m.tracking_week; writeJson(CONFIG, c);
    if (!m.intake_submitted_at) await rpc(actor, 'premium_save_intake', { p_mesocycle: a.mesocycle, p_expected: m.row_version, p_training: training, p_submit: true });
    for (const name of ['premium_permission', 'premium_weekly_permission', 'premium_chat_permission']) await rpc(actor, name, { p_mesocycle: a.mesocycle, p_allow: true });
    // This is idempotent for the exact same synthetic answers; no calendar manipulation.
    await rpc(actor, 'premium_save_weekly_checkin', { p_mesocycle: a.mesocycle, p_week: a.week, p_revision: a.revision, p_expected: 0, p_answers: weekly, p_submit: true });
  }
  return sync();
}
function requestSpec(spec) {
  const c = config(), actor = spec.actor || spec.who || spec.label;
  if (!ACTORS.includes(actor)) throw Error('actor_not_allowlisted');
  const input = spec.body || spec, body = {};
  for (const key of ['action', 'kind', 'mesocycle', 'id', 'key', 'case', 'scenario', 'hold_ms']) if (input[key] !== undefined) body[key] = input[key];
  if (!['reserve', 'claim', 'finish', 'state', 'expire', 'reconcile', 'resume'].includes(body.action) || !['chat', 'analysis'].includes(body.kind) || !Number.isInteger(body.case) || body.case < 1 || body.case > 12) throw Error('closed_scenario_required');
  body.scenario ??= 'normal'; body.hold_ms ??= 0;
  if (!['normal', 'unknown', 'oversize', 'probe', 'equal'].includes(body.scenario) || ![0, 1200].includes(body.hold_ms)) throw Error('closed_scenario_required');
  body.mesocycle ??= c.clients[actor]?.mesocycle;
  if (!uuid(body.mesocycle) || body.id !== undefined && !uuid(body.id) || body.key !== undefined && !uuid(body.key)) throw Error('invalid_synthetic_target');
  if (body.action === 'reserve') body.key ??= crypto.randomUUID();
  return { actor, body, run_id: c.run_id };
}
async function dispatch(spec) {
  const req = requestSpec(spec), f = creds(), s = await session(req.actor), begin = performance.now(), started_at = new Date().toISOString();
  const response = await fetch(URL + '/functions/v1/simple-coach-finance-qa', { method: 'POST', headers: { apikey: f.key, Authorization: 'Bearer ' + s.access, 'Content-Type': 'application/json' }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(30000) });
  const result = await readResponse(response), end = performance.now();
  return safe({ actor: req.actor, run_id: req.run_id, request: req.body, status: response.status, started_at, finished_at: new Date().toISOString(), begin_ms: begin, end_ms: end, elapsed_ms: end - begin, result });
}
async function command(cmd) {
  if (!cmd || typeof cmd !== 'object') throw Error('invalid_command');
  if (cmd.op === 'prepare') return prepare();
  if (cmd.op === 'sync') return sync();
  if (cmd.op === 'start') return start();
  if (cmd.op === 'one') return dispatch(cmd.request || cmd);
  if (cmd.op === 'pair') {
    const specs = cmd.requests || cmd.items;
    if (!Array.isArray(specs) || specs.length !== 2) throw Error('pair_requires_two_requests');
    // Authenticate before the common dispatch barrier. Both HTTP windows then truly overlap.
    const normalized = specs.map(requestSpec); await Promise.all([...new Set(normalized.map(x => x.actor))].map(session));
    const results = await Promise.all(specs.map(dispatch));
    return { requests: results, overlapping_http_windows: Math.max(...results.map(x => x.begin_ms)) < Math.min(...results.map(x => x.end_ms)), server_overlap_requires_audit: true };
  }
  if (cmd.op === 'close') { sessions.clear(); credentials = null; return { closed: true, tokens_persisted: false }; }
  throw Error('unsupported_command');
}
async function main() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { const cmd = JSON.parse(line), result = await command(cmd); process.stdout.write(JSON.stringify(safe({ ok: true, result })) + '\n'); if (cmd.op === 'close') { rl.close(); break; } }
    catch (e) { const code = /^[a-z0-9_]+$/i.test(e.message || '') ? e.message : 'runtime_command_failed'; process.stdout.write(JSON.stringify({ ok: false, error: code }) + '\n'); }
  }
  sessions.clear(); credentials = null;
}
module.exports = { command, safe };
if (require.main === module) main().catch(() => { sessions.clear(); credentials = null; process.stderr.write('runtime_failed\n'); process.exitCode = 1; });
