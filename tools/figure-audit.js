// In the page, for tools/figure-frames.ts (Phase 27): how a third-person figure holds its gun this frame, measured
// off the figure as it is drawn, as tools/pack-audit.js measures the first-person arms.
//
// - grip, support: how far each palm (the middle of its metacarpals, halfway from the wrist to the middle finger's
//   knuckle) is from the point on the gun that hand is meant to hold (MannequinFigure.holdPoints), cm.
// - aim: how far the gun's barrel points off the way the figure looks (its facing, tipped by its look pitch), degrees.
// - wristL, wristR: each wrist's bend, the forearm's line against the hand's, degrees.
// - handIn: how deep any skin of a hand is inside the gun, mm. Each skin point weighted most to a hand or finger bone
//   is taken into each gun part's own frame, to the nearest point of that part's surface, and is inside when it is
//   behind every face that nearest point lies on (the rule pack-audit.js settled on: counting ray crossings was fooled
//   by the models' inner shells).
// - gunIn: how deep the gun is inside the body (torso, arms, head; the hands are handIn's), mm, by the same rule the
//   other way round: the gun's points against the body's skin, which is skinned, so it is taken afresh every frame.
// Never the real mouse or keyboard: it only reads the scene.
(() => {
  const HAND = /^(hand|index|middle|ring|pinky|thumb)(_\d+)?_([lr])$/;
  const GRIP = /^(hand|index|middle|ring|pinky|thumb|lowerarm_twist)(_\d+)*_([lr])$/;
  /** a part's triangles in its own frame, bucketed on a grid once (the parts do not change shape) */
  const grids = new Map();
  const CELL = 0.02;

  /** the closest point of triangle abc to p (Ericson, Real-Time Collision Detection 5.1.5), into out; squared distance back */
  function closest(p, a, b, c, out) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const apx = p[0] - a[0], apy = p[1] - a[1], apz = p[2] - a[2];
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let x, y, z;
    if (d1 <= 0 && d2 <= 0) [x, y, z] = a;
    else {
      const bpx = p[0] - b[0], bpy = p[1] - b[1], bpz = p[2] - b[2];
      const d3 = abx * bpx + aby * bpy + abz * bpz;
      const d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) [x, y, z] = b;
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
          const v = d1 / (d1 - d3);
          x = a[0] + v * abx; y = a[1] + v * aby; z = a[2] + v * abz;
        } else {
          const cpx = p[0] - c[0], cpy = p[1] - c[1], cpz = p[2] - c[2];
          const d5 = abx * cpx + aby * cpy + abz * cpz;
          const d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) [x, y, z] = c;
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) {
              const w = d2 / (d2 - d6);
              x = a[0] + w * acx; y = a[1] + w * acy; z = a[2] + w * acz;
            } else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
                const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
                x = b[0] + w * (c[0] - b[0]); y = b[1] + w * (c[1] - b[1]); z = b[2] + w * (c[2] - b[2]);
              } else {
                const den = 1 / (va + vb + vc);
                const v = vb * den;
                const w = vc * den;
                x = a[0] + abx * v + acx * w; y = a[1] + aby * v + acy * w; z = a[2] + abz * v + acz * w;
              }
            }
          }
        }
      }
    }
    out[0] = x; out[1] = y; out[2] = z;
    return (p[0] - x) ** 2 + (p[1] - y) ** 2 + (p[2] - z) ** 2;
  }

  /** a grid of triangles given as flat xyz triples (9 numbers a triangle), cells of `cell` metres */
  function gridOf(tris, cell) {
    const map = new Map();
    const key = (i, j, k) => `${i},${j},${k}`;
    for (let t = 0; t < tris.length; t += 9) {
      let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
      for (let v = 0; v < 9; v += 3) {
        x0 = Math.min(x0, tris[t + v]); x1 = Math.max(x1, tris[t + v]);
        y0 = Math.min(y0, tris[t + v + 1]); y1 = Math.max(y1, tris[t + v + 1]);
        z0 = Math.min(z0, tris[t + v + 2]); z1 = Math.max(z1, tris[t + v + 2]);
      }
      for (let i = Math.floor(x0 / cell); i <= Math.floor(x1 / cell); i++)
        for (let j = Math.floor(y0 / cell); j <= Math.floor(y1 / cell); j++)
          for (let k = Math.floor(z0 / cell); k <= Math.floor(z1 / cell); k++) {
            const kk = key(i, j, k);
            let list = map.get(kk);
            if (!list) map.set(kk, (list = []));
            list.push(t);
          }
    }
    return { tris, map, cell, key };
  }

  /**
   * How deep point p is inside the surface in the grid (0 outside, or with no face within `reach` metres): the nearest
   * point of the surface, and inside when p is behind every face that nearest point lies on. `flip` -1 for a mirrored
   * part, whose faces wind the other way.
   */
  function depthIn(g, p, reach, flip, hit, far) {
    const r = Math.ceil(reach / g.cell);
    const ci = Math.floor(p[0] / g.cell), cj = Math.floor(p[1] / g.cell), ck = Math.floor(p[2] / g.cell);
    let best = reach * reach;
    const seen = new Set();
    const near = [];
    const q = [0, 0, 0];
    for (let i = ci - r; i <= ci + r; i++)
      for (let j = cj - r; j <= cj + r; j++)
        for (let k = ck - r; k <= ck + r; k++) {
          const list = g.map.get(g.key(i, j, k));
          if (!list) continue;
          for (const t of list) {
            if (seen.has(t)) continue;
            seen.add(t);
            const T = g.tris;
            const d = closest(p, [T[t], T[t + 1], T[t + 2]], [T[t + 3], T[t + 4], T[t + 5]], [T[t + 6], T[t + 7], T[t + 8]], q);
            if (d < best - 1e-12) {
              best = d;
              near.length = 0;
              near.push({ t, q: q.slice() });
            } else if (Math.abs(d - best) <= 1e-12) near.push({ t, q: q.slice() });
          }
        }
    if (far) far.d = Math.sqrt(best);
    if (!near.length || best >= reach * reach) return 0;
    if (hit) hit.t = near[0].t;
    const T = g.tris;
    for (const { t, q: at } of near) {
      const ux = T[t + 3] - T[t], uy = T[t + 4] - T[t + 1], uz = T[t + 5] - T[t + 2];
      const vx = T[t + 6] - T[t], vy = T[t + 7] - T[t + 1], vz = T[t + 8] - T[t + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const s = ((p[0] - at[0]) * nx + (p[1] - at[1]) * ny + (p[2] - at[2]) * nz) * flip;
      if (s >= 0) return 0;
    }
    return Math.sqrt(best);
  }

  /** a mesh's triangles as flat xyz, in its own frame (a part of the gun) */
  function localTris(geo) {
    const pos = geo.getAttribute("position");
    const idx = geo.index;
    const n = idx ? idx.count : pos.count;
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = idx ? idx.getX(i) : i;
      out[i * 3] = pos.getX(v);
      out[i * 3 + 1] = pos.getY(v);
      out[i * 3 + 2] = pos.getZ(v);
    }
    return out;
  }

  const shown = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  /**
   * Each skinned geometry's vertices worth skinning, and each one's bone (the one weighted most), once: a held gun is
   * never near the legs, and skinning all of a soldier's vertices every frame was most of what a measure cost.
   */
  const LEGS = /^(pelvis|thigh|calf|foot|ball|ik_)/;
  const upper = new Map();
  function upperOf(sk) {
    let u = upper.get(sk.geometry.uuid);
    if (u) return u;
    const si = sk.geometry.getAttribute("skinIndex");
    const sw = sk.geometry.getAttribute("skinWeight");
    const bones = sk.skeleton.bones;
    const n = sk.geometry.getAttribute("position").count;
    const boneOf = new Array(n);
    const keep = [];
    for (let k = 0; k < n; k++) {
      let bi = si.getX(k);
      let bw = sw.getX(k);
      for (const [ii, ww] of [[si.getY(k), sw.getY(k)], [si.getZ(k), sw.getZ(k)], [si.getW(k), sw.getW(k)]])
        if (ww > bw) {
          bw = ww;
          bi = ii;
        }
      boneOf[k] = bones[bi] ? bones[bi].name : "";
      if (!LEGS.test(boneOf[k])) keep.push(k);
    }
    upper.set(sk.geometry.uuid, (u = { boneOf, keep }));
    return u;
  }

  window.__figureAudit = (i, opts = {}) => {
    const r = window.__range;
    const T = r.THREE;
    const fig = r.labFigures()[i];
    const mq = fig && fig.figure;
    if (!mq) return null;
    fig.group.updateMatrixWorld(true);
    const V = () => new T.Vector3();
    const at = (n) => {
      const b = mq.boneAt(n);
      return b ? b.getWorldPosition(V()) : null;
    };
    const deg = (a) => Math.round((a * 1800) / Math.PI) / 10;
    const cm = (m) => Math.round(m * 1000) / 10;
    const gun = mq.gunObject;
    const out = { armed: !!gun && shown(gun), gripReach: mq.gripReach, supportReach: mq.supportReach };
    const palm = (s) => at(`hand_${s}`).lerp(at(`middle_01_${s}`), 0.5);
    const bend = (s) => {
      const e = at(`lowerarm_${s}`);
      const w = at(`hand_${s}`);
      const k = at(`middle_01_${s}`);
      return deg(w.clone().sub(e).angleTo(k.clone().sub(w)));
    };
    out.wristL = bend("l");
    out.wristR = bend("r");
    const hp = out.armed ? mq.holdPoints() : null;
    if (hp) {
      out.grip = cm(palm("r").distanceTo(hp.grip));
      out.support = cm(palm("l").distanceTo(hp.support));
    }
    if (out.armed) {
      const fwd = new T.Vector3(0, 0, -1).applyQuaternion(gun.getWorldQuaternion(new T.Quaternion()));
      const pitch = ((opts.pitch ?? 0) * Math.PI) / 180;
      const look = new T.Vector3(0, Math.sin(pitch), Math.cos(pitch)).applyQuaternion(fig.group.getWorldQuaternion(new T.Quaternion()));
      out.aim = deg(fwd.angleTo(look));
    }
    if (!out.armed || opts.depth === false) return out;

    // the gun's parts, each with its triangles in its own frame
    const parts = [];
    gun.updateMatrixWorld(true);
    gun.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || !shown(o) || o.userData.hull) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.transparent) return;
      let g = grids.get(o.geometry.uuid);
      if (!g) grids.set(o.geometry.uuid, (g = gridOf(localTris(o.geometry), CELL)));
      parts.push({ o, g, inv: new T.Matrix4().copy(o.matrixWorld).invert(), scale: o.getWorldScale(V()).x, flip: o.matrixWorld.determinant() < 0 ? -1 : 1 });
    });

    // the figure's skin, skinned as drawn this frame, world space; each vertex's bone the one weighted most
    const skins = [];
    mq.root.traverse((o) => {
      if (o.isSkinnedMesh && shown(o) && !o.userData.hull) skins.push(o);
    });
    const handIn = { l: 0, r: 0 };
    const where = {};
    // each finger's nearest skin to the gun, mm (outside it; 0 touching or in): a finger meant to hold the gun and 2 cm
    // off it is a hand held open beside the gun, which a measure of depth alone would call perfect
    const fingerGap = {};
    const far = { d: 0 };
    const FINGER = /^(index|middle|ring|pinky|thumb)_0([23])_([lr])$/;
    const bodyTris = [];
    /** each of bodyTris' triangles' bone (its first corner's), to say where the gun went in */
    const bodyBone = [];
    const gunBox = new T.Box3().setFromObject(gun).expandByScalar(0.05);
    const v = V();
    for (const sk of skins) {
      const pos = sk.geometry.getAttribute("position");
      const { boneOf, keep } = upperOf(sk);
      // a leg's vertex is never skinned: it stays at the far corner of the world, outside every box
      const world = new Float32Array(pos.count * 3).fill(1e9);
      for (const k of keep) {
        sk.getVertexPosition(k, v);
        v.applyMatrix4(sk.matrixWorld);
        world[k * 3] = v.x;
        world[k * 3 + 1] = v.y;
        world[k * 3 + 2] = v.z;
      }
      // the hands' skin into the gun (every second point)
      for (let k = 0; k < pos.count; k += 2) {
        const m = HAND.exec(boneOf[k]);
        if (!m) continue;
        const wp = new T.Vector3(world[k * 3], world[k * 3 + 1], world[k * 3 + 2]);
        if (!gunBox.containsPoint(wp)) continue;
        const fm = FINGER.exec(boneOf[k]);
        for (const pt of parts) {
          const lp = wp.clone().applyMatrix4(pt.inv);
          far.d = Infinity;
          const d = depthIn(pt.g, [lp.x, lp.y, lp.z], 0.03 / pt.scale, pt.flip, null, far) * pt.scale;
          if (fm) {
            const key = `${fm[1]}_${fm[3]}`;
            const gap = d > 0 ? 0 : Math.min(30, far.d * pt.scale * 1000);
            if (!(key in fingerGap) || gap < fingerGap[key]) fingerGap[key] = Math.round(gap);
          }
          if (d > handIn[m[3]]) handIn[m[3]] = d;
          if (opts.pts && d > 0.004) (out.pts ??= []).push([wp.x, wp.y, wp.z, 0]);
          if (d > 0.002) where[boneOf[k]] = Math.max(where[boneOf[k]] ?? 0, Math.round(d * 1000));
        }
      }
      // the rest of the body near the gun, for the gun's points against it
      const idx = sk.geometry.index;
      const n = idx ? idx.count : pos.count;
      for (let t = 0; t < n; t += 3) {
        const a = idx ? idx.getX(t) : t;
        const b = idx ? idx.getX(t + 1) : t + 1;
        const c = idx ? idx.getX(t + 2) : t + 2;
        // the hands and wrists hold the gun: their contact with it is handIn's to measure, not the body's
        if (GRIP.test(boneOf[a]) || GRIP.test(boneOf[b]) || GRIP.test(boneOf[c])) continue;
        // a corner on the legs was never skinned (upperOf): such a triangle is the hips', and no held gun's
        if (world[a * 3] > 1e8 || world[b * 3] > 1e8 || world[c * 3] > 1e8) continue;
        const ax = world[a * 3], ay = world[a * 3 + 1], az = world[a * 3 + 2];
        if (!gunBox.containsPoint(v.set(ax, ay, az)) && !gunBox.containsPoint(v.set(world[b * 3], world[b * 3 + 1], world[b * 3 + 2])) && !gunBox.containsPoint(v.set(world[c * 3], world[c * 3 + 1], world[c * 3 + 2]))) continue;
        bodyTris.push(ax, ay, az, world[b * 3], world[b * 3 + 1], world[b * 3 + 2], world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
        bodyBone.push(boneOf[a]);
      }
    }
    out.handIn = { l: Math.round(handIn.l * 1000), r: Math.round(handIn.r * 1000) };
    out.fingerGap = fingerGap;
    out.handWhere = where;
    // the gun's points against the body (every fourth vertex of each part)
    let gunIn = 0;
    const hit = { t: 0 };
    out.gunWhere = {};
    if (bodyTris.length) {
      const bg = gridOf(Float32Array.from(bodyTris), 0.03);
      for (const pt of parts) {
        const pos = pt.o.geometry.getAttribute("position");
        for (let k = 0; k < pos.count; k += 4) {
          v.set(pos.getX(k), pos.getY(k), pos.getZ(k)).applyMatrix4(pt.o.matrixWorld);
          const d = depthIn(bg, [v.x, v.y, v.z], 0.04, 1, hit);
          if (d > 0.01) {
            const key = `${pt.o.name || "part"}>${bodyBone[hit.t / 9]}`;
            out.gunWhere[key] = Math.max(out.gunWhere[key] ?? 0, Math.round(d * 1000));
            if (opts.pts) (out.pts ??= []).push([v.x, v.y, v.z, 1]);
          }
          if (d > gunIn) gunIn = d;
        }
      }
    }
    out.gunIn = Math.round(gunIn * 1000);
    return out;
  };
})();
