/**
 * The first-person arms from KINEMATION's FPS Animation Ultimate (docs/PLAN_FIRST_PERSON_ARMS.md, src/config/fparms.json),
 * holding our guns. The pack's arms play its clips for the pack gun that stands in for ours (the USSO's is the
 * Striker-V, BOOG's the L96X), and our gun is fitted into the hands where the pack's was: turned ahead, trigger on its
 * trigger, tilted about it until its underside meets the left palm (measured, tools/checks/fparms-pack.ts).
 *
 * As KINEMATION's own player does, the camera is fixed in the rig (its FPSPlayer prefab's) and the clip moves the gun
 * and both hands; our view (hip, aim, recoil, sway, sprint, swap) moves the gun, and the hands reach it from shoulders
 * that stay put. The clip's gun motion (a reload's tilt) reaches our gun through `gunDelta`, which the view puts between
 * the gun's holder and the gun. Our magazine and charging handle follow the pack gun's own (its A_W_ clips), and a
 * hand holding one of the pack gun's parts is moved onto ours.
 *
 * The files are paid: without them, or before they are in, `ready` is false and the view keeps its own arms.
 */
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import cfg from "../config/fparms.json";
import { HU, MOVE } from "./movement";

type Measured = { turn: number[]; forward: number[]; up: number[]; trigger: number[]; palm: number[]; clavicleL?: number[]; clavicleR?: number[] };
type PackGun = { model: string; arms: Record<string, string>; gun: Record<string, string>; offset?: number[] };
const MEASURED = (cfg as unknown as { measured: Record<string, Measured> }).measured;
const PACK = cfg.packGuns as Record<string, PackGun>;
const GUNS = cfg.guns as Record<string, string>;
const DEG = Math.PI / 180;
/** the most our gun is tilted in the hands to meet the left palm (fparms.json tiltMost, degrees) */
const TILT_MOST = ((cfg as unknown as { tiltMost?: number }).tiltMost ?? 12) * DEG;
const UP = new THREE.Vector3(0, 1, 0);
/** how far back the right shoulder goes in the sights, metres (fparms.json adsShoulder) */
const ADS_SHOULDER = (cfg as unknown as { adsShoulder?: number }).adsShoulder ?? 0;
/** the pack's camera in its rig (fparms.json camera) */
const CAMERA = (cfg as unknown as { camera: number[] }).camera;
/** the pack gun's magazine and charging handle, by the names its models give them */
const MAG_NODE = "Mag";
const HANDLE_NODES = ["ActiveCharging", "ChargingHandle", "Charger"];

/** a moving clip's own motion of the gun, read off the pack's .anim curves (tools/import-fparms.ts additive.json) */
interface AddTrack {
  t: number[];
  p: number[];
  q: number[];
}
interface AddClip {
  seconds: number;
  gun: AddTrack;
  cam: AddTrack;
}
/** a track at `time`, seconds, into `pos` and `quat` (keys every 1/30 s: straight between them) */
function sampleTrack(tr: AddTrack, time: number, pos: THREE.Vector3, quat: THREE.Quaternion): void {
  const n = tr.t.length;
  if (!n) {
    pos.set(0, 0, 0);
    quat.identity();
    return;
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (tr.t[mid] <= time) lo = mid;
    else hi = mid;
  }
  const u = tr.t[hi] > tr.t[lo] ? THREE.MathUtils.clamp((time - tr.t[lo]) / (tr.t[hi] - tr.t[lo]), 0, 1) : 0;
  pos.set(tr.p[lo * 3], tr.p[lo * 3 + 1], tr.p[lo * 3 + 2]).lerp(new THREE.Vector3(tr.p[hi * 3], tr.p[hi * 3 + 1], tr.p[hi * 3 + 2]), u);
  quat.set(tr.q[lo * 4], tr.q[lo * 4 + 1], tr.q[lo * 4 + 2], tr.q[lo * 4 + 3]).slerp(new THREE.Quaternion(tr.q[hi * 4], tr.q[hi * 4 + 1], tr.q[hi * 4 + 2], tr.q[hi * 4 + 3]), u);
}
/** half a turn about y: the rig faces +z, our view -z */
const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

/** the gun camera's vertical field of view at the hip with these arms (fparms.json fov) */
export const PACK_FOV = (cfg as unknown as { fov: number }).fov;

const url = (p: string): string => `${p}?v=${cfg.version}`;
const loader = new GLTFLoader();

/** the pack gun that stands in for one of ours, or null (the view's own arms hold it) */
export function packGunFor(id: string): string | null {
  const p = GUNS[id];
  return p && MEASURED[p] ? p : null;
}

/** our gun's underside (its frame's y) under a point along it, or null: a ray up from below, visible parts only */
function underside(gunRoot: THREE.Object3D, at: THREE.Vector3): number | null {
  gunRoot.updateWorldMatrix(true, true);
  const toLocal = new THREE.Matrix4().copy(gunRoot.matrixWorld).invert();
  const from = new THREE.Vector3(0, at.y - 0.5, at.z).applyMatrix4(gunRoot.matrixWorld);
  const dir = new THREE.Vector3(0, 1, 0).transformDirection(gunRoot.matrixWorld);
  const hits: THREE.Intersection[] = [];
  gunRoot.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    for (let p: THREE.Object3D | null = m; p && p !== gunRoot.parent; p = p.parent) if (!p.visible) return;
    new THREE.Raycaster(from, dir, 0, 1).intersectObject(m, false, hits);
  });
  if (!hits.length) return null;
  hits.sort((a, b) => a.distance - b.distance);
  return hits[0].point.applyMatrix4(toLocal).y;
}

/** a pack gun clip: its parts' skeleton (the clip file keeps its nodes), and what was measured off it */
interface GunClip {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clip: THREE.AnimationClip;
  /** the magazine's and the handle's rest, in the gun's own frame, at the clip's first frame */
  magRest: THREE.Matrix4 | null;
  handleRest: THREE.Vector3 | null;
  handle: string | null;
  /** the most the handle moves in this clip, metres */
  handleTravel: number;
  /** shares of the clip: the magazine leaving the gun and home again (the phase out and in go there) */
  magOut: number | null;
  magHome: number | null;
  /** shares of the clip the handle moves over */
  handleFrom: number | null;
  handleTo: number | null;
}

interface GunSet {
  name: string;
  arms: Map<string, THREE.AnimationClip>;
  gun: Map<string, GunClip>;
}

/** what the view tells the arms about this frame */
export interface PackArmsFrame {
  dt: number;
  /** 0..1 through a reload, or null */
  reload: number | null;
  /** the reload began with the magazine empty */
  empty: boolean;
  /** seconds since the last shot, and the gun's rechamber (BOOG's bolt worked after each shot) */
  sinceShot: number;
  rechamber: number;
  ads: number;
}

const loc = (m: THREE.Matrix4): THREE.Vector3 => new THREE.Vector3().setFromMatrixPosition(m);

export class PackArms {
  /** hung in the view's own group, so it shares its camera and scale */
  readonly group = new THREE.Group();
  /** the clip's own motion of the gun, in our gun's frame: the view puts it between the holder and the gun */
  readonly gunDelta = new THREE.Group();
  ready = false;
  /** the pack gun in the hands now, once its clips are in */
  active: string | null = null;
  /**
   * Where the pack holds the gun at the hip, as our view places a gun (its position in the view's group, and its turn):
   * the pack's hold is made for its own camera, so our gun goes where its gun was and the arms keep the shape the pack
   * gave them. Hung the other way (the arms stretched to our own hip pose) the sleeves filled a third of the view.
   */
  readonly hip = { position: new THREE.Vector3(), euler: new THREE.Euler() };
  /** how far our gun is tilted in the hands to meet the left palm, radians (the checks) */
  tilt = 0;
  /** the clip leading this frame ("pose", "reloadTac", "reloadEmpty", "fire") */
  lead = "pose";
  /**
   * What the checks read of the last frame: how far the clip turned the gun, degrees; how far back our handle is, 0..1;
   * the left hand's middle knuckle's distance to our handle and to our magazine, metres
   */
  readonly seen = { gunTurn: 0, handleBack: 0, leftToHandle: Infinity, leftToMag: Infinity };

  private arms: THREE.Object3D | null = null;
  /** the moving clips' motion of the gun, and where through them the stride is */
  private additive: Record<string, AddClip> | null = null;
  private stride = 0;
  private airAmt = 0;
  private airT = 0;
  private mixer: THREE.AnimationMixer | null = null;
  private bones: Record<string, THREE.Object3D> = {};
  private sets = new Map<string, GunSet>();
  private loading = new Map<string, Promise<GunSet | null>>();
  private actions = new Map<string, THREE.AnimationAction>();
  /** the arms and the gun moved as one in the view, metres (fparms.json packGuns offset) */
  private readonly offset = new THREE.Vector3();
  /** our gun's frame in the gun bone's, and back */
  private readonly ourInBone = new THREE.Matrix4();
  private readonly boneInOur = new THREE.Matrix4();
  /** the pack gun's own frame into ours (its parts' moves are carried by it) */
  private readonly packToOur = new THREE.Matrix4();
  private readonly ourToPack = new THREE.Matrix4();
  /** the gun bone at the pose's first frame, in the rig's space */
  private readonly boneRefInv = new THREE.Matrix4();
  /** the left hand at the hold, in our frame, and the move that keeps its height against our gun's underside */
  private readonly restHand = new THREE.Vector3();
  private readonly palmShift = new THREE.Vector3();
  /** every bone's place at bind, put back before another gun's clips (a clip leaves the bones it tracks where it put them) */
  private readonly bind = new Map<THREE.Object3D, [THREE.Vector3, THREE.Quaternion, THREE.Vector3]>();
  /** our magazine at rest in our frame, its parent's frame in ours, our handle's grip, and its travel */
  private magRestO: THREE.Matrix4 | null = null;
  private magParentInv: THREE.Matrix4 | null = null;
  private handleO: THREE.Vector3 | null = null;
  private boltRestZ = 0;
  private boltTravel = 0;

  /** the arms and their materials; false if the paid files are not here */
  async load(): Promise<boolean> {
    try {
      const g = await loader.loadAsync(url(`${cfg.models}arms.glb`));
      const tl = new THREE.TextureLoader();
      const tex = (name: string, srgb: boolean): THREE.Texture => {
        const t = tl.load(url(`${cfg.textures}${name}.webp`));
        t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        t.flipY = false;
        return t;
      };
      const mat = (part: string): THREE.MeshStandardMaterial => {
        const orm = tex(`${part}_orm`, false);
        return new THREE.MeshStandardMaterial({ map: tex(`${part}_color`, true), normalMap: tex(`${part}_normal`, false), roughnessMap: orm, metalnessMap: orm, aoMap: orm });
      };
      const byName: Record<string, THREE.MeshStandardMaterial> = { Glove: mat("Glove01"), Cloth: mat("Cloth01"), Hand: mat("Arm01") };
      g.scene.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isMesh) {
          const slot = (m.material as THREE.Material).name;
          m.material = byName[Object.keys(byName).find((k) => slot.includes(k)) ?? "Hand"];
          m.frustumCulled = false;
          m.castShadow = false;
          m.receiveShadow = false;
        }
        if (o.name) this.bones[o.name] = o;
        this.bind.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone()]);
      });
      this.arms = g.scene;
      this.group.add(g.scene);
      this.group.visible = false;
      this.mixer = new THREE.AnimationMixer(g.scene);
      this.additive = await fetch(url(`${cfg.models}additive.json`))
        .then((r) => (r.ok ? (r.json() as Promise<Record<string, AddClip>>) : null))
        .catch(() => null);
      this.ready = true;
      return true;
    } catch {
      return false;
    }
  }

  /** a pack gun's clips, loaded once, and its gun clips measured: where its parts rest, and when they move */
  private gunSet(name: string): Promise<GunSet | null> {
    const had = this.loading.get(name);
    if (had) return had;
    const p = (async (): Promise<GunSet | null> => {
      const pg = PACK[name];
      if (!pg) return null;
      const set: GunSet = { name, arms: new Map(), gun: new Map() };
      await Promise.all([
        ...Object.entries(pg.arms).map(async ([k, clip]) => {
          const g = await loader.loadAsync(url(`${cfg.models}clips/${clip}.glb`));
          if (g.animations[0]) set.arms.set(k, g.animations[0]);
        }),
        ...Object.entries(pg.gun).map(async ([k, clip]) => {
          // a gun's pose can be a still with no clip file (the L96X's)
          const g = await loader.loadAsync(url(`${cfg.models}clips/${clip}.glb`)).catch(() => null);
          if (g?.animations[0]) set.gun.set(k, measureGunClip(g.scene, g.animations[0]));
        }),
      ]);
      this.sets.set(name, set);
      return set;
    })().catch(() => null);
    this.loading.set(name, p);
    return p;
  }

  /**
   * Our gun `id` into the pack's hands: its clips (loaded the first time), and our gun measured into the pack gun's
   * place. `gunRoot` is our gun at rest; `trigger` and `boltGrip` are in its frame; `mag` and `bolt` are its moving
   * parts. Measured before the clips load: by then the gun may be spinning in on a swap.
   */
  async useGun(id: string, gunRoot: THREE.Object3D, trigger: THREE.Vector3, mag: THREE.Object3D | null, bolt: THREE.Object3D | null, boltTravel: number, boltGrip: THREE.Vector3 | null): Promise<boolean> {
    this.release();
    const name = packGunFor(id);
    if (!this.ready || !name || !this.mixer || !this.arms) return false;
    const me = MEASURED[name];
    // our gun in the gun bone's frame: the pack gun's quarter turns, ours turned ahead (it looks down -z, the pack's
    // down +z), our trigger on its trigger
    const turn = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(me.turn[0] * DEG, me.turn[1] * DEG, me.turn[2] * DEG));
    const about = new THREE.Matrix4().makeRotationY(Math.PI);
    const ourTrigger = trigger.clone().applyMatrix4(about);
    const place = new THREE.Matrix4().makeTranslation(me.trigger[0] - ourTrigger.x, me.trigger[1] - ourTrigger.y, me.trigger[2] - ourTrigger.z).multiply(about);
    // Both hands where the pack's clip has them, and our gun fitted into them: tilted about the trigger until its
    // underside under the left palm is where the pack gun's was, 22 mm under the palm. Moving the hand onto our gun
    // instead bent the arm: to our old support point, BOOG's 40 cm out, it ran out of reach and the hand hung in the
    // air; down onto BOOG's deeper underside, the elbow came up into the view
    const palm = new THREE.Vector3().fromArray(me.palm).applyMatrix4(new THREE.Matrix4().copy(place).invert());
    const under = underside(gunRoot, palm);
    const along = Math.abs(palm.z - trigger.z);
    const tilt = under === null || along < 0.05 ? 0 : THREE.MathUtils.clamp(Math.atan2(palm.y - (under + 0.022), along), -TILT_MOST, TILT_MOST);
    const pivot = new THREE.Matrix4().makeTranslation(trigger.x, trigger.y, trigger.z).multiply(new THREE.Matrix4().makeRotationX(tilt)).multiply(new THREE.Matrix4().makeTranslation(-trigger.x, -trigger.y, -trigger.z));
    const ourInBone = new THREE.Matrix4().copy(turn).multiply(place).multiply(pivot);
    const boneInOur = new THREE.Matrix4().copy(ourInBone).invert();
    // what the tilt, at most TILT_MOST, left between the pack's underside and ours under the palm: the hand is moved by it
    const palmO = new THREE.Vector3().fromArray(me.palm).applyMatrix4(boneInOur.clone().multiply(turn));
    const underT = underside(gunRoot, palmO);
    const residual = underT === null ? 0 : underT + 0.022 - palmO.y;
    // our moving parts at rest, in our frame
    gunRoot.updateWorldMatrix(true, true);
    const rootInv = new THREE.Matrix4().copy(gunRoot.matrixWorld).invert();
    const magRestO = mag ? new THREE.Matrix4().multiplyMatrices(rootInv, mag.matrixWorld) : null;
    const magParentInv = mag?.parent ? new THREE.Matrix4().multiplyMatrices(rootInv, mag.parent.matrixWorld).invert() : null;
    const boltRestZ = bolt ? bolt.position.z : 0;

    const set = await this.gunSet(name);
    if (!set || !set.arms.get("pose") || packGunFor(id) !== name) return false;
    this.ourInBone.copy(ourInBone);
    this.boneInOur.copy(boneInOur);
    this.packToOur.copy(boneInOur).multiply(turn);
    this.ourToPack.copy(this.packToOur).invert();
    this.palmShift.set(-palmO.x, residual, 0);
    this.tilt = tilt;
    this.magRestO = magRestO;
    this.magParentInv = magParentInv;
    this.handleO = boltGrip ? boltGrip.clone() : null;
    this.boltRestZ = boltRestZ;
    this.boltTravel = boltTravel;
    // every clip as an action the view drives by time; the pose's first frame is the reference
    this.mixer.stopAllAction();
    for (const [o, [p, q, sc]] of this.bind) {
      o.position.copy(p);
      o.quaternion.copy(q);
      o.scale.copy(sc);
    }
    this.actions.clear();
    for (const [k, clip] of set.arms) {
      const a = this.mixer.clipAction(clip);
      a.play();
      a.paused = true;
      a.time = 0;
      a.weight = k === "pose" ? 1 : 0;
      this.actions.set(k, a);
    }
    this.mixer.update(0);
    this.arms.updateMatrixWorld(true);
    const rigInv = new THREE.Matrix4().copy(this.arms.matrixWorld).invert();
    const boneRef = new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_gun.matrixWorld);
    this.boneRefInv.copy(boneRef).invert();
    this.restHand.setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(this.boneRefInv, new THREE.Matrix4().multiplyMatrices(rigInv, this.bones.ik_hand_l.matrixWorld))).applyMatrix4(boneInOur);
    // the hip: our gun where the pack's was, seen from the pack's camera (the rig faces +z, ours -z: half a turn), the
    // arms and gun moved as one by the pack gun's `offset`
    this.offset.fromArray(PACK[name].offset ?? [0, 0, 0]);
    const rigToView = new THREE.Matrix4().compose(new THREE.Vector3(CAMERA[0], -CAMERA[1], CAMERA[2]).add(this.offset), new THREE.Quaternion().setFromAxisAngle(UP, Math.PI), new THREE.Vector3(1, 1, 1));
    const hq = new THREE.Quaternion();
    rigToView.multiply(boneRef).multiply(ourInBone).decompose(this.hip.position, hq, new THREE.Vector3());
    this.hip.euler.setFromQuaternion(hq, "XYZ");
    this.active = name;
    return true;
  }

  /**
   * The moving clips' motion of the gun this frame, in our view's space, as KINEMATION's player adds it (its Additive
   * layer: idle, walk and sprint blended by the gait, the jump's loop in the air, at a third in the sights): our speed
   * `speed` (m/s) against SpeedKills' run and sprint (the gait's 1 and 2). The view adds it to the gun's pose; the
   * hands follow the gun.
   */
  locomotion(dt: number, speed: number, air: boolean, ads: number, pos: THREE.Vector3, quat: THREE.Quaternion): void {
    pos.set(0, 0, 0);
    quat.identity();
    const A = this.additive;
    if (!A || !A.A_FP_Idle) return;
    const run = MOVE.speed * HU;
    const sprint = MOVE.sprintSpeed * HU;
    const g = speed <= run ? speed / run : 1 + THREE.MathUtils.clamp((speed - run) / Math.max(0.1, sprint - run), 0, 1);
    const w: Array<[AddClip | undefined, number]> = [
      [A.A_FP_Idle, Math.max(0, 1 - g)],
      [A.A_FP_Walk, g <= 1 ? g : 2 - g],
      [A.A_FP_Sprint, Math.max(0, g - 1)],
    ];
    // one stride through all of them together, as a blend tree keeps its children in step
    let seconds = 0;
    for (const [c, k] of w) if (c) seconds += c.seconds * k;
    this.stride = (this.stride + dt / Math.max(0.2, seconds)) % 1;
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const acc = new THREE.Vector4();
    let first: THREE.Quaternion | null = null;
    for (const [c, k] of w) {
      if (!c || k <= 0) continue;
      sampleTrack(c.gun, this.stride * c.seconds, p, q);
      pos.addScaledVector(p, k);
      first ??= q.clone();
      const s = first.dot(q) < 0 ? -k : k;
      acc.x += q.x * s;
      acc.y += q.y * s;
      acc.z += q.z * s;
      acc.w += q.w * s;
    }
    quat.set(acc.x, acc.y, acc.z, acc.w).normalize();
    // the jump's loop while in the air, eased in and out
    this.airAmt += ((air ? 1 : 0) - this.airAmt) * Math.min(1, dt / 0.12);
    this.airT = air ? this.airT + dt : 0;
    const jump = A.A_FP_Jump_Loop;
    if (jump && this.airAmt > 0.001) {
      sampleTrack(jump.gun, this.airT % jump.seconds, p, q);
      pos.lerp(p, this.airAmt);
      quat.slerp(q, this.airAmt);
    }
    // a third of it in the sights (FPSProceduralJob: Lerp(1, 0.3, adsWeight))
    const weight = 1 - 0.7 * ads;
    pos.multiplyScalar(weight);
    quat.slerp(new THREE.Quaternion(), 1 - weight);
    // into our view's space
    pos.applyQuaternion(FLIP);
    quat.premultiply(FLIP).multiply(new THREE.Quaternion().copy(FLIP).invert());
  }

  /** the pack's arms off: another gun */
  release(): void {
    this.active = null;
    this.idle();
  }

  /** not drawn this frame (the fists, a zipline, a cast): hidden, and our gun back where the view put it */
  idle(): void {
    this.group.visible = false;
    this.gunDelta.position.set(0, 0, 0);
    this.gunDelta.quaternion.identity();
    this.gunDelta.scale.set(1, 1, 1);
  }

  /**
   * The clip leading this frame and the shares of it where the magazine leaves the gun and is home again, measured off
   * the pack gun's clip (null: not a reload, or the clip does not take the magazine out)
   */
  magMoments(): { out: number; home: number } | null {
    const set = this.active ? this.sets.get(this.active) : null;
    const g = set?.gun.get(this.lead);
    return g && g.magOut !== null && g.magHome !== null ? { out: g.magOut, home: g.magHome } : null;
  }

  /**
   * One frame: the clips to where the view's state says, the rig on the eye, our gun moved by the clip, our magazine and
   * handle moved with the pack gun's, both hands onto our gun where the view has put it.
   */
  update(f: PackArmsFrame, holder: THREE.Object3D, mag: THREE.Object3D | null, bolt: THREE.Object3D | null): void {
    const set = this.active ? this.sets.get(this.active) : null;
    if (!set || !this.mixer || !this.arms) return;
    this.group.visible = true;
    // which clip leads: a reload (from empty or not), the bolt worked after a shot, or the hold
    const reloadKey = f.reload !== null ? (f.empty && this.actions.has("reloadEmpty") ? "reloadEmpty" : "reloadTac") : null;
    const cycling = !reloadKey && this.actions.has("fire") && f.sinceShot >= 0 && f.sinceShot < f.rechamber;
    this.lead = reloadKey ?? (cycling ? "fire" : "pose");
    const u = reloadKey ? (f.reload ?? 0) : cycling ? f.sinceShot / f.rechamber : 0;
    for (const [k, a] of this.actions) {
      if (k === "pose") {
        a.time = 0;
        a.weight = 1;
        continue;
      }
      const on = k === this.lead;
      a.time = on ? u * a.getClip().duration : 0;
      // in and out over its first and last few percent, so it does not snap from the hold
      a.weight = on ? Math.min(1, u / 0.04, (1 - u) / 0.04) : 0;
    }
    this.mixer.update(0);
    this.moveShoulders(f.ads);

    // the rig fixed to the eye as the pack's camera is (fparms.json camera), moved by the gun's `offset`
    this.arms.quaternion.setFromAxisAngle(UP, Math.PI);
    this.arms.position.set(CAMERA[0], -CAMERA[1], CAMERA[2]).add(this.offset);
    this.arms.scale.set(1, 1, 1);
    this.arms.updateMatrixWorld(true);
    const rigInv = new THREE.Matrix4().copy(this.arms.matrixWorld).invert();
    const inRig = (o: THREE.Object3D): THREE.Matrix4 => new THREE.Matrix4().multiplyMatrices(rigInv, o.matrixWorld);

    // the clip's gun motion, carried to our gun
    const boneNow = inRig(this.bones.ik_hand_gun);
    new THREE.Matrix4().copy(this.boneInOur).multiply(this.boneRefInv).multiply(boneNow).multiply(this.ourInBone).decompose(this.gunDelta.position, this.gunDelta.quaternion, this.gunDelta.scale);
    this.gunDelta.updateMatrix();

    // the pack gun's parts now (its own clip at the same moment), and ours moved as they are
    const gunClip = set.gun.get(this.lead) ?? null;
    let packMagO: THREE.Vector3 | null = null;
    let packHandleO: THREE.Vector3 | null = null;
    let ourMagO: THREE.Vector3 | null = null;
    let ourHandleO: THREE.Vector3 | null = null;
    if (gunClip) {
      gunClip.mixer.setTime(u * gunClip.clip.duration);
      gunClip.root.updateMatrixWorld(true);
    }
    const partNow = (n: string | null): THREE.Matrix4 | null => {
      const o = n && gunClip ? gunClip.root.getObjectByName(n) : null;
      return o ? new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(gunClip!.root.matrixWorld).invert(), o.matrixWorld) : null;
    };
    const magNow = partNow(MAG_NODE);
    if (mag && this.magRestO && this.magParentInv) {
      let ours = this.magRestO;
      if (magNow && gunClip?.magRest) {
        // its move from rest in its own frame, carried into ours
        const d = new THREE.Matrix4().multiplyMatrices(magNow, new THREE.Matrix4().copy(gunClip.magRest).invert());
        ours = new THREE.Matrix4().copy(this.packToOur).multiply(d).multiply(this.ourToPack).multiply(this.magRestO);
        packMagO = loc(magNow).applyMatrix4(this.packToOur);
      } else packMagO = gunClip?.magRest ? loc(gunClip.magRest).applyMatrix4(this.packToOur) : null;
      ourMagO = loc(ours);
      new THREE.Matrix4().multiplyMatrices(this.magParentInv, ours).decompose(mag.position, mag.quaternion, mag.scale);
    }
    const handleNow = partNow(gunClip?.handle ?? null);
    if (bolt && this.boltTravel > 0) {
      let back = 0;
      if (handleNow && gunClip?.handleRest && gunClip.handleTravel > 0.005) {
        const at = loc(handleNow);
        back = THREE.MathUtils.clamp(at.distanceTo(gunClip.handleRest) / gunClip.handleTravel, 0, 1);
        packHandleO = at.clone().applyMatrix4(this.packToOur);
      }
      bolt.position.z = this.boltRestZ + back * this.boltTravel;
      this.seen.handleBack = back;
      if (this.handleO) ourHandleO = this.handleO.clone().setZ(this.handleO.z + back * this.boltTravel);
    }

    // both hands: where the clip has them on its gun, carried onto ours where the view has put it; the left moved from
    // the pack gun's handguard, magazine or handle onto ours by as much as it is holding each
    holder.updateWorldMatrix(true, false);
    const gunWorld = new THREE.Matrix4().multiplyMatrices(holder.matrixWorld, this.gunDelta.matrix);
    const boneInWorld = new THREE.Matrix4().multiplyMatrices(gunWorld, this.boneInOur);
    const boneNowInv = new THREE.Matrix4().copy(boneNow).invert();
    const toWorldDir = new THREE.Matrix3().setFromMatrix4(gunWorld);
    for (const side of ["r", "l"] as const) {
      const rel = new THREE.Matrix4().multiplyMatrices(boneNowInv, inRig(this.bones[`ik_hand_${side}`]));
      const pos = new THREE.Vector3();
      const quat = new THREE.Quaternion();
      new THREE.Matrix4().multiplyMatrices(boneInWorld, rel).decompose(pos, quat, new THREE.Vector3());
      if (side === "l") {
        // the hand in our gun's frame; where it goes on ours:
        // - at the hold, the pack's hand kept at its height against our gun's underside (what the tilt did not close);
        // - carrying the magazine, or working the handle, onto ours, over the moments the pack gun's clip moves its own
        //   (measured), with a lead-in for the reach to it
        const handO = loc(rel).applyMatrix4(this.boneInOur);
        const shift = new THREE.Vector3();
        let total = 0;
        const add = (w: number, s: THREE.Vector3): void => {
          if (w <= 0.001) return;
          shift.addScaledVector(s, w);
          total += w;
        };
        add(1 - THREE.MathUtils.smoothstep(handO.distanceTo(this.restHand), 0.03, 0.1), this.palmShift);
        const win = (from: number | null, to: number | null, lead: number, tail: number): number =>
          from === null || to === null ? 0 : THREE.MathUtils.smoothstep(u, from - lead, from) * (1 - THREE.MathUtils.smoothstep(u, to, to + tail));
        // (by the window alone: gated on the hand being near the pack's magazine too, the hand jumped 12 cm the moment
        // it came within reach of it; the offset between the two magazines turns with them, smoothly)
        if (packMagO && ourMagO && gunClip) add(win(gunClip.magOut, gunClip.magHome, 0.08, 0.04), ourMagO.clone().sub(packMagO));
        if (packHandleO && ourHandleO && gunClip) add(win(gunClip.handleFrom, gunClip.handleTo, 0.06, 0.05), ourHandleO.clone().sub(packHandleO));
        if (total > 1) shift.divideScalar(total);
        pos.add(shift.applyMatrix3(toWorldDir));
      }
      this.reach(side, pos, quat);
    }
    // for the checks
    this.seen.gunTurn = (2 * Math.acos(Math.min(1, Math.abs(this.gunDelta.quaternion.w))) * 180) / Math.PI;
    const knuckle = this.bones.middle_01_l?.getWorldPosition(new THREE.Vector3());
    this.seen.leftToHandle = knuckle && ourHandleO ? knuckle.distanceTo(ourHandleO.clone().applyMatrix4(gunWorld)) : Infinity;
    this.seen.leftToMag = knuckle && mag ? knuckle.distanceTo(mag.getWorldPosition(new THREE.Vector3())) : Infinity;
  }

  /**
   * Each shoulder moved as KINEMATION's player moves it for this gun (its settings' clavicle offsets, in the rig's space:
   * Unity's x is the glTF's -x), after the clip has put it: the L96X's right one 21 cm back, so the long gun's grip is
   * reached with the elbow bent (without it BOOG's right wrist bent 87 degrees at the hold and 155 aimed)
   */
  private moveShoulders(ads: number): void {
    const me = this.active ? MEASURED[this.active] : null;
    if (!me || !this.arms) return;
    // and aimed, both back by as much again as our sights bring the gun nearer the eye than the pack's do (fparms.json
    // adsShoulder): with the shoulders where the hold put them, the USSO's right wrist bent 109 degrees aimed, its left 70
    const back = ADS_SHOULDER * ads;
    const r = me.clavicleR ?? [0, 0, 0];
    const l = me.clavicleL ?? [0, 0, 0];
    for (const [side, off] of [["l", [l[0], l[1], l[2] - back]], ["r", [r[0], r[1], r[2] - back]]] as const) {
      if (!off || (off[0] === 0 && off[1] === 0 && off[2] === 0)) continue;
      const clav = this.bones[`clavicle_${side}`];
      if (!clav?.parent) continue;
      this.arms.updateMatrixWorld(true);
      const inRig = new THREE.Vector3(-off[0], off[1], off[2]);
      // the rig's direction into the clavicle's parent's frame
      const toParent = new THREE.Matrix4().copy(clav.parent.matrixWorld).invert().multiply(this.arms.matrixWorld);
      const len = inRig.length();
      clav.position.add(inRig.transformDirection(toParent).multiplyScalar(len));
    }
  }

  /** the hand `side` to `target` turned `turn` (world), the arm bent to reach it in the plane the clip had its elbow */
  private reach(side: "l" | "r", target: THREE.Vector3, turn: THREE.Quaternion): void {
    const up = this.bones[`upperarm_${side}`];
    const lo = this.bones[`lowerarm_${side}`];
    const hand = this.bones[`hand_${side}`];
    if (!up || !lo || !hand) return;
    const s = up.getWorldPosition(new THREE.Vector3());
    const e = lo.getWorldPosition(new THREE.Vector3());
    const w = hand.getWorldPosition(new THREE.Vector3());
    const a = s.distanceTo(e);
    const b = e.distanceTo(w);
    const d = THREE.MathUtils.clamp(s.distanceTo(target), Math.abs(a - b) + 1e-4, a + b - 1e-4);
    const dir = target.clone().sub(s).normalize();
    const pole = e.clone().sub(s);
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const elbow = s.clone().addScaledVector(dir, a * cosA).addScaledVector(pole, a * Math.sqrt(Math.max(0, 1 - cosA * cosA)));
    const aim = (bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, child: THREE.Vector3): void => {
      const q = new THREE.Quaternion().setFromUnitVectors(child.clone().sub(from).normalize(), to.clone().sub(from).normalize());
      const wq = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
      bone.quaternion.copy(bone.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(wq));
      bone.updateMatrixWorld(true);
    };
    aim(up, s, elbow, e);
    aim(lo, lo.getWorldPosition(new THREE.Vector3()), s.clone().addScaledVector(dir, d), hand.getWorldPosition(new THREE.Vector3()));
    // the hand keeps the turn the clip gave it on its gun
    hand.quaternion.copy(hand.parent!.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(turn));
    hand.updateMatrixWorld(true);
  }

  /** a wrist's bend, degrees: the angle between the hand's line and its forearm's (the checks) */
  wristBend(side: "l" | "r"): number {
    const lo = this.bones[`lowerarm_${side}`];
    const hand = this.bones[`hand_${side}`];
    const knuckle = this.bones[`middle_01_${side}`];
    if (!lo || !hand || !knuckle) return 0;
    const e = lo.getWorldPosition(new THREE.Vector3());
    const w = hand.getWorldPosition(new THREE.Vector3());
    const k = knuckle.getWorldPosition(new THREE.Vector3());
    return (w.clone().sub(e).angleTo(k.clone().sub(w)) * 180) / Math.PI;
  }

  /** a hand, in the world (the checks) */
  handAt(side: "l" | "r"): THREE.Vector3 | null {
    const h = this.bones[`hand_${side}`];
    return h ? h.getWorldPosition(new THREE.Vector3()) : null;
  }
}

/** a pack gun clip's parts measured: where the magazine and handle rest, how far the handle goes, when the magazine moves */
function measureGunClip(root: THREE.Object3D, clip: THREE.AnimationClip): GunClip {
  const mixer = new THREE.AnimationMixer(root);
  mixer.clipAction(clip).play();
  const inRoot = (o: THREE.Object3D): THREE.Matrix4 => new THREE.Matrix4().multiplyMatrices(new THREE.Matrix4().copy(root.matrixWorld).invert(), o.matrixWorld);
  mixer.setTime(0);
  root.updateMatrixWorld(true);
  const magO = root.getObjectByName(MAG_NODE) ?? null;
  const handle = HANDLE_NODES.find((n) => root.getObjectByName(n)) ?? null;
  const handleO = handle ? root.getObjectByName(handle)! : null;
  const magRest = magO ? inRoot(magO) : null;
  const handleRest = handleO ? loc(inRoot(handleO)) : null;
  let handleTravel = 0;
  let magOut: number | null = null;
  let magHome: number | null = null;
  let handleFrom: number | null = null;
  let handleTo: number | null = null;
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    mixer.setTime(t * clip.duration);
    root.updateMatrixWorld(true);
    if (handleO && handleRest) {
      const d = loc(inRoot(handleO)).distanceTo(handleRest);
      handleTravel = Math.max(handleTravel, d);
      if (d > 0.003) {
        if (handleFrom === null) handleFrom = t;
        handleTo = t;
      }
    }
    if (magO && magRest && loc(inRoot(magO)).distanceTo(loc(magRest)) > 0.004) {
      if (magOut === null) magOut = t;
      magHome = t;
    }
  }
  mixer.setTime(0);
  return { root, mixer, clip, magRest, handleRest, handle, handleTravel, magOut, magHome, handleFrom, handleTo };
}
