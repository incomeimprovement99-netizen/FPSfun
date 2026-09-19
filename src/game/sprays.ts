// Sprays: your mark on a wall, for friends between fights.
//
// The second half of "emotes, sprays, banner cards and quips". A tap of the
// spray key (8) paints the one you picked on the wall you look at, and every
// player in the match sees it where you put it. One each: a new one replaces
// your last. The art is the icon set the HUD already carries and credits,
// each drawn in its colour on a rough painted disc, so a spray costs no new
// asset at all.
import * as THREE from "three";
import cfg from "../config/sprays.json";

export const SPRAYS = cfg;
export type SprayDef = (typeof cfg.list)[number];

/** a spray by index, or null past the list */
export function sprayAt(i: number | null | undefined): SprayDef | null {
  return i !== null && i !== undefined && i >= 0 && i < cfg.list.length ? cfg.list[i] : null;
}

const textures = new Map<number, THREE.Texture>();

/** a spray's picture: a painted disc in its colour, the icon cut out of it in white; drawn once */
function sprayTexture(i: number): THREE.Texture | null {
  const hit = textures.get(i);
  if (hit) return hit;
  const def = sprayAt(i);
  if (!def || typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (!g) return null;
  // the paint: a disc with a ragged edge and a few drips, as a can leaves it
  g.fillStyle = def.color;
  g.globalAlpha = 0.85;
  g.beginPath();
  for (let a = 0; a <= Math.PI * 2 + 0.01; a += Math.PI / 24) {
    const r = 108 + Math.sin(a * 7 + i) * 5 + Math.sin(a * 13) * 3;
    const x = 128 + Math.cos(a) * r;
    const y = 128 + Math.sin(a) * r;
    if (a === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.fill();
  for (let d = 0; d < 3; d++) g.fillRect(90 + d * 34 + ((i * 13) % 11), 200, 5, 30 + ((d * 17 + i * 7) % 26));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  textures.set(i, tex);
  // the icon over it, dark, once the picture has loaded
  const img = new Image();
  img.onload = () => {
    g.globalAlpha = 0.92;
    g.globalCompositeOperation = "destination-out";
    g.drawImage(img, 56, 56, 144, 144);
    g.globalCompositeOperation = "source-over";
    tex.needsUpdate = true;
  };
  img.src = `icons/${def.icon}.svg`;
  return tex;
}

interface Mark {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  born: number;
}

export class SprayLayer {
  private marks = new Map<number, Mark>();
  private geo = new THREE.PlaneGeometry(1, 1);
  /** sprays put up since the page opened (tools/e2e.ts) */
  count = 0;

  constructor(private scene: THREE.Scene) {}

  /** player `owner`'s spray `index` on the wall at `at`, facing `normal`: their last one goes */
  place(owner: number, at: THREE.Vector3, normal: THREE.Vector3, index: number, now: number): void {
    const map = sprayTexture(index);
    if (!sprayAt(index)) return;
    this.remove(owner);
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    const mesh = new THREE.Mesh(this.geo, mat);
    mesh.position.copy(at).addScaledVector(normal, 0.015);
    // flat on the wall, upright when the wall is (a floor's spray faces up, turned to the sprayer)
    const n = normal.clone().normalize();
    // (straight back along -z the shortest turn is any half turn: make it the upright one)
    if (n.z < -0.999) mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    else mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    mesh.scale.setScalar(SPRAYS.size);
    mesh.userData.dynamic = true;
    this.scene.add(mesh);
    this.marks.set(owner, { mesh, mat, born: now });
    this.count++;
  }

  /** whose sprays are up (tools/e2e.ts) */
  owners(): number[] {
    return [...this.marks.keys()];
  }

  remove(owner: number): void {
    const m = this.marks.get(owner);
    if (!m) return;
    m.mesh.removeFromParent();
    m.mat.dispose();
    this.marks.delete(owner);
  }

  update(now: number): void {
    for (const [owner, m] of this.marks) {
      const age = now - m.born;
      if (age > SPRAYS.life) this.remove(owner);
      else if (age > SPRAYS.life - 5) m.mat.opacity = (SPRAYS.life - age) / 5;
    }
  }

  clear(): void {
    for (const owner of [...this.marks.keys()]) this.remove(owner);
  }
}
