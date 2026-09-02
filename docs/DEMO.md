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

Visual: title card, candidate field, and privacy indicator.

Narration: “Group decisions come with a hidden cost. To coordinate, people share budgets, accessibility needs, family obligations, and other private details. Or they stay quiet and settle for a bad outcome.”

### 0:14–0:30 — Product thesis

Visual: landing page and participant topology.

Narration: “UNSAID offers a third path. Everyone tells their own agent the whole truth. The shared page gets only the structured judgments needed to find common ground. Agents negotiate. People make the final call.”

### 0:30–0:44 — Structured room

Visual: the briefing state and a WebMCP room-state read.

Narration: “Four people are choosing an offsite. Three labeled demo agents already evaluated the options deterministically. I am the live participant. The room has none of my private context.”

### 0:44–1:05 — WebMCP ballot

Visual: WebMCP tool discovery followed by the `submit_ballot` result.

Narration: “I tell ChatGPT my constraints in private. Through Web M C P, the page gives it two typed tools: get room state, and submit ballot. ChatGPT evaluates the choices, then shares only preferred, acceptable, or unacceptable. No reason. No private story.”

### 1:05–1:22 — Enter bridge mode

Visual: the failed original slate, phase-aware bridge tools, and source-hidden public signals.

Narration: “None of the original options works for everyone. Now the page changes the tools available to the agent. Bridge tools appear, and the room shares only the minimum attribute signals needed to move forward.”

### 1:22–1:48 — Construct the bridge

Visual: public signals, the `propose_bridge` result, and the proposal lineage.

Narration: “ChatGPT combines those public signals with my private context and creates a new option: Lakeside Lab on Thursday, ending by four, for two hundred thirty-five dollars. The proposal changes what matters, without revealing why it matters.”

### 1:48–2:04 — Find common ground

Visual: demo-agent evaluation, four-of-four acceptance, and the newly available nomination action.

Narration: “The demo agents evaluate the new proposal. This time, all four participants accept it. The candidate moves into common ground, and Web M C P exposes a new action: nominate it for ratification.”

### 2:04–2:22 — Preserve human authority

Visual: agent nomination, the ratification screen, and a visible human approval.

Narration: “The agent can open ratification. It cannot make my final decision. I review the shared outcome and approve it myself.”

### 2:22–2:42 — Receipt and disclosure boundary

Visual: the agreement receipt, zero-raw-context metric, `get_agreement` result, and repository card.

Narration: “The receipt shows the disclosure boundary: structured ballots, public signals, one bridge proposal, and final approval. My private explanation never entered the room. Each agent action used a phase-specific Web M C P tool tied to the same operations as the human interface.”

### 2:42–2:52 — Close

Visual: final title card with the live URL.

Narration: “The old web helps one person transact. UNSAID helps many people agree.”

## Capture checklist

- Record the deployed URL at 1920×1080 and normal browser zoom.
- Keep ChatGPT and the app visible for the critical WebMCP calls.
- Use a fresh room and a clean run with no hidden errors.
- Add captions and clear spoken audio; do not use copyrighted music.
- Identify Maya, Theo, and Sam as deterministic fictional fixtures.
- End before 2:52 with the live URL readable.

## Release master

The release edit is generated from a clean, fresh-room WebMCP run and uses only original product imagery plus locally rendered Kokoro neural narration. It includes burned-in captions and a matching SRT sidecar.

- Runtime: `02:52.000`
- Frame: `1920×1080` at 30 fps
- Video: H.264
- Audio: AAC, stereo, 48 kHz
- Music: none
- Master: `outputs/video/UNSAID-WebMCP-demo.mp4`
- Captions: `outputs/video/UNSAID-WebMCP-demo.srt`
- Thumbnail: `public/submission/thumbnail-v2.png`

`npm run video:prepare` writes the exact shot and narration manifests. After the captioned stills are rendered into `outputs/video/render`, `npm run video:build` generates and validates the final master. The narration build uses Kokoro 82M's `af_heart` voice at its natural speed; the Apache-2.0 model is downloaded and cached locally on first use. The build fails closed if speech audio is missing, a scene overruns its visual slot, or the result is not under three minutes at 1920×1080 H.264/AAC.
