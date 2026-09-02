import { execFileSync } from "node:child_process";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { KokoroTTS } from "kokoro-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "outputs", "video", "voice-samples");
const cacheDirectory = path.join(root, "outputs", "video");
const sampleText =
  "UNSAID creates a third path. Tell your own agent the whole truth. The shared room receives only the structured judgments needed to find common ground. Agents negotiate the options. People make the final decision.";

const voices = [
  { id: "af_heart", label: "heart" },
  { id: "af_bella", label: "bella" },
  { id: "bf_emma", label: "emma" },
];

let lastDownloadStatus = "";

await mkdir(outputDirectory, { recursive: true });

// Keep the downloaded model with the ignored video outputs instead of in the repo root.
process.chdir(cacheDirectory);

const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
  dtype: "q8",
  device: "cpu",
  progress_callback: ({ status, file, progress }) => {
    if (status === "progress" && Number.isFinite(progress)) {
      const nextStatus = `Downloading ${file}: ${Math.floor(progress)}%`;
      if (nextStatus !== lastDownloadStatus) {
        process.stdout.write(`\r${nextStatus}`);
        lastDownloadStatus = nextStatus;
      }
    }
  },
});
process.stdout.write("\n");

const rendered = [];
for (const voice of voices) {
  const wavPath = path.join(outputDirectory, `${voice.label}.wav`);
  const mp3Path = path.join(outputDirectory, `${voice.label}.mp3`);
  const audio = await tts.generate(sampleText, { voice: voice.id, speed: 0.97 });
  await audio.save(wavPath);
  rendered.push({ mp3Path, wavPath });
}

for (const { mp3Path, wavPath } of rendered) {
  execFileSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      wavPath,
      "-af",
      "loudnorm=I=-16:TP=-1.5:LRA=11",
      "-c:a",
      "libmp3lame",
      "-b:a",
      "192k",
      mp3Path,
    ],
    { stdio: "inherit" },
  );
  console.log(`Created ${mp3Path}`);
}
