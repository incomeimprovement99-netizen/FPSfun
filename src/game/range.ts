// The range. Laid out like a real firing range rather than an empty box:
// a covered firing line, numbered lanes running out to 100 m, a low cover
// row for crouch and slide practice, elevated side platforms reached by
// stairs and a ramp, and a moving target rail.
//
// All geometry is generated here. Materials are CC0 (public/tex/ATTRIBUTION.md).
import * as THREE from "three";
import { material, tileBox } from "./materials";
import { PAL, bevel, flat, emissive, hazardTexture, floorNumber, textPanel } from "./geo";
import { LADDERS, ZIPLINES } from "./traversal";
import { makeSky, type Hour, type Sky } from "./sky";
import type { Bounds } from "./player";
import type { Placement } from "./props";

// maxZ reaches past the back wall to take in the movement course (course.ts).
export const RANGE_BOUNDS: Bounds = { minX: -34, maxX: 34, minZ: -108, maxZ: 212 };
/**
 * The gate through the firing line's back wall into the course, x range. In
 * the back-left corner behind the spawn, between the first two weapon racks.
 * It used to be straight behind the spawn, where nobody turned round to see it.
 */
export const COURSE_GATE = { minX: -23.5, maxX: -19.5 };
/** the second gate, back-right: the way into the tutorial (courses/tutorial.ts) */
export const COURSE_GATE_R = { minX: 19.5, maxX: 23.5 };
/** the third, in the middle behind the spawn: the tutorial's way out into the range, between the gun and hack stands */
export const COURSE_GATE_C = { minX: -2, maxX: 2 };
/** the gates this game's back wall has, left to right */
export const COURSE_GATES = [COURSE_GATE, COURSE_GATE_C, COURSE_GATE_R];

/**
 * Direction TO the sun. About 25 degrees of elevation, behind and to the right
 * of the spawn, so shadows rake away down the lanes rather than toward the
 * player's eye. Shared by the light and by the sky dome's sun disk, or the
 * painted sun and the real shadows would disagree.
 */
export const SUN_DIR = new THREE.Vector3(0.56, 0.66, 0.50).normalize();

let sunLight: THREE.DirectionalLight | null = null;
/** the sky fill and the rim light, each hour's own strength (setHour) */
let fillLight: THREE.HemisphereLight | null = null;
let rimLight: THREE.DirectionalLight | null = null;
/** the sun the hour lights the world with, for what stages a place's own light over it (atmosphere.ts districts) */
export const sunNow = (): THREE.DirectionalLight | null => sunLight;
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

/**
 * Put the world on another hour of the day: the dome's four colours, the
 * sun's direction, colour and strength, and the fog. The shadow map has to be
 * redrawn because it is static, and the caller reinstalls the environment map
 * because that needs the renderer.
 *
 * The sun keeps the shadow centre it was built with rather than being moved,
 * so a change of hour never slides the shadow region off the range.
 */
export function setHour(h: Hour, scene: THREE.Scene): void {
  rangeSky?.setHour(h);
  const fog = scene.fog as THREE.Fog | null;
  if (fog && rangeSky) fog.color.copy(rangeSky.fogColor);
  const sun = sunLight;
  if (sun) {
    const centre = sun.target.position.clone();
    sun.position.copy(h.dir).multiplyScalar(150).add(centre);
    sun.color.setHex(h.light);
    sun.intensity = h.intensity;
  }
  scene.environmentIntensity = h.env;
  if (fillLight) fillLight.intensity = h.fill;
  if (rimLight) rimLight.intensity = h.rim;
}

/**
 * The share of the sky's environment light the range gets (Milestone 631). It was indoors under a dark roof, and the
 * sky's reflection off its glossy floor was a white blaze under bloom beside the gun and hack stands at every hour:
 * at none the range is dark as a hall at night and lit by its own lamps, at a third the stands and targets keep their
 * colour. A street of the Neon City since Milestone 691, open to the sky, and its wet asphalt kept from the same blaze
 * at the same third. The battle royale's city keeps the whole of it.
 */
export const RANGE_ENV_SHARE = 0.3;

/** Axis-aligned solid the player collides with and can stand on. */
export interface Solid {
  minX: number; maxX: number; minZ: number; maxZ: number; top: number;
  /** floor height of the solid; the player can only stand on it from above */
  base: number;
  /** a door (doors.ts): it moves as the door opens and shuts, and a walk of the map treats its doorway as a way through */
  door?: boolean;
  /** a slick face: no wall run or climb starts on it or carries along it; a mantle still takes its top (the tutorial, Milestone 633) */
  slick?: boolean;
}
export const RANGE_SOLIDS: Solid[] = [];
/**
 * The range's plain look, its floor and its walls' faces: what the Neon street's dressing (rangedress.ts, Milestone
 * 691) is laid over and hides. Kept out of the page's static merge (userData.dynamic), which could not hide it after.
 */
export const RANGE_PLAIN = new THREE.Group();
/** the range walls' colliders reach this high, over the street's tallest building (rangedress.json blocks, 44 m) */
const WALLS_TOP = 60;

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
  scene: THREE.Object3D,
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

export interface RangeOptions {
  /** point lights cost every lit pixel; Competitive and Balanced drop them */
  pointLights: boolean;
  shadowSize: number;
  /** boxes of things other modules stand in the range (SpeedKills' armory's cases, armory.ts), pushed with its own */
  solids?: Solid[];
}

export function buildRange(scene: THREE.Scene, opts: RangeOptions = { pointLights: true, shadowSize: 4096 }): void {
  RANGE_SOLIDS.length = 0;
  TARGET_RAILS.length = 0;
  RANGE_PLAIN.clear();
  RANGE_PLAIN.name = "range:plain";
  RANGE_PLAIN.visible = true;
  scene.add(RANGE_PLAIN);
  ZIPLINES.length = 0;
  LADDERS.length = 0;
  if (opts.solids) RANGE_SOLIDS.push(...opts.solids);

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
  // SpeedKills (Phase 20 A12): the city's own pavement and street under a night palette, and its neon for the glow (the
  // legacy game's sunlit warehouse colours went in Milestone 534)
  const concrete = material("skPave", { color: 0x8a8e96, roughness: 0.9, metalness: 0.02 });
  const ground = material("skStreet", { color: 0x9aa0aa, roughness: 0.95, metalness: 0.02 });
  // METALNESS IS A PHYSICAL CLAIM, NOT A GLOSS DIAL. A metal has no diffuse
  // response at all: it shows only what it reflects. With a blue sky as the
  // only environment, the 0.72-metal roof reflected nothing but blue sky, so
  // its shaded underside rendered with a red channel of literally ZERO and the
  // whole top of the frame read as flat navy. Measured off the screenshot:
  // rgb(1, 47, 76) where the ceiling should have been painted grey.
  //
  // Painted structural steel is a dielectric with a thin metal flake at most.
  // These are the values for painted metal, not for a mirror.
  const wall = flat(0x252b3a, 0.7, 0.1);
  const panel = flat(0x161b27, 0.6, 0.12);

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
  RANGE_PLAIN.add(pad);

  // ---------- lane markings ----------
  const paint = new THREE.MeshStandardMaterial({ color: PAL.paint, roughness: 0.85 });
  const paintDim = new THREE.MeshStandardMaterial({ color: 0x8e8878, roughness: 0.9 });

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
  // Four pieces and three gates, each with a lintel over it: back-left into
  // THE RUN, back-right into the tutorial, the middle the tutorial's way out.
  const cuts = [-34, ...COURSE_GATES.flatMap((g) => [g.minX, g.maxX]), 34];
  for (let i = 0; i < cuts.length; i += 2) addBox(RANGE_PLAIN, wall, cuts[i + 1] - cuts[i], 6, 1, (cuts[i] + cuts[i + 1]) / 2, 0, 8.5);
  for (const g of COURSE_GATES) addBox(RANGE_PLAIN, wall, g.maxX - g.minX, 2.5, 1, (g.minX + g.maxX) / 2, 3.5, 8.5);
  // Side walls. 10 m, not 6: a sprint jump off the 4.6 m platform peaked at
  // 5.9 m and landed the player on top of a 6 m wall, where the arena clamp
  // then kept them walking along the cap.
  // They stop at the back wall (z 9): past it on the left the course's own
  // wall carries on, and two coplanar walls would flicker.
  addBox(RANGE_PLAIN, wall, 1, 10, 117, -34, 0, -49.5, { tile: 3 });
  addBox(RANGE_PLAIN, wall, 1, 10, 117, 34, 0, -49.5, { tile: 3 });
  // far backstop
  addBox(RANGE_PLAIN, wall, 68, 9, 1.5, 0, 0, -107.5, { tile: 3 });

  // Closed up to 10 m over the gate wall and the backstop, and the walls' colliders taller than the street's buildings
  // either side (rangedress.json blocks, 18 to 44 m): with no roof since Milestone 691 (the owner: "nothing is the old UI
  // anymore, its all built off the city"), a LEAP's 16 m would have cleared a 10 m wall
  addBox(RANGE_PLAIN, wall, 68, 4, 1, 0, 6, 8.5, { tile: 3 });
  addBox(RANGE_PLAIN, wall, 68, 1, 1.5, 0, 9, -107.5, { tile: 3 });
  for (const [minX, maxX, minZ, maxZ] of [
    [-34.5, -33.5, -108.25, 9],
    [33.5, 34.5, -108.25, 9],
    [-34.5, 34.5, -108.25, -106.75],
    [-34.5, 34.5, 8, 9],
  ]) RANGE_SOLIDS.push({ minX, maxX, minZ, maxZ, base: 10, top: WALLS_TOP });

  // ---------- the way to the course ----------
  // A lit frame round the gate, a sign over it facing the spawn, and arrows
  // on the floor from the spawn to it.
  const chevron = chevronTexture();
  const arrowMat = new THREE.MeshBasicMaterial({ map: chevron, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  // (the tutorial's way out has no arrows: it is not a way in)
  for (const [g, glowColor, title, fromX, arrows] of [
    [COURSE_GATE, PAL.orange, "THE RUN\nNine rooms out and back: a slide, a climb, a double jump, a wall run, a superglide. Beat the clock.", -3, true],
    [COURSE_GATE_R, 0xffd23c, "THE TUTORIAL: START HERE\nEvery move, then your hacks, then a gun: the game a room at a time.", 3, true],
    [COURSE_GATE_C, 0x7ddc8a, "THE TUTORIAL: WAY OUT\nIt comes out here, into the range.", 0, false],
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
    if (!arrows) continue;
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
  // You spawn facing down the lanes with the gate behind you, so a note is
  // painted on the floor just in front of the spawn where you will see it.
  const note = spawnNote();
  note.position.set(-2.8, 0.014, -3.4);
  scene.add(note);

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

  // (the warehouse's crates, drums, barriers and floodlights went with it, Milestone 691: the street is the dressing's)
  PROP_PLACEMENTS.length = 0;

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
  fillLight = bounce;

  // A cool rim from behind the range, so silhouettes separate from the sky.
  const rim = new THREE.DirectionalLight(0xbcd6f5, 0.3);
  rim.position.set(-50, 30, -140);
  scene.add(rim);
  rimLight = rim;
  // (the plain look out of the page's static merge, so the street's dressing can hide it: rangedress.ts)
  RANGE_PLAIN.traverse((o) => (o.userData.dynamic = true));
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
    g.fillText("TUTORIAL", 320, 190);
    g.fillStyle = "rgba(232,226,214,0.9)";
    g.font = '600 62px "Rajdhani", "Segoe UI", sans-serif';
    g.fillText("turn round: the right-hand gate. THE RUN: left", 322, 285);
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
