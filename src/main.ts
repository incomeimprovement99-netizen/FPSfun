import * as THREE from "three";
import playerCfg from "./config/player.json";
import { resolveWeapon, weaponIds, weaponName } from "./game/weapons";
import { adsSensScale, cmPer360, degPerCount, hipFov43, verticalFovFrom43 } from "./game/sens";
import { Input } from "./game/input";
import type { PadSettings } from "./game/gamepad";
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
import { ProjectileSystem } from "./game/projectile";
import { Dummy, ARMOR_NAME, ARMOR_COLOR, type ArmorTier } from "./game/dummy";
import { buildRange, skyFollow, RANGE_BOUNDS, TARGET_RAILS, TARGET_SPECS, PROP_PLACEMENTS } from "./game/range";
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
import { Duel, SHIELD_MAX, HEALTH_MAX, type MatchLike } from "./game/duel";
import { BotMatch } from "./game/bots";
import { Stats, type MatchKind, type BotDifficulty } from "./game/stats";
import { submitScore } from "./game/leaderboard";
import { hostMatch, joinMatch, type HostHandle, type Link } from "./net/link";
import type { MoveInput } from "./game/player";
import { buildArena, buildTriArena, ARENA_BOUNDS, ARENA_SPAWNS, TRI_BOUNDS } from "./game/arena";
import { Loadouts, type LoadoutDef } from "./game/loadouts";
import { operatorById, OPERATORS } from "./game/operators";
import { setArmColors } from "./game/arms";
import { Menu, type Mode } from "./ui/menu";
import type { ImpactEvent } from "./game/projectile";
import { MELEE_TIME } from "./game/viewmodel";

const DEG = Math.PI / 180;
/** slot 1 and slot 2. Keys 1 and 2 select, Q swaps. */
const LOADOUT_IDS = ["rspn101", "wingman"];
/** which key cycles each attachment slot, shown in the HUD */
const ATTACH_KEY: Record<AttachSlot, string> = {
  optic: "O",
  barrel: "B",
  stock: "N",
  laser: "H",
};

// ---------- settings (defaults from config, overrides in localStorage) ----------
interface Settings {
  dpi: number;
  sens: number;
  ads: number;
  fovScale: number;
}
const LS_KEY = "range.settings.v1";
function loadSettings(): Settings {
  const base: Settings = {
    dpi: playerCfg.dpi ?? 800,
    sens: playerCfg.mouseSensitivity,
    ads: playerCfg.adsScalars[0] ?? 1,
    fovScale: playerCfg.fovScale,
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

function readSettings(): void {
  settings.dpi = Number(inDpi.value) || settings.dpi;
  settings.sens = Number(inSens.value) || settings.sens;
  settings.ads = Number(inAds.value) || settings.ads;
  settings.fovScale = Math.max(1, Math.min(1.571, Number(inFov.value) || settings.fovScale));
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
  const adsScale = adsSensScale(hip, w.zoomFov43 * settings.fovScale, settings.ads);
  derived.innerHTML =
    `<b>${cm.toFixed(2)} cm/360</b> hipfire (${degPerCount(settings.sens).toFixed(5)}° per count) · ` +
    `ADS ${(cm / adsScale).toFixed(2)} cm/360<br/>` +
    `FOV ${hip.toFixed(1)} (4:3 horizontal) · vertical ${verticalFovFrom43(hip).toFixed(1)}° · ADS ${(w.zoomFov43 * settings.fovScale).toFixed(1)}`;
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
}) as WebGL2RenderingContext;
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
// exactly what the range built, for the static merge below (not the dummies
// and targets added later, which move)
const rangeRoots = scene.children.filter((o) => !beforeRange.has(o) && o !== arena.root && o !== triArena.root);
// The sky doubles as the environment map. Without it every metal surface is
// black, so this is load-bearing rather than decoration.
void installSky(scene, renderer);
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
} = {
  weapon: null,
  ads: null,
  reload: null,
  optic: null,
  lowered: null,
  onZip: null,
  heirloom: null,
};
const debugWeapons = new Map<string, ReturnType<typeof resolveWeapon>>();

const input = new Input(renderer.domElement);
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
const audio = new GameAudio();
const hud = new Hud($<HTMLCanvasElement>("hud"));
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
const projectiles = new ProjectileSystem(scene, [...dummies, ...courseEnemies], targets, 0);
/** everything a Digital Threat optic can light up */
const threatTargets = [...dummies, ...courseEnemies];

// ---------- matches: 1v1, 1v1v1 (src/game/duel.ts, src/net/link.ts), bots (src/game/bots.ts) ----------
let duel: MatchLike | null = null;
let hosting: HostHandle | null = null;
let cancelJoin: (() => void) | null = null;
/** knocked in a match: the controller gets no keys until the next round */
const NO_INPUT: MoveInput = { held: () => false, pressedNow: () => false };
const duelStatus = $("duelStatus");
const duelHostBtn = $<HTMLButtonElement>("duelHost");
const duelJoinBtn = $<HTMLButtonElement>("duelJoin");
const duelLeaveBtn = $<HTMLButtonElement>("duelLeave");
const duelCode = $<HTMLInputElement>("duelCode");
const duelPlayers = $<HTMLSelectElement>("duelPlayers");
const botDifficulty = $<HTMLSelectElement>("botDifficulty");
const botCount = $<HTMLSelectElement>("botCount");
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
  player.teleport(sp.x, 0, sp.z, sp.yaw);
  // full magazines, settled spread and recoil, gun out
  for (const sl of loadout.slots) sl.state.setWeapon(sl.weapon);
  holster = "out";
}
/** the callbacks every kind of match gets */
function wireMatch(d: MatchLike, kind: MatchKind): void {
  d.onRespawn = () => respawnForMatch(d);
  d.onHurt = () => {
    hud.hurt(gameTime);
    audio.hit();
    input.pad.rumble(0.6, 0.3, 120);
  };
  d.onRemoteShot = (o) => audio.shot(0.85, 10 / Math.max(10, o.distanceTo(player.pos)));
  d.onNotice = (t) => hud.notice(t, gameTime, 1);
  d.onEnd = (reason) => endMatch(reason);
  d.onFeed = (text, mine) => hud.feed(text, gameTime, mine ? "#7ddc8a" : "#ff8a7a");
  d.streak = profile.match(kind).streak;
  d.onMatchEnd = (s) => {
    profile.recordMatch(kind, s);
    d.streak = profile.match(kind).streak;
    menu.renderStats();
    if (s.won) void submitScore(`${kind.replace(":", ":")}:wins`, profile.profile.name, profile.match(kind).won);
  };
}
/** a friend's match: the host on its first guest, or a guest on the host's welcome */
function startDuel(link: Link, players: number, myId: number, guestId = 1): void {
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
  for (const c of courses) c.reset();
  const d = new Duel(scene, projectiles, { players, myId, link, guestId });
  duel = d;
  player.setBounds(players >= 3 ? TRI_BOUNDS : ARENA_BOUNDS);
  wireMatch(d, players >= 3 ? "triple" : "duel");
  d.onRoster = (connected, total) => {
    setDuelStatus(connected < total - 1 ? `${connected} of ${total - 1} friends in. Waiting for the rest; the code is <b class="code">${hosting?.code ?? ""}</b>.` : `Everyone is in. First to 3 rounds. <b>Click Play</b> to fight.`, connected < total - 1 ? "live" : "good");
  };
  respawnForMatch(d);
  if (myId === 0) d.onRoster?.(1, players);
  else setDuelStatus(`Connected as player ${myId + 1} of ${players}. First to 3 rounds. <b>Click Play</b> to fight.`, "good");
  duelButtons();
  hud.notice(players >= 3 ? "PLAYER CONNECTED" : "OPPONENT CONNECTED", gameTime, 2);
}
/** the offline match against bots */
function startBots(): void {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  cancelJoin = null;
  for (const c of courses) c.reset();
  const diff = (botDifficulty.value === "easy" || botDifficulty.value === "hard" ? botDifficulty.value : "normal") as BotDifficulty;
  const d = new BotMatch(scene, projectiles, diff, Number(botCount.value) === 2 ? 2 : 1);
  duel = d;
  player.setBounds(ARENA_BOUNDS);
  wireMatch(d, `bots:${diff}`);
  respawnForMatch(d);
  setDuelStatus(`Against ${Number(botCount.value) === 2 ? "two bots" : "a bot"}, ${diff}. First to 3 rounds.`, "good");
  duelButtons();
}
function endMatch(reason: string): void {
  duel?.dispose();
  duel = null;
  hosting?.cancel();
  hosting = null;
  hud.notice(reason.toUpperCase(), gameTime, 3);
  setDuelStatus(reason);
  duelButtons();
  goTo("range");
}
duelHostBtn.addEventListener("click", () => {
  if (duel || hosting) return;
  cancelJoin?.();
  const players = Number(duelPlayers.value) === 3 ? 3 : 2;
  setDuelStatus("Making a match...", "live");
  hosting = hostMatch(
    players,
    (code) => {
      setDuelStatus(`Your code is <b class="code">${code}</b> (copied). Send it to ${players === 3 ? "both friends" : "your friend"} and wait here.`, "live");
      void navigator.clipboard?.writeText(code).catch(() => undefined);
    },
    (link, id) => startDuel(link, players, 0, id),
    (err) => {
      setDuelStatus(err, "bad");
      hosting = null;
      duelButtons();
    }
  );
  duelButtons();
});
duelJoinBtn.addEventListener("click", () => {
  if (duel) return;
  hosting?.cancel();
  hosting = null;
  cancelJoin?.();
  setDuelStatus("Joining...", "live");
  cancelJoin = joinMatch(duelCode.value, (link, w) => startDuel(link, w.players, w.id), (err) => setDuelStatus(err, "bad"));
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
  : mergeStatic(scene, [...rangeRoots, ...courses.map((c) => c.root), arena.root, triArena.root]);

// Two slots, each with its own clip and reload state: empty one mag, swap,
// empty the other, swap back and the first is still empty.
const loadout = new Loadout([loadouts.current.slot1, loadouts.current.slot2]);
// from here the readout describes the gun actually in hand, attachments included
currentWeapon = () => loadout.active.weapon;
refreshDerived();

// Starting a run equips the course pistols; finishing (or leaving) gives your
// own guns back.
// Your guns come back as you had them: attachments and mag level included
// (saving the ids alone stripped every attachment after a run).
let savedSlots: SlotSetup[] | null = null;
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
    void submitScore(`course:${course.layout.id}`, profile.profile.name, Number(r.time.toFixed(3)));
  };
}
const courseRunning = (): boolean => courses.some((c) => c.running);

/**
 * Put a loadout on: weapons in both slots, the operator's colours on your
 * gloves, the heirloom in your hand. During a course run the course pistols
 * stay in hand and the loadout's guns come back at the end.
 */
function applyLoadout(def: LoadoutDef): void {
  if (courseRunning() && savedSlots) savedSlots = [def.slot1, def.slot2].map((id) => ({ id, magLevel: 0, attach: {}, zoomAlt: false }));
  else {
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
  for (const c of courses) c.reset();
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
    s.deadzone = Math.max(0, Math.min(0.3, (Number(dead.value) || 12) / 100));
    s.autoSprint = auto.value === "1";
    s.rumble = rumble.value === "1";
    try {
      localStorage.setItem(LS_PAD, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  };
  for (const el of [look, ads, curve, dead, auto, rumble]) el.addEventListener("change", save);
}
input.onLockChange = (locked) => {
  overlay.classList.toggle("hidden", locked);
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

function frame(): void {
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
  const padAdsScale = 1 + (adsSensScale(hipFov43(settings.fovScale), zoomFov43(loadout.active.weapon) * settings.fovScale, 1) - 1) * loadout.active.state.adsFrac;
  const padLook = input.pad.poll(wall, dt, padAdsScale);
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
  const knockedOut = duel !== null && !duel.alive;

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
    const armed = holster === "out" && !knockedOut;

    // discrete keys
    if (armed && input.pressedNow("reload") && !loadout.swapping && !(player.zipPrompt && input.pad.pressedNow("reload"))) {
      ws.startReload(now);
      if (ws.reloading) audio.reload();
    }
    // weapon select: 1 and 2 pick a slot, Q swaps to the other
    if (armed && input.pressedNow("slot1")) loadout.requestSwap(0, now);
    if (armed && input.pressedNow("slot2")) loadout.requestSwap(1, now);
    // Q or the forward thumb button, which is where most players bind swap
    if (armed && input.pressedNow("swapWeapon")) loadout.requestNext(now);
    if (input.pressedNow("cycleArmor")) {
      armorTier = ((armorTier + 1) % 5) as ArmorTier;
      for (const d of dummies) d.setTier(armorTier); // also clears engagedAt
    }
    if (input.pressedNow("resetDummies")) {
      for (const d of dummies) d.reset();
      for (const t of targets) t.reset();
      for (const c of courses) c.reset();
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
    if (input.pressedNow("melee") && now >= meleeReadyAt && !loadout.swapping && (!duel || duel.canFire)) {
      meleeReadyAt = now + MELEE_COOLDOWN;
      viewModel.melee();
      meleeHitAt = now + MELEE_TIME * 0.35;
    }
    // K: race your best run's ghost, or not
    if (input.pressedNow("ghost")) {
      const course = activeCourse();
      const on = course.toggleGhost();
      hud.notice(on ? (course.hasGhost ? "GHOST ON" : "GHOST ON: finish a run to record one") : "GHOST OFF", now, 1.4);
    }

    // mouse -> view. adsH is read from the CURRENT weapon object, which the
    // mag-level key above may have just replaced.
    const adsHNow = zoomFov43(loadout.active.weapon) * settings.fovScale;
    const m = input.consumeMouse();
    const adsScale = 1 + (adsSensScale(hipH, adsHNow, settings.ads) - 1) * ws.adsFrac;
    player.applyMouse(m.dx, m.dy, degPerCount(settings.sens) * adsScale, playerCfg.invertPitch);
    // the controller's right stick, read this frame in padLook
    player.addAngles(padLook.pitchUp * (playerCfg.invertPitch ? -1 : 1), padLook.yawLeft);
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
  const trigger = input.playing && input.held("fire") && !loadout.swapping && holster === "out" && (!duel || duel.canFire);
  // knocked in a 1v1: no aiming either
  const adsHeld = input.playing && input.held("ads") && !loadout.swapping && holster === "out" && (!duel || duel.alive);
  // Move BEFORE sampling stance, so the spread model sees this frame's stance
  // rather than last frame's. The cost is that move speed uses last frame's
  // ADS fraction, which over a 0.27 s transition is a 6% error for one frame.
  // re-read AFTER the input block, which may have swapped the weapon object
  const weapon = loadout.active.weapon;
  const adsH = zoomFov43(weapon) * settings.fovScale;
  const firing = now - ws.lastShotAt < 0.25;
  player.update(dt, now, knockedOut ? NO_INPUT : (scriptInput ?? input), ws.adsFrac, weapon.adsMoveScale, firing || trigger);
  // a slide counts as crouched for the spread model: the cone tightens
  const crouched = player.crouched || player.sliding;
  const stance = !player.onGround ? "air" : crouched ? "crouch" : "stand";
  const motion = player.sprinting ? "sprint" : player.speed > 0.6 ? "walk" : "still";
  const shots = ws.update(dt, now, trigger, adsHeld, stance, motion, !player.onGround, crouched, rnd);
  if (ws.consumeDryFire()) audio.dry();

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
  if (watch) {
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
  const speedFov = player.slideFov * (1 - ws.adsFrac);
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
    const shotQ = player.orientation(s.kick.preSoftPitchUp + hardPitch, s.kick.preSoftYawLeft + hardYaw);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(shotQ);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(shotQ);
    const origin = camera.position.clone();
    // Shotguns fire several pellets per trigger pull, each with its own
    // deviation. Firing one projectile made an EVA-8 hit for 7 instead of 56.
    for (let p = 0; p < weapon.pellets; p++) {
      tmpDir.set(0, 0, -1).applyQuaternion(shotQ);
      // a single pellet of a shotgun still spreads, using at least the
      // weapon's own cone so the pattern is not a laser
      const cone = weapon.pellets > 1 ? Math.max(s.cone, weapon.spread.standHip) : s.cone;
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
      projectiles.fire(origin.clone(), tmpDir, weapon);
      duel?.localShot(origin, tmpDir, weapon.id);
    }
    hardPitch += s.kick.permPitchUp;
    hardYaw += s.kick.permYawLeft;
    viewModel.onShot();
    audio.shot(1);
    input.pad.rumble(0.15, 0.35, 40);
  }
  if (shots.length) {
    // hard recoil moves the base angles, then the camera is refreshed so this
    // frame renders the post-shot view rather than lagging by a frame
    player.addAngles(hardPitch, hardYaw);
    camera.quaternion.copy(player.orientation(off.pitchUp, off.yawLeft));
  }

  const handleImpact = (e: ImpactEvent): void => {
    // a shootable target rather than a dummy
    if (e.target) {
      stats.hits++;
      stats.damage += e.damage;
      if (e.targetHead) stats.headshots++;
      hud.addDamage(e.point, e.damage, e.targetHead ? "#ffd23c" : "#9fe0ff", e.targetHead, now);
      hud.hitMarker(now, e.targetHead);
      if (e.targetHead) audio.headshot();
      else audio.hit();
      return;
    }
    // another player (or a bot) in a match: send the damage, show it at once
    const remote = duel && e.dummy ? duel.remoteOf(e.dummy) : null;
    if (duel && remote && e.report) {
      const r = e.report;
      const wasAlive = remote.health > 0;
      const onShield = remote.shield > 0;
      duel.localHit(remote, r.amount, r.headshot);
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
      else if (r.headshot) audio.headshot();
      else audio.hit();
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
    else if (r.headshot) audio.headshot();
    else audio.hit();
  };
  projectiles.update(dt, now, handleImpact);
  // the melee swing lands a third of the way through
  if (now >= meleeHitAt) {
    meleeHitAt = Infinity;
    // a swing is an attack for the accuracy readout, as a hit with it counts
    stats.shots++;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    projectiles.melee(camera.position, dir, MELEE_RANGE, MELEE_DAMAGE, now, handleImpact);
  }

  for (const d of dummies) d.update(now, dt);
  if (!duel) for (const c of courses) c.update(now, dt, player);
  for (const t of targets) t.update(now, dt);
  // The model on screen switches at the bottom of the swap dip, when the gun
  // is out of frame: the outgoing weapon before the midpoint, the incoming one
  // after it.
  const swapP = loadout.swapping ? loadout.swapProgress(now) : 1;
  const onScreen = loadout.swapping && swapP < 0.5 ? loadout.active : loadout.display;
  let drawn = onScreen.weapon;
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
    lowered: debugView.lowered ?? lowered,
    onZip: debugView.onZip ?? player.onZip,
  });

  duel?.update({
    x: player.pos.x,
    y: player.pos.y,
    z: player.pos.z,
    yaw: player.yaw,
    pitch: player.pitch,
    crouch: player.crouched || player.sliding,
    weapon: drawn.id,
    operator: loadouts.current.operator,
    name: profile.profile.name,
    ready: input.playing,
  });
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
  if (!NO_RENDER) pipeline.render(now);
  const shown = loadout.display;
  // context prompts: a zipline in reach, or a ladder you are facing
  let prompt: { key: string; text: string } | null = null;
  if (player.zipPrompt) prompt = { key: "E", text: "RIDE ZIPLINE" };
  else if (player.onGround && ladderAhead(player.pos.x, player.pos.y, player.pos.z, player.yaw)) {
    prompt = { key: "SPACE", text: "JUMP INTO THE WALL, HOLD W TO CLIMB" };
  }
  const optic = viewModel.opticFitted;
  const aimNow = debugView.ads ?? ws.adsFrac;
  hud.draw(now, camera, {
    // name/ammo follow the INCOMING weapon during a swap; cone/ADS stay with
    // the gun actually in hand
    weaponName: shown.weapon.name,
    magLevel: shown.magLevel,
    slot: loadout.displayIndex + 1,
    slotCount: loadout.slots.length,
    otherName: loadout.slots[loadout.nextIndex].weapon.name,
    swapping: loadout.swapping,
    fireMode: shown.weapon.burstCount > 1 ? `burst ${shown.weapon.burstCount}` : shown.weapon.semiAuto ? "single" : "auto",
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
    duel: duel ? duel.hud() : null,
    vitals: duel ? { shield: duel.shield, shieldMax: SHIELD_MAX, health: duel.health, healthMax: HEALTH_MAX } : null,
    plates: duel
      ? duel.avatars
          .map((a) => ({ a, r: duel!.remoteOf(a) }))
          .filter((x) => x.r !== null && x.a.group.visible)
          .map((x) => ({ world: new THREE.Vector3(x.a.group.position.x, x.a.group.position.y + 2.05, x.a.group.position.z), name: x.r!.name, health: x.r!.health, shield: x.r!.shield, shieldMax: SHIELD_MAX, alive: x.r!.alive }))
      : undefined,
    stance: player.stance,
    speedMs: player.speed,
    speedHu: player.speed / HU,
    prompt,
    scope: optic && optic.info.overlay
      ? { style: optic.info.reticle, color: optic.info.color, amount: Math.max(0, Math.min(1, (aimNow - 0.75) / 0.2)) }
      : null,
  });
  input.endFrame();
  // CPU time for everything this frame did: simulation, render submission and
  // HUD. The GPU works on it after this, in parallel with the next frame.
  frameMs += (performance.now() - frameStart - frameMs) * 0.1;
  schedule();
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
  drawCalls: () => renderer.info.render.calls,
  techLog,
  /** drive the player from a script instead of the keyboard (null to stop) */
  setScript: (s: MoveInput | null, hook: ((now: number, dt: number) => void) | null = null) => {
    scriptInput = s;
    frameHook = hook;
  },
  /** optics fitted anywhere in the scene: one at most, on the gun in hand (tools/e2e.ts) */
  opticsInScene: () => {
    let n = 0;
    scene.traverse((o) => {
      if (o.name.startsWith("optic:")) n++;
    });
    return n;
  },
};
