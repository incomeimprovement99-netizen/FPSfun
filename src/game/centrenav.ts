// THE CENTRE's bots walk the Neon City's own graph (neonmap.ts), cut to the circle (arenas/centre.ts). An arena's bots
// walk straight at where they want to be, with a slide along a wall and a detour out of a pocket: in the city's middle
// that ran them into the tower's podium and its walls. A battle royale's bots walk the graph; these do the same, its
// nodes kept inside the circle and every link that leaves it dropped (no rope and no jump pad is inside it).
import * as THREE from "three";
import { navTree, type NavNode, type NavTree } from "./navgraph";
import { botBlocked } from "./botbody";

/** how far off a node's floor a bot still counts as on it (the graph's own climb, brmatch.ts nearestNode's floor) */
const FLOOR = 2.5;
/** within this of its node, a bot goes on to the next */
const ARRIVE = 1.5;

export class CircleNav {
  readonly nodes: NavNode[];
  private trees = new Map<number, NavTree>();

  constructor(all: readonly NavNode[], c: { x: number; z: number; r: number }) {
    const keep = new Map<number, number>();
    all.forEach((n, i) => {
      if (Math.hypot(n.x - c.x, n.z - c.z) <= c.r) keep.set(i, keep.size);
    });
    this.nodes = [...keep.keys()].map((i) => ({
      x: all[i].x,
      z: all[i].z,
      y: all[i].y,
      links: all[i].links.filter((j) => keep.has(j)).map((j) => keep.get(j)!),
    }));
  }

  /** the node nearest a spot on its own floor that leads somewhere; the nearest of any floor if none is */
  nearest(x: number, y: number, z: number): number {
    let best = -1;
    let bestD = Infinity;
    let any = -1;
    let anyD = Infinity;
    this.nodes.forEach((n, i) => {
      if (!n.links.length) return;
      const d = Math.hypot(n.x - x, n.z - z);
      if (d < anyD) {
        anyD = d;
        any = i;
      }
      if (Math.abs((n.y ?? 0) - y) < FLOOR && d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best >= 0 ? best : any;
  }

  /** nothing that stops a body every half metre from `from` to `to`, at its height (bots.ts clearWalk's test) */
  private clear(from: THREE.Vector3, to: THREE.Vector3): boolean {
    const n = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / 0.5);
    for (let i = 1; i <= n; i++) if (botBlocked(from.x + ((to.x - from.x) * i) / n, from.z + ((to.z - from.z) * i) / n, from.y)) return false;
    return true;
  }

  /**
   * Where a bot at `from` walks next on its way to `to`: straight at it where nothing stands between, else its own
   * node first, then each next node of the graph's way, then `to` itself once on the node nearest it. Where the graph
   * has no way (an island of it), straight at `to`. (Measured from each of the eight spawns to the 1v1's circle,
   * 2026-10-01: straight alone never got there from the two north of the tower, 40 m off after 45 s; the graph alone
   * stopped 5.5 m short from one west of it, where straight took 17 s.)
   */
  step(from: THREE.Vector3, to: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    if (this.clear(from, to)) return out.copy(to);
    const a = this.nearest(from.x, from.y, from.z);
    const t = this.nearest(to.x, to.y, to.z);
    if (a < 0 || t < 0 || a === t) return out.copy(to);
    let tree = this.trees.get(t);
    if (!tree) {
      tree = navTree(this.nodes, to.x, to.z, { target: t });
      this.trees.set(t, tree);
    }
    const next = tree.toward[a];
    if (next < 0) return out.copy(to);
    // on to the next node once at its own, or already on the way (no farther from the next than its own node is): its
    // own node stays the nearest until it is halfway along, and sent back to it each time it went and came again
    const na = this.nodes[a];
    const nn = this.nodes[next];
    const onWay = Math.hypot(nn.x - from.x, nn.z - from.z) <= Math.hypot(nn.x - na.x, nn.z - na.z);
    const go = onWay || Math.hypot(na.x - from.x, na.z - from.z) < ARRIVE ? nn : na;
    return out.set(go.x, go.y ?? 0, go.z);
  }
}
