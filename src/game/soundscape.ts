// What the frame sounds like: each frame's state turned into the sounds that
// go with it. Footsteps (yours and every figure's, by surface), jumps and
// landings, the slide's scrape, the zipline, climbing taps and the mantle, the
// drop's wind, a heal's hum, the low-health heartbeat (and how much colour the
// picture should lose with it), the countdown's beeps, the ring's horn, the
// round and match stingers, and the parts of a reload. The sounds themselves
// are audio.ts's; this decides when.
import cfg from "../config/audio.json";
import type { GameAudio, Surface } from "./audio";
import type { Player } from "./player";
import type { Dummy } from "./dummy";
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
  /** a heal in progress, 0..1, or null */
  heal: number | null;
  /** the gun in hand: reloading, how far, and whether from empty */
  reload: { on: boolean; progress: number; empty: boolean };
}

/** what is under a pair of feet */
export function surfaceAt(y: number, outdoors: boolean): Surface {
  if (outdoors) return y < 0.05 ? "dirt" : "concrete";
  return y < 0.05 ? "concrete" : "metal";
}

export class Soundscape {
  private stepAcc = 0;
  private wasGround = true;
  private lastStance = "stand";
  private climbTapAt = 0;
  private others = new WeakMap<Dummy, number>();
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
    if (p.onGround && !p.sliding && !p.jolting && p.speed > 0.5 && f.alive) {
      this.stepAcc += p.speed * f.dt;
      const st = cfg.footsteps;
      const stride = p.crouched ? st.crouchStride : p.sprinting ? st.sprintStride : st.walkStride;
      if (this.stepAcc >= stride) {
        this.stepAcc -= stride;
        a.footstep(surface, null, p.crouched ? 0.45 : p.sprinting ? 1.15 : 0.8);
      }
    } else if (!p.onGround) this.stepAcc = 0;
    if (p.onGround && !this.wasGround && f.alive) a.land(p.landingSpeed / (600 * HU), surface);
    if (!p.onGround && this.wasGround && p.vel.y > 2 && !p.dropping) a.jump();
    this.wasGround = p.onGround;
    const stance = p.stance;
    if (stance === "mantle" && this.lastStance !== "mantle") a.mantle();
    if (stance === "climb" && f.now >= this.climbTapAt) {
      this.climbTapAt = f.now + 0.22;
      a.climbTap();
    }
    this.lastStance = stance;
    // ---- loops: the slide, the zipline, the drop's wind, a heal
    a.loop("slide", p.sliding ? Math.min(0.5, (p.speed / 10) * 0.5) : 0, 0.8 + p.speed / 15);
    a.loop("zip", p.onZip ? 0.22 : 0, 0.7 + p.speed / 12);
    a.loop("wind", p.dropping ? 0.3 : 0, 1);
    a.loop("heal", f.heal !== null ? 0.08 : 0, 0.8 + (f.heal ?? 0) * 0.9);
    // ---- the others' feet
    const hear = cfg.footsteps.hearOthersTo;
    for (const d of f.figures) {
      if (!d.group.visible || d.knocked) continue;
      const pose = d.currentPose;
      const g = d.group.position;
      if ((pose.stance !== "stand" && pose.stance !== "crouch") || pose.speed < 0.5) continue;
      if (Math.hypot(g.x - p.pos.x, g.z - p.pos.z) > hear) continue;
      const stride = pose.stance === "crouch" ? cfg.footsteps.crouchStride : pose.speed > 5.5 ? cfg.footsteps.sprintStride : cfg.footsteps.walkStride;
      let acc = (this.others.get(d) ?? Math.random() * stride) + pose.speed * f.dt;
      if (acc >= stride) {
        acc -= stride;
        a.footstep(surfaceAt(g.y, f.outdoors), { x: g.x, y: g.y + 0.1, z: g.z }, pose.stance === "crouch" ? 0.4 : pose.speed > 5.5 ? 1.1 : 0.75);
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
    // ---- the parts of a reload: the magazine out, in, and the bolt from empty
    const r = f.reload;
    if (r.on && !this.wasReloading) this.reloadMarks = { out: false, in: false, bolt: false };
    if (r.on) {
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
