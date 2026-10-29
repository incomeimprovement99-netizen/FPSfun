// The release before's files, after a deploy (Milestone 700): a page opened before a deploy asks for its own build's
// parts after it (PeerJS's, fetched only when a match is made), and the server serves them from the release kept
// beside the new one (server/game/serve.mjs PREV_ASSETS). Without them the page sat on "Making a match..." for good.
//
// The real server, run on a spare port over a made-up release and the one before it.
//
// Run on its own: npx tsx tools/checks/serve-prev.ts.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { freePort } from "./free-port";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const SERVE = new URL("../../server/game/serve.mjs", import.meta.url);

/** the server over `root` (its app/site and, when `prev`, the release before), each status asked for, and stopped */
async function statuses(prev: boolean, port: number, paths: string[]): Promise<number[]> {
  const root = mkdtempSync(join(tmpdir(), "serve-prev-"));
  const site = join(root, "app", "site");
  mkdirSync(join(site, "assets"), { recursive: true });
  writeFileSync(join(site, "index.html"), "<!doctype html><title>t</title>");
  writeFileSync(join(site, "version.txt"), "check");
  writeFileSync(join(site, "assets", "index-NEW.js"), "export const v = 2;");
  if (prev) {
    mkdirSync(join(root, "prev", "site", "assets"), { recursive: true });
    writeFileSync(join(root, "prev", "site", "assets", "peer-OLD.js"), "export const v = 1;");
  }
  const env = { ...process.env, PORT: String(port), HOST: "127.0.0.1", DIST: site, BOARD_FILE: join(root, "b.json"), ACCOUNT_FILE: join(root, "a.json"), SEEN_FILE: join(root, "s.jsonl"), FEEDBACK_FILE: join(root, "f.jsonl") };
  const srv = spawn(process.execPath, [SERVE.pathname.replace(/^\/([A-Za-z]:)/, "$1")], { env, stdio: "ignore" });
  try {
    // (up to 20 s for it to start: on a machine busy with other runs it took more than the 5 s first given)
    for (let i = 0; i < 200; i++) {
      try {
        if ((await fetch(`http://127.0.0.1:${port}/health`)).ok) break;
      } catch {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    const out: number[] = [];
    // (a server that never came up reads 0 for each, a failed check rather than a crash of the whole verify)
    for (const p of paths) out.push(await fetch(`http://127.0.0.1:${port}${p}`).then((r) => r.status, () => 0));
    return out;
  } finally {
    srv.kill();
    await new Promise((r) => setTimeout(r, 200));
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("The release before's files, after a deploy");
// (a worktree whose server folder has never had its packages installed cannot run the server: said, not failed; the
// release gate runs in apex-range, which has them)
if (!existsSync(new URL("../../server/game/node_modules/express/package.json", import.meta.url))) {
  console.log("  --  skipped: server/game has no node_modules (npm install there to run it)");
} else {
  const after = await statuses(true, await freePort(), ["/assets/index-NEW.js", "/assets/peer-OLD.js", "/assets/none.js"]);
  check("after a deploy, a page from before it still gets its own build's parts (the release before's)", after[1] === 200, JSON.stringify(after));
  check("and the new release's own, and a name in neither is a 404", after[0] === 200 && after[2] === 404, JSON.stringify(after));
  const first = await statuses(false, await freePort(), ["/assets/index-NEW.js", "/assets/peer-OLD.js"]);
  check("with no release before (the first deploy) the server starts and serves its own", first[0] === 200 && first[1] === 404, JSON.stringify(first));
}

export const servePrevFails = fails;
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) process.exitCode = fails ? 1 : 0;
