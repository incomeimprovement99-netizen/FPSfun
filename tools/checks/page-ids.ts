// The page's element ids, each used once (Milestone 711): the menu's Voice chat slider was given the id of the callouts'
// slider beside it, so the code that looks a slider up by its id found the callouts' one both times. The callouts'
// slider set the voice chat's volume too, and the voice chat's own did nothing. A browser keeps no count of this.
//
// Run on its own: npx tsx tools/checks/page-ids.ts.
import { readFileSync } from "node:fs";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The page's element ids");
const html = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const seen = new Map<string, number>();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
const twice = [...seen].filter(([, n]) => n > 1).map(([id, n]) => `${id} x${n}`);
check("every id in index.html is used once, so looking one up finds the element meant", seen.size > 100 && twice.length === 0, twice.length ? twice.join(", ") : `${seen.size} ids`);

export const pageIdsFails = fails;
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) process.exitCode = fails ? 1 : 0;
