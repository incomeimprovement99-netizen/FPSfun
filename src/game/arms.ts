// First-person hands and forearms.
//
// A gun floating in front of the camera with nothing holding it is the other
// half of the Roblox look. These are gloved hands built from capsules around a
// held bar, with a padded knuckle plate, a cuffed glove and a sleeved forearm
// that runs off the bottom of the screen toward where an elbow would be.
//
// Each hand is modelled once, holding a vertical bar at its origin. The
// viewmodel places it on the grip or the handguard and tilts it to match; the
// left hand is the same model mirrored, which three renders correctly because
// it flips the winding order for any object with a negative scale.
import * as THREE from "three";

export interface ArmMats {
  glove: THREE.MeshStandardMaterial;
  pad: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  cuff: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
}

let shared: ArmMats | null = null;
export function armMaterials(): ArmMats {
  if (!shared) {
    shared = {
      // Warm dark leather rather than blue-black. Under a blue sky every dark
      // cool colour on the viewmodel went navy, and the gloves merged with the
      // gun; a warm glove separates the hand from the steel.
      glove: new THREE.MeshStandardMaterial({ color: 0x45403a, roughness: 0.74, metalness: 0.02 }),
      pad: new THREE.MeshStandardMaterial({ color: 0x625a50, roughness: 0.55, metalness: 0.08 }),
      // Charcoal, not olive. A saturated green sleeve read as a green pipe
      // across the bottom of the frame, because it was the only large area of
      // that hue anywhere on screen.
      sleeve: new THREE.MeshStandardMaterial({ color: 0x3a3e43, roughness: 0.9, metalness: 0 }),
      cuff: new THREE.MeshStandardMaterial({ color: 0xc9772f, roughness: 0.7, metalness: 0.05 }),
      skin: new THREE.MeshStandardMaterial({ color: 0x9a7560, roughness: 0.68, metalness: 0 }),
    };
    // viewmodel-only, so extra image-based fill here lifts the shaded side of
    // the gloves without touching the world (see gunmodels.ts)
    for (const mat of Object.values(shared)) mat.envMapIntensity = 1.9;
  }
  return shared;
}

/**
 * Recolour the first-person arms for an operator: gloves, knuckle pads,
 * sleeves and the accent band all follow the look you picked.
 */
export function setArmColors(c: { glove: number; pad: number; sleeve: number; cuff: number }): void {
  const M = armMaterials();
  M.glove.color.setHex(c.glove);
  M.pad.color.setHex(c.pad);
  M.sleeve.color.setHex(c.sleeve);
  M.cuff.color.setHex(c.cuff);
}

/** a capsule between two points, as a mesh */
function segment(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 4, 10), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/**
 * A right hand closed around a vertical bar at the origin (bar about 32 mm
 * across and 46 mm fore and aft, which is a pistol grip). The back of the hand
 * faces +x, the fingers wrap the front strap (-z) and the thumb lies along the
 * left side, which is how a real firing grip sits.
 */
export class Hand {
  readonly group = new THREE.Group();
  /** where the forearm attaches, in hand space */
  private readonly wristLocal = v(0.026, -0.022, 0.048);

  constructor(mirrored: boolean) {
    const M = armMaterials();
    const g = this.group;

    // palm and back of hand, sitting against the right side of the grip
    const palm = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 4, 12), M.glove);
    palm.scale.set(0.7, 1, 1.25);
    palm.position.set(0.03, -0.004, 0.004);
    g.add(palm);
    // padded knuckle plate on the back of the hand
    const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.034, 3, 10), M.pad);
    pad.scale.set(0.55, 1, 1.5);
    pad.position.set(0.047, 0.004, -0.004);
    pad.rotation.x = 0.15;
    g.add(pad);
    // heel of the hand wrapping the back strap
    g.add(segment(v(0.012, -0.03, 0.03), v(0.012, 0.022, 0.03), 0.014, M.glove));

    // three fingers wrapped round the front strap, each in two segments so the
    // knuckle bend reads
    for (let i = 0; i < 3; i++) {
      const y = -0.004 - i * 0.02;
      const r = 0.0088 - i * 0.0005;
      const k = v(0.036, y, -0.02);
      const mid = v(0.018, y, -0.036);
      const tip = v(-0.016, y - 0.002, -0.03);
      g.add(segment(k, mid, r, M.glove));
      g.add(segment(mid, tip, r * 0.95, M.glove));
    }
    // index finger on the trigger
    g.add(segment(v(0.032, 0.02, -0.018), v(0.02, 0.018, -0.046), 0.0092, M.glove));
    g.add(segment(v(0.02, 0.018, -0.046), v(0.004, 0.006, -0.058), 0.0086, M.glove));
    // thumb down the left side
    g.add(segment(v(0.016, 0.018, 0.03), v(-0.012, 0.03, 0.004), 0.0115, M.glove));
    g.add(segment(v(-0.012, 0.03, 0.004), v(-0.022, 0.03, -0.03), 0.0102, M.glove));

    // armoured knuckles: three studs in the accent colour along the pad
    for (let i = 0; i < 3; i++) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), M.cuff);
      stud.scale.set(0.6, 1, 1);
      stud.position.set(0.052, 0.016 - i * 0.014, -0.008);
      g.add(stud);
    }
    // grip pads on the fingertips
    for (let i = 0; i < 3; i++) {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0082 - i * 0.0005, 10, 8), M.pad);
      cap.position.set(-0.016, -0.006 - i * 0.02, -0.03);
      g.add(cap);
    }

    // glove cuff, with a strap round it in the accent colour
    const cuffDir = v(0.1, -0.35, 1).normalize();
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.028, 0.03, 16), M.glove);
    cuff.position.copy(this.wristLocal).add(v(-0.004, 0.012, -0.012));
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
    g.add(cuff);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.0295, 0.0035, 6, 20), M.cuff);
    strap.position.copy(cuff.position);
    strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), cuffDir);
    g.add(strap);

    for (const o of g.children) {
      const m = o as THREE.Mesh;
      m.castShadow = false;
      m.receiveShadow = true;
    }
    if (mirrored) g.scale.x = -1;
  }

  /** the wrist position in the hand's PARENT space */
  wrist(out: THREE.Vector3): THREE.Vector3 {
    this.group.updateMatrix();
    return out.copy(this.wristLocal).applyMatrix4(this.group.matrix);
  }
}

/**
 * A forearm from the wrist to an elbow anchor. Built along +y with unit length
 * and stretched per frame, so the same mesh follows the hand wherever a reload
 * sends it: gloved at the wrist, a sleeve over the rest, and a coloured band
 * where the two meet.
 */
export class Forearm {
  readonly group = new THREE.Group();
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly dir = new THREE.Vector3();

  constructor() {
    const M = armMaterials();
    // the geometry runs from y = 0 (wrist) to y = 1 (elbow)
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.03, 0.22, 16, 1, false), M.glove);
    wrist.position.y = 0.11;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.041, 0.035, 16), M.cuff);
    band.position.y = 0.23;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.043, 0.78, 18), M.sleeve);
    sleeve.position.y = 0.62;
    for (const m of [wrist, band, sleeve]) {
      m.castShadow = false;
      m.receiveShadow = true;
      this.group.add(m);
    }
  }

  /**
   * Stretch from wrist to elbow. Only the length is scaled, so the radii stay
   * true however far the hand travels.
   */
  set(wrist: THREE.Vector3, elbow: THREE.Vector3): void {
    this.dir.subVectors(elbow, wrist);
    const len = Math.max(0.05, this.dir.length());
    this.group.position.copy(wrist);
    this.group.quaternion.setFromUnitVectors(this.up, this.dir.divideScalar(len));
    this.group.scale.set(1, len, 1);
  }
}
