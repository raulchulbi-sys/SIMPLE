# Replacement before/after correction — staging candidate only

The real v1.2 canary exposed a display defect: the adapter used the replacement's planned sets for both columns. The stored replacement and original revision remain distinct; this is not evidence of changed historical data.

`before-projection.sql` changes only the existing authorized recommendation read projection in staging. After its existing ownership/reviewer checks, each affected replacement includes `before_prescription`: name, scheme and exact normalized series from that recommendation's base revision and target UUID. It does not grant private revision access or expose notes, full snapshots, intake or transcripts. Stored patches and recommendations are untouched. Other patch kinds retain their existing projection.

The adapter consumes that scoped projection. If unavailable, it explicitly says the old prescription is unavailable, rather than using the replacement or the current program as historical evidence. The proposed replacement remains unchanged.

Validation on this candidate:
- 30 SQL checks, including the seven new before-projection checks; controlled staging transaction rolled back.
- 25 replacement policy/contract checks, offline provider interception only.
- 16 existing reviewer adapter checks, offline SDK.
- 8 focused before-adapter assertions.
- 8 rendering scenarios: Chromium/WebKit, athlete/reviewer, light/dark, mobile/desktop.
- Captured rollback restores the exact staging function definition in a rolled-back rehearsal.
- Eight central staging table fingerprints unchanged after fixtures were rolled back. Owner, grants, SECURITY DEFINER and search_path unchanged; no RLS changes.

These are not renewed JWT tests and do not prove financial concurrency. No new OpenAI call is part of these tests. Generated samples, screenshots and diagnostic reports remain ignored.

Production is intentionally not promoted. The real MODIFY recommendation remains pending_review; no approval, acceptance, R2 or workout is performed while the published comparison is misleading. A coordinated authorized promotion of this frontend and the read projection is still required before resuming that canary.
