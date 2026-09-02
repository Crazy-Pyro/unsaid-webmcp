import { mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { KokoroTTS } from "kokoro-js";

import { narrationScenes } from "./demo-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const audioDirectory = path.join(root, "outputs", "video", "audio");
const narrationModel = "onnx-community/Kokoro-82M-v1.0-ONNX";
const narrationVoice = "af_heart";
const narrationSpeed = 1;
const leadInSeconds = 0.65;
const sceneIndex = Number(process.argv[2]);
const scene = narrationScenes[sceneIndex];
const narrationText = process.argv.slice(3).join(" ") || scene?.text;

if (!Number.isInteger(sceneIndex) || !scene) {
  throw new Error(`Expected a narration scene index from 0 to ${narrationScenes.length - 1}.`);
}

await mkdir(audioDirectory, { recursive: true });

let lastDownloadStatus = "";
const tts = await KokoroTTS.from_pretrained(narrationModel, {
  dtype: "q8",
  device: "cpu",
  progress_callback: ({ status, file, progress }) => {
    if (status === "progress" && Number.isFinite(progress)) {
      const nextStatus = `Loading ${file}: ${Math.floor(progress)}%`;
      if (nextStatus !== lastDownloadStatus) {
        process.stdout.write(`\r${nextStatus}`);
        lastDownloadStatus = nextStatus;
      }
    }
  },
});
process.stdout.write("\n");

const stem = `scene-${String(sceneIndex).padStart(2, "0")}`;
const outputPath = path.join(audioDirectory, `${stem}-neural.wav`);
const audio = await tts.generate(narrationText, {
  voice: narrationVoice,
  speed: narrationSpeed,
});
const spokenDuration = audio.audio.length / audio.sampling_rate;

if (spokenDuration + leadInSeconds > scene.duration) {
  console.error(
    `Narration scene ${sceneIndex + 1} is ${spokenDuration.toFixed(2)}s, longer than its ${scene.duration}s slot.`,
  );
  process.exit(1);
}

await audio.save(outputPath);
const rawBytes = (await stat(outputPath)).size;
if (rawBytes < 16_000) {
  console.error(`Narration scene ${sceneIndex + 1} did not contain rendered neural speech.`);
  process.exit(1);
}
console.log(
  `Rendered scene ${sceneIndex + 1}: ${spokenDuration.toFixed(2)}s / ${scene.duration}s · ${narrationVoice}`,
);
