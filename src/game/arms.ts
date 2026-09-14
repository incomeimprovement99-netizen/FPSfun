// First-person hands and forearms.
//
// A gun floating in front of the camera with nothing holding it is the other
// half of the Roblox look. These are gloved hands with a palm, four jointed
// fingers and a thumb, a padded knuckle plate, a cuffed glove and a sleeved
// forearm that runs off the bottom of the screen toward where an elbow would
// be. Proportions are a real hand's: about 19 cm from wrist to fingertip,
// 8.5 cm across the knuckles.
//
// One parametric build makes two hands: a GRIP hand closed round a vertical
// bar at its origin (a pistol grip: the fingers wrap the front strap, the
// thumb lies along the far side), and a FIST with the fingers curled into the
// palm and the thumb across them, for the empty hands while holstered.
//
// The viewmodel places a hand on the grip or the handguard and tilts it to
// match; the left hand is the same model mirrored, which three renders
// correctly because it flips the winding order for any object with a
// negative scale.
import * as THREE from "three";

export interface ArmMats {
  glove: THREE.MeshStandardMaterial;
  pad: THREE.MeshStandardMaterial;
  sleeve: THREE.MeshStandardMaterial;
  cuff: THREE.MeshStandardMaterial;
  skin: THREE.MeshStandardMaterial;
  seam: THREE.MeshStandardMaterial;
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
      seam: new THREE.MeshStandardMaterial({ color: 0x2b2824, roughness: 0.85, metalness: 0 }),
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
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.0001, len), 4, 12), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** a rounded box */
function block(w: number, h: number, d: number, r: number, mat: THREE.Material): THREE.Mesh {
  // a capsule-ish box: a box with sphere corners is heavier than needed; a
  // scaled capsule reads the same at hand size
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.0001, h - 2 * r), 4, 14), mat);
  m.scale.set(w / (2 * r), 1, d / (2 * r));
  return m;
}

/**
 * A right hand at the origin. The back of the hand faces +x, the fingers
 * reach forward (-z) and curl round toward -x, the thumb lies along the -x
 * side. Gripping, the fingers close round a bar about 4 cm across at the
 * origin; as a fist they curl into the palm.
 */
export class Hand {
  readonly group = new THREE.Group();
  /** where the forearm attaches, in hand space */
  private readonly wristLocal = v(0.024, -0.052, 0.034);

  constructor(mirrored: boolean, fist = false) {
    const M = armMaterials();
    const g = this.group;

    // ---- palm: a slab against the +x side of the grip, wider at the knuckles
    const palm = block(0.03, 0.094, 0.074, 0.012, M.glove);
    palm.position.set(0.031, -0.008, 0.006);
    palm.rotation.y = -0.12;
    g.add(palm);
    // the heel of the hand, meaty, wrapping the back strap
    const heel = block(0.032, 0.05, 0.05, 0.012, M.glove);
    heel.position.set(0.02, -0.035, 0.028);
    g.add(heel);
    // padded knuckle plate on the back of the hand, with a seam round it
    const pad = block(0.008, 0.078, 0.052, 0.004, M.pad);
    pad.position.set(0.049, 0.004, -0.004);
    pad.rotation.x = 0.1;
    g.add(pad);
    const seam = block(0.009, 0.084, 0.058, 0.004, M.seam);
    seam.position.set(0.0475, 0.004, -0.004);
    seam.rotation.x = 0.1;
    g.add(seam);

    // ---- four fingers: three segments each, curling round the bar (grip) or
    // into the palm (fist). Knuckles across the top of the palm's front edge.
    const fingers: Array<{ y: number; scale: number }> = [
      { y: 0.03, scale: 1.0 }, // index
      { y: 0.011, scale: 1.06 }, // middle
      { y: -0.008, scale: 0.98 }, // ring
      { y: -0.027, scale: 0.84 }, // little
    ];
    // bend at each joint, radians, turning from -z round toward -x then +z
    const bends = fist ? [0.95, 1.5, 1.05] : [0.3, 1.0, 1.05];
    const lens = [0.045, 0.028, 0.023];
    const radii = [0.0105, 0.0095, 0.0085];
    for (const f of fingers) {
      // the grip's index finger sits on the trigger, straighter than the rest
      const onTrigger = !fist && f === fingers[0];
      const myBends = onTrigger ? [0.15, 0.55, 0.5] : bends;
      const p = v(0.041, f.y, -0.024);
      // the knuckle
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.0112 * f.scale, 12, 10), M.glove);
      k.position.copy(p);
      g.add(k);
      let dx = -0.2;
      let dz = -1;
      let a = 0;
      for (let i = 0; i < 3; i++) {
        a += myBends[i];
        // rotate the finger's direction about the bar (the y axis)
        const cx = dx * Math.cos(a) + dz * Math.sin(a);
        const cz = -dx * Math.sin(a) + dz * Math.cos(a);
        const len = lens[i] * f.scale;
        const q = v(p.x + cx * len, p.y - 0.004 * i, p.z + cz * len);
        g.add(segment(p, q, radii[i] * f.scale, M.glove));
        if (i < 2) {
          const j = new THREE.Mesh(new THREE.SphereGeometry(radii[i + 1] * f.scale * 1.05, 10, 8), M.glove);
          j.position.copy(q);
          g.add(j);
        } else {
          // a grip pad on the fingertip
          const cap = new THREE.Mesh(new THREE.SphereGeometry(radii[2] * f.scale * 1.02, 10, 8), M.pad);
          cap.position.copy(q);
          g.add(cap);
        }
        p.copy(q);
      }
    }

    // ---- thumb: along the far side of the grip, or across the fingers as a fist
    const t0 = v(0.014, 0.03, 0.03);
    const t1 = fist ? v(-0.006, 0.034, -0.006) : v(-0.013, 0.038, 0.004);
    const t2 = fist ? v(0.012, 0.026, -0.03) : v(-0.021, 0.036, -0.028);
    g.add(segment(t0, t1, 0.0125, M.glove));
    const tj = new THREE.Mesh(new THREE.SphereGeometry(0.0118, 12, 10), M.glove);
    tj.position.copy(t1);
    g.add(tj);
    g.add(segment(t1, t2, 0.0105, M.glove));
    const tcap = new THREE.Mesh(new THREE.SphereGeometry(0.0106, 10, 8), M.pad);
    tcap.position.copy(t2);
    g.add(tcap);

    // ---- armoured knuckles: four studs in the accent colour along the pad
    for (const f of fingers) {
      const stud = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 10, 8), M.cuff);
      stud.scale.set(0.55, 1, 1);
      stud.position.set(0.054, f.y + 0.002, -0.014);
      g.add(stud);
    }

    // ---- glove cuff, with a strap round it in the accent colour
    const cuffDir = v(0.1, -0.35, 1).normalize();
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.03, 0.03, 18), M.glove);
    cuff.position.copy(this.wristLocal).add(v(-0.002, 0.014, -0.01));
    cuff.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), cuffDir);
    g.add(cuff);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.0325, 0.0036, 6, 22), M.cuff);
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
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.032, 0.22, 16, 1, false), M.glove);
    wrist.position.y = 0.11;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.035, 16), M.cuff);
    band.position.y = 0.23;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.045, 0.78, 18), M.sleeve);
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
