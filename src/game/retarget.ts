/**
 * Clips made for one rig, played on another (Phase 21 S5, docs/OVERNIGHT_BRIEF_SOLDIER_AND_VERTICAL_CENTRE.md 6.7).
 *
 * The game's clips are Quaternius's, on a T-posed rig whose bones point along their +Y; the bought soldier is
 * A-posed, its bones point along +X, and its limbs are other lengths. The bone names match (the Unreal mannequin's),
 * so a clip's rotations would bind to the soldier, but they would mean nothing there: each is a turn from the
 * clip rig's own rest pose, about the clip rig's own axes.
 *
 * So each bone is carried over in world space. For every bone both rigs have, a frame is built in each from the
 * direction to its child and one reference axis (forward, or up for a bone that points forward), and the turn
 * between the two frames is the bone's offset: it takes in both the A-pose against the T-pose and the axes. Then at
 * every sampled moment the clip rig is posed, each soldier bone takes the clip bone's world turn with the offset,
 * and its local turn is what that leaves under its parent. Bones only the soldier has (its twist and IK bones) keep
 * their rest turn. Only the pelvis moves, by the clip pelvis's move from rest scaled by the ratio of the pelvis
 * heights, so a longer-legged figure does not sink into the floor or float.
 *
 * Pure (three.js maths only), so a check can run it in node.
 */
import * as THREE from "three";

interface RigBone {
  name: string;
  obj: THREE.Object3D;
  /** the parent bone's name, or null when the parent is not a bone (its world turn is then fixed) */
  parent: string | null;
  restLocalQ: THREE.Quaternion;
  restLocalP: THREE.Vector3;
  /** at rest, in the world */
  restWorldQ: THREE.Quaternion;
  restWorldP: THREE.Vector3;
  /** the world turn of a parent that is not a bone, fixed */
  baseQ: THREE.Quaternion;
  /** and its whole world matrix, inverted (a scale on the model is in it) */
  baseInv: THREE.Matrix4;
}

export interface Rig {
  root: THREE.Object3D;
  bones: Map<string, RigBone>;
  /** parents before children */
  order: string[];
}

/** a rig read off a model at rest (its scene as loaded) */
export function rigOf(root: THREE.Object3D): Rig {
  root.updateMatrixWorld(true);
  const bones = new Map<string, RigBone>();
  const order: string[] = [];
  root.traverse((o) => {
    if (!(o as THREE.Bone).isBone) return;
    const parentIsBone = !!(o.parent as THREE.Bone | null)?.isBone;
    const baseQ = new THREE.Quaternion();
    if (!parentIsBone && o.parent) o.parent.getWorldQuaternion(baseQ);
    const baseInv = !parentIsBone && o.parent ? o.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
    bones.set(o.name, {
      name: o.name,
      obj: o,
      parent: parentIsBone ? o.parent!.name : null,
      restLocalQ: o.quaternion.clone(),
      restLocalP: o.position.clone(),
      restWorldQ: o.getWorldQuaternion(new THREE.Quaternion()),
      restWorldP: o.getWorldPosition(new THREE.Vector3()),
      baseQ,
      baseInv,
    });
    order.push(o.name);
  });
  return { root, bones, order };
}

/** the child whose direction is a bone's own; a bone with none takes its parent's direction */
const CHILD: Record<string, string> = {
  pelvis: "spine_01",
  spine_01: "spine_02",
  spine_02: "spine_03",
  spine_03: "neck_01",
  neck_01: "Head",
};
for (const s of ["l", "r"]) {
  Object.assign(CHILD, {
    [`clavicle_${s}`]: `upperarm_${s}`,
    [`upperarm_${s}`]: `lowerarm_${s}`,
    [`lowerarm_${s}`]: `hand_${s}`,
    [`hand_${s}`]: `middle_01_${s}`,
    [`thigh_${s}`]: `calf_${s}`,
    [`calf_${s}`]: `foot_${s}`,
    [`foot_${s}`]: `ball_${s}`,
  });
  for (const f of ["index", "middle", "ring", "pinky", "thumb"]) {
    CHILD[`${f}_01_${s}`] = `${f}_02_${s}`;
    CHILD[`${f}_02_${s}`] = `${f}_03_${s}`;
  }
}

const Z = new THREE.Vector3(0, 0, 1);
const Y = new THREE.Vector3(0, 1, 0);

/** a bone's direction at rest, world: to its child, or its parent's when it has none */
function dirOf(rig: Rig, name: string): THREE.Vector3 | null {
  const b = rig.bones.get(name);
  if (!b) return null;
  const c = CHILD[name] ? rig.bones.get(CHILD[name]) : undefined;
  if (c) {
    const d = c.restWorldP.clone().sub(b.restWorldP);
    if (d.lengthSq() > 1e-10) return d.normalize();
  }
  return b.parent ? dirOf(rig, b.parent) : null;
}

/** a frame from a direction and a reference axis, as a turn */
function frame(d: THREE.Vector3, ref: THREE.Vector3): THREE.Quaternion {
  const x = d.clone().normalize();
  const z = ref.clone().sub(x.clone().multiplyScalar(ref.dot(x))).normalize();
  const y = z.clone().cross(x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}

export interface Retargeter {
  /** each shared bone's offset, clip world turn to soldier world turn */
  offset: Map<string, THREE.Quaternion>;
  src: Rig;
  dst: Rig;
  /** soldier pelvis height over the clip rig's, measured at rest */
  hipScale: number;
}

/** the offsets between two rigs, worked out once */
export function retargeter(src: Rig, dst: Rig): Retargeter {
  const offset = new Map<string, THREE.Quaternion>();
  for (const name of dst.order) {
    const s = src.bones.get(name);
    const t = dst.bones.get(name);
    if (!s || !t) continue;
    const ds = dirOf(src, name);
    const dt = dirOf(dst, name);
    if (!ds || !dt) continue;
    // forward is the reference, except for a bone that points along it (a foot, a toe), which takes up
    const ref = Math.abs(ds.dot(Z)) > 0.7 ? Y : Z;
    const align = frame(ds, ref).multiply(frame(dt, ref).invert());
    offset.set(name, s.restWorldQ.clone().invert().multiply(align).multiply(t.restWorldQ));
  }
  const ps = src.bones.get("pelvis");
  const pt = dst.bones.get("pelvis");
  const hipScale = ps && pt && ps.restWorldP.y > 0 ? pt.restWorldP.y / ps.restWorldP.y : 1;
  return { offset, src, dst, hipScale };
}

/** one clip, made for `r.src`, as a clip for `r.dst`: its rotations carried over, sampled at `fps` */
export function retargetClip(r: Retargeter, clip: THREE.AnimationClip, fps = 30): THREE.AnimationClip {
  const { src, dst } = r;
  // the clip's own tracks, by bone and property
  const rot = new Map<string, THREE.Interpolant>();
  const pos = new Map<string, THREE.Interpolant>();
  for (const t of clip.tracks) {
    const [bone, prop] = t.name.split(".");
    if (!src.bones.has(bone)) continue;
    if (prop === "quaternion") rot.set(bone, t.createInterpolant());
    else if (prop === "position") pos.set(bone, t.createInterpolant());
  }
  const n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(n);
  for (let i = 0; i < n; i++) times[i] = (clip.duration * i) / (n - 1);

  const out = new Map<string, Float32Array>();
  for (const name of dst.order) out.set(name, new Float32Array(n * 4));
  const hip = new Float32Array(n * 3);

  const sw = new Map<string, THREE.Quaternion>();
  const sp = new Map<string, THREE.Vector3>();
  const tw = new Map<string, THREE.Quaternion>();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const pelvisT = dst.bones.get("pelvis");
  const pelvisS = src.bones.get("pelvis");
  for (let i = 0; i < n; i++) {
    const t = times[i];
    // the clip rig posed, in the world
    for (const name of src.order) {
      const b = src.bones.get(name)!;
      const ri = rot.get(name);
      const lq = ri ? q.fromArray(ri.evaluate(t) as unknown as number[]).normalize() : b.restLocalQ;
      const pi = pos.get(name);
      const lp = pi ? v.fromArray(pi.evaluate(t) as unknown as number[]) : b.restLocalP;
      const pw = b.parent ? sw.get(b.parent)! : b.baseQ;
      const wq = (sw.get(name) ?? new THREE.Quaternion()).copy(pw).multiply(lq);
      sw.set(name, wq);
      const pp = b.parent ? sp.get(b.parent)! : null;
      // positions only matter for the pelvis's travel; a root bone's own place is its rest place in the world
      const wp = (sp.get(name) ?? new THREE.Vector3()).copy(lp).applyQuaternion(pw);
      if (pp) wp.add(pp);
      else wp.copy(b.restWorldP).add(lp.clone().sub(b.restLocalP).applyQuaternion(pw));
      sp.set(name, wp);
    }
    // the soldier, bone by bone
    for (const name of dst.order) {
      const b = dst.bones.get(name)!;
      const pw = b.parent ? tw.get(b.parent)! : b.baseQ;
      const off = r.offset.get(name);
      const wq = tw.get(name) ?? new THREE.Quaternion();
      if (off) wq.copy(sw.get(name)!).multiply(off);
      else wq.copy(pw).multiply(b.restLocalQ);
      tw.set(name, wq);
      const local = q.copy(pw).invert().multiply(wq);
      local.toArray(out.get(name)!, i * 4);
    }
    // the pelvis: its move from rest, scaled, in its parent's frame
    if (pelvisT && pelvisS) {
      const move = sp.get("pelvis")!.clone().sub(pelvisS.restWorldP).multiplyScalar(r.hipScale);
      // the soldier's pelvis hangs from a node, not a bone, so its place is the world place through that node
      const local = pelvisT.parent ? pelvisT.restLocalP.clone() : pelvisT.restWorldP.clone().add(move).applyMatrix4(pelvisT.baseInv);
      local.toArray(hip, i * 3);
    }
  }

  const tracks: THREE.KeyframeTrack[] = [];
  for (const name of dst.order) {
    // a bone the clip does not move and no offset turns keeps its rest: no track, less for the mixer to do
    if (!r.offset.has(name)) continue;
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, out.get(name)!));
  }
  if (pelvisT && pelvisS) tracks.push(new THREE.VectorKeyframeTrack("pelvis.position", times, hip));
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}
