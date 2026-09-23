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
import { fitMuzzle } from "./muzzle";
import { ammoTypeOf } from "./ammo";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { displayGunModel } from "./gunmodels";
import { LOWER as CARRY, REACH, gripAt, reachFraction, stockBehind } from "./hold";
import type { OperatorSkin } from "./operators";
import { buildGear, type GearPiece } from "./gear";
import { OUR_GEOMETRY, buildOutfit, outfitMaterials } from "./outfit";
import outfitCfg from "../config/outfits.json";
import type { FigurePose } from "./dummy";
import type { EmotePose } from "./emotes";

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

/**
 * The garment PARTS: a body, arms, legs, feet, a hood, a shoulder guard, each
 * its own skinned mesh on the same universal rig. This is what a modular
 * outfit pack is for - a ranger's legs under a peasant's shirt is an outfit
 * neither set shipped - and it is how an outfit is real cloth without being a
 * whole second figure.
 *
 * They load ON DEMAND. Loading them all beside the body put 15 MB on every
 * page whether anything wore them or not, and the e2e felt it twice: a mode
 * test and a Resurgence test each found a match that had not started yet. A
 * figure now asks for what its own outfit needs.
 */
const parts = new Map<string, THREE.SkinnedMesh>();
const partLoads = new Map<string, Promise<unknown>>();

/** the first skinned mesh in a loaded file, which is what a part is */
function skinnedIn(o: THREE.Object3D): THREE.SkinnedMesh | null {
  let found: THREE.SkinnedMesh | null = null;
  o.traverse((c) => {
    const m = c as THREE.SkinnedMesh;
    if (!found && m.isSkinnedMesh) found = m;
  });
  return found;
}

/**
 * The bodies. There are two in the pack, a heavier and a lighter build of the
 * same rig, and a garment is cut for one of them: the ranger's coat shaped for
 * the second sits wrong on the first. So an outfit names the body its clothes
 * were made for, and the figure is built on that one.
 *
 * The skeleton is identical either way, which is the part that matters for a
 * shooter: the hit boxes are built from the bones, so nobody is a bigger or a
 * smaller target for the body their clothes came on.
 */
const bodies = new Map<string, THREE.Object3D>();
const bodyLoads = new Map<string, Promise<unknown>>();
const DEFAULT_BODY = "Superhero_Male_FullBody";

/** the body an outfit's clothes were cut for */
export function bodyOf(outfit: string): string {
  return ((outfitCfg.sets as Record<string, { body?: string }>)[outfit]?.body ?? DEFAULT_BODY) as string;
}

/** fetch a body, once */
export function loadBody(name: string): Promise<unknown> {
  const had = bodyLoads.get(name);
  if (had) return had;
  const job = new GLTFLoader()
    .loadAsync(`models/body/${name}.gltf`)
    .then((g) => {
      bodies.set(name, g.scene);
    })
    .catch(() => null);
  bodyLoads.set(name, job);
  return job;
}

/**
 * An outfit's own recoloured atlas (tools/tint-outfits.ts), loaded once.
 *
 * Multiplying a colour into the material was the first try and it could only
 * darken, so every outfit stayed in the atlas's own brown-green family and
 * ARCTIC's white came out as a pale coat. The colour lives in the picture now:
 * the artist's folds and seams as luminance, the outfit's colour over them.
 */
const tintMaps = new Map<string, THREE.Texture | null>();
const tintLoads = new Map<string, Promise<unknown>>();
function tintMap(outfit: string): THREE.Texture | null {
  return tintMaps.get(outfit) ?? null;
}

/**
 * Fetch an outfit's own atlas, once, and only when it has one.
 *
 * Nine of the twenty outfits wear the pack's own colours and have no
 * recoloured atlas made for them. Asking for one anyway was a 404 each, which
 * the catch swallowed and the console did not: the e2e's "no page errors"
 * check is what noticed.
 */
export function loadTint(outfit: string): Promise<unknown> {
  const had = tintLoads.get(outfit);
  if (had) return had;
  if (tintOf(outfit) === null) {
    const none = Promise.resolve(null);
    tintLoads.set(outfit, none);
    tintMaps.set(outfit, null);
    return none;
  }
  const job = new THREE.TextureLoader()
    .loadAsync(`models/outfits/tints/${outfit}.webp`)
    .then((t) => {
      t.flipY = false;
      t.colorSpace = THREE.SRGBColorSpace;
      t.needsUpdate = true;
      tintMaps.set(outfit, t);
    })
    .catch(() => {
      tintMaps.set(outfit, null);
    });
  tintLoads.set(outfit, job);
  return job;
}

/** the colour an outfit paints its garments, or null for the asset's own */
export function tintOf(outfit: string): number | null {
  const t = (outfitCfg.sets as Record<string, { tint?: string }>)[outfit]?.tint;
  return typeof t === "string" ? parseInt(t.replace("#", ""), 16) : null;
}

/** what an outfit is made of, or nothing when it is built in code */
export function partsOf(outfit: string): string[] {
  return (((outfitCfg.sets as Record<string, { parts?: string[] }>)[outfit]?.parts ?? []) as string[]).slice();
}

/** fetch an outfit's parts, once each; resolves when they are all in or given up on */
export function loadOutfit(outfit: string): Promise<unknown> {
  const loader = new GLTFLoader();
  return Promise.all(
    partsOf(outfit).map((n) => {
      const had = partLoads.get(n);
      if (had) return had;
      const job = loader
        .loadAsync(`models/outfits/parts/${n}.gltf`)
        .then((g) => {
          const m = skinnedIn(g.scene);
          if (m) parts.set(n, m);
        })
        .catch(() => null);
      partLoads.set(n, job);
      return job;
    })
  );
}


/** the bones below the waist: the locomotion layer's */
const LOWER = /^(root|pelvis|thigh_|calf_|foot_|ball_)/;

/** load the two files once; figures made after it is in use it */
export function loadMannequin(): Promise<void> {
  if (loading) return loading;
  const loader = new GLTFLoader();
  // The body is a different file from the clips.
  //
  // mannequin.glb is Quaternius's Universal Animation Library: a grey
  // untextured mannequin and the motion. The body is their Universal Base
  // Characters, built on the SAME universal humanoid rig - the Unreal
  // mannequin's own bone names, pelvis / spine_01..03 / clavicle_l /
  // upperarm_l / calf_l / ball_l - so the clips drive it without retargeting,
  // and the clothes hang on the bones they already hang on. It has real
  // topology, a face, and base colour, normal and roughness maps, which is
  // what the grey mannequin never had.
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
      // The real body is an UPGRADE, not a gate.
      //
      // It was in the promise above, and that delayed the moment a figure
      // could stop being a robot by however long 3 MB of body and textures
      // takes. The e2e saw that as a bot with no spine_03 on it: it was still
      // a robot when the check ran. The grey mannequin is 4.4 MB we load
      // anyway and has the same skeleton, so figures start there, and every
      // figure built after the body arrives is the real one.
      void loader
        .loadAsync(`models/body/${DEFAULT_BODY}.gltf`)
        .then((b) => {
          if (!template) return;
          template.scene = b.scene;
          bodies.set(DEFAULT_BODY, b.scene);
          // the hand's aim pose is sampled off whatever the body is
          const p2 = cloneSkinned(b.scene);
          const m2 = new THREE.AnimationMixer(p2);
          m2.clipAction(clips.get("full:Pistol_Aim_Neutral")!).play();
          m2.update(0);
          p2.updateMatrixWorld(true);
          template.handAim = p2.getObjectByName("hand_r")!.matrixWorld.clone();
          template.chestAim = p2.getObjectByName("spine_03")!.matrixWorld.clone();
          template.shoulderR = new THREE.Vector3().setFromMatrixPosition(p2.getObjectByName("upperarm_r")!.matrixWorld);
        })
        .catch(() => null);

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
  /** an emote in progress (emotes.ts): its angles, already eased */
  emote?: EmotePose | null;
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

/**
 * How far a gun's body reaches behind its grip, metres. The model is built
 * pointing along its own -z with the grip `gripF` in front of the origin, so
 * the rearmost point of the box, measured from the grip, is what would end up
 * in the shoulder. Measured on the gun that is actually held, so an extended
 * stock or a long barrel is measured rather than assumed.
 */
function rearOfGrip(gun: THREE.Object3D, gripF: number): number {
  const box = new THREE.Box3().setFromObject(gun);
  return Math.max(0, box.max.z + gripF);
}

export class MannequinFigure {
  readonly root: THREE.Object3D;
  private mixer: THREE.AnimationMixer;
  private lower: THREE.AnimationAction | null = null;
  private upper: THREE.AnimationAction | null = null;
  private lowerName = "";
  private upperName = "";
  private bones: Record<string, THREE.Object3D> = {};
  /**
   * The clip's own rotation of each bone this class turns on top of the clips.
   * three's mixer writes a bone only when the clip's value has changed since
   * the last frame ("value has changed -> update scene graph" in
   * PropertyMixer.apply), and the upper body plays a held pose: after the first
   * frame it never wrote spine_01..03 or the head again, so every frame's
   * turnBone piled onto the last frame's and the torso spun without end. So:
   * the clip's pose goes back on before the mixer runs, is taken again after
   * it, and the edits start from it every frame.
   */
  private clipPose = new Map<THREE.Object3D, THREE.Quaternion>();
  private static readonly EDITED = ["pelvis", "spine_01", "spine_02", "spine_03", "Head", "upperarm_l", "lowerarm_l", "upperarm_r", "lowerarm_r"];
  private restoreClipPose(): void {
    for (const [b, q] of this.clipPose) b.quaternion.copy(q);
  }
  private captureClipPose(): void {
    for (const n of MannequinFigure.EDITED) {
      const b = this.bones[n];
      if (!b) continue;
      const q = this.clipPose.get(b);
      if (q) q.copy(b.quaternion);
      else this.clipPose.set(b, b.quaternion.clone());
    }
  }
  private gun: THREE.Object3D | null = null;
  /** the gun in its hands, for a finish to be painted on (dummy.ts) */
  get gunRoot(): THREE.Object3D | null {
    return this.gun;
  }
  /** its gun's muzzle flash, lit by the figure on a shot */
  flash: THREE.Sprite | null = null;
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
    // the body this outfit's clothes were cut for, if it is here; the one the
    // template holds otherwise, and the next figure gets it right
    const want = bodyOf(skin.outfit);
    const body = bodies.get(want);
    if (!body) void loadBody(want);
    this.root = cloneSkinned(body ?? t.scene);
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
    this.wearGear(skin);
    if (gunId) this.setGun(gunId);
  }

  /** what it is wearing, so a check and a snapshot can name the pieces */
  readonly gear: GearPiece[] = [];

  /**
   * Put the operator's kit on: each piece onto the bone it hangs from, so it
   * moves with the body without being weighted to it. A helmet on the head
   * bone turns when the head turns; a vest on the upper spine leans when the
   * spine leans; and nothing has to deform, because none of it would.
   */
  /**
   * Put real garment meshes on: each one is skinned to the same rig, so it is
   * rebound to THIS figure's bones and then moves with it exactly as the body
   * does - no bone to hang it from, no piece that fails to bend at a knee.
   * The body underneath is hidden where a garment covers it, because two
   * surfaces in the same place fight each other in the depth buffer.
   */
  private wearParts(names: string[], tint: number | null = null, outfit = ""): void {
    for (const n of names) {
      const src = parts.get(n);
      // already on, or not here yet
      if (!src || this.worn.some((w) => w.name === `wear:${n}`)) continue;
      const bones = src.skeleton.bones.map((b) => this.bones[b.name]);
      if (bones.some((b) => !b)) continue;
      // The garment in this outfit's own colour. The pack ships one texture
      // atlas per set, so a tint multiplied into it is how the same coat
      // becomes desert tan on one outfit and night black on another: real
      // cloth, our palette, and no second download.
      const mat = (src.material as THREE.MeshStandardMaterial).clone();
      // its own atlas if one is made for it; the multiply is the fallback
      const map = outfit ? tintMap(outfit) : null;
      if (map) mat.map = map;
      else if (tint !== null) mat.color.setHex(tint);
      const mesh = new THREE.SkinnedMesh(src.geometry, mat);
      mesh.bind(new THREE.Skeleton(bones as THREE.Bone[], src.skeleton.boneInverses), src.bindMatrix);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `wear:${n}`;
      this.root.add(mesh);
      this.worn.push(mesh);
    }
    // The body stays. Hiding it was wrong twice over: the garments in this
    // pack are cut to layer OVER the base body (its own assembled figures
    // include it), and the body is one mesh - head, hands and all - so hiding
    // it took the head with it. That is why the figure in the Loadouts panel
    // had no head.
  }

  /** the outfit's atlas arrived after the clothes went on: put it on them */
  private redressParts(outfit: string): void {
    const map = tintMap(outfit);
    if (!map) return;
    for (const w of this.worn) {
      const m = w.material as THREE.MeshStandardMaterial;
      m.map = map;
      m.color.setHex(0xffffff);
      m.needsUpdate = true;
    }
  }

  /** the garment meshes this figure is wearing */
  private worn: THREE.SkinnedMesh[] = [];

  private wearGear(skin: OperatorSkin): void {
    this.root.updateMatrixWorld(true);
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    // the clothes first, then the kit on top of them (src/game/outfit.ts).
    // A sleeve hangs on the arm bone and turns with it, so it is added raw;
    // what goes on a face is authored the way a person would describe it and
    // gets the same rest-frame holder the kit does.
    // real garment parts, if this outfit is made of them
    // Real garment meshes, if this outfit is made of them. They are fetched
    // on demand, so a figure built before they land wears what is there and
    // puts the rest on when it arrives - which is one frame later on this
    // machine and a second on a bad connection, either way better than every
    // page in the game waiting for clothes nobody asked for.
    const want = partsOf(skin.outfit);
    if (want.length) {
      const tint = tintOf(skin.outfit);
      this.wearParts(want, tint, skin.outfit);
      // The parts and the outfit's own atlas both arrive late on a cold page,
      // and BOTH are asked for here. The first try only started the atlas
      // inside the dressing loop, which a cold page never reaches because the
      // parts are not in yet: every figure wore the multiply instead and the
      // recoloured atlases were never seen.
      const outfit = skin.outfit;
      void Promise.all([loadOutfit(outfit), loadTint(outfit)]).then(() => {
        this.wearParts(want, tint, outfit);
        this.redressParts(outfit);
      });
    }
    const mats = outfitMaterials(skin.outfit, skin.visor, skin.eye);
    // a real outfit brings its own clothes; only what goes on the face is ours
    const all = buildOutfit(skin.outfit, mats, skin.face ?? [], skin.build ?? "regular");
    // a figure in real cloth wears only what the player put on its face
    const built = partsOf(skin.outfit).length ? all.filter((w) => w.bone === "Head") : all;
    for (const worn of built) {
      const bone = this.bones[worn.bone];
      if (!bone) continue;
      if (!worn.aligned) {
        bone.add(worn.group);
        continue;
      }
      const holder = new THREE.Group();
      holder.name = `wearMount:${worn.id}`;
      holder.quaternion.copy(bone.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rootQ));
      holder.add(worn.group);
      bone.add(holder);
    }
    // The kit is OURS, built in code out of boxes, and on a figure wearing
    // real cloth it is exactly what the owner spotted: our shapes stacked on
    // top of somebody's asset. The pack already brings a hood and a shoulder
    // guard of its own, and a plate carrier of boxes over a ranger's coat
    // reads as what it is. So a real-cloth outfit wears no kit at all; what
    // stays is the face, because nothing in the pack covers a pair of eyes and
    // the rule is that everybody's are covered.
    for (const piece of !OUR_GEOMETRY() || partsOf(skin.outfit).length ? [] : buildGear(skin)) {
      const bone = this.bones[piece.bone];
      if (!bone) continue;
      // Each piece is authored the way a person would describe it: so far up
      // the head, so far in front of the chest. A bone is not authored that
      // way (this rig's head bone leans, its arm bones point down their own
      // length), so the piece goes on a holder that undoes the bone's rest
      // turn. The holder still turns WITH the bone from there, which is what
      // a helmet and a vest do.
      const holder = new THREE.Group();
      holder.name = `gearMount:${piece.id}`;
      holder.add(piece.group);
      bone.add(holder);
      this.gear.push(piece);
    }
    this.fitGear(rootQ);
  }

  /**
   * Point every holder the way the figure points in its rest pose, so a piece
   * can be authored the way a person would describe it: so far up the head, so
   * far in front of the chest. From there each holder turns with its bone, so
   * a helmet leans when the head leans into the sights and a vest turns with
   * the chest, which is what a helmet and a vest do.
   */
  private fitGear(rootQ?: THREE.Quaternion): void {
    this.root.updateMatrixWorld(true);
    const rq = rootQ ?? this.root.getWorldQuaternion(new THREE.Quaternion());
    for (const piece of this.gear) {
      const holder = piece.group.parent;
      if (!holder?.parent) continue;
      holder.quaternion.copy(holder.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(rq));
    }
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
    // the model's own flash out, a marker with a flash sprite in its place (muzzle.ts)
    this.flash = fitMuzzle(gun, ammoTypeOf(id) === "energy", m.muzzle);
    gun.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
    });
    this.support = new THREE.Vector3(m.support.x ?? 0, m.support.u, -m.support.f);
    this.grip = new THREE.Vector3(0, m.grip.u, -m.grip.f);
    if (m.support.kind !== "pistol" && chest) {
      // A long gun: its stock in the shoulder pocket, which is OUTBOARD of the
      // joint and not inboard of it, its grip below and in front. How far in
      // front is the gun's own business: a carbine needs less room behind the
      // grip than a sniper with a full stock, and a gun given the carbine's
      // room has its stock through the chest (src/game/hold.ts).
      const sh = template.shoulderR;
      this.rear = rearOfGrip(gun, m.grip.f);
      const at = gripAt({ x: sh.x, y: sh.y, z: sh.z }, this.rear);
      const gripAtV = new THREE.Vector3(at.x, at.y, at.z);
      const inFigure = new THREE.Matrix4().compose(gripAtV, new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), new THREE.Vector3(1, 1, 1));
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

  /** how far this gun reaches behind its own grip, metres (0 for a pistol) */
  rear = 0;
  /**
   * Where the gun ended up, for the checks: how far behind the shoulder its
   * stock sits (positive is behind, and a stock is allowed a little), and how
   * far each hand is from the hold it is reaching for. A hand further than a
   * few centimetres off is the floating hand.
   */
  holdGaps(): { stock: number; grip: number; support: number; slide: number } | null {
    if (!this.gun || !this.grip || !this.support) return null;
    this.root.updateMatrixWorld(true);
    const gap = (side: "l" | "r", onGun: THREE.Vector3): number => {
      const hand = this.bones[`hand_${side}`];
      if (!hand) return 0;
      return hand.getWorldPosition(new THREE.Vector3()).distanceTo(this.gun!.localToWorld(onGun.clone()));
    };
    // the support gap is measured against the hold the hand is reaching for,
    // which on a long gun is further back than the handguard (supportHold)
    return { stock: this.mount ? stockBehind(this.rear) : 0, grip: gap("r", this.grip), support: gap("l", this.supportHold()), slide: this.supportSlide };
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
    if (!this.support) return;
    this.reach("l", this.supportHold(), w);
  }

  /**
   * Where the support hand takes hold this frame. Normally the handguard; on
   * a gun too long for the arm, as far along it as the arm reaches
   * (src/game/hold.ts reachFraction). The hand is then holding the gun in a
   * place a person would hold it, rather than hanging in the air beside the
   * place it could not get to, which is what the owner saw.
   */
  private supportHold(): THREE.Vector3 {
    const held = this.support!;
    const up = this.bones.upperarm_l;
    const lo = this.bones.lowerarm_l;
    const hand = this.bones.hand_l;
    if (!up || !lo || !hand || !this.grip || !this.gun) return held;
    this.root.updateMatrixWorld(true);
    const shoulder = up.getWorldPosition(v1);
    const arm = shoulder.distanceTo(lo.getWorldPosition(v2)) + lo.getWorldPosition(v2).distanceTo(hand.getWorldPosition(v3));
    const a = this.gun.localToWorld(v4.copy(held));
    const b = this.gun.localToWorld(v5.copy(this.grip));
    const t = reachFraction([a.x - shoulder.x, a.y - shoulder.y, a.z - shoulder.z], [b.x - a.x, b.y - a.y, b.z - a.z], arm * 0.98);
    this.supportSlide = t;
    return t < 1e-3 ? held : this.supportAt.copy(held).lerp(this.grip, t);
  }

  /** how far back along the gun the support hand had to slide, 0..1 (the tests look) */
  supportSlide = 0;
  private readonly supportAt = new THREE.Vector3();

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
    // the last live frame's turns come off first, so the death clip starts clean
    this.restoreClipPose();
    this.mixer.update(dt);
    this.captureClipPose();
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
  /** the time of the frames it sat out (figlod.ts): given to the mixer when its turn comes, so nothing drifts */
  private owed = 0;

  /**
   * Its pose this frame. `animate` false is a frame it sits out at distance
   * (figlod.ts): the time is kept and handed over on the next one it plays.
   */
  update(p: FigurePose, dt: number, armed: boolean, fx: MannequinImpulses, animate = true): void {
    if (!animate) {
      this.owed += dt;
      return;
    }
    dt += this.owed;
    this.owed = 0;
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
    // an emote: the gun put away, the arms hanging from the legs' clip, and the pose on top (below)
    const em = fx.emote && fx.emote.weight > 0.02 ? fx.emote : null;
    if (em) armed = false;
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
    this.restoreClipPose();
    this.mixer.update(dt);
    this.captureClipPose();
    // on top of the clips
    const b = this.bones;
    const fig = this.root;
    if (b.pelvis && b.spine_01) {
      turnBone(b.pelvis, fig, Y, fx.legYaw);
      turnBone(b.spine_01, fig, Y, -fx.legYaw);
    }
    const aimed = !full && armed && p.act !== "heal" && p.act !== "swap" && p.stance !== "downed";
    // Down: the crouched walk bent right over into a crawl, the head up to
    // see. At 45 degrees a knocked figure at 30 m read as a live one
    // crouching, which is the one thing a knock has to not look like: bent to
    // about 70 and sunk (below), it is low and plainly out of the fight.
    if (p.stance === "downed") {
      if (b.spine_01) turnBone(b.spine_01, fig, new THREE.Vector3(1, 0, 0), 0.7);
      if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), 0.5);
      if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -0.95);
    }
    const pitch = aimed ? Math.max(-70, Math.min(70, p.pitch)) * DEG : 0;
    // +x is the figure's left: a turn about it by a negative angle tips the chest back (a look up)
    const lean = fx.jolt * 0.45 - fx.flinch * 0.22;
    if (b.spine_02) turnBone(b.spine_02, fig, new THREE.Vector3(1, 0, 0), -pitch * 0.45 + lean * 0.5);
    if (b.spine_03) turnBone(b.spine_03, fig, new THREE.Vector3(1, 0, 0), -pitch * 0.45 + lean * 0.5 - fx.kick * 0.1);
    if (b.Head) turnBone(b.Head, fig, new THREE.Vector3(1, 0, 0), -fx.flinch * 0.25 + 0.1 * fx.ads);
    // The emote, on top of everything: the arms raised and swung in figure
    // space (+x is the figure's left, +z its front), the forearms bent at the
    // elbow, the spine and the head turned, the hips swung. Each angle arrives
    // eased, so the figure goes into it and comes out of it smoothly.
    if (em) {
      const X = new THREE.Vector3(1, 0, 0);
      const Z = new THREE.Vector3(0, 0, 1);
      if (b.pelvis) turnBone(b.pelvis, fig, Y, em.hipSway);
      if (b.spine_02) {
        turnBone(b.spine_02, fig, Y, em.spineTwist);
        turnBone(b.spine_02, fig, X, em.spineLean);
        turnBone(b.spine_02, fig, Z, -em.spineSide);
      }
      if (b.Head) {
        turnBone(b.Head, fig, X, em.headNod);
        turnBone(b.Head, fig, Z, -em.headTilt);
      }
      // the right arm hangs toward -x's side: raising it turns it about the front axis the negative way
      if (b.upperarm_r) {
        turnBone(b.upperarm_r, fig, Z, -em.rRaise);
        turnBone(b.upperarm_r, fig, X, -em.rForward);
      }
      if (b.lowerarm_r) {
        turnBone(b.lowerarm_r, fig, Z, -em.rElbow);
        turnBone(b.lowerarm_r, fig, X, -em.rElbowF);
      }
      if (b.upperarm_l) {
        turnBone(b.upperarm_l, fig, Z, em.lRaise);
        turnBone(b.upperarm_l, fig, X, -em.lForward);
      }
      if (b.lowerarm_l) {
        turnBone(b.lowerarm_l, fig, Z, em.lElbow);
        turnBone(b.lowerarm_l, fig, X, -em.lElbowF);
      }
      this.root.position.y = em.bounce;
    } else this.root.position.y = p.stance === "downed" ? -0.15 : 0;
    const shown = !!this.gun && this.gun.visible;
    if (this.mount && this.grip) {
      // a long gun: lowered and canted across the body for a sprint or a swap, up at the shoulder otherwise
      const low = shown && !full && (p.act === "swap" || upper === "Pistol_Idle_Loop") ? 1 : 0;
      this.lowered += (low - this.lowered) * Math.min(1, dt * REACH.lower);
      this.mount.position.setFromMatrixPosition(this.mountBase);
      this.mount.quaternion.setFromRotationMatrix(this.mountBase);
      if (this.lowered > 1e-3) {
        this.mount.position.y -= CARRY.drop * this.lowered;
        this.mount.rotateX(CARRY.pitch * this.lowered);
        this.mount.rotateZ(CARRY.roll * this.lowered);
      }
      // the right hand always on the grip while it shows; the left on the handguard unless the hands are busy
      this.gripW += ((shown && !full ? 1 : 0) - this.gripW) * Math.min(1, dt * REACH.grip);
      this.reach("r", this.grip, this.gripW);
      const support = shown && !full && p.act !== "reload" && this.t >= this.staggerUntil;
      this.ikW += ((support ? 1 : 0) - this.ikW) * Math.min(1, dt * REACH.support);
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
