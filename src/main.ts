import * as THREE from "three";
import playerCfg from "./config/player.json";
import { resolveWeapon, weaponIds, weaponName } from "./game/weapons";
import { adsSensScale, cmPer360, degPerCount, hipFov43, verticalFovFrom43, OPTIC_ZOOMS, opticZoom, type OpticZoom } from "./game/sens";
import { Input } from "./game/input";
import { padButtons, type PadSettings } from "./game/gamepad";
import { Player } from "./game/player";
import { Loadout, type SlotSetup } from "./game/loadout";
import type { AttachSlot } from "./game/attachments";
import { HU, MOVE } from "./game/movement";
import { installSky } from "./game/materials";
import { Renderer } from "./game/render";
import { Course } from "./game/course";
import { BASIC_COURSE } from "./game/courses/basic";
import { ADVANCED_COURSE } from "./game/courses/advanced";
import { loadQuality, saveQuality, measureRefresh, PRESETS, type Preset } from "./game/quality";
import { ProjectileSystem, solidHit } from "./game/projectile";
import { Dummy, ARMOR_NAME, ARMOR_COLOR, actCode, actFromCode, type ArmorTier, type FigurePose } from "./game/dummy";
import { buildRange, skyFollow, setShadowRegion, getSun, RANGE_BOUNDS, RANGE_SOLIDS, TARGET_RAILS, TARGET_SPECS, PROP_PLACEMENTS } from "./game/range";
import { buildBrMap, BR_BOUNDS, BR_CENTER } from "./game/br";
import { BrMatch, DROP_HEIGHT } from "./game/brmatch";
import { placeProps } from "./game/props";
import { Target } from "./game/targets";
import { ViewModel } from "./game/viewmodel";
import { GameAudio } from "./game/audio";
import { Hud } from "./game/hud";
import { DpiCalibrator, snapDpi } from "./game/dpi-calibrate";
import { ladderAhead } from "./game/traversal";
import { mergeStatic } from "./game/staticmerge";
import { opticInfo } from "./game/optics";
import { opticName } from "./config/names";
import type { ResolvedWeapon } from "./game/weapons";
import { Duel, SHIELD_MAX, HEALTH_MAX, moveDirOf, type MatchLike } from "./game/duel";
import { BotMatch } from "./game/bots";
import { Stats, type MatchKind, type BotDifficulty } from "./game/stats";
import { submitScore } from "./game/leaderboard";
import { hostMatch, joinMatch, normaliseCode, type BrWelcome, type HostHandle, type Link, type MatchOpts } from "./net/link";
import { deviceProblem, dismissWelcome, initWelcome } from "./ui/welcome";
import { AimAssist } from "./game/aimassist";
import { applySavedBinds, initBindsUi } from "./ui/binds";
import type { MoveInput } from "./game/player";
import { buildArena, buildTriArena, ARENA_BOUNDS, ARENA_SPAWNS, TRI_BOUNDS } from "./game/arena";
import { Loadouts, type LoadoutDef } from "./game/loadouts";
import { operatorById, OPERATORS } from "./game/operators";
import { setArmColors } from "./game/arms";
import { Menu, type Mode } from "./ui/menu";
import type { ImpactEvent } from "./game/projectile";
import { INSPECT_TIME, FLOURISH_TIME, MELEE_TIME } from "./game/viewmodel";
import { Abilities, ABILITIES, JOLT, type AbilityId } from "./game/abilities";
import { currentBinds, type Action } from "./game/input";
import { bindName } from "./ui/binds";
import { FxLayer } from "./game/fx";
import { Killcam, Recorder } from "./game/killcam";
import { DamageLog, HEAL_CODES, type Recap } from "./game/recap";
import { Soundscape } from "./game/soundscape";
import { DummyBehaviour, DUMMY_MODES, DUMMY_MODE_NAME, FlickDrill, RangeCombat, SprayWall, type DummyMode } from "./game/rangetools";
import { SuperglideTrainer } from "./game/trainer";
import { BrPlay } from "./game/brplay";
import { Tour, type TourCheck } from "./game/tour";
import { Ordnance, Throwables, THROWABLES, arcSlowFor, blastDamage, throwCode, throwFromCode, type FireStrip, type ThrowKind, type ThrowTarget, type Thrown } from "./game/throwables";
import { throwName } from "./config/names";
import { loadMannequin, setFigureStyle } from "./game/mannequin";
import { ArenaMode } from "./game/modematch";
import { MODES, MODE_TITLE, isModeKind, type ModeKind } from "./game/modes";
import squadCfg from "./config/squad.json";
import { lootLabel, type LootItem } from "./game/loot";
import type { AmmoType } from "./game/weapons";
import rangeToolsCfg from "./config/rangetools.json";
import type { HitTier } from "./game/audio";
import itemsCfg from "./config/items.json";
import { Armor, HEAL_ORDER, HEALS, Kit, type HealItem } from "./game/kit";

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
renderer.setPixelRatio(Math.min(quality.maxPixelRatio, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = quality.shadows !== "off";
renderer.shadowMap.type = quality.preset === "high" ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
// A static shadow map is drawn once and again only when asked. The range
// barely moves, so this removes a 2048-4096 depth render from every frame.
renderer.shadowMap.autoUpdate = quality.shadows === "live";
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
const camera = new THREE.PerspectiveCamera(90, window.innerWidth / window.innerHeight, 0.02, 400);
scene.add(camera);
const beforeRange = new Set(scene.children);
buildRange(scene, { pointLights: quality.pointLights, shadowSize: quality.shadowSize });
// the 1v1 arena, east of the range, and the 1v1v1 triangle north of it (src/game/arena.ts)
const arena = buildArena(scene);
const triArena = buildTriArena(scene);
// the battle royale map, 500 m south (src/game/br.ts)
const brMap = buildBrMap(scene);
/**
 * The sun's shadow map and the fog follow the part of the world you are in:
 * the range (tight, sharp shadows) or the open BR map (wide and far).
 */
function setRegion(region: "range" | "br"): void {
  const fog = scene.fog as THREE.Fog | null;
  audio.setSpace(region === "br" ? "outdoor" : "indoor");
  if (region === "br") {
    setShadowRegion(BR_CENTER, 230);
    if (fog) {
      fog.near = 140;
      fog.far = 680;
    }
  } else {
    setShadowRegion(new THREE.Vector3(-10, 0, 12), 135);
    if (fog) {
      fog.near = 55;
      fog.far = 290;
    }
  }
  renderer.shadowMap.needsUpdate = true;
}
// exactly what the range built, for the static merge below (not the dummies
// and targets added later, which move)
const rangeRoots = scene.children.filter((o) => !beforeRange.has(o) && o !== arena.root && o !== triArena.root);
// The sky doubles as the environment map. Without it every metal surface is
// black, so this is load-bearing rather than decoration.
void installSky(scene, renderer);
// A GPU reset (a driver update, a sleeping laptop, another tab crashing the
// GPU) loses the context. three brings the context back by itself, but a
// static shadow map comes back empty (the whole sunlit range in shadow) and
// the sky's environment map comes back black, so both are redrawn.
glCanvas.addEventListener("webglcontextlost", () => hud.notice("GRAPHICS RESET: RECOVERING", gameTime, 4));
glCanvas.addEventListener("webglcontextrestored", () => {
  renderer.shadowMap.needsUpdate = true;
  void installSky(scene, renderer);
});
// Post-processing. Ambient occlusion is what stops a scene made of boxes
// reading as flat shapes floating on a flat floor.
const pipeline = new Renderer(renderer, scene, camera, quality);

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
camera.add(viewModel.group);
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
} = {
  weapon: null,
  ads: null,
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
/** the ears' facing, each frame */
const earFwd = new THREE.Vector3();
const earUp = new THREE.Vector3();
/** the third-person aim: where the crosshair is, from the eye (in first person, the view itself) */
let aimYaw = 0;
let aimPitch = 0;
const audio = new GameAudio();
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
    for (const s of loadout.slots) if (!s.empty) items.push({ kind: "weapon", id: s.id, n: 1, rarity: "rare", mag: s.magLevel, attach: { ...s.attach } });
    for (const [type, n] of Object.entries(loadout.ammo.stock)) if (n > 0 && type !== "energy") items.push({ kind: "ammo", id: type, n, rarity: "common" });
    for (const [item, n] of Object.entries(kit.items)) if (n > 0) items.push({ kind: "heal", id: item, n, rarity: "common" });
    if (armor.helmet) items.push({ kind: "helmet", id: armor.helmet, n: 1, rarity: "legendary" });
    for (const [g, n] of Object.entries(ordnance.counts)) if (n > 0) items.push({ kind: "grenade", id: g, n, rarity: "rare" });
    if (d.players > 1) items.push({ kind: "banner", id: "banner", n: 1, rarity: "common", owner: d.id, ownerName: profile.profile.name });
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
  if (bd === "easy" || bd === "normal" || bd === "hard") botDifficulty.value = bd;
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
function duelButtons(): void {
  const busy = duel !== null || hosting !== null;
  duelHostBtn.hidden = busy;
  duelJoinBtn.hidden = busy;
  duelCode.hidden = busy;
  duelPlayers.hidden = busy;
  duelLeaveBtn.hidden = !busy;
}
function respawnForMatch(d: MatchLike): void {
  const sp = d.spawn;
  newLife(d);
  if (d instanceof BrMatch) {
    // a battle royale starts in the sky over your drop spot once everyone is
    // in; until then the lobby is wherever you are (the arena, for a host)
    if (d.phase !== "waiting") {
      player.setBounds(BR_BOUNDS);
      setRegion("br");
      player.beginDrop(sp.x, DROP_HEIGHT, sp.z, sp.yaw);
      mapOpen = false;
      hud.notice(`DROPPING INTO ${d.poi.name}`, gameTime, 3);
    }
  } else player.teleport(sp.x, 0, sp.z, sp.yaw);
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
  heal = { item, startedAt: now, duration: HEAL_ITEMS[item].time / abilities.healScale };
  // walking pace, no sprint, while it runs
  player.healSlow = itemsCfg.healSlow;
}
/** the heal wheel: hold the heal key, move the mouse toward an item, let go */
let healHeldAt = -1;
let wheelOpen = false;
const wheelVec = { x: 0, y: 0 };
let wheelPick: HealItem | null = null;
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
  const a = ABILITIES[id];
  hud.notice(`${a.name}: ${a.blurb.toUpperCase()}${id === "jolt" ? `  (${keyLabel("ability")})` : ""}`, now, 2.2);
  audio.reload();
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
  if (abilities.picked === "triage") {
    hud.notice("TRIAGE IS ALWAYS ON: YOUR HEALS ARE TWICE AS FAST", now, 1.4);
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
    if (!t.mine || (t.kind !== "frag" && t.kind !== "arcstar")) return;
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
    if (kind === "blast") audio.blast(what === "arcstar" ? "arcstar" : "frag", at);
    else audio.throwNoise(kind, at);
  },
});
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
  const kind = ordnance.spend();
  if (!kind) return;
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  const from = player.eyePosition().addScaledVector(fwd, 0.45).addScaledVector(right, 0.18).add(new THREE.Vector3(0, -0.12, 0));
  const vel = throwVelocity(kind, fwd);
  throwables.throw(kind, from, vel, duel ? duel.id : -1, true, gameTime);
  duel?.localFx("throw", from, vel, throwCode(kind));
  gunRow(kind).shots++;
  throwsMade++;
  audio.whoosh();
  void now;
}
function throwVelocity(kind: ThrowKind, fwd: THREE.Vector3): THREE.Vector3 {
  return fwd
    .clone()
    .multiplyScalar(THROWABLES[kind].speed)
    .add(new THREE.Vector3(0, 2.2, 0))
    .addScaledVector(player.vel, 0.6);
}

/** the battle royale from your side: E, the pads, pings (brplay.ts) */
const brPlay = new BrPlay({
  keyLabel: (a) => keyLabel(a),
  notice: (t) => hud.notice(t, gameTime, 2),
  sound: (k) => (k === "ping" ? audio.hitTier("white") : k === "revive" ? audio.healDone() : audio.whoosh()),
});
/** first person when you watch a squad mate (X switches to behind them) */
let spectateFirst = true;

/**
 * An item you took: a gun into an empty slot or in place of the one in hand
 * (which goes down where you stand), ammo and heals into the pack (what does
 * not fit goes back down), an attachment onto whichever gun takes it, a
 * helmet on, a banner carried.
 */
function applyLoot(it: LootItem): void {
  const d = duel instanceof BrMatch ? duel : null;
  const here = player.pos.clone();
  const putBack = (x: LootItem) => d?.dropLoot(x, here);
  const label = lootLabel(it);
  switch (it.kind) {
    case "weapon": {
      const empty = loadout.emptySlot;
      if (empty >= 0) {
        loadout.give(empty, it.id, it.mag ?? 0, (it.attach ?? {}) as Parameters<typeof loadout.give>[3]);
        if (loadout.activeIndex !== empty) loadout.requestSwap(empty, gameTime);
      } else {
        const s = loadout.active;
        putBack({ kind: "weapon", id: s.id, n: 1, rarity: "common", mag: s.magLevel, attach: { ...s.attach } });
        loadout.give(loadout.activeIndex, it.id, it.mag ?? 0, (it.attach ?? {}) as Parameters<typeof loadout.give>[3]);
      }
      audio.swap();
      break;
    }
    case "ammo":
      loadout.ammo.add(it.id as AmmoType, it.n);
      audio.reloadStep("in");
      break;
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
    case "helmet":
      armor.helmet = it.id === "red" ? "red" : "gold";
      if (d) d.shieldMax = armor.shieldMax;
      audio.shieldBreak();
      break;
    case "banner":
      brPlay.carry(it, gameTime);
      return;
    case "grenade": {
      if (!(it.id === "frag" || it.id === "arcstar" || it.id === "thermite")) return;
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
/** the callbacks every kind of match gets */
function wireMatch(d: MatchLike, kind: MatchKind): void {
  d.onRespawn = () => respawnForMatch(d);
  d.onHurt = () => {
    hud.hurt(gameTime);
    audio.hurt(d.shield > 0);
    input.pad.rumble(0.6, 0.3, 120);
  };
  // gunfire is heard from where it was fired (onShotFired, below), once a trigger pull
  d.onRemoteShot = null;
  d.onNotice = (t) => hud.notice(t, gameTime, 1);
  d.onEnd = (reason) => endMatch(reason);
  d.onFeed = (text, mine, neutral) => hud.feed(text, gameTime, neutral ? "#c8d0d8" : mine ? "#7ddc8a" : "#ff8a7a");
  // someone else's JOLT: the streak where it went, and its sound by distance
  d.onRemoteFx = (k, from, a, b, n) => {
    remoteFxLog.push({ k, from });
    if (remoteFxLog.length > 20) remoteFxLog.shift();
    // someone's throw: its flight, bounce and blast here too (their side sends the damage)
    const tk = throwFromCode(n);
    if (k === "throw" && a && b && tk) throwables.throw(tk, a, b, from, false, gameTime);
    if (k === "jolt" && a && b) {
      fx.jolt(a, b, gameTime);
      audio.joltAt(a);
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
  newLife(d);
  d.onDamaged = (from, amount, head, weapon, dist) => {
    dlog.hit({ t: realNow(), from, to: d.id, amount, head, weapon, dist });
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
  if (d instanceof BrMatch) {
    d.onLootTaken = (it) => applyLoot(it);
    d.onMark = (k, from, at, label, target) => brPlay.addMarker(k, at, label, from, target, gameTime);
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
  d.onMatchEnd = (s) => {
    profile.recordMatch(kind, s);
    d.streak = profile.match(kind).streak;
    menu.renderStats();
    if (s.won)
      void submitScore(`${kind}:wins`, profile.profile.name, profile.match(kind).won).then((rank) => {
        if (rank !== null) hud.notice(`#${rank} FOR WINS ON THE ONLINE BOARD`, gameTime, 3);
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
    const diff: BotDifficulty = modeOpts.difficulty === "easy" || modeOpts.difficulty === "hard" ? modeOpts.difficulty : "normal";
    d = new ArenaMode(scene, projectiles, { players, myId, link, guestId, abilities: withAbilities, kind: modeOpts.kind, bots: modeOpts.bots, difficulty: diff, list: modeOpts.list === "full" ? "full" : "short" });
    duel = d;
    player.setBounds(ARENA_BOUNDS);
    wireMatch(d, modeOpts.kind);
  } else if (squad) {
    const diff: BotDifficulty = squad.difficulty === "easy" || squad.difficulty === "hard" ? squad.difficulty : "normal";
    d = new BrMatch(scene, projectiles, brMap, diff, squad.bots, { players, myId, link, guestId, poi: squad.poi, abilities: withAbilities, seed: squad.seed, start: squad.start === "loadout" ? "loadout" : "loot" });
    duel = d;
    wireMatch(d, "br");
  } else {
    d = new Duel(scene, projectiles, { players, myId, link, guestId, abilities: withAbilities });
    duel = d;
    player.setBounds(players >= 3 ? TRI_BOUNDS : ARENA_BOUNDS);
    wireMatch(d, players >= 3 ? "triple" : "duel");
  }
  const goal = d instanceof ArenaMode ? `${MODE_TITLE[d.modeKind]}: ${modeGoal(d)}` : squad ? `The squad drops onto ${(d as BrMatch).poi.name} against ${squad.bots} bots.` : "First to 3 rounds.";
  d.onSlotFree = (id) => hosting?.release(id);
  d.onRoster = (connected, total) => {
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
  const diff = (botDifficulty.value === "easy" || botDifficulty.value === "hard" ? botDifficulty.value : "normal") as BotDifficulty;
  const d = new BotMatch(scene, projectiles, diff, Number(botCount.value) === 2 ? 2 : 1, abilitySetting("bots"));
  duel = d;
  player.setBounds(ARENA_BOUNDS);
  wireMatch(d, `bots:${diff}`);
  respawnForMatch(d);
  setDuelStatus(`Against ${Number(botCount.value) === 2 ? "two bots" : "a bot"}, ${diff}. First to 3 rounds.`, "good");
  duelButtons();
}
/** what a mode is played to, for the status line */
function modeGoal(d: ArenaMode): string {
  if (d.modeKind === "gunrun") return `${d.ladder.guns.length} guns then the knife, ${Math.round(MODES.gunRun.timeLimit / 60)} minutes.`;
  if (d.modeKind === "tdm") return `teams of ${MODES.tdm.teamSize}, first to ${MODES.tdm.scoreLimit}.`;
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
  const bots = kind === "tdm" ? MODES.tdm.teamSize * 2 - 1 : Math.max(1, modeBotCount());
  const d = new ArenaMode(scene, projectiles, { players: 1, myId: 0, link: null, abilities: abilitySetting("bots"), kind, bots, difficulty: diff, list: modeList() });
  duel = d;
  player.setBounds(ARENA_BOUNDS);
  wireMatch(d, kind);
  respawnForMatch(d);
  setDuelStatus(`${MODE_TITLE[kind]} against ${kind === "tdm" ? "a team of bots, with bots on your side" : `${bots} bot${bots === 1 ? "" : "s"}`}, ${diff}: ${modeGoal(d)}`, "good");
  duelButtons();
}
/** the battle royale against bots, on Outskirts */
function startBr(): void {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  cancelJoin = null;
  for (const c of courses) c.leave();
  const diff = brDifficulty();
  const bots = brBotCount();
  const d = new BrMatch(scene, projectiles, brMap, diff, bots, { players: 1, myId: 0, link: null, abilities: abilitySetting("br"), seed: newSeed(), start: brStart() });
  duel = d;
  wireMatch(d, "br");
  // the drop starts on the first frame in the game (respawnForMatch, from the countdown)
  setDuelStatus(`Battle royale on Outskirts: you and ${bots} bots, ${diff}. Dropping onto ${d.poi.name}.`, "good");
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
const newSeed = (): number => Math.floor(Math.random() * 2 ** 31);
const brDifficulty = (): BotDifficulty => (botDifficulty.value === "easy" || botDifficulty.value === "hard" ? botDifficulty.value : "normal");
const brBotCount = (): number => Math.max(1, Math.min(11, Number(brBots.value) || 11));
function endMatch(reason: string): void {
  const wasBr = duel instanceof BrMatch;
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
    // your loadout back (a loot game left you with what you found, or nothing)
    for (let i = 0; i < loadout.slots.length; i++) if (loadout.slots[i].empty) loadout.give(i, [loadouts.current.slot1, loadouts.current.slot2][i]);
    applyLoadout(loadouts.current);
    brPlay.reset();
  }
  hosting?.cancel();
  hosting = null;
  hud.notice(reason.toUpperCase(), gameTime, 3);
  setDuelStatusText(reason);
  duelButtons();
  goTo("range");
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
  const players = Number(duelPlayers.value) === 3 ? 3 : 2;
  // a battle royale squad: the place, the bots and the difficulty are fixed
  // now so every guest is told the same
  hostBr = duelMode.value === "br" ? { poi: brMap.pois[Math.floor(Math.random() * brMap.pois.length)].id, bots: brBotCount(), difficulty: brDifficulty(), seed: newSeed(), start: brStart() } : null;
  const mk = duelModeKind();
  hostOpts = { abilities: abilitySetting(duelKind()), mode: mk ? { kind: mk, bots: modeBotCount(), difficulty: brDifficulty(), list: modeList() } : undefined };
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
    },
    (link, id) => startDuel(link, players, 0, id),
    (err) => {
      setDuelStatusText(err, "bad");
      hosting = null;
      duelButtons();
    },
    hostBr ?? undefined,
    hostOpts
  );
  duelButtons();
  // the lobby is the arena itself: in at once, run around, the code on the
  // HUD; the match starts when the others arrive and everyone is in
  goTo("arena");
  if (!calibrating) {
    readSettings();
    void input.lock();
  }
});
duelJoinBtn.addEventListener("click", () => {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  setDuelStatus("Joining...", "live");
  cancelJoin = joinMatch(duelCode.value, (link, w) => startDuel(link, w.players, w.id, 1, w.br, w.opts), (err) => setDuelStatusText(err, "bad"));
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
// The range and the course are several hundred static meshes. Merged by
// material they are a few dozen draw calls, which is CPU time back on every
// frame (see staticmerge.ts). ?nomerge in the URL turns it off, so the
// benchmark can measure both.
const merged = new URLSearchParams(location.search).has("nomerge")
  ? null
  : mergeStatic(scene, [...rangeRoots, ...courses.map((c) => c.root), arena.root, triArena.root, brMap.root]);

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
  // In a match the arena and your spawn are the match's; every jump elsewhere
  // (the arena button included, which would put a guest on the host's spawn)
  // waits until you leave it.
  if (duel) {
    hud.notice("LEAVE THE MATCH FIRST (1V1 TAB)", gameTime, 2);
    return;
  }
  if (mode === "bots") {
    startBots();
    return;
  }
  if (mode === "br") {
    startBr();
    return;
  }
  if (mode === "gunrun" || mode === "tdm" || mode === "crown") {
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
});
menu.setRunBest(courseBasic.best, courseAdvanced.best);
applyLoadout(loadouts.current);
let armorTier: ArmorTier = 0;

const stats = { shots: 0, hits: 0, headshots: 0, damage: 0, knocks: 0, lastTtk: null as number | null };
/** figures the debug gallery put in the scene (tools/shot.ts), animated by the loop */
const galleryFigs: Dummy[] = [];

// ---------- overlay / lock ----------
$("play").addEventListener("click", () => {
  if (calibrating) return; // a measurement is in progress; do not steal the lock
  readSettings();
  void input.lock();
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
  playHint.textContent = "The browser did not let the game take the mouse. Click again in a second (after Esc, Chrome makes you wait a moment).";
};
input.onLockChange = (locked) => {
  overlay.classList.toggle("hidden", locked);
  if (locked) {
    // the first time in, the button stops saying Play: there is now a game to
    // resume, and the welcome has done its job
    playBtn.textContent = "Resume";
    dismissWelcome();
    playHint.classList.remove("warn");
    playHint.textContent = PLAY_HINT;
  }
  if (!locked) {
    menu.setRunBest(courseBasic.best, courseAdvanced.best);
    profile.flush();
    menu.renderStats();
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
    if (selfFig) selfFig.group.visible = false;
    return;
  }
  const key = `${weaponId}|${op}`;
  if (!selfFig || selfFigKey !== key) {
    selfFig?.dispose();
    selfFig = new Dummy(0, 0, 0, { armed: weaponId, respawn: false, skin: operatorById(op), rig: true, noBase: true });
    selfFig.group.name = "self";
    scene.add(selfFig.group);
    selfFigKey = key;
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
function frame(): void {
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

function step(): void {
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
  // The controller: read once here so every key check below sees it. Start
  // toggles the menu; with a pad in use no pointer lock is needed to play.
  const padAdsScale = 1 + (adsSensScale(hipFov43(settings.fovScale), zoomFov43(loadout.active.weapon) * settings.fovScale, opticAdsMult()) - 1) * loadout.active.state.adsFrac;
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
    // fists: the fire button punches (not with a grenade in hand: that press throws it)
    if (emptyHand && !downedNow && !knockedOut && !ordnance.readied && input.pressedNow("fire") && now >= meleeReadyAt && (!duel || duel.canFire)) {
      meleeReadyAt = now + MELEE_COOLDOWN;
      viewModel.melee();
      meleeHitAt = now + MELEE_TIME * 0.35;
    }
    // G: a grenade in hand (again: the next kind you have; after the last, the gun again)
    if (input.pressedNow("grenade") && !downedNow && !knockedOut && !heal && holster === "out" && !loadout.swapping && (!duel || duel.alive)) {
      const k = ordnance.cycle(now);
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
    // the middle mouse button: a ping for the squad
    if (input.pressedNow("ping") && duel instanceof BrMatch && duel.alive) {
      const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      brPlay.ping(duel, camera.position.clone(), f, now, duel.id);
    }

    // discrete keys
    // the pad's X is interact when there is a prompt for it (a zipline, an item, a revive)
    const padInteracts = (player.zipPrompt || (duel instanceof BrMatch && brPlay.hud.prompt !== null) || (!duel && drill.state === "idle" && drill.onPad(player.pos))) && input.pad.pressedNow("reload");
    if (armed && input.pressedNow("reload") && !loadout.swapping && !padInteracts) {
      ws.startReload(now);
      if (ws.reloading) audio.reload();
    }
    // weapon select: 1 and 2 pick a slot, Q swaps to the other
    const cardTakesPad = abilities.choosing;
    if (armed && input.pressedNow("slot1") && !(cardTakesPad && input.pad.pressedNow("slot1")) && loadout.requestSwap(0, now)) audio.swap();
    if (armed && input.pressedNow("slot2") && !(cardTakesPad && input.pad.pressedNow("slot2")) && loadout.requestSwap(1, now)) audio.swap();
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
    if (input.pressedNow("map")) mapOpen = !mapOpen;
    // 5 and 6 pick an ability while its card is up (any time in the range);
    // on a controller the d-pad's left and right pick while the card is up
    if (abilities.enabled && (abilities.choosing || !duel)) {
      const padPick = abilities.choosing;
      if (input.pressedNow("pickAbility1") || (padPick && input.pad.pressedNow("slot1"))) pickAbility("jolt", now);
      else if (input.pressedNow("pickAbility2") || (padPick && input.pad.pressedNow("slot2"))) pickAbility("triage", now);
    }
    // F: the ability
    if (input.pressedNow("ability") && !knockedOut) useAbility(now);
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
      // the wheel: five items round the circle, the mouse's direction picks
      wheelVec.x = Math.max(-200, Math.min(200, wheelVec.x + m.dx));
      wheelVec.y = Math.max(-200, Math.min(200, wheelVec.y + m.dy));
      if (Math.hypot(wheelVec.x, wheelVec.y) > 40) {
        const a = (Math.atan2(wheelVec.x, -wheelVec.y) + Math.PI * 2) % (Math.PI * 2);
        wheelPick = HEAL_ORDER[Math.round(a / ((Math.PI * 2) / HEAL_ORDER.length)) % HEAL_ORDER.length];
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
    player.addAngles(padLook.pitchUp * slow * (playerCfg.invertPitch ? -1 : 1) + (assist?.pitchUp ?? 0), padLook.yawLeft * slow + (assist?.yawLeft ?? 0));
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
  player.holsterBoost = holster === "away" ? MOVE.holsterBoost : 1;

  // A weapon being raised, lowered or holstered cannot fire or aim.
  // In a 1v1, firing is held during the countdown and after a round is decided.
  const trigger = input.playing && input.held("fire") && !loadout.swapping && holster === "out" && (!duel || duel.canFire) && !player.dropping && !loadout.active.empty && !downedNow && !ordnance.readied && !fireLockedToRelease;
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
  if (downedNow) player.healSlow = squadCfg.crawl;
  const moveIn = settings.crouchToggle && !scriptInput ? crouchToggled(input) : (scriptInput ?? input);
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
  // knocked in a match: on the floor until the round ends, or, with others
  // still standing (a 1v1v1), watching one of them from behind
  const watch = knockedOut && duel ? duel.spectateTarget() : null;
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
  // the shots leave from the eye whichever camera is on
  eye.copy(camera.position);
  aimYaw = player.yaw;
  aimPitch = player.pitch;
  const third = thirdPerson && !watch;
  if (third) {
    // Behind the right shoulder, looking where you look; orbiting, round the
    // figure's chest from wherever the orbit angles put it. A wall behind
    // pulls the camera in. The crosshair is what the camera's centre ray hits,
    // and the shot goes from the eye to that point, so it lands on the
    // crosshair rather than parallel to it.
    if (!orbiting) {
      const ease = 1 - Math.exp(-10 * dt);
      orbitYaw -= orbitYaw * ease;
      orbitPitch -= orbitPitch * ease;
    }
    const camQ = player.orientationAt(player.yaw + orbitYaw, Math.max(-80, Math.min(80, player.pitch + orbitPitch)), orbiting ? 0 : off.pitchUp, orbiting ? 0 : off.yawLeft);
    const fwd = tmpDir.set(0, 0, -1).applyQuaternion(camQ).clone();
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camQ);
    const back = fwd.clone().negate();
    const pivot = orbiting ? player.pos.clone().add(new THREE.Vector3(0, player.crouched || player.sliding ? 0.85 : 1.25, 0)) : eye.clone();
    if (!orbiting) {
      // over the shoulder, unless a wall is against it
      const side = Math.min(0.45, Math.max(0, solidHit(pivot, right, 0.45) - 0.1));
      pivot.addScaledVector(right, side).y += 0.1;
    }
    let dist = orbiting ? 3.2 : 2.4 - 0.9 * ws.adsFrac;
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
  const speedFov = (player.slideFov + joltFov) * (1 - ws.adsFrac);
  camera.fov = (hipV + (adsV - hipV) * ws.adsFrac) * (1 + speedFov);
  camera.updateProjectionMatrix();

  // Spawn shots. Each bullet leaves along the aim as it stood the instant
  // BEFORE that shot's own view kick, so the first round of a burst is
  // perfectly accurate. Hard recoil from earlier shots in the same frame is
  // accumulated so shot 2 of a frame sees shot 1's permanent kick.
  let hardPitch = 0;
  let hardYaw = 0;
  for (const s of shots) {
    // per pellet, as hits are: per trigger pull an EVA-8 read 800% accuracy
    stats.shots += weapon.pellets;
    gunRow(weapon.id).shots += weapon.pellets;
    drill.onShot(weapon.pellets);
    const shotQ = player.orientationAt(aimYaw, aimPitch, s.kick.preSoftPitchUp + hardPitch, s.kick.preSoftYawLeft + hardYaw);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(shotQ);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shotQ);
    const origin = eye.clone();
    // Shotguns fire several pellets per trigger pull, each with its own
    // deviation. Firing one projectile made an EVA-8 hit for 7 instead of 56.
    for (let p = 0; p < weapon.pellets; p++) {
      tmpDir.set(0, 0, -1).applyQuaternion(shotQ);
      // a single pellet of a shotgun still spreads, using at least the
      // weapon's own cone so the pattern is not a laser
      const cone = (weapon.pellets > 1 ? Math.max(s.cone, weapon.spread.standHip) : s.cone) * s.coneScale;
      if (cone > 0) {
        const half = (cone / 2) * DEG;
        const ang = half * Math.sqrt(rnd()); // sqrt for a uniform disc, not centre-biased
        const rot = rnd() * Math.PI * 2;
        const axis = right
          .clone()
          .multiplyScalar(Math.cos(rot))
          .add(up.clone().multiplyScalar(Math.sin(rot)))
          .normalize();
        tmpQ.setFromAxisAngle(axis, ang);
        tmpDir.applyQuaternion(tmpQ);
      }
      projectiles.fire(origin.clone(), tmpDir, weapon, false, s.dmgScale, s.speedScale);
      duel?.localShot(origin, tmpDir, weapon.id);
      selfFig?.kick();
    }
    hardPitch += s.kick.permPitchUp;
    hardYaw += s.kick.permYawLeft;
    viewModel.onShot();
    audio.gun(weapon.id);
    input.pad.rumble(0.15, 0.35, 40);
  }
  if (shots.length) {
    // hard recoil moves the base angles, then the camera is refreshed so this
    // frame renders the post-shot view rather than lagging by a frame
    player.addAngles(hardPitch, hardYaw);
    if (!third) camera.quaternion.copy(player.orientation(off.pitchUp, off.yawLeft));
  }

  const handleImpact = (e: ImpactEvent): void => {
    // a round into the spray wall (the range only)
    if (!duel && !e.dummy && !e.target && e.distance > 1) {
      const w = e.weapon === loadout.active.weapon.id ? loadout.active.weapon : e.weapon && e.weapon !== "melee" ? resolveWeapon(e.weapon, 0) : null;
      if (w) sprayWall.hit(e.point, w, now, e.distance);
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
      hud.addDamage(e.point, e.damage, e.targetHead ? "#ffd23c" : "#9fe0ff", e.targetHead, now);
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
        // a battle royale's shield core levels with the damage you deal
        if (duel instanceof BrMatch) {
          const up = armor.addEvo(r.amount);
          if (up !== null) {
            duel.shieldMax = armor.shieldMax;
            duel.shield = duel.shieldMax;
            hud.notice(`SHIELD UP: ${["", "WHITE", "BLUE", "PURPLE"][up]} ${armor.shieldMax}`, now, 1.6);
            audio.stinger("won");
          }
        }
      }
      duel.localHit(remote, r.amount, r.headshot, e.weapon, e.distance);
      stats.hits++;
      stats.damage += r.amount;
      if (r.headshot) stats.headshots++;
      const color = onShield ? `#${ARMOR_COLOR[2].toString(16).padStart(6, "0")}` : "#ff4a3d";
      const knock = wasAlive && remote.health <= 0;
      hud.addDamage(r.point, r.amount, r.headshot ? "#ffd23c" : color, r.headshot || knock, now);
      hud.hitMarker(now, r.headshot);
      if (knock) {
        hud.notice("KNOCKED DOWN", now, 0.8);
        stats.knocks++;
        audio.knock();
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
    hud.addDamage(r.point, r.amount, r.headshot ? "#ffd23c" : color, r.headshot || r.knocked, now);
    hud.hitMarker(now, r.headshot);
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
  for (const d of dummies) d.update(now, dt);
  drill.target.update(now, dt);
  for (const d of galleryFigs) d.update(now, dt);
  fx.update(now);
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
  viewModel.setHeirloom(debugView.heirloom ?? loadouts.current.heirloom);
  const lookYaw = player.yaw - prevYaw;
  const lookPitch = player.pitch - prevPitch;
  prevYaw = player.yaw;
  prevPitch = player.pitch;
  viewModel.update({
    dt,
    adsFrac: debugView.ads ?? ws.adsFrac,
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
    lowered: debugView.lowered ?? (emptyHand || downedNow || debugView.downed || knockedOut || ordnance.readied ? 1 : lowered),
    downed: downedNow || debugView.downed ? 1 : 0,
    inspect: now - inspectAt < INSPECT_TIME ? (now - inspectAt) / INSPECT_TIME : undefined,
    flourish: now - flourishAt < FLOURISH_TIME ? (now - flourishAt) / FLOURISH_TIME : undefined,
    onZip: debugView.onZip ?? player.onZip,
    draw: onScreen.state.drawFrac,
  });
  // in third person the gun in your hands is on your figure instead; in the
  // killcam the gun in view is your killer's, and it kicks when they fire
  // out (knocked in a round, eliminated): no gun and no hands at all, except the killer's in the killcam
  viewModel.group.visible = killcam.active || (!third && !knockedOut);
  if (killcam.active && killcam.firedThisFrame) viewModel.onShot();
  selfFigure(now, dt, emptyHand ? "" : onScreen.weapon.id, loadouts.current.operator, third && !killcam.active, knockedOut, downedNow);
  for (const lf of labFigs) {
    lf.f.setPose(lf.pose);
    // a knocked-out one stands a moment first (it drops the gun it held)
    if (lf.dead && now - lf.at > 0.6) lf.f.fallDown();
    lf.f.update(now, dt);
  }

  duel?.update({
    x: player.pos.x,
    y: player.pos.y,
    z: player.pos.z,
    yaw: player.yaw,
    pitch: player.pitch,
    crouch: player.crouched || player.sliding,
    weapon: emptyHand ? "" : drawn.id,
    operator: loadouts.current.operator,
    name: profile.profile.name,
    ready: input.playing,
    stance: downedNow ? "downed" : player.stance,
    speed: player.speed,
    ads: ws.adsFrac,
    act: localAct(),
  });
  // the battle royale from your side: E, the pads, pings
  if (duel instanceof BrMatch) {
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
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
    for (const [a, mine] of [
      [arena, !inTri],
      [triArena, inTri],
    ] as const) {
      const live = mine && !!z?.live;
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
      let t = 0;
      if (range && aim > 0 && d.group.visible && !d.knocked) {
        const dist = d.group.position.distanceTo(camera.position);
        t = aim * (dist <= range[0] ? 1 : dist >= range[1] ? 0 : 1 - (dist - range[0]) / (range[1] - range[0]));
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
  if (!NO_RENDER) pipeline.render(now);
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
    mapRegion: duel instanceof BrMatch ? BR_BOUNDS : undefined,
    // the drop shows the map by itself; M opens it any other time
    mapOpen: mapOpen || !!duelHud?.br?.dropping,
    heal: heal && vitalsTarget() ? { item: HEAL_ITEMS[heal.item].name, progress: Math.min(1, (now - heal.startedAt) / heal.duration) } : null,
    kit: (duel && duel.alive) || (!duel && rangeCombat.on && rangeCombat.alive) ? { ...kit.items } : null,
    healWheel: wheelOpen ? { items: HEAL_ORDER.map((k) => ({ id: k, name: HEAL_ITEMS[k].name, count: kit.items[k] })), pick: wheelPick } : null,
    lobby:
      hosting && (!duel || (duel.phase === "waiting" && duel instanceof Duel && duel.connected < duel.players - 1))
        ? { code: hosting.code, waitingFor: duel ? duel.players - 1 - (duel as Duel).connected : Number(duelPlayers.value) === 3 ? 2 : 1 }
        : null,
    vitals: duel ? { shield: duel.shield, shieldMax: duel.shieldMax, health: duel.health, healthMax: HEALTH_MAX, evo: duel instanceof BrMatch ? armor.evoFrac : null, helmet: armor.helmet } : rangeCombat.on ? { shield: rangeCombat.shield, shieldMax: rangeCombat.shieldMax, health: rangeCombat.health, healthMax: HEALTH_MAX } : null,
    drill: duel ? null : drill.hud(now),
    brHold: duel instanceof BrMatch ? brPlay.hud.hold : null,
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
    downed: downedNow && duel instanceof Duel ? { left: Math.max(0, duel.bleedUntil - performance.now() / 1000), revivedBy: duel.revivedBy !== null ? duel.nameFor(duel.revivedBy) : null } : null,
    spectating: watch && watchMate ? { name: watchMate.name, first: watchMate.id < Duel.BOT_ID && spectateFirst } : null,
    trainer: trainer.hud(now),
    mantleCue: trainer.cue && mantleCueOn,
    killcam: killcam.active ? { name: killcam.killerName, weapon: killcam.killerWeapon ? weaponName(killcam.killerWeapon) : "", progress: killcam.progress, left: killcam.left, skipKey: keyLabel("jump") } : null,
    recap: recap && !killcam.active ? { ...recap, age: now - recapShownAt, closeKey: keyLabel("jump") } : null,
    ability:
      abilities.enabled && abilities.picked
        ? (() => {
            const c = abilities.charge(now);
            return { name: ABILITIES[abilities.picked!].name, key: keyLabel("ability"), cooldown: c.recharge, left: c.charges > 0 ? 0 : c.nextIn, passive: abilities.picked === "triage", charges: c.charges, max: c.max, nextIn: c.nextIn };
          })()
        : null,
    // the card: full when it has just come up in a match, one line after 6 s or in the range
    abilityCard:
      abilities.enabled && (abilities.choosing || (!duel && !abilities.picked))
        ? {
            options: (["jolt", "triage"] as const).map((id, i) => ({ key: keyLabel(i === 0 ? "pickAbility1" : "pickAbility2"), name: ABILITIES[id].name, blurb: ABILITIES[id].blurb, picked: abilities.picked === id })),
            age: now - abilities.offeredAt,
            compact: !duel || !abilities.choosing || now - abilities.offeredAt > 6,
          }
        : null,
    plates: duel
      ? duel.avatars
          .map((a) => ({ a, r: duel!.remoteOf(a) }))
          .filter((x) => x.r !== null && x.a.group.visible)
          .map((x) => ({ world: new THREE.Vector3(x.a.group.position.x, x.a.group.position.y + 2.05, x.a.group.position.z), name: x.r!.name, health: x.r!.health, shield: x.r!.shield, shieldMax: x.r!.shieldMax, alive: x.r!.alive, ally: duel instanceof Duel && duel.isAlly(x.r!.id) }))
      : undefined,
    stance: player.stance,
    speedMs: player.speed,
    speedHu: player.speed / HU,
    prompt,
    scope: optic && optic.info.overlay && !third
      ? { style: optic.info.reticle, color: optic.info.color, amount: Math.max(0, Math.min(1, (aimNow - 0.75) / 0.2)) }
      : null,
  });
  input.endFrame();
  // CPU time for everything this frame did: simulation, render submission and
  // HUD. The GPU works on it after this, in parallel with the next frame.
  frameMs += (performance.now() - frameStart - frameMs) * 0.1;
}
/**
 * Next frame. A hidden tab gets no animation frames at all, which in a 1v1
 * would freeze you for the other player (and stop the host's round clock), so
 * in the background the loop carries on on a timer instead.
 */
let rafId = 0;
let timerId = 0;
function schedule(): void {
  if (document.hidden) timerId = window.setTimeout(frame, 16);
  else rafId = requestAnimationFrame(frame);
}
// A frame already asked for with the other method never arrives (a hidden
// tab's animation frame) or arrives late, so switch over the moment the tab is
// hidden or shown. Cancelling first means there is only ever one loop.
document.addEventListener("visibilitychange", () => {
  cancelAnimationFrame(rafId);
  clearTimeout(timerId);
  schedule();
});
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
  lobbyCode: () => (hosting && !duel ? hosting.code : null),
  setMapOpen: (on: boolean) => (mapOpen = on),
  /** abilities (tools/e2e.ts): the state, a pick, a use */
  abilities,
  pickAbility: (id: AbilityId) => pickAbility(id, gameTime),
  useAbility: () => useAbility(gameTime),
  fxCount: () => fx.count,
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
  /** the viewmodel's inspect and first draw (tools/e2e.ts) */
  /** a JOLT's view: the roll in degrees and the FOV fraction now (tools/e2e.ts) */
  joltFeel: () => ({ roll: joltRoll(gameTime), fov: joltFov }),
  vmState: () => ({ inspecting: gameTime - inspectAt < INSPECT_TIME, flourish: gameTime - flourishAt < FLOURISH_TIME, ...viewModel.shown }),
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
  gunSession: () => [...gunSession.entries()],
  startHeal: () => startHeal(gameTime),
  kit,
  armor,
  brMap,
  renderer,
  sun: getSun,
  quality,
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
  drawCalls: () => renderer.info.render.calls,
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
