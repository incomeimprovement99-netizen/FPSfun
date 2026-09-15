// THE RUN: timed movement courses off the back wall of the range.
//
// Built on two references. MW2's "The Pit" (24 armed pop-up cutouts and 5
// civilians across seven areas, a clock, stars at 45 s and 35 s, Infinity
// Ward's best 22.6 s) gives the pop-up rooms and the time penalties. MW4's
// 2026 Mobility Course gives the idea of a route that asks for a different
// movement technique in each section and rewards chaining them.
//
// This file is the engine: the run (clock, splits, penalties, the ghost, the
// results TV), and the structure every course shares (a walled compound with
// a roof, a divider wall and a nameplate between rooms, the start and finish
// lines). What is IN the rooms comes from a CourseLayout (courses/basic.ts,
// courses/advanced.ts), which also names the rooms, their enemies and the tips
// on the walls.
//
// Cross the start line to start the clock, the finish line to stop it. Every
// armed dummy left standing at the finish adds 3 s. Falling into a hazard puts
// you back at that room's entrance with 2 s added.
//
// Coordinates are the course's own: x across it (its walls at x0 and x1), z
// from the gate at 9 to the far wall. The whole course sits at `layout.x` in
// the world.
//
// Sides: running the course you face +z, and facing +z, +x is on your LEFT.
// The tips are written for someone running it forwards. (The first draft had
// every left and right mirrored; the movement simulation caught it.)
//
// Every room has its fastest route written on the wall you came in through,
// facing into the room. Running the course the right way you never see it;
// turn round, or walk it backwards, and it is there.
import * as THREE from "three";
import { Dummy } from "./dummy";
import { RANGE_SOLIDS } from "./range";
import { PAL, bevel, flat, emissive, hazardTexture, graffitiTexture, worldTiledMaterial, textPanel, type WallTheme } from "./geo";
import { warehouseRoof } from "./warehouse";
import { material } from "./materials";
import { ZIPLINES, buildLadder } from "./traversal";

// ------------------------------------------------------------------ layout

const PENALTY_MISS = 3;
const PENALTY_FALL = 2;
/** a run still going after this long is abandoned (its ghost would not fit in storage) */
const MAX_RUN = 600;

export interface EnemySpec {
  x: number;
  z: number;
  y?: number;
  gun: string;
  /** side-to-side sway amplitude, metres (0 = still) */
  sway?: number;
}

export interface Room {
  name: string;
  /** entry wall z: the tip faces into the room from here */
  entryZ: number;
  /** tip panel centre x (clear of the door) */
  tipX: number;
  tip: string;
  /** the room's enemies pop up when this returns true (course coordinates) */
  trigger: (x: number, y: number, z: number) => boolean;
  enemies: EnemySpec[];
  /** the par for this room, seconds (else its share of the course's S time by its length) */
  par?: number;
}

export type Medal = "gold" | "silver" | "bronze";
/** a medal against a par: gold at or under it, silver within 25%, bronze within 60% (ours) */
export const MEDAL_STEPS: Array<[Medal, number]> = [
  ["gold", 1],
  ["silver", 1.25],
  ["bronze", 1.6],
];
export function medalFor(time: number, par: number): Medal | null {
  if (!Number.isFinite(time) || !Number.isFinite(par) || par <= 0) return null;
  for (const [m, k] of MEDAL_STEPS) if (time <= par * k + 1e-9) return m;
  return null;
}

/**
 * Each room's par: its own if set, else the course's S time shared out by the
 * rooms' lengths along the course (the stretch from the start line to the
 * first room and each room to the next entry, the last to the finish).
 */
export function roomPars(L: Pick<CourseLayout, "rooms" | "ranks" | "startZ" | "finishZ">): number[] {
  const sTime = L.ranks[0]?.[1] ?? 60;
  const total = Math.max(1, L.finishZ - L.startZ);
  return L.rooms.map((room, i) => {
    if (room.par !== undefined) return room.par;
    const end = i + 1 < L.rooms.length ? L.rooms[i + 1].entryZ : L.finishZ;
    return Math.round(((sTime * (end - room.entryZ)) / total) * 10) / 10;
  });
}

/** a hazard floor: below `fallY` between these z you have fallen; back to `respawn`, 2 s added */
export interface Hazard {
  minZ: number;
  maxZ: number;
  fallY: number;
  respawn: THREE.Vector3;
}

/**
 * What a layout gets to build its rooms with. Course coordinates throughout;
 * every solid it makes is a collider. The simulation drives the same build
 * with a collision-only builder, which is how a room is proved possible.
 */
export interface CourseBuilder {
  x0: number;
  x1: number;
  wallH: number;
  /** a solid box: w, h, d at (x, y, z), y the base. `solid` false for decoration. */
  box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material, solid?: boolean): THREE.Mesh | null;
  /** a bare collider */
  solid(minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number): void;
  /** a ladder on a wall face (traversal.ts) */
  ladder(x: number, z: number, nx: number, nz: number, base: number, top: number): void;
  /** a zipline; `floorA`/`floorB` are the floor heights at each end's anchor post */
  zipline(a: THREE.Vector3, b: THREE.Vector3, opts: { vertical: boolean; floorA?: number; floorB?: number }): void;
  /** a hazard floor's paint (the rule is the layout's `hazards`) */
  hazardFloor(minZ: number, maxZ: number, minX?: number, maxX?: number): void;
  /** a glowing strip (vent lips, edges) */
  glow(w: number, h: number, d: number, x: number, y: number, z: number, color: number, intensity?: number): void;
  /** anything else drawn */
  add(o: THREE.Object3D): void;
  /** the wall paint of the room at this z */
  roomMat(z: number): THREE.Material;
  coverMat: THREE.Material;
  platMat: THREE.Material;
  /** a plain colour */
  flat(color: number, roughness?: number, metalness?: number): THREE.Material;
}

export interface CourseLayout {
  /** storage id ("basic" keeps the keys from before there were two) */
  id: string;
  /** the name on the TV and the HUD */
  title: string;
  /** where x = 0 is in the world */
  x: number;
  x0: number;
  x1: number;
  wallH: number;
  startZ: number;
  finishZ: number;
  farZ: number;
  /** rank thresholds in seconds, ascending, the last Infinity */
  ranks: Array<[string, number]>;
  rooms: Room[];
  /** divider walls between rooms, and the door gap in x */
  dividers: Array<{ z: number; door: [number, number] }>;
  /** wall paint per segment: index 0 the start area, then the rooms in order */
  themes: Array<{ wall: WallTheme; trim: number }>;
  /** where each segment's walls begin and end; one more than themes */
  segments: number[];
  hazards: Hazard[];
  /** the results TV and where you stand to read it */
  tv: { x: number; y: number; z: number; w: number; h: number };
  returnTo: { x: number; z: number; yaw: number; pitch: number };
  /** the menu's start position */
  startPose: { x: number; z: number; yaw: number };
  /** the rules sign inside the gate; {P1} and {P2} are the course pistols' names */
  sign: string;
  /** roof girders and light rows, x */
  girders: number[];
  lights: number[];
  build(b: CourseBuilder): void;
}

export interface CourseSplit {
  name: string;
  /** clock time on entering this room (penalties included), NaN if skipped */
  time: number;
  /** against the best run's split here, or null with no best run yet */
  delta: number | null;
  /** the time spent in this room (to the next room, or the finish), its par, and the medal it earned */
  room?: number;
  par?: number;
  medal?: Medal | null;
}

export interface CourseResult {
  time: number;
  raw: number;
  missed: number;
  rank: string;
  newBest: boolean;
  splits: CourseSplit[];
}

/** a recorded run: x, y, z, yaw every `dt` seconds */
interface Ghost {
  dt: number;
  data: number[];
}
const GHOST_DT = 1 / 30;

export interface CoursePlayer {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  /** place the player cleanly (Player.teleport) */
  teleport(x: number, y: number, z: number, yaw: number, pitch?: number): void;
}

/** the localStorage keys; the first course keeps the names from before there were two */
function storageKeys(id: string): { best: string; splits: string; ghost: string; recent: string; ghostOn: string } {
  const p = id === "basic" ? "range.course" : `range.course.${id}`;
  return { best: `${p}.best`, splits: `${p}.splits.v2`, ghost: `${p}.ghost.v2`, recent: `${p}.recent.v1`, ghostOn: `${p}.ghostOn` };
}

/**
 * The course's colliders and ziplines without a scene, for the simulation:
 * the compound's walls and dividers, then whatever the layout builds, through
 * a builder that draws nothing.
 */
export function courseColliders(L: CourseLayout): { solids: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; base: number; top: number }>; zips: Array<[THREE.Vector3, THREE.Vector3]> } {
  const solids: Array<{ minX: number; maxX: number; minZ: number; maxZ: number; base: number; top: number }> = [];
  const zips: Array<[THREE.Vector3, THREE.Vector3]> = [];
  const dummyMat = new THREE.MeshBasicMaterial();
  const b: CourseBuilder = {
    x0: L.x0,
    x1: L.x1,
    wallH: L.wallH,
    box: (w, h, d, x, y, z, _mat, solid = true) => {
      if (solid) solids.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2, base: y, top: y + h });
      return null;
    },
    solid: (minX, maxX, minZ, maxZ, base, top) => solids.push({ minX, maxX, minZ, maxZ, base, top }),
    ladder: () => undefined,
    zipline: (a, c) => zips.push([a.clone(), c.clone()]),
    hazardFloor: () => undefined,
    glow: () => undefined,
    add: () => undefined,
    roomMat: () => dummyMat,
    coverMat: dummyMat,
    platMat: dummyMat,
    flat: () => dummyMat,
  };
  structure(L, b);
  L.build(b);
  return { solids, zips };
}

/** the compound: outer walls, the far wall, the dividers (colliders only through `b`) */
function structure(L: CourseLayout, b: CourseBuilder): void {
  for (let i = 0; i < L.segments.length - 1; i++) {
    const z0 = L.segments[i];
    const z1 = L.segments[i + 1];
    b.box(1, L.wallH, z1 - z0, L.x0 - 0.5, 0, (z0 + z1) / 2, b.roomMat(z0));
    b.box(1, L.wallH, z1 - z0, L.x1 + 0.5, 0, (z0 + z1) / 2, b.roomMat(z0));
  }
  b.box(L.x1 - L.x0 + 2, L.wallH, 1, 0, 0, L.farZ + 0.5, b.roomMat(L.farZ - 0.1));
  // the range's back wall is 6 m; close the gap to the course roof over it
  b.box(L.x1 - L.x0 + 2, L.wallH - 6, 1, 0, 6, 8.5, b.roomMat(9));
  for (const d of L.dividers) {
    const [d0, d1] = d.door;
    for (const [dz, mat] of [
      [-0.25, b.roomMat(d.z - 1)],
      [0.25, b.roomMat(d.z + 1)],
    ] as const) {
      if (d0 > L.x0) b.box(d0 - L.x0, L.wallH, 0.5, (L.x0 + d0) / 2, 0, d.z + dz, mat);
      if (d1 < L.x1) b.box(L.x1 - d1, L.wallH, 0.5, (d1 + L.x1) / 2, 0, d.z + dz, mat);
      // above the door, up to the roof
      b.box(d1 - d0, L.wallH - 3.3, 0.5, (d0 + d1) / 2, 3.3, d.z + dz, mat);
    }
  }
}

export class Course {
  readonly enemies: Dummy[] = [];
  private readonly roomEnemies: Dummy[][] = [];
  private readonly roomTriggered: boolean[] = [];
  private readonly baseX = new Map<Dummy, number>();
  private readonly sway = new Map<Dummy, number>();
  /** everything the course draws, placed at the layout's x */
  readonly root = new THREE.Group();
  running = false;
  private startedAt = 0;
  private penalties = 0;
  result: CourseResult | null = null;
  private resultUntil = 0;
  best: number | null = null;
  private lastZ = 0;
  private inCompound = false;
  /** called with true when a run starts and false when it ends */
  onRunChange: ((running: boolean) => void) | null = null;
  /** called for on-screen notices */
  onNotice: ((text: string) => void) | null = null;
  /** a run finished: the result, for stats */
  onFinish: ((r: CourseResult) => void) | null = null;

  // ----- splits: the clock at each room entry, against the best run's -----
  private splits: number[] = [];
  private bestSplits: number[] | null = null;
  /** the latest split, for the HUD to show for a few seconds */
  lastSplit: (CourseSplit & { at: number }) | null = null;

  // ----- the ghost: your best run, replayed as you race it -----
  private rec: number[] = [];
  private recNext = 0;
  private ghost: Ghost | null = null;
  private readonly ghostFig: THREE.Group;
  /** K toggles the ghost; remembered */
  ghostOn = true;

  // ----- the results TV by the start -----
  private tvCanvas!: HTMLCanvasElement;
  private tvTex!: THREE.CanvasTexture;
  private recent: number[] = [];
  /** after a finish, when to put the player back at the start */
  private returnAt = Infinity;
  private readonly keys: ReturnType<typeof storageKeys>;

  constructor(
    private scene: THREE.Scene,
    readonly layout: CourseLayout
  ) {
    this.keys = storageKeys(layout.id);
    try {
      const b = Number(localStorage.getItem(this.keys.best));
      if (b > 0) this.best = b;
      const sp = JSON.parse(localStorage.getItem(this.keys.splits) ?? "null") as unknown;
      if (Array.isArray(sp) && sp.every((x) => typeof x === "number" || x === null)) this.bestSplits = sp.map((x) => (x === null ? NaN : x));
      const g = JSON.parse(localStorage.getItem(this.keys.ghost) ?? "null") as Ghost | null;
      if (g && typeof g.dt === "number" && Array.isArray(g.data) && g.data.length >= 8) this.ghost = g;
      this.ghostOn = localStorage.getItem(this.keys.ghostOn) !== "0";
      const r = JSON.parse(localStorage.getItem(this.keys.recent) ?? "[]") as unknown;
      if (Array.isArray(r)) this.recent = r.filter((x): x is number => typeof x === "number").slice(0, 5);
    } catch {
      /* ignore */
    }
    this.ghostFig = ghostFigure();
    this.ghostFig.visible = false;
    scene.add(this.ghostFig);
    this.root.position.x = layout.x;
    this.root.name = `course:${layout.id}`;
    scene.add(this.root);
    this.build();
    this.root.updateMatrixWorld(true);
  }

  /** where to put someone who wants to run the course: at the start, facing the line */
  get startPose(): { x: number; z: number; yaw: number } {
    const sp = this.layout.startPose;
    return { x: sp.x + this.layout.x, z: sp.z, yaw: sp.yaw };
  }

  // ---------- geometry ----------

  /** a collider, in course coordinates */
  private solid(minX: number, maxX: number, minZ: number, maxZ: number, base: number, top: number): void {
    RANGE_SOLIDS.push({ minX: minX + this.layout.x, maxX: maxX + this.layout.x, minZ, maxZ, top, base });
  }

  private builder(mats: THREE.Material[]): CourseBuilder {
    const L = this.layout;
    const roomMat = (z: number) => mats[Math.max(0, L.segments.findIndex((z0, i) => z >= z0 && z < L.segments[i + 1]))];
    const b: CourseBuilder = {
      x0: L.x0,
      x1: L.x1,
      wallH: L.wallH,
      box: (w, h, d, x, y, z, mat, solid = true) => {
        const m = new THREE.Mesh(bevel(w, h, d, 0.04), mat);
        m.position.set(x, y + h / 2, z);
        m.castShadow = true;
        m.receiveShadow = true;
        this.root.add(m);
        if (solid) this.solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
        return m;
      },
      solid: (minX, maxX, minZ, maxZ, base, top) => this.solid(minX, maxX, minZ, maxZ, base, top),
      ladder: (x, z, nx, nz, base, top) => buildLadder(this.root, x, z, nx, nz, base, top, L.x),
      zipline: (a, c, opts) => this.zipline(a, c, opts.vertical, opts.floorA ?? 0, opts.floorB ?? 0),
      hazardFloor: (minZ, maxZ, minX = L.x0, maxX = L.x1) => {
        const hz = hazardTexture("#d43a2f", "#1a1d21", 5);
        hz.repeat.set(Math.max(1, Math.round((maxX - minX) / 2)), Math.max(1, Math.round((maxZ - minZ) / 2)));
        const hzMat = new THREE.MeshStandardMaterial({ map: hz, emissiveMap: hz, emissive: 0xff3b2f, emissiveIntensity: 0.6, roughness: 0.8 });
        const hazard = new THREE.Mesh(new THREE.PlaneGeometry(maxX - minX, maxZ - minZ), hzMat);
        hazard.rotation.x = -Math.PI / 2;
        hazard.position.set((minX + maxX) / 2, 0.01, (minZ + maxZ) / 2);
        this.root.add(hazard);
      },
      glow: (w, h, d, x, y, z, color, intensity = 1.8) => {
        const g = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), emissive(color, intensity));
        g.position.set(x, y + h / 2, z);
        this.root.add(g);
      },
      add: (o) => this.root.add(o),
      roomMat,
      coverMat: flat(PAL.steelLight, 0.55, 0.12),
      platMat: flat(0x5a6470, 0.5, 0.15),
      flat: (color, roughness = 0.5, metalness = 0.15) => flat(color, roughness, metalness),
    };
    return b;
  }

  private build(): void {
    const L = this.layout;
    // "B00G" on every wall of the course, laid on in world space so one
    // material covers walls of any size at one scale
    const mats = L.themes.map((t) => worldTiledMaterial(graffitiTexture("B00G", t.wall), 4, 2));
    const b = this.builder(mats);

    // floor pad
    const floorMat = material("concrete", { color: 0xd8cbb0, roughness: 0.95, metalness: 0.02 });
    const padGeo = new THREE.PlaneGeometry(L.x1 - L.x0, L.farZ - 9);
    const uv = padGeo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * ((L.farZ - 9) / 4));
    uv.needsUpdate = true;
    const pad = new THREE.Mesh(padGeo, floorMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.004, (9 + L.farZ) / 2);
    pad.receiveShadow = true;
    this.root.add(pad);

    structure(L, b);
    // door trim in the colour of the room you are walking into, and the
    // room's name over the door, facing you as you come to it
    L.dividers.forEach((d, i) => {
      const [d0, d1] = d.door;
      const trim = flat(L.themes[i + 1].trim, 0.5, 0.2);
      for (const x of [d0, d1]) b.box(0.2, 3.3, 1.08, x, 0, d.z, trim, false);
      b.box(d1 - d0 + 0.2, 0.2, 1.08, (d0 + d1) / 2, 3.2, d.z, trim, false);
      this.panel(L.rooms[i].name, (d0 + d1) / 2, 4.2, d.z - 0.52, Math.PI, 3.4, 0.8);
    });
    warehouseRoof(this.root, {
      x0: L.x0 - 1,
      x1: L.x1 + 1,
      z0: 8,
      z1: L.farZ + 1,
      y: L.wallH,
      girders: L.girders,
      lights: L.lights,
      solid: (a, c, d, e, f, g) => this.solid(a, c, d, e, f, g),
    });
    this.tv();

    // start and finish lines
    this.line(L.startZ, 0x7ddc8a, "START");
    this.line(L.finishZ, 0xffd23c, "FINISH");

    L.build(b);

    // --- sign at the entrance, readable on the way IN
    this.panel(L.sign, L.x0 + 0.51, 2.6, 15.5, Math.PI / 2, 7, 3.6);

    // --- the tips, on each room's entry wall, facing into the room
    L.rooms.forEach((room) => this.panel(room.tip, room.tipX, 2.6, room.entryZ + 0.51, 0, 7, 3.2));

    // --- enemies, hidden until their room triggers. Dummies live in world
    // space, so they are placed at the course's offset.
    L.rooms.forEach((room, ri) => {
      const list: Dummy[] = [];
      for (const e of room.enemies) {
        const d = new Dummy(e.x + L.x, e.z, 0, { armed: e.gun, oneHit: true, respawn: false });
        d.group.position.y = e.y ?? 0;
        d.hide();
        this.scene.add(d.group);
        this.enemies.push(d);
        list.push(d);
        this.baseX.set(d, e.x + L.x);
        this.sway.set(d, e.sway ?? 0);
      }
      this.roomEnemies[ri] = list;
      this.roomTriggered[ri] = false;
    });
  }

  /**
   * The results TV on the wall by the start. After a run you are put back in
   * front of it: your time, rank, best, the splits against your best, and the
   * last few runs. Turn round and the start line is right there.
   */
  private tv(): void {
    const TV = this.layout.tv;
    const PX = 200;
    this.tvCanvas = document.createElement("canvas");
    this.tvCanvas.width = Math.round(TV.w * PX);
    this.tvCanvas.height = Math.round(TV.h * PX);
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas);
    this.tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tvTex.anisotropy = 8;
    const frame = new THREE.Mesh(bevel(TV.w + 0.24, TV.h + 0.24, 0.12, 0.04), flat(0x15181c, 0.4, 0.5));
    frame.position.set(TV.x, TV.y, TV.z + 0.02);
    this.root.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(TV.w, TV.h), new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false }));
    screen.position.set(TV.x, TV.y, TV.z + 0.09);
    screen.userData.dynamic = true;
    this.root.add(screen);
    this.drawTv();
    document.fonts?.load('700 40px "Rajdhani"').then(() => this.drawTv(), () => undefined);
  }

  private drawTv(): void {
    const MEDAL_COLOUR: Record<Medal, string> = { gold: "#ffd23c", silver: "#cfd8e0", bronze: "#d0803a" };
    const g = this.tvCanvas.getContext("2d")!;
    const W = this.tvCanvas.width;
    const H = this.tvCanvas.height;
    const font = (w: number, px: number) => `${w} ${px}px "Rajdhani", "Segoe UI", sans-serif`;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "#10161d");
    grad.addColorStop(1, "#0a0d11");
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#d4712a";
    g.fillRect(0, 0, W, 10);
    g.textBaseline = "alphabetic";
    g.fillStyle = "#ffd23c";
    g.font = font(700, 54);
    g.textAlign = "left";
    g.fillText(this.layout.title, 40, 76);
    g.fillStyle = "#9aa4ad";
    g.font = font(600, 30);
    g.textAlign = "right";
    g.fillText(this.best !== null ? `BEST ${this.best.toFixed(2)} s` : "NO BEST YET", W - 40, 72);
    const r = this.result;
    if (!r) {
      g.textAlign = "center";
      g.fillStyle = "#eef2f5";
      g.font = font(700, 54);
      g.fillText("TURN ROUND AND CROSS THE GREEN LINE", W / 2, H / 2);
      g.font = font(500, 34);
      g.fillStyle = "#9aa4ad";
      g.fillText("Your time, rank and splits show up here after every run.", W / 2, H / 2 + 60);
    } else {
      g.textAlign = "left";
      g.fillStyle = "#eef2f5";
      g.font = font(700, 150);
      g.fillText(r.time.toFixed(2), 40, 250);
      g.fillStyle = "#ffd23c";
      g.font = font(700, 130);
      g.fillText(r.rank, 520, 250);
      g.font = font(700, 36);
      g.fillStyle = r.newBest ? "#ffd23c" : "#9aa4ad";
      g.fillText(r.newBest ? "NEW PERSONAL BEST" : "LAST RUN", 44, 118 + 20);
      g.fillStyle = r.missed ? "#ff6a5a" : "#7ddc8a";
      g.font = font(600, 32);
      g.fillText(`${r.raw.toFixed(2)} s run` + (r.missed ? `, +${r.missed * PENALTY_MISS} s for ${r.missed} missed` : ", every enemy down"), 44, 300);
      g.fillStyle = "#9aa4ad";
      g.fillText(this.recent.length ? `RECENT  ${this.recent.map((t) => t.toFixed(2)).join("   ")}` : "", 44, 350);
      // splits: as many rows as fit
      const x0 = W * 0.56;
      const rowH = Math.min(44, (H - 190) / Math.max(1, r.splits.length));
      g.font = font(600, Math.min(30, rowH - 8));
      r.splits.forEach((sp, i) => {
        const y = 140 + i * rowH;
        g.fillStyle = "#9aa4ad";
        g.textAlign = "left";
        g.fillText(sp.name, x0, y);
        g.fillStyle = "#eef2f5";
        g.textAlign = "right";
        g.fillText(Number.isFinite(sp.time) ? sp.time.toFixed(2) : "-", x0 + 330, y);
        if (sp.medal !== undefined) {
          g.fillStyle = sp.medal ? MEDAL_COLOUR[sp.medal] : "#3a434c";
          g.beginPath();
          g.arc(x0 + 360, y - 9, 11, 0, Math.PI * 2);
          g.fill();
          if (sp.room !== undefined && Number.isFinite(sp.room)) {
            g.fillStyle = "#9aa4ad";
            g.textAlign = "left";
            g.font = font(600, Math.min(22, rowH - 12));
            g.fillText(`${sp.room.toFixed(1)}/${sp.par?.toFixed(1)}`, x0 + 380, y);
            g.font = font(600, Math.min(30, rowH - 8));
          }
        }
        if (sp.delta !== null) {
          g.fillStyle = sp.delta <= 0 ? "#7ddc8a" : "#ff6a5a";
          g.fillText(`${sp.delta <= 0 ? "-" : "+"}${Math.abs(sp.delta).toFixed(2)}`, W - 40, y);
        }
      });
    }
    g.textAlign = "center";
    g.fillStyle = "#6f7a85";
    g.font = font(600, 28);
    g.fillText("Turn round: the start line is behind you.  Y resets.  P copies your result.  K toggles the ghost.", W / 2, H - 28);
    this.tvTex.needsUpdate = true;
  }

  /**
   * A zipline between two points where your hands hold it. Yellow rope, a
   * plate and cable at each end; the rope continues 0.6 m past each end of
   * the ride to its anchor, so you are thrown off before the anchor.
   */
  private zipline(a: THREE.Vector3, b: THREE.Vector3, vertical: boolean, floorA: number, floorB: number): void {
    const WALL_H = this.layout.wallH;
    const ropeMat = emissive(0xffc21a, 0.55);
    const dir = new THREE.Vector3().subVectors(b, a).normalize();
    const ra = vertical ? new THREE.Vector3(a.x, floorA, a.z) : a.clone().addScaledVector(dir, -0.6);
    const rb = vertical ? new THREE.Vector3(b.x, WALL_H - 0.4, b.z) : b.clone().addScaledVector(dir, 0.6);
    const len = ra.distanceTo(rb);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), ropeMat);
    rope.position.copy(ra).lerp(rb, 0.5);
    rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(rb, ra).normalize());
    this.root.add(rope);
    const poleMat = flat(PAL.steelDark, 0.55, 0.3);
    const cap = flat(PAL.hazard, 0.5, 0.3);
    if (vertical) {
      // floor plate and a roof bracket
      const plate = new THREE.Mesh(bevel(0.6, 0.12, 0.6, 0.03), cap);
      plate.position.set(a.x, floorA + 0.06, a.z);
      this.root.add(plate);
      const bracket = new THREE.Mesh(bevel(0.5, 0.4, 0.5, 0.04), poleMat);
      bracket.position.set(b.x, WALL_H - 0.4, b.z);
      this.root.add(bracket);
    } else {
      // an anchor post at each end: from the floor under it to just above the rope
      for (const [p, floor] of [
        [ra, floorA],
        [rb, floorB],
      ] as const) {
        const h = p.y + 0.35 - floor;
        const post = new THREE.Mesh(bevel(0.22, h, 0.22, 0.04), poleMat);
        post.position.set(p.x, floor + h / 2, p.z);
        post.castShadow = true;
        this.root.add(post);
        const head = new THREE.Mesh(bevel(0.34, 0.2, 0.34, 0.04), cap);
        head.position.set(p.x, p.y + 0.12, p.z);
        this.root.add(head);
      }
    }
    ZIPLINES.push({
      a: new THREE.Vector3(a.x + this.layout.x, a.y, a.z),
      b: new THREE.Vector3(b.x + this.layout.x, b.y, b.z),
    });
  }

  private line(z: number, color: number, label: string): void {
    const { x0, x1 } = this.layout;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, 0.5), emissive(color, 1.6));
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.015, z);
    this.root.add(m);
    // posts either side with the label
    for (const x of [x0 + 0.4, x1 - 0.4]) {
      const post = new THREE.Mesh(bevel(0.3, 2.6, 0.3, 0.05), emissive(color, 1.2));
      post.position.set(x, 1.3, z);
      this.root.add(post);
    }
    this.panel(label, 0, 3.4, z, Math.PI, 3, 0.8, true);
  }

  /**
   * A text panel. Unlit so it reads in shade, single-sided so it only shows
   * from the side it faces. `rotY` 0 faces +z (into a room from its entry
   * wall), PI faces -z.
   */
  private panel(text: string, x: number, y: number, z: number, rotY: number, w: number, h: number, doubleSided = false): void {
    this.root.add(textPanel(text, x, y, z, rotY, w, h, doubleSided));
  }

  // ---------- run ----------

  /** hide every enemy and clear the run */
  reset(): void {
    this.returnAt = Infinity;
    for (const d of this.enemies) d.hide();
    this.roomTriggered.fill(false);
    if (this.running) {
      this.running = false;
      this.onRunChange?.(false);
    }
    this.penalties = 0;
  }

  /** another mode: the run and its result card go (the card and P/K would follow you there) */
  leave(): void {
    this.reset();
    this.result = null;
  }

  /**
   * The menu is up: the clock stands still. Every time the run keeps is
   * measured from `startedAt`, so moving it on by the paused frame stops the
   * clock, the ghost and the recording together; the return to the start and
   * the result card wait too.
   */
  pause(dt: number): void {
    if (this.running) this.startedAt += dt;
    if (this.returnAt !== Infinity) this.returnAt += dt;
    if (this.result) this.resultUntil += dt;
  }

  private start(now: number): void {
    this.reset();
    this.running = true;
    this.startedAt = now;
    this.result = null;
    this.splits = [];
    this.lastSplit = null;
    this.rec = [];
    this.recNext = 0;
    this.onRunChange?.(true);
  }

  /** turn the ghost on or off; returns the new state */
  toggleGhost(): boolean {
    this.ghostOn = !this.ghostOn;
    try {
      localStorage.setItem(this.keys.ghostOn, this.ghostOn ? "1" : "0");
    } catch {
      /* ignore */
    }
    return this.ghostOn;
  }

  get hasGhost(): boolean {
    return this.ghost !== null;
  }

  private finish(now: number): void {
    const L = this.layout;
    const raw = now - this.startedAt;
    const missed = this.enemies.filter((d) => !d.knocked).length;
    const time = raw + this.penalties + missed * PENALTY_MISS;
    const rank = L.ranks.find(([, t]) => time <= t)![0];
    const newBest = this.best === null || time < this.best;
    const splits: CourseSplit[] = L.rooms.map((room, i) => {
      const t = this.splits[i] ?? NaN;
      const b = this.bestSplits?.[i];
      return { name: room.name, time: t, delta: b !== undefined && Number.isFinite(b) && Number.isFinite(t) ? t - b : null };
    });
    // each room's own time against its par: a medal a room. The last room runs
    // to the clock at the line: the missed-enemy penalty is the run's, not the room's
    const pars = roomPars(L);
    const atLine = raw + this.penalties;
    splits.forEach((sp, i) => {
      const next = i + 1 < splits.length ? splits[i + 1].time : atLine;
      const inRoom = Number.isFinite(sp.time) && Number.isFinite(next) ? next - sp.time : NaN;
      sp.room = inRoom;
      sp.par = pars[i];
      sp.medal = medalFor(inRoom, pars[i]);
    });
    const bFinish = this.bestSplits?.[L.rooms.length];
    splits.push({ name: "FINISH", time, delta: bFinish !== undefined && Number.isFinite(bFinish) ? time - bFinish : null });
    if (newBest) {
      this.best = time;
      this.bestSplits = splits.map((sp) => sp.time);
      this.ghost = { dt: GHOST_DT, data: this.rec.slice() };
      try {
        localStorage.setItem(this.keys.best, String(time));
        localStorage.setItem(this.keys.splits, JSON.stringify(this.bestSplits.map((t) => (Number.isFinite(t) ? Number(t.toFixed(3)) : null))));
        localStorage.setItem(this.keys.ghost, JSON.stringify(this.ghost));
      } catch {
        /* ignore */
      }
    }
    this.result = { time, raw, missed, rank, newBest, splits };
    this.recent = [time, ...this.recent].slice(0, 5);
    try {
      localStorage.setItem(this.keys.recent, JSON.stringify(this.recent.map((t) => Number(t.toFixed(3)))));
    } catch {
      /* ignore */
    }
    this.drawTv();
    // a moment to see the finish, then back to the start facing the TV
    this.returnAt = now + 1.5;
    this.resultUntil = now + 10;
    this.running = false;
    this.onRunChange?.(false);
    this.onFinish?.(this.result);
  }

  /** a line you can paste to your friends */
  shareText(): string | null {
    const r = this.result;
    if (!r) return null;
    return `${this.layout.title}: ${r.time.toFixed(2)} s, rank ${r.rank}` + (r.missed ? ` (${r.missed} missed)` : ", all enemies down") + (this.best !== null ? `. Best ${this.best.toFixed(2)} s` : "");
  }

  update(now: number, dt: number, p: CoursePlayer): void {
    const L = this.layout;
    const x = p.pos.x - L.x;
    const { y, z } = p.pos;
    const insideX = x > L.x0 && x < L.x1;
    this.inCompound = insideX && z > 9 && z < L.farZ;

    // start line crossed going forward (re)starts the run
    if (insideX && this.lastZ < L.startZ && z >= L.startZ) this.start(now);
    // walking back out through the gate abandons it; so does a run left going
    // for ten minutes (its ghost recording would be too big to keep)
    if (this.running && (z < 9 || !insideX || now - this.startedAt > MAX_RUN)) this.reset();

    if (this.running) {
      L.rooms.forEach((room, ri) => {
        if (!this.roomTriggered[ri] && room.trigger(x, y, z)) {
          this.roomTriggered[ri] = true;
          for (const d of this.roomEnemies[ri]) d.popUp();
          // split: the clock on entering the room, against the best run's
          const t = now - this.startedAt + this.penalties;
          this.splits[ri] = t;
          const b = this.bestSplits?.[ri];
          this.lastSplit = { name: room.name, time: t, delta: b !== undefined && Number.isFinite(b) ? t - b : null, at: now };
        }
      });
      // record this run for the ghost, 30 samples a second
      const since = now - this.startedAt;
      while (since >= this.recNext) {
        this.rec.push(Number(p.pos.x.toFixed(2)), Number(p.pos.y.toFixed(2)), Number(p.pos.z.toFixed(2)), Number(p.yaw.toFixed(1)));
        this.recNext += GHOST_DT;
      }
      // a hazard: fall in and you are back at its room's entrance, 2 s down
      for (const hz of L.hazards) {
        if (z > hz.minZ && z < hz.maxZ && y < hz.fallY) {
          p.teleport(hz.respawn.x + L.x, hz.respawn.y, hz.respawn.z, 180);
          this.penalties += PENALTY_FALL;
          this.onNotice?.(`FELL  +${PENALTY_FALL} s`);
          break;
        }
      }
      if (insideX && this.lastZ < L.finishZ && z >= L.finishZ) this.finish(now);
    }
    // back to the start after a finish, facing the results TV
    if (now >= this.returnAt) {
      this.returnAt = Infinity;
      const r = L.returnTo;
      p.teleport(r.x + L.x, 0, r.z, r.yaw, r.pitch);
      this.lastZ = r.z;
    } else this.lastZ = z;

    // enemies turn to keep their guns on you, and some sway
    for (const d of this.enemies) {
      if (!d.group.visible) continue;
      if (!d.knocked) {
        const want = Math.atan2(p.pos.x - d.group.position.x, z - d.group.position.z);
        let diff = want - d.group.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        d.group.rotation.y += diff * Math.min(1, dt * 8);
        const amp = this.sway.get(d) ?? 0;
        if (amp > 0) d.group.position.x = (this.baseX.get(d) ?? 0) + Math.sin(now * 2.2 + (this.baseX.get(d) ?? 0)) * amp;
      }
      d.update(now, dt);
    }
    if (this.result && now > this.resultUntil) this.result = null;
    this.updateGhost(now);
  }

  /** place the ghost where your best run was at this point in the clock */
  private updateGhost(now: number): void {
    const g = this.ghost;
    const fig = this.ghostFig;
    if (!g || !this.ghostOn || !this.running) {
      fig.visible = false;
      return;
    }
    const n = g.data.length / 4;
    const f = (now - this.startedAt) / g.dt;
    const i = Math.floor(f);
    if (i >= n - 1) {
      fig.visible = false;
      return;
    }
    const k = f - i;
    const a = i * 4;
    const b = a + 4;
    const d = g.data;
    fig.visible = true;
    fig.position.set(d[a] + (d[b] - d[a]) * k, d[a + 1] + (d[b + 1] - d[a + 1]) * k, d[a + 2] + (d[b + 2] - d[a + 2]) * k);
    let dy = d[b + 3] - d[a + 3];
    dy = ((dy + 540) % 360) - 180;
    fig.rotation.y = ((d[a + 3] + dy * k) * Math.PI) / 180;
  }

  /** what the HUD shows, or null when you are nowhere near the course */
  hud(now: number): {
    title: string;
    running: boolean;
    time: number;
    enemiesLeft: number;
    enemiesTotal: number;
    best: number | null;
    result: CourseResult | null;
    banner: string | null;
    split: CourseSplit | null;
  } | null {
    if (!this.inCompound && !this.running && !this.result) return null;
    return {
      title: this.layout.title,
      split: this.running && this.lastSplit && now - this.lastSplit.at < 3 ? this.lastSplit : null,
      running: this.running,
      time: this.running ? now - this.startedAt + this.penalties : 0,
      enemiesLeft: this.enemies.filter((d) => d.group.visible && !d.knocked).length + this.untriggeredCount(),
      enemiesTotal: this.enemies.length,
      best: this.best,
      result: this.result,
      banner: this.inCompound ? `${this.layout.title}: cross the green line to start` : null,
    };
  }

  private untriggeredCount(): number {
    let n = 0;
    this.roomTriggered.forEach((t, i) => {
      if (!t) n += this.roomEnemies[i].length;
    });
    return n;
  }
}

/**
 * The ghost: a see-through figure of your best run, with a visor so you can
 * tell which way it faces. Drawn without depth writes so it never hides a
 * target behind it.
 */
function ghostFigure(): THREE.Group {
  const mat = new THREE.MeshBasicMaterial({ color: 0x7fe8ff, transparent: true, opacity: 0.3, depthWrite: false });
  const g = new THREE.Group();
  g.name = "ghost";
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.95, 4, 12), mat);
  body.position.y = 0.26 + 0.475 + 0.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 14, 10), mat);
  head.position.y = 1.66;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.08), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false }));
  visor.position.set(0, 1.68, -0.13);
  g.add(body, head, visor);
  return g;
}
