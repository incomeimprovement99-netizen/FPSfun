/**
 * A damped spring pulled back to rest, stepped in pieces no longer than 1/240 s, so it stays stable at any frame time.
 * Stepped once a frame, a stiff one grows without end on a slow frame: the USSO's kick (stiffness 900, damping 46) did
 * past about 23 fps, where a frame's damping step overshoots, and flung the gun off (its roll read -695968 radians on a
 * software-rendered page). Returns the new offset and speed.
 */
export function springStep(x: number, v: number, stiffness: number, damping: number, dt: number): [number, number] {
  const n = Math.max(1, Math.ceil(dt * 240));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    v += (-stiffness * x - damping * v) * h;
    x += v * h;
  }
  return [x, v];
}
