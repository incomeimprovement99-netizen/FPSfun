// Mechanical guard for PROJECT_RULES.md section 1.
// Fails if any tracked source/config/doc file references an Apex/EA/Steam path.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const SKIP_DIRS = new Set(["node_modules", "dist", ".vite", ".git"]);
const PATTERNS: RegExp[] = [
  /Apex Legends[\\/]/i,
  /EA Games/i,
  /Origin Games/i,
  /steamapps/i,
  /Saved Games[\\/]+Respawn/i,
  /r5apex/i,
  /EasyAntiCheat/i,
];
// PROJECT_RULES.md and this file are allowed to name the patterns they forbid.
const ALLOW = new Set(["PROJECT_RULES.md", "tools/rules-check.ts", "docs/FIDELITY.md"]);

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|json|md|html|css)$/.test(name)) out.push(p);
  }
}

const files: string[] = [];
walk(ROOT, files);
let bad = 0;
for (const f of files) {
  const rel = relative(ROOT, f).replace(/\\/g, "/");
  if (ALLOW.has(rel)) continue;
  const text = readFileSync(f, "utf8");
  for (const re of PATTERNS) {
    const m = text.match(re);
    if (m) {
      console.error(`RULES FAIL ${rel}: matches ${re}`);
      bad++;
    }
  }
}
// The bought assets (Unity Asset Store EULA, docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md section 5) are licensed to the
// owner, not to the public: their files may never be tracked, or a push would publish them on GitHub
const paid = execSync("git ls-files public/models/paid public/audio/paid", { cwd: ROOT, encoding: "utf8" }).trim();
if (paid) {
  console.error(`RULES FAIL paid asset files are tracked by git (they must stay local):\n${paid.split("\n").slice(0, 10).join("\n")}`);
  bad++;
}
if (bad) {
  console.error(`${bad} rule violation(s). See PROJECT_RULES.md section 1.`);
  process.exit(1);
}
console.log(`rules ok (${files.length} files scanned)`);
