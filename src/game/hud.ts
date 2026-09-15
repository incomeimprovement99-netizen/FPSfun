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
import * as THREE from "three";
import { RANGE_SOLIDS, COURSE_GATE, COURSE_GATE_R } from "./range";
import { ZIPLINES } from "./traversal";
import { drawReticle, type ReticleStyle } from "./optics";

export interface DamageNumber {
  world: THREE.Vector3;
  text: string;
  color: string;
  born: number;
  big: boolean;
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
    splits: Array<{ name: string; time: number; delta: number | null }>;
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
  magLevel: number;
  slot: number;
  slotCount: number;
  otherName: string;
  swapping: boolean;
  fireMode: string;
  attachLines: string[];
  clip: number;
  clipSize: number;
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
  /** a 1v1 in progress */
  duel?: {
    you: number;
    them: number;
    round: number;
    phase: "waiting" | "countdown" | "fight" | "roundEnd" | "matchEnd";
    left: number;
    ping: number | null;
    youWonRound: boolean | null;
    youWonMatch: boolean | null;
    zone: { live: boolean; startsIn: number; you: number; them: number; need: number };
    /** everyone, you first: a scoreboard for three */
    players: Array<{ name: string; score: number; alive: boolean; you: boolean }>;
    waiting: string | null;
    /** at the end of a match: the numbers for the card */
    summary: { won: boolean; roundsWon: number; roundsLost: number; kills: number; deaths: number; damage: number; shots: number; hits: number; streak: number } | null;
  } | null;
  /** hosting a match and waiting in the arena: the code, and how many are still to come */
  lobby?: { code: string; waitingFor: number } | null;
  /** nameplates over the other players and the bots */
  plates?: Array<{ world: THREE.Vector3; name: string; health: number; shield: number; shieldMax: number; alive: boolean }>;
  /** real shield and health (a 1v1); the bars are decorative without it */
  vitals?: { shield: number; shieldMax: number; health: number; healthMax: number } | null;
}

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
  /** pre-drawn top-down map of the whole world, PX_PER_M pixels per metre */
  private map: HTMLCanvasElement | null = null;
  private mapMinX = 0;
  private mapMinZ = 0;
  private mapSolids = -1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", () => this.resize());
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
    this.numbers.push({ world, text: String(amount), color, born: now, big });
    if (this.numbers.length > 40) this.numbers.shift();
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

  draw(now: number, camera: THREE.Camera, s: HudState): void {
    if (!this.enabled) return;
    const c = this.ctx;
    c.clearRect(0, 0, this.w, this.h);
    const u = this.h / 1080; // layout unit: 1 px at 1080p
    this.drawScope(s, u);
    this.drawHurt(now);
    this.drawDamageNumbers(now, camera, u);
    this.drawCrosshair(now, s, u);
    this.drawMinimap(s, u);
    this.drawStats(s, u);
    this.drawCompass(s, u);
    this.drawFps(s, u);
    this.drawVitals(s, u);
    this.drawWeapons(s, u);
    this.drawCourse(s, u);
    this.drawNotice(now, u);
    this.drawPrompt(s, u);
    this.drawTechFeed(now, u);
    this.drawPlates(now, camera, s, u);
    this.drawDuel(s, u);
    this.drawLobby(s, u);
    this.drawFeed(now, u);
    this.drawSummary(s, u);
  }

  /** names and bars over the other players and the bots, fading with distance */
  private drawPlates(_now: number, camera: THREE.Camera, s: HudState, u: number): void {
    if (!s.plates?.length) return;
    const c = this.ctx;
    const v = new THREE.Vector3();
    for (const pl of s.plates) {
      const dist = pl.world.distanceTo((camera as THREE.PerspectiveCamera).position);
      if (dist > 60) continue;
      v.copy(pl.world).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h;
      if (x < -50 || x > this.w + 50 || y < -50 || y > this.h + 50) continue;
      const a = dist < 40 ? 1 : 1 - (dist - 40) / 20;
      c.globalAlpha = a * (pl.alive ? 1 : 0.5);
      const w = 110 * u;
      const col = pl.alive ? WHITE : DIM;
      this.text(pl.alive ? pl.name : `${pl.name}  DOWN`, x, y - 12 * u, 700, 14 * u, col, "center");
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
    if (!d || d.phase !== "matchEnd" || !d.summary) return;
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
    row(0, "ROUNDS", `${sm.roundsWon} - ${sm.roundsLost}`);
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
    if (!d) return;
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
    if (hip > 0) {
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
  private buildMap(): void {
    const PX = 6;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const s of RANGE_SOLIDS) {
      minX = Math.min(minX, s.minX);
      maxX = Math.max(maxX, s.maxX);
      minZ = Math.min(minZ, s.minZ);
      maxZ = Math.max(maxZ, s.maxZ);
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
    g.fillStyle = "#1c2227";
    g.fillRect(0, 0, cv.width, cv.height);
    // Overhead pieces (the course roof, the vent slab) would cover what is
    // under them, so the map shows only what stands on the floor.
    const sorted = RANGE_SOLIDS.filter((s) => s.base < 2.5).sort((a, b) => a.top - b.top);
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
      g.beginPath();
      g.moveTo((z.a.x - minX) * PX, (z.a.z - minZ) * PX);
      g.lineTo((z.b.x - minX) * PX + 0.01, (z.b.z - minZ) * PX + 0.01);
      g.stroke();
      g.fillStyle = "#ffc21a";
      g.fillRect((z.a.x - minX) * PX - 3, (z.a.z - minZ) * PX - 3, 6, 6);
    }
    g.fillStyle = "#e2742b";
    for (const gate of [COURSE_GATE, COURSE_GATE_R]) g.fillRect((gate.minX - minX) * PX, (8 - minZ) * PX, (gate.maxX - gate.minX) * PX, 1 * PX);
    this.map = cv;
    this.mapMinX = minX;
    this.mapMinZ = minZ;
    this.mapSolids = RANGE_SOLIDS.length;
  }

  private drawMinimap(s: HudState, u: number): void {
    if (this.mapSolids !== RANGE_SOLIDS.length) this.buildMap();
    const c = this.ctx;
    const size = 230 * u;
    const x0 = 26 * u;
    const y0 = 26 * u;
    const metres = 70; // across the minimap
    c.save();
    c.fillStyle = PANEL;
    c.fillRect(x0, y0, size, size);
    c.beginPath();
    c.rect(x0, y0, size, size);
    c.clip();
    if (this.map) {
      const scale = size / metres / 6;
      c.translate(x0 + size / 2, y0 + size / 2);
      // Rotate so the direction you face is up. Yaw is positive to the left
      // and 0 faces -z, which is "up" on an unrotated map.
      c.rotate((s.yaw * Math.PI) / 180);
      c.scale(scale, scale);
      c.globalAlpha = 0.9;
      c.drawImage(this.map, -(s.px - this.mapMinX) * 6, -(s.pz - this.mapMinZ) * 6);
      c.globalAlpha = 1;
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
      c.fillStyle = v ? "#3b8bff" : SHIELD;
      c.fillRect(x0 + i * (segW + gap), yShield, segW * fill, 10 * u);
    }
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
    // big magazine count and reserve
    const clipColor = s.clip === 0 ? RED : s.swapping || s.holstered ? DIM : WHITE;
    this.text(`${s.clip}`, right - 70 * u, bottom - 10 * u, 700, 58 * u, clipColor, "right");
    this.text(`/ ${s.clipSize}`, right, bottom - 18 * u, 700, 22 * u, DIM, "right");
    this.text("∞", right, bottom - 44 * u, 700, 20 * u, DIM, "right");
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
    this.text(`${s.fireMode.toUpperCase()}  ·  MAG ${s.magLevel}`, right, top - 10 * u, 600, 13 * u, DIM, "right");
    if (s.attachLines.length) {
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
        if (sp.delta !== null) {
          this.text(`${sp.delta <= 0 ? "-" : "+"}${Math.abs(sp.delta).toFixed(2)}`, x0 + w - 28 * u, y, 700, 15 * u, sp.delta <= 0 ? "#7ddc8a" : RED, "right");
        }
      });
    }
  }
}
