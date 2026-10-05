# SIMPLE Coach Premium — Phase 3 closure and Phase 4 Chat

Base: `7af766f`, branch `codex/premium-chat`. Lineage: 72fc545 → 660dcb1 → dde5dd8 → 00c3f64 → 7af766f → this candidate. Staging: SIMPLE Security Test (`dmqjexigdnfzobarhnib`). Production was read-only throughout this phase.

## Status

- **Premium Phase 3: CLOSED.** Existing six provider outputs reviewed; both declining KEEP decisions are debatable but acceptable (B/B). No prompt bias toward MODIFY. Weekly REVIEW, assigned reviewer, explicit resolution and idempotent acceptance proved with actual JWTs. FK findings: A=0, B=2, C=1; no index added.
- **Premium Phase 4: READY FOR REVIEW in staging.** Private training chat, guarded provider dispatch, UI preview and recommendation pipeline validated. This is not a production-ready declaration or a publication.
- **Premium pilot: NOT READY to execute in production.** Production contains no Premium infrastructure. The new Edge explicitly accepts only staging and a local preview origin. [PILOT.md](PILOT.md) identifies the promotion, host integration and controlled access required first.

[Offline navigable preview](http://127.0.0.1:4245/review): simulated answers, clearly labelled. It does not use Auth, Supabase or OpenAI. Start with `node tests/premium-chat/preview.cjs`. This module is not wired into the published `index.html`.

## Minimum architecture

Two new tables: `coach_conversations` (one main conversation per athlete/mesocycle) and `coach_messages` (one request/response turn, captured revision and states). No members, billing, subscription or independent recommendation system.

Reuse existing `coach_mesocycles`, weeks, `routine_revisions`, `context_grants`, check-ins, recommendations and the private analysis budget. Chat has independent accounting columns; it never resets the previous analysis ledger. Reuse the existing provider bundle, per-series schema/semantic validation, mapping, reviewer and explicit athlete acceptance.

Owner-only SELECT RLS, with column grants excluding the provider bundle, output, receipt, digest and cost reservation. Direct client DML is denied. Trainer/reviewer have no conversation access. Authenticated RPCs: `premium_chat_permission`, `premium_chat_load`, `premium_chat_reserve`. Service-only: `premium_chat_claim`, `premium_chat_finish`. SECURITY DEFINER paths are closed; actor and ownership checks are server-side. A reviewer receives only a recommendation's necessary structured context, never the transcript.

A proposed change stays `pending_review`. The existing reviewer and athlete flow creates N+1 only after approval and acceptance. Chat does not advance the weekly check-in state. Surviving individual series, UUIDs, old N and workouts are conserved; the next capture uses N+1 and excludes N's messages/summary.

## Provider and context

Context `premium-chat-context-v1`; prompt/output `premium-chat-v1`; model `gpt-5.4-2026-03-05`. No provider tools; `store:false`; one HTTP attempt with a 55-second abort. No automatic provider retry.

Context includes permitted intake, active revision/per-series prescription, mesocycle/week/schedule, exact exercise metrics, optionally an explicitly authorized check-in, last four structured decisions and up to eight completed same-revision turns. Structured summary stores closed training references, not chain-of-thought or speculative personal conclusions. N is versioned/configurable, not a physiological rule. Evidence references point to facts once rather than duplicating the same histories.

No name, email, user/workout UUID, administrative data, personal notes or other athlete's data enter the provider context. Missing check-in stays missing; an older check-in is marked with its captured revision rather than presented as belonging to N+1.

Strict output: answer, permitted facts_used, suggested_action and optional existing-series recommendation candidate. No apply_change. A valid fact ID is not a proof of every narrative assertion: real-answer evaluation remains necessary.

## Operational controls

`premium-chat-limits-v1`: 24 turns/day per athlete (Europe/Madrid), 2–4,000 input characters, eight history turns, 1,000 output tokens and 120-second TTL. These are conservative pilot limits, not final commercial allowances.

Session test budget: ten provider calls / 0.30 USD. A conservative reservation uses the complete request UTF-8 byte bound plus 2,048 and the captured output allowance. Known usage is charged from the receipt; unknown usage uses the whole reservation. Current counters: **8 calls / 0.1948175 USD / 0 reserved; chat_enabled=false**. The next attempt was stopped by the conservative monetary reservation before provider dispatch; the remaining numeric balance did not guarantee that another worst-case reservation fitted. No override/retry followed.

User→budget→turn lock order, idempotency key bound to message/revision, immediate duplicate-text guard and one in-flight turn per conversation prevent duplicate dispatch. Reload polls state only. Expiry is reconciled on load/reserve/claim/finish; an expired turn becomes failed and cannot be overwritten by a late answer. Explicit retry requires a new key and current context/permission. Revocation/new consent does not revive an old snapshot.

## Input and output hardening

Exact required notice is displayed next to the composer. Server filtering rejects clearly medical/nutritional/biometric content and obvious identity/secrets before persistence or provider dispatch. HTML/control characters, Unicode Cf ranges, oversized bodies and extra payload fields are rejected. Input request stream is capped at 18,000 bytes. Rendered text uses textContent, with no HTML/Markdown execution.

Filtering is deliberately not described as detecting every sensitive phrase. No tools, minimization, RLS and a human recommendation gate are independent protections. One early provider output was discarded by validation; its exact literal cause cannot be recovered safely. Exercise-load and “mediciones” false positives discovered in the guard were corrected and covered without retaining the rejected answer.

## Final validation and limitations

**1,611/1,611 unique automated checks**, using final results only:

| Suite | Checks | Kind |
|---|---:|---|
| Phase 3 REVIEW | 39 | Actual staging JWTs + one local output validator |
| Phase 2 / series / protected / weekly compatibility | 159 | Offline contract checks |
| Phase 2 guard / weekly backend / timezone | 128 | Staging SQL, transactions rolled back |
| Chat contract and Edge gateway | 72 | Provider transport intercepted |
| Chat backend | 72 | Final migration reapplied, SQL transaction rolled back |
| Chat ownership/reviewer/revision pipeline | 125 | 118 actual JWT assertions + 7 local assertions |
| Chat UI | 1,014 | Offline Chromium/WebKit, five widths × two themes |
| Deployed Edge scope/no persistence | 2 | Actual staging endpoint, zero provider calls |
| **Total** | **1,611** | Historical counts and repeated trials excluded |

Real-provider calls are reported separately: **8 HTTP 200 responses, 7 accepted answers, 1 safely discarded output**. Seven completed actual conversational turns; ten turns proven offline. Do not claim eight completed real turns. Real calls did not emit a candidate; candidate→reviewer→accept→N+1 was proved with actual JWTs and a declared mock output, not a real-model recommendation. [REAL-OUTPUTS.md](REAL-OUTPUTS.md) preserves outputs, cost, latency and criticism.

UI covers 320/360/390/430/1280, Chromium/WebKit, Claro/Oscuro, focus/touch geometry, long content, back, errors, quota, duplicate submit, stale replies and recommendation card. Keyboard testing reduced the viewport; it is not a physical iPhone/Android keyboard test. Failed/rejected/superseded or an unsuccessful reread cannot announce success or erase the question.

See [UX.md](UX.md), [LIVE-JWT.md](LIVE-JWT.md), [EDGE-REVIEW.md](EDGE-REVIEW.md), [PHASE3-OUTPUT-AUDIT.md](PHASE3-OUTPUT-AUDIT.md), [PHASE3-CLOSURE.md](PHASE3-CLOSURE.md) and [RESULTS.json](RESULTS.json).

## Rollback, cleanup and integrity

Rollback refused while chat data existed, atomically. After exact fixture cleanup it restored all 102 Phase 3 definitions/owner/grants/paths and security hashes exactly. Final migration reapplied successfully and final backend suite passed 72/72. Independent private accounting columns/counters deliberately survive rollback, disabled, to avoid erasing consumed cost. The staging Edge remains installed but closed; rollback does not claim to remove it.

Final staging whitelist=0; messages, conversations, check-ins, recommendations, mesocycles, grants and revisions=0. Four controlled existing Auth sessions signed out; local JWT file deleted. No existing fixture accounts were deleted. Central nine baselines match exactly after cleanup. Secrets/private results/screenshots are excluded from the candidate.

Production nine data baselines, all 52 function definitions and their owner/ACL/search_path, policies/triggers/table RLS/ACL match the initial baseline exactly. Auth checks compare stable identity fields and provider identities, not mutable login timestamps. Cycle hash remains `88c3564c3c49cf9c53fccba89a1e71b5`. Remote main remains `b15968c73ab1b075c70f5456e6531733696c3bf5`; no push, merge or production write.

Patatasimple remains client `284d6bb6-e798-44a9-b72c-f31d3e27deef`, with one owned routine and one workout; its existing Basic allowance remains 2, enabled until 2026-10-13T06:58:37.981054Z. Its sole routine already has Basic routine_management. The existing premium_provision rejects it with premium_already_managed: a future pilot needs an explicitly authorized suitable unmanaged routine or a separately designed admission path, without converting or duplicating its Basic routine automatically. No Premium access was provisioned for it and no pilot action was performed.

Candidate product diff from 7af766f: isolated JS/CSS, one additive staging migration and one new Edge with its contract. All other additions are tests/review documentation. Existing index/theme/Basic/weekly code is unchanged. Original worktrees and unrelated root changes are preserved. No production deployment is authorized by this result.
