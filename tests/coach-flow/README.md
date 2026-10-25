# Coach request recovery — development candidate

Base: production/main `0c96b5fa96c2b99436dfc1c32425ed5e3a8b4663`.
Independent branch: `codex/coach-flow-reliability`. No deployment, SQL migration,
Auth change, allowance, reviewer assignment or paid model request is part of this change.
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

## Reproducible checks

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

Total: **1,287 unique final assertions**. Reproductions, smoke runs, reruns and
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

## Remaining validation and rollback

- Rehearse this frontend against real authorized synthetic staging JWTs, including
  owner, other client, trainer and reviewer, before promotion. No accounts or reviewer
  capabilities were enabled merely to satisfy this check.
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
