// The city's files whole (tools/citybake.ts, Milestone 628): a GLB says its own length in its header, so a file cut
// short or still being written is told from a whole one, and a missing kit is named. The deploy refuses to ship
// without every kit of the committed map version whole; the live check holds the site's to the same.
//
// Run on its own: npx tsx tools/checks/citybake.ts.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CITY_KITS, cityBakeProblems, cityFile, glbHeaderProblem, tutorialDressProblems, tutorialFile } from "../citybake";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** a GLB of `size` bytes whose header says `said` */
function glb(size: number, said = size, magic = "glTF"): Uint8Array {
  const b = new Uint8Array(size);
  for (let i = 0; i < 4; i++) b[i] = magic.charCodeAt(i);
  const v = new DataView(b.buffer);
  v.setUint32(4, 2, true);
  v.setUint32(8, said, true);
  return b;
}

console.log("The city's files whole");
check("a whole GLB passes", glbHeaderProblem(glb(64), 64) === null);
check("one cut short is caught (its header says more than there is)", /cut short/.test(glbHeaderProblem(glb(64, 4096), 64) ?? ""));
check("a page where the file should be is caught", /not "glTF"/.test(glbHeaderProblem(glb(64, 64, "<!do"), 64) ?? ""));
check("nothing there is caught", /not a GLB header/.test(glbHeaderProblem(new Uint8Array(0), 0) ?? ""));
{
  const dir = mkdtempSync(join(tmpdir(), "citybake-"));
  try {
    const put = (kit: string, b: Uint8Array) => {
      const f = join(dir, cityFile(93, kit));
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, b);
    };
    put("lo", glb(128));
    put("hi", glb(256));
    const missingMax = cityBakeProblems(dir, 93);
    check("a release without its High file is refused, naming it", missingMax.length === 1 && /v93-max\.glb is missing/.test(missingMax[0]), missingMax.join("; "));
    put("max", glb(512, 9000));
    const halfMax = cityBakeProblems(dir, 93);
    check("and one with its High file half copied", halfMax.length === 1 && /max/.test(halfMax[0]) && /cut short/.test(halfMax[0]), halfMax.join("; "));
    put("max", glb(512));
    check(`with ${CITY_KITS.join(", ")} whole it may ship`, cityBakeProblems(dir, 93).length === 0);
    check("and an older version's files do not count for a newer one", cityBakeProblems(dir, 94).length === 3);
    // the tutorial's dressing (Milestone 634): missing, cut short, whole
    const missingTutorial = tutorialDressProblems(dir, 1);
    check("a release without the tutorial's dressing is refused, naming it", missingTutorial.length === 1 && /tutorial-v1\.glb is missing/.test(missingTutorial[0]), missingTutorial.join("; "));
    const t = join(dir, tutorialFile(1));
    writeFileSync(t, glb(256, 4000));
    check("and one with it cut short", tutorialDressProblems(dir, 1).length === 1 && /cut short/.test(tutorialDressProblems(dir, 1)[0]));
    writeFileSync(t, glb(256));
    check("whole, it may ship", tutorialDressProblems(dir, 1).length === 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(fails === 0 ? "\nCITY FILES PASS" : `\nCITY FILES FAIL (${fails})`);
export const cityBakeFails = fails;
