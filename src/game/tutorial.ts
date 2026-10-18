// The tutorial's steps (Milestone 633, docs/PLAN_TUTORIAL.md): a step a room of THE TUTORIAL course
// (src/game/courses/tutorial.ts), on a panel at the top twice the size the old guided tour's was (the owner, 2026-10-17:
// "make sure the instructions are blatantly obvious near the top, like at least twice as big as they are now on the
// 'Tour'"). The guided tour itself went in Milestone 637: the tutorial teaches what it did.
//
// Each room's door stays shut until the room before it is done (the owner: "they shouldn't be able to advance through
// the tutorial if they don't perform the moves"), the hacks stay off until the dash room and the guns put away until
// the ANAKIN is handed over; hold interact to skip a room, and a room you are stuck in (three falls,
// or a minute in it) says how. The page does what a step hands over (main.ts: the dash, the ANAKIN, and both back
// afterwards); the course does the rest (its pits put you back at their door, its soldiers stand up as you climb to
// them). The steps only watch, and open doors.
//
// It starts when you are in its start room behind the right-hand gate (the start screen's Tutorial puts you there), is
// over when you walk out of its last door into the range, and is put back to its first room when you leave it.
import * as THREE from "three";
import type { Course } from "./course";
import type { Dummy } from "./dummy";
import { RANGE_SOLIDS, type Solid } from "./range";
import { emissive, flat } from "./geo";
import { TUTORIAL_COURSE, TUTORIAL_X, DIVIDERS, MOVE_ROOM, JUMP, DOUBLE, MANTLE, WALLRUN, DASH, HIGH, CLIMB, GLIDE, EXIT, OUT, BACK, DECK, RUN_WALL_X, inOut, inBack, type Ledge } from "./courses/tutorial";

/** the panel at the top of the screen: the room, what to do, the skip bar, the marker; or the finish card (hud.ts) */
export interface TutorialHud {
  step: number;
  of: number;
  title: string;
  text: string;
  /** the marker to go to, if the step has one and you are not there yet */
  marker: THREE.Vector3 | null;
  /** 0..1 of the skip hold */
  skip: number;
  /** the finish card, for a few seconds */
  done: boolean;
  /** what the panel calls it */
  label: string;
  /** the panel's size against its base one (the owner asked twice the old guided tour's) */
  size: number;
}

/** what the steps read of the game each frame */
export interface TutorialCheck {
  pos: THREE.Vector3;
  onGround: boolean;
}

interface StepState {
  since: number;
  falls: number;
}

interface Step {
  title: string;
  /** what to do; {action} is that action's key */
  text: string;
  done: (c: TutorialCheck, figs: readonly Dummy[]) => boolean;
  /** what it says once you have fallen in a few times, or been a minute in it */
  stuck?: string;
  /**
   * Where to go now you are in its room: the marker and the beacon stand there (the owner's playtest, 2026-10-18:
   * "anything should be like painfully obvious where to go with no guesses"). Null where the room's own targets say it.
   */
  goal?: (c: TutorialCheck) => THREE.Vector3 | null;
}

const OX = (OUT.x0 + OUT.x1) / 2;
const BX = (BACK.x0 + BACK.x1) / 2;
const at = (x: number, y: number, z: number) => new THREE.Vector3(TUTORIAL_X + x, y, z);
const mid = (l: { z0: number; z1: number }) => (l.z0 + l.z1) / 2;
/** a door's middle on the floor */
const doorAt = (d: { door: [number, number]; z: number }) => at((d.door[0] + d.door[1]) / 2, 0, d.z);
const exitAt = () => at((EXIT.x0 + EXIT.x1) / 2, 0, EXIT.z);
/** the superglide's lane, beside the optional bridge */
const LANE_X = (BACK.x0 + GLIDE.laneX1) / 2;

/** on a ledge's top, or past it the way the room runs */
const onOrPast = (l: Ledge, inBay: (x: number) => boolean) => (c: TutorialCheck) => {
  if (!inBay(c.pos.x)) return false;
  const out = l.z1 > l.z0;
  const past = out ? c.pos.z > l.z1 : c.pos.z < l.z1;
  const over = out ? c.pos.z > l.z0 - 0.2 : c.pos.z < l.z0 + 0.2;
  return past || (over && c.pos.y > l.top - 0.3);
};
const allDown = (figs: readonly Dummy[]) => figs.length > 0 && figs.every((d) => d.knocked);

const STEPS: Step[] = [
  {
    title: "MOVE",
    text: "Walk forward to the door with {forward}. The mouse looks around. You always run: there is no walking.",
    done: (c) => inOut(c.pos.x) && c.pos.z > MOVE_ROOM.exitZ - 3,
    goal: () => doorAt(DIVIDERS[1]),
  },
  {
    title: "JUMP",
    text: "Press {jump} to jump up onto the ledge.",
    done: onOrPast(JUMP.ledge, inOut),
    goal: () => at(OX, JUMP.ledge.top, mid(JUMP.ledge)),
  },
  {
    title: "DOUBLE JUMP",
    text: "Too high for one jump. Press {jump}, then {jump} again in the air: a double jump.",
    done: onOrPast(DOUBLE.ledge, inOut),
    stuck: "Jump close to the ledge, then jump again near the top of the first jump.",
    goal: () => at(OX, DOUBLE.ledge.top, mid(DOUBLE.ledge)),
  },
  {
    title: "MANTLE",
    text: "That grab at the top was a MANTLE: jump at a ledge in reach and you pull yourself up. Double jump over the pit and mantle onto the ledge.",
    done: onOrPast({ z0: MANTLE.b0, z1: MANTLE.b1, top: MANTLE.top }, inOut),
    stuck: "Jump at the pit's edge, double jump as you start to fall, and keep {forward} held into the ledge.",
    goal: () => at(OX, MANTLE.top, (MANTLE.b0 + MANTLE.b1) / 2),
  },
  {
    title: "WALL RUN",
    text: "Too far for any jump. Run up the deck along the lit line, right beside the lit wall on your left, jump at the end and keep {forward} held: you run along the wall, for up to 3 s.",
    done: (c) => inOut(c.pos.x) && c.pos.z > WALLRUN.b0,
    stuck: "Get right up against the lit wall on the deck (the lit line), jump at its end, and keep {forward} held.",
    // the take-off beside the lit wall at the deck's end, until you are off it; then the landing past the pit
    goal: (c) => (c.pos.z < WALLRUN.a1 - 1.5 && c.pos.y < DECK + 0.6 ? at(RUN_WALL_X - 0.7, DECK, WALLRUN.a1 - 1) : at(OX, DECK, WALLRUN.b0 + 4)),
  },
  {
    title: "DASH",
    text: "Your hacks are on. {ability} is DASH: a 26 m jump the way you look. Double jump off the edge, then dash at the ledge. These walls cannot be run on.",
    done: onOrPast({ z0: DASH.b0, z1: DASH.b1, top: DASH.top }, inBack),
    stuck: "Double jump first, then dash at the top of it: from a jump alone the dash leaves you under the ledge's top. Fall in and your dash is back at once.",
    goal: () => at(BX, DASH.top, (DASH.b0 + DASH.b1) / 2),
  },
  {
    title: "HIGH GROUND",
    text: "Your gun: the ANAKIN. Double jump up onto the platform and shoot the two soldiers with {fire}. {ads} aims. They have 50 health.",
    done: (_c, figs) => allDown(figs),
    // up on the platform; from there its soldiers are the targets
    goal: (c) => (c.pos.y < HIGH.ledge.top - 0.3 ? at(BX, HIGH.ledge.top, mid(HIGH.ledge)) : null),
  },
  {
    title: "CLIMB",
    text: "Run at the wall and keep holding {forward}: you climb it. Shoot the two soldiers from the top.",
    done: (_c, figs) => allDown(figs),
    goal: (c) => (c.pos.y < CLIMB.ledge.top - 0.3 ? at(BX, CLIMB.ledge.top, mid(CLIMB.ledge)) : null),
  },
  {
    title: "SUPERGLIDE",
    text: "Last, the hard one. Jump at the ledge, and as you pull yourself up press {jump}, then {crouch} a frame later. Or take the bridge on your right: it is optional.",
    done: (c) => inBack(c.pos.x) && c.pos.z < GLIDE.b0,
    stuck: "Hard to time? Settings, Mantle boost: On, then hold {jump} through the climb up. Or take the bridge on the right.",
    // the ledge to jump at, then the landing past the gap
    goal: (c) => (c.pos.z > GLIDE.edge ? at(LANE_X, GLIDE.h, GLIDE.face - 0.3) : at(LANE_X, GLIDE.h, GLIDE.b0 - 3)),
  },
  {
    title: "OUT",
    text: "That is the tutorial. Walk out through the door into the firing range: every gun and every hack is on the stands there.",
    done: (c) => c.pos.z < EXIT.z - 0.4 && c.pos.x > EXIT.x0 - 1 && c.pos.x < EXIT.x1 + 1,
    goal: exitAt,
  },
];
/** the room your hacks come on in (DASH), and the one your gun does (the ANAKIN's) */
export const DASH_STEP = STEPS.findIndex((s) => s.title === "DASH");
export const GUN_STEP = STEPS.findIndex((s) => s.title === "HIGH GROUND");

const SKIP_HOLD = 1.2;
/** a room this long, or this many falls in it, says what to change and how to skip it */
const STUCK_AFTER = 60;
const STUCK_FALLS = 3;
/** the finish card, seconds */
const CARD = 10;
const DOOR_OPEN = 0.6;
/** the panel's size against its base one */
const PANEL_SIZE = 2;
/** the beacon's column of light, metres: over a 5.5 m ledge and still under the 15 m roof */
const BEAM_H = 9;

interface TutorialDoor {
  mesh: THREE.Mesh;
  light: THREE.Mesh;
  solid: Solid;
  h: number;
  /** when it began to open, or null shut */
  openedAt: number | null;
}

export class Tutorial {
  private index = -1;
  private state: StepState = { since: 0, falls: 0 };
  private skipFrom = -Infinity;
  private doneAt = -Infinity;
  private readonly doors: TutorialDoor[] = [];
  private readonly shutMat = emissive(0xff3b2f, 1.4);
  private readonly openMat = emissive(0x7ddc8a, 1.4);
  /** a step began (its index): the page hands over what it needs, the dash and the ANAKIN */
  onStep: ((title: string, index: number) => void) | null = null;
  onDoor: ((at: THREE.Vector3) => void) | null = null;
  onDone: (() => void) | null = null;
  /** back to before the first room: the page gives back what it lent */
  onReset: (() => void) | null = null;
  /** a room skipped: the page puts you at the next one's start (roomStart), as if you had come through its door */
  onSkip: ((x: number, y: number, z: number, yaw: number) => void) | null = null;
  /**
   * The beacon over where to go: a column of light, a ring on the floor and an arrow bobbing over it, with the HUD's
   * marker (the owner's playtest, 2026-10-18: "the waypoints need to be more obvious when used")
   */
  private readonly beacon = new THREE.Group();
  private readonly beaconArrow: THREE.Mesh;
  private readonly beaconRing: THREE.Mesh;

  constructor(
    scene: THREE.Scene,
    private readonly course: Course
  ) {
    // a door in every doorway but the first, and the way out: a panel and its collider, shut, which slide up into the
    // lintel to open
    const panel = flat(0x1b222c, 0.5, 0.4);
    const ways = DIVIDERS.slice(1).map((d) => ({ x0: d.door[0], x1: d.door[1], z: d.z, h: 3.3, t: 0.5 }));
    ways.push({ x0: EXIT.x0, x1: EXIT.x1, z: EXIT.z, h: EXIT.h, t: 1 });
    for (const w of ways) {
      const width = w.x1 - w.x0;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, w.h, 0.2), panel);
      mesh.position.set(TUTORIAL_X + (w.x0 + w.x1) / 2, w.h / 2, w.z);
      mesh.castShadow = true;
      const light = new THREE.Mesh(new THREE.BoxGeometry(width * 0.8, 0.12, 0.26), this.shutMat);
      light.position.y = 0.4 - w.h / 2;
      mesh.add(light);
      scene.add(mesh);
      const solid: Solid = { minX: TUTORIAL_X + w.x0, maxX: TUTORIAL_X + w.x1, minZ: w.z - w.t / 2, maxZ: w.z + w.t / 2, base: 0, top: w.h, door: true };
      RANGE_SOLIDS.push(solid);
      this.doors.push({ mesh, light, solid, h: w.h, openedAt: null });
    }
    const glow = (opacity: number) => new THREE.MeshBasicMaterial({ color: 0x7ddc8a, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, BEAM_H, 16, 1, true), glow(0.32));
    beam.position.y = BEAM_H / 2;
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(0.75, 1.05, 40), glow(0.85));
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.05;
    this.beaconArrow = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.9, 4), glow(0.95));
    this.beaconArrow.rotation.x = Math.PI;
    this.beacon.add(beam, this.beaconRing, this.beaconArrow);
    this.beacon.visible = false;
    this.beacon.userData.dynamic = true;
    this.beacon.traverse((o) => (o.userData.dynamic = true));
    scene.add(this.beacon);
  }

  /**
   * Where the room after step `index` starts, as its door is come through: just inside it, facing in; past the
   * superglide, its landing deck; past the last, out in the range. What a skip puts you at (onSkip).
   */
  roomStart(index: number): { x: number; y: number; z: number; yaw: number } {
    const next = index + 1;
    if (next >= STEPS.length) return { x: TUTORIAL_X + (EXIT.x0 + EXIT.x1) / 2, y: 0, z: EXIT.z - 1.5, yaw: 0 };
    if (next === STEPS.length - 1) return { x: TUTORIAL_X + LANE_X, y: GLIDE.h, z: GLIDE.b0 - 2, yaw: 0 };
    const d = DIVIDERS[next];
    const back = d.facing === -1;
    return { x: TUTORIAL_X + (d.door[0] + d.door[1]) / 2, y: 0, z: d.z + (back ? -0.9 : 0.9), yaw: back ? 0 : 180 };
  }

  get active(): boolean {
    return this.index >= 0;
  }

  /** the step in hand's title, or null */
  get stepTitle(): string | null {
    return this.active ? STEPS[this.index].title : null;
  }

  /** the step in hand, or -1 */
  get step(): number {
    return this.index;
  }

  /** your hacks stay off until the dash room */
  get hacksLocked(): boolean {
    return this.active && this.index < DASH_STEP;
  }

  /** and your guns put away until the ANAKIN is handed over */
  get gunsLocked(): boolean {
    return this.active && this.index < GUN_STEP;
  }

  /** from the first room, every door shut and the rooms' soldiers down again (the start screen's Tutorial) */
  restart(now: number): void {
    this.reset();
    this.index = 0;
    this.begin(now);
  }

  /** out of it: back to before the first room */
  reset(): void {
    const was = this.active || this.doors.some((d) => d.openedAt !== null);
    this.index = -1;
    this.skipFrom = -Infinity;
    for (const d of this.doors) {
      d.openedAt = null;
      d.solid.base = 0;
      d.solid.top = d.h;
      d.mesh.position.y = d.h / 2;
      d.mesh.visible = true;
      d.light.material = this.shutMat;
    }
    this.course.reset();
    if (was) this.onReset?.();
  }

  /** a fall into one of the course's pits (Course.onFall) */
  onFall(): void {
    if (this.active) this.state.falls++;
  }

  private begin(now: number): void {
    this.state = { since: now, falls: 0 };
    this.skipFrom = -Infinity;
    this.onStep?.(STEPS[this.index].title, this.index);
  }

  /** the step's room is done: its way on opens, and the next step begins */
  private next(now: number): void {
    const door = this.doors[this.index];
    if (door && door.openedAt === null) {
      door.openedAt = now;
      door.light.material = this.openMat;
      this.onDoor?.(door.mesh.position.clone());
    }
    this.index++;
    if (this.index >= STEPS.length) {
      this.index = -1;
      this.doneAt = now;
      this.onDone?.();
      return;
    }
    this.begin(now);
  }

  /** inside the course's walls */
  private inside(p: THREE.Vector3): boolean {
    return p.x > BACK.x0 && p.x < OUT.x1 && p.z > 9 && p.z < TUTORIAL_COURSE.farZ;
  }

  /** through its door into the step's room yet */
  private entered(c: TutorialCheck): boolean {
    const d = DIVIDERS[this.index];
    if (!d) return true;
    const bay = d.facing === -1 ? inBack : inOut;
    return bay(c.pos.x) && (d.facing === -1 ? c.pos.z < d.z - 0.7 : c.pos.z > d.z + 0.7);
  }

  /** one frame: start, the doors, the check, the skip hold; `keys` fills in the key names */
  update(now: number, c: TutorialCheck, skipHeld: boolean, keys: (action: string) => string): TutorialHud | null {
    for (const d of this.doors) {
      if (d.openedAt === null || !d.mesh.visible) continue;
      const k = Math.min(1, (now - d.openedAt) / DOOR_OPEN);
      d.mesh.position.y = d.h / 2 + d.h * k * k;
      if (k >= 1) {
        // up into the lintel, where the wall already is: it takes nothing of the doorway
        d.solid.base = d.h;
        d.solid.top = d.h + 0.3;
        d.mesh.visible = false;
      }
    }
    const inside = this.inside(c.pos);
    if (this.active) {
      const step = STEPS[this.index];
      // (before the walls: the last step is done by walking out of them)
      if (step.done(c, this.course.roomFigures(this.index))) {
        this.next(now);
        return this.update(now, c, false, keys);
      }
      if (!inside) {
        this.reset();
        return null;
      }
    } else if (inside && inOut(c.pos.x) && c.pos.z < MOVE_ROOM.entryZ && now - this.doneAt > 1) {
      // in its start room: the first room
      this.restart(now);
    } else if (!inside && this.doors.some((d) => d.openedAt !== null)) {
      this.reset();
    }
    if (!this.active) {
      this.showBeacon(null, now);
      if (now - this.doneAt < CARD) {
        return {
          step: STEPS.length,
          of: STEPS.length,
          title: "TUTORIAL COMPLETE",
          text: "Every gun and hack is on the stands here: try them on the dummies. Then Battle Royale, from the start screen: a squad of two, the city decays sector by sector, and your first death sends you to the Gulag to win your way back.",
          marker: null,
          skip: 0,
          done: true,
          label: "TUTORIAL",
          size: PANEL_SIZE,
        };
      }
      return null;
    }
    const step = STEPS[this.index];
    const s = this.state;
    if (skipHeld) {
      if (!Number.isFinite(this.skipFrom)) this.skipFrom = now;
      if (now - this.skipFrom >= SKIP_HOLD) {
        // into the next room, not left where you were stuck (the owner's playtest: a skip of the wall run left you
        // on its side of the pit)
        const to = this.roomStart(this.index);
        this.next(now);
        this.onSkip?.(to.x, to.y, to.z, to.yaw);
        return this.update(now, c, false, keys);
      }
    } else this.skipFrom = -Infinity;
    // the way in, until you are through it; then the room's goal
    let marker: THREE.Vector3 | null = null;
    if (!this.entered(c)) marker = doorAt(DIVIDERS[this.index]);
    else marker = step.goal?.(c) ?? null;
    this.showBeacon(marker, now);
    const fill = (t: string) => t.replace(/\{(\w+)\}/g, (_m, a: string) => keys(a));
    let text = fill(step.text);
    const stuck = s.falls >= STUCK_FALLS || now - s.since > STUCK_AFTER;
    if (stuck) text = `${step.stuck ? fill(step.stuck) : text}  Stuck? Hold ${keys("interact")} to skip this room.`;
    return {
      step: this.index + 1,
      of: STEPS.length,
      title: step.title,
      text,
      marker,
      skip: Number.isFinite(this.skipFrom) ? Math.min(1, (now - this.skipFrom) / SKIP_HOLD) : 0,
      done: false,
      label: "TUTORIAL",
      size: PANEL_SIZE,
    };
  }

  /** the beacon at the marker, its arrow bobbing and its ring breathing; hidden with none */
  private showBeacon(marker: THREE.Vector3 | null, now: number): void {
    this.beacon.visible = marker !== null;
    if (!marker) return;
    this.beacon.position.copy(marker);
    this.beaconArrow.position.y = 2.4 + 0.3 * Math.sin(now * 4);
    const k = 1 + 0.15 * Math.sin(now * 3);
    this.beaconRing.scale.set(k, k, 1);
  }
}
