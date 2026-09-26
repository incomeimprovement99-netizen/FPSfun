// The guided tour of the range (the Play tab's "Guided tour"): a step at a
// time, each with a marker to walk to where it has one, a line of what to do
// and the keys, and it moves on when the game sees you do it. Hold the
// interact key to skip a step (the superglide takes practice).
//
// The steps read the game's own state through `TourCheck`: the movement's
// flags (sprinting, sliding, a mantle, a climb), the tech feed (a
// superglide), the gun (a hit, a reload, a swap), a heal, the ability, a
// throw. Nothing here moves you: the tour only watches.
import * as THREE from "three";

export interface TourCheck {
  pos: THREE.Vector3;
  sprinting: boolean;
  sliding: boolean;
  onGround: boolean;
  vy: number;
  mantling: boolean;
  climbing: boolean;
  hits: number;
  reloading: boolean;
  swapping: boolean;
  healing: boolean;
  joltUsed: boolean;
  thrown: number;
}

interface Step {
  id: string;
  title: string;
  /** what to do, with {key} names filled in by the caller's key labels */
  text: string;
  /** a marker to go to first (world space); the step's action counts once you are there */
  at?: [number, number];
  /** within this of the marker counts as there */
  reach?: number;
  /** the action: the check is true this frame */
  done: (c: TourCheck, s: StepState) => boolean;
}

interface StepState {
  /** the counters when the step began (hits, throws) */
  hits0: number;
  thrown0: number;
  /** the marker has been reached */
  there: boolean;
  /** a tech name the feed reported during the step */
  tech: Set<string>;
  sprinted: boolean;
}

const STEPS: Step[] = [
  { id: "move", title: "MOVE", text: "Walk to the marker with {forward} {left} {back} {right}.", at: [0, -8], reach: 1.6, done: (_c, s) => s.there },
  { id: "sprint", title: "SPRINT", text: "Hold {sprint} and run to the next marker.", at: [-6, -13], reach: 1.8, done: (c, s) => s.there && (s.sprinted || c.sprinting) },
  { id: "slide", title: "SLIDE", text: "Sprint at the low rail and press {crouch} to slide under it.", at: [0, -22], reach: 3.5, done: (c) => c.sliding },
  { id: "jump", title: "JUMP", text: "Press {jump}.", done: (c) => !c.onGround && c.vy > 2 },
  { id: "mantle", title: "MANTLE", text: "Run at the ledge, jump and hold {forward}: you pull yourself up.", at: [-25.5, -58], reach: 2.2, done: (c) => c.mantling },
  { id: "climb", title: "CLIMB", text: "Run at the ladder's wall and hold {forward} and {jump}: you climb it.", at: [14.8, -46], reach: 2.5, done: (c) => c.climbing },
  { id: "superglide", title: "SUPERGLIDE", text: "At the very end of a mantle, press {jump} and then {crouch} within a frame: you shoot forward. The feed says how close you were. Hold {interact} to skip this one.", at: [25.5, -8], reach: 3, done: (_c, s) => s.tech.has("SUPERGLIDE") },
  { id: "shoot", title: "SHOOT", text: "Go back to the firing line and hit a target downrange with {fire}. {ads} aims down the sights.", at: [0, -2], reach: 3, done: (c, s) => c.hits > s.hits0 },
  { id: "reload", title: "RELOAD", text: "Press {reload}.", done: (c) => c.reloading },
  { id: "swap", title: "SWAP", text: "Swap guns with {swapWeapon}, or {slot1} and {slot2}.", done: (c) => c.swapping },
  { id: "heal", title: "HEAL", text: "Your shield is down: press {heal} for a shield cell (hold it for the wheel of every heal).", done: (c) => c.healing },
  { id: "ability", title: "ABILITY", text: "Pick JOLT with {pickAbility1}, then press {ability} to dash.", done: (c) => c.joltUsed },
  { id: "grenade", title: "GRENADE", text: "Press {grenade} for a grenade (again for the next kind), {fire} throws it.", done: (c, s) => c.thrown > s.thrown0 },
];

export interface TourHud {
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
}

const SKIP_HOLD = 1.2;

export class Tour {
  private index = -1;
  private state: StepState = { hits0: 0, thrown0: 0, there: false, tech: new Set(), sprinted: false };
  private skipFrom = -Infinity;
  private doneAt = -Infinity;
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private beam: THREE.Mesh;
  /** the heal step's own vitals: the range has none unless the dummies shoot back */
  readonly vitals = { shield: 25, health: 100, alive: true };
  onStep: ((title: string) => void) | null = null;
  onDone: (() => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.group.name = "tour";
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40), new THREE.MeshBasicMaterial({ color: 0x7ddc8a, transparent: true, opacity: 0.9, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 6, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x7ddc8a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.beam.position.y = 3;
    this.group.add(this.ring, this.beam);
    this.group.visible = false;
    scene.add(this.group);
  }

  get active(): boolean {
    return this.index >= 0 && this.index < STEPS.length;
  }

  get stepId(): string | null {
    return this.active ? STEPS[this.index].id : null;
  }

  /** the heal step lends its vitals (the range has none of its own), until the heal it began is over */
  get healVitals(): { shield: number; health: number; alive: boolean } | null {
    return this.stepId === "heal" || this.lending ? this.vitals : null;
  }
  private lending = false;

  start(c: TourCheck): void {
    this.index = 0;
    this.begin(c);
  }

  stop(): void {
    this.index = -1;
    this.lending = false;
    this.group.visible = false;
  }

  /** a line from the tech feed (the superglide step listens for its name) */
  onTech(name: string): void {
    if (this.active) this.state.tech.add(name.toUpperCase());
  }

  private begin(c: TourCheck): void {
    this.state = { hits0: c.hits, thrown0: c.thrown, there: false, tech: new Set(), sprinted: false };
    if (STEPS[this.index]?.id === "heal") {
      this.vitals.shield = 25;
      this.vitals.health = 100;
    }
    this.skipFrom = -Infinity;
    if (this.active) this.onStep?.(STEPS[this.index].title);
  }

  private next(c: TourCheck, now: number): void {
    // the heal step is done the moment the heal starts: its shield stays lent until the heal ends
    if (STEPS[this.index]?.id === "heal") this.lending = true;
    this.index++;
    if (this.index >= STEPS.length) {
      this.index = -1;
      this.doneAt = now;
      this.group.visible = false;
      this.onDone?.();
      return;
    }
    this.begin(c);
  }

  /** one frame: the marker, the check, the skip hold; `keys` fills in the key names */
  update(now: number, c: TourCheck, skipHeld: boolean, keys: (action: string) => string): TourHud | null {
    if (!this.active) return now - this.doneAt < 5 ? { step: STEPS.length, of: STEPS.length, title: "TOUR COMPLETE", text: "That is everything the range teaches. The Run (Basic) puts it together against the clock.", marker: null, skip: 0, done: true } : null;
    const step = STEPS[this.index];
    const s = this.state;
    if (c.sprinting) s.sprinted = true;
    if (this.lending && !c.healing) this.lending = false;
    let marker: THREE.Vector3 | null = null;
    if (step.at) {
      const [x, z] = step.at;
      if (!s.there && Math.hypot(c.pos.x - x, c.pos.z - z) <= (step.reach ?? 1.6)) s.there = true;
      if (!s.there) marker = new THREE.Vector3(x, 0, z);
    } else s.there = true;
    this.group.visible = !!marker;
    if (marker) {
      this.group.position.copy(marker);
      this.ring.scale.setScalar(1 + 0.12 * Math.sin(now * 5));
    }
    // the action counts once you are at the marker (a marker is where it is done)
    if (s.there && step.done(c, s)) {
      this.next(c, now);
      return this.update(now, c, false, keys);
    }
    if (skipHeld) {
      if (!Number.isFinite(this.skipFrom)) this.skipFrom = now;
      if (now - this.skipFrom >= SKIP_HOLD) {
        this.next(c, now);
        return this.update(now, c, false, keys);
      }
    } else this.skipFrom = -Infinity;
    const text = step.text.replace(/\{(\w+)\}/g, (_m, a: string) => keys(a));
    return { step: this.index + 1, of: STEPS.length, title: step.title, text: marker && !/marker/.test(step.text) ? `${text}  (Walk to the green marker first.)` : text, marker, skip: Number.isFinite(this.skipFrom) ? Math.min(1, (now - this.skipFrom) / SKIP_HOLD) : 0, done: false };
  }
}

export const TOUR_STEPS = STEPS.map((s) => s.id);
