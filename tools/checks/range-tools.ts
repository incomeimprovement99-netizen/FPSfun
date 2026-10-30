// The firing range's tools, proven on the real modules (Milestones 917 to 921, from a review of the range):
//   - the flick drill counts one figure a shotgun pull, not each pellet's (it cleared five at once with BIGANTLER);
//   - the fusion key mid-reload ends the reload, as a fuse at a stand does, and a gun lent away and given back keeps its
//     fusion level;
//   - a strafing dummy sidesteps, its legs going the way it moves (it ran forward on the spot);
//   - shooting back gives you a match's shield.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/range-tools.ts (verify runs it that way).
import * as THREE from "three";
import { FlickDrill, DummyBehaviour, RangeCombat } from "../../src/game/rangetools";
import { ProjectileSystem } from "../../src/game/projectile";
import { resolveWeapon } from "../../src/game/weapons";
import { blastOffsets } from "../../src/game/blast";
import { Loadout } from "../../src/game/loadout";
import { Dummy } from "../../src/game/dummy";
import { PROFILE } from "../../src/game/game";
import cfg from "../../src/config/rangetools.json";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The flick drill (src/game/rangetools.ts FlickDrill)");
{
  // one pull of each shotgun, its own pattern, at a figure straight ahead 6 and 10 m out, through the real rounds
  const DEG = Math.PI / 180;
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647), seed / 2147483647);
  const most: Record<string, number> = {};
  for (const id of ["mastiff", "shotgun"]) {
    for (const dist of [6, 10]) {
      const scene = new THREE.Scene();
      const projectiles = new ProjectileSystem(scene, [], [], 0);
      const drill = new FlickDrill(scene, projectiles);
      drill.start(0);
      drill.update(3.01);
      drill.target.group.position.set(cfg.drill.padX, 0, cfg.drill.padZ - dist);
      for (let i = 0; i < 30; i++) drill.target.update(3.01 + i / 60, 1 / 60);
      const w = resolveWeapon(id);
      const eye = new THREE.Vector3(cfg.drill.padX, cfg.board.height, cfg.drill.padZ);
      const pattern = blastOffsets(w, true, rnd)!;
      for (let p = 0; p < w.pellets; p++) {
        const [across, upDeg] = pattern[p % pattern.length];
        const d = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -across * DEG).applyAxisAngle(new THREE.Vector3(1, 0, 0), upDeg * DEG);
        projectiles.fire(eye.clone(), d, w, false);
      }
      let now = 3.6;
      for (let f = 0; f < 60; f++) {
        projectiles.update(1 / 60, now, (e) => {
          if (e.dummy) drill.onHit(e.dummy, now);
        });
        drill.target.update(now, 1 / 60);
        now += 1 / 60;
      }
      most[id] = Math.max(most[id] ?? 0, drill.done);
    }
  }
  check("one shotgun pull clears one drill figure at most, BIGANTLER's and REZ's, at 6 and 10 m", most.mastiff === 1 && most.shotgun <= 1, JSON.stringify(most));
}

console.log("\nFusion (src/game/loadout.ts)");
{
  // the range's key 0.2 s into an R-97's reload: the full magazine fires at once
  const lo = new Loadout(["r97", "vinson"]);
  const st = lo.slots[0].state;
  let t = 10;
  for (let i = 0; i < 30; i++) st.update(1 / 60, (t += 1 / 60), true, false, "stand", "still", false, false, Math.random);
  st.update(1 / 60, (t += 1 / 60), false, false, "stand", "still", false, false, Math.random);
  st.startReload(t);
  const began = t;
  t += 0.2;
  lo.setFusion(0, 1);
  let first: number | null = null;
  for (let i = 0; i < 300 && first === null; i++) if (st.update(1 / 60, (t += 1 / 60), true, false, "stand", "still", false, false, Math.random).length) first = t;
  check("the fusion key mid-reload ends the reload: the full magazine fires at once", first !== null && first - began < 0.5, `first shot ${first === null ? "never" : (first - began).toFixed(2)} s after the reload began`);
  // lent away (THE RUN's pistols) and given back: the level it had
  lo.setFusion(1, 3);
  const kept = lo.setup(1);
  lo.setWeaponId(1, "semipistol");
  lo.restore(1, kept);
  check("a gun given back after a course keeps its fusion level", lo.slots[1].fusion === 3 && lo.slots[1].weapon.clipSize === resolveWeapon("vinson", [], 3).clipSize, `level ${lo.slots[1].fusion}, ${lo.slots[1].weapon.clipSize} rounds`);
}

console.log("\nThe range's dummies (src/game/rangetools.ts DummyBehaviour, RangeCombat)");
{
  const d = new Dummy(4, -30, 30);
  const b = new DummyBehaviour([d]);
  b.mode = "strafe";
  const ways = new Set<string>();
  for (let i = 0; i < 600; i++) {
    b.update(i / 60, 1 / 60);
    const pose = (d as unknown as { pose: { speed: number; moveDir?: number } | null }).pose;
    if (pose && pose.speed > 0.1) ways.add(Math.abs(pose.moveDir ?? 0).toFixed(2));
  }
  check("a strafing dummy sidesteps: its legs go the way it moves, a quarter turn off its facing", ways.size === 1 && ways.has((Math.PI / 2).toFixed(2)), [...ways].join(", ") || "never moved");
  const c = new RangeCombat();
  const want = PROFILE.health?.shield ?? null;
  check("shooting back gives you a match's shield", want !== null && c.shieldMax === want && c.shield === want, `${c.shieldMax} against the game's ${want}`);
}

console.log(fails === 0 ? "\nRANGE TOOLS PASS" : `\nRANGE TOOLS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
