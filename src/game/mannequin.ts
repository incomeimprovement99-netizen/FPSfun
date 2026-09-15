// The motion-captured figure: Quaternius's mannequin and his Universal
// Animation Library clips (CC0; public/models/mannequin), in place of the
// robot built in code, when Settings says "Figures: mannequins".
//
// It is the default figure; the robot is the setting's other choice and the
// fallback until the files have loaded. The library's clips are pistol clips
// (it has no rifle set), so a pistol is held as the aim clip holds it, and a
// long gun is not: it hangs off the chest with its stock in the right
// shoulder, and both arms reach onto it (a two-bone IK to the grip and the
// handguard), lowered and canted across the body for a sprint or a swap. The
// hit zones are the Dummy's own invisible boxes either way, so the choice
// changes nothing about what a bullet hits.
//
// The body is two layers. The legs (and the hips' bob) play the locomotion
// clip for the stance and speed: idle, walk, jog, sprint, crouched, backward
// by running the clip in reverse. The upper body plays the hands' clip: the
// aim pose, the reload, the heal, the gun lowered for a sprint or a swap; an
// unarmed figure's arms swing with the legs. Then, on top of the clips, the
// same corrections the robot makes: the hips turn toward a strafe and the
// spine turns back onto the aim, the spine bends to the look pitch, a shot
// kicks, a hit flinches, a JOLT leans.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { displayGunModel } from "./gunmodels";
import type { OperatorSkin } from "./operators";
import type { FigurePose } from "./dummy";

export type FigureStyle = "robot" | "mannequin";
let style: FigureStyle = "robot";
/** what new figures are built as (Settings); the robot until the mannequin has loaded */
export function setFigureStyle(s: FigureStyle): void {
  style = s;
  if (s === "mannequin") void loadMannequin();
}
export function useMannequin(): boolean {
  return style === "mannequin" && template !== null;
}

interface Template {
  scene: THREE.Object3D;
  /** the clips split in two: "lower:Walk_Loop", "upper:Pistol_Reload", and whole ones: "full:Slide_Loop" */
  clips: Map<string, THREE.AnimationClip>;
  /** the right hand's place in the aim pose, figure space (where a pistol's grip goes) */
  handAim: THREE.Matrix4;
  /** the upper chest bone in the aim pose, figure space (a rifle's mount hangs off it) */
  chestAim: THREE.Matrix4;
  /** the right shoulder in the aim pose, figure space (a rifle's stock goes to it) */
  shoulderR: THREE.Vector3;
}
let template: Template | null = null;
let loading: Promise<void> | null = null;

/** the bones below the waist: the locomotion layer's */
const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;

/** load the two files once; figures made after it is in use it */
export function loadMannequin(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  loading = Promise.all([loader.loadAsync("models/mannequin/mannequin.glb"), loader.loadAsync("models/mannequin/mannequin-more.glb")])
    .then(([main, more]) => {
      const clips = new Map<string, THREE.AnimationClip>();
      for (const c of [...main.animations, ...more.animations]) {
        const lower = c.tracks.filter((t) => LOWER.test(t.name.split(".")[0]));
        const upper = c.tracks.filter((t) => !LOWER.test(t.name.split(".")[0]));
        clips.set(`lower:${c.name}`, new THREE.AnimationClip(`lower:${c.name}`, c.duration, lower));
        clips.set(`upper:${c.name}`, new THREE.AnimationClip(`upper:${c.name}`, c.duration, upper));
        clips.set(`full:${c.name}`, c);
      }
      // the right hand in the aim pose: sample the clip onto a copy once
      const probe = cloneSkinned(main.scene);
      const mixer = new THREE.AnimationMixer(probe);
      mixer.clipAction(clips.get("full:Pistol_Aim_Neutral")!).play();
      mixer.update(0);
      probe.updateMatrixWorld(true);
      const hand = probe.getObjectByName("hand_r")!;
      const chest = probe.getObjectByName("spine_03")!;
      const shoulder = probe.getObjectByName("upperarm_r")!;
      template = { scene: main.scene, clips, handAim: hand.matrixWorld.clone(), chestAim: chest.matrixWorld.clone(), shoulderR: new THREE.Vector3().setFromMatrixPosition(shoulder.matrixWorld) };
    })
    .catch((e) => {
      console.warn("the mannequin did not load; the figures stay robots", e);
      loading = null;
    });
  return loading;
}

const DEG = Math.PI / 180;
const Y = new THREE.Vector3(0, 1, 0);
const tq1 = new THREE.Quaternion();
const tq2 = new THREE.Quaternion();
const tq3 = new THREE.Quaternion();
const tv = new THREE.Vector3();

/** turn a bone by `angle` about an axis given in the figure's own frame, on top of what the clip set */
function turnBone(bone: THREE.Object3D, figure: THREE.Object3D, axisLocal: THREE.Vector3, angle: number): void {
  if (Math.abs(angle) < 1e-5 || !bone.parent) return;
  bone.parent.updateWorldMatrix(true, false);
  const parentQ = bone.parent.getWorldQuaternion(tq1);
  const world = tq2.copy(parentQ).multiply(bone.quaternion);
  const axis = tv.copy(axisLocal).applyQuaternion(figure.getWorldQuaternion(tq3)).normalize();
  world.premultiply(tq3.setFromAxisAngle(axis, angle));
  bone.quaternion.copy(parentQ.invert().multiply(world));
}

export interface MannequinImpulses {
  kick: number;
  flinch: number;
  jolt: number;
  legYaw: number;
  ads: number;
  /** a landing's squash, 1 on touchdown */
  land?: number;
  /** when the shield last broke, on the figure's clock (a stagger) */
  stagger?: number;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const v4 = new THREE.Vector3();
const v5 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const IDENTITY = new THREE.Quaternion();

/** turn a bone (weighted by w) so its direction `from` (world) points along `to` (world) */
function aimBone(bone: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, w: number): void {
  if (!bone.parent || from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const d = q1.setFromUnitVectors(from.normalize(), to.normalize());
  if (w < 1) d.slerpQuaternions(IDENTITY, d.clone(), w);
  const world = bone.getWorldQuaternion(q2).premultiply(d);
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  bone.updateWorldMatrix(false, true);
}

export class MannequinFigure {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private lower: THREE.AnimationAction | null = null;
  private upper: THREE.AnimationAction | null = null;
  private lowerName = "";
  private upperName = "";
  private bones: Record<string, THREE.Object3D> = {};
  private gun: THREE.Object3D | null = null;
  private gunShown = true;
  private mats: THREE.MeshStandardMaterial[] = [];
  private joints: THREE.MeshStandardMaterial | null = null;
  /** knocked out: the death clip, once, then lying still */
  private dead = false;
  /** where the left hand holds the gun, gun-local (its handguard), and how far the reach is blended in */
  private support: THREE.Vector3 | null = null;
  private ikW = 0;
  /**
   * A long gun is not held as the clips hold a pistol, out at arm's length:
   * it hangs off the chest with its stock at the right shoulder, and both
   * hands reach onto it (the grip and the handguard). `mount` is its pivot
   * at the grip; `mountBase` its place in the aim pose; `grip` gun-local.
   */
  private mount: THREE.Object3D | null = null;
  private mountBase = new THREE.Matrix4();
  private grip: THREE.Vector3 | null = null;
  private gripW = 0;
  /** 0..1 the long gun lowered and canted across the body (a sprint, a swap) */
  private lowered = 0;
  /** the figure's own clock, and when a landing's clip and a stagger's end */
  private t = 0;
  private landUntil = -Infinity;
  private staggerSeen = -Infinity;
  private staggerUntil = -Infinity;
  private wasAir = false;
  /** the gun is in the hand and showing this frame */
  gunInHand = false;

  constructor(skin: OperatorSkin, gunId: string | null) {
    const t = template!;
    this.root = cloneSkinned(t.scene);
    this.root.name = "mannequin";
    this.mixer = new THREE.AnimationMixer(this.root);
    this.root.traverse((o) => {
      if ((o as THREE.Bone).isBone) this.bones[o.name] = o;
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) {
        m.castShadow = true;
        m.frustumCulled = false;
        // its own materials, in the operator's colours: the body the shell's, the joints the accent's
        const src = m.material as THREE.MeshStandardMaterial;
        const mat = src.clone();
        if (src.name === "M_Joints") {
          mat.color.setHex(skin.accent);
          this.joints = mat;
        } else mat.color.setHex(skin.shell);
        mat.roughness = 0.55;
        this.mats.push(mat);
        m.material = mat;
      }
    });
    if (gunId) this.setGun(gunId);
  }

  /** a gun into the right hand, held as the aim pose holds it: pointing the way the figure faces */
  setGun(id: string): void {
    const hand = this.bones.hand_r;
    const chest = this.bones.spine_03;
    if (!hand || !template) return;
    this.gun?.removeFromParent();
    this.mount?.removeFromParent();
    this.mount = null;
    const m = displayGunModel(id);
    const gun = m.root.clone(true);
    for (const child of [...gun.children]) if (child.name === "muzzleflash") gun.remove(child);
    gun.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.support = new THREE.Vector3(m.support.x ?? 0, m.support.u, -m.support.f);
    this.grip = new THREE.Vector3(0, m.grip.u, -m.grip.f);
    if (m.support.kind !== "pistol" && chest) {
      // a long gun: its grip a hand's width in from the right shoulder, low and
      // forward, so the stock sits in the shoulder; the muzzle along the facing
      const sh = template.shoulderR;
      const inward = -Math.sign(sh.x || 1) * 0.05;
      const gripAt = new THREE.Vector3(sh.x + inward, sh.y - 0.1, sh.z + 0.24);
      const inFigure = new THREE.Matrix4().compose(gripAt, new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
      this.mountBase.copy(template.chestAim).invert().multiply(inFigure);
      const mount = new THREE.Object3D();
      mount.name = "gunMount";
      this.mountBase.decompose(mount.position, mount.quaternion, mount.scale);
      gun.position.copy(this.grip).negate();
      gun.visible = this.gunShown && !this.dead;
      mount.add(gun);
      chest.add(mount);
      this.mount = mount;
      this.gun = gun;
      return;
    }
    // where the gun sits in the figure's frame in the aim pose: its grip in the
    // hand (a little into the palm), the muzzle forward
    const grip = new THREE.Vector3().setFromMatrixPosition(template.handAim).add(new THREE.Vector3(0.02, -0.02, 0.06));
    const inFigure = new THREE.Matrix4().compose(grip.clone().sub(new THREE.Vector3(0, m.grip.u, m.grip.f)), new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().copy(template.handAim).invert().multiply(inFigure);
    local.decompose(gun.position, gun.quaternion, gun.scale);
    gun.visible = this.gunShown && !this.dead;
    hand.add(gun);
    this.gun = gun;
  }

  /** the right hand's reach onto a long gun's grip, 0..1 (the tests look) */
  get gripReach(): number {
    return this.gripW;
  }

  /** the left hand's reach onto the gun, 0..1 (the tests look) */
  get supportReach(): number {
    return this.ikW;
  }

  /**
   * The left hand onto the gun's support point: a two-bone reach (upper arm,
   * forearm) with the elbow down and out, weighted by `w`. The clips are a
   * pistol's two-hand grip; a rifle's handguard is 20 to 30 cm further out.
   */
  private reachSupport(w: number): void {
    if (this.support) this.reach("l", this.support, w);
  }

  /** one arm (l or r) onto a point on the gun (gun-local), weighted by w */
  private reach(side: "l" | "r", onGun: THREE.Vector3, w: number): void {
    const b = this.bones;
    const up = b[`upperarm_${side}`];
    const lo = b[`lowerarm_${side}`];
    const hand = b[`hand_${side}`];
    if (!up || !lo || !hand || !this.gun || w < 0.01) return;
    this.root.updateMatrixWorld(true);
    const target = this.gun.localToWorld(v4.copy(onGun));
    const a = up.getWorldPosition(v1);
    const bb = lo.getWorldPosition(v2);
    const c = hand.getWorldPosition(v3);
    const lab = a.distanceTo(bb);
    const lbc = bb.distanceTo(c);
    const toT = v5.copy(target).sub(a);
    const dist = Math.max(0.05, Math.min(lab + lbc - 1e-3, toT.length()));
    const dir = toT.normalize();
    // the elbow's side: down and out (the left arm to +x, the figure's left; the right to -x), a little back
    const out = side === "l" ? 0.7 : -0.9;
    const pole = new THREE.Vector3(out, -1, -0.2).applyQuaternion(this.root.getWorldQuaternion(new THREE.Quaternion()));
    pole.addScaledVector(dir, -pole.dot(dir)).normalize();
    const cosA = Math.max(-1, Math.min(1, (lab * lab + dist * dist - lbc * lbc) / (2 * lab * dist)));
    const sinA = Math.sqrt(1 - cosA * cosA);
    const elbow = a.clone().addScaledVector(dir, cosA * lab).addScaledVector(pole, sinA * lab);
    aimBone(up, bb.clone().sub(a), elbow.clone().sub(a), w);
    const b2 = lo.getWorldPosition(new THREE.Vector3());
    const c2 = hand.getWorldPosition(new THREE.Vector3());
    const goal = a.clone().addScaledVector(dir, dist);
    aimBone(lo, c2.sub(b2), goal.sub(b2), w);
  }

  setGunVisible(on: boolean): void {
    this.gunShown = on;
    if (this.gun) this.gun.visible = on && !this.dead;
    this.gunInHand = !!this.gun && this.gun.visible;
  }

  /** the gun in its hand (the figure drops a copy of it when knocked out) */
  get gunObject(): THREE.Object3D | null {
    return this.gun;
  }

  /** knocked out, or back up: the death clip plays once from the start; back up snaps to the pose */
  setDead(on: boolean): void {
    if (on === this.dead) return;
    this.dead = on;
    if (this.gun) this.gun.visible = this.gunShown && !on;
    this.gunInHand = !!this.gun && this.gun.visible;
    if (on) {
      // the library's death is 2.4 s: a game's is quicker (1.5 s)
      this.play("lower", "Death01", 1.6, 0.12, true, "full");
      this.upper?.fadeOut(0.12);
      this.upper = null;
      this.upperName = "";
    } else {
      // up again (a new round, a respawn): the next update picks the clips, at once
      this.mixer.stopAllAction();
      this.lower = this.upper = null;
      this.lowerName = this.upperName = "";
    }
  }

  /** knocked out: only the death clip runs */
  updateDead(dt: number): void {
    this.mixer.update(dt);
  }

  /** the joints glow in the armour's colour (the robot's vest does it on the robot) */
  setArmorColour(hex: number | null): void {
    if (!this.joints) return;
    this.joints.emissive.setHex(hex ?? 0x000000);
    this.joints.emissiveIntensity = hex === null ? 0 : 0.35;
  }

  /** the hit flash: the body lights up for a moment */
  setFlash(amount: number, head: boolean): void {
    for (const m of this.mats) if (m !== this.joints) m.emissive.setRGB(amount * 0.9 + (head ? amount * 0.6 : 0), amount * 0.9 + (head ? amount * 0.3 : 0), amount * 0.9);
  }

  private play(layer: "lower" | "upper", name: string, timeScale: number, fade = 0.18, once = false, source: "lower" | "upper" | "full" = layer): void {
    const key = `${source}:${name}`;
    const clip = template?.clips.get(key) ?? template?.clips.get(`${layer}:Idle_Loop`);
    if (!clip) return;
    if ((layer === "lower" ? this.lowerName : this.upperName) === key) {
      const cur = layer === "lower" ? this.lower : this.upper;
      if (cur) cur.timeScale = timeScale;
      return;
    }
    const next = this.mixer.clipAction(clip);
    next.reset();
    next.timeScale = timeScale;
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, Infinity);
    next.clampWhenFinished = once;
    next.play();
    const prev = layer === "lower" ? this.lower : this.upper;
    if (prev) next.crossFadeFrom(prev, fade, false);
    if (layer === "lower") {
      this.lower = next;
      this.lowerName = key;
    } else {
      this.upper = next;
      this.upperName = key;
    }
  }

  /**
   * One frame: the clips for the pose, the mixer, then the corrections on
   * top (the strafe's hips and spine, the look pitch, a kick, a flinch, a
   * JOLT's lean). `armed`: it has a gun in hand.
   */
  update(p: FigurePose, dt: number, armed: boolean, fx: MannequinImpulses): void {
    const speed = Math.max(0, p.speed);
    this.t += dt;
    // a landing from standing (or a walk): the impact's crouch from the landing clip, briefly
    const air = p.stance === "air";
    if (this.wasAir && !air && (fx.land ?? 0) > 0.4 && speed < 2.6 && p.stance === "stand") this.landUntil = this.t + 0.32;
    this.wasAir = air;
    // the shield broke: the stagger clip on the upper body, once
    if (fx.stagger !== undefined && fx.stagger !== this.staggerSeen && Number.isFinite(fx.stagger)) {
      this.staggerSeen = fx.stagger;
      this.staggerUntil = this.t + 0.3;
    }
    const back = speed > 0.3 && Math.abs(p.moveDir ?? 0) > 1.9;
    const dirSign = back ? -1 : 1;
    // the legs
    let lower = "Idle_Loop";
    let lowerRate = 1;
    let full = false;
    switch (p.stance) {
      case "crouch":
        lower = speed > 0.3 ? "Crouch_Fwd_Loop" : "Crouch_Idle_Loop";
        lowerRate = speed > 0.3 ? (speed / 2.2) * dirSign : 1;
        break;
      case "slide":
        lower = "Slide_Loop";
        full = true;
        break;
      case "air":
        lower = "Jump_Loop";
        break;
      case "climb":
      case "mantle":
        lower = "ClimbUp_1m";
        full = true;
        break;
      case "zip":
        lower = "Idle_Rail_Loop";
        full = true;
        break;
      case "downed":
        lower = "Crouch_Fwd_Loop";
        lowerRate = Math.max(0.2, speed / 2);
        break;
      default:
        if (this.t < this.landUntil) {
          lower = "Jump_Land";
          lowerRate = 2.2;
        } else if (speed > 6.2) {
          lower = "Sprint_Loop";
          lowerRate = (speed / 7.5) * dirSign;
        } else if (speed > 2.6) {
          lower = "Jog_Fwd_Loop";
          lowerRate = (speed / 4.8) * dirSign;
        } else if (speed > 0.3) {
          lower = "Walk_Loop";
          lowerRate = (speed / 1.6) * dirSign;
        }
    }
    // the hands: a full-body clip takes them too; otherwise the gun's pose, or the arms' swing
    let upper = lower;
    let upperRate = lowerRate;
    let once = false;
    if (!full) {
      if (p.act === "heal") {
        upper = "Consume";
        upperRate = 1;
      } else if (this.t < this.staggerUntil && p.stance !== "downed") {
        upper = "Hit_Chest";
        upperRate = 1.1;
        once = true;
      } else if (!armed || p.stance === "downed") {
        upper = lower;
      } else if (p.act === "reload") {
        upper = "Pistol_Reload";
        upperRate = 1;
        once = true;
      } else if (p.act === "swap" || (lower === "Sprint_Loop" && (p.ads ?? 0) < 0.3)) {
        upper = "Pistol_Idle_Loop";
        upperRate = 1;
      } else {
        upper = "Pistol_Aim_Neutral";
        upperRate = 1;
      }
    }
    this.play("lower", lower, lowerRate);
    this.play("upper", upper, upperRate, 0.15, once);
    // no gun in the hand for a heal, or down (the figure says armed = false then)
    if (this.gun) this.gun.visible = this.gunShown && armed && p.act !== "heal" && !this.dead;
    this.gunInHand = !!this.gun && this.gun.visible;
    this.mixer.update(dt);
    // on top of the clips
    const b = this.bones;
    const fig = this.root;
    if (b.pelvis && b.spine_01) {
      turnBone(b.pelvis, fig, Y, fx.legYaw);
      turnBone(b.spine_01, fig, Y, -fx.legYaw);
    }
    const aimed = !full && armed && p.act !== "heal" && p.act !== "swap" && p.stance !== "downed";
    // down: the crouched walk bent over into a crawl, the head up to see
    if (p.stance === "downed") {
      if (b.spine_01) turnBone(b.spine_01, fig, new THREE.Vector3(1, 0, 0), 0.45);
      if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), 0.35);
      if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -0.6);
    }
    const pitch = aimed ? Math.max(-70, Math.min(70, p.pitch)) * DEG : 0;
    // +x is the figure's left: a turn about it by a negative angle tips the chest back (a look up)
    const lean = fx.jolt * 0.45 - fx.flinch * 0.22;
    if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), -pitch * 0.45 + lean * 0.5);
    if (b.spine_03) turnBone(b.spine_03, fig, new THREE.Vector3(1, 0, 0), -pitch * 0.45 + lean * 0.5 - fx.kick * 0.1);
    if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -fx.flinch * 0.25 + 0.1 * fx.ads);
    const shown = !!this.gun && this.gun.visible;
    if (this.mount && this.grip) {
      // a long gun: lowered and canted across the body for a sprint or a swap, up at the shoulder otherwise
      const low = shown && !full && (p.act === "swap" || upper === "Pistol_Idle_Loop") ? 1 : 0;
      this.lowered += (low - this.lowered) * Math.min(1, dt * 8);
      this.mount.position.setFromMatrixPosition(this.mountBase);
      this.mount.quaternion.setFromRotationMatrix(this.mountBase);
      if (this.lowered > 1e-3) {
        this.mount.position.y -= 0.12 * this.lowered;
        this.mount.rotateX(0.75 * this.lowered);
        this.mount.rotateZ(-0.5 * this.lowered);
      }
      // the right hand always on the grip while it shows; the left on the handguard unless the hands are busy
      this.gripW += ((shown && !full ? 1 : 0) - this.gripW) * Math.min(1, dt * 12);
      this.reach("r", this.grip, this.gripW);
      const support = shown && !full && p.act !== "reload" && this.t >= this.staggerUntil;
      this.ikW += ((support ? 1 : 0) - this.ikW) * Math.min(1, dt * 10);
      this.reachSupport(this.ikW);
    } else {
      // a pistol: the aim clip's two-hand grip, the left hand onto the frame's support point
      const holding = aimed && upper === "Pistol_Aim_Neutral" && shown;
      this.ikW += ((holding ? 1 : 0) - this.ikW) * Math.min(1, dt * 10);
      this.reachSupport(this.ikW);
    }
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.root.removeFromParent();
    for (const m of this.mats) m.dispose();
    // each clone has its own skeleton (and its bone texture on the GPU)
    this.root.traverse((o) => {
      const m = o as THREE.SkinnedMesh;
      if (m.isSkinnedMesh) m.skeleton.dispose();
    });
  }
}
