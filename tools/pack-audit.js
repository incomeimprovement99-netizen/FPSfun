// In the page, for tools/pack-frames.ts: how much of the bought arms' hands is inside our gun this frame.
// Each hand vertex (every second one, of those weighted most to a hand or finger bone) is taken into each gun part's own
// frame and to the nearest point of that part's surface: it is inside when it is behind every face that nearest point
// lies on, and its depth is how far. Counting ray crossings was fooled by the models' inner shells (a silencer's bore,
// a magazine inside its grip): points round the grip read 38 mm deep, and a point under the gun's top face read outside.
// Each part's triangles are bucketed in a grid once, in its own frame, since the parts do not change shape.
// A point inside counts as `seen` when where it goes in (its nearest point of the surface) is in the eye's sight: a
// fingertip wrapped round the far side of a grip is inside it, but hidden behind the gun, and no one sees it; nor does
// anyone see what is off the gun camera's picture (at the hip the USSO's right hand is mostly under the screen's edge).
window.__packAudit = (deep, keep) => {
  const r = window.__range;
  const T = r.THREE;
  const root = r.viewModelRoot();
  let rig = null;
  root.traverse((o) => {
    if (o.name === "pack-arms") rig = o;
  });
  if (!rig || !rig.visible) return null;
  root.updateMatrixWorld(true);
  const shown = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  const under = (o, a) => {
    for (let p = o; p; p = p.parent) if (p === a) return true;
    return false;
  };
  const parts = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || under(o, rig) || !shown(o)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m && m.transparent) return;
    // (a part mirrored in the scene winds its faces the other way in its own frame: three.js turns them round to draw it)
    const flip = o.matrixWorld.determinant() < 0 ? -1 : 1;
    parts.push({ o, flip, grid: gridOf(o.geometry, T), inv: new T.Matrix4().copy(o.matrixWorld).invert(), scale: o.getWorldScale(new T.Vector3()).x });
  });
  const rigScale = rig.getWorldScale(new T.Vector3()).x;
  // (a scope's picture hides the gun: nothing to test)
  if (!parts.length) return { l: 0, r: 0, seenL: 0, seenR: 0, seenDeepest: 0, deepest: 0, where: {}, bones: {}, seenBones: {}, tested: 0, touch: 0, self: true, selfShare: 1, pts: [], push: {}, parts: 0, gap: { l: Infinity, r: Infinity }, palmGap: { l: Infinity, r: Infinity } };
  const HAND = /^(hand|index|middle|ring|pinky|thumb)(_\d+)?_([lr])$/;
  const out = { l: 0, r: 0, seenL: 0, seenR: 0, seenDeepest: 0, deepest: 0, where: {}, bones: {}, seenBones: {}, tested: 0, touch: 0, self: false, selfShare: 0, pts: [], push: {}, gap: { l: Infinity, r: Infinity }, palmGap: { l: Infinity, r: Infinity } };
  // how near each hand comes to the gun, and its palm alone, view metres (0 touching or in): a hand meant to hold the gun
  // and short of it by a few millimetres reads as a gap between them
  const eye = rig.getWorldPosition(new T.Vector3());
  // the gun camera's picture from the eye (the rig's group is the view's: its origin the eye, looking down -z)
  const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180);
  const tanH = tanV * (innerWidth / innerHeight);
  const onScreen = (w) => {
    const e = rig.worldToLocal(w.clone());
    return e.z < 0 && Math.abs(e.x) <= -e.z * tanH && Math.abs(e.y) <= -e.z * tanV;
  };
  const sight = new T.Raycaster();
  sight.layers.enableAll();
  const partMeshes = parts.map((p) => p.o);
  const sides = new Map();
  // each palm's way out of the gun (world): the nearest surface's way from each of its points inside, and how far
  const pushes = { l: [], r: [] };
  let nearQ = null;
  // the test on itself: down onto the biggest part's top at 16 places, a point 1 mm under the face it meets is inside
  // and one 2 cm over it is not; it holds if 14 of the 16 agree (a thin plate under the top can put the point through)
  const big = parts.reduce((a, p) => (!a || p.grid.size > a.grid.size ? p : a), null);
  if (big) {
    const g = big.grid;
    const ray = new T.Raycaster();
    ray.layers.enableAll();
    const down = new T.Vector3(0, -1, 0).transformDirection(big.o.matrixWorld);
    const side = big.o.material.side;
    big.o.material.side = T.DoubleSide;
    let tried = 0;
    let right = 0;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const x = g.box.min.x + ((i + 0.5) / 4) * (g.box.max.x - g.box.min.x);
        const z = g.box.min.z + ((j + 0.5) / 4) * (g.box.max.z - g.box.min.z);
        ray.set(new T.Vector3(x, g.box.max.y + g.size, z).applyMatrix4(big.o.matrixWorld), down);
        const hit = ray.intersectObject(big.o, false)[0];
        if (!hit) continue;
        tried++;
        const inL = hit.point.clone().addScaledVector(down, 0.001 * rigScale).applyMatrix4(big.inv);
        const outL = hit.point.clone().addScaledVector(down, -0.02 * rigScale).applyMatrix4(big.inv);
        if (big.flip * depthIn(g, inL) > 0 && big.flip * depthIn(g, outL) < 0) right++;
      }
    big.o.material.side = side;
    out.selfShare = tried ? right / tried : 0;
    out.self = tried >= 4 && right / tried >= 14 / 16;
  }
  const v = new T.Vector3();
  const loc = new T.Vector3();
  rig.traverse((sk) => {
    if (!sk.isSkinnedMesh || !shown(sk)) return;
    if (!sk.userData.handVerts) {
      const si = sk.geometry.attributes.skinIndex;
      const sw = sk.geometry.attributes.skinWeight;
      const list = [];
      for (let i = 0; i < si.count; i += 2) {
        let best = 0;
        let bi = 0;
        for (let k = 0; k < 4; k++)
          if (sw.getComponent(i, k) > best) {
            best = sw.getComponent(i, k);
            bi = si.getComponent(i, k);
          }
        const m = (sk.skeleton.bones[bi]?.name ?? "").match(HAND);
        if (m) list.push([i, m[3], sk.skeleton.bones[bi].name]);
      }
      sk.userData.handVerts = list;
    }
    for (const [i, side, bone] of sk.userData.handVerts) {
      sk.getVertexPosition(i, v);
      v.applyMatrix4(sk.matrixWorld);
      out.tested++;
      for (const p of parts) {
        loc.copy(v).applyMatrix4(p.inv);
        if (!p.grid.box.containsPoint(loc)) {
          // (outside the part's box: how far from it, only near it)
          if (p.grid.box.distanceToPoint(loc) * p.scale / rigScale < 0.03) {
            const d0 = p.flip * depthIn(p.grid, loc);
            const away = Math.max(0, -d0) * p.scale / rigScale;
            out.gap[side] = Math.min(out.gap[side], away);
            if (bone === `hand_${side}`) out.palmGap[side] = Math.min(out.palmGap[side], away);
          }
          continue;
        }
        const d = p.flip * depthIn(p.grid, loc);
        {
          const away = Math.max(0, -d) * p.scale / rigScale;
          out.gap[side] = Math.min(out.gap[side], away);
          if (bone === `hand_${side}`) out.palmGap[side] = Math.min(out.palmGap[side], away);
        }
        if (d <= 0) continue;
        out.touch++;
        const depth = (d * p.scale) / rigScale;
        if (bone === `hand_${side}` && nearQ) pushes[side].push(nearQ.clone().sub(loc).transformDirection(p.o.matrixWorld).multiplyScalar(d * p.scale));
        out.deepest = Math.max(out.deepest, depth);
        if (depth > deep) {
          // where it goes in, in the world, and whether the eye sees that point first along its line
          const q = nearQ.clone().applyMatrix4(p.o.matrixWorld);
          const to = q.clone().sub(eye);
          const dist = to.length();
          for (const m of partMeshes) for (const mat of [].concat(m.material)) if (!sides.has(mat)) { sides.set(mat, mat.side); mat.side = T.DoubleSide; }
          sight.set(eye, to.normalize());
          sight.far = dist + 0.01;
          const first = sight.intersectObjects(partMeshes, false)[0];
          const seen = onScreen(q) && (!first || first.distance > dist - 0.003 * rigScale);
          if (seen) {
            out[side === "l" ? "seenL" : "seenR"]++;
            out.seenDeepest = Math.max(out.seenDeepest, depth);
            out.seenBones[bone] = Math.max(out.seenBones[bone] || 0, Math.round(depth * 1000));
          }
          if (keep) out.pts.push([v.x, v.y, v.z, depth, seen ? 1 : 0]);
          out[side]++;
          out.bones[bone] = Math.max(out.bones[bone] || 0, Math.round(depth * 1000));
          const n = p.o.name || p.o.parent?.name || "?";
          out.where[n] = (out.where[n] || 0) + 1;
        }
      }
    }
  });
  for (const [mat, side] of sides) mat.side = side;
  for (const side of ["l", "r"]) {
    const list = pushes[side];
    if (!list.length) continue;
    const n = list.reduce((a, v) => a.add(v), new T.Vector3()).normalize();
    const far = Math.max(...list.map((v) => v.dot(n)));
    out.push[side] = [n.x * far, n.y * far, n.z * far];
  }
  return out;

  // a part's triangles in its own frame, bucketed in a grid of cells a 48th of its longest side
  function gridOf(geo, T) {
    if (geo.userData.auditGrid) return geo.userData.auditGrid;
    const pos = geo.attributes.position;
    const idx = geo.index;
    const n = idx ? idx.count / 3 : pos.count / 3;
    const tri = new Float32Array(n * 9);
    for (let t = 0; t < n; t++)
      for (let k = 0; k < 3; k++) {
        const i = idx ? idx.getX(t * 3 + k) : t * 3 + k;
        tri[t * 9 + k * 3] = pos.getX(i);
        tri[t * 9 + k * 3 + 1] = pos.getY(i);
        tri[t * 9 + k * 3 + 2] = pos.getZ(i);
      }
    geo.computeBoundingBox();
    const box = geo.boundingBox.clone();
    const sz = box.getSize(new T.Vector3());
    const size = Math.max(sz.x, sz.y, sz.z);
    const cell = size / 48;
    const dim = [Math.max(1, Math.ceil(sz.x / cell)), Math.max(1, Math.ceil(sz.y / cell)), Math.max(1, Math.ceil(sz.z / cell))];
    const cells = new Map();
    const ci = (a, lo, d) => Math.min(d - 1, Math.max(0, Math.floor((a - lo) / cell)));
    for (let t = 0; t < n; t++) {
      const o = t * 9;
      const lo = [Math.min(tri[o], tri[o + 3], tri[o + 6]), Math.min(tri[o + 1], tri[o + 4], tri[o + 7]), Math.min(tri[o + 2], tri[o + 5], tri[o + 8])];
      const hi = [Math.max(tri[o], tri[o + 3], tri[o + 6]), Math.max(tri[o + 1], tri[o + 4], tri[o + 7]), Math.max(tri[o + 2], tri[o + 5], tri[o + 8])];
      for (let x = ci(lo[0], box.min.x, dim[0]); x <= ci(hi[0], box.min.x, dim[0]); x++)
        for (let y = ci(lo[1], box.min.y, dim[1]); y <= ci(hi[1], box.min.y, dim[1]); y++)
          for (let z = ci(lo[2], box.min.z, dim[2]); z <= ci(hi[2], box.min.z, dim[2]); z++) {
            const key = (x * dim[1] + y) * dim[2] + z;
            let c = cells.get(key);
            if (!c) cells.set(key, (c = []));
            c.push(t);
          }
    }
    const g = { tri, box, size, cell, dim, cells, ci };
    geo.userData.auditGrid = g;
    return g;
  }

  // how far behind the nearest surface a point is (its part's frame): positive inside, negative outside. A point by an
  // edge or a corner is as near several faces: inside only if it is behind every one of them
  function depthIn(g, p) {
    const px = p.x, py = p.y, pz = p.z;
    const cx = g.ci(px, g.box.min.x, g.dim[0]), cy = g.ci(py, g.box.min.y, g.dim[1]), cz = g.ci(pz, g.box.min.z, g.dim[2]);
    let best = Infinity;
    let bestQ = null;
    const found = [];
    const seen = new Set();
    const maxRing = Math.max(g.dim[0], g.dim[1], g.dim[2]);
    for (let ring = 0; ring <= maxRing; ring++) {
      for (let x = cx - ring; x <= cx + ring; x++)
        for (let y = cy - ring; y <= cy + ring; y++)
          for (let z = cz - ring; z <= cz + ring; z++) {
            if (Math.max(Math.abs(x - cx), Math.abs(y - cy), Math.abs(z - cz)) !== ring) continue;
            if (x < 0 || y < 0 || z < 0 || x >= g.dim[0] || y >= g.dim[1] || z >= g.dim[2]) continue;
            const c = g.cells.get((x * g.dim[1] + y) * g.dim[2] + z);
            if (!c) continue;
            for (const t of c) {
              if (seen.has(t)) continue;
              seen.add(t);
              const r = closest(g.tri, t, px, py, pz);
              found.push(r);
              if (r.d < best) {
                best = r.d;
                bestQ = r.q;
              }
            }
          }
      // every cell within ring cells of the point is searched, so nothing unsearched is nearer than that (best is squared)
      if (Math.sqrt(best) <= ring * g.cell) break;
    }
    if (best === Infinity) return -1;
    nearQ = new T.Vector3(bestQ[0], bestQ[1], bestQ[2]);
    const eps = best * 1e-4 + g.cell * g.cell * 1e-8;
    for (const r of found) if (r.d <= best + eps && !r.behind) return -Math.sqrt(best);
    return Math.sqrt(best);
  }

  // the nearest point of triangle t to p (Ericson, Real-Time Collision Detection 5.1.5): squared distance, and whether p
  // is behind the face (the winding's normal)
  function closest(tri, t, px, py, pz) {
    const o = t * 9;
    const ax = tri[o], ay = tri[o + 1], az = tri[o + 2];
    const bx = tri[o + 3], by = tri[o + 4], bz = tri[o + 5];
    const cx = tri[o + 6], cy = tri[o + 7], cz = tri[o + 8];
    const abx = bx - ax, aby = by - ay, abz = bz - az;
    const acx = cx - ax, acy = cy - ay, acz = cz - az;
    const apx = px - ax, apy = py - ay, apz = pz - az;
    let qx, qy, qz;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    const bpx = px - bx, bpy = py - by, bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz;
    const d5 = abx * cpx + aby * cpy + abz * cpz;
    const d6 = acx * cpx + acy * cpy + acz * cpz;
    const vc = d1 * d4 - d3 * d2;
    const vb = d5 * d2 - d1 * d6;
    const va = d3 * d6 - d5 * d4;
    if (d1 <= 0 && d2 <= 0) [qx, qy, qz] = [ax, ay, az];
    else if (d3 >= 0 && d4 <= d3) [qx, qy, qz] = [bx, by, bz];
    else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      const v = d1 / (d1 - d3);
      [qx, qy, qz] = [ax + abx * v, ay + aby * v, az + abz * v];
    } else if (d6 >= 0 && d5 <= d6) [qx, qy, qz] = [cx, cy, cz];
    else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      [qx, qy, qz] = [ax + acx * w, ay + acy * w, az + acz * w];
    } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
      const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
      [qx, qy, qz] = [bx + (cx - bx) * w, by + (cy - by) * w, bz + (cz - bz) * w];
    } else {
      const den = 1 / (va + vb + vc);
      const v = vb * den;
      const w = vc * den;
      [qx, qy, qz] = [ax + abx * v + acx * w, ay + aby * v + acy * w, az + abz * v + acz * w];
    }
    const nx = aby * acz - abz * acy, ny = abz * acx - abx * acz, nz = abx * acy - aby * acx;
    const dx = px - qx, dy = py - qy, dz = pz - qz;
    return { d: dx * dx + dy * dy + dz * dz, behind: dx * nx + dy * ny + dz * nz < 0, q: [qx, qy, qz] };
  }
};
