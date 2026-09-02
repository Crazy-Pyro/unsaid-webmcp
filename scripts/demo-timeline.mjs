import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const narrationScenes = [
  {
    duration: 14,
    text: "Group decisions have a hidden cost. To coordinate, people reveal budgets, accessibility needs, family obligations, or other private constraints—or they stay silent and accept a bad outcome.",
  },
  {
    duration: 16,
    text: "UNSAID changes that. Each person tells their own agent the full truth. The shared webpage learns only the structured judgments needed to construct common ground. Agents negotiate attributes. Humans ratify the agreement.",
  },
  {
    duration: 14,
    text: "This is a four-person offsite decision. Three fictional demo agents have already evaluated the options from deterministic private fixture profiles. I am the live participant. The room has received zero raw private context from me.",
  },
  {
    duration: 21,
    text: "I tell ChatGPT my constraints privately. The page exposes a typed get room state tool and a submit ballot tool through WebMCP. ChatGPT evaluates the live options and sends only preferred, acceptable, or unacceptable—no reason and no private narrative.",
  },
  {
    duration: 17,
    text: "No original option works for everyone. At this moment the webpage changes its agent interface. Bridge tools appear, and the room reveals only the minimum attribute signals needed to move forward.",
  },
  {
    duration: 26,
    text: "ChatGPT uses those public signals plus my private context to create an option that did not exist: a Thursday Lakeside Lab that ends by four and costs two hundred thirty-five dollars. It does not disclose why those changes matter.",
  },
  {
    duration: 16,
    text: "The deterministic demo agents re-evaluate the proposal. Everyone can accept it. The candidate moves into common ground, and a new WebMCP action becomes available: nominate it for ratification.",
  },
  {
    duration: 18,
    text: "The agent can open ratification, but it cannot make my final decision. I review the shared outcome and ratify it myself.",
  },
  {
    duration: 20,
    text: "The receipt shows what was shared: structured ballots, public signals, a bridge proposal, and final approval. My raw private explanation never entered the room. Every agent action used phase-specific WebMCP tools wired to the same operations as the human interface.",
  },
  {
    duration: 10,
    text: "The old web helps one person transact. UNSAID helps many people agree.",
  },
];

export const shots = [
  {
    background: "thumbnail-v2.png",
    caption: "Group decisions have a hidden cost.",
    duration: 5,
    label: "UNSAID",
  },
  {
    background: "frames-wide/01-briefing.png",
    caption:
      "To coordinate, people reveal budgets, accessibility needs, family obligations, or other private constraints—",
    duration: 4.5,
    label: "Minimum disclosure",
  },
  {
    background: "frames-wide/03-get-state.png",
    caption: "or they stay silent and accept a bad outcome.",
    duration: 4.5,
    label: "Private context stays private",
  },
  {
    background: "frames-wide/00-landing.png",
    caption: "UNSAID changes that.",
    duration: 5,
    label: "Private context → shared agreement",
  },
  {
    background: "frames-wide/00-landing.png",
    caption: "Each person tells their own agent the full truth.",
    duration: 5,
    label: "Personal agents",
  },
  {
    background: "frames-wide/00-landing.png",
    caption:
      "The shared webpage learns only structured judgments. Agents negotiate attributes. Humans ratify the agreement.",
    duration: 6,
    label: "A neutral coordination protocol",
  },
  {
    background: "frames-wide/01-briefing.png",
    caption:
      "This is a four-person offsite decision. Three fictional demo agents already evaluated the options from deterministic fixture profiles.",
    duration: 7,
    label: "Three deterministic demo agents",
  },
  {
    background: "frames-wide/03-get-state.png",
    caption:
      "I am the live participant. The room has received zero raw private context from me.",
    duration: 7,
    label: "One live ChatGPT agent",
  },
  {
    background: "frames-wide/02-webmcp-discovery.png",
    caption: "I tell ChatGPT my constraints privately.",
    duration: 6,
    label: "Live ChatGPT agent",
  },
  {
    background: "frames-wide/02-webmcp-discovery.png",
    caption:
      "The page exposes typed get_room_state and submit_ballot tools through WebMCP.",
    duration: 8,
    label: "WebMCP tool discovery",
  },
  {
    background: "frames-wide/04-submit-ballot.png",
    caption:
      "ChatGPT sends only preferred, acceptable, or unacceptable—no reason and no private narrative.",
    duration: 7,
    label: "WebMCP tool call · submit_ballot",
  },
  {
    background: "frames-wide/04-submit-ballot.png",
    caption: "No original option works for everyone.",
    duration: 5,
    label: "No consensus",
  },
  {
    background: "frames-wide/05-publish-signal.png",
    caption: "At this moment the webpage changes its agent interface. Bridge tools appear,",
    duration: 7,
    label: "Phase-aware WebMCP tools",
  },
  {
    background: "frames-wide/05-publish-signal.png",
    caption:
      "and the room reveals only the minimum attribute signals needed to move forward.",
    duration: 5,
    label: "WebMCP tool call · publish_signal",
  },
  {
    background: "frames-wide/05-publish-signal.png",
    caption: "ChatGPT uses those public signals plus my private context",
    duration: 6,
    label: "Structured signals · source hidden",
  },
  {
    background: "frames-wide/06-propose-bridge.png",
    caption: "to create an option that did not exist: a Thursday Lakeside Lab",
    duration: 8,
    label: "WebMCP tool call · propose_bridge",
  },
  {
    background: "frames-wide/06-propose-bridge.png",
    caption: "that ends by four and costs two hundred thirty-five dollars.",
    duration: 7,
    label: "Three structured changes",
  },
  {
    background: "frames-wide/06-propose-bridge.png",
    caption: "It does not disclose why those changes matter.",
    duration: 5,
    label: "No private narrative field",
  },
  {
    background: "frames-wide/06-propose-bridge.png",
    caption: "The deterministic demo agents re-evaluate the proposal.",
    duration: 5,
    label: "Deterministic demo agents",
  },
  {
    background: "frames-wide/07-common-ground.png",
    caption: "Everyone can accept it. The candidate moves into common ground,",
    duration: 6,
    label: "4 / 4 can accept",
  },
  {
    background: "frames-wide/07-common-ground.png",
    caption: "and a new WebMCP action becomes available: nominate it for ratification.",
    duration: 5,
    label: "WebMCP action · nominate_candidate",
  },
  {
    background: "frames-wide/08-ratification.png",
    caption: "The agent can open ratification, but it cannot make my final decision.",
    duration: 7,
    label: "Agent nomination",
  },
  {
    background: "frames-wide/08-ratification.png",
    caption: "I review the shared outcome",
    duration: 6,
    label: "Human ratification required",
  },
  {
    background: "frames-wide/09-agreement.png",
    caption: "and ratify it myself.",
    duration: 5,
    label: "Human ratification",
  },
  {
    background: "frames-wide/09-agreement.png",
    caption:
      "The receipt shows what was shared: structured ballots, public signals, a bridge proposal, and final approval.",
    duration: 6,
    label: "Inspectable agreement receipt",
  },
  {
    background: "frames-wide/10-agreement-tool.png",
    caption: "My raw private explanation never entered the room.",
    duration: 5,
    label: "Zero raw private reasons received",
  },
  {
    background: "frames-wide/10-agreement-tool.png",
    caption:
      "Every agent action used phase-specific WebMCP tools wired to the same operations as the human interface.",
    duration: 7,
    label: "WebMCP tool call · get_agreement",
  },
  {
    background: "code-card.png",
    caption: "",
    duration: 2,
    label: "",
  },
  {
    background: "thumbnail-v2.png",
    caption: "The old web helps one person transact. UNSAID helps many people agree.",
    duration: 10,
    final: true,
    label: "LIVE DEMO",
  },
];

export const totalDuration = narrationScenes.reduce((sum, scene) => sum + scene.duration, 0);

async function writeTimelineArtifacts() {
  const outputDirectory = path.join(root, "outputs", "video");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    path.join(outputDirectory, "timeline.json"),
    `${JSON.stringify({ narrationScenes, shots, totalDuration }, null, 2)}\n`,
  );
  await writeFile(
    path.join(outputDirectory, "narration.txt"),
    `${narrationScenes.map((scene, index) => `${index + 1}. ${scene.text}`).join("\n\n")}\n`,
  );
  console.log(`Prepared ${shots.length} shots for ${totalDuration} seconds.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await writeTimelineArtifacts();
}
