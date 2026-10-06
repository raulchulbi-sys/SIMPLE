# Chat v1.2 — replacement prescription reassessment

Scope: replace_exercise only. Historical v1/v1.1 and their captured recommendations keep the previous mapper and validator. No UI, Basic, weekly analysis, Auth, RLS, grants or training-data migration.

Cause: v1.1 deliberately required every replacement planned set to equal its source. This preserved identity and individualized series but also carried an obsolete prescription into a different exercise.

New deterministic server policy uses the existing V5 metadata and rest guidance. It retains the number of sets, compatible primary muscle/group, and weekly structure; it revalidates reps, effort and recovery. Equivalent valid prescriptions remain unchanged. Top set/back-off survives only in an equivalent compound exercise with suitable experience/effort confidence. Equipment and exclusions are mandatory. Increased fatigue and controlled-failure warnings remain visible. Projected duration uses the captured day schedule, or the shortest available intake duration; estimates include warm-up, transitions, repetitions and recovery. It refuses an increase beyond the 90% time envelope rather than shortening recovery.

No fixed Dead bug/Bird dog mapping is encoded. For the pilot profile, the deterministic evaluation of cable_crunch and reverse_crunch yields two sets each of 10–15 reps, RIR 3, 120 seconds. Other metadata/profile combinations can yield different prescriptions.

Backend: four existing private entrypoints replaced; four closed private helpers added. Existing owners, grants, search_path and policies retained. Every new helper is inaccessible to anon/authenticated/service_role. Rollback restores the four original definitions; closed helpers can remain without activating v1.2.

## Final validation — 2026-10-06

338 unique automated checks (reruns excluded):
- Replacement SQL: 23; A–H, independent duration rejection, source/live matching, tampering, reviewer projection, acceptance protection, rollback-only acceptance/idempotence, original revision/workout and ten unaffected identities.
- Replacement contract: 25; SQL/Edge parity, schema/semantic negatives, fatigue/duration, historical compatibility, one intercepted request and reviewer adapter.
- Historical v1.1 selection: 22 SQL + 29 contract.
- Existing context: 22 SQL + 23 contract.
- Existing Chat: 72 SQL + 72 contract/gateway.
- Per-series: 34.
- Reviewer adapter: 16.

SQL tests are controlled synthetic transactions, rolled back; they are not live JWT/provider tests. The old Chat SQL test additionally initializes its test ledger inside that rollback transaction because staging's ten-call cap was consumed; no real charge/dispatch was reset. Historical selection samples explicitly capture the v1.1 selection version. Expectations were preserved.

Separately, ONE actual staging JWT → Edge → OpenAI → Postgres request:
- Model gpt-5.4-2026-03-05, prompt premium-chat-v1.2, context premium-chat-context-v1.
- HTTP 200; completed; MODIFY/pending_review; no acceptance.
- 4,167 input / 602 output tokens; 8,903 ms; $0.0194475.
- Conservative reservation $0.0696475, phase ceiling $0.07; no second call.
- Selected floor_crunch and reverse_crunch independently; two sets each, 10–15, RIR 3, 120 seconds.
- Warnings checkin_missing and multiple_changes_require_review retained; no insufficient-rest warning for these replacement sets.
- Request output limit temporarily 900; restored to 1,000, provider gates OFF, prior ceilings restored, actual charge/dispatch retained.
- Initial sandbox network attempt failed before Auth/Edge: SQL confirmed zero messages/dispatch movement before the one real request.

Exact live fixture removed, no temporary user created, staging whitelist = 0. Sixteen core/stable-Auth baseline counts and hashes restored exactly. Tokens existed only in runtime; credential manifests and raw results are ignored, never committed.

Production recommendation 47815d58-d7bc-4070-9518-5dcdc716df91 is historical evidence and must remain byte-identical, pending_review, with R1 active and R2 absent. This fix does not rewrite its original 60-second rests.

## Reproduction / deployment

backend.sql returns samples for contract.cjs; save the result in ignored results/backend-final.json. real-staging.cjs is a single-request utility requiring an exact ignored live manifest and the existing controlled synthetic credentials. Never run it without fresh authorization, fixture/budget checks and cleanup.

Use the migration unchanged. Deploy only simple-coach-chat, with the actual production URL/origin guards preserved and the new policy import/dependencies. The repository entrypoint remains staging-only. Keep the preceding production Edge source privately for rollback; do not replace it with staging CORS.

Rollback was exercised transactionally: all four original hashes matched, then the transaction rolled back so the candidate remained installed in staging. No new production AI call or proposal is part of this promotion.
