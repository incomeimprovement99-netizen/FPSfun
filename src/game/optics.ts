// Optics: the sight you look through when an optic attachment is fitted.
//
// Before this, fitting an optic changed only the zoom: you still aimed down
// the iron sights at 3x. Now each optic in the attachment list has a housing
// on the rail, aiming lines your eye up with the OPTIC's sight line instead of
// the irons, and the reticle sits in its window. Magnified scopes (3x and up)
// fill the screen at full aim with a scope picture and a black surround, which
// is how Apex draws them.
//
// Housings and reticles are ours, drawn to read like the Apex families (the
// HCOG's boxy hood, the holo's round window, the chevron reticles of the
// Bruiser and Ranger, the sniper crosshair), not copied from the game.
import * as THREE from "three";
import { bevel } from "./geo";

export type ReticleStyle = "classic" | "holo" | "vholo" | "threat" | "chevron" | "ranger" | "aog" | "sniper" | "dsniper";

export interface OpticInfo {
  label: string;
  reticle: ReticleStyle;
  color: string;
  /** the housing shape */
  body: "hood" | "ring" | "box" | "tube" | "longtube";
  /** housing length and window size, metres */
  len: number;
  winW: number;
  winH: number;
  /** eye to the back of the optic when aiming, metres (before the viewmodel scale) */
  relief: number;
  /** at full aim the screen becomes a scope picture */
  overlay: boolean;
  /** a variable optic's two zooms, for the notice when Z switches */
  zooms?: [string, string];
}

/** by attachment mod name */
export const OPTICS: Record<string, OpticInfo> = {
  optic_cq_hcog_classic: { label: "1x HCOG Classic", reticle: "classic", color: "#ff3b30", body: "hood", len: 0.05, winW: 0.03, winH: 0.026, relief: 0.065, overlay: false },
  optic_cq_holosight: { label: "1x Holo", reticle: "holo", color: "#ff3b30", body: "ring", len: 0.03, winW: 0.034, winH: 0.034, relief: 0.085, overlay: false },
  optic_cq_threat: { label: "1x Digital Threat", reticle: "threat", color: "#ff2d2d", body: "hood", len: 0.052, winW: 0.03, winH: 0.026, relief: 0.065, overlay: false },
  optic_cq_hcog_bruiser: { label: "2x HCOG Bruiser", reticle: "chevron", color: "#ff5a2a", body: "hood", len: 0.06, winW: 0.032, winH: 0.028, relief: 0.07, overlay: false },
  optic_cq_holosight_variable: { label: "1x-2x Variable Holo", reticle: "vholo", color: "#ff3b30", body: "box", len: 0.045, winW: 0.036, winH: 0.028, relief: 0.075, overlay: false, zooms: ["1x", "2x"] },
  optic_ranged_hcog: { label: "3x HCOG Ranger", reticle: "ranger", color: "#ff5a2a", body: "hood", len: 0.075, winW: 0.036, winH: 0.03, relief: 0.1, overlay: true },
  optic_ranged_aog_variable: { label: "2x-4x Variable AOG", reticle: "aog", color: "#ff3b30", body: "tube", len: 0.1, winW: 0.034, winH: 0.034, relief: 0.1, overlay: true, zooms: ["2x", "4x"] },
  optic_sniper: { label: "6x Sniper", reticle: "sniper", color: "#101214", body: "longtube", len: 0.17, winW: 0.04, winH: 0.04, relief: 0.1, overlay: true },
  optic_sniper_variable: { label: "4x-8x Variable Sniper", reticle: "sniper", color: "#101214", body: "longtube", len: 0.17, winW: 0.04, winH: 0.04, relief: 0.1, overlay: true, zooms: ["4x", "8x"] },
  optic_sniper_threat: { label: "4x-10x Digital Sniper Threat", reticle: "dsniper", color: "#ff2d2d", body: "longtube", len: 0.17, winW: 0.04, winH: 0.04, relief: 0.1, overlay: true, zooms: ["4x", "10x"] },
};

export function opticInfo(mod: string | null | undefined): OpticInfo | null {
  return mod ? OPTICS[mod] ?? null : null;
}

// ------------------------------------------------------------------ reticle

/**
 * Draw a reticle centred at (cx, cy). `r` is the window's radius in pixels and
 * sets every length. `lw` is the stroke unit: a lens texture scales it with
 * the window, a full-screen scope keeps it to a few screen pixels, or its
 * lines turn into bars.
 */
export function drawReticle(g: CanvasRenderingContext2D, style: ReticleStyle, color: string, cx: number, cy: number, r: number, lw = r * 0.045): void {
  g.save();
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineCap = "round";
  const dot = (rad: number) => {
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.fill();
  };
  const ring = (rad: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.arc(cx, cy, rad, 0, Math.PI * 2);
    g.stroke();
  };
  const line = (x0: number, y0: number, x1: number, y1: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(cx + x0, cy + y0);
    g.lineTo(cx + x1, cy + y1);
    g.stroke();
  };
  const chevron = (s: number, w: number) => {
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(cx - s, cy + s * 0.9);
    g.lineTo(cx, cy);
    g.lineTo(cx + s, cy + s * 0.9);
    g.stroke();
  };
  switch (style) {
    case "classic":
      dot(r * 0.05);
      for (const [dx, dy] of [
        [0, -1],
        [-1, 0],
        [1, 0],
      ] as const) line(dx * r * 0.22, dy * r * 0.22, dx * r * 0.42, dy * r * 0.42, lw * 1.1);
      ring(r * 0.62, lw * 0.55);
      break;
    case "holo":
      ring(r * 0.42, lw * 1.1);
      dot(Math.max(lw * 1.1, r * 0.03));
      break;
    case "vholo":
      ring(r * 0.46, lw);
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ] as const) line(dx * r * 0.46, dy * r * 0.46, dx * r * 0.62, dy * r * 0.62, lw);
      dot(Math.max(lw, r * 0.03));
      break;
    case "threat":
      g.setLineDash([r * 0.12, r * 0.08]);
      ring(r * 0.5, lw * 0.8);
      g.setLineDash([]);
      dot(Math.max(lw * 1.2, r * 0.035));
      break;
    case "chevron":
      chevron(r * 0.2, lw * 1.1);
      line(-r * 0.62, 0, -r * 0.34, 0, lw * 0.9);
      line(r * 0.34, 0, r * 0.62, 0, lw * 0.9);
      break;
    case "ranger":
      chevron(r * 0.16, lw);
      line(-r * 0.7, 0, -r * 0.3, 0, lw * 0.8);
      line(r * 0.3, 0, r * 0.7, 0, lw * 0.8);
      // bullet-drop ticks below, shrinking with range
      [0.3, 0.44, 0.56, 0.66].forEach((y, i) => line(-r * (0.12 - i * 0.02), r * y, r * (0.12 - i * 0.02), r * y, lw * 0.7));
      break;
    case "aog":
      ring(r * 0.58, lw * 0.7);
      chevron(r * 0.14, lw * 0.9);
      line(0, r * 0.16, 0, r * 0.58, lw * 0.55);
      [0.3, 0.42].forEach((y) => line(-r * 0.08, r * y, r * 0.08, r * y, lw * 0.55));
      break;
    case "sniper":
    case "dsniper": {
      // thin centre cross, heavy outer posts, and mil dots
      const thin = Math.max(1, lw * 0.25);
      line(-r * 0.55, 0, r * 0.55, 0, thin);
      line(0, -r * 0.55, 0, r * 0.55, thin);
      for (const s of [-1, 1]) {
        line(s * r * 0.55, 0, s * r, 0, lw * 1.6);
        line(0, s * r * 0.55, 0, s * r, lw * 1.6);
      }
      for (let i = 1; i <= 5; i++) {
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(cx + s * i * r * 0.1 + lw * 0.4, cy);
          g.arc(cx + s * i * r * 0.1, cy, lw * 0.4, 0, Math.PI * 2);
          g.moveTo(cx + lw * 0.4, cy + s * i * r * 0.1);
          g.arc(cx, cy + s * i * r * 0.1, lw * 0.4, 0, Math.PI * 2);
          g.fill();
        }
      }
      if (style === "dsniper") {
        g.fillStyle = "#ff2d2d";
        dot(Math.max(lw * 0.8, r * 0.012));
      }
      break;
    }
  }
  g.restore();
}

const reticleTexCache = new Map<string, THREE.CanvasTexture>();
function reticleTexture(info: OpticInfo): THREE.CanvasTexture {
  const key = `${info.reticle}:${info.color}`;
  const hit = reticleTexCache.get(key);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  // a faint glow under the strokes, the way a reflex sight's LED blooms
  g.shadowColor = info.color;
  g.shadowBlur = 6;
  drawReticle(g, info.reticle, info.color, S / 2, S / 2, S / 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  reticleTexCache.set(key, t);
  return t;
}

// ------------------------------------------------------------------ housing

let mats: { body: THREE.MeshStandardMaterial; lens: THREE.MeshStandardMaterial; accent: THREE.MeshStandardMaterial } | null = null;
function opticMaterials() {
  if (!mats) {
    mats = {
      body: new THREE.MeshStandardMaterial({ color: 0x2b2f35, roughness: 0.42, metalness: 0.55 }),
      // a coated lens: a faint blue sheen, mostly see-through
      lens: new THREE.MeshStandardMaterial({ color: 0x9fd4ff, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.16, depthWrite: false }),
      accent: new THREE.MeshStandardMaterial({ color: 0xd4712a, roughness: 0.5, metalness: 0.2 }),
    };
    for (const m of Object.values(mats)) m.envMapIntensity = 1.9;
  }
  return mats;
}

export interface OpticModel {
  group: THREE.Group;
  info: OpticInfo;
  /** height of the sight line above the rail */
  lineH: number;
  /** the back of the optic, forward of the mount point (negative = behind it) */
  backF: number;
  reticle: THREE.Mesh;
}

/**
 * Build an optic. Origin at the mount point on top of the rail, forward is
 * -z like the guns, and the sight line runs `lineH` above the origin.
 */
export function buildOptic(mod: string | null | undefined): OpticModel | null {
  const info = opticInfo(mod);
  if (!info) return null;
  const M = opticMaterials();
  const g = new THREE.Group();
  g.name = "optic";
  const L = info.len;
  const lineH = info.body === "longtube" ? 0.042 : info.body === "tube" ? 0.036 : 0.03;
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = false;
    g.add(m);
    return m;
  };

  // the clamp on the rail
  add(bevel(0.026, 0.01, Math.min(L * 0.8, 0.06), 0.002), M.body, 0, 0.005, 0);
  add(bevel(0.006, 0.008, 0.012, 0.0015), M.body, 0.016, 0.005, 0.004);

  const w = info.winW;
  const h = info.winH;
  if (info.body === "hood" || info.body === "box") {
    // A boxy hood round a rectangular window: two side walls, a roof and a
    // base, open front and back. The HCOG family's silhouette.
    const t = 0.0035;
    const bottom = lineH - h / 2;
    add(bevel(w + 2 * t, t, L, 0.0012), M.body, 0, bottom - t / 2, 0);
    add(bevel(w + 2 * t, t * 1.4, L, 0.0015), M.body, 0, lineH + h / 2 + t * 0.7, 0);
    for (const s of [-1, 1]) add(bevel(t, h + t, L, 0.0012), M.body, s * (w / 2 + t / 2), lineH, 0);
    // a riser from the clamp up to the hood
    add(bevel(0.02, Math.max(0.002, bottom - t - 0.01), L * 0.6, 0.0015), M.body, 0, 0.01 + (bottom - t - 0.01) / 2, 0);
    // brightness knob and an orange index line, so it reads at a glance
    add(new THREE.CylinderGeometry(0.0055, 0.0055, 0.006, 14).rotateZ(Math.PI / 2), M.body, w / 2 + t + 0.003, lineH, L * 0.1);
    add(bevel(0.0012, 0.002, L * 0.7, 0.0004), M.accent, w / 2 + t + 0.0002, lineH + h * 0.35, 0);
    if (info.body === "box") {
      // the variable holo's zoom lever
      add(bevel(0.004, 0.012, 0.004, 0.001), M.accent, -(w / 2 + t + 0.002), lineH + 0.004, -L * 0.2);
    }
  } else if (info.body === "ring") {
    // the 1x holo: a round window on a short post
    const R = w / 2;
    add(new THREE.TorusGeometry(R + 0.002, 0.0032, 10, 28), M.body, 0, lineH, -L / 2 + 0.004);
    add(new THREE.TorusGeometry(R + 0.002, 0.0026, 10, 28), M.body, 0, lineH, L / 2 - 0.004);
    add(bevel(0.016, lineH - R - 0.004, L, 0.0015), M.body, 0, 0.01 + (lineH - R - 0.004 - 0.01) / 2 + 0.004, 0);
    add(bevel(0.008, 0.005, L * 0.8, 0.001), M.body, 0, lineH + R + 0.006, 0);
  } else {
    // scopes: a tube with a bigger objective bell, rings and turrets
    const R = info.body === "longtube" ? 0.015 : 0.013;
    const bell = info.body === "longtube" ? 0.022 : 0.018;
    const cyl = (r0: number, r1: number, len: number) => new THREE.CylinderGeometry(r0, r1, len, 22).rotateX(Math.PI / 2);
    add(cyl(R, R, L * 0.62), M.body, 0, lineH, -L * 0.02);
    add(cyl(bell, R, L * 0.2), M.body, 0, lineH, -L * 0.41);
    add(cyl(bell * 0.92, bell * 0.92, L * 0.06), M.body, 0, lineH, -L * 0.48);
    add(cyl(R * 1.25, R, L * 0.14), M.body, 0, lineH, L * 0.39);
    for (const f of [-0.22, 0.2]) {
      add(bevel(0.006, lineH - 0.006, 0.012, 0.0015), M.body, 0, (lineH + 0.004) / 2, f * L);
      add(new THREE.TorusGeometry(R + 0.0015, 0.0022, 8, 22), M.body, 0, lineH, f * L);
    }
    add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.01, 14), M.body, 0, lineH + R + 0.005, 0);
    add(new THREE.CylinderGeometry(0.0065, 0.0065, 0.01, 14).rotateZ(Math.PI / 2), M.body, R + 0.005, lineH, 0);
    add(bevel(0.0015, 0.002, L * 0.3, 0.0005), M.accent, 0, lineH + R + 0.0005, -L * 0.2);
  }

  // the lens and the reticle in the front window; the reticle sits just behind
  // the lens so the tint does not cover it
  const lensGeo = info.body === "hood" || info.body === "box" ? new THREE.PlaneGeometry(w, h) : new THREE.CircleGeometry(w / 2, 28);
  add(lensGeo, M.lens, 0, lineH, -L / 2 + 0.002);
  const size = Math.max(w, h);
  const reticle = add(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: reticleTexture(info), transparent: true, depthWrite: false, toneMapped: false }),
    0,
    lineH,
    -L / 2 + 0.004
  );
  reticle.renderOrder = 2;
  return { group: g, info, lineH, backF: -L / 2, reticle };
}
