# Cycle ocean color

Base: published `06736a417463bfa69a402725d5697013be72fc9e`.

Only cycle fills change: `--simple-cycle-fill` is `#2f6f89` in light and `#71b7d1` in dark. `--simple-cycle-track` uses the existing neutral stone token. The filled and completed segments share the same rule. Dimensions, layout, success colors, chart colors and all JavaScript stay unchanged.

Existing bars are used in assigned athlete routines and own routines. Trainer client overview/profile currently use numbers and completion text, not a bar; no new bars are added there.

`node tests/cycle-ocean/browser.cjs` uses the isolated preview at port 4187. It checks Chromium/WebKit, client/trainer, 320/360/390/430/1280, empty/partial/complete, both themes, exact fill/track colors, stable dimensions/state, unchanged success/chart tokens and no new overview bars. It also compares the entire HTML/JavaScript with the published base. Results and screenshots are ignored.

For public-asset verification, set `SIMPLE_PUBLIC_URL=https://raulchulbi-sys.github.io/SIMPLE/`; the test replaces the SDK with the local mock and blocks remote mutations. `OCEAN_WIDTHS=390,1280` narrows the post-deploy check. This is not authenticated production or physical-device testing.

Historical review is read-only, using a private fresh snapshot. Previously confirmed PUSH aliases retain their observations. No new aliases or historical writes are part of this candidate; proposed mappings and personal data remain outside Git. The current-template-only exercise selector is preserved. Existing contracts and progress-cycle browser/interactions suites cover identity, stale responses, midnight, drafts, ordering and rest behavior. No RPC or Supabase setting is changed.
