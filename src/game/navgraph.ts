// The battle royale's bot graph, walked toward a point.
//
// A bot running from the ring used to walk a straight line at the next
// circle's middle. That line was never one of the graph's tested links: it
// ran into the Table, down the Notch's defile and over the edge cliffs. The
// graph is walked instead: one breadth-first walk out from the node nearest
// the middle gives every node its next step toward it, worked out once a
// circle. Pure, so the checks can walk it.

export interface NavNode {
  x: number;
  z: number;
  /** the floor it is on, where not the ground (a deck, a crest, a tower's storey) */
  y?: number;
  links: number[];
  /** nodes reached by riding a rope from this one (br.ts): a step like any other, taken by riding */
  ropes?: number[];
}

export interface NavTree {
  /** the node nearest the point: the walk's end, from where a bot goes straight in */
  target: number;
  /** each node's next step toward the target; -1 at the target, -2 where no link leads to it */
  toward: Int32Array;
}

export function navTree(nodes: readonly NavNode[], x: number, z: number, o: { ground?: boolean; target?: number } = {}): NavTree {
  // `target`: that node itself. `ground`: the nearest on the ground only, since
  // a node up a tower's stairs can be the nearest across and is a storey up
  // (SpeedKills' city, whose low towers' stairs are on the graph)
  let target = o.target ?? 0;
  let best = Infinity;
  if (o.target === undefined)
    nodes.forEach((n, i) => {
      const d = Math.hypot(n.x - x, n.z - z);
      if (n.links.length && d < best && !(o.ground && (n.y ?? 0) > 1.5)) {
        best = d;
        target = i;
      }
    });
  const toward = new Int32Array(nodes.length).fill(-2);
  toward[target] = -1;
  const queue = [target];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const j of nodes[i].links) {
      if (toward[j] !== -2) continue;
      toward[j] = i;
      queue.push(j);
    }
    // a rope is a step too: the walk plans through it, and the bot rides it
    for (const j of nodes[i].ropes ?? []) {
      if (toward[j] !== -2) continue;
      toward[j] = i;
      queue.push(j);
    }
  }
  return { target, toward };
}
