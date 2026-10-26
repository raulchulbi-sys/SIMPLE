# Basic: prepared authenticated staging rehearsal

Status, 26 October 2026: **AUTHORIZED REHEARSAL COMPLETED AND CLEANED**.
See [results, limitations and integrity](BASIC-SDK-RESULTS.md). The preparation below
records the original plan and its historical checks; it is not permission to start
another run. Existing receipts must never be reused to recreate deleted fixtures.
This is a recovery/authorization/workflow rehearsal using the real Supabase SDK and
existing synthetic accounts. Its proposal is deterministic test data. It cannot
establish real model generation, programming quality or production readiness.

## Preparation checkpoint (25 October; historical)

Base is PR #2 remote `92fc4b4` / local equivalent `652e4a1`, tree
`f75f2192b26ce8b631547d6bbb33c53ec43ade5c`. Main remains `0c96b5f`; draft hosting
PR #1 remains independent. Root checkout's older dirty work is untouched.

A new defect was reproduced before correction: when intake submission survived but
operation registration/response remained uncertain, full reload erased the in-memory
attempt. Choosing Basic again reached the form and made a second save/invocation in
the offline harness. This proves duplicate frontend requests, not two paid calls.

`coachLoadIntake` now reads exact owner-scoped intake/grants/operation and verifies
returned owners. A submitted latest intake without a matching operation enters the
existing read-only reconciliation even after reload or when starting another
proposal alongside an older accepted routine. Drafts remain editable. Nothing is
stored in localStorage/sessionStorage, and no provider resend is automatic.
If registration never appears, the UI remains uncertain; it does not infer failure
or silently unlock another generation. Resolving that case needs investigation or
an expressly authorized retry, not another click through a new questionnaire.

New offline assertions: **20/20 uncertain reload** (Chromium/WebKit, first routine,
older accepted routine/history, delayed registration, ordinary draft) and **14/14
pilot safety**. Necessary affected regressions: **111/111 recovery, 40/40 Basic
journey, 23/23 compatibility**. Those 174 are reexecuted existing assertions, not
new cases. The previous 156 JWT/mixed/simulated checks were not repeated or added.

This phase only inspected staging metadata/aggregate data and generated local files.
It also successfully ran the two reviewed `IMMUTABLE` staging validators against
the synthetic intake/proposal (two real read-only SQL contract checks, **not JWT tests**).
No activation, seed, SQL cleanup, real SDK journey or new JWT login was executed.
Creation/cleanup SQL has not been executed or live-validated; dry-run/safety checks
must not be represented as database PASS results.

## Smallest fixture set / exact proposed scope

Use SIMPLE Security Test only: `dmqjexigdnfzobarhnib`. No new accounts:

| Actor | Existing synthetic UUID | Temporary change |
| --- | --- | --- |
| Owner `mock`, client | `c7bbe50b-d349-4f7e-8fdc-476f17c22674` | One Basic pilot entry, 60 minutes |
| Other client `real` | `c14a2a6d-9853-431d-856c-4d742002187e` | None; negative access tests |
| Reviewer, existing trainer | `6b47ae02-6574-46db-acdb-f00925efdd74` | One Basic reviewer entry, 60 minutes |
| Normal trainer | `0b6fb9c1-3a62-4fbb-93d9-b3993a8fffb8` | None; negative access tests |

Roles, Auth settings, RLS, ACLs, secrets, Premium scopes and budgets are unchanged.
The two temporary configuration functions are `coach_private.pilot_config()` and
`coach_private.reviewer_config()`. Preserve their owners, ACLs, signatures and paths.
There is no new table, RPC, trigger, policy, migration or Edge deployment.

The current Basic reviewer API is global, **not assignment-scoped**. To keep its
effective dataset limited to this fixture, activation requires globally zero Basic
intakes/operations/feedback and health rows, both configs empty, no preexisting active Basic context grant
for this owner, exact synthetic identities and unchanged backend/security hashes.
It stops on drift. It does not claim an assignment restriction absent from the server.
The same reviewer gate is also used by the assignment-filtered Premium initial queue.
Activation therefore refuses any pending Premium initial operation assigned to this
reviewer; read-only inspection currently finds zero. Existing Premium access/expiry
and assignments remain unchanged. This additional fence prevents this Basic rehearsal
from exposing an unrelated pending Premium initial review.

One transaction creates **three rows only**: one synthetic training-only context
grant (`pilot-supervised-v2`), one submitted Basic v2 intake, one V5-compatible
`pending_review` operation. The proposal uses the existing deterministic test wire
and existing contract; name/description and all V5 programming code remain intact.
Provenance is `model_provider=mock`, `model_name=deterministic-sdk-fixture`, zero
tokens/cost/attempts, no provider start, human review still required.

In the **same transaction**, enable that owner and reviewer until T+60 minutes.
The owner's generation limit remains one (the existing default) and the registered
synthetic root already consumes that one: remaining zero, `can_generate=false`.
No retry is authorized. This never offers a free generation interval before seeding.
The activation clock begins at transaction time, not while preparing files.

After activation approval, the SDK/UI may create at most one accepted fixture
routine, three days, twelve exercises, one revision/management row, one synthetic
workout and at most four personal notes. Nothing is assigned/shared with anyone.
Existing routines, notes and 22 staging workouts are outside the mutation scope.

## Zero-provider boundary

Calls to every `/functions/` endpoint are blocked by the runner. No Edge invocation,
fake Edge response, provider receipt or OpenAI request is used. All Auth, permitted
REST/RPC reads, reviewer decision, acceptance and workout/note writes use the real
SDK 2.115.0 and actual staging server. Reconciliation is entered with the known
fixture owner/intake to represent the registered-but-unconfirmed request. This
does **not** test provider invocation/registration from the initial submit button;
that failure/reload boundary is the focused offline regression above.

Model-call budget: **0 requests / 0 USD**. No budget configuration is changed.
The consumed synthetic root also denies new generations throughout pending/ready/
accepted states. The runner forbids reject/retry authorization, extra intakes,
consent changes and other business writes. This is a controlled-runner guarantee,
not a newly installed server-wide OpenAI kill switch. Do not run manual generation
or authorize a retry outside it during the window. A global provider/configuration
change would require a different authorization and is not included.

## Reproducible preparation (no database writer in the planner)

`pilot-plan.cjs` only renders SQL; it cannot connect to a database. Keep generated
bundles/snapshots under ignored `tests/coach-flow/private/`.

```powershell
node tests/coach-flow/pilot-plan.cjs capture <existing-private-scope-proof>
# Execute only the emitted read-only snapshot SELECT with MCP project_id
# dmqjexigdnfzobarhnib after get_project verifies its exact name/ref.
# Save the returned snapshot locally, adding that independently verified project/name.
node tests/coach-flow/pilot-plan.cjs prepare <proof> <snapshot> tests/coach-flow/private/basic-sdk-pilot
node tests/coach-flow/pilot-safety.cjs tests/coach-flow/private/basic-sdk-pilot/plan.json
node tests/coach-flow/pilot-sdk.cjs tests/coach-flow/private/basic-sdk-pilot/plan.json
```

The last command is offline preflight by default. It neither reads passwords nor
starts a session. Verify the existing local official SDK file is present, SHA256
`0d8509e5aab9a4d8b0b0525c27082149a849f50df7ebbddfcd9c33d2ba645ad7`.
It is an existing private test runtime file, not a new application dependency/asset.

The snapshot includes 27 count/hash references, two additional empty-table guards,
stable Auth identities (excluding normal login timestamps/sessions), sixteen critical
function definitions/owners/ACLs and
table/policy security hash. Always capture a fresh one on the approved activation
day. Review regenerated SQL and the exact run/fixture UUIDs before executing it.
An absent project GUC is not evidence of the project: the coordinator must select
and verify the MCP project. UUID/role/email-domain/config hashes are additional guards.

## Reviewed execution order (new runs require explicit authorization)

1. Authorize this exact four-account scope, 60-minute window, three seed rows,
   synthetic reviewer approval/acceptance, one workout/four-note cap and bounded
   deactivation/cleanup, with zero provider calls. Prepare the runtime, fresh
   snapshot, SDK and credentials before starting the activation clock.
2. Execute reviewed **create.sql only**, explicitly against verified staging. It
   uses a transaction, owner advisory lock, 2-second lock timeout, 15-second statement
   timeout, identity/config/function/security/integrity preconditions. Reapplication
   fails safely; do not replay after a lost response without inspecting state.
3. Run **validate.sql** read-only. Confirm the fixture is pending review and token/
   cost/provider-start/retry fields are zero/null. Read the actual config expirations
   and reviewer status. Record a private approval receipt: `approved:true`, exact
   `project`, `run`, SHA256 of the reviewed `plan.json` as `planSha256`, `activatedAt`,
   `expiresAt`, `maxProviderCalls:0`. Do not create this approval receipt beforehand.
4. Execute once:

   ```powershell
   node tests/coach-flow/pilot-sdk.cjs <plan.json> <existing-authorized-credential-manifest> <approval.json> --run-approved
   ```

   The runner verifies the matching approval/hash and at least 15 minutes remaining.
   It also verifies the six pinned product/runner source hashes. It binds loopback port4195, uses four isolated Chromium contexts, genuine SDK
   Auth/getUser, SDK custom storage backed only by Node memory, auto-refresh off,
   local-session logout and no traces/screenshots/request-body logs. No browser
   localStorage/sessionStorage contains Auth tokens. It clears memory on exit.
5. Real checks: owner scope/zero remaining generation; exact registered operation;
   other client/trainer/reviewer direct private-row denial; client/trainer reviewer
   denial; owner premature acceptance rejection; real read reconciliation and full
   reload; reviewer sees exactly the consented projection; UI approval; owner UI
   acceptance; idempotent repeated acceptance; one routine/revision; one UI workout;
   history/notes readback and no prescription rewrite. These are **pending**.
6. The runner writes only a sanitized complete/partial receipt in ignored results.
   It does not auto-clean the database. Regenerate validation/cleanup with actual IDs:

   ```powershell
   node tests/coach-flow/pilot-plan.cjs finalize <plan.json> tests/coach-flow/results/basic-sdk-pilot.json
   ```

7. Run final **validate.sql**, then **disable.sql**, then **cleanup.sql**, each against
   verified staging. Finally recapture integrity/function metadata and compare all
   27 entries and the original config definitions/ACLs. Scope expiry remains the
   backstop if the client stops; it does not delete fixtures automatically.

## Cleanup, reversibility and STOP conditions

Disable removes only keys marked with this run; when baseline is unchanged it
restores the exact original function definitions. It does not rewrite independent
new keys. Missing keys make disable a no-op. Changed run markers require review.

Cleanup first requires owner/reviewer disabled, exact fixture identity/provenance,
complete routine/day/exercise/revision/workout/note UUID receipt, no assignments,
share codes, statistics stages, derived routines, feedback or Premium references,
and unchanged preexisting row hashes. It deletes only those newly created IDs in FK
order, with a transaction and a final full-baseline comparison. Missing accepted
routine/history IDs cause STOP, never guessed deletion or a whole-user purge.
Unexpected restrictive FKs or hash drift roll the transaction back.

If approval/acceptance/save response is lost, inspect only this operation and its
linked fixture records, complete the partial receipt with read-only evidence, and
review the newly rendered cleanup. Do not recreate the seed, repeat a save, reset
accounts, delete preexisting fixtures or clear budgets to force a pass.

If any security check, quota, permission, source or integrity precondition fails,
stop the live journey, disable the owned scope if safe, preserve the receipt and
investigate. No automatic retry/provider fallback, extra account, role change,
expiry extension or quota increase is authorized by this preparation.

Product rollback: restore only `assets/coach.js` and its cache reference from
PR #2 `92fc4b4` (local equivalent `652e4a1`) if this unmerged fix is rejected.
No production SQL rollback exists or is needed. Staging fixture cleanup and exact
temporary config restoration are independent of the frontend rollback.

The production reviewer-JWT/Cloudflare gate, PR #1, commercial flags and legal
review remain separate. Neither PR is merged or deployed by this task.
