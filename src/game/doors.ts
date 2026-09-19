// Doors (src/config/doors.json).
//
// Every doorway on Outskirts was a hole: a gap in the wall with a lintel over
// it, so nobody inside ever heard anyone coming and a building could not be
// held. Each ground-floor doorway brpoi.ts builds now has a door hung in it,
// closed at the start of a match. E opens or closes the one you look at, a
// bot opens one it walks into, and the host decides every door for everyone.
//
// A door is a panel on a hinge at one end of the gap, and a solid in the
// map's collision list. Closed, the solid fills the doorway; open, it is the
// panel swung 90 degrees into the building, against which you can still
// bump. The solid is the same object either way, moved rather than added or
// removed, so the list keeps its length (the minimap redraws on a change of
// length) and everything that reads it (movement, bullets, the bots' sight,
// sound through walls) sees the door as it is now. It carries `door: true`,
// so the tests' walk of the map treats a doorway as a way through.
import * as THREE from "three";
import cfg from "../config/doors.json";
import { RANGE_SOLIDS, type Solid } from "./range";

export type DoorSide = "n" | "s" | "e" | "w";

/** a doorway as brpoi.ts builds it: the gap's centre on the wall line, at its floor, in the map's own coordinates */
export interface Doorway {
  x: number;
  z: number;
  y: number;
  /** which wall of the building: the door swings in, away from it */
  side: DoorSide;
  /** the wall's thickness */
  t: number;
  /** the gap's width and height */
  w: number;
  h: number;
}

/** every doorway the map's buildings made, in the order they were built (brpoi.ts adds to it; the map reads it once) */
export const DOORWAYS: Doorway[] = [];

export interface Door {
  readonly i: number;
  /** the middle of the doorway, in the world, at half the door's height */
  readonly centre: THREE.Vector3;
  readonly side: DoorSide;
  open: boolean;
  /** kicked in: gone from the doorway until the next match, and it cannot be shut */
  broken: boolean;
  /** melee hits taken while shut (config kicks breaks it) */
  hits: number;
  /** 0 closed to 1 open, as drawn */
  swing: number;
  readonly pivot: THREE.Group;
  readonly solid: Solid;
  readonly closed: Readonly<Omit<Solid, "door">>;
  readonly opened: Readonly<Omit<Solid, "door">>;
  /** the rotation of the pivot closed, and how far it turns to open */
  readonly yaw0: number;
  readonly turn: number;
}

const HALF_PI = Math.PI / 2;

export class Doors {
  readonly list: Door[] = [];
  /** a door opened, shut, kicked or kicked in here (by anyone): main plays it */
  onChange: ((door: Door, what: "open" | "close" | "kick" | "break") => void) | null = null;

  constructor(root: THREE.Group, origin: { x: number; z: number }, ways: readonly Doorway[]) {
    const panelMat = new THREE.MeshStandardMaterial({ color: cfg.colour, roughness: 0.55, metalness: 0.35 });
    const handleMat = new THREE.MeshStandardMaterial({ color: 0xc8c8c8, roughness: 0.3, metalness: 0.9 });
    for (const d of ways) {
      const horizontal = d.side === "n" || d.side === "s";
      const width = d.w - cfg.gap * 2;
      const height = d.h - cfg.gap;
      // the hinge: the doorway's west end in a wall along x, its north end in one along z
      const hx = horizontal ? d.x - d.w / 2 + cfg.gap : d.x;
      const hz = horizontal ? d.z : d.z - d.w / 2 + cfg.gap;
      // closed, the panel runs from the hinge along the wall: +x, or +z (a turn of -90 degrees)
      const yaw0 = horizontal ? 0 : -HALF_PI;
      // it swings in, away from the wall's own side of the building
      const turn = d.side === "s" || d.side === "w" ? HALF_PI : -HALF_PI;
      const pivot = new THREE.Group();
      pivot.position.set(hx, d.y, hz);
      pivot.rotation.y = yaw0;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(width, height, cfg.thick), panelMat);
      panel.position.set(width / 2, height / 2, 0);
      panel.castShadow = true;
      panel.receiveShadow = true;
      // a handle on each face, at the far end from the hinge
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, cfg.thick + 0.08), handleMat);
      handle.position.set(width - 0.18, 1.0, 0);
      for (const m of [panel, handle]) {
        // it moves: the map's static merge must leave it out
        m.userData.dynamic = true;
        pivot.add(m);
      }
      root.add(pivot);
      const wx = origin.x;
      const wz = origin.z;
      const closed = horizontal
        ? { minX: wx + d.x - d.w / 2, maxX: wx + d.x + d.w / 2, minZ: wz + d.z - d.t / 2, maxZ: wz + d.z + d.t / 2, base: d.y, top: d.y + d.h }
        : { minX: wx + d.x - d.t / 2, maxX: wx + d.x + d.t / 2, minZ: wz + d.z - d.w / 2, maxZ: wz + d.z + d.w / 2, base: d.y, top: d.y + d.h };
      // open: the panel against the hinge side, pointing into the building
      const into = d.side === "s" ? { x: 0, z: -1 } : d.side === "n" ? { x: 0, z: 1 } : d.side === "w" ? { x: 1, z: 0 } : { x: -1, z: 0 };
      const ex = wx + hx + into.x * width;
      const ez = wz + hz + into.z * width;
      const T = cfg.thick / 2 + 0.02;
      const opened = {
        minX: Math.min(wx + hx, ex) - T,
        maxX: Math.max(wx + hx, ex) + T,
        minZ: Math.min(wz + hz, ez) - T,
        maxZ: Math.max(wz + hz, ez) + T,
        base: d.y,
        top: d.y + height,
      };
      const solid: Solid = { ...closed, door: true };
      RANGE_SOLIDS.push(solid);
      this.list.push({
        i: this.list.length,
        centre: new THREE.Vector3(wx + d.x, d.y + d.h / 2, wz + d.z),
        side: d.side,
        open: false,
        broken: false,
        hits: 0,
        swing: 0,
        pivot,
        solid,
        closed,
        opened,
        yaw0,
        turn,
      });
    }
  }

  /**
   * Open or close door `i`; false when it was already so. The solid moves at
   * once, so a door being opened is already out of the way; one being closed
   * is in the doorway at once, which is why a door with a body in it is not
   * closed (canClose).
   */
  set(i: number, open: boolean): boolean {
    const d = this.list[i];
    if (!d || d.open === open || d.broken) return false;
    d.open = open;
    Object.assign(d.solid, open ? d.opened : d.closed);
    this.onChange?.(d, open ? "open" : "close");
    return true;
  }

  /** a melee hit on shut door `i`: "kick" while it holds, "break" as it goes, null for an open or broken one */
  kick(i: number): "kick" | "break" | null {
    const d = this.list[i];
    if (!d || d.open || d.broken) return null;
    d.hits++;
    if (d.hits < cfg.kicks) {
      this.onChange?.(d, "kick");
      return "kick";
    }
    this.breakDoor(i);
    return "break";
  }

  /** a kick heard here that the host counted (a friend's page plays it; the state comes with the break) */
  kickHeard(i: number): void {
    const d = this.list[i];
    if (d && !d.broken) this.onChange?.(d, "kick");
  }

  /** door `i` kicked in: gone from the doorway, nothing left to bump into, never shut again this match */
  breakDoor(i: number): void {
    const d = this.list[i];
    if (!d || d.broken) return;
    d.broken = true;
    d.open = true;
    // flat on its own floor: no height left to stop anything
    Object.assign(d.solid, { ...d.closed, top: d.closed.base });
    d.pivot.visible = false;
    this.onChange?.(d, "break");
  }

  /** the kicked-in doors, for the ring packet */
  brokenList(): number[] {
    return this.list.filter((d) => d.broken).map((d) => d.i);
  }

  /** every door as the host says: open the listed ones, close the rest (the ring packet's door list) */
  setOpen(open: readonly number[]): void {
    const want = new Set(open);
    for (const d of this.list) this.set(d.i, want.has(d.i));
  }

  /** the open doors, for the ring packet */
  openList(): number[] {
    return this.list.filter((d) => d.open).map((d) => d.i);
  }

  /** a new match: every door shut, drawn shut */
  reset(): void {
    for (const d of this.list) {
      d.open = false;
      d.broken = false;
      d.hits = 0;
      d.swing = 0;
      Object.assign(d.solid, d.closed);
      d.pivot.rotation.y = d.yaw0;
      d.pivot.visible = true;
    }
  }

  /** nobody standing in the doorway (a body there would be shut inside the door) */
  canClose(i: number, bodies: Iterable<{ x: number; y: number; z: number }>): boolean {
    const d = this.list[i];
    if (!d) return false;
    const c = d.closed;
    const r = cfg.bodyRadius;
    for (const b of bodies) if (b.x + r > c.minX && b.x - r < c.maxX && b.z + r > c.minZ && b.z - r < c.maxZ && b.y < c.top && b.y + 1.8 > c.base) return false;
    return true;
  }

  /** the door you look at within reach of the eye, or null */
  aimedAt(eye: THREE.Vector3, fwd: THREE.Vector3): Door | null {
    let best: Door | null = null;
    let bestDot = cfg.aimDot;
    const to = new THREE.Vector3();
    for (const d of this.list) {
      if (d.broken) continue;
      to.subVectors(d.centre, eye);
      const dist = to.length();
      if (dist > cfg.reach || Math.abs(d.centre.y - eye.y) > 2) continue;
      const dot = to.normalize().dot(fwd);
      // up close the doorway fills the view: any look at it will do
      const need = dist < 1.2 ? 0.2 : bestDot;
      if (dot > need && (!best || dot > bestDot)) {
        best = d;
        bestDot = Math.max(dot, cfg.aimDot);
      }
    }
    return best;
  }

  /** a closed door a body at `p` has walked into (a bot's), or null */
  closedAt(p: { x: number; y: number; z: number }, reach: number): Door | null {
    for (const d of this.list) {
      if (d.open) continue;
      if (Math.abs(p.y - (d.centre.y - (d.closed.top - d.closed.base) / 2)) > 1.5) continue;
      if (Math.hypot(p.x - d.centre.x, p.z - d.centre.z) < reach) return d;
    }
    return null;
  }

  /** the panels swing toward where their doors are */
  update(dt: number): void {
    const k = Math.min(1, dt / cfg.swing);
    for (const d of this.list) {
      const want = d.open ? 1 : 0;
      if (d.swing === want) continue;
      d.swing = d.swing < want ? Math.min(want, d.swing + k) : Math.max(want, d.swing - k);
      // eased at both ends, as a door on a closer moves
      const e = d.swing * d.swing * (3 - 2 * d.swing);
      d.pivot.rotation.y = d.yaw0 + d.turn * e;
    }
  }
}
