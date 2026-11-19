# Premium initial reviewer security — local only

Current candidate (04/11/2026): **91 distinct PostgreSQL cases passed**, 23 new.
Full run 90/90, then targeted 5/5 (four repeated, one new); do not report 95.
The two expiry/error regressions failed on 6bb4596 before the fix. Error-boundary
tests distinguish real validators with controlled delays from explicit fault
injection. Unknown programming failures remain visible. See
`docs/commercial/PREMIUM-ERROR-BOUNDARY-20261104.md` for hashes and limits.

Run from the isolated candidate worktree with Node 24 and an existing PostgreSQL
17 installation. No package downloads, credentials or remote services are needed.

```powershell
$env:SIMPLE_POSTGRES_BIN = 'C:/path/to/postgresql/bin'
node scripts/premium-review-postgres.cjs
```

The runner creates its own cluster under ignored `.tests-local`, binds only to
127.0.0.1:55451 and uses the new `simple_premium_review_local` database. Before
fixture writes it verifies host, port, role, database, marker and data directory.
Inherited PG connection settings are removed. It never connects to an existing
remote or staging database. Its own cluster stops in `finally`; files and TAP
remain ignored for inspection. A busy port is a failure, not permission to reuse
or stop another server.

The schema is a minimal synthetic dependency model, not a complete Supabase
replica. Roles and `auth.uid()` use SQL claims, **not real JWTs**. Owner RLS and
function ACLs are exercised in PostgreSQL. Security helpers, catalogue, V5 and
Premium validators, locks, assertion and projection are extracted from the
versioned migrations and executed. Only the local reviewer configuration is
represented by a table so tests can revoke and expire it safely.

No generation, acceptance, workouts, provider calls or financial operations occur.
The synthetic proposal is derived offline from the versioned Premium cases.
The original vulnerable writer is loaded only into this disposable cluster to
reproduce the error discrepancy. It is never a rollback candidate for a server.

Coverage includes existing/missing/NULL identifiers, actor and owner isolation,
closed switch, historical states, entitlement/version/reviewer, two consents,
intake drift, human decisions, idempotency, safe projection and row/advisory
locks. Concurrent revocations and expirations use observed `pg_stat_activity`
barriers. Additional fault injection checks only the assertion boundary and a
slow wrapper around the real validator; these are explicitly controlled tests.

The narrow fallback disables only this writer. Its test preserves all other
function definitions, OIDs, owners, ACLs, table RLS/policies and fixture data,
then reapplies the candidate and verifies the exact original candidate catalogue.

The optional `--test-name-pattern=...` filter requires including `replacement`
to load the patch and `final local closure` to run fixture closure, for example:

```powershell
node scripts/premium-review-postgres.cjs '--test-name-pattern=replacement|hardening extra|expiry during controlled|final local closure'
```

Session result 03/11/2026: 58 initial cases passed, then 12 targeted cases passed,
of which two were repeats and ten were new. **68 distinct cases passed**, not 70.
Results `results/postgres.tap` and `results/filtered.tap` are local ignored files.
This evidence does not certify PostgREST error envelopes, JWTs, remote preimages,
every possible administrative interleaving or constant-time responses.
