// Mechanical guard for PROJECT_RULES.md section 1.
// Fails if any tracked source/config/doc file references an Apex/EA/Steam path.
import { readdirSync, readFileSync, statSync } from "node:fs";
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
if (bad) {
  console.error(`${bad} rule violation(s). See PROJECT_RULES.md section 1.`);
  process.exit(1);
}
console.log(`rules ok (${files.length} files scanned)`);
