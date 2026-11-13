// Movement lines over the Neon City (docs/PLAN_MAP_TO_8.md step 2): a named route a player is meant to be able to run
// at SpeedKills' speed, driven here with the game's real Player over the bake's collision, timed, and failed when it no
// longer goes. The fresh reviews score pictures and the map's other checks walk doors, pads and ropes; nothing ran a
// roof route or a wall, so a prop on a line or a roof moved out of a leap's reach showed nowhere. A line is data
// (neonmap.json rules.lines): where it starts, the points it goes by and how each is reached, where it ends, and the
// seconds it may take.
//
// As a check: tools/checks/sk-neon.ts runs every line of rules.lines with runLine below.
// As a tool, to try a line or a change before a bake:
//   GAME=speedkills npx tsx tools/neon-lines.ts            every line of rules.lines
//   ONLY=id                 one line
//   LINES=file.json         lines from a file instead (the same shape as rules.lines)
//   SOLIDS=file.json        another collision file (a snapshot's)
//   EXTRA=file.json         boxes added to the collision, [[minX, maxX, minZ, maxZ, base, top], ...] in the map's metres
//   LESS=file.json          boxes taken out first: every collision box whose middle is inside one of these
//   TRACE=1                 where the body is every quarter second
import type { Player as PlayerT } from "../src/game/player";
import type { Action } from "../src/game/input";

/** how a point is reached: on foot (a mantle or a climb comes by itself), with a jump off an edge, with a second jump at
 * the first's top, along a wall, or off an edge with no jump */
export type How = "run" | "jump" | "double" | "wall" | "drop";
/** a point of a line: x, z in the map's metres, how it is reached, and the height the body should be at there */
export type Via = [number, number, How, number?];
export interface Line {
  id: string;
  name: string;
  /** feet: x, y, z in the map's metres */
  from: [number, number, number];
  via: Via[];
  /** seconds it may take */
  within: number;
  /** metres of it that must be run along a wall, where the line is a wall's */
  wall?: number;
  /** how near a point counts as reached, metres (1.2 where none) */
  reach?: number;
  _note?: string;
}
export interface Ran {
  ok: boolean;
  /** seconds it took, or the budget where it did not arrive */
  time: number;
  /** how many of its points were reached */
  reached: number;
  /** where it stood when it ended */
  at: [number, number, number];
  wallMetres: number;
  topSpeed: number;
  why: string;
  trace: string[];
}
interface Deps {
  Player: new (b: { minX: number; maxX: number; minZ: number; maxZ: number }) => PlayerT;
  /** the collision boxes over a rectangle, world metres */
  solidsIn: (minX: number, maxX: number, minZ: number, maxZ: number) => Array<{ minX: number; maxX: number; minZ: number; maxZ: number; base: number; top: number }>;
  floorAt: (x: number, z: number) => number;
  BR_X: number;
  BR_Z: number;
  trace?: boolean;
}

const DT = 1 / 144;

/**
 * Run one line with the real Player. The driver is as simple as a player's own hands: it faces the next point and holds
 * forward (SpeedKills sprints by itself), jumps where the floor ends ahead of it when the point is a jump's, jumps again
 * at the top of the first when it is a double's, and on a wall holds along it and kicks off at the point.
 */
export function runLine(d: Deps, line: Line): Ran {
  const p = new d.Player({ minX: d.BR_X - 400, maxX: d.BR_X + 400, minZ: d.BR_Z - 400, maxZ: d.BR_Z + 400 });
  p.extraMoves = true;
  p.autoClimb = true;
  p.sprintMode = "always";
  const reach = line.reach ?? 1.2;
  const first = line.via[0];
  const yawTo = (x: number, z: number): number => (Math.atan2(-(x + d.BR_X - p.pos.x), -(z + d.BR_Z - p.pos.z)) * 180) / Math.PI;
  p.teleport(line.from[0] + d.BR_X, line.from[1], line.from[2] + d.BR_Z, 0);
  p.yaw = yawTo(first[0], first[1]);
  const down = new Set<Action>();
  const pressed = new Set<Action>();
  const input = { held: (a: Action) => down.has(a), pressedNow: (a: Action) => pressed.has(a) };
  // the top of what is under a spot, no higher than a step over the feet (the street where nothing is)
  const under = (x: number, z: number, feet: number): number => {
    let top = d.floorAt(x, z);
    for (const s of d.solidsIn(x - 0.15, x + 0.15, z - 0.15, z + 0.15)) if (s.minX < x + 0.15 && s.maxX > x - 0.15 && s.minZ < z + 0.15 && s.maxZ > z - 0.15 && s.top <= feet + 0.4 && s.top > top) top = s.top;
    return top;
  };
  let t = 1000;
  let i = 0;
  let wallMetres = 0;
  let topSpeed = 0;
  let second = false; // the second jump of this point's is spent
  let kicked = false; // the kick off a wall is made, until the body stands or runs a wall again
  let held = 0; // seconds it has stood against something on the ground
  const trace: string[] = [];
  const steps = Math.round(line.within / DT);
  for (let n = 0; n < steps; n++) {
    const [wx, wz, how, wy] = line.via[i];
    const dx = wx + d.BR_X - p.pos.x;
    const dz = wz + d.BR_Z - p.pos.z;
    const far = Math.hypot(dx, dz);
    // reached: near it, at its height where one is named, and standing unless the point is a wall's end (the kick is made there)
    const level = wy === undefined || Math.abs(p.pos.y - wy) < 1.25;
    // (a drop's point is passed in the air as well: the body lands past it)
    if (far < reach && (level || how === "drop") && (p.onGround || how === "wall" || how === "drop" || line.via[i + 1]?.[2] === "wall")) {
      i++;
      second = false;
      if (i >= line.via.length) return { ok: (line.wall ?? 0) <= wallMetres + 1e-6, time: +(n * DT).toFixed(2), reached: i, at: [+(p.pos.x - d.BR_X).toFixed(2), +p.pos.y.toFixed(2), +(p.pos.z - d.BR_Z).toFixed(2)], wallMetres: +wallMetres.toFixed(1), topSpeed: +topSpeed.toFixed(1), why: (line.wall ?? 0) <= wallMetres ? "" : `only ${wallMetres.toFixed(1)} m of it along a wall, ${line.wall} asked`, trace };
      continue;
    }
    p.yaw = yawTo(wx, wz);
    down.clear();
    down.add("forward");
    const speed = Math.hypot(p.vel.x, p.vel.z);
    if (p.onGround) {
      second = false;
      kicked = false;
      if (how === "jump" || how === "double" || how === "wall") {
        // the floor ends ahead: a lead that grows with the speed, so the jump leaves from the edge and not past it
        const lead = 0.35 + speed * 0.03;
        const [ax, az] = [p.pos.x + (dx / far) * lead, p.pos.z + (dz / far) * lead];
        // (a wall's line from the ground: off the ground as soon as there is speed to run it with, an edge or none)
        if (under(ax, az, p.pos.y) < p.pos.y - 0.5 || (how === "wall" && speed > 7)) pressed.add("jump");
      }
      // stood against something a mantle clears (a roof's kerb, a box): a jump at it, as a player's thumb would
      held = speed < 2.5 ? held + DT : 0;
      if (held > 0.12 && how !== "drop") {
        pressed.add("jump");
        held = 0;
      }
    } else if (p.onWall) {
      // along the wall to its point, then off it: the kick goes where the body looks, at the point after this one
      if (how === "wall" && far < reach + 1.5 && !kicked && line.via[i + 1]) {
        const nx = line.via[i + 1];
        p.yaw = yawTo(nx[0], nx[1]);
        pressed.add("jump");
        kicked = true;
        // (the wall's point is the kick: the body is in the air past it from here, on its way to the next)
        i++;
      }
    } else if (how === "double" && !second && p.vel.y <= 0.3) {
      pressed.add("jump");
      second = true;
    }
    const [bx, bz] = [p.pos.x, p.pos.z];
    t += DT;
    p.update(DT, t, input, 0, 1, false);
    pressed.clear();
    const moved = Math.hypot(p.pos.x - bx, p.pos.z - bz);
    if (p.onWall) wallMetres += moved;
    topSpeed = Math.max(topSpeed, Math.hypot(p.vel.x, p.vel.z));
    if (d.trace && n % 36 === 0) trace.push(`${(n * DT).toFixed(2)}s to ${i} (${(p.pos.x - d.BR_X).toFixed(1)}, ${p.pos.y.toFixed(1)}, ${(p.pos.z - d.BR_Z).toFixed(1)}) ${speed.toFixed(1)} m/s ${p.onGround ? "ground" : p.onWall ? "WALL" : p.stance}`);
  }
  const [wx, wz, how] = line.via[i];
  return { ok: false, time: line.within, reached: i, at: [+(p.pos.x - d.BR_X).toFixed(2), +p.pos.y.toFixed(2), +(p.pos.z - d.BR_Z).toFixed(2)], wallMetres: +wallMetres.toFixed(1), topSpeed: +topSpeed.toFixed(1), why: `stopped before point ${i + 1} of ${line.via.length} (${wx}, ${wz}, by ${how})`, trace };
}

// ---------------------------------------------------------------- as a tool
if (process.argv[1]?.replace(/\\/g, "/").endsWith("tools/neon-lines.ts")) {
  const { readFileSync } = await import("node:fs");
  const THREE = await import("three");
  // (the map builds its boards on a canvas: none here, as tools/checks/sk-neon.ts)
  const g = globalThis as unknown as Record<string, unknown>;
  const anyProxy = (): unknown =>
    new Proxy(function () {}, {
      get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
      set: () => true,
      apply: () => anyProxy(),
    });
  const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
  if (!("document" in g)) g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
  const warn = console.warn;
  console.warn = () => undefined;
  const { buildNeonMap } = await import("../src/game/neonmap");
  const { Player } = await import("../src/game/player");
  const { BR_X, BR_Z } = await import("../src/game/br");
  const { solidsIn } = await import("../src/game/solidgrid");
  const { floorAt } = await import("../src/game/floors");
  const cfg = (await import("../src/config/neonmap.json")).default as unknown as { rules: { lines?: Line[] } };
  const read = (f: string): unknown => JSON.parse(readFileSync(f, "utf8"));
  let boxes = (process.env.SOLIDS ? (read(process.env.SOLIDS) as { solids: number[][] }) : ((await import("../src/config/neon/neonmap.solids.json")).default as { solids: number[][] })).solids;
  if (process.env.LESS) {
    const less = read(process.env.LESS) as number[][];
    const before = boxes.length;
    boxes = boxes.filter((b) => !less.some((r) => (b[0] + b[1]) / 2 > r[0] && (b[0] + b[1]) / 2 < r[1] && (b[2] + b[3]) / 2 > r[2] && (b[2] + b[3]) / 2 < r[3] && (b[4] + b[5]) / 2 > r[4] && (b[4] + b[5]) / 2 < r[5]));
    console.log(`taken out: ${before - boxes.length} boxes`);
  }
  if (process.env.EXTRA) boxes = boxes.concat(read(process.env.EXTRA) as number[][]);
  buildNeonMap(new THREE.Scene(), boxes);
  console.warn = warn;
  const lines = ((process.env.LINES ? read(process.env.LINES) : cfg.rules.lines) as Line[] | undefined) ?? [];
  let fails = 0;
  for (const line of lines) {
    if (process.env.ONLY && line.id !== process.env.ONLY) continue;
    const r = runLine({ Player, solidsIn, floorAt, BR_X, BR_Z, trace: !!process.env.TRACE }, line);
    if (!r.ok) fails++;
    console.log(`${r.ok ? "  ok  " : "FAIL  "}${line.id}: ${line.name}: ${r.ok ? `${r.time} s of ${line.within}` : r.why}; ended at (${r.at.join(", ")}), ${r.wallMetres} m along walls, top speed ${r.topSpeed} m/s`);
    for (const s of r.trace) console.log("        " + s);
  }
  console.log(fails ? `\nLINES FAIL (${fails})` : `\nLINES PASS (${lines.length})`);
  process.exit(fails ? 1 : 0);
}
