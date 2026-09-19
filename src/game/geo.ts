// Geometry and palette helpers for the look pass.
//
// The central idea: at this scale a flat colour with a BEVEL and contact AO
// beats a tiled photographic texture on a sharp-edged box, every time. A 90
// degree edge catches no highlight, so it reads as a shape rather than as an
// object made of something. A 3 cm chamfer catches a bright line along every
// edge in the frame, and that line is what tells you the material is metal.
//
// So most structure here is `bevel()` plus `flat()`, and the photographic
// materials are kept for the few genuinely large surfaces (floor, ground)
// where tiling is not obvious and the detail actually earns its bandwidth.
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * Committed palette. One warm family, one cool family, two saturated accents.
 * Everything in the range comes from here so the frame stays coherent.
 */
export const PAL = {
  /** warm sand concrete, the range pad */
  floor: 0x9d8c73,
  floorDark: 0x6a5e4c,
  /** painted lane markings */
  paint: 0xd8d2c6,
  /**
   * The structure family. These were a stop and a half too dark: 0x5a6773 is
   * a NIGHT blue-grey, and a surface that dark reads as unlit no matter how
   * much light you put on it, because albedo multiplies. Painted industrial
   * steel is a light grey with a blue cast, not a navy.
   */
  steel: 0x6b7787,
  steelDark: 0x49535f,
  steelLight: 0x97a1ad,
  /** the roof underside, painted pale so the covered line is not a black lid */
  ceiling: 0xb6bcc4,
  /** saturated orange: trim, safety rail, rack accents */
  orange: 0xd4712a,
  orangeDeep: 0x8f4415,
  /** cyan: emissive, holo panels, target faces */
  cyan: 0x2fd0e8,
  cyanDeep: 0x0d6d80,
  /** hazard yellow */
  hazard: 0xe8b02c,
  /** rubber, tyres, matting */
  rubber: 0x1a1d21,
  /** the dummies */
  dummy: 0xb9c3cc,
  dummyDark: 0x6d7a86,
} as const;

const flatCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * A flat-colour PBR material. Roughness and metalness are the only things
 * separating one surface from another once the textures are gone, so they are
 * worth setting deliberately rather than defaulting.
 */
export function flat(
  color: number,
  roughness = 0.62,
  metalness = 0.18
): THREE.MeshStandardMaterial {
  const key = `${color}:${roughness}:${metalness}`;
  const hit = flatCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  flatCache.set(key, m);
  return m;
}

const emitCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * An emissive panel. `intensity` above 1 pushes it past the bloom threshold,
 * which is the only way anything in the frame actually glows.
 */
export function emissive(color: number, intensity = 2.2): THREE.MeshStandardMaterial {
  const key = `${color}:${intensity}`;
  const hit = emitCache.get(key);
  if (hit) return hit;
  const m = new THREE.MeshStandardMaterial({
    color: 0x0a0d10,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
  });
  emitCache.set(key, m);
  return m;
}

const bevelCache = new Map<string, THREE.BufferGeometry>();

/**
 * A chamfered box. The radius is capped at just under half the smallest side,
 * because RoundedBoxGeometry produces degenerate faces past that and a 0.04
 * default would otherwise blow up a 5 cm trim strip.
 *
 * Geometries are cached by their exact dimensions, so a wall repeated twenty
 * times costs one buffer.
 */
export function bevel(w: number, h: number, d: number, radius = 0.035): THREE.BufferGeometry {
  const r = Math.min(radius, Math.min(w, h, d) * 0.48);
  const key = `${w.toFixed(3)}:${h.toFixed(3)}:${d.toFixed(3)}:${r.toFixed(3)}`;
  const hit = bevelCache.get(key);
  if (hit) return hit;
  // 2 segments is enough for a chamfer read; more only costs vertices. It
  // comes with every triangle's corners its own (900 vertices a box): indexed,
  // it is 212, and it merges with the indexed plain boxes instead of apart.
  const g = mergeVertices(new RoundedBoxGeometry(w, h, d, 2, r));
  // shared by every model that asks for this size: never dispose it
  g.userData.shared = true;
  bevelCache.set(key, g);
  return g;
}

/**
 * A rock that fills a w x h x d box: the box cut into facets, pulled part way
 * toward the egg inside it and pushed in and out a little at random, with its
 * underside left flat on the ground. The field's cover was bevelled boxes the
 * colour of rock; this keeps each one's footprint and height (so the box that
 * collides with it still fits it: it never reaches more than 4% past its box,
 * and its corners sit inside it) and makes it read as stone. The random is
 * fixed by `seed` and by the facet grid, so a vertex shared by two faces moves
 * the same way for both and the seams stay shut.
 */
export function rockGeometry(w: number, h: number, d: number, seed: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 4, 3, 4);
  const pos = g.attributes.position;
  const v = new THREE.Vector3();
  const hash = (a: number, b: number, c: number): number => {
    const n = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + seed * 19.31) * 43758.5453;
    return n - Math.floor(n);
  };
  const ROUND = 0.4;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ux = v.x / (w / 2);
    const uy = v.y / (h / 2);
    const uz = v.z / (d / 2);
    const len = Math.hypot(ux, uy, uz) || 1;
    // part way from the box's surface to the egg through its face centres
    const k = 1 - ROUND + ROUND / len;
    const n = 0.9 + hash(Math.round(ux * 4), Math.round(uy * 3), Math.round(uz * 4)) * 0.14;
    const x = ux * k * n;
    const z = uz * k * n;
    // the underside stays on the ground, and nothing goes below it
    const y = uy <= -0.999 ? -1 : Math.max(-1, uy * k * n);
    pos.setXYZ(i, (x * w) / 2, (y * h) / 2, (z * d) / 2);
  }
  g.computeVertexNormals();
  return g;
}

/** a bevelled box mesh that casts and receives shadow */
export function block(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  radius = 0.035
): THREE.Mesh {
  const m = new THREE.Mesh(bevel(w, h, d, radius), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------- painted floor markings ----------

/**
 * A canvas texture of diagonal hazard chevrons. Drawn rather than fetched so
 * it costs nothing and can be recoloured per use.
 */
export function hazardTexture(
  a = "#e8b02c",
  b = "#1a1d21",
  stripes = 6
): THREE.CanvasTexture {
  const size = 256;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  g.fillStyle = a;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = b;
  g.lineWidth = size / (stripes * 2);
  g.beginPath();
  // Draw past both edges so the diagonal tiles seamlessly across the wrap.
  for (let i = -stripes; i <= stripes * 2; i++) {
    const x = (i * size) / stripes;
    g.moveTo(x, 0);
    g.lineTo(x + size, size);
  }
  g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/**
 * A flat painted marking laid on the floor. Uses polygonOffset rather than a
 * Y offset: lifting paint off the floor by a millimetre looks fine head-on and
 * shows a visible gap when you crouch next to it.
 */
export function decal(
  w: number,
  d: number,
  color: number,
  opacity = 1
): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
      transparent: opacity < 1,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  m.rotation.x = -Math.PI / 2;
  m.receiveShadow = true;
  return m;
}

/**
 * Painted steel wall panels with "B00G" stencilled and sprayed over them, at
 * several sizes and angles, as one 4 m by 2 m tile. Every letter stays inside
 * the tile so it repeats without a seam. The words are redrawn once the web
 * font arrives, since the first draw may happen before it has loaded.
 */
/** a colour scheme for graffitiTexture: wall paint top and bottom, and five spray colours */
export interface WallTheme {
  top: string;
  bottom: string;
  words: [string, string, string, string, string];
  /** how strongly the words show, 1 full; 0.3 keeps them out of the way */
  strength?: number;
}
export const DEFAULT_WALL: WallTheme = { top: "#75818f", bottom: "#66717e", words: ["#e2742b", "#f1efe6", "#ffd23c", "#f1efe6", "#2fd0e8"] };

export function graffitiTexture(word = "B00G", theme: WallTheme = DEFAULT_WALL): THREE.CanvasTexture {
  const W = 1024;
  const H = 512; // 256 px per metre
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const g = cv.getContext("2d")!;
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;

  // one stencilled word, drawn on its own canvas so the stencil bridges cut
  // only the letters and not the wall
  const stencil = (text: string, size: number, color: string, alpha: number, x: number, y: number, rot: number, drips: boolean) => {
    const c = document.createElement("canvas");
    const font = `700 ${size}px "Rajdhani", Impact, "Arial Black", sans-serif`;
    const m = c.getContext("2d")!;
    m.font = font;
    const tw = Math.ceil(m.measureText(text).width) + 8;
    c.width = tw;
    c.height = Math.ceil(size * 1.5);
    m.font = font;
    m.textBaseline = "middle";
    m.fillStyle = color;
    m.fillText(text, 4, c.height / 2);
    // stencil bridges: two thin horizontal cuts through every letter
    m.globalCompositeOperation = "destination-out";
    m.fillRect(0, c.height / 2 - size * 0.2, tw, Math.max(2, size * 0.05));
    m.fillRect(0, c.height / 2 + size * 0.16, tw, Math.max(2, size * 0.05));
    m.globalCompositeOperation = "source-over";
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalAlpha = alpha;
    g.drawImage(c, -tw / 2, -c.height / 2);
    if (drips) {
      // spray paint runs below the word
      g.fillStyle = color;
      for (let i = 0; i < 6; i++) {
        const dx = -tw / 2 + tw * ((i * 0.37 + 0.11) % 1);
        const len = size * (0.15 + ((i * 0.61) % 0.35));
        g.fillRect(dx, size * 0.32, Math.max(2, size * 0.025), len);
      }
    }
    g.restore();
    g.globalAlpha = 1;
  };

  const draw = () => {
    // painted steel with a slight vertical wash, so it is not one flat colour
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, theme.top);
    base.addColorStop(1, theme.bottom);
    g.fillStyle = base;
    g.fillRect(0, 0, W, H);
    // panel seams every metre, with rivets along them
    g.fillStyle = "rgba(20,24,28,0.55)";
    for (let x = 0; x <= W; x += 256) g.fillRect(x - 2, 0, 4, H);
    g.fillRect(0, 254, W, 4);
    g.fillStyle = "rgba(210,218,226,0.35)";
    for (let x = 0; x <= W; x += 256) for (let y = 16; y < H; y += 48) g.fillRect(x + 7, y, 4, 4);
    // a few scuffs so the paint reads as used
    g.fillStyle = "rgba(30,32,36,0.12)";
    for (let i = 0; i < 40; i++) g.fillRect((i * 263) % W, (i * 151) % H, 20 + ((i * 37) % 60), 3);

    const k = theme.strength ?? 1;
    const [w0, w1, w2, w3, w4] = theme.words;
    stencil(word, 230, w0, 0.92 * k, 330, 290, -0.04, true);
    stencil(word, 96, w1, 0.85 * k, 800, 110, 0.12, false);
    stencil(word, 70, w2, 0.8 * k, 820, 400, -0.18, true);
    stencil(word, 56, w3, 0.7 * k, 120, 80, 0.07, false);
    stencil(word, 44, w4, 0.75 * k, 600, 470, 0.03, false);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('700 100px "Rajdhani"').then(draw, () => undefined);
  return tex;
}

/**
 * A material whose texture is laid on in WORLD space: each face takes its
 * UVs from its world position, so walls of any size share one material and
 * one texture scale, and the words always read left to right from whichever
 * side you look at them. `tileW` and `tileH` are the texture's size in metres.
 */
export function worldTiledMaterial(map: THREE.Texture, tileW: number, tileH: number, roughness = 0.62, metalness = 0.08): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ map, roughness, metalness });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.worldTile = { value: new THREE.Vector2(1 / tileW, 1 / tileH) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform vec2 worldTile;")
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        {
          vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vec3 wn = normalize(mat3(modelMatrix) * objectNormal);
          vec2 st;
          if (abs(wn.y) > 0.7) st = wp.xz;
          else if (abs(wn.x) > abs(wn.z)) st = vec2(wn.x > 0.0 ? -wp.z : wp.z, wp.y);
          else st = vec2(wn.z > 0.0 ? wp.x : -wp.x, wp.y);
          vMapUv = st * worldTile;
        }`
      );
  };
  m.customProgramCacheKey = () => "worldTiled";
  return m;
}

/**
 * Big numerals painted on the floor at each distance marker, drawn to a canvas.
 * Distance numbers are the one thing our range has that the real one does not,
 * and they are also the cheapest way to make a flat pad read as measured space.
 */
export function floorNumber(text: string, w: number, color = "#d8d2c6"): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const g = cv.getContext("2d")!;
  g.clearRect(0, 0, cv.width, cv.height);
  g.fillStyle = color;
  g.font = "bold 190px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.globalAlpha = 0.72;
  g.fillText(text, cv.width / 2, cv.height / 2);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w / 2),
    new THREE.MeshStandardMaterial({
      map: t,
      transparent: true,
      roughness: 0.9,
      metalness: 0,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/**
 * A text panel mesh: dark card, orange top bar, yellow title and wrapped body
 * text. Unlit so it reads in shade. Shared by the course and the range's sign
 * over the course gate.
 */
export function textPanel(text: string, x: number, y: number, z: number, rotY: number, w: number, h: number, doubleSided = false): THREE.Mesh {
  const PX = 110;
  const cv = document.createElement("canvas");
  cv.width = Math.round(w * PX);
  cv.height = Math.round(h * PX);
  const g = cv.getContext("2d")!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const pad = 26;
  const paragraphs = text.split("\n");
  /**
   * Lay the text out at a body size, wrapping words; `paint` false only
   * measures. Returns the height used, so the size can be shrunk until the
   * whole text fits the panel (a sign that ran past its board was the bug).
   */
  const layout = (bodySize: number, paint: boolean): number => {
    let yy = pad + 34;
    const titleSize = h < 1.2 ? 64 : Math.max(bodySize + 12, Math.round(bodySize * 1.5));
    paragraphs.forEach((para, i) => {
      const size = i === 0 ? titleSize : bodySize;
      g.font = `${i === 0 ? 700 : 500} ${size}px "Rajdhani", "Segoe UI", sans-serif`;
      g.fillStyle = i === 0 ? "#ffd23c" : "#eef2f5";
      if (h < 1.2) {
        if (paint) {
          g.textAlign = "center";
          g.fillText(para, cv.width / 2, cv.height / 2 + size / 3);
        }
        return;
      }
      g.textAlign = "left";
      const words = para.split(" ");
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (g.measureText(test).width > cv.width - pad * 2 && line) {
          if (paint) g.fillText(line, pad, yy);
          yy += size * 1.18;
          line = word;
        } else line = test;
      }
      if (line && paint) g.fillText(line, pad, yy);
      yy += para ? size * 1.18 : size * 0.4;
    });
    return yy;
  };
  const draw = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = "rgba(10,12,15,0.86)";
    g.fillRect(0, 0, cv.width, cv.height);
    g.fillStyle = "#d4712a";
    g.fillRect(0, 0, cv.width, 8);
    // the largest body size, from 30 px down to 18, at which everything fits
    let size = 30;
    while (size > 18 && layout(size, false) > cv.height - pad * 0.5) size -= 2;
    layout(size, true);
    tex.needsUpdate = true;
  };
  draw();
  // the web font may arrive after the first draw
  document.fonts?.load('500 30px "Rajdhani"').then(draw, () => undefined);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, side: doubleSided ? THREE.DoubleSide : THREE.FrontSide })
  );
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  return m;
}
