# Basic SDK rehearsal — closed, 26 October 2026

Scope: SIMPLE Security Test only, four existing synthetic actors, one owner/reviewer
access window, deterministic V5-compatible proposal, zero provider calls and zero USD.
This closes the authorized rehearsal; it does not authorize another activation.
No product, training, programming, Auth configuration, RLS or production change.
Main remains `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`; hosting PR #1 is unchanged.
PR #2 remains draft and unmerged.

## Evidence and exact counts

| Evidence | Unique assertions | Result |
| --- | ---: | --- |
| Real SDK 2.115.0 / staging JWT / actual UI | 21 | PASS |
| PostgreSQL read-only security fingerprint and guard regressions | 14 | PASS |
| Offline runner navigation race regression | 2 | PASS |
| Existing pilot safety regression | 14 | PASS, reused/rerun; excluded from new total |

The 37 new unique assertions belong to this rehearsal and its harness correction.
Partial executions and continuations are not counted twice. The final closeout did
not repeat them or sign in again. The earlier 156 and other historical suites were
not rerun. Integrity comparisons are reported separately: 27/27 count/hash references,
16/16 function definitions/owners/ACLs, and the unchanged security catalog hash.

The actual SDK journey verified four identities with Auth, the consumed one-generation
limit, exact owner/intake/provenance, populated private-operation denial for the other
client/trainer/reviewer, reviewer projection denial for the other client and trainer,
premature-acceptance rejection, reconciliation and full reload, the single permitted
reviewer projection, UI approval and acceptance, idempotent repeated acceptance,
one routine/revision, V5 targets, one saved workout/four notes, and history readback.
The history continuation used a new memory-only owner session with business writes
blocked, after the temporary Basic/reviewer configs had already been disabled.

The proposal was registered administratively as a synthetic fixture. Deliberately
entering the uncertain-request view is controlled setup, not a real lost Edge response.
No model generation, Edge provider registration, real OpenAI receipt or sporting quality
is proved here. All Edge endpoints and non-staging external hosts were blocked.

The final structure equality assertion ran during the history-only continuation; it
compares its before/after reads. It is not an independent pre-training byte snapshot.
The network write allowlist prohibited all prescription writes throughout the run;
the 27 original-data references also stayed unchanged. No broader claim is inferred.

## Harness defects corrected

1. `pg_policies` deparses expressions using the caller's `search_path`, producing a
   false `security_catalog_changed`. `pilot-plan.cjs` now reads stored `pg_policy`
   expression trees, role OIDs, command and permissive flag. Table ACL/RLS inputs and
   the separate function definition/owner/ACL guards remain enforced. OID/tree hashes
   are compared within the same database/version, not across database restores.
   PostgreSQL reference: https://www.postgresql.org/docs/17/catalog-pg-policy.html
2. The runner clicked Open and immediately called `startWorkoutDay` while the routine
   reads were still pending. It now waits for and clicks the rendered day control.
3. Save intentionally closes the training modal. The runner now reopens the saved day
   before navigating to History. No product navigation was changed.

The 14 fingerprint cases comprise three search paths, eight projected catalog faults
(USING, WITH CHECK, role targets, command, permissive flag, RLS, forced RLS, table ACL),
and three exact generated SQL-guard rejections for altered function owner/ACL/hash
expectations. Fault injection is read-only: no real policy, grant or role was edited.
It proves sensitivity to those catalog fields, not a new live permission mutation test.

`--resume-training` and `--resume-history` accept only the exact recorded checkpoint,
unchanged run/IDs and original window. Training continuation requires no existing
workout/notes; history continuation blocks business writes. Neither creates a fixture,
approves, accepts or extends access. Source pin/approval hashes were explicitly reviewed
and refreshed for those harness fixes; activation and expiry timestamps did not change.
In continuation receipts, `accepts=3` saturates the acceptance guard; it is not three
additional calls. The initial receipt records the actual three requests: premature
denial, accepted proposal, and idempotent replay.

## Cleanup and integrity

The original access window began at 17:42:38 UTC and was capped at 18:42:38 UTC.
Both configs were explicitly restored before the training/history continuations.
The interrupted task was resumed for cleanup only; no new activation, data or login.

Only exact receipt UUIDs were deleted in a guarded transaction:

| Synthetic records removed | Count |
| --- | ---: |
| Context grant, submitted intake, Basic operation | 3 |
| Routine, management row, accepted revision | 3 |
| Routine days / exercises | 3 / 12 |
| Workout / personal notes | 1 / 4 |
| Total | 26 |

The SQL checked provenance, owner, child UUID lists, foreign references, scopes off,
original-data hashes and final baseline. FK/cascade targets and delete triggers were
reviewed in read-only mode. No whole-user deletion, cascade guess or grant extension.
One connector request expired before cleanup was confirmed. A read showed the three
root records still present; the same transaction was then submitted successfully.
It was not blindly repeated after an ambiguous response.

Final snapshot at 19:35:58 UTC: all 27 original counts AND hashes match. In particular:
19 routines, 33 days, 98 exercises, 4 revisions, 22 workouts, 4 notes, zero Basic
intakes/operations, original 10 context grants. Both configs are `{}`. All 16 critical
function definitions/owners/ACLs and table/policy security hash match. No test rows
or newly created test Auth sessions remain. Normal login timestamps are excluded
from stable Auth identity hashes; no identity, role or Auth setting was changed.

Private evidence remains ignored under `tests/coach-flow/private/basic-sdk-repeat-20261026/`
and `tests/coach-flow/results/`: baseline/final snapshots, exact SQL, bounded receipts,
interrupted checkpoints and security regression results. No tokens, credentials,
private receipts or personal data belong in Git. SDK tokens existed only in Node
runtime memory; isolated browser contexts closed and sessions were signed out.

## Remaining before a real-model Basic trial

A separate explicit authorization is needed for the exact staging account, temporary
generation allowance/scope, maximum one provider attempt, model/output-token/cost cap,
and cleanup. Recheck Financial P1/kill switches and the minimum required Edge boundary
before enabling that one path. This zero-provider runner must not be silently changed
into a paid test. A real model response still requires output/quality validation,
human review and explicit acceptance. Production, Cloudflare and positive Premium
chat scopes remain separate; no deployment or PR merge is authorized by this result.
