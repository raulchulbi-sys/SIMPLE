# Coach pilot v2 — Edge contract

The production files changed are `contract.mjs` and `provider.mjs`. The HTTP handler, default model (`gpt-5.4-2026-03-05`), `basic-initial-v2` system prompt and output schema version 1 remain unchanged.

The provider receives a positive construction with exactly two top-level data keys:

```json
{
  "training": {
    "goal": "Fuerza general",
    "experience": "beginner",
    "days": 3,
    "minutes": 60,
    "equipment": ["Gimnasio"],
    "preferred": "",
    "avoided": "",
    "preferences": ""
  },
  "allowed_exercises": ["backend catalogue entries: name, equipment, group"]
}
```

`allowed_exercises` is an array of the existing catalogue objects, filtered by selected equipment and exact avoided exercise names. It is not supplied by a participant. No health object is read or serialized. Account identifiers, other intake fields and arbitrary extra properties never enter this projection.

There is no general free-text field in this pilot. Goal, experience, minutes and equipment are exact closed options; preferred/avoided are empty strings or exact catalogue choices joined with `, `. The retained `preferences` storage field must be empty. Contradictory selections, missing movement groups and preferred exercises requiring unavailable equipment are rejected before an upstream request. These checks assess training feasibility, not medical eligibility; lack of health data is not medical clearance.

Each reserved operation makes at most **one** provider HTTP request. HTTP 429/5xx, network uncertainty, invalid output and timeout do not automatically issue a second request. A new logical attempt requires the existing reviewer authorization. A late response cannot become a proposal after the deadline. No model tools are configured; unexpected tool-call output is rejected, never executed.

The historical system prompt still uses the wording “piloto sintético” and refers to a mild limitation. Its text is deliberately preserved rather than silently modifying an already versioned prompt; neither phrase adds health input or removes human review.

## Local checks

Run from the worktree root with Node 24 (TypeScript stripping is used only for the handler test):

```text
node tests/coach-ai/unit.mjs
node tests/coach-pilot-v2/edge.mjs
node tests/coach-pilot-v2/edge-http.mjs
```

Results at implementation: 62 + 60 + 20 = **142** distinct checks. All transport responses in these suites are synthetic. The ten quality cases validate contract/rubric behavior using fabricated proposals; they are not evidence of ten real model generations. Actual model-quality results and real JWT checks belong to the separately executed staging harness.

Covered: six prompt-injection inputs, identifying/health prose, forbidden extra fields, malformed selections, all selected preferences, equipment and duration limits, day bounds, schema failures, refused/incomplete/invalid responses, network error, HTTP 4xx/5xx, late timeout response, no hidden retries, CORS and verified-user boundary, idempotent replay, failed concurrent claim, private context stripping and uncertain final receipt handling. The prompt hash is compared with the published baseline.

Outputs go to ignored `results/`. No credentials, fixtures or generated result files are intended for publication.
