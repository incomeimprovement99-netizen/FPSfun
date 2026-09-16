// An authored sky dome.
//
// The HDRI is still loaded, but only as `scene.environment` for reflections
// and ambient. It is no longer the background, for two reasons:
//
//   1. A photographic sky has a horizon at a fixed height that does not line
//      up with where our ground plane ends, so the frame showed a hard seam
//      with sky visible *below* the horizon line.
//   2. A photo cannot be art-directed. A gradient can be tuned to the grade
//      and to the fog in one place, which is what makes ground and sky read
//      as one space.
//
// Three bands, blended: ground haze below the horizon, a warm band at the
// horizon, and a deep band at the zenith, plus a sun disk with a wide glow.
import * as THREE from "three";
import skyCfg from "../config/sky.json";

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  // Direction from the camera, in world space. Using position directly works
  // because the dome is centred on the camera every frame.
  vDir = normalize( ( modelMatrix * vec4( position, 1.0 ) ).xyz - cameraPosition );
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const frag = /* glsl */ `
uniform vec3  uZenith;
uniform vec3  uHorizon;
uniform vec3  uGround;
uniform vec3  uSunColor;
uniform vec3  uSunDir;
uniform float uSunSize;
uniform float uGlow;
varying vec3 vDir;

void main() {
  vec3 d = normalize( vDir );

  // height above the horizon, 0 at the horizon and 1 at the zenith
  float h = d.y;

  // Horizon to zenith. The exponent sets how tall the pale horizon band is:
  // 0.42 put the half-way point about 5 degrees up, which compressed the whole
  // gradient into a narrow strip and read as a hard bright BAND across the
  // frame rather than as sky. 0.55 puts it at about 15 degrees, which is what
  // a hazy day actually looks like.
  vec3 sky = mix( uHorizon, uZenith, pow( clamp( h, 0.0, 1.0 ), 0.55 ) );

  // Below the horizon we mostly keep the horizon colour and only lean part of
  // the way toward the ground haze, over a wide angle. Blending all the way to
  // a darker haze over a tenth of a radian was the other half of the band: a
  // pale strip with something darker on BOTH sides of it.
  vec3 c = mix( sky, uGround, smoothstep( 0.0, -0.40, h ) * 0.65 );

  // sun disk plus a wide atmospheric glow that also warms the horizon near it
  float cosA = dot( d, normalize( uSunDir ) );
  float disk = smoothstep( 1.0 - uSunSize, 1.0 - uSunSize * 0.35, cosA );
  float glow = pow( max( cosA, 0.0 ), 18.0 ) * uGlow;
  c += uSunColor * ( disk * 6.0 + glow );

  gl_FragColor = vec4( c, 1.0 );
}
`;

export interface SkyColors {
  zenith: number;
  horizon: number;
  ground: number;
  sun: number;
}

/**
 * Bright afternoon, NOT golden hour.
 *
 * The first attempt at this went moody: a deep blue zenith, a low warm sun and
 * a dimmed environment. The result was a night scene with a blown-out band
 * where the pale horizon met the dark sky. That was the wrong reference. The
 * range we are copying is a bright sunny desert, so the sky is a clean daylight
 * blue, the horizon is pale rather than orange, and the ground haze is the same
 * warm sand as the floor so the pad and the distance read as one material.
 */
export const SKY: SkyColors = {
  zenith: 0x3f7cc4,
  horizon: 0xc6d5e2,
  ground: 0xa89880,
  sun: 0xfff0d0,
};

/**
 * The hours of the day (src/config/sky.json), each with its own dome palette,
 * sun and environment map. One sky meant every match was the same hour of the
 * same day, which is the cheapest variety a shooter can have: the light does
 * more for how a map reads than any amount of geometry.
 */
export interface Hour {
  id: string;
  label: string;
  /** the HDRI in public/tex; a missing one falls back to sky.hdr */
  hdr: string;
  colors: SkyColors;
  /** the direction the light comes from, normalised */
  dir: THREE.Vector3;
  /** the directional light's strength, and scene.environmentIntensity */
  intensity: number;
  env: number;
  /** the range's fog, in metres; the battle royale scales both up */
  fog: [number, number];
}

const hex = (s: string): number => parseInt(s, 16);

export const HOURS: Record<string, Hour> = Object.fromEntries(
  Object.entries(skyCfg.hours).map(([id, h]) => [
    id,
    {
      id,
      label: h.label,
      hdr: h.hdr,
      colors: { zenith: hex(h.zenith), horizon: hex(h.horizon), ground: hex(h.ground), sun: hex(h.sun) },
      dir: new THREE.Vector3(h.dir[0], h.dir[1], h.dir[2]).normalize(),
      intensity: h.intensity,
      env: h.env,
      fog: [h.fog[0], h.fog[1]] as [number, number],
    },
  ])
);

/** the order the settings menu shows them in */
export const HOUR_IDS: string[] = skyCfg.order.filter((id) => id in HOURS);
export const DEFAULT_HOUR = skyCfg.default;

/** an unknown id (an old saved setting, a typo) falls back to the default */
export function hourFor(id: string | null | undefined): Hour {
  return HOURS[id ?? ""] ?? HOURS[DEFAULT_HOUR];
}

const HOUR_KEY = "range.sky.hour";

/** the owner's chosen hour, kept the way the graphics preset is */
export function loadHour(): Hour {
  try {
    return hourFor(localStorage.getItem(HOUR_KEY));
  } catch {
    return HOURS[DEFAULT_HOUR];
  }
}

export function saveHour(id: string): void {
  try {
    localStorage.setItem(HOUR_KEY, id);
  } catch {
    // a browser with storage switched off still gets to change the hour, it
    // just does not keep it
  }
}

export interface Sky {
  mesh: THREE.Mesh;
  /** call once per frame so the dome stays centred on the camera */
  follow(camera: THREE.Camera): void;
  /** the colour the scene fog should be, so ground meets sky without a seam */
  fogColor: THREE.Color;
  /**
   * Repaint the dome for another hour. The dome is one shader with four
   * colour uniforms, so changing the hour is four writes and a fog colour
   * rather than rebuilding anything.
   */
  setHour(h: Hour): void;
}

export function makeSky(sunDir: THREE.Vector3, c: SkyColors = SKY): Sky {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(c.zenith) },
      uHorizon: { value: new THREE.Color(c.horizon) },
      uGround: { value: new THREE.Color(c.ground) },
      uSunColor: { value: new THREE.Color(c.sun) },
      uSunDir: { value: sunDir.clone().normalize() },
      uSunSize: { value: 0.0035 },
      uGlow: { value: 0.22 },
    },
    vertexShader: vert,
    fragmentShader: frag,
    side: THREE.BackSide,
    depthWrite: false,
    // Drawn first, and never depth-tested, so every piece of real geometry
    // paints over it no matter how far away the dome is.
    depthTest: false,
    // The dome is the background: it must never be fogged, never be lit, and
    // never be tone-mapped twice.
    fog: false,
    toneMapped: false,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), mat);
  // 200 m, comfortably INSIDE the camera's 400 m far plane. At 4000 the whole
  // dome sat beyond the far plane, which is a clipping bug waiting to bite
  // even where it happened to survive. depthTest is off as well, so the dome
  // is always behind everything regardless of where it physically sits.
  mesh.scale.setScalar(200);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1000;
  mesh.name = "sky";

  // The fog wants the colour the sky actually shows at the horizon in the
  // direction you spend most time looking, which is a blend of horizon and
  // ground haze rather than either one.
  const fogColor = new THREE.Color(c.horizon).lerp(new THREE.Color(c.ground), 0.18);

  const u = mat.uniforms;
  return {
    mesh,
    fogColor,
    follow(camera: THREE.Camera) {
      mesh.position.copy(camera.position);
    },
    setHour(h: Hour) {
      (u.uZenith.value as THREE.Color).setHex(h.colors.zenith);
      (u.uHorizon.value as THREE.Color).setHex(h.colors.horizon);
      (u.uGround.value as THREE.Color).setHex(h.colors.ground);
      (u.uSunColor.value as THREE.Color).setHex(h.colors.sun);
      (u.uSunDir.value as THREE.Vector3).copy(h.dir);
      fogColor.setHex(h.colors.horizon).lerp(new THREE.Color(h.colors.ground), 0.18);
    },
  };
}
