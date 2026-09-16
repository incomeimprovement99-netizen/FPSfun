// Where the ring puts its circles (src/game/ring.ts, src/config/ring.json).
//
// Two things used to go wrong. A circle could be picked with its edge past the
// map's square, which herded players into sand the controller hard-clamps them
// out of, and the late circles landed on open ground as often as on a place,
// so the end game was a flat plain shoot-out. These run the real Ring over
// hundreds of seeded matches and check both, plus the things that were already
// true and must stay true: every circle nests inside the one before it, and
// the six rounds still carry Apex's documented damage and our scaled clock.
//
// The cover test is a paired one. The same seeds are run twice, once with the
// map's attractors and once with none, so "nearer cover than chance" means
// nearer than the very same draws with the bias switched off.
//
// Run on its own: npx tsx tools/checks/ring-place.ts.
import { readFileSync } from "node:fs";
import { Ring, RING_PHASES, RING_TICK, RING_BOUNDS, RING_ATTRACTORS, type Attractor, type Circle } from "../../src/game/ring";
import cfg from "../../src/config/ring.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}
function near(label: string, got: number, want: number, tol: number): void {
  check(label, Math.abs(got - want) <= tol, `${got.toFixed(2)}, want ${want} +/- ${tol}`);
}

/** the same little LCG the rest of the tools use, so a seed is a whole match */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
};

// brmatch.ts opens the match on a circle 35% wider than the map: everyone is
// inside it, and it is the one circle allowed to hang over the edge.
const START = (): Circle => ({ cx: RING_BOUNDS.centerX, cz: RING_BOUNDS.centerZ, r: RING_BOUNDS.half * 1.35 });
const MATCHES = 300;
const DT = 1 / 30;

const outOfBounds = (c: Circle): number =>
  Math.max(
    0,
    Math.abs(c.cx - RING_BOUNDS.centerX) + c.r - RING_BOUNDS.half,
    Math.abs(c.cz - RING_BOUNDS.centerZ) + c.r - RING_BOUNDS.half
  );
const nests = (a: Circle, b: Circle): boolean => Math.hypot(a.cx - b.cx, a.cz - b.cz) + a.r <= b.r + 1e-6;
const toCover = (c: Circle, from: readonly Attractor[] = RING_ATTRACTORS): number =>
  Math.min(...from.map((a) => Math.hypot(c.cx - a.x, c.cz - a.z)));

// ------------------------------------------------------- the documented rounds
console.log("\nThe six rounds (Apex's damage, our clock: src/config/ring.json)");
{
  // Apex's six rounds and its damage per tick; the waits, the closes and the
  // radii are ours, scaled to a map 440 m across (docs/GAP_ANALYSIS.md 4).
  const want = [
    { wait: 45, close: 60, radius: 140, damage: 3 },
    { wait: 50, close: 45, radius: 80, damage: 4 },
    { wait: 45, close: 35, radius: 45, damage: 10 },
    { wait: 40, close: 30, radius: 22, damage: 15 },
    { wait: 35, close: 25, radius: 10, damage: 20 },
    { wait: 30, close: 40, radius: 0, damage: 25 },
  ];
  check("six rounds", RING_PHASES.length === want.length, `${RING_PHASES.length}`);
  let same = true;
  RING_PHASES.forEach((p, i) => {
    const w = want[i];
    if (!w || p.wait !== w.wait || p.close !== w.close || p.radius !== w.radius || p.damage !== w.damage) same = false;
  });
  check("the waits, closes, radii and damage are unchanged", same, RING_PHASES.map((p) => `${p.wait}/${p.close}/${p.radius}/${p.damage}`).join(" "));
  near("a tick every 1.5 s", RING_TICK, 1.5, 0);
  check(
    "every round is smaller than the last",
    RING_PHASES.every((p, i) => i === 0 || p.radius < RING_PHASES[i - 1].radius),
    RING_PHASES.map((p) => p.radius).join(" > ")
  );
  check("the last round is a point", RING_PHASES[RING_PHASES.length - 1].radius === 0);

  // the whole match on the ring's own clock, run for real
  const r = new Ring(START(), seeded(11));
  let t = 0;
  let ticks = 0;
  while (!r.done && t < 3000) {
    if (r.update(DT)) ticks++;
    t += DT;
  }
  const total = RING_PHASES.reduce((a, p) => a + p.wait + p.close, 0);
  near("a match runs the sum of the waits and the closes", t, total, 0.1);
  near("with a damage tick every RING_TICK of it", ticks, Math.floor(total / RING_TICK), 1);
}

// --------------------------------------------------- the config against br.ts
console.log("\nThe bounds and the cover points against src/game/br.ts");
{
  const src = readFileSync(new URL("../../src/game/br.ts", import.meta.url), "utf8");
  const num = (name: string): number | null => {
    const m = src.match(new RegExp(`export const ${name} = (-?[0-9.]+)`));
    return m ? Number(m[1]) : null;
  };
  check("bounds centre x matches BR_X", num("BR_X") === RING_BOUNDS.centerX, `br.ts ${num("BR_X")}, ring.json ${RING_BOUNDS.centerX}`);
  check("bounds centre z matches BR_Z", num("BR_Z") === RING_BOUNDS.centerZ, `br.ts ${num("BR_Z")}, ring.json ${RING_BOUNDS.centerZ}`);
  check("bounds half-side matches BR_HALF", num("BR_HALF") === RING_BOUNDS.half, `br.ts ${num("BR_HALF")}, ring.json ${RING_BOUNDS.half}`);

  // the poi list: { id: "hub", name: "THE HUB", ...P(0, 0), drops: [...] }
  const pois = [...src.matchAll(/\{ id: "(\w+)", name: "[^"]+", \.\.\.P\((-?\d+(?:\.\d+)?), (-?\d+(?:\.\d+)?)\)/g)].map((m) => ({
    id: m[1],
    x: Number(m[2]),
    z: Number(m[3]),
  }));
  const local = cfg.attractors.map((a) => `${a.x},${a.z}`);
  const missing = pois.filter((p) => !local.includes(`${p.x},${p.z}`)).map((p) => p.id);
  check("br.ts's places all parsed", pois.length >= 9, `${pois.length} found`);
  check("every place is an attractor", pois.length >= 9 && missing.length === 0, missing.length ? `missing ${missing.join(", ")}` : `${pois.length} places`);

  // the roadside stops: the [x, z, kind] table under "the roadside"
  const block = src.match(/const spots: Array<\[number, number, number\]> = \[([\s\S]*?)\];/);
  const stops = block ? [...block[1].matchAll(/\[(-?\d+), (-?\d+), \d+\]/g)].map((m) => `${Number(m[1])},${Number(m[2])}`) : [];
  const lost = stops.filter((s) => !local.includes(s));
  check("br.ts's roadside stops all parsed", stops.length >= 12, `${stops.length} found`);
  check("every roadside stop is an attractor", stops.length >= 12 && lost.length === 0, lost.length ? `missing ${lost.join(" ")}` : `${stops.length} stops`);
  check(
    "every attractor pulls with a positive weight",
    RING_ATTRACTORS.every((a) => a.w > 0),
    `${RING_ATTRACTORS.length} points`
  );
}

// ------------------------------------------------------------- inside the map
console.log(`\nEvery circle inside the map, over ${MATCHES} seeded matches`);
{
  let worstNext = 0;
  let worstNextSeed = 0;
  let worstLive = 0;
  let nested = true;
  let nestSeed = 0;
  let picks = 0;
  for (let seed = 1; seed <= MATCHES; seed++) {
    const ring = new Ring(START(), seeded(seed));
    let t = 0;
    let phase = -1;
    while (!ring.done && t < 3000) {
      if (ring.phase !== phase) {
        phase = ring.phase;
        picks++;
      }
      const over = outOfBounds(ring.next);
      if (over > worstNext) {
        worstNext = over;
        worstNextSeed = seed;
      }
      // the opening circle is wider than the map on purpose, so the live ring
      // is only held to the bounds once round one has finished closing
      if (ring.phase >= 1) worstLive = Math.max(worstLive, outOfBounds(ring.current));
      if (!nests(ring.next, ring.current)) {
        if (nested) nestSeed = seed;
        nested = false;
      }
      ring.update(DT);
      t += DT;
    }
  }
  check("every picked circle sits wholly inside the map", worstNext <= 1e-6, worstNext > 0 ? `${worstNext.toFixed(4)} m over at seed ${worstNextSeed}` : `${picks} circles, none over the edge`);
  check("and so does the live ring from round two on", worstLive <= 1e-6, `worst overshoot ${worstLive.toFixed(4)} m`);
  check("every circle nests inside the one it closes from", nested, nested ? `${picks} picks` : `first broken at seed ${nestSeed}`);
}

// ---------------------------------------------------------- the late circles
console.log(`\nThe late circles lean onto cover (${MATCHES} paired matches, biased against the same draws unbiased)`);
{
  /** the final circle of a match, and the last phase whose radius is still a circle */
  const finals = (attractors: readonly Attractor[]): Circle[] => {
    const out: Circle[] = [];
    for (let seed = 1; seed <= MATCHES; seed++) {
      const ring = new Ring(START(), seeded(seed), attractors);
      let t = 0;
      while (!ring.done && t < 3000) {
        ring.update(DT);
        t += DT;
      }
      out.push({ ...ring.current });
    }
    return out;
  };
  const biased = finals(RING_ATTRACTORS);
  const plain = finals([]);
  const mean = (cs: Circle[]) => cs.reduce((a, c) => a + toCover(c), 0) / cs.length;
  const within = (cs: Circle[], m: number) => cs.filter((c) => toCover(c) <= m).length / cs.length;
  const mb = mean(biased);
  const mp = mean(plain);
  check("the last circle lands nearer cover than the unbiased draw", mb < mp * 0.5, `${mb.toFixed(1)} m vs ${mp.toFixed(1)} m to the nearest attractor`);
  const wb = within(biased, 25);
  const wp = within(plain, 25);
  check("and lands on top of cover (25 m) far more often", wb > wp * 1.5 && wb >= 0.85, `${(wb * 100).toFixed(0)}% vs ${(wp * 100).toFixed(0)}%`);
  const better = biased.filter((c, i) => toCover(c) < toCover(plain[i])).length / MATCHES;
  check("match for match, the bias helps far more often than it hurts", better >= 0.75, `${(better * 100).toFixed(0)}% of matches nearer cover`);

  // ... and it is still a draw, not a rule: the ring must not end in the same
  // place every match, or the last round is a map marker rather than a fight.
  const spots = new Set(biased.map((c) => `${c.cx.toFixed(2)},${c.cz.toFixed(2)}`));
  check("no two matches end on the same spot", spots.size === MATCHES, `${spots.size} distinct end centres in ${MATCHES} matches`);
  const nearest = (c: Circle) =>
    RING_ATTRACTORS.reduce((best, a) => (Math.hypot(c.cx - a.x, c.cz - a.z) < Math.hypot(c.cx - best.x, c.cz - best.z) ? a : best), RING_ATTRACTORS[0]);
  const counts = new Map<string, number>();
  for (const c of biased) {
    const a = nearest(c);
    counts.set(`${a.x},${a.z}`, (counts.get(`${a.x},${a.z}`) ?? 0) + 1);
  }
  const top = Math.max(...counts.values()) / MATCHES;
  // Circles nest, so the end game leans toward the middle of the map whatever
  // the bias does; what matters is that no one place owns the last round.
  check("no one place takes more than a third of the matches", top <= 1 / 3, `the busiest takes ${(top * 100).toFixed(0)}%`);
  check("and the end game reaches cover all over the map", counts.size >= 10, `${counts.size} of ${RING_ATTRACTORS.length} attractors seen`);

  // the rounds before the bias starts must be untouched by it
  const early = (attractors: readonly Attractor[]): number[] => {
    const out: number[] = [];
    for (let seed = 1; seed <= MATCHES; seed++) {
      const ring = new Ring(START(), seeded(seed), attractors);
      out.push(ring.next.cx, ring.next.cz);
    }
    return out;
  };
  const a = early(RING_ATTRACTORS);
  const b = early([]);
  check("round one is drawn the same way it always was", a.every((v, i) => v === b[i]), `fromPhase ${cfg.cover.fromPhase}`);
}

console.log(fails === 0 ? "\nRING PLACE PASS" : `\nRING PLACE FAIL (${fails})`);
export const ringPlaceFails = fails;
if (process.argv[1]?.endsWith("ring-place.ts")) process.exit(fails === 0 ? 0 : 1);
