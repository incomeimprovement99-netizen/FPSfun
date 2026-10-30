// A release's shell steps on the box (tools/release-steps.ts, Milestone 938), run in a real bash on a stand-in box: a
// folder for ~/range, with pm2, curl and npm stand-ins on the path. The real box is never touched.
//   - a release that comes up stays, and the last one is kept as prev;
//   - a release that does not answer (its server crashed) or a reload that failed (the old one still answering) puts the
//     last one back and fails the deploy;
//   - a failed unpack leaves neither the half-filled next/ nor the upload on the disk;
//   - a rollback whose reload failed does not pass.
//
// Run on its own: npx tsx tools/checks/release-steps.ts (verify runs it that way).
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rollbackSteps, shipSteps } from "../release-steps";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

// (Git's bash on Windows: the bash the path finds first there can be WSL's, with another idea of every path here)
const BASH = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
if (!existsSync(BASH) && process.platform === "win32") {
  console.log("  --  skipped: no Git bash here");
  process.exit(0);
}

/** a stand-in box: `old` running, `incoming.tgz` holding the new release; `reload` is what pm2 then does */
function box(reload: "ok" | "crash" | "fail"): { home: string; run: (steps: string) => { status: number | null; out: string }; running: () => string } {
  const home = mkdtempSync(join(tmpdir(), "release-steps-"));
  const range = join(home, "range");
  const bin = join(home, "bin");
  mkdirSync(join(range, "app", "site"), { recursive: true });
  mkdirSync(join(range, "app", "server"), { recursive: true });
  mkdirSync(join(range, "prev", "site"), { recursive: true });
  mkdirSync(join(range, "prev", "server"), { recursive: true });
  mkdirSync(bin);
  writeFileSync(join(range, "app", "site", "version.txt"), "old1 2026-10-30\n");
  writeFileSync(join(range, "prev", "site", "version.txt"), "older 2026-10-29\n");
  writeFileSync(join(home, "running"), "old1\n");
  // what /health says is what pm2 last loaded, the way a live server's is
  const script = (name: string, body: string): void => {
    writeFileSync(join(bin, name), `#!/bin/bash\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  script("curl", `v=$(cat "$HOME/running"); [ -n "$v" ] || exit 7; echo "{\\"ok\\":true,\\"version\\":\\"$v 2026-10-30\\"}"`);
  script("npm", "exit 0");
  script("sleep", "exit 0");
  script(
    "pm2",
    `[ "$1" = save ] && exit 0
v=$(cut -d' ' -f1 "$HOME/range/app/site/version.txt")
if [ -f "$HOME/reload-next" ]; then r=$(cat "$HOME/reload-next"); rm "$HOME/reload-next"; else r=ok; fi
if [ "$r" = fail ]; then exit 1; fi
if [ "$r" = crash ]; then : > "$HOME/running"; exit 0; fi
echo "$v" > "$HOME/running"`,
  );
  writeFileSync(join(home, "reload-next"), reload);
  const run = (steps: string): { status: number | null; out: string } => {
    // (put first inside the shell: Git's bash.exe puts its own folders before whatever path it is given)
    const r = spawnSync(BASH, ["-c", `export PATH="$HOME/bin:$PATH"; ${steps}`], { env: { ...process.env, HOME: home }, encoding: "utf8" });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  };
  return { home, run, running: () => readFileSync(join(home, "running"), "utf8").trim() };
}
/** the new release's tgz in place of what scp left */
function upload(home: string, sha: string): void {
  const stage = join(home, "stage");
  mkdirSync(join(stage, "site"), { recursive: true });
  mkdirSync(join(stage, "server"), { recursive: true });
  writeFileSync(join(stage, "site", "version.txt"), `${sha} 2026-10-30\n`);
  const r = spawnSync(BASH, ["-c", `cd "${stage.replace(/\\/g, "/")}" && tar -czf ../range/incoming.tgz site server`], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(r.stderr);
}
const versionIn = (home: string, dir: string): string => {
  const f = join(home, "range", dir, "site", "version.txt");
  return existsSync(f) ? readFileSync(f, "utf8").split(" ")[0] : "none";
};

console.log("A release on a stand-in box (tools/release-steps.ts)");
{
  const b = box("ok");
  upload(b.home, "new2");
  const r = b.run(shipSteps("new2"));
  check("a release that comes up stays, the last one kept", r.status === 0 && b.running() === "new2" && versionIn(b.home, "app") === "new2" && versionIn(b.home, "prev") === "old1", JSON.stringify({ status: r.status, running: b.running(), out: r.out.slice(-120) }));
  check("and nothing is left over", !existsSync(join(b.home, "range", "next")) && !existsSync(join(b.home, "range", "incoming.tgz")));
  rmSync(b.home, { recursive: true, force: true });
}
{
  const b = box("crash");
  upload(b.home, "new2");
  const r = b.run(shipSteps("new2"));
  check("a release whose server does not come up: the last one goes back, and the deploy fails", r.status !== 0 && b.running() === "old1" && versionIn(b.home, "app") === "old1", JSON.stringify({ status: r.status, running: b.running(), app: versionIn(b.home, "app") }));
  rmSync(b.home, { recursive: true, force: true });
}
{
  const b = box("fail");
  upload(b.home, "new2");
  const r = b.run(shipSteps("new2"));
  check("a reload that failed, the old server still answering: no pass, and the last one back", r.status !== 0 && versionIn(b.home, "app") === "old1", JSON.stringify({ status: r.status, running: b.running(), app: versionIn(b.home, "app") }));
  rmSync(b.home, { recursive: true, force: true });
}
{
  const b = box("ok");
  writeFileSync(join(b.home, "range", "incoming.tgz"), "not a tar");
  const r = b.run(shipSteps("new2"));
  check("an unpack that fails stops, the running release as it was", r.status !== 0 && b.running() === "old1" && versionIn(b.home, "app") === "old1", JSON.stringify({ status: r.status, app: versionIn(b.home, "app") }));
  check("and leaves neither next/ nor the upload on the disk", !existsSync(join(b.home, "range", "next")) && !existsSync(join(b.home, "range", "incoming.tgz")));
  rmSync(b.home, { recursive: true, force: true });
}
{
  const b = box("fail");
  const r = b.run(rollbackSteps);
  check("a rollback whose reload failed does not pass", r.status !== 0, JSON.stringify({ status: r.status, out: r.out.slice(-120) }));
  rmSync(b.home, { recursive: true, force: true });
  const c = box("ok");
  const k = c.run(rollbackSteps);
  check("and one that reloads answers as the release it put back", k.status === 0 && c.running() === "older" && versionIn(c.home, "app") === "older", JSON.stringify({ status: k.status, running: c.running(), out: k.out.slice(-120) }));
  rmSync(c.home, { recursive: true, force: true });
}

console.log(fails === 0 ? "\nRELEASE STEPS PASS" : `\nRELEASE STEPS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
