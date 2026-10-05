# Premium Chat: server context and accounting

The staging RPC captures `premium-chat-context-v1` for one turn before provider dispatch. The existing `premium_bundle` remains the single source of training facts, per-series prescriptions and exact-identity exposures. It is not reconstructed from messages or a free-text summary.

`evidence` is a bounded registry of server-defined references. IDs used in `facts_used` are unchanged; the `value` object points to data already present in the same captured context instead of duplicating those data:

| Evidence ID | Closed value |
| --- | --- |
| `intake` | `{ "source": "training.intake" }` |
| `schedule` | `{ "source": "week_schedule" }` |
| `checkin` | `{ "source": "checkin" }`, only when separately authorized and submitted |
| `exercise_N.prescription` | `{ "source": "training.routine.exercises", "exercise_ref": "exercise_N", "kind": "prescription" }` |
| `exercise_N.metric` | `{ "source": "training.routine.exercises", "exercise_ref": "exercise_N", "kind": "metric" }` |
| `decision_N` | `{ "source": "recent_decisions", "index": N-1 }` (zero-based position in this captured array) |

`prescription` identifies that exact exercise's catalogue, day, `planned_sets` and prescription format. `metric` identifies its metrics and exposures. No UUID, database query, external URL or executable path is sent through these references. SQL validates every returned evidence ID against the captured registry. The existing series validator reads the factual values directly from `training` and preserves the current prescription model.

The compact registry changes only newly captured contexts. Previously persisted turn snapshots, including failed turns, are not rewritten. `last_messages` remains bounded by the private configuration (default eight) and restricted to the current revision. Summary references are discarded from provider context when their captured revision differs from the active revision.

Dispatch reserves a conservative cost using the entire request's UTF-8 byte bound plus server-side output allowance. The claim captures `input_bound`, `output_bound` and expiration, so later configuration edits cannot retroactively change receipt validation or that turn's timeout. Known token usage is charged using the captured bounds; unknown usage charges the full reservation. Closing a budget-exhausted turn consumes no new provider call or cost and requires an explicit new key for a manual retry. The separate previous analysis ledger is never reset or charged by chat.

Rejected output is discarded. A closed `receipt.validation_stage` enum (`schema`, `answer_text`, `evidence`, `action`, `candidate_text`, `candidate_mapping`) aids diagnosis without storing rejected answer text, exception messages or credentials.
