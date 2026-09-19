// Render pipeline.
//
// The order matters and OutputPass must be last: it does the tone mapping and
// the sRGB conversion, so anything after it renders with wrong colours.
//
// What each pass buys, in order of how much it changes the look:
//   GTAO   contact darkening in every corner where surface meets surface.
//          The single biggest win for a scene built out of boxes, which
//          otherwise reads as flat shapes floating on a flat floor.
//   Bloom  a high threshold so only emissive strips and muzzle flashes glow,
//          not the whole scene. This is what reads as "sci-fi".
//   SMAA   MSAA is unavailable once a composer is in play, so edges need an
//          explicit pass or everything is jagged. It runs AFTER tone mapping
//          because edge detection wants display-referred values, not HDR.
//   Grade  split-tone, S-curve, saturation, vignette, grain. The cheapest
//          change in the whole project and the one that reads as "a game".
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { Pass } from "three/examples/jsm/postprocessing/Pass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/examples/jsm/postprocessing/SMAAPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { makeGradePass, GRADE } from "./grade";
import type { Quality } from "./quality";


/**
 * GTAOPass finds depth and normals by redrawing the whole scene with one
 * override material, and before doing so it hides only points and lines.
 * Everything else is drawn SOLID, whatever its own material says:
 *
 *   - sprites and transparent quads became opaque slabs in the AO buffer and
 *     were shaded as black rectangles. That was the "black panels on the
 *     walls": the 4 x 2 m distance-label sprites, and the damage readout
 *     sprite on every target board.
 *   - meshes with an invisible material (the dummies' hit zones, which are now
 *     separate from the robot you see) would have been drawn as boxes, putting
 *     box-shaped AO halos round every dummy.
 *
 * So the pass also hides those for its own prepass. The visibility cache it
 * already keeps restores them afterwards.
 */
function excludeFromAo(gtao: GTAOPass): void {
  const pass = gtao as unknown as { overrideVisibility: () => void; scene: THREE.Scene };
  const original = pass.overrideVisibility.bind(gtao);
  pass.overrideVisibility = () => {
    original();
    pass.scene.traverse((o) => {
      if ((o as THREE.Sprite).isSprite) {
        o.visible = false;
        return;
      }
      const mat = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mat) return;
      const list = Array.isArray(mat) ? mat : [mat];
      if (list.every((m) => m.transparent || !m.visible)) o.visible = false;
    });
  };
}

/** the layer the first-person gun is on: only its own camera sees it */
export const VM_LAYER = 1;

/**
 * The gun, over the world: its own camera (its own FOV), the depth cleared
 * so it never sinks into a wall. The sky is the world pass's (a background
 * drawn again here would paint over it), and the shadow maps are too (the
 * lights the gun is lit by are the world's, and drawing their shadows again
 * would cost a second shadow pass for nothing).
 */
function drawViewModel(r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera): void {
  const clear = r.autoClear;
  const shadows = r.shadowMap.autoUpdate;
  const sky = scene.background;
  r.autoClear = false;
  r.shadowMap.autoUpdate = false;
  scene.background = null;
  r.clearDepth();
  r.render(scene, cam);
  r.autoClear = clear;
  r.shadowMap.autoUpdate = shadows;
  scene.background = sky;
}

/** the gun's pass in the post chain: after the world and its AO (the gun takes none), before bloom (its flash blooms) */
class ViewModelPass extends Pass {
  constructor(
    private scene: THREE.Scene,
    private cam: THREE.Camera
  ) {
    super();
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    drawViewModel(renderer, this.scene, this.cam);
  }
}

export class Renderer {
  /** null in Competitive: the scene is drawn straight to the screen */
  readonly composer: EffectComposer | null = null;
  private grade: ShaderPass | null = null;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    q: Quality,
    private vmCamera: THREE.PerspectiveCamera | null = null
  ) {
    // Competitive: no composer at all. Rendering straight to the canvas keeps
    // hardware MSAA, skips four full-screen passes, and removes the offscreen
    // copy a composer adds between the scene and the display.
    if (!q.post) return;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const composer = new EffectComposer(renderer);
    this.composer = composer;
    composer.addPass(new RenderPass(scene, camera));

    if (q.ao) {
      const gtao = new GTAOPass(scene, camera, w, h);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.updateGtaoMaterial({
        radius: 1.1,
        distanceExponent: 1.4,
        thickness: 1.0,
        scale: 1.0,
        samples: 16,
        distanceFallOff: 1.0,
        screenSpaceRadius: false,
      });
      gtao.blendIntensity = 1.0;
      excludeFromAo(gtao);
      composer.addPass(gtao);
    }

    if (vmCamera) composer.addPass(new ViewModelPass(scene, vmCamera));

    if (q.bloom) {
      // Threshold 0.95 and a lower strength: emissive trim glows, gunfire only
      // just crosses it. At 0.5 strength the muzzle flash lit the whole frame.
      const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.32, 0.5, 0.95);
      composer.addPass(bloom);
    }

    // Tone mapping and the sRGB conversion; everything after works on
    // display-referred values, which is what SMAA and the grade want.
    composer.addPass(new OutputPass());

    if (q.smaa) {
      const smaa = new SMAAPass(w * renderer.getPixelRatio(), h * renderer.getPixelRatio());
      composer.addPass(smaa);
    }

    if (q.grade) {
      const grade = makeGradePass();
      this.grade = grade;
      composer.addPass(grade);
    }
  }

  /**
   * The composer sizes every pass at CSS size times its pixel ratio. Sizing
   * the AO and bloom passes again at CSS size after it (as this did) dropped
   * them to a quarter of the pixels on a 2x screen after the first resize.
   */
  setSize(w: number, h: number): void {
    this.composer?.setSize(w, h);
  }

  /** the window moved to a screen with another pixel ratio, or the zoom changed */
  setPixelRatio(pr: number): void {
    this.composer?.setPixelRatio(pr);
  }

  private desat = 0;
  private desatDiv: HTMLDivElement | null = null;
  /**
   * 0..1: the picture loses its colour (low health). The grade does it where
   * there is one; Competitive has no post chain, so a blend layer over the
   * canvas does it there (only while it is above zero).
   */
  setDesaturation(k: number): void {
    const v = Math.max(0, Math.min(1, k));
    if (Math.abs(v - this.desat) < 0.005) return;
    this.desat = v;
    if (this.grade) {
      this.grade.uniforms.uSaturation.value = GRADE.saturation * (1 - v);
      return;
    }
    if (!this.desatDiv) {
      const d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;pointer-events:none;background:#808080;mix-blend-mode:saturation;z-index:1";
      document.body.appendChild(d);
      this.desatDiv = d;
    }
    this.desatDiv.style.opacity = String(v);
    this.desatDiv.style.display = v > 0.01 ? "block" : "none";
  }

  render(now = 0): void {
    if (!this.composer) {
      this.renderer.render(this.scene, this.camera);
      if (this.vmCamera) drawViewModel(this.renderer, this.scene, this.vmCamera);
      return;
    }
    if (this.grade) this.grade.uniforms.uTime.value = now;
    this.composer.render();
  }
}
