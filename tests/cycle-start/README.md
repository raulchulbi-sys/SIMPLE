# Routine-cycle start correction — local candidate

The current rolling cycle restarts when any already-counted session is repeated.
If a partial cycle restarted with a middle session, returning to the routine's
initial session could incorrectly extend that partial cycle instead of starting
a new turn. This candidate adds that initial-session restart and preserves the
existing repeated-session behavior.

The start is the **UUID of the first session in the current effective order**:

- Template/ordinary routine: `day_order`, then `created_at`, then UUID. The live
  `routine_days` schema was inspected and contains those columns.
- Client customization: JSON `day_order`, then array ordinal, then UUID.

Renaming never changes identity. Reordering intentionally changes which session
starts a turn, so recalculating historical progress can reflect the new order.
This is not a calendar-week reset and does not infer weekdays from labels.

## Scope

`candidate.sql` replaces only the three existing cycle RPC definitions:

| Function | Current MD5 | Candidate MD5 |
| --- | --- | --- |
| `get_client_routine_cycle_progress(uuid,uuid)` | `88c3564c3c49cf9c53fccba89a1e71b5` | `2a8197e876ca69d5bb54124f40c06107` |
| `get_client_routine_stage_cycle_progress(uuid,uuid)` | `33b792eb30c3303822c425b78c188af8` | `5c6c56ae1ca187aefb37891e8664b9fb` |
| `get_client_custom_routine_cycle_progress(uuid,uuid)` | `0199a244143ccbf520a301a3f55f1bde` | `a936e5595f93366d74d41dcdbe0b6ea7` |

Each body gains one start-UUID variable, an ordered start lookup and the expanded
restart condition. Authorization checks, historical aliases, stage filtering,
client-specific structure selection and completion-day precedence are unchanged.
Completing a cycle today still displays full progress for that date in
`Europe/Madrid`; the next date starts at zero unless another workout exists.

No table, stored workout, note, exercise, assignment, role, RLS policy, grant,
owner or `search_path` changes. No schema migration is applied. Both scripts
are one transaction with before/after checks of function MD5, owner, ACL,
`SECURITY DEFINER` and configuration. Unexpected state aborts the transaction.
`rollback.sql` restores the exact previous definitions under inverse guards.
SQL files keep LF line endings, including on Windows, so guarded definition
hashes remain reproducible after checkout.

## Validation

```text
node tests/cycle-start/unit.cjs
```

31 offline checks: 26 synthetic behavior cases and five source/rollback contracts.
They cover the reported sequence, normal progression, repeated non-initial days,
completion today/yesterday, same-day workouts, midnight, unique/ambiguous legacy
names, exact UUIDs, scoped aliases, renaming/reordering, stages and overrides.
The contract checks prove that removing the three intended changes reproduces
each original function body exactly.

`read-only-regression.sql` contains only a SELECT over synthetic VALUES. Its 14
PostgreSQL scenarios passed; these overlap the offline scenarios and are an
additional implementation cross-check, **not 14 additional unique product cases**.

A separate ignored, scoped SELECT replay over the existing affected history
resolved all 33 UUIDs and produced the requested `1/5` with the proposed loop.
The query/result, original diagnosis and original definitions are under
`private/`, which is excluded by the repository's existing ignore rule.

**Limits:** The candidate PL/pgSQL definitions have not been created or invoked
in staging or production. There is no authenticated JWT/backend acceptance test
for the candidate yet. The SELECT replays are not substitutes for those checks.
No production or staging DDL/DML, Auth changes or OpenAI calls were performed.

Publication/backend promotion requires its own authorization. Do not execute
either SQL file merely to inspect it.
