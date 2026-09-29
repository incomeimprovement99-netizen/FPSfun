/**
 * A hack used in first person (the owner, 2026-09-27: "we have no ... animation when the user uses a hack, check if
 * hyperscape had those"). Hyper Scape had one for every hack (its official hack stills): the left hand comes up, an
 * amber holographic card with the hack's icon on it stands in front of the wrist, a finger taps it, the hack goes off on
 * the tap and the card breaks into amber pixels; for a quick hack the gun stays in the other hand and dips to the right.
 * This is the card, its icon and its burst; the hand, its arm and the gun's dip are the viewmodel's (viewmodel.ts
 * castHack). Numbers: src/config/viewmodel.json hackCast.
 */
import * as THREE from "three";
import { phasedMaterial, type PhaseSweep } from "./phase";

/** a hack's icon on its card, drawn in a 100 by 100 box round (0, 0) */
function drawIcon(c: CanvasRenderingContext2D, id: string): void {
  c.beginPath();
  const chevron = (y: number, up: boolean) => {
    c.moveTo(-32, y + (up ? 14 : -14));
    c.lineTo(0, y + (up ? -14 : 14));
    c.lineTo(32, y + (up ? 14 : -14));
  };
  switch (id) {
    case "heal":
      c.rect(-11, -36, 22, 72);
      c.rect(-36, -11, 72, 22);
      c.fill();
      return;
    case "leap":
      chevron(-14, true);
      chevron(16, true);
      break;
    case "slam":
      chevron(-16, false);
      chevron(14, false);
      c.moveTo(-40, 38);
      c.lineTo(40, 38);
      break;
    case "dash":
      for (const x of [-20, 8]) {
        c.moveTo(x - 10, -30);
        c.lineTo(x + 18, 0);
        c.lineTo(x - 10, 30);
      }
      break;
    case "grapple":
      c.arc(0, -8, 22, Math.PI * 0.15, Math.PI * 1.85, true);
      c.moveTo(0, 14);
      c.lineTo(0, 40);
      break;
    case "armor":
      c.moveTo(0, -38);
      c.lineTo(32, -26);
      c.lineTo(28, 10);
      c.lineTo(0, 38);
      c.lineTo(-28, 10);
      c.lineTo(-32, -26);
      c.closePath();
      break;
    case "wall":
      for (let i = -1; i <= 1; i++) {
        c.rect(-36, i * 24 - 10, 72, 20);
      }
      break;
    case "invis":
      c.setLineDash([9, 8]);
      c.arc(0, 0, 32, 0, Math.PI * 2);
      c.stroke();
      c.setLineDash([]);
      return;
    case "reveal":
      c.arc(0, 0, 30, 0, Math.PI * 2);
      c.moveTo(12, 0);
      c.arc(0, 0, 12, 0, Math.PI * 2);
      for (const [x, y] of [[0, -44], [0, 44], [-44, 0], [44, 0]]) {
        c.moveTo(x * 0.62, y * 0.62);
        c.lineTo(x, y);
      }
      break;
    case "mine":
      c.moveTo(0, -36);
      c.lineTo(36, 0);
      c.lineTo(0, 36);
      c.lineTo(-36, 0);
      c.closePath();
      c.moveTo(8, 0);
      c.arc(0, 0, 8, 0, Math.PI * 2);
      break;
    default:
      c.arc(0, 0, 30, 0, Math.PI * 2);
  }
  c.stroke();
}

const cards = new Map<string, THREE.CanvasTexture>();

/** a hack's fusion level on its card: `at` of `of` pips lit, in `color` (its slot's, as the HUD's hack boxes have them) */
export type CardLevel = { at: number; of: number; color: string };

/**
 * A hack's card: amber cut-cornered frame, a dashed line inside it, the icon in white with a cyan halo, over a dark
 * glass, as the official stills show it; with a `level`, the hack's fusion level as pips along its foot
 */
export function hackCard(id: string, amber: string, level?: CardLevel): THREE.CanvasTexture {
  const key = level ? `${id}|${level.at}|${level.of}|${level.color}` : id;
  const have = cards.get(key);
  if (have) return have;
  const W = 256;
  const H = 208;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const c = cv.getContext("2d")!;
  const cut = 26;
  const frame = (inset: number) => {
    c.beginPath();
    c.moveTo(inset + cut, inset);
    c.lineTo(W - inset - cut, inset);
    c.lineTo(W - inset, inset + cut);
    c.lineTo(W - inset, H - inset - cut);
    c.lineTo(W - inset - cut, H - inset);
    c.lineTo(inset + cut, H - inset);
    c.lineTo(inset, H - inset - cut);
    c.lineTo(inset, inset + cut);
    c.closePath();
  };
  frame(6);
  c.fillStyle = "rgba(40, 22, 4, 0.55)";
  c.fill();
  c.strokeStyle = amber;
  c.lineWidth = 7;
  c.shadowColor = amber;
  c.shadowBlur = 12;
  c.stroke();
  c.setLineDash([10, 8]);
  c.lineWidth = 2.5;
  frame(20);
  c.stroke();
  c.setLineDash([]);
  c.save();
  // (up and a little smaller with the pips under it: centred, the icon's foot ran into them)
  c.translate(W / 2, level ? H / 2 - 14 : H / 2);
  c.scale(level ? 0.8 : 0.95, level ? 0.8 : 0.95);
  c.strokeStyle = c.fillStyle = "#ffffff";
  c.lineWidth = 9;
  c.lineCap = "round";
  c.lineJoin = "round";
  c.shadowColor = "#7fe9ff";
  c.shadowBlur = 14;
  drawIcon(c, id);
  c.restore();
  if (level && level.of > 0) {
    const [x0, x1, y, h, gap] = [60, W - 60, H - 50, 12, 8];
    const pw = (x1 - x0 - gap * (level.of - 1)) / level.of;
    for (let p = 0; p < level.of; p++) {
      const lit = p < level.at;
      c.fillStyle = lit ? level.color : "rgba(255, 255, 255, 0.22)";
      c.shadowColor = level.color;
      c.shadowBlur = lit ? 12 : 0;
      c.fillRect(x0 + p * (pw + gap), y, pw, h);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  cards.set(key, tex);
  return tex;
}

let haloTex: THREE.CanvasTexture | null = null;
/** a soft round light, white in the middle falling to nothing: tinted, the glow behind a card */
function halo(): THREE.CanvasTexture {
  if (haloTex) return haloTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const c = cv.getContext("2d")!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255, 255, 255, 1)");
  g.addColorStop(0.45, "rgba(255, 255, 255, 0.35)");
  g.addColorStop(1, "rgba(255, 255, 255, 0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  haloTex = new THREE.CanvasTexture(cv);
  return haloTex;
}

/**
 * The card and its burst of pixels, in the view's space (the viewmodel's group). Options for an inspect's cards: `solid`,
 * drawn over what is behind it rather than added to it (added, over the open glove's lit palm the icon washed out to
 * white); `glow`, a halo behind it; `sweep`, a phase sweep it can dissolve by, as a gun does (phase.ts)
 */
export class HackCard {
  readonly group = new THREE.Group();
  private readonly card: THREE.Mesh;
  private readonly mat: THREE.MeshBasicMaterial;
  private readonly bits: Array<{ mesh: THREE.Mesh; vel: THREE.Vector3 }> = [];
  private readonly bitMat: THREE.MeshBasicMaterial;
  private readonly halo: THREE.Mesh | null = null;
  private readonly haloMat: THREE.MeshBasicMaterial | null = null;
  private readonly sweep: PhaseSweep | null;
  /** the halo's brightness asked for (glowAt), and how whole the card is (phaseAt) */
  private glowK = 0;
  private whole = 1;

  constructor(size: number, amber: string, burst: number, opts: { solid?: boolean; glow?: boolean; sweep?: PhaseSweep } = {}) {
    const base = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, depthTest: false, blending: opts.solid ? THREE.NormalBlending : THREE.AdditiveBlending, toneMapped: false });
    this.sweep = opts.sweep ?? null;
    this.mat = (this.sweep ? phasedMaterial(base, this.sweep) : base) as THREE.MeshBasicMaterial;
    this.card = new THREE.Mesh(new THREE.PlaneGeometry(size, size * (208 / 256)), this.mat);
    this.card.renderOrder = 10;
    if (opts.glow) {
      this.haloMat = new THREE.MeshBasicMaterial({ map: halo(), color: new THREE.Color(amber), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false });
      this.halo = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.7, size * 1.5), this.haloMat);
      this.halo.renderOrder = 9;
      this.halo.position.z = -0.002;
      this.group.add(this.halo);
    }
    this.group.add(this.card);
    this.bitMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(amber).multiplyScalar(1.6), transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false });
    const bitGeo = new THREE.PlaneGeometry(size * 0.07, size * 0.07);
    for (let i = 0; i < burst; i++) {
      const mesh = new THREE.Mesh(bitGeo, this.bitMat);
      mesh.renderOrder = 11;
      mesh.visible = false;
      this.group.add(mesh);
      this.bits.push({ mesh, vel: new THREE.Vector3() });
    }
    this.group.visible = false;
  }

  /** a hack's card up, its icon on it */
  show(tex: THREE.Texture): void {
    this.mat.map = tex;
    this.mat.needsUpdate = true;
    this.group.visible = true;
    for (const b of this.bits) b.mesh.visible = false;
  }

  /** the tap: the card breaks into pixels flying out from it */
  burst(): void {
    const s = (this.card.geometry as THREE.PlaneGeometry).parameters;
    for (const b of this.bits) {
      b.mesh.visible = true;
      b.mesh.position.set((Math.random() - 0.5) * s.width, (Math.random() - 0.5) * s.height, 0);
      b.vel.set(b.mesh.position.x * 9, b.mesh.position.y * 9 + 0.05, 0.08 + Math.random() * 0.12);
    }
  }

  /**
   * this frame: `k` how far up the card is (0 to 1), `flick` whether it is still coming on (its scanline flicker),
   * `after` the seconds since the tap (or below 0 before it), `dt` the frame
   */
  frame(k: number, flick: boolean, after: number, dt: number): void {
    const on = flick ? (Math.random() < 0.35 ? 0.35 : 1) : 1;
    const gone = after >= 0 ? Math.max(0, 1 - after / 0.12) : 1;
    this.mat.opacity = k * on * gone;
    this.card.scale.setScalar(0.6 + 0.4 * k + (after >= 0 ? after * 2.5 : 0));
    this.card.visible = this.mat.opacity > 0.01 && this.whole > 0.001;
    if (this.halo && this.haloMat) {
      this.haloMat.opacity = this.mat.opacity * this.glowK * this.whole;
      this.halo.scale.copy(this.card.scale);
      this.halo.visible = this.card.visible && this.haloMat.opacity > 0.01;
    }
    this.bitMat.opacity = after >= 0 ? Math.max(0, 1 - after / 0.28) : 0;
    for (const b of this.bits) {
      if (!b.mesh.visible) continue;
      b.mesh.position.addScaledVector(b.vel, dt);
      if (this.bitMat.opacity <= 0) b.mesh.visible = false;
    }
    this.group.visible = this.card.visible || this.bitMat.opacity > 0;
  }

  /** the halo's brightness, 0 to 1 (with `glow`) */
  glowAt(k: number): void {
    this.glowK = k;
  }

  /**
   * How whole the card is, 0 gone to 1 (with a `sweep`): the sweep runs up the card as it is now, so it dissolves from
   * its top down the way a gun phases out; `t` the view's clock, for the sweep's flicker. Called before frame().
   */
  phaseAt(whole: number, t: number): void {
    this.whole = whole;
    const S = this.sweep;
    if (!S) return;
    S.phase.value = whole;
    S.time.value = t;
    const h = (this.card.geometry as THREE.PlaneGeometry).parameters.height;
    this.card.updateWorldMatrix(true, false);
    S.origin.value.set(0, -h / 2, 0).applyMatrix4(this.card.matrixWorld);
    S.dir.value.set(0, h / 2, 0).applyMatrix4(this.card.matrixWorld).sub(S.origin.value);
    S.len.value = Math.max(1e-6, S.dir.value.length());
    S.dir.value.normalize();
  }
}
