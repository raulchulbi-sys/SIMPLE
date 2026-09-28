# SIMPLE regression coverage for Coach v2

All supplemental browser runs use current candidate HTML/assets and existing synthetic fixtures served from `127.0.0.1:4261`. CSP has `connect-src 'none'` and `form-action 'none'`; no Supabase, OAuth or email request can be made. These are not real Google login, recovery-email receipt or physical iPhone checks.

Final supplemental result: **122/122 unique scenarios passed** — interactions 12/12 plus polish 110/110. The synthetic preview server was stopped after completion. The earlier incomplete run and repeated cold-navigation case are not counted again.

## Coverage without repeating completed suites

| Requirement | Existing suite used in this task |
|---|---|
| Email login, role entry, session state | `tests/onboarding/browser.cjs` |
| Recovery accepted/error/limits/double click/navigation | `tests/onboarding/recovery-feedback.cjs`, `recovery-sdk.cjs` |
| Google callback/profile/persistence and button | `tests/interior/oauth-sdk.cjs`, `google-button.cjs` |
| Workouts and edit separation | Archived `test-training-modes`, session-edit contracts |
| Duration, active-workout startup | Archived `26-test-duration`, `test-duration-entry`, `test-training-flash` |
| Drafts and concurrency | Archived `test-session-drafts`, `test-concurrency` |
| Session/history navigation | Archived `test-navigation-history` |
| Codes, assignments through redemption, historical exercise deletion | Archived `23-test-features-browser` |
| Drag/drop routine and day order, pointer cancellation | `tests/progress-cycle/interactions.cjs` |
| Current cycle, Madrid date boundary, two tabs, celebration | `tests/progress-cycle/interactions.cjs` |
| Graph pagination and late cross-client responses | `tests/progress-cycle/interactions.cjs` |
| Claro/Oscuro, settings, keyboard focus, toasts, theme persistence | `tests/polish/browser.cjs` |
| Creating/editing routine and active-workout state during theme change | `tests/polish/browser.cjs` |
| History, graph homonyms/tooltips, trash, empty/error/loading views | `tests/polish/browser.cjs` |
| Storage blocked/system preference migration/theme metadata | `tests/coach-v2/theme-contract.cjs` |

The additional interactions suite has 12 scenarios: six per Chromium/WebKit. Its first cold Chromium page navigation hit the historical eight-second load timeout; no functional assertion had yet run. The other 11 passed. Only that one scenario was rerun with a 30-second navigation allowance and passed. Count 12 unique cases, not 13.

The additional polish suite uses Chromium and WebKit at 320, 360, 390, 430 and 1280 px. Its first attempt timed out globally before the legacy suite wrote a final report; three cold page loads also exceeded its six-second limit. This incomplete run is diagnostic, never included as a completed passing suite. The final run allows 30 seconds for navigation, checkpoints each test, and skips redundant screenshots while keeping every assertion. Operation/action waits remain unchanged.

## Archived fixed-reference contracts

`tests/interior/contracts.cjs` compares against `36dc00f`; `tests/polish/contracts.cjs` compares against `f0a4cfb`. Those references precede approved releases of Google, recovery feedback, cycle and theme changes. The same nine failures occur on the untouched current baseline `df9ac7d` and on this candidate. They do not represent new failures caused by Coach v2, and their expectations were not rewritten.

One of those nine is an obsolete theme DOM mock missing `querySelector`; the focused replacement retains the original functional expectations with the browser metadata API mocked. The other failures are fixed-snapshot assumptions invalidated by later published changes. Ten non-Coach source files were compared directly with `df9ac7d` and are unchanged.

Exact per-suite outcomes and counts are in ignored `results/regressions.json`, `results/general-regressions.json`, `results/polish-rerun.json`, `results/legacy-contract-audit.json`, and the consolidated supplemental report. Repeated attempts are not added to the unique total.
