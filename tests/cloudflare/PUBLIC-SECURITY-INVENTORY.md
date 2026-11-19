# Public frontend security inventory — staging, 2026-10-16

**PUBLIC FRONTEND SECURITY: BLOCKED.** The executed anonymous and authenticated checks passed. Four explicitly recorded coverage gaps remain, including a positive assigned-reviewer privacy check. This is not a confirmed REST disclosure or a production security certification.

Only staging was inspected. No production Auth/CORS, users, profiles, quotas, budgets, financial records or training records were changed. No additional accounts or business fixtures were created. Cloudflare production continues to serve its inert placeholder. CORS is a browser restriction; server permissions and identity checks remain authoritative for requests from any HTTP client.

## Evidence and limits

| Evidence | Result | Meaning |
| --- | --- | --- |
| LIVE database metadata, 09:45:55Z | 41 tables, 47 policies, 219 functions | 26 public tables, seven private tables and eight Storage tables; all have RLS. No views or materialized views in these schemas. |
| Anonymous HTTP report, 09:22Z | 50/50 | Actual staging requests without a user session; no returned private records. |
| Anonymous reorder supplement, 09:48Z | 3/3 | Actual calls to the three PUBLIC-executable reorder functions reject unauthenticated callers. |
| New JWT harness, 09:56:52Z–09:57:21Z | **92/92 checks; 109 HTTP requests** | Five existing authorized synthetic accounts; password login, Auth identity, database role, owner/cross-user reads, assigned trainer reads and denied operations. |
| Premium prerequisites, 09:59:11Z | Disabled; unchanged | Read-only booleans explain why eligible reviewer and revocation-transition positives were unavailable. |

The 92 checks are one new run, not repeated historical tests added to a total. No 635-test or 103-test batch was rerun. The original DNS-blocked attempt reached no HTTP response and obtained no session; its report is retained separately and is not counted as a credential failure or successful test.

The saved-response code audit found **26 HTTP 403 / SQLSTATE 42501 authorization denials**, including all 15 server-only RPC attempts and all five profile-role PATCH attempts. **Nine HTTP 400 / P0001 responses are only missing-target/business-validation negatives; they are not proof that a write against an existing foreign row is blocked.** No success depends on PGRST202 (missing signature), 42883 (missing function) or 22P02 (invalid input/UUID). The remaining checks cover actual authenticated identities, reads and current access observations; 92/92 does not mean complete cross-user write authorization coverage.

This audit used the saved HTTP statuses/codes, without another login or HTTP request. Error messages were deliberately not retained, so exact historical P0001 message matching is not claimed. The future runner now requires 42501/403 for permission denials, or an explicit P0001 business-message allowlist; it rejects missing-signature and malformed-input errors. The original run report and its source hash are preserved separately from this later matcher change. Six local matcher assertions are not additional live security checks.

The five successful password logins create normal Auth sessions and can update `last_sign_in_at`/`updated_at`. There were no password changes, account/profile edits, refresh calls, admin calls or logout calls. `finally` cleared the in-memory token map; the Node process completed and exited. Newly issued access/refresh tokens were not written to files or printed. Existing historical token fields were ignored. Auth session rows remain subject to their normal lifecycle; no existing sessions were revoked.

Local ignored evidence: `private/public-security-catalog-20261016.json`, `private/public-security-prerequisites-20261016.json`, `results/public-anonymous-security.json`, `results/public-anonymous-reorder.json`, `results/public-jwt-security.json`, `results/public-jwt-security-before-code-audit.json` and the separate DNS report. These files are not web assets. The public report contains no account identifiers, email addresses, passwords, private data values or tokens.

## Effective authorization inventory

| Surface | Enforced server contract | Evidence |
| --- | --- | --- |
| Anonymous REST | No SELECT/DML grants, including column SELECT grants, on the 26 application tables. | Catalog plus 26 real REST probes. Empty responses or permission errors must contain no rows. |
| Anonymous RPC | Sensitive RPCs have no anon EXECUTE. The three reorder exceptions are SECURITY INVOKER and reject `auth.uid() IS NULL` before locks/writes. | Catalog, LIVE source and three real rejection probes. |
| Client identity and role | Existing profiles cannot be updated through the authenticated role. Initial profile INSERT is limited to the authenticated ID and an allowed onboarding role; it cannot overwrite an existing profile. | Profiles ACL/policies, five real self-profile reads and denied role PATCH requests on absent targets. |
| Private routines, workouts and notes | Owner predicates use `auth.uid()`. Workout triggers preserve identity/context; direct writes cannot change owner or captured routine/session identity. | LIVE policies/triggers; owner positives and client A/B negatives with real JWTs. |
| Trainer access | History/notes RPCs require an active matching assignment and the trainer's routine ownership. Templates and client customization remain separate. | Two existing authorized synthetic assignments each returned their own history and notes; unassigned trainer/reviewer calls returned no records. |
| Assignments and sharing | Direct assignment INSERT is not granted. UPDATE is restricted to `client_deleted_at`. Sharing RPC requires a trainer owning the routine; redemption requires a client and a valid trainer-owned code. | ACL, column grants and LIVE RPC guards. No share code was created/redeemed in this run. |
| Routine editing | Owner/trainer and assignment checks, entity membership, edit scope and expected versions constrain edits. | LIVE source; client calls against nonexistent scopes rejected. No saved edit was attempted. |
| Session/exercise deletion | Owner-only deletion or an explicit valid trainer assignment, depending on RPC; missing targets reject. | LIVE source and rejected nonexistent-target RPCs. No existing session/exercise was deleted. |
| Basic/initial acceptance | Client identity is derived from `coach_private.actor()`, which requires `auth.uid()` and a database profile with role client. Review, context, ownership and operation state are checked on the server. | LIVE source; no generation or acceptance was invoked. |
| Premium check-ins and revisions | Current mesocycle, owner access, consent, revision/week and expected row version are checked before a write. | LIVE source and rejected nonexistent check-in scopes. No positive write or revision generation was attempted. |
| Reviewer | Basic reviewer access uses enabled/expiry configuration. Premium review uses trainer role, explicit `reviewer_id`, and the owner's effective Premium access. It does not grant global conversation/workout/revision access. | LIVE helpers; real JWT global read negatives. Assigned Premium projection remains unexercised. |
| Premium activation, quotas, backend claim/finish | Browser roles cannot execute entitlement, allowance, reviewer-assignment, admin/control, finance or backend claim/finish RPCs. Privileged Premium helpers also reject an authenticated database role. | Catalog; entitlement/allowance/reviewer-assignment calls rejected for all five JWT actors against nonexistent targets. No financial procedure was called by the JWT harness. |
| Private finance/config schema | No schema USAGE for anon/authenticated; no exposed public view provides a bypass. | Catalog and anonymous non-exposed-schema probes. No financial values were copied into this report. |

There are 92 public-schema functions, of which 67 are executable by authenticated users. Across the public/private function inventory, 183 use SECURITY DEFINER; all have an explicit search path. No function definition or policy references `user_metadata`/`raw_user_meta_data` for authorization. Client roles cannot CREATE in the public/private schemas. These facts support source review; they do not make every definer function safe without its individual guards.

`routine_user_notes` policies target PUBLIC but still require the authenticated owner's ID, and anon has no corresponding table grants. Storage's managed table grants are also subject to RLS; there are no application Storage policies granting access in the inspected catalog. RLS and grants must be assessed together.

## Edge Functions

| Frontend function | LIVE staging version | Authentication and business boundary |
| --- | ---: | --- |
| `simple-coach-mock` | 31 | JWT gateway plus `/auth/v1/user`; server-bound actor/operation and Basic guards. |
| `simple-coach-premium` | 15 | JWT gateway, staging-project guard, verified user, Premium access and claim before provider dispatch. |
| `simple-coach-chat` | 15 | Same identity boundary; current revision, consent, access, idempotency and a single provider claim. |
| `simple-coach-initial-premium` | 4 | Same identity boundary; independent initial eligibility and claim/finish guards. |

All four keep `verify_jwt: true`, explicit CORS origin lists, OPTIONS handling and rejection of unapproved origins. User identity is obtained from Supabase Auth, not a caller-supplied user ID. Check-ins, reviewer actions and recommendations also use protected RPC/REST; they do not require additional hosting backend routes. The six historical QA helpers have retirement-only HTTP 410 source and keep JWT verification enabled. No helper was reactivated or invoked.

No authenticated Edge call was made: a valid business request could dispatch AI. Existing real anonymous gateway probes cover invalid authentication without entering the provider path.

## Assigned-reviewer REST privacy question — not a confirmed reproduction

The catalog exposes a condition that deserves an explicit positive test before declaring full security readiness:

- `public.coach_mesocycles` grants authenticated SELECT on all its columns, including `intake`. Its `premium_explicit_reviewer` SELECT policy uses `coach_private.premium_review_access(id)`.
- `public.coach_recommendations` grants authenticated SELECT on all columns, including `context_snapshot`, `analysis_bundle` and `analysis_trace`. Its `premium_explicit_reviewer` policy combines `premium_review_access(mesocycle_id)` with the weekly/chat visibility predicates.
- The frontend deliberately selects a reviewer projection omitting private intake, and `premium_recommendation_view` returns a bounded projection. These selections do not themselves remove columns from an independently permitted REST row.

Consequently, **if** the reviewer policy admits a row, the catalog suggests that a direct REST `select=id,intake` or `select=id,context_snapshot,analysis_bundle` may return fields outside the UI projection. The actual content/sensitivity and the authorized reviewer contract still require verification. No eligible assigned row was available among the three authorized synthetic owners, so this run did not reproduce a disclosure, did not read such private values, and did not apply a fix.

The policy helper requires a trainer whose ID is the mesocycle's `reviewer_id`, plus `premium_access` for its owner. That owner access ultimately requires global `premium_analysis_budget.premium_enabled`, an enabled and unexpired entitlement with `tracking` capability, suitable mesocycle state/access time, admission/consent and Premium routine management. At 09:59Z the global switch was false; all three authorized clients had disabled, expired entitlements without the tracking capability. None had a mesocycle assigned to the authorized reviewer. The initial-generation switch was also false. These are specific missing prerequisites, not evidence that the REST projection is safe when enabled.

The historical reviewer configuration was disabled as well. Premium assignment checks and the Basic reviewer configuration are distinct controls; enabling one must not be assumed to satisfy the other.

## Four remaining gaps

1. The third synthetic client's owner-routine positive had no routine. Its zero-row result was recorded without claiming a populated-owner test. Other owner-routine, workout and note positives were observed.
2. No eligible mesocycle assigned to the authorized reviewer was present among the authorized owners. The positive reviewer intake projection was not exercised.
3. No authorized visible recommendation was available for the assigned-reviewer context projection. Global reviewer read denials passed, but do not cover this positive scope.
4. All observed Premium accesses were disabled. The run verified current denial and server controls, not a live enabled-to-revoked transition or positive generation. No entitlement, flag, consent, quota or budget was changed to manufacture coverage.

No extra account or fixture was created to fill these gaps. No result from SQL claims/role impersonation is presented as a real JWT test.

## Smallest future staging verification

Under a separately scoped authorization, use an isolated nonfinancial test owner and reviewer, either already authorized or newly authorized for that task. Create only the necessary isolated Premium scope and recommendation; give the owner the exact eligible state and explicit reviewer assignment. Preserve the current financial audit accounts and all production state. Capture/revert only task-owned fixtures and specifically authorized controls.

Use real Auth JWTs in RAM and request:

1. Owner REST positive for the isolated routine/mesocycle/recommendation.
2. Assigned reviewer bounded UI/RPC projection positive.
3. Assigned reviewer direct REST `coach_mesocycles?select=id,intake&id=eq.<isolated-scope>` and `coach_recommendations?select=id,context_snapshot,analysis_bundle,analysis_trace&id=eq.<isolated-recommendation>`. Report column presence/denial only, never their contents.
4. Unassigned reviewer and other-client negatives for the same exact IDs.
5. If the role contract excludes those private fields and REST returns them, record the reproduction before preparing the smallest staging-only server fix. Keep permitted reviewer workflow and owner access working; a UI filter alone is insufficient.
6. A separately authorized revocation case should prove that an already issued JWT loses the protected capability on the next server request. Do not call a provider or alter financial audit records to test it.

The reusable `public-jwt-security.cjs` runner defaults to DRY RUN. Its explicit `--run` mode accepts only the five pinned historical synthetic identities and the reviewed staging backend, obtains password sessions in RAM, blocks provider/admin/refresh/logout routes, and writes only redacted results to ignored `results/`. A future different actor set requires a separately reviewed pin change; do not substitute real-user credentials.

Official references reviewed on 2026-10-16: [Supabase changelog](https://supabase.com/changelog), [RLS and views](https://supabase.com/docs/guides/database/postgres/row-level-security), [database functions and execution privileges](https://supabase.com/docs/guides/database/functions). They support assessing grants, RLS and definer behavior separately; they do not replace the live project evidence above.
