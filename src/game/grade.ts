// Colour grade.
//
// This runs AFTER OutputPass, so it works on display-referred sRGB values
// rather than linear HDR. That is deliberate: contrast, split-toning and
// vignette are "look" operations and every film grade does them in display
// space. Doing them before tone mapping fights the tone mapper instead.
//
// What each term buys, in order of how much it changes the frame:
//
//   split-tone  shadows cool, highlights warm. Two hues in a frame is what
//               separates "lit" from "flat". Costs nothing and does more than
//               any geometry change.
//   S-curve     the greybox render sits in a 50-65% value band. Pushing the
//               ends apart is what gives surfaces weight.
//   saturation  PBR under a neutral HDRI comes out grey. Colour is a choice.
//   vignette    focuses the centre, and hides the fact that the range runs out
//               of world at the frame edge.
//   grain       breaks up the flat gradients that give away a synthetic image,
//               especially across the sky.
import * as THREE from "three";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

const vert = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

const frag = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec3  uShadowTint;
uniform vec3  uHighlightTint;
uniform float uContrast;
uniform float uSaturation;
uniform float uVignette;
uniform float uGrain;
uniform float uTime;
varying vec2 vUv;

const vec3 LUMA = vec3( 0.2126, 0.7152, 0.0722 );

// cheap hash, good enough for grain
float hash( vec2 p ) {
  return fract( sin( dot( p, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

void main() {
  vec3 c = texture2D( tDiffuse, vUv ).rgb;

  // --- split tone ---
  float l = dot( c, LUMA );
  vec3 tint = mix( uShadowTint, uHighlightTint, smoothstep( 0.12, 0.72, l ) );
  c *= tint;

  // --- S-curve around the 0.5 pivot ---
  // A straight (c-0.5)*k+0.5 clips both ends, so ease it: the smoothstep term
  // bends the shoulder and toe instead of shearing them off.
  vec3 lift = ( c - 0.5 ) * uContrast + 0.5;
  vec3 soft = c * c * ( 3.0 - 2.0 * c );
  c = mix( lift, soft, 0.35 );

  // --- saturation ---
  float g = dot( c, LUMA );
  c = mix( vec3( g ), c, uSaturation );

  // --- vignette ---
  vec2 q = ( vUv - 0.5 ) * vec2( 1.0, 0.86 );
  float v = 1.0 - uVignette * dot( q, q ) * 2.2;
  c *= v;

  // --- grain, scaled down in the highlights where it would read as noise ---
  float n = hash( vUv * 1024.0 + fract( uTime ) * 37.0 ) - 0.5;
  c += n * uGrain * ( 1.0 - smoothstep( 0.55, 1.0, dot( c, LUMA ) ) );

  // Gamut guard. A plain clamp() turns an out-of-range colour into a DIFFERENT
  // hue: pinning a slightly negative red to zero is what made the sky read as
  // pure cyan with no red in it. Pulling the colour back toward its own luma
  // instead costs saturation and keeps the hue.
  float lo = min( c.r, min( c.g, c.b ) );
  if ( lo < 0.0 ) {
    float lum = dot( c, LUMA );
    c = mix( vec3( lum ), c, clamp( lum / ( lum - lo ), 0.0, 1.0 ) );
  }
  gl_FragColor = vec4( clamp( c, 0.0, 1.0 ), 1.0 );
}
`;

export interface GradeSettings {
  shadowTint: number;
  highlightTint: number;
  contrast: number;
  saturation: number;
  vignette: number;
  grain: number;
}

/**
 * Tuned against `shots/firing-line.png`. The shadow tint is a desaturated
 * blue and the highlight tint a warm cream: that pair is the whole reason a
 * late-afternoon frame reads as late afternoon.
 */
export const GRADE: GradeSettings = {
  // A gentler shadow tint than the first pass. 0x8b9ec2 was a strong blue, and
  // stacked on a dimmed environment it turned every shaded surface navy. The
  // point of a split tone is a hint of separation, not a colour cast.
  shadowTint: 0xaebed6,
  highlightTint: 0xfff2e0,
  contrast: 1.09,
  saturation: 1.06,
  // 0.38 was a heavy vignette. On a wide FOV it darkened most of the frame,
  // because at 109 degrees the "edge" is where you are actually looking.
  vignette: 0.2,
  grain: 0.016,
};

export function makeGradePass(s: GradeSettings = GRADE): ShaderPass {
  const pass = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      // The tints multiply, so they are normalised around 1.0 rather than used
      // as raw colours: a 0x8b9ec2 used directly would halve the whole frame.
      uShadowTint: { value: normalised(s.shadowTint) },
      uHighlightTint: { value: normalised(s.highlightTint) },
      uContrast: { value: s.contrast },
      uSaturation: { value: s.saturation },
      uVignette: { value: s.vignette },
      uGrain: { value: s.grain },
      uTime: { value: 0 },
    },
    vertexShader: vert,
    fragmentShader: frag,
  });
  return pass;
}

/**
 * Scale a colour so its mean channel is 1.0. Multiplying by the result shifts
 * hue without changing overall exposure, which is what a tint should do.
 *
 * The bytes are read straight out of the hex rather than through THREE.Color,
 * and that is the whole point. THREE.Color linearises on assignment, but this
 * pass runs after OutputPass and therefore works on display-referred sRGB.
 * Linearising exaggerates the ratio between channels: 0xaebed6 is a gentle
 * blue at (0.68, 0.75, 0.84) and a much stronger one at (0.42, 0.51, 0.67)
 * once linearised. Normalised, that turned into a 0.79x multiplier on red
 * instead of 0.90x, and combined with the saturation lift it drove the sky's
 * red channel negative, where the final clamp pinned it to ZERO. Measured off
 * shots/firing-line.png: the sky read (0, 44, 90) at the top of frame, a
 * colour with no red in it at all.
 */
function normalised(hex: number): THREE.Vector3 {
  const r = ((hex >> 16) & 0xff) / 255;
  const g = ((hex >> 8) & 0xff) / 255;
  const b = (hex & 0xff) / 255;
  const mean = (r + g + b) / 3;
  return new THREE.Vector3(r / mean, g / mean, b / mean);
}
