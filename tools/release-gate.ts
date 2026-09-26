// The gate both deploys go through before they build anything: verify and
// rules, and the recorded sounds and gunshots on disk. docs/TEST_AUDIT.md: the
// deploys used to build and ship whatever was in the folder, and the only thing
// that kept a failing check off the live site was remembering to run it. Set
// RELEASE_GATE=off to skip it (a hotfix to the server's own files, say), and
// say why in the commit.
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function releaseGate(root: string): void {
  if (process.env.RELEASE_GATE === "off") {
    console.log("\n== release gate SKIPPED (RELEASE_GATE=off)");
    return;
  }
  console.log("\n== release gate: verify, rules, and the recorded sounds on disk");
  const missing = ["public/audio/kenney/index.json", "public/audio/guns/index.json", "public/audio/music/drop.mp3", "public/audio/music/city.mp3"].filter((f) => !existsSync(join(root, f)));
  if (missing.length) throw new Error(`release gate: ${missing.join(" and ")} missing: run npm run sounds and npm run guns here first, or the release ships synthesised sound`);
  for (const cmd of ["npm run verify", "npm run rules"]) {
    try {
      execSync(cmd, { cwd: root, stdio: "pipe", maxBuffer: 1 << 28 });
    } catch (e) {
      const out = String((e as { stdout?: Buffer }).stdout ?? "") + String((e as { stderr?: Buffer }).stderr ?? "");
      console.log(out.split("\n").filter((l) => /FAIL/.test(l)).slice(0, 20).join("\n"));
      throw new Error(`release gate: ${cmd} failed; nothing was built or shipped`);
    }
  }
  console.log("   verify and rules pass");
}
