/**
 * The HEAL hack's area (the owner, 2026-09-27: "we have no healing animation ... check if hyperscape had those"). As
 * Hyper Scape's stills and its players describe it: "healing in a big blue circle", a ring on the ground with arcs
 * turning inside it, the "+" of the heal rising round the people standing in it, and the heal's station in the middle
 * (ours is the bought med kit, main.ts healKit). Ours is in the heal's green, not Hyper Scape's cyan: cyan is the
 * signature guns' phase here. Everyone's looks the same and heals whoever stands in it (the owner, 2026-09-27: "if they
 * are using healing, it should just be green and animated like it is now when we throw it, we should be able to heal
 * in it anyways"): an enemy's was drawn fainter and in another skin, and a red one had read as the out-of-bounds laser.
 * Numbers: src/config/hacks.json healArea.
 */
import * as THREE from "three";

interface HealAreaCfg {
  /** the wall's height and how bright it is */
  wall: number;
  opacity: number;
  /** the "+" signs: how many, how big, how high they rise and how long a rise takes, s */
  plus: { count: number; size: number; rise: number; seconds: number };
  /** the inner arcs: at shares of the radius, a turn a this many seconds */
  arcs: number[];
  spin: number;
}

let plusTex: THREE.CanvasTexture | null = null;
/** a soft green "+", drawn once */
function plusTexture(): THREE.CanvasTexture {
  if (plusTex) return plusTex;
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  const c = cv.getContext("2d")!;
  c.shadowColor = "#3dff9a";
  c.shadowBlur = 10;
  c.fillStyle = "#c8ffe0";
  c.fillRect(26, 12, 12, 40);
  c.fillRect(12, 26, 40, 12);
  plusTex = new THREE.CanvasTexture(cv);
  plusTex.colorSpace = THREE.SRGBColorSpace;
  return plusTex;
}

/** a heal area of `radius` metres, its foot at the group's origin; it animates itself as it is drawn */
export function healArea(radius: number, cfg: HealAreaCfg): THREE.Group {
  const g = new THREE.Group();
  g.name = "heal-area";
  const color = new THREE.Color(0x3dff9a);
  const add = (m: THREE.Mesh) => {
    m.frustumCulled = false;
    m.userData.dynamic = true;
    g.add(m);
    return m;
  };
  const flat = (geo: THREE.BufferGeometry, opacity: number) =>
    add(new THREE.Mesh(geo.rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })));
  // the ring on the ground, and a fainter band just inside it
  const ring = flat(new THREE.RingGeometry(radius - 0.14, radius, 64), 0.85);
  ring.position.y = 0.04;
  flat(new THREE.RingGeometry(radius - 0.55, radius - 0.45, 64), 0.25).position.y = 0.04;
  // the arcs turning inside it, alternately
  const arcs = cfg.arcs.map((s, i) => {
    const m = flat(new THREE.RingGeometry(radius * s - 0.06, radius * s, 32, 1, (i * Math.PI) / 3, Math.PI * 0.55), 0.6);
    m.position.y = 0.05;
    return m;
  });
  // a low wall of light at the edge, fading up
  const wallGeo = new THREE.CylinderGeometry(radius, radius, cfg.wall, 48, 1, true).translate(0, cfg.wall / 2, 0);
  const shade = new Float32Array(wallGeo.attributes.position.count * 3);
  for (let i = 0; i < wallGeo.attributes.position.count; i++) {
    const up = 1 - wallGeo.attributes.position.getY(i) / cfg.wall;
    shade[i * 3] = shade[i * 3 + 1] = shade[i * 3 + 2] = up;
  }
  wallGeo.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  add(new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ color, vertexColors: true, transparent: true, opacity: cfg.opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })));
  // the "+" signs rising, each from its own spot, at its own phase
  const P = cfg.plus;
  const pluses = Array.from({ length: P.count }, (_, i) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: plusTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    const a = (i / P.count) * Math.PI * 2 + Math.random() * 0.6;
    const r = radius * (0.2 + 0.75 * Math.sqrt(Math.random()));
    s.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    s.scale.setScalar(P.size);
    s.userData.phase = Math.random();
    s.frustumCulled = false;
    g.add(s);
    return s;
  });
  const born = performance.now();
  ring.onBeforeRender = () => {
    const t = (performance.now() - born) / 1000;
    arcs.forEach((m, i) => (m.rotation.y = ((i % 2 ? -1 : 1) * t * Math.PI * 2) / cfg.spin));
    for (const s of pluses) {
      const u = (t / P.seconds + (s.userData.phase as number)) % 1;
      s.position.y = 0.2 + u * P.rise;
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(Math.PI * u);
    }
  };
  return g;
}
