import * as THREE from "three";
import { setFigureView } from "./game/figlod";
import { WALLS, clearWalls, putWall, stepWalls } from "./game/walls";
import { SMOKES, clearSmoke, smokeAt, stepSmoke, throwSmoke } from "./game/smoke";
import playerCfg from "./config/player.json";
import { resolveWeapon, weaponClass, weaponIds, weaponName } from "./game/weapons";
import { adsSensScale, cmPer360, degPerCount, gunFov, hipFov43, verticalFovFrom43, OPTIC_ZOOMS, opticZoom, type OpticZoom } from "./game/sens";
import { Input } from "./game/input";
import { padButtons, type PadSettings } from "./game/gamepad";
import { Player } from "./game/player";
import { Loadout, type SlotSetup } from "./game/loadout";
import type { AttachSlot } from "./game/attachments";
import { HU, MOVE } from "./game/movement";
import { installSky } from "./game/materials";
import { Renderer, VM_LAYER } from "./game/render";
import vmCfg from "./config/viewmodel.json";
import netCfg from "./config/net.json";
import doorsCfg from "./config/doors.json";
import voiceCfg from "./config/voice.json";
import rulesCfg from "./config/rules.json";
import { FINISHES, chooseFinish, finishFor } from "./game/finishes";
import { applyFinish, gunModel } from "./game/gunmodels";
import { Voice } from "./net/voice";
import type Peer from "peerjs";
import { Course } from "./game/course";
import { BASIC_COURSE } from "./game/courses/basic";
import { ADVANCED_COURSE } from "./game/courses/advanced";
import { loadQuality, saveQuality, measureRefresh, PRESETS, type Preset, drawRange, sceneryFar } from "./game/quality";
import { lastSolidNormal, ProjectileSystem, solidHit } from "./game/projectile";
import AUDIO_CFG from "./config/audio.json";
import { LOCKED_HOPUPS, lockedHopupFor } from "./game/attachments";
import { Dummy, ARMOR_NAME, ARMOR_COLOR, actCode, actFromCode, type ArmorTier, type FigurePose } from "./game/dummy";
import { buildRange, skyFollow, setShadowRegion, setHour, getSun, RANGE_BOUNDS, RANGE_SOLIDS, TARGET_RAILS, TARGET_SPECS, PROP_PLACEMENTS } from "./game/range";
import { HOURS, HOUR_IDS, hourFor, loadHour, saveHour, matchHour, loadBrSky, saveBrSky, type Hour } from "./game/sky";
import { buildBrMap, BR_BOUNDS, BR_CENTER } from "./game/br";
import { BrMatch, DROP_HEIGHT } from "./game/brmatch";
import { SHIP, surfaceUnder, type ShipRun } from "./game/dropship";
import { GULAG } from "./game/gulag";
import brCfg from "./config/br.json";
import { placeProps, placeInstanced, stepInstanced } from "./game/props";
import { Target } from "./game/targets";
import { ViewModel } from "./game/viewmodel";
import { GameAudio } from "./game/audio";
import { Hud, type HudState } from "./game/hud";
import { DpiCalibrator, snapDpi } from "./game/dpi-calibrate";
import { ZIPLINES, ladderAhead, deployZipline } from "./game/traversal";
import { mergeStatic } from "./game/staticmerge";
import { opticInfo } from "./game/optics";
import { opticName, hopupName } from "./config/names";
import type { ResolvedWeapon } from "./game/weapons";
import { Duel, MAX_PLAYERS, SHIELD_MAX, HEALTH_MAX, moveDirOf, type MatchLike, type HeirSnapshot } from "./game/duel";
import { BotMatch, MOST_BOTS } from "./game/bots";
import { Stats, asDifficulty, type MatchKind, type MatchSummary, type BotDifficulty } from "./game/stats";
import { initAccountUi } from "./ui/account";
import { submitScore } from "./game/leaderboard";
import { hostMatch, joinMatch, normaliseCode, type BrWelcome, type HostHandle, type Link, type MatchOpts, type MatchRules, type NetMsg } from "./net/link";
import { deviceProblem, dismissWelcome, initWelcome } from "./ui/welcome";
import { AimAssist } from "./game/aimassist";
import { applySavedBinds, initBindsUi } from "./ui/binds";
import type { MoveInput } from "./game/player";
import { buildArena, buildTriArena, ARENA_BOUNDS, ARENA_HANDLES, ARENA_MAPS, ARENA_SPAWNS, TRI_BOUNDS, arenaMap, mapFor, type ArenaMapId } from "./game/arena";
import { Loadouts, type LoadoutDef } from "./game/loadouts";
import { operatorById, OPERATORS } from "./game/operators";
import { setArmColors } from "./game/arms";
import { Menu, brRulesId, brTeamId, type Mode } from "./ui/menu";
import { friendsModeFor } from "./ui/lobby";
import { calloutAt, calloutLine } from "./game/callouts";
import type { ImpactEvent } from "./game/projectile";
import { INSPECT_TIME, FLOURISH_TIME, MELEE_TIME } from "./game/viewmodel";
import { Abilities, ABILITIES, JOLT, JOLT_DEFAULTS, KITS, kitOf, setJolt, type AbilityId } from "./game/abilities";
import { currentBinds, type Action } from "./game/input";
import { bindName } from "./ui/binds";
import { FxLayer } from "./game/fx";
import { Killcam, Recorder } from "./game/killcam";
import { DamageLog, HEAL_CODES, type Recap } from "./game/recap";
import { Soundscape } from "./game/soundscape";
import { DummyBehaviour, DUMMY_MODES, DUMMY_MODE_NAME, FlickDrill, RangeCombat, SprayWall, type DummyMode } from "./game/rangetools";
import { ReadmeTv } from "./game/readmetv";
import { Aimbot } from "./game/aimbot";
import { blastOffsets } from "./game/blast";
import hudCfg from "./config/hud.json";
import { SuperglideTrainer } from "./game/trainer";
import { BrPlay, PING_INTENTS, pingPickAt } from "./game/brplay";
import { Captions, howFar, whereFrom } from "./game/captions";
import { Tour, type TourCheck } from "./game/tour";
import { Ordnance, Throwables, THROWABLES, PAINT, arcSlowFor, blastDamage, isPaintThrow, isThrowKind, paintUnder, throwCode, throwFromCode, type FireStrip, type ThrowKind, type ThrowTarget, type Thrown } from "./game/throwables";
import { throwName } from "./config/names";
import { loadMannequin, setFigureStyle } from "./game/mannequin";
import { ArenaMode } from "./game/modematch";
import { MODES, MODE_TITLE, isModeKind, type ModeKind } from "./game/modes";
import squadCfg from "./config/squad.json";
import { BINS, lootLabel, type LootItem } from "./game/loot";
import type { AmmoType } from "./game/weapons";
import rangeToolsCfg from "./config/rangetools.json";
import type { HitTier } from "./game/audio";
import itemsCfg from "./config/items.json";
import { PACK_ORDER, Armor, HEAL_ORDER, HEALS, Kit, type HealItem } from "./game/kit";
import { Knockdown, type BackTier, type KnockTier } from "./game/kit";
import { STACK, ammoTypeOf } from "./game/ammo";
import { RETICLE_COLORS, RETICLE_DEFAULT, RETICLE_STYLES, cleanReticle, drawReticle, loadReticle, saveReticle, type Reticle } from "./game/reticle";
import { Progress, levelFor, type Award } from "./game/progress";
import { HUD_SCALES, P, VISION_MODES, access, loadAccess, saveAccess, setHudScale, setVision, type VisionMode } from "./game/palette";
import { LoadingScreen } from "./ui/loading";
import { Intro } from "./ui/intro";
import { setMuzzleViewer } from "./game/muzzle";
import { SPRAYS, SprayLayer } from "./game/sprays";
import { BANNERS, BANNER_ICONS, bannerCode, bannerOf } from "./game/banners";
import { ImpactLayer, IMPACTS, blastShakeDeg } from "./game/impacts";
import { EMOTES, EMOTE_STOP } from "./game/emotes";
import emotesCfg from "./config/emotes.json";

// the loading screen listens from here on: before any loader of the page's own has started
const loadingScreen = new LoadingScreen();
/**
 * The intro card (src/ui/intro.ts): the page opens on it, and it plays again
 * as you drop into a match. `?nointro` turns it off, which is what the
 * benchmark and the screenshots pass: neither wants a title card in the frame.
 */
const intro = new Intro();
const NO_INTRO = new URLSearchParams(location.search).has("nointro");
/** the card that opens the game has been played (the frame loop starts it once the world is in) */
let introShown = false;
// a key or a click takes the rest of it: nobody wants a title card twice
if (!NO_INTRO) for (const ev of ["keydown", "pointerdown"] as const) window.addEventListener(ev, () => intro.skip(), { capture: true });
// the shot the card is built round, heard as well as seen. Nothing is heard on
// the page's first card: a browser plays no sound until something is clicked,
// which is exactly right, and by the time a match starts one has been.
intro.onShot = () => audio.shot(0.72, 0.9);
// the sound's graph, and the shot's own voice in it, built a card ahead of the
// shot rather than on its frame: a first noise costs about 30 ms to put
// together, and that landed on the one frame of the card that has to be sharp
intro.onWarm = () => {
  audio.unlock();
  audio.shot(1, 0);
};
// the card is the loading screen: it holds on the rain until the world is in,
// and draws how much of it is as the line under the name
intro.ready = () => loadingScreen.loaded;
intro.progress = () => loadingScreen.fraction;

const DEG = Math.PI / 180;
/** slot 1 and slot 2. Keys 1 and 2 select, Q swaps. */
const LOADOUT_IDS = ["rspn101", "wingman"];
/** which key cycles each attachment slot, shown in the HUD */
const ATTACH_KEY: Record<AttachSlot, string> = {
  optic: "O",
  barrel: "J",
  stock: "N",
  laser: "H",
  hopup: "L",
};

// ---------- settings (defaults from config, overrides in localStorage) ----------
interface Settings {
  dpi: number;
  sens: number;
  ads: number;
  fovScale: number;
  /** aim down sights and crouch: held, or a press to go in and another to come out */
  adsToggle: boolean;
  crouchToggle: boolean;
  /** the per-optic ADS multipliers, on top of the ADS one (1 each by default) */
  opticAds: Record<OpticZoom, number>;
}
const LS_KEY = "range.settings.v1";
function loadSettings(): Settings {
  const base: Settings = {
    dpi: playerCfg.dpi ?? 800,
    sens: playerCfg.mouseSensitivity,
    ads: playerCfg.adsScalars[0] ?? 1,
    fovScale: playerCfg.fovScale,
    adsToggle: false,
    crouchToggle: false,
    opticAds: Object.fromEntries(OPTIC_ZOOMS.map((z) => [z, 1])) as Record<OpticZoom, number>,
  };
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      // Validate every restored field. Trusting localStorage wholesale let a
      // bad value reach the sensitivity math and print NaN on the HUD with no
      // way back.
      const saved = JSON.parse(raw) as Partial<Record<keyof Settings, unknown>>;
      const num = (v: unknown, lo: number, hi: number): number | null => {
        const n = typeof v === "number" ? v : Number(v);
        return Number.isFinite(n) && n >= lo && n <= hi ? n : null;
      };
      base.dpi = num(saved.dpi, 100, 32000) ?? base.dpi;
      base.sens = num(saved.sens, 0.01, 20) ?? base.sens;
      base.ads = num(saved.ads, 0.1, 3) ?? base.ads;
      base.fovScale = num(saved.fovScale, 1, 1.571) ?? base.fovScale;
      base.adsToggle = saved.adsToggle === true;
      base.crouchToggle = saved.crouchToggle === true;
      const oa = saved.opticAds as Record<string, unknown> | undefined;
      if (oa && typeof oa === "object") for (const z of OPTIC_ZOOMS) base.opticAds[z] = num(oa[z], 0.1, 3) ?? 1;
    }
  } catch {
    /* ignore */
  }
  return base;
}
function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
const settings = loadSettings();
// Accessibility (src/game/palette.ts): colour vision and the HUD scale, before
// the first frame so the HUD never draws once in the wrong colours
loadAccess();
// and the captions (src/game/captions.ts): what you would have heard
const captions = new Captions();
{
  const sel = document.getElementById("accCaptions") as HTMLSelectElement;
  try {
    const saved = localStorage.getItem("range.captions");
    if (saved === "off" || saved === "important" || saved === "all") captions.mode = saved;
  } catch {
    /* ignore */
  }
  sel.value = captions.mode;
  sel.addEventListener("change", () => {
    captions.mode = sel.value === "all" ? "all" : sel.value === "important" ? "important" : "off";
    captions.clear();
    try {
      localStorage.setItem("range.captions", captions.mode);
    } catch {
      /* ignore */
    }
  });
}
{
  const vision = document.getElementById("accVision") as HTMLSelectElement;
  const scale = document.getElementById("accHudScale") as HTMLSelectElement;
  for (const v of VISION_MODES) {
    const o = document.createElement("option");
    o.value = v.id;
    o.textContent = v.label;
    vision.appendChild(o);
  }
  for (const k of HUD_SCALES) {
    const o = document.createElement("option");
    o.value = String(k);
    o.textContent = k === 1 ? "HUD scale: 100% (default)" : `HUD scale: ${Math.round(k * 100)}%`;
    scale.appendChild(o);
  }
  vision.value = access.vision;
  scale.value = String(access.hudScale);
  vision.addEventListener("change", () => {
    setVision(vision.value as VisionMode);
    saveAccess();
  });
  scale.addEventListener("change", () => {
    setHudScale(Number(scale.value));
    saveAccess();
  });
}
// XP, the account level and the challenges (src/game/progress.ts)
const progress = new Progress();
/**
 * Quick chat (hud.json quickChat): the chat key opens the list, 1 to 6 sends a
 * line. A line travels as its number over the effect message the host already
 * relays, so nobody's typed text ever reaches anyone else's screen.
 */
const QUICK = hudCfg.quickChat;
let quickOpenUntil = 0;
let quickSentAt = -Infinity;
/** a line said by someone: the kill feed, with their name */
function sayQuick(name: string, i: number, mine: boolean): void {
  const line = QUICK.lines[i];
  if (line === undefined) return;
  hud.feed(`${name}: ${line}`, gameTime, mine ? P.feedAlly : "#c8d0d8");
}
/** send line i, if the gap since the last allows */
function sendQuick(i: number): boolean {
  if (!duel || i < 0 || i >= QUICK.lines.length) return false;
  if (gameTime - quickSentAt < QUICK.gap) return false;
  quickSentAt = gameTime;
  quickOpenUntil = 0;
  duel.localFx("chat", undefined, undefined, i);
  sayQuick(profile.profile.name || "YOU", i, true);
  return true;
}
// 1 to 6 while the list is open send a line instead of switching weapons:
// caught before the game's own key handling sees them
window.addEventListener(
  "keydown",
  (e) => {
    if (gameTime >= quickOpenUntil || !e.code.startsWith("Digit")) return;
    const n = Number(e.code.slice(5));
    if (!(n >= 1 && n <= QUICK.lines.length)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    sendQuick(n - 1);
  },
  { capture: true }
);
/**
 * The end of a match with friends: each player sends their line (kills,
 * damage, place; deaths as the count) as an effect when their match ends,
 * and everyone's card shows one table of all of them. It used to show your
 * own numbers alone.
 */
const endTable = new Map<number, { name: string; kills: number; damage: number; place: number }>();
/** the last match's result, for the summary card while it shows (its table fixed once the match is added to tonight's tally) */
let lastSummary: { at: number; kind: string; s: MatchSummary; a: Award; xpBefore: number; table?: EndRow[] } | null = null;
type EndRow = { name: string; kills: number; damage: number; place: number; you: boolean; id?: number };
/** your id in the match whose line is pending */
let tallyId = 0;

/**
 * Tonight's tally: every match with friends since the code was made, by
 * name (the ids change when a group plays again). Each browser adds up the
 * end tables it is sent, which are the same on every browser, so everyone's
 * tally is the same without a message of its own. A match is added once its
 * end screen is over (the next match starting, or back in the range), when
 * every player's line has come in.
 */
const tonight = new Map<string, { played: number; wins: number; kills: number; damage: number }>();
/** your line of the match whose end screen is up, until it is added to the tally */
let tallyPending: EndRow | null = null;
/** the whole end table: your line and everyone else's that has come in */
function endRows(mine: EndRow): EndRow[] {
  return [mine, ...[...endTable.entries()].map(([id, r]) => ({ ...r, you: false, id }))].sort((a, b) => a.place - b.place || b.kills - a.kills || b.damage - a.damage);
}
/** the match whose end screen is over goes on tonight's tally */
function flushTally(): void {
  const mine = tallyPending;
  if (!mine) return;
  tallyPending = null;
  const rows = endRows(mine);
  if (lastSummary) lastSummary.table = rows;
  // two friends with the same name are told apart by their order in the match (by id, which Play again keeps in order)
  const byId = [...rows].sort((a, b) => (a.you ? tallyId : (a.id ?? 0)) - (b.you ? tallyId : (b.id ?? 0)));
  const seen = new Map<string, number>();
  for (const r of byId) {
    const n = (seen.get(r.name) ?? 0) + 1;
    seen.set(r.name, n);
    const key = rows.filter((o) => o.name === r.name).length > 1 ? `${r.name} (${n})` : r.name;
    const t = tonight.get(key) ?? { played: 0, wins: 0, kills: 0, damage: 0 };
    t.played++;
    if (r.place === 1) t.wins++;
    t.kills += r.kills;
    t.damage += Math.round(r.damage);
    tonight.set(key, t);
  }
  // the lines were this match's: a rematch fills it again
  endTable.clear();
  renderTonight();
}
/** a new code: a new night */
function newNight(): void {
  tonight.clear();
  tallyPending = null;
  renderTonight();
}
function renderTonight(): void {
  const el = $("tonight");
  el.hidden = tonight.size === 0;
  const rows = [...tonight.entries()].sort((a, b) => b[1].wins - a[1].wins || b[1].kills - a[1].kills || b[1].damage - a[1].damage);
  el.innerHTML =
    `<div class="rosterRow"><b>TONIGHT</b> · ${Math.max(0, ...rows.map(([, t]) => t.played))} played</div>` +
    rows.map(([name, t]) => `<div class="rosterRow" data-name="${escapeHtml(name)}"><b>${escapeHtml(name)}</b> · ${t.wins} ${t.wins === 1 ? "win" : "wins"} · ${t.kills} ${t.kills === 1 ? "kill" : "kills"} · ${t.damage} damage · ${t.played} played</div>`).join("");
}
/**
 * The summary card as the HUD draws it this frame, or null once it has had
 * its time or a new match has started.
 */
function summaryView(): HudState["summary"] {
  const L = lastSummary;
  if (!L) return null;
  const cfg = hudCfg.summary;
  const age = gameTime - L.at;
  if (age < 0 || age > cfg.show || (duel && duel.phase === "fight")) {
    lastSummary = null;
    return null;
  }
  const s = L.s;
  const br = s.placement !== undefined;
  const title = br ? (s.placement === 1 ? "CHAMPIONS" : `#${s.placement} OF ${s.players ?? "?"}`) : s.won ? "VICTORY" : "DEFEAT";
  const rows: Array<[string, string]> = [
    ["Kills", String(s.kills)],
    ["Damage", String(Math.round(s.damage))],
    ["Accuracy", s.shots ? `${Math.round((100 * s.hits) / s.shots)}%` : "-"],
  ];
  if (br) rows.push(["Survived", `${Math.floor((s.survived ?? 0) / 60)}:${String(Math.floor((s.survived ?? 0) % 60)).padStart(2, "0")}`]);
  else rows.push(["Rounds", `${s.roundsWon} - ${s.roundsLost}`]);
  // the bar runs from the XP before the match to the XP after, over `fill`
  const t = Math.min(1, age / cfg.fill);
  const shown = L.xpBefore + L.a.gained * (1 - Math.pow(1 - t, 3));
  const lv = levelFor(shown);
  return {
    title,
    good: br ? (s.placement ?? 99) <= 3 : s.won,
    rows,
    xp: L.a.gained,
    lines: L.a.completed.map((c) => `CHALLENGE: ${c.label.toUpperCase()}  +${c.xp}`),
    table: L.table ?? endRows({ name: profile.profile.name || "YOU", kills: s.kills, damage: s.damage, place: s.placement ?? (s.won ? 1 : 2), you: true }),
    level: lv.level,
    bar: lv.need ? lv.into / lv.need : 1,
    levelUp: L.a.levelAfter > L.a.levelBefore && t >= 1,
    alpha: Math.min(1, age * 4, (cfg.show - age) * 2),
  };
}
/** what an award earned, said on the HUD: the XP, a level reached, a challenge finished */
function announceAward(a: Award): void {
  if (a.gained <= 0) return;
  const lines = [`+${a.gained} XP`];
  for (const c of a.completed) lines.push(`CHALLENGE: ${c.label.toUpperCase()}  +${c.xp}`);
  if (a.levelAfter > a.levelBefore) lines.push(`LEVEL ${a.levelAfter}`);
  hud.notice(lines.join("  ·  "), gameTime, 3.5);
}
// The crosshair (src/game/reticle.ts), and the Settings rows that set it up.
// Every change applies at once, is kept, and redraws the little preview so
// the choice can be made without starting a match.
const reticle: Reticle = loadReticle();
{
  const fill = (sel: HTMLSelectElement, items: Array<{ id: string; label: string }>) => {
    for (const it of items) {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = it.label;
      sel.appendChild(o);
    }
  };
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const style = el<HTMLSelectElement>("xhStyle");
  const color = el<HTMLSelectElement>("xhColor");
  const size = el<HTMLInputElement>("xhSize");
  const thick = el<HTMLInputElement>("xhThick");
  const gapIn = el<HTMLInputElement>("xhGap");
  const dot = el<HTMLSelectElement>("xhDot");
  const outline = el<HTMLSelectElement>("xhOutline");
  const dynamic = el<HTMLSelectElement>("xhDynamic");
  const opacity = el<HTMLInputElement>("xhOpacity");
  const preview = el<HTMLCanvasElement>("xhPreview");
  fill(style, RETICLE_STYLES);
  fill(color, RETICLE_COLORS);
  const show = () => {
    style.value = reticle.style;
    color.value = reticle.color;
    size.value = String(reticle.size);
    thick.value = String(reticle.thickness);
    gapIn.value = String(reticle.gap);
    dot.value = reticle.dot ? "1" : "0";
    outline.value = reticle.outline ? "1" : "0";
    dynamic.value = reticle.dynamic ? "1" : "0";
    opacity.value = String(reticle.opacity);
    const g = preview.getContext("2d");
    if (g) {
      g.clearRect(0, 0, preview.width, preview.height);
      drawReticle(g, preview.width / 2, preview.height / 2, 6, 1.4, 1, reticle);
    }
  };
  const read = () => {
    Object.assign(
      reticle,
      cleanReticle({
        style: style.value,
        color: color.value,
        size: Number(size.value),
        thickness: Number(thick.value),
        gap: Number(gapIn.value),
        dot: dot.value === "1",
        outline: outline.value === "1",
        dynamic: dynamic.value === "1",
        opacity: Number(opacity.value),
      })
    );
    saveReticle(reticle);
    show();
  };
  for (const c of [style, color, dot, outline, dynamic]) c.addEventListener("change", read);
  for (const c of [size, thick, gapIn, opacity]) c.addEventListener("change", read);
  el<HTMLButtonElement>("xhReset").addEventListener("click", () => {
    Object.assign(reticle, RETICLE_DEFAULT);
    saveReticle(reticle);
    show();
  });
  show();
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
/**
 * The weapon the derived readout describes. Before the loadout exists this is
 * the default slot-1 weapon; afterwards it is whatever is in hand, with its
 * attachments applied.
 */
let currentWeapon = () => resolveWeapon(LOADOUT_IDS[0], 0);
const overlay = $("overlay");
const inDpi = $<HTMLInputElement>("dpi");
const inSens = $<HTMLInputElement>("sens");
const inAds = $<HTMLInputElement>("ads");
const inFov = $<HTMLInputElement>("fov");
const derived = $("derived");
inDpi.value = String(settings.dpi);
inSens.value = String(settings.sens);
inAds.value = String(settings.ads);
inFov.value = String(settings.fovScale);

/**
 * The typed values, held to the same ranges loadSettings accepts. A sens of
 * -1 used to invert the mouse for the session and then silently reset to the
 * default on the next load; an empty or half-typed field keeps the last value.
 */
function readSettings(): void {
  const field = (el: HTMLInputElement, lo: number, hi: number, prev: number): number => {
    const n = Number(el.value);
    return el.value.trim() !== "" && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : prev;
  };
  settings.dpi = field(inDpi, 100, 32000, settings.dpi);
  settings.sens = field(inSens, 0.01, 20, settings.sens);
  settings.ads = field(inAds, 0.1, 3, settings.ads);
  settings.fovScale = field(inFov, 1, 1.571, settings.fovScale);
  settings.adsToggle = $<HTMLSelectElement>("adsMode").value === "toggle";
  settings.crouchToggle = $<HTMLSelectElement>("crouchMode").value === "toggle";
  for (const z of OPTIC_ZOOMS) settings.opticAds[z] = field($<HTMLInputElement>(`opticAds${z}`), 0.1, 3, settings.opticAds[z]);
  saveSettings(settings);
  refreshDerived();
}
function refreshDerived(): void {
  const hip = hipFov43(settings.fovScale);
  const cm = cmPer360(settings.sens, settings.dpi);
  // ADS figures follow the weapon actually in hand, with its attachments: a
  // 2x optic changes the ADS field of view by 30%, and reading the bare
  // iron-sight number here would be wrong exactly when someone checks it.
  const w = currentWeapon();
  const adsScale = adsSensScale(hip, w.zoomFov43 * settings.fovScale, settings.ads * opticAdsMult());
  derived.innerHTML =
    `<b>${cm.toFixed(2)} cm/360</b> hipfire (${degPerCount(settings.sens).toFixed(5)}° per count) · ` +
    `ADS ${(cm / adsScale).toFixed(2)} cm/360<br/>` +
    `FOV ${hip.toFixed(1)} (4:3 horizontal) · vertical ${verticalFovFrom43(hip).toFixed(1)}° · ADS ${(w.zoomFov43 * settings.fovScale).toFixed(1)}`;
}
// the hold / toggle choices and the per-optic multipliers: the Settings tab's rows
{
  $<HTMLSelectElement>("adsMode").value = settings.adsToggle ? "toggle" : "hold";
  $<HTMLSelectElement>("crouchMode").value = settings.crouchToggle ? "toggle" : "hold";
  const box = $("opticAdsBox");
  for (const z of OPTIC_ZOOMS) {
    const lab = document.createElement("label");
    lab.className = "opticAds";
    lab.innerHTML = `${z} <input id="opticAds${z}" type="number" min="0.1" max="3" step="0.05" value="${settings.opticAds[z]}" />`;
    box.appendChild(lab);
  }
  for (const id of ["adsMode", "crouchMode"]) $(id).addEventListener("change", readSettings);
  for (const z of OPTIC_ZOOMS) $(`opticAds${z}`).addEventListener("input", readSettings);
}
/** the optic in hand's zoom (set once the loadout exists: until then, 1x) */
let currentOpticZoom = (): OpticZoom => "1x";
/** the per-optic multiplier for the optic in hand (its current zoom, for a variable one) */
function opticAdsMult(): number {
  return settings.opticAds[currentOpticZoom()] ?? 1;
}
for (const el of [inDpi, inSens, inAds, inFov]) el.addEventListener("input", readSettings);
refreshDerived();

// ---------- DPI measurement ----------
// DPI lives in the mouse's onboard memory, not in any file, so it is measured.
const calibBody = $("calibBody");
const calibMsg = $("calibMsg");
const calibCm = $<HTMLInputElement>("calibCm");
const calibrator = new DpiCalibrator(document.body);
const CALIB_HELP = "Hold the left mouse button, drag the mouse exactly that far in a straight line, then release.";
let calibrating = false;

function resetCalibMsg(): void {
  calibMsg.className = "calibMsg";
  calibMsg.textContent = CALIB_HELP;
}
$("calibStart").addEventListener("click", () => {
  calibBody.hidden = !calibBody.hidden;
  if (!calibBody.hidden) resetCalibMsg();
});
$("calibGo").addEventListener("click", () => {
  const cm = Math.max(2, Number(calibCm.value) || 10);
  calibrating = true;
  calibMsg.className = "calibMsg live";
  calibMsg.textContent = "Waiting for the left button...";
  void calibrator.start(
    cm,
    (counts) => {
      calibMsg.className = "calibMsg live";
      calibMsg.textContent = `${counts} counts...`;
    },
    (r) => {
      calibrating = false;
      const snapped = snapDpi(r.dpi);
      inDpi.value = String(snapped);
      readSettings();
      calibMsg.className = "calibMsg good";
      calibMsg.textContent =
        `${r.counts} counts over ${r.inches.toFixed(2)} in = ${r.dpi} DPI` +
        (snapped !== r.dpi ? `, snapped to ${snapped}.` : ".") +
        " Repeat a couple of times; if it keeps landing on the same number, that is your DPI.";
    },
    (f) => {
      // Always clear the flag, or Play stays disabled with no visible reason.
      calibrating = false;
      calibMsg.className = "calibMsg";
      if (f.reason === "too-short") {
        calibMsg.textContent = `Only ${f.counts} counts, too short to measure. Hold the left button and drag the full distance in one go, then release.`;
      } else if (f.reason === "no-pointer-lock") {
        calibMsg.textContent = "The browser would not lock the pointer, so the counts would include mouse acceleration. Click inside the page and try again.";
      } else {
        calibMsg.textContent = `Measurement cancelled. ${CALIB_HELP}`;
      }
    }
  );
});
$("calibCancel").addEventListener("click", () => {
  calibrating = false;
  calibrator.cancel();
  resetCalibMsg();
});

// ---------- loadouts ----------
// Five defaults and five custom slots (src/game/loadouts.ts); the last one
// used is remembered and is what you play with, 1v1 included.
const loadouts = new Loadouts();

// ---------- three ----------
const app = $("app");
const quality = loadQuality();
// The WebGL context is made here rather than by three, because three does not
// pass `desynchronized` through. A desynchronized canvas is the browser's
// low-latency path: frames reach the screen without waiting on the page
// compositor, the same trade as turning v-sync off in a game.
const glCanvas = document.createElement("canvas");
const gl = glCanvas.getContext("webgl2", {
  antialias: true,
  alpha: false,
  depth: true,
  stencil: false,
  powerPreference: "high-performance",
  desynchronized: quality.lowLatency,
  preserveDrawingBuffer: false,
}) as WebGL2RenderingContext | null;
if (!gl) {
  // Without WebGL 2 three throws right here, the rest of this file never runs,
  // and the menu sits on screen with buttons that do nothing. Say why instead.
  const box = document.createElement("div");
  box.style.cssText =
    "position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;padding:24px;background:#0b0d10;color:#e6e6e6;font:16px/1.6 'Segoe UI',system-ui,sans-serif;text-align:center";
  box.innerHTML =
    "<div style='max-width:560px'><h2 style='margin:0 0 12px;color:#ffd23c'>This browser could not start 3D graphics</h2>" +
    "The game needs WebGL 2. Use <b>Chrome or Edge on a PC</b>, make sure hardware acceleration is on " +
    "(Settings, System, &ldquo;Use graphics acceleration when available&rdquo;), update the graphics driver, then reload. " +
    "Phones, tablets and Safari are not supported.</div>";
  document.body.appendChild(box);
  throw new Error("WebGL 2 is not available");
}
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, context: gl, antialias: true, powerPreference: "high-performance" });
// The counters are reset once a frame by hand, not on every render call: with
// post-processing a frame is several passes, and the automatic reset left
// only the last pass counted (the benchmark reported a bloom pass as a frame).
renderer.info.autoReset = false;
/** the whole of the last frame drawn: every pass, the shadow map's included */
let frameCost = { calls: 0, triangles: 0 };
renderer.setPixelRatio(Math.min(quality.maxPixelRatio, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = quality.shadows !== "off";
renderer.shadowMap.type = quality.preset === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
// A static shadow map is drawn once and again only when asked. The range
// barely moves, so this removes a 2048-4096 depth render from every frame.
renderer.shadowMap.autoUpdate = quality.shadows === "live";
// where the shadow map is drawn once, figures get a contact shadow instead (dummy.ts)
Dummy.contactShadows = quality.shadows !== "live";
renderer.shadowMap.needsUpdate = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
// filmic tonemapping instead of raw linear output: without it the textured
// materials clip to white in sunlight and read as flat grey in shadow
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// The environment is now at 0.38 and the sun carries the exposure, so this can
// come back up: at 0.85 with a dimmed environment the whole frame sat in a
// narrow grey band, which was most of the "flat" complaint.
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
/** the fog of each part of the world, before the preset's draw distance shortens it (quality.ts drawRange) */
const RANGE_FOG = { near: 55, far: 290 };
const BR_FOG = { near: 140, far: 680 };
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.02, drawRange(RANGE_FOG, quality).camFar);
scene.add(camera);
// the gun's own camera, at the world camera's place, drawn after it at its own FOV (render.ts)
const vmCamera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.02, 20);
vmCamera.layers.set(VM_LAYER);
camera.add(vmCamera);
const beforeRange = new Set(scene.children);
buildRange(scene, { pointLights: quality.pointLights, shadowSize: quality.shadowSize });
// the 1v1 arena, east of the range, and the 1v1v1 triangle north of it (src/game/arena.ts)
const arena = buildArena(scene);
const triArena = buildTriArena(scene);
// the battle royale map, 500 m south (src/game/br.ts)
const brMap = buildBrMap(scene);
// a door opening or shutting, heard where it hangs (whoever did it)
brMap.doors.onChange = (d, what) => audio.door(d.centre, what === "break" || what === "kick" ? "kick" : what);
/**
 * The sun's shadow map and the fog follow the part of the world you are in:
 * the range (tight, sharp shadows) or the open BR map (wide and far).
 */
function setRegion(region: "range" | "br"): void {
  const fog = scene.fog as THREE.Fog | null;
  audio.setSpace(region === "br" ? "outdoor" : "indoor");
  // the region's own fog, shortened to what the preset draws; the far plane
  // sits beyond the fog's end, so nothing is ever cut off in clear air
  const want = drawRange(region === "br" ? BR_FOG : RANGE_FOG, quality);
  if (region === "br") setShadowRegion(BR_CENTER, 230);
  else setShadowRegion(new THREE.Vector3(-10, 0, 12), 135);
  if (fog) {
    fog.near = want.near;
    fog.far = want.far;
  }
  if (camera.far !== want.camFar) {
    camera.far = want.camFar;
    camera.updateProjectionMatrix();
  }
  renderer.shadowMap.needsUpdate = true;
}
// exactly what the range built, for the static merge below (not the dummies
// and targets added later, which move)
// (not the battle royale map, built between: it was in this list, so the merge
// took every one of its meshes twice and the whole map was drawn double)
const rangeRoots = scene.children.filter((o) => !beforeRange.has(o) && o !== arena.root && o !== triArena.root && o !== brMap.root);
// The sky doubles as the environment map. Without it every metal surface is
// black, so this is load-bearing rather than decoration.
//
// Which sky is the owner's setting (src/config/sky.json, seven hours). It is
// applied before the first frame so the menu's background is already the
// right hour, and applying it is four shader colours, the sun and the fog:
// nothing is rebuilt, so changing it mid-game costs a frame.
let hour = loadHour();
function applyHour(h: Hour): void {
  hour = h;
  setHour(h, scene);
  renderer.shadowMap.needsUpdate = true;
  void installSky(scene, renderer, h.hdr);
}
applyHour(hour);
// A GPU reset (a driver update, a sleeping laptop, another tab crashing the
// GPU) loses the context. three brings the context back by itself, but a
// static shadow map comes back empty (the whole sunlit range in shadow) and
// the sky's environment map comes back black, so both are redrawn.
glCanvas.addEventListener("webglcontextlost", () => hud.notice("GRAPHICS RESET: RECOVERING", gameTime, 4));
glCanvas.addEventListener("webglcontextrestored", () => {
  renderer.shadowMap.needsUpdate = true;
  void installSky(scene, renderer, hour.hdr);
});
// Post-processing. Ambient occlusion is what stops a scene made of boxes
// reading as flat shapes floating on a flat floor.
const pipeline = new Renderer(renderer, scene, camera, quality, vmCamera);

// ---------- graphics preset and the frame-rate explanation ----------
const qualitySel = $<HTMLSelectElement>("quality");
const PRESET_LABEL: Record<Preset, string> = {
  competitive: "Competitive: fastest, lowest latency",
  balanced: "Balanced: bloom and colour grade",
  high: "High: everything, including ambient occlusion",
};
for (const key of Object.keys(PRESETS) as Preset[]) {
  const o = document.createElement("option");
  o.value = key;
  o.textContent = PRESET_LABEL[key];
  qualitySel.appendChild(o);
}
qualitySel.value = quality.preset;
// The renderer's antialiasing and canvas mode are fixed when the WebGL context
// is created, so a preset change applies by reloading. Settings persist.
qualitySel.addEventListener("change", () => {
  saveQuality(qualitySel.value as Preset);
  location.reload();
});
// Time of day. Unlike the graphics preset this needs no reload: the dome is
// one shader with four colour uniforms, the sun is one light, and the
// environment map is reloaded in the background.
const skySel = $<HTMLSelectElement>("skyHour");
for (const id of HOUR_IDS) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = HOURS[id].label;
  skySel.appendChild(o);
}
skySel.value = hour.id;
skySel.addEventListener("change", () => {
  saveHour(skySel.value);
  applyHour(hourFor(skySel.value));
});
// A battle royale plays at its own hour, drawn from the match seed, unless
// the owner keeps theirs. Changing it mid-match applies at once.
const skyBrSel = $<HTMLSelectElement>("skyBr");
skyBrSel.value = loadBrSky();
skyBrSel.addEventListener("change", () => {
  saveBrSky(skyBrSel.value === "mine" ? "mine" : "match");
  if (duel instanceof BrMatch) brHour(duel);
});
/** the sky a battle royale is played under: the match's hour, or the owner's own */
function brHour(d: BrMatch): void {
  applyHour(loadBrSky() === "match" ? matchHour(d.seed) : loadHour());
}
const perfLine = $("perfLine");
void measureRefresh().then((hz) => {
  const r = Math.round(hz);
  perfLine.innerHTML =
    `Your display runs at <b>${r} Hz</b>, so the browser caps the game at <b>${r} fps</b> ` +
    `(${(1000 / hz).toFixed(1)} ms a frame). Hover the <b>i</b> for how to go higher.`;
  $("perfHz").textContent = String(r);
});
// the shortcut opens whatever address this page is on (localhost or the site)
$("flagsTarget").textContent = `"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --user-data-dir="C:\\ChromeUncapped" --disable-frame-rate-limit --disable-gpu-vsync ${location.origin}${location.pathname}`;
// the shortcut target in the guide, one click to copy
$("copyFlags").addEventListener("click", () => {
  const text = $("flagsTarget").textContent ?? "";
  void navigator.clipboard?.writeText(text).then(() => ($("copyFlags").textContent = "Copied"));
});
// CC0 props arrive asynchronously; their colliders are already in place. A
// static shadow map has to be redrawn once they are in, or they cast nothing.
void placeProps(scene, PROP_PLACEMENTS).then(() => {
  renderer.shadowMap.needsUpdate = true;
});

// The battle royale's field, as rock rather than boxes: its rocks, its dead
// scrub and the faces of the cliff that walls it in, each kind drawn as one
// instanced mesh per mesh of its model. The colliders are the map's own boxes,
// so movement is the same whether or not these arrive; the boxed shapes it
// drew stay until they do (a checkout without `npm run models` looks as it
// did). The scrub and the faces carry no collider at all: they are to look at.
// how far each kind is drawn, the tuned distance scaled by the preset's draw
// distance (quality.ts sceneryFar): the preset that sees further sees more
const far = (base: number): number => sceneryFar(base, quality);
void placeInstanced(brMap.root, [
  { prop: "namaqualand_boulder_04", at: brMap.scenery.rocks.filter((_, i) => i % 3 === 0), standIn: brMap.scenery.boxed.filter((_, i) => i % 3 === 0), far: far(170) },
  { prop: "namaqualand_boulder_06", at: brMap.scenery.rocks.filter((_, i) => i % 3 === 1), standIn: brMap.scenery.boxed.filter((_, i) => i % 3 === 1), far: far(170) },
  { prop: "namaqualand_boulders_01", at: brMap.scenery.rocks.filter((_, i) => i % 3 === 2), standIn: brMap.scenery.boxed.filter((_, i) => i % 3 === 2), far: far(170) },
  { prop: "dead_quiver_trunk", at: brMap.scenery.scrub.filter((s) => s.kind === "trunk"), shadows: false, far: far(150) },
  { prop: "dead_quiver_branch_02", at: brMap.scenery.scrub.filter((s) => s.kind === "branch"), shadows: false, far: far(150) },
  { prop: "dry_branches_medium_01", at: brMap.scenery.scrub.filter((s) => s.kind === "twigs"), shadows: false, far: far(150) },
  { prop: "rock_face_02", at: brMap.scenery.cliffs, shadows: false, far: far(260) },
]).then((drawn) => {
  // every boulder kind in: the boxed rocks give way to them, and come back
  // beyond the distance a scan is worth drawing (props.ts stepInstanced)
  if (["namaqualand_boulder_04", "namaqualand_boulder_06", "namaqualand_boulders_01"].every((n) => drawn.includes(n as never))) for (const m of brMap.scenery.boxed) m.visible = false;
  renderer.shadowMap.needsUpdate = true;
});

// Static dummies down the lanes, plus one on each moving rail. Distances are
// true because the player spawns on the firing line at z = 0.
const dummies: Dummy[] = [
  new Dummy(-12, -15, 15),
  new Dummy(-4, -25, 25),
  new Dummy(4, -30, 30),
  new Dummy(12, -45, 45),
  new Dummy(-20, -55, 55),
  new Dummy(0, -70, 70),
  new Dummy(18, -85, 85),
  new Dummy(-24, -40, 46), // on the left platform; height is set below
];
dummies[dummies.length - 1].group.position.y = 4.6;
for (const rail of TARGET_RAILS) {
  const d = new Dummy((rail.minX + rail.maxX) / 2, rail.z, Math.abs(rail.z));
  d.rail = rail;
  dummies.push(d);
}
for (const d of dummies) scene.add(d.group);

const viewModel = new ViewModel();
vmCamera.add(viewModel.group);
/**
 * Everything of the gun on the gun's layer, every frame (a new gun or optic
 * brings new meshes); a light on it (the flash) lights the world as well.
 */
function gunLayer(): void {
  viewModel.group.traverse((o) => {
    if ((o as THREE.Light).isLight) o.layers.enable(VM_LAYER);
    else o.layers.set(VM_LAYER);
  });
}
/**
 * The world's lights light the gun too: every light in the scene on its
 * layer as well. Walked again only when the scene's top level changes (a map
 * or a match adding its own), not every frame: the walk is the whole world.
 */
let lightsLayeredFor = -1;
function lightsOnGun(): void {
  if (scene.children.length === lightsLayeredFor) return;
  lightsLayeredFor = scene.children.length;
  scene.traverse((o) => {
    if ((o as THREE.Light).isLight) o.layers.enable(VM_LAYER);
  });
}
/**
 * A point on the gun, where it shows in the world's picture. The gun is
 * drawn at its own FOV, so its muzzle is on screen somewhere its world
 * position is not; the tracer leaves the muzzle you see, at the same depth.
 */
function onScreenAsWorld(p: THREE.Vector3 | null): THREE.Vector3 | null {
  if (!p) return null;
  camera.updateMatrixWorld();
  const v = p.clone().applyMatrix4(camera.matrixWorld.clone().invert());
  const k = Math.tan((camera.fov * Math.PI) / 360) / Math.tan((vmCamera.fov * Math.PI) / 360);
  v.x *= k;
  v.y *= k;
  return v.applyMatrix4(camera.matrixWorld);
}
// last frame's view angles, so the gun can lag behind how fast you turn
let prevYaw = 0;
let prevPitch = 0;
// holster state machine: out -> lowering -> away -> raising -> out
let holster: "out" | "lowering" | "away" | "raising" = "out";
let holsterAt = 0;
/**
 * Screenshot overrides, set by tools/shot.ts through window.__range. They only
 * change what the viewmodel DRAWS, never the simulation, so a stray value can
 * not affect aim, damage or movement.
 */
const debugView: {
  weapon: string | null;
  ads: number | null;
  reload: number | null;
  optic: string | null;
  lowered: number | null;
  onZip: boolean | null;
  heirloom: string | null;
  /** the down view's hands, for a screenshot (tools/snap.ts) */
  downed: boolean | null;
  /** hold an inspect at a point in its run, 0..1, for a screenshot (tools/snap.ts) */
  inspect: number | null;
} = {
  weapon: null,
  ads: null,
  inspect: null,
  reload: null,
  optic: null,
  lowered: null,
  onZip: null,
  heirloom: null,
  downed: null,
};
const debugWeapons = new Map<string, ReturnType<typeof resolveWeapon>>();

const input = new Input(renderer.domElement);
// the player's own keys (the Controls tab) on top of binds.json
applySavedBinds();
initBindsUi($("bindTable"), $("bindsNote"));
const player = new Player(RANGE_BOUNDS);
/** your name and every result, in this browser (src/game/stats.ts) */
const profile = new Stats();
// Spawn ON the firing line (z = 0) so the lane labels are the true distance
// to each dummy. Spawning behind it made every label read 3 m short.
player.pos.set(0, 0, 0);
player.sprintMode = playerCfg.sprintMode === "hold" ? "hold" : "toggle";
// Sprint: toggle (press once, Apex's default) or hold. Chosen on the start
// screen and remembered.
const LS_SPRINT = "range.sprintMode";
try {
  const sm = localStorage.getItem(LS_SPRINT);
  if (sm === "hold" || sm === "toggle") player.sprintMode = sm;
} catch {
  /* ignore */
}
const sprintSel = $<HTMLSelectElement>("sprintMode");
sprintSel.value = player.sprintMode;
sprintSel.addEventListener("change", () => {
  player.sprintMode = sprintSel.value === "hold" ? "hold" : "toggle";
  try {
    localStorage.setItem(LS_SPRINT, player.sprintMode);
  } catch {
    /* ignore */
  }
});
// The mantle boost, Apex's own setting: with it on, holding jump through the
// end of a mantle superglides for you. Off by default here, because the window
// is what the trainer and the crosshair cue exist to teach.
const LS_MANTLE_BOOST = "range.mantleBoost";
try {
  player.mantleBoost = localStorage.getItem(LS_MANTLE_BOOST) === "on";
} catch {
  /* ignore */
}
const mantleBoostSel = $<HTMLSelectElement>("mantleBoost");
mantleBoostSel.value = player.mantleBoost ? "on" : "off";
mantleBoostSel.addEventListener("change", () => {
  player.mantleBoost = mantleBoostSel.value === "on";
  try {
    localStorage.setItem(LS_MANTLE_BOOST, player.mantleBoost ? "on" : "off");
  } catch {
    /* ignore */
  }
});
// Fullscreen while playing, on by default: it is what lets Ctrl-crouch plus W
// reach the game instead of closing the tab (Input.lock).
const LS_FULLSCREEN = "range.fullscreen";
try {
  input.fullscreen = localStorage.getItem(LS_FULLSCREEN) !== "0";
} catch {
  /* ignore */
}
const fullscreenSel = $<HTMLSelectElement>("fullscreen");
fullscreenSel.value = input.fullscreen ? "1" : "0";
fullscreenSel.addEventListener("change", () => {
  input.fullscreen = fullscreenSel.value === "1";
  try {
    localStorage.setItem(LS_FULLSCREEN, fullscreenSel.value);
  } catch {
    /* ignore */
  }
});
// Sprint view shake (the game's setting): Normal is its default
const SPRINT_SHAKE = { normal: 1, minimal: 0.4, off: 0 } as const;
type ShakeMode = keyof typeof SPRINT_SHAKE;
let sprintShakeMode: ShakeMode = "normal";
let sprintShake = 0;
let strideT = 0;
let sprintRoll = 0;
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);
/** the camera's own up and right, for the lurch kick and the boost's pull (src/config/player.json `feel`) */
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const RIGHT_AXIS = new THREE.Vector3(1, 0, 0);
const LS_SHAKE = "range.sprintShake";
try {
  const sm = localStorage.getItem(LS_SHAKE);
  if (sm === "normal" || sm === "minimal" || sm === "off") sprintShakeMode = sm;
} catch {
  /* ignore */
}
const shakeSel = $<HTMLSelectElement>("sprintShake");
shakeSel.value = sprintShakeMode;
shakeSel.addEventListener("change", () => {
  const v = shakeSel.value;
  sprintShakeMode = v === "minimal" || v === "off" ? v : "normal";
  try {
    localStorage.setItem(LS_SHAKE, sprintShakeMode);
  } catch {
    /* ignore */
  }
});
// The camera: first person, or third person behind the shoulder (X, or the
// Settings tab). Holding the orbit key turns the camera round your figure to
// see the skin; letting go eases it back behind you.
const LS_CAMERA = "range.camera";
let thirdPerson = false;
try {
  thirdPerson = localStorage.getItem(LS_CAMERA) === "third";
} catch {
  /* ignore */
}
const cameraSel = $<HTMLSelectElement>("cameraMode");
cameraSel.value = thirdPerson ? "third" : "first";
function setThirdPerson(on: boolean): void {
  thirdPerson = on;
  cameraSel.value = on ? "third" : "first";
  try {
    localStorage.setItem(LS_CAMERA, on ? "third" : "first");
  } catch {
    /* ignore */
  }
}
cameraSel.addEventListener("change", () => setThirdPerson(cameraSel.value === "third"));
let orbitYaw = 0;
let orbitPitch = 0;
let orbiting = false;
/** the tests hold the orbit without a key */
let debugOrbitHold = false;
/** the slide's lean and the paint boost's pull, eased frame to frame (src/config/player.json `feel`) */
let slideLean = 0;
/** the lean while steering in the air (player.json feel.airRoll) */
let airLean = 0;
let boostFeel = 0;
/** which way a slide is carrying you, to the right of where you are looking, -1 to 1 */
function slideLeanSide(): number {
  const yawR = player.yaw * DEG;
  const fx = -Math.sin(yawR);
  const fz = -Math.cos(yawR);
  const side = player.vel.x * -fz + player.vel.z * fx;
  return side / 6;
}
/** the ears' facing, each frame */
const earFwd = new THREE.Vector3();
const earUp = new THREE.Vector3();
/** the third-person aim: where the crosshair is, from the eye (in first person, the view itself) */
let aimYaw = 0;
let aimPitch = 0;
const audio = new GameAudio();
// How much of the world stands between the ear and a sound. Three lines
// rather than one, spread across the source, so a figure half behind a pillar
// is half blocked instead of all or nothing, which is what a single ray gives
// and what makes occlusion pop on and off as someone walks.
//
// It lives here rather than in audio.ts because that module knows about gain
// and filters and should not know about collision boxes. solidHit is the same
// test the bullets use, so what you cannot shoot through is what you cannot
// hear clearly through, which is the rule a player can actually learn.
{
  const from = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const side = new THREE.Vector3();
// every sound worth writing down, written down (src/game/captions.ts): the
// wording and the direction are the captions', the sound is the mixer's
audio.onCue = (id, at, fwd, ear) => {
  if (!at) {
    captions.heard(id, gameTime, "", "");
    return;
  }
  const dx = at.x - ear.x;
  const dz = at.z - ear.z;
  captions.heard(id, gameTime, whereFrom(dx, dz, fwd.x, fwd.z), howFar(Math.hypot(dx, dz)));
};
  audio.setOccluder((ear, at) => {
    from.set(ear.x, ear.y, ear.z);
    dir.set(at.x - ear.x, at.y - ear.y, at.z - ear.z);
    const len = dir.length();
    if (len < 0.5) return 0;
    dir.divideScalar(len);
    // a horizontal offset, so the extra rays straddle the source
    side.set(-dir.z, 0, dir.x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    else side.normalize();
    const spread = AUDIO_CFG.occlusion.spread;
    let blocked = 0;
    for (let i = 0; i < AUDIO_CFG.occlusion.rays; i++) {
      const off = i === 0 ? 0 : i === 1 ? spread : -spread;
      const tx = at.x + side.x * off;
      const tz = at.z + side.z * off;
      dir.set(tx - ear.x, at.y - ear.y, tz - ear.z);
      const l = dir.length();
      dir.divideScalar(l);
      if (solidHit(from, dir, l) < l) blocked++;
    }
    return blocked / AUDIO_CFG.occlusion.rays;
  });
}
/** when each sound goes with the frame: footsteps, loops, the clock's beeps (soundscape.ts) */
const sounds = new Soundscape(audio);
/** the last gunshot heard from each shooter: a shotgun's pellets are one sound */
const lastShotSound = new Map<number, number>();
const SHIELD_TIER: Record<number, HitTier> = { 1: "white", 2: "blue", 3: "purple", 4: "red" };
const hud = new Hud($<HTMLCanvasElement>("hud"));
/** JOLT and TRIAGE (abilities.ts): the pick, the cooldown; the match (or the range) switches them on */
const abilities = new Abilities();
abilities.enabled = true; // the range lets you practise either
/** short-lived world effects: JOLT streaks (fx.ts) */
const fx = new FxLayer(scene);
// everyone's sprays on the walls (sprays.ts)
const sprays = new SprayLayer(scene);
let sprayReadyAt = 0;
const sprayPick = $<HTMLSelectElement>("sprayPick");
SPRAYS.list.forEach((sp, i) => {
  const o = document.createElement("option");
  o.value = String(i);
  o.textContent = sp.name;
  sprayPick.appendChild(o);
});
try {
  sprayPick.value = localStorage.getItem("range.spray") ?? "0";
} catch {
  /* ignore */
}
sprayPick.addEventListener("change", () => {
  try {
    localStorage.setItem("range.spray", sprayPick.value);
  } catch {
    /* kept for this visit */
  }
});
// Your banner card: three picks, kept; sent to the match every few seconds so
// a friend who arrives late has it; everyone else's kept as it arrives.
const bannerSel = {
  icon: $<HTMLSelectElement>("bannerIcon"),
  frame: $<HTMLSelectElement>("bannerFrame"),
  title: $<HTMLSelectElement>("bannerTitle"),
};
const fillSel = (sel: HTMLSelectElement, names: string[]) =>
  names.forEach((n, i) => {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = n;
    sel.appendChild(o);
  });
fillSel(bannerSel.icon, BANNER_ICONS);
fillSel(bannerSel.frame, BANNERS.frames.map((_, i) => `Frame ${i + 1}`));
fillSel(bannerSel.title, BANNERS.titles.map((t) => t.charAt(0) + t.slice(1).toLowerCase()));
try {
  const saved = JSON.parse(localStorage.getItem("range.banner") ?? "null") as number[] | null;
  if (saved) [bannerSel.icon.value, bannerSel.frame.value, bannerSel.title.value] = saved.map(String);
} catch {
  /* ignore */
}
for (const sel of Object.values(bannerSel))
  sel.addEventListener("change", () => {
    try {
      localStorage.setItem("range.banner", JSON.stringify([bannerSel.icon.value, bannerSel.frame.value, bannerSel.title.value].map(Number)));
    } catch {
      /* kept for this visit */
    }
  });
const myBanner = (): number => bannerCode(Number(bannerSel.icon.value), Number(bannerSel.frame.value), Number(bannerSel.title.value));
/** the card of a killer who never sent one (a bot, or a friend on an older build): fixed by the id, so the same one always shows the same */
const botBanner = (id: number): number => bannerCode(id % 8, (id * 3) % 8, (id * 5) % 8);
/** the others' cards, by player id */
const remoteBanners = new Map<number, number>();
let bannerSentAt = -Infinity;
/** the finish of the gun in hand as last told to the match, and when */
let finishSent = "";
let finishSentAt = -Infinity;
/** each player's finish (an index into FINISHES), as their page said */
const remoteFinishes = new Map<number, number>();

/**
 * Your spray on the wall you look at, within reach, for everyone in the
 * match: found with the level's own ray test (the face it hits is the wall's
 * facing), and sent as one effect.
 */
function doSpray(now: number): boolean {
  if (now < sprayReadyAt) return false;
  const eye = player.eyePosition();
  // the way you face, from your own angles (the camera is a frame behind a turn)
  const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.orientationAt(player.yaw, player.pitch, 0, 0));
  const t = solidHit(eye, dir, SPRAYS.range);
  if (!Number.isFinite(t) || t > SPRAYS.range) {
    hud.notice("NOTHING TO SPRAY ON", now, 0.8);
    return false;
  }
  const at = eye.clone().addScaledVector(dir, t);
  const normal = lastSolidNormal.clone();
  const idx = Math.max(0, Math.min(SPRAYS.list.length - 1, Number(sprayPick.value) || 0));
  sprays.place(duel?.id ?? 0, at, normal, idx, now);
  duel?.localFx("spray", at, normal, idx);
  audio.spray(at);
  sprayReadyAt = now + SPRAYS.cooldown;
  return true;
}
// bullet holes and dust where rounds hit the level, anyone's (impacts.ts)
const impacts = new ImpactLayer(scene);
/** a round into the level: marked, and heard close by (the ground in the battle royale is dirt) */
function markImpact(at: THREE.Vector3, normal: THREE.Vector3): void {
  impacts.add(at, normal, gameTime);
  if (at.distanceTo(player.pos) > IMPACTS.hearing) return;
  const ground = normal.y > 0.9 && at.y < 0.6;
  audio.impact(ground && at.z > 280 ? "dirt" : "concrete", at);
}
/**
 * ?norender: run the simulation and the network without drawing. Only for the
 * end-to-end test, which runs two pages at once on a software renderer.
 */
const NO_RENDER = new URLSearchParams(location.search).has("norender");
hud.enabled = !NO_RENDER;
// the tech feed: what the movement code registered, as it happens; the log is
// for the tools (tools/tech-probe.ts drives a wallbounce in the real page)
const techLog: Array<{ name: string; detail: string; good: boolean; at: number }> = [];
player.onTech = (name, detail, good) => {
  trainer?.onTech(name, detail);
  if (good) tour?.onTech(name);
  hud.tech(name, detail, good, gameTime);
  techLog.push({ name, detail, good, at: gameTime });
  if (techLog.length > 200) techLog.shift();
  profile.recordTech(name, good);
};
/** a scripted controller in place of the keyboard, for the tools */
let scriptInput: MoveInput | null = null;
/** called at the start of every frame, for the tools */
let frameHook: ((now: number, dt: number) => void) | null = null;
// Shootable target banks: emissive boards that read out the damage, and
// near flippers that fold when hit.
const targets: Target[] = TARGET_SPECS.map((t) => {
  const tg = new Target(t.kind, t.x, t.y, t.z, t.scale);
  if (t.rail) tg.rail = t.rail;
  scene.add(tg.group);
  return tg;
});
// The two movement courses behind the firing line (src/game/course.ts, the
// layouts in src/game/courses/). Their armed pop-ups are dummies too, so
// bullets test against them as well.
const courses = [new Course(scene, BASIC_COURSE), new Course(scene, ADVANCED_COURSE)];
const [courseBasic, courseAdvanced] = courses;
/** the course a run is going on, or the one you are standing in, or the basic one */
const activeCourse = (): Course => courses.find((c) => c.running) ?? courses.find((c) => c.hud(gameTime)) ?? courseBasic;
const courseEnemies = courses.flatMap((c) => c.enemies);
/** every figure outside a match: the range's dummies and the courses' pop-ups (hidden ones are skipped where it matters) */
const rangeTargets: Dummy[] = [...dummies, ...courseEnemies];
// a copy: the projectile system adds and removes match figures in its own list
const projectiles = new ProjectileSystem(scene, [...rangeTargets], targets, 0);
const aimAssist = new AimAssist();
projectiles.listener = camera.position;
projectiles.onWhiz = (p) => audio.whiz(p);
projectiles.onVisualImpact = (at, normal) => markImpact(at, normal);

// ---------- the range's tooling (rangetools.ts, trainer.ts) ----------
const dummyBehaviour = new DummyBehaviour(dummies);
const rangeCombat = new RangeCombat();
const combatWeapon = resolveWeapon(rangeToolsCfg.combat.weapon, 2);
rangeCombat.onHurt = (amount) => {
  hud.hurt(gameTime);
  audio.hurt(rangeCombat.shield > 0);
  void amount;
};
rangeCombat.onDown = () => hud.notice("DOWN: BACK UP IN 2 S", gameTime, 2);
rangeCombat.onUp = () => {
  kit.fill("kit");
  hud.notice("BACK UP", gameTime, 1);
};
const sprayWall = new SprayWall(scene);
// the README screen under the "B00G'S RANGE" sign at the far end: its pages
// turn when you shoot the arrows beside it (src/game/readmetv.ts)
const readmeTv = new ReadmeTv(scene);
readmeTv.onPress = (action, at) => {
  audio.ui("click");
  hud.notice(action === "jump" ? readmeTv.state().title.toUpperCase() : `${readmeTv.state().title.toUpperCase()}  ·  PAGE ${readmeTv.page + 1}/${readmeTv.pageCount}`, gameTime, 2);
  void at;
};
projectiles.addShootable(readmeTv);
const drill = new FlickDrill(scene, projectiles);
drill.onFinish = (time, acc) => {
  const rank = time < 22 ? "S" : time < 28 ? "A" : time < 36 ? "B" : "C";
  hud.notice(`FLICK DRILL ${time.toFixed(2)} S  ·  ${Math.round(acc * 100)}%  ·  ${rank}`, gameTime, 4);
  audio.stinger(time <= (drill.best ?? Infinity) + 1e-6 ? "won" : "lost");
  profile.recordRun("drill", time, rank);
  profile.flush();
  void submitScore("course:drill", profile.profile.name, Number(time.toFixed(3))).then((r) => {
    if (r !== null) hud.notice(`#${r} ON THE ONLINE BOARD`, gameTime, 3);
  });
};
const trainer = new SuperglideTrainer();
/** this session's shots and hits per gun (the Stats tab) */
const gunSession = new Map<string, { shots: number; hits: number; heads: number; damage: number }>();
const gunRow = (id: string) => {
  let r = gunSession.get(id);
  if (!r) gunSession.set(id, (r = { shots: 0, hits: 0, heads: 0, damage: 0 }));
  return r;
};
/** I: the next dummy behaviour (set up with the Range box below) */
let cycleDummyMode: () => string = () => "";
// the Range box on the Play tab, remembered
{
  const modeSel = $<HTMLSelectElement>("dummyMode");
  const speedSel = $<HTMLSelectElement>("dummySpeed");
  const shootSel = $<HTMLSelectElement>("dummyShoot");
  try {
    const v = JSON.parse(localStorage.getItem("range.dummies") ?? "{}") as { mode?: string; speed?: string; shoot?: string };
    if (v.mode && DUMMY_MODES.includes(v.mode as DummyMode)) modeSel.value = v.mode;
    if (v.speed && [...speedSel.options].some((o) => o.value === v.speed)) speedSel.value = v.speed;
    if (v.shoot && [...shootSel.options].some((o) => o.value === v.shoot)) shootSel.value = v.shoot;
  } catch {
    /* ignore */
  }
  const apply = () => {
    dummyBehaviour.mode = modeSel.value as DummyMode;
    dummyBehaviour.speed = Number(speedSel.value) || 1;
    rangeCombat.level = (shootSel.value === "easy" || shootSel.value === "normal" || shootSel.value === "hard" ? shootSel.value : "off") as RangeCombat["level"];
    rangeCombat.refill();
    try {
      localStorage.setItem("range.dummies", JSON.stringify({ mode: modeSel.value, speed: speedSel.value, shoot: shootSel.value }));
    } catch {
      /* ignore */
    }
  };
  for (const s of [modeSel, speedSel, shootSel]) s.addEventListener("change", apply);
  apply();
  // I in the range cycles the dummies' behaviour; the select follows
  cycleDummyMode = () => {
    const i = DUMMY_MODES.indexOf(dummyBehaviour.mode);
    modeSel.value = DUMMY_MODES[(i + 1) % DUMMY_MODES.length];
    apply();
    return DUMMY_MODE_NAME[dummyBehaviour.mode];
  };
}
/** the last 8 s of every match, the replay of your elimination, and the damage log for the recap */
const recorder = new Recorder();
const killcam = new Killcam(scene, projectiles);
const dlog = new DamageLog();
/** the recap of your last elimination, shown after the killcam until you close it or play on */
let recap: Recap | null = null;
let recapShownAt = 0;
const realNow = (): number => performance.now() / 1000;
// the three volumes (Settings), remembered by the audio itself
{
  const vol = [
    ["volMaster", "master"],
    ["volFx", "effects"],
    ["volHits", "hits"],
  ] as const;
  for (const [id, key] of vol) {
    const el = $<HTMLInputElement>(id);
    el.value = String(Math.round(audio.volumes[key] * 100));
    el.addEventListener("input", () => audio.setVolumes({ [key]: Math.max(0, Math.min(1, Number(el.value) / 100)) }));
  }
}
// the range's ammo: endless (the default), or counted like a match (Settings)
const rangeAmmoSel = $<HTMLSelectElement>("rangeAmmo");
let rangeAmmoCounted = false;
try {
  rangeAmmoCounted = localStorage.getItem("range.ammo") === "counted";
} catch {
  /* ignore */
}
rangeAmmoSel.value = rangeAmmoCounted ? "counted" : "endless";
rangeAmmoSel.addEventListener("change", () => {
  rangeAmmoCounted = rangeAmmoSel.value === "counted";
  try {
    localStorage.setItem("range.ammo", rangeAmmoSel.value);
  } catch {
    /* ignore */
  }
  if (!duel) {
    loadout.ammo.infinite = !rangeAmmoCounted;
    if (rangeAmmoCounted) {
      loadout.ammo.kit(loadout.slots.map((sl) => sl.weapon));
      loadout.refillEnergy();
    }
  }
});
// the mantle boost cue: a ring on the crosshair while a superglide's window is open (Settings)
const mantleCueSel = $<HTMLSelectElement>("mantleCue");
let mantleCueOn = true;
try {
  mantleCueOn = localStorage.getItem("range.mantleCue") !== "0";
} catch {
  /* ignore */
}
mantleCueSel.value = mantleCueOn ? "1" : "0";
mantleCueSel.addEventListener("change", () => {
  mantleCueOn = mantleCueSel.value === "1";
  try {
    localStorage.setItem("range.mantleCue", mantleCueOn ? "1" : "0");
  } catch {
    /* ignore */
  }
});
// the figures: the motion-captured mannequin (the default since it holds a rifle at the
// shoulder), or our robots (Settings; mannequin.ts). Robots stand in until it has loaded.
const figureSel = $<HTMLSelectElement>("figureStyle");
figureSel.value = "mannequin";
try {
  if (localStorage.getItem("range.figures") === "robot") figureSel.value = "robot";
} catch {
  /* ignore */
}
setFigureStyle(figureSel.value === "mannequin" ? "mannequin" : "robot");
figureSel.addEventListener("change", () => {
  setFigureStyle(figureSel.value === "mannequin" ? "mannequin" : "robot");
  try {
    localStorage.setItem("range.figures", figureSel.value);
  } catch {
    /* ignore */
  }
});
// The practice aim bot (Settings): it steers the view onto the nearest enemy
// you can see. Off in any match with another human in it (see the frame loop),
// which is the one place using it would take something from someone else.
const aimbot = new Aimbot();

const aimbotSel = $<HTMLSelectElement>("aimbotMode");
try {
  aimbot.enabled = localStorage.getItem("range.aimbot") === "1";
} catch {
  /* ignore */
}
aimbotSel.value = aimbot.enabled ? "1" : "0";
aimbotSel.addEventListener("change", () => {
  aimbot.enabled = aimbotSel.value === "1";
  try {
    localStorage.setItem("range.aimbot", aimbot.enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
});

// The dash, from Settings: distance, how long it takes, how many charges and
// how long each takes to come back. They are the same numbers the bots use.
const dashInputs = {
  distance: $<HTMLInputElement>("dashDistance"),
  duration: $<HTMLInputElement>("dashTime"),
  charges: $<HTMLInputElement>("dashCharges"),
  recharge: $<HTMLInputElement>("dashRecharge"),
};
const LS_DASH = "range.dash.v1";
function showDash(): void {
  dashInputs.distance.value = String(JOLT.distance);
  dashInputs.duration.value = String(JOLT.duration);
  dashInputs.charges.value = String(JOLT.charges);
  dashInputs.recharge.value = String(JOLT.recharge);
}
try {
  const raw = localStorage.getItem(LS_DASH);
  if (raw) setJolt(JSON.parse(raw) as Partial<typeof JOLT_DEFAULTS>);
} catch {
  /* ignore */
}
showDash();
for (const [key, el] of Object.entries(dashInputs)) {
  el.addEventListener("change", () => {
    setJolt({ [key]: Number(el.value) } as Partial<typeof JOLT_DEFAULTS>);
    // a charge count change takes effect on the next fill
    abilities.fill();
    showDash();
    try {
      localStorage.setItem(LS_DASH, JSON.stringify({ distance: JOLT.distance, duration: JOLT.duration, charges: JOLT.charges, recharge: JOLT.recharge }));
    } catch {
      /* ignore */
    }
  });
}

// the killcam can be turned off (Settings); the recap still shows
const killcamSel = $<HTMLSelectElement>("killcamMode");
let killcamOn = true;
try {
  killcamOn = localStorage.getItem("range.killcam") !== "0";
} catch {
  /* ignore */
}
killcamSel.value = killcamOn ? "1" : "0";
killcamSel.addEventListener("change", () => {
  killcamOn = killcamSel.value === "1";
  try {
    localStorage.setItem("range.killcam", killcamOn ? "1" : "0");
  } catch {
    /* ignore */
  }
});
/** you are out: the recap is written now, and the killcam starts if there is a killer to watch */
function onEliminated(d: MatchLike, by: number): void {
  const t = realNow();
  // a loot battle royale: your death box, with your banner for the squad
  if (d instanceof BrMatch && d.lootField) {
    const items: LootItem[] = [];
    for (const s of loadout.slots) if (!s.empty) items.push({ kind: "weapon", id: s.id, n: 1, rarity: "rare", mag: s.magLevel, attach: { ...s.attach }, ...(s.hopLock ? { hop: s.hopLock.have } : {}) });
    for (const [type, n] of Object.entries(loadout.ammo.stock)) if (n > 0 && type !== "energy") items.push({ kind: "ammo", id: type, n, rarity: "common" });
    for (const [item, n] of Object.entries(kit.items)) if (n > 0) items.push({ kind: "heal", id: item, n, rarity: "common" });
    if (armor.helmet) items.push({ kind: "helmet", id: armor.helmet, n: 1, rarity: "legendary" });
    for (const [g, n] of Object.entries(ordnance.counts)) if (n > 0) items.push({ kind: "grenade", id: g, n, rarity: "rare" });
    // a banner only where there is a squad to carry it: in solo the others are opponents
    if (d.players > 1 && d.team.size > 1) items.push({ kind: "banner", id: "banner", n: 1, rarity: "common", owner: d.id, ownerName: profile.profile.name });
    d.dropBox(items, player.pos.clone());
  }
  recap = dlog.recap(t, by, (id) => d.nameFor(id), (id) => d.vitalsFor(id));
  recapShownAt = gameTime;
  if (killcamOn && by >= 0 && by !== d.id) killcam.start(recorder, t, by, d.nameFor(by));
}
/**
 * A new life: the log starts over. A replay still running (a round's respawn
 * comes 3 s after the kill) plays on through the countdown; the fight ends it.
 */
function newLife(d: MatchLike): void {
  dlog.clear(d.id);
}
/** everything a Digital Threat optic can light up */
const threatTargets = [...dummies, ...courseEnemies];

// ---------- matches: 1v1, 1v1v1 (src/game/duel.ts, src/net/link.ts), bots (src/game/bots.ts) ----------
let duel: MatchLike | null = null;
let hosting: HostHandle | null = null;
/**
 * The group between matches. A match used to end by dropping every
 * connection, so the next one needed a new code for all eight. Now a match
 * that ended (not one left) hands its links back: the host keeps its
 * friends' (by id), a guest its link to the host, and the host's Play again
 * starts the next match on them.
 */
let party: { guests: Map<number, Link> } | { host: Link } | null = null;
/**
 * Voice chat (src/net/voice.ts): one per PeerJS peer, which outlives a match
 * when the group plays again; who this page talks to is worked out each frame
 * from the host's roster, and the key is push to talk.
 */
const voices = new WeakMap<Peer, Voice>();
let voice: Voice | null = null;
let voiceGroupKey = "";
let voiceTalking = false;
let hudVoice: { me: boolean; talking: string[] } | null = null;
/** the Settings tab's voice volume, 0 to 1 (remembered) */
let voiceVolume = voiceCfg.volume;
try {
  const v = Number(localStorage.getItem("range.voiceVolume"));
  if (localStorage.getItem("range.voiceVolume") !== null && Number.isFinite(v) && v >= 0 && v <= 1) voiceVolume = v;
} catch {
  /* ignore */
}
/** players muted this session, by name (ids change when a group plays again; a name does not) */
const mutedNames = new Set<string>();
/** who this page can hear now, for the Friends tab's mute list: PeerJS id to name */
let voiceNames = new Map<string, string>();
/** whom this page may talk to: its squad or team (anyone it is allied with), or everyone where nobody is (a lobby, a 1v1, a free-for-all); in a battle royale, its squad only */
function hearsVoice(d: Duel, id: number): boolean {
  if (d instanceof BrMatch) return d.isAlly(id);
  const allies = [...d.voicePeers.keys()].some((o) => o !== d.id && d.isAlly(o));
  return allies ? d.isAlly(id) : true;
}
function voiceFrame(): void {
  const d = duel instanceof Duel ? duel : null;
  if (d && !voice) {
    const peer = d.anyLink()?.voicePeer?.();
    if (peer) {
      voice = voices.get(peer) ?? new Voice(peer);
      voices.set(peer, voice);
      voice.setVolume(voiceVolume);
    }
  }
  if (!d || !voice) {
    hudVoice = null;
    return;
  }
  const ids: string[] = [];
  const names = new Map<string, string>();
  for (const [id, pid] of d.voicePeers) {
    if (id === d.id || !hearsVoice(d, id)) continue;
    ids.push(pid);
    names.set(pid, d.nameFor(id));
  }
  const key = [...ids].sort().join(",");
  if (key !== voiceGroupKey) {
    voiceGroupKey = key;
    voice.setGroup(ids);
    // a muted name stays muted under its new id
    for (const [pid, name] of names) voice.setMuted(pid, mutedNames.has(name));
  }
  voiceNames = names;
  // push to talk, held (the script's key in the tests)
  const want = ids.length > 0 && (input.playing || !!scriptInput) && (scriptInput ? scriptInput.held("voice") : input.held("voice"));
  if (want !== voiceTalking) {
    voiceTalking = want;
    const v = voice;
    void v.setTalking(want).then(() => {
      if (want && v.denied) hud.notice("NO MICROPHONE: VOICE CHAT CANNOT SEND", gameTime, 2);
    });
  }
  const talking: string[] = [];
  for (const [pid, level] of voice.levels()) if (level > voiceCfg.talking) talking.push(names.get(pid) ?? "?");
  hudVoice = { me: voice.live, talking };
}
/** the Friends tab's list of who you can hear, each with a mute (redrawn with the roster) */
let voiceListKey = "";
function renderVoiceList(): void {
  const el = $("voiceList");
  const rows = voice ? [...voiceNames.entries()] : [];
  const key = JSON.stringify(rows.map(([pid, name]) => [pid, name, voice?.isMuted(pid)]));
  if (key === voiceListKey) return;
  voiceListKey = key;
  el.hidden = !rows.length;
  el.innerHTML =
    `<div class="rosterRow"><b>VOICE</b> · hold Caps Lock to talk</div>` +
    rows.map(([pid, name]) => `<div class="rosterRow"><b>${escapeHtml(name)}</b> <button type="button" class="ghost" data-mute="${escapeHtml(pid)}">${voice?.isMuted(pid) ? "Unmute" : "Mute"}</button></div>`).join("");
}
$("voiceList").addEventListener("click", (e) => {
  const pid = (e.target as HTMLElement).getAttribute("data-mute");
  if (!pid || !voice) return;
  const on = !voice.isMuted(pid);
  voice.setMuted(pid, on);
  const name = voiceNames.get(pid);
  if (name) {
    if (on) mutedNames.add(name);
    else mutedNames.delete(name);
  }
  renderVoiceList();
});
{
  const el = $<HTMLInputElement>("volVoice");
  el.value = String(Math.round(voiceVolume * 100));
  el.addEventListener("input", () => {
    voiceVolume = Math.max(0, Math.min(1, Number(el.value) / 100));
    voice?.setVolume(voiceVolume);
    try {
      localStorage.setItem("range.voiceVolume", String(voiceVolume));
    } catch {
      /* ignore */
    }
  });
}

/** out of the match: every call ended and the microphone let go */
function voiceStop(): void {
  voice?.stop();
  voice = null;
  voiceGroupKey = "";
  voiceTalking = false;
  hudVoice = null;
}

/** a guest's seat: the code, the id and the key the welcome gave, to get back in on after a dropped connection */
let mySeat: { code: string; id: number; key: string } | null = null;

/**
 * A guest whose connection to the host dropped mid-match: the match keeps
 * running here, and the same code is tried again with the seat's key every
 * net.json rejoin.retry seconds until the host takes us back or the match
 * gives up (its own clock, rejoin.hold).
 */
function getBackIn(d: Duel): void {
  const seat = mySeat;
  if (!seat) return;
  const attempt = () => {
    if (duel !== d || d.reconnectUntil === null) return;
    hud.notice("CONNECTION LOST: GETTING BACK IN", gameTime, netCfg.rejoin.retry);
    let settled = false;
    const retry = () => {
      if (settled) return;
      settled = true;
      // a friend taking the match over is there within a second or two: try again sooner than for a host coming back
      setTimeout(attempt, (d.heir !== null && d.heir !== d.id ? netCfg.migrate.wait : netCfg.rejoin.retry) * 1000);
    };
    const cancel = joinMatch(
      seat.code,
      (link, w) => {
        settled = true;
        if (duel !== d || !w.back || w.id !== seat.id) {
          link.close();
          return;
        }
        d.swapHost(link, w.host);
        // the heir's own try for the code is not wanted now
        if (hosting && d.role === "guest") {
          hosting.cancel();
          hosting = null;
        }
        hud.notice(typeof w.host === "number" && w.host !== 0 ? "BACK IN: A FRIEND IS THE HOST NOW" : "BACK IN", gameTime, 2);
      },
      () => retry(),
      { id: seat.id, key: seat.key }
    );
    // an attempt that hears nothing either way is given up and tried again
    setTimeout(() => {
      if (settled) return;
      cancel();
      retry();
    }, 8000);
  };
  // a friend is taking the match over (host migration): give it a moment to hold the code before the first try
  if (d.heir !== null && d.heir !== d.id) setTimeout(attempt, netCfg.migrate.wait * 1000);
  else attempt();
}
/**
 * The heir, now the host of a match whose host went (Duel.takeOver has run):
 * the match's own code registered again, answering the others' retries with
 * their held seats. Nobody new comes in.
 */
function takeOverHosting(d: Duel, snap: HeirSnapshot): void {
  const seat = mySeat;
  const joined = joinedWith;
  if (!seat || !joined) return;
  hosting?.cancel();
  const h = hostMatch(
    d.players,
    // (the local link says the code is ours before hostMatch has returned)
    (code) => queueMicrotask(() => {
      // back in as a guest first (the host was there after all), or out: let the code go
      if (duel !== d || d.role !== "guest" || d.reconnectUntil === null) {
        h.cancel();
        if (hosting === h) hosting = null;
        return;
      }
      d.takeOver(snap);
      mySeat = null;
      hostBr = joined.br ?? null;
      hostOpts = joined.opts ?? null;
      hud.notice("THE HOST IS GONE: YOU ARE THE HOST NOW", gameTime, 3);
      setDuelStatusText(`You are the host now, on the same code (${code}): the others are coming back.`);
      duelButtons();
    }),
    (link) => link.close(),
    () => {
      // the code stayed taken: this page goes on trying to get back in as a guest
      if (hosting === h) hosting = null;
    },
    joined.br,
    joined.opts,
    { code: seat.code, keys: snap.keys, host: d.id, claim: netCfg.migrate.claim }
  );
  hosting = h;
  h.onRejoin = (link, id) => (duel === d && d.role === "host" ? d.rejoin(link, id) : false);
}
/** what this page's welcome into a match said, for taking it over (host migration) */
let joinedWith: { players: number; br?: BrWelcome; opts?: MatchOpts } | null = null;
let cancelJoin: (() => void) | null = null;
/** knocked in a match: the controller gets no keys until the next round */
const NO_INPUT: MoveInput = { held: () => false, pressedNow: () => false };
/** toggle ADS's state: in until the next press (or a sprint, a swap) */
let adsLatch = false;
/** a throw took this press of fire: the gun waits for the button to come up */
let fireLockedToRelease = false;
/** this frame's ADS press put a grenade away (it does not also aim) */
let adsPressUsed = false;
/** an inspect: when it began, and since when reload has been held with a full magazine */
let inspectAt = -Infinity;
let reloadHeldAt = -Infinity;
/** hold reload this long (a full magazine) to inspect */
const INSPECT_HOLD = 0.4;
/** a new gun's first-draw flourish: when it began */
let flourishAt = -Infinity;
/** the tour's panel this frame */
let tourHud: ReturnType<Tour["update"]> = null;
/** toggle crouch's state: down until the next press, a jump or a sprint */
let crouchLatch = false;
/** the movement's input with crouch as a toggle: a press flips it, and it is "held" while down */
function crouchToggled(src: MoveInput): MoveInput {
  if (src.pressedNow("crouch")) crouchLatch = !crouchLatch;
  if (src.pressedNow("jump") || src.pressedNow("sprint")) crouchLatch = false;
  return { held: (a) => (a === "crouch" ? crouchLatch : src.held(a)), pressedNow: (a) => src.pressedNow(a) };
}
/** a figure on your side (a squad mate, a team mate): no aim assist toward it, a friendly plate */
function isAllyFigure(a: Dummy): boolean {
  if (!(duel instanceof Duel)) return false;
  const r = duel.remoteOf(a);
  return !!r && duel.isAlly(r.id);
}
/** down: the move keys only, and crouched (a crawl) */
const CRAWL_KEYS = new Set(["forward", "back", "left", "right"]);
const crawlInput = (src: MoveInput): MoveInput => ({
  held: (a) => a === "crouch" || (CRAWL_KEYS.has(a) && src.held(a)),
  pressedNow: (a) => CRAWL_KEYS.has(a) && src.pressedNow(a),
});
const duelStatus = $("duelStatus");
const duelHostBtn = $<HTMLButtonElement>("duelHost");
const duelJoinBtn = $<HTMLButtonElement>("duelJoin");
const duelLeaveBtn = $<HTMLButtonElement>("duelLeave");
const duelCode = $<HTMLInputElement>("duelCode");
const duelPlayers = $<HTMLSelectElement>("duelPlayers");
const duelMode = $<HTMLSelectElement>("duelMode");
const botDifficulty = $<HTMLSelectElement>("botDifficulty");
const botCount = $<HTMLSelectElement>("botCount");
const brBots = $<HTMLSelectElement>("brBots");
const modeBots = $<HTMLSelectElement>("modeBots");
const gunRunList = $<HTMLSelectElement>("gunRunList");
for (const [sel, key] of [
  [modeBots, "range.mode.bots"],
  [gunRunList, "range.mode.list"],
] as const) {
  try {
    const v = localStorage.getItem(key);
    if (v && [...sel.options].some((o) => o.value === v)) sel.value = v;
  } catch {
    /* ignore */
  }
  sel.addEventListener("change", () => {
    try {
      localStorage.setItem(key, sel.value);
    } catch {
      /* ignore */
    }
  });
}
const modeBotCount = (): number => Math.max(0, Math.min(MODES.maxBots, Number(modeBots.value) || 0));
const modeList = (): "short" | "full" => (gunRunList.value === "full" ? "full" : "short");
// What the bots carry: mixed (the built-in list) or one gun for all of them.
const botWeaponSel = $<HTMLSelectElement>("botWeapon");
for (const id of weaponIds()) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = `Bot guns: ${weaponName(id)}`;
  botWeaponSel.appendChild(o);
}
try {
  const saved = localStorage.getItem("range.botWeapon") ?? "";
  if (saved && [...botWeaponSel.options].some((o) => o.value === saved)) botWeaponSel.value = saved;
} catch {
  /* ignore */
}
botWeaponSel.addEventListener("change", () => {
  try {
    localStorage.setItem("range.botWeapon", botWeaponSel.value);
  } catch {
    /* ignore */
  }
});
const botWeaponChoice = (): string | null => botWeaponSel.value || null;
// The arena. One map for six modes was why every mode played the same, and the
// owner asked for small maps for 1v1s and free-for-all. The warehouse stays
// the default so a match that worked yesterday opens where it opened
// yesterday; "picked for the mode" uses the map each mode was drawn for.
const arenaMapSel = $<HTMLSelectElement>("arenaMap");
for (const [value, label] of [
  // the box wears the word MAP in the lobby, so the options do not repeat it
  ["warehouse", "The warehouse"],
  ["auto", "Picked for the mode"],
  ...ARENA_MAPS.filter((m) => m.plan).map((m) => [m.id, `${m.name[0]}${m.name.slice(1).toLowerCase()}`]),
] as Array<[string, string]>) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = label;
  arenaMapSel.appendChild(o);
}
try {
  const saved = localStorage.getItem("range.arenaMap") ?? "";
  if (saved && [...arenaMapSel.options].some((o) => o.value === saved)) arenaMapSel.value = saved;
} catch {
  /* ignore */
}
arenaMapSel.addEventListener("change", () => {
  try {
    localStorage.setItem("range.arenaMap", arenaMapSel.value);
  } catch {
    /* ignore */
  }
});
/** the arena for a mode (or "duel"), from the picker */
const arenaMapChoice = (kind: string, players: number): ArenaMapId => {
  if (arenaMapSel.value === "auto") return mapFor(kind, players);
  return arenaMap(arenaMapSel.value).id as ArenaMapId;
};
/** a map id from the wire, which may be from an older build or not a map at all */
const arenaFromWire = (id: string | undefined): ArenaMapId | null => (id ? (arenaMap(id).id as ArenaMapId) : null);
// Abilities on or off, per kind of match, remembered: the friends' arena and
// the bots off by default, the battle royale on. The friends' select follows
// the mode picked beside it (a squad BR shows the BR's setting).
const duelAbilities = $<HTMLSelectElement>("duelAbilities");
const botAbilities = $<HTMLSelectElement>("botAbilities");
const brAbilities = $<HTMLSelectElement>("brAbilities");
const ABILITY_DEFAULTS: Record<"arena" | "bots" | "br", "0" | "1"> = { arena: "0", bots: "0", br: "1" };
const abilitySetting = (kind: "arena" | "bots" | "br"): boolean => {
  try {
    const v = localStorage.getItem(`range.abilities.${kind}`);
    return (v === "0" || v === "1" ? v : ABILITY_DEFAULTS[kind]) === "1";
  } catch {
    return ABILITY_DEFAULTS[kind] === "1";
  }
};
const setAbilitySetting = (kind: "arena" | "bots" | "br", on: boolean): void => {
  try {
    localStorage.setItem(`range.abilities.${kind}`, on ? "1" : "0");
  } catch {
    /* ignore */
  }
};
const duelKind = (): "arena" | "br" => (duelMode.value === "br" ? "br" : "arena");
/** the friends' row's mode, when it is one of the arena's modes */
const duelModeKind = (): ModeKind | null => (isModeKind(duelMode.value) ? duelMode.value : null);
const showAbilitySettings = (): void => {
  duelAbilities.value = abilitySetting(duelKind()) ? "1" : "0";
  botAbilities.value = abilitySetting("bots") ? "1" : "0";
  brAbilities.value = abilitySetting("br") ? "1" : "0";
};
showAbilitySettings();
duelAbilities.addEventListener("change", () => {
  setAbilitySetting(duelKind(), duelAbilities.value === "1");
  showAbilitySettings();
});
botAbilities.addEventListener("change", () => setAbilitySetting("bots", botAbilities.value === "1"));
brAbilities.addEventListener("change", () => {
  setAbilitySetting("br", brAbilities.value === "1");
  showAbilitySettings();
});
// choosing the battle royale on the friends' row shows its own setting (on unless you turned it off)
duelMode.addEventListener("change", showAbilitySettings);
try {
  const bb = localStorage.getItem("range.br.bots");
  if (bb && [...brBots.options].some((o) => o.value === bb)) brBots.value = bb;
} catch {
  /* ignore */
}
brBots.addEventListener("change", () => {
  try {
    localStorage.setItem("range.br.bots", brBots.value);
  } catch {
    /* ignore */
  }
});
try {
  const bd = localStorage.getItem("range.bots.difficulty");
  if (bd) botDifficulty.value = asDifficulty(bd);
  const bc = localStorage.getItem("range.bots.count");
  if (bc === "1" || bc === "2") botCount.value = bc;
} catch {
  /* ignore */
}
for (const sel of [botDifficulty, botCount]) {
  sel.addEventListener("change", () => {
    try {
      localStorage.setItem("range.bots.difficulty", botDifficulty.value);
      localStorage.setItem("range.bots.count", botCount.value);
    } catch {
      /* ignore */
    }
  });
}
function setDuelStatus(html: string, cls = ""): void {
  duelStatus.className = `calibMsg ${cls}`;
  duelStatus.innerHTML = html;
}
/** a status line from text that can carry another player's name: never markup */
function setDuelStatusText(text: string, cls = ""): void {
  duelStatus.className = `calibMsg ${cls}`;
  duelStatus.textContent = text;
}
/** the group kept at a match's end: listening for its next match (a guest) or its members leaving (the host) */
function keepParty(p: { guests: Map<number, Link> } | { host: Link }): void {
  party = p;
  if ("guests" in p) {
    for (const [id, l] of p.guests)
      l.onClose = () => {
        p.guests.delete(id);
        if (!p.guests.size) leaveParty("Everyone else left the group.");
        else duelButtons();
      };
  } else {
    p.host.onMessage = (m) => {
      // the host's next match: the welcome again, on the same link
      if (m.t !== "welcome" || typeof m.id !== "number" || typeof m.players !== "number") return;
      party = null;
      p.host.onClose = null;
      if (mySeat && m.key) mySeat = { ...mySeat, id: m.id, key: m.key };
      startDuel(p.host, m.players, m.id, 1, m.br, m.opts);
    };
    p.host.onClose = () => leaveParty("The host left the group.");
  }
  duelButtons();
}

/** out of the group: its links closed, and the host's code gone */
function leaveParty(reason: string): void {
  const p = party;
  party = null;
  if (p && "guests" in p) {
    for (const l of p.guests.values()) {
      l.onClose = null;
      l.close();
    }
    hosting?.cancel();
    hosting = null;
  } else if (p) {
    p.host.onClose = null;
    p.host.onMessage = null;
    p.host.close();
  }
  setDuelStatusText(reason);
  duelButtons();
}

/** the host: the group's next match, on what the Friends tab says now, over the links it already has */
function playAgain(): void {
  if (duel || !party || !("guests" in party)) return;
  const links = [...party.guests.entries()].sort((a, b) => a[0] - b[0]).map(([, l]) => l);
  party = null;
  readHostSettings();
  const players = links.length + 1;
  // ids afresh, 1 up: a friend who left the group leaves no gap
  links.forEach((l, i) => {
    l.onClose = null;
    l.send({ t: "welcome", id: i + 1, players, br: hostBr ?? undefined, opts: hostOpts ?? undefined, key: hosting?.keyOf(i + 1) });
  });
  links.forEach((l, i) => startDuel(l, players, 0, i + 1));
}

function duelButtons(): void {
  const busy = duel !== null || hosting !== null || party !== null;
  duelHostBtn.hidden = busy;
  duelJoinBtn.hidden = busy;
  duelCode.hidden = busy;
  duelPlayers.hidden = busy;
  duelLeaveBtn.hidden = !busy;
  // the host with some friends in and some places still open: start with those in
  const d = duel instanceof Duel ? duel : null;
  const short = !!d && !!hosting && d.role === "host" && d.phase === "waiting" && d.mode !== "duel" && d.connected >= 1 && d.connected < d.players - 1;
  duelStartNowBtn.hidden = !short;
  // the host of a kept group: another match on the same links
  const again = !duel && party !== null && "guests" in party;
  duelAgainBtn.hidden = !again;
  if (again && party && "guests" in party) duelAgainBtn.textContent = `Play again with ${party.guests.size + 1}`;
  duelLeaveBtn.textContent = !duel && party ? "Leave the group" : "Leave match";
  renderRoster();
  if (short && d) duelStartNowBtn.textContent = `Start with ${d.connected + 1}`;
}
const duelStartNowBtn = $<HTMLButtonElement>("duelStartNow");
const duelAgainBtn = $<HTMLButtonElement>("duelAgain");
duelAgainBtn.addEventListener("click", () => playAgain());
/**
 * The host's lobby: each friend in, whether they have clicked Play, their
 * ping, and a button to take them out. The status line only said "3 of 7
 * friends in", which never told the host who they were waiting on.
 */
const duelRosterEl = $("duelRoster");
/** a friend's name into the page as text, never as markup (they typed it) */
const escapeHtml = (t: string): string => t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
let rosterKey = "";
function renderRoster(): void {
  const d = duel instanceof Duel && duel.role === "host" && duel.phase === "waiting" ? duel : null;
  const rows = d ? d.roster() : [];
  const key = JSON.stringify(rows.map((r) => [r.id, r.name, r.ready, r.ping === null ? null : Math.round(r.ping / 10)]));
  if (key === rosterKey) return;
  rosterKey = key;
  duelRosterEl.hidden = !rows.length;
  duelRosterEl.innerHTML = rows
    .map((r) => `<div class="rosterRow"><b>${escapeHtml(r.name)}</b> · ${r.ready ? "in" : "on the menu"} · ${r.ping === null ? "ping -" : `${Math.round(r.ping)} ms`} <button type="button" class="ghost" data-host="${r.id}" title="hand the host over: they make a new code for this lobby and everyone moves there">Make host</button> <button type="button" class="ghost" data-kick="${r.id}">Kick</button></div>`)
    .join("");
}
duelRosterEl.addEventListener("click", (e) => {
  const t = e.target as HTMLElement;
  if (t.hasAttribute("data-host")) {
    handOver(Number(t.getAttribute("data-host")));
    return;
  }
  const id = Number(t.getAttribute("data-kick"));
  if (t.hasAttribute("data-kick") && Number.isFinite(id) && duel instanceof Duel) duel.kick(id);
});
duelStartNowBtn.addEventListener("click", () => {
  if (duel instanceof Duel && duel.startNow()) {
    hosting?.stopAccepting();
    duelButtons();
  }
});
/**
 * The heading nearest `yaw` that looks down some open floor (modes.json
 * spawnFacing). The new arenas put cover on the line between opposite spawns
 * on purpose, so facing the middle meant facing a box a metre away; a spawn
 * that already sees open floor keeps the middle.
 */
function openYaw(x: number, z: number, yaw: number): number {
  const cfg = MODES.spawnFacing;
  const eye = new THREE.Vector3(x, 1.6, z);
  const dir = new THREE.Vector3();
  const clearAt = (deg: number): number => {
    const r = deg * DEG;
    dir.set(-Math.sin(r), 0, -Math.cos(r));
    return Math.min(60, solidHit(eye, dir, 60));
  };
  let best = yaw;
  let bestClear = clearAt(yaw);
  if (bestClear >= cfg.clear) return yaw;
  for (let off = cfg.step; off <= cfg.sweep; off += cfg.step) {
    for (const sign of [1, -1]) {
      const y = yaw + sign * off;
      const c = clearAt(y);
      if (c >= cfg.clear) return y;
      if (c > bestClear) {
        bestClear = c;
        best = y;
      }
    }
  }
  return best;
}
/**
 * Aboard the dropship at the start of a battle royale: facing the way it
 * flies, the map up to choose by, and in a squad linked to the jumpmaster
 * (the host), whose jump takes the squad with them.
 */
function boardShip(d: BrMatch, run: ShipRun): void {
  const at = run.at(realNow());
  player.yaw = run.yaw;
  player.pitch = -12;
  player.board(at.x, at.y + SHIP.seat, at.z);
  // the ride is the ride: the map no longer covers the first thing anyone sees
  // of a match (src/config/squad.json dive.mapOnBoard). The minimap and the
  // notice below say where the ship is; M opens the big one.
  mapOpen = squadCfg.dive.mapOnBoard;
  following = null;
  // the first of your squad leads it down (the host, unless the friends are split into squads)
  linkedTo = d.jumpmaster();
  const master = d.isJumpmaster();
  hud.notice(master ? "YOU ARE THE JUMPMASTER: THE SQUAD JUMPS WITH YOU" : linkedTo !== null ? `${d.nameFor(linkedTo)} IS THE JUMPMASTER` : `THE SHIP PASSES ${d.poi.name}: JUMP WHEN YOU LIKE`, gameTime, 3);
  if (!squadCfg.dive.mapOnBoard) window.setTimeout(() => hud.notice("M IS THE MAP  ·  SPACE JUMPS", gameTime, 2.5), 3200);
}

/** off the ship, into the skydive where it is; the jumpmaster's jump takes the linked squad with them */
function jumpOut(d: BrMatch, why: string | null): void {
  player.leaveShip(SHIP.exit);
  mapOpen = false;
  dropMapUntil = 0;
  audio.whoosh();
  if (why) hud.notice(why, gameTime, 2);
  if (d.isJumpmaster()) d.localFx("jm", player.pos.clone());
}

/**
 * The ship each frame: carried with it, the jump once the doors are open,
 * out at the end of the line whatever you do, and a linked squad mate's
 * break. Then following the jumpmaster down: held in the formation behind
 * them until the break key or until they are near the ground.
 */
function shipFrame(d: BrMatch, keys: MoveInput): void {
  const t = realNow();
  const run = d.ship;
  if (player.aboard) {
    if (!run) {
      player.aboard = false;
      return;
    }
    const at = run.riderAt(t);
    player.ride(at.x, at.y + SHIP.seat, at.z);
    if (linkedTo !== null && keys.pressedNow("crouch")) {
      linkedTo = null;
      hud.notice("YOU BROKE OFF: JUMP WHEN YOU LIKE", gameTime, 2);
    }
    if (run.gone(t)) jumpOut(d, "THE SHIP IS LEAVING THE MAP");
    else if (run.doorsOpen(t) && keys.pressedNow("jump")) {
      // a linked squad mate who jumps first goes alone
      linkedTo = null;
      jumpOut(d, null);
    }
    return;
  }
  if (following === null) return;
  const f = d.figureOf(following);
  const g = f?.group.position;
  const clear = g ? g.y - surfaceUnder(g.x, g.z, g.y) : 0;
  if (!player.dropping || !f || !g || f.currentPose.stance !== "air" || clear < SHIP.follow.release) {
    following = null;
    player.leash = null;
    if (player.dropping) hud.notice("ON YOUR OWN: STEER IN", gameTime, 1.5);
  } else if (keys.pressedNow("crouch")) {
    following = null;
    player.leash = null;
    hud.notice("YOU BROKE OFF", gameTime, 1.5);
  } else {
    // behind the jumpmaster and to one side, the side by your id so a trio fans out
    const yaw = f.group.rotation.y - Math.PI;
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const side = (d.id % 2 === 1 ? -1 : 1) * SHIP.follow.side;
    leashAt.set(g.x - fx * SHIP.follow.back - fz * side, g.y + SHIP.follow.up, g.z - fz * SHIP.follow.back + fx * side);
    player.leash = leashAt;
  }
}

/** the ship for the HUD: its line and where it is, the doors, the end, and who jumps for whom */
function shipHud(d: BrMatch, run: ShipRun): NonNullable<HudState["ship"]> {
  const t = realNow();
  const at = run.at(t);
  return {
    line: [run.line.ax, run.line.az, run.line.bx, run.line.bz],
    at: [at.x, at.z],
    doorsIn: run.doorsIn(t),
    endIn: run.endIn(t),
    master: d.players > 1 && d.id === 0,
    linkedTo: linkedTo !== null ? d.nameFor(linkedTo) : null,
    keys: { jump: keyLabel("jump"), crouch: keyLabel("crouch"), map: keyLabel("map") },
  };
}

function respawnForMatch(d: MatchLike): void {
  const sp = d.spawn;
  newLife(d);
  const boxAt = d instanceof BrMatch && d.respawnOnBox ? d.boxRespawnAt : null;
  // the Gulag: this respawn is into its room
  const gulagIn = d instanceof BrMatch ? d.takeGulagEntry() : null;
  if (gulagIn) {
    const room = arenaMap(GULAG.map);
    player.setBounds(room.bounds);
    setRegion("range");
    // facing open floor, as every arena spawn does, not the wall a metre off
    player.teleport(gulagIn.x, 0, gulagIn.z, openYaw(gulagIn.x, gulagIn.z, gulagIn.yaw));
    hud.notice("THE GULAG: WIN AND YOU ARE BACK IN", gameTime, 3);
  } else if (d instanceof BrMatch && boxAt) {
    // a squad mate held at your death box: you stand up on it, at its height
    player.setBounds(BR_BOUNDS);
    setRegion("br");
    player.teleport(boxAt.x, boxAt.y, boxAt.z, player.yaw);
    hud.notice("RESPAWNED AT YOUR DEATH BOX", gameTime, 2.5);
  } else if (d instanceof BrMatch) {
    // a battle royale starts in the sky over your drop spot once everyone is
    // in; until then the lobby is wherever you are (the arena, for a host)
    if (d.phase !== "waiting") {
      player.setBounds(BR_BOUNDS);
      setRegion("br");
      // the start of the match is the ship; a beacon's respawn (and the tests) drop straight in
      const run = d.takeBoarding();
      if (run) boardShip(d, run);
      else {
        player.beginDrop(sp.x, DROP_HEIGHT, sp.z, sp.yaw);
        mapOpen = false;
        dropMapUntil = gameTime + squadCfg.dive.mapSeconds;
        hud.notice(d.redeploying ? "REDEPLOYED: BACK INTO THE FIGHT" : `DROPPING INTO ${d.poi.name}`, gameTime, 3);
        // and the hot zone, so the match's own decision is one everybody has:
        // kitted guns in one named place, and everyone told where
        if (!d.redeploying) {
          const hot = d.hotZone();
          if (hot) window.setTimeout(() => hud.notice(`HOT ZONE: ${hot.name.toUpperCase()}  ·  KITTED GUNS, AND EVERYONE KNOWS`, gameTime, 4), 1200);
        }
      }
    }
  } else player.teleport(sp.x, 0, sp.z, openYaw(sp.x, sp.z, sp.yaw));
  if (pendingSlots) {
    pendingSlots.forEach((id, i) => loadout.setWeaponId(i, id));
    pendingSlots = null;
  }
  // full magazines, settled spread and recoil, gun out, a full heal kit, and
  // the match's ammo: counted, two stacks of each gun's, full energy stockpiles
  for (const sl of loadout.slots) sl.state.setWeapon(sl.weapon);
  loadout.ammo.infinite = false;
  loadout.ammo.kit(loadout.slots.map((sl) => sl.weapon));
  loadout.refillEnergy();
  holster = "out";
  // the arena and the bots: the fixed kit and blue shields; a battle royale:
  // its start kit and a white shield core that levels with EVO
  const br = d instanceof BrMatch;
  kit.fill(br ? "brStart" : "kit");
  // JOLT's two charges, both there for every life and every round
  abilities.fill();
  // no knockdown shield, no regen carried over from the last life
  kd.reset();
  execRegen = null;
  boxRegen = null;
  // grenades: the match's kit each life (Gun Run is guns and the knife: none)
  ordnance.endless = false;
  ordnance.readied = null;
  ordnance.fill(d instanceof ArenaMode && d.modeKind === "gunrun" ? "empty" : "kit");
  player.arcSlowUntil = 0;
  // land with nothing and loot: fists, no heals, no ammo, no grenades
  if (d instanceof BrMatch && d.startLoot) {
    loadout.clearSlot(0);
    loadout.clearSlot(1);
    loadout.ammo.empty();
    kit.fill("empty");
    ordnance.fill("empty");
  }
  armor.reset(br ? 1 : 2);
  d.shieldMax = armor.shieldMax;
  d.shield = d.shieldMax;
  heal = null;
  player.healSlow = 1;
  // A Deathbox Respawn, last (after the life's kit and armour above, so nothing of the box is cleared
  // again): 20 health, the shield back over a few seconds, and what is left in the box put on (the
  // box's items lie 0.9 m round its own spot, near the banner the mate held at)
  if (d instanceof BrMatch && boxAt) {
    d.health = squadCfg.boxRespawn.health;
    d.shield = 0;
    boxRegen = { rate: d.shieldMax / squadCfg.boxRespawn.shieldRegen };
    const f = d.lootField;
    if (f) {
      const drops = [...f.drops.values()];
      const box = drops.filter((x) => x.item.kind === "box").sort((a, b) => a.pos.distanceTo(boxAt) - b.pos.distanceTo(boxAt))[0];
      const at = box && box.pos.distanceTo(boxAt) < 2 ? box.pos : boxAt;
      for (const drop of drops) if (drop.item.kind !== "box" && Math.hypot(drop.pos.x - at.x, drop.pos.z - at.z) < 1.3) d.takeLoot(drop.key);
    }
  }
  // The Gulag: in, the fight's two guns and their ammo; won, the same guns
  // back as you drop in again. The killcam of the death that sent you gives way.
  const gulagGuns = gulagIn ? gulagIn.guns : d instanceof BrMatch ? d.takeGulagKit() : null;
  if (gulagGuns) {
    loadout.clearSlot(0);
    loadout.clearSlot(1);
    loadout.ammo.empty();
    for (const gun of gulagGuns) {
      applyLoot({ kind: "weapon", id: gun, n: 1, rarity: "common" });
      const type = ammoTypeOf(gun);
      if (type !== "energy") applyLoot({ kind: "ammo", id: type, n: STACK[type] * GULAG.kitStacks, rarity: "common" });
    }
    killcam.stop();
    recap = null;
  }
  // Resurgence: back from the sky with a sidearm, some of its ammo and a few heals
  // (a match that lands with loadouts already has them), and the killcam gives way
  if (d instanceof BrMatch && d.takeRedeployKit()) {
    if (d.startLoot) {
      const R = brCfg.resurgence;
      const gun = R.kit[Math.floor(Math.random() * R.kit.length)];
      applyLoot({ kind: "weapon", id: gun, n: 1, rarity: "common" });
      const type = ammoTypeOf(gun);
      if (type !== "energy") applyLoot({ kind: "ammo", id: type, n: STACK[type] * R.kitStacks, rarity: "common" });
      for (const [h, n] of Object.entries(R.heals)) applyLoot({ kind: "heal", id: h, n, rarity: "common" });
    }
    killcam.stop();
    recap = null;
  }
  if (d instanceof ArenaMode) {
    // Gun Run: the level's gun, one slot, endless reserve (the guns change with every kill)
    if (d.modeKind === "gunrun") {
      loadout.ammo.infinite = true;
      applyModeGun(d.currentGun);
    }
    // back in after going down: the killcam and the recap give way
    if (d.respawns && d.phase === "fight") {
      killcam.stop();
      recap = null;
    }
  }
}

/** Gun Run: the gun for your level in hand (the other slot empty), or the knife (fists) */
function applyModeGun(id: string | null): void {
  if (id === null) {
    loadout.clearSlot(0);
    loadout.clearSlot(1);
    return;
  }
  loadout.give(loadout.activeIndex, id);
  loadout.clearSlot(1 - loadout.activeIndex);
  loadout.raise(gameTime);
  refreshDerived();
}

// ---------- healing ----------
// Apex's items, the numbers its own (src/config/items.json): a shield cell is
// 25 shield over 2.5 s, a syringe 25 health over 4 s. The kit per life is in
// the config; the heal key takes a cell while the shield is down, else a
// syringe. Firing or aiming cancels it; the item is only spent when it
// finishes. TRIAGE halves every time.
const HEAL_ITEMS = HEALS;
/**
 * EVO (squad.json, Season 30): the damage you deal, a knock 150, an assist
 * 100, a revive 100 twice then less, a care package 100. A level up refills
 * the shield and says so.
 */
function giveEvo(amount: number, why = ""): void {
  if (!(duel instanceof BrMatch) || amount <= 0) return;
  const up = armor.addEvo(amount);
  if (why) hud.notice(`+${amount} EVO  ·  ${why}`, gameTime, 1.2);
  if (up !== null) {
    duel.shieldMax = armor.shieldMax;
    if (!duel.downed) duel.shield = duel.shieldMax;
    hud.notice(`SHIELD UP: ${["", "WHITE", "BLUE", "PURPLE"][up]} ${armor.shieldMax}`, gameTime, 1.6);
    audio.stinger("won");
  }
}
/** whom you hurt and when (an assist: someone else knocks them soon after) */
const damagedAt = new Map<number, number>();

type Plate = { world: THREE.Vector3; name: string; health: number; shield: number; shieldMax: number; alive: boolean; ally?: boolean; aimbot?: boolean };
/** the plates drawn this frame (tools/e2e.ts) */
let lastPlates: Plate[] = [];
/** nothing of the level between your eye and `p` */
function clearTo(p: THREE.Vector3): boolean {
  const eye = camera.position;
  const dir = p.clone().sub(eye);
  const len = dir.length();
  if (len < 1e-3) return true;
  return solidHit(eye, dir.divideScalar(len), len) >= len;
}
/**
 * The names and bars over the others. A team mate's always; an enemy's only
 * after you have hurt them (hud.json's afterHit), and only while your eye has
 * a clear line to their chest: a bar through a wall gave their position away.
 */
function platesNow(d: NonNullable<typeof duel>, now: number): Plate[] {
  const out: Plate[] = [];
  for (const a of d.avatars) {
    const r = d.remoteOf(a);
    if (!r || !a.group.visible) continue;
    const ally = d instanceof Duel && d.isAlly(r.id);
    // the aim bot's mark is shown whatever the plate rules say
    if (!ally && !r.aimbot) {
      if (now - (damagedAt.get(r.id) ?? -Infinity) >= hudCfg.plates.afterHit) continue;
      const chest = a.hitMeshes.find((m) => m.userData.zone === "body")?.getWorldPosition(new THREE.Vector3()) ?? a.group.position.clone().setY(a.group.position.y + 1.2);
      if (!clearTo(chest)) continue;
    }
    out.push({ world: new THREE.Vector3(a.group.position.x, a.group.position.y + 2.05, a.group.position.z), name: r.name, health: r.health, shield: r.shield, shieldMax: r.shieldMax, alive: r.alive, ally, aimbot: !!r.aimbot });
  }
  return out;
}
/** the knocks already paid (a figure can be reported twice: down, then out) */
const evoPaid = new Map<number, number>();
/** your revives this match (the first two pay 100, then less) and the care packages already paid */
let revivesDone = 0;
const podsPaid = new Set<number>();
function evoForKnock(victim: number, by: number): void {
  if (!(duel instanceof BrMatch) || victim === duel.id) return;
  const last = evoPaid.get(victim) ?? -Infinity;
  if (gameTime - last < 3) return;
  if (by === duel.id) {
    evoPaid.set(victim, gameTime);
    giveEvo(squadCfg.evo.knock, "KNOCK");
  } else if (gameTime - (damagedAt.get(victim) ?? -Infinity) < squadCfg.evo.assistWindow) {
    evoPaid.set(victim, gameTime);
    giveEvo(squadCfg.evo.assist, "ASSIST");
  }
}

// ---- the hop-ups of Seasons 29 and 30 (weapon-mechanics.json lockedHopups): unlocked by damage, and their effects
/** damage with the gun in hand goes to its locked hop-up; at the mark it unlocks */
function hopProgress(weaponId: string, amount: number): void {
  const s = loadout.active;
  if (s.empty || s.id !== weaponId || !s.hopLock) return;
  s.hopLock.have += amount;
  if (s.hopLock.have >= s.hopLock.need) {
    const mod = s.hopLock.mod;
    s.hopLock = null;
    loadout.fitAttachment(loadout.activeIndex, "hopup", mod);
    hud.notice(`${hopupName(mod).toUpperCase()} UNLOCKED`, gameTime, 2);
    audio.healDone();
  }
}
/** Shattercaps: the gun's round as a blast of pellets (7 of 8, heads x1.25), made once per gun */
const shatterCache = new Map<string, ResolvedWeapon>();
function shatterOf(w: ResolvedWeapon): ResolvedWeapon {
  const key = `${w.id}:${w.magLevel}`;
  let v = shatterCache.get(key);
  if (!v) {
    const h = LOCKED_HOPUPS.hopup_shattercaps;
    const dmg = h?.damage ?? 8;
    v = { ...w, pellets: h?.pellets ?? 7, damage: { ...w.damage, near: dmg, far: dmg, veryFar: dmg, headshot: h?.headshot ?? 1.25 } };
    shatterCache.set(key, v);
  }
  return v;
}
/** Executioner's shield after a knock: what is left to give, and how fast */
let execRegen: { left: number; rate: number } | null = null;
/** a Deathbox Respawn: the shield comes back over a few seconds */
let boxRegen: { rate: number } | null = null;
/** the knockdown shield (squad.json kdShield): what it has left, raised or not, and the knock it belongs to */
// The knockdown shield (src/game/kit.ts): its size comes from your EVO level,
// or a better one you looted, and a gold one carries a self-revive.
const kd = new Knockdown();
/** your bleed-out last frame while down, so the self-revive can tell a hit landed */
let selfReviveHp = 0;
let kdPane: THREE.Mesh | null = null;
/** the Deathbox Respawn beams in the world, by who is holding (your own is -1) */
const beams = new Map<number, { obj: THREE.Mesh; until: number; hum: (() => void) | null }>();
function setBeam(key: number, at: THREE.Vector3 | null): void {
  const old = beams.get(key);
  if (old) {
    old.hum?.();
    old.obj.removeFromParent();
    old.obj.geometry.dispose();
    (old.obj.material as THREE.Material).dispose();
    beams.delete(key);
  }
  if (!at) return;
  const obj = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 180, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0x5dff7a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  obj.position.set(at.x, at.y + 90, at.z);
  scene.add(obj);
  beams.set(key, { obj, until: gameTime + squadCfg.boxRespawn.time + 1, hum: audio.beamHum(at, squadCfg.boxRespawn.time) });
}

// a dropped gun's clatter on the floor; the menu's clicks
Dummy.onGunLands = (at) => audio.clatter(at);
document.getElementById("overlay")?.addEventListener("click", (e) => {
  const t = e.target as HTMLElement | null;
  if (t && (t.tagName === "BUTTON" || t.closest("button"))) audio.ui("click");
});

/** your heals (kit.ts) and your armour: the shield core, its EVO, a helmet */
const kit = new Kit();
kit.fill("kit");
const armor = new Armor();
let heal: { item: HealItem; startedAt: number; duration: number } | null = null;
/** the shield the heals and the HUD work to: the match's, else the range's */
const shieldCap = (): number => duel?.shieldMax ?? SHIELD_MAX;
/** a heal: the quick heal's pick (kit.ts), or the one the wheel chose */
function startHeal(now: number, want: HealItem | null = null): void {
  const v = vitalsTarget();
  if (!v || !v.alive || heal) return;
  const item = want && kit.items[want] > 0 ? want : want ? null : kit.pick(v.shield, shieldCap(), v.health, HEALTH_MAX);
  if (!item) {
    hud.notice(want ? `NO ${HEAL_ITEMS[want].name.toUpperCase()}` : kit.whyNot(v.shield, shieldCap(), v.health, HEALTH_MAX), now, 1);
    return;
  }
  // a gold backpack takes a quarter off every heal (kit.healTime)
  heal = { item, startedAt: now, duration: kit.healTime(item) / abilities.healScale };
  // walking pace, no sprint, while it runs
  player.healSlow = itemsCfg.healSlow;
}
/** the heal wheel: hold the heal key, move the mouse toward an item, let go */
let healHeldAt = -1;
let wheelOpen = false;
const wheelVec = { x: 0, y: 0 };
let wheelPick: HealItem | null = null;
/** the emote wheel (7, held): open, where the mouse has moved it, what it points at */
let emoteWheelOpen = false;
const emoteVec = { x: 0, y: 0 };
let emotePick: number | null = null;
/** the ping wheel (src/game/brplay.ts PING_INTENTS): held open, where the mouse points, and what it picked */
let pingHeldAt = -1;
let pingWheelOpen = false;
const pingVec = { x: 0, y: 0 };
let pingPick: number | null = null;
let emoteHeldAt = -1;
/** your emote playing (emotes.ts): which, and until when; your view steps back to watch it */
let emoting: { index: number; until: number } | null = null;
let emoteReadyAt = 0;
/** a tap of the key plays the last one again */
let lastEmote = 0;

/** play an emote: your figure does it for everyone, and the camera comes round to watch */
function playEmote(i: number, now: number): void {
  const def = EMOTES[i];
  const d = duel;
  if (!def || now < emoteReadyAt || !player.onGround || (d && (!d.alive || (d instanceof Duel && d.downed)))) return;
  emoting = { index: i, until: now + def.seconds };
  emoteReadyAt = now + def.seconds + emotesCfg.cooldown;
  lastEmote = i;
  selfFig?.emote(i);
  d?.localFx("emote", undefined, undefined, i);
}

/** your emote ends early (you moved, fired, were hit): the figure stops for everyone */
function stopEmote(): void {
  if (!emoting) return;
  emoting = null;
  selfFig?.emote(null);
  duel?.localFx("emote", undefined, undefined, EMOTE_STOP);
}
/** the heal in progress: cancelled by firing or aiming, applied when its time is up */
function updateHeal(now: number, cancel: boolean): void {
  const v = vitalsTarget();
  if (!heal || !v) {
    heal = null;
    player.healSlow = 1;
    return;
  }
  if (cancel || !v.alive) {
    heal = null;
    player.healSlow = 1;
    return;
  }
  const it = HEAL_ITEMS[heal.item];
  if (now - heal.startedAt < heal.duration) return;
  // the gold helmet doubles what the small heals give
  const small = heal.item === "cell" || heal.item === "syringe" ? armor.smallHealScale : 1;
  v.shield = Math.min(shieldCap(), v.shield + it.shield * small);
  v.health = Math.min(HEALTH_MAX, v.health + it.health * small);
  kit.items[heal.item]--;
  player.healSlow = 1;
  audio.healDone();
  // the others' recaps say you healed
  duel?.localFx("heal", undefined, undefined, HEAL_CODES.indexOf(heal.item));
  heal = null;
}
// ---------- abilities: JOLT and TRIAGE ----------
/** the key an action is on, as the HUD shows it */
const keyLabel = (a: Action): string => bindName(currentBinds()[a]?.[0] ?? "?").toUpperCase();
function pickAbility(id: AbilityId, now: number): void {
  if (!abilities.enabled) return;
  abilities.pick(id);
  const k = kitOf(id);
  hud.notice(`${k.kit}: ${k.tactical} (${keyLabel("ability")}), ${k.passive}, ${k.ult} (${keyLabel("ultimate")})`, now, 2.6);
  audio.reload();
}

/**
 * Health given back over time (MEDIC's PATCH and FIELD HEAL): so much a
 * second until it is done, in a match, while you are up. A second one while
 * one runs takes whichever gives more.
 */
let regen: { perSec: number; until: number } | null = null;
function startRegen(health: number, seconds: number, now: number): void {
  const perSec = health / Math.max(0.1, seconds);
  if (regen && now < regen.until && regen.perSec * (regen.until - now) >= health) return;
  regen = { perSec, until: now + seconds };
}
function stepRegen(now: number, dt: number): void {
  if (!regen) return;
  if (now >= regen.until) {
    regen = null;
    return;
  }
  // any kind of match with a health bar (a 1v1, the modes, a bot match, a battle royale), while you are up
  const d = duel as unknown as { health?: number; alive?: boolean; downed?: boolean } | null;
  if (!d || typeof d.health !== "number" || d.alive === false || d.downed === true) return;
  d.health = Math.min(HEALTH_MAX, d.health + regen.perSec * dt);
}
/**
 * HOOK's ultimate: a zipline put up in play, on every page (the one who used
 * it, and the others through its effect). They come down when their time is up
 * or the match ends.
 */
let ziplines: Array<{ until: number; take: () => void }> = [];
function putUpZipline(from: THREE.Vector3, to: THREE.Vector3, now: number): void {
  const a = from.clone().setY(from.y - 0.4);
  const take = deployZipline(scene, a, to.clone());
  ziplines.push({ until: now + KITS.hook.ult.seconds, take });
  audio.beacon(a);
}
function stepZiplines(now: number): void {
  if (!ziplines.length) return;
  const keep: typeof ziplines = [];
  for (const z of ziplines) {
    if (now < z.until) keep.push(z);
    else z.take();
  }
  ziplines = keep;
}
/** the match is over: every zipline anyone put up comes down */
function clearZiplines(): void {
  for (const z of ziplines) z.take();
  ziplines = [];
}
/**
 * The match's kit sight (SCOUT's scans, SMOKE's passive): every kind of match
 * has it, the ones built on Duel and the offline bot practice, so the page
 * asks for it rather than for a class.
 */
function kitSight(): { reveal(at: THREE.Vector3, fwd: THREE.Vector3 | null, range: number, cone: number, seconds: number): number; revealWhere(where: (at: THREE.Vector3) => boolean, seconds: number): number; revealOne(id: number, seconds: number): void; shown: ReadonlySet<Dummy> } | null {
  const d = duel as unknown as { reveal?: unknown; shown?: unknown } | null;
  return d && typeof d.reveal === "function" && d.shown instanceof Set ? (d as never) : null;
}

/** when something last hurt this player (WARD's HARD SHELL waits this out) */
let lastHurtAt = -Infinity;

/** where WARD's wall goes: a few metres in front of you on the ground, square to the way you face */
function wallSpot(): { x: number; y: number; z: number; deg: number } {
  const yaw = player.yaw;
  const r = yaw * DEG;
  const reach = KITS.ward.tactical.reach;
  const fx = -Math.sin(r);
  const fz = -Math.cos(r);
  const ahead = Math.max(1.2, Math.min(reach, solidHit(player.pos.clone().setY(player.pos.y + 1), new THREE.Vector3(fx, 0, fz), reach) - 0.4));
  return { x: player.pos.x + fx * ahead, y: player.pos.y, z: player.pos.z + fz * ahead, deg: yaw };
}

/** WARD's ultimate: a horseshoe of walls round a point, open the way you came from */
function putBastion(at: THREE.Vector3, yaw: number, now: number): void {
  const u = KITS.ward.ult;
  for (let i = 0; i < u.count; i++) {
    // spread across the way you face: the middle one ahead, the others round the sides
    const deg = yaw + (i - (u.count - 1) / 2) * (120 / Math.max(1, u.count));
    const r = deg * DEG;
    putWall(scene, at.x - Math.sin(r) * u.radius, at.y, at.z - Math.cos(r) * u.radius, deg, now, u.seconds);
  }
}

/** where a throw of this reach lands: what you look at, or the far end of it */
function aimPoint(reach: number): THREE.Vector3 {
  const eye = camera.position.clone();
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const wall = solidHit(eye, fwd, reach);
  const ground = fwd.y < -1e-3 ? eye.y / -fwd.y : Infinity;
  const t = Math.max(1, Math.min(reach, wall - 0.3, ground));
  const at = eye.clone().addScaledVector(fwd, t);
  return at.setY(Math.max(0, at.y - (t >= reach ? 1.4 : 0)));
}

/** SMOKE's clouds a step on, and its passive: an enemy standing in one of them is shown to you */
function stepSmokeKit(now: number, dt: number): void {
  stepSmoke(now, dt);
  if (!SMOKES.length || abilities.picked !== "smoke") return;
  kitSight()?.revealWhere((at) => !!smokeAt(at, now), 0.4);
}

/** RUNNER's OVERDRIVE: every move speed up until this time (game clock) */
let overdriveUntil = -Infinity;
/** the damage this player had dealt last frame, for the ultimate's meter */
let ultDamageSeen = 0;

/**
 * The ultimate key. A full meter spends itself on the kit's ultimate:
 * RUNNER's OVERDRIVE (faster, JOLT refilled), MEDIC's FIELD HEAL (health
 * over time for you and every mate close by, their pages healing them).
 */
function useUltimate(now: number): void {
  if (!abilities.enabled) return;
  if (!abilities.picked) {
    hud.notice(abilities.choosing ? "PICK A KIT FIRST" : "NO ABILITIES IN THIS MATCH", now, 1.4);
    return;
  }
  const k = kitOf(abilities.picked);
  if (abilities.ult < 1) {
    hud.notice(`${k.ult}: ${Math.floor(abilities.ult * 100)}%`, now, 0.8);
    return;
  }
  if (player.dropping || (duel instanceof Duel && (duel.downed || !duel.alive))) return;
  if (!abilities.tryUlt()) return;
  // (the meter starts filling again at once, so the HUD shows it near empty rather than exactly 0)
  const at = player.pos.clone();
  if (abilities.picked === "jolt") {
    overdriveUntil = now + KITS.runner.ult.seconds;
    abilities.fill();
    audio.jolt(1);
    duel?.localFx("ult", at, undefined, 1);
  } else if (abilities.picked === "ward") {
    const u = KITS.ward.ult;
    putBastion(player.pos.clone(), player.yaw, now);
    audio.clatter(player.pos);
    duel?.localFx("ult", player.pos.clone(), new THREE.Vector3(player.yaw, 0, 0), 6);
    hud.notice(`${u.name}: ${u.count} WALLS`, now, 1.6);
    return;
  } else if (abilities.picked === "smoke") {
    const u = KITS.smoke.ult;
    const from = camera.position.clone();
    const to = aimPoint(KITS.smoke.tactical.range);
    // across your view: the middle one where you look, the others either side of it
    const across = new THREE.Vector3(0, 1, 0).cross(to.clone().sub(from).setY(0).normalize()).normalize();
    for (let i = 0; i < u.count; i++) {
      const off = (i - (u.count - 1) / 2) * u.spread;
      throwSmoke(scene, from, to.clone().addScaledVector(across, off), now);
    }
    audio.throwNoise("bounce", to);
    duel?.localFx("ult", from, to, 5);
    hud.notice(`${u.name}: ${u.count} CLOUDS`, now, 1.6);
    return;
  } else if (abilities.picked === "hook") {
    const u = KITS.hook.ult;
    const eye = camera.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const reach = Math.min(u.length, solidHit(eye, fwd, u.length));
    const to = eye.clone().addScaledVector(fwd, Math.max(6, reach - 0.5));
    putUpZipline(eye, to, now);
    duel?.localFx("ult", eye, to, 4);
    hud.notice(`${u.name}: RIDE IT`, now, 1.6);
    return;
  } else if (abilities.picked === "scout") {
    const u = KITS.scout.ult;
    const n = kitSight()?.reveal(player.pos, null, u.range, 360, u.seconds) ?? 0;
    audio.beacon(player.pos);
    duel?.localFx("ult", at, undefined, 3);
    hud.notice(`${u.name}: ${n} ENEMY CONTACT${n === 1 ? "" : "S"}`, now, 1.8);
    return;
  } else {
    const u = KITS.medic.ult;
    startRegen(u.health, u.seconds, now);
    audio.reload();
    duel?.localFx("ult", at, undefined, 2);
  }
  hud.notice(k.ult, now, 1.6);
}
/**
 * The ability key. JOLT dashes the way the movement keys point (forward with
 * none); the streak and the sound go to the others. TRIAGE has nothing to
 * press: it says so.
 */
function useAbility(now: number): void {
  if (!abilities.enabled) return;
  if (!abilities.picked) {
    hud.notice(abilities.choosing ? `PICK AN ABILITY FIRST: ${keyLabel("pickAbility1")} JOLT, ${keyLabel("pickAbility2")} TRIAGE` : "NO ABILITY IN THIS MATCH", now, 1.4);
    return;
  }
  // WARD's tactical: a wall on the ground in front of you
  if (abilities.picked === "ward") {
    if (player.dropping || (duel instanceof Duel && (duel.downed || !duel.alive))) return;
    const left = abilities.wallLeft(now);
    if (left > 0) {
      hud.notice(`WALL: BACK IN ${left.toFixed(1)} S`, now, 0.6);
      return;
    }
    if (!abilities.tryWall(now)) return;
    const spot = wallSpot();
    putWall(scene, spot.x, spot.y, spot.z, spot.deg, now);
    audio.clatter(new THREE.Vector3(spot.x, spot.y, spot.z));
    duel?.localFx("wall", new THREE.Vector3(spot.x, spot.y, spot.z), new THREE.Vector3(spot.deg, 0, 0));
    return;
  }
  // SMOKE's tactical: a canister at what you look at, and a cloud where it lands
  if (abilities.picked === "smoke") {
    if (player.dropping || (duel instanceof Duel && (duel.downed || !duel.alive))) return;
    const left = abilities.canisterLeft(now);
    if (left > 0) {
      hud.notice(`CANISTER: BACK IN ${left.toFixed(1)} S`, now, 0.6);
      return;
    }
    if (!abilities.tryCanister(now)) return;
    const to = aimPoint(KITS.smoke.tactical.range);
    const from = camera.position.clone();
    throwSmoke(scene, from, to, now);
    audio.throwNoise("bounce", to);
    duel?.localFx("smoke", from, to);
    return;
  }
  // HOOK's tactical: GRAPPLE, a line at what you look at and a pull to it
  if (abilities.picked === "hook") {
    if (player.dropping || (duel instanceof Duel && (duel.downed || !duel.alive))) return;
    const left = abilities.grappleLeft(now);
    if (left > 0) {
      hud.notice(`GRAPPLE: BACK IN ${left.toFixed(1)} S`, now, 0.6);
      return;
    }
    if (!abilities.tryGrapple(now)) return;
    const t = KITS.hook.tactical;
    const eye = camera.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const hit = solidHit(eye, fwd, t.range);
    if (!Number.isFinite(hit) || hit >= t.range) {
      // nothing in reach: the line comes back and so does the cooldown
      abilities.refundGrapple();
      hud.notice("GRAPPLE: NOTHING IN REACH", now, 0.8);
      return;
    }
    const to = eye.clone().addScaledVector(fwd, hit);
    const pull = to.clone().sub(player.pos).normalize();
    player.impulse(pull.x * t.speed, Math.max(pull.y, 0) * t.speed + t.lift * t.speed, pull.z * t.speed);
    fx.jolt(player.pos.clone(), to, now);
    audio.zipOn(player.pos);
    duel?.localFx("grap", player.pos.clone(), to);
    if (input.pad.active) input.pad.rumble(0.3, 0.5, 100);
    return;
  }
  // SCOUT's tactical: PULSE, the enemies in front shown
  if (abilities.picked === "scout") {
    if (duel instanceof Duel && (duel.downed || !duel.alive)) return;
    const left = abilities.pulseLeft(now);
    if (left > 0) {
      hud.notice(`PULSE: BACK IN ${left.toFixed(1)} S`, now, 0.6);
      return;
    }
    if (!abilities.tryPulse(now)) return;
    const t = KITS.scout.tactical;
    const n = kitSight()?.reveal(player.pos, new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion), t.range, t.cone, t.seconds) ?? 0;
    audio.pingTick();
    hud.notice(n > 0 ? `PULSE: ${n} ENEMY${n > 1 ? " CONTACTS" : ""}` : "PULSE: NOBODY IN FRONT", now, 1.4);
    return;
  }
  // MEDIC's tactical: PATCH, health back over a few seconds
  if (abilities.picked === "triage") {
    if (duel instanceof Duel && (duel.downed || !duel.alive)) return;
    const left = abilities.patchLeft(now);
    if (left > 0) {
      hud.notice(`PATCH: BACK IN ${left.toFixed(1)} S`, now, 0.6);
      return;
    }
    if (!abilities.tryPatch(now)) return;
    const t = KITS.medic.tactical;
    startRegen(t.health, t.seconds, now);
    audio.reload();
    duel?.localFx("patch", player.pos.clone());
    return;
  }
  if (player.dropping) return;
  // down (a battle royale squad): no dash
  if (duel instanceof Duel && duel.downed) return;
  const left = abilities.cooldownLeft(now);
  if (left > 0) {
    // a dash just gone: the second waits out the gap quietly; empty: when the next is back
    if (abilities.charge(now).charges === 0) hud.notice(`JOLT: NEXT CHARGE IN ${left.toFixed(1)} S`, now, 0.6);
    return;
  }
  const d = player.moveDir(scriptInput ?? input);
  const from = player.pos.clone();
  if (!abilities.tryJolt(now)) return;
  if (!player.jolt(d.x, d.z, JOLT.distance, JOLT.duration, JOLT.exitSpeedHu * HU)) {
    abilities.refund();
    return;
  }
  // where it will end: a wall ahead stops it
  const dir = new THREE.Vector3(d.x, 0, d.z);
  const reach = Math.max(0, Math.min(JOLT.distance, solidHit(from.clone().setY(from.y + 1), dir, JOLT.distance) - MOVE.radius));
  const to = from.clone().addScaledVector(dir, reach);
  // your own streak only from behind: in first person you are inside it
  if (thirdPerson) fx.jolt(from, to, now);
  audio.jolt(1);
  duel?.localFx("jolt", from, to);
  selfFig?.jolt();
  joltedAt = gameTime;
  // the feel: the view rolls toward a sideways dash (none for straight ahead or back), the pad kicks
  const yawR = player.yaw * DEG;
  const lateral = d.x * Math.cos(yawR) - d.z * Math.sin(yawR);
  joltRollSide = Math.abs(lateral) > 0.3 ? Math.sign(lateral) * Math.min(1, Math.abs(lateral)) : 0;
  if (input.pad.active) input.pad.rumble(JOLT.feel.rumble[0], JOLT.feel.rumble[1], JOLT.feel.rumble[2]);
}
/** a JOLT's roll: which side (+1 right), and the envelope from joltedAt */
let joltRollSide = 0;
function joltRoll(now: number): number {
  const t = now - joltedAt;
  const f = JOLT.feel;
  const env = t < 0 ? 0 : t < f.rollIn ? t / f.rollIn : Math.max(0, 1 - (t - f.rollIn) / f.rollOut);
  return env * f.roll * joltRollSide;
}
/** a ping twice within this long is an enemy ping (the game's double tap), and when the last went */
const PING_DOUBLE = 0.35;
let lastPingAt = -Infinity;
/** the match's phase last frame, and whether you were in the drop: the card comes up on a change */
let lastMatchPhase: string | null = null;
let wasDropping = false;
/** extra field of view through a JOLT, eased */
let joltFov = 0;

/** the vitals heals work on: the match's, or the range's when the dummies shoot back */
const vitalsTarget = (): { shield: number; health: number; alive: boolean } | null => duel ?? (rangeCombat?.on ? rangeCombat : (tour?.healVitals ?? null));
/** the guided tour of the range (tour.ts): it watches, the steps move on when you do each thing */
const tour = new Tour(scene);
/** throws made (the tour's grenade step) and whether a JOLT has gone this step */
let throwsMade = 0;
let joltedAt = -Infinity;
function tourCheck(now: number): TourCheck {
  return {
    pos: player.pos,
    sprinting: player.sprinting,
    sliding: player.sliding,
    onGround: player.onGround,
    vy: player.vel.y,
    mantling: player.mantling,
    climbing: player.climbing,
    hits: stats.hits,
    reloading: loadout.active.state.reloading,
    swapping: loadout.swapping,
    healing: heal !== null,
    joltUsed: now - joltedAt < 0.5,
    thrown: throwsMade,
  };
}
tour.onStep = (title) => {
  hud.notice(`TOUR: ${title}`, gameTime, 1.4);
  audio.countdown(false);
};
tour.onDone = () => {
  hud.notice("TOUR COMPLETE", gameTime, 3);
  audio.stinger("won");
  try {
    localStorage.setItem("range.tour.done", "1");
  } catch {
    /* ignore */
  }
};

// ---------- throwables: the frag, the arc star, thermite ----------
/** what you carry, and the one readied (the range never runs out) */
const ordnance = new Ordnance();
/** the bullets' impact handler for this frame (the frame makes it): a blast's hits go through it too */
let impactSink: ((e: ImpactEvent) => void) | null = null;
/** figures burning after leaving the fire: by figure, how much is left and when the next bit lands */
const afterburns = new Map<string, { left: number; next: number; per: number }>();
/** a figure by its throwables id: a match's player or bot by its id, a range dummy by -2 - its index */
/**
 * Where the recent hits on you came from, for the HUD's damage direction arcs.
 * A position rather than an angle, because you keep turning after the hit and
 * the arc has to keep pointing at the shooter, not at where they were on
 * screen when it landed.
 */
const damageFrom: Array<{ id: number; x: number; z: number; at: number }> = [];
function noteDamageFrom(id: number): void {
  const fig = figureById(id);
  if (!fig) return;
  const p = fig.group.position;
  const cfg = hudCfg.damageDir;
  const same = damageFrom.find((e) => e.id === id || Math.hypot(e.x - p.x, e.z - p.z) < cfg.merge);
  if (same) {
    same.id = id;
    same.x = p.x;
    same.z = p.z;
    same.at = gameTime;
  } else damageFrom.unshift({ id, x: p.x, z: p.z, at: gameTime });
  damageFrom.length = Math.min(damageFrom.length, cfg.max);
}
/** the arcs as the HUD draws them this frame: angle from straight ahead, clockwise, and what is left of each */
function damageDirs(): Array<{ angle: number; alpha: number }> {
  const cfg = hudCfg.damageDir;
  const yawR = player.yaw * DEG;
  const fx = -Math.sin(yawR);
  const fz = -Math.cos(yawR);
  const rx = Math.cos(yawR);
  const rz = -Math.sin(yawR);
  const out: Array<{ angle: number; alpha: number }> = [];
  for (let i = damageFrom.length - 1; i >= 0; i--) {
    const e = damageFrom[i];
    const age = gameTime - e.at;
    if (age > cfg.life || age < 0) {
      damageFrom.splice(i, 1);
      continue;
    }
    const dx = e.x - player.pos.x;
    const dz = e.z - player.pos.z;
    out.push({ angle: Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz), alpha: 1 - age / cfg.life });
  }
  return out;
}

function figureById(id: number): Dummy | null {
  if (duel) return duel.avatars.find((a) => duel!.remoteOf(a)?.id === id) ?? null;
  return id <= -2 ? (dummies[-2 - id] ?? null) : null;
}
/** the figures a throw can reach: the match's (and you, for the others' throws), or the range's dummies */
function throwTargets(): ThrowTarget[] {
  const out: ThrowTarget[] = [];
  if (duel) {
    for (const a of duel.avatars) {
      const r = duel.remoteOf(a);
      if (r && a.group.visible && !a.knocked) out.push({ id: r.id, feet: a.group.position });
    }
    if (duel.alive) out.push({ id: duel.id, feet: player.pos });
  } else dummies.forEach((d, i) => d.group.visible && !d.knocked && out.push({ id: -2 - i, feet: d.group.position }));
  return out;
}
/** your throw's damage to a figure: through the bullets' path (the numbers, the marker, the match's hit) */
function throwHit(id: number, amount: number, kind: ThrowKind, from: THREE.Vector3): void {
  const a = figureById(id);
  if (!a || amount <= 0 || a.knocked) return;
  // a fire or a late frag outside the fight (a countdown, a round's end) hurts nobody
  if (duel && duel.phase !== "fight") return;
  if (duel && (duel instanceof Duel ? duel.isAlly(id) : false)) return;
  const point = a.group.position.clone().setY(a.group.position.y + 1.2);
  const report = a.hit(gameTime, "body", amount, 1, 1, point);
  impactSink?.({ dummy: a, report, target: null, targetHead: false, damage: report?.amount ?? 0, point, distance: point.distanceTo(from), weapon: kind });
}
const throwables = new Throwables(scene, {
  onStrike: (t: Thrown, target: number) => {
    if (!t.mine) return;
    if (t.kind === "frag") throwHit(target, THROWABLES.frag.direct, "frag", t.pos);
    else if (t.kind === "arcstar") throwHit(target, THROWABLES.arcstar.stick, "arcstar", t.pos);
  },
  onBlast: (t: Thrown, at: THREE.Vector3) => {
    if (t.kind !== "frag" && t.kind !== "arcstar") return;
    // someone else's: if it was a bot's, the side running the bots works out its damage
    if (!t.mine) {
      duel?.botBlast?.(t.owner, at, t.kind);
      return;
    }
    // everyone in reach and in sight of it (you are not hurt by your own)
    for (const tg of throwTargets()) {
      if (duel && tg.id === duel.id) continue;
      const chest = tg.feet.clone().setY(tg.feet.y + 1.1);
      const dist = chest.distanceTo(at);
      const dmg = blastDamage(t.kind, dist);
      if (dmg > 0 && Throwables.inSight(at, chest)) throwHit(tg.id, dmg, t.kind, at);
    }
  },
  onFireTick: (f: FireStrip) => {
    if (!f.mine) return;
    const now = gameTime;
    for (const tg of throwTargets()) {
      if (duel && tg.id === duel.id) continue;
      const key = String(tg.id);
      if (Throwables.inFire(f, tg.feet)) {
        throwHit(tg.id, THROWABLES.thermite.tickDamage, "thermite", f.a.clone().lerp(f.b, 0.5));
        // the afterburn starts over each time they are in it
        const ticks = Math.round(THROWABLES.thermite.afterburnTime / THROWABLES.thermite.tick);
        afterburns.set(key, { left: ticks, next: now + THROWABLES.thermite.tick, per: THROWABLES.thermite.afterburn / ticks });
      }
    }
  },
  onSound: (kind, at, what) => {
    if (kind === "blast") {
      audio.blast(what === "arcstar" ? "arcstar" : "frag", at);
      feelBlast(at);
    }
    else audio.throwNoise(kind, at);
  },
});
/** the highest floor under a point, at or below it: where a blast's scorch lies */
function floorUnder(at: THREE.Vector3): number {
  let y = 0;
  for (const s of RANGE_SOLIDS) if (at.x >= s.minX && at.x <= s.maxX && at.z >= s.minZ && at.z <= s.maxZ && s.top <= at.y + 0.3 && s.top > y) y = s.top;
  return y;
}
/** a blast's shake, how hard and since when (hud.json blasts) */
let blastShake = 0;
let blastShakeAt = -Infinity;
/**
 * A grenade gone off, felt: the view shakes within its radius (falling off
 * with the square of the distance; the screen-shake setting scales it, and
 * Off turns it off), your ears ring close to it, and it leaves a scorch and a
 * column of smoke. It used to be a ball and a ring for half a second.
 */
function feelBlast(at: THREE.Vector3): void {
  const B = hudCfg.blasts;
  const d = at.distanceTo(player.eyePosition());
  if (d < B.shakeRadius) {
    blastShake = Math.max(gameTime - blastShakeAt < B.shakeTime ? blastShake : 0, blastShakeDeg(d));
    blastShakeAt = gameTime;
  }
  if (d < B.ringRadius) audio.ringing(B.ringTime * (1 - d / B.ringRadius / 2), B.ringHz);
  impacts.blast(at, floorUnder(at), gameTime);
}
/** the afterburn: out of the fire, the rest of the burn lands a bit at a time */
function updateAfterburns(now: number): void {
  for (const [key, b] of afterburns) {
    if (now < b.next) continue;
    const f = throwables.fires.find((x) => x.mine && Throwables.inFire(x, figureById(Number(key))?.group.position ?? new THREE.Vector3(1e9, 0, 1e9)));
    // still in a fire of yours: the fire's own ticks do it
    if (f) {
      b.next = now + THROWABLES.thermite.tick;
      continue;
    }
    throwHit(Number(key), b.per, "thermite", figureById(Number(key))?.group.position ?? player.pos);
    b.left--;
    b.next = now + THROWABLES.thermite.tick;
    if (b.left <= 0) afterburns.delete(key);
  }
}
/** when the arc preview is next worked out */
let previewNextAt = 0;
const THROWABLES_ANY = (): boolean => ordnance.endless || Object.values(ordnance.counts).some((n) => n > 0);
/** throw what is readied, the way you look, a little up, with some of your own speed */
function throwReadied(now: number): void {
  const kind = ordnance.spend(now);
  if (!kind) return;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const from = player.eyePosition().addScaledVector(fwd, 0.45).addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.12, 0));
  const vel = throwVelocity(kind, fwd);
  throwables.throw(kind, from, vel, duel ? duel.id : -1, true, gameTime, player.pos);
  duel?.localFx("throw", from, vel, throwCode(kind));
  gunRow(kind).shots++;
  throwsMade++;
  audio.whoosh();
  void now;
}
function throwVelocity(kind: ThrowKind, fwd: THREE.Vector3): THREE.Vector3 {
  // a paint bomb is thrown at the ground in front of you, so it leaves the
  // hand a little slower than a frag (src/config/paint.json)
  const speed = isPaintThrow(kind) ? PAINT.throw.speed : (THROWABLES as unknown as Record<string, { speed: number }>)[kind].speed;
  return fwd
    .clone()
    .multiplyScalar(speed)
    .add(new THREE.Vector3(0, 2.2, 0))
    .addScaledVector(player.vel, 0.6);
}

/** the battle royale from your side: E, the pads, pings (brplay.ts) */
const brPlay = new BrPlay({
  keyLabel: (a) => keyLabel(a),
  notice: (t) => hud.notice(t, gameTime, 2),
  sound: (k) => (k === "ping" ? audio.hitTier("white") : k === "revive" ? audio.healDone() : audio.whoosh()),
  onScan: () => giveEvo(brCfg.console.evo, "RING CONSOLE"),
  onRevive: () => {
    const R = squadCfg.evo.revive;
    giveEvo(R[Math.min(revivesDone, R.length - 1)], "REVIVE");
    revivesDone++;
  },
  beam: (at) => {
    setBeam(-1, at);
    duel?.localFx("beam", at ?? undefined, undefined, at ? 1 : 0);
    // the bots hear it a long way off
    if (at && duel instanceof BrMatch) duel.hearBeam(at);
  },
});
// What you carry, for the walk-over pickup and the reach list's grey-out. The
// looting shipped with this hook documented and never set, so in a real match
// the walk-over pickup did nothing at all: with no carry state it takes
// nothing, because it cannot tell ammo for your gun from ammo for someone
// else's.
brPlay.carrying = () => {
  const held = loadout.slots.filter((s) => !s.empty);
  return {
    ammo: held.map((s) => ammoTypeOf(s.id)),
    healRoom: kit.room,
    ammoRoom: Object.fromEntries(held.map((s) => [ammoTypeOf(s.id), loadout.ammo.room(ammoTypeOf(s.id))])),
    mag: held.length ? Math.min(...held.map((s) => s.magLevel)) : 0,
  };
};
/** first person when you watch a squad mate (X switches to behind them) */
let spectateFirst = true;
/**
 * Out with others still standing: who you are watching. The page keeps its
 * place in the match's list (duel.spectateList) rather than being handed
 * whoever is first every frame, so you stay with the one you picked until
 * they are out; fire takes the next and aim the one before.
 */
let watchIndex = 0;
let watchName = "";

/**
 * An item you took: a gun into an empty slot or in place of the one in hand
 * (which goes down where you stand), ammo and heals into the pack (what does
 * not fit goes back down), an attachment onto whichever gun takes it, a
 * helmet on, a banner carried.
 */
function applyLoot(it: LootItem): void {
  const d = duel instanceof BrMatch ? duel : null;
  // a care package's loot: its EVO, once a package
  if (it.pod !== undefined && !podsPaid.has(it.pod)) {
    podsPaid.add(it.pod);
    giveEvo(squadCfg.evo.carePackage, "CARE PACKAGE");
  }
  const here = player.pos.clone();
  const putBack = (x: LootItem) => d?.dropLoot(x, here);
  const label = lootLabel(it);
  switch (it.kind) {
    // a supply bin: opening it is taking it, and what it held is on the floor now; nothing goes in the pack
    case "bin":
      return;
    case "weapon": {
      const empty = loadout.emptySlot;
      const into = empty >= 0 ? empty : loadout.activeIndex;
      if (empty >= 0) {
        loadout.give(empty, it.id, it.mag ?? 0, (it.attach ?? {}) as Parameters<typeof loadout.give>[3]);
        if (loadout.activeIndex !== empty) loadout.requestSwap(empty, gameTime);
      } else {
        const s = loadout.active;
        putBack({ kind: "weapon", id: s.id, n: 1, rarity: "common", mag: s.magLevel, attach: { ...s.attach }, ...(s.hopLock ? { hop: s.hopLock.have } : {}) });
        loadout.give(loadout.activeIndex, it.id, it.mag ?? 0, (it.attach ?? {}) as Parameters<typeof loadout.give>[3]);
      }
      // Seasons 29 and 30: a gun with a locked hop-up earns it with damage (a care-package gun, or one already unlocked, has it)
      const lockMod = lockedHopupFor(it.id);
      const slot = loadout.slots[into];
      if (lockMod && slot.attach.hopup !== lockMod) slot.hopLock = { mod: lockMod, have: it.hop ?? 0, need: LOCKED_HOPUPS[lockMod].unlock };
      audio.swap();
      break;
    }
    case "ammo": {
      // as much as fits; the rest goes back down where it lay (ammo.json carry)
      const put = loadout.ammo.add(it.id as AmmoType, it.n);
      if (put < it.n) {
        putBack({ ...it, n: it.n - put });
        hud.notice(put ? `${label}: ${put} TAKEN, THE REST IS FULL` : `${label}: FULL`, gameTime, 1.4);
        if (!put) return;
      }
      audio.reloadStep("in");
      break;
    }
    case "heal": {
      const put = kit.add(it.id as HealItem, it.n);
      if (put < it.n) {
        putBack({ ...it, n: it.n - put });
        hud.notice(put ? `${label}: ${put} TAKEN, THE REST IS FULL` : `${label}: FULL`, gameTime, 1.4);
        return;
      }
      audio.reloadStep("out");
      break;
    }
    case "attach":
    case "hopup": {
      const order = [loadout.activeIndex, 1 - loadout.activeIndex];
      let ok = false;
      if (it.id.startsWith("mag:")) ok = order.some((i) => loadout.fitMag(i, Number(it.id.slice(4))));
      else {
        const slot = it.kind === "hopup" ? "hopup" : it.id.startsWith("optic_") ? "optic" : it.id.startsWith("barrel_") ? "barrel" : it.id.startsWith("stock_") ? "stock" : "laser";
        ok = order.some((i) => loadout.fitAttachment(i, slot, it.id));
      }
      if (!ok) {
        putBack(it);
        hud.notice(`${label} FITS NEITHER GUN`, gameTime, 1.4);
        return;
      }
      audio.reloadStep("bolt");
      break;
    }
    case "backpack":
      // more room for every heal, and at gold, faster heals; a worse one stays down
      if (!kit.takePack(it.id as BackTier)) {
        putBack(it);
        hud.notice(`${label}: YOURS IS AS GOOD`, gameTime, 1.2);
        return;
      }
      hud.notice(`${label}: MORE HEALS FIT`, gameTime, 1.4);
      audio.reloadStep("out");
      break;
    case "knockdown":
      // the shield you crawl behind when you are knocked; a gold one gets you up once
      if (!kd.take(it.id as KnockTier, armor.level)) {
        putBack(it);
        hud.notice(`${label}: YOURS IS AS GOOD`, gameTime, 1.2);
        return;
      }
      hud.notice(kd.canSelfRevive ? `${label}: CARRIES A SELF-REVIVE` : label, gameTime, 1.4);
      audio.shieldBreak();
      break;
    case "helmet":
      armor.helmet = it.id === "red" ? "red" : "gold";
      if (d) d.shieldMax = armor.shieldMax;
      audio.shieldBreak();
      break;
    case "keycard":
      // the vault's keycard: the way to the vault is marked while you hold it (brmatch.ts stepVault)
      if (duel instanceof BrMatch) duel.myKey = true;
      hud.notice("VAULT KEYCARD  ·  THE VAULT IS AT THE WELL", gameTime, 3);
      audio.pickup?.();
      break;
    case "banner":
      // your own (back from your box after a Deathbox Respawn): nothing to carry
      if (d && it.owner === d.id) return;
      brPlay.carry(it, gameTime);
      return;
    case "grenade": {
      if (!isThrowKind(it.id)) return;
      const put = ordnance.add(it.id, it.n);
      if (put < it.n) {
        putBack({ ...it, n: it.n - put });
        hud.notice(put ? `${label}: ${put} TAKEN, THE REST IS FULL` : `${label}: FULL`, gameTime, 1.4);
        return;
      }
      audio.throwNoise("pin", null);
      break;
    }
  }
  hud.notice(label, gameTime, 1);
}

/** the killer's gun for the killcam's view, resolved once each */
const killcamGuns = new Map<string, ResolvedWeapon>();
function killcamGun(id: string): ResolvedWeapon {
  let w = killcamGuns.get(id);
  if (!w) {
    try {
      w = resolveWeapon(id, 0);
    } catch {
      w = resolveWeapon("rspn101", 0);
    }
    killcamGuns.set(id, w);
  }
  return w;
}

/** the full map (M); shown by itself through a battle royale's drop */
let mapOpen = false;
/** until when the drop keeps the full map up by itself (squad.json dive.mapSeconds) */
let dropMapUntil = 0;
/** the battle royale place you are in, and when its name was last shown (the arrival card) */
let placeHere: string | null = null;
/** the callout for the ground you are on, and the last one said (arenas) */
let calloutNow: string | null = null;
let calloutWas: string | null = null;
const placeShownAt = new Map<string, number>();
/** on the ship in a squad: the jumpmaster (the host) you are linked to, whose jump takes you with them */
let linkedTo: number | null = null;
/** following that jumpmaster down: their id, until you break off or the ground comes close */
let following: number | null = null;
/** where the formation puts you behind the jumpmaster this frame */
const leashAt = new THREE.Vector3();
/**
 * The tests' switch (tools/e2e.ts sets it on every page): the drop goes
 * straight onto the squad's place, as it did before the ship, for the checks
 * that are about what happens after a landing and not about the ship.
 */
const straightDrop = (): boolean => (window as unknown as { __straightDrop?: boolean }).__straightDrop === true;
/** the tests' other switch: no Gulag, for the checks of what a plain death does (the Gulag's own section turns it back on) */
const noGulag = (): boolean => (window as unknown as { __noGulag?: boolean }).__noGulag === true;
/** and no vault (its guard is a bot more on the map), for the checks that count the bots; the vault's own section turns it back on */
const noVault = (): boolean => (window as unknown as { __noVault?: boolean }).__noVault === true;
/** the callbacks every kind of match gets */
function wireMatch(d: MatchLike, kind: MatchKind): void {
  // dropping into a match: the short card, over the match already starting
  // underneath it. Nothing waits for it (src/ui/intro.ts).
  if (!NO_INTRO) void intro.play("match");
  d.onRespawn = () => respawnForMatch(d);
  // a guest with a seat key (a host that gives one) gets back in after a dropped connection
  if (d instanceof Duel && d.role === "guest" && mySeat) d.onHostLost = () => getBackIn(d);
  // host migration: the host's heir is sent each seat's key; the heir takes the code over when the host goes
  if (d instanceof Duel) {
    d.seatKeys = (ids) => (hosting ? ids.map((id) => [id, (hosting as HostHandle).keyOf(id)] as [number, string]) : []);
    if (d.role === "guest" && mySeat) d.onTakeOver = (snap) => takeOverHosting(d, snap);
  }
  // the lobby's host handover
  if (d instanceof Duel) d.onHandover = (m, from) => onHandover(d, m, from);
  d.onHurt = () => {
    stopEmote();
    lastHurtAt = gameTime;
    hud.hurt(gameTime);
    audio.hurt(d.shield > 0);
    input.pad.rumble(0.6, 0.3, 120);
  };
  // gunfire is heard from where it was fired (onShotFired, below), once a trigger pull
  d.onRemoteShot = null;
  d.onNotice = (t) => hud.notice(t, gameTime, 1);
  d.onEnd = (reason) => endMatch(reason);
  d.onFeed = (text, mine, neutral) => hud.feed(text, gameTime, neutral ? "#c8d0d8" : mine ? P.feedAlly : P.feedEnemy);
  // someone else's JOLT: the streak where it went, and its sound by distance
  d.onRemoteFx = (k, from, a, b, n) => {
    remoteFxLog.push({ k, from });
    if (remoteFxLog.length > 20) remoteFxLog.shift();
    // a MEDIC mate's FIELD HEAL: close enough, and it is health over time for this player too
    if (k === "ult" && n === 2 && a && d instanceof Duel && d.isFriend(from)) {
      if (player.pos.distanceTo(a) <= KITS.medic.ult.radius) {
        startRegen(KITS.medic.ult.health, KITS.medic.ult.seconds, gameTime);
        hud.notice(`${KITS.medic.ult.name} FROM ${d.nameFor(from) ?? "A MATE"}`, gameTime, 1.4);
      }
      return;
    }
    // someone else's GRAPPLE: the line where it went; their ZIP LINE: the same rope here
    if (k === "grap" && a && b) {
      fx.jolt(a, b, gameTime);
      audio.zipOn(a);
      return;
    }
    if (k === "ult" && n === 4 && a && b) {
      putUpZipline(a, b, gameTime);
      return;
    }
    // someone else's canister, or their screen of three: the same clouds here
    if (k === "wall" && a && b) {
      putWall(scene, a.x, a.y, a.z, b.x, gameTime);
      audio.clatter(a);
      return;
    }
    if (k === "ult" && n === 6 && a && b) {
      putBastion(a, b.x, gameTime);
      audio.clatter(a);
      return;
    }
    if (k === "smoke" && a && b) {
      throwSmoke(scene, a, b, gameTime);
      audio.throwNoise("bounce", b);
      return;
    }
    if (k === "ult" && n === 5 && a && b) {
      const u = KITS.smoke.ult;
      const across = new THREE.Vector3(0, 1, 0).cross(b.clone().sub(a).setY(0).normalize()).normalize();
      for (let i = 0; i < u.count; i++) throwSmoke(scene, a, b.clone().addScaledVector(across, (i - (u.count - 1) / 2) * u.spread), gameTime);
      audio.throwNoise("bounce", b);
      return;
    }
    if (k === "ult" || k === "patch") return;
    // a quick chat line: its number, said in the feed under their name
    if (k === "chat" && typeof n === "number") {
      sayQuick(d.nameFor(from) ?? "PLAYER", n, false);
      return;
    }
    // a squad mate scanned a Ring Console: the circle after next is on our map too
    // someone's emote: their figure plays it (or stops)
    // someone's line for the end table
    if (k === "sum" && a && duel) {
      endTable.set(from, { name: duel.nameFor(from) ?? `PLAYER ${from + 1}`, kills: Math.max(0, Math.round(a.x)), damage: Math.max(0, a.y), place: Math.max(0, Math.round(a.z)) });
      return;
    }
    // the finish on someone's gun
    if (k === "fin" && typeof n === "number") {
      if (n >= 0 && n < FINISHES.length) remoteFinishes.set(from, n);
      return;
    }
    // someone's banner card
    if (k === "banner" && typeof n === "number") {
      remoteBanners.set(from, n);
      return;
    }
    // someone's spray, where they put it
    if (k === "spray" && a && b && typeof n === "number") {
      sprays.place(from, a, b, n, gameTime);
      audio.spray(a);
      return;
    }
    if (k === "emote" && typeof n === "number") {
      figureById(from)?.emote(n === EMOTE_STOP ? null : n);
      return;
    }
    // a squad mate's Gulag: in it, back from it, or out
    if (k === "gulag" && typeof n === "number" && d instanceof BrMatch) {
      d.hearGulag(from, n);
      const who = d.nameFor(from);
      hud.notice(n === 1 ? `${who} IS IN THE GULAG` : n === 2 ? `${who} WON THE GULAG AND IS DROPPING BACK IN` : `${who} LOST IN THE GULAG`, gameTime, 2.5);
      return;
    }
    if (k === "rcon" && a && typeof n === "number" && d instanceof BrMatch) {
      d.hearConsole(a, n);
      hud.notice(`${d.nameFor(from)} SCANNED A RING CONSOLE: THE RING AFTER NEXT IS ON THE MAP`, gameTime, 2.5);
      return;
    }
    // the jumpmaster jumped: a squad mate still linked to them goes too, and follows them down
    if (k === "jm" && player.aboard && linkedTo === from && d instanceof BrMatch) {
      linkedTo = null;
      jumpOut(d, `FOLLOWING ${d.nameFor(from)}  ·  ${keyLabel("crouch")} BREAKS OFF`);
      following = from;
      return;
    }
    // someone's throw: its flight, bounce and blast here too (their side sends the damage)
    const tk = throwFromCode(n);
    if (k === "throw" && a && b && tk) throwables.throw(tk, a, b, from, false, gameTime);
    if (k === "jolt" && a && b) {
      fx.jolt(a, b, gameTime);
      audio.joltAt(a);
    }
    // a squad mate's Deathbox Respawn: the beam while it runs
    if (k === "beam") {
      setBeam(from, n === 1 && a ? a : null);
      if (n === 1 && a && duel instanceof BrMatch) duel.hearBeam(a);
    }
    // A care package or a loadout crate (brmatch.ts: n 0 or 2 called, 1
    // landed): the horn when it is called and the thump when it lands, each
    // heard only so far (br.json podHeard). Past 25 m the audio holds each
    // back by its distance over the speed of sound, so a far one comes late.
    if (k === "pod" && a) {
      const far = Math.hypot(a.x - player.pos.x, a.z - player.pos.z);
      if (n === 1) {
        if (far <= brCfg.podHeard.thump) audio.bodyFall(a);
      } else if (far <= brCfg.podHeard.horn) audio.horn(a);
    }
  };
  // abilities are the match's: on or off, nothing picked yet (the card comes at the countdown or the landing)
  abilities.reset(d.abilities);
  tour.stop();
  drill.stop();
  // the killcam's recording and the recap's log
  recorder.clear();
  killcam.stop();
  recap = null;
  // who you have hurt is this match's: an id is reused by the next match's
  // bots, and a stale entry would show their plate before you touched them
  damagedAt.clear();
  newLife(d);
  d.onDamaged = (from, amount, head, weapon, dist) => {
    dlog.hit({ t: realNow(), from, to: d.id, amount, head, weapon, dist });
    noteDamageFrom(from);
    // an arc star: slowed, for longer the more it did
    if (weapon === "arcstar") {
      player.arcSlowUntil = Math.max(player.arcSlowUntil, gameTime + arcSlowFor(amount));
      player.arcSlowScale = THROWABLES.arcstar.slowScale;
    }
    if (from === -1) audio.ringTick();
  };
  d.onEliminated = (by) => onEliminated(d, by);
  d.onShotFired = (id, o, dir, w) => {
    recorder.shot(realNow(), id, o, dir, w);
    if (id === d.id) return;
    // SCOUT's SHARP EARS: an enemy firing within earshot shows itself
    if (abilities.enabled && abilities.picked === "scout" && !(d instanceof Duel && d.isFriend(id)) && player.pos.distanceTo(o) <= KITS.scout.hearing) kitSight()?.revealOne(id, KITS.scout.tactical.seconds);
    const t = realNow();
    if (t - (lastShotSound.get(id) ?? -1) > 0.03) {
      lastShotSound.set(id, t);
      audio.gun(w, o);
    }
  };
  d.onHealSeen = (id, item) => dlog.heal({ t: realNow(), id, item });
  brPlay.reset();
  if (d instanceof ArenaMode) d.onGun = (id) => {
    applyModeGun(id);
    if (d.alive) audio.swap();
  };
  // Search's bomb, beeping where it lies (quicker, and higher in its last ten seconds)
  if (d instanceof ArenaMode) d.onBeep = (at, left) => audio.bombBeep(at, left < 10);
  // a team mate's SCOUT scan, in the modes (a battle royale's marks go through onMark below)
  if (d instanceof Duel && !(d instanceof BrMatch)) d.onMark = (k, _from, _at, _label, target) => void (k === "scan" && target >= 0 && d.revealOne(target, KITS.scout.tactical.seconds));
  if (d instanceof BrMatch) {
    d.onBinOpened = (at) => audio.bin(at, true);
    d.onKnockSeen = (victim, by) => {
      evoForKnock(victim, by);
      // Resurgence: a knock by your side cuts your wait to come back
      if (d instanceof BrMatch) {
        const cut = d.sideKill(victim, by);
        if (cut > 0) hud.notice(`-${cut} S TO YOUR REDEPLOY  ·  ${d.nameFor(by)} GOT ONE`, gameTime, 1.6);
      }
    };
    revivesDone = 0;
    podsPaid.clear();
    damagedAt.clear();
    evoPaid.clear();
    // the knockdown shield: raised and facing the shot, it takes what it can
    d.downedBlock = (amount, from) => {
      if (!kd.up || kd.hp <= 0) return amount;
      const at = figureById(from)?.group.position;
      if (!at) return amount;
      const yawR = player.yaw * DEG;
      const fx = -Math.sin(yawR);
      const fz = -Math.cos(yawR);
      const dx = at.x - player.pos.x;
      const dz = at.z - player.pos.z;
      const dl = Math.hypot(dx, dz) || 1;
      if ((fx * dx + fz * dz) / dl < Math.cos(squadCfg.kdShield.arc * DEG)) return amount;
      const r = kd.absorb(amount);
      audio.hitTier("blue");
      if (r.broke) {
        hud.notice("KNOCKDOWN SHIELD BROKEN", gameTime, 1.4);
        audio.shieldBreak();
      }
      return r.through;
    };
    d.onLootTaken = (it) => applyLoot(it);
    // The loadout crate (brmatch.ts): the two guns you built go straight into
    // your two slots, and what you were carrying goes down at your feet the
    // way a swap puts it down, so nothing you found is lost to the crate.
    // The ammo that came with them goes in the pack.
    d.onLoadoutDrop = (items) => {
      const here = player.pos.clone();
      items
        .filter((it) => it.kind === "weapon")
        .slice(0, loadout.slots.length)
        .forEach((g, i) => {
          const s = loadout.slots[i];
          if (!s.empty) d.dropLoot({ kind: "weapon", id: s.id, n: 1, rarity: "common", mag: s.magLevel, attach: { ...s.attach }, ...(s.hopLock ? { hop: s.hopLock.have } : {}) }, here);
          loadout.give(i, g.id, g.mag ?? 0, (g.attach ?? {}) as Parameters<typeof loadout.give>[3]);
          // a hop-up earned with damage is earned here too, unless the crate fitted it (as applyLoot)
          const lockMod = lockedHopupFor(g.id);
          if (lockMod && loadout.slots[i].attach.hopup !== lockMod) loadout.slots[i].hopLock = { mod: lockMod, have: 0, need: LOCKED_HOPUPS[lockMod].unlock };
        });
      for (const it of items) if (it.kind === "ammo") loadout.ammo.add(it.id as AmmoType, it.n);
      audio.swap();
    };
    d.onMark = (k, from, at, label, target) => {
      // a squad mate's PULSE or SWEEP: the same enemies shown here
      if (k === "scan") {
        if (target >= 0) d.revealOne(target, KITS.scout.tactical.seconds);
        return;
      }
      brPlay.addMarker(k, at, label, from, target, gameTime);
    };
    d.onDowned = () => {
      hud.notice("DOWN: A SQUAD MATE CAN REVIVE YOU", gameTime, 2.5);
      audio.knock();
      heal = null;
    };
    d.onRevived = () => {
      hud.notice("REVIVED", gameTime, 1.5);
      audio.healDone();
    };
  }
  d.streak = profile.match(kind).streak;
  endTable.clear();
  d.onMatchEnd = (s) => {
    // your line for everyone's end table (the others' arrive as theirs end)
    d.localFx("sum", new THREE.Vector3(s.kills, Math.round(s.damage), s.placement ?? (s.won ? 1 : 2)), undefined, s.deaths);
    // with friends it goes on tonight's tally once the end screen is over (a match before it still on screen goes first)
    flushTally();
    if (d instanceof Duel && d.players > 1) tallyId = d.id;
    if (d instanceof Duel && d.players > 1) tallyPending = { name: profile.profile.name || "YOU", kills: s.kills, damage: Math.round(s.damage), place: s.placement ?? (s.won ? 1 : 2), you: true };
    profile.recordMatch(kind, s);
    // what the match earned: XP, a level, any challenge it finished
    const award = progress.award(kind as MatchKind, s);
    announceAward(award);
    lastSummary = { at: gameTime, kind, s, a: award, xpBefore: progress.xp - award.gained };
    d.streak = profile.match(kind).streak;
    menu.renderStats();
    profile.flush();
    account.sync();
    if (s.won)
      void submitScore(`${kind}:wins`, profile.profile.name, profile.match(kind).won).then((rank) => {
        if (rank !== null) hud.notice(`#${rank} FOR WINS ON THE ONLINE BOARD`, gameTime, 3);
      });
    // and what this match itself was worth: the two boards that reward a good
    // night rather than a long one (src/game/leaderboard.ts BOARDS)
    if (s.kills > 0)
      void submitScore("match:kills", profile.profile.name, s.kills).then((rank) => {
        if (rank !== null && rank <= 10) hud.notice(`#${rank} FOR KILLS IN A MATCH`, gameTime, 3);
      });
    if (s.damage >= 100)
      void submitScore("match:damage", profile.profile.name, Math.round(s.damage)).then((rank) => {
        if (rank !== null && rank <= 10) hud.notice(`#${rank} FOR DAMAGE IN A MATCH`, gameTime, 3);
      });
  };
}
/** the others' effects as they arrived, for the tests */
const remoteFxLog: Array<{ k: string; from: number }> = [];
/** the host's battle royale settings, fixed at Create so every guest's welcome says the same */
let hostBr: BrWelcome | null = null;
/** the host's settings (abilities on or off), fixed at Create, in every guest's welcome */
let hostOpts: MatchOpts | null = null;

/** a friend's match: the host on its first guest, or a guest on the host's welcome (`br`: a battle royale squad) */
function startDuel(link: Link, players: number, myId: number, guestId = 1, br?: BrWelcome, opts?: MatchOpts): void {
  if (duel && duel.kind === "duel") {
    // the host's second guest joins the match in progress
    if (myId === 0 && duel instanceof Duel) {
      duel.addGuest(link, guestId);
      return;
    }
    link.close();
    return;
  }
  if (duel) {
    link.close();
    return;
  }
  cancelJoin = null;
  for (const c of courses) c.leave();
  const squad = myId === 0 ? hostBr : (br ?? null);
  // the host's own choice, or what the host's welcome said (an older host sends none: off)
  const withAbilities = myId === 0 ? (hostOpts?.abilities ?? false) : (opts?.abilities ?? false);
  let d: Duel;
  const modeOpts = myId === 0 ? hostOpts?.mode : opts?.mode;
  if (modeOpts && isModeKind(modeOpts.kind)) {
    const diff: BotDifficulty = asDifficulty(modeOpts.difficulty);
    d = new ArenaMode(scene, projectiles, { players, myId, link, guestId, abilities: withAbilities, kind: modeOpts.kind, bots: modeOpts.bots, difficulty: diff, botWeapon: modeOpts.botWeapon ?? null, list: modeOpts.list === "full" ? "full" : "short", map: arenaFromWire(modeOpts.map), split: modeOpts.split === true });
    duel = d;
    // the walls of the map this match is on, which is not always the warehouse now
    player.setBounds(d.arenaBounds);
    wireMatch(d, modeOpts.kind);
    applyRules(d, myId === 0 ? (hostOpts?.rules ?? undefined) : opts?.rules);
  } else if (squad) {
    const diff: BotDifficulty = asDifficulty(squad.difficulty);
    // the squad size is the host's for everyone (an older host sends none: the default size)
    const br = new BrMatch(scene, projectiles, brMap, diff, squad.bots, { players, myId, link, guestId, poi: squad.poi, abilities: withAbilities, seed: squad.seed, start: squad.start === "loadout" ? "loadout" : "loot", team: squad.team, ship: !straightDrop(), rules: squad.rules, pace: squad.pace, gulag: !noGulag(), split: squad.split === true, vault: !noVault() });
    d = br;
    duel = d;
    wireMatch(d, "br");
    applyRules(d, myId === 0 ? (hostOpts?.rules ?? undefined) : opts?.rules);
    brHour(br);
  } else {
    // three is still the triangle, the only map with three corners; two play
    // on the host's pick
    const wireMap = myId === 0 ? hostOpts?.map : opts?.map;
    d = new Duel(scene, projectiles, { players, myId, link, guestId, abilities: withAbilities, map: players >= 3 ? null : arenaFromWire(wireMap) });
    duel = d;
    player.setBounds(players >= 3 ? TRI_BOUNDS : d.arenaBounds);
    wireMatch(d, players >= 3 ? "triple" : "duel");
    applyRules(d, myId === 0 ? (hostOpts?.rules ?? undefined) : opts?.rules);
  }
  const goal = d instanceof ArenaMode ? `${MODE_TITLE[d.modeKind]}: ${modeGoal(d)}` : squad ? `${(d as BrMatch).team.label}: the squad drops onto ${(d as BrMatch).poi.name} against ${squad.bots} bots.` : "First to 3 rounds.";
  d.onSlotFree = (id) => hosting?.release(id);
  d.onRoster = (connected, total) => {
    duelButtons();
    setDuelStatus(connected < total - 1 ? `${connected} of ${total - 1} friends in. Waiting for the rest; the code is <b class="code">${hosting?.code ?? ""}</b>.` : `Everyone is in. ${goal} <b>Click Play</b>.`, connected < total - 1 ? "live" : "good");
  };
  respawnForMatch(d);
  if (myId === 0) d.onRoster?.(1, players);
  else setDuelStatus(`Connected as player ${myId + 1} of ${players}. ${goal} <b>Click Play</b>.`, "good");
  duelButtons();
  hud.notice(players >= 3 ? "PLAYER CONNECTED" : "OPPONENT CONNECTED", gameTime, 2);
  // straight into the arena when the browser still allows it (a Join click a
  // moment ago counts); otherwise the menu says Click Play
  if (!input.playing && !calibrating) void input.lock(true);
}
/** the offline match against bots */
function startBots(): void {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  cancelJoin = null;
  for (const c of courses) c.leave();
  const diff = asDifficulty(botDifficulty.value);
  // the count the picker says, which it did not use to be: the box offered
  // five and the match made one or two whatever it said
  const count = Math.max(1, Math.min(MOST_BOTS, Number(botCount.value) || 1));
  // the Map picker covers the 1v1 against bots too; the warehouse is still the default
  const d = new BotMatch(scene, projectiles, diff, count, abilitySetting("bots"), arenaMapChoice("duel", 2));
  duel = d;
  player.setBounds(d.arenaBounds);
  wireMatch(d, `bots:${diff}`);
  respawnForMatch(d);
  setDuelStatus(`Against ${count === 1 ? "a bot" : `${count} bots`}, ${diff}. First to 3 rounds.`, "good");
  duelButtons();
}
/** what a mode is played to, for the status line */
function modeGoal(d: ArenaMode): string {
  if (d.modeKind === "gunrun") return `${d.ladder.guns.length} guns then the knife, ${Math.round(MODES.gunRun.timeLimit / 60)} minutes.`;
  if (d.modeKind === "tdm") return `teams of ${MODES.tdm.teamSize}, first to ${MODES.tdm.scoreLimit}.`;
  if (d.modeKind === "control") return `teams of ${MODES.control.teamSize} over zones A, B and C, a point a second a zone, first to ${MODES.control.scoreLimit}.`;
  if (d.modeKind === "search") return `teams of ${MODES.search.teamSize}, one life a round: plant on A or B, or stop them; sides swap after ${MODES.search.swapAt} rounds, first to ${MODES.search.roundsToWin}.`;
  if (d.modeKind === "ffa") return `everyone for themselves, first to ${MODES.ffa.scoreLimit} kills or the most at ${Math.round(MODES.ffa.timeLimit / 60)} minutes.`;
  return `hold the crown ${MODES.crown.hold} s, first to ${MODES.crown.roundsToWin} rounds.`;
}
/** an arena mode alone, against bots */
function startMode(kind: ModeKind): void {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  cancelJoin = null;
  for (const c of courses) c.leave();
  const diff = brDifficulty();
  // the bots you picked are the ones you face, in every mode; a team mode
  // fills your side to match (modematch.ts)
  const bots = Math.max(1, modeBotCount());
  const d = new ArenaMode(scene, projectiles, { players: 1, myId: 0, link: null, abilities: abilitySetting("bots"), kind, bots, difficulty: diff, list: modeList(), botWeapon: botWeaponChoice(), map: arenaMapChoice(kind, 1 + bots) });
  duel = d;
  player.setBounds(d.arenaBounds);
  wireMatch(d, kind);
  respawnForMatch(d);
  setDuelStatus(`${MODE_TITLE[kind]} against ${kind === "tdm" || kind === "control" ? "a team of bots, with bots on your side" : `${bots} bot${bots === 1 ? "" : "s"}`}, ${diff}: ${modeGoal(d)}`, "good");
  duelButtons();
}
/** the battle royale against bots, on Outskirts */
function startBr(seed = newSeed(), poi?: string): void {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  cancelJoin = null;
  for (const c of courses) c.leave();
  const diff = brDifficulty();
  const bots = brBotCount();
  const d = new BrMatch(scene, projectiles, brMap, diff, bots, { players: 1, myId: 0, link: null, poi, abilities: abilitySetting("br"), seed, start: brStart(), team: brTeamId(), ship: !straightDrop(), rules: brRulesId(), pace: brPace(), gulag: !noGulag(), vault: !noVault() });
  duel = d;
  wireMatch(d, "br");
  brHour(d);
  // the drop starts on the first frame in the game (respawnForMatch, from the countdown)
  setDuelStatus(`Battle royale on Outskirts, ${d.team.label.toLowerCase()}: you and ${bots} bots, ${diff}. Dropping onto ${d.poi.name}.`, "good");
  duelButtons();
}
const brStartSel = $<HTMLSelectElement>("brStart");
try {
  const v = localStorage.getItem("range.br.start");
  if (v === "loot" || v === "loadout") brStartSel.value = v;
} catch {
  /* ignore */
}
brStartSel.addEventListener("change", () => {
  try {
    localStorage.setItem("range.br.start", brStartSel.value);
  } catch {
    /* ignore */
  }
});
const brStart = (): "loot" | "loadout" => (brStartSel.value === "loadout" ? "loadout" : "loot");

// How fast the ring pulls in: the lobby's box, kept between visits. It is the
// length of a match rather than its difficulty (src/game/ring.ts ringPace),
// and the host's is everyone's, so it travels in the welcome packet.
const brPaceSel = $<HTMLSelectElement>("brPace");
try {
  const v = localStorage.getItem("range.br.pace");
  if (v === "slow" || v === "normal" || v === "fast") brPaceSel.value = v;
} catch {
  /* storage off: the normal pace */
}
brPaceSel.addEventListener("change", () => {
  try {
    localStorage.setItem("range.br.pace", brPaceSel.value);
  } catch {
    /* ignore */
  }
});
const brPace = (): string => brPaceSel.value || "normal";

// The movement this match runs (src/config/movement.json `extra`): Apex's, or
// Apex's plus a double jump and a wall run. Off by default, because both
// change how every fight reads and the rest of the movement in this game is
// measured against a source. Remembered between visits, and applied whenever
// a match or the range starts.
const extraMovesSel = $<HTMLSelectElement>("extraMoves");
try {
  if (localStorage.getItem("range.move.extra") === "1") extraMovesSel.value = "1";
} catch {
  /* storage off: Apex's */
}
const applyExtraMoves = (): void => {
  player.extraMoves = extraMovesSel.value === "1";
};
extraMovesSel.addEventListener("change", () => {
  try {
    localStorage.setItem("range.move.extra", extraMovesSel.value);
  } catch {
    /* ignore */
  }
  applyExtraMoves();
});
applyExtraMoves();
const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
const brDifficulty = (): BotDifficulty => asDifficulty(botDifficulty.value);
const brBotCount = (): number => Math.max(1, Math.min(MOST_BOTS, Number(brBots.value) || 11));
function endMatch(reason: string): void {
  const wasBr = duel instanceof BrMatch;
  // any zipline HOOK put up, and any cloud SMOKE left, go with the match
  clearZiplines();
  clearSmoke();
  clearWalls();
  voiceStop();
  matchGuns = null;
  flushTally();
  // a match that ran to its end keeps the group: its links, handed back open (leaving closed them)
  if (duel instanceof Duel && duel.phase === "matchEnd" && !duel.left) {
    const { guests, host } = duel.takeLinks();
    if (duel.role === "host" && guests.size) keepParty({ guests });
    else if (duel.role === "guest" && host) keepParty({ host });
  }
  // a loadout picked during the last fight comes on now; the range's heal kit is full again
  if (pendingSlots) {
    pendingSlots.forEach((id, i) => loadout.setWeaponId(i, id));
    pendingSlots = null;
  }
  kit.fill("kit");
  // the range: grenades without end; nothing in the air
  ordnance.endless = true;
  ordnance.readied = null;
  throwables.clear();
  afterburns.clear();
  player.arcSlowUntil = 0;
  const wasGunRun = duel instanceof ArenaMode && duel.modeKind === "gunrun";
  duel?.dispose();
  duel = null;
  bannerSentAt = -Infinity;
  finishSent = "";
  remoteFinishes.clear();
  remoteBanners.clear();
  // the match's bullet holes and sprays go with it
  impacts.clear();
  sprays.clear();
  // and out of a battle royale nothing limits the ammo you carry
  loadout.ammo.packTier = null;
  // back in the range: either ability to practise, nothing picked; ammo as Settings says
  abilities.reset(true);
  loadout.ammo.infinite = !rangeAmmoCounted;
  killcam.stop();
  recap = null;
  recorder.clear();
  heal = null;
  mapOpen = false;
  if (wasGunRun) {
    for (let i = 0; i < loadout.slots.length; i++) if (loadout.slots[i].empty) loadout.give(i, [loadouts.current.slot1, loadouts.current.slot2][i]);
    applyLoadout(loadouts.current);
    loadout.setWeaponId(0, loadouts.current.slot1);
    loadout.setWeaponId(1, loadouts.current.slot2);
  }
  if (wasBr) {
    setRegion("range");
    // the owner's own hour again, if the match had its own
    if (hour.id !== loadHour().id) applyHour(loadHour());
    // your loadout back (a loot game left you with what you found, or nothing)
    for (let i = 0; i < loadout.slots.length; i++) if (loadout.slots[i].empty) loadout.give(i, [loadouts.current.slot1, loadouts.current.slot2][i]);
    applyLoadout(loadouts.current);
    brPlay.reset();
  }
  // the host's code stays open behind a kept group (no new friends join it); otherwise it goes
  if (party && "guests" in party) hosting?.stopAccepting();
  else if (!takingOver) {
    hosting?.cancel();
    hosting = null;
  }
  hud.notice(reason.toUpperCase(), gameTime, 3);
  const together = !party ? "" : "guests" in party ? " Your group is still here: pick the next match above and Play again." : " Your group is still together: the host starts the next match.";
  setDuelStatusText(reason + together);
  duelButtons();
  goTo("range");
}
/** what the host's match will be, from the Friends tab as it stands: read when a match is made, and again for the group's next one */
function readHostSettings(): void {
  // a battle royale squad: the place, the bots, the difficulty and the squad
  // size are fixed now so every guest is told the same
  hostBr = duelMode.value === "br" ? { poi: brMap.pois[Math.floor(Math.random() * brMap.pois.length)].id, bots: brBotCount(), difficulty: brDifficulty(), seed: newSeed(), start: brStart(), team: brTeamId(), rules: brRulesId(), pace: brPace(), split: $<HTMLSelectElement>("brSides").value === "split" } : null;
  const mk = duelModeKind();
  // the custom rules (the Rules row), for everyone
  const guns = $<HTMLSelectElement>("ruleGuns").value;
  const rules: MatchRules = { guns: guns in rulesCfg.classes ? guns : "any", rounds: Number($<HTMLSelectElement>("ruleRounds").value) || 3, ff: $<HTMLSelectElement>("ruleFF").value === "on" };
  // a class of guns arms the bots with its first, unless the Bot guns box already picked one
  const classGun = rules.guns !== "any" ? rulesCfg.classes[rules.guns as keyof typeof rulesCfg.classes].guns[0] : null;
  hostOpts = {
    abilities: abilitySetting(duelKind()),
    mode: mk ? { kind: mk, bots: modeBotCount(), difficulty: brDifficulty(), list: modeList(), botWeapon: botWeaponChoice() ?? (mk !== "gunrun" ? classGun : null), map: arenaMapChoice(mk, 8), split: $<HTMLSelectElement>("modeSides").value === "split" } : undefined,
    map: arenaMapChoice("duel", 2),
    rules,
  };
}

/** the class of guns this match allows (custom rules), or null for any: not in a battle royale or Gun Run */
let matchGuns: keyof typeof rulesCfg.classes | null = null;
/** a match's custom rules, as the host set them (this page's, or the welcome's): rounds, friendly fire, guns */
function applyRules(d: Duel, r: MatchRules | undefined): void {
  matchGuns = null;
  if (!r) return;
  if (typeof r.rounds === "number" && rulesCfg.rounds.includes(r.rounds)) d.roundsToWin = r.rounds;
  d.friendlyFire = r.ff === true;
  const gunRun = d instanceof ArenaMode && d.modeKind === "gunrun";
  if (typeof r.guns === "string" && r.guns in rulesCfg.classes && !(d instanceof BrMatch) && !gunRun) matchGuns = r.guns as keyof typeof rulesCfg.classes;
}
/** every frame of such a match: a gun of another class in hand (the start, a respawn, the Loadouts tab) becomes one of the class's */
function enforceGuns(): void {
  if (!matchGuns || !duel) return;
  const list = rulesCfg.classes[matchGuns].guns;
  for (let i = 0; i < loadout.slots.length; i++) {
    const s = loadout.slots[i];
    if (s.empty || weaponClass(s.id) === matchGuns) continue;
    loadout.setWeaponId(i, list[i % list.length]);
  }
}
/** this page's address with ?join=CODE: opening it joins that match (other flags, like ?net=local, ride along) */
function inviteLink(code: string): string {
  const q = new URLSearchParams(location.search);
  q.set("join", code);
  return `${location.origin}${location.pathname}?${q.toString()}`;
}
duelHostBtn.addEventListener("click", () => {
  if (duel || hosting) return;
  cancelJoin?.();
  newNight();
  const players = Math.max(2, Math.min(MAX_PLAYERS, Number(duelPlayers.value) || 2));
  readHostSettings();
  openHosting(players);
  // the lobby is the arena itself: in at once, run around, the code on the
  // HUD; the match starts when the others arrive and everyone is in
  goTo("arena");
  if (!calibrating) {
    readSettings();
    void input.lock();
  }
});

/** a code for a match of `players` on hostBr and hostOpts as they stand: the invite on the Friends tab, the guests into the match as they come */
function openHosting(players: number, then?: (code: string) => void): void {
  setDuelStatus("Making a match...", "live");
  hosting = hostMatch(
    players,
    (code) => {
      // an invite link: opening it joins this match, no code to type
      const link = inviteLink(code);
      setDuelStatus(
        `Your code is <b class="code">${code}</b>. Send ${players === 3 ? "both friends" : "your friend"} the invite link (copied) and wait here:` +
          `<div class="invite"><input id="inviteLink" readonly value="${link.replace(/&/g, "&amp;").replace(/"/g, "&quot;")}" /><button type="button" id="inviteCopy">Copy</button></div>`,
        "live"
      );
      const copy = () => void navigator.clipboard?.writeText(link).catch(() => undefined);
      copy();
      $("inviteCopy")?.addEventListener("click", () => {
        copy();
        $("inviteCopy").textContent = "Copied";
      });
      $<HTMLInputElement>("inviteLink")?.addEventListener("focus", (e) => (e.target as HTMLInputElement).select());
      then?.(code);
    },
    (link, id) => startDuel(link, players, 0, id),
    (err) => {
      setDuelStatusText(err, "bad");
      hosting = null;
      duelButtons();
    },
    hostBr ?? undefined,
    hostOpts ?? undefined
  );
  // a guest back after a dropped connection: the match takes them back on their held seat
  hosting.onRejoin = (link, id) => (duel instanceof Duel && duel.role === "host" ? duel.rejoin(link, id) : false);
  duelButtons();
}

/** join a match by code as the Join button does (the handover moves everyone this way too) */
function joinCode(code: string): void {
  setDuelStatus("Joining...", "live");
  cancelJoin = joinMatch(
    code,
    (link, w) => {
      // the seat's key, for getting back in if the connection drops
      mySeat = w.key ? { code, id: w.id, key: w.key } : null;
      joinedWith = { players: w.players, br: w.br, opts: w.opts };
      startDuel(link, w.players, w.id, 1, w.br, w.opts);
    },
    (err) => setDuelStatusText(err, "bad")
  );
}

/**
 * Handing the host over, in the lobby (the host's roster has a Make host
 * button). The host asks one guest to take it; that guest opens a new code
 * for the same match, sends it back and leaves the old lobby; the host tells
 * everyone else to move to it, then goes there itself. Nobody types a code.
 */
let handingTo: number | null = null;
/** the new host's own code while it leaves the old lobby: its end must not close the new one */
let takingOver = false;
function handOver(to: number): void {
  const d = duel;
  if (!(d instanceof Duel) || d.role !== "host" || d.phase !== "waiting" || handingTo !== null) return;
  handingTo = to;
  d.tell(to, { t: "host", op: "take", players: d.players, br: hostBr ?? undefined, opts: hostOpts ?? undefined });
  setDuelStatusText(`Handing the host to ${d.nameFor(to)}...`);
}
function onHandover(d: Duel, m: Extract<NetMsg, { t: "host" }>, from: number): void {
  if (m.op === "take" && d.role === "guest") {
    const players = typeof m.players === "number" && m.players >= 2 && m.players <= MAX_PLAYERS ? m.players : d.players;
    // the match the old host made, now ours to host
    hostBr = m.br ?? null;
    hostOpts = m.opts ?? null;
    takingOver = true;
    openHosting(players, (code) => {
      // The code, then out of the old lobby at once (the code goes first on
      // the ordered channel): a friend who arrived while this page was still
      // a guest there would be turned away. The new code stays open (endMatch).
      d.tell(0, { t: "host", op: "code", code });
      if (duel === d) d.leave();
      takingOver = false;
      goTo("arena");
      setDuelStatusText(`You are the host now. Your code is ${code}: the others are on their way.`);
      duelButtons();
    });
  } else if (m.op === "code" && d.role === "host" && from === handingTo && typeof m.code === "string" && m.code.length === 5) {
    const code = m.code;
    handingTo = null;
    // everyone else to the new code, then this page too
    for (const id of d.roster().map((r) => r.id)) if (id !== from) d.tell(id, { t: "host", op: "move", code });
    setTimeout(() => {
      if (duel === d) d.leave();
      hosting?.cancel();
      hosting = null;
      joinCode(code);
    }, 150);
  } else if (m.op === "move" && d.role === "guest" && typeof m.code === "string" && m.code.length === 5) {
    const code = m.code;
    d.leave();
    joinCode(code);
  }
}

duelJoinBtn.addEventListener("click", () => {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  newNight();
  setDuelStatus("Joining...", "live");
  joinCode(duelCode.value);
});
// the Flick drill button: to the pad, facing downrange, the countdown starts once you are in
$("goDrill").addEventListener("click", () => {
  if (duel) {
    hud.notice("LEAVE THE MATCH FIRST (1V1 TAB)", gameTime, 2);
    return;
  }
  goTo("range");
  player.teleport(rangeToolsCfg.drill.padX, 0, rangeToolsCfg.drill.padZ, 0);
  drill.start(gameTime);
  if (!calibrating) {
    readSettings();
    void input.lock();
  }
});
duelCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") duelJoinBtn.click();
});
duelLeaveBtn.addEventListener("click", () => {
  if (duel) duel.leave();
  else if (party) leaveParty("You left the group.");
  else if (hosting) {
    hosting.cancel();
    hosting = null;
    setDuelStatus("Match cancelled.");
    duelButtons();
  }
});
// Closing or reloading the tab tells the other side at once, rather than
// leaving them facing a frozen figure until the silence timeout.
window.addEventListener("pagehide", () => duel?.leave());
// Ctrl+W still closes a windowed tab (Input.lock): mid-match or mid-play the
// browser asks first.
window.addEventListener("beforeunload", (e) => {
  if (!duel && !input.playing) return;
  e.preventDefault();
  e.returnValue = "";
});
/**
 * The two sides of the world, 500 m apart: the range with its courses,
 * targets, dummies and arenas, and the battle royale map. The camera sees
 * 400 m, so from one side the other was in view and drawn: from the Mast's
 * roof the range's target frames, course signs and props were about 350 draw
 * calls and a million triangles of nothing anyone could see through the fog.
 * Each side is a group now, and only the side you stand on is drawn (showSide).
 */
const rangeSide = new THREE.Group();
rangeSide.name = "range-side";
const brSide = new THREE.Group();
brSide.name = "br-side";
scene.add(rangeSide, brSide);
{
  // The lights the range builds (the sun, the sky's fill, the rim) light the
  // whole world: hiding them with the range turned the sun off on the map.
  // They, and the objects the sun aims at, stay on the scene.
  const lit = new Set<THREE.Object3D>();
  scene.traverse((o) => {
    if ((o as THREE.Light).isLight) {
      lit.add(o);
      const target = (o as THREE.DirectionalLight).target;
      if (target) lit.add(target);
    }
    // The sky dome is the range's to build but everyone's to stand under, and
    // it follows the camera wherever it goes (skyFollow). Hidden with the
    // range, the battle royale was played under a black sky: the fog still
    // took the dome's colour, so the ground faded into nothing and only a
    // picture of the horizon showed it.
    if (o.name === "sky") lit.add(o);
  });
  const onRangeSide = [...rangeRoots, ...courses.map((c) => c.root), arena.root, triArena.root, ...targets.map((t) => t.group), ...dummies.map((d) => d.group)];
  for (const o of onRangeSide) if (!lit.has(o)) rangeSide.attach(o);
}
brSide.attach(brMap.root);
/** which side is drawn: the one the camera is on (the battle royale map starts 280 m south; the range side ends well short of it) */
let sideShown: "range" | "br" | null = null;
function showSide(): void {
  const want = camera.position.z > 250 ? "br" : "range";
  if (want === sideShown) return;
  sideShown = want;
  rangeSide.visible = want === "range";
  brSide.visible = want === "br";
  // the static shadow map is drawn from what is shown
  renderer.shadowMap.needsUpdate = true;
}
// The range and the course are several hundred static meshes. Merged by
// material they are a few dozen draw calls, which is CPU time back on every
// frame (see staticmerge.ts). ?nomerge in the URL turns it off, so the
// benchmark can measure both.
const merged = new URLSearchParams(location.search).has("nomerge")
  ? null
  : mergeStatic(scene, [[...rangeRoots, ...courses.map((c) => c.root)], arena.root, triArena.root, brMap.root], [rangeSide, rangeSide, rangeSide, brSide]);

// Two slots, each with its own clip and reload state: empty one mag, swap,
// empty the other, swap back and the first is still empty.
const loadout = new Loadout([loadouts.current.slot1, loadouts.current.slot2]);
// from here the readout describes the gun actually in hand, attachments included
currentWeapon = () => loadout.active.weapon;
currentOpticZoom = () => {
  const info = opticInfo(loadout.active.attach.optic ?? loadout.active.weapon.integralOptic ?? null);
  return opticZoom(info?.label ?? null, info?.zooms, loadout.active.zoomAlt);
};
refreshDerived();

// Starting a run equips the course pistols; finishing (or leaving) gives your
// own guns back.
// Your guns come back as you had them: attachments and mag level included
// (saving the ids alone stripped every attachment after a run).
let savedSlots: SlotSetup[] | null = null;
/** a loadout picked mid-fight: its guns, put on at the next round's spawn */
let pendingSlots: string[] | null = null;
for (const course of courses) {
  course.onRunChange = (running) => {
    if (running) {
      // one run at a time: starting one course abandons the other
      for (const other of courses) if (other !== course && other.running) other.reset();
      if (!savedSlots) savedSlots = loadout.slots.map((_, i) => loadout.setup(i));
      loadout.setWeaponId(0, "semipistol");
      loadout.setWeaponId(1, "g17");
    } else if (savedSlots) {
      savedSlots.forEach((su, i) => loadout.restore(i, su));
      savedSlots = null;
    }
  };
  course.onNotice = (text) => hud.notice(text, gameTime, 1.2);
  course.onFinish = (r) => {
    profile.recordRun(course.layout.id, r.time, r.rank);
    announceAward(progress.awardRun(r.rank));
    profile.flush();
    void submitScore(`course:${course.layout.id}`, profile.profile.name, Number(r.time.toFixed(3))).then((rank) => {
      if (rank !== null) hud.notice(`#${rank} ON THE ONLINE BOARD`, gameTime, 3);
    });
  };
}
const courseRunning = (): boolean => courses.some((c) => c.running);

/**
 * Put a loadout on: weapons in both slots, the operator's colours on your
 * gloves, the heirloom in your hand. During a course run the course pistols
 * stay in hand and the loadout's guns come back at the end.
 */
function applyLoadout(def: LoadoutDef): void {
  const ids = [def.slot1, def.slot2];
  if (courseRunning() && savedSlots) {
    // only a slot whose gun changed is replaced: changing the operator must
    // not strip the attachments off guns you get back at the end
    const saved = savedSlots;
    savedSlots = ids.map((id, i) => (saved[i]?.id === id ? saved[i] : { id, magLevel: 0, attach: {}, zoomAlt: false }));
  } else if (duel && duel.phase === "fight" && (loadout.slots[0].id !== def.slot1 || loadout.slots[1].id !== def.slot2)) {
    // mid-fight a new gun would come up with a full magazine and no deploy
    // time: it waits for the next round's spawn
    pendingSlots = ids;
    hud.notice("NEW LOADOUT NEXT ROUND", gameTime, 1.6);
  } else {
    pendingSlots = null;
    loadout.setWeaponId(0, def.slot1);
    loadout.setWeaponId(1, def.slot2);
  }
  setArmColors(operatorById(def.operator));
  viewModel.setHeirloom(def.heirloom);
  refreshDerived();
}

/** go somewhere to play, from the menu: the range, the course start, or the arena alone */
function goTo(mode: Mode): void {
  if (mode === "duel") return;
  applyExtraMoves();
  // In a match the arena and your spawn are the match's, so a jump elsewhere
  // has to end it first. It used to refuse and send you to a tab to resign
  // from the match by hand, which the owner rightly called bad: picking a
  // mode is a decision, and the game's job is to carry it out. So the old
  // match is left (the friends in it are told, as if you had pressed Leave),
  // everything it owned is cleared, and the mode you picked starts.
  if (duel) {
    duel.leave();
    if (duel) endMatch("You left for another mode.");
  }
  if (mode === "bots") {
    startBots();
    return;
  }
  if (mode === "br") {
    startBr();
    return;
  }
  if (mode === "gunrun" || mode === "tdm" || mode === "crown" || mode === "control" || mode === "ffa" || mode === "search") {
    startMode(mode);
    return;
  }
  for (const c of courses) c.leave();
  if (mode === "tour") {
    player.setBounds(RANGE_BOUNDS);
    player.teleport(0, 0, 0, 0);
    tour.start(tourCheck(gameTime));
    return;
  }
  if (mode === "range") {
    player.setBounds(RANGE_BOUNDS);
    player.teleport(0, 0, 0, 0);
  } else if (mode === "run" || mode === "runAdvanced") {
    player.setBounds(RANGE_BOUNDS);
    const sp = (mode === "run" ? courseBasic : courseAdvanced).startPose;
    player.teleport(sp.x, 0, sp.z, sp.yaw);
  } else if (mode === "arena") {
    player.setBounds(ARENA_BOUNDS);
    const sp = ARENA_SPAWNS.host;
    player.teleport(sp.x, 0, sp.z, sp.yaw);
  }
}

const menu = new Menu(loadouts, profile, {
  // the finish pickers follow the slots (hoisted: it runs once the pickers exist)
  onRendered: () => renderFinishes(),
  progress: () => ({ ...progress.level, xp: progress.xp, done: progress.done, challenges: progress.challenges }),
  weaponIds: weaponIds(),
  weaponName,
  onApply: applyLoadout,
  sessionGuns: () => [...gunSession.entries()].map(([id, r]) => ({ name: weaponName(id), ...r })),
  onGo: (mode) => {
    goTo(mode);
    if (calibrating) return;
    readSettings();
    void input.lock();
  },
  // The panel's With friends button. The mode the lobby is on becomes the
  // friends' match's mode, which is the translation the player used to have to
  // do themselves: pick Battle Royale on one tab, then find it again under
  // another name in a box on the tab called 1v1.
  onFriends: (mode) => {
    const want = friendsModeFor(mode);
    if (!want) return;
    duelMode.value = want;
    duelMode.dispatchEvent(new Event("change"));
    menu.show("duel");
    duelHostBtn.click();
  },
});
// the Stats tab's level card follows every award
progress.onChange = () => {
  menu.renderStats();
  renderFinishes();
};
/**
 * The Loadouts tab's finish pickers, one by each slot's gun: every finish,
 * the ones your level has not opened shown with the level that opens them
 * and not choosable, and the gun's own choice picked.
 */
function renderFinishes(): void {
  const level = progress.level.level;
  for (const i of [0, 1]) {
    const gun = $<HTMLSelectElement>(`slot${i}`).value;
    const sel = $<HTMLSelectElement>(`finish${i}`);
    sel.innerHTML = FINISHES.map((f) => `<option value="${f.id}"${f.level > level ? " disabled" : ""}>${f.label}${f.level > level ? ` (level ${f.level})` : ""}</option>`).join("");
    sel.value = finishFor(gun, level).id;
  }
}
for (const i of [0, 1]) {
  $<HTMLSelectElement>(`finish${i}`).addEventListener("change", (e) => {
    const gun = $<HTMLSelectElement>(`slot${i}`).value;
    chooseFinish(gun, (e.target as HTMLSelectElement).value, progress.level.level);
    // on the gun at once (the menu is up: the frame that keeps the gun in hand in its finish is not running)
    applyFinish(gunModel(gun), finishFor(gun, progress.level.level));
    renderFinishes();
  });
  // a different gun in the slot: its own finish
  $<HTMLSelectElement>(`slot${i}`).addEventListener("change", () => renderFinishes());
}
renderFinishes();
/** the optional account (Stats tab): the name is the account's once signed in; new stats go up after a match or a run */
const account = initAccountUi({
  setName: (name) => {
    profile.setName(name);
    profile.flush();
    const nameIn = document.getElementById("profileName") as HTMLInputElement | null;
    if (nameIn) nameIn.value = profile.profile.name;
    menu.renderStats();
  },
});
menu.setRunBest(courseBasic.best, courseAdvanced.best);
applyLoadout(loadouts.current);
let armorTier: ArmorTier = 0;

const stats = { shots: 0, hits: 0, headshots: 0, damage: 0, knocks: 0, lastTtk: null as number | null };
/** figures the debug gallery put in the scene (tools/shot.ts), animated by the loop */
const galleryFigs: Dummy[] = [];

// ---------- overlay / lock ----------
/** Play / Resume: read the settings and take the mouse back */
function resumeFromMenu(): void {
  if (calibrating) return; // a measurement is in progress; do not steal the lock
  readSettings();
  void input.lock();
}
$("play").addEventListener("click", () => resumeFromMenu());
/**
 * Esc on the menu is the Resume button, the way the game's own menus close.
 *
 * A key being rebound eats Esc first (it cancels that capture, and its
 * listener stops the event), and Esc in a text field leaves the field rather
 * than resuming.
 *
 * The hard part is Chrome. It blocks a pointer lock for about a second after
 * the Esc that let the mouse go, which is exactly when this is pressed, and it
 * only grants one from inside a real gesture. A retry on a timer is not a
 * gesture, so the old one asked for the lock from a setTimeout and Chrome
 * refused it in silence: Esc, Esc did nothing, which is what the owner kept
 * hitting. So a refused resume is remembered instead, and taken the next time
 * the player does anything at all: another Esc, any key, a click. That is a
 * gesture, and by then the second is up.
 */
let wantResume = false;
const dropRelock = (): void => {
  wantResume = false;
};
overlay.addEventListener("pointerdown", dropRelock, true);
/**
 * The next gesture after a refused resume takes it. Bound once, on the window,
 * so it catches a key or a click anywhere: the menu is up, and anything the
 * player does with it is a sign they are still trying to get back in.
 */
const takeResume = (e: Event): void => {
  if (!wantResume || input.locked || calibrating || overlay.classList.contains("hidden")) return;
  // a field being typed in, or a click on a control, is the player using the
  // menu rather than asking to leave it
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
  const on = e.target as HTMLElement | null;
  if (e.type === "pointerdown" && on && on.closest("button, select, input, a, .tabs")) return;
  wantResume = false;
  void input.lock(true);
};
window.addEventListener("keydown", takeResume, true);
window.addEventListener("pointerdown", takeResume, true);
/** Esc presses on the menu (tools/e2e.ts) */
let menuEscapes = 0;
window.addEventListener("keydown", (e) => {
  if (e.code !== "Escape" || overlay.classList.contains("hidden")) return;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
    el.blur();
    return;
  }
  e.preventDefault();
  menuEscapes++;
  wantResume = false;
  resumeFromMenu();
  // refused (Chrome's cooldown after the Esc that let the mouse go): the next
  // thing the player does takes it, and the hint says so
  if (!input.locked) {
    wantResume = true;
    playHint.textContent = "Press any key or click to go back in (the browser makes you wait a moment after Esc).";
  }
});
let courseHinted = false;
let padWasActive = false;
// The controller's settings (gamepad.ts), from the Settings tab, remembered
const LS_PAD = "range.pad.v1";
try {
  const raw = localStorage.getItem(LS_PAD);
  if (raw) {
    const p = JSON.parse(raw) as Partial<PadSettings>;
    const s = input.pad.settings;
    if (typeof p.look === "number" && p.look >= 1 && p.look <= 8) s.look = p.look;
    if (typeof p.ads === "number" && p.ads >= 1 && p.ads <= 8) s.ads = p.ads;
    if (p.curve === "linear" || p.curve === "classic") s.curve = p.curve;
    if (typeof p.deadzone === "number" && p.deadzone >= 0 && p.deadzone <= 0.3) s.deadzone = p.deadzone;
    if (typeof p.autoSprint === "boolean") s.autoSprint = p.autoSprint;
    if (typeof p.rumble === "boolean") s.rumble = p.rumble;
    if (typeof p.aimAssist === "boolean") s.aimAssist = p.aimAssist;
    if (typeof p.advanced === "boolean") s.advanced = p.advanced;
    const rng = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi ? v : d);
    s.yaw = rng(p.yaw, 10, 1000, s.yaw);
    s.pitch = rng(p.pitch, 10, 1000, s.pitch);
    s.extraYaw = rng(p.extraYaw, 0, 1000, s.extraYaw);
    s.extraPitch = rng(p.extraPitch, 0, 1000, s.extraPitch);
    s.rampTime = rng(p.rampTime, 0, 3, s.rampTime);
    s.rampDelay = rng(p.rampDelay, 0, 3, s.rampDelay);
    s.adsYaw = rng(p.adsYaw, 10, 1000, s.adsYaw);
    s.adsPitch = rng(p.adsPitch, 10, 1000, s.adsPitch);
  }
} catch {
  /* ignore */
}
{
  const s = input.pad.settings;
  const look = $<HTMLSelectElement>("padLook");
  const ads = $<HTMLSelectElement>("padAds");
  for (const sel of [look, ads]) {
    for (let i = 1; i <= 8; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${i}${i === 3 ? " (the game's default)" : ""}`;
      sel.appendChild(o);
    }
  }
  const curve = $<HTMLSelectElement>("padCurve");
  const dead = $<HTMLInputElement>("padDeadzone");
  const auto = $<HTMLSelectElement>("padAutoSprint");
  const rumble = $<HTMLSelectElement>("padRumble");
  const assistSel = $<HTMLSelectElement>("padAimAssist");
  assistSel.value = s.aimAssist ? "1" : "0";
  aimAssist.enabled = s.aimAssist;
  look.value = String(s.look);
  ads.value = String(s.ads);
  curve.value = s.curve;
  dead.value = String(Math.round(s.deadzone * 100));
  auto.value = s.autoSprint ? "1" : "0";
  rumble.value = s.rumble ? "1" : "0";
  const save = () => {
    s.look = Number(look.value) || 3;
    s.ads = Number(ads.value) || 3;
    s.curve = curve.value === "linear" ? "linear" : "classic";
    // 0 is a real deadzone (a new pad with no drift), not "empty": only a
    // blank or unreadable field falls back to 12
    const dz = Number(dead.value);
    s.deadzone = Math.max(0, Math.min(0.3, (dead.value.trim() !== "" && Number.isFinite(dz) ? dz : 12) / 100));
    s.autoSprint = auto.value === "1";
    s.rumble = rumble.value === "1";
    s.aimAssist = assistSel.value === "1";
    aimAssist.enabled = s.aimAssist;
    try {
      localStorage.setItem(LS_PAD, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  };
  for (const el of [look, ads, curve, dead, auto, rumble, assistSel]) el.addEventListener("change", save);
  // the advanced look: on or off, and its numbers
  const adv = $<HTMLSelectElement>("padAdvanced");
  const nums: Array<[keyof PadSettings, number, number]> = [
    ["yaw", 10, 1000],
    ["pitch", 10, 1000],
    ["extraYaw", 0, 1000],
    ["extraPitch", 0, 1000],
    ["rampTime", 0, 3],
    ["rampDelay", 0, 3],
    ["adsYaw", 10, 1000],
    ["adsPitch", 10, 1000],
  ];
  const advBox = $("padAdvancedBox");
  const inputs = new Map<string, HTMLInputElement>();
  const labels: Record<string, string> = { yaw: "Yaw", pitch: "Pitch", extraYaw: "Extra yaw", extraPitch: "Extra pitch", rampTime: "Ramp-up time", rampDelay: "Ramp-up delay", adsYaw: "ADS yaw", adsPitch: "ADS pitch" };
  for (const [k, lo, hi] of nums) {
    const lab = document.createElement("label");
    lab.className = "opticAds";
    const step = hi <= 3 ? 0.01 : 5;
    lab.innerHTML = `${labels[k]} <input id="pad_${k}" type="number" min="${lo}" max="${hi}" step="${step}" value="${s[k]}" />`;
    advBox.appendChild(lab);
    inputs.set(k, lab.querySelector("input")!);
  }
  adv.value = s.advanced ? "1" : "0";
  advBox.hidden = !s.advanced;
  const saveAdv = () => {
    s.advanced = adv.value === "1";
    advBox.hidden = !s.advanced;
    for (const [k, lo, hi] of nums) {
      const n = Number(inputs.get(k)!.value);
      if (Number.isFinite(n)) (s as unknown as Record<string, number>)[k] = Math.max(lo, Math.min(hi, n));
    }
    try {
      localStorage.setItem(LS_PAD, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  };
  adv.addEventListener("change", saveAdv);
  for (const el of inputs.values()) el.addEventListener("change", saveAdv);
}
const playBtn = $<HTMLButtonElement>("play");
const playHint = $("playHint");
const PLAY_HINT = playHint.textContent ?? "";
// Refused (Chrome waits about a second after Esc before it locks again; an
// embedded page may not be allowed at all): say so, instead of a click that
// does nothing.
input.onLockRefused = () => {
  playHint.classList.add("warn");
  playHint.textContent = "The browser did not let the game take the mouse. Press Esc or click again in a second (after Esc, Chrome makes you wait a moment).";
};
input.onLockChange = (locked) => {
  overlay.classList.toggle("hidden", locked);
  if (locked) {
    // the first time in, the button stops saying Play: there is now a game to
    // resume, and the welcome has done its job
    playBtn.textContent = "Resume";
    playBtn.hidden = false;
    dismissWelcome();
    playHint.classList.remove("warn");
    playHint.textContent = PLAY_HINT;
  }
  if (!locked) {
    menu.setRunBest(courseBasic.best, courseAdvanced.best);
    profile.flush();
    menu.renderStats();
    account.sync();
  }
  if (locked && !courseHinted) {
    courseHinted = true;
    hud.notice("THE RUN: the two movement courses are through the lit gates behind you", gameTime, 5);
  }
  if (locked) audio.unlock(); // create/resume the AudioContext from the gesture
  // coming back to the panel: the build may have changed in game
  else refreshDerived();
};

window.addEventListener("resize", () => {
  // a move to a screen with another pixel ratio, or a browser zoom, fires this
  // too: without the ratio the 3D view stayed blurry or oversized
  const pr = Math.min(quality.maxPixelRatio, window.devicePixelRatio);
  if (pr !== renderer.getPixelRatio()) {
    renderer.setPixelRatio(pr);
    pipeline.setPixelRatio(pr);
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
  pipeline.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
});

// ---------- loop ----------
let last = performance.now() / 1000;
let gameTime = 0;
let fps = 60;
let frameMs = 0;
/**
 * 0..1 between a variable optic's two zooms. It blends over the data's
 * zoom_toggle_lerp_time rather than snapping.
 */
let zoomBlend = 0;
/** melee: when the next one may start, and when the current swing lands */
const MELEE_COOLDOWN = 0.9;
const MELEE_DAMAGE = 30;
const MELEE_RANGE = 1.8;
let meleeReadyAt = 0;
let meleeHitAt = Infinity;
const zoomFov43 = (w: ResolvedWeapon): number => w.zoomFov43 + ((w.zoomToggleFov43 ?? w.zoomFov43) - w.zoomFov43) * zoomBlend;
const rnd = () => Math.random();
const tmpDir = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
/** the eye this frame: where shots leave from, and the first-person camera */
const eye = new THREE.Vector3();
/** your own figure, drawn in third person; rebuilt when the gun or the operator changes */
let selfFig: Dummy | null = null;
/** the figure lab (tools/snap.ts): posed figures in a row in front of you, to judge the animation */
const labFigs: Array<{ f: Dummy; pose: FigurePose; dead: boolean; at: number }> = [];
let selfFigKey = "";
/** what your hands are doing, for your figure on the others' screens and in third person */
function localAct(): number {
  if (heal) return actCode("heal", Math.max(0, HEAL_CODES.indexOf(heal.item)));
  if (loadout.swapping) return actCode("swap");
  if (loadout.active.state.reloading) return actCode("reload");
  return 0;
}

function selfFigure(now: number, dt: number, weaponId: string, op: string, show: boolean, knocked: boolean, downed: boolean): void {
  if (!show) {
    if (selfFig) {
      selfFig.group.visible = false;
      selfFig.clearDropped();
    }
    return;
  }
  const key = `${weaponId}|${op}`;
  if (!selfFig || selfFigKey !== key) {
    selfFig?.dispose();
    selfFig = new Dummy(0, 0, 0, { armed: weaponId, respawn: false, skin: operatorById(op), rig: true, noBase: true });
    selfFig.group.name = "self";
    scene.add(selfFig.group);
    selfFigKey = key;
    // an emote in progress: the figure is often made for it (the view only goes third person to watch), so it starts it
    if (emoting) selfFig.emote(emoting.index);
  }
  const f = selfFig;
  f.group.visible = true;
  f.group.position.copy(player.pos);
  f.group.rotation.y = player.yaw * DEG + Math.PI;
  if (knocked) f.fallDown();
  else if (f.knocked) f.reset();
  const ac = localAct();
  f.setPose({ speed: player.speed, stance: downed ? "downed" : player.stance, pitch: player.pitch, moveDir: moveDirOf(player.vel.x, player.vel.z, player.yaw), ads: loadout.active.state.adsFrac, act: actFromCode(ac), healItem: heal?.item });
  f.update(now, dt);
}

/**
 * One frame, guarded. A throw inside the frame used to skip the schedule() at
 * its end, which stopped the game for good with the last picture frozen on
 * screen. Now the loop carries on; the error is rethrown outside the loop (the
 * first few), so the console and the tests still see it.
 */
let frameErrors = 0;
/** kills in a row (each within the streak window of the last): the chime climbs with them */
let killStreak = 0;
let lastKillAt = -Infinity;
/** frames run since the page opened (the suite counts them while the tab is hidden) */
let framesRun = 0;
/** the frustum the figures' LOD tests against, rebuilt once a frame */
const lodFrustum = new THREE.Frustum();
const lodMatrix = new THREE.Matrix4();

function frame(): void {
  framesRun++;
  // where the figures are being looked at from this frame (figlod.ts): their
  // animation, their shadows and their guns follow from it
  camera.updateMatrixWorld();
  lodFrustum.setFromProjectionMatrix(lodMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  setFigureView(camera.position, lodFrustum, framesRun);
  // the field's rock and scrub: only the cells near enough to be worth drawing
  stepInstanced(camera.position);
  try {
    step();
  } catch (e) {
    input.endFrame();
    if (frameErrors++ < 3)
      setTimeout(() => {
        throw e;
      }, 0);
  }
  schedule();
}

let rosterAt = 0;
/** when the nearest supply bin last hummed */
let binHumAt = 0;
function step(): void {
  // the host's lobby list changes as friends click Play and pings come back: redrawn twice a second while it waits
  if (performance.now() - rosterAt > 500) {
    rosterAt = performance.now();
    renderRoster();
    renderVoiceList();
    // a rematch in the same match (the arena, the modes): the last one goes on the tally as the next begins
    if (tallyPending && duel && duel.phase !== "matchEnd") flushTally();
  }
  const frameStart = performance.now();
  const wall = performance.now() / 1000;
  let dt = wall - last;
  last = wall;
  if (dt > 0.1) dt = 0.1;
  // `now` is a game clock that advances by the CLAMPED dt. Using wall time for
  // the schedulers while the integrators saw a clamped dt made them disagree
  // after a hitch: the fire scheduler and decay delays would think a full
  // second had passed while the spring and spread had advanced only 0.1 s.
  gameTime += dt;
  const now = gameTime;
  fps += (1 / Math.max(dt, 1e-3) - fps) * 0.05;
  frameHook?.(now, dt);
  // the map's doors swing to where they are (any of them, in a match or not)
  brMap.doors.update(dt);
  voiceFrame();
  enforceGuns();
  // The controller: read once here so every key check below sees it. Start
  // toggles the menu; with a pad in use no pointer lock is needed to play.
  const padAdsScale = 1 + (adsSensScale(hipFov43(settings.fovScale), zoomFov43(loadout.active.weapon) * settings.fovScale, opticAdsMult()) - 1) * loadout.active.state.adsFrac;
  input.pad.cardOpen = abilities.choosing;
  const padLook = input.pad.poll(wall, dt, padAdsScale, loadout.active.state.adsFrac);
  if (input.pad.menuPressed) {
    if (input.locked) input.unlock();
    else if (!overlay.classList.contains("hidden")) {
      // on the menu: Start plays
      if (!calibrating) {
        readSettings();
        input.padPlaying = true;
        input.onLockChange?.(true);
      }
    } else {
      input.padPlaying = false;
      input.onLockChange?.(false);
    }
  }
  if (input.pad.justConnected) {
    input.pad.justConnected = false;
    hud.notice("CONTROLLER CONNECTED: PRESS START TO PLAY", now, 3);
  }
  // the pad went away (or idle) while it was the way in: back to the menu,
  // or there would be no input and no menu at all
  if (input.padPlaying && !input.locked && !input.pad.active) {
    input.padPlaying = false;
    input.onLockChange?.(false);
  }
  void padWasActive;

  loadout.update(now);
  const ws = loadout.active.state;
  {
    const w = loadout.active.weapon;
    const target = loadout.active.zoomAlt && w.zoomToggleFov43 !== null ? 1 : 0;
    const step = dt / Math.max(0.02, w.zoomToggleLerp);
    zoomBlend = target > zoomBlend ? Math.min(target, zoomBlend + step) : Math.max(target, zoomBlend - step);
  }
  const hipH = hipFov43(settings.fovScale);
  // knocked in a 1v1: no movement, no weapon keys, until the next round
  const knockedOut = (duel !== null && !duel.alive) || (!duel && rangeCombat.on && !rangeCombat.alive);
  // down, not out (a battle royale squad): a crawl, no guns, no heals
  const downedNow = duel instanceof Duel && duel.downed && duel.alive;
  // an empty slot (a battle royale's start): fists
  const emptyHand = loadout.active.empty;

  if (input.playing) {
    // Holster. While the gun is away, fire, aim, reload or any weapon key
    // brings it back up instead of doing its usual job.
    const drawKey =
      !knockedOut &&
      (input.pressedNow("fire") ||
        input.pressedNow("ads") ||
        input.pressedNow("reload") ||
        input.pressedNow("slot1") ||
        input.pressedNow("slot2") ||
        input.pressedNow("swapWeapon"));
    if (!knockedOut && input.pressedNow("holster") && !loadout.swapping) {
      if (holster === "out") {
        holster = "lowering";
        holsterAt = now;
        audio.swap();
        // a burst or a reload in flight does not survive being put away
        ws.cancelAction();
      } else if (holster === "away" || holster === "lowering") {
        holster = "raising";
        holsterAt = now;
      }
    } else if (drawKey && (holster === "away" || holster === "lowering")) {
      holster = "raising";
      holsterAt = now;
    }
    const armed = holster === "out" && !knockedOut && !downedNow && !emptyHand;
    // a throw (or putting one away) uses that press of the button: the gun does not fire, the aim does not toggle
    if (fireLockedToRelease && !input.held("fire")) fireLockedToRelease = false;
    adsPressUsed = false;
    // Fists or the heirloom out: the fire button swings, the way the melee key
    // does. That is the empty hand of Gun Run's knife level AND the gun put
    // away on 3, where clicking used to do nothing at all. Not with a grenade
    // in hand: that press throws it.
    const handsOut = emptyHand || holster === "away";
    if (handsOut && !downedNow && !knockedOut && !player.aboard && !ordnance.readied && input.pressedNow("fire") && now >= meleeReadyAt && (!duel || duel.canFire)) {
      meleeReadyAt = now + MELEE_COOLDOWN;
      viewModel.melee();
      meleeHitAt = now + MELEE_TIME * 0.35;
    }
    // G: a grenade in hand (again: the next kind you have; after the last, the gun again)
    if (input.pressedNow("grenade") && !downedNow && !knockedOut && !player.aboard && !heal && holster === "out" && !loadout.swapping && (!duel || duel.alive)) {
      const k = ordnance.cycle(now, downedNow);
      if (k) {
        hud.notice(`${throwName(k)}  ·  ${keyLabel("fire")} THROWS, ${keyLabel("ads")} PUTS IT AWAY`, now, 1.6);
        audio.throwNoise("pin", null);
      } else if (!THROWABLES_ANY()) hud.notice("NO GRENADES", now, 1);
    }
    if (ordnance.readied) {
      if (input.pressedNow("ads")) {
        ordnance.readied = null;
        adsPressUsed = true;
      } else if (loadout.swapping || downedNow || knockedOut || heal) ordnance.readied = null;
      else if (input.pressedNow("fire") && now >= ordnance.readied.readyAt && (!duel || duel.canFire)) {
        throwReadied(now);
        fireLockedToRelease = true;
      }
    }
    // The middle mouse button (RB): a TAP pings what you are looking at, twice
    // quickly an enemy there, and HOLDING it opens the wheel of what the mark
    // means (src/game/brplay.ts PING_INTENTS). A squad without voice is
    // legible or it is not, and "here" on its own is not.
    if (input.pressedNow("ping") && duel instanceof BrMatch && duel.alive) {
      pingHeldAt = now;
      pingVec.x = pingVec.y = 0;
      pingPick = null;
    }
    if (pingHeldAt >= 0 && input.held("ping") && !pingWheelOpen && now - pingHeldAt >= squadCfg.pingWheel.openAfter) pingWheelOpen = true;
    if (pingHeldAt >= 0 && !input.held("ping")) {
      const held = pingWheelOpen;
      const pick = pingPick;
      pingWheelOpen = false;
      pingHeldAt = -1;
      if (duel instanceof BrMatch && duel.alive) {
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        if (held) {
          // the wheel: what it picked, or nothing if it pointed nowhere
          if (pick !== null) {
            hud.notice(brPlay.pingIntent(duel, camera.position.clone(), f, now, duel.id, pick), now, 1.4);
            lastPingAt = -Infinity;
          }
        } else if (now - lastPingAt < PING_DOUBLE) {
          brPlay.pingEnemy(duel, camera.position.clone(), f, now, duel.id);
          lastPingAt = -Infinity;
        } else {
          brPlay.ping(duel, camera.position.clone(), f, now, duel.id);
          lastPingAt = now;
        }
      }
    }

    // discrete keys
    // the pad's X is interact when there is a prompt for it (a zipline, an item, a revive)
    const padInteracts = (player.zipPrompt || (duel instanceof BrMatch && brPlay.hud.prompt !== null) || (!duel && drill.state === "idle" && drill.onPad(player.pos))) && input.pad.pressedNow("reload");
    if (armed && input.pressedNow("reload") && !loadout.swapping && !padInteracts) {
      ws.startReload(now);
      if (ws.reloading) audio.reload();
    }
    // weapon select: 1 and 2 pick a slot, Q swaps to the other
    if (armed && input.pressedNow("slot1") && loadout.requestSwap(0, now)) audio.swap();
    if (armed && input.pressedNow("slot2") && loadout.requestSwap(1, now)) audio.swap();
    // Q or the forward thumb button, which is where most players bind swap
    if (armed && input.pressedNow("swapWeapon") && loadout.requestNext(now)) audio.swap();
    if (!duel && input.pressedNow("dummyMode")) hud.notice(`DUMMIES: ${cycleDummyMode()}`, now, 1.2);
    if (!duel && input.pressedNow("interact") && drill.state === "idle" && drill.onPad(player.pos)) drill.start(now);
    if (input.pressedNow("cycleArmor")) {
      armorTier = ((armorTier + 1) % 5) as ArmorTier;
      for (const d of dummies) d.setTier(armorTier); // also clears engagedAt
    }
    if (input.pressedNow("resetDummies")) {
      for (const d of dummies) d.reset();
      for (const t of targets) t.reset();
      for (const c of courses) c.reset();
      // and the live overlay's numbers, the spray wall, a drill in progress
      Object.assign(stats, { shots: 0, hits: 0, headshots: 0, damage: 0, knocks: 0, lastTtk: null });
      sprayWall.clear();
      drill.stop();
      hud.notice("RESET: DUMMIES, NUMBERS, THE WALL", now, 1);
    }
    if (input.pressedNow("copyResult")) {
      const line = activeCourse().shareText();
      if (line) {
        void navigator.clipboard?.writeText(line).then(
          () => hud.notice("RESULT COPIED", now),
          () => hud.notice(line, now, 4)
        );
      }
    }
    // Attachments on the weapon in hand. Digits 1 and 2 are weapon slots, so
    // these get their own keys.
    if (!loadout.swapping && !knockedOut) {
      if (input.pressedNow("magLevel")) loadout.setMagLevel((loadout.active.magLevel + 1) % 5);
      if (input.pressedNow("optic")) loadout.cycleAttachment("optic");
      if (input.pressedNow("barrel")) loadout.cycleAttachment("barrel");
      if (input.pressedNow("stock")) loadout.cycleAttachment("stock");
      if (input.pressedNow("laser")) loadout.cycleAttachment("laser");
      if (input.pressedNow("hopup")) loadout.cycleAttachment("hopup");
      // B: the gun's other fire mode, where it has one (a switch hop-up may be needed)
      if (input.pressedNow("fireMode")) {
        const label = loadout.toggleFireMode();
        hud.notice(label ? `FIRE MODE: ${label.toUpperCase()}` : "THIS GUN HAS ONE FIRE MODE", now, 1);
        if (label) audio.reloadStep("bolt");
      }
      // Z: a variable optic's other zoom
      if (input.pressedNow("zoomToggle") && loadout.toggleZoom()) {
        const w = loadout.active.weapon;
        const mod = w.optic ?? w.integralOptic;
        const info = opticInfo(mod);
        if (info?.zooms) hud.notice(`${opticName(mod ?? "", info.label)}: ${info.zooms[loadout.active.zoomAlt ? 1 : 0]}`, now, 0.9);
      }
    }
    // V: melee, with the heirloom (or a fist). Apex's melee does 30 anywhere
    // it lands, at arm's length.
    if (input.pressedNow("melee") && now >= meleeReadyAt && !loadout.swapping && !downedNow && (!duel || duel.canFire)) {
      meleeReadyAt = now + MELEE_COOLDOWN;
      viewModel.melee();
      meleeHitAt = now + MELEE_TIME * 0.35;
    }
    // 4: a tap is the quick heal, a hold opens the wheel (move the mouse to an item, let go)
    if (input.pressedNow("heal")) {
      healHeldAt = now;
      wheelVec.x = wheelVec.y = 0;
      wheelPick = null;
    }
    if (healHeldAt >= 0 && input.held("heal") && !wheelOpen && now - healHeldAt >= 0.25 && vitalsTarget()) wheelOpen = true;
    if (healHeldAt >= 0 && !input.held("heal")) {
      if (wheelOpen) {
        if (wheelPick) startHeal(now, wheelPick);
      } else startHeal(now);
      wheelOpen = false;
      healHeldAt = -1;
    }
    // 7: hold for the emote wheel (move to one, let go); a tap plays the last one again
    // 8: your spray on the wall you look at
    if (input.pressedNow("spray")) doSpray(now);
    // your banner card to the match, now and then
    if (duel && now - bannerSentAt > BANNERS.resend) {
      bannerSentAt = now;
      duel.localFx("banner", undefined, undefined, myBanner());
    }
    if (input.pressedNow("emote")) {
      emoteHeldAt = now;
      emoteVec.x = emoteVec.y = 0;
      emotePick = null;
    }
    if (emoteHeldAt >= 0 && input.held("emote") && !emoteWheelOpen && now - emoteHeldAt >= 0.2) emoteWheelOpen = true;
    if (emoteHeldAt >= 0 && !input.held("emote")) {
      const pick = emoteWheelOpen ? emotePick : lastEmote;
      emoteWheelOpen = false;
      emoteHeldAt = -1;
      if (pick !== null) playEmote(pick, now);
    }
    if (input.pressedNow("map")) mapOpen = !mapOpen;
    // 5 and 6 pick an ability while its card is up (any time in the range);
    // on a controller the d-pad's left and right pick while the card is up
    if (abilities.enabled && (abilities.choosing || !duel)) {
      // (the pad's D-pad left and right are these while the card is up: gamepad.ts)
      if (input.pressedNow("pickAbility1")) pickAbility("jolt", now);
      else if (input.pressedNow("pickAbility2")) pickAbility("triage", now);
      else if (input.pressedNow("pickAbility3")) pickAbility("scout", now);
      else if (input.pressedNow("pickAbility4")) pickAbility("hook", now);
      else if (input.pressedNow("pickAbility5")) pickAbility("smoke", now);
      else if (input.pressedNow("pickAbility6")) pickAbility("ward", now);
    }
    // F: the ability; Z: the ultimate
    if (input.pressedNow("ability") && !knockedOut) useAbility(now);
    if (input.pressedNow("ultimate") && !knockedOut) useUltimate(now);
    // K: race your best run's ghost, or not
    if (input.pressedNow("ghost")) {
      const course = activeCourse();
      const on = course.toggleGhost();
      hud.notice(on ? (course.hasGhost ? "GHOST ON" : "GHOST ON: finish a run to record one") : "GHOST OFF", now, 1.4);
    }

    // X: the camera; Alt (held, third person): the mouse turns the camera round you
    if (input.pressedNow("thirdPerson")) {
      setThirdPerson(!thirdPerson);
      hud.notice(thirdPerson ? "THIRD PERSON  (hold Alt to look round)" : "FIRST PERSON", now, 1.4);
    }
    orbiting = thirdPerson && (input.held("orbit") || debugOrbitHold);

    // mouse -> view. adsH is read from the CURRENT weapon object, which the
    // mag-level key above may have just replaced.
    const adsHNow = zoomFov43(loadout.active.weapon) * settings.fovScale;
    const m = input.consumeMouse();
    const adsScale = 1 + (adsSensScale(hipH, adsHNow, settings.ads * opticAdsMult()) - 1) * ws.adsFrac;
    if (wheelOpen) {
      // the wheel: five items round the circle, the mouse's (or the right stick's) direction picks
      wheelVec.x = Math.max(-200, Math.min(200, wheelVec.x + m.dx - padLook.yawLeft * 14));
      wheelVec.y = Math.max(-200, Math.min(200, wheelVec.y + m.dy - padLook.pitchUp * 14));
      if (Math.hypot(wheelVec.x, wheelVec.y) > 40) {
        const a = (Math.atan2(wheelVec.x, -wheelVec.y) + Math.PI * 2) % (Math.PI * 2);
        wheelPick = HEAL_ORDER[Math.round(a / ((Math.PI * 2) / HEAL_ORDER.length)) % HEAL_ORDER.length];
      }
      m.dx = 0;
      m.dy = 0;
    }
    if (pingWheelOpen) {
      // the ping wheel: the mouse's direction picks, as the emote wheel's does
      pingVec.x = Math.max(-200, Math.min(200, pingVec.x + m.dx));
      pingVec.y = Math.max(-200, Math.min(200, pingVec.y + m.dy));
      const at = pingPickAt(pingVec.x, pingVec.y);
      if (at !== null) pingPick = at;
      m.dx = 0;
      m.dy = 0;
    }
    if (emoteWheelOpen) {
      // the emote wheel: the mouse's direction picks, as the heal wheel's does
      emoteVec.x = Math.max(-200, Math.min(200, emoteVec.x + m.dx));
      emoteVec.y = Math.max(-200, Math.min(200, emoteVec.y + m.dy));
      if (Math.hypot(emoteVec.x, emoteVec.y) > 40) {
        const a = (Math.atan2(emoteVec.x, -emoteVec.y) + Math.PI * 2) % (Math.PI * 2);
        emotePick = Math.round(a / ((Math.PI * 2) / EMOTES.length)) % EMOTES.length;
      }
      m.dx = 0;
      m.dy = 0;
    }
    if (orbiting) {
      const k = degPerCount(settings.sens);
      orbitYaw -= m.dx * k;
      orbitPitch = Math.max(-60, Math.min(70, orbitPitch - m.dy * k));
    } else player.applyMouse(m.dx, m.dy, degPerCount(settings.sens) * adsScale, playerCfg.invertPitch);
    // the controller's right stick, read this frame in padLook, with aim
    // assist (aimassist.ts) when the pad is what is aiming: its look stick or
    // its move stick in use this frame, so a mouse player never gets it
    const padAiming =
      padLook.yawLeft !== 0 || padLook.pitchUp !== 0 || (["forward", "back", "left", "right"] as const).some((a) => input.pad.held(a));
    const assist =
      padAiming && !knockedOut
        ? aimAssist.update({
            eye: player.eyePosition(),
            yaw: player.yaw,
            pitch: player.pitch,
            ads: ws.adsFrac,
            activeInput: true,
            targets: duel ? duel.avatars.filter((a) => !isAllyFigure(a)) : rangeTargets,
          })
        : null;
    const slow = assist?.slow ?? 1;
    // (the wheel open: the stick is picking, not looking)
    if (!wheelOpen && !emoteWheelOpen) player.addAngles(padLook.pitchUp * slow * (playerCfg.invertPitch ? -1 : 1) + (assist?.pitchUp ?? 0), padLook.yawLeft * slow + (assist?.yawLeft ?? 0));
  }

  // The practice aim bot, after the look input so it is the last word on where
  // you are pointing. It works in a match with friends too (the owner's call:
  // a 1v1 where both know is a laugh), and the price of that is that it cannot
  // be hidden: whoever has it on wears a red bar and the word AIM BOT over
  // them on every other screen, at any range, through walls.
  {
    if (aimbot.enabled && !knockedOut && !downedNow && input.playing) {
      const aim = aimbot.update({
        eye: player.eyePosition(),
        yaw: player.yaw,
        pitch: player.pitch,
        dt,
        targets: duel ? duel.avatars.filter((a) => !isAllyFigure(a)) : rangeTargets,
      });
      // through addAngles, so the pitch clamp is the one every other input uses
      if (aim) player.addAngles(aim.pitch - player.pitch, aim.yaw - player.yaw);
    }
  }

  // holster timing, from the weapon's own holster and deploy times
  if (holster === "lowering" && now - holsterAt >= loadout.active.weapon.holsterTime) holster = "away";
  if (holster === "raising" && now - holsterAt >= loadout.active.weapon.deployTime) holster = "out";
  const lowered =
    holster === "away"
      ? 1
      : holster === "lowering"
        ? Math.min(1, (now - holsterAt) / Math.max(0.05, loadout.active.weapon.holsterTime))
        : holster === "raising"
          ? 1 - Math.min(1, (now - holsterAt) / Math.max(0.05, loadout.active.weapon.deployTime))
          : 0;
  // Holstered you move 15% faster: walk 199.5, sprint 299, crouch 92, and the
  // slide boost and cap scale with it.
  player.holsterBoost = (holster === "away" ? MOVE.holsterBoost : 1) * (gameTime < overdriveUntil ? KITS.runner.ult.speed : 1);
  // the kit: RUNNER's passive, the ultimate's meter (time, and the damage dealt since last frame), MEDIC's heals over time
  player.sureFooting = abilities.enabled && abilities.picked === "jolt";
  player.climbBoost = abilities.enabled && abilities.picked === "hook" ? KITS.hook.climbSpace : 1;
  stepZiplines(gameTime);
  stepSmokeKit(gameTime, dt);
  stepWalls(gameTime);
  // WARD's HARD SHELL: shield back once nothing has hurt you for a while
  {
    const regen = abilities.shieldRegen;
    const d = duel as unknown as { shield?: number; shieldMax?: number; alive?: boolean } | null;
    if (regen > 0 && d && typeof d.shield === "number" && typeof d.shieldMax === "number" && d.alive !== false && gameTime - lastHurtAt >= KITS.ward.quiet) d.shield = Math.min(d.shieldMax, d.shield + regen * dt);
  }
  {
    const dealt = duel instanceof Duel ? duel.damageDealt : 0;
    abilities.chargeUlt(duel ? dt : 0, Math.max(0, dealt - ultDamageSeen));
    ultDamageSeen = dealt;
  }
  stepRegen(gameTime, dt);

  // A weapon being raised, lowered or holstered cannot fire or aim.
  // In a 1v1, firing is held during the countdown and after a round is decided.
  // the trigger, from the script when a test is driving (as the crouch, the
  // interact and the movement already do): a magazine held on the spray wall
  // is a thing worth being able to ask for without a fake pad
  const trigger = (input.playing || !!scriptInput) && (scriptInput ? scriptInput.held("fire") : input.held("fire")) && !loadout.swapping && holster === "out" && (!duel || duel.canFire) && !player.dropping && !player.aboard && !loadout.active.empty && !downedNow && !ordnance.readied && !fireLockedToRelease;
  // a burst fires on without the trigger: knocked, or the round decided, it stops
  if (knockedOut || (duel && !duel.canFire)) ws.cancelBurst();
  // knocked in a 1v1: no aiming either
  // toggle ADS: a press goes in, the next comes out; a sprint, a swap or a holster comes out too
  if (settings.adsToggle) {
    if (!input.playing || loadout.swapping || holster !== "out" || knockedOut || downedNow) adsLatch = false;
    else if (input.pressedNow("ads") && !adsPressUsed && !ordnance.readied && !loadout.active.empty) adsLatch = !adsLatch;
    else if (input.pressedNow("sprint")) adsLatch = false;
  } else adsLatch = false;
  const adsIn = settings.adsToggle ? adsLatch : input.held("ads");
  const adsHeld = input.playing && adsIn && !loadout.swapping && holster === "out" && (!duel || duel.alive) && !loadout.active.empty && !downedNow && !ordnance.readied;
  // inspect: hold reload with a full magazine; anything that uses the gun ends it
  {
    const slot = loadout.active;
    const full = !slot.empty && slot.state.clip >= slot.weapon.clipSize && !slot.state.reloading;
    // (not in the tour: there the held X is the step's skip, and the two would fight)
    if (input.playing && input.held("reload") && full && !loadout.swapping && holster === "out" && !tour.active) {
      if (!Number.isFinite(reloadHeldAt)) reloadHeldAt = now;
      if (now - reloadHeldAt > INSPECT_HOLD && now - inspectAt > INSPECT_TIME) inspectAt = now;
    } else reloadHeldAt = -Infinity;
    // its own button too (the pad's D-pad left, held): any magazine
    if (input.playing && input.pressedNow("chat") && duel) quickOpenUntil = gameTime < quickOpenUntil ? 0 : gameTime + QUICK.open;
    if (input.playing && input.pressedNow("inspect") && !slot.empty && !loadout.swapping && holster === "out" && now - inspectAt > INSPECT_TIME) inspectAt = now;
    if (trigger || adsHeld || loadout.swapping || player.sprinting || holster !== "out" || ordnance.readied || knockedOut) inspectAt = -Infinity;
    // a new gun's first time out (a pickup, Gun Run's next gun): the flourish, once it is up
    if (slot.firstDraw && !loadout.swapping && !slot.empty) {
      slot.firstDraw = false;
      flourishAt = now;
    }
    if (trigger || adsHeld) flourishAt = -Infinity;
  }
  // Move BEFORE sampling stance, so the spread model sees this frame's stance
  // rather than last frame's. The cost is that move speed uses last frame's
  // ADS fraction, which over a 0.27 s transition is a 6% error for one frame.
  // re-read AFTER the input block, which may have swapped the weapon object
  const weapon = loadout.active.weapon;
  const adsH = zoomFov43(weapon) * settings.fovScale;
  const firing = now - ws.lastShotAt < 0.25;
  // down: the move keys only, crouched, at a crawl
  if (downedNow && duel instanceof Duel) {
    // a new knock: the knockdown shield at your EVO level's size
    // (a looted shield better than your EVO level's is the one that comes up)
    kd.onKnock(duel.knockCount, armor.level);
    // held fire raises it (and slows the crawl behind it)
    kd.up = kd.hp > 0 && (input.playing || !!scriptInput) && (scriptInput ? scriptInput.held("fire") : input.held("fire"));
    duel.kdUp = kd.up;
    // A gold shield's self-revive: hold interact. A hit, a squad mate starting
    // to revive you, or raising the shield all break the channel, and what it
    // had run is not kept (kit.ts selfRevive). Done, you stand at the same
    // health a squad mate's revive gives you, not more.
    if (kd.canSelfRevive) {
      const held = (input.playing || !!scriptInput) && (scriptInput ? scriptInput.held("interact") : input.held("interact"));
      // down, a hit lands on the bleed-out and not on health
      const hurt = duel.bleedLeft < selfReviveHp - 1e-6;
      const sr = kd.selfRevive(gameTime, held, hurt || duel.revivedBy !== null || kd.up);
      if (sr.state === "done") {
        duel.downed = false;
        duel.health = sr.health;
        duel.revivedBy = null;
        hud.notice("SELF-REVIVED", gameTime, 1.5);
        audio.healDone();
      } else if (sr.state === "cancelled") audio.ui("error");
    }
    selfReviveHp = duel.bleedLeft;
    player.healSlow = squadCfg.crawl * (kd.up ? squadCfg.kdShield.crawlScale : 1);
  } else if (kd.up) {
    kd.up = false;
    if (duel instanceof Duel) duel.kdUp = false;
  }
  // the pane in front of you while it is up
  if (kd.up && !kdPane) {
    kdPane = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.9, 16, 1, true, -0.9, 1.8), new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(kdPane);
  }
  if (kdPane) {
    kdPane.visible = kd.up && !thirdPerson;
    kdPane.position.set(player.pos.x, player.pos.y + 0.55, player.pos.z);
    kdPane.rotation.y = player.yaw * DEG + Math.PI;
  }
  selfFig?.setKnockShield(kd.up);
  // Executioner's shield after a knock, a Deathbox Respawn's shield: coming back a bit each frame
  if (execRegen && (!duel || !duel.alive)) execRegen = null;
  if (duel && duel.alive && !(duel instanceof Duel && duel.downed)) {
    if (execRegen) {
      const add = Math.min(execRegen.left, execRegen.rate * dt, duel.shieldMax - duel.shield);
      duel.shield += Math.max(0, add);
      execRegen.left -= execRegen.rate * dt;
      if (execRegen.left <= 0) execRegen = null;
    }
    if (boxRegen && duel instanceof BrMatch) {
      duel.shield = Math.min(duel.shieldMax, duel.shield + boxRegen.rate * dt);
      if (duel.shield >= duel.shieldMax) boxRegen = null;
    }
  }
  // the beams burn out on their own (a holder who left, a message lost)
  for (const [k, b] of beams) if (gameTime > b.until) setBeam(k, null);
  const moveIn = settings.crouchToggle && !scriptInput ? crouchToggled(input) : (scriptInput ?? input);
  // An emote ends when it has played, or the moment you move, jump, crouch,
  // aim or fire. Every frame, and off the same keys that move you (a script's
  // in the tests), so one never outlives the menu or a scripted walk.
  if (emoting) {
    const moved = (["forward", "back", "left", "right"] as const).some((a) => moveIn.held(a)) || moveIn.pressedNow("jump") || moveIn.pressedNow("crouch") || input.pressedNow("fire") || input.pressedNow("ads");
    if (moved) stopEmote();
    else if (now >= emoting.until) emoting = null;
  }
  if (duel instanceof BrMatch) shipFrame(duel, moveIn);
  else if (player.aboard) player.aboard = false;
  // The arrival card: walk into a place and its name comes up, the way the
  // big games name the ground you have just reached. On your feet only, and a
  // name once in a while, so a walk along a place's edge does not flicker it.
  if (duel instanceof BrMatch && duel.alive && player.onGround && duel.phase === "fight") {
    const here = brMap.placeAt(player.pos.x, player.pos.z);
    const id = here ? here.id : null;
    if (id !== placeHere) {
      placeHere = id;
      if (here && now - (placeShownAt.get(here.id) ?? -Infinity) > 20) {
        placeShownAt.set(here.id, now);
        hud.notice(here.name, now, 2);
      }
    }
  } else if (!duel) {
    placeHere = null;
    placeShownAt.clear();
  }
  // The arenas' own callouts. Worked out from where you stand rather than
  // hand-written, so every map has them, the three drawn ones included, and
  // a roof is said as a roof because that is the thing worth saying.
  {
    const b = duel && "arenaBounds" in duel ? (duel as { arenaBounds: { minX: number; maxX: number; minZ: number; maxZ: number } }).arenaBounds : null;
    if (b && duel && !(duel instanceof BrMatch)) {
      const cx = (b.minX + b.maxX) / 2;
      const cz = (b.minZ + b.maxZ) / 2;
      const call = calloutAt(player.pos.x - cx, player.pos.z - cz, player.pos.y, (b.maxX - b.minX) / 2, (b.maxZ - b.minZ) / 2);
      calloutNow = call.name;
      if (call.name !== calloutWas) {
        // said when it changes, but not the first time it is worked out: at
        // the start of a match everyone is being put on their spawn, and a
        // line about it would be the first thing they read
        const first = calloutWas === null;
        calloutWas = call.name;
        if (!first && player.onGround && duel.phase === "fight") hud.notice(calloutLine(call), now, 1.2);
      }
    } else if (!b) {
      calloutNow = null;
      calloutWas = null;
    }
  }
  player.update(dt, now, knockedOut ? NO_INPUT : downedNow ? crawlInput(moveIn) : moveIn, ws.adsFrac, weapon.adsMoveScale, firing || trigger);
  // a slide counts as crouched for the spread model: the cone tightens
  const crouched = player.crouched || player.sliding;
  const stance = !player.onGround ? "air" : crouched ? "crouch" : "stand";
  const motion = player.sprinting ? "sprint" : player.speed > 0.6 ? "walk" : "still";
  const shots = ws.update(dt, now, trigger, adsHeld, stance, motion, !player.onGround, crouched, rnd);
  if (ws.consumeDryFire()) audio.dry();
  if (ws.consumeNoAmmo()) {
    hud.notice(`NO ${weapon.ammoType.toUpperCase()} AMMO`, now, 1);
    audio.dry();
  }
  if (ws.chargeStarted) {
    ws.chargeStarted = false;
    const m = weapon.mech;
    if (m.chargeUp && m.chargeUp.time > 0.05) audio.charge(m.chargeUp.time);
    else if (m.chargeShot) audio.charge(m.chargeShot.time);
    else if (m.draw) audio.charge(m.draw.time);
  }
  if (ws.overheatStarted) {
    ws.overheatStarted = false;
    audio.overheat();
    hud.notice("OVERHEATED", now, 0.8);
  }
  updateHeal(now, trigger || adsHeld || knockedOut || downedNow || (input.playing && input.pressedNow("sprint")) || loadout.swapping);
  if (!downedNow && !heal && player.healSlow !== 1) player.healSlow = 1;

  // camera from angles + soft recoil
  const off = ws.kick.offset();
  camera.position.copy(player.eyePosition());
  // The landing dip lowers the eye rather than pitching it, because pitching
  // would move the crosshair off what you were aiming at. Dropping the eye
  // keeps the aim exactly where it was.
  camera.position.y += player.viewDip;
  // Out of a match with others still standing: you watch one of them, and you
  // choose which. The list is the match's (squad first, then the rest); this
  // keeps a place in it, moves on when whoever you are watching goes out, and
  // says nothing at all while you are still up.
  let watch: Dummy | null = null;
  if (knockedOut && duel) {
    const list = duel.spectateList();
    if (list.length) {
      if (input.playing && input.pressedNow("fire")) watchIndex++;
      if (input.playing && input.pressedNow("ads")) watchIndex--;
      watchIndex = ((watchIndex % list.length) + list.length) % list.length;
      const pick = list[watchIndex];
      watch = pick.figure;
      watchName = pick.name;
    } else {
      watch = duel.spectateTarget();
      watchName = "";
    }
  } else {
    watchIndex = 0;
    watchName = "";
  }
  if (knockedOut && !watch) camera.position.y -= 1.0;
  // Sprint view shake, as the game's setting of that name: the eye bobs with
  // each stride and the view rolls a touch. Normal is the game's default;
  // Minimal is its other option. Off is ours. The aim point is not moved: the
  // bob is a camera offset, the shot still leaves along the player's angles.
  {
    const wantShake = player.sprinting && player.onGround && !player.sliding ? 1 : 0;
    sprintShake += (wantShake - sprintShake) * Math.min(1, dt / 0.15);
    if (player.onGround && player.speed > 0.5) strideT += dt * player.speed * 0.85;
    const k = sprintShake * SPRINT_SHAKE[sprintShakeMode];
    camera.position.y += -Math.abs(Math.sin(strideT)) * 0.028 * k;
    sprintRoll = Math.sin(strideT) * 0.55 * DEG * k;
  }
  camera.quaternion.copy(player.orientation(off.pitchUp, off.yawLeft));
  if (sprintRoll !== 0) camera.quaternion.multiply(tmpQ.setFromAxisAngle(FORWARD_AXIS, sprintRoll));
  // a sideways JOLT leans the view into it
  const jr = joltRoll(gameTime);
  if (jr !== 0) camera.quaternion.multiply(tmpQ.setFromAxisAngle(FORWARD_AXIS, -jr * DEG));
  // The camera moves with the body (src/config/player.json `feel`): a lean
  // into a slide, a roll on a running landing, a kick out of a lurch, and a
  // pull forward while a paint boost is on. None of it touches the aim: the
  // shot leaves along the player's own angles, and these are the camera's
  // roll, pitch offset and field of view only. All of it is scaled by the
  // Sprint view shake setting, which is the switch for how much the view moves.
  {
    const f = playerCfg.feel;
    const k = SPRINT_SHAKE[sprintShakeMode];
    // the slide: lean into the way it is carrying you, in over `slideIn` and
    // out over `slideOut`, so it arrives with the slide and leaves after it
    const want = player.sliding ? Math.max(-1, Math.min(1, slideLeanSide())) : 0;
    const ease = Math.min(1, dt / (Math.abs(want) > Math.abs(slideLean) ? f.slideIn : f.slideOut));
    slideLean += (want - slideLean) * ease;
    let roll = slideLean * f.slideRoll;
    // The air, which was the one part of a chain that did not move with the
    // body: a jump out of a slide dropped the lean as it left the ground and
    // the view sat flat until it landed. In the air you lean into the way you
    // are steering rather than the way you are carried, so this follows the
    // wish and not the velocity, and it is smaller than the slide's.
    // the same input the movement itself reads, so what the camera leans
    // into is what the body is doing (a test drives the game through it too)
    const wish = !player.onGround && !player.climbing ? player.moveDir(scriptInput ?? input) : null;
    const yawR = player.yaw * DEG;
    const airWant = wish ? Math.max(-1, Math.min(1, wish.x * -Math.cos(yawR) - wish.z * -Math.sin(yawR))) : 0;
    const airEase = Math.min(1, dt / (Math.abs(airWant) > Math.abs(airLean) ? f.airIn : f.airOut));
    airLean += (airWant - airLean) * airEase;
    roll += airLean * f.airRoll;
    // and it dips, by how hard it came down: a landing used to arrive with a
    // roll and nothing else, so a drop of any height read as a stop rather
    // than an impact. The camera only, as everything else in this block is.
    {
      const since = gameTime - player.landAt;
      if (since >= 0 && since < f.landDipTime && k > 0) {
        const hard = Math.max(0, Math.min(1, player.landingSpeed / 9));
        const env = Math.sin((1 - since / f.landDipTime) * Math.PI * 0.9);
        camera.position.y -= f.landDip * hard * env * k;
      }
    }
    // a running landing rolls the view, by the sideways speed it came down with
    const sinceLand = gameTime - player.landAt;
    if (sinceLand >= 0 && sinceLand < f.landTime) {
      const env = 1 - sinceLand / f.landTime;
      roll += Math.max(-1, Math.min(1, player.landSide / 6)) * f.landRoll * env * env;
    }
    if (roll !== 0 && k > 0) camera.quaternion.multiply(tmpQ.setFromAxisAngle(FORWARD_AXIS, -roll * DEG * k));
    // a lurch kicks the view round a touch and settles: a tap-strafe has weight
    const sinceLurch = gameTime - player.lurchAt;
    if (sinceLurch >= 0 && sinceLurch < f.lurchTime && k > 0) {
      const env = Math.sin((1 - sinceLurch / f.lurchTime) * Math.PI);
      camera.quaternion.multiply(tmpQ.setFromAxisAngle(UP_AXIS, -player.lurchSide * f.lurchKick * env * DEG * k));
    }
    // a paint boost pulls the view forward and opens it a little, so speed
    // reads on the screen and not only on the ground under you
    const boost = Math.max(0, Math.min(1, (player.paintSpeed(gameTime) - 1) / Math.max(0.001, PAINT.speed.mul - 1)));
    boostFeel += (boost - boostFeel) * Math.min(1, dt / f.boostEase);
    if (boostFeel > 0.001 && k > 0) {
      camera.quaternion.multiply(tmpQ.setFromAxisAngle(RIGHT_AXIS, -f.boostPitch * boostFeel * DEG * k));
    }
  }
  // a blast close by shakes the view, dying away; the aim is not moved (hud.json blasts)
  {
    const t = gameTime - blastShakeAt;
    const k = t < hudCfg.blasts.shakeTime ? blastShake * (1 - t / hudCfg.blasts.shakeTime) * SPRINT_SHAKE[sprintShakeMode] : 0;
    if (k > 0) camera.quaternion.multiply(tmpQ.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 2 * k * DEG, (Math.random() - 0.5) * 2 * k * DEG, 0)));
  }
  // the shots leave from the eye whichever camera is on
  eye.copy(camera.position);
  aimYaw = player.yaw;
  aimPitch = player.pitch;
  // an emote steps your view back to watch it, whichever camera you play in
  const third = (thirdPerson || !!emoting) && !watch;
  if (third) {
    // Behind the right shoulder, looking where you look; orbiting, round the
    // figure's chest from wherever the orbit angles put it. A wall behind
    // pulls the camera in. The crosshair is what the camera's centre ray hits,
    // and the shot goes from the eye to that point, so it lands on the
    // crosshair rather than parallel to it.
    // an emote: the camera comes round in front of you to watch it
    const orbitNow = orbiting || !!emoting;
    if (emoting) {
      const ease = 1 - Math.exp(-4 * dt);
      orbitYaw += (160 - orbitYaw) * ease;
      orbitPitch += (-6 - orbitPitch) * ease;
    } else if (!orbiting) {
      const ease = 1 - Math.exp(-10 * dt);
      orbitYaw -= orbitYaw * ease;
      orbitPitch -= orbitPitch * ease;
    }
    const camQ = player.orientationAt(player.yaw + orbitYaw, Math.max(-80, Math.min(80, player.pitch + orbitPitch)), orbitNow ? 0 : off.pitchUp, orbitNow ? 0 : off.yawLeft);
    const fwd = tmpDir.set(0, 0, -1).applyQuaternion(camQ).clone();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
    const back = fwd.clone().negate();
    const pivot = orbitNow ? player.pos.clone().add(new THREE.Vector3(0, player.crouched || player.sliding ? 0.85 : 1.25, 0)) : eye.clone();
    if (!orbitNow) {
      // over the shoulder, unless a wall is against it
      const side = Math.min(0.45, Math.max(0, solidHit(pivot, right, 0.45) - 0.1));
      pivot.addScaledVector(right, side).y += 0.1;
    }
    let dist = orbitNow ? (emoting ? emotesCfg.camera.back : 3.2) : 2.4 - 0.9 * ws.adsFrac;
    const wall = solidHit(pivot, back, dist);
    if (wall < dist) dist = Math.max(0.25, wall - 0.15);
    camera.position.copy(pivot).addScaledVector(back, dist);
    camera.quaternion.copy(camQ);
    // the aim: the eye toward the camera ray's first wall (or 200 m out)
    const reach = Math.min(200, solidHit(camera.position, fwd, 200));
    const at = camera.position.clone().addScaledVector(fwd, reach);
    const d = at.sub(eye);
    const len = d.length();
    if (len > 1e-3) {
      aimYaw = (Math.atan2(-d.x, -d.z) * 180) / Math.PI;
      aimPitch = (Math.asin(Math.max(-1, Math.min(1, d.y / len))) * 180) / Math.PI;
    }
  } else {
    orbitYaw = 0;
    orbitPitch = 0;
  }
  if (player.aboard && duel instanceof BrMatch && duel.ship) {
    // aboard: the camera rides behind and above the ship, round it as you look
    const camQ = player.orientationAt(player.yaw, player.pitch, 0, 0);
    const back = tmpDir.set(0, 0, 1).applyQuaternion(camQ);
    camera.position.copy(duel.ship.at(realNow())).addScaledVector(back, SHIP.chase);
    camera.position.y += SHIP.chaseUp;
    camera.quaternion.copy(camQ);
  }
  const watchMate = watch && duel ? duel.remoteOf(watch) : null;
  if (watch && knockedOut && input.pressedNow("thirdPerson")) spectateFirst = !spectateFirst;
  if (watch && watchMate && watchMate.id < Duel.BOT_ID && spectateFirst) {
    // a squad mate: through their eyes, their aim
    const f = watch.group;
    const pose = watch.currentPose;
    camera.position.set(f.position.x, f.position.y + (pose.stance === "crouch" || pose.stance === "slide" ? 1.05 : 1.6), f.position.z);
    camera.quaternion.setFromEuler(new THREE.Euler((pose.pitch * Math.PI) / 180, f.rotation.y - Math.PI, 0, "YXZ"));
  } else if (watch) {
    // behind and above the figure, looking where it looks (the figure faces +z of its own rotation)
    const f = watch.group;
    const fx = Math.sin(f.rotation.y);
    const fz = Math.cos(f.rotation.y);
    camera.position.set(f.position.x - fx * 2.6, f.position.y + 2.1, f.position.z - fz * 2.6);
    camera.lookAt(f.position.x + fx * 2, f.position.y + 1.2, f.position.z + fz * 2);
  }
  const hipV = verticalFovFrom43(hipH);
  const adsV = verticalFovFrom43(adsH);
  // Sliding widens the view by slideFovScale (an engine value). Sprint does
  // not: the sprint FOV kick that was here was ours, and Apex has none.
  // a JOLT: the view widens by its kick at once, and settles as the dash hands over to the run
  joltFov += ((player.jolting ? JOLT.feel.fov / hipV : 0) - joltFov) * Math.min(1, dt / (player.jolting ? JOLT.feel.rollIn : JOLT.feel.rollOut));
  // and a paint boost opens it a touch too, the same way the slide does
  const speedFov = (player.slideFov + joltFov + boostFeel * playerCfg.feel.boostFov * SPRINT_SHAKE[sprintShakeMode]) * (1 - ws.adsFrac);
  camera.fov = (hipV + (adsV - hipV) * ws.adsFrac) * (1 + speedFov);
  camera.updateProjectionMatrix();
  // the gun's FOV: the same blend at viewmodel.json's scale, not yours, and no slide or JOLT in it
  vmCamera.fov = gunFov(hipH, adsH, ws.adsFrac, settings.fovScale, vmCfg.fovScale);
  vmCamera.aspect = camera.aspect;
  vmCamera.updateProjectionMatrix();

  // Spawn shots. Each bullet leaves along the aim as it stood the instant
  // BEFORE that shot's own view kick, so the first round of a burst is
  // perfectly accurate. Hard recoil from earlier shots in the same frame is
  // accumulated so shot 2 of a frame sees shot 1's permanent kick.
  let hardPitch = 0;
  let hardYaw = 0;
  // Seasons 29 and 30's hop-ups: Shattercaps splits a hip-fired round into a blast; Redline hits harder near overheat
  const hop = loadout.active.attach.hopup;
  const shatter = hop === "hopup_shattercaps" && ws.adsFrac < 0.5 ? shatterOf(weapon) : null;
  const redline = hop === "hopup_redline" && 1 - ws.clip / Math.max(1, weapon.clipSize) >= (LOCKED_HOPUPS.hopup_redline?.heat ?? 0.75) ? (LOCKED_HOPUPS.hopup_redline?.damage ?? 1.15) : 1;
  for (const s0 of shots) {
    const s = redline !== 1 ? { ...s0, dmgScale: s0.dmgScale * redline } : s0;
    const weapon = shatter ?? loadout.active.weapon;
    // per pellet, as hits are: per trigger pull an EVA-8 read 800% accuracy
    stats.shots += weapon.pellets;
    gunRow(weapon.id).shots += weapon.pellets;
    drill.onShot(weapon.pellets);
    const shotQ = player.orientationAt(aimYaw, aimPitch, s.kick.preSoftPitchUp + hardPitch, s.kick.preSoftYawLeft + hardYaw);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(shotQ);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shotQ);
    const origin = eye.clone();
    /** a random deviation inside a cone of `cone` degrees, applied to `dir` */
    const deviate = (dir: THREE.Vector3, cone: number): void => {
      if (cone <= 0) return;
      const half = (cone / 2) * DEG;
      const ang = half * Math.sqrt(rnd()); // sqrt for a uniform disc, not centre-biased
      const rot = rnd() * Math.PI * 2;
      const axis = right
        .clone()
        .multiplyScalar(Math.cos(rot))
        .add(up.clone().multiplyScalar(Math.sin(rot)))
        .normalize();
      tmpQ.setFromAxisAngle(axis, ang);
      dir.applyQuaternion(tmpQ);
    };
    // A shotgun fires its pattern (blast.ts): the spread stat deviates the
    // blast as a whole, once, and each pellet sits at its place in the shape
    // round that. Without a pattern (a Shattercaps blast, a single round) each
    // projectile takes its own deviation inside the cone.
    const pattern = shatter ? null : blastOffsets(weapon, ws.adsFrac > 0.5, s.coneScale, rnd);
    const centre = new THREE.Vector3(0, 0, -1).applyQuaternion(shotQ);
    if (pattern) deviate(centre, s.cone * s.coneScale);
    for (let p = 0; p < weapon.pellets; p++) {
      tmpDir.copy(centre);
      if (pattern) {
        // across: positive is right, which is a turn the other way about `up`; up is a turn about `right`
        const [across, upDeg] = pattern[p % pattern.length];
        tmpDir.applyAxisAngle(up, -across * DEG).applyAxisAngle(right, upDeg * DEG);
      } else {
        // a single pellet of a shotgun still spreads, using at least the
        // weapon's own cone so the pattern is not a laser
        const cone = shatter ? Math.max(s.cone, LOCKED_HOPUPS.hopup_shattercaps?.cone ?? 5) : (weapon.pellets > 1 ? Math.max(s.cone, weapon.spread.standHip) : s.cone) * s.coneScale;
        deviate(tmpDir, cone);
      }
      // the tracer from the muzzle you see: the gun in first person, your figure's in third
      const muzzle = thirdPerson ? (selfFig?.muzzleWorld() ?? null) : onScreenAsWorld(viewModel.muzzleWorld());
      projectiles.fire(origin.clone(), tmpDir, weapon, false, s.dmgScale, s.speedScale, muzzle);
      duel?.localShot(origin, tmpDir, weapon.id);
      selfFig?.kick();
    }
    hardPitch += s.kick.permPitchUp;
    hardYaw += s.kick.permYawLeft;
    viewModel.onShot();
    audio.gun(weapon.id);
    // the last rounds: a click that climbs as the magazine runs out (hud.json lowAmmo)
    {
      const left = loadout.active.state.clip;
      const size = weapon.clipSize;
      const from = Math.ceil(size * hudCfg.lowAmmo.click);
      if (size >= hudCfg.lowAmmo.minClip && left <= from) audio.lowAmmo(1 - left / Math.max(1, from));
    }
    input.pad.rumble(0.15, 0.35, 40);
  }
  if (shots.length) {
    // hard recoil moves the base angles, then the camera is refreshed so this
    // frame renders the post-shot view rather than lagging by a frame
    player.addAngles(hardPitch, hardYaw);
    if (!third) camera.quaternion.copy(player.orientation(off.pitchUp, off.yawLeft));
  }

  const handleImpact = (e: ImpactEvent): void => {
    // a melee that lands: the punch where it landed
    if (e.weapon === "melee" && (e.dummy || e.target)) audio.punch(e.point);
    // the README screen took the round (an arrow, or a section's name): a hit
    // marker, no damage and no spray-wall dot
    if (e.shootable) {
      hud.hitMarker(now, false);
      return;
    }
    // a round into the level in a match: a hole, dust and its sound
    if (duel && !e.dummy && !e.target && e.normal && e.weapon !== "melee") {
      markImpact(e.point, e.normal);
      return;
    }
    // a round into the spray wall (the range only)
    if (!duel && !e.dummy && !e.target && e.distance > 1) {
      const w = e.weapon === loadout.active.weapon.id ? loadout.active.weapon : e.weapon && e.weapon !== "melee" ? resolveWeapon(e.weapon, 0) : null;
      if (w) sprayWall.hit(e.point, w, now, e.distance, ws.adsFrac > 0.5);
      return;
    }
    // the flick drill's figure: counted, and the next one is up at once
    if (e.dummy && drill.onHit(e.dummy, now)) {
      hud.hitMarker(now, e.report?.headshot ?? false);
      audio.hitTier(e.report?.headshot ? "head" : "health");
      const g = gunRow(e.weapon);
      g.hits++;
      return;
    }
    if (e.damage > 0 || e.report) {
      const g = gunRow(e.weapon);
      g.hits++;
      g.damage += e.report?.amount ?? e.damage;
      if (e.report?.headshot || e.targetHead) g.heads++;
    }
    // a shootable target rather than a dummy
    if (e.target) {
      stats.hits++;
      stats.damage += e.damage;
      if (e.targetHead) stats.headshots++;
      hud.addDamage(e.point, e.damage, e.targetHead ? "#ffd23c" : "#9fe0ff", e.targetHead, now, e.target);
      hud.hitMarker(now, e.targetHead);
      audio.hitTier(e.targetHead ? "head" : "white");
      return;
    }
    // another player (or a bot) in a match: send the damage, show it at once
    const remote = duel && e.dummy ? duel.remoteOf(e.dummy) : null;
    if (duel && remote && e.report) {
      const r = e.report;
      const wasAlive = remote.health > 0;
      const onShield = remote.shield > 0;
      if (duel.phase === "fight" && remote.alive) {
        dlog.hit({ t: realNow(), from: duel.id, to: remote.id, amount: r.amount, head: r.headshot, weapon: e.weapon, dist: e.distance });
        // when you last hurt them: their plate shows for a while after (and a battle royale's assists)
        damagedAt.set(remote.id, gameTime);
        // a battle royale's shield core levels with the damage you deal; the gun's locked hop-up counts it too
        if (duel instanceof BrMatch) {
          giveEvo(r.amount);
          hopProgress(e.weapon, r.amount);
        }
      }
      const wasDowned = remote.downed;
      duel.localHit(remote, r.amount, r.headshot, e.weapon, e.distance);
      stats.hits++;
      stats.damage += r.amount;
      if (r.headshot) stats.headshots++;
      const color = onShield ? `#${ARMOR_COLOR[2].toString(16).padStart(6, "0")}` : "#ff4a3d";
      // (a squad's bot knocked goes down with a fresh bleed-out pool, so its health says nothing)
      const knock = wasAlive && (remote.health <= 0 || (remote.downed && !wasDowned));
      hud.addDamage(r.point, r.amount, r.headshot ? "#ffd23c" : color, r.headshot || knock, now, remote);
      // A bot's knock is its death unless it went down (a duo's or a trio's
      // bot with a mate up), and a human's is once the hit left them out
      // (solo, a 1v1): that is a kill, marked and heard as one. A knock a
      // squad mate can still revive is a knock.
      const kill = knock && (remote.id >= Duel.BOT_ID ? !remote.downed : !remote.alive || !(duel instanceof BrMatch) || duel.team.size === 1);
      hud.hitMarker(now, r.headshot, kill ? "kill" : knock ? "knock" : "hit");
      if (kill) {
        killStreak = gameTime - lastKillAt <= hudCfg.killMarker.streak ? killStreak + 1 : 0;
        lastKillAt = gameTime;
        audio.eliminate(Math.min(killStreak, hudCfg.killMarker.chimeMax) * hudCfg.killMarker.chimeStep);
      }
      if (knock) {
        hud.notice(kill ? "ELIMINATED" : "KNOCKED DOWN", now, 0.8);
        stats.knocks++;
        audio.knock();
        if (e.dummy) audio.bodyFall(e.dummy.group.position);
        // Executioner: a knock with the gun that has it gives shield back over a few seconds
        const ex = LOCKED_HOPUPS.hopup_executioner;
        if (ex && !loadout.active.empty && loadout.active.id === e.weapon && loadout.active.attach.hopup === "hopup_executioner") {
          execRegen = { left: ex.shield ?? 50, rate: (ex.shield ?? 50) / (ex.over ?? 5) };
          hud.notice(`${hopupName("hopup_executioner").toUpperCase()}: +${ex.shield} SHIELD`, now, 1.2);
        }
      } else if (onShield && remote.shield <= 0) audio.shieldBreak();
      else audio.hitTier(r.headshot ? "head" : onShield ? "blue" : "health");
      return;
    }
    if (!e.dummy || !e.report) return;
    const r = e.report;
    stats.hits++;
    stats.damage += r.amount;
    if (r.headshot) stats.headshots++;
    // Timing is per dummy, and the clock starts on THIS dummy's first hit.
    // A single global start reported 0.00 s for any one-shot knock and mixed
    // targets together.
    const firstHit = e.dummy.engagedAt === null;
    if (firstHit) e.dummy.engagedAt = now;
    const color = r.toShield > 0 ? `#${ARMOR_COLOR[e.dummy.tier].toString(16).padStart(6, "0")}` : "#ff4a3d";
    hud.addDamage(r.point, r.amount, r.headshot ? "#ffd23c" : color, r.headshot || r.knocked, now, e.dummy);
    hud.hitMarker(now, r.headshot, r.knocked ? "knock" : "hit");
    if (r.knocked) {
      hud.notice("KNOCKED DOWN", now, 0.8);
      stats.knocks++;
      // a one-shot knock is a genuine 0, not a missing measurement
      stats.lastTtk = now - (e.dummy.engagedAt ?? now);
      audio.knock();
    } else if (r.broke) audio.shieldBreak();
    else audio.hitTier(r.headshot ? "head" : r.toShield > 0 ? (SHIELD_TIER[e.dummy.tier] ?? "white") : "health");
  };
  projectiles.update(dt, now, handleImpact);
  // the guided tour: its marker and the check for the step
  tourHud = !duel ? tour.update(now, tourCheck(now), input.playing && input.held("interact"), (a) => keyLabel(a as Parameters<typeof keyLabel>[0])) : null;
  // throwables: their flights, fuses and fires; a blast's hits go the bullets' way
  impactSink = handleImpact;
  throwables.update(now, dt, throwTargets());
  // the paint under your feet this frame: the boost itself is the player's,
  // and it outlives the ground it came from (src/config/paint.json)
  {
    const p = player.onGround ? paintUnder(throwables.paints, player.pos) : null;
    player.onPaint(p ? p.kind : null, now);
  }
  // The carried charges move whoever is standing on or in them. Throws replay
  // on every client already, so every client has the same pads and the same
  // rifts and moves only its own player: an enemy is thrown and carried with
  // no new packet at all.
  {
    const me = { id: duel ? duel.id : -1, feet: player.pos, downed: downedNow };
    const launch = throwables.launchFor(me, now);
    if (launch) player.impulse(launch.x, launch.y, launch.z);
    const out = throwables.riftFor(me, now);
    if (out) player.teleport(out.x, out.y, out.z, player.yaw, player.pitch);
  }
  updateAfterburns(now);
  if (ordnance.readied && now >= ordnance.readied.readyAt && !third) {
    // the path is 90 steps against every box in the world: ten times a second is plenty to aim by
    if (now >= previewNextAt) {
      previewNextAt = now + 0.1;
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
      const from = player.eyePosition().addScaledVector(fwd, 0.45).addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.12, 0));
      throwables.preview(from, throwVelocity(ordnance.readied.kind, fwd));
    }
  } else {
    previewNextAt = 0;
    throwables.preview(null, null);
  }
  // the melee swing lands a third of the way through
  if (now >= meleeHitAt) {
    meleeHitAt = Infinity;
    // a swing is an attack for the accuracy readout, as a hit with it counts
    stats.shots++;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(player.orientationAt(aimYaw, aimPitch, 0, 0));
    // Gun Run's last level: the knife (100 a hit, 300 to the head)
    const knife = duel instanceof ArenaMode && duel.knifeNow;
    projectiles.melee(eye, dir, MELEE_RANGE, knife ? MODES.gunRun.knifeDamage : MELEE_DAMAGE, now, handleImpact, knife ? MODES.gunRun.knifeHeadDamage : MELEE_DAMAGE);
    // a shut door in front of the swing takes the kick (doors.json kicks break it)
    if (duel instanceof BrMatch) {
      const door = brMap.doors.aimedAt(eye, dir);
      if (door && !door.open && door.centre.distanceTo(eye) < doorsCfg.kickReach) duel.kickDoor(door.i);
    }
  }

  // ---------- the killcam and the recap ----------
  // Space (or E, or A on a pad) skips the replay, then closes the recap; your
  // next fight ends both. The replay's camera is set here, over the one above.
  if (killcam.active) {
    const skip = input.pressedNow("jump") || input.pressedNow("interact");
    if (skip || !duel || (duel.phase === "fight" && duel.alive)) killcam.stop();
    else if (killcam.update(wall, dt)) {
      killcam.pose(camera);
      camera.fov = verticalFovFrom43(hipH);
      camera.updateProjectionMatrix();
    }
    if (!killcam.active && recap) recapShownAt = now;
  } else if (recap && (input.pressedNow("jump") || input.pressedNow("interact") || !duel || (duel.phase === "fight" && duel.alive))) recap = null;

  // the range's tooling: moving dummies, the ones that shoot back, the drill, the trainer
  if (!duel) {
    dummyBehaviour.update(now, dt);
    if (input.playing || scriptInput) rangeCombat.update(now, dummies, player.pos, projectiles, combatWeapon);
    // the menu open: the drill's clock waits
    if (!input.playing && !scriptInput) drill.hold(dt);
    drill.update(now);
  }
  trainer.update(now, player, scriptInput ?? input);
  readmeTv.update(now);
  for (const d of dummies) d.update(now, dt);
  drill.target.update(now, dt);
  for (const d of galleryFigs) d.update(now, dt);
  fx.update(now);
  sprays.update(gameTime);
  impacts.update(gameTime, dt);
  // the menu stops a run's clock (a minute on the Settings tab was a minute
  // on the time); a test script drives the course without the menu
  if (!duel) {
    for (const c of courses) {
      if (input.playing || scriptInput) c.update(now, dt, player);
      else c.pause(dt);
    }
  }
  for (const t of targets) t.update(now, dt);
  // The model on screen switches at the bottom of the swap dip, when the gun
  // is out of frame: the outgoing weapon before the midpoint, the incoming one
  // after it.
  const swapP = loadout.swapping ? loadout.swapProgress(now) : 1;
  const onScreen = loadout.swapping && swapP < 0.5 ? loadout.active : loadout.display;
  let drawn = onScreen.weapon;
  if (killcam.active && killcam.killerWeapon) drawn = killcamGun(killcam.killerWeapon);
  if (debugView.weapon) {
    const key = `${debugView.weapon}:${debugView.optic ?? ""}`;
    let dw = debugWeapons.get(key);
    if (!dw) debugWeapons.set(key, (dw = resolveWeapon(debugView.weapon, 0, debugView.optic ? [debugView.optic] : [])));
    drawn = dw;
  }
  viewModel.setWeapon(drawn);
  // the gun in hand in its finish (the Loadouts tab's choice for it, if your level allows it),
  // and the match told which, on a change and now and then for anyone who arrives late
  {
    const f = finishFor(drawn.id, progress.level.level);
    const m = gunModel(drawn.id);
    if (m.root.userData.finish !== f.id) applyFinish(m, f);
    const key = `${drawn.id}:${f.id}`;
    if (duel && (key !== finishSent || now - finishSentAt > BANNERS.resend)) {
      finishSent = key;
      finishSentAt = now;
      duel.localFx("fin", undefined, undefined, FINISHES.indexOf(f));
    }
    // the others' figures in the finishes their pages said
    if (duel instanceof Duel)
      for (const [id, n] of remoteFinishes) {
        const fig = duel.avatarOf(id);
        const want = FINISHES[n] ?? null;
        if (fig && fig.finishId !== (want?.id ?? "factory")) fig.setFinish(want);
      }
  }
  viewModel.setHeirloom(debugView.heirloom ?? loadouts.current.heirloom);
  const lookYaw = player.yaw - prevYaw;
  const lookPitch = player.pitch - prevPitch;
  prevYaw = player.yaw;
  prevPitch = player.pitch;
  viewModel.update({
    dt,
    // in the killcam the gun is the killer's, held as they held it
    adsFrac: debugView.ads ?? (killcam.active ? killcam.killerAds : ws.adsFrac),
    moveSpeed: player.speed,
    onGround: player.onGround,
    raise: swapP,
    sprinting: player.sprinting,
    sliding: player.sliding,
    climbing: player.stance === "climb",
    mantling: player.stance === "mantle",
    clipEmpty: onScreen.state.clip <= 0,
    vy: player.vel.y,
    reloading: debugView.reload !== null || onScreen.state.reloading,
    reloadProgress: debugView.reload ?? (onScreen.state.reloading ? onScreen.state.reloadProgress(now) : 0),
    lookYaw,
    lookPitch,
    landDip: player.viewDip,
    lowered: debugView.lowered ?? (emptyHand || downedNow || debugView.downed || (knockedOut && !killcam.active) || ordnance.readied ? 1 : lowered),
    downed: downedNow || debugView.downed ? 1 : 0,
    inspect: debugView.inspect ?? (now - inspectAt < INSPECT_TIME ? (now - inspectAt) / INSPECT_TIME : undefined),
    flourish: now - flourishAt < FLOURISH_TIME ? (now - flourishAt) / FLOURISH_TIME : undefined,
    onZip: debugView.onZip ?? player.onZip,
    draw: onScreen.state.drawFrac,
  });
  // in third person the gun in your hands is on your figure instead; in the
  // killcam the gun in view is your killer's, and it kicks when they fire
  // out (knocked in a round, eliminated): no gun and no hands at all, except the killer's in the killcam;
  // in the skydive the hands are put away, out of the view of the ground you are steering onto
  viewModel.group.visible = killcam.active || (!third && !knockedOut && !player.dropping && !player.aboard);
  if (killcam.active && killcam.firedThisFrame) viewModel.onShot();
  selfFigure(now, dt, emptyHand ? "" : onScreen.weapon.id, loadouts.current.operator, third && !killcam.active, knockedOut, downedNow);
  for (const lf of labFigs) {
    lf.f.setPose(lf.pose);
    // a knocked-out one stands a moment first (it drops the gun it held)
    if (lf.dead && now - lf.at > 0.6) lf.f.fallDown();
    lf.f.update(now, dt);
  }

  // Search: interact held is a plant on a site, or a defuse beside the bomb
  if (duel instanceof ArenaMode) duel.holding = (input.playing || !!scriptInput) && (scriptInput ? scriptInput.held("interact") : input.held("interact"));
  duel?.update({
    x: player.pos.x,
    y: player.pos.y,
    z: player.pos.z,
    yaw: player.yaw,
    pitch: player.pitch,
    crouch: player.crouched || player.sliding,
    weapon: emptyHand ? "" : onScreen.weapon.id,
    operator: loadouts.current.operator,
    name: profile.profile.name,
    ready: input.playing,
    stance: downedNow ? "downed" : player.stance,
    speed: player.speed,
    ads: ws.adsFrac,
    act: localAct(),
    aimbot: aimbot.enabled,
  });
  // the battle royale from your side: E, the pads, pings
  if (duel instanceof BrMatch) {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    // a closed supply bin near you hums, every couple of seconds, the nearest one
    if (now - binHumAt > 1.8 && duel.lootField) {
      binHumAt = now;
      let best: THREE.Vector3 | null = null;
      let bestD: number = BINS.humHear;
      for (const b of duel.lootField.drops.values()) {
        if (b.item.kind !== "bin" || b.item.id !== "closed") continue;
        const dd = b.pos.distanceTo(player.pos);
        if (dd < bestD) {
          bestD = dd;
          best = b.pos;
        }
      }
      if (best) audio.binHum(best);
    }
    // what the backpack lets you carry of each ammo type (ammo.json carry)
    loadout.ammo.packTier = PACK_ORDER.indexOf(kit.pack);
    brPlay.update(now, duel, player, scriptInput ?? input, camera.position.clone(), f, { alive: duel.alive, downed: downedNow, playing: input.playing || !!scriptInput, myId: duel.id });
  }

  // the killcam's recording: you and everyone else, 30 times a second
  if (duel) {
    const d = duel;
    recorder.sample(wall, () => [
      { id: d.id, name: profile.profile.name, x: player.pos.x, y: player.pos.y, z: player.pos.z, yaw: player.yaw, pitch: player.pitch, stance: downedNow ? "downed" : player.stance, speed: player.speed, weapon: onScreen.weapon.id, op: loadouts.current.operator, alive: d.alive },
      ...d.actorStates(),
    ]);
  }

  // the ability card: at each countdown of an arena or bot match, and on
  // landing from a battle royale's drop; a re-offer (a pick already made)
  // goes away by itself when the fight starts
  if (duel && duel.abilities) {
    const ph = duel.phase;
    if (duel instanceof BrMatch) {
      if (wasDropping && !player.dropping && duel.alive && !abilities.picked) abilities.offer(now);
    } else if (ph === "countdown" && lastMatchPhase !== "countdown") abilities.offer(now);
    else if (ph === "fight" && lastMatchPhase === "countdown" && abilities.picked) abilities.choosing = false;
    lastMatchPhase = ph;
  } else lastMatchPhase = null;
  wasDropping = player.dropping;

  // the arena circles: a column of light once the match's is live
  {
    const z = duel ? duel.hud().zone : null;
    const inTri = duel !== null && duel.players >= 3 && duel.kind === "duel";
    // Every arena has its own circle now (src/game/arena.ts ARENA_HANDLES), and
    // only the one the match is standing in lights up. A match that does not
    // say which is the warehouse, or the triangle for three.
    const onMap = duel && "arenaId" in duel ? (duel as { arenaId: string }).arenaId : "warehouse";
    const active = inTri ? "triangle" : onMap;
    for (const [id, a] of ARENA_HANDLES) {
      const live = id === active && !!z?.live;
      a.zone.column.visible = live;
      (a.zone.ring.material as THREE.MeshStandardMaterial).emissiveIntensity = live ? 2.2 + Math.sin(now * 6) * 0.6 : 1.2;
    }
  }

  // Digital Threat optics: aiming through one lights enemies up red, fading
  // out over the data's threat_scope_fadedist range.
  {
    const range = drawn.threatRange;
    const aim = Math.max(0, Math.min(1, ((debugView.ads ?? ws.adsFrac) - 0.6) / 0.3));
    for (const d of duel ? [...threatTargets, ...duel.avatars] : threatTargets) {
      // SCOUT's PULSE or SWEEP (or a squad mate's) shows an enemy whatever the optic
      let t = kitSight()?.shown.has(d) ? 1 : 0;
      if (range && aim > 0 && d.group.visible && !d.knocked) {
        const dist = d.group.position.distanceTo(camera.position);
        t = Math.max(t, aim * (dist <= range[0] ? 1 : dist >= range[1] ? 0 : 1 - (dist - range[0]) / (range[1] - range[0])));
      }
      d.setThreat(t);
    }
  }

  // The sky dome is drawn at a fixed radius around the camera, so it has to be
  // re-centred every frame or you can walk out of your own sky.
  skyFollow(camera);
  // the ears are the camera's (the killcam's, when it plays)
  camera.getWorldDirection(earFwd);
  earUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  audio.setListener(camera.position, earFwd, earUp);
  const hiddenForReplay: THREE.Object3D[] = [];
  if (killcam.active && duel) {
    for (const a of duel.avatars) {
      if (a.group.visible) {
        a.group.visible = false;
        hiddenForReplay.push(a.group);
      }
    }
  }
  renderer.info.reset();
  // the other players' muzzle flashes size themselves to this view (muzzle.ts)
  setMuzzleViewer(camera, renderer.domElement.clientHeight || window.innerHeight);
  if (!NO_RENDER && !document.hidden) {
    gunLayer();
    lightsOnGun();
    showSide();
    pipeline.render(now);
  }
  frameCost = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  for (const o of hiddenForReplay) o.visible = true;
  const shown = loadout.display;
  // context prompts: a zipline in reach, or a ladder you are facing
  let prompt: { key: string; text: string } | null = null;
  if (duel instanceof BrMatch && brPlay.hud.prompt) prompt = brPlay.hud.prompt;
  else if (player.zipPrompt) prompt = { key: "E", text: "RIDE ZIPLINE" };
  else if (!duel && drill.state === "idle" && drill.onPad(player.pos)) prompt = { key: keyLabel("interact"), text: "START THE FLICK DRILL" };
  else if (player.onGround && ladderAhead(player.pos.x, player.pos.y, player.pos.z, player.yaw)) {
    prompt = { key: "SPACE", text: "JUMP INTO THE WALL, HOLD W TO CLIMB" };
  }
  const optic = viewModel.opticFitted;
  const aimNow = debugView.ads ?? ws.adsFrac;
  const duelHud = duel ? duel.hud() : null;
  sounds.update({
    now,
    dt,
    player,
    live: input.playing || duel !== null,
    outdoors: duel instanceof BrMatch,
    match: duelHud,
    alive: duel ? duel.alive : true,
    health: duel ? duel.health : HEALTH_MAX,
    figures: duel ? duel.avatars : [],
    heal: heal && duel ? Math.min(1, (now - heal.startedAt) / heal.duration) : null,
    reload: { on: ws.reloading, progress: ws.reloadProgress(now), empty: ws.clip === 0 },
  });
  pipeline.setDesaturation(sounds.desat);
  hud.draw(now, camera, {
    // name/ammo follow the INCOMING weapon during a swap; cone/ADS stay with
    // the gun actually in hand
    weaponName: shown.empty ? "FISTS" : shown.weapon.name,
    hopLock: !shown.empty && shown.hopLock ? { name: hopupName(shown.hopLock.mod), have: shown.hopLock.have, need: shown.hopLock.need } : null,
    unarmed: shown.empty,
    magLevel: shown.magLevel,
    slot: loadout.displayIndex + 1,
    slotCount: loadout.slots.length,
    otherName: loadout.slots[loadout.nextIndex].empty ? "EMPTY" : loadout.slots[loadout.nextIndex].weapon.name,
    swapping: loadout.swapping,
    fireMode: loadout.fireModeLabel(),
    reserve: loadout.reserve(),
    energy: shown.energy ? { rounds: shown.energy.rounds, max: shown.energy.max } : null,
    gunCharge: shown.state.chargeFrac(now),
    heat: shown.weapon.mech.overheat ? { heat: shown.state.heat, locked: shown.state.overheated } : null,
    spin: shown.weapon.spin ? shown.state.spin : null,
    attachLines: loadout
      .attachLabels()
      .filter((a) => a.available)
      .map((a) => `${ATTACH_KEY[a.slot]}  ${a.slot}   ${a.label}`),
    clip: shown.state.clip,
    clipSize: shown.weapon.clipSize,
    reloading: shown.state.reloading,
    reloadProgress: shown.state.reloadProgress(now),
    coneDeg: ws.spread.cone(),
    adsFrac: ws.adsFrac,
    thirdPerson,
    boost: player.paintSpeed(now) > 1.001 ? "speed" : player.paintJump(now) > 1.001 ? "jump" : null,
    vFovDeg: camera.fov,
    stats,
    armorName: ARMOR_NAME[armorTier],
    cm360: cmPer360(settings.sens, settings.dpi),
    hipFov: hipH,
    fps,
    frameMs,
    yaw: player.yaw,
    px: player.pos.x,
    pz: player.pos.z,
    holstered: holster !== "out",
    course: duel ? null : (courses.map((c) => c.hud(now)).find((h) => h !== null) ?? null),
    duel: duelHud,
    // the battle royale's map, except in the Gulag's room, where the minimap shows the room
    mapRegion: duel instanceof BrMatch && !(duel.gulag && duel.gulag.phase !== "wait") ? BR_BOUNDS : undefined,
    // the drop shows the map by itself for its first moments, then it steps
    // aside so you can see the ground you are steering onto; M opens it any
    // time. Only while you are still in the air: a guest who lands before the
    // host no longer stares at the map until the host does.
    mapOpen: mapOpen || (!!duelHud?.br?.dropping && player.dropping && now < dropMapUntil),
    dive: player.dropping
      ? { k: player.diveFactor, height: player.pos.y - surfaceUnder(player.pos.x, player.pos.z, player.pos.y), following: following !== null && duel ? duel.nameFor(following) : null, breakKey: keyLabel("crouch") }
      : null,
    ship: player.aboard && duel instanceof BrMatch && duel.ship ? shipHud(duel, duel.ship) : null,
    heal: heal && vitalsTarget() ? { item: HEAL_ITEMS[heal.item].name, progress: Math.min(1, (now - heal.startedAt) / heal.duration) } : null,
    kit: (duel && duel.alive) || (!duel && rangeCombat.on && rangeCombat.alive) ? { ...kit.items } : null,
    // Tab, held: everything you are carrying in one place (hud.ts
    // drawInventory). Read only on purpose: what a player needs mid-match is
    // the answer to "what have I got", and dropping and swapping are done
    // where the item is.
    inventory: input.held("inventory")
      ? {
          guns: loadout.slots.map((sl, i) => ({
            name: weaponName(sl.weapon.id),
            clip: sl.state.clip,
            size: sl.weapon.clipSize,
            ammo: sl.energy ? `${sl.energy.rounds} energy` : `${loadout.ammo.stock[ammoTypeOf(sl.id)] ?? 0} ${ammoTypeOf(sl.id)}`,
            attach:
              i === loadout.activeIndex
                ? loadout
                    .attachLabels()
                    .filter((a) => a.available && !/none|iron/i.test(a.label))
                    .map((a) => a.label)
                : [],
            inHand: i === loadout.activeIndex,
          })),
          heals: HEAL_ORDER.filter((k) => (kit.items[k] ?? 0) > 0).map((k) => ({ name: HEAL_ITEMS[k].name, n: kit.items[k] })),
          nades: Object.entries(ordnance.counts)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => ({ name: throwName(k), n })),
          ammo: Object.entries(loadout.ammo.stock)
            .filter(([, n]) => n > 0)
            .map(([k, n]) => ({ name: k.toUpperCase(), n })),
          armor: armorTier === 0 ? "NO SHIELD" : `${ARMOR_NAME[armorTier].toUpperCase()} SHIELD`,
          helmet: armor.helmet ? `${armor.helmet.toUpperCase()} HELMET` : "NO HELMET",
        }
      : null,
    damageDirs: duel ? damageDirs() : undefined,
    reticle,
    summary: summaryView(),
    quickChat: gameTime < quickOpenUntil ? QUICK.lines : null,
    healWheel: wheelOpen ? { items: HEAL_ORDER.map((k) => ({ id: k, name: HEAL_ITEMS[k].name, count: kit.items[k] })), pick: wheelPick } : null,
    emoteWheel: emoteWheelOpen ? { items: EMOTES.map((e) => e.name), pick: emotePick } : null,
    lobby:
      hosting && (!duel || (duel.phase === "waiting" && duel instanceof Duel && duel.connected < duel.players - 1))
        ? { code: hosting.code, waitingFor: duel ? duel.players - 1 - (duel as Duel).connected : Number(duelPlayers.value) === 3 ? 2 : 1 }
        : null,
    vitals: duel ? { shield: duel.shield, shieldMax: duel.shieldMax, health: duel.health, healthMax: HEALTH_MAX, evo: duel instanceof BrMatch ? armor.evoFrac : null, helmet: armor.helmet } : rangeCombat.on ? { shield: rangeCombat.shield, shieldMax: rangeCombat.shieldMax, health: rangeCombat.health, healthMax: HEALTH_MAX } : null,
    drill: duel ? null : drill.hud(now),
    // a hold-E action, or standing on a loadout crate while it hands your loadout over
    brHold: duel instanceof BrMatch ? (brPlay.hud.hold ?? (duelHud?.br?.crate != null ? { label: "LOADOUT CRATE  ·  STAY ON IT", progress: duelHud.br.crate } : null)) : null,
    tour: tourHud,
    healKey: keyLabel("heal"),
    ordnance: {
      counts: ordnance.endless ? null : { ...ordnance.counts },
      readied: ordnance.readied ? throwName(ordnance.readied.kind) : null,
      ready: !!ordnance.readied && now >= ordnance.readied.readyAt,
      key: keyLabel("grenade"),
      fire: keyLabel("fire"),
      cancel: keyLabel("ads"),
    },
    markers: duel instanceof BrMatch ? brPlay.hud.markers : null,
    banner: duel instanceof BrMatch ? brPlay.hud.banner : null,
    downed: downedNow && duel instanceof Duel ? { left: Math.max(0, duel.bleedUntil - performance.now() / 1000), revivedBy: duel.revivedBy !== null ? duel.nameFor(duel.revivedBy) : null, kd: kd.max > 0 ? { hp: kd.hp, max: kd.max, up: kd.up, key: keyLabel("fire") } : null, self: kd.canSelfRevive ? { key: keyLabel("interact"), progress: kd.selfProgress(gameTime) } : null } : null,
    captions: captions.mode === "off" ? null : captions.live(gameTime).map((l) => ({ text: l.text, where: l.where, range: l.range })),
    pingWheel: pingWheelOpen ? { items: PING_INTENTS.map((x) => x.label), pick: pingPick } : null,
    spectating: watch ? { name: watchName || watchMate?.name || "SOMEONE", first: !!watchMate && watchMate.id < Duel.BOT_ID && spectateFirst, of: duel ? duel.spectateList().length : 1, at: watchIndex + 1 } : null,
    voice: hudVoice,
    trainer: trainer.hud(now),
    mantleCue: trainer.cue && mantleCueOn,
    killcam: killcam.active ? { name: killcam.killerName, weapon: killcam.killerWeapon ? weaponName(killcam.killerWeapon) : "", progress: killcam.progress, left: killcam.left, skipKey: keyLabel("jump") } : null,
    recap: recap && !killcam.active ? { ...recap, age: now - recapShownAt, closeKey: keyLabel("jump"), killerCard: bannerOf(remoteBanners.get(recap.killerId) ?? botBanner(recap.killerId)) } : null,
    myCard: bannerOf(myBanner()),
    ability:
      abilities.enabled && abilities.picked
        ? (() => {
            const c = abilities.charge(now);
            const k = kitOf(abilities.picked!);
            const ult = { name: k.ult, key: keyLabel("ultimate"), k: abilities.ult, live: abilities.picked === "jolt" ? Math.max(0, overdriveUntil - now) : regen ? Math.max(0, regen.until - now) : 0 };
            if (abilities.picked === "ward") return { name: k.tactical, key: keyLabel("ability"), cooldown: KITS.ward.tactical.cooldown, left: abilities.wallLeft(now), passive: false, icon: "wall" as const, ult };
    if (abilities.picked === "smoke") return { name: k.tactical, key: keyLabel("ability"), cooldown: KITS.smoke.tactical.cooldown, left: abilities.canisterLeft(now), passive: false, icon: "cloud" as const, ult };
    if (abilities.picked === "hook") return { name: k.tactical, key: keyLabel("ability"), cooldown: KITS.hook.tactical.cooldown, left: abilities.grappleLeft(now), passive: false, icon: "hook" as const, ult };
    if (abilities.picked === "scout") return { name: k.tactical, key: keyLabel("ability"), cooldown: KITS.scout.tactical.cooldown, left: abilities.pulseLeft(now), passive: false, icon: "eye" as const, ult };
    if (abilities.picked === "triage") return { name: k.tactical, key: keyLabel("ability"), cooldown: KITS.medic.tactical.cooldown, left: abilities.patchLeft(now), passive: false, icon: "cross" as const, ult };
            return { name: ABILITIES[abilities.picked!].name, key: keyLabel("ability"), cooldown: c.recharge, left: c.charges > 0 ? 0 : c.nextIn, passive: false, charges: c.charges, max: c.max, nextIn: c.nextIn, icon: "dash" as const, ult };
          })()
        : null,
    // the card: full when it has just come up in a match, one line after 6 s or in the range
    abilityCard:
      abilities.enabled && (abilities.choosing || (!duel && !abilities.picked))
        ? {
            options: (["jolt", "triage", "scout", "hook", "smoke", "ward"] as const).map((id, i) => { const k = kitOf(id); return { key: keyLabel((["pickAbility1", "pickAbility2", "pickAbility3", "pickAbility4", "pickAbility5", "pickAbility6"] as const)[i]), name: k.kit, blurb: k.blurb, tactical: k.tactical, ult: k.ult, passive: k.passive, picked: abilities.picked === id }; }),
            age: now - abilities.offeredAt,
            compact: !duel || !abilities.choosing || now - abilities.offeredAt > 6,
          }
        : null,
    callout: calloutNow,
    plates: duel ? (lastPlates = platesNow(duel, now)) : (lastPlates = []),
    stance: player.stance,
    speedMs: player.speed,
    speedHu: player.speed / HU,
    prompt,
    scope: optic && optic.info.overlay && !third
      ? { style: optic.info.reticle, color: optic.info.color, amount: Math.max(0, Math.min(1, (aimNow - 0.75) / 0.2)) }
      : null,
  });
  input.endFrame();
  // the loading screen goes once the world is in and this frame is drawn
  loadingScreen.frame();
  // and the card opens the game the moment it does. It waits for that rather
  // than starting with the page, because the first seconds of a page are the
  // models and textures coming in and being decoded, which is one long stutter
  // on the main thread: a card played through that plays on a clock nobody can
  // see. From here the frames are steady (src/ui/intro.ts).
  if (!NO_INTRO && !introShown) {
    introShown = true;
    loadingScreen.hide();
    void intro.play("boot");
  }
  // CPU time for everything this frame did: simulation, render submission and
  // HUD. The GPU works on it after this, in parallel with the next frame.
  frameMs += (performance.now() - frameStart - frameMs) * 0.1;
}
/**
 * Next frame. A hidden tab gets no animation frames at all, which in a 1v1
 * would freeze you for the other player (and stop the host's round clock), so
 * in the background the loop carries on on a timer instead.
 *
 * Not the page's own timer: Chrome slows a background tab's timers to about
 * one a second, and a host who alt-tabbed (to paste the invite, to answer a
 * message) ran the whole match, its bots, its ring and every state packet,
 * at one frame a second for everyone. A worker's timer is not slowed, so a
 * small worker ticks at 30 Hz while the tab is hidden, and nothing is drawn
 * that nobody can see.
 */
let rafId = 0;
let timerId = 0;
const HIDDEN_HZ = 30;
let hiddenTicker: Worker | null = null;
function tickWhileHidden(on: boolean): void {
  if (!on) {
    hiddenTicker?.terminate();
    hiddenTicker = null;
    return;
  }
  if (hiddenTicker) return;
  try {
    const src = `let t = 0; onmessage = (e) => { clearInterval(t); if (e.data > 0) t = setInterval(() => postMessage(0), e.data); };`;
    hiddenTicker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
    hiddenTicker.onmessage = () => {
      if (document.hidden) frame();
    };
    hiddenTicker.postMessage(1000 / HIDDEN_HZ);
  } catch {
    // no workers (a locked-down browser): the page's timer, slowed or not
    hiddenTicker = null;
    timerId = window.setTimeout(frame, 16);
  }
}
function schedule(): void {
  if (document.hidden) {
    // the worker drives frames while hidden; the timer only stands in without one
    if (!hiddenTicker) timerId = window.setTimeout(frame, 16);
  } else rafId = requestAnimationFrame(frame);
}
// A frame already asked for with the other method never arrives (a hidden
// tab's animation frame) or arrives late, so switch over the moment the tab is
// hidden or shown. Cancelling first means there is only ever one loop.
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(rafId);
  clearTimeout(timerId);
  tickWhileHidden(document.hidden);
  schedule();
});
tickWhileHidden(document.hidden);
schedule();
// ---------- first visit, invite links ----------
initWelcome();
{
  // Opened from an invite link (?join=CODE): straight into that match. The
  // code comes off the address at once, so a reload does not try to join a
  // match that is long over.
  const q = new URLSearchParams(location.search);
  const invite = normaliseCode(q.get("join") ?? "");
  if (q.has("join")) {
    q.delete("join");
    const rest = q.toString();
    history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
  }
  if (invite.length === 5) {
    menu.show("duel");
    duelCode.value = invite;
    duelJoinBtn.click();
  }
}

// debug handle
(window as unknown as { __range: unknown }).__range = {
  loadout,
  player,
  settings,
  // the hour of the day, so the suite can set one and read back what it did
  sky: {
    get id() {
      return hour.id;
    },
    ids: HOUR_IDS,
    /** the hour a battle royale on this seed is played at */
    matchFor: (seed: number) => matchHour(seed).id,
    set: (id: string) => {
      saveHour(id);
      applyHour(hourFor(id));
      skySel.value = hour.id;
      return hour.id;
    },
    read: () => ({
      id: hour.id,
      sun: getSun()?.color.getHex() ?? 0,
      intensity: getSun()?.intensity ?? 0,
      env: scene.environmentIntensity,
      fog: (scene.fog as THREE.Fog | null)?.color.getHex() ?? 0,
    }),
  },
  debugView,
  dummies,
  course: courseBasic,
  courseAdvanced,
  merged,
  duel: () => duel,
  hud,
  input,
  profile,
  startBots,
  startMode,
  applyModeGun,
  menu,
  loadouts,
  /** screenshots: the five operators in a row, in front of the arena's first spawn */
  gallery: () => {
    OPERATORS.forEach((op, i) => {
      const d = new Dummy(ARENA_SPAWNS.host.x - 4 + i * 2, ARENA_SPAWNS.host.z + 5, 0, { armed: "rspn101", respawn: false, skin: op });
      d.group.rotation.y = Math.PI;
      scene.add(d.group);
    });
  },
  galleryPositions: () => galleryFigs.map((d) => [d.group.position.x, d.group.position.y, d.group.position.z, d.group.visible]),
  setThirdPerson,
  selfFigureVisible: () => selfFig?.group.visible ?? false,
  viewModelVisible: () => viewModel.group.visible,
  /** the gun's own camera's vertical FOV against the world's */
  gunFov: () => ({ gun: vmCamera.fov, world: camera.fov }),
  /** the finish a gun model wears now (tools/e2e.ts) */
  gunFinish: (id: string) => ({ finish: gunModel(id).root.userData.finish ?? "factory" }),
  /** voice chat as this page has it: sending, the loudest each player it hears is now, and the group (tools/e2e.ts) */
  voiceState: () => ({ live: voice?.live ?? false, levels: voice ? Object.fromEntries(voice.levels()) : {}, group: voiceGroupKey, denied: voice?.denied ?? false, muted: [...voiceNames.keys()].filter((p) => voice?.isMuted(p)) }),
  /** a melee swing, as the key starts one (tools/e2e.ts: kicking a door in) */
  swing: (): boolean => {
    if (gameTime < meleeReadyAt || loadout.swapping) return false;
    meleeReadyAt = gameTime + MELEE_COOLDOWN;
    viewModel.melee();
    meleeHitAt = gameTime + MELEE_TIME * 0.35;
    return true;
  },
  lobbyCode: () => (hosting && !duel ? hosting.code : null),
  setMapOpen: (on: boolean) => (mapOpen = on),
  /** emotes (tools/e2e.ts): play one, and what is playing */
  emote: (i: number) => playEmote(i, gameTime),
  emoting: () => emoting,
  cameraPos: () => camera.position.toArray(),
  /** the loading screen has gone: everything asked for is in and a frame is drawn (the tools wait on it) */
  loaded: () => loadingScreen.loaded,
  /** the intro card (tools/e2e.ts, tools/snap.ts): what it is doing, skip it, or hold it at one moment for a picture */
  intro: {
    state: () => intro.state(),
    skip: () => intro.skip(),
    play: (kind: "boot" | "match") => intro.play(kind),
    freeze: (seconds: number) => intro.freeze(seconds),
  },
  /** the dropship: this match's flight, and who you are linked to or following */
  ship: () => (duel instanceof BrMatch ? duel.ship : null),
  shipState: () => ({ aboard: player.aboard, linkedTo, following, leash: player.leash ? player.leash.toArray() : null }),
  /** abilities (tools/e2e.ts): the state, a pick, a use */
  abilities,
  pickAbility: (id: AbilityId) => pickAbility(id, gameTime),
  useAbility: () => useAbility(gameTime),
  useUltimate: () => useUltimate(gameTime),
  fxCount: () => fx.count,
  /** the ziplines in the world now, HOOK's put up among them (the checks count them) */
  ziplineCount: () => ZIPLINES.length,
  /** the clouds standing now (the checks count them) */
  smokeCount: () => SMOKES.length,
  /** the walls WARD put up, standing now (the checks count them) */
  wallCount: () => WALLS.length,
  /** the checks: everything the kits have put up (walls, clouds, ziplines) taken away between them */
  clearKitStuff: () => {
    clearWalls();
    clearSmoke();
    clearZiplines();
  },
  /** where each cloud stands (the checks look) */
  smokeSpots: () => SMOKES.map((c) => ({ x: c.at.x, y: c.at.y, z: c.at.z, r: c.r })),
  gameTime: () => gameTime,
  /** the killcam and the recap (tools/e2e.ts) */
  killcamState: () => ({ active: killcam.active, killer: killcam.killerName, weapon: killcam.killerWeapon, progress: killcam.progress, frames: recorder.frames.length, span: recorder.span, shots: recorder.shots.length }),
  recap: () => recap,
  skipKillcam: () => killcam.stop(),
  /** one of your hits on a match figure, through the same log and match calls a bullet makes (tools/e2e.ts) */
  landHit: (remoteId: number, amount: number, head: boolean, weapon: string, dist: number) => {
    const d = duel;
    if (!d) return false;
    const target = d.avatars.map((a) => d.remoteOf(a)).find((r) => r?.id === remoteId);
    if (!target) return false;
    if (d.phase === "fight" && target.alive) dlog.hit({ t: realNow(), from: d.id, to: target.id, amount, head, weapon, dist });
    const av = target.avatar;
    av.hit(gameTime, head ? "head" : "body", amount, 1, 1, av.group.position.clone());
    d.localHit(target, amount, head, weapon, dist);
    return true;
  },
  /** a hit on a match figure through the bullets' own impact path (EVO, hop-ups, knocks), from the gun in hand (tools/e2e.ts) */
  hitThrough: (remoteId: number, amount: number) => {
    const d = duel;
    const a = d?.avatars.find((x) => d.remoteOf(x)?.id === remoteId);
    if (!d || !a || !impactSink) return false;
    const point = a.group.position.clone().setY(a.group.position.y + 1.2);
    const report = a.hit(gameTime, "body", amount, 1, 1, point);
    impactSink({ dummy: a, report, target: null, targetHead: false, damage: report?.amount ?? 0, point, distance: 6, weapon: loadout.active.id });
    return true;
  },
  /** the knockdown shield and the regens (tools/e2e.ts) */
  kdState: () => ({ ...kd, exec: execRegen ? { ...execRegen } : null, box: boxRegen ? { ...boxRegen } : null }),
  closeRecap: () => (recap = null),
  remoteFxLog,
  audio,
  brPlay,
  applyLoot,
  ordnance,
  throwables,
  /** a throw now, of `kind`, from `from` with `vel` (tools/e2e.ts); yours */
  throwAt: (kind: ThrowKind, from: THREE.Vector3, vel: THREE.Vector3) => {
    throwsMade++;
    throwables.throw(kind, from, vel, duel ? duel.id : -1, true, gameTime);
    duel?.localFx("throw", from, vel, throwCode(kind));
  },
  THREE,
  tour,
  opticAdsMult,
  padButtons,
  /** the range's readout counters (shots, hits) */
  stats: () => stats,
  /** Esc on the menu: how many were taken as Resume (tools/e2e.ts) */
  menuEscapes: () => menuEscapes,
  /** the plates drawn this frame, and the line-of-sight test they use (tools/e2e.ts) */
  platesNow: () => lastPlates,
  clearTo,
  /** the level's ziplines and collision boxes (tools/e2e.ts) */
  ziplines: ZIPLINES,
  solids: RANGE_SOLIDS,
  /** the practice aim bot and the dash's settings (tools/e2e.ts) */
  aimbot,
  jolt: () => ({ ...JOLT }),
  setJolt,
  /** the viewmodel's inspect and first draw (tools/e2e.ts) */
  /** how the camera is moving with the body (tools/e2e.ts): the slide's lean, the boost's pull, and the angles the shot uses */
  feelState: () => ({ lean: slideLean, air: airLean, boost: boostFeel, yaw: player.yaw, pitch: player.pitch, landSide: player.landSide, lurchSide: player.lurchSide }),
  /** a JOLT's view: the roll in degrees and the FOV fraction now (tools/e2e.ts) */
  joltFeel: () => ({ roll: joltRoll(gameTime), fov: joltFov }),
  vmState: () => ({ inspecting: gameTime - inspectAt < INSPECT_TIME, flourish: gameTime - flourishAt < FLOURISH_TIME, ...viewModel.shown }),
  /** how far into the sights the killcam is holding the killer's gun (tools/e2e.ts) */
  killcamAds: () => killcam.killerAds,
  /** your own third-person figure (tools/e2e.ts) */
  selfFigure: () => selfFig,
  /**
   * The figure lab (tools/snap.ts): figures in a row `dist` metres in front of
   * you, facing you, one per pose ("dead" knocks it out); none clears it.
   */
  figureLab: (poses: Array<FigurePose & { dead?: boolean; weapon?: string }> = [], dist = 4, turnDeg = 0) => {
    for (const lf of labFigs) lf.f.dispose();
    labFigs.length = 0;
    const yawR = player.yaw * DEG;
    const fx = -Math.sin(yawR);
    const fz = -Math.cos(yawR);
    poses.forEach((p, i) => {
      const side = (i - (poses.length - 1) / 2) * 1.3;
      const f = new Dummy(0, 0, 0, { armed: p.weapon ?? "rspn101", respawn: false, rig: true, noBase: true, skin: OPERATORS[i % OPERATORS.length] });
      f.group.position.set(player.pos.x + fx * dist + fz * side, player.pos.y, player.pos.z + fz * dist - fx * side);
      f.group.rotation.y = yawR + turnDeg * DEG;
      scene.add(f.group);
      labFigs.push({ f, pose: p, dead: !!p.dead, at: gameTime });
    });
    return labFigs.map((l) => l.f);
  },
  loadMannequin,
  setFigureStyle,
  /** open ground near x, z: nothing standing on the floor within `clear` metres (tools/e2e.ts) */
  openGround: (x: number, z: number, clear = 5): { x: number; z: number } | null => {
    for (let r = 0; r < 120; r += 3) {
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r;
        const pz = z + Math.sin((a / 16) * Math.PI * 2) * r;
        // only what stands on the floor: a roof or a girder overhead is no obstacle
        if (!RANGE_SOLIDS.some((s) => s.base < 2 && px > s.minX - clear && px < s.maxX + clear && pz > s.minZ - clear && pz < s.maxZ + clear)) return { x: px, z: pz };
        if (r === 0) break;
      }
    }
    return null;
  },
  /** the range's tooling (tools/e2e.ts) */
  dummyBehaviour,
  rangeCombat,
  sprayWall,
  drill,
  trainer,
  /** the README screen at the far end (tools/e2e.ts, tools/snap.ts) */
  readmeTv,
  gunSession: () => [...gunSession.entries()],
  startHeal: () => startHeal(gameTime),
  kit,
  /** the crosshair as set up on the Settings tab (tools/e2e.ts) */
  reticle,
  /** XP, the level and the challenges (tools/e2e.ts) */
  progress,
  /** say quick chat line i, as the 1 to 6 keys do (tools/e2e.ts) */
  quickChat: (i: number) => sendQuick(i),
  /** the knockdown shield (tools/e2e.ts) */
  kd,
  armor,
  brMap,
  renderer,
  sun: getSun,
  quality,
  /** the part of the world the fog and the shadows are set for (tools/bench.ts: a spot on the map wants the map's fog, not the range's) */
  setRegion,
  /** the sky dome: where it hangs and whether it is drawn (tools/e2e.ts; on the range's side of the world it was hidden on the map) */
  skyDome: () => {
    const d = scene.getObjectByName("sky");
    return { there: !!d, visible: !!d?.visible, under: d?.parent?.name ?? "", shown: sideShown };
  },
  /** how far this preset draws where you stand now: the fog's two ends and the camera's far plane (tools/e2e.ts) */
  viewRange: () => ({ near: (scene.fog as THREE.Fog | null)?.near ?? 0, far: (scene.fog as THREE.Fog | null)?.far ?? 0, camFar: camera.far, draws: quality.drawDistance }),
  /** back to the menu, whichever way in was used (tools/e2e.ts) */
  toMenu: () => {
    input.padPlaying = false;
    if (input.locked) input.unlock();
    else input.onLockChange?.(false);
  },
  /** screenshots: hold the orbit at these angles (the input block is off without a pointer lock) */
  setOrbit: (yaw: number, pitch: number, hold = true) => {
    orbitYaw = yaw;
    orbitPitch = pitch;
    orbiting = hold;
    debugOrbitHold = hold;
  },
  camera,
  /** screenshots: rigged figures in every stance, armed and unarmed, animated by the frame loop */
  rigGallery: (speed = 5) => {
    const stances = ["stand", "crouch", "slide", "air", "climb", "mantle", "zip"] as const;
    stances.forEach((st, i) => {
      for (const [row, armed] of [
        [0, "rspn101"],
        [1, undefined],
      ] as const) {
        const d = new Dummy(ARENA_SPAWNS.host.x - 6 + i * 2, ARENA_SPAWNS.host.z + 5 + row * 2.5, 0, { armed, respawn: false, skin: OPERATORS[i % OPERATORS.length], rig: true, noBase: true });
        d.group.rotation.y = Math.PI;
        d.setPose({ speed: st === "stand" || st === "crouch" ? speed : 0, stance: st, pitch: 12 });
        scene.add(d.group);
        galleryFigs.push(d);
      }
    });
  },
  drawCalls: () => frameCost.calls,
  /** how many of a named prop are in the world, and where (tools/e2e.ts, tools/snap.ts) */
  propsNamed: (name: string) => {
    const out: Array<{ x: number; y: number; z: number }> = [];
    scene.traverse((o) => {
      if (!o.userData?.prop || (name && o.userData.prop !== name)) return;
      const p = o.getWorldPosition(new THREE.Vector3());
      out.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) });
    });
    return out;
  },
  /** frames run since the page opened */
  frames: () => framesRun,
  /** the live rounds' tracers (projectile.ts) */
  tracers: () => projectiles.tracers,
  /** banner cards: yours as a number, and the ones others sent */
  banner: () => myBanner(),
  banners: () => Object.fromEntries(remoteBanners),
  /** sprays: put yours up, and whose are up */
  spray: () => doSpray(gameTime),
  sprays: () => ({ count: sprays.count, owners: sprays.owners() }),
  /** bullet impacts marked on the level since the page opened */
  impacts: () => impacts.count,
  /** blasts marked on the level (scorch and smoke) since the page opened */
  blasts: () => impacts.blasts,
  /** a round from the gun in hand along a direction, through the bullets' own path (tools/snap.ts) */
  fireRound: (dir: [number, number, number]) => {
    const w = loadout.active.weapon;
    projectiles.fire(player.eyePosition(), new THREE.Vector3(...dir).normalize(), w, false, 1, 1, onScreenAsWorld(viewModel.muzzleWorld()));
  },
  /** the last frame's draw calls and triangles over every pass (tools/bench.ts) */
  frameCost: () => ({ ...frameCost }),
  /** a solo battle royale on a given seed and place, so the benchmark measures the same match every run */
  startBr: (o?: { seed?: number; poi?: string }) => startBr(o?.seed, o?.poi),
  techLog,
  /** drive the player from a script instead of the keyboard (null to stop) */
  setScript: (s: MoveInput | null, hook: ((now: number, dt: number) => void) | null = null) => {
    scriptInput = s;
    frameHook = hook;
  },
  /** the welcome's device check, for a user agent (tools/e2e.ts) */
  deviceProblem,
  /** the basic course's run clock as its HUD shows it (tools/e2e.ts: the menu stops it) */
  courseClock: () => courseBasic.hud(gameTime)?.time ?? 0,
  /** optics fitted anywhere in the scene: one at most, on the gun in hand (tools/e2e.ts) */
  opticsInScene: () => {
    let n = 0;
    scene.traverse((o) => {
      if (o.name.startsWith("optic:")) n++;
    });
    return n;
  },
};

