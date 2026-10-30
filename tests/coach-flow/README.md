# Coach request recovery — development candidate

29 October staging validation: [authenticated sports review](BASIC-SPORTS-STAGING.md).
Edge v33 retains the cost guard and changes only the V5 evaluator dependency.
58/58 distinct live SDK/JWT + authenticated-renderer checks and 11/11 offline
evidence checks passed. Three synthetic rows cleaned; 27/27 references restored;
temporary scopes closed. No provider calls or frontend/production deployment.

29 October follow-up: [Basic V5 contextual sports review](BASIC-SPORTS-REVIEW.md).
56/56 new offline evaluator/browser cases and 79/79 existing regressions passed.
The preserved real proposal remains valid with five advisory warnings. No deployment,
provider call or backend change. Historical zero-warning receipts remain unchanged.

28 October: [first real Basic V5 generation and sports audit](BASIC-REAL-RESULTS.md).
One provider count and one generation succeeded; 24/24 real SDK/JWT checks passed.
Proposal stayed pending_review and was never accepted. Three synthetic rows were cleaned;
27/27 references and 16 critical functions/configurations were restored.
Token cost calculated from provider usage: USD 0.036885; invoice/count charges unverified.
29 October: 10/10 read-only local receipt checks; no new backend or provider requests.
These are separate evidence categories, not 34 authenticated checks.
The real-run harness is retained for traceability, not authorization to repeat it.

27 October: [Basic cost guard deployed to staging v32](BASIC-GUARD-DEPLOYMENT.md),
JWT required and all existing CORS retained. 18 new live denial/CORS/auth checks pass;
44 existing offline guard cases rerun successfully. No provider calls or pilot activation.
The earlier preparation also passed 35 existing V5 regressions (not rerun for deployment).
Run `node tests/coach-flow/basic-cost-guard.cjs` and `node tests/coach-flow/basic-real-preflight.cjs`.
The preflight's optional private deployment snapshot stays ignored; it is not required by CI.
See the plan for technical limits versus unverified commercial/credential assumptions.

Latest result (26 October): [Basic real-SDK rehearsal closed](BASIC-SDK-RESULTS.md).
The authorized staging run completed 21 unique real SDK/JWT checks, including review,
acceptance, one workout and history. Its deterministic proposal was seeded, not generated
by a provider. All fixture rows were removed; 27/27 original count/hash references and
16 function definitions/owners/ACLs were restored. No model call, deployment or merge.
The harness fingerprint and navigation fixes add 14 read-only security regression cases
and 2 offline navigation assertions; reruns are not added to those totals.
The [plan](BASIC-SDK-PILOT.md) remains the procedure for a separately authorized future
run. Earlier sections below are dated evidence, not new executions or current blockers.

Base: production/main `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`.
Independent branch: `codex/coach-flow-reliability`. Only the explicitly authorized staging
Edge guard was deployed; no production deployment, persistent SQL migration,
Auth configuration change. The one explicitly authorized provider request on 28 October
is documented above; temporary staging scopes were restored after both trials.
Cloudflare PR #1 is a separate draft and is not modified.

## Current implementation, checked 25 October 2026

Basic already includes training-only intake v2, the v5 generation contract,
structured targets per set, supervised review, explicit acceptance, fixed routine
prescriptions and the existing workout/history flow. Production Edge source includes
`contract-v5.mjs`; JWT verification remains enabled. Older proposal versions remain
supported. An existing accepted production operation uses v2; that is historical
evidence, not a new real-model test of this candidate.

Premium already includes direct initial programming, Basic upgrades, mesocycles,
weekly check-ins, training-history permissions, analysis, chat, recommendations,
reviewer projections and explicit acceptance of revisions. Production chat source
includes `premium-chat-v1.2`. Direct initial Premium remains switched off. Deployment
of those modules is distinct from a valid, unexpired individual entitlement.

This session inspected metadata and aggregate configuration only. It did not grant
access, extend expirations, reopen a pilot or resolve the outstanding production
same-JWT reviewer privacy check. The legal/privacy launch gates remain independent.

## Reproduced defects and corrections

1. **Basic response loss.** When the simulated server recorded the proposal but the
   invocation response was lost, the form showed a generic retryable error. A fast
   second activation performed another save/invocation in the offline harness.
   This is evidence of duplicate frontend requests, not two real paid calls: the
   server has independent reservation/idempotency guards.
   The UI now retains the owner/intake in memory and reconciles the existing operation
   using an owner- and intake-filtered read. Pending/ready/failed states follow their
   existing flow. Unknown/reserved states expose a read-only refresh, never automatic
   provider resubmission. Closing/reopening and late responses are guarded by owner
   and dialog epoch. Sign-out clears the in-memory marker.
2. **Premium explicit retry.** A manual retry after an unconfirmed response created a
   new request key. It now reuses the outstanding key/message ID for the same revision.
   The unchanged server continues binding the key to its original context/content and
   rejects conflicts. Once state is confirmed, a new turn receives a new key. There is
   no automatic resend, new quota, provider policy or financial change.

Only `assets/coach.js`, `assets/coach-premium-chat.js` and their two versioned script
references in `index.html` change product behavior. There is no redesign or change to
questionnaire wording, programming rules, catalogue, prescriptions, training save,
Auth/OAuth, recovery, roles, RLS, RPCs, backend transport or billing.

## Initial candidate checks (historical; not rerun for the JWT follow-up)

Use the repository's existing Node/Playwright installation; no runtime dependency is
added. The browser scripts use isolated headless profiles, never personal sessions.

```powershell
$env:COACH_PORT='4266'
node tests/coach-pilot/preview.cjs
# In another terminal, from this worktree:
node tests/coach-flow/recovery.cjs
node tests/coach-flow/journey.cjs
node tests/coach-flow/premium-retry.cjs
node tests/coach-flow/contracts.cjs
node tests/coach-quality-v5/unit.cjs
node tests/coach-intake-v2/unit.cjs
$env:PREMIUM_CHAT_UI_PORT='4270'
node tests/premium-chat/ui.cjs
# Optional, real anonymous reads of SIMPLE Security Test only:
node tests/coach-flow/staging-anon.cjs
```

| Final suite | Assertions | Evidence type |
| --- | ---: | --- |
| Basic request recovery | 111/111 | Chromium/WebKit, mocked backend |
| Basic review → acceptance → workout/history | 40/40 | Chromium/WebKit, mocked backend/reviewer |
| Premium retry idempotency | 8/8 | Chromium/WebKit, mocked provider counter |
| Compatibility against current main | 23/23 | Local source assertions |
| Existing v5 contracts/provider | 35/35 | Unit + injected provider transport |
| Existing questionnaire contracts | 50/50 | Unit |
| Existing chat UI regression | 1,014/1,014 | Offline Chromium/WebKit |
| Anonymous staging reads | 6/6 | Real HTTP, no JWT |

Initial candidate total: **1,287 unique assertions**. These are existing evidence,
not new executions in the authenticated follow-up below. Reproductions, smoke runs, reruns and
historical counts are not added again. Recovery and workout views include
360/390/430/1280, light/dark. The chat regression also includes 320px. Keyboard,
focus, duplicate activation, delayed responses, foreign owner/intake, review gates,
errors, pending state and exact v5 targets are exercised.

No real model output or real authenticated user journey is claimed here. The mock
proposal is a contract fixture, not evidence of individualized programming quality.
The six staging HTTP checks establish only anonymous denial/empty results; they do
not stand in for owner, trainer, other-client or reviewer JWT tests.

The historical `tests/coach-generation/contracts.cjs` compares Auth against an older
publication and fails on changes already present in this production base (including
Caps Lock). Its failure is retained in the private run evidence; it was not rewritten
or counted as a pass. The new current-base checks prove the relevant protected sources
and the entire inline training/navigation code are unchanged from current main.
Browser sandbox startup and preview connectivity issues were test-environment errors;
the final browser runs used the existing authorized test runtime and loopback server.

Results, screenshots, aggregate read-only integrity receipts and failure evidence stay
under ignored `results/` or `private/`. They must not enter public artifacts or commits.

## Authenticated staging follow-up — 25 October 2026

At that checkpoint, product files were byte-identical to the reviewed PR #2 tree
`b07c074c3f7f13a06991bdc736dfd056dfb12a20`. This follow-up adds test runners and
documentation only. No new product defect was reproduced in that follow-up. The
later full-reload gap/fix is recorded in BASIC-SDK-PILOT.md; server, questionnaire
and v5 programming code still remain unchanged.

| New checks | Passed | Evidence |
| --- | ---: | --- |
| Existing synthetic identities and scopes | 84/84 | Real JWTs verified by staging Auth; actual authenticated REST/RPC responses |
| Basic recovery view and full reload | 18/18 | Actual frontend + real JWT HTTP relay in Node; browser contains no token |
| Full Basic reload and Premium conflicts/context | 54/54 | Actual frontend with controlled synthetic server; Chromium and WebKit |

**156 unique new assertions**, excluding the earlier candidate's 1,287 assertions
and all partial harness runs. In addition, **27/27 aggregate integrity comparisons**
match before/after; these are reported separately rather than inflating the test count.

Five already-authorized synthetic identities were used: three clients (`mock`,
`real`, `retry`), a designated reviewer and a normal trainer. The server verified
each real JWT and existing profile role. No new identity, permission, consent,
allowance or reviewer assignment was created. Passwords were read from the existing
authorized private manifest in memory. Access/refresh tokens were never written to
files, browser storage, logs, snapshots, child environments or test results.
All runner processes exited and discarded their in-memory sessions.

Real JWT evidence covers own existing routine/history reads, denial of another
unassigned client's populated routine, denial of existing private revisions and
mesocycles, exact owner/intake filtering for a nonexistent Basic operation,
unavailable Basic/Premium capabilities, role guards and expired reviewer assignments.
The reviewer currently has four preexisting assignments, all expired; all four
specific projections reject access. An `actor: reviewer` label with an empty
`scopes` array is not a permission grant or a positive projection test.

Ten authenticated `premium_chat_reserve` requests target a UUID verified absent
beforehand. Each rejects in the existing client-role/owned-mesocycle guard before
expiry reconciliation, inserts, reservations or quota consumption. The trainer
guard returns `coach_not_authorized`; clients return `premium_chat_not_authorized`.
The unchanged financial/data hashes confirm there was no persistent business write.
These rejections do **not** prove the later idempotency/content-binding branch.

The mixed browser checks use a strict read-only Node relay with real JWTs for the
three clients. External browser HTTP is blocked. It exercises the real recovery
view, read-only status refresh and full reload with the actual unavailable Basic
capability. It is **not** a complete Supabase SDK login, OAuth or authenticated
browser journey, nor a successful generation/operation recovery.

The 54 controlled browser assertions cover full reload of reserved, failed,
pending-review, ready, accepted and absent operation states while retaining an
existing accepted routine, revision, workout and note. They verify zero automatic
invocations or saves. Premium checks pass the same key with changed content to a
simulated server rejection, change revision between attempts and revoke context;
the confirmed transcript remains intact without another simulated charge.
The production server's corresponding key/content/revision checks were inspected
in read-only source/metadata, but their positive-scope execution remains untested.

### Explicit limitations / blocked positive scenarios

- No Basic intakes or operations currently exist in staging for these identities;
  their pilot capability is off. Empty foreign Basic reads cannot prove isolation
  against a populated operation row. Positive owner recovery and review/acceptance
  states remain simulated.
- None of these identities owns a Premium mesocycle, conversation or message.
  Their Premium capability is unavailable. The assigned reviewer scopes are expired.
  Positive chat idempotency, real server content/revision conflicts and an authorized
  reviewer projection cannot legitimately reach their target branches today.
- No scopes were extended, fixtures inserted or existing records modified to make
  a positive case pass. This is independent of the outstanding production reviewer
  privacy test for Cloudflare.

### Integrity, harness diagnostics and reproduction

The 27 comparisons include profiles, routines/days/exercises/assignments, workouts,
notes, intakes/grants/operations, management/revisions/mesocycles, conversations,
messages/recommendations/check-ins, budgets/entitlements/admissions/financial audit,
stable Auth identity fields and pilot/reviewer configuration. Counts and hashes match.
In particular, 19 routines, 98 exercises, 22 workouts, four revisions and four notes
are unchanged. All preexisting fixtures, including financial records, remain intact.
Normal test sign-ins create Auth sessions and update login timestamps; those mutable
fields are deliberately excluded from the stable identity comparison. No Auth
configuration, identity/role, RLS, secret, quota or budget was changed.

Three stopped attempts were harness diagnostics, not application regressions:
expecting the reviewer actor label to imply access, expecting a client error for
trainers, and restoring a memory-only attempt after a supposed full reload. The
assertions were corrected using the actual function definitions and real reload
semantics. Their partial counts are not added to the 156 final assertions.

```powershell
# Offline, no credentials/network/provider:
node tests/coach-flow/reload-context.cjs
# Explicit real staging validation using the existing authorized manifest:
node tests/coach-flow/jwt-readonly.cjs <authorized-private-manifest-path> --browser
```

The real runner additionally requires an independently checked, ignored
`private/jwt-scope-proof.json`: exact staging project, five authorized actor IDs and
roles, own routine/workout counts, a verified nonexistent negative target and the
four expired reviewer scope IDs. Refresh that read-only proof before a future run;
it is not a fixture generator or permission-grant script. Never commit it or the
credential manifest. All evidence is ignored in `results/` and `private/`, including
the final authenticated/reload-context JSON and aggregate integrity receipt.

No staging Edge Function was invoked, no provider request or spending occurred,
and no production database or application state was modified. Neither PR was merged
or deployed; main and draft PR #1 are unchanged. Updating PR #2 adds tests/docs only.

## Remaining pilot validation and rollback

- Before a supervised Basic pilot, separately authorize valid synthetic pilot scope,
  consent and suitable isolated operation fixtures (or one supervised generation),
  then test positive recovery, populated cross-owner denial and reload using the
  real SDK. Do not grant these automatically. For Premium's positive idempotency
  path, a valid owned mesocycle/chat scope and controlled no-provider fixture/replay
  mechanism need separate authorization; expired reviewer denial is insufficient.
- A new real model generation requires separate authorization/cost approval. Existing
  real pilot evidence is historical and was not regenerated or modified.
- The outstanding production reviewer privacy gate and Cloudflare cutover are not
  closed by these tests. No hosting configuration changed.
- Rollback is the previous three frontend files from the base commit; there is no
  database rollback or counter reset to apply. Preserve all server-side operations,
  accepted routines and workout history.

The local `/review` preview remains explicitly synthetic. Its `/` route is the old
staging login surface; the new browser suites use only `/demo` with external network
requests blocked.
