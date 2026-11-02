// The underground floors' open edges (rules.underground.edge), for the bake (tools/import-neon.ts): where a floor under the
// street meets a higher one past its edge with no box across it, the game's floorAt is all that stands there.

type Edge = { out: number; in: number; every: number; knee: number; lip: number };
type Floor = { rect: number[]; y: number };

/**
 * The floors under the street as the game reads them (src/game/neonmap.ts FLOORS, first match first): the court, its
 * halls, then the underground's, map-local metres.
 */
export function groundFloors(cfg: { court: { x0: number; x1: number; z0: number; z1: number; y: number; halls: Array<{ x0: number; x1: number; z0: number; z1: number }> }; underground: { floors: Floor[] } }): Floor[] {
  const K = cfg.court;
  return [{ rect: [K.x0, K.x1, K.z0, K.z1], y: K.y }, ...K.halls.map((h) => ({ rect: [h.x0, h.x1, h.z0, h.z1], y: K.y })), ...cfg.underground.floors];
}

/**
 * Each run of a floor's edge where the floor past it is higher by more than `step` and no box crosses the strip from
 * `in` inside the edge to `out` past it from under `knee` over the floor all the way up to the next floor (within `lip`):
 * the box that shuts it, [x0, x1, z0, z1, y0, y1], `out` thick past the edge, from the floor to the next one's height.
 * Up to the next floor, not to a body's height: a ball thrown over a wall that stops short came up through the slab too.
 */
export function openEdges(F: Floor[], boxes: number[][], E: Edge, step: number): number[][] {
  const at = (x: number, z: number) => F.find(({ rect: [x0, x1, z0, z1] }) => x >= x0 && x <= x1 && z >= z0 && z <= z1)?.y ?? 0;
  const low = Math.min(...F.map((f) => f.y));
  const under = boxes.filter((b) => b[4] < 0 && b[5] > low);
  const out: number[][] = [];
  for (const { rect: [x0, x1, z0, z1], y } of F) {
    // (each side: whether it runs along x, its line, which way is out, and its ends)
    const sides: Array<[boolean, number, number, number, number]> = [[true, z0, -1, x0, x1], [true, z1, 1, x0, x1], [false, x0, -1, z0, z1], [false, x1, 1, z0, z1]];
    for (const [ax, e, sg, a, b] of sides) {
      const n = Math.max(1, Math.ceil((b - a) / E.every));
      const d = (b - a) / n;
      let run = null as { from: number; to: number; top: number } | null;
      const close = () => {
        if (!run) return;
        const [o0, o1] = sg < 0 ? [e - E.out, e] : [e, e + E.out];
        // (a run that reaches a corner goes `out` past it, so the two sides' boxes meet there)
        const r0 = run.from <= a ? a - E.out : run.from - d / 2;
        const r1 = run.to >= b ? b + E.out : run.to + d / 2;
        out.push(ax ? [r0, r1, o0, o1, y, run.top] : [o0, o1, r0, r1, y, run.top]);
        run = null;
      };
      for (let k = 0; k <= n; k++) {
        const t = a + k * d;
        const next = ax ? at(t, e + sg * E.out) : at(e + sg * E.out, t);
        const [s0, s1] = sg < 0 ? [e - E.out, e + E.in] : [e - E.in, e + E.out];
        const [bx0, bx1, bz0, bz1] = ax ? [t, t, s0, s1] : [s0, s1, t, t];
        const shut = next - y <= step || under.some((q) => q[0] <= bx1 && q[1] >= bx0 && q[2] <= bz1 && q[3] >= bz0 && q[4] <= y + E.knee && q[5] >= next - E.lip);
        if (shut || (run && run.top !== next)) close();
        if (shut) continue;
        if (run) run.to = t;
        else run = { from: t, to: t, top: next };
      }
      close();
    }
  }
  return out;
}
