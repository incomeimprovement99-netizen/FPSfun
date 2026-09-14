// Training dummy: three hit zones (head / body / legs), health + shield
// tiers, damage application, knock and respawn.
//
// The body you SEE and the body you HIT are now two different things.
//
// The hit zones are the same boxes and sphere they always were, with the same
// dimensions to the millimetre (tools/verify.ts pins the neck-gap numbers), but
// they are drawn with an invisible material. Over them sits a jointed training
// robot: a lathed torso, capsule limbs, ball joints, a visored head. The old
// dummy WAS its hitboxes, which is exactly the Roblox look: a figure made of
// the boxes a physics engine uses.
//
// The visual body sits inside the hit zones everywhere, so a round that
// visibly lands on the robot always registers. The robot is our own design, a
// generic range mannequin, and deliberately not any game's character.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { displayGunModel } from "./gunmodels";
import { OPERATORS, skinMaterials, type OperatorSkin } from "./operators";

export type Zone = "head" | "body" | "legs";
export type ArmorTier = 0 | 1 | 2 | 3 | 4;
export const ARMOR_SHIELD: Record<ArmorTier, number> = { 0: 0, 1: 50, 2: 75, 3: 100, 4: 125 };
export const ARMOR_NAME: Record<ArmorTier, string> = { 0: "no armor", 1: "white", 2: "blue", 3: "purple", 4: "red" };
export const ARMOR_COLOR: Record<ArmorTier, number> = { 0: 0xd84a3a, 1: 0xe8e8e8, 2: 0x3b8bff, 3: 0xb04cff, 4: 0xff3b3b };

export interface HitReport {
  zone: Zone;
  amount: number;
  toShield: number;
  toHealth: number;
  broke: boolean;
  knocked: boolean;
  headshot: boolean;
  point: THREE.Vector3;
}

const HEALTH_MAX = 100;
const RESPAWN_S = 1.2;
const FALL_S = 0.32;

// human hull, metres (72 units tall)
const H = 72 * 0.0254;

/**
 * Hit zones render nothing, but the MESH stays visible. That distinction is
 * load-bearing: ProjectileSystem skips meshes whose `visible` is false (three's
 * raycaster would otherwise hit hidden ones), and the armour plate still uses
 * mesh visibility to switch itself off at tier 0.
 */
const HITBOX = new THREE.MeshBasicMaterial({ visible: false });

// ---------------------------------------------------------------- shared geo

const up = new THREE.Vector3(0, 1, 0);

/** a capsule limb between two points */
function limb(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, 14), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(up, d.normalize());
  return m;
}

function ball(p: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
  m.position.copy(p);
  return m;
}

/**
 * The torso as a lathe: chest broad at the shoulders, narrow at the waist,
 * flaring at the hips, then squashed front to back so the cross-section is an
 * ellipse rather than a barrel.
 */
function torsoGeometry(): THREE.BufferGeometry {
  const pts = [
    [0.0, 0.93],
    [0.15, 0.935],
    [0.168, 0.97],
    [0.16, 1.02],
    [0.138, 1.08],
    [0.142, 1.15],
    [0.178, 1.26],
    [0.205, 1.36],
    [0.212, 1.42],
    [0.196, 1.475],
    [0.15, 1.515],
    [0.07, 1.54],
    [0.0, 1.545],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  g.scale(1, 1, 0.64);
  return g;
}

/** a shell covering only the chest, worn over the torso as the armour vest */
function vestGeometry(): THREE.BufferGeometry {
  const pts = [
    [0.15, 1.16],
    [0.186, 1.26],
    [0.214, 1.36],
    [0.222, 1.42],
    [0.206, 1.47],
    [0.165, 1.5],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 28);
  g.scale(1, 1, 0.68);
  return g;
}

let torsoGeo: THREE.BufferGeometry | null = null;
let vestGeo: THREE.BufferGeometry | null = null;

// joint, visor and eye materials come from the operator skin (operators.ts)
const seamMat = new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.8 });
const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4047, roughness: 0.5, metalness: 0.55 });

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * Bake a group of static meshes into one mesh per material. The robot is about
 * sixty primitives, and with thirteen dummies each drawn twice (once for the
 * shadow map) that was over 1,500 draw calls for the dummies alone. Every part
 * is rigid relative to the dummy, so merging loses nothing and leaves about
 * seven draw calls per dummy. `keep` meshes stay separate because they toggle.
 */
function bake(src: THREE.Group, keep: Set<THREE.Object3D>): THREE.Group {
  src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(src.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const out = new THREE.Group();
  src.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    if (keep.has(m)) return;
    const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    g.clearGroups();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    const mat = m.material as THREE.Material;
    const list = byMat.get(mat) ?? [];
    list.push(g);
    byMat.set(mat, list);
  });
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
    for (const g of geos) g.dispose();
  }
  for (const k of keep) {
    k.removeFromParent();
    out.add(k);
  }
  return out;
}

export interface DummyOptions {
  /** a weapon id: the robot holds it at the aim, pointing where it faces */
  armed?: string;
  /** any hit drops it, for the course's pop-up targets */
  oneHit?: boolean;
  /** stand back up after being knocked; false keeps it down until reset */
  respawn?: boolean;
  /** the operator look; the range's own dummies use the default */
  skin?: OperatorSkin;
}

export class Dummy {
  readonly group = new THREE.Group();
  readonly hitMeshes: THREE.Mesh[] = [];
  health = HEALTH_MAX;
  shield = 0;
  shieldMax = 0;
  tier: ArmorTier = 0;
  knocked = false;
  /** time of the FIRST hit on this dummy since it was last full, or null */
  engagedAt: number | null = null;
  /** if set, this dummy tracks left and right along a rail */
  rail: { z: number; minX: number; maxX: number; speed: number } | null = null;
  private railDir = 1;
  private respawnAt = 0;
  private fall = 0;
  private flash = 0;
  private headFlash = 0;
  /** 0..1 rising from the ground after a pop-up; 1 when upright */
  private rise = 1;
  /** 0..1 Digital Threat highlight */
  private threat = 0;
  readonly oneHit: boolean;
  readonly respawns: boolean;
  private readonly plate: THREE.Mesh;
  private readonly shell: THREE.MeshStandardMaterial;
  private readonly headShell: THREE.MeshStandardMaterial;
  private readonly accent: THREE.MeshStandardMaterial;
  private readonly vest: THREE.Mesh;
  private readonly vestMat: THREE.MeshStandardMaterial;
  private readonly ringMat: THREE.MeshStandardMaterial;
  /** the merged robot body: its geometry is this dummy's own */
  private readonly baked: THREE.Group;
  readonly distanceLabel: number;
  /** the operator this figure wears */
  readonly skin: OperatorSkin;

  constructor(x: number, z: number, distanceLabel: number, opts: DummyOptions = {}) {
    this.distanceLabel = distanceLabel;
    this.oneHit = opts.oneHit ?? false;
    this.respawns = opts.respawn ?? true;
    // Yaw first, then the fall, so an armed dummy turned to face you falls
    // away from you rather than along the world axis.
    this.group.rotation.order = "YXZ";
    const armed = opts.armed ?? null;
    const skin = opts.skin ?? OPERATORS[0];
    this.skin = skin;
    const { joint: jointMat, visor: visorMat, eye: eyeMat } = skinMaterials(skin);

    // ---------------- hit zones: unchanged dimensions, invisible
    // legs: 0..0.92 m
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.92, 0.3), HITBOX);
    legs.position.y = 0.46;
    legs.userData.zone = "legs";
    // torso: 0.92..1.55 m. The top must reach the head sphere's bottom
    // (1.5488) or a round through the neck registers no hit at all.
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.63, 0.32), HITBOX);
    torso.position.y = 1.235;
    torso.userData.zone = "body";
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.14), HITBOX);
    armL.position.set(-0.33, 1.2, 0);
    armL.userData.zone = "body";
    const armR = armL.clone();
    armR.position.x = 0.33;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.1, 10), HITBOX);
    neck.position.y = 1.58;
    neck.userData.zone = "body";
    // head: sphere r 0.13 at 1.68 m (total ~1.83 m)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 14), HITBOX);
    head.position.y = H - 0.15;
    head.userData.zone = "head";
    // armour plate: visibility still switches it off at tier 0
    this.plate = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.06), HITBOX);
    this.plate.position.set(0, 1.28, 0.19);
    this.plate.userData.zone = "body";
    for (const m of [legs, torso, armL, armR, neck, head, this.plate]) {
      m.castShadow = false;
      this.group.add(m);
      this.hitMeshes.push(m);
    }

    // ---------------- the visible robot
    // Per-dummy shell materials, so a hit can flash just this one.
    // Light grey, not white. At 0xc3c9cf in full sun the shell clipped to a
    // flat white silhouette and lost all its shading, which is the one thing
    // that makes a rounded form read as rounded.
    this.shell = new THREE.MeshStandardMaterial({ color: skin.shell, roughness: 0.48, metalness: 0.08 });
    this.headShell = new THREE.MeshStandardMaterial({ color: skin.head, roughness: 0.4, metalness: 0.08 });
    this.accent = new THREE.MeshStandardMaterial({ color: skin.accent, roughness: 0.55, metalness: 0.1 });
    this.vestMat = new THREE.MeshStandardMaterial({ color: ARMOR_COLOR[1], roughness: 0.35, metalness: 0.3, emissive: ARMOR_COLOR[1], emissiveIntensity: 0.25 });
    const b = new THREE.Group();
    const S = this.shell;
    const A = this.accent;

    // head: a slightly tall ovoid with a wraparound visor and a lit eye strip
    const headY = H - 0.15;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.118, 28, 20), this.headShell);
    skull.scale.set(1, 1.1, 1.02);
    skull.position.y = headY;
    b.add(skull);
    const visor = new THREE.Mesh(new THREE.SphereGeometry(0.1215, 28, 8, Math.PI / 2 - 0.95, 1.9, Math.PI / 2 - 0.32, 0.46), visorMat);
    visor.scale.set(1, 1.1, 1.02);
    visor.position.y = headY;
    b.add(visor);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1222, 28, 3, Math.PI / 2 - 0.7, 1.4, Math.PI / 2 - 0.13, 0.05), eyeMat);
    eye.scale.set(1, 1.1, 1.02);
    eye.position.y = headY;
    b.add(eye);
    for (const sx of [-1, 1]) {
      const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.03, 18), A);
      pod.rotation.z = Math.PI / 2;
      pod.position.set(sx * 0.118, headY + 0.005, -0.005);
      b.add(pod);
    }
    // neck: a ribbed joint
    b.add(limb(v(0, 1.5, 0), v(0, 1.585, 0), 0.05, jointMat));
    for (const y of [1.52, 1.55]) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 6, 18), seamMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.y = y;
      b.add(rib);
    }

    // torso, waist joint and pelvis
    torsoGeo ??= torsoGeometry();
    b.add(new THREE.Mesh(torsoGeo, S));
    const waist = new THREE.Mesh(new THREE.CylinderGeometry(0.128, 0.138, 0.06, 24), jointMat);
    waist.scale.z = 0.68;
    waist.position.y = 1.06;
    b.add(waist);
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.165, 24, 14, 0, Math.PI * 2, Math.PI / 2 - 0.2, Math.PI / 2), S);
    pelvis.scale.set(1, 0.9, 0.66);
    pelvis.position.y = 0.99;
    b.add(pelvis);
    // chest panel with a status light, and a seam down the sternum
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.02), A);
    panel.position.set(0, 1.34, 0.13);
    panel.rotation.x = -0.12;
    b.add(panel);
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.01), eyeMat);
    light.position.set(0.05, 1.37, 0.142);
    light.rotation.x = -0.12;
    b.add(light);
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.2, 0.01), seamMat);
    seam.position.set(0, 1.18, 0.105);
    b.add(seam);
    // armour vest in the tier colour
    vestGeo ??= vestGeometry();
    this.vest = new THREE.Mesh(vestGeo, this.vestMat);
    b.add(this.vest);

    // arms, hanging slightly out from the body so they sit inside the arm zones
    for (const sx of [-1, 1]) {
      const sh = v(sx * 0.225, 1.44, 0);
      // Armed: both arms forward to the gun, right hand on the grip and the
      // left supporting it. Unarmed: hanging slightly out from the body.
      const el = armed ? v(sx * 0.21, 1.3, 0.22) : v(sx * 0.3, 1.17, 0.01);
      const wr = armed ? (sx > 0 ? v(0.07, 1.36, 0.43) : v(-0.01, 1.34, 0.47)) : v(sx * 0.32, 0.93, 0.03);
      const pad = new THREE.Mesh(new THREE.SphereGeometry(0.078, 18, 12), S);
      pad.scale.set(1, 0.85, 0.95);
      pad.position.copy(sh);
      b.add(pad);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.008, 6, 18), A);
      band.position.set(sh.x, sh.y - 0.04, sh.z);
      band.rotation.x = Math.PI / 2;
      b.add(band);
      b.add(limb(sh, el, 0.046, S));
      b.add(ball(el, 0.045, jointMat));
      b.add(limb(el, wr, 0.04, S));
      const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.05, 4, 10), jointMat);
      hand.scale.set(0.75, 1, 1);
      if (armed) hand.position.set(wr.x, wr.y - 0.03, wr.z + 0.02);
      else hand.position.set(wr.x + sx * 0.004, wr.y - 0.07, wr.z);
      b.add(hand);
    }

    // legs
    for (const sx of [-1, 1]) {
      const hip = v(sx * 0.098, 0.9, 0);
      const knee = v(sx * 0.108, 0.49, 0.012);
      const ankle = v(sx * 0.108, 0.1, 0);
      b.add(ball(hip, 0.066, jointMat));
      b.add(limb(hip, knee, 0.07, S));
      b.add(ball(knee, 0.056, jointMat));
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), A);
      cap.scale.set(1, 1.2, 0.6);
      cap.position.set(knee.x, knee.y, knee.z + 0.045);
      b.add(cap);
      b.add(limb(knee, ankle, 0.056, S));
      b.add(ball(ankle, 0.042, jointMat));
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.042, 0.13, 4, 10), jointMat);
      foot.rotation.x = Math.PI / 2;
      foot.scale.set(1.1, 1, 0.75);
      foot.position.set(ankle.x, 0.035, 0.03);
      b.add(foot);
    }

    // the operator's add-ons
    const ex = skin.extras;
    if (ex.crest) {
      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.09, 0.2), A);
      crest.position.set(0, headY + 0.13, -0.01);
      crest.rotation.x = -0.25;
      b.add(crest);
    }
    if (ex.antenna) {
      b.add(limb(v(0.07, headY + 0.08, 0.02), v(0.1, headY + 0.34, -0.03), 0.006, jointMat));
      b.add(ball(v(0.1, headY + 0.35, -0.03), 0.016, eyeMat));
    }
    if (ex.brim) {
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.012, 28), A);
      brim.position.set(0, headY + 0.07, 0);
      b.add(brim);
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), A);
      hood.scale.set(1, 0.8, 1);
      hood.position.set(0, headY + 0.07, 0);
      b.add(hood);
    }
    if (ex.mask) {
      const mask = new THREE.Mesh(new THREE.SphereGeometry(0.124, 20, 8, Math.PI / 2 - 0.9, 1.8, Math.PI / 2 + 0.15, 0.55), A);
      mask.scale.set(1, 1.1, 1.05);
      mask.position.y = headY;
      b.add(mask);
    }
    if (ex.shoulders) {
      for (const sx of [-1, 1]) {
        const plate = new THREE.Mesh(new THREE.SphereGeometry(0.11, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), A);
        plate.scale.set(1.05, 0.75, 1.1);
        plate.position.set(sx * 0.235, 1.45, 0);
        plate.rotation.z = sx * -0.35;
        b.add(plate);
      }
    }

    this.vest.castShadow = true;
    this.baked = bake(b, new Set<THREE.Object3D>([this.vest]));
    this.group.add(this.baked);

    // The gun, pointing the way the robot faces (+z). Model space has the
    // muzzle down -z, so it turns half round, and it is placed so its grip
    // lands in the right hand.
    if (armed) {
      // an untouched copy: the viewmodel's own gun carries your optic, your
      // magazine colour and a bolt caught mid-cycle
      const m = displayGunModel(armed);
      const gun = m.root.clone(true);
      gun.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true;
      });
      for (const child of [...gun.children]) if (child.name === "muzzleflash") gun.remove(child);
      gun.rotation.y = Math.PI;
      gun.position.set(0.07, 1.33 - m.grip.u, 0.45 - m.grip.f);
      this.group.add(gun);
    }

    // base plinth with a lit ring in the armour colour
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.05, 32), baseMat);
    ring.position.y = 0.025;
    ring.receiveShadow = true;
    this.group.add(ring);
    this.ringMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0x39d7ee, emissiveIntensity: 1.8 });
    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.008, 6, 40), this.ringMat);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = 0.05;
    this.group.add(glow);

    this.group.position.set(x, 0, z);
    this.setTier(0);
  }

  setTier(t: ArmorTier): void {
    this.tier = t;
    this.shieldMax = ARMOR_SHIELD[t];
    this.shield = this.shieldMax;
    this.health = this.oneHit ? 1 : HEALTH_MAX;
    this.plate.visible = t !== 0;
    this.vest.visible = t !== 0;
    if (t !== 0) {
      this.vestMat.color.setHex(ARMOR_COLOR[t]);
      this.vestMat.emissive.setHex(ARMOR_COLOR[t]);
      this.ringMat.emissive.setHex(ARMOR_COLOR[t]);
    } else {
      this.ringMat.emissive.setHex(0x39d7ee);
    }
    this.engagedAt = null;
  }

  /** course pop-up: appear lying down and swing upright */
  popUp(): void {
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.rise = 0;
    this.group.visible = true;
    this.group.rotation.x = -Math.PI / 2 + 0.2;
  }

  /** course reset: gone, and not hittable (hidden groups are skipped) */
  hide(): void {
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.rise = 1;
    this.group.visible = false;
    this.group.rotation.x = 0;
  }

  /**
   * Seen through a Digital Threat optic: the shell glows red. 0 is off; the
   * caller fades it with distance, as the data's fade range says.
   */
  setThreat(amount: number): void {
    if (Math.abs(amount - this.threat) < 0.01) return;
    this.threat = amount;
    this.applyGlow();
  }

  /**
   * Shell emissive: the hit flash, plus the threat highlight. The highlight
   * also darkens the grey shell, or red light on top of light grey paint
   * reads pink rather than the solid red a threat optic shows.
   */
  private applyGlow(): void {
    const t = this.threat;
    const f = this.flash * 0.9;
    // Kept under 1: filmic tone mapping pushes a brighter red toward orange.
    this.shell.color.setHex(this.skin.shell).multiplyScalar(1 - 0.9 * t);
    this.headShell.color.setHex(this.skin.head).multiplyScalar(1 - 0.9 * t);
    this.shell.emissive.setRGB(f + t * 0.95, f + t * 0.02, f + t * 0.02);
    this.headShell.emissive.setRGB(this.headFlash * 1.6 + t * 0.95, this.headFlash * 1.1 + t * 0.02, this.headFlash * 0.2 + t * 0.02);
  }

  /**
   * Free what this figure alone owns: its merged body, hit boxes and its own
   * materials. The vest shape, the gun (it shares the gun model's geometry) and
   * the skin materials are shared, and stay. For figures that are replaced
   * while playing, like the 1v1 opponent's.
   */
  dispose(): void {
    this.group.removeFromParent();
    for (const o of this.baked.children) if (o !== this.vest) (o as THREE.Mesh).geometry?.dispose();
    for (const m of this.hitMeshes) m.geometry.dispose();
    for (const mat of [this.shell, this.headShell, this.accent, this.vestMat, this.ringMat]) mat.dispose();
  }

  /** knocked by something other than a hit here (the 1v1 opponent going down) */
  fallDown(): void {
    if (this.knocked) return;
    this.knocked = true;
    this.fall = 0.0001;
    this.respawnAt = Infinity;
  }

  reset(): void {
    this.setTier(this.tier);
    this.knocked = false;
    this.fall = 0;
    this.group.rotation.x = 0;
    this.group.visible = true;
  }

  /**
   * Apply a hit. `now` is the GAME clock (the same one passed to update()),
   * not wall time: mixing the two meant a knocked dummy never respawned.
   */
  hit(now: number, zone: Zone, baseDamage: number, headshotScale: number, legScale: number, point: THREE.Vector3): HitReport | null {
    if (this.knocked) return null;
    const mult = zone === "head" ? headshotScale : zone === "legs" ? legScale : 1;
    const amount = Math.floor(baseDamage * mult + 1e-6);
    if (this.oneHit) {
      this.health = 0;
      this.knocked = true;
      this.fall = 0.0001;
      this.respawnAt = now + RESPAWN_S;
      if (zone === "head") this.headFlash = 1;
      else this.flash = 1;
      return { zone, amount, toShield: 0, toHealth: amount, broke: false, knocked: true, headshot: zone === "head", point: point.clone() };
    }
    let remaining = amount;
    const toShield = Math.min(this.shield, remaining);
    this.shield -= toShield;
    remaining -= toShield;
    const toHealth = Math.min(this.health, remaining);
    this.health -= toHealth;
    const broke = toShield > 0 && this.shield === 0;
    const knocked = this.health <= 0;
    // hit flash: the whole shell for a body hit, the head alone for a headshot
    if (zone === "head") this.headFlash = 1;
    else this.flash = 1;
    if (broke) this.vest.visible = false;
    if (knocked) {
      this.knocked = true;
      this.respawnAt = now + RESPAWN_S;
      this.fall = 0.0001;
    }
    return { zone, amount: toShield + toHealth, toShield, toHealth, broke, knocked, headshot: zone === "head", point: point.clone() };
  }

  update(now: number, dt = 0): void {
    if (this.knocked && this.respawns && now >= this.respawnAt) this.reset();

    // rising up after a pop-up
    if (this.rise < 1 && !this.knocked) {
      this.rise = Math.min(1, this.rise + dt / 0.22);
      const e = 1 - Math.pow(1 - this.rise, 3);
      this.group.rotation.x = (-Math.PI / 2 + 0.2) * (1 - e);
    }

    // Fall over rather than snap to the floor: ease out, with a small bounce
    // at the end, pivoting at the feet and toppling away from the shooter.
    if (this.knocked && this.fall < 1) {
      this.fall = Math.min(1, this.fall + dt / FALL_S);
      const t = this.fall;
      const ease = t < 0.82 ? Math.pow(t / 0.82, 2) : 1 - Math.sin(((t - 0.82) / 0.18) * Math.PI) * 0.06;
      this.group.rotation.x = (-Math.PI / 2 + 0.2) * ease;
    }

    // hit flashes decay in about a tenth of a second
    if (this.flash > 0 || this.headFlash > 0) {
      this.flash = Math.max(0, this.flash - dt * 9);
      this.headFlash = Math.max(0, this.headFlash - dt * 7);
      this.applyGlow();
    }

    if (this.rail && !this.knocked) {
      this.group.position.x += this.railDir * this.rail.speed * dt;
      if (this.group.position.x > this.rail.maxX) {
        this.group.position.x = this.rail.maxX;
        this.railDir = -1;
      } else if (this.group.position.x < this.rail.minX) {
        this.group.position.x = this.rail.minX;
        this.railDir = 1;
      }
      // face the firing line
      this.group.rotation.y = 0;
    }
  }
}
