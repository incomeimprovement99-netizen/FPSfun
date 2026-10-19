// A squad mate's ghost as the squad sees it (Milestone 605). Out in a battle royale with a squad mate standing, a player
// goes on as a ghost that runs where they run (brmatch.ts), and Hyper Scape's squads see theirs (its echoes) as the
// players still: a figure of light, running, jumping, looking round. Ours was a pale capsule where they were. This is their
// soldier, playing its own clips from what they send, drawn as light in the colour the squad knows them by (their name
// tag's, squadview.ts). It holds no gun (a ghost fires none), casts no shadow and has nothing to hit: it is not a Dummy,
// with no hit volumes, and only a squad mate's page makes one (main.ts stepGhosts).
import * as THREE from "three";
import { MannequinFigure, useMannequin } from "./mannequin";
import type { FigureStance } from "./dummy";
import type { OperatorSkin } from "./operators";
import figureCfg from "../config/figure.json";

/** how see-through the light is, and how fast the figure closes on where its player was last heard (figure.json ghost) */
const GHOST = figureCfg.ghost as { opacity: number; follow: number };
const DEG = Math.PI / 180;

/** what a squad mate sent: where they are and what they are doing (duel.ts Sample) */
export interface GhostSample {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  stance: FigureStance;
  speed: number;
}

export class GhostFigure {
  readonly group = new THREE.Group();
  private readonly mq: MannequinFigure;
  private readonly light: THREE.MeshBasicMaterial;
  private placed = false;

  /** null until the soldier's files have loaded: there is nothing to make it of before */
  static make(skin: OperatorSkin): GhostFigure | null {
    return useMannequin() ? new GhostFigure(skin) : null;
  }

  private constructor(skin: OperatorSkin) {
    this.mq = new MannequinFigure(skin, null);
    this.mq.showEyes(false);
    this.light = new THREE.MeshBasicMaterial({ transparent: true, opacity: GHOST.opacity, depthWrite: false });
    this.mq.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.castShadow = false;
      m.receiveShadow = false;
      m.material = this.light;
    });
    this.group.add(this.mq.root);
    this.group.userData.dynamic = true;
  }

  /** onto the last thing its player sent, moving the way they move, in the squad colour */
  update(last: GhostSample, color: THREE.ColorRepresentation, moveDir: number, dt: number): void {
    this.light.color.set(color);
    const k = this.placed ? 1 - Math.exp(-GHOST.follow * dt) : 1;
    this.placed = true;
    this.group.position.x += (last.x - this.group.position.x) * k;
    this.group.position.y += (last.y - this.group.position.y) * k;
    this.group.position.z += (last.z - this.group.position.z) * k;
    // the figure faces +z; a player at yaw 0 looks down -z
    this.group.rotation.y = last.yaw * DEG + Math.PI;
    this.mq.update({ speed: last.speed, stance: last.stance, pitch: last.pitch, moveDir }, dt, false, { kick: 0, flinch: 0, jolt: 0, legYaw: 0, ads: 0 });
  }

  /** it is the soldier, drawn in light: a skinned body, every mesh of it in the ghost's own see-through material */
  drawn(): boolean {
    let skinned = 0;
    let other = 0;
    this.mq.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh || !m.visible) return;
      if ((m as THREE.SkinnedMesh).isSkinnedMesh && m.material === this.light) skinned++;
      else other++;
    });
    return skinned > 0 && other === 0 && this.light.transparent && this.light.opacity < 1;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.mq.dispose();
    this.light.dispose();
  }
}
