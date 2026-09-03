# Challenge submission record

## Project

**UNSAID — Private Context, Shared Agreement**

**Tagline:** A minimum-disclosure decision room where personal agents construct common ground and people ratify it.

## Release identifiers

- Live URL: https://unsaid-agreement.kbelcher.chatgpt.site
- Public repository: https://github.com/Crazy-Pyro/unsaid-webmcp
- Demo video: https://youtu.be/2VwElVuBz3k
- Frozen commit: pending
- Site version: 8 (`appgprj_6a98a492a7308191a8921f29804b17da~appgver_7cdbe18e80fc81918f460fdd6c476e06`)
- Release tag: pending

These values are replaced with verified public links and immutable identifiers before submission.

## Short description

UNSAID lets each participant tell their own browser agent the full private context while the shared webpage receives only structured judgments, minimum coordination signals, proposals, and ratifications. In the demo, a live ChatGPT agent evaluates offsite options, discovers that no existing choice works for everyone, and creates a new bridge option through phase-specific WebMCP tools. The page updates visibly as agents act, but a human must ratify the final agreement. UNSAID treats the webpage as a neutral protocol among people and their personal agents, not as a chatbot that owns everyone’s context.

## Full submission description

### Inspiration

Group decisions routinely force people to reveal more than they should. A person may have a strict budget, an accessibility need, a caregiving deadline, or another private reason an option will not work. Polls make the group choose among fixed answers. Meetings make people explain themselves. We wanted a third path: let each person’s private agent understand the full context while the shared room learns only what it needs to build agreement.

### What it does

UNSAID is a shared decision canvas. Participants privately brief their own browser agents. The room receives structured ballots rather than raw explanations. When no existing option works for everyone, participants or their agents can publish minimum structured signals and create a bridge proposal by changing known attributes. Candidates move toward a visible common-ground ring as aggregate support improves. A candidate can be nominated only when every participant accepts it, and the live person must ratify the final agreement through the human interface.

The judge demo uses one live ChatGPT participant and three clearly labeled deterministic demo agents so the complete multi-party experience can be tested immediately.

### Why WebMCP

UNSAID is not improved by adding generic chat. Its core depends on the webpage exposing a precise coordination protocol. Through WebMCP, a personal agent can read shared room state, submit a private ballot, publish a structured signal, create a bridge candidate, and nominate a viable option. Tool schemas prevent raw private narratives from being sent accidentally. The tools reuse the same state transitions and permissions as the human interface, and their availability changes with the room phase.

Without WebMCP, an agent would have to scrape cards, guess form controls, and infer whether a shared state mutation succeeded. With WebMCP, agent actions are typed, reliable, attributable, and visibly reflected in the common canvas.

### What people and agents can do together now

A person can give their own agent the complete private context. The agent can translate that context into the minimum structured contribution, reason across aggregate group signals, and construct a new option that did not previously exist. The group can reach a better agreement without collecting everyone’s raw private explanation. Agents do the translation and option construction; people retain final authority.

### How it was built

UNSAID is a full-stack TypeScript application hosted on ChatGPT Sites with durable room state in D1. The top-level page registers imperative WebMCP tools through `document.modelContext.registerTool`. Read-only and state-changing tools have narrow JSON schemas and compact verifiable results. The room uses server-authoritative versioning, aggregate ballots, a deterministic consensus function, and a fixture evaluator for the three fictional demo agents. The human interface remains fully usable when WebMCP is unavailable.

### Limitations

UNSAID is a prototype for minimum disclosure, not an anonymity or encryption system. Source-hidden signals may be inferable in a small group. The deterministic demo agents are fictional fixtures, clearly labeled in the product and source. The current submission demonstrates an offsite decision rather than a general production platform.

## Built with

- WebMCP
- ChatGPT Sites
- TypeScript
- React
- D1
- Zod
- Framer Motion

## Testing instructions

Open the live URL and select **Start judge demo**. For the full agent experience, use ChatGPT’s built-in browser with site tools enabled. Copy the private brief shown in the right rail into ChatGPT and ask it to represent you. The agent should read the room and submit a structured ballot. After the room enters bridge mode, ask the agent to create the strongest common-ground option using the room’s signals. Once the proposal is acceptable to everyone, ask it to nominate the candidate. Complete the final ratification by clicking **I ratify this agreement** in the webpage. The same flow can be completed through the Manual tab in a browser without WebMCP.

## Screenshot captions

1. **No consensus:** No existing option works for everyone.
2. **Agent-created bridge:** Agents construct an option that did not exist.
3. **Agreement receipt:** Agreement reached with zero raw private context received from the live participant.

## Freeze policy

The final submission points to one tagged source revision and one verified Site version. No later revision is deployed to the submitted URL after the deadline.
