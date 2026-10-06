# Premium Chat: public decision explanation

Bug: successful analysis stores public reason/interpretation, but premium_chat_bundle omitted both from recent_decisions. The unchanged Chat prompt correctly refused to invent a missing reason.

Only product change: coach_private.premium_chat_bundle(uuid,uuid,uuid,text), via migration 20261006061247_coach_premium_chat_decision_explanation.sql.
- Add reason and interpretation only from finished, successful structured provider output with a supported response schema.
- Each string is bounded to the existing 1–800 characters and checked by the existing premium_chat_safe_output filter. Invalid/unsafe/oversized values become null; valid text is never truncated.
- original_kind preserves the original analysis kind when a human resolution changes the current kind.
- Include superseded history with its actual state. Nothing marks it as current or applied.
- Preserve existing owner/mesocycle/weekly-consent filters and closed changes/evidence projection.
- No review_reason, private reviewer comments, notes, identity, raw trace or provider payload is projected.
- No schema, policy, grant, owner, Auth, Edge, asset, prompt or UI change.
- Versions remain premium-chat-context-v1 / premium-chat-v1. Fields are an additive compatible extension.
- Existing facts remain in the closed training/evidence contract; this fix does not duplicate historical observations or reinterpret them as current measurements.

Staging final unique checks (399 passed):
- backend.sql: 22 actual database projection/RPC checks (A–H, accepted/rejected, boundaries, failed outputs, consent, access and R1).
- contract.cjs: 23 checks using actual staging projections and intercepted provider transport; four requested questions use explicitly mocked answers, not live AI.
- ../premium-chat/contract.cjs: 72 contract/gateway checks, intercepted transport.
- ../premium-chat/backend.sql: 72 SQL lifecycle checks, claim/finish mocked, transaction rolled back.
- ../premium-weekly/weekly-unit.cjs: 76 contract/gateway checks, intercepted transport.
- ../premium-series/unit.cjs: 34 per-series checks.
- ../premium-distribution/unit.cjs: 38 contract checks.
- ../premium-distribution/backend.sql: 26 transactional pipeline/reviewer/acceptance/stale checks.
- ../premium-upgrade/backend.sql: 36 transactional compatibility/identity/Basic/admission checks, with existing synthetic actor settings.

backend.sql needs staging synthetic owner 495fa022-d51b-4bdd-a2f8-e031409b69f5, other c14a2a6d-9853-431d-856c-4d742002187e and a synthetic trainer. Assertions emulate SQL JWT claims and authenticated role; they are not signed JWT browser sessions. All fixture mutations end in ROLLBACK. The older Chat suite fixture is updated only to satisfy current entitlement/admission/shared-dispatch gates; no HTTP provider call is made.

Save backend.sql's result into ignored results/backend.json before running node tests/premium-chat-context/contract.cjs. Results/ and private/ are excluded from Git.

Staging rollback was exercised: exact previous definition, owner, ACL, search_path and timezone restored, then exact candidate reinstated.
Previous bundle definition MD5: 169b6cf53f54992b03fcc2902826b493
Candidate bundle definition MD5: 497fff05253934afd32b4999985e750c
Rollback: rollback.sql restores only the previous function, leaving all user data and existing records intact.

Production plan: recheck previous definition and baseline integrity; apply only the validated migration; recheck definition and unchanged metadata/data/functions except this bundle. Publish an exact matching Git tree. Perform at most one authorized real Chat turn, preserve the existing pending REVIEW, R1 and four workouts. No new weekly analysis, resolution, acceptance or workout.
