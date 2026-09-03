# WebMCP protocol

UNSAID uses top-level imperative registration through `document.modelContext.registerTool`. Tools are registered and unregistered as the room phase changes. They call the same authenticated, server-authoritative operations as the manual interface.

## Phase matrix

| Phase | Registered tools | Valid server action |
| --- | --- | --- |
| `BRIEFING` | `get_room_state` | Human UI begins deliberation |
| `COLLECTING` | `get_room_state`, `submit_ballot` | Complete ballot for all originals |
| `BRIDGING` | `get_room_state`, `submit_ballot`, `publish_signal`, `propose_bridge` | Evaluate bridges or construct one |
| `READY_TO_NOMINATE` | `get_room_state`, `submit_ballot`, `nominate_candidate` | Nominate a viable candidate |
| `RATIFYING` | `get_room_state` | Human UI ratifies or declines |
| `AGREED` | `get_agreement` | Read the immutable result |

## Shared conventions

- Every write includes the latest `room_version`.
- The browser wrapper generates an internal request ID for idempotent retry.
- A repeated identical signal, bridge proposal, or active nomination is naturally
  idempotent even when a client retries with a fresh request ID and the operation's
  now-stale version. The server returns current success without another mutation.
- Inputs reject unknown properties.
- IDs and structured values are length- and type-bounded.
- Tool results report `ok`, `room_version`, `summary`, visible `public_effect`, privacy notes, and valid next actions.
- Read tools use the same result envelope as writes. Candidate rows are column-labeled to preserve every decision attribute and aggregate without returning the full page payload.
- State-reading tools carry `untrustedContentHint`.
- There is no ratification tool.

## Schemas

### `get_room_state`

Input: empty object.

Returns the decision, phase, version, active candidate attributes and aggregates, public signals, the current participant’s own ballot, a privacy statement, and available actions. It omits other individual ballots and all fixture profiles.

### `submit_ballot`

```json
{
  "room_version": 2,
  "evaluations": [
    { "candidate_id": "museum-sprint", "stance": "preferred" }
  ]
}
```

Allowed stances are `preferred`, `acceptable`, and `unacceptable`. The first live ballot must cover every original candidate; later ballots may evaluate bridge candidates only.

### `publish_signal`

```json
{
  "room_version": 3,
  "field": "end_time",
  "operator": "at_or_before",
  "value": "17:00",
  "visibility": "source_hidden"
}
```

The server validates each field/operator/value combination and collapses identical signals from the same participant.

### `propose_bridge`

```json
{
  "room_version": 3,
  "base_candidate_id": "lakeside-lab",
  "changes": [
    { "field": "day", "value": "Thursday" },
    { "field": "end_time", "value": "16:00" },
    { "field": "cost_per_person", "value": 235 }
  ]
}
```

The server rejects narrative payloads, markup, duplicate or unchanged fields, invalid enum values, invalid time order, out-of-range numbers, and duplicate proposals. It generates the public title and change summary.

### `nominate_candidate`

```json
{
  "room_version": 6,
  "candidate_id": "lakeside-lab-bridge-7lv5xt"
}
```

The server independently verifies viability, locks the candidate, records demo-agent ratifications, and moves the room to `RATIFYING`. The result explicitly says the live human’s approval is still required.

### `get_agreement`

Input: empty object.

Returns the completed candidate, final room version, public audit ledger, and minimum-disclosure accounting.

## Failure behavior

- Stale versions return a retryable `409 STALE_ROOM_VERSION` with the current version.
- Wrong-phase operations return a clear phase error.
- Validation failures return bounded `422` errors.
- Cross-origin mutations return `403 CROSS_ORIGIN_REQUEST`.
- Ratification without the visible interface’s human-intent header returns `403 HUMAN_ACTION_REQUIRED`.
- Human decline clears and unlocks the current nomination, returns the room to
  `BRIDGING`, and leaves the candidate available for later evaluation and renomination.
- Polling pauses while the document is hidden and backs off to 15 seconds after network failures.
- Both ratification controls remain disabled while the room is reconnecting and re-enable only after a successful state refresh.
