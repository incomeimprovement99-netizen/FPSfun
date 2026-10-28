// What the frame sounds like: each frame's state turned into the sounds that
// go with it. Footsteps (yours and every figure's, by surface), jumps and
// landings, the slide's scrape, the zipline, climbing taps and the mantle, the
// drop's wind, a heal's hum, the low-health heartbeat (and how much colour the
// picture should lose with it), the countdown's beeps, the ring's horn, the
// round and match stingers, and the parts of a reload. The sounds themselves
// are audio.ts's; this decides when.
import cfg from "../config/audio.json";
import figureCfg from "../config/figure.json";
import type { GameAudio, Surface } from "./audio";
import type { Player } from "./player";
import { airborne, type Dummy, type FigureStance } from "./dummy";
import type { DuelHud } from "./duel";
import { HU } from "./movement";

export interface SoundFrame {
  now: number;
  dt: number;
  player: Player;
  /** the game is being played (not the menu) or a match is on */
  live: boolean;
  /** the battle royale's map: dirt underfoot */
  outdoors: boolean;
  /** the match's HUD numbers, or null outside one */
  match: DuelHud | null;
  alive: boolean;
  health: number;
  /** other figures to hear walking */
  figures: Dummy[];
  /** where the ears are: the camera, which is the one watched once you are out (Milestone 734) */
  ear: { x: number; z: number };
  /** a heal in progress, 0..1, or null */
  heal: number | null;
  /** the gun in hand: reloading, how far, and whether from empty */
  reload: { on: boolean; progress: number; empty: boolean };
}

/**
 * A wall run's stride at `speed` (audio.json footsteps.wall): the sprint's, while the figure's legs keep up with the
 * speed, and longer once they are held at figure.json wallRun.mostRate of the loop's own pace
 */
export function wallStride(speed: number): number {
  return cfg.footsteps.sprintStride * Math.max(1, speed / (cfg.footsteps.wall.legsAt * figureCfg.wallRun.mostRate));
}

/** what is under a pair of feet */
export function surfaceAt(y: number, outdoors: boolean): Surface {
  // the ground outdoors is dirt; the metro's floor under it (y well under 0) is concrete
  if (outdoors) return y < 0.05 && y > -0.5 ? "dirt" : "concrete";
  return y < 0.05 ? "concrete" : "metal";
}

export class Soundscape {
  private stepAcc = 0;
  /** your double jumps counted so far (player.ts airJumps): one more is a puff */
  private airJumpsWas = -1;
  private wasGround = true;
  private lastStance = "stand";
  private climbTapAt = 0;
  private others = new WeakMap<Dummy, number>();
  /** each figure's stance and height last frame, and how fast it was falling while in the air (their landings' weight) */
  private otherMove = new WeakMap<Dummy, { stance: string; y: number; vy: number; airJumps: number }>();
  /** the others' movement sounds lately played, newest last (tools/e2e.ts) */
  readonly othersHeard: string[] = [];
  private heard(kind: string): void {
    this.othersHeard.push(kind);
    if (this.othersHeard.length > 20) this.othersHeard.shift();
  }
  private lastPhase: string | null = null;
  private lastCount = -1;
  private ringWasClosing = false;
  private reloadMarks = { out: false, in: false, bolt: false };
  private wasReloading = false;
  private placementPlayed = false;
  /** 0..1: how much colour the picture loses (low health) */
  desat = 0;

  constructor(private audio: GameAudio) {}

  update(f: SoundFrame): void {
    const p = f.player;
    const a = this.audio;
    if (!f.live) {
      a.stopLoops();
      this.desat = 0;
      return;
    }
    // ---- your feet
    const surface = surfaceAt(p.pos.y, f.outdoors);
    if (p.onGround && !p.sliding && p.speed > 0.5 && f.alive) {
      this.stepAcc += p.speed * f.dt;
      const st = cfg.footsteps;
      const stride = p.crouched ? st.crouchStride : p.sprinting ? st.sprintStride : st.walkStride;
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        a.footstep(surface, null, p.crouched ? 0.45 : p.sprinting ? 1.15 : 0.8);
      }
    } else if (p.onWall && p.speed > 0.5 && f.alive) {
      // your feet along a wall (Milestone 707): a wall run was silent
      this.stepAcc += p.speed * f.dt;
      const stride = wallStride(p.speed);
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        a.footstep("concrete", null, cfg.footsteps.wall.loud);
      }
    } else if (!p.onGround) this.stepAcc = 0;
    if (p.onGround && !this.wasGround && f.alive) a.land(p.landingSpeed / (600 * HU), surface);
    if (!p.onGround && this.wasGround && p.vel.y > 2 && !p.dropping) a.jump();
    // a double jump (Milestone 713): it was silent
    if (this.airJumpsWas >= 0 && p.airJumps > this.airJumpsWas && f.alive) a.airJump();
    this.airJumpsWas = p.airJumps;
    this.wasGround = p.onGround;
    const stance = p.stance;
    if (stance === "mantle" && this.lastStance !== "mantle") a.mantle();
    // The zipline had a loop and no start. Stepping on is the moment the ride
    // reads as a decision, and on the battle royale map it is also the tell
    // that gives a rotating squad away, so it is a placed sound and not a
    // menu click.
    if (stance === "zip" && this.lastStance !== "zip") a.zipOn(p.pos, true);
    if (stance === "climb" && f.now >= this.climbTapAt) {
      this.climbTapAt = f.now + 0.22;
      a.climbTap();
    }
    this.lastStance = stance;
    // ---- loops: the slide, the zipline, the drop's wind, a heal
    a.loop("slide", p.sliding ? Math.min(0.5, (p.speed / 10) * 0.5) : 0, 0.8 + p.speed / 15);
    a.loop("zip", p.onZip ? 0.22 : 0, 0.7 + p.speed / 12);
    // the drop's wind, and on the ship its engines, the same loop low and slow
    a.loop("wind", p.dropping ? 0.3 : p.aboard ? 0.2 : 0, p.aboard ? 0.35 : 1);
    a.loop("heal", f.heal !== null ? 0.08 : 0, 0.8 + (f.heal ?? 0) * 0.9);
    // ---- the others' feet
    const hear = cfg.footsteps.hearOthersTo;
    const grounded = (s: string): boolean => s === "stand" || s === "crouch" || s === "slide";
    for (const d of f.figures) {
      // (one unseen under INVISIBILITY is hidden but still there, and still heard: Milestone 717)
      if ((!d.group.visible && !d.cloaked) || d.knocked) continue;
      const pose = d.currentPose;
      const g = d.group.position;
      // (from the ears, not your body: out and watching a squad mate, the steps by them were silent and those by your
      // still body heard, Milestone 734)
      const far = Math.hypot(g.x - f.ear.x, g.z - f.ear.z) > hear;
      // their jumps, landings, slides and mantles, where they are (Milestone 695): yours had them, and theirs were
      // silent, so a figure dropping off a ledge behind you or sliding round a corner made no sound but its steps
      const was = this.otherMove.get(d);
      const vy = was && f.dt > 0 ? (g.y - was.y) / f.dt : 0;
      if (was && !far) {
        const at = { x: g.x, y: g.y + 0.1, z: g.z };
        // a jump off the ground, or a kick off a wall
        if (pose.stance === "air" && ((grounded(was.stance) && vy > 1) || was.stance === "wallL" || was.stance === "wallR")) {
          a.jump(at);
          this.heard("jump");
        }
        if (grounded(pose.stance) && airborne(was.stance as FigureStance)) {
          a.land(Math.abs(was.vy) / (600 * HU), surfaceAt(g.y, f.outdoors), at);
          this.heard("land");
        }
        if (pose.stance === "slide" && was.stance !== "slide") {
          a.slideStart(at);
          this.heard("slide");
        }
        if (pose.stance === "mantle" && was.stance !== "mantle") {
          a.mantle(at);
          this.heard("mantle");
        }
        // their double jump (Milestone 713): the figure counts them (dummy.ts airJumps), and one more is a puff where they are
        if ((pose.airJumps ?? 0) > was.airJumps) {
          a.airJump(at);
          this.heard("airjump");
        }
        // and their zipline's catch as they take one (Milestone 712): yours had it, and a squad riding over your roof was
        // silent, the very tell the zipline's sound is for
        if (pose.stance === "zip" && was.stance !== "zip") {
          a.zipOn(at);
          this.heard("zip");
        }
      }
      this.otherMove.set(d, { stance: pose.stance, y: g.y, vy: airborne(pose.stance) ? Math.min(vy, was?.vy ?? 0) : 0, airJumps: pose.airJumps ?? 0 });
      if (far) continue;
      // and along a wall (Milestone 707): someone running a wall was silent, the one way to come at you unheard
      const onWall = pose.stance === "wallL" || pose.stance === "wallR";
      if ((!onWall && pose.stance !== "stand" && pose.stance !== "crouch") || pose.speed < 0.5) continue;
      const stride = onWall ? wallStride(pose.speed) : pose.stance === "crouch" ? cfg.footsteps.crouchStride : pose.speed > 5.5 ? cfg.footsteps.sprintStride : cfg.footsteps.walkStride;
      let acc = (this.others.get(d) ?? Math.random() * stride) + pose.speed * f.dt;
      if (acc >= stride) {
        acc -= stride;
        if (onWall) {
          // (their feet on the wall, about knee high off the floor they left)
          a.footstep("concrete", { x: g.x, y: g.y + 0.6, z: g.z }, cfg.footsteps.wall.loud);
          this.heard("wallstep");
        } else a.footstep(surfaceAt(g.y, f.outdoors), { x: g.x, y: g.y + 0.1, z: g.z }, pose.stance === "crouch" ? 0.4 : pose.speed > 5.5 ? 1.1 : 0.75);
      }
      this.others.set(d, acc);
    }
    // ---- low health: a heartbeat, and the colour drains
    const low = f.match && f.alive && f.health < 30 ? 1 - f.health / 30 : 0;
    a.loop("heart", low > 0 ? 0.25 + 0.35 * low : 0, 1);
    this.desat += (low * 0.7 - this.desat) * Math.min(1, f.dt / 0.3);
    // ---- the match's clock: countdown beeps, the fight, the ring, the stingers
    const m = f.match;
    if (m) {
      if (m.phase === "countdown" && !m.br) {
        const c = Math.ceil(m.left);
        if (c !== this.lastCount && c >= 1 && c <= 3) a.countdown(false);
        this.lastCount = c;
      }
      if (m.phase === "fight" && this.lastPhase === "countdown" && !m.br) a.countdown(true);
      if (m.phase === "roundEnd" && this.lastPhase !== "roundEnd" && m.youWonRound !== null) a.stinger(m.youWonRound ? "won" : "lost");
      if (m.phase === "matchEnd" && this.lastPhase !== "matchEnd") {
        if (m.br) {
          if (m.br.placement === 1) a.stinger("champion");
          else a.stinger("lost");
        } else if (m.youWonMatch !== null) a.stinger(m.youWonMatch ? "won" : "lost");
      }
      if (m.br) {
        if (m.br.ring.closing && !this.ringWasClosing) a.ringHorn();
        this.ringWasClosing = m.br.ring.closing;
        if (m.br.placement === 1 && !this.placementPlayed) this.placementPlayed = true;
      }
      this.lastPhase = m.phase;
    } else {
      this.lastPhase = null;
      this.lastCount = -1;
      this.ringWasClosing = false;
      this.placementPlayed = false;
    }
    // ---- the parts of a reload: the magazine out, in, and the bolt from empty (not under the pack's own recording of them)
    const r = f.reload;
    if (r.on && !this.wasReloading) this.reloadMarks = { out: false, in: false, bolt: false };
    if (r.on && !a.reloadPacked) {
      if (!this.reloadMarks.out && r.progress >= 0.18) {
        this.reloadMarks.out = true;
        a.reloadStep("out");
      }
      if (!this.reloadMarks.in && r.progress >= 0.62) {
        this.reloadMarks.in = true;
        a.reloadStep("in");
      }
      if (r.empty && !this.reloadMarks.bolt && r.progress >= 0.86) {
        this.reloadMarks.bolt = true;
        a.reloadStep("bolt");
      }
    }
    this.wasReloading = r.on;
  }
}
