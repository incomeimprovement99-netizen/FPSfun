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
import { RANGE_SOLIDS, COURSE_GATES } from "./range";
import { ZIPLINES } from "./traversal";
import { drawReticle, type ReticleStyle } from "./optics";
import type { DuelHud } from "./duel";
import type { Recap } from "./recap";
import type { BannerCard } from "./banners";
import type { DrillHud } from "./rangetools";
import type { TrainerHud } from "./trainer";
import type { ModeHud } from "./modematch";
import type { TourHud } from "./tour";
import hudCfg from "../config/hud.json";
import { damageText, poolText } from "./damagetext";
import { IS_SK } from "./game";
import type { LootCardView } from "./lootcard";
/** SpeedKills' bottom HUD (hud.json layouts; Phase 20 A6); the legacy game draws its own, in code */
type SkLayout = typeof hudCfg.layouts.speedkills;
const SK_LAYOUT: SkLayout | null = IS_SK ? hudCfg.layouts.speedkills : null;
/** damage numbers: the window a spray at one target adds to one number, and the pop as it grows (hud.json) */
const NUMBERS = hudCfg.damageNumbers;
const LOW_AMMO = hudCfg.lowAmmo;
const KILL_MARK = hudCfg.killMarker;

/** the warning under the crosshair for a magazine: RELOAD when empty, LOW AMMO from the warn share down, or nothing */
export function ammoWarning(clip: number, clipSize: number, reloading: boolean): "RELOAD" | "LOW AMMO" | null {
  if (clipSize < LOW_AMMO.minClip || reloading) return null;
  if (clip <= 0) return "RELOAD";
  return clip <= Math.ceil(clipSize * LOW_AMMO.warn) ? "LOW AMMO" : null;
}
import lootCfg from "../config/loot.json";
import { REACH } from "./brplay";
import { drawIcon, loadIcons } from "./icons";
import { drawReticle as drawCrosshair2d, type Reticle } from "./reticle";
import { P, access } from "./palette";
import { RING_TICK } from "./ring";
import type { MateLife, SquadRow } from "./squadview";
import squadCfg from "../config/squad.json";
import { slow } from "./slow";

type ModeRow = ModeHud["rows"][number];

export interface DamageNumber {
  world: THREE.Vector3;
  text: string;
  color: string;
  born: number;
  big: boolean;
  /** what the text says, summed over a shot's pellets, or over a spray at one target */
  amount: number;
  /** the target it is for (a spray at it adds to this number), when the last hit added to it, and when it last grew */
  key?: object;
  last: number;
  pop: number;
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
  /** the wall run's lean, -1 to 1: its streaks down the wall's side of the screen (drawWallRun) */
  wallRun?: number;
  weaponName: string;
  /** SpeedKills: the gun's class beside its name (speedkills.json kind; Phase 20 A7) */
  weaponKind?: string | null;
  /** the gun's locked hop-up and its progress (a battle royale, Seasons 29 and 30) */
  hopLock?: { name: string; have: number; need: number } | null;
  magLevel: number;
  /** SpeedKills: each slot's fusion level (slot 1 first) and the most there is; null in the legacy game */
  fusion?: { levels: number[]; max: number } | null;
  slot: number;
  slotCount: number;
  otherName: string;
  otherKind?: string | null;
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
    /** everyone in the match, as each sent it at the end: you among them */
    table?: Array<{ name: string; kills: number; damage: number; place: number; you: boolean }>;
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
  /**
   * The camera is behind the shoulder. Aiming takes the crosshair away in
   * first person because the gun's own sights replace it, and in third person
   * there are no sights on the screen to replace it with, so it stays.
   */
  thirdPerson?: boolean;
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
  /** the keys on screen, under the FPS (keyhints.json): each row's description and keys, and the key that hides them */
  keyHints?: { rows: ReadonlyArray<{ label: string; keys: readonly string[] }>; hide: string } | null;
  /**
   * a magnified scope's full-screen picture, faded in with aim; a signature gun's (gunfeel.json scope) powers on: `on`
   * is how far through its boot it is, 0..1, and `charge` how far it has recharged since its last shot
   */
  scope: { style: ReticleStyle; color: string; amount: number; on?: number; charge?: number | null; hs?: boolean; zoom?: string } | null;
  /**
   * SpeedKills: being healed by a HEAL area, 0 to 1 (eased in and out by main.ts), and how much of the view's edges
   * glow green at full (hacks.json healArea screen)
   */
  healing?: { k: number; edge: number };
  /** a match in progress (duel.ts DuelHud: the 1v1, the bots, the battle royale) */
  duel?: DuelHud | null;
  /** hosting a match and waiting in the arena: the code, and how many are still to come */
  lobby?: { code: string; waitingFor: number } | null;
  /** the part of the world the minimap draws (the range, or the BR map) */
  mapRegion?: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** the full map is open (M), or shown by the drop */
  mapOpen?: boolean;
  /** in the skydive: 0 gliding to 1 diving (player.ts diveFactor), how high you are, and the jumpmaster you follow */
  dive?: { k: number; height: number; following?: string | null; breakKey?: string } | null;
  /** aboard the dropship (dropship.ts): its line and where it is on it, the doors, the end, and who jumps for whom */
  ship?: {
    line: [number, number, number, number];
    at: [number, number];
    doorsIn: number;
    endIn: number;
    /** you are the jumpmaster: your jump is the squad's */
    master: boolean;
    /** the jumpmaster you are linked to */
    linkedTo: string | null;
    keys: { jump: string; crouch: string; map: string };
  } | null;
  /** a heal in progress: the item, 0..1, and what is left in the kit */
  heal?: { item: string; progress: number } | null;
  /** what is left of each heal */
  kit?: Record<string, number> | null;
  /** the heal wheel, held open: the items, their counts, the one the mouse points at */
  healWheel?: { items: Array<{ id: string; name: string; count: number }>; pick: string | null } | null;
  /** the emote wheel (7, held): the emotes round it and the one the mouse points at */
  emoteWheel?: { items: string[]; pick: number | null } | null;
  /** sound captions (src/game/captions.ts): what was heard, which way and how far */
  captions?: Array<{ text: string; where: string; range: string }> | null;
  /** the ping wheel (the ping key, held): what a mark would mean, and the one the mouse points at */
  pingWheel?: { items: string[]; pick: number | null } | null;
  /**
   * What you are carrying, held open on Tab: the two guns with their builds,
   * the pack, the ammo by kind and the armour. A battle royale
   * hands you a dozen decisions a minute and the HUD could only answer them
   * one line at a time.
   */
  inventory?: {
    guns: Array<{ name: string; clip: number; size: number; ammo: string; attach: string[]; inHand: boolean }>;
    heals: Array<{ name: string; n: number }>;
    ammo: Array<{ name: string; n: number }>;
    armor: string;
    helmet: string;
  } | null;
  /** nameplates over the other players and the bots */
  plates?: Array<{ world: THREE.Vector3; name: string; health: number; shield: number; shieldMax: number; alive: boolean; ally?: boolean; aimbot?: boolean }>;
  /**
   * Your squad (Phase 27, squadview.ts): your own number and colour, a row a
   * teammate for the panel over your health, and where each teammate here is
   * for the name over them. Null outside a squad, and in the legacy game.
   */
  squad?: { me: { slot: number; color: string } | null; rows: SquadRow[]; tags: MateTag[] } | null;
  /** real shield and health (a 1v1); the bars are decorative without it */
  vitals?: { shield: number; shieldMax: number; health: number; healthMax: number; evo?: number | null; helmet?: string | null } | null;
  /** your ability (abilities.ts): name, key, its cooldown and what is left of it (0: ready); a passive one has no key */
  ability?: {
    name: string;
    key: string;
    cooldown: number;
    left: number;
    passive: boolean;
    charges?: number;
    max?: number;
    nextIn?: number;
    /** the square's icon: a dash's chevrons, a heal's cross, a scan's eye, or a grapple's hook */
    icon?: "dash" | "cross" | "eye" | "hook" | "cloud" | "wall";
    /** the kit's ultimate: its name and key, the meter (0..1), and the seconds it still runs once used */
    ult?: { name: string; key: string; k: number; live: number };
  } | null;
  /**
   * SpeedKills' two hacks (src/game/hacks.ts), mobility then utility: the
   * name, the key, how much of the cooldown is still to go (0 ready), the
   * seconds left, and its fusion level against the most there is.
   */
  hacks?: Array<{ name: string; key: string; frac: number; left: number; level: number; maxLevel: number; slot: "mobility" | "utility" }> | null;
  /**
   * SpeedKills' sectors on the maps (decay.ts): each one's rectangle (world
   * space), name, colour, and where the decay has it; and the capture zone,
   * once it is open: where, how wide, who holds it (yours, theirs, contested)
   * and how far their meter is.
   */
  sectors?: Array<{ minX: number; minZ: number; maxX: number; maxZ: number; name: string; accent: number; phase: "live" | "warning" | "decaying" | "gone"; k: number; final: boolean }> | null;
  capture?: { x: number; z: number; r: number; held: number; hold: number; state: "empty" | "yours" | "theirs" | "contested" } | null;
  /** the line over the battle royale's clock, when the game has its own words for it (SpeedKills' decay) */
  zoneLabel?: string | null;
  /** SpeedKills: the floor item you look at against what you carry (Phase 20 A8; lootcard.ts) */
  lootCard?: LootCardView | null;
  /** SpeedKills past the city's edge (Phase 20 A4): the seconds left */
  edge?: { left: number | null } | null;
  /** the city and the wall round it, for the maps */
  edgeZone?: { inner: { minX: number; maxX: number; minZ: number; maxZ: number }; outer: { minX: number; maxX: number; minZ: number; maxZ: number } } | null;
  /** the ability card: the two options with their keys; compact is the one-line form */
  /**
   * Where you are standing, in the words a squad uses (src/game/callouts.ts).
   * The battle royale has named places; the arenas had nothing, so "he is
   * over there" was all anybody could say. Under the compass, because that is
   * where you look to say where you are.
   */
  callout?: string | null;
  abilityCard?: { options: Array<{ key: string; name: string; blurb: string; tactical: string; ult: string; passive: string; picked: boolean }>; age: number; compact: boolean } | null;
  /** the killcam is playing: whose eyes, their gun, how far through, the skip key */
  killcam?: { name: string; weapon: string; progress: number; left: number; skipKey: string } | null;
  /** the death recap, after the killcam: how long it has been up, the close key */
  recap?: (Recap & { age: number; closeKey: string; killerCard?: BannerCard | null }) | null;
  /** your banner card, for the champion screen */
  myCard?: BannerCard | null;
  /** the flick drill: its countdown, the clock, how many are down */
  drill?: DrillHud | null;
  /** the superglide trainer's bar */
  trainer?: TrainerHud | null;
  /** a superglide's window is open: the mantle boost cue on the crosshair */
  mantleCue?: boolean;
  /** the heal key's label, for the kit line */
  healKey?: string;
  /** the guided tour's step, or its finish card */
  tour?: TourHud | null;
  /** a hold-E action in progress (a revive, a restore): its label and 0..1 */
  brHold?: { label: string; progress: number } | null;
  /** pings in the world: an enemy (red), an item (its colour), a place (yellow) */
  markers?: Array<{ k: "enemy" | "loot" | "go"; at: THREE.Vector3; label: string; mine: boolean }> | null;
  /** you are down: the bleed-out clock, and who is reviving you */
  downed?: {
    left: number;
    revivedBy: string | null;
    kd?: { hp: number; max: number; up: boolean; key: string } | null;
    /** a gold knockdown shield's self-revive: the key to hold, and how far the channel has run (null while it is not) */
    self?: { key: string; progress: number | null } | null;
  } | null;
  /** out, watching a squad mate (or a bot): whose eyes, and first person or not */
  spectating?: { name: string; first: boolean; of?: number; at?: number } | null;
  /** voice chat: you are talking, and who else is */
  voice?: { me: boolean; talking: string[] } | null;
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

/** a teammate's name over them (Phase 27): where, in what colour, and what goes under it */
export interface MateTag {
  id: number;
  world: THREE.Vector3;
  slot: number;
  color: string;
  name: string;
  life: MateLife;
  health: number;
  shield: number;
  shieldMax: number;
  dist: number;
}

/** a squad row's words in place of its bars, when something has happened to them */
function squadState(life: MateLife): { text: string; color: string } | null {
  switch (life) {
    case "gulag":
      return { text: "IN THE GULAG", color: "#ffb13d" };
    case "ghost":
      return { text: "GHOST: RESTORE AT THEIR ECHO", color: "#9fefff" };
    case "out":
      return { text: "OUT", color: DIM };
    case "quiet":
      return { text: "CONNECTION LOST", color: "#ffb13d" };
    case "left":
      return { text: "LEFT THE MATCH", color: DIM };
    case "redeploy":
      return { text: "REDEPLOYING", color: "#7ddc8a" };
    default:
      return null;
  }
}
/** a CSS colour's luminance, 0 to 1, from #rgb, #rrggbb or rgb()/rgba(); a colour it cannot read counts as light */
const lumSeen = new Map<string, number>();
function lumOf(color: string): number {
  let l = lumSeen.get(color);
  if (l !== undefined) return l;
  const s = color.trim();
  let rgb: number[] | null = null;
  const fn = /^rgba?\(([^)]*)\)$/.exec(s);
  if (fn) rgb = fn[1].split(",").slice(0, 3).map(Number);
  else if (/^#[0-9a-f]{6}$/i.test(s)) rgb = [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
  else if (/^#[0-9a-f]{3}$/i.test(s)) rgb = [1, 2, 3].map((i) => parseInt(s[i] + s[i], 16));
  l = rgb && rgb.every(Number.isFinite) ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255 : 1;
  lumSeen.set(color, l);
  return l;
}
/** a CSS colour's own alpha: an rgba()'s fourth part, else 1 (the outline fades with the text it is under) */
function alphaOf(color: string): number {
  const m = /^rgba\(([^)]*)\)$/.exec(color.trim());
  const a = m ? Number(m[1].split(",")[3]) : 1;
  return Number.isFinite(a) ? a : 1;
}

export class Hud {
  private ctx: CanvasRenderingContext2D;
  private numbers: DamageNumber[] = [];
  /** SpeedKills' bottom layout, or null for the legacy HUD (Phase 20 A6) */
  private readonly layout: SkLayout | null = SK_LAYOUT;
  /** the HUD unit of the frame being drawn (the outline's limits scale with it) */
  private uNow = 1;
  /** where the squad panel's top is this frame (the captions and the talking list go above it); the screen's foot without one */
  private leftTop = Infinity;
  /** the signature scope's recharge as last drawn, and when it last came ready (seconds, the page's clock) */
  private hsCharge = 1;
  private hsReadyAt = -Infinity;
  /** what the signature scope drew of its recharge on its last frame (tools/e2e.ts): the ring's share and READY */
  hsChargeDrawn: { ring: number; ready: boolean } = { ring: 1, ready: false };
  private hitMarkerUntil = 0;
  private hitMarkerHead = false;
  private hitMarkerKind: "hit" | "knock" | "kill" = "hit";
  /** the last notice put up, for the checks (tools/e2e.ts reads it) */
  get noticeNow(): string {
    return this.noticeText;
  }
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

  addDamage(world: THREE.Vector3, amount: number, color: string, big: boolean, now: number, key?: object): void {
    const grow = (n: DamageNumber): void => {
      n.amount += amount;
      n.text = damageText(n.amount);
      n.world = world;
      n.last = now;
      n.pop = now;
      n.color = color;
      if (big) n.big = true;
    };
    // A spray at one target reads as one number that grows, as Apex's do by
    // default: every hit on the same target within the stack window adds to
    // it. Without a target, one trigger pull's pellets still read as one: five
    // 19s on top of each other looked like a single pellet.
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      if (key ? n.key === key && now - n.last < NUMBERS.stack : now - n.born <= 0.05 && n.world.distanceTo(world) < 1.5) {
        grow(n);
        return;
      }
      if (!key && now - n.born > 0.05) break;
    }
    this.numbers.push({ world, text: damageText(amount), color, born: now, big, amount, key, last: now, pop: now });
    if (this.numbers.length > 40) this.numbers.shift();
  }

  /** the low-ammo line under the crosshair last frame drawn */
  lastAmmoWarning: "RELOAD" | "LOW AMMO" | null = null;

  /** the low-ammo line for the last state handed in, drawn or not (tools/e2e.ts) */
  get ammoWarningNow(): "RELOAD" | "LOW AMMO" | null {
    const s = this.last;
    return !s || s.unarmed || s.holstered ? null : ammoWarning(s.clip, s.clipSize, s.reloading);
  }

  /** the damage numbers up now, newest last (tools/e2e.ts) */
  get damageNumbers(): ReadonlyArray<{ amount: number; text: string; big: boolean }> {
    return this.numbers.map((n) => ({ amount: n.amount, text: n.text, big: n.big }));
  }

  /**
   * The hit marker. A knock and a kill get their own, bigger, red and held
   * longer: one white flicker for every hit left a kill unconfirmed, and in a
   * spray you could not tell the round that finished them.
   */
  hitMarker(now: number, head: boolean, kind: "hit" | "knock" | "kill" = "hit"): void {
    this.hitMarkerUntil = now + (kind === "hit" ? 0.12 : KILL_MARK.hold);
    this.hitMarkerHead = head;
    this.hitMarkerKind = kind;
  }

  /** the last hit marker's kind (tools/e2e.ts) */
  get hitMarkerKindNow(): "hit" | "knock" | "kill" {
    return this.hitMarkerKind;
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

  /**
   * On a wall: a glow and streaks sliding down the wall's side of the screen, as strong as the view's lean (hud.json
   * wallRun), so a wall run reads as one (the owner, 2026-09-28: "some sort of visual feedback that we are indeed
   * wallrunning, like empulse does")
   */
  private drawWallRun(now: number, lean: number): void {
    const W = (hudCfg as unknown as { wallRun: { width: number; alpha: number; streaks: number; speed: number; color: string } }).wallRun;
    const a = Math.min(1, Math.abs(lean));
    if (a < 0.02) return;
    const c = this.ctx;
    const right = lean > 0;
    const w = this.w * W.width;
    const x0 = right ? this.w : 0;
    const x1 = right ? this.w - w : w;
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, `${W.color}${Math.round(W.alpha * a * 255).toString(16).padStart(2, "0")}`);
    g.addColorStop(1, `${W.color}00`);
    c.fillStyle = g;
    c.fillRect(Math.min(x0, x1), 0, w, this.h);
    c.strokeStyle = `${W.color}${Math.round(W.alpha * 1.6 * a * 255).toString(16).padStart(2, "0")}`;
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < W.streaks; i++) {
      const across = ((i * 0.618) % 1) * w * 0.8;
      const x = right ? this.w - across - 4 : across + 4;
      const y = ((now * W.speed + i / W.streaks) % 1) * this.h * 1.3 - this.h * 0.15;
      c.moveTo(x, y);
      c.lineTo(x, y + this.h * 0.12);
    }
    c.stroke();
  }

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
      this.hintsBottom = 0;
      this.drawFeed(now, u);
      return;
    }
    if (s.wallRun) this.drawWallRun(now, s.wallRun);
    this.uNow = u;
    this.leftTop = Infinity;
    this.drawScope(s, u);
    this.drawHealing(now, s, u);
    this.drawHurt(now);
    this.drawDamageNumbers(now, camera, u);
    this.drawCrosshair(now, s, u);
    // LOW AMMO / RELOAD under the crosshair, where the eyes are in a fight
    this.lastAmmoWarning = s.unarmed || s.holstered ? null : ammoWarning(s.clip, s.clipSize, s.reloading);
    if (this.lastAmmoWarning) this.text(this.lastAmmoWarning, this.w / 2, this.h / 2 + 64 * u, 700, 15 * u, this.lastAmmoWarning === "RELOAD" ? RED : "#ffb13d", "center");
    this.drawDamageDirs(s, u);
    this.drawMatchCard(s, u);
    this.drawQuickChat(s, u);
    this.drawMinimap(s, u);
    this.drawStats(s, u);
    this.drawCompass(s, u);
    this.drawCallout(s, u);
    this.drawFps(s, u);
    this.drawKeyHints(s, u);
    this.drawVitals(s, u);
    this.drawWeapons(s, u);
    this.drawCourse(s, u);
    this.drawNotice(now, u);
    this.drawPrompt(s, u);
    this.drawReachList(u);
    this.drawLootCard(s, u);
    this.drawTechFeed(now, u);
    this.drawPlates(now, camera, s, u);
    this.drawMateTags(camera, s, u);
    this.drawMarkers(now, camera, s, u);
    this.drawDuel(s, u);
    this.drawMode(now, camera, s, u);
    this.drawBr(now, s, u);
    this.drawDive(s, u);
    this.drawShip(s, u);
    this.drawKit(s, u);
    this.drawAbility(now, s, u);
    this.drawHacks(s, u);
    this.drawAbilityCard(s, u);
    this.drawLobby(s, u);
    this.drawFeed(now, u);
    this.drawSummary(s, u);
    this.drawFullMap(now, s, u);
    this.drawRecap(s, u);
    this.drawDrill(s, u);
    this.drawTrainer(s, u);
    this.drawSquad(now, s, u);
    // over the rest of the HUD: past the edge nothing else matters
    this.drawEdge(now, s, u);
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
   * The card in the gap between rounds: who did what in the one just played.
   * A shipped shooter uses this moment to tell you why you lost, and we were
   * showing a banner and nothing else (docs/NEXT_STEPS.md item 6). Your side
   * is listed first with your own row lit; the columns are what the mode
   * counts, kills and deaths.
   */
  private roundCard(d: NonNullable<HudState["duel"]>, u: number, cx: number): void {
    const rows = d.players.filter((p) => p.kills !== undefined).slice(0, 8);
    if (!rows.length) return;
    const c = this.ctx;
    const w = 420 * u;
    const rowH = 26 * u;
    const top = this.h * 0.46;
    const h = rowH * (rows.length + 1) + 16 * u;
    c.fillStyle = "rgba(10, 13, 16, 0.82)";
    c.fillRect(cx - w / 2, top, w, h);
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.lineWidth = 1;
    c.strokeRect(cx - w / 2, top, w, h);
    const x0 = cx - w / 2 + 16 * u;
    let y = top + 22 * u;
    this.text("THE ROUND", x0, y, 700, 13 * u, DIM);
    this.text("KILLS", cx + w / 2 - 92 * u, y, 700, 11 * u, DIM, "right");
    this.text("DEATHS", cx + w / 2 - 16 * u, y, 700, 11 * u, DIM, "right");
    y += 10 * u;
    for (const p of rows) {
      y += rowH;
      const col = p.you ? "#ffd23c" : p.ally ? "#7ddc8a" : WHITE;
      this.text(p.name, x0, y, p.you ? 700 : 600, 15 * u, col);
      this.text(`${p.kills ?? 0}`, cx + w / 2 - 92 * u, y, 700, 15 * u, col, "right");
      this.text(`${p.deaths ?? 0}`, cx + w / 2 - 16 * u, y, 600, 15 * u, DIM, "right");
    }
  }

  /**
   * The squad's overlays: down (the bleed-out clock, a red edge, who is
   * reviving you), a revive or restore hold's bar, and
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
    if (s.voice && (s.voice.me || s.voice.talking.length)) {
      // who is talking: you first, then the others, down the left above the vitals
      const rows = [...(s.voice.me ? ["YOU"] : []), ...s.voice.talking];
      const y0 = Math.min(this.h - 190 * u, this.leftTop - 34 * u);
      rows.forEach((name, i) => this.text(`● ${name}`, 24 * u, y0 - i * 17 * u, 700, 13 * u, "#7ddc8a", "left"));
    }
    if (s.spectating) {
      c.fillStyle = PANEL;
      c.fillRect(cx - 190 * u, this.h - 132 * u, 380 * u, 44 * u);
      this.text(`WATCHING ${s.spectating.name}`, cx, this.h - 106 * u, 700, 18 * u, WHITE, "center");
      const more = (s.spectating.of ?? 1) > 1 ? `  ·  FIRE: NEXT, AIM: BACK  (${s.spectating.at ?? 1} OF ${s.spectating.of})` : "";
      this.text((s.spectating.first ? "THEIR EYES  ·  THIRD PERSON KEY: BEHIND THEM" : "BEHIND THEM  ·  THIRD PERSON KEY: THEIR EYES") + more, cx, this.h - 92 * u, 600, 11 * u, DIM, "center");
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
    // a good glide puts the two marks one frame (a few pixels) apart: JUMP's label sits a row above CROUCH's so neither hides the other
    const mark = (before: number | null, label: string, col: string, lift: number) => {
      if (before === null) return;
      const x = xAt(before);
      c.fillStyle = col;
      c.fillRect(x - 1.5 * u, y - (6 + lift) * u, 3 * u, (24 + lift) * u);
      this.text(label, x, y - (9 + lift) * u, 700, 11 * u, col, "center");
    };
    mark(t.jump, "JUMP", "#ffd23c", 13);
    mark(t.crouch, "CROUCH", "#8fd8ff", 0);
    if (t.left !== null) {
      c.fillStyle = WHITE;
      c.fillRect(xAt(t.left) - 1 * u, y - 3 * u, 2 * u, 18 * u);
    }
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

  /** a banner card: its frame colour, its icon, the name and its title */
  private drawCard(card: BannerCard, name: string, x: number, y: number, w: number, h: number, u: number): void {
    const c = this.ctx;
    c.fillStyle = "rgba(8,10,12,0.92)";
    c.fillRect(x, y, w, h);
    c.strokeStyle = card.frame;
    c.lineWidth = 3 * u;
    c.strokeRect(x + 1.5 * u, y + 1.5 * u, w - 3 * u, h - 3 * u);
    c.fillStyle = card.frame;
    c.fillRect(x, y, h, h);
    drawIcon(c, card.icon, x + h / 2, y + h / 2, h * 0.62, "#0b0d10");
    this.text(name, x + h + 12 * u, y + h * 0.45, 700, h * 0.3, WHITE);
    this.text(card.title, x + h + 12 * u, y + h * 0.8, 700, h * 0.2, card.frame);
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
    this.text(r.byEdge ? "TERMINATED: OUT OF BOUNDS" : r.byRing ? "ELIMINATED BY THE RING" : `ELIMINATED BY ${r.killerName}`, x0 + 22 * u, y0 + 62 * u, 700, 28 * u, r.byEdge ? "#ff3b4a" : r.byRing ? "#ff9a4a" : WHITE);
    // their card, over the recap's top right edge
    if (!r.byRing && !r.byEdge && r.killerCard) this.drawCard(r.killerCard, r.killerName, x0 + w - 232 * u, y0 - 66 * u, 220 * u, 58 * u, u);
    this.text(`YOU DEALT ${damageText(r.totalDealt)}  ·  TOOK ${damageText(r.totalTaken)}`, x0 + w - 22 * u, y0 + 62 * u, 700, 15 * u, DIM, "right");
    if (!rows.length) this.text(r.byEdge ? "You stayed past the city's edge: OUT OF BOUNDS." : "Nobody hit you this life: it was the ring.", x0 + 22 * u, y0 + 110 * u, 600, 15 * u, DIM);
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
        this.text(`${damageText(v.damage)}  ·  ${v.hits} HIT${v.hits === 1 ? "" : "S"}${v.heads ? `, ${v.heads} HEAD` : ""}`, bx + 100 * u + bw, yy, 700, 14 * u, WHITE);
      };
      line(y + 50 * u, "YOU → THEM", row.dealt, "#7ddc8a");
      line(y + 72 * u, "THEM → YOU", row.taken, RED);
      const gun = row.guns[0];
      const dist = (g: typeof gun) => (g.near === null ? "" : g.far !== null && Math.round(g.far) !== Math.round(g.near) ? `  ${Math.round(g.near)}-${Math.round(g.far)} M` : `  ${Math.round(g.near)} M`);
      const guns = row.guns.length ? row.guns.slice(0, 2).map((g) => `${g.name}${dist(g)}`).join("   ·   ") : "NO HITS ON YOU";
      this.text(guns, bx, y + 96 * u, 600, 13 * u, "#c8d0d8");
      const right: string[] = [];
      if (row.healed) right.push(`HEALED ${row.healed.ago.toFixed(1)} S BEFORE (${row.healed.item})`);
      if (row.left) right.push(`LEFT: ${poolText(row.left.shield)} SHIELD · ${poolText(row.left.health)} HEALTH`);
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

  /** the bottom of the keys panel this frame, for the kill feed to start under (0: not shown) */
  private hintsBottom = 0;

  /**
   * The keys on screen (keyhints.json): up on the right under the FPS, a row a
   * thing to do, its keys in the prompt's own caps, and how to put it away. Not
   * a layout box: the SpeedKills layout check holds every box to the bottom band.
   */
  /**
   * The keys panel, drawn into a canvas of its own and copied onto the HUD each frame: about fifty outlined texts
   * (each a stroke and a fill) a frame for a panel that changes when a key is rebound or the window is resized, 0.15 ms
   * of a frame (tools/profile-frame.ts, 2026-10-03). Drawn again when what it shows or its size changes.
   */
  private hintsCache: { key: string; canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number } | null = null;

  private drawKeyHints(s: HudState, u: number): void {
    this.hintsBottom = 0;
    const k = s.keyHints;
    if (!k || !k.rows.length) return;
    const right = this.w - 30 * u;
    const width = 330 * u;
    const left = right - width;
    const rowH = 27 * u;
    const top = 116 * u;
    const head = 26 * u;
    const foot = 32 * u;
    const h = head + k.rows.length * rowH + foot;
    this.hintsBottom = top + h;
    // (?slow=keys: drawn every frame, as before)
    if (slow("keys")) return this.paintKeyHints(k, u, left, right, width, top, h);
    const dpr = this.canvas.width / this.w;
    // (the fonts' state too: drawn before the HUD's font is in, it would keep the stand-in font for good)
    const key = `${this.w}|${dpr}|${u}|${this.layout ? 1 : 0}|${document.fonts?.status}|${k.hide}|${k.rows.map((r) => `${r.label}=${r.keys.join(",")}`).join(";")}`;
    if (this.hintsCache?.key !== key) {
      // its corner on a whole device pixel, so the copy is as sharp as the drawing
      const x = Math.floor((left - 12 * u) * dpr) / dpr;
      const y = Math.floor(top * dpr) / dpr;
      const w = Math.ceil((right + 12 * u - x) * dpr) / dpr;
      const hh = Math.ceil((top + h - y) * dpr) / dpr;
      const canvas = this.hintsCache?.canvas ?? document.createElement("canvas");
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(hh * dpr);
      const own = canvas.getContext("2d")!;
      own.setTransform(dpr, 0, 0, dpr, -x * dpr, -y * dpr);
      const hud = this.ctx;
      this.ctx = own;
      try {
        this.paintKeyHints(k, u, left, right, width, top, h);
      } finally {
        this.ctx = hud;
      }
      this.hintsCache = { key, canvas, x, y, w, h: hh };
    }
    const hc = this.hintsCache;
    this.ctx.drawImage(hc.canvas, hc.x, hc.y, hc.w, hc.h);
  }

  private paintKeyHints(k: NonNullable<HudState["keyHints"]>, u: number, left: number, right: number, width: number, top: number, h: number): void {
    const c = this.ctx;
    const rowH = 27 * u;
    const cap = 22 * u;
    const head = 26 * u;
    const foot = 32 * u;
    c.fillStyle = PANEL;
    c.fillRect(left - 12 * u, top, width + 24 * u, h);
    this.text("KEYS", left, top + 18 * u, 700, 13 * u, DIM);
    const caps = (keys: readonly string[], x0: number, yMid: number): void => {
      // right to left, so the last key sits on the panel's right edge
      let x = x0;
      for (let i = keys.length - 1; i >= 0; i--) {
        c.font = this.font(600, 15 * u);
        const w = Math.max(cap, c.measureText(keys[i]).width + 12 * u);
        x -= w;
        c.fillStyle = "#f2f2f2";
        c.fillRect(x, yMid - cap / 2, w, cap);
        this.text(keys[i], x + w / 2, yMid + 5 * u, 600, 15 * u, "#101214", "center");
        x -= 5 * u;
      }
    };
    let y = top + head;
    for (const r of k.rows) {
      const mid = y + rowH / 2;
      // a weight down from the rest of the HUD: a column of bold labels read as a heavy block (the owner, 2026-10-02)
      this.text(r.label, left, mid + 5 * u, 500, 15 * u, WHITE);
      caps(r.keys, right, mid);
      y += rowH;
    }
    // how to put it away, in the hacks' gold so it is the line a new player finds
    const mid = y + foot / 2;
    this.text("Press", left, mid + 5 * u, 600, 14 * u, "#ffd23c");
    c.font = this.font(600, 14 * u);
    const pw = c.measureText("Press ").width;
    c.font = this.font(600, 13 * u);
    const hw = Math.max(cap, c.measureText(k.hide).width + 12 * u);
    c.fillStyle = "#ffd23c";
    c.fillRect(left + pw, mid - cap / 2, hw, cap);
    this.text(k.hide, left + pw + hw / 2, mid + 5 * u, 600, 13 * u, "#101214", "center");
    this.text("to hide this", left + pw + hw + 6 * u, mid + 5 * u, 600, 14 * u, "#ffd23c");
  }

  /** the kill feed under the FPS counter, six seconds a line (and under the keys, when they are up) */
  private drawFeed(now: number, u: number): void {
    const x = this.w - 30 * u;
    let y = this.hintsBottom ? this.hintsBottom + 22 * u : 120 * u;
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
    row(2, "DAMAGE", damageText(sm.damage));
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
      this.roundCard(d, u, cx);
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
    } else if (m.search) {
      // Search: the rounds, your job this round and the clock; once planted, the bomb's clock in red
      const sr = m.search;
      const BLUE = "#3fa7ff";
      const ORANGE = "#ffa23c";
      this.text("YOUR TEAM", cx - 175 * u, 84 * u, 700, 13 * u, BLUE);
      this.text(`${sr.you}`, cx - 40 * u, 110 * u, 700, 36 * u, WHITE, "right");
      this.text("-", cx, 106 * u, 700, 28 * u, DIM, "center");
      this.text(`${sr.them}`, cx + 40 * u, 110 * u, 700, 36 * u, WHITE);
      this.text("THEM", cx + 175 * u, 84 * u, 700, 13 * u, RED, "right");
      const job = sr.attacking ? "ATTACK" : "DEFEND";
      const line =
        sr.phase === "planted" ? `BOMB ON ${sr.site ?? ""}  ·  ${Math.ceil(sr.left)} S` : d.phase === "fight" ? `${job}  ·  ${clock(sr.left)}  ·  FIRST TO ${sr.limit}` : `ROUND ${d.round}  ·  ${job} NEXT  ·  FIRST TO ${sr.limit}`;
      this.text(line, cx, 138 * u, 700, 15 * u, sr.phase === "planted" ? RED : sr.attacking ? ORANGE : BLUE, "center");
      if (d.phase === "fight") {
        // a plant or a defuse under way: a bar over the crosshair, yours or someone's
        if (sr.work) {
          const bw = 240 * u;
          const y = this.h * 0.58;
          const what = sr.work.kind === "plant" ? "PLANTING" : "DEFUSING";
          const who = sr.work.mine ? "" : sr.work.ally ? "  ·  YOUR TEAM" : "  ·  THEM";
          c.fillStyle = "rgba(0,0,0,0.55)";
          c.fillRect(cx - bw / 2, y, bw, 10 * u);
          c.fillStyle = sr.work.kind === "plant" ? ORANGE : BLUE;
          c.fillRect(cx - bw / 2, y, bw * sr.work.k, 10 * u);
          this.text(`${what}${who}`, cx, y - 8 * u, 700, 14 * u, WHITE, "center");
        } else if (sr.prompt) this.text(sr.prompt, cx, this.h * 0.58, 700, 18 * u, WHITE, "center");
        // the sites' letters in the world (the bomb's in red), held to the screen
        for (const q of sr.sites) {
          if (q.here) continue;
          const v = q.at.clone().setY(q.at.y + 2.5).project(camera);
          if (v.z > 1) continue;
          const x = (v.x * 0.5 + 0.5) * this.w;
          const y = (-v.y * 0.5 + 0.5) * this.h;
          if (x < 0 || x > this.w || y < 0 || y > this.h) continue;
          c.fillStyle = "rgba(0,0,0,0.5)";
          c.fillRect(x - 11 * u, y - 11 * u, 22 * u, 22 * u);
          this.text(q.id, x, y + 6 * u, 700, 16 * u, q.bomb ? RED : ORANGE, "center");
        }
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
    if (sc.hs) {
      this.drawHsScope(sc, u);
      return;
    }
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
    const on = sc.on ?? 1;
    // a signature gun's scope powering on: the reticle drawn down to a scan line sweeping the picture
    if (on < 1) {
      c.save();
      c.beginPath();
      c.rect(cx - R, cy - R, 2 * R, 2 * R * on);
      c.clip();
    }
    drawReticle(c, sc.style, sc.color, cx, cy, sc.style === "sniper" || sc.style === "dsniper" ? R : R * 0.6, Math.max(1.5, 3 * u));
    if (on < 1) {
      c.restore();
      const y = cy - R + 2 * R * on;
      const half = Math.sqrt(Math.max(0, R * R - (y - cy) * (y - cy)));
      c.shadowColor = "#7fe9ff";
      c.shadowBlur = 12 * u;
      c.strokeStyle = "rgba(127,233,255,0.9)";
      c.lineWidth = 2 * u;
      c.beginPath();
      c.moveTo(cx - half, y);
      c.lineTo(cx + half, y);
      c.stroke();
    }
    if (sc.on !== undefined) {
      // the signature scope's own ring inside the rim: four ticks, and the recharge filling it after a shot
      const r2 = R * 0.965;
      c.shadowBlur = 6 * u;
      c.shadowColor = "#7fe9ff";
      c.lineWidth = 2.5 * u;
      c.strokeStyle = "rgba(127,233,255,0.22)";
      c.beginPath();
      c.arc(cx, cy, r2, 0, Math.PI * 2);
      c.stroke();
      const k = sc.charge ?? 1;
      c.strokeStyle = k >= 1 ? "rgba(127,233,255,0.75)" : "rgba(255,190,90,0.85)";
      c.beginPath();
      c.arc(cx, cy, r2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k * on);
      c.stroke();
      c.lineWidth = 3 * u;
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * (r2 - 14 * u), cy + Math.sin(a) * (r2 - 14 * u));
        c.lineTo(cx + Math.cos(a) * (r2 - 4 * u), cy + Math.sin(a) * (r2 - 4 * u));
        c.stroke();
      }
    }
    c.restore();
  }

  /**
   * Being healed by a HEAL area (hacks.json healArea): the view's edges glow green, and the heal's "+" rises up them,
   * the area's own sign, so the heal is felt in first person as well as seen on the ground
   */
  private drawHealing(now: number, s: HudState, u: number): void {
    const h = s.healing;
    if (!h || h.k <= 0.01) return;
    const c = this.ctx;
    const W = this.w;
    const H = this.h;
    c.save();
    const edge = Math.min(W, H) * h.edge;
    const pulse = 0.75 + 0.25 * Math.sin(now * 5);
    for (const [x0, y0, x1, y1] of [
      [0, 0, edge, 0],
      [W, 0, W - edge, 0],
      [0, H, 0, H - edge],
    ] as const) {
      const g = c.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(61,255,154,${(0.22 * h.k * pulse).toFixed(3)})`);
      g.addColorStop(1, "rgba(61,255,154,0)");
      c.fillStyle = g;
      c.fillRect(0, 0, W, H);
    }
    // the "+" signs rising up both edges, each on its own clock
    c.shadowColor = "#3dff9a";
    c.shadowBlur = 10 * u;
    for (let i = 0; i < 10; i++) {
      const side = i % 2 ? 1 : 0;
      const t = (now * 0.55 + i * 0.137) % 1;
      const x = side ? W - (40 + ((i * 53) % 90)) * u : (40 + ((i * 71) % 90)) * u;
      const y = H * (0.92 - t * 0.7);
      const a = h.k * Math.sin(Math.PI * t) * 0.85;
      const r = (9 + (i % 3) * 4) * u;
      c.fillStyle = `rgba(200,255,224,${a.toFixed(3)})`;
      c.fillRect(x - r * 0.3, y - r, r * 0.6, 2 * r);
      c.fillRect(x - r, y - r * 0.3, 2 * r, r * 0.6);
    }
    c.restore();
  }

  /**
   * Hyper Scape's Protocol V scope (research, docs/HYPERSCAPE_GAP_ANALYSIS.md): not a circle, the whole screen, framed by
   * a soft chamfered-rectangle vignette at the edges; thin red lines across it with a gap at the middle and range ticks
   * either side, a post down from above and stadia below; a chevron and the zoom ("x6.00") at the left edge. After a
   * shot a ring round the aim point closes as the gun recharges, and READY flashes when it can fire again (hud.json
   * hsCharge). It powers on top to bottom as the signature scope does.
   */
  private drawHsScope(sc: NonNullable<HudState["scope"]>, u: number): void {
    const c = this.ctx;
    const W = this.w;
    const H = this.h;
    const cx = W / 2;
    const cy = H / 2;
    c.save();
    c.globalAlpha = sc.amount;
    // the chamfered frame: black outside, soft inside
    const inset = Math.min(W, H) * 0.035;
    const cut = Math.min(W, H) * 0.12;
    const frame = (k: number) => {
      const i = inset + k;
      c.moveTo(i + cut, i);
      c.lineTo(W - i - cut, i);
      c.lineTo(W - i, i + cut);
      c.lineTo(W - i, H - i - cut);
      c.lineTo(W - i - cut, H - i);
      c.lineTo(i + cut, H - i);
      c.lineTo(i, H - i - cut);
      c.lineTo(i, i + cut);
      c.closePath();
    };
    c.fillStyle = "#040506";
    c.beginPath();
    c.rect(0, 0, W, H);
    frame(0);
    c.fill("evenodd");
    for (let k = 1; k <= 6; k++) {
      c.strokeStyle = `rgba(4,5,6,${(0.5 * (1 - k / 7)).toFixed(3)})`;
      c.lineWidth = 6 * u;
      c.beginPath();
      frame(k * 5 * u);
      c.stroke();
    }
    const ready = sc.charge === undefined || sc.charge === null || sc.charge >= 1;
    const red = ready ? "rgba(255,42,58,0.95)" : "rgba(255,42,58,0.45)";
    const on = sc.on ?? 1;
    c.save();
    c.beginPath();
    c.rect(0, 0, W, cy - H * 0.5 + H * on * 1.0 + 1);
    c.clip();
    c.strokeStyle = red;
    c.fillStyle = red;
    const lw = Math.max(1.5, 2 * u);
    c.lineWidth = lw;
    const gap = W * 0.018;
    // the line across, with the gap at the middle
    c.beginPath();
    c.moveTo(inset, cy);
    c.lineTo(cx - gap, cy);
    c.moveTo(cx + gap, cy);
    c.lineTo(W - inset, cy);
    c.stroke();
    // range ticks either side of the gap
    for (let i = 1; i <= 6; i++) {
      const dx = gap + i * W * 0.022;
      const th = (i % 3 === 0 ? 14 : 8) * u;
      c.beginPath();
      c.moveTo(cx - dx, cy);
      c.lineTo(cx - dx, cy + th);
      c.moveTo(cx + dx, cy);
      c.lineTo(cx + dx, cy + th);
      c.stroke();
    }
    // the post from above, and the stadia below
    c.beginPath();
    c.moveTo(cx, inset);
    c.lineTo(cx, cy - gap);
    c.moveTo(cx, cy + gap);
    c.lineTo(cx, cy + H * 0.3);
    for (const [k, half] of [[0.1, 0.028], [0.19, 0.02], [0.27, 0.014]] as const) {
      c.moveTo(cx - W * half, cy + H * k);
      c.lineTo(cx + W * half, cy + H * k);
    }
    c.stroke();
    // and fine lines on through the gap, crossing at the middle with a dot on it: the gap alone left nothing to aim
    // with where the shot goes (the owner, 2026-09-27: "they stop in the middle of the scope ... like we are guessing
    // in the middle"). Thin, so the heavy lines still lead the eye in and the target is not covered
    c.lineWidth = Math.max(1, lw * 0.5);
    c.beginPath();
    c.moveTo(cx - gap, cy);
    c.lineTo(cx + gap, cy);
    c.moveTo(cx, cy - gap);
    c.lineTo(cx, cy + gap);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, Math.max(1.5, 2 * u), 0, Math.PI * 2);
    c.fill();
    c.lineWidth = lw;
    // the chevron and the zoom at the left edge
    const lx = inset + 10 * u;
    c.beginPath();
    c.moveTo(lx, cy - 7 * u);
    c.lineTo(lx + 34 * u, cy - 7 * u);
    c.lineTo(lx + 44 * u, cy);
    c.lineTo(lx + 34 * u, cy + 7 * u);
    c.lineTo(lx, cy + 7 * u);
    c.stroke();
    c.font = this.font(700, 22 * u);
    c.textAlign = "left";
    c.fillText(sc.zoom ?? "", lx + 4 * u, cy + 34 * u);
    // the recharge (hud.json hsCharge): a ring round the aim point, closing clockwise from the top as the gun
    // recharges, then READY as it can fire again. It was a 90 by 4 pixel bar at the frame's edge, which the owner never
    // saw ("when the user can shoot again, I thought we agreed on having a bar there")
    {
      const HC = hudCfg.hsCharge;
      const k = Math.max(0, Math.min(1, sc.charge ?? 1));
      const t = performance.now() / 1000;
      if (this.hsCharge < 1 && k >= 1) this.hsReadyAt = t;
      this.hsCharge = k;
      const rr = H * HC.radius;
      const since = t - this.hsReadyAt;
      c.shadowBlur = 0;
      c.lineWidth = HC.width * u;
      c.textAlign = "center";
      c.font = this.font(700, HC.text * u);
      if (k < 1) {
        c.strokeStyle = HC.track;
        c.beginPath();
        c.arc(cx, cy, rr, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = HC.fill;
        c.beginPath();
        c.arc(cx, cy, rr, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
        c.stroke();
        c.fillStyle = HC.fill;
        c.fillText(HC.charging, cx, cy + rr + (HC.width + HC.text + 4) * u);
        this.hsChargeDrawn = { ring: k, ready: false };
      } else if (since < HC.flash) {
        const a = 1 - since / HC.flash;
        c.globalAlpha = sc.amount * a;
        c.strokeStyle = HC.ready;
        c.beginPath();
        c.arc(cx, cy, rr, 0, Math.PI * 2);
        c.stroke();
        c.fillStyle = HC.ready;
        c.fillText(HC.readyText, cx, cy + rr + (HC.width + HC.text + 4) * u);
        c.globalAlpha = sc.amount;
        this.hsChargeDrawn = { ring: 1, ready: true };
      } else this.hsChargeDrawn = { ring: 1, ready: false };
    }
    c.restore();
    // the power-on's scan line
    if (on < 1) {
      const y = H * on;
      c.strokeStyle = "rgba(255,120,120,0.8)";
      c.lineWidth = 2 * u;
      c.beginPath();
      c.moveTo(inset, y);
      c.lineTo(W - inset, y);
      c.stroke();
    }
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
  /**
   * The loot card (Phase 20 A8), right of the crosshair: the item, what E does with it, and its numbers set
   * against yours, better in green and worse in red. Full teaches; Compact is the verdict and what decides a swap.
   */
  private drawLootCard(s: HudState, u: number): void {
    const v = s.lootCard;
    if (!v) return;
    const c = this.ctx;
    const full = v.mode === "full";
    const w = (full ? hudCfg.lootCard.w : hudCfg.lootCard.w * 0.72) * u;
    const pad = 14 * u;
    const rowH = 20 * u;
    // the notes wrapped to the card, a word at a time
    c.font = this.font(600, 11 * u);
    const noteLines: string[] = [];
    for (const n of v.notes) {
      let line = "";
      for (const word of n.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && c.measureText(next).width > w - 2 * pad) {
          noteLines.push(line);
          line = word;
        } else line = next;
      }
      if (line) noteLines.push(line);
    }
    const noteH = 15 * u;
    const lines = (v.sayMore ? 1 : 0) + (v.heads ? 1 : 0) + v.rows.length;
    const h = pad * 2 + 30 * u + 22 * u + lines * rowH + (noteLines.length ? 10 * u + noteLines.length * noteH : 0);
    const x = this.w / 2 + 70 * u;
    const y = this.h * 0.42 - h / 2;
    c.fillStyle = "rgba(8,10,16,0.82)";
    c.fillRect(x, y, w, h);
    const accent = v.verdict === "fuse" ? "#3cf2ff" : v.verdict === "max" ? DIM : v.verdict === "swap" ? "#ffd23c" : "#7ddc8a";
    c.fillStyle = accent;
    c.fillRect(x, y, 3 * u, h);
    this.edge(x, y, w, h, u);
    let yy = y + pad + 18 * u;
    this.text(v.title, x + pad, yy, 700, 22 * u, WHITE);
    this.text(v.sub, x + w - pad, yy, 700, 12 * u, DIM, "right");
    yy += 24 * u;
    this.text(v.say, x + pad, yy, 700, 15 * u, accent);
    if (v.sayMore) {
      yy += rowH;
      this.text(v.sayMore, x + pad, yy, 600, 12 * u, DIM);
    }
    const colA = x + w * 0.52;
    const colB = x + w - pad;
    if (v.heads) {
      yy += rowH + 2 * u;
      this.text(v.heads[0], colA, yy, 700, 11 * u, DIM, "right");
      this.text(v.heads[1], colB, yy, 700, 11 * u, DIM, "right");
    }
    for (const r of v.rows) {
      yy += rowH;
      this.text(r.label, x + pad, yy, 700, 12 * u, DIM);
      this.text(r.have, colA, yy, 700, 14 * u, WHITE, "right");
      const col = r.cmp > 0 ? "#7ddc8a" : r.cmp < 0 ? "#ff6b5e" : WHITE;
      this.text(`${r.get}${r.cmp > 0 ? " +" : r.cmp < 0 ? " -" : ""}`, colB, yy, 700, 14 * u, col, "right");
    }
    if (noteLines.length) {
      yy += 10 * u;
      for (const n of noteLines) {
        yy += noteH;
        this.text(n, x + pad, yy, 600, 11 * u, DIM);
      }
    }
    this.box("lootCard", x, y, w, h);
  }

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
    // SpeedKills: a thin outline under every text, so none of it is lost against a lit wall or a bright floor
    // (the owner, Phase 20 A6), in the colour opposite the text's; faded text keeps a faded outline
    const L = this.layout;
    if (L) {
      const o = L.outline;
      const lw = c.lineWidth;
      const lj = c.lineJoin;
      c.lineJoin = "round";
      c.miterLimit = 2;
      c.lineWidth = Math.min(o.max * this.uNow, Math.max(o.min * this.uNow, size * o.text));
      c.strokeStyle = `rgba(${lumOf(color) < o.darkBelow ? o.lightRgb : o.rgb},${o.alpha * alphaOf(color)})`;
      c.strokeText(t, x, y);
      c.lineWidth = lw;
      c.lineJoin = lj;
    }
    c.fillStyle = color;
    c.fillText(t, x, y);
  }

  /** SpeedKills: the dark outline round a bar or a box, wholly outside it (Phase 20 A6) */
  private edge(x: number, y: number, w: number, h: number, u: number): void {
    const L = this.layout;
    if (!L) return;
    const c = this.ctx;
    const t = L.outline.bar * u;
    c.lineWidth = t;
    c.lineJoin = "miter";
    c.strokeStyle = `rgba(${L.outline.rgb},${L.outline.alpha})`;
    c.strokeRect(x - t / 2, y - t / 2, w + t, h + t);
  }

  /** a bar: its track, its fill to `frac`, and in SpeedKills its outline */
  private bar(x: number, y: number, w: number, h: number, frac: number, track: string, fill: string, u: number): void {
    const c = this.ctx;
    c.fillStyle = track;
    c.fillRect(x, y, w, h);
    c.fillStyle = fill;
    c.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    this.edge(x, y, w, h, u);
  }

  /**
   * SpeedKills' bottom unit: the HUD's own unit, shrunk on a screen too narrow for its two sides to fit apart
   * (4:3 at the largest HUD scale)
   */
  private bottomUnit(u: number): number {
    const L = this.layout!;
    const left = L.margin.x + L.health.w + L.hacks.dx + 2 * L.hacks.size + L.hacks.gap;
    const right = L.margin.x + L.ammo.right + L.ammo.digitsBox + L.slots.dx + L.slots.w;
    return u * Math.min(1, this.w / ((left + right + L.margin.minGap) * u));
  }

  /** where each piece of SpeedKills' bottom HUD was drawn this frame (tools/e2e.ts holds the owner's layout to them) */
  readonly boxes: Record<string, { x: number; y: number; w: number; h: number }> = {};

  private box(k: string, x: number, y: number, w: number, h: number): void {
    this.boxes[k] = { x, y, w, h };
  }

  // ------------------------------------------------------------ centre

  private drawDamageNumbers(now: number, camera: THREE.Camera, u: number): void {
    const c = this.ctx;
    const v = new THREE.Vector3();
    for (let i = this.numbers.length - 1; i >= 0; i--) {
      const n = this.numbers[i];
      // it rises and fades from its last hit, so a number still growing stays up
      const age = now - n.last;
      if (age > 0.9) {
        this.numbers.splice(i, 1);
        continue;
      }
      v.copy(n.world).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h - age * 60 * u - 14 * u;
      c.globalAlpha = age < 0.6 ? 1 : 1 - (age - 0.6) / 0.3;
      // a pop as it grows: 1.25 times, back to its size over the pop time
      const pop = 1 + 0.25 * Math.max(0, 1 - (now - n.pop) / NUMBERS.pop);
      c.font = this.font(700, (n.big ? 30 : 24) * pop * u);
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
    // A battle royale's own end card (the placement, big, at 30% down) is up
    // while its match ends: this one goes under it rather than over it.
    const brEnd = s.duel?.br?.placement !== null && s.duel?.br?.placement !== undefined;
    const y = brEnd ? this.h * 0.3 + 76 * u : this.h * 0.2;
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
    // everyone's line, under the card: a match with friends ends on one table, not on your numbers alone
    const t = m.table ?? [];
    if (t.length > 1) {
      const ty = y + h + 10 * u;
      const th = (30 + t.length * 22) * u;
      c.fillStyle = "rgba(10,13,16,0.86)";
      c.fillRect(x, ty, w, th);
      this.text("PLAYER", x + 24 * u, ty + 20 * u, 700, 12 * u, DIM);
      this.text("KILLS", x + w * 0.62, ty + 20 * u, 700, 12 * u, DIM, "right");
      this.text("DAMAGE", x + w * 0.82, ty + 20 * u, 700, 12 * u, DIM, "right");
      this.text("PLACE", x + w - 24 * u, ty + 20 * u, 700, 12 * u, DIM, "right");
      t.forEach((r, i) => {
        const yy = ty + (42 + i * 22) * u;
        const col = r.you ? "#ffd23c" : WHITE;
        this.text(r.name, x + 24 * u, yy, 700, 14 * u, col);
        this.text(String(r.kills), x + w * 0.62, yy, 700, 14 * u, col, "right");
        this.text(damageText(r.damage), x + w * 0.82, yy, 700, 14 * u, col, "right");
        this.text(r.place > 0 ? `#${r.place}` : "-", x + w - 24 * u, yy, 700, 14 * u, col, "right");
      });
    }
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
    // markers still show while aiming. Over the shoulder is the exception:
    // the sights are off to one side of the screen there and the shot goes
    // where the crosshair is, so aiming keeps it.
    const hip = s.holstered ? 0.35 : s.thirdPerson ? 1 : Math.max(0, 1 - s.adsFrac / 0.3);
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
      const big = this.hitMarkerKind !== "hit";
      c.strokeStyle = big ? (this.hitMarkerKind === "kill" ? "rgba(255,60,50,0.98)" : "rgba(255,140,60,0.98)") : this.hitMarkerHead ? "rgba(255,210,60,0.95)" : "rgba(255,255,255,0.9)";
      if (big) c.lineWidth = 3;
      const r0 = gap + 4;
      const r1 = r0 + (8 * u + 2) * (big ? KILL_MARK.scale : 1);
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
    // (and nothing under the street: the metro's walls, stairs and trains, and the street's slab over it)
    const sorted = solids.filter((s) => s.base < 2.5 && s.top > 0.05).sort((a, b) => a.top - b.top);
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
      for (const gate of COURSE_GATES) g.fillRect((gate.minX - minX) * PX, (8 - minZ) * PX, (gate.maxX - gate.minX) * PX, 1 * PX);
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

  /** the rings on a map: the live one orange, the next one white, and the one after dashed cyan when a Ring Console has shown it */
  /** Past SpeedKills' edge (Phase 20 A4): a red vignette and the countdown in the middle of the screen */
  private drawEdge(now: number, s: HudState, u: number): void {
    const e = s.edge;
    if (!e) return;
    const c = this.ctx;
    const cx = this.w / 2;
    if (e.left === null) return;
    const g = c.createRadialGradient(cx, this.h / 2, this.h * 0.3, cx, this.h / 2, this.h * 0.9);
    g.addColorStop(0, "rgba(255,30,50,0)");
    g.addColorStop(1, `rgba(255,30,50,${0.4 + 0.15 * Math.sin(now * 8)})`);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    const pw = 460 * u;
    const ph = 128 * u;
    const y0 = this.h * 0.3 - ph / 2;
    c.fillStyle = PANEL;
    c.fillRect(cx - pw / 2, y0, pw, ph);
    this.text("RETURN TO THE CITY", cx, y0 + 34 * u, 700, 28 * u, "#ff3b4a", "center");
    this.text(`${Math.ceil(e.left)}`, cx, y0 + 96 * u, 700, 60 * u, e.left < 2 ? "#ff3b4a" : WHITE, "center");
    this.text("OR BE TERMINATED", cx, y0 + 120 * u, 600, 13 * u, DIM, "center");
  }

  private drawRings(s: HudState, toX: (x: number) => number, toZ: (z: number) => number, scale: number, u: number): void {
    const br = s.duel?.br;
    if (!br) return;
    const c = this.ctx;
    // SpeedKills: the sectors instead of rings, each in its colour, the decay
    // over them, and the capture zone once it opens
    if (s.sectors?.length) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 180);
      for (const sec of s.sectors) {
        const x0 = toX(sec.minX);
        const z0 = toZ(sec.minZ);
        const w = toX(sec.maxX) - x0;
        const h = toZ(sec.maxZ) - z0;
        const rgb = `${(sec.accent >> 16) & 255}, ${(sec.accent >> 8) & 255}, ${sec.accent & 255}`;
        c.fillStyle =
          sec.phase === "gone"
            ? "rgba(120, 10, 40, 0.62)"
            : sec.phase === "decaying"
              ? `rgba(255, 46, 154, ${0.25 + 0.35 * sec.k})`
              : sec.phase === "warning"
                ? `rgba(255, 46, 154, ${0.12 + 0.18 * pulse})`
                : `rgba(${rgb}, 0.08)`;
        c.fillRect(x0, z0, w, h);
        c.strokeStyle = sec.final ? "rgba(255, 255, 255, 0.95)" : `rgba(${rgb}, 0.7)`;
        c.lineWidth = (sec.final ? 2.5 : 1.2) * u;
        c.strokeRect(x0, z0, w, h);
        // the names where there is room for them (the big map)
        if (w > 60 * u) this.text(sec.phase === "gone" ? `${sec.name} · GONE` : sec.name, x0 + w / 2, z0 + h / 2, 700, Math.max(9, 11 * u), sec.phase === "gone" ? "rgba(255,120,160,0.8)" : `rgba(${rgb}, 0.9)`, "center");
      }
      // the band past the city's edge, red, and the edge itself lined (Phase 20 A4)
      const ez = s.edgeZone;
      if (ez) {
        c.fillStyle = "rgba(255, 46, 74, 0.22)";
        c.beginPath();
        c.rect(toX(ez.outer.minX), toZ(ez.outer.minZ), toX(ez.outer.maxX) - toX(ez.outer.minX), toZ(ez.outer.maxZ) - toZ(ez.outer.minZ));
        c.rect(toX(ez.inner.minX), toZ(ez.inner.minZ), toX(ez.inner.maxX) - toX(ez.inner.minX), toZ(ez.inner.maxZ) - toZ(ez.inner.minZ));
        c.fill("evenodd");
        c.strokeStyle = "rgba(255, 46, 74, 0.9)";
        c.lineWidth = 2 * u;
        c.strokeRect(toX(ez.inner.minX), toZ(ez.inner.minZ), toX(ez.inner.maxX) - toX(ez.inner.minX), toZ(ez.inner.maxZ) - toZ(ez.inner.minZ));
      }
      const cz = s.capture;
      if (cz) {
        const col = cz.state === "yours" ? "#2effc0" : cz.state === "theirs" ? "#ff3b3b" : cz.state === "contested" ? "#ffd23c" : "#ffffff";
        c.strokeStyle = col;
        c.lineWidth = 2.5 * u;
        c.beginPath();
        c.arc(toX(cz.x), toZ(cz.z), Math.max(3 * u, cz.r * scale), 0, Math.PI * 2);
        c.stroke();
        if (cz.held > 0) {
          c.lineWidth = 5 * u;
          c.beginPath();
          c.arc(toX(cz.x), toZ(cz.z), Math.max(3 * u, cz.r * scale) + 4 * u, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * cz.held) / cz.hold);
          c.stroke();
        }
      }
      return;
    }
    if (br.ring.ahead) {
      const a = br.ring.ahead;
      c.save();
      c.lineWidth = 2 * u;
      c.setLineDash([8 * u, 6 * u]);
      c.strokeStyle = "rgba(57,208,255,0.95)";
      c.beginPath();
      c.arc(toX(a.cx), toZ(a.cz), Math.max(0.5, a.r * scale), 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
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
    // the hot zone: the place this match kitted out. Gold, dashed, and named,
    // because a hot zone nobody can see is a secret rather than a decision.
    if (br.hot) {
      c.save();
      c.setLineDash([6 * u, 5 * u]);
      c.strokeStyle = "rgba(255,210,60,0.9)";
      c.lineWidth = 2 * u;
      c.beginPath();
      c.arc(toX(br.hot.x), toZ(br.hot.z), Math.max(1, br.hot.radius * scale), 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  /**
   * The battle royale's map icons: jump towers (a balloon), care
   * packages (a blue box, falling or down), pings, and the
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
    // a Ring Console: a cyan screen, dim once it has been scanned this round
    for (const k of br.consoles ?? []) {
      upright(k.x, k.z, () => {
        c.fillStyle = k.ready ? "#39d0ff" : "rgba(57,208,255,0.3)";
        c.fillRect(-5 * u, -4 * u, 10 * u, 8 * u);
        c.strokeRect(-5 * u, -4 * u, 10 * u, 8 * u);
        c.fillStyle = "rgba(0,0,0,0.8)";
        c.fillRect(-3 * u, -2 * u, 6 * u, 1.5 * u);
      });
    }
    // a care package blue and a loadout crate gold: faint while it is only
    // called or falling, bright while it is down and worth fighting over, and
    // dim again once its window has passed and it has most likely been had
    for (const p of br.pods) {
      upright(p.x, p.z, () => {
        const rgb = p.loadout ? "255,193,46" : "59,139,255";
        c.fillStyle = `rgba(${rgb},${!p.landed ? 0.5 : p.hot ? 1 : 0.3})`;
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
    // your squad: each in their colour with their number (Phase 27), a ghost where the ghost is, pale
    const rows = s.squad?.rows;
    for (const m of br.mates) {
      const row = rows?.find((r) => r.id === m.id);
      const ghost = row?.life === "ghost";
      if (!m.alive && !ghost) continue;
      if (!row) {
        dot(m.x, m.z, 5, m.downed ? "#ff4b3e" : "#3ddc84");
        c.stroke();
        continue;
      }
      c.globalAlpha = ghost ? 0.55 : 1;
      dot(m.x, m.z, 6, m.downed ? RED : row.color);
      c.stroke();
      upright(m.x, m.z, () => {
        c.fillStyle = "#0b0e12";
        c.font = this.font(800, 9 * u);
        c.textAlign = "center";
        c.fillText(String(row.slot), 0, 3.2 * u);
      });
      c.globalAlpha = 1;
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
      // the sites between the places: named, smaller and dimmer, so the nine
      // big places still read first and a squad can call "the Crossing"; a
      // dark backing, because four of them sit on the pale shading of a mesa
      for (const p of br.sites ?? []) {
        c.font = this.font(600, 10 * u);
        const w = c.measureText(p.name).width + 8 * u;
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(toX(p.x) - w / 2, toZ(p.z) - 16 * u, w, 13 * u);
        this.text(p.name, toX(p.x), toZ(p.z) - 6 * u, 600, 10 * u, "rgba(255,255,255,0.8)", "center");
      }
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
    // the dropship's line: the way it has come faint, the way it is going bright
    if (s.ship) {
      const [ax, az, bx, bz] = s.ship.line;
      const [sx, sz] = s.ship.at;
      c.lineWidth = 3 * u;
      c.setLineDash([10 * u, 7 * u]);
      c.strokeStyle = "rgba(255,255,255,0.3)";
      c.beginPath();
      c.moveTo(toX(ax), toZ(az));
      c.lineTo(toX(sx), toZ(sz));
      c.stroke();
      c.strokeStyle = "rgba(255,255,255,0.9)";
      c.beginPath();
      c.moveTo(toX(sx), toZ(sz));
      c.lineTo(toX(bx), toZ(bz));
      c.stroke();
      c.setLineDash([]);
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
    const foot = y0 + (r.maxZ - r.minZ) * scale + 34 * u;
    if (s.ship) {
      const sh = s.ship;
      this.text(`THE SHIP PASSES ${br?.poi ?? "YOUR PLACE"}`, this.w / 2, y0 - 26 * u, 700, 34 * u, "#ffd23c", "center");
      this.text(this.shipLine(sh), this.w / 2, foot, 600, 15 * u, sh.doorsIn > 0 ? DIM : WHITE, "center");
      this.text(this.shipWho(sh), this.w / 2, foot + 22 * u, 600, 14 * u, DIM, "center");
    } else if (br?.dropping) {
      this.text(`DROPPING INTO ${br.poi}`, this.w / 2, y0 - 26 * u, 700, 34 * u, "#ffd23c", "center");
      this.text("STEER WITH THE MOVEMENT KEYS, LOOK DOWN TO DIVE", this.w / 2, foot, 600, 15 * u, DIM, "center");
    } else this.text("M CLOSES THE MAP", this.w / 2, foot, 600, 15 * u, DIM, "center");
  }

  /**
   * The skydive's readout: which of its two states you are in, where between
   * them, and how high you are, with the hint that says how to change it.
   * Hidden while the full map is over the screen.
   */
  private drawDive(s: HudState, u: number): void {
    const d = s.dive;
    if (!d || s.mapOpen) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const y = this.h * 0.7;
    const diving = d.k > 0.66;
    const gliding = d.k < 0.33;
    // on a panel: the ground under a skydive is bright, and plain text on it is lost
    c.fillStyle = PANEL;
    c.fillRect(cx - 170 * u, y - 30 * u, 340 * u, 106 * u);
    this.text(diving ? "DIVING" : gliding ? "GLIDING" : "FALLING", cx, y, 700, 24 * u, diving ? "#ff9a3c" : gliding ? "#7fd8ff" : WHITE, "center");
    // the bar: the glide at the left end, the dive at the right, a mark where you are
    const w = 220 * u;
    c.fillStyle = "rgba(255,255,255,0.2)";
    c.fillRect(cx - w / 2, y + 12 * u, w, 6 * u);
    c.fillStyle = "#ffd23c";
    c.fillRect(cx - w / 2 + d.k * w - 2 * u, y + 8 * u, 4 * u, 14 * u);
    this.text("GLIDE", cx - w / 2 - 8 * u, y + 20 * u, 600, 12 * u, DIM, "right");
    this.text("DIVE", cx + w / 2 + 8 * u, y + 20 * u, 600, 12 * u, DIM, "left");
    this.text(`${Math.max(0, Math.round(d.height))} M`, cx, y + 44 * u, 700, 16 * u, WHITE, "center");
    // following a jumpmaster, they fly it for you
    if (d.following) this.text(`FOLLOWING ${d.following}  ·  ${d.breakKey ?? "C"} BREAKS OFF`, cx, y + 64 * u, 600, 13 * u, "#7ddc8a", "center");
    else this.text("LOOK DOWN TO DIVE, LEVEL TO GLIDE", cx, y + 64 * u, 600, 13 * u, DIM, "center");
  }

  /** the ship's clock and the key that matters now */
  private shipLine(sh: NonNullable<HudState["ship"]>): string {
    if (sh.doorsIn > 0) return `THE DOORS OPEN IN ${Math.ceil(sh.doorsIn)}`;
    const jump = sh.linkedTo ? `${sh.keys.jump} JUMPS ALONE` : `${sh.keys.jump} TO JUMP`;
    return `${jump}  ·  ${sh.keys.map} FOR THE MAP  ·  OUT AT THE EDGE IN ${Math.ceil(sh.endIn)} S`;
  }

  /** who jumps for whom */
  private shipWho(sh: NonNullable<HudState["ship"]>): string {
    if (sh.master) return "YOU LEAD THE DROP: THE SQUAD JUMPS WITH YOU";
    if (sh.linkedTo) return `LINKED TO ${sh.linkedTo}, WHO JUMPS FOR YOU  ·  ${sh.keys.crouch} BREAKS OFF`;
    return "JUMP OVER ANY PLACE YOU LIKE: A GLIDE CARRIES ABOUT 160 M";
  }

  /**
   * Aboard, with the map closed: what the map's foot would say, on a panel
   * where the dive's readout goes.
   */
  private drawShip(s: HudState, u: number): void {
    const sh = s.ship;
    if (!sh || s.mapOpen) return;
    const c = this.ctx;
    const cx = this.w / 2;
    // under the ship, which the chase camera puts a little below the middle
    const y = this.h * 0.83;
    c.fillStyle = PANEL;
    c.fillRect(cx - 260 * u, y - 30 * u, 520 * u, 92 * u);
    this.text("ON THE DROPSHIP", cx, y, 700, 24 * u, "#ffd23c", "center");
    this.text(this.shipLine(sh), cx, y + 26 * u, 600, 14 * u, sh.doorsIn > 0 ? DIM : WHITE, "center");
    this.text(this.shipWho(sh), cx, y + 48 * u, 600, 13 * u, DIM, "center");
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
    // The Gulag: on the way in, the countdown, the fight's clock, and overtime's flag
    if (br.gulag) {
      const gl = br.gulag;
      const y = this.h * 0.22;
      c.fillStyle = PANEL;
      c.fillRect(cx - 210 * u, y - 36 * u, 420 * u, gl.phase === "overtime" ? 96 * u : 70 * u);
      const mm = Math.floor(gl.clock / 60);
      const ss = Math.floor(gl.clock % 60);
      const title =
        gl.phase === "wait"
          ? `TO THE GULAG IN ${Math.ceil(gl.clock)}`
          : gl.phase === "countdown"
            ? `THE GULAG  ·  FIGHT IN ${Math.ceil(gl.clock)}`
            : gl.phase === "fight"
              ? `THE GULAG  ·  ${mm}:${ss.toString().padStart(2, "0")}`
              : gl.phase === "overtime"
                ? "OVERTIME: TAKE THE FLAG"
                : gl.phase === "won"
                  ? "YOU WON: BACK INTO THE MATCH"
                  : "OUT";
      this.text(title, cx, y, 700, 28 * u, gl.phase === "overtime" ? "#ffd23c" : gl.phase === "lost" ? "#ff5a4a" : "#7ddc8a", "center");
      this.text(gl.phase === "wait" ? "A 1V1 FOR YOUR WAY BACK" : `WIN AND YOU ARE BACK IN  ·  AGAINST ${gl.opponent}`, cx, y + 24 * u, 600, 13 * u, DIM, "center");
      if (gl.phase === "overtime") {
        // two bars: yours and theirs, each filling to the capture
        const w = 150 * u;
        for (const [k, v, col] of [
          [-1, gl.capMe, "#7ddc8a"],
          [1, gl.capThem, "#ff5a4a"],
        ] as const) {
          const x0 = cx + (k < 0 ? -w - 20 * u : 20 * u);
          c.fillStyle = "rgba(255,255,255,0.15)";
          c.fillRect(x0, y + 40 * u, w, 8 * u);
          c.fillStyle = col;
          c.fillRect(x0, y + 40 * u, w * Math.min(1, v / gl.capture), 8 * u);
        }
      }
    }
    // Resurgence: how long the dead still come back, and your own wait while you are out
    if (br.resurgence) {
      const rs = br.resurgence;
      const m = Math.floor(rs.toFinal / 60);
      const sec = Math.floor(rs.toFinal % 60);
      // under the squads count (132) and Storm Surge's line (150), so all three can be up at once
      this.text(rs.live ? `RESURGENCE  ·  DEATHS FINAL IN ${m}:${sec.toString().padStart(2, "0")}` : "RESURGENCE OVER  ·  EVERY DEATH IS FINAL", cx, 170 * u, 700, 13 * u, rs.live ? "#7ddc8a" : "#ff7a1a", "center");
      if (rs.redeployIn !== null) {
        c.fillStyle = PANEL;
        c.fillRect(cx - 200 * u, this.h * 0.36 - 44 * u, 400 * u, 84 * u);
        this.text(`REDEPLOYING IN ${Math.ceil(rs.redeployIn)}`, cx, this.h * 0.36, 700, 34 * u, "#7ddc8a", "center");
        this.text("EVERY KILL BY YOUR SIDE CUTS THE WAIT", cx, this.h * 0.36 + 26 * u, 600, 13 * u, DIM, "center");
      }
    }
    this.text(s.zoneLabel ?? (ringDone ? "RING CLOSED" : br.ring.closing ? "RING CLOSING" : `RING ${br.ring.phase} CLOSES IN`), cx, 80 * u, 700, 13 * u, br.ring.closing ? "#ff2e9a" : DIM, "center");
    this.text(ringDone ? "" : clock, cx, 108 * u, 700, 30 * u, br.ring.closing ? (s.zoneLabel ? "#ff2e9a" : "#ff7a1a") : WHITE, "center");
    // SpeedKills' capture zone: its meter, under the clock
    const cap = s.capture;
    if (cap) {
      const col = cap.state === "yours" ? "#2effc0" : cap.state === "theirs" ? "#ff3b3b" : cap.state === "contested" ? "#ffd23c" : "#e8fbff";
      const say = cap.state === "yours" ? "HOLDING THE ZONE" : cap.state === "theirs" ? "ENEMIES HOLD THE ZONE" : cap.state === "contested" ? "ZONE CONTESTED" : "CAPTURE ZONE OPEN";
      this.text(`${say}  ·  ${Math.ceil(cap.held)} / ${cap.hold} S`, cx, 196 * u, 700, 14 * u, col, "center");
      c.fillStyle = "rgba(255,255,255,0.15)";
      c.fillRect(cx - 110 * u, 204 * u, 220 * u, 5 * u);
      c.fillStyle = col;
      c.fillRect(cx - 110 * u, 204 * u, (220 * u * cap.held) / cap.hold, 5 * u);
    }
    // in duos and trios the count that decides a placement is squads, so it sits under the alive count
    if (br.team > 1 && br.placement === null) this.text(`${br.squads} SQUAD${br.squads === 1 ? "" : "S"}`, cx - 120 * u, 132 * u, 700, 12 * u, DIM, "center");
    // Storm Surge under the panel: the countdown once it is called, then what
    // a tick costs and whether you are the one below the line
    const sg = br.surge;
    if (sg && br.placement === null) {
      const text = !sg.live
        ? `STORM SURGE IN ${Math.ceil(sg.startsIn)}  ·  DEAL DAMAGE OR TAKE IT`
        : sg.safe
          ? `STORM SURGE  ·  ${sg.below} BELOW THE LINE  ·  YOU ARE CLEAR`
          : `STORM SURGE  ·  ${sg.damage} EVERY ${RING_TICK} S  ·  DEAL DAMAGE`;
      this.text(text, cx, 150 * u, 700, 15 * u, !sg.live ? "#ffd23c" : sg.safe ? DIM : "#ff5a4a", "center");
    }
    // outside: an orange vignette and the damage it costs
    if (br.ring.outside && !br.dropping && !br.placement && !s.edge) {
      const g = c.createRadialGradient(cx, this.h / 2, this.h * 0.35, cx, this.h / 2, this.h * 0.9);
      g.addColorStop(0, "rgba(255,110,20,0)");
      g.addColorStop(1, `rgba(255,110,20,${0.35 + 0.1 * Math.sin(now * 5)})`);
      c.fillStyle = g;
      c.fillRect(0, 0, this.w, this.h);
      this.text(`${s.sectors?.length ? "IN THE DECAY" : "OUTSIDE THE RING"}  ·  ${br.ring.damage} EVERY ${RING_TICK} S`, cx, this.h * 0.3, 700, 26 * u, "#ff9a4a", "center");
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
      // out of the squads: in solo that is everyone, in duos and trios it is how Apex counts it
      this.text(won ? "LAST SQUAD STANDING" : `#${br.placement} OF ${br.squadsTotal}${br.team > 1 ? " SQUADS" : ""}`, cx, this.h * 0.3, 700, 62 * u, won ? "#ffd23c" : WHITE, "center");
      const m = Math.floor(br.survived / 60);
      const sec = Math.floor(br.survived % 60);
      this.text(`${br.kills} kill${br.kills === 1 ? "" : "s"}  ·  ${m}:${sec.toString().padStart(2, "0")} survived  ·  menu in ${Math.ceil(s.duel?.left ?? 0)}`, cx, this.h * 0.3 + 44 * u, 700, 22 * u, DIM, "center");
      // the champion's card under it
      if (won && s.myCard) this.drawCard(s.myCard, "YOU", cx - 150 * u, this.h * 0.3 + 70 * u, 300 * u, 74 * u, u);
    }
  }

  /**
   * The ability, bottom left beside the bars: a square with its key, a dark
   * sweep for the cooldown and the seconds left, a bright edge when ready.
   * TRIAGE is passive: a cross and "HEALS x2".
   */
  /**
   * SpeedKills' hacks, bottom left beside the bars, where the ability square
   * is in the legacy game: a square each, the mobility hack in cyan and the
   * utility one in magenta, its name, its key, a dark sweep while it comes
   * back with the seconds on it, and its fusion level as pips along the foot.
   */
  private drawHacks(s: HudState, u: number): void {
    if (this.layout) {
      this.drawHacksSk(s, this.bottomUnit(u), this.layout);
      return;
    }
    const list = s.hacks;
    if (!list?.length) return;
    const c = this.ctx;
    const size = 58 * u;
    const gap = 8 * u;
    list.forEach((h, i) => {
      const x = 384 * u + i * (size + gap);
      const y = this.h - 76 * u - size;
      const col = h.slot === "mobility" ? "32, 224, 255" : "255, 46, 154";
      const ready = h.frac <= 0;
      c.fillStyle = PANEL;
      c.fillRect(x, y, size, size);
      c.strokeStyle = `rgba(${col}, ${ready ? 0.95 : 0.4})`;
      c.lineWidth = 2 * u;
      c.strokeRect(x + u, y + u, size - 2 * u, size - 2 * u);
      // the dark sweep while it comes back, from the top down
      if (!ready) {
        c.fillStyle = "rgba(0, 0, 0, 0.55)";
        c.fillRect(x, y, size, size * h.frac);
      }
      c.textAlign = "center";
      c.fillStyle = ready ? `rgb(${col})` : `rgba(${col}, 0.6)`;
      c.font = `700 ${Math.round(11 * u)}px ${FONT}`;
      c.fillText(h.name.length > 8 ? h.name.slice(0, 7) + "." : h.name, x + size / 2, y + 24 * u);
      c.fillStyle = WHITE;
      c.font = `700 ${Math.round((ready ? 12 : 15) * u)}px ${FONT}`;
      c.fillText(ready ? h.key : h.left.toFixed(h.left < 10 ? 1 : 0), x + size / 2, y + 42 * u);
      // the fusion level, as pips
      for (let p = 0; p < h.maxLevel; p++) {
        c.fillStyle = p < h.level ? `rgb(${col})` : "rgba(255,255,255,0.18)";
        c.fillRect(x + 8 * u + p * ((size - 16 * u) / h.maxLevel), y + size - 8 * u, (size - 16 * u) / h.maxLevel - 2 * u, 3 * u);
      }
      c.textAlign = "left";
    });
  }

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
    if (a.icon === "wall") {
      // a wall: a slab with a lip on the ground
      c.fillRect(-13 * u, -10 * u, 26 * u, 16 * u);
      c.fillRect(-16 * u, 8 * u, 32 * u, 4 * u);
    } else if (a.icon === "cloud") {
      // a cloud: three rounds in a row
      for (const [dx, dy, rr] of [
        [-7, 2, 6],
        [2, -2, 8],
        [10, 3, 5],
      ] as const) {
        c.beginPath();
        c.arc(dx * u, dy * u, rr * u, 0, Math.PI * 2);
        c.fill();
      }
    } else if (a.icon === "hook") {
      // a hook: a line with a curl at its end
      c.beginPath();
      c.moveTo(-12 * u, -12 * u);
      c.lineTo(2 * u, 2 * u);
      c.stroke();
      c.beginPath();
      c.arc(4 * u, 8 * u, 6 * u, -Math.PI / 2, Math.PI * 0.75);
      c.stroke();
    } else if (a.icon === "eye") {
      // a scan: two rings out from a dot
      c.beginPath();
      c.arc(0, 0, 3.5 * u, 0, Math.PI * 2);
      c.fill();
      for (const rr of [8, 13]) {
        c.beginPath();
        c.arc(0, 0, rr * u, -0.9, 0.9);
        c.stroke();
        c.beginPath();
        c.arc(0, 0, rr * u, Math.PI - 0.9, Math.PI + 0.9);
        c.stroke();
      }
    } else if (a.passive || a.icon === "cross") {
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
    if (a.ult) this.drawUlt(now, a.ult, x + size + 16 * u, y, size, u);
  }

  /**
   * The ultimate, beside the ability: a ring that fills as the meter does, its
   * key in the middle and the percentage under it; full, it glows and says
   * READY; while it runs, the seconds left.
   */
  private drawUlt(now: number, ult: { name: string; key: string; k: number; live: number }, x: number, y: number, size: number, u: number): void {
    const c = this.ctx;
    const r = size / 2;
    const cx = x + r;
    const cy = y + r;
    const GOLD = "#ffd23c";
    const full = ult.k >= 1;
    c.fillStyle = PANEL;
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 5 * u;
    c.strokeStyle = "rgba(255,255,255,0.12)";
    c.beginPath();
    c.arc(cx, cy, r - 4 * u, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = full ? `rgba(255,210,60,${0.7 + 0.3 * Math.sin(now * 5)})` : GOLD;
    c.beginPath();
    c.arc(cx, cy, r - 4 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ult.k));
    c.stroke();
    this.text(ult.key, cx, cy + 7 * u, 700, 20 * u, full ? GOLD : WHITE, "center");
    const line = ult.live > 0 ? `${ult.name}  ${Math.ceil(ult.live)} S` : full ? `${ult.name}  READY` : `${ult.name}  ${Math.floor(ult.k * 100)}%`;
    this.text(line, cx, y + size + 16 * u, 700, 12 * u, full || ult.live > 0 ? GOLD : DIM, "center");
  }

  /**
   * The ability card. Full: a panel low in the middle, "CHOOSE YOUR ABILITY",
   * the two options side by side with their keys. Compact: one line over the
   * ability square, for when it has been up a while or you are in the range.
   */
  /**
   * The card you pick a kit from. It used to lay every option out in one row
   * of two: with two kits that was a card, and with six it was six tiles
   * across a 620 px box, running off the card and off the screen, with a
   * sentence in each too long to read. It is a grid now, as many columns as
   * fit and as many rows as it takes, and each tile says what the kit gives
   * you rather than only what it is called: the tactical on its key, the
   * ultimate, and the passive that is always on.
   */
  private drawAbilityCard(s: HudState, u: number): void {
    const k = s.abilityCard;
    if (!k || !k.options.length) return;
    const c = this.ctx;
    if (k.compact) {
      const line = k.options.map((o) => `[${o.key}] ${o.name}`).join("   ");
      this.text(`ABILITY   ${line}`, 384 * u, this.h - 150 * u, 700, 14 * u, "#8fd8ff");
      return;
    }
    const n = k.options.length;
    // the grid: never more than three across, and never wider than the screen
    const cols = Math.min(3, Math.max(1, Math.min(n, Math.floor((this.w * 0.92) / (300 * u)))));
    const rows = Math.ceil(n / cols);
    const tw = Math.min(300 * u, (this.w * 0.92) / cols);
    const th = 104 * u;
    const pad = 10 * u;
    const head = 32 * u;
    const w = cols * tw + pad * 2;
    const h = rows * th + head + pad;
    const cx = this.w / 2;
    const y0 = Math.max(60 * u, this.h * 0.78 - h);
    // slides up over the first quarter second
    const rise = Math.max(0, 1 - k.age / 0.25) * 30 * u;
    c.save();
    c.globalAlpha = Math.min(1, k.age / 0.2);
    c.fillStyle = "rgba(8,10,12,0.86)";
    c.fillRect(cx - w / 2, y0 + rise, w, h);
    c.fillStyle = "#8fd8ff";
    c.fillRect(cx - w / 2, y0 + rise, w, 3 * u);
    this.text("CHOOSE YOUR KIT", cx, y0 + rise + 22 * u, 700, 15 * u, "#8fd8ff", "center");
    k.options.forEach((o, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = cx - w / 2 + pad + col * tw;
      const by = y0 + rise + head + row * th;
      c.fillStyle = o.picked ? "rgba(143,216,255,0.18)" : "rgba(255,255,255,0.05)";
      c.fillRect(bx + 2 * u, by + 2 * u, tw - 4 * u, th - 4 * u);
      // the key you press, in a chip
      c.fillStyle = "#f2f2f2";
      c.fillRect(bx + 10 * u, by + 10 * u, 26 * u, 26 * u);
      this.text(o.key, bx + 23 * u, by + 29 * u, 700, 16 * u, "#101214", "center");
      this.text(o.name, bx + 44 * u, by + 30 * u, 700, 21 * u, o.picked ? "#8fd8ff" : WHITE);
      // what it gives you: the two you press and the one that is always on
      const line = (label: string, value: string, dy: number): void => {
        this.text(label, bx + 12 * u, by + dy, 700, 11 * u, "#6f7a86");
        this.text(value, bx + 62 * u, by + dy, 600, 12 * u, DIM);
      };
      line("TACTICAL", o.tactical, 54 * u);
      line("ULTIMATE", o.ult, 70 * u);
      line("PASSIVE", o.passive, 86 * u);
    });
    // and the whole sentence for the one under the cursor, under the grid
    const picked = k.options.find((o) => o.picked);
    if (picked) this.text(picked.blurb, cx, y0 + rise + h + 16 * u, 600, 13 * u, DIM, "center");
    c.restore();
  }

  /** the heal kit, bottom left over the bars: what is left of each */
  private drawKit(s: HudState, u: number): void {
    // SpeedKills carries no heals: no rows for them, only the wheels,
    // the inventory and the captions, which the legacy path left undrawn while alive in a match (Phase 20 A6)
    if (this.layout) {
      this.drawHealWheel(s, u);
      this.drawEmoteWheel(s, u);
      this.drawPingWheel(s, u);
      this.drawInventory(s, u);
      this.drawCaptions(s, u);
      return;
    }
    if (!s.kit) {
      this.drawHealWheel(s, u);
    this.drawEmoteWheel(s, u);
    this.drawPingWheel(s, u);
    this.drawInventory(s, u);
    this.drawCaptions(s, u);
      return;
    }
    const x = 34 * u + 350 * u;
    const y = this.h - 52 * u;
    const short: Record<string, string> = { cell: "CELL", battery: "BATT", syringe: "SYR", medkit: "MED", phoenix: PHOENIX_SHORT };
    const parts = ["cell", "battery", "syringe", "medkit", "phoenix"].filter((k) => (s.kit?.[k] ?? 0) > 0 || k === "cell" || k === "syringe").map((k) => `${short[k]} ${s.kit?.[k] ?? 0}`);
    const any = Object.values(s.kit).some((n) => n > 0);
    this.text(`${s.healKey ?? "4"}  ${parts.join("  ")}`, x, y, 700, 13 * u, any ? DIM : "rgba(154,164,173,0.4)");
    this.drawHealWheel(s, u);
  }

  /** the heal wheel: the five heals round the crosshair, the one pointed at lit, a count on each */
  /**
   * The captions, down the left above the vitals: what was heard, which way it
   * came from and roughly how far. Read left to right the way a line of text
   * is read, because that is what it is.
   */
  private drawCaptions(s: HudState, u: number): void {
    const lines = s.captions;
    if (!lines || !lines.length) return;
    const c = this.ctx;
    const x = 34 * u;
    let y = Math.min(this.h - 150 * u, this.leftTop - 20 * u) - lines.length * 22 * u;
    for (const l of lines) {
      const where = l.where ? `  ${l.where}` : "";
      const range = l.range ? `  ${l.range}` : "";
      c.fillStyle = "rgba(8, 10, 13, 0.6)";
      const text = `${l.text}${where}${range}`;
      c.font = `700 ${13 * u}px Rajdhani, sans-serif`;
      const w = c.measureText(text).width + 16 * u;
      c.fillRect(x - 6 * u, y - 14 * u, w, 20 * u);
      this.text(l.text, x, y, 700, 13 * u, WHITE);
      if (l.where) this.text(`${l.where}${range}`, x + c.measureText(l.text).width + 10 * u, y, 600, 12 * u, DIM);
      y += 22 * u;
    }
  }

  /** the ping wheel: what a mark would mean, six round the middle */
  private drawPingWheel(s: HudState, u: number): void {
    const w = s.pingWheel;
    if (!w) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = 130 * u;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.arc(cx, cy, R + 56 * u, 0, Math.PI * 2);
    c.fill();
    w.items.forEach((name, i) => {
      const a = (i / w.items.length) * Math.PI * 2;
      const x = cx + Math.sin(a) * R;
      const y = cy - Math.cos(a) * R;
      const on = w.pick === i;
      c.fillStyle = on ? "rgba(90,190,255,0.3)" : "rgba(8,10,12,0.75)";
      c.beginPath();
      c.arc(x, y, 44 * u, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = on ? "#5abeff" : "rgba(255,255,255,0.25)";
      c.lineWidth = 2 * u;
      c.stroke();
      for (const [j, line] of name.split(" ").entries()) this.text(line, x, y + (j - (name.split(" ").length - 1) / 2) * 13 * u + 4 * u, 700, 11 * u, on ? "#5abeff" : WHITE, "center");
    });
    this.text("MOVE TO WHAT YOU MEAN, LET GO TO MARK IT", cx, cy + R + 76 * u, 700, 13 * u, DIM, "center");
  }

  /**
   * The pack, held open on Tab: what you have, in one place. Read only, which
   * is the honest half of an inventory screen: dropping and swapping are done
   * where the item is, and what a player needs mid-match is the answer to
   * "what have I got".
   */
  private drawInventory(s: HudState, u: number): void {
    const inv = s.inventory;
    if (!inv) return;
    const c = this.ctx;
    const w = Math.min(this.w * 0.8, 760 * u);
    const h = Math.min(this.h * 0.8, 460 * u);
    const x0 = (this.w - w) / 2;
    const y0 = (this.h - h) / 2;
    c.fillStyle = "rgba(8, 10, 13, 0.9)";
    c.fillRect(x0, y0, w, h);
    c.strokeStyle = "rgba(255,255,255,0.14)";
    c.lineWidth = 1;
    c.strokeRect(x0, y0, w, h);
    this.text("WHAT YOU ARE CARRYING", x0 + 24 * u, y0 + 34 * u, 700, 18 * u, WHITE);
    this.text(`${inv.armor}   ·   ${inv.helmet}`, x0 + w - 24 * u, y0 + 34 * u, 700, 14 * u, DIM, "right");
    let y = y0 + 74 * u;
    for (const g of inv.guns) {
      this.text(g.name, x0 + 24 * u, y, 700, 17 * u, g.inHand ? "#ffd23c" : WHITE);
      this.text(`${g.clip} / ${g.size}   ${g.ammo}`, x0 + w - 24 * u, y, 700, 15 * u, g.inHand ? "#ffd23c" : DIM, "right");
      y += 20 * u;
      this.text(g.attach.length ? g.attach.join("  ·  ") : "no attachments", x0 + 24 * u, y, 600, 12 * u, DIM);
      y += 30 * u;
    }
    const col = (title: string, rows: Array<{ name: string; n: number }>, cx: number) => {
      let yy = y + 10 * u;
      this.text(title, cx, yy, 700, 12 * u, DIM);
      yy += 22 * u;
      if (!rows.length) this.text("nothing", cx, yy, 600, 13 * u, "rgba(154,164,173,0.5)");
      for (const r of rows) {
        this.text(r.name, cx, yy, 600, 13 * u, WHITE);
        this.text(`x${r.n}`, cx + 150 * u, yy, 700, 13 * u, DIM, "right");
        yy += 19 * u;
      }
    };
    col("HEALS", inv.heals, x0 + 24 * u);
    col("AMMO", inv.ammo, x0 + 24 * u + 200 * u);
    this.text("HOLD TAB", this.w / 2, y0 + h - 18 * u, 700, 12 * u, DIM, "center");
  }

  /** the emote wheel: six round the middle, the one pointed at lit */
  private drawEmoteWheel(s: HudState, u: number): void {
    const w = s.emoteWheel;
    if (!w) return;
    const c = this.ctx;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const R = 120 * u;
    c.fillStyle = "rgba(0,0,0,0.35)";
    c.beginPath();
    c.arc(cx, cy, R + 50 * u, 0, Math.PI * 2);
    c.fill();
    w.items.forEach((name, i) => {
      const a = (i / w.items.length) * Math.PI * 2;
      const x = cx + Math.sin(a) * R;
      const y = cy - Math.cos(a) * R;
      const on = w.pick === i;
      c.fillStyle = on ? "rgba(255,210,60,0.3)" : "rgba(8,10,12,0.75)";
      c.beginPath();
      c.arc(x, y, 38 * u, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = on ? "#ffd23c" : "rgba(255,255,255,0.25)";
      c.lineWidth = 2 * u;
      c.stroke();
      this.text(name, x, y + 5 * u, 700, 12 * u, on ? "#ffd23c" : WHITE, "center");
    });
    this.text("MOVE TO AN EMOTE, LET GO TO PLAY IT", cx, cy + R + 70 * u, 700, 13 * u, DIM, "center");
  }

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
    // the range's practice numbers are the range's: in a SpeedKills match they were only in the way
    if (this.layout && s.duel) return;
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
      ["DAMAGE", `${damageText(s.stats.damage)}   HS ${s.stats.headshots}`],
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

  /** the ground you are on, under the compass: "MID", "EAST ROOF" */
  private drawCallout(s: HudState, u: number): void {
    if (!s.callout) return;
    this.text(s.callout, this.w / 2, 60 * u, 700, 12 * u, "rgba(154,164,173,0.75)", "center");
  }

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
    // Your squad along the strip (Phase 27): each teammate's number on their colour at the bearing to them, or at
    // the strip's end, pointing, when they are off it. Before the readout, which stays readable over one.
    for (const t of s.squad?.tags ?? []) {
      const to = (Math.atan2(t.world.x - s.px, -(t.world.z - s.pz)) * 180) / Math.PI;
      const d = ((((to - bearing) % 360) + 540) % 360) - 180;
      const lim = span / 2 - 4;
      const off = Math.abs(d) > lim;
      const x = cx + (Math.max(-lim, Math.min(lim, d)) / span) * width;
      const bs = 11 * u;
      const py = y + 8 * u;
      c.globalAlpha = t.life === "ghost" || t.life === "quiet" ? 0.6 : 1;
      c.fillStyle = t.color;
      c.fillRect(x - bs / 2, py, bs, bs);
      if (off) {
        const dir = Math.sign(d);
        c.beginPath();
        c.moveTo(x + dir * (bs / 2 + 6 * u), py + bs / 2);
        c.lineTo(x + dir * (bs / 2 + 1 * u), py);
        c.lineTo(x + dir * (bs / 2 + 1 * u), py + bs);
        c.closePath();
        c.fill();
      }
      c.fillStyle = "#0b0e12";
      c.font = this.font(800, 10 * u);
      c.textAlign = "center";
      c.fillText(String(t.slot), x, py + bs / 2 + 3.5 * u);
      c.globalAlpha = 1;
    }
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

  /** a text's box for the layout checks: from its measured width and the font's cap height */
  private textBox(k: string, t: string, x: number, y: number, weight: number, size: number, align: CanvasTextAlign): void {
    const c = this.ctx;
    c.font = this.font(weight, size);
    const w = c.measureText(t).width;
    const x0 = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    this.box(k, x0, y - size * 0.66, w, size * 0.66);
  }

  /** SpeedKills' left of the bottom edge: speed, the shield's segments, the health bar twice as thick (Phase 20 A6) */
  private drawVitalsSk(s: HudState, u: number, L: SkLayout): void {
    const c = this.ctx;
    const x0 = L.margin.x * u;
    const bw = L.health.w * u;
    const hh = L.health.h * u;
    const yH = this.h - (L.margin.bottom + L.health.h) * u;
    const sh = L.shield.h * u;
    const yS = yH - (L.shield.gap + L.shield.h) * u;
    const base = yS - L.speed.gap * u;
    const stanceColor = s.stance === "slide" ? "#ffd27a" : s.stance === "air" ? "#8fc7ff" : s.stance === "climb" ? "#7ddc8a" : WHITE;
    const speedColor = WHITE;
    const sp = `${s.speedHu.toFixed(0)}`;
    this.text(sp, x0, base, 700, L.speed.font * u, speedColor);
    this.textBox("speed", sp, x0, base, 700, L.speed.font * u, "left");
    c.font = this.font(700, L.speed.font * u);
    const sw = c.measureText(sp).width;
    const st = `HU/S   ${s.stance.toUpperCase()}${s.holstered ? "   HOLSTERED" : ""}`;
    this.text(st, x0 + sw + 8 * u, base, 700, L.speed.stanceFont * u, stanceColor);
    this.textBox("stance", st, x0 + sw + 8 * u, base, 700, L.speed.stanceFont * u, "left");
    const v = s.vitals;
    const segs = v ? Math.max(1, Math.round(v.shieldMax / L.shield.per)) : 2;
    const g = L.shield.segGap * u;
    const segW = (bw - g * (segs - 1)) / segs;
    for (let i = 0; i < segs; i++) this.bar(x0 + i * (segW + g), yS, segW, sh, v ? (v.shield - i * L.shield.per) / L.shield.per : 1, "rgba(0,0,0,0.5)", "#a855f7", u);
    this.box("shield", x0, yS, bw, sh);
    const hp = v ? Math.max(0, v.health / v.healthMax) : 1;
    this.bar(x0, yH, bw, hh, hp, "rgba(0,0,0,0.5)", hp < 0.3 ? RED : WHITE, u);
    this.box("health", x0, yH, bw, hh);
    const n = v ? poolText(v.health) : "100";
    const ny = yH + hh / 2 + L.health.font * u * 0.35;
    this.text(n, x0 + bw - L.health.pad * u, ny, 700, L.health.font * u, WHITE, "right");
    this.textBox("healthNumber", n, x0 + bw - L.health.pad * u, ny, 700, L.health.font * u, "right");
    const sq = s.squad;
    if (sq?.me) this.drawMyNumber(sq.me, x0, yS, yH + hh - yS, u, L);
    if (sq?.rows.length) this.drawSquadPanel(sq.rows, x0, base - L.speed.font * u * 0.75 - L.squad.gap * u, u, L);
  }

  /** your own number, on your colour, in the margin left of your shield and health (Phase 27) */
  private drawMyNumber(me: { slot: number; color: string }, x0: number, y: number, h: number, u: number, L: SkLayout): void {
    const M = L.squad.mine;
    const w = M.w * u;
    const x = x0 - (M.w + M.dx) * u;
    const c = this.ctx;
    c.fillStyle = me.color;
    c.fillRect(x, y, w, h);
    this.edge(x, y, w, h, u);
    c.fillStyle = "#0b0e12";
    c.font = this.font(800, M.font * u);
    c.textAlign = "center";
    c.fillText(String(me.slot), x + w / 2, y + h / 2 + M.font * u * 0.35);
    this.box("squadMe", x, y, w, h);
  }

  /**
   * The squad panel (Phase 27): a row a teammate over your own health, as
   * every battle royale has it, bordered in their colour with their number on
   * it. Each shows their shield and health, a flash and a draining chip when
   * they are hit, or what has become of them instead.
   */
  private drawSquadPanel(rows: SquadRow[], x0: number, bottom: number, u: number, L: SkLayout): void {
    const Q = L.squad;
    const c = this.ctx;
    const w = Q.w * u;
    const h = Q.rowH * u;
    const top = bottom - rows.length * h - (rows.length - 1) * Q.rowGap * u;
    this.leftTop = top;
    rows.forEach((r, i) => {
      const y = top + i * (h + Q.rowGap * u);
      const gone = r.life === "out" || r.life === "left";
      const dim = gone || r.life === "quiet";
      c.globalAlpha = gone ? 0.55 : 1;
      c.fillStyle = "rgba(8,10,13,0.6)";
      c.fillRect(x0, y, w, h);
      if (r.hurtK > 0) {
        c.fillStyle = `rgba(255,60,60,${(0.4 * r.hurtK).toFixed(3)})`;
        c.fillRect(x0, y, w, h);
      }
      c.lineWidth = Q.border * u;
      c.strokeStyle = r.color;
      c.strokeRect(x0 + (Q.border * u) / 2, y + (Q.border * u) / 2, w - Q.border * u, h - Q.border * u);
      const bs = Q.badge * u;
      const bx = x0 + (h - bs) / 2;
      const by = y + (h - bs) / 2;
      c.fillStyle = r.color;
      c.fillRect(bx, by, bs, bs);
      c.fillStyle = "#0b0e12";
      c.font = this.font(800, Q.numFont * u);
      c.textAlign = "center";
      c.fillText(String(r.slot), bx + bs / 2, by + bs / 2 + Q.numFont * u * 0.35);
      const nx = bx + bs + Q.pad * u;
      const right = x0 + w - Q.pad * u;
      const ny = y + Q.pad * u + Q.nameFont * u * 0.7;
      this.text(r.name, nx, ny, 700, Q.nameFont * u, dim ? DIM : WHITE);
      if (r.talking) {
        c.font = this.font(700, Q.nameFont * u);
        this.text("●", nx + c.measureText(r.name).width + 6 * u, ny, 700, Q.nameFont * u * 0.8, "#7ddc8a");
      }
      if (r.dist !== null && r.life !== "left" && r.life !== "gulag") this.text(`${Math.round(r.dist)} M`, right, ny, 600, Q.distFont * u, DIM, "right");
      const state = squadState(r.life);
      const bw = right - nx;
      const sy = ny + Q.barGap * u + 2 * u;
      if (state) this.text(state.text, nx, sy + Q.stateFont * u * 0.8, 700, Q.stateFont * u, state.color);
      else {
        // the shield's segments over the health bar, as your own below, with what the last hits took still showing
        const segs = Math.max(1, Math.round(r.shieldMax / L.shield.per));
        const g = 2 * u;
        const segW = (bw - g * (segs - 1)) / segs;
        const sh = Q.shieldH * u;
        for (let k = 0; k < segs; k++) {
          const sx = nx + k * (segW + g);
          const was = (r.chipShield - k * L.shield.per) / L.shield.per;
          c.fillStyle = "rgba(0,0,0,0.5)";
          c.fillRect(sx, sy, segW, sh);
          if (r.chipK > 0 && was > 0) {
            c.fillStyle = `rgba(255,255,255,${(0.7 * r.chipK).toFixed(3)})`;
            c.fillRect(sx, sy, segW * Math.min(1, was), sh);
          }
          c.fillStyle = SHIELD;
          c.fillRect(sx, sy, segW * Math.max(0, Math.min(1, (r.shield - k * L.shield.per) / L.shield.per)), sh);
        }
        const hy = sy + sh + Q.barGap * u;
        const hb = Q.barH * u;
        const hp = Math.max(0, r.health / r.healthMax);
        c.fillStyle = "rgba(0,0,0,0.5)";
        c.fillRect(nx, hy, bw, hb);
        if (r.chipK > 0 && r.chipHealth > r.health) {
          c.fillStyle = `rgba(255,90,90,${(0.85 * r.chipK).toFixed(3)})`;
          c.fillRect(nx, hy, bw * Math.min(1, r.chipHealth / r.healthMax), hb);
        }
        c.fillStyle = r.life === "down" || hp < 0.3 ? RED : WHITE;
        c.fillRect(nx, hy, bw * Math.min(1, hp), hb);
        this.edge(nx, hy, bw, hb, u);
        if (r.life === "down") this.text("DOWN", right, ny, 700, Q.stateFont * u, RED, "right");
      }
      c.globalAlpha = 1;
      this.box(`squad${r.slot}`, x0, y, w, h);
    });
  }

  /**
   * The name over each teammate (Phase 27): small, in their colour, with their
   * number, through anything and at any distance, which is how you keep track
   * of a friend in a city. Close up their shield and health are under it;
   * further off, how far they are. A ghost's is over the ghost, and says so.
   */
  private drawMateTags(camera: THREE.Camera, s: HudState, u: number): void {
    const tags = s.squad?.tags;
    if (!tags?.length) return;
    const T = squadCfg.mates.tag;
    const c = this.ctx;
    const v = new THREE.Vector3();
    for (const t of tags) {
      v.copy(t.world).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * this.w;
      const y = (-v.y * 0.5 + 0.5) * this.h;
      if (x < -40 || x > this.w + 40 || y < -40 || y > this.h + 40) continue;
      c.globalAlpha = t.life === "quiet" ? 0.5 : t.life === "ghost" ? 0.8 : 1;
      const label = t.life === "ghost" ? `${t.name}  GHOST` : t.name;
      c.font = this.font(700, T.font * u);
      const tw = c.measureText(label).width;
      const bs = T.badge * u;
      const x0 = x - (tw + bs + 4 * u) / 2;
      c.fillStyle = t.color;
      c.fillRect(x0, y - bs + 3 * u, bs, bs);
      c.fillStyle = "#0b0e12";
      c.font = this.font(800, T.font * u * 0.85);
      c.textAlign = "center";
      c.fillText(String(t.slot), x0 + bs / 2, y + 3 * u - bs / 2 + T.font * u * 0.3);
      this.text(label, x0 + bs + 4 * u, y, 700, T.font * u, t.color);
      if (t.life === "ghost") this.text("RESTORE AT THEIR ECHO", x, y + 14 * u, 600, 11 * u, t.color, "center");
      else if (t.life === "quiet") this.text("NO CONNECTION", x, y + 14 * u, 600, 11 * u, DIM, "center");
      else if (t.dist <= T.bars && t.life === "up") {
        const bw = 60 * u;
        c.fillStyle = "rgba(0,0,0,0.55)";
        c.fillRect(x - bw / 2, y + 6 * u, bw, 3 * u);
        c.fillRect(x - bw / 2, y + 10 * u, bw, 3 * u);
        c.fillStyle = SHIELD;
        c.fillRect(x - bw / 2, y + 6 * u, bw * Math.max(0, Math.min(1, t.shield / Math.max(1, t.shieldMax))), 3 * u);
        c.fillStyle = t.health > 30 ? "#d8e2ea" : RED;
        c.fillRect(x - bw / 2, y + 10 * u, bw * Math.max(0, Math.min(1, t.health / 100)), 3 * u);
      } else if (t.dist > T.distFrom) this.text(`${Math.round(t.dist)} M`, x, y + 14 * u, 600, 11 * u, DIM, "center");
      c.globalAlpha = 1;
    }
  }

  /** SpeedKills' two hacks, right of the health bar, lower and bigger than the legacy square (Phase 20 A6) */
  private drawHacksSk(s: HudState, u: number, L: SkLayout): void {
    const list = s.hacks;
    if (!list?.length) return;
    const c = this.ctx;
    const size = L.hacks.size * u;
    const gap = L.hacks.gap * u;
    const x0 = (L.margin.x + L.health.w + L.hacks.dx) * u;
    const y = this.h - (L.margin.bottom + L.hacks.size) * u;
    list.forEach((hk, i) => {
      const x = x0 + i * (size + gap);
      const col = hk.slot === "mobility" ? "32, 224, 255" : "255, 46, 154";
      const ready = hk.frac <= 0;
      c.fillStyle = PANEL;
      c.fillRect(x, y, size, size);
      if (!ready) {
        c.fillStyle = "rgba(0, 0, 0, 0.55)";
        c.fillRect(x, y, size, size * hk.frac);
      }
      this.edge(x, y, size, size, u);
      c.strokeStyle = `rgba(${col}, ${ready ? 0.95 : 0.4})`;
      c.lineWidth = 2 * u;
      c.strokeRect(x + u, y + u, size - 2 * u, size - 2 * u);
      const name = hk.name.length > 8 ? hk.name.slice(0, 7) + "." : hk.name;
      this.text(name, x + size / 2, y + 22 * u, 700, L.hacks.nameFont * u, ready ? `rgb(${col})` : `rgba(${col}, 0.75)`, "center");
      this.text(ready ? hk.key : hk.left.toFixed(hk.left < 10 ? 1 : 0), x + size / 2, y + 50 * u, 700, L.hacks.keyFont * u, WHITE, "center");
      const pw = (size - 16 * u) / hk.maxLevel;
      for (let p = 0; p < hk.maxLevel; p++) this.bar(x + 8 * u + p * pw, y + size - 11 * u, pw - 3 * u, L.hacks.pipH * u, p < hk.level ? 1 : 0, "rgba(255,255,255,0.18)", `rgb(${col})`, u * 0.67);
      this.box(`hack${i}`, x, y, size, size);
    });
  }

  /**
   * SpeedKills' right of the bottom edge: the ammo count half as big again, and the two guns with their fusion
   * pips and level left of it (Phase 20 A6)
   */
  private drawWeaponsSk(s: HudState, u: number, L: SkLayout): void {
    const c = this.ctx;
    const right = this.w - L.margin.x * u;
    const xR = this.w - (L.margin.x + L.ammo.right) * u;
    const base = this.h - L.margin.bottom * u;
    const warn = s.unarmed ? null : ammoWarning(s.clip, s.clipSize, s.reloading);
    const clipColor = s.clip === 0 ? RED : s.swapping || s.holstered ? DIM : warn ? "#ffb13d" : WHITE;
    const clipText = s.unarmed ? "-" : `${s.clip}`;
    this.text(clipText, xR, base, 700, L.ammo.font * u, s.unarmed ? DIM : clipColor, "right");
    this.textBox("ammo", clipText, xR, base, 700, L.ammo.font * u, "right");
    if (!s.unarmed) {
      this.text(`/ ${s.clipSize}`, right, base - 8 * u, 700, L.ammo.sizeFont * u, DIM, "right");
      this.textBox("clipSize", `/ ${s.clipSize}`, right, base - 8 * u, 700, L.ammo.sizeFont * u, "right");
      const res = s.reserve ?? Infinity;
      const rt = Number.isFinite(res) ? String(res) : "\u221e";
      this.text(rt, right, base - 44 * u, 700, L.ammo.reserveFont * u, res === 0 ? RED : DIM, "right");
      this.textBox("reserve", rt, right, base - 44 * u, 700, L.ammo.reserveFont * u, "right");
    }
    if (s.heat) {
      this.bar(xR - L.ammo.heatW * u, base - 92 * u, L.ammo.heatW * u, L.ammo.heatH * u, s.heat.heat, "rgba(0,0,0,0.5)", s.heat.locked ? RED : "#ffd27a", u);
      this.box("heat", xR - L.ammo.heatW * u, base - 92 * u, L.ammo.heatW * u, L.ammo.heatH * u);
    }
    const sw = L.slots.w * u;
    const sh = L.slots.h * u;
    const sg = L.slots.gap * u;
    const sx = xR - (L.ammo.digitsBox + L.slots.dx) * u - sw;
    const names = s.slot === 1 ? [s.weaponName, s.otherName] : [s.otherName, s.weaponName];
    const n = s.fusion ? s.fusion.max : 0;
    const pipsW = n * L.slots.pipW * u + Math.max(0, n - 1) * L.slots.pipGap * u;
    for (let i = 0; i < 2 && i < s.slotCount; i++) {
      const active = i + 1 === s.slot;
      const y = base - (2 - i) * sh - (1 - i) * sg;
      c.fillStyle = active ? "rgba(255,255,255,0.16)" : PANEL;
      c.fillRect(sx, y, sw, sh);
      this.edge(sx, y, sw, sh, u);
      if (active) {
        c.fillStyle = "#ffd23c";
        c.fillRect(sx, y, 3 * u, sh);
      }
      this.text(`${i + 1}`, sx + 10 * u, y + sh / 2 + 6 * u, 700, L.slots.numFont * u, active ? "#ffd23c" : DIM);
      const lv = s.fusion ? s.fusion.levels[i] : undefined;
      // (fists and an empty slot have no level to show)
      const hasGun = names[i] !== "EMPTY" && !(active && s.unarmed);
      // the level in words beside its pips: a beginner reads LV 3 before they learn the pips
      const lvText = s.fusion && lv !== undefined && hasGun ? `LV ${lv}` : "";
      c.font = this.font(700, L.slots.levelFont * u);
      const lvW = lvText ? c.measureText(lvText).width + 6 * u : 0;
      const label = names[i].toUpperCase();
      // the gun's class after its name in a second, smaller tone (Phase 20 A7): gold on the lit slot, where grey
      // did not read
      const kind = (s.slot === 1 ? [s.weaponKind, s.otherKind] : [s.otherKind, s.weaponKind])[i];
      const kindText = hasGun && kind ? kind.toUpperCase() : "";
      c.font = this.font(700, L.slots.nameFont * u);
      const nameW = c.measureText(label).width;
      c.font = this.font(700, L.slots.kindFont * u);
      const kindW = kindText ? c.measureText(kindText).width + 6 * u : 0;
      const room = sw - 26 * u - 8 * u - (lvText ? pipsW + lvW + 8 * u : 0);
      const fit = Math.min(1, room / Math.max(1, nameW + kindW));
      this.text(label, sx + 26 * u, y + sh / 2 + 6.5 * u, 700, L.slots.nameFont * u * fit, active ? WHITE : DIM);
      if (kindText) this.text(kindText, sx + 26 * u + (nameW + 6 * u) * fit, y + sh / 2 + 6.5 * u, 700, L.slots.kindFont * u * fit, active ? "#ffd23c" : DIM);
      if (lvText && lv !== undefined) {
        const px0 = sx + sw - 8 * u - lvW - pipsW;
        for (let k = 0; k < n; k++) this.bar(px0 + k * (L.slots.pipW + L.slots.pipGap) * u, y + sh / 2 - 2 * u, L.slots.pipW * u, L.slots.pipH * u, k < lv ? 1 : 0, "rgba(255,255,255,0.18)", "#3cf2ff", u * 0.67);
        this.text(lvText, sx + sw - 8 * u, y + sh / 2 + 4.5 * u, 700, L.slots.levelFont * u, active ? "#3cf2ff" : DIM, "right");
      }
      this.box(`slot${i}`, sx, y, sw, sh);
    }
    if (!s.unarmed) {
      const mode = s.fireMode.toUpperCase();
      const my = base - 2 * sh - sg - 8 * u;
      this.text(mode, sx + sw, my, 600, L.slots.modeFont * u, DIM, "right");
      this.textBox("fireMode", mode, sx + sw, my, 600, L.slots.modeFont * u, "right");
    }
    if (s.reloading) {
      const w = 180 * u;
      const x = Math.round((this.w - w) / 2);
      const y = Math.round(this.h / 2 + 46 * u);
      this.bar(x, y, w, 5 * u, s.reloadProgress, "rgba(255,255,255,0.18)", "rgba(255,210,122,0.72)", u * 0.67);
      this.text("RELOADING", x + w / 2, y - 6 * u, 600, 10 * u, "rgba(230,236,242,0.5)", "center");
    }
  }

  private drawVitals(s: HudState, u: number): void {
    if (this.layout) {
      this.drawVitalsSk(s, this.bottomUnit(u), this.layout);
      return;
    }
    const c = this.ctx;
    const x0 = 34 * u;
    const barW = 330 * u;
    const yShield = this.h - 72 * u;
    const yHealth = this.h - 50 * u;
    // speed and stance, which movement players actually read
    const stanceColor = s.stance === "slide" ? "#ffd27a" : s.stance === "air" ? "#8fc7ff" : s.stance === "climb" ? "#7ddc8a" : WHITE;
    const speedColor = WHITE;
    this.text(`${s.speedHu.toFixed(0)}`, x0, yShield - 26 * u, 700, 34 * u, speedColor);
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
    this.text(v ? poolText(v.health) : "100", x0 + barW + 10 * u, yHealth + 11 * u, 700, 15 * u, WHITE);
  }

  // ------------------------------------------------------------ bottom-right

  private drawWeapons(s: HudState, u: number): void {
    if (this.layout) {
      this.drawWeaponsSk(s, this.bottomUnit(u), this.layout);
      return;
    }
    const c = this.ctx;
    const right = this.w - 30 * u;
    const bottom = this.h - 30 * u;
    // big magazine count and reserve (none with nothing in hand)
    if (s.unarmed) {
      this.text("—", right - 70 * u, bottom - 10 * u, 700, 58 * u, DIM, "right");
    }
    const warn = s.unarmed ? null : ammoWarning(s.clip, s.clipSize, s.reloading);
    const clipColor = s.clip === 0 ? RED : s.swapping || s.holstered ? DIM : warn ? "#ffb13d" : WHITE;
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
      // SpeedKills: the gun's fusion as pips along the slot's foot, lit to its level (as the hacks show theirs)
      const lv = s.fusion ? s.fusion.levels[i] : undefined;
      if (s.fusion && lv !== undefined && names[i] !== "EMPTY") {
        const n = s.fusion.max;
        const pw = 10 * u;
        const gap = 3 * u;
        const x0 = x + slotW - 8 * u - n * pw - (n - 1) * gap;
        for (let k = 0; k < n; k++) {
          c.fillStyle = k < lv ? "#3cf2ff" : "rgba(255,255,255,0.18)";
          c.fillRect(x0 + k * (pw + gap), top + 4 * u, pw, 3 * u);
        }
      }
    }
    if (!s.unarmed) this.text(s.fusion ? `${s.fireMode.toUpperCase()}  ·  FUSION ${s.fusion.levels[s.slot - 1] ?? 0}/${s.fusion.max}` : `${s.fireMode.toUpperCase()}  ·  MAG ${s.magLevel}`, right, top - 10 * u, 600, 13 * u, DIM, "right");
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
    // The reload bar is in the middle of the screen, under the reticle, and
    // faint. It was tucked under the ammo count in the corner, which is the
    // one place your eyes are not during a reload: you are looking at whoever
    // made you reload. Faint, because it sits over the fight - enough to read
    // at a glance, not enough to hide anybody.
    if (s.reloading) {
      const w = 180 * u;
      const x = Math.round((this.w - w) / 2);
      const y = Math.round(this.h / 2 + 46 * u);
      const done = Math.max(0, Math.min(1, s.reloadProgress));
      c.fillStyle = "rgba(0,0,0,0.28)";
      c.fillRect(x - 1, y - 1, w + 2, 5 * u + 2);
      c.fillStyle = "rgba(255,255,255,0.18)";
      c.fillRect(x, y, w, 5 * u);
      c.fillStyle = "rgba(255,210,122,0.72)";
      c.fillRect(x, y, w * done, 5 * u);
      this.text("RELOADING", x + w / 2, y - 6 * u, 600, 10 * u, "rgba(230,236,242,0.5)", "center");
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
