// Shootable targets.
//
// Two kinds, matching how a real range reads:
//   BOARD   a large panel at distance with a printed bullseye face and a
//           small LED display above it showing the damage of the last hit.
//           Infinitely shootable, flashes on impact.
//   FLIPPER a steel humanoid silhouette on a hinge that folds flat when shot
//           and pops back up after a moment. Has a head zone.
//
// Both used to be flat coloured boxes, which is what made them read as
// cardboard. The boards now have a bevelled steel frame, an A-frame stand and a
// face drawn to a canvas; the flipper is an extruded silhouette with painted
// scoring zones. The HIT geometry is unchanged: the same boxes in the same
// places, the flipper's drawn with an invisible material so the silhouette you
// see is not the box you hit.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export const TARGET_BLUE = 0x2fa8ff;
export const TARGET_RED = 0xff4436;
export const TARGET_HIT = 0xfff2c4;

export type TargetKind = "board" | "flipper";

export interface TargetHit {
  target: Target;
  point: THREE.Vector3;
  head: boolean;
  distance: number;
}

/** hit zones that render nothing; the mesh stays visible so it can be hit */
const HITBOX = new THREE.MeshBasicMaterial({ visible: false });

const steel = new THREE.MeshStandardMaterial({ color: 0x4b5159, roughness: 0.45, metalness: 0.6 });
const steelDark = new THREE.MeshStandardMaterial({ color: 0x2a2f35, roughness: 0.55, metalness: 0.5 });
const zoneDark = new THREE.MeshStandardMaterial({ color: 0x0c1b2b, roughness: 0.6, metalness: 0.1 });
const hazard = new THREE.MeshStandardMaterial({ color: 0xe8b02c, roughness: 0.6, metalness: 0.1 });

let faceTex: THREE.CanvasTexture | null = null;

/**
 * The board face: a dark field, a lit border, four scoring rings and a centre
 * dot. Used as both the colour map and the emissive map, so in daylight you see
 * the printed rings and the emissive colour tints the whole face blue, red or
 * hit-white without redrawing anything.
 */
function boardFace(): THREE.CanvasTexture {
  if (faceTex) return faceTex;
  const W = 512;
  const H = 372;
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const bg = g.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W * 0.6);
  bg.addColorStop(0, "#2a4a68");
  bg.addColorStop(1, "#0d1e30");
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // border
  g.strokeStyle = "#d8f0ff";
  g.lineWidth = 12;
  g.strokeRect(14, 14, W - 28, H - 28);
  g.lineWidth = 3;
  g.strokeRect(32, 32, W - 64, H - 64);
  // corner ticks
  g.lineWidth = 8;
  for (const [x, y, dx, dy] of [
    [48, 48, 1, 1],
    [W - 48, 48, -1, 1],
    [48, H - 48, 1, -1],
    [W - 48, H - 48, -1, -1],
  ]) {
    g.beginPath();
    g.moveTo(x, y + dy * 36);
    g.lineTo(x, y);
    g.lineTo(x + dx * 36, y);
    g.stroke();
  }
  // crosshair
  g.strokeStyle = "rgba(216,240,255,0.35)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(W / 2, 40);
  g.lineTo(W / 2, H - 40);
  g.moveTo(40, H / 2);
  g.lineTo(W - 40, H / 2);
  g.stroke();
  // rings
  g.strokeStyle = "#eef8ff";
  for (const [r, lw] of [
    [150, 7],
    [112, 6],
    [74, 6],
    [38, 6],
  ]) {
    g.lineWidth = lw;
    g.beginPath();
    g.arc(W / 2, H / 2, r, 0, Math.PI * 2);
    g.stroke();
  }
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(W / 2, H / 2, 16, 0, Math.PI * 2);
  g.fill();
  faceTex = new THREE.CanvasTexture(cv);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 8;
  return faceTex;
}

/**
 * A humanoid silhouette outline: tapered torso, rounded shoulders, a neck and a
 * round head, sized to sit exactly over the flipper's body and head hit boxes.
 */
function silhouette(w: number, bodyBot: number, bodyTop: number, headY: number, headR: number): THREE.Shape {
  const s = new THREE.Shape();
  const neckW = 0.065;
  const neckTop = headY - headR * 0.82;
  s.moveTo(-0.4 * w, bodyBot);
  s.lineTo(0.4 * w, bodyBot);
  s.lineTo(0.5 * w, bodyTop - 0.14);
  s.quadraticCurveTo(0.5 * w, bodyTop, 0.3 * w, bodyTop);
  s.lineTo(neckW, bodyTop);
  s.lineTo(neckW, neckTop);
  const a0 = Math.atan2(neckTop - headY, neckW);
  s.absarc(0, headY, headR, a0, Math.PI - a0, false);
  s.lineTo(-neckW, bodyTop);
  s.lineTo(-0.3 * w, bodyTop);
  s.quadraticCurveTo(-0.5 * w, bodyTop, -0.5 * w, bodyTop - 0.14);
  s.closePath();
  return s;
}

export class Target {
  readonly group = new THREE.Group();
  readonly hitMeshes: THREE.Mesh[] = [];
  readonly kind: TargetKind;
  /** boards show the last damage dealt on a small display above the face */
  private readoutCanvas: HTMLCanvasElement | null = null;
  private readoutTex: THREE.CanvasTexture | null = null;
  private panel: THREE.MeshStandardMaterial;
  private litUntil = -Infinity;
  private downUntil = -Infinity;
  private baseColor: number;
  /** set when this target rides a rail */
  rail: { minX: number; maxX: number; speed: number } | null = null;
  private railDir = 1;
  private homeX = 0;

  constructor(kind: TargetKind, x: number, y: number, z: number, scale = 1) {
    this.kind = kind;
    this.baseColor = TARGET_BLUE;

    if (kind === "board") {
      const w = 2.2 * scale;
      const h = 1.6 * scale;
      const tex = boardFace();
      this.panel = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: tex,
        emissiveMap: tex,
        emissive: TARGET_BLUE,
        emissiveIntensity: 1.1,
        roughness: 0.4,
        metalness: 0.05,
      });
      // The face is still a box and still the hit mesh; the printed face is
      // on the +z side only, the rest is the steel edge.
      const face = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), [steelDark, steelDark, steelDark, steelDark, this.panel, steelDark]);
      face.position.y = h / 2;
      face.userData.zone = "body";
      face.castShadow = true;
      face.receiveShadow = true;
      this.group.add(face);
      this.hitMeshes.push(face);

      // bevelled frame round the face
      const t = 0.09;
      for (const [fw, fh, fx, fy] of [
        [w + 2 * t, t, 0, h + t / 2],
        [w + 2 * t, t, 0, -t / 2],
        [t, h, -(w + t) / 2, h / 2],
        [t, h, (w + t) / 2, h / 2],
      ]) {
        const bar = new THREE.Mesh(new RoundedBoxGeometry(fw, fh, 0.12, 2, 0.025), steel);
        bar.position.set(fx, fy, -0.01);
        bar.castShadow = true;
        bar.receiveShadow = true;
        this.group.add(bar);
      }
      // A-frame stand: two raked legs and a foot bar, instead of two posts
      for (const sx of [-1, 1]) {
        const legLen = h * 0.75;
        const leg = new THREE.Mesh(new RoundedBoxGeometry(0.07, legLen, 0.07, 2, 0.015), steelDark);
        leg.position.set(sx * w * 0.36, -legLen * 0.38, -0.25);
        leg.rotation.x = 0.42;
        leg.castShadow = true;
        this.group.add(leg);
      }
      const foot = new THREE.Mesh(new RoundedBoxGeometry(w * 0.9, 0.06, 0.09, 2, 0.015), steelDark);
      foot.position.set(0, -h * 0.66, -0.52);
      this.group.add(foot);

      // LED damage display on top of the frame
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 96;
      this.readoutCanvas = c;
      this.readoutTex = new THREE.CanvasTexture(c);
      this.readoutTex.colorSpace = THREE.SRGBColorSpace;
      const dw = Math.min(1.1, w * 0.5);
      const dh = dw * 0.375;
      const housing = new THREE.Mesh(new RoundedBoxGeometry(dw + 0.08, dh + 0.08, 0.1, 2, 0.02), steelDark);
      housing.position.set(0, h + t + dh / 2 + 0.06, -0.01);
      housing.castShadow = true;
      this.group.add(housing);
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(dw, dh),
        new THREE.MeshStandardMaterial({
          color: 0x000000,
          emissive: 0xffffff,
          emissiveMap: this.readoutTex,
          emissiveIntensity: 1.6,
          roughness: 0.2,
        })
      );
      screen.position.set(0, h + t + dh / 2 + 0.06, 0.052);
      this.group.add(screen);
      this.drawReadout("");
    } else {
      // flipper: hit boxes exactly as before, invisible
      const w = 0.55 * scale;
      const h = 0.9 * scale;
      this.panel = new THREE.MeshStandardMaterial({
        color: 0x1c4f78,
        emissive: TARGET_BLUE,
        emissiveIntensity: 0.9,
        roughness: 0.42,
        metalness: 0.35,
      });
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), HITBOX);
      body.position.y = 0.55 + h / 2;
      body.userData.zone = "body";
      const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.28 * scale, 0.28 * scale, 0.07), HITBOX);
      const headY = 0.55 + h + 0.16;
      headBox.position.y = headY;
      headBox.userData.zone = "head";
      this.group.add(body, headBox);
      this.hitMeshes.push(body, headBox);

      // the visible steel silhouette over them
      const shape = silhouette(w, 0.55, 0.55 + h, headY, 0.13 * scale);
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.02,
        bevelEnabled: true,
        bevelThickness: 0.008,
        bevelSize: 0.008,
        bevelSegments: 2,
        curveSegments: 16,
      });
      geo.translate(0, 0, -0.01);
      const plate = new THREE.Mesh(geo, this.panel);
      plate.castShadow = true;
      plate.receiveShadow = true;
      this.group.add(plate);
      // painted scoring zones: a chest box and a head circle, with a lit ring
      const chest = new THREE.Mesh(new RoundedBoxGeometry(w * 0.46, h * 0.42, 0.01, 2, 0.004), zoneDark);
      chest.position.set(0, 0.55 + h * 0.62, 0.02);
      this.group.add(chest);
      const headZone = new THREE.Mesh(new THREE.CircleGeometry(0.075 * scale, 24), zoneDark);
      headZone.position.set(0, headY, 0.021);
      this.group.add(headZone);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.045 * scale, 0.058 * scale, 28), this.panel);
      ring.position.set(0, 0.55 + h * 0.62, 0.027);
      this.group.add(ring);

      // hinge, arm and a weighted base with a hazard band
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w * 0.8, 14), steel);
      hinge.rotation.z = Math.PI / 2;
      hinge.position.y = 0.55;
      this.group.add(hinge);
      for (const sx of [-1, 1]) {
        const arm = new THREE.Mesh(new RoundedBoxGeometry(0.045, 0.52, 0.045, 2, 0.01), steelDark);
        arm.position.set(sx * w * 0.3, 0.29, 0);
        arm.castShadow = true;
        this.group.add(arm);
      }
      const base = new THREE.Mesh(new RoundedBoxGeometry(w * 1.05, 0.08, 0.36, 2, 0.02), steelDark);
      base.position.y = 0.04;
      base.receiveShadow = true;
      base.castShadow = true;
      this.group.add(base);
      const band = new THREE.Mesh(new THREE.BoxGeometry(w * 1.06, 0.025, 0.02), hazard);
      band.position.set(0, 0.06, 0.18);
      this.group.add(band);
    }

    this.group.position.set(x, y, z);
    this.homeX = x;
  }

  private drawReadout(text: string, color = "#eaf6ff"): void {
    const c = this.readoutCanvas;
    if (!c || !this.readoutTex) return;
    const ctx = c.getContext("2d")!;
    // a dark LCD with a faint grid, so it reads as a display even when blank
    ctx.fillStyle = "#04070a";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "rgba(60,140,200,0.18)";
    ctx.lineWidth = 1;
    for (let x = 0; x < c.width; x += 8) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.height);
      ctx.stroke();
    }
    ctx.font = "700 70px 'Share Tech Mono', ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (text) {
      ctx.fillStyle = color;
      ctx.fillText(text, c.width / 2, c.height / 2 + 4);
    } else {
      ctx.fillStyle = "rgba(90,170,230,0.35)";
      ctx.fillText("--", c.width / 2, c.height / 2 + 4);
    }
    this.readoutTex.needsUpdate = true;
  }

  /** a bullet landed; returns true if it counted */
  hit(now: number, head: boolean, damage: number): boolean {
    if (now < this.downUntil) return false;
    this.litUntil = now + 0.14;
    this.panel.emissive.setHex(TARGET_HIT);
    this.panel.emissiveIntensity = 3.2;
    if (this.kind === "board") {
      this.drawReadout(String(damage), head ? "#ffd23c" : "#eaf6ff");
    } else {
      // fold flat, then pop back up
      this.downUntil = now + 1.1;
    }
    return true;
  }

  /** valid or invalid, for drills */
  setValid(valid: boolean): void {
    this.baseColor = valid ? TARGET_BLUE : TARGET_RED;
  }

  update(now: number, dt: number): void {
    // cool back to the base colour after a hit
    if (now >= this.litUntil) {
      this.panel.emissive.setHex(this.baseColor);
      this.panel.emissiveIntensity = this.kind === "board" ? 1.1 : 0.9;
    }
    // flipper fold and rise
    if (this.kind === "flipper") {
      const down = now < this.downUntil;
      const target = down ? -Math.PI / 2.1 : 0;
      const k = Math.min(1, dt / (down ? 0.06 : 0.18));
      this.group.rotation.x += (target - this.group.rotation.x) * k;
    }
    // rail traverse
    if (this.rail) {
      this.group.position.x += this.railDir * this.rail.speed * dt;
      if (this.group.position.x > this.rail.maxX) {
        this.group.position.x = this.rail.maxX;
        this.railDir = -1;
      } else if (this.group.position.x < this.rail.minX) {
        this.group.position.x = this.rail.minX;
        this.railDir = 1;
      }
    }
  }

  /** is this target shootable at game time `now` (the clock `hit` uses; the browser's clock runs ahead of it) */
  isLive(now: number): boolean {
    return now >= this.downUntil;
  }

  reset(): void {
    this.downUntil = -Infinity;
    this.group.rotation.x = 0;
    this.group.position.x = this.homeX;
    this.drawReadout("");
  }
}
