// The slide probe: the real controller (src/game/player.ts) driven through a
// sprint, a slide and a slide jump, frame by frame, with speed, view height
// and stance recorded every frame, written as a page of curves beside the
// Apex Movement Wiki's numbers. So "the slide feels weird" becomes a curve
// someone can point at.
//
// Run: npx tsx tools/slide-probe.ts   (writes shots/slide-probe.html)
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Player, type MoveInput } from "../src/game/player";
import type { Action } from "../src/game/input";
import { RANGE_SOLIDS } from "../src/game/range";
import { HU, MOVE } from "../src/game/movement";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const OUT = resolve(HERE, "..", "shots");
const FPS = 144;
const DT = 1 / FPS;

class Script implements MoveInput {
  down = new Set<Action>();
  taps = new Set<Action>();
  pressed = new Set<Action>();
  held(a: Action): boolean {
    return this.down.has(a) || this.taps.has(a);
  }
  pressedNow(a: Action): boolean {
    return this.pressed.has(a) || this.taps.has(a);
  }
  hold(a: Action): void {
    if (!this.down.has(a)) this.pressed.add(a);
    this.down.add(a);
  }
  release(a: Action): void {
    this.down.delete(a);
  }
  tap(a: Action): void {
    this.taps.add(a);
  }
  end(): void {
    this.pressed.clear();
    this.taps.clear();
  }
}

interface Sample {
  t: number;
  speed: number;
  eye: number;
  stance: string;
}

/** a run: sprint `sprint` s, slide, jump out `jumpAfter` s into the slide (or never) */
function run(label: string, jumpAfter: number | null): { label: string; samples: Sample[]; slideAt: number; jumpAt: number | null } {
  RANGE_SOLIDS.length = 0;
  const p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  const s = new Script();
  const samples: Sample[] = [];
  let t = 0;
  let slideAt = -1;
  let jumpAt: number | null = null;
  s.hold("forward");
  s.tap("sprint");
  for (let i = 0; i < FPS * 4.2; i++) {
    t += DT;
    if (t >= 1.5 && slideAt < 0) {
      s.hold("crouch");
      slideAt = t;
    }
    if (jumpAfter !== null && slideAt > 0 && jumpAt === null && t - slideAt >= jumpAfter) {
      s.tap("jump");
      jumpAt = t;
    }
    p.update(DT, 1000 + t, s, 0, 1, false);
    s.end();
    samples.push({ t, speed: p.speed / HU, eye: p.eyePosition().y - p.pos.y, stance: p.stance });
  }
  return { label, samples, slideAt, jumpAt };
}

const runs = [run("slide, no jump", null), run("slide jump at 0.30 s (in time: keeps the speed)", 0.3), run("slide jump at 0.05 s (a deadslide)", 0.05)];

// the page: an SVG per curve, a line per run, the wiki's numbers drawn across
const W = 900;
const H = 260;
const T0 = 1.2;
const T1 = 4.2;
const colours = ["#3b8bff", "#7ddc8a", "#ff6a4a"];
function chart(title: string, get: (s: Sample) => number, lo: number, hi: number, refs: Array<[number, string]>, unit: string): string {
  const x = (t: number) => ((t - T0) / (T1 - T0)) * W;
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const lines = runs
    .map((r, i) => {
      const pts = r.samples.filter((s) => s.t >= T0).map((s) => `${x(s.t).toFixed(1)},${y(get(s)).toFixed(1)}`).join(" ");
      return `<polyline fill="none" stroke="${colours[i]}" stroke-width="2" points="${pts}"/>`;
    })
    .join("");
  const refLines = refs.map(([v, label]) => `<line x1="0" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="#888" stroke-dasharray="6 4"/><text x="6" y="${y(v) - 4}" fill="#aaa" font-size="12">${label}</text>`).join("");
  const ticks = Array.from({ length: Math.round((T1 - T0) / 0.5) + 1 }, (_, i) => T0 + i * 0.5)
    .map((t) => `<line x1="${x(t)}" x2="${x(t)}" y1="0" y2="${H}" stroke="#2a2f36"/><text x="${x(t) + 3}" y="${H - 4}" fill="#666" font-size="11">${t.toFixed(1)} s</text>`)
    .join("");
  return `<h3>${title} (${unit})</h3><svg width="${W}" height="${H}" style="background:#15181c">${ticks}${refLines}${lines}</svg>`;
}

const legend = runs.map((r, i) => `<span style="color:${colours[i]}">■ ${r.label}</span>`).join(" &nbsp; ");
const html = `<!doctype html><meta charset="utf-8"><title>Slide probe</title>
<body style="background:#0b0d10;color:#e6e6e6;font:14px Segoe UI,sans-serif;padding:16px">
<h2>Slide probe: the real controller, ${FPS} fps, sprint from 0 s, crouch at 1.5 s</h2>
<p>${legend}</p>
${chart("Horizontal speed", (s) => s.speed, 0, 460, [[MOVE.sprintSpeed / HU, "sprint 260"], [MOVE.slideSpeedBoostCap / HU, "slide boost cap"], [MOVE.slideMaxJumpSpeed / HU, "350: jump above it inside 0.24 s = a deadslide"]], "hu/s")}
${chart("View height above the feet", (s) => s.eye, 0.6, 1.8, [[MOVE.eyeStand, "standing eye"], [MOVE.eyeCrouch, "crouched eye"]], "m")}
<p>Stances along the way (the last run): ${runs[2].samples.filter((_, i) => i % 18 === 0 && _.t >= T0).map((s) => `${s.t.toFixed(2)} ${s.stance}`).join(" · ")}</p>
<p>The numbers behind the dashed lines are src/config/movement.json's, checked against the wiki by npm run movesim.</p>
</body>`;
mkdirSync(OUT, { recursive: true });
writeFileSync(resolve(OUT, "slide-probe.html"), html);
for (const r of runs) {
  const peak = Math.max(...r.samples.map((s) => s.speed));
  console.log(`${r.label.padEnd(50)} peak ${peak.toFixed(0)} hu/s, at 4.2 s ${r.samples[r.samples.length - 1].speed.toFixed(0)} hu/s`);
}
console.log(`wrote ${resolve(OUT, "slide-probe.html")}`);
