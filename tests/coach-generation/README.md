# Second independent Basic generation

Base: published `c68b5c3f` (tree identical to approved `90012ba`).

The previous lifetime-wide partial index, reservation shortcut and access calculation
all prevented a second generation. Acceptance itself already creates a separate routine.

## Server contract

- Private pilot configuration accepts `generation_limit` 1 or 2, default 1; invalid values deny new roots.
- An independent generation is a root operation (`retry_source IS NULL`). Its UUID is its generation key.
- Every root consumes one authorization, including a failed root. Consumption is never reset.
- Existing reviewed retries stay explicit children, share that generation and do not grant another root.
- At most one reserved/pending/ready operation per user; at most one root per user/intake.
- Existing idempotency and retry-source uniqueness, owner lock, one routine/revision/management per operation remain.
- A new root requires the previous attempt to be accepted and a new Basic v2 intake.
- Accepted operations, intake snapshots, routines, revisions and workouts are not rewritten.
- The legacy `routine_id` scalar remains the first accepted routine. `accepted_routines` enumerates explicit choices;
  the existing athlete home already lists every managed routine. There is no automatic active-routine replacement.

Only three public RPCs change: access, reserve and reviewer-authorized retry. A private limit helper is added.
No new tables, columns, RLS policies, Auth configuration, Edge implementation or programming rules.

## Tests

`live.cjs` uses existing controlled staging accounts supplied through an ignored private manifest.
Mock tests exercise real JWTs, reservations, RLS, reviewer actions, acceptance, concurrency and immutable hashes.
The `real` mode has a durable one-dispatch marker and can call only the staging Edge; it cannot approve/accept.
`ui.cjs`: isolated offline preview, Chromium/WebKit, 320/360/390/430/1280, light/dark, fresh v2 questionnaire,
duplicate click, late response after close, pending reopening and explicit choices between accepted routines.
`contracts.cjs` compares Auth, model, questionnaire, training, reviewer and acceptance code against published base.
These UI/SDK mocks do not represent a new real Google consent or password recovery email test.

Rollback refuses if multiple independent generations already exist; it never deletes them to fit the old schema.
The rollback was rehearsed only in staging after exact fixture cleanup, then the candidate was reapplied.
Canonical SQL has equivalent definitions after CRLF normalization; the ignored production backup retains exact definitions.
All diagnostic output, session tokens, receipts, generated SQL fixtures and screenshots stay in ignored private/results.
