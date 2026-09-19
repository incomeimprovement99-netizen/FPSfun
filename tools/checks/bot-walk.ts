// How a bot finds its way: along the battle royale's graph to the ring, and
// what it can see in front of it.
//
// A bot running from the ring used to walk straight at the next circle's
// middle, across the Table, the Notch's defile and the edge cliffs, none of it
// a link the graph's walk was ever tested on. It walks the graph now: from
// every node, the steps must reach the node nearest the middle, for a circle
// at every place the ring is drawn toward. And a bot not in a fight sees only
// in front of it, where it used to see behind itself too.
//
// Builds the real map in node (a canvas that draws nothing stands in for the
// page's, as net-delta.ts does). Run on its own: npx tsx tools/checks/bot-walk.ts.
import * as THREE from "three";

const g = globalThis as unknown as Record<string, unknown>;
const hadDocument = "document" in g;
// anything asked of it answers with more of itself: a canvas, its context, an image
const anyProxy = (): unknown =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "measureText" ? () => ({ width: 10 }) : k === Symbol.toPrimitive ? () => 0 : k === "width" || k === "height" ? 64 : anyProxy()),
    set: () => true,
    apply: () => anyProxy(),
  });
const fakeEl = (): unknown => ({ width: 64, height: 64, style: {}, getContext: () => anyProxy(), addEventListener() {}, removeEventListener() {}, set src(_v: string) {} });
if (!hadDocument) g.document = { createElement: () => fakeEl(), createElementNS: () => fakeEl() };
const warn = console.warn;
console.warn = () => undefined;
const { buildBrMap } = await import("../../src/game/br");
const { RING_ATTRACTORS } = await import("../../src/game/ring");
const { navTree } = await import("../../src/game/navgraph");
const { inCone } = await import("../../src/game/bots");
const botsCfg = (await import("../../src/config/bots.json")).default;
const map = buildBrMap(new THREE.Scene());
console.warn = warn;
if (!hadDocument) delete g.document;

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("A bot's way to the ring, and what it sees");
{
  const nodes = map.nodes;
  let stuck = 0;
  let longest = 0;
  for (const a of RING_ATTRACTORS) {
    const t = navTree(nodes, a.x, a.z);
    nodes.forEach((n, i) => {
      if (!n.links.length) return;
      let at = i;
      let steps = 0;
      while (at !== t.target && steps <= nodes.length) {
        const next = t.toward[at];
        if (next < 0) break;
        // every step is one of the graph's own links
        if (!nodes[at].links.includes(next)) stuck++;
        at = next;
        steps++;
      }
      if (at !== t.target) stuck++;
      longest = Math.max(longest, steps);
    });
  }
  check(`from all ${nodes.length} nodes, along the graph's own links, to the node nearest each of the ${RING_ATTRACTORS.length} places a ring closes toward`, stuck === 0, `${stuck} stuck, the longest ${longest} steps`);
}
{
  const min = botsCfg.sight.min;
  // facing +z (yaw 0): ahead is +z
  check("a bot sees what is in front of it", inCone(0, 0, 60) && inCone(0, 30, 60));
  check("but not behind it, or far to its side, out of a fight", !inCone(0, 0, -60) && !inCone(0, 60, -5));
  check(`within ${min} m it notices you whichever way it faces`, inCone(0, 0, -(min - 1)));
}

console.log(fails === 0 ? "\nBOT WALK PASS" : `\nBOT WALK FAIL (${fails})`);
export const botWalkFails = fails;
if (process.argv[1]?.endsWith("bot-walk.ts")) process.exit(fails === 0 ? 0 : 1);
