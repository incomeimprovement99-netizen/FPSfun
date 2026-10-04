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
//   Both count only the gun as drawn: a point ahead of its phase's front (a swap, a reload's magazine) is not there.
//   It looks 4 cm in: a point further from every surface than that reads as outside (0), so a stock right through an
//   arm shows only its edge. opts.exact looks 15 cm in and keeps a point only if rays from it cross the mesh it is in
//   an odd number of times (most of five): a long look alone took points outside an armour shell for inside (the USSO's
//   stock "74 mm" in a forearm it is only beside).
// - __triggerGap(i): how far the right index finger is from the trigger, mm, where a finger pulls one: the skin round its
//   last joint's crease (within 11 mm of the joint, on the last and middle phalanges), not its tip. The owner,
//   2026-09-30: "the trigger finger should be more through the hold and still touching the trigger. right now its like
//   the very finger tip is the only thing that can press the trigger". To the trigger's front face (the bought model's
//   own part, a mesh named Trigger), sampled over the face's triangles, anywhere on it. null for a gun with no trigger
// Never the real mouse or keyboard: it only reads the scene.
(() => {
  const HAND = /^(hand|index|middle|ring|pinky|thumb)(_\d+)?_([lr])$/;
  const GRIP = /^(hand|index|middle|ring|pinky|thumb|lowerarm_twist)(_\d+)*_([lr])$/;
  /** a part's triangles in its own frame, bucketed on a grid once (the parts do not change shape) */
  const grids = new Map();
  const CELL = 0.02;

  /**
   * The closest point to p of the triangle at t in the flat array T (its corners a, b, c: Ericson, Real-Time Collision
   * Detection 5.1.5), into out; squared distance back. Read in place: three arrays made a triangle were most of a measure.
   */
  function closest(p, T, t, out) {
    const a0 = T[t], a1 = T[t + 1], a2 = T[t + 2], b0 = T[t + 3], b1 = T[t + 4], b2 = T[t + 5], c0 = T[t + 6], c1 = T[t + 7], c2 = T[t + 8];
    const abx = b0 - a0, aby = b1 - a1, abz = b2 - a2;
    const acx = c0 - a0, acy = c1 - a1, acz = c2 - a2;
    const apx = p[0] - a0, apy = p[1] - a1, apz = p[2] - a2;
    const d1 = abx * apx + aby * apy + abz * apz;
    const d2 = acx * apx + acy * apy + acz * apz;
    let x, y, z;
    if (d1 <= 0 && d2 <= 0) (x = a0), (y = a1), (z = a2);
    else {
      const bpx = p[0] - b0, bpy = p[1] - b1, bpz = p[2] - b2;
      const d3 = abx * bpx + aby * bpy + abz * bpz;
      const d4 = acx * bpx + acy * bpy + acz * bpz;
      if (d3 >= 0 && d4 <= d3) (x = b0), (y = b1), (z = b2);
      else {
        const vc = d1 * d4 - d3 * d2;
        if (vc <= 0 && d1 >= 0 && d3 <= 0) {
          const v = d1 / (d1 - d3);
          x = a0 + v * abx; y = a1 + v * aby; z = a2 + v * abz;
        } else {
          const cpx = p[0] - c0, cpy = p[1] - c1, cpz = p[2] - c2;
          const d5 = abx * cpx + aby * cpy + abz * cpz;
          const d6 = acx * cpx + acy * cpy + acz * cpz;
          if (d6 >= 0 && d5 <= d6) (x = c0), (y = c1), (z = c2);
          else {
            const vb = d5 * d2 - d1 * d6;
            if (vb <= 0 && d2 >= 0 && d6 <= 0) {
              const w = d2 / (d2 - d6);
              x = a0 + w * acx; y = a1 + w * acy; z = a2 + w * acz;
            } else {
              const va = d3 * d6 - d5 * d4;
              if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
                const w = (d4 - d3) / (d4 - d3 + (d5 - d6));
                x = b0 + w * (c0 - b0); y = b1 + w * (c1 - b1); z = b2 + w * (c2 - b2);
              } else {
                const den = 1 / (va + vb + vc);
                const v = vb * den;
                const w = vc * den;
                x = a0 + abx * v + acx * w; y = a1 + aby * v + acy * w; z = a2 + abz * v + acz * w;
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
    // each triangle's stamp: the query that last looked at it, so a query sees each once (a Set a query was slow)
    return { tris, map, cell, key, stamp: new Int32Array(tris.length / 9), query: 0 };
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
    const now = ++g.query;
    const near = [];
    const q = [0, 0, 0];
    // the cells nearest first, and none once the nearest a cell could hold is past the best face found: the same
    // answer, but a point by a surface looks at a few cells' faces, not the 125 round it (a hand's fit measures often)
    const cells = [];
    const c = g.cell;
    for (let i = ci - r; i <= ci + r; i++)
      for (let j = cj - r; j <= cj + r; j++)
        for (let k = ck - r; k <= ck + r; k++) {
          const dx = Math.max(0, i * c - p[0], p[0] - (i + 1) * c);
          const dy = Math.max(0, j * c - p[1], p[1] - (j + 1) * c);
          const dz = Math.max(0, k * c - p[2], p[2] - (k + 1) * c);
          cells.push([dx * dx + dy * dy + dz * dz, i, j, k]);
        }
    cells.sort((a, b) => a[0] - b[0]);
    for (const [d2, i, j, k] of cells) {
      if (d2 > best + 1e-12) break;
      const list = g.map.get(g.key(i, j, k));
      if (!list) continue;
      for (const t of list) {
        if (g.stamp[t / 9] === now) continue;
        g.stamp[t / 9] = now;
        const d = closest(p, g.tris, t, q);
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
    /** the hands' own vertices, for a measure of the hands alone (a hand's fit tries thousands of grasps) */
    const hands = [];
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
      if (HAND.test(boneOf[k])) hands.push(k);
    }
    upper.set(sk.geometry.uuid, (u = { boneOf, keep, hands }));
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

    // A point of the gun is drawn only behind its phase's front (phase.ts): ahead of it, in a swap or a reload, the gun is
    // not there to clip a hand or the body. Its magazine's on the magazine's sweep, the rest on the gun's.
    const sweepOf = (o) => {
      for (let q = o; q && q !== gun; q = q.parent) if (q.name === "mag") return mq.magSweep;
      return mq.gunSweep;
    };
    const drawn = (o, p) => {
      const S = sweepOf(o);
      if (!S || S.phase.value >= 0.999) return true;
      if (S.phase.value <= 0.001) return false;
      const s = S.radial && S.radial.value > 0.5 ? p.distanceTo(S.center.value) / S.radius.value : p.clone().sub(S.origin.value).dot(S.dir.value) / S.len.value;
      return s <= S.phase.value * (1 + S.band.value + S.jag.value);
    };
    // the gun's parts, each with its triangles in its own frame
    const parts = [];
    gun.updateMatrixWorld(true);
    gun.traverse((o) => {
      if (!o.isMesh || o.isSkinnedMesh || !shown(o) || o.userData.hull) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m && m.transparent) return;
      let g = grids.get(o.geometry.uuid);
      if (!g) grids.set(o.geometry.uuid, (g = gridOf(localTris(o.geometry), CELL)));
      // (its box, out by the 3 cm a depth looks: a point outside it has no face of this part within reach)
      parts.push({ o, g, box: new T.Box3().setFromObject(o).expandByScalar(0.03), tight: new T.Box3().setFromObject(o).expandByScalar(0.001), inv: new T.Matrix4().copy(o.matrixWorld).invert(), scale: o.getWorldScale(V()).x, flip: o.matrixWorld.determinant() < 0 ? -1 : 1 });
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
    const palmGap = { l: 30, r: 30 };
    const far = { d: 0 };
    const FINGER = /^(index|middle|ring|pinky|thumb)_0([23])_([lr])$/;
    const bodyTris = [];
    /** each of bodyTris' triangles' bone (its first corner's), to say where the gun went in */
    const bodyBone = [];
    /** (opts.exact) each of bodyTris' triangles' mesh, and each mesh's whole upper body, for the rays */
    const bodySkin = [];
    const skinTris = [];
    const gunBox = new T.Box3().setFromObject(gun).expandByScalar(opts.exact ? 0.15 : 0.05);
    const v = V();
    for (const sk of skins) {
      const pos = sk.geometry.getAttribute("position");
      const { boneOf, keep, hands } = upperOf(sk);
      // a leg's vertex is never skinned: it stays at the far corner of the world, outside every box
      const world = new Float32Array(pos.count * 3).fill(1e9);
      for (const k of opts.handsOnly ? hands : keep) {
        sk.getVertexPosition(k, v);
        v.applyMatrix4(sk.matrixWorld);
        world[k * 3] = v.x;
        world[k * 3 + 1] = v.y;
        world[k * 3 + 2] = v.z;
      }
      // the hands' skin into the gun (every second point)
      for (const k of hands) {
        if (k % 2) continue;
        const m = HAND.exec(boneOf[k]);
        const wp = new T.Vector3(world[k * 3], world[k * 3 + 1], world[k * 3 + 2]);
        if (!gunBox.containsPoint(wp)) continue;
        const fm = FINGER.exec(boneOf[k]);
        for (const pt of parts) {
          if (!pt.box.containsPoint(wp) || !drawn(pt.o, wp)) continue;
          const lp = wp.clone().applyMatrix4(pt.inv);
          far.d = Infinity;
          let d = depthIn(pt.g, [lp.x, lp.y, lp.z], 0.03 / pt.scale, pt.flip, null, far) * pt.scale;
          // a point outside a part's own box is not in it: by a thin part's edge the rule above read skin 3 cm under
          // REZ's trigger as 30 mm inside it (the throw's return, 2026-10-04)
          if (d > 0 && !pt.tight.containsPoint(wp)) d = 0;
          // the palm's nearest skin to the gun, the same way: a palm held off its grip is as wrong as one through it
          if (boneOf[k] === `hand_${m[3]}`) {
            const gap = d > 0 ? 0 : Math.min(30, far.d * pt.scale * 1000);
            palmGap[m[3]] = Math.min(palmGap[m[3]], Math.round(gap));
          }
          if (fm) {
            const key = `${fm[1]}_${fm[3]}`;
            const gap = d > 0 ? 0 : Math.min(30, far.d * pt.scale * 1000);
            if (!(key in fingerGap) || gap < fingerGap[key]) fingerGap[key] = Math.round(gap);
          }
          if (d > handIn[m[3]]) handIn[m[3]] = d;
          if (opts.pts && d > 0.004) (out.pts ??= []).push([wp.x, wp.y, wp.z, 0]);
          if (d > 0.002) where[boneOf[k]] = Math.max(where[boneOf[k]] ?? 0, Math.round(d * 1000));
          // where in the gun each bone's deepest skin is (cm, the gun's own frame), to say which part of the gun it is in
          if (opts.locate && d > 0.002 && Math.round(d * 1000) >= where[boneOf[k]]) {
            const g = gun.worldToLocal(wp.clone());
            (out.whereAt ??= {})[boneOf[k]] = [cm(g.x), cm(g.y), cm(g.z), pt.o.name];
          }
        }
      }
      // the rest of the body near the gun, for the gun's points against it (handsOnly: a hand's fit, which has no use for it)
      if (opts.handsOnly) continue;
      const idx = sk.geometry.index;
      const n = idx ? idx.count : pos.count;
      const all = opts.exact ? [] : null;
      skinTris.push(all);
      for (let t = 0; t < n; t += 3) {
        const a = idx ? idx.getX(t) : t;
        const b = idx ? idx.getX(t + 1) : t + 1;
        const c = idx ? idx.getX(t + 2) : t + 2;
        // (the rays need the mesh whole, hands too; only the never skinned legs are left out)
        if (all && world[a * 3] < 1e8 && world[b * 3] < 1e8 && world[c * 3] < 1e8) all.push(world[a * 3], world[a * 3 + 1], world[a * 3 + 2], world[b * 3], world[b * 3 + 1], world[b * 3 + 2], world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
        // the hands and wrists hold the gun: their contact with it is handIn's to measure, not the body's
        if (GRIP.test(boneOf[a]) || GRIP.test(boneOf[b]) || GRIP.test(boneOf[c])) continue;
        // a corner on the legs was never skinned (upperOf): such a triangle is the hips', and no held gun's
        if (world[a * 3] > 1e8 || world[b * 3] > 1e8 || world[c * 3] > 1e8) continue;
        const ax = world[a * 3], ay = world[a * 3 + 1], az = world[a * 3 + 2];
        if (!gunBox.containsPoint(v.set(ax, ay, az)) && !gunBox.containsPoint(v.set(world[b * 3], world[b * 3 + 1], world[b * 3 + 2])) && !gunBox.containsPoint(v.set(world[c * 3], world[c * 3 + 1], world[c * 3 + 2]))) continue;
        bodyTris.push(ax, ay, az, world[b * 3], world[b * 3 + 1], world[b * 3 + 2], world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
        bodyBone.push(boneOf[a]);
        bodySkin.push(skinTris.length - 1);
      }
    }
    out.handIn = { l: Math.round(handIn.l * 1000), r: Math.round(handIn.r * 1000) };
    out.fingerGap = fingerGap;
    out.palmGap = palmGap;
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
          if (!drawn(pt.o, v)) continue;
          // (opts.gunCap, metres: how deep to look, 4 cm unless a tuning run needs to see past it)
          let d = depthIn(bg, [v.x, v.y, v.z], opts.exact ? 0.15 : (opts.gunCap ?? 0.04), 1, hit);
          // (only a point that would be a new deepest is worth its rays)
          if (opts.exact && d > 0.01 && (d > gunIn || Math.round(d * 1000) > (out.gunWhere[`${pt.o.name || "part"}>${bodyBone[hit.t / 9]}`] ?? 0)) && !insideByRays(v, skinTris[bodySkin[hit.t / 9]])) d = 0;
          if (d > 0.01) {
            const key = `${pt.o.name || "part"}>${bodyBone[hit.t / 9]}`;
            out.gunWhere[key] = Math.max(out.gunWhere[key] ?? 0, Math.round(d * 1000));
            if (opts.pts) (out.pts ??= []).push([v.x, v.y, v.z, 1]);
          }
          // (with opts.locate, where the deepest is: cm in the gun's own frame, and the bone it is in)
          if (d > gunIn && opts.locate && d > 0.01) {
            const g = gun.worldToLocal(v.clone());
            out.gunAt = [cm(g.x), cm(g.y), cm(g.z), bodyBone[hit.t / 9]];
          }
          if (d > gunIn) gunIn = d;
        }
      }
    }
    out.gunIn = Math.round(gunIn * 1000);
    return out;
  };

  /**
   * Whether p is inside a mesh given as a flat array of world triangles: rays from it along five ways (the four level
   * ones and up; not down, where the never skinned legs leave the mesh open) each cross it an odd number of times, three
   * or more of the five (Moller-Trumbore)
   */
  function insideByRays(p, tris) {
    if (!tris || !tris.length) return false;
    const ways = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]];
    let odd = 0;
    for (const [dx, dy, dz] of ways) {
      let c = 0;
      for (let t = 0; t < tris.length; t += 9) {
        const ax = tris[t], ay = tris[t + 1], az = tris[t + 2];
        const e1x = tris[t + 3] - ax, e1y = tris[t + 4] - ay, e1z = tris[t + 5] - az;
        const e2x = tris[t + 6] - ax, e2y = tris[t + 7] - ay, e2z = tris[t + 8] - az;
        const hx = dy * e2z - dz * e2y, hy = dz * e2x - dx * e2z, hz = dx * e2y - dy * e2x;
        const det = e1x * hx + e1y * hy + e1z * hz;
        if (Math.abs(det) < 1e-12) continue;
        const f = 1 / det;
        const sx = p.x - ax, sy = p.y - ay, sz = p.z - az;
        const u = f * (sx * hx + sy * hy + sz * hz);
        if (u < 0 || u > 1) continue;
        const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
        const w = f * (dx * qx + dy * qy + dz * qz);
        if (w < 0 || u + w > 1) continue;
        if (f * (e2x * qx + e2y * qy + e2z * qz) > 1e-6) c++;
      }
      if (c % 2 === 1) odd++;
    }
    return odd >= 3;
  }

  /** each figure's trigger face (gun-local) and fingertip points, found once a figure and gun */
  const tips = new WeakMap();
  window.__triggerGap = (i) => {
    const r = window.__range, T = r.THREE, mq = r.labFigures()[i].figure, gun = mq.gunObject;
    if (!gun) return null;
    let known = tips.get(gun);
    if (!known) {
      let trig = null;
      gun.traverse((o) => {
        if (!trig && o.isMesh && /^Trigger/.test(o.name)) trig = o;
      });
      if (!trig) return null;
      gun.updateMatrixWorld(true);
      const inv = gun.matrixWorld.clone().invert(), p = trig.geometry.getAttribute("position"), idx = trig.geometry.index, v = new T.Vector3();
      const at = (k) => new T.Vector3().fromBufferAttribute(p, k).applyMatrix4(trig.matrixWorld).applyMatrix4(inv);
      const corners = [];
      for (let k = 0; k < p.count; k++) corners.push(at(k));
      // its front: the gun's -z, the triangles within 6 mm of the frontmost point, each sampled every few millimetres
      const zMin = Math.min(...corners.map((q) => q.z));
      const target = [];
      const n = idx ? idx.count : p.count;
      for (let t = 0; t < n; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => corners[idx ? idx.getX(t + k) : t + k]);
        if ((a.z + b.z + c.z) / 3 > zMin + 0.006) continue;
        for (let u = 0; u <= 6; u++) for (let w = 0; w <= 6 - u; w++) target.push(a.clone().multiplyScalar(u / 6).addScaledVector(b, w / 6).addScaledVector(c, (6 - u - w) / 6));
      }
      const skin = [];
      mq.root.traverse((o) => {
        if (!o.isSkinnedMesh) return;
        const near = [o.skeleton.bones.findIndex((b) => b.name === "index_03_r"), o.skeleton.bones.findIndex((b) => b.name === "index_02_r")].filter((b) => b >= 0);
        if (!near.length) return;
        const si = o.geometry.getAttribute("skinIndex"), sw = o.geometry.getAttribute("skinWeight");
        for (let k = 0; k < si.count; k++) {
          let top = -1, w = -1;
          for (let c = 0; c < 4; c++) if (sw.getComponent(k, c) > w) (w = sw.getComponent(k, c)), (top = si.getComponent(k, c));
          if (near.includes(top)) skin.push([o, k]);
        }
      });
      known = { target, skin, joint: mq.boneAt("index_03_r") };
      tips.set(gun, known);
    }
    gun.updateMatrixWorld(true);
    const inv = gun.matrixWorld.clone().invert(), v = new T.Vector3();
    const joint = known.joint.getWorldPosition(new T.Vector3());
    let d = Infinity;
    for (const [m, k] of known.skin) {
      m.getVertexPosition(k, v).applyMatrix4(m.matrixWorld);
      // (the crease's skin: round the last joint, not the tip)
      if (v.distanceTo(joint) > 0.011) continue;
      v.applyMatrix4(inv);
      for (const q of known.target) d = Math.min(d, v.distanceTo(q));
    }
    return Number.isFinite(d) ? Math.round(d * 10000) / 10 : null;
  };
})();
