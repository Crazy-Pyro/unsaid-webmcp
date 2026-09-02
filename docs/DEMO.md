# Judge and video demo

## Fast judge path

1. Open the public URL and select **Start judge demo**.
2. In a compatible ChatGPT browser, paste the private brief shown in the product.
3. Ask: “Read this room and summarize the decision, active options, and what action is currently needed.”
4. Ask the agent to evaluate all options using the private constraints and submit the ballot without publishing a reason.
5. Confirm the room visibly enters bridge mode and reveals source-hidden structured signals.
6. Ask for the strongest common-ground proposal with the fewest meaningful changes.
7. Confirm **Lakeside Lab · Thursday Bridge** appears with lineage and change chips.
8. Ask the agent to evaluate the bridge and nominate it if everyone can accept it.
9. Confirm only `get_room_state` remains available during ratification.
10. Select **I ratify this agreement** yourself.
11. Read the agreement receipt and the zero-raw-context metric.

The same sequence is available from the **Manual** tab in a browser without WebMCP.

## Narrated video script, target 2:52

### 0:00–0:14 — The human problem

Visual: title card, candidate field, privacy indicator.

Narration: “Group decisions have a hidden cost. To coordinate, people reveal budgets, accessibility needs, family obligations, or other private constraints, or they stay silent and accept a bad outcome.”

### 0:14–0:30 — Product thesis

Visual: landing page and participant topology.

Narration: “UNSAID creates a third path. Tell your own agent the whole truth. Tell the shared room only enough to agree.”

### 0:30–0:53 — Structured room

Visual: start a fresh room and show the five original options.

Narration: “This judge room represents one live participant and three clearly labeled deterministic demo agents. Their private profiles stay server-side. The room exposes only candidate attributes, aggregate support, and structured actions.”

### 0:53–1:22 — WebMCP ballot

Visual: ChatGPT reads state and calls `submit_ballot`; room enters bridge mode.

Narration: “My browser agent knows my full constraints in our private conversation. Through a narrow WebMCP schema it submits only candidate IDs and stance values. No reason or chat transcript reaches the room.”

### 1:22–1:52 — Construct the bridge

Visual: public signals, `propose_bridge`, lineage animation.

Narration: “No original works for everyone. The agent combines public signals with my private context to create a Thursday Lakeside Lab that ends at four and costs two hundred thirty-five dollars. The proposal contains three structured changes, not an explanation.”

### 1:52–2:08 — Find common ground

Visual: agent evaluates the bridge; node moves into the common-ground ring.

Narration: “The deterministic fixtures re-evaluate it. All four participants can accept the bridge, so a new phase-specific action becomes available: nominate it.”

### 2:08–2:29 — Preserve human authority

Visual: `nominate_candidate`, ratification screen, visible human click.

Narration: “The agent can open ratification, but it cannot make my final decision. Only the visible human interface can record my approval.”

### 2:29–2:48 — Receipt and close

Visual: final receipt, live URL, repository URL.

Narration: “The agreement is durable, inspectable, and human-ratified. The receipt shows what was shared and what was not: zero raw private reasons received. The old web helps one person transact. UNSAID helps many people agree.”

## Capture checklist

- Record the deployed URL at 1920×1080 and normal browser zoom.
- Keep ChatGPT and the app visible for the critical WebMCP calls.
- Use a fresh room and a clean run with no hidden errors.
- Add captions and clear spoken audio; do not use copyrighted music.
- Identify Maya, Theo, and Sam as deterministic fictional fixtures.
- End before 2:52 with the live URL readable.

## Release master

The release edit is generated from a clean, fresh-room WebMCP run and uses only original product imagery plus macOS system narration. It includes burned-in captions and a matching SRT sidecar.

- Runtime: `02:52.000`
- Frame: `1920×1080` at 30 fps
- Video: H.264
- Audio: AAC, stereo, 48 kHz
- Music: none
- Master: `outputs/video/UNSAID-WebMCP-demo.mp4`
- Captions: `outputs/video/UNSAID-WebMCP-demo.srt`
- Thumbnail: `public/submission/thumbnail-v2.png`

`npm run video:prepare` writes the exact shot and narration manifests. After the captioned stills are rendered into `outputs/video/render`, `npm run video:build` generates and validates the final master. The narration build uses the macOS Samantha system voice and fails closed if speech audio is missing or if the result is not under three minutes at 1920×1080 H.264/AAC.
