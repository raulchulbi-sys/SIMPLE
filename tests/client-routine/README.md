# Client routine isolation — candidate

Base: published main bfe228ccaddc5bfaaa1d08169eaf896b1bd0d51b (same tree as local 0196760).
Branch: codex/client-routine-customization.

## Confirmed cause

Sharing creates a routine_assignments row pointing at the trainer template. The client editor called save_routine_atomic with the same template UUID. That save legitimately changed the template displayed in Mis rutinas and every assignment referencing it. The earlier session-isolation tests concerned different routines; they did not cover two clients sharing one template.

## Product change

One private, RLS-enabled table stores each assignment's prescription snapshot and CAS version. Authenticated users have no direct table access. Eight narrowly authorized functions and an assignment trigger capture, read, save, reorder and validate that snapshot. Four existing functions are adapted: save_routine_atomic, the two template reorder functions, and the workout identity trigger function. Original grants/owners are retained. Existing policies and the original cycle RPC are unchanged.

Client edits change only the assignment snapshot. Library edits change only the template. Existing routine/day/exercise UUIDs remain logical identities; no workout or note is remapped. New client-only days/exercises get server UUIDs and are authorized for that client's workout inserts. Existing assignments are seeded with their current structure, never an inferred former version. Sharing later captures the template at that time. Client customizations survive assignment withdrawal/restoration.

The frontend uses the assignment snapshot for metadata, editing, reordering, session overview, training and progress. It rereads persisted values after saving, fails closed on incomplete responses, and rejects stale versions. No template fallback or cache is used as proof of client persistence. The original cycle RPC hash stays 88c3564c3c49cf9c53fccba89a1e71b5; a new helper applies its current-cycle algorithm to the assigned days, retaining only the four already confirmed historical day aliases.

A reopening regression also exposed the workout state guard treating its own note-loading update as an external edit. Refreshing the expected state immediately after that synchronous update restores reopening while retaining all late-response guards. No note or alias logic changes.

## Verification — final distinct checks

| Suite | Result |
|---|---:|
| tests/client-routine/backend.sql, Supabase staging SQL | 48/48 |
| tests/client-routine/browser.cjs, Chromium/WebKit, 390/1280 | 72/72 |
| tests/client-routine/unit.cjs, strict response/CAS verification | 18/18 |
| tests/session-edit/contracts.cjs, focused input, incomplete save, history, zeros/nulls, stale responses | 40/40 |
| tests/exercise-alias/browser.cjs, current UUIDs and six confirmed aliases, notes/drafts/reopening, 390/1280, both engines | 348/348 |
| tests/statistics-stage/unit.cjs | 26/26 |
| tests/training-reset/unit.cjs | 13/13 |
| tests/training-reset/navigation.cjs | 9/9 |
| Archived test-concurrency | 33/33 |
| Archived test-session-drafts | 7/7 |
| Archived 26-test-duration | 30/30 |
| Archived test-training-flash | 10/10 |
| Archived test-ux-robustness | 26/26 |
| Archived 23-test-features-browser (sharing/codes etc.) | 105/105 |
| Archived test-duration-entry | 8/8 |
| tests/onboarding/browser.cjs, 320/360/390/430/768/1280, both engines | 276/276 |
| tests/training-reset/backend.sql, staging | 30/30 |
| External simultaneous staging saves (CAS; library/client independence) | 2/2 |
| **Total distinct final checks** | **1,101/1,101** |

The backend SQL tests use request claims and actual authenticated database roles, not real HTTP JWT sessions. Browser persistence uses an explicit offline synthetic SDK. External concurrency uses two independent real staging SQL transactions. No authenticated production save was performed. Fresh migration plus rollback/reapply were additionally exercised inside one transaction, using the same 48 checks; repetitions are not added to the total.

The alias harness now initializes the statistics-stage read and fixes its fixture date to 2026-09-07. Archived SDK adapters implement the added read endpoints and map the explicit library reorder wrapper to their existing doubles. Assertions remain intact. These adaptations are test-only, never shipped as application dependencies.

## Integrity and cleanup

Staging: all 16 original central-table count/hash pairs match their pre-test values. The 12 candidate snapshots equal the initial prescriptions of their 12 assignments. Transaction fixtures were rolled back. The sole committed concurrency fixture was deleted by exact UUIDs after verifying its synthetic label and owner; zero residue remains. No Auth user/session changes, no OAuth/config changes, no OpenAI calls.

Production: no writes and no publication during this task. Main remains bfe228cc. Original save/reorder hashes and original cycle hash match the initial read. The new table does not exist in production. Patatasimple and Coach are untouched.

## Existing template recovery

Guille and a second client currently reference the same ba2d0a25-1844-45c1-9777-f0e1aa7aa392 template, now named PPL-UL / ANNA. No routine_revision exists for it. Historical local evidence contains a workout and six PUSH exercise rows, not a complete authoritative earlier PPL-UL / XTV template. Therefore no original structure has been reconstructed or restored. Guille currently has zero workouts after the user's previous reset; historical counts from earlier tasks are not treated as the current baseline.

Future isolation and recovery of an already overwritten original are separate: the first is ready for coordinated backend/frontend promotion; the latter needs a confirmed original structure. No real client prescription is changed by the seed.

## Promotion and rollback

Requires a separate production authorization for supabase/migrations/20261006181142_client_routine_customization.sql and this frontend candidate. Apply the migration once after confirming expected original function hashes/object absence; verify seeded assignments and original central data; publish the exact candidate tree only after backend checks pass. No aliases, Auth, Coach or RLS policy changes.

Rollback: tests/client-routine/rollback-production.sql restores the four original function definitions and disables assignment capture. It deliberately retains the new private table and protected readers to avoid deleting any customized prescriptions. Coordinate with a frontend rollback. The former shared-template behavior returns, so pause client editing during rollback. This is a recovery script, not a destructive deletion of customizations. It was checked transactionally as part of the fresh migration replay. Do not rerun the initial migration over retained data without a deliberate reconciliation.

Preview: http://127.0.0.1:4260/?role=trainer (offline synthetic data, CSP blocks all network connections).
Screenshots/results are ignored and excluded from the commit.
