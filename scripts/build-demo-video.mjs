import { execFileSync } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { narrationScenes, shots, totalDuration } from "./demo-timeline.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videoDirectory = path.join(root, "outputs", "video");
const audioDirectory = path.join(videoDirectory, "audio");
const renderDirectory = path.join(videoDirectory, "render");
const outputPath = path.join(videoDirectory, "UNSAID-WebMCP-demo.mp4");
const subtitlePath = path.join(videoDirectory, "UNSAID-WebMCP-demo.srt");

function run(command, args, options = {}) {
  console.log(`→ ${command} ${args.slice(0, 4).join(" ")}${args.length > 4 ? " …" : ""}`);
  execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.quiet ? "pipe" : "inherit",
  });
}

function probeDuration(filePath) {
  return Number(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
      { encoding: "utf8" },
    ).trim(),
  );
}

function timestamp(seconds) {
  const milliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(wholeSeconds).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
}

function concatManifest(filePaths) {
  return `${filePaths.map((filePath) => `file '${filePath.replaceAll("'", "'\\''")}'`).join("\n")}\n`;
}

async function assertExists(filePath) {
  const details = await stat(filePath);
  if (!details.isFile() || details.size === 0) throw new Error(`Missing media asset: ${filePath}`);
}

async function buildAudio() {
  const converted = [];

  for (const [index, scene] of narrationScenes.entries()) {
    const stem = `scene-${String(index).padStart(2, "0")}`;
    const rawPath = path.join(audioDirectory, `${stem}.aiff`);
    const convertedPath = path.join(audioDirectory, `${stem}.wav`);

    run("say", ["-v", "Samantha", "-r", "185", "-o", rawPath, "--", scene.text], {
      quiet: true,
    });

    const spokenDuration = probeDuration(rawPath);
    const rawBytes = (await stat(rawPath)).size;
    if (!Number.isFinite(spokenDuration) || spokenDuration < 0.5 || rawBytes < 16_000) {
      throw new Error(
        `Narration scene ${index + 1} did not contain rendered speech. Run outside a restricted audio sandbox.`,
      );
    }
    if (spokenDuration + 0.65 > scene.duration) {
      throw new Error(
        `Narration scene ${index + 1} is ${spokenDuration.toFixed(2)}s, longer than its ${scene.duration}s slot.`,
      );
    }

    run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        rawPath,
        "-af",
        "adelay=650:all=1,apad",
        "-t",
        String(scene.duration),
        "-ar",
        "48000",
        "-ac",
        "2",
        "-c:a",
        "pcm_s16le",
        convertedPath,
      ],
      { quiet: true },
    );
    converted.push(convertedPath);
  }

  const manifestPath = path.join(renderDirectory, "audio.ffconcat");
  const narrationPath = path.join(renderDirectory, "narration.wav");
  await writeFile(manifestPath, concatManifest(converted));
  run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c:a",
      "pcm_s16le",
      narrationPath,
    ],
    { quiet: true },
  );
  return narrationPath;
}

async function buildVideo() {
  const clips = [];

  for (const [index, shot] of shots.entries()) {
    const stillPath = path.join(renderDirectory, `still-${String(index).padStart(2, "0")}.png`);
    const clipPath = path.join(renderDirectory, `shot-${String(index).padStart(2, "0")}.mp4`);
    await assertExists(stillPath);

    const increment = index % 2 === 0 ? "0.000055" : "0.000045";
    const videoFilter = [
      "scale=1920:1080:force_original_aspect_ratio=increase",
      "crop=1920:1080",
      `zoompan=z='min(zoom+${increment},1.014)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1920x1080:fps=30`,
      "format=yuv420p",
    ].join(",");

    run(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-loop",
        "1",
        "-framerate",
        "30",
        "-i",
        stillPath,
        "-t",
        String(shot.duration),
        "-vf",
        videoFilter,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        clipPath,
      ],
      { quiet: true },
    );
    clips.push(clipPath);
  }

  const manifestPath = path.join(renderDirectory, "video.ffconcat");
  const silentPath = path.join(renderDirectory, "silent.mp4");
  await writeFile(manifestPath, concatManifest(clips));
  run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifestPath,
      "-c",
      "copy",
      silentPath,
    ],
    { quiet: true },
  );
  return silentPath;
}

async function writeSubtitles() {
  let offset = 0;
  let cue = 1;
  const lines = [];

  for (const shot of shots) {
    if (shot.caption) {
      lines.push(
        String(cue),
        `${timestamp(offset)} --> ${timestamp(offset + shot.duration)}`,
        shot.caption,
        "",
      );
      cue += 1;
    }
    offset += shot.duration;
  }

  await writeFile(subtitlePath, `${lines.join("\n")}\n`);
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("The reproducible narration build uses the macOS Samantha voice.");
  }
  if (Math.abs(shots.reduce((sum, shot) => sum + shot.duration, 0) - totalDuration) > 0.001) {
    throw new Error("Narration and visual timelines do not have the same duration.");
  }

  await mkdir(audioDirectory, { recursive: true });
  await mkdir(renderDirectory, { recursive: true });
  await writeSubtitles();

  const [narrationPath, silentPath] = await Promise.all([buildAudio(), buildVideo()]);
  run(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      silentPath,
      "-i",
      narrationPath,
      "-t",
      String(totalDuration),
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { quiet: true },
  );

  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate",
        "-of",
        "json",
        outputPath,
      ],
      { encoding: "utf8" },
    ),
  );
  const duration = Number(probe.format.duration);
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  const audio = probe.streams.find((stream) => stream.codec_type === "audio");
  if (
    duration >= 180 ||
    video?.codec_name !== "h264" ||
    video?.width !== 1920 ||
    video?.height !== 1080 ||
    audio?.codec_name !== "aac"
  ) {
    throw new Error(`Unexpected final media properties: ${JSON.stringify(probe)}`);
  }

  const bytes = (await stat(outputPath)).size;
  const narration = await readFile(path.join(videoDirectory, "narration.txt"), "utf8");
  if (!narration.includes("UNSAID helps many people agree")) {
    throw new Error("Narration artifact is incomplete.");
  }
  console.log(
    `✓ ${outputPath}\n✓ ${duration.toFixed(3)} seconds · 1920×1080 · H.264/AAC · ${(bytes / 1_048_576).toFixed(1)} MiB\n✓ ${subtitlePath}`,
  );
}

await main();
