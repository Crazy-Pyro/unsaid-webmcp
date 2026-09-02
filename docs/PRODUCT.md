# Product brief

## Thesis

UNSAID is a minimum-disclosure group decision room. A person may give their own browser agent complete private context, while the shared webpage receives only the structured contribution needed to coordinate. Personal agents help construct common ground; people retain final authority.

## Judge scenario

The one-room demo asks four represented teammates to choose a one-day offsite. The live participant is joined by Maya, Theo, and Sam, three deterministic fictional demo agents. Five original candidates intentionally contain incompatible day, time, cost, travel, accessibility, setting, or format attributes, so no original candidate is viable.

The intended common-ground option is **Lakeside Lab · Thursday Bridge**:

- Thursday
- 10:00 a.m.–4:00 p.m.
- $235 per person
- 35 minutes travel
- Mixed indoor/outdoor
- Step-free
- Collaborative workshop

## Product contract

- A candidate is viable only when every active participant has evaluated it and no one marks it unacceptable.
- Aggregate support is shared; individual ballots are not.
- Coordination signals disclose an attribute request without a visible source or personal explanation.
- Bridge proposals accept only known structured fields and receive generated titles and change summaries.
- A viable candidate may be nominated by a person or browser agent.
- The live participant’s final ratification requires an explicit click in the visible interface.
- A declined ratification returns the room to bridge building.

## State machine

```text
BRIEFING
   │ human enters
   ▼
COLLECTING
   │ complete live ballot, no viable original
   ▼
BRIDGING
   │ create and fully evaluate viable bridge
   ▼
READY_TO_NOMINATE
   │ nomination
   ▼
RATIFYING
   ├─ decline ───────────────► BRIDGING
   └─ visible human approve ─► AGREED
```

## Success criteria

- A judge can finish the complete flow without credentials.
- The same operations work through visible manual controls and phase-aware WebMCP tools.
- Tool actions create immediate visible changes and attributable public ledger entries.
- The final receipt reports zero raw private reasons received from the live participant.
- Privacy language never claims anonymity, encryption, or zero knowledge.

## Non-goals

- General-purpose chat
- Production identity, invitations, or account management
- Payment, booking, or calendar integrations
- Arbitrary decision templates
- Claims of anonymity or suitability for sensitive production decisions
