// What the player hears, proven on the real mixer (src/game/audio.ts) over a stand-in Web Audio graph that keeps every
// node and gain (Milestones 924 to 926, from a review of the sound and the captions):
//   - a slider at 0 silences what it names, its reverb too: at Effects 0 every gun, blast and footstep still played as
//     its tail, the reverb joining the master past the buses, and at Hits 0 the knock;
//   - the kill chime is a hit sound, on the Hit sounds slider;
//   - a sound the voice limit refuses is not captioned;
//   - someone else's reload is heard where they are;
//   - a battle royale's ping plays the ping's own tick, not the hit marker's.
//
// It sets the page's globals for itself, so it runs in a process of its own: npx tsx tools/checks/sound.ts (verify runs
// it that way).
import { readFileSync } from "node:fs";
import { MockCtx, nodes, paths, type MockNode } from "./mock-audio";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const store = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
g.AudioContext = MockCtx;
g.fetch = () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) });

const { GameAudio } = await import("../../src/game/audio");
const audioCfg = (await import("../../src/config/audio.json")).default;
const a = new GameAudio();
a.unlock();
const A = a as unknown as Record<string, MockNode | number>;

/** how many of what `play` made reach the speakers with any gain at all */
function heard(play: () => void): number {
  const before = nodes.length;
  play();
  const names = new Map<MockNode, string>();
  let n = 0;
  for (const s of nodes.slice(before).filter((x) => x.kind === "osc" || x.kind === "bufsrc")) for (const p of paths(s, names)) if (p.gain > 0) n++;
  return n;
}

console.log("The sliders (src/game/audio.ts)");
{
  const effects = {
    "your R-97": () => a.gun("r97"),
    "an enemy's R-97 15 m off": () => a.gun("r97", { x: 15, y: 1, z: 0 }),
    "a frag 20 m off": () => a.blast("frag", { x: 20, y: 0, z: 0 }),
    "a footstep 5 m off": () => a.footstep("concrete", { x: 5, y: 0, z: 0 }),
  };
  a.setVolumes({ master: 0.8, effects: 1, hits: 1 });
  const loud = Object.entries(effects).map(([k, f]) => [k, heard(f)] as const);
  a.setVolumes({ master: 0.8, effects: 0, hits: 1 });
  const quiet = Object.entries(effects).map(([k, f]) => [k, heard(f)] as const);
  check("Effects at 0 silences guns, blasts and footsteps, their reverb too (each is heard at 1)", loud.every(([, n]) => n > 0) && quiet.every(([, n]) => n === 0), JSON.stringify(Object.fromEntries(quiet)));
  a.setVolumes({ master: 0.8, effects: 1, hits: 0 });
  const hits = { knock: heard(() => a.knock()), shieldBreak: heard(() => a.shieldBreak()), killChime: heard(() => a.eliminate()) };
  check("Hits at 0 silences the knock, a shield breaking and the kill chime", Object.values(hits).every((n) => n === 0), JSON.stringify(hits));
  a.setVolumes({ master: 0.8, effects: 1, hits: 1 });
}

console.log("\nCaptions for what is played (src/game/audio.ts cue)");
{
  const cued: Array<{ id: string; at: boolean }> = [];
  a.onCue = (id, at) => void cued.push({ id, at: !!at });
  // every voice taken: a pickup and a restore's beacon are refused (the knock and the ring's horn go past the limit, as
  // the sounds that must be heard do), and what was refused is not written down
  const was = A.voices as number;
  A.voices = audioCfg.maxVoices;
  a.pickup();
  a.beacon({ x: 3, y: 0, z: 0 });
  a.knock();
  const full = cued.splice(0).map((c) => c.id);
  A.voices = was;
  check("a sound the voice limit refuses is not captioned (a pickup, a restore), and one it lets through is (a knock)", !full.includes("pickup") && !full.includes("revive") && full.includes("knock"), full.join(", ") || "none");
  a.reloadAt({ x: 4, y: 1, z: 0 });
  const reload = cued.splice(0);
  check("someone else's reload is played and captioned where they are", reload.some((c) => c.id === "reload" && c.at), JSON.stringify(reload));
}

console.log("\nThe battle royale's ping (src/main.ts)");
{
  const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  const line = /sound: \(k\) => \(k === "ping" \? audio\.([a-zA-Z]+)\(/.exec(main);
  check("a ping plays the ping's own tick, not the hit marker's", line?.[1] === "pingTick", line?.[1] ?? "no ping sound found");
}

console.log("\nThe battle royale's announcer (src/main.ts)");
{
  const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  // (Milestone 926) the drop said once the ship is shown: under the loading screen it was said to nobody, and its
  // cooldown kept it from the ship's flight
  check("the drop is said once the ship is shown, not under the loading screen", /dropping: dropping && !show/.test(main));
}

console.log(fails === 0 ? "\nSOUND PASS" : `\nSOUND FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
