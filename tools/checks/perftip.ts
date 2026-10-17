// The low frame rate tip (src/game/perftip.ts, Milestone 627): after hud.json slowTip.seconds of play under its
// `below` frames a second the HUD says so once, naming what is not yet tried, and never again in that browser; a
// machine that keeps up, the menu and a long stall say nothing.
//
// Run on its own: npx tsx tools/checks/perftip.ts.
import hudCfg from "../../src/config/hud.json";
import { SlowTip } from "../../src/game/perftip";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const C = hudCfg.slowTip;
/** a browser's storage, its own */
const store = (): { data: Map<string, string>; getItem: (k: string) => string | null; setItem: (k: string, v: string) => void } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};
/** `secs` of frames at `fps`, the texts said */
const run = (t: SlowTip, fps: number, secs: number, playing = true, scale = 1, preset = "balanced"): string[] => {
  const said: string[] = [];
  for (let i = 0; i < Math.round(fps * secs); i++) {
    const s = t.frame(1 / fps, playing, scale, preset);
    if (s) said.push(s);
  }
  return said;
};

console.log("The low frame rate tip");
{
  const s = store();
  const slow = new SlowTip(s);
  const said = run(slow, 30, C.seconds + 1);
  check(`${C.seconds} s of play at 30 fps: the tip, once, naming Render scale and Competitive`, said.length === 1 && /30 FPS/.test(said[0]) && /RENDER SCALE 70%/.test(said[0]) && /COMPETITIVE/.test(said[0]), said.join(" | "));
  check("and never again in that browser, even after a reload", run(slow, 30, C.seconds * 3).length === 0 && run(new SlowTip(s), 30, C.seconds * 2).length === 0 && s.data.get("range.slowTipShown") === "1");
}
{
  check(`a machine at ${C.below + 15} fps hears nothing`, run(new SlowTip(store()), C.below + 15, C.seconds * 2).length === 0);
  check("time on the menu counts for nothing", run(new SlowTip(store()), 20, C.seconds * 2, false).length === 0);
  const tried = run(new SlowTip(store()), 25, C.seconds + 1, true, 0.6, "competitive");
  check("with both already tried it says fewer bots instead", tried.length === 1 && /FEWER BOTS/.test(tried[0]) && !/RENDER SCALE/.test(tried[0]), tried.join(" | "));
  // a frame over a second is a stall (a tab in the background, a load), not the machine's pace
  const t = new SlowTip(store());
  let stall = 0;
  for (let i = 0; i < C.seconds + 5; i++) if (t.frame(2, true, 1, "balanced")) stall++;
  check("long stalls are not counted as a slow machine", stall === 0);
}

console.log(fails === 0 ? "\nSLOW TIP PASS" : `\nSLOW TIP FAIL (${fails})`);
export const perfTipFails = fails;
