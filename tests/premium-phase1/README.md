# SIMPLE Coach Premium — Phase 1

Candidate based on production `b15968c73ab1b075c70f5456e6531733696c3bf5`.
Implemented and tested only in SIMPLE Security Test (`dmqjexigdnfzobarhnib`).
No production writes, publishing, OpenAI requests, health, payments, chat or check-ins.

## Existing architecture and reuse

Basic remains an initial-generation service: intake → operation → review → accepted
routine. Premium is longitudinal tracking; Coaching 1:1 remains future work.
The existing Basic operation/allowance/reviewer/feedback tables are not repurposed
as Premium permissions, recommendations or weekly tracking.

Reused:

| Existing structure | Premium use |
| --- | --- |
| profiles / routines / routine_days / routine_exercises | Existing client identity and owned routine structure |
| workouts, including recorded sets in JSON | Own historical observations; no rewrite |
| context_grants | Separate explicit, revocable history permission |
| routine_management | Protected routine and current revision pointer, with `plan_kind` |
| routine_revisions | Immutable baseline and subsequent accepted versions, with `origin` and recommendation provenance |
| Approved intake vocabulary and questionnaire | Unchanged `premium-intake-v1` tree and client-side validation |

`training_intakes` remains Basic: its global intake revision and operation coupling
would mix two service lifecycles. Premium intake lives in the mesocycle draft.
No fourth intake table. `routine_user_notes`, Basic feedback, Auth and existing
training/edit/history/chart consumers remain unchanged.

## Minimal schema

Three new tables, all with RLS and composite foreign keys binding owner/routine/revision:

* `coach_mesocycles`: id, user_id, routine_id, number, start_date, planned_weeks
  (1–26, not a compulsory six-week cycle), state, objective, initial_revision_id,
  current_revision_id, intake JSON, intake_submitted_at, access_until, row_version,
  nullable explicitly assigned reviewer_id, created_at, updated_at.
* `coach_mesocycle_weeks`: id, mesocycle_id, routine_id, user_id, week_number,
  state, planned_date, revision_id. One row per week; several weeks may share a revision.
* `coach_recommendations`: id, mesocycle_id, routine_id, user_id, base_revision_id,
  kind, state, patches, facts, interpretation, context_snapshot, review_reason,
  reviewed_at, accepted_at, result_revision_id, transient apply_txid, created_at.

Mesocycle states: `draft / active / completed / cancelled`.
Week states: `planned / active / completed / cancelled`.
Recommendation kinds: `KEEP / MODIFY / REVIEW`.
Recommendation states: `pending_review / ready / rejected / accepted / superseded`.

Existing constraints remain strict for Basic: non-null operation and revision 1.
Premium baseline has no Basic operation; subsequent revisions require unique
recommendation provenance. `snapshot_schema` remains 1; **origin distinguishes
the payload shape**. Premium snapshots contain full `routine` plus `days` and
their exercises; Basic snapshots retain their original format. Do not treat the
two formats as interchangeable in a future consumer.

## Intake and permission

The approved tree is reused: experience, recent pause, goal, conditional weak
points, days/availability/time per day, external activity, effort/RIR confidence,
recovery, sleep/stability, stress, exclusions, distribution and equipment inventory.
Beginners are not asked weak points; 1–2 years optional; experienced users up to two.
There is no selection of exercises to include and no health fields.

Draft saving and submission are real staging RPCs. Server validation checks
closed vocabulary, unknown keys, availability, inventory, conditional answers and
completeness. `row_version` prevents stale drafts, including missing expected
versions. Submission freezes the intake and activates the mesocycle.

History permission uses `context_grants.scope = premium_training_history`, notice
`premium-tracking-v1`. The owner grants/revokes through `premium_permission`.
The RPC requires backend-provisioned access; localStorage cannot grant access.
Every new history extraction, provider projection, mock recommendation and
acceptance checks the live grant. Revocation does not erase existing snapshots.

## Exact history contract

The following JSON illustrates the **actual keys and nesting**, using placeholders
for UUIDs and example values, not production data:

```json
{
  "schema_version": "premium-history-v1",
  "routine_id": "<routine UUID>",
  "base_revision_id": "<revision UUID>",
  "mesocycle": {"number": 1, "start_date": "2026-10-03", "planned_weeks": 7, "objective": "balanced"},
  "weekly_summary": [{"week": "2026-09-28", "recorded_sessions": 2}],
  "exercises": [{
    "exercise_id": "<current exercise UUID>",
    "day_id": "<current day UUID>",
    "name": "Remo con mancuerna",
    "prescription": {"sets": 3, "reps": "8-12", "rir": "2", "rest_seconds": 180},
    "exposures": [{
      "workout_id": "<workout UUID>", "date": "2026-10-01",
      "historical_exercise_id": "<original UUID>", "historical_day_id": "<original day UUID>",
      "sets": [{"kg": 20, "reps": 11, "rir": 2}]
    }],
    "metrics": {"exposures": 1, "recorded_sets": 1, "trend": "insufficient_data", "method": "Last three exposures: same set count, same per-set load and RIR; compare total reps only. Descriptive, no causal inference."}
  }],
  "limits": {"exposures": 4, "window_days": 56, "sessions": 112, "exercises": 40, "sets": 12}
}
```

Filters: own user plus exact routine UUID. Most recent four exposures per current
exercise, eight-week window, at most 112 sessions, 40 exercises and 12 sets per
exposure. Four permits three observations plus a contextual buffer; these are
bounded-context limits, not physiological programming rules. The trend currently
uses only the latest three; a fourth exposure is retained for later contextual review.

Trend values: `insufficient_data`, `context_changed_or_incomplete`,
`reps_increasing_comparable`, `stable_comparable`, `reps_decreasing_comparable`,
`mixed_comparable`. Only equal set counts, per-set load and RIR with complete data
permit total-rep comparison. Increased load alone is not progress. Zero remains
zero; missing/empty values become null. No scores or causal claims.

Exact exercise UUID wins. Six already-confirmed aliases are scoped to the
original owner and routine, not applied globally. Ambiguous duplicates are
excluded. No name/position inference, new alias or Hiperextensiones → Hip thrust.
Workouts retain their original IDs and prescriptions.

`premium-provider-v1` contains: schema_version, intake, mesocycle, weekly_summary,
exercises, limits. Each exercise contains only `ref: exercise_1`, metrics,
sanitized prescription and exposures `{date, sets}`. Custom inventory is removed;
no user/routine/day/exercise/workout UUIDs, names from stored routine rows, free
notes, email, identity, administrative or health data are included. No provider is
called. Phase 2 needs a validated catalogue/ref mapping, not fuzzy legacy names.

## Recommendation, acceptance and protection

Mock recommendations are backend-only and store facts separately from an
interpretation (max 800 characters), plus the exact context snapshot used.
No automatic decision engine or obligation to modify weekly.

Structured patch (exact four-key shape):

```json
{"target_id":"<exercise UUID>","field":"sets","from":3,"to":2}
```

Allowed fields: sets, target (rep range), rir, rest_seconds, exercise_order,
day_id, day_order, replace_exercise. At most 30 patches. Volume is expressed
through sets/distribution, not an unvalidated prose command. Replacement receives
a fresh UUID and approved catalogue entry; backend derives its name and checks
inventory/exclusions. It does not inherit arbitrary notes or history.

Logical flow:

```text
premium_intake → context_grant → training_history_context
→ mesocycle → structured mock recommendation → scoped review
→ explicit owner acceptance → routine_revision → atomic apply
```

Provisioning creates a draft mesocycle first; the logical flow is not a mandate
to create database rows in that exact order. Provisioning is service/backend-only,
wraps an owned unmanaged manual routine and never converts a Basic managed routine.
Access is a server-controlled `access_until`, not a commercial subscription.

Reviewer: default denied. Backend may assign one trainer to one Premium mesocycle;
that reviewer can read its mesocycle/weeks/recommendations and validate/reject.
No global workout access, no owner history RPC, no acceptance on behalf of athlete.
Basic reviewer configuration and permissions remain untouched.

Acceptance locks management → mesocycle → recommendation, checks ownership,
ready state, live access/grant, current base revision and every `from` value.
Duplicate patches fail. KEEP records acceptance but creates no unnecessary revision.
MODIFY applies all patches and creates one immutable revision transactionally.
Previous revisions and completed/past weeks remain intact. Current/future
noncompleted weeks share the new revision. REVIEW is not auto-applied.
Repeated acceptance returns the same revision; obsolete competitors are superseded.
Any mid-apply error rolls back structure, pointers and revision together.

The existing structure guard is retained, with a narrow exception requiring a
trusted ready recommendation, correct owner/base/routine and current transaction
ID. The flag is cleared in the same transaction. No global GUC bypass, disabled
trigger or relaxed RLS. Direct editing of a protected Premium routine is rejected.
New revisions reject authenticated/service updates/deletes; explicit database
administrative maintenance remains possible for controlled cleanup/rollback.

## RPCs and privilege boundary

Owner: premium_permission, premium_save_intake, premium_training_history,
premium_provider_context, premium_accept_recommendation.
Backend: premium_provision, premium_mock_recommendation, premium_assign_reviewer.
Scoped reviewer/backend: premium_review_recommendation.
Authenticated has SELECT only on the three new tables; no direct DML.
Service has backend privileges. Private helper execution is revoked, except
the non-exposed RLS predicate requiring exact assigned reviewer identity.
All privileged RPCs use fixed search_path and server-side checks.

## Validation actually performed

Final unique checks, **not sums of retries**:

| Evidence | Passed |
| --- | ---: |
| Real staging JWT owner/other client/trainer/default and assigned reviewer/anon, intake, permission, acceptance and races (`live.cjs`) | 87/87 |
| SQL identity/version/permission/history invariants plus service-role immutable trigger | 30/30 |
| Chromium/WebKit offline UI: 320/390/1280, real light/dark computed styles, late responses and errors | 66/66 |
| Real staging UI persistence and final Chromium readback: same sizes/themes | 33/33 |
| Existing Basic intake unit suite | 50/50 |
| Existing Basic V5 unit suite (local, no model calls) | 35/35 |
| **Total** | **301/301** |

Service authorization was tested through real SQL `SET LOCAL ROLE service_role`,
not a service JWT. Browser tests use synthetic fixtures; none claim real AI analysis.
Scenarios cover rising/stable/falling/insufficient history, replacement, double
acceptance, stale recommendations, concurrent competitors, completed mesocycle,
atomic failure, retained old snapshots, no duplicated days/exercises and aliases.
Real staging UI write was followed by final readback after UI-only fixes; that
readback is not added again to inflate the 33 checks.

Rollback rehearsal restored all 52 original function definitions/owners/ACLs.
Final schema was reapplied in staging and final fixtures verified/cleaned. Nine
central staging table counts/hashes returned exactly to their initial values.
Final Premium objects, revisions, management rows and grants: **all zero**.
Existing controlled staging test users were reused, not created/deleted. Their
normal login timestamps can change; no Auth configuration or user identity edit.

Production: nine central table counts/hashes and 52 function definitions/owners/
ACLs unchanged. Cycle RPC hash remains `88c3564c3c49cf9c53fccba89a1e71b5`.
Patatasimple was not used in tests; profile remains client with original UUID.
No production Auth mutations, data writes, secrets reads or OpenAI calls.

Security advisor still reports deliberate authenticated SECURITY DEFINER RPCs
(five new owner APIs) and pre-existing leaked-password protection warning. These
are not hidden as a clean global security audit; owner/role boundaries were tested.
No Auth changes were made to address unrelated warnings.

## Preview, artifacts and reproduction

`node tests/premium-phase1/preview.cjs` serves the local **fictional** demonstration
at `http://127.0.0.1:4231/review`. No public index modification or new commercial
entry. The optional live mode needs a reviewed staging-only private fixture and
JWT manifest, and was stopped after cleanup. Do not enable it against deleted fixtures.
`ui.cjs` uses the local preview. `build.cjs` generates ignored private/candidate.sql
from the approved vocabulary, template and captured original guard. Canonical
migration matches it byte for byte (SHA-256
`afd0f1acb2f81779809b1dbf2504d0a836014e296dea201a92f87d9f9d332c52`).

Live tests are orchestrated in stages with reviewed SQL and existing controlled
accounts; they are not a one-command production runner. Read `live.cjs`/`verify.cjs`
before rebuilding fixtures. No credentials included. `private/` and `results/`
are ignored; CLI binary, sessions, UUID manifests, captures and diagnostic output
are excluded from the candidate. Screenshots distinguish offline examples from
actual staging fixture UI.

`rollback.sql` is staging-only and refuses to run while Premium objects/grants
remain. Clean exact reviewed fixture UUIDs first, preserving all historical/real
data. Cleanup defers only the cyclic provenance FK inside its transaction; it
does not disable RLS/triggers or overwrite snapshots. Never use blind destructive
cleanup or promote this rollback to production without a separate review.

## Remaining boundaries

Ready for **architecture review**, not commercial activation or Phase 2 release.
Not implemented: Premium AI generation/analysis, automated adaptation, full
acceptance UX, lifecycle scheduler, payments, chat, check-ins, Coaching 1:1.
Owner access and expiry are provisioned by backend; zero users remain provisioned.
The provider contract needs catalogue/ref enrichment for future AI exercise
selection. Its conservative trend deliberately declines changed/incomplete
contexts rather than inventing progression. No production promotion authorized.
