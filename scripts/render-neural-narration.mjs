import { execFileSync } from "node:child_process";

import { narrationScenes } from "./demo-timeline.mjs";

// Kokoro's native runtime is most reliable when each narration scene owns a
// fresh process. Model files are cached locally, so this trades a little startup
// time for deterministic synthesis without affecting the resulting audio.
for (const [index] of narrationScenes.entries()) {
  execFileSync(process.execPath, ["scripts/render-neural-narration-scene.mjs", String(index)], {
    encoding: "utf8",
    stdio: "inherit",
  });
}
