// SpeedKills' soldier holding a long gun, as other players see it (Phase 27, 27.8; src/config/soldierhold.json).
//
// The figures' clips are a pistol library (Quaternius UAL): nothing in it holds a rifle, and the gun used to hang off
// the chest where the legacy mannequin's numbers put it, the arms swung at it by the upper arm and forearm alone. The
// owner saw it in the Loadouts tab: "you can tell it is purely fucked up". So the soldier's upper body is posed here,
// on top of the clips, the way a rifleman stands:
//
// 1. the chest turned to its right so the left shoulder leads, the head turned back to face the aim;
// 2. the butt in the right shoulder's pocket (measured off the model, in the chest's frame, so it rides the chest
//    through every step and breath of the clips), and the gun along the look, exactly;
// 3. each hand placed palm first on its hold and turned to it: a two-bone reach puts the wrist where the palm lands,
//    the hand is turned to its grip, the forearm's twist bone takes half the roll so the wrist does not wring;
// 4. the fingers closed round the grip and the handguard, each joint about its own bend axis, measured.
//
// What a hand is, is measured off the bones rather than their axes: the bought rig's right side mirrors its left
// (Unreal's convention), so a local axis means one thing on one hand and the opposite on the other. A hand here is
// its wrist, the way it runs to its knuckles, and the way its palm faces, the same on both.
import * as THREE from "three";
import cfg from "../config/soldierhold.json";

export type Side = "l" | "r";
const SIDES: Side[] = ["l", "r"];
const FINGERS = ["index", "middle", "ring", "pinky", "thumb"] as const;
const DEG = Math.PI / 180;
const X = new THREE.Vector3(1, 0, 0);
const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);

/** a hand, in its own bone's frame: its palm's middle, the way it runs wrist to knuckles, the way the palm faces */
interface HandRig {
  palm: THREE.Vector3;
  fwd: THREE.Vector3;
  face: THREE.Vector3;
}

/** what the rifle hold needs of a soldier model, measured once off its rest pose */
export interface RifleRig {
  /** the right shoulder joint in spine_03's own frame at rest, and the figure's frame in it (the pocket is set from them) */
  shoulder: THREE.Vector3;
  figInSpine: THREE.Quaternion;
  spineScale: number;
  hands: Record<Side, HandRig>;
  /**
   * each finger joint's bend toward the palm (an axis in its own frame), its sideways swing in the palm's plane, its bind
   * rotation, and (a finger's first joint) how far it is splayed from the middle finger's line, degrees about that swing
   */
  bend: Map<string, { axis: THREE.Vector3; spread: THREE.Vector3; bind: THREE.Quaternion; splay: number }>;
  /** each forearm's twist bone: its bind rotation, and the forearm's line in the forearm's frame */
  twist: Record<Side, { bind: THREE.Quaternion; along: THREE.Vector3 } | null>;
  /** the right eye's middle, in the Head bone's frame (the soldier's eye meshes, measured): where an aimed gun's sight line goes */
  eyeR: THREE.Vector3 | null;
}

/** the bones the hold turns, beyond those the figure already puts back from the clip every frame (mannequin.ts EDITED) */
export const RIFLE_BONES: string[] = [
  ...SIDES.flatMap((s) => [`hand_${s}`, `lowerarm_twist_01_${s}`, `clavicle_${s}`]),
  ...SIDES.flatMap((s) => FINGERS.flatMap((f) => [1, 2, 3].map((j) => `${f}_0${j}_${s}`))),
];

/** the rig of a soldier model in its rest pose (an unposed clone): null when it is not the bought soldier's */
export function measureRifleRig(root: THREE.Object3D): RifleRig | null {
  root.updateMatrixWorld(true);
  const bone = (n: string) => root.getObjectByName(n) ?? null;
  const at = (n: string) => bone(n)?.getWorldPosition(new THREE.Vector3()) ?? null;
  const spine = bone("spine_03");
  const shoulder = at("upperarm_r");
  if (!spine || !shoulder) return null;
  const hands = {} as Record<Side, HandRig>;
  const bend = new Map<string, { axis: THREE.Vector3; spread: THREE.Vector3; bind: THREE.Quaternion; splay: number }>();
  const twist = {} as RifleRig["twist"];
  for (const s of SIDES) {
    const hand = bone(`hand_${s}`);
    const w = at(`hand_${s}`);
    const k = at(`middle_01_${s}`);
    const ix = at(`index_01_${s}`);
    const pk = at(`pinky_01_${s}`);
    if (!hand || !w || !k || !ix || !pk) return null;
    const fwd = k.clone().sub(w).normalize();
    const across = ix.clone().sub(pk).normalize();
    // the palm's side: on the left hand fwd x across, the right mirrors it
    const face = (s === "l" ? fwd.clone().cross(across) : across.clone().cross(fwd)).normalize();
    face.addScaledVector(fwd, -face.dot(fwd)).normalize();
    const inv = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    hands[s] = { palm: hand.worldToLocal(w.clone().lerp(k, 0.5)), fwd: fwd.applyQuaternion(inv.clone()), face: face.clone().applyQuaternion(inv) };
    // each finger's first phalanx in the palm's plane: the bought rig's fingers fan out as a T-pose's do
    const inPalm = (f: string): THREE.Vector3 | null => {
      const a = at(`${f}_01_${s}`);
      const b = at(`${f}_02_${s}`);
      if (!a || !b) return null;
      const d = b.sub(a);
      return d.addScaledVector(face, -d.dot(face)).normalize();
    };
    const middle = inPalm("middle");
    // each finger joint turns toward the palm about the line across it: its own direction crossed with the palm's
    for (const f of FINGERS)
      for (let j = 1; j <= 3; j++) {
        const b = bone(`${f}_0${j}_${s}`);
        if (!b) continue;
        const next = bone(`${f}_0${j + 1}_${s}`);
        const from = b.getWorldPosition(new THREE.Vector3());
        const dir = next ? next.getWorldPosition(new THREE.Vector3()).sub(from) : from.clone().sub(b.parent!.getWorldPosition(new THREE.Vector3()));
        const axis = dir.normalize().cross(face).normalize();
        // and swings sideways about the palm's own normal, square to its line: a thumb that only curled could not
        // be brought down round a grip's side from where the bind pose has it, over the receiver
        const spread = face.clone().addScaledVector(dir, -face.dot(dir)).normalize();
        const toBone = b.getWorldQuaternion(new THREE.Quaternion()).invert();
        const line = j === 1 && f !== "thumb" && middle ? inPalm(f) : null;
        const splay = line && middle ? Math.atan2(line.clone().cross(middle).dot(face), line.dot(middle)) / DEG : 0;
        bend.set(b.name, { axis: axis.applyQuaternion(toBone), spread: spread.applyQuaternion(toBone), bind: b.quaternion.clone(), splay });
      }
    const tw = bone(`lowerarm_twist_01_${s}`);
    twist[s] = tw ? { bind: tw.quaternion.clone(), along: hand.position.clone().normalize() } : null;
  }
  // the pocket is set off the right shoulder joint in the figure's own frame (pocketOf), carried in the chest's
  const figQ = root.getWorldQuaternion(new THREE.Quaternion());
  const spineQ = spine.getWorldQuaternion(new THREE.Quaternion());
  return { shoulder: spine.worldToLocal(shoulder.clone()), figInSpine: spineQ.invert().multiply(figQ), spineScale: spine.getWorldScale(new THREE.Vector3()).x, hands, bend, twist, eyeR: rightEye(root) };
}

/**
 * The right eye's middle in the Head bone's frame, off the rest pose: the vertices of the soldier's eye mesh (its
 * M_eyes material) on the figure's right (-x) of the two, averaged.
 */
function rightEye(root: THREE.Object3D): THREE.Vector3 | null {
  const head = root.getObjectByName("Head");
  if (!head) return null;
  const pts: THREE.Vector3[] = [];
  root.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    // merged, the soldier's eye mesh is tagged with its slot (soldier.ts mergeSoldier); unmerged, its material is named so
    if (!m.isSkinnedMesh || (m.userData.soldierMaterial ?? (m.material as THREE.Material).name) !== "M_eyes") return;
    const pos = m.geometry.getAttribute("position");
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) pts.push(m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld).clone());
  });
  if (!pts.length) return null;
  const mid = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(pts.length);
  const right = pts.filter((p) => p.x < mid.x);
  if (!right.length) return null;
  return head.worldToLocal(right.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(right.length));
}

type HoldCfg = Omit<typeof cfg, "guns">;
const perGun = new Map<string, HoldCfg>();
/** the hold's numbers for one gun: the shared ones with that gun's own over them (soldierhold.json guns) */
function cfgFor(id: string): HoldCfg {
  let c = perGun.get(id);
  if (!c) {
    const own = (cfg.guns as Record<string, Record<string, unknown>>)[id] ?? {};
    c = JSON.parse(JSON.stringify(cfg)) as HoldCfg;
    mergeInto(c as unknown as Record<string, unknown>, own);
    perGun.set(id, c);
  }
  return c;
}
function mergeInto(to: Record<string, unknown>, from: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(from)) {
    if (v && typeof v === "object" && !Array.isArray(v) && to[k] && typeof to[k] === "object") mergeInto(to[k] as Record<string, unknown>, v as Record<string, unknown>);
    else to[k] = v;
  }
}

/** how much bigger than its model the soldier draws this gun (soldierhold.json scale): the glove is a big man's */
export function gunScaleOf(id: string): number {
  return cfgFor(id).scale;
}

/** where the soldier's left hand takes this gun, gun-local, when not where the model's own measures put it (soldierhold.json support) */
export function supportOf(id: string): THREE.Vector3 | null {
  const at = (cfg.guns as Record<string, { support?: number[] }>)[id]?.support;
  return at ? new THREE.Vector3(...at) : null;
}

/** where the butt sits, in spine_03's frame: in from the right shoulder joint toward the chest's middle (+x, the figure's left), under it, in front (soldierhold.json pocket) */
function pocketOf(rig: RifleRig, figScale: number, C: HoldCfg): THREE.Vector3 {
  const P = C.pocket;
  const off = new THREE.Vector3(P.in, -P.down, P.ahead).multiplyScalar(figScale / rig.spineScale).applyQuaternion(rig.figInSpine);
  return rig.shoulder.clone().add(off);
}

/**
 * The hold's numbers changed while it runs, for a tool searching them (tools/figure-solve.ts): each key of `patch`
 * over the config's, objects merged, anything else replaced. The page keeps them until it is loaded again.
 */
export function tuneRifle(patch: Record<string, unknown>): void {
  mergeInto(cfg as unknown as Record<string, unknown>, patch);
  perGun.clear();
}

/** the hold's numbers as they are now (tools/figure-solve.ts) */
export function rifleConfig(): typeof cfg {
  return JSON.parse(JSON.stringify(cfg));
}

/** a rotation that takes the frame (a, b) to the frame (c, d), each an orthogonal pair of directions */
function frameTo(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3): THREE.Quaternion {
  const basis = (u: THREE.Vector3, v: THREE.Vector3) => {
    const x = u.clone().normalize();
    const y = v.clone().addScaledVector(x, -v.dot(x)).normalize();
    const z = x.clone().cross(y);
    return new THREE.Matrix4().makeBasis(x, y, z);
  };
  const from = basis(a, b);
  const to = basis(c, d);
  return new THREE.Quaternion().setFromRotationMatrix(to.multiply(from.transpose()));
}

/** a bone's world rotation set to `q`, weighted by `w` from where the clip left it */
function setWorldQuat(b: THREE.Object3D, q: THREE.Quaternion, w: number): void {
  if (!b.parent) return;
  const cur = b.getWorldQuaternion(new THREE.Quaternion());
  const want = w >= 1 ? q.clone() : cur.slerp(q, w);
  b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(want));
  b.updateWorldMatrix(false, true);
}

/** turn a bone about an axis given in the figure's own frame (mannequin.ts turnBone, here for the chest and head) */
function turnAbout(b: THREE.Object3D, fig: THREE.Object3D, axis: THREE.Vector3, angle: number): void {
  if (Math.abs(angle) < 1e-5 || !b.parent) return;
  b.parent.updateWorldMatrix(true, false);
  const pq = b.parent.getWorldQuaternion(new THREE.Quaternion());
  const world = pq.clone().multiply(b.quaternion);
  const a = axis.clone().applyQuaternion(fig.getWorldQuaternion(new THREE.Quaternion())).normalize();
  world.premultiply(new THREE.Quaternion().setFromAxisAngle(a, angle));
  b.quaternion.copy(pq.invert().multiply(world));
}

/** turn a bone (weighted by w) so its direction `from` (world) points along `to` (world) */
function aim(b: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, w: number): void {
  if (!b.parent || from.lengthSq() < 1e-10 || to.lengthSq() < 1e-10) return;
  const d = new THREE.Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize());
  if (w < 1) d.slerpQuaternions(new THREE.Quaternion(), d.clone(), w);
  const world = b.getWorldQuaternion(new THREE.Quaternion()).premultiply(d);
  b.quaternion.copy(b.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(world));
  b.updateWorldMatrix(false, true);
}

/**
 * Upper arm and forearm reached so the wrist lands on `target` (world), the elbow toward `pole` (the figure's
 * frame), weighted by `w`; how far short it stays when the target is out of the arm's reach, metres.
 */
function reachArm(fig: THREE.Object3D, up: THREE.Object3D, lo: THREE.Object3D, hand: THREE.Object3D, target: THREE.Vector3, pole: THREE.Vector3, w: number): number {
  // the arm's chain alone, from its shoulder down (the whole figure a time, four times a frame, was most of the hold's cost)
  up.updateWorldMatrix(true, true);
  const a = up.getWorldPosition(new THREE.Vector3());
  const b = lo.getWorldPosition(new THREE.Vector3());
  const c = hand.getWorldPosition(new THREE.Vector3());
  const lab = a.distanceTo(b);
  const lbc = b.distanceTo(c);
  const toT = target.clone().sub(a);
  const want = toT.length();
  const dist = Math.max(0.05, Math.min(lab + lbc - 1e-3, want));
  const dir = toT.normalize();
  const p = pole.clone().applyQuaternion(fig.getWorldQuaternion(new THREE.Quaternion()));
  p.addScaledVector(dir, -p.dot(dir)).normalize();
  const cosA = Math.max(-1, Math.min(1, (lab * lab + dist * dist - lbc * lbc) / (2 * lab * dist)));
  const elbow = a.clone().addScaledVector(dir, cosA * lab).addScaledVector(p, Math.sqrt(1 - cosA * cosA) * lab);
  aim(up, b.clone().sub(a), elbow.sub(a), w);
  const b2 = lo.getWorldPosition(new THREE.Vector3());
  const c2 = hand.getWorldPosition(new THREE.Vector3());
  aim(lo, c2.sub(b2), a.clone().addScaledVector(dir, dist).sub(b2), w);
  return Math.max(0, want - (lab + lbc));
}

/** the twist of rotation q about the unit axis `along`, radians */
function twistAbout(q: THREE.Quaternion, along: THREE.Vector3): number {
  const p = along.x * q.x + along.y * q.y + along.z * q.z;
  return 2 * Math.atan2(p, q.w);
}

export interface RifleState {
  /** the look's pitch, radians, up positive */
  pitch: number;
  /** 0..1 aimed in */
  ads: number;
  /** 0..1 lowered across the body (a sprint, a swap) */
  lowered: number;
  /** 0..1 the right hand on its grip, and the left on the gun */
  wR: number;
  wL: number;
  /** 0..1 the stance itself (the chest's turn, the butt in the shoulder), off for a full-body clip */
  stance: number;
  /** a reload's progress 0..1, or null when not reloading */
  reload: number | null;
  /** a shot's kick, 1 as it fires and fading (dummy.ts kick) */
  kick: number;
  /** last frame's, so the moment a magazine is let go is caught once */
  lastReload?: number | null;
  /**
   * The figure's own memory of where the gun sits in its right hand, taken while both hands hold it: a full-body clip
   * (a slide, a climb, a zipline) takes the arms, and the gun goes with the right hand rather than hanging at the
   * shoulder with no hand on it.
   */
  mem?: { gunInHand: THREE.Matrix4 | null };
}

/** what a gun offers a reload, gun-local: its magazine (the group a reload takes out) and where the hand takes it, and the charging handle or bolt */
export interface ReloadParts {
  mag: THREE.Object3D | null;
  /** the magazine group's place at rest, in the gun */
  magHome: THREE.Vector3;
  magBottom: THREE.Vector3;
  handle: THREE.Vector3 | null;
}

export interface RifleGun {
  /** the gun's id, for its own numbers (soldierhold.json guns) */
  id: string;
  gun: THREE.Object3D;
  parts?: ReloadParts;
  /** gun-local: where the eye is when it aims down the gun's own sights (gunmodels.ts sightY, rearF) */
  sight?: THREE.Vector3;
  mount: THREE.Object3D;
  /** gun-local: the grip, where the left hand holds, and the butt */
  grip: THREE.Vector3;
  support: THREE.Vector3;
  butt: THREE.Vector3;
}

/** what the hold did this frame, for the checks: how far short each arm fell, and a magazine let go this frame */
export interface RifleOut {
  shortL: number;
  shortR: number;
  /** the magazine's place and turn in the world as the hand let go of it (the figure drops a copy there) */
  dropped?: { at: THREE.Vector3; q: THREE.Quaternion } | null;
  /** where the reload is: which of its keys each hand is between (tools/figure-frames.ts) */
  keys?: string;
  /** where each palm was meant to be this frame, world (MannequinFigure.holdPoints) */
  palm?: { r?: THREE.Vector3; l?: THREE.Vector3 };
}

/**
 * One frame of the hold, after the clips and the figure's own turns: the stance, the gun placed, the arms, hands and
 * fingers onto it. `bones` by name; `fig` the figure's root.
 */
export function holdRifle(fig: THREE.Object3D, bones: Record<string, THREE.Object3D>, rig: RifleRig, g: RifleGun, s: RifleState): RifleOut {
  const out: RifleOut = { shortL: 0, shortR: 0 };
  const b = bones;
  const C = cfgFor(g.id);
  // 1. the chest turned to its right, the left shoulder leading; the head turned back to look where the gun points
  const blade = C.blade * DEG * s.stance;
  if (b.spine_02) turnAbout(b.spine_02, fig, Y, -blade * 0.5);
  if (b.spine_03) turnAbout(b.spine_03, fig, Y, -blade * 0.5);
  if (b.Head) turnAbout(b.Head, fig, Y, blade);
  // aimed in, the head down onto the stock and toward the gun (the figure's right, -x)
  const A = C.pocket.adsHead;
  if (b.Head && s.ads > 0) {
    turnAbout(b.Head, fig, X, A.down * DEG * s.ads * s.stance);
    turnAbout(b.Head, fig, Z, A.toward * DEG * s.ads * s.stance);
  }
  // the chest's branch (the arms, the head, the gun), which the turns moved; the legs they did not
  (b.spine_02 ?? fig).updateWorldMatrix(true, true);
  // 2. the gun: its butt in the pocket (riding the chest), along the look, or lowered across the body
  const spine = b.spine_03;
  if (!spine) return out;
  const figQ = fig.getWorldQuaternion(new THREE.Quaternion());
  const figScale = fig.getWorldScale(new THREE.Vector3()).x;
  const pocket = spine.localToWorld(pocketOf(rig, figScale, C)).add(Y.clone().applyQuaternion(figQ).multiplyScalar(C.pocket.adsUp * s.ads * figScale));
  const L = C.lowered;
  const lo = s.lowered;
  // a reload turns the gun's magazine toward the left hand and tips it down, then back
  const R = C.reload;
  const u = s.reload;
  const tilt = u === null ? 0 : smooth(u, R.tiltIn[0], R.tiltIn[1]) * (1 - smooth(u, R.tiltOut[0], R.tiltOut[1]));
  const q = figQ
    .clone()
    .multiply(new THREE.Quaternion().setFromAxisAngle(X, -s.pitch * (1 - lo) + R.tilt.down * DEG * tilt - C.recoil.up * DEG * s.kick))
    .multiply(new THREE.Quaternion().setFromAxisAngle(Y, L.left * DEG * lo))
    .multiply(new THREE.Quaternion().setFromAxisAngle(X, L.down * DEG * lo))
    // the gun's own -z (its muzzle) onto the figure's +z (its front)
    .multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI))
    .multiply(new THREE.Quaternion().setFromAxisAngle(Z, L.roll * DEG * lo + R.tilt.roll * DEG * tilt));
  // Aimed in, the gun comes up to the eye: the butt where it puts the sight line through the right eye, `relief` in
  // front of it and `cheek` under it (the head has leant onto the stock above), blended in by how far the figure aims.
  const gunScale0 = g.gun.getWorldScale(new THREE.Vector3()).x;
  if (s.ads > 0 && g.sight && rig.eyeR && b.Head) {
    const eye = b.Head.localToWorld(rig.eyeR.clone());
    const A2 = C.aim;
    const upW = Y.clone().applyQuaternion(q);
    const fwdW = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
    // (the figure's right is its -x)
    const rightW = new THREE.Vector3(-1, 0, 0).applyQuaternion(figQ);
    const sightAt = eye.clone().addScaledVector(fwdW, A2.relief * figScale).addScaledVector(upW, -A2.cheek * figScale).addScaledVector(rightW, (A2.side ?? 0) * figScale);
    // where the butt is when the gun's sight is at sightAt: sightAt + q (butt - sight)
    const buttAt = sightAt.add(g.butt.clone().sub(g.sight).multiplyScalar(gunScale0).applyQuaternion(q));
    pocket.lerp(buttAt, Math.min(1, s.ads) * s.stance);
  }
  // a shot drives the gun back into the shoulder
  if (s.kick > 0) pocket.add(new THREE.Vector3(0, 0, -C.recoil.back * s.kick * figScale).applyQuaternion(figQ));
  // the mount is the grip's frame: the butt at the pocket puts the grip at pocket + q (grip - butt)
  const gunScale = g.gun.getWorldScale(new THREE.Vector3()).x;
  // lowered, the gun is held out from the body a little, so its receiver clears the belly it hangs across
  if (lo > 0) pocket.add(new THREE.Vector3(...L.out).multiplyScalar(lo * figScale).applyQuaternion(figQ));
  const mountAt = pocket.clone().add(g.grip.clone().sub(g.butt).multiplyScalar(gunScale).applyQuaternion(q));
  const parent = g.mount.parent;
  if (!parent) return out;
  parent.updateWorldMatrix(true, false);
  const mountScale = g.mount.getWorldScale(new THREE.Vector3()).x;
  const want = new THREE.Matrix4().compose(mountAt, q, new THREE.Vector3(1, 1, 1).multiplyScalar(mountScale));
  // out of the stance (a full-body clip has the arms): the gun where the right hand carries it
  const handR = b.hand_r;
  if (s.stance < 0.999 && s.mem?.gunInHand && handR) {
    handR.updateWorldMatrix(true, false);
    const inHand = new THREE.Matrix4().multiplyMatrices(handR.matrixWorld, s.mem.gunInHand);
    const p0 = new THREE.Vector3();
    const q0 = new THREE.Quaternion();
    const p1 = new THREE.Vector3();
    const q1b = new THREE.Quaternion();
    const sc = new THREE.Vector3();
    want.decompose(p0, q0, sc);
    inHand.decompose(p1, q1b, sc);
    const k = 1 - s.stance;
    want.compose(p0.lerp(p1, k), q0.slerp(q1b, k), new THREE.Vector3(1, 1, 1).multiplyScalar(mountScale));
  }
  const local = new THREE.Matrix4().copy(parent.matrixWorld).invert().multiply(want);
  local.decompose(g.mount.position, g.mount.quaternion, g.mount.scale);
  g.mount.updateMatrixWorld(true);
  // 4. the fingers closed round the hold, each joint about its own bend axis, from its bind pose
  const closeFingers = (side: Side, w: number): void => {
    const F = C.fingers[side];
    for (const f of FINGERS)
      for (let j = 1; j <= 3; j++) {
        const fb = b[`${f}_0${j}_${side}`];
        const m = rig.bend.get(`${f}_0${j}_${side}`);
        if (!fb || !m) continue;
        // A finger's first joint is swung sideways (its fourth number, or `together` of the way from its splay to the
        // middle finger's line) and then curled about its bend axis as it was: swung after the curl, a curled finger
        // only spins about its own length. The thumb the other way round: curled, and then the curled thumb turned
        // about the palm's normal, which is how it goes round the far side of a grip (swung first, it could not).
        const swing = j === 1 ? (F[f][3] ?? (f === "thumb" ? 0 : C.together * m.splay)) : 0;
        const curl = new THREE.Quaternion().setFromAxisAngle(m.axis, F[f][j - 1] * DEG);
        const turn = new THREE.Quaternion().setFromAxisAngle(m.spread, swing * DEG);
        const target = f === "thumb" ? m.bind.clone().multiply(turn).multiply(curl) : m.bind.clone().multiply(curl).multiply(turn);
        fb.quaternion.slerp(target, w);
      }
  };
  // 3. the hands, palm first: the wrist where the palm lands, the elbow the rifleman's way, the hand turned to its hold
  for (const side of ["r", "l"] as Side[]) {
    const w = side === "r" ? s.wR : s.wL;
    const up = b[`upperarm_${side}`];
    const fore = b[`lowerarm_${side}`];
    const hand = b[`hand_${side}`];
    if (!up || !fore || !hand) continue;
    // A full-body clip (a slide, a climb) has the arm, but the gun is still in the right hand, where the hold left it
    // (mem.gunInHand): its fingers stay closed round the grip. The clip's own were a fist through it.
    const carried = side === "r" && s.stance < 0.999 && !!s.mem?.gunInHand;
    if (w < 0.01) {
      if (carried) closeFingers(side, 1);
      continue;
    }
    const gunQ = g.gun.getWorldQuaternion(new THREE.Quaternion());
    const aimAt = keyTarget(side === "r" ? "grip" : "hold", C, g, gunQ, b, figQ);
    // lowered, the left hand takes the gun its own way (lowered.l), blended in as the gun drops
    if (side === "l" && lo > 0) {
      const LL = keyTarget("lowL", C, g, gunQ, b, figQ);
      aimAt.at.lerp(LL.at, lo);
      aimAt.fwd.lerp(LL.fwd, lo).normalize();
      aimAt.face.lerp(LL.face, lo).normalize();
    }
    const reloadAt = u !== null && g.parts ? reloadTarget(side, u, C, g, gunQ, b, figQ) : null;
    const { at: palmAt, fwd, face } = reloadAt ?? aimAt;
    (out.palm ??= {})[side] = palmAt.clone();
    if (reloadAt) out.keys = `${out.keys ? `${out.keys} ` : ""}${side}:${reloadAt.key}`;
    const hr = rig.hands[side];
    const handQ = frameTo(hr.fwd, hr.face, fwd, face);
    // the hand's frame in the world is its bone's: the palm's middle sits `palm` from the wrist in it
    const handScale = hand.getWorldScale(new THREE.Vector3()).x;
    const wrist = palmAt.clone().sub(hr.palm.clone().multiplyScalar(handScale).applyQuaternion(handQ));
    const short = reachArm(fig, up, fore, hand, wrist, new THREE.Vector3(...C.elbows[side]), w);
    if (side === "r") out.shortR = short;
    else out.shortL = short;
    setWorldQuat(hand, handQ, w);
    // the forearm's twist bone takes its share of the hand's roll about the forearm
    const tw = rig.twist[side];
    const twb = b[`lowerarm_twist_01_${side}`];
    if (tw && twb) {
      const rel = fore.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(hand.getWorldQuaternion(new THREE.Quaternion()));
      const roll = twistAbout(rel, tw.along);
      twb.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(tw.along, roll * C.twist * w).multiply(tw.bind));
    }
    closeFingers(side, carried ? Math.max(w, 1 - s.stance) : w);
  }
  // held in both hands in the stance: remember where the gun is in the right hand, for when a full-body clip takes the arms
  if (s.mem && handR && s.stance > 0.99 && s.wR > 0.99 && u === null) {
    handR.updateWorldMatrix(true, false);
    g.mount.updateWorldMatrix(true, false);
    s.mem.gunInHand = (s.mem.gunInHand ?? new THREE.Matrix4()).copy(handR.matrixWorld).invert().multiply(g.mount.matrixWorld);
  }
  // the magazine: out with the hand, let go (the figure drops a copy), a new one in the hand from the pouch, home
  const parts = g.parts;
  if (parts?.mag) {
    const m = parts.mag;
    if (u === null || !R.magazine) {
      m.position.copy(parts.magHome);
      m.visible = true;
    } else {
      const outK = smooth(u, R.pull[0], R.pull[1]);
      if (u < R.dropAt) {
        m.visible = true;
        m.position.copy(parts.magHome).add(new THREE.Vector3(0, -R.out * outK, 0));
      } else if (u < R.inHand[0]) {
        m.visible = false;
      } else if (u < R.inHand[1]) {
        // in the left hand: its bottom in the palm, upright as the gun is, so it goes in straight
        m.visible = true;
        const hand = b.hand_l;
        const hr = rig.hands.l;
        if (hand) {
          const palm = hand.localToWorld(hr.palm.clone());
          const bottomOff = parts.magBottom.clone().sub(parts.magHome);
          const home = g.gun.worldToLocal(palm);
          m.position.copy(home.sub(bottomOff).add(new THREE.Vector3(0, R.magInPalm, 0)));
        }
      } else m.position.copy(parts.magHome);
      m.visible = u < R.dropAt || u >= R.inHand[0];
    }
    // the moment the hand lets go: where it is, for the copy that falls
    if (u !== null && R.magazine && u >= R.dropAt && (s.lastReload ?? -1) < R.dropAt) {
      m.updateWorldMatrix(true, false);
      out.dropped = { at: m.getWorldPosition(new THREE.Vector3()), q: m.getWorldQuaternion(new THREE.Quaternion()) };
    }
  }
  (b.spine_02 ?? fig).updateWorldMatrix(false, true);
  return out;
}

/** 0 before a, 1 after b, eased between */
function smooth(u: number, a: number, b: number): number {
  const t = Math.max(0, Math.min(1, (u - a) / Math.max(1e-6, b - a)));
  return t * t * (3 - 2 * t);
}

type Target = { at: THREE.Vector3; fwd: THREE.Vector3; face: THREE.Vector3; key: string };

/**
 * A hand's target at one named key, in the world: `grip` and `hold` are the hold's own (soldierhold.json hands); the
 * rest are a reload's, each a palm place and turn off a part of the gun (its magazine's bottom, its charging handle,
 * its bolt) or, for the pouch, off the hips.
 */
function keyTarget(key: string, C: HoldCfg, g: RifleGun, gunQ: THREE.Quaternion, b: Record<string, THREE.Object3D>, figQ: THREE.Quaternion): Target {
  if (key === "grip" || key === "hold" || key === "lowL") {
    const H = key === "lowL" ? C.lowered.l : C.hands[key === "grip" ? "r" : "l"];
    const hold = key === "grip" ? g.grip : g.support;
    return { at: g.gun.localToWorld(hold.clone().add(new THREE.Vector3(...H.at))), fwd: new THREE.Vector3(...H.fwd).normalize().applyQuaternion(gunQ), face: new THREE.Vector3(...H.palm).normalize().applyQuaternion(gunQ), key };
  }
  const K = (C.reload.keys as Record<string, { from: string; at: number[]; fwd: number[]; palm: number[] }>)[key];
  const parts = g.parts!;
  if (K.from === "hips") {
    const pelvis = b.pelvis;
    const at = (pelvis ? pelvis.getWorldPosition(new THREE.Vector3()) : g.gun.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(...K.at).applyQuaternion(figQ));
    return { at, fwd: new THREE.Vector3(...K.fwd).normalize().applyQuaternion(figQ), face: new THREE.Vector3(...K.palm).normalize().applyQuaternion(figQ), key };
  }
  const base = K.from === "mag" ? parts.magBottom : K.from === "handle" && parts.handle ? parts.handle : g.grip;
  return { at: g.gun.localToWorld(base.clone().add(new THREE.Vector3(...K.at))), fwd: new THREE.Vector3(...K.fwd).normalize().applyQuaternion(gunQ), face: new THREE.Vector3(...K.palm).normalize().applyQuaternion(gunQ), key };
}

/** a hand's target during a reload: between the two of its keys the progress is between, eased; null when this hand has none then */
function reloadTarget(side: Side, u: number, C: HoldCfg, g: RifleGun, gunQ: THREE.Quaternion, b: Record<string, THREE.Object3D>, figQ: THREE.Quaternion): Target | null {
  const list = (side === "l" ? C.reload.left : C.reload.right) as Array<[number, string]>;
  if (!list.length || u < list[0][0] || u > list[list.length - 1][0]) return null;
  let i = 0;
  while (i < list.length - 2 && u > list[i + 1][0]) i++;
  const [a0, k0] = list[i];
  const [a1, k1] = list[i + 1];
  const t = smooth(u, a0, a1);
  const A = keyTarget(k0, C, g, gunQ, b, figQ);
  if (t <= 0 || k0 === k1) return A;
  const B = keyTarget(k1, C, g, gunQ, b, figQ);
  const fwd = A.fwd.clone().lerp(B.fwd, t).normalize();
  const face = A.face.clone().lerp(B.face, t).normalize();
  return { at: A.at.clone().lerp(B.at, t), fwd, face, key: t < 0.5 ? k0 : k1 };
}

/**
 * Where a gun's butt is, gun-local: the middle of whatever of it is within 2 cm of its rearmost point (the model is
 * built pointing along its own -z, so the rear is its largest z). Measured on the gun that is actually held.
 */
export function buttOf(gun: THREE.Object3D): THREE.Vector3 {
  gun.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(gun.matrixWorld).invert();
  let maxZ = -Infinity;
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  gun.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.visible) return;
    let shown = true;
    for (let p: THREE.Object3D | null = m; p && p !== gun; p = p.parent) shown &&= p.visible;
    if (!shown) return;
    const pos = m.geometry.getAttribute("position");
    const toGun = new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld);
    for (let i = 0; i < pos.count; i += 2) {
      v.fromBufferAttribute(pos, i).applyMatrix4(toGun);
      pts.push(v.clone());
      if (v.z > maxZ) maxZ = v.z;
    }
  });
  const near = pts.filter((p) => p.z > maxZ - 0.02);
  if (!near.length) return new THREE.Vector3(0, 0, 0.2);
  const mid = near.reduce((a, p) => a.add(p), new THREE.Vector3()).divideScalar(near.length);
  return new THREE.Vector3(mid.x, mid.y, maxZ);
}
