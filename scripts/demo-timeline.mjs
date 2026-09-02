import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const narrationScenes = [
  {
    duration: 14,
    text: "Group decisions come with a hidden cost. To coordinate, people share budgets, accessibility needs, family obligations, and other private details. Or they stay quiet and settle for a bad outcome.",
  },
  {
    duration: 16,
    text: "UNSAID offers a third path. Everyone tells their own agent the whole truth. The shared page gets only the structured judgments needed to find common ground. Agents negotiate. People make the final call.",
  },
  {
    duration: 14,
    text: "Four people are choosing an offsite. Three labeled demo agents already evaluated the options deterministically. I am the live participant. The room has none of my private context.",
  },
  {
    duration: 21,
    text: "I tell ChatGPT my constraints in private. Through Web M C P, the page gives it two typed tools: get room state, and submit ballot. ChatGPT evaluates the choices, then shares only preferred, acceptable, or unacceptable. No reason. No private story.",
  },
  {
    duration: 17,
    text: "None of the original options works for everyone. Now the page changes the tools available to the agent. Bridge tools appear, and the room shares only the minimum attribute signals needed to move forward.",
  },
  {
    duration: 26,
    text: "ChatGPT combines those public signals with my private context and creates a new option: Lakeside Lab on Thursday, ending by four, for two hundred thirty-five dollars. The proposal changes what matters, without revealing why it matters.",
  },
  {
    duration: 16,
    text: "The demo agents evaluate the new proposal. This time, all four participants accept it. The candidate moves into common ground, and Web M C P exposes a new action: nominate it for ratification.",
  },
  {
    duration: 18,
    text: "The agent can open ratification. It cannot make my final decision. I review the shared outcome and approve it myself.",
  },
  {
    duration: 20,
    text: "The receipt shows the disclosure boundary: structured ballots, public signals, one bridge proposal, and final approval. My private explanation never entered the room. Each agent action used a phase-specific Web M C P tool tied to the same operations as the human interface.",
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
      "To coordinate, people share budgets, accessibility needs, family obligations, and other private details—",
    duration: 4.5,
    label: "Minimum disclosure",
  },
  {
    background: "frames-wide/03-get-state.png",
    caption: "or they stay quiet and settle for a bad outcome.",
    duration: 4.5,
    label: "Private context stays private",
  },
  {
    background: "frames-wide/00-landing.png",
    caption: "UNSAID offers a third path.",
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
      "The shared page gets only structured judgments. Agents negotiate. People make the final call.",
    duration: 6,
    label: "A neutral coordination protocol",
  },
  {
    background: "frames-wide/01-briefing.png",
    caption:
      "Four people are choosing an offsite. Three labeled demo agents evaluated the options deterministically.",
    duration: 7,
    label: "Three deterministic demo agents",
  },
  {
    background: "frames-wide/03-get-state.png",
    caption:
      "I am the live participant. The room has none of my private context.",
    duration: 7,
    label: "One live ChatGPT agent",
  },
  {
    background: "frames-wide/02-webmcp-discovery.png",
    caption: "I tell ChatGPT my constraints in private.",
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
    caption: "Now the page changes the tools available to the agent. Bridge tools appear,",
    duration: 7,
    label: "Phase-aware WebMCP tools",
  },
  {
    background: "frames-wide/05-publish-signal.png",
    caption:
      "and the room shares only the minimum attribute signals needed to move forward.",
    duration: 5,
    label: "WebMCP tool call · publish_signal",
  },
  {
    background: "frames-wide/05-publish-signal.png",
    caption: "ChatGPT combines those public signals with my private context",
    duration: 6,
    label: "Structured signals · source hidden",
  },
  {
    background: "frames-wide/06-propose-bridge.png",
    caption: "to create a new option: Lakeside Lab on Thursday",
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
    caption: "The proposal changes what matters, without revealing why it matters.",
    duration: 5,
    label: "No private narrative field",
  },
  {
    background: "frames-wide/06-propose-bridge.png",
    caption: "The demo agents evaluate the new proposal.",
    duration: 5,
    label: "Deterministic demo agents",
  },
  {
    background: "frames-wide/07-common-ground.png",
    caption: "All four participants accept it. The candidate moves into common ground,",
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
    caption: "and approve it myself.",
    duration: 5,
    label: "Human ratification",
  },
  {
    background: "frames-wide/09-agreement.png",
    caption:
      "The receipt shows the disclosure boundary: structured ballots, public signals, one bridge proposal, and final approval.",
    duration: 6,
    label: "Inspectable agreement receipt",
  },
  {
    background: "frames-wide/10-agreement-tool.png",
    caption: "My private explanation never entered the room.",
    duration: 5,
    label: "Zero raw private reasons received",
  },
  {
    background: "frames-wide/10-agreement-tool.png",
    caption:
      "Each agent action used a phase-specific WebMCP tool tied to the same operations as the human interface.",
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
