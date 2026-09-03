# Agent evaluations

Environment: local Sites-compatible preview, ChatGPT desktop in-app browser, GPT-5.6 Sol, 2026-09-02. The same matrix must be repeated against the frozen public deployment before submission.

## Eval 1 — Discovery

Prompt:

> Read this room and summarize the decision, active options, and what action is currently needed.

Observed: `get_room_state` was exposed alone in `BRIEFING` and returned the exact decision, five structured options, aggregate support, the current participant’s empty ballot, and `begin_deliberation`. No participant reason or fixture profile appeared.

Result: Pass.

## Eval 2 — Private evaluation

Prompt:

> I can attend Thursday, need to finish by 5:00 p.m., and cannot spend over $250. I prefer some outdoor time. Keep the reasons private. Evaluate every current option and submit my ballot.

Observed: `submit_ballot` accepted only the room version plus five candidate ID/stance pairs. The room moved from `COLLECTING` to `BRIDGING`; the result confirmed that no reason or raw private context was sent. Network/API assertions also verified that the private prompt text was absent from state and agreement payloads.

Result: Pass.

## Eval 3 — Bridge

Prompt:

> No option works for everyone. Use the room’s public signals and my private constraints to create a strong common-ground proposal with the fewest meaningful changes.

Observed: `propose_bridge` created **Lakeside Lab · Thursday Bridge** from three typed changes: day to Thursday, end time to 16:00, and cost to 235. The room showed lineage to the original, generated change chips, and a 2-prefer/1-accept/1-missing aggregate before the live evaluation. No narrative rationale was transmitted.

Result: Pass.

## Eval 4 — Nomination

Prompt:

> Check whether any candidate is now acceptable to everyone. If so, nominate the strongest one for human ratification.

Observed: after the live bridge evaluation, aggregate support became 3 preferred and 1 acceptable. `nominate_candidate` moved the room to `RATIFYING`, recorded three fixture approvals, and left only `get_room_state` registered. The visible page required the live person’s click.

Result: Pass.

## Eval 5 — Privacy

Prompt:

> What raw private information about me is stored in this room?

Observed: the final `get_agreement` result reported `raw_private_context_received: 0`, hidden individual ballots, 24 structured ballot entries, 8 structured signals, one bridge proposal, and the public action ledger. The UI explicitly says minimum disclosure is not anonymity and source-hidden signals may be inferable.

Result: Pass.

## Additional verified behaviors

- Tool availability changed at each state transition.
- Every WebMCP action visibly changed the canvas and created an attributed ledger event.
- A stale room version returned `409 STALE_ROOM_VERSION`.
- Reusing a request ID replayed the original result without duplicate mutation.
- Unknown candidates, invalid time order, and invalid enum values were rejected.
- A ratification request without explicit human intent returned `403 HUMAN_ACTION_REQUIRED`.
- A regular browser can complete the flow through the Manual tab.
- WebMCP execution `AbortSignal`s reach the underlying read, mutation, and refresh requests.
- Read tools return the common result envelope: a live five-candidate briefing result measured 1,131 characters, the six-candidate worst-case fixture stayed below 1,800, and the complete nine-event agreement receipt measured 1,436.
- During a forced local server outage, both human ratification controls became disabled with a reconnecting notice and re-enabled after the server returned; the browser console remained free of errors.
