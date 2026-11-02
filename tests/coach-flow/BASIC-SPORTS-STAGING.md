# Basic V5 sports review: authenticated staging validation

Completed 29 October 2026. Scope: SIMPLE Security Test only.
Source candidate: PR #2, remote 56aae5a (local bc8e3c9, identical tree).
This report does not authorize another activation, generation or deployment.

## Result and evidence classes

- **58/58 distinct authenticated checks:** 30 SDK/JWT checks and 28 checks of the
  real reviewer renderer connected through a read-only SDK relay to staging.
- **11/11 new offline evidence checks**, including evaluation of the dependency
  files retrieved from deployed v33, restoration and cross-realm JSON comparison.
- Earlier offline sports-review, V5 and cost-guard suites were reused as historical
  evidence, not rerun or added to these totals.
- Zero OpenAI requests, including token counting. Zero generation cost.
- No approval/rejection/acceptance, routine, revision, workout or note created.
- Three exact synthetic rows created and deleted: consent, submitted Basic v2 intake,
  pending-review operation containing the already documented synthetic proposal.
  Provider metadata explicitly says mock; this is not a second real generation.

Private original receipts, exact IDs, baseline snapshots, source bundle and rollback
remain under ignored tests/coach-flow/private/sports-review-staging-20261029/.
No credentials or tokens are included in this report or the committed harness.

## Deployment and import resolution

simple-coach-mock v32 → **v33 ACTIVE**, verify_jwt=true, no import map.
Retrieved deployment bundle hash:
0de5d740f29f5615cfea2e1678f95f25f7528d6bea996e50ee1e5e543e3f4c20.

The actual 11-file v32 package matched the earlier saved source exactly.
The v33 download matches all 11 files of the prepared payload. All 13 relative
import edges resolve inside that package, including contract-v5.mjs →
../../../assets/coach-programming-v5.js. Editing the repository alone was not
treated as a deployment.

Only assets/coach-programming-v5.js changed:
- Before SHA-256: 2d5afd7ae028c20a259c7003b5324facd3fe078352ae5730f4e9887837abb155
- After SHA-256: 4023724c538bc47f3ea5769597cfe2942668709ec55531c3a087d3a8d217342e

Ten files retained byte-for-byte (SHA-256):

| File | Hash |
| --- | --- |
| supabase/functions/simple-coach-mock/index.ts | bb3b02359e02b7ab88f8c1edee1939ec29943aadd6d76b48b0d526fa3885de5e |
| supabase/functions/simple-coach-mock/contract.mjs | 2f11679ea6d550b04b2e1248edfdc76c47d2d74979ce47c976f2d66447d63a0b |
| supabase/functions/simple-coach-mock/contract-v5.mjs | 101c3c02c2701500284a3b92c15b031c53e52dbe26aeabdd5f474549bd443039 |
| supabase/functions/simple-coach-mock/contract-v4.mjs | 428a265edb6df852746a3341522483902650c74106b1d613c2d567e8087a3cc4 |
| supabase/functions/simple-coach-mock/contract-v3.mjs | bf3b91e657a31652c1f4dff65d7312e02d17136b594122e34c53f2bcb0118e52 |
| supabase/functions/simple-coach-mock/contract-v2.mjs | c5e35966bd379058416941e20b30a0594b69e073cb80d9d45460889e71f7eb7c |
| assets/coach-intake.js | 01e871875961e98e9fd787fc7b09affd92a8b18a9c732842f39351e0f319165d |
| assets/coach-programming-v4.js | 7162b7007c3f001752f2409e87151ac22b318157b62cedcd6c0505109f1a0740 |
| supabase/functions/simple-coach-mock/provider.mjs | b9f8ceb7c253ad997fffd6de090cdb98ea9e676162e062c2dd736eb0d892a38f |
| supabase/functions/simple-coach-mock/staging-cost-guard.mjs | c48caccefd4f65ca1d9a18a14bb5858ccfde180aed0abab752eb5b8bd659af1d |

Thus all eight existing CORS origins, JWT requirement, GPT-5.4 model, V5 contract,
prompt, catalogue and v32 cost guard remain unchanged. No SQL business functions,
RLS, Auth configuration, Financial P1 or secrets were changed.

The deployed function was not invoked to generate or evaluate a request remotely.
Its downloaded effective contract/evaluator was executed offline. The live backend
evidence concerns authenticated reviewer reads and the server's existing proposal
validation at controlled seeding. These are distinct forms of evidence.

## Authenticated scope and network limits

Existing synthetic owner, other client, reviewer and ordinary trainer only.
No new accounts, role changes, global grants or quota/budget changes.

Before activation: both access configurations empty, Basic operations/intakes empty,
feedback/health rows absent, no unrelated pending Premium initial review for this
reviewer, and no active competing client queries. Fresh 27-reference comparison and
critical security checks matched immediately before activation.

The authorized Basic reviewer remains global; no claim of row-scoped reviewer
authorization is made. It was safe to enable for this isolated trial because there
was no unrelated Basic data. This is not evidence that global reviewer access would
be appropriate in a multi-user environment.

The only temporary owner and reviewer entries were set to expire after 60 minutes. Seeding
the one consumed root operation and enabling access occurred atomically; the owner's
can_generate was false throughout the live reads. Scope opened at 13:06:54 UTC;
the completed SDK receipt is timestamped 13:08:18 UTC. Both configurations were
restored empty immediately afterwards and before cleanup.

SDK 2.115.0 was checked against its pinned hash. The transport:
- allows only fixed-project sign-in/identity verification and selected read RPCs;
- requires read RPCs to appear in the captured STABLE/IMMUTABLE function list;
- allows only exact-ID operation/intake reads and own profile reads;
- blocks all Edge Functions, OpenAI, other hosts and business mutations;
- stores access/refresh sessions only in memory, with persistence/refresh disabled.

All four synthetic sessions signed out locally. No tokens were materialized.

## What the live checks established

30 SDK/JWT checks:
- Four real sign-ins, server identity verification and unchanged roles (12).
- Owner authorized to read but cannot generate (1).
- Reviewer queue contains exactly the seeded operation (1).
- Pending human review, exact proposal and training-only projection (2).
- Owner, other client and unauthorized trainer denied the reviewer queue (3).
- Direct operation and private-intake ownership isolation for all four actors (8).
  The reviewer can use the projection but cannot directly read either private row.
- Final operation and queue unchanged, no blocked mutation/provider attempts (3).

28 browser + real SDK/JWT checks:
- Chromium (installed Edge engine) and WebKit, real repository renderer.
- Five warnings, 30 series and enabled human decision controls, uncertainty and
  direct/secondary distinction, no browser errors or outbound browser traffic (8).
- 320/360/390/430/1280 px, light and dark, both engines (20).

Browser presentation was local and isolated; only its SDK relay read staging.
This is not a claim of frontend deployment or a public-site end-to-end login test.
No decision buttons were clicked.

## Five warnings actually displayed

1. **Recovery after Sunday running:** Monday lower-body work follows running.
   Duration/intensity/load are unknown; review perceived recovery and expected
   performance. Proximity alone does not establish interference or risk.
2. **Deltoids:** 2 direct sets / 1 day; secondary participation in 10 sets / 3 days.
3. **Biceps:** 0 direct sets; secondary participation in 6 sets / 3 days.
4. **Triceps:** 0 direct sets; secondary participation in 6 sets / 3 days.
5. **Calves:** 2 direct sets / 1 day; 0 secondary sets.

The coverage messages explicitly reference the within-plan median of covered major
groups (6 sets), not a universal minimum. They ask for human review and do not
require isolation exercises or adding volume. Shoulder regions remain distinguished.

The proposal stays structurally valid: 30 sets, 15 exercise occurrences / 12 unique,
same exercises, prescriptions, RIR and rests. Estimated Monday/Wednesday/Friday
duration remains 46/47/47 minutes. Warnings neither mutate the proposal nor disable
the human approval/rejection controls. No decision was made.

## Cleanup and integrity

Exact receipt equality was checked before three UUID-bound deletions. Cleanup checks
foreign references, absence of provider attempts/decisions, scopes off, and hashes
excluding only those three known rows. No approximate filters or cascade cleanup.

Restored:
- 27/27 original count/hash references, also matching the previous generation closure.
- All 16 critical definitions, owners and ACLs.
- Security catalogue, roles, memberships, schema ownership/ACLs, triggers and complete
  public/coach_private function fingerprints.
- Basic/reviewer configurations empty; no pending Basic intake/operation.
- 19 routines, 4 revisions, 22 workouts, 4 notes, original contents unchanged.

Normal synthetic authentication session/audit activity and the two staging
activation/deactivation migration-history entries are retained. This does not claim
byte equality of Auth's mutable session timestamps or erase audit records.

Production, its users/training, main, PR #1 and Cloudflare were not modified.
Both PRs remain draft. Staging v33 is intentionally retained.

## Incidents and recovery

1. First read pass stopped because strict deep equality compared SDK objects from
   a separate JS VM realm with local objects. Same JSON, different prototypes.
   The harness now normalizes JSON before comparison; a negative regression proves
   a real RIR mutation still fails equality. The incomplete receipt is preserved.
   Only authenticated reads were resumed in the same window with the same three rows.
   The 14 repeated initial checks are counted once, not added as new cases.
2. A truncated SQL tool-output string was rejected by PostgreSQL syntax validation
   on the first deactivation attempt. No statement was applied. The complete source
   was retrieved and the exact restoration then succeeded.
3. The first cleanup tool request returned invalid/expired requestState. Read-only
   reconciliation confirmed all three exact rows still existed, unchanged, scopes
   off. Only then was the identical guarded cleanup submitted once and verified.

No product bug, unexpected data mutation or permission expansion was observed.

## Reproducibility and rollback

New scripts are limited to this bounded trial:
- sports-review-package.cjs: offline exact source comparison, import graph, package/rollback.
- sports-review-plan.cjs: offline three-row plan, guarded activation/restoration/cleanup SQL.
- sports-review-sdk.cjs: authentic read-only SDK and browser relay.
- sports-review-evidence.cjs: offline verification of saved receipts and effective source.

The private rollback.json contains the complete v32 source/configuration payload.
Redeploying it would create a new Edge version with the original contents; version
numbers cannot be rolled back. It was prepared and source-checked, not exercised
because no regression required restoration. Do not execute it without authorization.

## Remaining limits

This validates advisory presentation/security for one previously generated proposal,
not the quality of another model response, other athlete profiles or real-world
recovery. Broader profile coverage needs separate authorization. No new generation
or model bill was produced in this trial. Future trials require a fresh empty-scope
and integrity preflight; this document is evidence, not standing authorization.
