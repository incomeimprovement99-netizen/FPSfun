// The range. Laid out like a real firing range rather than an empty box:
// a covered firing line, numbered lanes running out to 100 m, a low cover
// row for crouch and slide practice, elevated side platforms reached by
// stairs and a ramp, and a moving target rail.
//
// All geometry is generated here. Materials are CC0 (public/tex/ATTRIBUTION.md).
import * as THREE from "three";
import { material, tileBox } from "./materials";
import { PAL, bevel, flat, emissive, hazardTexture, floorNumber, textPanel } from "./geo";
import { LADDERS, ZIPLINES, buildLadder } from "./traversal";
import { warehouseRoof } from "./warehouse";
import { makeSky, type Sky } from "./sky";
import type { Bounds } from "./player";
import { MOVE, SLIDE_RAMP_ANGLE } from "./movement";
import type { Placement } from "./props";

// maxZ reaches past the back wall to take in the movement course (course.ts).
export const RANGE_BOUNDS: Bounds = { minX: -34, maxX: 34, minZ: -108, maxZ: 212 };
/**
 * The gate through the firing line's back wall into the course, x range. In
 * the back-left corner behind the spawn, between the first two weapon racks.
 * It used to be straight behind the spawn, where nobody turned round to see it.
 */
export const COURSE_GATE = { minX: -23.5, maxX: -19.5 };
/** the second gate, back-right, into the advanced course (courses/advanced.ts) */
export const COURSE_GATE_R = { minX: 19.5, maxX: 23.5 };

/**
 * Direction TO the sun. About 25 degrees of elevation, behind and to the right
 * of the spawn, so shadows rake away down the lanes rather than toward the
 * player's eye. Shared by the light and by the sky dome's sun disk, or the
 * painted sun and the real shadows would disagree.
 */
export const SUN_DIR = new THREE.Vector3(0.56, 0.66, 0.50).normalize();

let sunLight: THREE.DirectionalLight | null = null;
/** the sun, for the debug handle */
export const getSun = (): THREE.DirectionalLight | null => sunLight;
/**
 * Point the sun's shadow map at another part of the world (the BR map is 500
 * m south of the range). `half` is half the width covered: 135 for the range,
 * 230 for the whole BR map (11 cm a texel at 4096, coarse but there).
 */
export function setShadowRegion(centre: THREE.Vector3, half: number): void {
  const sun = sunLight;
  if (!sun) return;
  sun.position.copy(SUN_DIR).multiplyScalar(150 + half * 0.4).add(centre);
  sun.target.position.copy(centre);
  const c = sun.shadow.camera;
  c.left = -half;
  c.right = half;
  c.top = half;
  c.bottom = -half;
  c.far = 360 + half;
  c.updateProjectionMatrix();
}

/** the sky dome, so the frame loop can keep it centred on the camera */
let rangeSky: Sky | null = null;
export function skyFollow(camera: THREE.Camera): void {
  rangeSky?.follow(camera);
}

/** Axis-aligned solid the player collides with and can stand on. */
export interface Solid {
  minX: number; maxX: number; minZ: number; maxZ: number; top: number;
  /** floor height of the solid; the player can only stand on it from above */
  base: number;
}
export const RANGE_SOLIDS: Solid[] = [];

/**
 * Target placements: 11 static boards and flippers in four rows at differing
 * distance and height, plus one slider per rail. That arrangement is how a
 * real range lays out its target banks.
 */
export interface TargetSpec {
  kind: "board" | "flipper";
  x: number;
  y: number;
  z: number;
  scale: number;
  rail?: { minX: number; maxX: number; speed: number };
}
export const TARGET_SPECS: TargetSpec[] = [];

/** rails the moving targets ride along, filled by buildRange */
export interface TargetRail {
  z: number;
  minX: number;
  maxX: number;
  speed: number;
}
export const TARGET_RAILS: TargetRail[] = [];

/** CC0 props to drop in once loaded; see src/game/props.ts */
export const PROP_PLACEMENTS: Placement[] = [];

function addBox(
  scene: THREE.Scene,
  mat: THREE.Material,
  w: number, h: number, d: number,
  x: number, y: number, z: number,
  opts: { solid?: boolean; tile?: number; sharp?: boolean } = {}
): THREE.Mesh {
  // Bevelled by default. A 90 degree edge catches no highlight and so reads as
  // a shape rather than as something made of metal; a 5 cm chamfer puts a
  // bright line along every edge in the frame. `sharp` opts out for the few
  // pieces that still want a tiled photographic texture, because
  // RoundedBoxGeometry does not carry the box parameters tileBox needs.
  let geo: THREE.BufferGeometry;
  if (opts.sharp || opts.tile) {
    const b = new THREE.BoxGeometry(w, h, d);
    if (opts.tile) tileBox(b, opts.tile);
    geo = b;
  } else {
    geo = bevel(w, h, d, 0.05);
  }
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + h / 2, z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  if (opts.solid !== false) {
    RANGE_SOLIDS.push({
      minX: x - w / 2, maxX: x + w / 2,
      minZ: z - d / 2, maxZ: z + d / 2,
      top: y + h,
      base: y,
    });
  }
  return m;
}

function labelSprite(text: string, px = 72, color = "#f4f4f4"): THREE.Sprite {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.font = `700 ${px * 2}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.strokeText(text, 256, 128);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(4, 2, 1);
  return s;
}

export interface RangeOptions {
  /** point lights cost every lit pixel; Competitive and Balanced drop them */
  pointLights: boolean;
  shadowSize: number;
}

export function buildRange(scene: THREE.Scene, opts: RangeOptions = { pointLights: true, shadowSize: 4096 }): void {
  RANGE_SOLIDS.length = 0;
  TARGET_RAILS.length = 0;
  ZIPLINES.length = 0;
  LADDERS.length = 0;

  // Tints shape one palette out of five packs. A tint multiplies the map, so
  // it can only darken: the packs themselves have to be light to begin with.
  // Textured only where the surface is genuinely large and the tiling will not
  // be obvious: the pad and the ground outside it. Everything structural is
  // flat colour plus a bevel, which at this scale reads as a better material
  // than tiled photographic metal does. The colours come from one committed
  // palette (src/game/geo.ts) so the frame stays coherent.
  // These colours MULTIPLY the texture, whose own mid-grey is around 0.5, so
  // tinting at the final colour you want lands about half as bright as you
  // wanted. Both are set roughly a stop up from the target sand.
  const concrete = material("concrete", { color: 0xe6d5b8, roughness: 0.95, metalness: 0.02 });
  const ground = material("ground", { color: 0xcabfa8, roughness: 1, metalness: 0 });
  // METALNESS IS A PHYSICAL CLAIM, NOT A GLOSS DIAL. A metal has no diffuse
  // response at all: it shows only what it reflects. With a blue sky as the
  // only environment, the 0.72-metal roof reflected nothing but blue sky, so
  // its shaded underside rendered with a red channel of literally ZERO and the
  // whole top of the frame read as flat navy. Measured off the screenshot:
  // rgb(1, 47, 76) where the ceiling should have been painted grey.
  //
  // Painted structural steel is a dielectric with a thin metal flake at most.
  // These are the values for painted metal, not for a mirror.
  const wall = flat(PAL.steel, 0.62, 0.08);
  const catwalk = flat(PAL.steelLight, 0.55, 0.14);
  const panel = flat(PAL.steelDark, 0.55, 0.12);
  const trim = flat(PAL.orange, 0.55, 0.25);
  const glow = emissive(PAL.cyan, 2.6);

  // ---------- sky and fog ----------
  // An authored gradient dome, not the HDRI. The HDRI stays as
  // scene.environment for reflections and ambient (installSky), but as a
  // BACKGROUND its horizon sat at a fixed height that did not line up with
  // where our ground plane ends, leaving a hard seam with sky below the
  // horizon line. The fog colour is taken from the dome so ground and sky
  // join instead of butting together.
  const sky = makeSky(SUN_DIR);
  scene.add(sky.mesh);
  scene.fog = new THREE.Fog(sky.fogColor.getHex(), 55, 290);
  rangeSky = sky;

  // ---------- ground ----------
  const outerGeo = new THREE.PlaneGeometry(400, 400);
  const outerUv = outerGeo.attributes.uv as THREE.BufferAttribute;
  // 400 m across; without this it is one tile and reads as flat mush
  for (let i = 0; i < outerUv.count; i++) outerUv.setXY(i, outerUv.getX(i) * 50, outerUv.getY(i) * 50);
  outerUv.needsUpdate = true;
  const outer = new THREE.Mesh(outerGeo, ground);
  outer.rotation.x = -Math.PI / 2;
  outer.position.y = -0.02;
  outer.receiveShadow = true;
  scene.add(outer);

  // the concrete pad the whole range sits on
  const padGeo = new THREE.PlaneGeometry(68, 122);
  const padUv = padGeo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < padUv.count; i++) padUv.setXY(i, padUv.getX(i) * 17, padUv.getY(i) * 30);
  padUv.needsUpdate = true;
  const pad = new THREE.Mesh(padGeo, concrete);
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0, -47);
  pad.receiveShadow = true;
  scene.add(pad);

  // ---------- lane markings ----------
  const paint = new THREE.MeshStandardMaterial({ color: PAL.paint, roughness: 0.85 });
  const paintDim = new THREE.MeshStandardMaterial({ color: 0x8e8878, roughness: 0.9 });
  const accent = new THREE.MeshStandardMaterial({ color: PAL.orange, roughness: 0.8 });

  const stripe = (w: number, d: number, x: number, z: number, mat: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.012, z);
    m.receiveShadow = false;
    scene.add(m);
  };

  // Firing line: a hazard-chevron band rather than a plain stripe. Painted
  // floor markings are most of what makes a flat pad read as a range, and
  // they cost one canvas each.
  const hazard = hazardTexture("#e8b02c", "#20242a", 5);
  hazard.repeat.set(90, 1);
  const hazardMat = new THREE.MeshStandardMaterial({
    map: hazard,
    roughness: 0.85,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const fline = new THREE.Mesh(new THREE.PlaneGeometry(64, 0.6), hazardMat);
  fline.rotation.x = -Math.PI / 2;
  fline.position.set(0, 0.012, 0);
  fline.receiveShadow = true;
  scene.add(fline);

  // distance bands every 10 m to 100 m, with numbers on the floor AND at the
  // lane edges. The floor numerals are readable while you are aiming, which
  // the floating sprites are not.
  for (let d = 10; d <= 100; d += 10) {
    const major = d % 50 === 0;
    stripe(64, major ? 0.3 : 0.14, 0, -d, major ? paint : paintDim);
    for (const x of [-26, 26]) {
      const l = labelSprite(`${d}`, major ? 84 : 64, major ? "#ffffff" : "#cfd6dc");
      l.position.set(x, 1.5, -d);
      scene.add(l);
    }
    if (major || d % 20 === 0) {
      const n = floorNumber(`${d}`, major ? 7 : 5, major ? "#e4ddd0" : "#a79c89");
      n.position.set(0, 0.013, -d - (major ? 3.6 : 2.6));
      scene.add(n);
    }
  }
  // lane divider lines
  for (const x of [-18, -6, 6, 18]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 110), paintDim);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.011, -55);
    scene.add(m);
  }

  // ---------- covered firing line ----------
  // back wall behind the player
  // Back wall, in two halves with a gate between them into the course. A
  // lintel over the gate closes the wall above head height.
  // Three pieces and two gates: back-left into the basic course, back-right
  // into the advanced one, each with a lintel over it.
  addBox(scene, wall, 34 + COURSE_GATE.minX, 6, 1, (-34 + COURSE_GATE.minX) / 2, 0, 8.5);
  addBox(scene, wall, COURSE_GATE_R.minX - COURSE_GATE.maxX, 6, 1, (COURSE_GATE.maxX + COURSE_GATE_R.minX) / 2, 0, 8.5);
  addBox(scene, wall, 34 - COURSE_GATE_R.maxX, 6, 1, (34 + COURSE_GATE_R.maxX) / 2, 0, 8.5);
  for (const g of [COURSE_GATE, COURSE_GATE_R]) addBox(scene, wall, g.maxX - g.minX, 2.5, 1, (g.minX + g.maxX) / 2, 3.5, 8.5);
  // Side walls. 10 m, not 6: a sprint jump off the 4.6 m platform peaked at
  // 5.9 m and landed the player on top of a 6 m wall, where the arena clamp
  // then kept them walking along the cap.
  // They stop at the back wall (z 9): past it on the left the course's own
  // wall carries on, and two coplanar walls would flicker.
  addBox(scene, wall, 1, 10, 117, -34, 0, -49.5, { tile: 3 });
  addBox(scene, wall, 1, 10, 117, 34, 0, -49.5, { tile: 3 });
  // far backstop
  addBox(scene, wall, 68, 9, 1.5, 0, 0, -107.5, { tile: 3 });

  // The warehouse roof over the whole range, at the side walls' 10 m, the
  // same build as the course's and the arena's. The back wall (6 m) and the
  // backstop (9 m) are closed up to it.
  addBox(scene, wall, 68, 4, 1, 0, 6, 8.5, { tile: 3 });
  addBox(scene, wall, 68, 1, 1.5, 0, 9, -107.5, { tile: 3 });
  warehouseRoof(scene, {
    x0: -34.5,
    x1: 34.5,
    z0: -108.5,
    z1: 9,
    y: 10,
    skylightEvery: 4,
    girders: [-17, 0, 17],
    lights: [-26, -9, 9, 26],
    solid: (minX, maxX, minZ, maxZ, base, top) => RANGE_SOLIDS.push({ minX, maxX, minZ, maxZ, base, top }),
  });

  // Roof over the BAYS BEHIND the firing line, not over the line itself.
  //
  // It used to span z -5.5 to 8.5 with the spawn at z = 0, so the player stood
  // under the middle of it and its underside filled the top third of the
  // default view: a dark unlit slab across the frame that no amount of
  // lighting elsewhere could fix. Measured, the transition sat at screen
  // y = 132 of 900. It now starts at z = 1 and runs back, so from the firing
  // line you see sky ahead and the canopy only when you look up or turn round.
  //
  // It is also higher, 6.2 instead of 5.2, which reads as an industrial
  // structure rather than a carport.
  const ROOF_Y = 6.2;
  const ROOF_NEAR = 1.0;
  const ROOF_FAR = 9.5;
  const roofDepth = ROOF_FAR - ROOF_NEAR;
  const roofGeo = new THREE.BoxGeometry(64, 0.4, roofDepth);
  tileBox(roofGeo, 2); // without this the 64 m roof shows two thirds of one tile
  const roof = new THREE.Mesh(roofGeo, flat(PAL.ceiling, 0.72, 0.06));
  roof.position.set(0, ROOF_Y, (ROOF_NEAR + ROOF_FAR) / 2);
  roof.castShadow = true;
  roof.receiveShadow = true;
  scene.add(roof);
  for (const x of [-30, -18, -6, 6, 18, 30]) {
    // The back row sits inside the back wall (z 8 to 9). At ROOF_FAR - 0.6 it
    // stuck 15 cm through into the course's start area.
    for (const z of [ROOF_NEAR + 0.6, ROOF_FAR - 1.0]) {
      addBox(scene, panel, 0.5, ROOF_Y, 0.5, x, 0, z, { tile: 2 });
    }
  }

  // Shooting bay dividers. None at x = 0: the player spawns there, and a
  // divider on the spawn ejected them 0.56 m sideways on the first frame,
  // which also broke the lane distances the spawn point exists to make exact.
  for (const x of [-24, -12, 12, 24]) {
    addBox(scene, panel, 0.3, 1.25, 3.2, x, 0, 1.4, { tile: 1.5 });
  }

  // ---------- cover row for crouch and slide practice ----------
  for (const [x, z, w, h] of [
    [-14, -16, 4, 1.15],
    [-4, -22, 3, 0.95],
    [8, -18, 5, 1.3],
    [20, -26, 3.5, 1.15],
    [-22, -30, 4, 0.95],
    [2, -34, 6, 1.5],
    [16, -40, 4, 1.15],
    [-10, -44, 5, 1.3],
  ] as Array<[number, number, number, number]>) {
    addBox(scene, panel, w, h, 1.1, x, 0, z, { tile: 1.5 });
  }

  // a low rail to slide under: two posts and a beam, no collider on the beam
  for (const z of [-26, -52]) {
    addBox(scene, panel, 0.35, 1.35, 0.35, -3, 0, z, { tile: 1 });
    addBox(scene, panel, 0.35, 1.35, 0.35, 3, 0, z, { tile: 1 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 0.3), accent);
    beam.position.set(0, 1.5, z);
    beam.castShadow = true;
    scene.add(beam);
  }

  // ---------- elevated side platforms ----------
  // Left platform, reached by stairs. The lowest step must be NEAREST the
  // firing line (highest z) and they ascend away from it, or the player walks
  // into the top step face-first. Rise per step is 0.44 m against a free
  // step-up of 0.559 m; at 0.55 the margin was 9 mm and one rounding away
  // from an unclimbable staircase.
  const platY = 4;
  addBox(scene, catwalk, 14, 0.6, 22, -24, platY, -40, { tile: 2 });
  const STEPS = 10;
  const STEP_RISE = 0.44;
  const STEP_DEPTH = 1.2;
  for (let i = 0; i < STEPS; i++) {
    // Each step is solid all the way to the ground. Boxes that floated at
    // their own tread height let a crouched player walk straight through the
    // body of the staircase.
    const top = (i + 1) * STEP_RISE;
    addBox(scene, catwalk, 5, top, STEP_DEPTH, -20, 0, -17.6 - i * STEP_DEPTH, { tile: 1.5 });
  }
  // Right platform, reached by a ramp you can slide down.
  addBox(scene, catwalk, 14, 0.6, 22, 24, platY, -40, { tile: 2 });

  // The ramp angle is DERIVED from the slide physics, not chosen. Built by eye
  // at 12.9 degrees it was far too shallow: slide friction at speed is
  // dominated by the velocity-proportional decay term, and cancelling that at
  // the slide boost cap needs 30.4 degrees. Below the break-even angle a slide
  // down a ramp still decays, which made the ramp pointless for the one thing
  // a ramp is for. See slideBreakEvenAngle in movement.ts.
  const RAMP_TOP_Y = platY + 0.6;
  const RAMP_TOP_Z = -29; // meets the platform's near edge
  const rampRun = RAMP_TOP_Y / Math.tan(SLIDE_RAMP_ANGLE);
  const rampBottomZ = RAMP_TOP_Z + rampRun;
  const rampLen = RAMP_TOP_Y / Math.sin(SLIDE_RAMP_ANGLE);

  // The mesh must rise toward -z to match its colliders. At a negative
  // rotation the visible ramp sloped the opposite way and passed through the
  // player's head while they walked up an invisible slope.
  const rampGeo = new THREE.BoxGeometry(5, 0.4, rampLen);
  tileBox(rampGeo, 2);
  const ramp = new THREE.Mesh(rampGeo, catwalk);
  ramp.position.set(18, RAMP_TOP_Y / 2, (RAMP_TOP_Z + rampBottomZ) / 2);
  ramp.rotation.x = SLIDE_RAMP_ANGLE;
  ramp.castShadow = true;
  ramp.receiveShadow = true;
  scene.add(ramp);

  // Stepped colliders under the ramp, since collision is axis-aligned boxes.
  // Step count is chosen so the rise per step keeps a real margin under the
  // free step-up height; at 14 steps the rise is 0.33 m against a 0.56 m
  // step, rather than the 9 mm margin the stairs once had.
  const RAMP_STEPS = 14;
  for (let i = 0; i < RAMP_STEPS; i++) {
    const t0 = i / RAMP_STEPS;
    RANGE_SOLIDS.push({
      minX: 15.5, maxX: 20.5,
      minZ: RAMP_TOP_Z + rampRun * t0,
      maxZ: RAMP_TOP_Z + rampRun * ((i + 1) / RAMP_STEPS),
      top: RAMP_TOP_Y * (1 - t0),
      base: 0,
    });
  }
  // A wedge of side skirt so the ramp does not read as a floating plank.
  for (const sx of [15.4, 20.6]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, rampLen), panel);
    skirt.position.set(sx, RAMP_TOP_Y / 2, (RAMP_TOP_Z + rampBottomZ) / 2);
    skirt.rotation.x = SLIDE_RAMP_ANGLE;
    skirt.castShadow = true;
    scene.add(skirt);
  }
  // Platform railings: a top rail, a mid rail and posts, rather than one bar
  // floating in space. Three thin elements at different heights are what makes
  // a silhouette read as a handrail, and they catch the low sun along their
  // whole length.
  for (const sx of [-24, 24]) {
    for (const dz of [-11, 11]) {
      for (const [hy, th] of [
        [1.65, 0.09],
        [0.95, 0.06],
      ] as const) {
        const r = new THREE.Mesh(bevel(14, th, th, th * 0.4), trim);
        r.position.set(sx, platY + hy, -40 + dz);
        r.castShadow = true;
        scene.add(r);
      }
      for (let i = -3; i <= 3; i++) {
        const post = new THREE.Mesh(bevel(0.08, 1.7, 0.08, 0.02), trim);
        post.position.set(sx + i * 2.2, platY + 0.85, -40 + dz);
        post.castShadow = true;
        scene.add(post);
      }
    }
    // An emissive strip under the platform lip. Edge lighting is the single
    // clearest way to describe a silhouette against a bright sky, and it is
    // the only thing in the frame above the bloom threshold.
    for (const dz of [-11, 11]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(14, 0.07, 0.03), glow);
      strip.position.set(sx, platY - 0.08, -40 + dz + (dz > 0 ? 0.32 : -0.32));
      scene.add(strip);
    }
  }

  // ---------- trim: kick plates and roof edge ----------
  // Orange at the base of every long wall. A horizontal band low on a tall
  // surface gives it a floor line and a sense of height; without one a 10 m
  // wall and a 4 m wall look identical.
  const gateL = COURSE_GATE.minX;
  const gateR = COURSE_GATE.maxX;
  for (const [x, z, w, d] of [
    [-33.4, -49.5, 0.12, 117],
    [33.4, -49.5, 0.12, 117],
    // the back wall's, either side of the two course gates
    [(-34 + gateL) / 2, 7.9, gateL + 34, 0.12],
    [(gateR + COURSE_GATE_R.minX) / 2, 7.9, COURSE_GATE_R.minX - gateR, 0.12],
    [(COURSE_GATE_R.maxX + 34) / 2, 7.9, 34 - COURSE_GATE_R.maxX, 0.12],
    [0, -106.9, 68, 0.12],
  ] as const) {
    const kick = new THREE.Mesh(bevel(w, 0.5, d, 0.03), trim);
    kick.position.set(x, 0.25, z);
    kick.receiveShadow = true;
    scene.add(kick);
  }
  // Roof edge light bar, facing down along the canopy's leading edge.
  const roofBar = new THREE.Mesh(new THREE.BoxGeometry(62, 0.1, 0.16), glow);
  roofBar.position.set(0, ROOF_Y - 0.26, ROOF_NEAR + 0.2);
  scene.add(roofBar);

  // ---------- ceiling lights ----------
  // The canopy's underside is what you see when you turn round or look up from
  // the bays. Unlit, it is a dark slab no matter how good the lighting is
  // everywhere else. Real ranges light the bays from above; so does this one.
  const lampWhite = emissive(0xfff0d2, 3.4);
  for (const x of [-27, -18, -9, 0, 9, 18, 27]) {
    for (const z of [ROOF_NEAR + 2.2, ROOF_FAR - 2.2]) {
      // The housing sits flush against the roof and the lit strip hangs BELOW
      // it. Previously the two overlapped and the housing covered most of the
      // strip it was meant to hold.
      const can = new THREE.Mesh(bevel(5.6, 0.16, 0.8, 0.05), panel);
      can.position.set(x, ROOF_Y - 0.28, z);
      can.castShadow = false;
      scene.add(can);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.07, 0.55), lampWhite);
      lamp.position.set(x, ROOF_Y - 0.39, z);
      scene.add(lamp);
    }
  }
  // Six lights doing the actual work. Point lights are expensive per-fragment,
  // so this is six covering a 64 m line rather than one per fitting. Intensity
  // is in candela and falls off with the square of distance, so at 26 the
  // nearest fitting was contributing about as much as the sky bounce; a ceiling
  // wants to be lit by its own lamps, not by the sky it is blocking.
  for (const x of opts.pointLights ? [-27, -16, -5, 5, 16, 27] : []) {
    const pl = new THREE.PointLight(0xffeccd, 110, 34, 2);
    pl.position.set(x, ROOF_Y - 0.7, (ROOF_NEAR + ROOF_FAR) / 2);
    scene.add(pl);
  }

  // ---------- mantle ledges, waist to chest height ----------
  for (const [x, z, h] of [
    [-30, -8, 1.6],
    [30, -8, 2.0],
    [-30, -58, 2.4],
    [30, -58, 1.6],
  ] as Array<[number, number, number]>) {
    addBox(scene, panel, 6, h, 3, x, 0, z, { tile: 1.5 });
  }

  // ---------- wallbounce practice, on the right-hand wall ----------
  // The climb zones painted on the wall at the heights they sit when you jump
  // from this floor: where your FEET are when you jump off decides what you
  // get (mini-bounce, wallbounce, wall push). A take-off line on the floor.
  const zones = climbZonesPanel();
  zones.position.set(33.49, 2, -19);
  zones.rotation.y = -Math.PI / 2;
  scene.add(zones);
  scene.add(
    textPanel(
      "WALLBOUNCE (the wiki's recipe)\n\nSprint at the wall. Crouch to slide, then JUMP out of the slide. Let go of W. Hit the wall at the top of the jump or just after: a slide jump peaks at 44 hu, inside the green band. Press jump. Lower in the band is a bigger bounce. A plain sprint jump peaks at 56, above the band: touch there and you get a wall push, no height. Hold W into the wall and you get the height but no distance (a wallskip). The feed on the left says what you got and why.",
      33.48, 5.6, -19, -Math.PI / 2, 6, 3.0
    )
  );
  const takeoff = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 6), paint);
  takeoff.rotation.x = -Math.PI / 2;
  takeoff.position.set(31.3, 0.012, -19);
  scene.add(takeoff);

  // ---------- ladders on the side platforms ----------
  // A ladder in Apex is rungs on a wall a climb gets you up, so each platform
  // gets a wall column to its top with a ladder on it. The platforms are 4.6 m,
  // within a jump, climb and mantle.
  for (const side of [-1, 1]) {
    const faceX = side * 16.5;
    addBox(scene, panel, 0.5, platY + 0.6, 2.4, faceX - side * 0.25, 0, -46, { tile: 1.5 });
    buildLadder(scene, faceX, -46, -side, 0, 0, platY + 0.6);
  }

  // ---------- the way to the course ----------
  // A lit frame round the gate, a sign over it facing the spawn, and arrows
  // on the floor from the spawn to it.
  const chevron = chevronTexture();
  const arrowMat = new THREE.MeshBasicMaterial({ map: chevron, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  for (const [g, glowColor, title, fromX] of [
    [COURSE_GATE, PAL.orange, "THE RUN: BASIC\nSeven rooms: slides, a climb, a superglide, a gap, ziplines. Beat the clock.", -3],
    [COURSE_GATE_R, 0xff3b2f, "THE RUN: ADVANCED\nNine rooms, 200 m: a superglide gap, lurch pads, wallbounces, a zipline superjump. Chain them.", 3],
  ] as const) {
    const glow = emissive(glowColor, 2.4);
    for (const x of [g.minX - 0.1, g.maxX + 0.1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.5, 0.1), glow);
      post.position.set(x, 1.75, 7.95);
      scene.add(post);
    }
    const lintelGlow = new THREE.Mesh(new THREE.BoxGeometry(g.maxX - g.minX + 0.4, 0.2, 0.1), glow);
    lintelGlow.position.set((g.minX + g.maxX) / 2, 3.5, 7.95);
    scene.add(lintelGlow);
    scene.add(textPanel(title, (g.minX + g.maxX) / 2, 4.75, 7.94, Math.PI, 4.6, 1.9));
    const from = new THREE.Vector2(fromX, 1.5);
    const to = new THREE.Vector2((g.minX + g.maxX) / 2, 6.8);
    const heading = Math.atan2(to.x - from.x, to.y - from.y);
    for (let i = 0; i < 6; i++) {
      const p = from.clone().lerp(to, i / 5.5);
      const a = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), arrowMat);
      // lie flat, then turn to point at the gate
      a.rotation.set(-Math.PI / 2, heading + Math.PI, 0, "YXZ");
      a.position.set(p.x, 0.014, p.y);
      scene.add(a);
    }
  }
  void gateL;
  void gateR;
  // You spawn facing down the lanes with the gate behind you, so a note is
  // painted on the floor just in front of the spawn where you will see it.
  const note = spawnNote();
  note.position.set(-2.8, 0.014, -3.4);
  scene.add(note);

  // ---------- weapon racks, colour coded by ammo type ----------
  // Saturated functional colour is the readability layer of a real range and
  // the single most recognisable thing about one. It is also what the bloom
  // pass exists for: these emissive strips are the only things in the scene
  // bright enough to cross its threshold.
  const AMMO: Array<[string, number]> = [
    ["LIGHT", 0xf2a33c],
    ["HEAVY", 0x35c9c4],
    ["ENERGY", 0x7ddc4a],
    ["SHOTGUN", 0xe4553c],
    ["SNIPER", 0x9a7bff],
    ["SUPPLY", 0xd94f9a],
  ];
  AMMO.forEach(([label, colour], i) => {
    // Behind the firing line, flanking the spawn, so they never block a lane.
    const x = -26 + i * 10.4;
    const z = 5.5;
    // rack body
    addBox(scene, panel, 3.4, 1.15, 0.9, x, 0, z, { tile: 1.2 });
    // emissive strip along the top edge
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(3.3, 0.1, 0.08),
      new THREE.MeshStandardMaterial({
        color: 0x101418,
        emissive: colour,
        emissiveIntensity: 2.2,
        roughness: 0.4,
      })
    );
    strip.position.set(x, 1.2, z - 0.47);
    scene.add(strip);
    // a back board so the rack reads as a station, and a label
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.5, 0.12),
      new THREE.MeshStandardMaterial({ color: 0x232a31, roughness: 0.6, metalness: 0.4 })
    );
    board.position.set(x, 2.0, z + 0.4);
    board.castShadow = true;
    scene.add(board);
    const l = labelSprite(label, 52, `#${colour.toString(16).padStart(6, "0")}`);
    l.scale.set(3.0, 1.5, 1);
    l.position.set(x, 2.15, z + 0.32);
    scene.add(l);
    // a small fill light so the rack pool-lights the floor in front of it
    if (opts.pointLights) {
      const pl = new THREE.PointLight(colour, 6, 7, 2);
      pl.position.set(x, 1.6, z - 1.2);
      scene.add(pl);
    }
  });

  // ---------- moving target rails ----------
  TARGET_RAILS.push({ z: -35, minX: -10, maxX: 10, speed: 4.2 });
  TARGET_RAILS.push({ z: -60, minX: -16, maxX: 16, speed: 6.0 });
  for (const rail of TARGET_RAILS) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(rail.maxX - rail.minX + 2, 0.12, 0.12), paintDim);
    bar.position.set((rail.minX + rail.maxX) / 2, 0.08, rail.z);
    scene.add(bar);
  }

  // ---------- target banks ----------
  TARGET_SPECS.length = 0;
  // four rows of static targets at differing distance and height
  const rows: Array<{ z: number; y: number; xs: number[]; kind: "board" | "flipper"; scale: number }> = [
    { z: -12, y: 0, xs: [-9, -3, 3, 9], kind: "flipper", scale: 1 },
    { z: -28, y: 0, xs: [-14, 0, 14], kind: "board", scale: 0.9 },
    { z: -50, y: 1.2, xs: [-8, 8], kind: "board", scale: 1.1 },
    { z: -78, y: 2.2, xs: [-16, 0, 16], kind: "board", scale: 1.5 },
  ];
  for (const r of rows) {
    for (const x of r.xs) TARGET_SPECS.push({ kind: r.kind, x, y: r.y, z: r.z, scale: r.scale });
    // a low plinth under the raised rows so they do not float
    if (r.y > 0) {
      for (const x of r.xs) addBox(scene, panel, 3.2, r.y, 1.0, x, 0, r.z, { tile: 1.5 });
    }
  }
  // one slider per rail
  for (const rail of TARGET_RAILS) {
    TARGET_SPECS.push({
      kind: "board",
      x: (rail.minX + rail.maxX) / 2,
      y: 0,
      z: rail.z,
      scale: 0.9,
      rail,
    });
  }

  // ---------- dressing ----------
  // Real props break up the boxes. Colliders are added here so collision does
  // not wait on a network fetch; the visible models arrive when they arrive.
  PROP_PLACEMENTS.length = 0;
  const prop = (p: Placement) => {
    PROP_PLACEMENTS.push(p);
    if (p.solid) {
      RANGE_SOLIDS.push({
        minX: p.x - p.solid.w / 2, maxX: p.x + p.solid.w / 2,
        minZ: p.z - p.solid.d / 2, maxZ: p.z + p.solid.d / 2,
        top: (p.y ?? 0) + p.solid.h,
        base: p.y ?? 0,
      });
    }
  };

  // crate stacks flanking the racks
  for (const [x, z, r] of [[-31, 3, 12], [-31, 0.5, -8], [31, 3, -20], [31, 0.6, 6], [-29.5, -2.5, 40]] as Array<[number, number, number]>) {
    prop({ prop: "wooden_military_crate", x, z, rot: r, solid: { w: 1.1, h: 0.8, d: 0.8 } });
  }
  // drums along the walls
  for (const [x, z] of [[-32, -14], [-32, -16.2], [32, -34], [32, -36.2], [-32, -62], [32, -70]] as Array<[number, number]>) {
    prop({ prop: "Barrel_01", x, z, rot: Math.random() * 360, solid: { w: 0.7, h: 0.95, d: 0.7 } });
  }
  // concrete barriers marking the lane mouths
  for (const x of [-22, -10, 10, 22]) {
    prop({ prop: "concrete_road_barrier", x, z: -8, rot: 90, solid: { w: 0.8, h: 0.85, d: 2.2 } });
  }
  // ammo boxes and shelving beside the racks
  for (let i = 0; i < 6; i++) {
    prop({ prop: "ammo_box", x: -26 + i * 10.4 + 2.2, z: 4.6, rot: 180 });
    prop({ prop: "plastic_crate_03", x: -26 + i * 10.4 - 2.2, z: 4.8, rot: 20 * i });
  }
  // Floodlights on the front pillar row. They followed the old roof line at
  // z = -4.5; once the canopy moved back they were left hanging in open air
  // 6 m in front of the pillars that were meant to carry them.
  for (const x of [-30, -6, 18]) {
    prop({ prop: "security_light", x, z: 1.1, y: 4.2, rot: 180, scale: 1.4 });
  }
  // yard clutter behind the line
  prop({ prop: "portable_generator", x: -18, z: 6.5, rot: -25, solid: { w: 1.2, h: 0.9, d: 1.0 } });
  prop({ prop: "utility_box_01", x: 14, z: 7.4, rot: 180, scale: 1.2 });
  prop({ prop: "steel_frame_shelves_01", x: 28, z: 7.0, rot: 200 });

  // ---------- lighting ----------
  //
  // The old setup had a near-overhead sun at 1.9 with the full-strength HDRI
  // as ambient. That combination is why the render came out inside a 50-65%
  // grey band with no visible shadows anywhere: a steep sun drops its shadows
  // under the objects that cast them, and an unattenuated environment map
  // then fills those shadows straight back in.
  //
  // The first fix over-corrected. Dropping the sun to 25 degrees AND cutting
  // the environment to a third AND adding a cool grade on top produced a night
  // scene with a blown-out horizon band: three darkening changes stacked.
  //
  // The reference is a bright sunny desert, not golden hour. So the sun sits at
  // 41 degrees, high enough to light the pad properly and still low enough to
  // throw shadows you can read, and the environment carries real fill instead
  // of being switched off. Contrast now comes from the RATIO of sun to fill,
  // not from turning everything down.
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.1);
  sunLight = sun;
  // Centred between the range and the course behind it, so the shadow map
  // covers both.
  const shadowCentre = new THREE.Vector3(-10, 0, 12);
  sun.position.copy(SUN_DIR).multiplyScalar(150).add(shadowCentre);
  sun.target.position.copy(shadowCentre);
  // The target must be in the scene or its world matrix never updates and the
  // shadow camera keeps aiming at the origin.
  scene.add(sun.target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(opts.shadowSize, opts.shadowSize);
  const c = sun.shadow.camera;
  // Tight to the play area rather than to the 400 m ground plane: the frustum
  // is what sets the texel size, and 190 m across 4096 is 4.6 cm per texel.
  c.left = -135;
  c.right = 135;
  c.top = 135;
  c.bottom = -135;
  c.near = 1;
  c.far = 360;
  c.updateProjectionMatrix();
  // A low sun means grazing angles, where a constant bias either peters out
  // into acne or floats the contact point. normalBias handles the grazing case
  // and lets the constant bias stay small enough to keep contacts tight.
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.035;
  scene.add(sun);

  // Sky fill from above, warm bounce from the pad below. This is doing the job
  // a real GI solve would: it keeps shadowed faces readable and, more usefully,
  // makes the undersides warm while the tops stay cool, which is most of what
  // sells outdoor light.
  const bounce = new THREE.HemisphereLight(0xb4d2f5, 0xc0a074, 0.75);
  scene.add(bounce);

  // A cool rim from behind the range, so silhouettes separate from the sky.
  const rim = new THREE.DirectionalLight(0xbcd6f5, 0.3);
  rim.position.set(-50, 30, -140);
  scene.add(rim);
}

/**
 * "THE RUN" painted on the floor with a U-turn arrow: the movement course is
 * behind you and to the left. Reads from the spawn looking down the lanes.
 */
function spawnNote(): THREE.Mesh {
  const cv = document.createElement("canvas");
  cv.width = 1024;
  cv.height = 384;
  const g = cv.getContext("2d")!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const draw = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    // a U-turn arrow: up, round to the left, and back down
    g.strokeStyle = "rgba(226,116,43,0.92)";
    g.fillStyle = "rgba(226,116,43,0.92)";
    g.lineWidth = 34;
    g.beginPath();
    g.moveTo(250, 330);
    g.lineTo(250, 170);
    g.arc(160, 170, 90, 0, Math.PI, true);
    g.lineTo(70, 250);
    g.stroke();
    g.beginPath();
    g.moveTo(20, 240);
    g.lineTo(120, 240);
    g.lineTo(70, 330);
    g.closePath();
    g.fill();
    g.font = '700 150px "Rajdhani", Impact, sans-serif';
    g.fillText("THE RUN", 320, 190);
    g.fillStyle = "rgba(232,226,214,0.9)";
    g.font = '600 62px "Rajdhani", "Segoe UI", sans-serif';
    g.fillText("courses: turn round. basic left, advanced right", 322, 285);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('700 100px "Rajdhani"').then(draw, () => undefined);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 1.35),
    new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.9, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
  m.rotation.x = -Math.PI / 2;
  return m;
}

/**
 * The climb zones painted on a wall, 6 m wide and 4 m tall from the floor:
 * mini (0 to 19 hu), green (19 to 47 hu), neutral (47 to 147 hu), from the
 * movement constants so the paint cannot drift from the rules.
 */
function climbZonesPanel(): THREE.Mesh {
  const PX = 96;
  const W = 6;
  const H = 4;
  const cv = document.createElement("canvas");
  cv.width = W * PX;
  cv.height = H * PX;
  const g = cv.getContext("2d")!;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const y = (m: number) => cv.height - m * PX;
  const mini = MOVE.climbMiniZone;
  const green = MOVE.climbGreenZoneTop;
  const top = MOVE.climbSpaceHeight;
  const draw = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    const band = (from: number, to: number, fill: string, label: string, color: string) => {
      g.fillStyle = fill;
      g.fillRect(0, y(to), cv.width, y(from) - y(to));
      g.fillStyle = color;
      g.font = '700 30px "Rajdhani", "Segoe UI", sans-serif';
      g.fillText(label, 16, y(to) + 32);
    };
    band(green, top, "rgba(160,170,180,0.22)", "NEUTRAL: wall push, no height", "#e8ecef");
    band(mini, green, "rgba(63,191,95,0.72)", "GREEN: jump with your feet here", "#ffffff");
    band(0, mini, "rgba(59,130,196,0.7)", "MINI", "#ffffff");
    g.fillStyle = "rgba(255,255,255,0.8)";
    g.fillRect(0, y(top) - 2, cv.width, 4);
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('700 30px "Rajdhani"').then(draw, () => undefined);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(W, H),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
  );
}

/** a painted chevron pointing up the texture (+v), for the floor arrows */
function chevronTexture(): THREE.CanvasTexture {
  const S = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const g = cv.getContext("2d")!;
  g.strokeStyle = "rgba(226,116,43,0.9)";
  g.lineWidth = 20;
  g.lineCap = "square";
  g.beginPath();
  g.moveTo(20, 96);
  g.lineTo(64, 40);
  g.lineTo(108, 96);
  g.stroke();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
