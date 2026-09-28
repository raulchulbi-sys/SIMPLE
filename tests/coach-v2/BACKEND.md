# Coach pilot v2 backend

This change is restricted to Coach. It does not edit `pilot_config`, `reviewer_config`, central tables, central RPCs, Auth, OAuth or SMTP.

## Contract

- `training_intake` consent must be an explicit new `pilot-supervised-v2` grant. Prior receipts are retained and never converted.
- `declared_health=true` is rejected. `p_health` is an optional backwards-compatible RPC argument: only SQL NULL or `{}` is accepted. It is never stored or read into a model/reviewer context.
- Direct authenticated SELECT of `intake_health` is disabled. Existing table, rows and owner policy remain in place for a future separately authorized phase.
- Training has exactly eight fields: goal, experience, days, minutes, equipment, preferred, avoided, preferences. Goal and equipment are exact enums; experience is beginner/intermediate/experienced, days 1–5, minutes 30/45/60/75/90. Preferred/avoided are exact catalogue names joined by `, `, at most 600 characters with no duplicates or overlap. General preferences must be empty. No free text enters the model context.
- A is required before saving a draft and before generation. Old submitted intakes cannot bypass the new structured validator by being reserved directly.
- No health grant is fabricated. Revoking B invalidates only operations that actually reference the revoked grant IDs; A-only operations stay valid.
- Revoking B removes health from owned drafts only. Submitted receipts, accepted routines and workouts remain unchanged.

## Additional endpoints

- `delete_my_training_intake(p_id uuid,p_expected bigint)`: owner only; current row version; draft only; no linked operation. It deletes that draft's health row if one existed. No operation or submitted intake is deleted.
- `get_coach_reviewer_status()`: reports only the caller's authorization and, while active, its expiry. No arbitrary UUID input.
- `get_my_coach_access()` additionally returns `has_feedback`, `health_enabled=false` and notice version. Existing `can_feedback` remains server-derived from an own workout.

Reviewer and pilot expiry checks use wall-clock time. Review/retry recheck reviewer access after acquiring the athlete advisory lock so waiting cannot carry an expired authorization forward. Existing operation idempotency, immutable completion receipts and structural guards remain active.

## Local files and validation

The migration filename was created with the official portable Supabase CLI 2.118.0 `migration new`. The preparer rebuilds the rollback from exact baseline definitions when the ignored read-only snapshot is present; no credentials are read.

`transaction.mjs` generates 70 synthetic SQL assertions inside BEGIN/ROLLBACK. Its identities, configurations, workouts, drafts and routines must never be committed outside that transaction. It uses database claims, not real JWT transport, and no external model calls. Live JWT tests are a separate root-run suite.

Initial execution found a fixture omission: the synthetic workout lacked `routine_day_id`. The test was corrected to use the accepted routine's actual day UUID; no product guard was changed.

## Rollback

`supabase/rollback-coach-pilot-v2.sql` requires an empty whitelist and no reserved generation. It restores 12 exact prior function definitions, removes the two new endpoints and restores the prior health read privilege. Only the save RPC is dropped/recreated, without CASCADE, to remove argument defaults; its exact owner/grants are restored. Unexpected dependencies stop rollback safely.

The notice CHECK still permits v2 audit receipts after rollback; it does not delete or relabel them. The default notice returns to v1. Coordinate the rollback with the previous Edge and frontend; never activate a pilot while versions disagree.

No retention deadlines or automatic purge are introduced. No legal compliance certification is implied. Legacy health data is retained but unavailable in the pilot.
