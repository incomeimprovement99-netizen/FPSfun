// The firing range's dressing in the Neon City bundle (Milestone 691, docs/PLAN_RANGE_NEON.md): tools/range-dress.ts
// bakes the street (its road and sidewalks, the blocks either side, across its far end and over the gate wall, the
// bundle's signs and lights) into one small file of its own, public/models/paid/neon/range-v<version>.glb, read as the
// tutorial's is (tutorialdress.ts) and laid over the range, whose own colliders stay. Small, as the tutorial's: the
// range is the first thing a player loads, and the city's file is 155 MB.
//
// A checkout without the bought files has no file here: the range's plain look stays.
import * as THREE from "three";
import { loadNeonDress } from "./tutorialdress";
import dress from "../config/rangedress.json";

/** what the dressing did, for the tests and the screen */
export const RANGE_DRESS = { asked: false, drawn: false, failed: false, meshes: 0, file: "" };

/** the dressing's file, read and made ready to draw, or null where there is none (or it would not read) */
export async function loadRangeDress(renderer: THREE.WebGLRenderer): Promise<THREE.Object3D | null> {
  return loadNeonDress(renderer, `models/paid/neon/range-v${dress.version}.glb?v=${dress.version}`, "range:dress", RANGE_DRESS);
}
