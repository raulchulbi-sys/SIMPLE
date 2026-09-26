# Previous-session presentation and routine isolation

Base: published `a5d97e83670066251ef86450293d1f8dd4832f8d`.

Product changes are limited to wrapping previous sets without an inner scroll area and removing its unnecessary keyboard stop. No selection, save, identity, history, assignment, Auth or RPC implementation changes.

## Reproduction

Start `tests/interior/preview.cjs` with `INTERIOR_PORT=4188`.

- `SIMPLE_PREVIEW_URL=http://127.0.0.1:4188/ node tests/compact/browser.cjs`: 110 cases across Chromium/WebKit, athlete/trainer, light/dark, 320/360/390/430/1280. Checks complete sets, zero/empty values, contrast, preserved state, themes and no remote writes.
- `node tests/session-isolation/browser.cjs`: 24 cases, Chromium/WebKit at 390/1280. Same-owner routines with homonymous exercises; exact save payloads; client assignment; stale field event, load and save; unchanged other exercises/history/notes/assignments. Uses the real frontend and a local SDK double.
- `staging.sql`: 12 checks of installed production-equivalent save RPCs. Run ONLY in SIMPLE Security Test. Creates random synthetic identities inside one transaction, sets the authenticated database role and subject, tests field patches, structural add/remove, foreign UUID rejection, stale expected values, owner restrictions and the bounded correction, then ROLLBACK. This is a database-role test, not a JWT/HTTP login. All staging fingerprints matched afterward.
- `tests/session-edit/contracts.cjs`: 40 passed.
- `tests/identity/protected.cjs`: 16 passed; persistence methods unchanged.
- Current `tests/progress-cycle/interactions.cjs`: 12 passed against port 4188 (only the runner URL overridden), including real pointer reorder, scrolling, stale client responses and paginated charts.

## Broader regression execution and limitations

The existing session-edit runner was also executed. Thirteen suites passed (456 cases): duration 30, concurrency 33, navigation/history 26, historical identity 19, drafts 7, robustness 26, features 105, trainer structure 92, unified editor 34, duration entry 8, training modes 16, training flash 10, general browser 50.

The phase-3 browser suite passed 123/124 on its first run. One CDP touch case timed out. The four unchanged touch cases were rerun alone at 320/360/390/430 and passed 4/4; count the suite as 124 distinct cases, not 128. First-run evidence is retained locally.

Two archived suites are excluded from the passing total, not reported as green:

- Archived `test.cjs`: 36/40, with identical four failures against published main. It uses the old routine reorder interaction and does not load the later reorder asset. The current interaction suite passes.
- Archived phase-2 chart suite: timed out; its old SDK double lacks `.range()`. A focused run against published main confirms `TypeError: query.range is not a function`. Current pagination/chart interactions pass. No product or assertion changes were made to conceal these failures.

Total relevant distinct cases passing, including the isolated touch retry: **794**. Diagnostic baseline runs and repeated cases are not added. This does not certify iPhone hardware or a real authenticated production session.

## Authorized data correction

A separate, explicitly authorized correction restores three fields of one existing exercise in the client's assigned routine. Its existing UUID also identifies the hyperextension in earlier workouts; no alias or identity rewrite was necessary. Historical workouts remain untouched, including their original labels. The other routine and all other exercise rows are byte-identical. No schema, RPC, policy, RLS, Auth or OAuth changes.

The original cause of the old rename cannot be established from the available snapshots; the present save paths correctly scope routine/day/exercise UUIDs. Do not claim an unproven cross-routine bug was fixed.

Private evidence, row backup and guarded rollback live in ignored `tests/session-edit/results/`. No real records or correction SQL are included in this public test directory. Browser screenshots are in ignored `tests/compact/results/`.
