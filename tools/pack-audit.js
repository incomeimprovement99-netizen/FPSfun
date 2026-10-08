// In the page, for tools/pack-frames.ts: how much of the bought arms' hands is inside our gun this frame.
// Each hand vertex (every second one, of those weighted most to a hand or finger bone) is taken into each gun part's own
// frame and to the nearest point of that part's surface: it is inside when it is behind every face that nearest point
// lies on, and its depth is how far. Counting ray crossings was fooled by the models' inner shells (a silencer's bore,
// a magazine inside its grip): points round the grip read 38 mm deep, and a point under the gun's top face read outside.
// Each part's triangles are bucketed in a grid once, in its own frame, since the parts do not change shape.
// A point inside counts as `seen` when where it goes in (its nearest point of the surface) is in the eye's sight: a
// fingertip wrapped round the far side of a grip is inside it, but hidden behind the gun, and no one sees it; nor does
// anyone see what is off the gun camera's picture (at the hip the USSO's right hand is mostly under the screen's edge).
// `only`: { side, bones (a regular expression's source) } tests those skin points alone and skips the test on itself, for
// a solver trying one finger's joints (tools/pack-solve.ts): a whole audit of both hands took a second a try
window.__packAudit = (deep, keep, only) => {
  const onlyBones = only && only.bones ? new RegExp(only.bones) : null;
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
  if (!parts.length) return { l: 0, r: 0, seenL: 0, seenR: 0, seenDeepest: 0, deepest: 0, where: {}, bones: {}, seenBones: {}, tested: 0, touch: 0, self: true, selfShare: 1, pts: [], push: {}, parts: 0, gap: { l: Infinity, r: Infinity }, palmGap: { l: Infinity, r: Infinity }, boneGap: {} };
  const HAND = /^(hand|index|middle|ring|pinky|thumb)(_\d+)?_([lr])$/;
  const out = { l: 0, r: 0, seenL: 0, seenR: 0, seenDeepest: 0, deepest: 0, where: {}, bones: {}, seenBones: {}, tested: 0, touch: 0, self: false, selfShare: 0, pts: [], push: {}, gap: { l: Infinity, r: Infinity }, palmGap: { l: Infinity, r: Infinity }, boneGap: {} };
  // each bone's nearest skin to the gun, mm (0 touching or in; only skin within 3 cm of a part is looked at)
  const noteGap = (bone, away) => {
    const mm = Math.round(away * 10000) / 10;
    if (!(bone in out.boneGap) || mm < out.boneGap[bone]) out.boneGap[bone] = mm;
  };
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
  const big = only ? null : parts.reduce((a, p) => (!a || p.grid.size > a.grid.size ? p : a), null);
  if (!big) out.self = true;
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
      if (only && ((only.side && side !== only.side) || (onlyBones && !onlyBones.test(bone)))) continue;
      // (`only.points`: each tested point's depth into the gun, metres, below 0 its distance off it up to 3 cm, in a
      // fixed order: a solver's residuals, tools/pack-solve.ts)
      let ptDepth = -0.03;
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
            ptDepth = Math.max(ptDepth, -away);
            out.gap[side] = Math.min(out.gap[side], away);
            if (bone === `hand_${side}`) out.palmGap[side] = Math.min(out.palmGap[side], away);
            noteGap(bone, away);
          }
          continue;
        }
        const d = p.flip * depthIn(p.grid, loc);
        ptDepth = Math.max(ptDepth, (d * p.scale) / rigScale);
        {
          const away = Math.max(0, -d) * p.scale / rigScale;
          out.gap[side] = Math.min(out.gap[side], away);
          if (bone === `hand_${side}`) out.palmGap[side] = Math.min(out.palmGap[side], away);
          noteGap(bone, away);
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
          // (and which part it is in, the deepest a bone goes: the checks and the solver's notes)
          if (!out.boneIn) out.boneIn = {};
          const pn = p.o.name || p.o.parent?.name || "?";
          if (!out.boneIn[bone] || out.boneIn[bone][1] < depth) out.boneIn[bone] = [pn, depth];
          const n = p.o.name || p.o.parent?.name || "?";
          out.where[n] = (out.where[n] || 0) + 1;
        }
      }
      if (only && only.points) (out.points ??= []).push(ptDepth);
      // (`only.gapList`: each bone's tested points' gaps to the gun, mm, below 0 into it: how much of a palm lies on the
      // gun, where its nearest point alone read a hand touching at its heel as flush, tools/pack-flush.ts)
      if (only && only.gapList) ((out.gapList ??= {})[bone] ??= []).push(Math.round(-ptDepth * 10000) / 10);
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

// How much of each hack card over the open palm lies over the gun on the screen, per cent (the owner, 2026-09-28: the hack
// "needs to be held higher and slightly more to the left so it doesn't bug in and out with the gun when it sways back and
// forth on the usso when we inspect"). The card draws with no depth test and adds its light, so over the white gun it
// washes out: in the picture it goes in and out as the gun sways under it. The gun's triangles are filled into a grid a
// tenth of the screen's size, and each shown card's cells over them counted.
window.__cardOverGun = () => {
  const r = window.__range;
  const T = r.THREE;
  const root = r.viewModelRoot();
  const tanV = Math.tan(((r.gunFov().gun / 2) * Math.PI) / 180);
  const tanH = tanV * (innerWidth / innerHeight);
  const inv = new T.Matrix4().copy(root.matrixWorld).invert();
  const GW = 192, GH = 108;
  const grid = new Uint8Array(GW * GH);
  const px = (v) => [(0.5 + v.x / -v.z / tanH / 2) * GW, (0.5 - v.y / -v.z / tanV / 2) * GH];
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  let gun = null;
  root.traverse((o) => { if (o.userData && o.userData.paid && !gun) gun = o; });
  if (!gun) return [];
  const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
  gun.traverse((o) => {
    if (!o.isMesh || !shown(o) || !o.geometry.attributes.position) return;
    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count : pos.count;
    for (let t = 0; t < n; t += 3) {
      a.fromBufferAttribute(pos, idx ? idx.getX(t) : t).applyMatrix4(m);
      b.fromBufferAttribute(pos, idx ? idx.getX(t + 1) : t + 1).applyMatrix4(m);
      c.fromBufferAttribute(pos, idx ? idx.getX(t + 2) : t + 2).applyMatrix4(m);
      if (a.z > -0.01 || b.z > -0.01 || c.z > -0.01) continue;
      const [ax, ay] = px(a), [bx, by] = px(b), [cx, cy] = px(c);
      const d = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
      if (Math.abs(d) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx))), x1 = Math.min(GW - 1, Math.ceil(Math.max(ax, bx, cx)));
      const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy))), y1 = Math.min(GH - 1, Math.ceil(Math.max(ay, by, cy)));
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const qx = x + 0.5, qy = y + 0.5;
          const w1 = ((bx - qx) * (cy - qy) - (cx - qx) * (by - qy)) / d;
          const w2 = ((cx - qx) * (ay - qy) - (ax - qx) * (cy - qy)) / d;
          if (w1 >= 0 && w2 >= 0 && w1 + w2 <= 1) grid[y * GW + x] = 1;
        }
    }
  });
  // (the palm's cards are the view's meshes drawn at render order 10 with a picture on them)
  const out = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.material || !o.material.map || o.renderOrder !== 10 || !shown(o) || o.material.opacity < 0.05) return;
    const m = new T.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const pts = [];
    for (let k = 0; k < pos.count; k++) pts.push(px(new T.Vector3().fromBufferAttribute(pos, k).applyMatrix4(m)));
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    let n = 0, over = 0;
    for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(GH - 1, Math.ceil(Math.max(...ys))); y++)
      for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(GW - 1, Math.ceil(Math.max(...xs))); x++) {
        n++;
        if (grid[y * GW + x]) over++;
      }
    out.push(n ? (100 * over) / n : 0);
  });
  return out;
};

// Daylight between a hand and the gun, as the eye sees it (the owner, 2026-10-05: "WOW THE LEFT SUPPORT HAND ON THE USSO
// HAS A GAP BETWEEN IT AND THE GUN"). The audit above measured skin against the gun's surface, and a palm touching at one
// point passed while the eye saw background through the hand: a ring of forefinger and thumb closed ahead of the gun,
// the palm under it. Here the view's own camera draws the arms and the gun as two flat colours into a small picture, and
// the background the hand closes off is counted: holes (background shut in on every side) that the gun alone does not
// shut in (a trigger guard's opening is the gun's own), and cracks narrower than `r` pixels between hand and gun that
// neither has alone (the gaps between fingers are the hand's own). Only round the one hand: its bones' box on the
// picture. `w` is the picture's width (960); a pixel there is about a millimetre at a support hand's distance.
window.__packSeenGap = (side, o) => {
  o = o || {};
  const r = window.__range;
  const T = r.THREE;
  const R = r.renderer;
  const root = r.viewModelRoot();
  const cam = root.parent;
  let scene = root;
  while (scene.parent) scene = scene.parent;
  let rig = null, gun = null;
  root.traverse((x) => {
    if (x.name === "pack-arms") rig = x;
    if (!gun && x.userData && x.userData.paid) gun = x;
  });
  if (!rig || !rig.visible || !gun) return null;
  const under = (x, a) => { for (let p = x; p; p = p.parent) if (p === a) return true; return false; };
  const W = o.w || 960, H = Math.round((W * innerHeight) / innerWidth), RAD = o.r || 4;
  root.updateMatrixWorld(true);
  const red = new T.MeshBasicMaterial({ color: 0xff0000, fog: false, toneMapped: false, side: T.DoubleSide });
  const green = new T.MeshBasicMaterial({ color: 0x00ff00, fog: false, toneMapped: false, side: T.DoubleSide });
  const saved = [];
  scene.traverse((x) => {
    if (!(x.isMesh || x.isPoints || x.isLine || x.isSprite) || !x.layers.test(cam.layers)) return;
    saved.push([x, x.material, x.visible]);
    if (under(x, rig)) x.material = red;
    else if (under(x, gun) && !x.isSprite && !x.isPoints) x.material = green;
    else x.visible = false;
  });
  const rt = new T.WebGLRenderTarget(W, H);
  const bg = scene.background, was = R.getRenderTarget(), cc = R.getClearColor(new T.Color()), ca = R.getClearAlpha();
  const buf = new Uint8Array(W * H * 4);
  try {
    scene.background = null;
    R.setRenderTarget(rt);
    R.setClearColor(0x000000, 1);
    R.clear(true, true, true);
    R.render(scene, cam);
    R.readRenderTargetPixels(rt, 0, 0, W, H, buf);
  } finally {
    R.setRenderTarget(was);
    R.setClearColor(cc, ca);
    scene.background = bg;
    for (const [x, m, v] of saved) { x.material = m; x.visible = v; }
    rt.dispose(); red.dispose(); green.dispose();
  }
  // rows from the top, as the picture is seen
  const hand = new Uint8Array(W * H), gunM = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const k = ((H - 1 - y) * W + x) * 4;
      if (buf[k] > 128 && buf[k + 1] < 128) hand[y * W + x] = 1;
      else if (buf[k + 1] > 128) gunM[y * W + x] = 1;
    }
  const both = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) both[i] = hand[i] | gunM[i];
  // background reached from the picture's edge; what is not reached is shut in
  const shutIn = (m) => {
    const seen = new Uint8Array(W * H), st = [];
    const push = (i) => { if (!m[i] && !seen[i]) { seen[i] = 1; st.push(i); } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i - x) / W;
      if (x > 0) push(i - 1);
      if (x < W - 1) push(i + 1);
      if (y > 0) push(i - W);
      if (y < H - 1) push(i + W);
    }
    const out = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) out[i] = !m[i] && !seen[i] ? 1 : 0;
    return out;
  };
  // a closing (grown then shrunk by a square `RAD` pixels round), separably
  const grow = (m, keep) => {
    const a = new Uint8Array(W * H), b = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      let run = -1e9;
      for (let x = 0; x < W; x++) { if (m[y * W + x] === keep) run = x; a[y * W + x] = x - run <= RAD ? keep : 1 - keep; }
      run = 1e9;
      for (let x = W - 1; x >= 0; x--) { if (m[y * W + x] === keep) run = x; if (run - x <= RAD) a[y * W + x] = keep; }
    }
    for (let x = 0; x < W; x++) {
      let run = -1e9;
      for (let y = 0; y < H; y++) { if (a[y * W + x] === keep) run = y; b[y * W + x] = y - run <= RAD ? keep : 1 - keep; }
      run = 1e9;
      for (let y = H - 1; y >= 0; y--) { if (a[y * W + x] === keep) run = y; if (run - y <= RAD) b[y * W + x] = keep; }
    }
    return b;
  };
  const close = (m) => grow(grow(m, 1), 0);
  const holeBoth = shutIn(both), holeGun = shutIn(gunM);
  const cBoth = close(both), cGun = close(gunM), cHand = close(hand);
  // the hand's box on the picture: its own bones, and a fingertip's length past them; a pixel there is the hand's when
  // its nearest point on the picture is one of this hand's: its fingers' joints and its palm's middle, and not its
  // wrist or forearm (daylight between a forearm and the gun is the arm's way up to it, not a gap: BOOG's wrist leaves
  // the fore-end below the glove's cuff), nor the other hand (the right hand's box at the hip reaches over the left)
  const bones = [];
  const at = (n) => { const b = rig.getObjectByName(n); return b ? b.getWorldPosition(new T.Vector3()) : null; };
  const put = (v, own, hand) => { if (!v) return; const p = v.clone().project(cam); bones.push({ x: (p.x * 0.5 + 0.5) * W, y: (0.5 - p.y * 0.5) * H, own, hand }); };
  for (const s of ["l", "r"]) {
    const own = s === side;
    rig.traverse((x) => { if (x.isBone && /^(thumb|index|middle|ring|pinky)_0[123]_[lr]$/.test(x.name) && x.name.endsWith("_" + s)) put(x.getWorldPosition(new T.Vector3()), own, true); });
    const wrist = at("hand_" + s), knuckle = at("middle_01_" + s), elbow = at("lowerarm_" + s);
    if (wrist && knuckle) put(wrist.clone().lerp(knuckle, 0.5), own, true);
    put(wrist, false, false);
    if (wrist && elbow) for (const t of [0.25, 0.5, 0.75]) put(wrist.clone().lerp(elbow, t), false, false);
  }
  const pts = bones.filter((b) => b.own && b.hand);
  if (!pts.length) return null;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const pad = 0.35 * Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)), x1 = Math.min(W - 1, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)), y1 = Math.min(H - 1, Math.ceil(Math.max(...ys) + pad));
  const ours = (x, y) => {
    let d = Infinity, own = false;
    for (const b of bones) { const e = (b.x - x) ** 2 + (b.y - y) ** 2; if (e < d) { d = e; own = b.own; } }
    return own;
  };
  let holes = 0, cracks = 0, handPx = 0;
  const gap = new Uint8Array(W * H);
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = y * W + x;
      if (hand[i]) handPx++;
      if (both[i]) continue;
      // (no crack at the picture's edge: the edge cuts the hand and the gun, and a closing there reads the cut as a gap)
      const edge = x < 2 * RAD || y < 2 * RAD || x >= W - 2 * RAD || y >= H - 2 * RAD;
      const hole = holeBoth[i] && !holeGun[i], crack = !hole && !edge && cBoth[i] && !cGun[i] && !cHand[i];
      if ((!hole && !crack) || !ours(x, y)) continue;
      if (hole) { holes++; gap[i] = 1; } else { cracks++; gap[i] = 2; }
    }
  // a hole is one the eye sees: 8 pixels and more in one piece; a pinhole where a fingertip meets the gun is the
  // antialiasing's (2 to 6 pixels, the USSO's right hand), counted apart as specks
  let specks = 0;
  {
    const seen = new Uint8Array(W * H);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i0 = y * W + x;
        if (gap[i0] !== 1 || seen[i0]) continue;
        const st = [i0];
        seen[i0] = 1;
        let n = 0;
        while (st.length) {
          const i = st.pop(), px = i % W, py = (i - px) / W;
          n++;
          for (const [qx, qy] of [[px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]]) {
            if (qx < x0 || qx > x1 || qy < y0 || qy > y1) continue;
            const q = qy * W + qx;
            if (gap[q] === 1 && !seen[q]) { seen[q] = 1; st.push(q); }
          }
        }
        if (n < (o.minHole || 8)) { specks += n; holes -= n; }
      }
  }
  const res = { holes, specks, cracks, handPx, share: handPx ? +((100 * (holes + cracks)) / handPx).toFixed(2) : 0, box: [x0, y0, x1, y1], w: W, h: H };
  if (o.image) {
    const cv = document.createElement("canvas");
    cv.width = x1 - x0 + 1; cv.height = y1 - y0 + 1;
    const cx = cv.getContext("2d"), im = cx.createImageData(cv.width, cv.height);
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const i = y * W + x, k = ((y - y0) * cv.width + (x - x0)) * 4;
        const c = gap[i] === 1 ? [255, 220, 0] : gap[i] === 2 ? [255, 120, 0] : hand[i] ? [200, 60, 60] : gunM[i] ? [90, 170, 90] : [30, 30, 40];
        im.data[k] = c[0]; im.data[k + 1] = c[1]; im.data[k + 2] = c[2]; im.data[k + 3] = 255;
      }
    cx.putImageData(im, 0, 0);
    res.image = cv.toDataURL("image/png");
  }
  return res;
};
