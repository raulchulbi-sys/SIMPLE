# Basic cost guard — staging deployment verified

27 October 2026. Scope: SIMPLE Security Test `dmqjexigdnfzobarhnib` only.
Status: **DEPLOYED AND VERIFIED (denial paths); real provider path NOT EXECUTED.**

## Version and exact payload

- Initial Edge: `simple-coach-mock` v31, ACTIVE, verify_jwt=true, import_map=false.
- Final Edge: **v32**, ACTIVE, verify_jwt=true, import_map=false.
- Function ID unchanged. Retrieved all 11 deployed files; exact content equals the prepared payload.
- v32 ezbr SHA256: `c8bcd7a162e41b1114a9bcf05edd4ca5fc7a40bdb70506fddfd33244563c015c`.
- Prepared payload SHA256: `0ca118633dd6e43fd75203265f7388e6a4f569d4afbf3aac37550a80efe76a52`.
- Candidate runtime came from PR #2 remote `16ae3f64f835c56551656764b074288ebdec2f0b`,
  local equivalent `8078440d8c69490a430959e10ab580c2c5870c40`,
  shared tree `ac46fcbf93b9c387a72380f361028f43ba084d91`.

Exact delta from v31:
1. Add `supabase/functions/simple-coach-mock/staging-cost-guard.mjs`.
2. Integrate that wrapper in `index.ts` for the staging project only.
3. Preserve the existing deployed CORS line, including origins not present in local code.
4. Preserve all other nine deployed dependency files byte-for-byte.

No V5/catalogue/provider implementation, SQL, RLS, Auth, quota, secret or Financial P1 change.
Production provider path remains unchanged. No production or Cloudflare deployment.

## Evidence — separate execution classes

### New real staging HTTP checks: 18/18

- Missing JWT, malformed JWT and anon JWT: 401, no authenticated user.
- Eight existing origins: OPTIONS 204, exact Access-Control-Allow-Origin,
  Vary includes Origin, Cache-Control=no-store.
- Unapproved origin: 403, no allow-origin header.
- GET: 405.
- Existing authorized synthetic client: real password login and Auth user identity confirmed.
- Same real JWT with Basic disabled: 400 coach_pilot_required, before reservation.
- Client-supplied model and malformed JSON: 400 invalid_request.
- Synthetic local session signed out; read-only query confirms zero remaining sessions
  created for that account since this deployment baseline.

No synthetic access was enabled. Requests used fixed nonexistent intake/key values.
No consent/intake/operation/proposal/routine/workout/note was created.
No token, refresh token or password was persisted by this runner. The preexisting private
credential manifest was read, not copied, modified or included in Git.

Eight preserved CORS origins:
- http://127.0.0.1:4194 and http://localhost:4194
- http://127.0.0.1:4195 and http://localhost:4195
- http://127.0.0.1:4280 and http://localhost:4280
- https://simple-staging-raulchulbi.pages.dev
- https://4a8636ab.simple-staging-raulchulbi.pages.dev

### Existing offline checks reused: 44/44

Rerun `basic-cost-guard.cjs`: final request/UTF-8 bytes, fixed model/contract/tier,
count failure/overflow/timeout, output limit, concurrent duplicate dispatch,
receipt validation and usage preservation, project restrictions and entrypoint integration.
All OpenAI responses are simulated. This does not certify live token counting,
provider credentials, model availability, complete V5 output or actual billing.

The 35 V5 regressions and 21 SDK/JWT rehearsal checks are earlier evidence,
not new executions and not added to today's 18 new checks.

### Read-only integrity comparisons

27/27 count/hash references exactly equal before/after. In particular:
19 routines, 33 days, 98 exercises, 12 assignments, 22 workouts, four notes,
four revisions; training_intakes=0 and coach_operations=0.
pilot_config={} and reviewer_config={}.
16 critical function definitions/owners/ACLs and security metadata unchanged.
Additional complete fingerprints for public/coach_private functions, triggers,
roles, memberships and schema ownership/ACLs also unchanged.
Financial budgets/ledger references, stable Auth identities and profiles unchanged.

Ordinary synthetic sign-in can update Auth timestamps; stable Auth fingerprints
exclude those mutable timestamps. No Auth configuration, role or identity changed.

### Harness diagnostics (not product regressions)

The first restricted-network invocation failed to establish HTTP transport.
An authorized network execution reached staging normally.
An initial assertion expected Vary to equal Origin, but the gateway correctly adds
Accept-Encoding. The assertion now checks the Origin token in the Vary list.
The final 18-case run passed; partial attempts are not counted as new checks.
No rollback was needed and no product change was made to satisfy either diagnostic.

## Reproduction and rollback

`basic-guard-package.cjs` is an offline packager. It rejects unreviewed entrypoint/
dependency drift, preserves deployed CORS and emits exact deployment/rollback payloads
only under the ignored private directory. It does not deploy anything.

`basic-guard-postdeploy.cjs` requires an explicit --verify-denials flag and a verified
before snapshot with disabled access and empty Basic data. Fixed staging host only.
It makes denial requests and signs an existing synthetic session out in finally.
Do not run it without rechecking those preconditions.

Private evidence (ignored, not uploaded):
`tests/coach-flow/private/basic-guard-deploy-20261027/`
contains before/after Edge code, DB/security snapshots, exact deployment/rollback
payloads, package hashes and the sanitized HTTP result receipt.

Rollback payload SHA256:
`192ed0e36711de950681963b685c0c6024236771acdb7efdf266402164834b4f`.

On a demonstrated regression, redeploy that exact v31 source/configuration with
verify_jwt=true to this staging project only; it will receive a NEW version number.
Then retrieve source, compare exact files, verify denials/CORS and integrity.
No SQL rollback, permission adjustment, quota reset or historical data deletion.
The rollback was prepared and checked, NOT executed as an extra deployment.

## Effective controls and residual risks

Fixed `gpt-5.4-2026-03-05`, `basic-initial-v5`, final JSON <=16,384 UTF-8 bytes,
verified input count <=12,000, max_output_tokens=5,120, service_tier=default,
truncation=disabled, reasoning=low, store=false, strict schema, no tools.
One count and at most one generation per claimed operation; no automatic retries.
Existing database idempotency/claim plus single-use runtime transport retained.
Unexpected configuration or failed count rejects before generation.
Receipt inconsistencies reject the proposal while preserving reported usage.

The byte limit and request construction are local checks. Actual input count and
provider compliance can only be checked on the separately authorized real request.
A timeout does not prove that the provider did not charge. Never silently retry.
5,120 includes reasoning; incomplete output remains possible.

Official GPT-5.4 standard tariffs reviewed: input $2.50/M, cached $0.25/M,
output $15/M. Assuming those tariffs, fixed default tier and compliance with caps:
(12,000 * 2.50 + 5,120 * 15) / 1,000,000 = **$0.1068**.
This excludes taxes, counting-endpoint charges if any, and hosting.
A hypothetical 10% regional surcharge would make the token component $0.11748;
the code uses global api.openai.com, not a regional endpoint.
No documented price for the counting endpoint was established in the consulted
official references; absence of a listed fee is not evidence that it is free.
**$0.12 is not a guaranteed monetary hard cap.**
No account budget, secret or commercial condition was changed.
Current key validity and account billing terms remain unverified.

Sources:
- https://developers.openai.com/api/docs/models/gpt-5.4
- https://developers.openai.com/api/docs/guides/token-counting
- https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count
- https://developers.openai.com/api/docs/guides/reasoning

## Next authorization — not executed

See BASIC-REAL-GENERATION.md for the exact synthetic intake and evaluation:
three 60-minute sessions, permitted equipment, two exclusions, Sunday running.
The next scope requires:
- Existing synthetic owner and reviewer only, temporary access <=60 minutes.
- One synthetic training-only consent/intake; operation created by the real Edge flow.
- One count and at most one generation, zero retries; no other Edge calls.
- Acceptance of the conditional token estimate and resolution of counting/account
  billing uncertainty; if an absolute monetary guarantee is required, do not execute.
- Exact usage/model/tier/cost/latency receipt and V5/sport evaluation.
- pending_review only; no automatic approval, acceptance or workout.
- Disable temporary access, preserve billing evidence, clean only exact recorded UUIDs
  once reconciled, verify original integrity. Keep v32 unless a regression requires rollback.

## GitHub boundary

Main remains `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`.
PR #1 remains draft at `81fe65f4b9b5a9b7c3d905c2ea3c432f8ef5d839`, untouched.
PR #2 remains a draft; only deployment harness/evidence updates follow the reviewed guard.
Neither PR merged; no hosting publication or production change.
**Zero OpenAI API requests (including counting), zero provider usage generated.**
