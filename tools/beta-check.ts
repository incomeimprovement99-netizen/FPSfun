// After `npm run build:beta`: nothing in dist/ may carry a real weapon name,
// the pistol brand, or the game's name (PROJECT_RULES.md section 2: real names
// only while the project is private). Fails the build if any is found.
//
// Run: npm run build:beta   (runs this last)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(HERE, "..");
const DIST = join(ROOT, "dist");
const data = JSON.parse(readFileSync(join(ROOT, "data", "weapons.json"), "utf8")) as { weapons: Record<string, { name: string }> };

const banned = new Set<string>(Object.values(data.weapons).map((w) => w.name));
for (const extra of ["Glock", "Apex", "Respawn Entertainment", "Electronic Arts", "Nemesis", "Bocek", "Turbocharger", "Skullpiercer", "Hammerpoint", "Disruptor", "Selectfire", "Arc Star", "ARC STAR"]) banned.add(extra);

function files(dir: string): string[] {
  const out: string[] = [];
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(js|html|css|json|txt|md)$/.test(f)) out.push(p);
  }
  return out;
}

let bad = 0;
for (const f of files(DIST)) {
  const text = readFileSync(f, "utf8");
  for (const name of banned) {
    // whole words only: "Apex" inside an identifier like climbGreenApex is not the name
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[^A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`);
    const m = re.exec(text);
    const i = m ? m.index + m[1].length : -1;
    if (i >= 0) {
      bad++;
      console.error(`FAIL ${f.slice(DIST.length + 1)}: "${name}" ... ${text.slice(Math.max(0, i - 40), i + 40).replace(/\s+/g, " ")}`);
    }
  }
}
console.log(bad === 0 ? `BETA CHECK PASS: no real names in ${files(DIST).length} files` : `BETA CHECK FAIL (${bad})`);
process.exit(bad === 0 ? 0 : 1);
