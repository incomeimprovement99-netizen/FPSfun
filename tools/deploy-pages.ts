// Publish the public build to GitHub Pages: build the beta (codenames only,
// checked), then push dist/ as the `gh-pages` branch of the repo's `origin`.
// Pages serves that branch at https://<user>.github.io/<repo>/ once it is
// switched on in the repo's settings (docs/DEPLOY_GUIDE.md).
//
// Pushing is not publishing. GitHub builds the branch after the push, and
// that build can fail on its own: the commonest reason is its rate limit of
// ten builds an hour, which a day of shipping reaches easily. When it fails,
// Pages keeps serving the LAST build that worked and sends an email, so the
// push looks fine from here and the site is quietly a version behind. That
// happened, and the owner found out by email.
//
// So this waits and looks: it reads the entry script out of the build it just
// pushed and asks the live site for it until it appears. Either the site is
// serving what was pushed, and it says so, or it is not, and it says that
// too, with what to do about it.
//
// Run: npm run deploy
import { releaseGate } from "./release-gate";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sh = (cmd: string, cwd = ROOT) => execSync(cmd, { cwd, stdio: "inherit" });
const out = (cmd: string, cwd = ROOT) => execSync(cmd, { cwd, encoding: "utf8" }).trim();

const remote = out("git remote get-url origin");
releaseGate(ROOT);
console.log(`\n== building the public beta for ${remote}`);
sh("npm run build:beta");
if (!existsSync(join(ROOT, "dist", "index.html"))) throw new Error("no dist/index.html: the build failed");
// Pages runs Jekyll by default, which drops files and folders starting with an
// underscore; this file turns it off
writeFileSync(join(ROOT, "dist", ".nojekyll"), "");

// a throwaway clone of just the gh-pages branch (or an orphan if it is new),
// dist/ copied in, one commit, force-pushed
const work = mkdtempSync(join(tmpdir(), "range-pages-"));
try {
  sh(`git init -q -b gh-pages "${work}"`);
  sh(`git -C "${work}" remote add origin "${remote}"`);
  // copy dist into the work tree (robocopy on Windows, cp elsewhere)
  if (process.platform === "win32") {
    try {
      execSync(`robocopy "${join(ROOT, "dist")}" "${work}" /E /NFL /NDL /NJH /NJS /NP`, { stdio: "inherit" });
    } catch (e) {
      // robocopy exits 1 for "files copied", which execSync treats as failure
      const code = (e as { status?: number }).status ?? 0;
      if (code > 7) throw e;
    }
  } else sh(`cp -R "${join(ROOT, "dist")}/." "${work}/"`);
  sh(`git -C "${work}" add -A`);
  sh(`git -C "${work}" -c user.name="range-deploy" -c user.email="deploy@local" commit -q -m "Public build ${new Date().toISOString()}"`);
  sh(`git -C "${work}" push -f origin gh-pages`);
  const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(remote);
  if (!m) {
    console.log("\n== pushed (the remote is not a github.com url, so there is nothing to check)");
  } else {
    const site = `https://${m[1]}.github.io/${m[2]}/`;
    console.log(`\n== pushed. Once Pages is on (Settings, Pages, branch gh-pages), the game is at ${site}`);
    await confirmPublished(site);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

/**
 * Wait for Pages to serve the build that was just pushed.
 *
 * The entry script's name carries the build's own hash, so asking the live
 * site for that one file is an exact question: 200 means this build is up,
 * 404 means the site is still serving an older one. Pages usually takes under
 * a minute; a failed build never gets there at all, which is the case worth
 * catching.
 */
async function confirmPublished(site: string): Promise<void> {
  const html = readFileSync(join(ROOT, "dist", "index.html"), "utf8");
  const entry = /src="\.?\/?(assets\/index-[A-Za-z0-9_-]+\.js)"/.exec(html)?.[1];
  if (!entry) {
    console.log("== could not read the build's entry script, so nothing was checked");
    return;
  }
  const url = `${site}${entry}`;
  const deadline = Date.now() + 5 * 60_000;
  process.stdout.write("== waiting for Pages to serve it");
  for (let tries = 0; Date.now() < deadline; tries++) {
    try {
      const r = await fetch(url, { method: "HEAD", cache: "no-store" as RequestCache });
      if (r.ok) {
        console.log(`\n== LIVE: ${site} is serving this build (${entry})`);
        return;
      }
    } catch {
      // the site may be between builds; keep asking
    }
    process.stdout.write(".");
    await new Promise((r) => setTimeout(r, 10_000));
  }
  console.log(`\n== NOT LIVE: ${site} is still serving an older build after five minutes.`);
  console.log("== Pages builds ten times an hour at most, and a build over that limit fails and emails you.");
  console.log("== The push is fine and nothing is lost: run `npm run deploy` again in a while and it will go up.");
  process.exitCode = 1;
}
