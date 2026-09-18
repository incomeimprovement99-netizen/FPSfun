// The HUD, laid out where Apex puts things.
//
//   top-left       minimap, rotating with you, drawn from the range's own
//                  collision boxes; range stats under it
//   top-centre     compass strip with the bearing
//   top-right      FPS, in the biggest type on the screen (owner's ask), with
//                  the frame time under it
//   bottom-left    speed and stance, then shield and health bars
//   bottom-right   the two weapon slots, magazine count, reserve, fire mode
//   centre         crosshair, hit markers, damage numbers at the hit point,
//                  knock notice, and the course timer when a run is live
//
// One 2D canvas, redrawn every frame. Everything is sized from the viewport
// height so the layout holds at any resolution.
import { PHOENIX_SHORT } from "../config/names";
import * as THREE from "three";
import { RANGE_SOLIDS, COURSE_GATE, COURSE_GATE_R } from "./range";
import { ZIPLINES } from "./traversal";
import { drawReticle, type ReticleStyle } from "./optics";
import type { DuelHud } from "./duel";
import type { Recap } from "./recap";
import type { DrillHud } from "./rangetools";
import type { TrainerHud } from "./trainer";
import type { ModeHud } from "./modematch";
import type { TourHud } from "./tour";
import hudCfg from "../config/hud.json";
import lootCfg from "../config/loot.json";
import { REACH } from "./brplay";
import { drawIcon, loadIcons } from "./icons";
import { drawReticle as drawCrosshair2d, type Reticle } from "./reticle";
import { P, access } from "./palette";

type ModeRow = ModeHud["rows"][number];

export interface DamageNumber {
  world: THREE.Vector3;
  text: string;
  color: string;
  born: number;
  big: boolean;
  /** what the text says, summed over a shot's pellets */
  amount: number;
}

export interface CourseHud {
  /** which course: "THE RUN", "THE RUN: ADVANCED" */
  title: string;
  /** a run is in progress */
  running: boolean;
  /** seconds on the clock (live, or the final time) */
  time: number;
  enemiesLeft: number;
  enemiesTotal: number;
  best: number | null;
  /** set for a few seconds after a finish */
  result: {
    time: number;
    raw: number;
    missed: number;
    rank: string;
    newBest: boolean;
    splits: Array<{ name: string; time: number; delta: number | null; room?: number; par?: number; medal?: "gold" | "silver" | "bronze" | null }>;
  } | null;
  /** short banner, e.g. "COURSE: cross the line to start" */
  banner: string | null;
  /** the room you just entered, its split and the difference to your best */
  split: { name: string; time: number; delta: number | null } | null;
}

interface TechEntry {
  name: string;
  detail: string;
  good: boolean;
  at: number;
}

export interface HudState {
  weaponName: string;
  /** the gun's locked hop-up and its progress (a battle royale, Seasons 29 and 30) */
  hopLock?: { name: string; have: number; need: number } | null;
  magLevel: number;
  slot: number;
  slotCount: number;
  otherName: string;
  swapping: boolean;
  fireMode: string;
  attachLines: string[];
  clip: number;
  clipSize: number;
  /** nothing in hand (a battle royale's start, an empty slot): no count, no reserve */
  unarmed?: boolean;
  /** rounds left to reload with (Infinity: the range's endless ammo) */
  reserve?: number;
  /** an energy gun's own stockpile, shown as a percentage like the game */
  energy?: { rounds: number; max: number } | null;
  /**
   * Where the recent hits on you came from: `angle` in radians clockwise from
   * straight ahead, `alpha` how much of its life is left (src/main.ts works
   * both out from the shooter's position and your yaw every frame).
   */
  damageDirs?: Array<{ angle: number; alpha: number }>;
  /** the player's crosshair (src/game/reticle.ts); none is the old three prongs */
  reticle?: Reticle;
  /** the quick chat list while it is open: the lines, numbered 1 up */
  quickChat?: string[] | null;
  /** the card when a match ends: the result, the numbers, the XP and the level bar (src/main.ts) */
  summary?: {
    title: string;
    good: boolean;
    rows: Array<[string, string]>;
    xp: number;
    lines: string[];
    level: number;
    /** 0..1, where the bar is now as it runs from before to after */
    bar: number;
    levelUp: boolean;
    alpha: number;
  } | null;
  /** 0..1: the gun's wind-up, charge, aimed charge, choke or burst charge (a ring round the crosshair) */
  gunCharge?: number;
  /** the L-STAR's heat, and whether it is in its forced cooldown */
  heat?: { heat: number; locked: boolean } | null;
  /** the Devotion's spin, 0..1 */
  spin?: number | null;
  reloading: boolean;
  reloadProgress: number;
  coneDeg: number;
  adsFrac: number;
  vFovDeg: number;
  stats: { shots: number; hits: number; headshots: number; damage: number; knocks: number; lastTtk: number | null };
  armorName: string;
  cm360: number;
  hipFov: number;
  fps: number;
  /** CPU time of the last frame, ms */
  frameMs: number;
  stance: string;
  speedMs: number;
  speedHu: number;
  /** view yaw in degrees (positive = left), and feet position, for map and compass */
  yaw: number;
  px: number;
  pz: number;
  holstered: boolean;
  course: CourseHud | null;
  /** a context prompt under the crosshair: key and what it does */
  prompt: { key: string; text: string } | null;
  /** a magnified scope's full-screen picture, faded in with aim */
  scope: { style: ReticleStyle; color: string; amount: number } | null;
  /** a match in progress (duel.ts DuelHud: the 1v1, the bots, the battle royale) */
  duel?: DuelHud | null;
  /** hosting a match and waiting in the arena: the code, and how many are still to come */
  lobby?: { code: string; waitingFor: number } | null;
  /** the part of the world the minimap draws (the range, or the BR map) */
  mapRegion?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** the full map is open (M), or shown by the drop */
  mapOpen?: boolean;
  /** a heal in progress: the item, 0..1, and what is left in the kit */
  heal?: { item: string; progress: number } | null;
  /** what is left of each heal */
  kit?: Record<string, number> | null;
  /** the heal wheel, held open: the items, their counts, the one the mouse points at */
  healWheel?: { items: Array<{ id: string; name: string; count: number }>; pick: string | null } | null;
  /** nameplates over the other players and the bots */
  plates?: Array<{ world: THREE.Vector3; name: string; health: number; shield: number; shieldMax: number; alive: boolean; ally?: boolean; aimbot?: boolean }>;
  /** real shield and health (a 1v1); the bars are decorative without it */
  vitals?: { shield: number; shieldMax: number; health: number; healthMax: number; evo?: number | null; helmet?: string | null } | null;
  /** your ability (abilities.ts): name, key, its cooldown and what is left of it (0: ready); a passive one has no key */
  ability?: { name: string; key: string; cooldown: number; left: number; passive: boolean; charges?: number; max?: number; nextIn?: number } | null;
  /** the ability card: the two options with their keys; compact is the one-line form */
  abilityCard?: { options: Array<{ key: string; name: string; blurb: string; picked: boolean }>; age: number; compact: boolean } | null;
  /** the killcam is playing: whose eyes, their gun, how far through, the skip key */
  killcam?: { name: string; weapon: string; progress: number; left: number; skipKey: string } | null;
  /** the death recap, after the killcam: how long it has been up, the close key */
  recap?: (Recap & { age: number; closeKey: string }) | null;
  /** the flick drill: its countdown, the clock, how many are down */
  drill?: DrillHud | null;
  /** the superglide trainer's bar */
  trainer?: TrainerHud | null;
  /** a superglide's window is open: the mantle boost cue on the crosshair */
  mantleCue?: boolean;
  /** the heal key's label, for the kit line */
  healKey?: string;
  /** grenades: how many of each (null: the range, no count), the one in hand, its keys */
  ordnance?: { counts: Record<string, number> | null; readied: string | null; ready: boolean; key: string; fire: string; cancel: string } | null;
  /** the guided tour's step, or its finish card */
  tour?: TourHud | null;
  /** a hold-E action in progress (a revive, a beacon): its label and 0..1 */
  brHold?: { label: string; progress: number } | null;
  /** pings in the world: an enemy (red), an item (its colour), a place (yellow) */
  markers?: Array<{ k: "enemy" | "loot" | "go"; at: THREE.Vector3; label: string; mine: boolean }> | null;
  /** a squad mate's banner you carry, and how long it lasts */
  banner?: { name: string; left: number } | null;
  /** you are down: the bleed-out clock, and who is reviving you */
  downed?: {
    left: number;
    revivedBy: string | null;
    kd?: { hp: number; max: number; up: boolean; key: string } | null;
    /** a gold knockdown shield's self-revive: the key to hold, and how far the channel has run (null while it is not) */
    self?: { key: string; progress: number | null } | null;
  } | null;
  /** out, watching a squad mate (or a bot): whose eyes, and first person or not */
  spectating?: { name: string; first: boolean } | null;
}

/** map canvas pixels per metre */
const MAP_PX = 6;

// Apex-flavoured palette
const WHITE = "#f2f2f2";
const DIM = "#9aa4ad";
const PANEL = "rgba(8,10,12,0.55)";
const SHIELD = "#a855f7";
const RED = "#ff4b3e";
const FONT = `"Rajdhani", "Segoe UI", system-ui, sans-serif`;

export class Hud {
  private ctx: CanvasRenderingContext2D;
  private numbers: DamageNumber[] = [];
  private hitMarkerUntil = 0;
  private hitMarkerHead = false;
  private noticeText = "";
  private noticeUntil = 0;
  /** the kill feed, top right, newest first */
  private feedLines: Array<{ text: string; born: number; color: string }> = [];
  private techFeed: TechEntry[] = [];
  private hurtAt = -Infinity;
  private w = 0;
  private h = 0;
  /** pre-drawn top-down map of the current region, MAP_PX pixels per metre */
  private map: HTMLCanvasElement | null = null;
  private mapMinX = 0;
  private mapMinZ = 0;
  private mapSolids = -1;
  private mapRegionKey = "";

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    // fire and forget: nothing waits on the icons, and every place that draws
    // one falls back to the text it drew before until they arrive
    loadIcons();
  }

  resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * dpr);
    this.canvas.height = Math.floor(this.h * dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  addDamage(world: THREE.Vector3, amount: number, color: string, big: boolean, now: number): void {
    // one trigger pull's pellets read as one number, as the game's do: five
    // 19s on top of each other looked like a single pellet
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      if (now - n.born > 0.05) break;
      if (n.world.distanceTo(world) < 1.5) {
        n.amount += amount;
        n.text = String(n.amount);
        if (big && !n.big) {
          n.big = true;
          n.color = color;
        }
        return;
      }
    }
    this.numbers.push({ world, text: String(amount), color, born: now, big, amount });
    if (this.numbers.length > 40) this.numbers.shift();
  }

  /** the damage numbers up now, newest last (tools/e2e.ts) */
  get damageNumbers(): ReadonlyArray<{ amount: number; text: string; big: boolean }> {
    return this.numbers.map((n) => ({ amount: n.amount, text: n.text, big: n.big }));
  }

  hitMarker(now: number, head: boolean): void {
    this.hitMarkerUntil = now + 0.12;
    this.hitMarkerHead = head;
  }

  /**
   * A line in the tech feed: what the movement code registered (a superglide,
   * a wallbounce, a deadslide), so you can tell a clean input from a near miss.
   */
  tech(name: string, detail: string, good: boolean, now: number): void {
    this.techFeed.push({ name, detail, good, at: now });
    if (this.techFeed.length > 5) this.techFeed.shift();
  }

  /** a red flash at the screen edge: you took damage */
  hurt(now: number): void {
    this.hurtAt = now;
  }

  /** the kill feed's lines, newest first (tools/e2e.ts) */
  get feedText(): string[] {
    return this.feedLines.map((l) => l.text);
  }

  /** a line in the kill feed ("YOU knocked BOT ASH") */
  feed(text: string, now: number, color = WHITE): void {
    this.feedLines.unshift({ text, born: now, color });
    if (this.feedLines.length > 6) this.feedLines.length = 6;
  }

  /** a centre notice, e.g. "KNOCKED DOWN" */
  notice(text: string, now: number, seconds = 1.2): void {
    this.noticeText = text;
    this.noticeUntil = now + seconds;
  }

  /** false skips drawing (the end-to-end test's ?norender) */
  enabled = true;

  /** the last frame's state (tools/e2e.ts reads what the HUD would show) */
  last: HudState | null = null;

  draw(now: number, camera: THREE.Camera, s: HudState): void {
    this.last = s;
    if (!this.enabled) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    // layout unit: 1 px at 1080p, times the player's HUD scale (Settings, Accessibility)
    const u = (this.h / 1080) * access.hudScale;
    // the killcam has the screen to itself, and the kill feed
    if (s.killcam) {
      this.drawKillcam(now, s.killcam, u);
      this.drawFeed(now, u);
      return;
    }
    this.drawScope(s, u);
    this.drawHurt(now);
    this.drawDamageNumbers(now, camera, u);
    this.drawCrosshair(now, s, u);
    this.drawDamageDirs(s, u);
    this.drawMatchCard(s, u);
    this.drawQuickChat(s, u);
    this.drawMinimap(s, u);
    this.drawStats(s, u);
    this.drawCompass(s, u);
    this.drawFps(s, u);
    this.drawVitals(s, u);
    this.drawWeapons(s, u);
    this.drawCourse(s, u);
    this.drawNotice(now, u);
    this.drawPrompt(s, u);
    this.drawReachList(u);
    this.drawTechFeed(now, u);
    this.drawPlates(now, camera, s, u);
    this.drawMarkers(now, camera, s, u);
    this.drawDuel(s, u);
    this.drawMode(now, camera, s, u);
    this.drawBr(now, s, u);
    this.drawKit(s, u);
    this.drawAbility(now, s, u);
    this.drawAbilityCard(s, u);
    this.drawLobby(s, u);
    this.drawFeed(now, u);
    this.drawSummary(s, u);
    this.drawFullMap(now, s, u);
    this.drawRecap(s, u);
    this.drawDrill(s, u);
    this.drawTrainer(s, u);
    this.drawSquad(now, s, u);
    this.drawTour(camera, s, u);
  }

  /** the tour: the step under the compass, what to do, the skip bar, and an arrow to the marker when it is off screen */
  private drawTour(camera: THREE.Camera, s: HudState, u: number): void {
    const t = s.tour;
    if (!t) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const w = 620 * u;
    const y0 = 62 * u;
    c.fillStyle = "rgba(8,10,12,0.78)";
    c.fillRect(cx - w / 2, y0, w, 86 * u);
    c.fillStyle = t.done ? "#ffd23c" : "#7ddc8a";
    c.fillRect(cx - w / 2, y0, w * (t.step / t.of), 4 * u);
    this.text(t.done ? t.title : `TOUR ${t.step} / ${t.of}  ·  ${t.title}`, cx, y0 + 30 * u, 700, 20 * u, t.done ? "#ffd23c" : "#7ddc8a", "center");
    // the instruction, wrapped to the panel
    c.font = this.font(600, 14 * u);
    const words = t.text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const wd of words) {
      const next = line ? `${line} ${wd}` : wd;
      if (c.measureText(next).width > w - 40 * u && line) {
        lines.push(line);
        line = wd;
      } else line = next;
    }
    if (line) lines.push(line);
    lines.slice(0, 3).forEach((l, i) => this.text(l, cx, y0 + 52 * u + i * 16 * u, 600, 14 * u, WHITE, "center"));
    if (t.skip > 0) {
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fillRect(cx - 80 * u, y0 + 92 * u, 160 * u, 5 * u);
      c.fillStyle = "#ffd23c";
      c.fillRect(cx - 80 * u, y0 + 92 * u, 160 * u * t.skip, 5 * u);
    }
    // the marker: where on screen, or an arrow at the edge toward it
    if (t.marker) {
      const v = t.marker.clone().setY(1.2).project(camera);
      const pad = 44 * u;
      let x = (v.x * 0.5 + 0.5) * this.w;
      let y = (-v.y * 0.5 + 0.5) * this.h;
      const behind = v.z > 1;
      if (behind) {
        x = this.w - x;
        y = this.h - pad;
      }
      const off = behind || x < pad || x > this.w - pad || y < pad || y > this.h - pad;
      x = Math.max(pad, Math.min(this.w - pad, x));
      y = Math.max(pad, Math.min(this.h - pad, y));
      const cam = (camera as THREE.PerspectiveCamera).position;
      const dist = Math.round(Math.hypot(t.marker.x - cam.x, t.marker.z - cam.z));
      c.fillStyle = "#7ddc8a";
      c.beginPath();
      if (off) {
        const a = Math.atan2(y - this.h / 2, x - cx);
        c.moveTo(x + Math.cos(a) * 14 * u, y + Math.sin(a) * 14 * u);
        c.lineTo(x + Math.cos(a + 2.4) * 11 * u, y + Math.sin(a + 2.4) * 11 * u);
        c.lineTo(x + Math.cos(a - 2.4) * 11 * u, y + Math.sin(a - 2.4) * 11 * u);
      } else c.arc(x, y, 7 * u, 0, Math.PI * 2);
      c.closePath();
      c.fill();
      this.text(`${dist} M`, x, y + 24 * u, 700, 12 * u, "#7ddc8a", "center");
    }
  }

  /**
   * Pings, where they are in the world: a diamond with the label and the
   * distance, held to the screen's edge when off it (Apex keeps a ping in
   * view the same way).
   */
  private drawMarkers(now: number, camera: THREE.Camera, s: HudState, u: number): void {
    if (!s.markers?.length) return;
    const c = this.ctx;
    const v = new THREE.Vector3();
    const cam = (camera as THREE.PerspectiveCamera).position;
    const pad = 40 * u;
    for (const m of s.markers) {
      v.copy(m.at).project(camera);
      let x = (v.x * 0.5 + 0.5) * this.w;
      let y = (-v.y * 0.5 + 0.5) * this.h;
      // behind you: mirrored and pinned to the bottom edge
      const behind = v.z > 1;
      if (behind) {
        x = this.w - x;
        y = this.h - pad;
      }
      const off = behind || x < pad || x > this.w - pad || y < pad || y > this.h - pad;
      x = Math.max(pad, Math.min(this.w - pad, x));
      y = Math.max(pad, Math.min(this.h - pad, y));
      const col = m.k === "enemy" ? P.enemy : m.k === "loot" ? "#8fd8ff" : "#ffd23c";
      const r = (m.k === "enemy" ? 11 : 9) * u * (m.k === "enemy" ? 1 + 0.12 * Math.sin(now * 8) : 1);
      c.fillStyle = col;
      c.strokeStyle = "rgba(0,0,0,0.7)";
      c.lineWidth = 2 * u;
      c.beginPath();
      c.moveTo(x, y - r);
      c.lineTo(x + r, y);
      c.lineTo(x, y + r);
      c.lineTo(x - r, y);
      c.closePath();
      c.fill();
      c.stroke();
      const dist = Math.round(m.at.distanceTo(cam));
      if (!off) this.text(m.label, x, y - r - 6 * u, 700, 13 * u, col, "center");
      this.text(`${dist} M`, x, y + r + 14 * u, 700, 12 * u, WHITE, "center");
    }
  }

  /**
   * The squad's overlays: down (the bleed-out clock, a red edge, who is
   * reviving you), a revive or beacon hold's bar, the banner you carry, and
   * whose eyes you are watching through.
   */
  private drawSquad(now: number, s: HudState, u: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    if (s.downed) {
      const g = c.createRadialGradient(cx, this.h / 2, this.h * 0.3, cx, this.h / 2, this.h * 0.85);
      g.addColorStop(0, "rgba(160,0,0,0)");
      g.addColorStop(1, `rgba(160,0,0,${0.45 + 0.08 * Math.sin(now * 3)})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
      this.text("DOWN", cx, this.h * 0.3, 700, 52 * u, "#ff4b3e", "center");
      this.text(s.downed.revivedBy ? `${s.downed.revivedBy} IS REVIVING YOU` : `BLEEDING OUT  ·  ${Math.ceil(s.downed.left)} S`, cx, this.h * 0.3 + 34 * u, 700, 20 * u, s.downed.revivedBy ? "#7ddc8a" : WHITE, "center");
      this.text("CRAWL TO COVER: A SQUAD MATE CAN REVIVE YOU", cx, this.h * 0.3 + 60 * u, 600, 14 * u, DIM, "center");
      // the knockdown shield: what it has left, and how to raise it
      const kd = s.downed.kd;
      if (kd) {
        const bw = 220 * u;
        const y = this.h * 0.3 + 76 * u;
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(cx - bw / 2, y, bw, 8 * u);
        c.fillStyle = kd.hp <= 0 ? "#5a5f66" : kd.up ? "#6fd3ff" : "rgba(111,211,255,0.55)";
        c.fillRect(cx - bw / 2, y, bw * Math.max(0, kd.hp / kd.max), 8 * u);
        this.text(kd.hp <= 0 ? "KNOCKDOWN SHIELD BROKEN" : kd.up ? `KNOCKDOWN SHIELD UP  ·  ${Math.ceil(kd.hp)}` : `HOLD ${kd.key}: KNOCKDOWN SHIELD (${Math.ceil(kd.hp)})`, cx, y + 24 * u, 700, 13 * u, kd.hp <= 0 ? DIM : "#bfe9ff", "center");
      }
      // a gold shield's self-revive: the prompt, and the channel's bar while it runs
      const self = s.downed.self;
      if (self) {
        const y = this.h * 0.3 + 116 * u;
        if (self.progress !== null) {
          const bw = 220 * u;
          c.fillStyle = "rgba(0,0,0,0.55)";
          c.fillRect(cx - bw / 2, y, bw, 8 * u);
          c.fillStyle = "#ffc12e";
          c.fillRect(cx - bw / 2, y, bw * self.progress, 8 * u);
        }
        this.text(self.progress !== null ? "SELF-REVIVING  ·  DO NOT GET HIT" : `HOLD ${self.key}: SELF-REVIVE (GOLD SHIELD)`, cx, y + 24 * u, 700, 13 * u, "#ffd27a", "center");
      }
    }
    if (s.brHold) {
      const bw = 300 * u;
      const y = this.h * 0.58;
      c.fillStyle = "rgba(0,0,0,0.6)";
      c.fillRect(cx - bw / 2, y, bw, 12 * u);
      c.fillStyle = "#7ddc8a";
      c.fillRect(cx - bw / 2, y, bw * s.brHold.progress, 12 * u);
      this.text(s.brHold.label, cx, y - 9 * u, 700, 16 * u, WHITE, "center");
    }
    if (s.banner) {
      this.text(`${s.banner.name}'S BANNER  ·  ${Math.ceil(s.banner.left)} S  ·  TAKE IT TO A RESPAWN BEACON`, cx, this.h - 150 * u, 700, 15 * u, "#7ddc8a", "center");
    }
    if (s.spectating) {
      c.fillStyle = PANEL;
      c.fillRect(cx - 190 * u, this.h - 132 * u, 380 * u, 44 * u);
      this.text(`WATCHING ${s.spectating.name}`, cx, this.h - 106 * u, 700, 18 * u, WHITE, "center");
      this.text(s.spectating.first ? "THEIR EYES  ·  THIRD PERSON KEY: BEHIND THEM" : "BEHIND THEM  ·  THIRD PERSON KEY: THEIR EYES", cx, this.h - 92 * u, 600, 11 * u, DIM, "center");
    }
  }

  /** the flick drill: a countdown, then the clock and the count, then the result */
  private drawDrill(s: HudState, u: number): void {
    const d = s.drill;
    if (!d) return;
    const cx = this.w / 2;
    if (d.state === "countdown") {
      this.text(`${Math.max(1, Math.ceil(d.left))}`, cx, this.h * 0.42, 700, 90 * u, WHITE, "center");
      this.text("FLICK DRILL: 30 TARGETS", cx, this.h * 0.42 + 36 * u, 700, 20 * u, "#8fd8ff", "center");
      return;
    }
    const acc = d.shots ? Math.round((100 * d.hits) / d.shots) : 0;
    if (d.state === "running") {
      this.text(d.time.toFixed(2), cx, 110 * u, 700, 48 * u, WHITE, "center");
      this.text(`${d.done} / ${d.total}   ·   ${acc}%${d.best !== null ? `   ·   BEST ${d.best.toFixed(2)}` : ""}`, cx, 136 * u, 700, 16 * u, DIM, "center");
      return;
    }
    const c = this.ctx;
    const w = 420 * u;
    const h = 150 * u;
    const x0 = cx - w / 2;
    const y0 = this.h * 0.24;
    c.fillStyle = "rgba(8,10,12,0.82)";
    c.fillRect(x0, y0, w, h);
    c.fillStyle = "#8fd8ff";
    c.fillRect(x0, y0, w, 4 * u);
    this.text("FLICK DRILL COMPLETE", cx, y0 + 32 * u, 700, 18 * u, DIM, "center");
    this.text(d.time.toFixed(2), cx, y0 + 88 * u, 700, 56 * u, WHITE, "center");
    this.text(`${acc}% ACCURACY  ·  ${(d.time / d.total).toFixed(2)} S A TARGET`, cx, y0 + 116 * u, 700, 15 * u, DIM, "center");
    this.text(d.newBest ? "NEW PERSONAL BEST" : d.best !== null ? `BEST ${d.best.toFixed(2)}` : "", cx, y0 + 138 * u, 700, 14 * u, d.newBest ? "#ffd23c" : DIM, "center");
  }

  /**
   * The superglide trainer: the mantle's last 0.3 s as a bar with the window
   * shaded green, your jump (J) and crouch (C) where they landed, the frames
   * between them, the verdict and your last ten tries.
   */
  private drawTrainer(s: HudState, u: number): void {
    const t = s.trainer;
    if (!t) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const w = 300 * u;
    const y = this.h * 0.6;
    const x0 = cx - w / 2;
    c.globalAlpha = t.live ? 1 : Math.max(0, 1 - Math.max(0, t.age - 1.8) / 0.7);
    // time runs left to right: the bar's right edge is the mantle's end
    const xAt = (before: number) => x0 + w * (1 - Math.max(0, Math.min(t.span, before)) / t.span);
    c.fillStyle = "rgba(0,0,0,0.55)";
    c.fillRect(x0, y, w, 12 * u);
    c.fillStyle = "rgba(125,220,138,0.55)";
    c.fillRect(xAt(t.window), y, x0 + w - xAt(t.window), 12 * u);
    const mark = (before: number | null, label: string, col: string) => {
      if (before === null) return;
      const x = xAt(before);
      c.fillStyle = col;
      c.fillRect(x - 1.5 * u, y - 6 * u, 3 * u, 24 * u);
      this.text(label, x, y - 9 * u, 700, 11 * u, col, "center");
    };
    mark(t.jump, "JUMP", "#ffd23c");
    mark(t.crouch, "CROUCH", "#8fd8ff");
    const verdict = t.result === "SUPERGLIDE" ? "SUPERGLIDE" : t.result === "MISS" ? `MISS: ${t.reason}` : "SUPERGLIDE: JUMP IN THE GREEN, CROUCH ONE FRAME LATER";
    this.text(verdict + (t.frames !== null && t.result ? `   (${t.frames} frame${t.frames === 1 ? "" : "s"} apart)` : ""), cx, y + 30 * u, 700, 13 * u, t.result === "SUPERGLIDE" ? "#7ddc8a" : t.result === "MISS" ? "#ff9f43" : DIM, "center");
    // the last ten tries as dots
    t.tries.forEach((ok, i) => {
      c.fillStyle = ok ? "#7ddc8a" : "#ff6a4a";
      c.beginPath();
      c.arc(x0 + w + 14 * u + i * 10 * u, y + 6 * u, 3.5 * u, 0, Math.PI * 2);
      c.fill();
    });
    if (t.tries.length) this.text(`${t.tries.filter(Boolean).length}/${t.tries.length}`, x0 + w + 20 * u + t.tries.length * 10 * u, y + 11 * u, 700, 12 * u, WHITE);
    c.globalAlpha = 1;
  }

  /**
   * The killcam: bars top and bottom, "KILLCAM" and whose eyes these are with
   * their gun, a thin bar of how far through, and the skip key.
   */
  private drawKillcam(now: number, k: NonNullable<HudState["killcam"]>, u: number): void {
    const c = this.ctx;
    const bar = this.h * 0.09;
    c.fillStyle = "rgba(0,0,0,0.88)";
    c.fillRect(0, 0, this.w, bar);
    c.fillRect(0, this.h - bar, this.w, bar);
    // a faint red wash over the picture: this is the past
    c.fillStyle = "rgba(120,10,10,0.12)";
    c.fillRect(0, bar, this.w, this.h - bar * 2);
    const blink = Math.sin(now * 5) > 0 ? 1 : 0.45;
    c.fillStyle = `rgba(255,75,62,${blink})`;
    c.beginPath();
    c.arc(34 * u, bar / 2, 7 * u, 0, Math.PI * 2);
    c.fill();
    this.text("KILLCAM", 50 * u, bar / 2 + 8 * u, 700, 24 * u, WHITE);
    this.text(k.name, this.w / 2, bar / 2 + 6 * u, 700, 28 * u, RED, "center");
    if (k.weapon) this.text(k.weapon.toUpperCase(), this.w / 2, bar / 2 + 28 * u, 600, 14 * u, DIM, "center");
    this.text(`${k.skipKey} TO SKIP`, this.w - 30 * u, this.h - bar / 2 + 6 * u, 700, 16 * u, DIM, "right");
    c.fillStyle = "rgba(255,255,255,0.15)";
    c.fillRect(30 * u, this.h - bar / 2 - 2 * u, this.w * 0.4, 4 * u);
    c.fillStyle = RED;
    c.fillRect(30 * u, this.h - bar / 2 - 2 * u, this.w * 0.4 * k.progress, 4 * u);
  }

  /**
   * The death recap: who eliminated you and with what, then one block per
   * opponent (the killer first): your damage to them against theirs to you,
   * hits and headshots each way, the guns and distances they hit you from,
   * a heal of theirs just before, and what they had left.
   */
  private drawRecap(s: HudState, u: number): void {
    const r = s.recap;
    if (!r) return;
    const c = this.ctx;
    const rows = r.rows.slice(0, 3);
    const w = Math.min(this.w - 40 * u, 700 * u);
    const rowH = 118 * u;
    const h = 96 * u + Math.max(1, rows.length) * rowH + 30 * u;
    const x0 = this.w / 2 - w / 2;
    // under the countdown's number and the centre notices, above the bottom edge
    const y0 = Math.max(60 * u, Math.min(this.h * 0.47, this.h - h - 20 * u));
    c.save();
    c.globalAlpha = Math.min(1, r.age / 0.2);
    c.fillStyle = "rgba(8,10,12,0.9)";
    c.fillRect(x0, y0, w, h);
    c.fillStyle = RED;
    c.fillRect(x0, y0, w, 4 * u);
    this.text("DEATH RECAP", x0 + 22 * u, y0 + 30 * u, 700, 14 * u, DIM);
    this.text(r.byRing ? "ELIMINATED BY THE RING" : `ELIMINATED BY ${r.killerName}`, x0 + 22 * u, y0 + 62 * u, 700, 28 * u, r.byRing ? "#ff9a4a" : WHITE);
    this.text(`YOU DEALT ${Math.round(r.totalDealt)}  ·  TOOK ${Math.round(r.totalTaken)}`, x0 + w - 22 * u, y0 + 62 * u, 700, 15 * u, DIM, "right");
    if (!rows.length) this.text("Nobody hit you this life: it was the ring.", x0 + 22 * u, y0 + 110 * u, 600, 15 * u, DIM);
    rows.forEach((row, i) => {
      const y = y0 + 88 * u + i * rowH;
      c.fillStyle = row.killer ? "rgba(255,75,62,0.1)" : "rgba(255,255,255,0.04)";
      c.fillRect(x0 + 12 * u, y, w - 24 * u, rowH - 10 * u);
      this.text(row.name, x0 + 24 * u, y + 24 * u, 700, 18 * u, row.killer ? RED : WHITE);
      if (row.killer) this.text("KILLER", x0 + 24 * u + this.measure(row.name, 18 * u) + 10 * u, y + 24 * u, 700, 12 * u, RED);
      // you against them, as two bars on one scale
      const most = Math.max(1, row.dealt.damage, row.taken.damage);
      const bw = w * 0.36;
      const bx = x0 + 24 * u;
      const line = (yy: number, label: string, v: { damage: number; hits: number; heads: number }, col: string) => {
        this.text(label, bx, yy, 700, 12 * u, DIM);
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillRect(bx + 92 * u, yy - 10 * u, bw, 10 * u);
        c.fillStyle = col;
        c.fillRect(bx + 92 * u, yy - 10 * u, (bw * v.damage) / most, 10 * u);
        this.text(`${Math.round(v.damage)}  ·  ${v.hits} HIT${v.hits === 1 ? "" : "S"}${v.heads ? `, ${v.heads} HEAD` : ""}`, bx + 100 * u + bw, yy, 700, 14 * u, WHITE);
      };
      line(y + 50 * u, "YOU → THEM", row.dealt, "#7ddc8a");
      line(y + 72 * u, "THEM → YOU", row.taken, RED);
      const gun = row.guns[0];
      const dist = (g: typeof gun) => (g.near === null ? "" : g.far !== null && Math.round(g.far) !== Math.round(g.near) ? `  ${Math.round(g.near)}-${Math.round(g.far)} M` : `  ${Math.round(g.near)} M`);
      const guns = row.guns.length ? row.guns.slice(0, 2).map((g) => `${g.name}${dist(g)}`).join("   ·   ") : "NO HITS ON YOU";
      this.text(guns, bx, y + 96 * u, 600, 13 * u, "#c8d0d8");
      const right: string[] = [];
      if (row.healed) right.push(`HEALED ${row.healed.ago.toFixed(1)} S BEFORE (${row.healed.item})`);
      if (row.left) right.push(`LEFT: ${Math.round(row.left.shield)} SHIELD · ${Math.round(row.left.health)} HEALTH`);
      right.forEach((t, j) => this.text(t, x0 + w - 24 * u, y + 24 * u + j * 18 * u, 700, 12 * u, j === 0 && row.healed ? "#ffd23c" : DIM, "right"));
    });
    this.text(`${r.closeKey} CLOSES`, x0 + w - 22 * u, y0 + h - 12 * u, 600, 12 * u, DIM, "right");
    c.restore();
  }

  private measure(t: string, size: number): number {
    this.ctx.font = this.font(700, size);
    return this.ctx.measureText(t).width;
  }

  /** names and bars over the other players and the bots, fading with distance */
  private drawPlates(_now: number, camera: THREE.Camera, s: HudState, u: number): void {
    if (!s.plates?.length) return;
    const c = this.ctx;
    const v = new THREE.Vector3();
    const { range, fadeFrom } = hudCfg.plates;
    for (const pl of s.plates) {
      const dist = pl.world.distanceTo((camera as THREE.PerspectiveCamera).position);
      // the aim bot's mark is not subject to the plate rules: whoever has it
      // on is shown to everyone, at any range, through anything
      if (dist > range && !pl.aimbot) continue;
      v.copy(pl.world).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h;
      if (x < -50 || x > this.w + 50 || y < -50 || y > this.h + 50) continue;
      const a = pl.aimbot ? 1 : dist < fadeFrom ? 1 : 1 - (dist - fadeFrom) / (range - fadeFrom);
      c.globalAlpha = a * (pl.alive ? 1 : 0.5);
      const w = 110 * u;
      const col = !pl.alive ? DIM : pl.aimbot ? RED : pl.ally ? P.ally : WHITE;
      this.text(pl.alive ? pl.name : `${pl.name}  DOWN`, x, y - 12 * u, 700, 14 * u, col, "center");
      // the aim bot: a red bar and a word over them, so nobody has to wonder
      if (pl.aimbot && pl.alive) {
        c.fillStyle = RED;
        c.fillRect(x - w / 2, y - 30 * u, w, 5 * u);
        this.text("AIM BOT", x, y - 34 * u, 700, 12 * u, RED, "center");
      }
      if (pl.alive) {
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(x - w / 2, y - 8 * u, w, 4 * u);
        c.fillRect(x - w / 2, y - 3 * u, w, 4 * u);
        c.fillStyle = "#3b8bff";
        c.fillRect(x - w / 2, y - 8 * u, w * Math.max(0, Math.min(1, pl.shield / Math.max(1, pl.shieldMax))), 4 * u);
        c.fillStyle = pl.health > 30 ? "#d8e2ea" : RED;
        c.fillRect(x - w / 2, y - 3 * u, w * Math.max(0, Math.min(1, pl.health / 100)), 4 * u);
      }
      c.globalAlpha = 1;
    }
  }

  /** the kill feed under the FPS counter, six seconds a line */
  private drawFeed(now: number, u: number): void {
    const x = this.w - 30 * u;
    let y = 120 * u;
    for (let i = this.feedLines.length - 1; i >= 0; i--) if (now - this.feedLines[i].born > 6) this.feedLines.splice(i, 1);
    for (const l of this.feedLines) {
      const age = now - l.born;
      this.ctx.globalAlpha = age < 5 ? 1 : 1 - (age - 5);
      this.text(l.text, x, y, 700, 15 * u, l.color, "right");
      y += 20 * u;
    }
    this.ctx.globalAlpha = 1;
  }

  /** the match summary at the end: rounds, K/D, damage, accuracy */
  private drawSummary(s: HudState, u: number): void {
    const d = s.duel;
    if (!d || d.phase !== "matchEnd" || !d.summary || d.br) return;
    const sm = d.summary;
    const c = this.ctx;
    const cx = this.w / 2;
    const w = 420 * u;
    const h = 170 * u;
    const x0 = cx - w / 2;
    const y0 = this.h * 0.36 + 70 * u;
    c.fillStyle = "rgba(8,10,12,0.8)";
    c.fillRect(x0, y0, w, h);
    c.fillStyle = sm.won ? "#ffd23c" : RED;
    c.fillRect(x0, y0, w, 4 * u);
    const row = (i: number, label: string, value: string) => {
      const y = y0 + 34 * u + i * 26 * u;
      this.text(label, x0 + 24 * u, y, 600, 15 * u, DIM);
      this.text(value, x0 + w - 24 * u, y, 700, 16 * u, WHITE, "right");
    };
    const k = d.mode?.kind;
    row(0, k === "gunrun" ? "LEVEL REACHED" : k === "tdm" ? "TEAM SCORE" : "ROUNDS", k === "gunrun" ? `${sm.roundsWon + 1}` : `${sm.roundsWon} - ${sm.roundsLost}`);
    row(1, "KILLS / DEATHS", `${sm.kills} / ${sm.deaths}   K/D ${sm.deaths ? (sm.kills / sm.deaths).toFixed(2) : sm.kills.toFixed(2)}`);
    row(2, "DAMAGE", `${Math.round(sm.damage)}`);
    row(3, "ACCURACY", sm.shots ? `${Math.round((100 * sm.hits) / sm.shots)}%  (${sm.hits} of ${sm.shots})` : "-");
    row(4, "STREAK", `${sm.streak} win${sm.streak === 1 ? "" : "s"} in a row`);
  }

  private drawHurt(now: number): void {
    const age = now - this.hurtAt;
    if (age > 0.35) return;
    const c = this.ctx;
    const a = 1 - age / 0.35;
    const g = c.createRadialGradient(this.w / 2, this.h / 2, this.h * 0.3, this.w / 2, this.h / 2, this.h * 0.85);
    g.addColorStop(0, "rgba(220,30,20,0)");
    g.addColorStop(1, `rgba(220,30,20,${0.55 * a})`);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
  }

  /**
   * The 1v1: score under the compass, the round, a big countdown, the round
   * and match result, and the other player's ping.
   */
  private drawDuel(s: HudState, u: number): void {
    const d = s.duel;
    if (!d || d.br || d.mode) return;
    const cx = this.w / 2;
    const c = this.ctx;
    c.fillStyle = PANEL;
    c.fillRect(cx - 150 * u, 60 * u, 300 * u, 58 * u);
    this.text("YOU", cx - 120 * u, 97 * u, 700, 18 * u, "#7ddc8a");
    this.text(`${d.you}`, cx - 30 * u, 102 * u, 700, 38 * u, WHITE, "right");
    this.text("-", cx, 100 * u, 700, 30 * u, DIM, "center");
    this.text(`${d.them}`, cx + 30 * u, 102 * u, 700, 38 * u, WHITE);
    this.text("THEM", cx + 120 * u, 97 * u, 700, 18 * u, RED, "right");
    this.text(`ROUND ${d.round}   FIRST TO 3` + (d.ping !== null ? `   PING ${Math.round(d.ping)} ms` : ""), cx, 136 * u, 600, 14 * u, DIM, "center");
    // three or more: a scoreboard down the right, names, scores, who is up
    if (d.players.length > 2) {
      const x = this.w - 30 * u;
      d.players.forEach((p, i) => {
        const y = 140 * u + i * 22 * u;
        const col = p.you ? "#7ddc8a" : p.alive ? WHITE : DIM;
        this.text(`${p.alive ? "" : "DOWN  "}${p.name}`, x - 44 * u, y, 700, 15 * u, col, "right");
        this.text(`${p.score}`, x, y, 700, 18 * u, col, "right");
      });
    }
    if (d.waiting) this.text(d.waiting, cx, this.h * 0.42, 700, 34 * u, "#ffd23c", "center");
    // the circle: when it goes live, then who is holding it
    if (d.phase === "fight") {
      if (!d.zone.live) {
        this.text(`CIRCLE IN ${Math.ceil(d.zone.startsIn)}`, cx, 160 * u, 700, 16 * u, "#ffd23c", "center");
      } else {
        this.text("HOLD THE CIRCLE", cx, 160 * u, 700, 18 * u, "#ffd23c", "center");
        const bw = 200 * u;
        const bar = (y: number, v: number, col: string, label: string) => {
          c.fillStyle = "rgba(0,0,0,0.5)";
          c.fillRect(cx - bw / 2, y, bw, 8 * u);
          c.fillStyle = col;
          c.fillRect(cx - bw / 2, y, bw * Math.min(1, v / d.zone.need), 8 * u);
          this.text(label, cx - bw / 2 - 8 * u, y + 8 * u, 700, 12 * u, col, "right");
        };
        bar(170 * u, d.zone.you, "#7ddc8a", "YOU");
        bar(184 * u, d.zone.them, RED, "THEM");
      }
    }
    if (d.phase === "countdown") {
      this.text(`${Math.max(1, Math.ceil(d.left))}`, cx, this.h * 0.42, 700, 110 * u, WHITE, "center");
      this.text("GET READY", cx, this.h * 0.42 + 40 * u, 700, 22 * u, "#ffd23c", "center");
    } else if (d.phase === "roundEnd" && d.youWonRound !== null) {
      const winner = d.players.find((p) => !p.you && p.alive && d.players.length > 2 && !d.youWonRound);
      this.text(d.youWonRound ? "ROUND WON" : winner ? `${winner.name} TAKES THE ROUND` : "ROUND LOST", cx, this.h * 0.38, 700, 56 * u, d.youWonRound ? "#7ddc8a" : RED, "center");
    } else if (d.phase === "matchEnd" && d.youWonMatch !== null) {
      this.text(d.youWonMatch ? "YOU WIN THE MATCH" : "YOU LOST THE MATCH", cx, this.h * 0.36, 700, 60 * u, d.youWonMatch ? "#ffd23c" : RED, "center");
      this.text(`${d.you} - ${d.them}   rematch in ${Math.ceil(d.left)}`, cx, this.h * 0.36 + 44 * u, 700, 22 * u, WHITE, "center");
    }
  }

  /**
   * An arena mode: its panel under the compass (Gun Run: your level and gun,
   * the next; team deathmatch: the teams' scores; Crown: the rounds and where
   * the crown is), the clock, a scoreboard down the right, the crown's marker
   * in the world, the respawn count, the round and match results.
   */
  private drawMode(now: number, camera: THREE.Camera, s: HudState, u: number): void {
    const d = s.duel;
    const m = d?.mode;
    if (!d || !m) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const clock = (t: number) => `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;
    c.fillStyle = PANEL;
    c.fillRect(cx - 190 * u, 60 * u, 380 * u, 62 * u);
    const GOLD = "#ffd23c";
    if (m.gun) {
      this.text(`LEVEL ${m.gun.level} / ${m.gun.of}`, cx - 175 * u, 84 * u, 700, 14 * u, DIM);
      this.text(m.gun.name, cx - 175 * u, 110 * u, 700, 24 * u, m.gun.knife ? GOLD : WHITE);
      if (m.gun.next) this.text(`NEXT  ${m.gun.next}`, cx + 175 * u, 110 * u, 600, 13 * u, DIM, "right");
      if (m.left !== null) this.text(clock(m.left), cx + 175 * u, 88 * u, 700, 20 * u, m.left < 60 ? RED : WHITE, "right");
    } else if (m.teams) {
      this.text("YOUR TEAM", cx - 175 * u, 84 * u, 700, 13 * u, "#7ddc8a");
      this.text(`${m.teams.you}`, cx - 40 * u, 110 * u, 700, 36 * u, WHITE, "right");
      this.text("-", cx, 106 * u, 700, 28 * u, DIM, "center");
      this.text(`${m.teams.them}`, cx + 40 * u, 110 * u, 700, 36 * u, WHITE);
      this.text("THEM", cx + 175 * u, 84 * u, 700, 13 * u, RED, "right");
      this.text(`FIRST TO ${m.teams.limit}${m.left !== null ? `  ·  ${clock(m.left)}` : ""}`, cx, 138 * u, 600, 14 * u, DIM, "center");
    } else if (m.control) {
      const ct = m.control;
      const BLUE = "#3fa7ff";
      this.text("YOUR TEAM", cx - 175 * u, 80 * u, 700, 12 * u, BLUE);
      this.text(`${ct.you}`, cx - 175 * u, 110 * u, 700, 28 * u, WHITE);
      this.text("THEM", cx + 175 * u, 80 * u, 700, 12 * u, RED, "right");
      this.text(`${ct.them}`, cx + 175 * u, 110 * u, 700, 28 * u, WHITE, "right");
      // A B C: a square each in the holder's colour, the capture's fill from the side it leans to
      ct.zones.forEach((z, i) => {
        const sz = 34 * u;
        const x = cx + (i - 1) * 46 * u - sz / 2;
        const y = 70 * u;
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(x, y, sz, sz);
        const lean = z.v >= 0 ? BLUE : RED;
        c.fillStyle = z.owner === "you" ? BLUE : z.owner === "them" ? RED : "rgba(255,255,255,0.12)";
        c.globalAlpha = z.owner ? 0.85 : 1;
        c.fillRect(x, y, sz, sz);
        c.globalAlpha = 1;
        if (!z.owner && Math.abs(z.v) > 0.01) {
          c.fillStyle = lean;
          c.fillRect(x, y + sz * (1 - Math.abs(z.v)), sz, sz * Math.abs(z.v));
        }
        if (z.here) {
          c.strokeStyle = WHITE;
          c.lineWidth = 2 * u;
          c.strokeRect(x - 2 * u, y - 2 * u, sz + 4 * u, sz + 4 * u);
        }
        if (z.bonus) {
          c.strokeStyle = GOLD;
          c.lineWidth = 3 * u;
          c.strokeRect(x - 4 * u, y - 4 * u, sz + 8 * u, sz + 8 * u);
        }
        this.text(z.id, x + sz / 2, y + sz / 2 + 8 * u, 700, 20 * u, WHITE, "center");
      });
      const line = ct.lockout
        ? `${ct.lockout.mine ? "LOCKOUT: HOLD ALL THREE" : "LOCKOUT: RETAKE A ZONE"}  ·  ${Math.ceil(ct.lockout.left)} S`
        : ct.bonusLeft !== null
          ? `BONUS ZONE ${ct.zones.find((z) => z.bonus)?.id ?? ""}  ·  ${Math.ceil(ct.bonusLeft)} S`
          : `FIRST TO ${ct.limit}${m.left !== null ? `  ·  ${clock(m.left)}` : ""}`;
      this.text(line, cx, 138 * u, 700, 14 * u, ct.lockout ? (ct.lockout.mine ? BLUE : RED) : ct.bonusLeft !== null ? GOLD : DIM, "center");
      // each zone's letter in the world, held to the screen's edge
      for (const z of ct.zones) {
        if (z.here) continue;
        const v = z.at.clone().setY(z.at.y + 2.5).project(camera);
        if (v.z > 1) continue;
        const x = (v.x * 0.5 + 0.5) * this.w;
        const y = (-v.y * 0.5 + 0.5) * this.h;
        if (x < 0 || x > this.w || y < 0 || y > this.h) continue;
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillRect(x - 11 * u, y - 11 * u, 22 * u, 22 * u);
        this.text(z.id, x, y + 6 * u, 700, 16 * u, z.owner === "you" ? BLUE : z.owner === "them" ? RED : WHITE, "center");
      }
    } else if (m.ffa) {
      // free-for-all: your kills against the best of the others, the limit and the clock
      this.text("YOU", cx - 175 * u, 84 * u, 700, 13 * u, "#7ddc8a");
      this.text(`${m.ffa.you}`, cx - 40 * u, 110 * u, 700, 36 * u, WHITE, "right");
      this.text("-", cx, 106 * u, 700, 28 * u, DIM, "center");
      this.text(`${m.ffa.best}`, cx + 40 * u, 110 * u, 700, 36 * u, WHITE);
      this.text("BEST OTHER", cx + 175 * u, 84 * u, 700, 13 * u, RED, "right");
      this.text(`FIRST TO ${m.ffa.limit} KILLS${m.left !== null ? `  ·  ${clock(m.left)}` : ""}`, cx, 138 * u, 600, 14 * u, DIM, "center");
    } else if (m.crown) {
      const cr = m.crown;
      const best = Math.max(0, ...m.rows.filter((r) => !r.you).map((r) => r.wins));
      this.text("YOU", cx - 175 * u, 84 * u, 700, 13 * u, "#7ddc8a");
      this.text(`${cr.wins}`, cx - 40 * u, 110 * u, 700, 36 * u, WHITE, "right");
      this.text("-", cx, 106 * u, 700, 28 * u, DIM, "center");
      this.text(`${best}`, cx + 40 * u, 110 * u, 700, 36 * u, WHITE);
      this.text("BEST OTHER", cx + 175 * u, 84 * u, 700, 13 * u, RED, "right");
      this.text(`ROUND ${d.round}  ·  FIRST TO ${cr.roundsToWin}`, cx, 138 * u, 600, 14 * u, DIM, "center");
      if (d.phase === "fight") {
        if (cr.phase === "waiting") this.text(`THE CROWN IN ${Math.ceil(m.left ?? 0)}`, cx, 162 * u, 700, 16 * u, GOLD, "center");
        else if (cr.phase === "ground") this.text("THE CROWN IS UP: TAKE IT", cx, 162 * u, 700, 18 * u, GOLD, "center");
        else {
          this.text(cr.mine ? "YOU HAVE THE CROWN: STAY UP" : `${cr.carrier} HAS THE CROWN`, cx, 162 * u, 700, 18 * u, cr.mine ? "#7ddc8a" : GOLD, "center");
          const bw = 220 * u;
          c.fillStyle = "rgba(0,0,0,0.5)";
          c.fillRect(cx - bw / 2, 172 * u, bw, 8 * u);
          c.fillStyle = cr.mine ? "#7ddc8a" : GOLD;
          c.fillRect(cx - bw / 2, 172 * u, bw * Math.min(1, cr.held / cr.need), 8 * u);
          this.text(`${Math.floor(cr.held)} / ${cr.need} S`, cx + bw / 2 + 8 * u, 180 * u, 700, 12 * u, WHITE);
        }
        // the crown in the world, held to the screen's edge
        if (cr.phase !== "waiting" && !cr.mine) {
          const v = cr.at.clone().setY(cr.at.y + 0.6).project(camera);
          const pad = 40 * u;
          let x = (v.x * 0.5 + 0.5) * this.w;
          let y = (-v.y * 0.5 + 0.5) * this.h;
          if (v.z > 1) {
            x = this.w - x;
            y = this.h - pad;
          }
          x = Math.max(pad, Math.min(this.w - pad, x));
          y = Math.max(pad, Math.min(this.h - pad, y));
          const r = 11 * u * (1 + 0.1 * Math.sin(now * 6));
          c.fillStyle = GOLD;
          c.strokeStyle = "rgba(0,0,0,0.7)";
          c.lineWidth = 2 * u;
          c.beginPath();
          c.moveTo(x - r, y + r * 0.6);
          c.lineTo(x - r, y - r * 0.4);
          c.lineTo(x - r * 0.5, y + r * 0.1);
          c.lineTo(x, y - r * 0.7);
          c.lineTo(x + r * 0.5, y + r * 0.1);
          c.lineTo(x + r, y - r * 0.4);
          c.lineTo(x + r, y + r * 0.6);
          c.closePath();
          c.fill();
          c.stroke();
          const cam = (camera as THREE.PerspectiveCamera).position;
          this.text(`CROWN  ${Math.round(Math.hypot(cr.at.x - cam.x, cr.at.z - cam.z))} M`, x, y + r + 14 * u, 700, 12 * u, GOLD, "center");
        }
      }
    }
    // the scoreboard, down the right under the feed
    const x = this.w - 30 * u;
    const top = 270 * u;
    const value = (r: ModeRow) => (m.kind === "gunrun" ? `LV ${r.level + 1}  ·  ${r.kills}` : m.kind === "crown" ? `${r.wins}  ·  ${r.kills}` : `${r.kills} / ${r.deaths}`);
    this.text(m.kind === "gunrun" ? "LEVEL  ·  KILLS" : m.kind === "crown" ? "ROUNDS  ·  KILLS" : "KILLS / DEATHS", x, top - 18 * u, 700, 11 * u, DIM, "right");
    m.rows.slice(0, 9).forEach((r, i) => {
      const y = top + i * 19 * u;
      const col = r.you ? "#7ddc8a" : r.ally ? "#8fd8ff" : r.alive ? WHITE : DIM;
      this.text(value(r), x, y, 700, 14 * u, col, "right");
      this.text(`${r.alive ? "" : "DOWN  "}${r.name}`, x - 110 * u, y, 700, 14 * u, col, "right");
    });
    // down in a mode with respawns: back in soon
    if (m.respawnIn !== null && d.phase === "fight") {
      this.text(`BACK IN ${Math.max(1, Math.ceil(m.respawnIn))}`, cx, this.h * 0.3, 700, 40 * u, WHITE, "center");
    }
    if (d.waiting) this.text(d.waiting, cx, this.h * 0.42, 700, 34 * u, GOLD, "center");
    if (d.phase === "countdown") {
      this.text(`${Math.max(1, Math.ceil(d.left))}`, cx, this.h * 0.42, 700, 110 * u, WHITE, "center");
      this.text(m.title, cx, this.h * 0.42 + 40 * u, 700, 22 * u, GOLD, "center");
    } else if (d.phase === "roundEnd" && d.youWonRound !== null) {
      this.text(d.youWonRound ? "ROUND WON" : "ROUND LOST", cx, this.h * 0.38, 700, 56 * u, d.youWonRound ? "#7ddc8a" : RED, "center");
    } else if (d.phase === "matchEnd" && m.winner !== null) {
      const title = m.won ? (m.kind === "tdm" ? "YOUR TEAM WINS" : "YOU WIN") : m.winner === "NOBODY" ? "A DRAW" : `${m.winner} WINS`;
      this.text(title, cx, this.h * 0.3, 700, 60 * u, m.won ? GOLD : RED, "center");
      this.text(`${m.title}  ·  rematch in ${Math.ceil(d.left)}`, cx, this.h * 0.3 + 44 * u, 700, 22 * u, WHITE, "center");
    }
  }

  /** the lobby: the match code under the compass while friends are still to arrive */
  private drawLobby(s: HudState, u: number): void {
    const l = s.lobby;
    if (!l) return;
    const cx = this.w / 2;
    const c = this.ctx;
    const y = s.duel ? 200 * u : 60 * u;
    c.fillStyle = PANEL;
    c.fillRect(cx - 190 * u, y, 380 * u, 74 * u);
    this.text("MATCH CODE", cx, y + 22 * u, 700, 14 * u, DIM, "center");
    this.text(l.code.split("").join(" "), cx, y + 54 * u, 700, 34 * u, "#ffd23c", "center");
    const who = l.waitingFor === 1 ? "A FRIEND" : `${l.waitingFor} FRIENDS`;
    this.text(`WAITING FOR ${who}  ·  THE INVITE LINK IS ON YOUR CLIPBOARD (ESC TO SEE IT)`, cx, y + 92 * u, 600, 13 * u, WHITE, "center");
  }

  /** the tech feed, down the left edge under the stats, newest at the bottom */
  private drawTechFeed(now: number, u: number): void {
    const LIFE = 2.6;
    this.techFeed = this.techFeed.filter((e) => now - e.at < LIFE);
    const x0 = 26 * u;
    let y = 420 * u;
    const c = this.ctx;
    for (const e of this.techFeed) {
      const age = now - e.at;
      c.globalAlpha = age < LIFE - 0.5 ? 1 : (LIFE - age) / 0.5;
      // slide in from the left over the first tenth of a second
      const dx = Math.max(0, 1 - age / 0.1) * -30 * u;
      c.fillStyle = e.good ? "#7ddc8a" : "#ff9f43";
      c.fillRect(x0 + dx, y - 20 * u, 4 * u, 26 * u);
      this.text(e.name, x0 + dx + 12 * u, y, 700, 21 * u, e.good ? WHITE : "#ffcf9e");
      c.font = this.font(700, 21 * u);
      const nw = c.measureText(e.name).width;
      if (e.detail) this.text(e.detail, x0 + dx + 20 * u + nw, y, 600, 15 * u, DIM);
      y += 32 * u;
    }
    c.globalAlpha = 1;
  }

  /**
   * A magnified scope at full aim: the picture in a circle, black around it
   * with a soft inner edge, the lens rim, and the reticle drawn at screen
   * size. The gun is hidden while this is up (viewmodel.ts).
   */
  private drawScope(s: HudState, u: number): void {
    const sc = s.scope;
    if (!sc || sc.amount <= 0.001) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = this.h * 0.45;
    c.save();
    c.globalAlpha = sc.amount;
    c.fillStyle = "#050607";
    c.beginPath();
    c.rect(0, 0, this.w, this.h);
    c.arc(cx, cy, R, 0, Math.PI * 2, true);
    c.fill();
    const edge = c.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    edge.addColorStop(0, "rgba(5,6,7,0)");
    edge.addColorStop(1, "rgba(5,6,7,0.92)");
    c.fillStyle = edge;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#1d2126";
    c.lineWidth = 7 * u;
    c.stroke();
    // the reticle at a sensible size inside the picture, with screen-pixel
    // strokes (a lens texture's strokes scaled up to this size are bars)
    c.shadowColor = sc.color;
    c.shadowBlur = 4 * u;
    drawReticle(c, sc.style, sc.color, cx, cy, sc.style === "sniper" || sc.style === "dsniper" ? R : R * 0.6, Math.max(1.5, 3 * u));
    c.restore();
  }

  /** Apex-style interact prompt: a key cap and the action, under the crosshair */
  private drawPrompt(s: HudState, u: number): void {
    const p = s.prompt;
    if (!p) return;
    const c = this.ctx;
    const y = this.h * 0.58;
    c.font = this.font(700, 22 * u);
    const tw = c.measureText(p.text).width;
    c.font = this.font(700, 18 * u);
    const key = Math.max(30 * u, c.measureText(p.key).width + 16 * u);
    c.font = this.font(700, 22 * u);
    const gap = 10 * u;
    const total = key + gap + tw;
    const x = this.w / 2 - total / 2;
    const cap = 30 * u;
    c.fillStyle = PANEL;
    c.fillRect(x - 10 * u, y - cap / 2 - 6 * u, total + 20 * u, cap + 12 * u);
    c.fillStyle = "#f2f2f2";
    c.fillRect(x, y - cap / 2, key, cap);
    this.text(p.key, x + key / 2, y + 7 * u, 700, 18 * u, "#101214", "center");
    this.text(p.text, x + key + gap, y + 8 * u, 700, 22 * u, WHITE);
  }

  /**
   * What is lying at your feet, when there is more than one thing (the reach
   * list, src/game/brplay.ts): a short list under the prompt, nearest first,
   * every row ticked in its rarity's colour. The row the prompt points at is
   * picked out, the rows there is nothing to gain from are greyed, and the
   * cycle key steps down the list. Before this the game silently took
   * whichever item happened to be nearest the crosshair and you found out
   * what it was from the notice afterwards.
   */
  private drawReachList(u: number): void {
    const rows = REACH.rows;
    if (rows.length < 2) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const rowH = 21 * u;
    // under the prompt, and under the hold bar that shares the prompt's line
    const top = this.h * 0.58 + 30 * u;
    c.font = this.font(700, 14 * u);
    let widest = 0;
    for (const r of rows) widest = Math.max(widest, c.measureText(r.label).width);
    const pw = widest + 96 * u;
    const foot = REACH.cycleKey ? 16 * u : 0;
    c.fillStyle = PANEL;
    c.fillRect(cx - pw / 2, top - 6 * u, pw, rows.length * rowH + foot + 10 * u);
    rows.forEach((r, i) => {
      const y = top + i * rowH + 15 * u;
      const picked = r.key === REACH.pick;
      if (picked) {
        c.fillStyle = "rgba(242,242,242,0.12)";
        c.fillRect(cx - pw / 2 + 4 * u, y - 15 * u, pw - 8 * u, rowH);
      }
      c.fillStyle = r.dim ? "#5a5f66" : lootCfg.colors[r.rarity];
      c.fillRect(cx - pw / 2 + 12 * u, y - 11 * u, 4 * u, 13 * u);
      this.text(r.label, cx - pw / 2 + 24 * u, y, picked ? 700 : 600, 14 * u, r.dim ? "#5a5f66" : picked ? WHITE : "#c8d0d8");
      this.text(`${r.dist.toFixed(1)} M`, cx + pw / 2 - 12 * u, y, 600, 12 * u, DIM, "right");
    });
    if (REACH.cycleKey) this.text(`${REACH.cycleKey}: NEXT ITEM`, cx, top + rows.length * rowH + 8 * u, 600, 11 * u, DIM, "center");
  }

  // ------------------------------------------------------------ helpers

  private font(weight: number, size: number): string {
    return `${weight} ${Math.round(size)}px ${FONT}`;
  }

  private text(t: string, x: number, y: number, weight: number, size: number, color: string, align: CanvasTextAlign = "left"): void {
    const c = this.ctx;
    c.font = this.font(weight, size);
    c.textAlign = align;
    c.fillStyle = color;
    c.fillText(t, x, y);
  }

  // ------------------------------------------------------------ centre

  private drawDamageNumbers(now: number, camera: THREE.Camera, u: number): void {
    const c = this.ctx;
    const v = new THREE.Vector3();
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      const age = now - n.born;
      if (age > 0.9) {
        this.numbers.splice(i, 1);
        continue;
      }
      v.copy(n.world).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h - age * 60 * u - 14 * u;
      c.globalAlpha = age < 0.6 ? 1 : 1 - (age - 0.6) / 0.3;
      c.font = this.font(700, (n.big ? 30 : 24) * u);
      c.textAlign = "center";
      c.lineWidth = 4 * u;
      c.strokeStyle = "rgba(0,0,0,0.8)";
      c.strokeText(n.text, x, y);
      c.fillStyle = n.color;
      c.fillText(n.text, x, y);
    }
    c.globalAlpha = 1;
  }

  /**
   * The damage direction arcs. Drawn on their own rather than inside the
   * crosshair, because the crosshair goes away when you aim down sights and a
   * hit from behind matters most exactly then.
   */
  /** the quick chat list, left of centre, while it is open */
  private drawQuickChat(s: HudState, u: number): void {
    const lines = s.quickChat;
    if (!lines || !lines.length) return;
    const c = this.ctx;
    const x = 40 * u;
    const w = 230 * u;
    const rowH = 24 * u;
    const y = this.h * 0.42;
    c.fillStyle = "rgba(10,13,16,0.82)";
    c.fillRect(x, y, w, (lines.length + 1) * rowH + 12 * u);
    this.text("QUICK CHAT", x + 14 * u, y + 20 * u, 700, 13 * u, "#ffd23c");
    lines.forEach((line, i) => {
      this.text(`${i + 1}`, x + 14 * u, y + 20 * u + (i + 1) * rowH, 700, 14 * u, "#ffd23c");
      this.text(line, x + 38 * u, y + 20 * u + (i + 1) * rowH, 600, 14 * u, WHITE);
    });
  }

  /** the match summary: a card over the middle of the screen once a match ends */
  private drawMatchCard(s: HudState, u: number): void {
    const m = s.summary;
    if (!m || m.alpha <= 0) return;
    const c = this.ctx;
    const w = 420 * u;
    const rowH = 22 * u;
    const h = (118 + m.rows.length * 22 + m.lines.length * 20 + 46) * u;
    const x = this.w / 2 - w / 2;
    const y = this.h * 0.2;
    c.save();
    c.globalAlpha = m.alpha;
    c.fillStyle = "rgba(10,13,16,0.86)";
    c.fillRect(x, y, w, h);
    c.fillStyle = m.good ? "#ffd23c" : "#c8d0d8";
    c.fillRect(x, y, w, 4 * u);
    this.text(m.title, this.w / 2, y + 38 * u, 700, 30 * u, m.good ? "#ffd23c" : WHITE, "center");
    let ry = y + 70 * u;
    for (const [k, v] of m.rows) {
      this.text(k, x + 24 * u, ry, 600, 15 * u, DIM);
      this.text(v, x + w - 24 * u, ry, 700, 15 * u, WHITE, "right");
      ry += rowH;
    }
    ry += 8 * u;
    this.text(`+${m.xp} XP`, this.w / 2, ry + 6 * u, 700, 22 * u, "#ffd23c", "center");
    ry += 26 * u;
    for (const line of m.lines) {
      this.text(line, this.w / 2, ry, 600, 13 * u, "#ffe9a8", "center");
      ry += 20 * u;
    }
    // the level bar, running from where you were to where you are
    const bw = w - 48 * u;
    c.fillStyle = "rgba(255,255,255,0.12)";
    c.fillRect(x + 24 * u, ry + 4 * u, bw, 8 * u);
    c.fillStyle = "#ffd23c";
    c.fillRect(x + 24 * u, ry + 4 * u, bw * Math.max(0, Math.min(1, m.bar)), 8 * u);
    this.text(m.levelUp ? `LEVEL ${m.level}  ·  LEVEL UP` : `LEVEL ${m.level}`, this.w / 2, ry + 32 * u, 700, 14 * u, m.levelUp ? "#ffd23c" : DIM, "center");
    c.restore();
  }

  private drawDamageDirs(s: HudState, u: number): void {
    const dirs = s.damageDirs;
    if (!dirs || !dirs.length) return;
    const c = this.ctx;
    const cfg = hudCfg.damageDir;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const r = cfg.radius * u;
    const half = ((cfg.arc / 2) * Math.PI) / 180;
    c.lineCap = "round";
    for (const d of dirs) {
      // canvas angles start at +x and run clockwise; ours start straight up
      const a = d.angle - Math.PI / 2;
      c.strokeStyle = `rgba(${P.damage},${(0.9 * d.alpha).toFixed(3)})`;
      c.lineWidth = cfg.thick * u;
      c.beginPath();
      c.arc(cx, cy, r, a - half, a + half);
      c.stroke();
    }
    c.lineCap = "butt";
    c.lineWidth = 2;
  }

  private drawCrosshair(now: number, s: HudState, u: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const half = (s.coneDeg / 2) * (Math.PI / 180);
    const px = (Math.tan(half) / Math.tan((s.vFovDeg * Math.PI) / 360)) * (this.h / 2);
    const gap = Math.max(3, px);
    c.strokeStyle = "rgba(255,255,255,0.95)";
    c.lineWidth = 2;
    c.shadowColor = "rgba(0,0,0,0.8)";
    c.shadowBlur = 2;
    // Hipfire only, as in Apex: the crosshair is gone as soon as you start to
    // aim, and the sights (irons, reticle or scope) are the aim point. Hit
    // markers still show while aiming.
    const hip = s.holstered ? 0.35 : Math.max(0, 1 - s.adsFrac / 0.3);
    if (hip > 0 && s.reticle) {
      c.shadowBlur = 0;
      drawCrosshair2d(c, cx, cy, gap, u, hip, s.reticle);
      c.shadowBlur = 2;
    } else if (hip > 0) {
      c.globalAlpha = hip;
      const len = 7 * u + 3;
      for (const [dx, dy] of [
        [0, -1],
        [-0.866, 0.5],
        [0.866, 0.5],
      ]) {
        c.beginPath();
        c.moveTo(cx + dx * gap, cy + dy * gap);
        c.lineTo(cx + dx * (gap + len), cy + dy * (gap + len));
        c.stroke();
      }
      c.fillStyle = "rgba(255,255,255,0.95)";
      c.beginPath();
      c.arc(cx, cy, 1.4, 0, Math.PI * 2);
      c.fill();
      c.globalAlpha = 1;
    }
    // the mantle boost cue: a green ring while a superglide's window is open
    if (s.mantleCue) {
      c.strokeStyle = "rgba(125,220,138,0.95)";
      c.lineWidth = 3 * u;
      c.beginPath();
      c.arc(cx, cy, gap + 24 * u, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = 2;
    }
    // a gun's charge: a ring round the crosshair that closes as it fills
    const ch = s.gunCharge ?? 0;
    if (ch > 0.01 && !s.holstered) {
      c.lineWidth = 3 * u;
      c.strokeStyle = "rgba(0,0,0,0.5)";
      c.beginPath();
      c.arc(cx, cy, gap + 16 * u, 0, Math.PI * 2);
      c.stroke();
      c.strokeStyle = ch >= 0.999 ? "#ffd23c" : "#8fd8ff";
      c.beginPath();
      c.arc(cx, cy, gap + 16 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ch);
      c.stroke();
      c.lineWidth = 2;
    }
    if (now < this.hitMarkerUntil) {
      c.strokeStyle = this.hitMarkerHead ? "rgba(255,210,60,0.95)" : "rgba(255,255,255,0.9)";
      const r0 = gap + 4;
      const r1 = r0 + 8 * u + 2;
      for (const [dx, dy] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        c.beginPath();
        c.moveTo(cx + dx * r0 * 0.707, cy + dy * r0 * 0.707);
        c.lineTo(cx + dx * r1 * 0.707, cy + dy * r1 * 0.707);
        c.stroke();
      }
    }
    c.shadowBlur = 0;
  }

  private drawNotice(now: number, u: number): void {
    if (now >= this.noticeUntil) return;
    const a = Math.min(1, (this.noticeUntil - now) / 0.25);
    this.ctx.globalAlpha = a;
    this.text(this.noticeText, this.w / 2, this.h * 0.64, 700, 30 * u, "#ffd23c", "center");
    this.ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ top-left

  /**
   * Draw the world's collision boxes once into a top-down canvas. Taller
   * things are lighter, so walls read over floor-level cover. Rebuilt if the
   * number of solids changes (the course adds its own after load).
   */
  private buildMap(region?: HudState["mapRegion"]): void {
    const PX = MAP_PX;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    // the region's solids only: the BR map is 500 m from the range, and one
    // canvas for both would be tens of millions of pixels
    const inRegion = (s: { minX: number; maxX: number; minZ: number; maxZ: number }) =>
      !region || (s.maxX > region.minX && s.minX < region.maxX && s.maxZ > region.minZ && s.minZ < region.maxZ);
    const solids = RANGE_SOLIDS.filter(inRegion);
    for (const s of solids) {
      minX = Math.min(minX, s.minX);
      maxX = Math.max(maxX, s.maxX);
      minZ = Math.min(minZ, s.minZ);
      maxZ = Math.max(maxZ, s.maxZ);
    }
    if (region) {
      minX = region.minX;
      maxX = region.maxX;
      minZ = region.minZ;
      maxZ = region.maxZ;
    }
    if (!Number.isFinite(minX)) return;
    minX -= 10;
    minZ -= 10;
    maxX += 10;
    maxZ += 10;
    const cv = document.createElement("canvas");
    cv.width = Math.ceil((maxX - minX) * PX);
    cv.height = Math.ceil((maxZ - minZ) * PX);
    const g = cv.getContext("2d")!;
    g.fillStyle = region ? "#2a2d27" : "#1c2227";
    g.fillRect(0, 0, cv.width, cv.height);
    // Overhead pieces (the course roof, the vent slab) would cover what is
    // under them, so the map shows only what stands on the floor.
    const sorted = solids.filter((s) => s.base < 2.5).sort((a, b) => a.top - b.top);
    for (const s of sorted) {
      const shade = Math.min(1, s.top / 6);
      const l = Math.round(70 + shade * 120);
      g.fillStyle = `rgb(${l},${l + 6},${l + 12})`;
      g.fillRect((s.minX - minX) * PX, (s.minZ - minZ) * PX, (s.maxX - s.minX) * PX, (s.maxZ - s.minZ) * PX);
    }
    // ziplines in their yellow, and the course gate in orange
    g.strokeStyle = "#ffc21a";
    g.lineWidth = 2;
    for (const z of ZIPLINES) {
      if (!inRegion({ minX: Math.min(z.a.x, z.b.x), maxX: Math.max(z.a.x, z.b.x), minZ: Math.min(z.a.z, z.b.z), maxZ: Math.max(z.a.z, z.b.z) })) continue;
      g.beginPath();
      g.moveTo((z.a.x - minX) * PX, (z.a.z - minZ) * PX);
      g.lineTo((z.b.x - minX) * PX + 0.01, (z.b.z - minZ) * PX + 0.01);
      g.stroke();
      g.fillStyle = "#ffc21a";
      g.fillRect((z.a.x - minX) * PX - 3, (z.a.z - minZ) * PX - 3, 6, 6);
    }
    if (!region) {
      g.fillStyle = "#e2742b";
      for (const gate of [COURSE_GATE, COURSE_GATE_R]) g.fillRect((gate.minX - minX) * PX, (8 - minZ) * PX, (gate.maxX - gate.minX) * PX, 1 * PX);
    }
    this.map = cv;
    this.mapMinX = minX;
    this.mapMinZ = minZ;
    this.mapSolids = RANGE_SOLIDS.length;
    this.mapRegionKey = region ? `${region.minX},${region.minZ},${region.maxX},${region.maxZ}` : "";
  }

  private ensureMap(s: HudState): void {
    const key = s.mapRegion ? `${s.mapRegion.minX},${s.mapRegion.minZ},${s.mapRegion.maxX},${s.mapRegion.maxZ}` : "";
    if (this.mapSolids !== RANGE_SOLIDS.length || key !== this.mapRegionKey) this.buildMap(s.mapRegion);
  }

  /** the rings on a map: the live one orange, the next one white */
  private drawRings(s: HudState, toX: (x: number) => number, toZ: (z: number) => number, scale: number, u: number): void {
    const br = s.duel?.br;
    if (!br) return;
    const c = this.ctx;
    c.lineWidth = 2 * u;
    c.strokeStyle = "rgba(255,255,255,0.9)";
    c.beginPath();
    c.arc(toX(br.ring.next.cx), toZ(br.ring.next.cz), Math.max(0.5, br.ring.next.r * scale), 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = "rgba(255,122,26,0.95)";
    c.lineWidth = 2.5 * u;
    c.beginPath();
    c.arc(toX(br.ring.current.cx), toZ(br.ring.current.cz), Math.max(0.5, br.ring.current.r * scale), 0, Math.PI * 2);
    c.stroke();
  }

  /**
   * The battle royale's map icons: jump towers (a balloon), respawn beacons (a
   * green mast), care packages (a blue box, falling or down), pings, and the
   * squad mates. `yaw` turns the labels back upright on the rotating minimap.
   */
  private drawMapIcons(s: HudState, toX: (x: number) => number, toZ: (z: number) => number, u: number, yaw: number): void {
    const br = s.duel?.br;
    if (!br) return;
    const c = this.ctx;
    const dot = (x: number, z: number, r: number, fill: string) => {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(toX(x), toZ(z), r * u, 0, Math.PI * 2);
      c.fill();
    };
    const upright = (x: number, z: number, draw: () => void) => {
      c.save();
      c.translate(toX(x), toZ(z));
      c.rotate((-yaw * Math.PI) / 180);
      draw();
      c.restore();
    };
    c.strokeStyle = "rgba(0,0,0,0.8)";
    c.lineWidth = 1.5 * u;
    for (const t of br.towers) {
      dot(t.x, t.z, 5, "#e04848");
      c.stroke();
      upright(t.x, t.z, () => {
        c.fillStyle = "#e04848";
        c.fillRect(-0.8 * u, 5 * u, 1.6 * u, 6 * u);
      });
    }
    for (const b of br.beacons) {
      upright(b.x, b.z, () => {
        c.fillStyle = "#3ddc84";
        c.beginPath();
        c.moveTo(0, -7 * u);
        c.lineTo(5 * u, 5 * u);
        c.lineTo(-5 * u, 5 * u);
        c.closePath();
        c.fill();
        c.stroke();
      });
    }
    for (const p of br.pods) {
      upright(p.x, p.z, () => {
        c.fillStyle = p.landed ? "#3b8bff" : "rgba(59,139,255,0.5)";
        c.fillRect(-5 * u, -5 * u, 10 * u, 10 * u);
        c.strokeRect(-5 * u, -5 * u, 10 * u, 10 * u);
      });
    }
    for (const m of s.markers ?? []) {
      upright(m.at.x, m.at.z, () => {
        c.fillStyle = m.k === "enemy" ? P.enemy : m.k === "loot" ? "#8fd8ff" : "#ffd23c";
        c.beginPath();
        c.moveTo(0, -6 * u);
        c.lineTo(6 * u, 0);
        c.lineTo(0, 6 * u);
        c.lineTo(-6 * u, 0);
        c.closePath();
        c.fill();
        c.stroke();
      });
    }
    for (const m of br.mates) {
      if (!m.alive) continue;
      dot(m.x, m.z, 5, m.downed ? "#ff4b3e" : "#3ddc84");
      c.stroke();
    }
  }

  private drawMinimap(s: HudState, u: number): void {
    this.ensureMap(s);
    const c = this.ctx;
    const size = 230 * u;
    const x0 = 26 * u;
    const y0 = 26 * u;
    const metres = s.duel?.br ? 160 : 70; // across the minimap
    c.save();
    c.fillStyle = PANEL;
    c.fillRect(x0, y0, size, size);
    c.beginPath();
    c.rect(x0, y0, size, size);
    c.clip();
    if (this.map) {
      const scale = size / metres / MAP_PX;
      c.translate(x0 + size / 2, y0 + size / 2);
      // Rotate so the direction you face is up. Yaw is positive to the left
      // and 0 faces -z, which is "up" on an unrotated map.
      c.rotate((s.yaw * Math.PI) / 180);
      c.scale(scale, scale);
      c.globalAlpha = 0.9;
      c.drawImage(this.map, -(s.px - this.mapMinX) * MAP_PX, -(s.pz - this.mapMinZ) * MAP_PX);
      c.globalAlpha = 1;
      // the rings, in the same rotated frame (metres to canvas pixels)
      const k = MAP_PX;
      this.drawRings(s, (x) => (x - s.px) * k, (z) => (z - s.pz) * k, k, u / scale);
      this.drawMapIcons(s, (x) => (x - s.px) * k, (z) => (z - s.pz) * k, u / scale, s.yaw);
    }
    c.restore();
    // frame and player arrow
    c.strokeStyle = "rgba(255,255,255,0.35)";
    c.lineWidth = 1.5;
    c.strokeRect(x0, y0, size, size);
    const ax = x0 + size / 2;
    const ay = y0 + size / 2;
    c.fillStyle = "#ffd23c";
    c.beginPath();
    c.moveTo(ax, ay - 9 * u);
    c.lineTo(ax + 6 * u, ay + 7 * u);
    c.lineTo(ax, ay + 3 * u);
    c.lineTo(ax - 6 * u, ay + 7 * u);
    c.closePath();
    c.fill();
  }

  /**
   * The full map (M, and shown through the drop): the region to fit the
   * screen, north up, the POIs named, the rings, you as an arrow, and while
   * dropping a pulsing marker on the POI you are dropping onto.
   */
  private drawFullMap(now: number, s: HudState, u: number): void {
    if (!s.mapOpen || !this.map) return;
    const c = this.ctx;
    const r = s.mapRegion ?? { minX: this.mapMinX, maxX: this.mapMinX + this.map.width / MAP_PX, minZ: this.mapMinZ, maxZ: this.mapMinZ + this.map.height / MAP_PX };
    const side = Math.min(this.w * 0.62, this.h * 0.8);
    const scale = side / Math.max(r.maxX - r.minX, r.maxZ - r.minZ);
    const x0 = this.w / 2 - ((r.maxX - r.minX) * scale) / 2;
    const y0 = this.h / 2 - ((r.maxZ - r.minZ) * scale) / 2;
    const toX = (x: number) => x0 + (x - r.minX) * scale;
    const toZ = (z: number) => y0 + (z - r.minZ) * scale;
    c.save();
    c.fillStyle = "rgba(4,6,8,0.78)";
    c.fillRect(0, 0, this.w, this.h);
    c.drawImage(this.map, (r.minX - this.mapMinX) * MAP_PX, (r.minZ - this.mapMinZ) * MAP_PX, (r.maxX - r.minX) * MAP_PX, (r.maxZ - r.minZ) * MAP_PX, x0, y0, (r.maxX - r.minX) * scale, (r.maxZ - r.minZ) * scale);
    c.strokeStyle = "rgba(255,255,255,0.4)";
    c.lineWidth = 1.5 * u;
    c.strokeRect(x0, y0, (r.maxX - r.minX) * scale, (r.maxZ - r.minZ) * scale);
    const br = s.duel?.br;
    if (br) {
      this.drawRings(s, toX, toZ, scale, u);
      this.drawMapIcons(s, toX, toZ, u, 0);
      for (const p of br.pois) {
        const mine = br.dropping && p.name === br.poi;
        this.text(p.name, toX(p.x), toZ(p.z) - 10 * u, 700, (mine ? 18 : 14) * u, mine ? "#ffd23c" : WHITE, "center");
        if (mine) {
          const pulse = 1 + 0.35 * Math.sin(now * 6);
          c.strokeStyle = "#ffd23c";
          c.lineWidth = 3 * u;
          c.beginPath();
          c.arc(toX(p.x), toZ(p.z), 18 * u * pulse, 0, Math.PI * 2);
          c.stroke();
        }
      }
    }
    // you, as the minimap's arrow, facing the way you face
    c.translate(toX(s.px), toZ(s.pz));
    c.rotate((-s.yaw * Math.PI) / 180);
    c.fillStyle = "#ffd23c";
    c.beginPath();
    c.moveTo(0, -10 * u);
    c.lineTo(7 * u, 8 * u);
    c.lineTo(0, 4 * u);
    c.lineTo(-7 * u, 8 * u);
    c.closePath();
    c.fill();
    c.restore();
    if (br?.dropping) {
      this.text(`DROPPING INTO ${br.poi}`, this.w / 2, y0 - 26 * u, 700, 34 * u, "#ffd23c", "center");
      this.text("STEER WITH THE MOVEMENT KEYS", this.w / 2, y0 + (r.maxZ - r.minZ) * scale + 34 * u, 600, 15 * u, DIM, "center");
    } else this.text("M CLOSES THE MAP", this.w / 2, y0 + (r.maxZ - r.minZ) * scale + 34 * u, 600, 15 * u, DIM, "center");
  }

  /** the battle royale: who is left, the ring's clock, outside the ring, the heal, the card */
  private drawBr(now: number, s: HudState, u: number): void {
    const br = s.duel?.br;
    if (!br) return;
    const c = this.ctx;
    const cx = this.w / 2;
    // top centre, under the compass: alive, kills, the ring's clock
    c.fillStyle = PANEL;
    c.fillRect(cx - 170 * u, 60 * u, 340 * u, 58 * u);
    this.text(`${br.alive}`, cx - 120 * u, 102 * u, 700, 38 * u, WHITE, "center");
    this.text("ALIVE", cx - 120 * u, 76 * u, 700, 13 * u, DIM, "center");
    this.text(`${br.kills}`, cx + 120 * u, 102 * u, 700, 38 * u, "#7ddc8a", "center");
    this.text("KILLS", cx + 120 * u, 76 * u, 700, 13 * u, DIM, "center");
    const d = s.duel!;
    if (d.waiting) this.text(d.waiting, cx, this.h * 0.42, 700, 34 * u, "#ffd23c", "center");
    const t = br.ring.timeLeft;
    const mm = Math.floor(t / 60);
    const ss = Math.floor(t % 60);
    const clock = `${mm}:${ss.toString().padStart(2, "0")}`;
    const ringDone = br.ring.phase >= br.ring.phases && !br.ring.closing;
    this.text(ringDone ? "RING CLOSED" : br.ring.closing ? "RING CLOSING" : `RING ${br.ring.phase} CLOSES IN`, cx, 80 * u, 700, 13 * u, br.ring.closing ? "#ff7a1a" : DIM, "center");
    this.text(ringDone ? "" : clock, cx, 108 * u, 700, 30 * u, br.ring.closing ? "#ff7a1a" : WHITE, "center");
    // outside: an orange vignette and the damage it costs
    if (br.ring.outside && !br.dropping && !br.placement) {
      const g = c.createRadialGradient(cx, this.h / 2, this.h * 0.35, cx, this.h / 2, this.h * 0.9);
      g.addColorStop(0, "rgba(255,110,20,0)");
      g.addColorStop(1, `rgba(255,110,20,${0.35 + 0.1 * Math.sin(now * 5)})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
      this.text(`OUTSIDE THE RING  ·  ${br.ring.damage} EVERY 1.5 S`, cx, this.h * 0.3, 700, 26 * u, "#ff9a4a", "center");
    }
    // the heal in progress, and the kit
    if (s.heal) {
      const bw = 260 * u;
      const y = this.h * 0.62;
      c.fillStyle = "rgba(0,0,0,0.55)";
      c.fillRect(cx - bw / 2, y, bw, 10 * u);
      c.fillStyle = "#7ddc8a";
      c.fillRect(cx - bw / 2, y, bw * s.heal.progress, 10 * u);
      this.text(s.heal.item.toUpperCase(), cx, y - 8 * u, 700, 15 * u, WHITE, "center");
    }
    // the card at the end
    if (br.placement !== null) {
      const won = br.placement === 1;
      this.text(won ? "YOU ARE THE CHAMPION" : `#${br.placement} OF ${br.total}`, cx, this.h * 0.3, 700, 62 * u, won ? "#ffd23c" : WHITE, "center");
      const m = Math.floor(br.survived / 60);
      const sec = Math.floor(br.survived % 60);
      this.text(`${br.kills} kill${br.kills === 1 ? "" : "s"}  ·  ${m}:${sec.toString().padStart(2, "0")} survived  ·  menu in ${Math.ceil(s.duel?.left ?? 0)}`, cx, this.h * 0.3 + 44 * u, 700, 22 * u, DIM, "center");
    }
  }

  /**
   * The ability, bottom left beside the bars: a square with its key, a dark
   * sweep for the cooldown and the seconds left, a bright edge when ready.
   * TRIAGE is passive: a cross and "HEALS x2".
   */
  private drawAbility(now: number, s: HudState, u: number): void {
    const a = s.ability;
    if (!a) return;
    const c = this.ctx;
    const size = 54 * u;
    const x = 384 * u;
    const y = this.h - 76 * u - size;
    c.fillStyle = PANEL;
    c.fillRect(x, y, size, size);
    const ready = a.passive || a.left <= 0;
    // the icon: a chevron for JOLT, a cross for TRIAGE
    c.save();
    c.translate(x + size / 2, y + size / 2);
    c.strokeStyle = ready ? "#8fd8ff" : "rgba(143,216,255,0.45)";
    c.fillStyle = c.strokeStyle;
    c.lineWidth = 4 * u;
    if (a.passive) {
      c.fillRect(-4 * u, -14 * u, 8 * u, 28 * u);
      c.fillRect(-14 * u, -4 * u, 28 * u, 8 * u);
    } else {
      for (const dx of [-8, 4]) {
        c.beginPath();
        c.moveTo((dx - 5) * u, -12 * u);
        c.lineTo((dx + 7) * u, 0);
        c.lineTo((dx - 5) * u, 12 * u);
        c.stroke();
      }
    }
    c.restore();
    if (!ready) {
      // the cooldown: a dark pie over what is still to come, the seconds on top
      const frac = Math.max(0, Math.min(1, a.left / Math.max(1e-3, a.cooldown)));
      c.fillStyle = "rgba(0,0,0,0.62)";
      c.save();
      c.beginPath();
      c.rect(x, y, size, size);
      c.clip();
      c.beginPath();
      c.moveTo(x + size / 2, y + size / 2);
      c.arc(x + size / 2, y + size / 2, size * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
      c.closePath();
      c.fill();
      c.restore();
      this.text(a.left.toFixed(1), x + size / 2, y + size / 2 + 7 * u, 700, 18 * u, WHITE, "center");
    } else {
      c.strokeStyle = `rgba(143,216,255,${0.55 + 0.25 * Math.sin(now * 4)})`;
      c.lineWidth = 2 * u;
      c.strokeRect(x + 1, y + 1, size - 2, size - 2);
    }
    // the key cap, top left, and the name under the square
    if (!a.passive) {
      c.fillStyle = "#f2f2f2";
      c.fillRect(x - 6 * u, y - 6 * u, 20 * u, 18 * u);
      this.text(a.key, x + 4 * u, y + 8 * u, 700, 12 * u, "#101214", "center");
    }
    // the charges: a pip each under the square, full when there, the next one filling as it comes back
    let nameY = y + size + 16 * u;
    if (!a.passive && (a.max ?? 0) > 1) {
      const n = a.max!;
      const have = a.charges ?? 0;
      const gapPx = 4 * u;
      const pw = (size - gapPx * (n - 1)) / n;
      const py = y + size + 4 * u;
      const fill = 1 - Math.max(0, Math.min(1, (a.nextIn ?? 0) / Math.max(1e-3, a.cooldown)));
      for (let i = 0; i < n; i++) {
        const px = x + i * (pw + gapPx);
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(px, py, pw, 5 * u);
        const f = i < have ? 1 : i === have ? fill : 0;
        if (f > 0) {
          c.fillStyle = i < have ? "#8fd8ff" : "rgba(143,216,255,0.5)";
          c.fillRect(px, py, pw * f, 5 * u);
        }
      }
      nameY += 8 * u;
    }
    this.text(a.passive ? `${a.name}  HEALS x2` : a.name, x + size / 2, nameY, 700, 13 * u, ready ? WHITE : DIM, "center");
  }

  /**
   * The ability card. Full: a panel low in the middle, "CHOOSE YOUR ABILITY",
   * the two options side by side with their keys. Compact: one line over the
   * ability square, for when it has been up a while or you are in the range.
   */
  private drawAbilityCard(s: HudState, u: number): void {
    const k = s.abilityCard;
    if (!k) return;
    const c = this.ctx;
    if (k.compact) {
      const line = k.options.map((o) => `[${o.key}] ${o.name}`).join("   ");
      this.text(`ABILITY   ${line}`, 384 * u, this.h - 150 * u, 700, 14 * u, "#8fd8ff");
      return;
    }
    const cx = this.w / 2;
    const w = 620 * u;
    const h = 128 * u;
    const y0 = this.h * 0.7;
    // slides up over the first quarter second
    const rise = Math.max(0, 1 - k.age / 0.25) * 30 * u;
    c.save();
    c.globalAlpha = Math.min(1, k.age / 0.2);
    c.fillStyle = "rgba(8,10,12,0.82)";
    c.fillRect(cx - w / 2, y0 + rise, w, h);
    c.fillStyle = "#8fd8ff";
    c.fillRect(cx - w / 2, y0 + rise, w, 3 * u);
    this.text("CHOOSE YOUR ABILITY", cx, y0 + rise + 24 * u, 700, 15 * u, "#8fd8ff", "center");
    const bw = (w - 36 * u) / 2;
    k.options.forEach((o, i) => {
      const bx = cx - w / 2 + 12 * u + i * (bw + 12 * u);
      const by = y0 + rise + 36 * u;
      c.fillStyle = o.picked ? "rgba(143,216,255,0.18)" : "rgba(255,255,255,0.06)";
      c.fillRect(bx, by, bw, h - 48 * u);
      c.fillStyle = "#f2f2f2";
      c.fillRect(bx + 10 * u, by + 12 * u, 30 * u, 30 * u);
      this.text(o.key, bx + 25 * u, by + 34 * u, 700, 18 * u, "#101214", "center");
      this.text(o.name, bx + 52 * u, by + 34 * u, 700, 26 * u, o.picked ? "#8fd8ff" : WHITE);
      this.text(o.blurb, bx + 10 * u, by + 64 * u, 600, 14 * u, DIM);
    });
    c.restore();
  }

  /** the heal kit, bottom left over the bars: what is left of each */
  private drawKit(s: HudState, u: number): void {
    if (!s.kit) {
      this.drawOrdnance(s, u, 384 * u, this.h - 52 * u);
      this.drawHealWheel(s, u);
      return;
    }
    const x = 34 * u + 350 * u;
    const y = this.h - 52 * u;
    const short: Record<string, string> = { cell: "CELL", battery: "BATT", syringe: "SYR", medkit: "MED", phoenix: PHOENIX_SHORT };
    const parts = ["cell", "battery", "syringe", "medkit", "phoenix"].filter((k) => (s.kit?.[k] ?? 0) > 0 || k === "cell" || k === "syringe").map((k) => `${short[k]} ${s.kit?.[k] ?? 0}`);
    const any = Object.values(s.kit).some((n) => n > 0);
    this.text(`${s.healKey ?? "4"}  ${parts.join("  ")}`, x, y, 700, 13 * u, any ? DIM : "rgba(154,164,173,0.4)");
    this.drawOrdnance(s, u, x, y - 18 * u);
    this.drawHealWheel(s, u);
  }

  /** the grenades you carry, over the heals, and the one in hand under the crosshair */
  private drawOrdnance(s: HudState, u: number, x: number, y: number): void {
    const o = s.ordnance;
    if (!o) return;
    if (o.counts) {
      const short: Record<string, string> = { frag: "FRAG", arcstar: "STAR", thermite: "THERM", shockwave: "WAVE", rift: "RIFT" };
      const any = Object.values(o.counts).some((n) => n > 0);
      const color = any ? DIM : "rgba(154,164,173,0.4)";
      // An icon and a count read faster than five words, and at a glance the
      // shapes are what you actually recognise. Every icon that is not here
      // yet falls back to the word it replaced, so a checkout that has not
      // run npm run icons looks exactly like the old row and nothing leaves
      // a hole while the files load.
      const size = 15 * u;
      let cx = x;
      this.text(o.key, cx, y, 700, 13 * u, color);
      cx += this.ctx.measureText(o.key).width + 10 * u;
      for (const [k, n] of Object.entries(o.counts)) {
        if (drawIcon(this.ctx, k, cx + size / 2, y - 4 * u, size, color)) cx += size + 3 * u;
        else {
          const word = short[k] ?? k;
          this.text(word, cx, y, 700, 13 * u, color);
          cx += this.ctx.measureText(word).width + 3 * u;
        }
        const count = String(n);
        this.text(count, cx, y, 700, 13 * u, color);
        cx += this.ctx.measureText(count).width + 10 * u;
      }
    }
    if (o.readied) {
      const cx = this.w / 2;
      const y0 = this.h * 0.64;
      this.text(o.readied, cx, y0, 700, 18 * u, o.ready ? "#ffd27a" : DIM, "center");
      this.text(o.ready ? `${o.fire} THROW  ·  ${o.cancel} PUT AWAY  ·  ${o.key} NEXT` : "PULLING THE PIN", cx, y0 + 18 * u, 600, 12 * u, DIM, "center");
    }
  }

  /** the heal wheel: the five heals round the crosshair, the one pointed at lit, a count on each */
  private drawHealWheel(s: HudState, u: number): void {
    const w = s.healWheel;
    if (!w) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = 120 * u;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.arc(cx, cy, R + 50 * u, 0, Math.PI * 2);
    c.fill();
    w.items.forEach((it, i) => {
      const a = (i / w.items.length) * Math.PI * 2;
      const x = cx + Math.sin(a) * R;
      const y = cy - Math.cos(a) * R;
      const on = w.pick === it.id;
      c.fillStyle = on ? "rgba(125,220,138,0.35)" : "rgba(8,10,12,0.75)";
      c.beginPath();
      c.arc(x, y, 36 * u, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = on ? "#7ddc8a" : "rgba(255,255,255,0.25)";
      c.lineWidth = 2 * u;
      c.stroke();
      this.text(it.name.toUpperCase(), x, y - 2 * u, 700, 12 * u, it.count > 0 ? WHITE : DIM, "center");
      this.text(`${it.count}`, x, y + 16 * u, 700, 16 * u, it.count > 0 ? (on ? "#7ddc8a" : WHITE) : RED, "center");
    });
    this.text("MOVE TO AN ITEM, LET GO TO USE IT", cx, cy + R + 70 * u, 700, 13 * u, DIM, "center");
  }

  private drawStats(s: HudState, u: number): void {
    const x0 = 26 * u;
    const y0 = 26 * u + 230 * u + 10 * u;
    const w = 230 * u;
    const c = this.ctx;
    c.fillStyle = PANEL;
    c.fillRect(x0, y0, w, 104 * u);
    const acc = s.stats.shots ? Math.round((100 * s.stats.hits) / s.stats.shots) : 0;
    const lh = 19 * u;
    const lines: Array<[string, string]> = [
      ["ACCURACY", `${acc}%  ${s.stats.hits}/${s.stats.shots}`],
      ["DAMAGE", `${s.stats.damage}   HS ${s.stats.headshots}`],
      ["KNOCKS", `${s.stats.knocks}   TTK ${s.stats.lastTtk === null ? "-" : s.stats.lastTtk.toFixed(2)}`],
      ["DUMMY", `${s.armorName.toUpperCase()}  (T)`],
      ["SENS", `${s.cm360.toFixed(1)} cm/360  FOV ${s.hipFov.toFixed(0)}`],
    ];
    lines.forEach(([k, v], i) => {
      this.text(k, x0 + 10 * u, y0 + 20 * u + i * lh, 600, 13 * u, DIM);
      this.text(v, x0 + w - 10 * u, y0 + 20 * u + i * lh, 700, 14 * u, WHITE, "right");
    });
  }

  // ------------------------------------------------------------ top

  private drawCompass(s: HudState, u: number): void {
    const c = this.ctx;
    const cx = this.w / 2;
    const y = 34 * u;
    const width = 560 * u;
    const span = 90; // degrees visible across the strip
    // Bearing: 0 = north = -z; yaw is positive to the left, so bearing = -yaw
    const bearing = ((-s.yaw % 360) + 360) % 360;
    c.save();
    c.beginPath();
    c.rect(cx - width / 2, y - 20 * u, width, 40 * u);
    c.clip();
    const grad = c.createLinearGradient(cx - width / 2, 0, cx + width / 2, 0);
    grad.addColorStop(0, "rgba(8,10,12,0)");
    grad.addColorStop(0.2, "rgba(8,10,12,0.45)");
    grad.addColorStop(0.8, "rgba(8,10,12,0.45)");
    grad.addColorStop(1, "rgba(8,10,12,0)");
    c.fillStyle = grad;
    c.fillRect(cx - width / 2, y - 16 * u, width, 30 * u);
    const names: Record<number, string> = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };
    const start = Math.floor((bearing - span / 2) / 5) * 5;
    for (let b = start; b <= bearing + span / 2; b += 5) {
      const d = b - bearing;
      const x = cx + (d / span) * width;
      const bb = ((b % 360) + 360) % 360;
      const major = bb % 15 === 0;
      c.strokeStyle = major ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.35)";
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(x, y + 6 * u);
      c.lineTo(x, y + (major ? -2 : 2) * u);
      c.stroke();
      // labels only where they fit whole; a clipped "NE" read as "N"
      const inside = Math.abs(d) < span / 2 - 7;
      if (inside && names[bb]) this.text(names[bb], x, y - 5 * u, 700, 17 * u, bb === 0 ? "#ffd23c" : WHITE, "center");
      else if (inside && major) this.text(String(bb), x, y - 5 * u, 600, 13 * u, DIM, "center");
    }
    c.restore();
    // bearing readout
    this.text(String(Math.round(bearing) % 360), cx, y + 26 * u, 700, 16 * u, WHITE, "center");
    c.fillStyle = "#ffd23c";
    c.beginPath();
    c.moveTo(cx, y + 9 * u);
    c.lineTo(cx - 5 * u, y + 15 * u);
    c.lineTo(cx + 5 * u, y + 15 * u);
    c.closePath();
    c.fill();
  }

  /** FPS: the biggest number on the screen, by request */
  private drawFps(s: HudState, u: number): void {
    const x = this.w - 30 * u;
    const y = 74 * u;
    const f = Math.round(s.fps);
    const color = s.frameMs > 16.7 ? RED : s.frameMs > 8.4 ? "#ffd23c" : "#7ddc8a";
    this.ctx.lineWidth = 5 * u;
    this.ctx.strokeStyle = "rgba(0,0,0,0.6)";
    this.ctx.font = this.font(700, 64 * u);
    this.ctx.textAlign = "right";
    this.ctx.strokeText(String(f), x - 50 * u, y);
    this.text(String(f), x - 50 * u, y, 700, 64 * u, color, "right");
    this.text("FPS", x, y - 8 * u, 700, 22 * u, DIM, "right");
    this.text(`${s.frameMs.toFixed(1)} ms frame`, x, y + 24 * u, 600, 15 * u, DIM, "right");
  }

  // ------------------------------------------------------------ bottom-left

  private drawVitals(s: HudState, u: number): void {
    const c = this.ctx;
    const x0 = 34 * u;
    const barW = 330 * u;
    const yShield = this.h - 72 * u;
    const yHealth = this.h - 50 * u;
    // speed and stance, which movement players actually read
    const stanceColor = s.stance === "slide" ? "#ffd27a" : s.stance === "air" ? "#8fc7ff" : s.stance === "climb" ? "#7ddc8a" : WHITE;
    this.text(`${s.speedHu.toFixed(0)}`, x0, yShield - 26 * u, 700, 34 * u, WHITE);
    this.text(`HU/S   ${s.stance.toUpperCase()}${s.holstered ? "   HOLSTERED" : ""}`, x0 + 72 * u, yShield - 30 * u, 700, 15 * u, stanceColor);
    // shield: segmented in 25s like the game. Real values in a 1v1 (blue
    // shields, three segments); full purple bars otherwise.
    const v = s.vitals;
    const segs = v ? Math.round(v.shieldMax / 25) : 4;
    const gap = 4 * u;
    const segW = (barW - gap * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) {
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(x0 + i * (segW + gap), yShield, segW, 10 * u);
      const fill = v ? Math.max(0, Math.min(1, (v.shield - i * 25) / 25)) : 1;
      // the shield's colour is its tier: white 50, blue 75, purple 100, red 125
      c.fillStyle = v ? (v.shieldMax >= 125 ? "#ff3b3b" : v.shieldMax >= 100 ? SHIELD : v.shieldMax >= 75 ? "#3b8bff" : "#e8e8e8") : SHIELD;
      c.fillRect(x0 + i * (segW + gap), yShield, segW * fill, 10 * u);
    }
    // EVO: how far the shield core is to its next level, a thin bar under the shield
    if (v && v.evo !== null && v.evo !== undefined) {
      c.fillStyle = "rgba(0,0,0,0.45)";
      c.fillRect(x0, yShield + 11 * u, barW, 2 * u);
      c.fillStyle = "#e8e8e8";
      c.fillRect(x0, yShield + 11 * u, barW * v.evo, 2 * u);
    }
    if (v?.helmet) this.text(v.helmet === "red" ? "MYTHIC HELMET" : "GOLD HELMET", x0 + barW + 10 * u, yShield + 9 * u, 700, 11 * u, v.helmet === "red" ? RED : "#ffd23c");
    const hp = v ? Math.max(0, v.health / v.healthMax) : 1;
    c.fillStyle = "rgba(0,0,0,0.5)";
    c.fillRect(x0, yHealth, barW, 12 * u);
    c.fillStyle = hp < 0.3 ? RED : WHITE;
    c.fillRect(x0, yHealth, barW * hp, 12 * u);
    this.text(v ? `${Math.ceil(v.health)}` : "100", x0 + barW + 10 * u, yHealth + 11 * u, 700, 15 * u, WHITE);
  }

  // ------------------------------------------------------------ bottom-right

  private drawWeapons(s: HudState, u: number): void {
    const c = this.ctx;
    const right = this.w - 30 * u;
    const bottom = this.h - 30 * u;
    // big magazine count and reserve (none with nothing in hand)
    if (s.unarmed) {
      this.text("—", right - 70 * u, bottom - 10 * u, 700, 58 * u, DIM, "right");
    }
    const clipColor = s.clip === 0 ? RED : s.swapping || s.holstered ? DIM : WHITE;
    if (!s.unarmed) {
      this.text(`${s.clip}`, right - 70 * u, bottom - 10 * u, 700, 58 * u, clipColor, "right");
      this.text(`/ ${s.clipSize}`, right, bottom - 18 * u, 700, 22 * u, DIM, "right");
    }
    // the reserve: endless in the range, rounds in the inventory, an energy gun's stockpile as a percentage
    const res = s.reserve ?? Infinity;
    if (s.unarmed) {
      /* nothing to reload */
    } else if (s.energy && Number.isFinite(res)) {
      const pct = Math.round((100 * s.energy.rounds) / Math.max(1, s.energy.max));
      this.text(`${pct}%`, right, bottom - 44 * u, 700, 20 * u, pct === 0 ? RED : "#8fd8ff", "right");
    } else this.text(Number.isFinite(res) ? String(res) : "∞", right, bottom - 44 * u, 700, 20 * u, res === 0 ? RED : DIM, "right");
    // the L-STAR's heat, the Devotion's spin: a bar over the count
    const bar = (v: number, col: string, label: string) => {
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(right - 180 * u, bottom - 72 * u, 180 * u, 6 * u);
      c.fillStyle = col;
      c.fillRect(right - 180 * u, bottom - 72 * u, 180 * u * Math.max(0, Math.min(1, v)), 6 * u);
      this.text(label, right - 186 * u, bottom - 66 * u, 700, 12 * u, col, "right");
    };
    if (s.heat) bar(s.heat.heat, s.heat.locked ? RED : s.heat.heat > 0.75 ? "#ff9a4a" : "#ffd27a", s.heat.locked ? "OVERHEATED" : "HEAT");
    else if (s.spin !== null && s.spin !== undefined) bar(s.spin, "#8fd8ff", "SPIN");
    // two slots, active one lit
    const slotW = 170 * u;
    const slotH = 30 * u;
    const top = bottom - 110 * u;
    const names = s.slot === 1 ? [s.weaponName, s.otherName] : [s.otherName, s.weaponName];
    for (let i = 0; i < 2 && i < s.slotCount; i++) {
      const active = i + 1 === s.slot;
      const x = right - (2 - i) * (slotW + 8 * u) + 8 * u;
      c.fillStyle = active ? "rgba(255,255,255,0.16)" : PANEL;
      c.fillRect(x, top, slotW, slotH);
      if (active) {
        c.fillStyle = "#ffd23c";
        c.fillRect(x, top + slotH - 3 * u, slotW, 3 * u);
      }
      this.text(`${i + 1}`, x + 8 * u, top + 21 * u, 700, 15 * u, active ? "#ffd23c" : DIM);
      const label = names[i].toUpperCase();
      this.ctx.font = this.font(700, 15 * u);
      const fit = Math.min(1, (slotW - 32 * u) / Math.max(1, this.ctx.measureText(label).width));
      this.text(label, x + 24 * u, top + 21 * u, 700, 15 * u * fit, active ? WHITE : DIM);
    }
    if (!s.unarmed) this.text(`${s.fireMode.toUpperCase()}  ·  MAG ${s.magLevel}`, right, top - 10 * u, 600, 13 * u, DIM, "right");
    // a locked hop-up: a thin bar over the slots, filling with the damage done with the gun
    if (s.hopLock && !s.unarmed) {
      const w = 170 * u;
      const y = top - 4 * u;
      c.fillStyle = "rgba(0,0,0,0.5)";
      c.fillRect(right - w, y, w, 3 * u);
      c.fillStyle = "#e8b84a";
      c.fillRect(right - w, y, w * Math.min(1, s.hopLock.have / Math.max(1, s.hopLock.need)), 3 * u);
      this.text(`${s.hopLock.name.toUpperCase()} LOCKED  ·  ${Math.floor(s.hopLock.have)}/${s.hopLock.need}`, right - w - 8 * u, y + 4 * u, 700, 11 * u, "#e8b84a", "right");
    }
    if (s.attachLines.length && !s.unarmed) {
      s.attachLines.forEach((line, i) => {
        const empty = line.endsWith("none") || line.endsWith("iron sights");
        this.text(line, right, top - 30 * u - i * 16 * u, 600, 12 * u, empty ? "#5d666f" : "#b9c2cc", "right");
      });
    }
    if (s.reloading) {
      c.fillStyle = "rgba(255,255,255,0.25)";
      c.fillRect(right - 250 * u, bottom + 4 * u, 250 * u, 4 * u);
      c.fillStyle = "#ffd27a";
      c.fillRect(right - 250 * u, bottom + 4 * u, 250 * u * Math.max(0, Math.min(1, s.reloadProgress)), 4 * u);
    }
  }

  // ------------------------------------------------------------ course

  private drawCourse(s: HudState, u: number): void {
    const k = s.course;
    if (!k) return;
    const cx = this.w / 2;
    if (k.banner && !k.running && !k.result) {
      this.text(k.banner, cx, 92 * u, 700, 20 * u, "#ffd23c", "center");
    }
    if (k.running) {
      this.text(k.time.toFixed(2), cx, 110 * u, 700, 52 * u, WHITE, "center");
      this.text(`ENEMIES ${k.enemiesTotal - k.enemiesLeft} / ${k.enemiesTotal}`, cx, 134 * u, 700, 16 * u, k.enemiesLeft ? DIM : "#7ddc8a", "center");
      if (k.best !== null) this.text(`BEST ${k.best.toFixed(2)}`, cx, 154 * u, 600, 14 * u, DIM, "center");
      if (k.split) {
        const d = k.split.delta;
        const col = d === null ? WHITE : d <= 0 ? "#7ddc8a" : RED;
        const txt = `${k.split.name}  ${k.split.time.toFixed(2)}` + (d === null ? "" : `   ${d <= 0 ? "-" : "+"}${Math.abs(d).toFixed(2)}`);
        this.text(txt, cx, 180 * u, 700, 20 * u, col, "center");
      }
    }
    if (k.result) {
      const r = k.result;
      const w = 420 * u;
      const rowH = 19 * u;
      const h = 190 * u + r.splits.length * rowH + 12 * u;
      const x0 = cx - w / 2;
      const y0 = this.h * 0.22;
      const c = this.ctx;
      c.fillStyle = "rgba(8,10,12,0.8)";
      c.fillRect(x0, y0, w, h);
      c.fillStyle = "#ffd23c";
      c.fillRect(x0, y0, w, 4 * u);
      this.text(`${k.title} COMPLETE`, cx, y0 + 34 * u, 700, 20 * u, DIM, "center");
      this.text(r.time.toFixed(2), cx, y0 + 96 * u, 700, 64 * u, WHITE, "center");
      this.text(r.rank, x0 + w - 24 * u, y0 + 96 * u, 700, 58 * u, "#ffd23c", "right");
      const detail = `${r.raw.toFixed(2)} run` + (r.missed ? `  +${r.missed * 3}s for ${r.missed} missed` : "  all enemies down");
      this.text(detail, cx, y0 + 128 * u, 600, 15 * u, r.missed ? RED : "#7ddc8a", "center");
      this.text(r.newBest ? "NEW PERSONAL BEST" : k.best !== null ? `BEST ${k.best.toFixed(2)}` : "", cx, y0 + 156 * u, 700, 16 * u, r.newBest ? "#ffd23c" : DIM, "center");
      this.text("P copies your result to share", cx, y0 + 178 * u, 600, 13 * u, DIM, "center");
      // splits: the clock at each room entry, and against your best run
      r.splits.forEach((sp, i) => {
        const y = y0 + 206 * u + i * rowH;
        this.text(sp.name, x0 + 28 * u, y, 600, 14 * u, DIM);
        this.text(Number.isFinite(sp.time) ? sp.time.toFixed(2) : "-", x0 + w * 0.62, y, 700, 15 * u, WHITE, "right");
        // the room's medal against its par
        if (sp.medal !== undefined) {
          c.fillStyle = sp.medal === "gold" ? "#ffd23c" : sp.medal === "silver" ? "#cfd8e0" : sp.medal === "bronze" ? "#d0803a" : "#3a434c";
          c.beginPath();
          c.arc(x0 + w * 0.66, y - 5 * u, 5 * u, 0, Math.PI * 2);
          c.fill();
        }
        if (sp.delta !== null) {
          this.text(`${sp.delta <= 0 ? "-" : "+"}${Math.abs(sp.delta).toFixed(2)}`, x0 + w - 28 * u, y, 700, 15 * u, sp.delta <= 0 ? "#7ddc8a" : RED, "right");
        }
      });
    }
  }
}
