// SpeedKills' movement, driven frame by frame through the real controller
// (src/game/player.ts) with SpeedKills' overlay on (src/config/
// movement.speedkills.json; docs/PHASE_18_PLAN_SPEEDKILLS.md 7.2).
//
// The legacy game's movement is tools/movesim.ts, which holds it to Apex's
// measured numbers; this holds SpeedKills to what the city asks of it: a
// storey is about 4 m, and the targets are the things a player must be able
// to do on the roofs. It runs in its own process with GAME=speedkills, since
// the movement numbers are read once when the module loads.
//
// Run on its own: GAME=speedkills npx tsx tools/sk-movesim.ts (npm run verify runs it).
import { Player, type MoveInput } from "../src/game/player";
import type { Action } from "../src/game/input";
import { RANGE_SOLIDS } from "../src/game/range";
import { ZIPLINES } from "../src/game/traversal";
import { HU, MOVE } from "../src/game/movement";
import { GAME } from "../src/game/game";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

class Script implements MoveInput {
  private down = new Set<Action>();
  private pressed = new Set<Action>();
  private taps = new Set<Action>();
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
  endFrame(): void {
    this.pressed.clear();
    this.taps.clear();
  }
}

type Box = { minX: number; maxX: number; minZ: number; maxZ: number; top: number; base?: number };
const DT = 1 / 144;

class Sim {
  p = new Player({ minX: -500, maxX: 500, minZ: -500, maxZ: 500 });
  in = new Script();
  t = 1000;
  constructor(solids: Box[] = []) {
    RANGE_SOLIDS.length = 0;
    for (const s of solids) RANGE_SOLIDS.push({ ...s, base: s.base ?? 0 });
    ZIPLINES.length = 0;
    // SpeedKills' baseline, as main.ts sets it on a SpeedKills page
    this.p.extraMoves = true;
    this.p.autoClimb = true;
  }
  run(seconds: number, each?: (frame: number) => void): void {
    const n = Math.round(seconds / DT);
    for (let i = 0; i < n; i++) {
      each?.(i);
      this.t += DT;
      this.p.update(DT, this.t, this.in, 0, 1, false);
      this.in.endFrame();
    }
  }
}

console.log(`\nSpeedKills movement (game: ${GAME})`);
check("this runs with SpeedKills' numbers", GAME === "speedkills");

// sprint
{
  const s = new Sim();
  s.in.hold("forward");
  s.in.tap("sprint");
  s.run(3);
  const hu = s.p.speed / HU;
  check("sprint is SpeedKills' 275 hu/s (7 m/s)", Math.abs(hu - 275) < 0.5, `${hu.toFixed(1)} hu/s`);
}

// a one-storey roof (4 m), run straight at: auto-climb takes you up without a jump
{
  const wall: Box = { minX: -10, maxX: 10, minZ: -30, maxZ: -6, top: 4 };
  const s = new Sim([wall]);
  s.p.teleport(0, 0, 0, 0);
  s.in.hold("forward");
  s.in.tap("sprint");
  let climbed = false;
  s.run(4, () => {
    if (s.p.climbing) climbed = true;
  });
  check("run at a 4 m wall and you climb it, no jump pressed", climbed, `on top at y=${s.p.pos.y.toFixed(2)}`);
  check("and you end up on its roof", s.p.pos.y > 3.9 && s.p.pos.z < -6.5, `y=${s.p.pos.y.toFixed(2)} z=${s.p.pos.z.toFixed(2)}`);
}

// a low wall (1 m) is mantled or stepped over, not climbed
{
  const s = new Sim([{ minX: -10, maxX: 10, minZ: -30, maxZ: -6, top: 1 }]);
  s.p.teleport(0, 0, 0, 0);
  s.in.hold("forward");
  let climbed = false;
  s.run(3, () => {
    if (s.p.climbing) climbed = true;
  });
  check("a waist-high wall is not climbed: auto-climb is for walls too tall to mantle", !climbed);
}

// two storeys: how high a jump, a double jump and a climb reach
{
  // the approach a player takes: a run-up, the jump a few metres out, the double jump on the way in, then the climb
  let best = 0;
  for (const h of [5, 6, 7, 8, 8.5, 9, 10]) {
    for (const out of [1.5, 2.5, 3.5]) {
      for (const dj of [0.2, 0.3, 0.4]) {
        const s = new Sim([{ minX: -10, maxX: 10, minZ: -40, maxZ: -6, top: h }]);
        s.p.teleport(0, 0, 14, 0);
        s.in.hold("forward");
        s.in.tap("sprint");
        let jumpedAt = -1;
        s.run(5, () => {
          if (jumpedAt < 0 && s.p.onGround && s.p.pos.z < -6 + out) {
            s.in.tap("jump");
            jumpedAt = s.t;
          } else if (jumpedAt > 0 && s.t - jumpedAt >= dj && s.t - jumpedAt < dj + 1 / 144 && !s.p.climbing) s.in.tap("jump");
        });
        if (s.p.pos.y > h - 0.1) best = Math.max(best, h);
      }
    }
  }
  check("a jump, a double jump and a climb reach a two-storey roof (8 m)", best >= 8, `highest roof reached ${best} m`);
}

// the street: roof to roof over a gap, running, jump then double jump at the peak
{
  let best = 0;
  for (const gap of [6, 7, 8, 9, 10, 11, 12]) {
    const s = new Sim([
      { minX: -10, maxX: 10, minZ: -2, maxZ: 40, top: 10 },
      { minX: -10, maxX: 10, minZ: -80, maxZ: -2 - gap, top: 10 },
    ]);
    s.p.teleport(0, 10, 30, 0);
    s.in.hold("forward");
    s.in.tap("sprint");
    // take off at the edge
    s.run(10, (i) => {
      if (s.p.onGround && s.p.pos.z < -1.2 && s.p.pos.y > 9.9) s.in.tap("jump");
      if (!s.p.onGround && s.p.vel.y < 0 && s.p.pos.z < -2 && i % 20 === 0) s.in.tap("jump");
    });
    if (s.p.pos.y > 9.5 && s.p.pos.z < -2 - gap) best = gap;
  }
  check("running, a jump and a double jump cross a 9 m street roof to roof", best >= 9, `widest gap crossed ${best} m`);
}

// no fall stun: off a 30 m roof and running at once
{
  const s = new Sim([{ minX: -10, maxX: 10, minZ: -10, maxZ: 10, top: 0.01 }]);
  s.p.teleport(0, 30, 0, 0);
  let stunned = false;
  s.run(4, () => {
    if (s.p.stunned) stunned = true;
  });
  check("a drop of 30 m lands without a stun", !stunned && s.p.onGround);
}

// the numbers themselves, so a change to the overlay is seen
check("gravity is lighter than the legacy game's 750 hu/s^2", MOVE.gravity < 750 * HU, `${(MOVE.gravity / HU).toFixed(0)}`);

console.log(fails === 0 ? "\nSK MOVESIM PASS" : `\nSK MOVESIM FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
