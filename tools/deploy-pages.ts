// Publish the public build to GitHub Pages: build the beta (codenames only,
// checked), then push dist/ as the `gh-pages` branch of the repo's `origin`.
// Pages serves that branch at https://<user>.github.io/<repo>/ once it is
// switched on in the repo's settings (docs/DEPLOY_GUIDE.md).
//
// Run: npm run deploy
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const sh = (cmd: string, cwd = ROOT) => execSync(cmd, { cwd, stdio: "inherit" });
const out = (cmd: string, cwd = ROOT) => execSync(cmd, { cwd, encoding: "utf8" }).trim();

const remote = out("git remote get-url origin");
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
  if (m) console.log(`\n== pushed. Once Pages is on (Settings, Pages, branch gh-pages), the game is at https://${m[1]}.github.io/${m[2]}/`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
