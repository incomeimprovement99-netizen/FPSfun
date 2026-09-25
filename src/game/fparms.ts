// The player's own arms in the first-person view.
//
// The viewmodel's hands used to be drawn in code: a glove of capsules and a
// sleeve that was a cylinder, which from behind the gun read as two grey
// pipes. These are the published body's own arms and hands, cut down to the
// arms (mannequin.ts buildArmRig), in the body and build the loadout picked,
// wearing the outfit's own sleeves in the outfit's own colour.
//
// None of the viewmodel's animation changes. It still works out where every
// hand goes - on the grip, on the handguard, on the magazine in a reload, up
// on a zipline trolley, a fist when holstered - by placing its glove there.
// The glove is no longer drawn; a real arm is posed onto it each frame
// instead: the hand bone on the glove's wrist, turned to the glove's own
// frame, and the forearm and upper arm back along the line the drawn
// forearm took, which is already kept clear of the eye.
import * as THREE from "three";
import { GLOVE_MIDDLE_KNUCKLE, GLOVE_WRIST, type Forearm, type Hand } from "./arms";
import cfg from "../config/viewmodel.json";
import { armRigKey, buildArmRig, type ArmRig } from "./mannequin";
import type { OperatorSkin } from "./operators";

/** the drawn glove's knuckles run from the little finger at the bottom to the index at the top, along +y (arms.ts Hand) */
const GLOVE_ACROSS = new THREE.Vector3(0, 1, 0);

/** how much of the wrist's twist the forearm takes, and how far the upper arm turns down out of the frame (viewmodel.json realArms) */
const TWIST = cfg.realArms.twist;
const DOWN = cfg.realArms.down;

interface Side {
  up: THREE.Bone;
  lo: THREE.Bone;
  hand: THREE.Bone;
  /** each bone's own axis toward its child, in its own space */
  upAxis: THREE.Vector3;
  loAxis: THREE.Vector3;
  /** the upper arm's, the forearm's and the hand's rest turns against their parents */
  upRest: THREE.Quaternion;
  loRest: THREE.Quaternion;
  handRest: THREE.Quaternion;
  /** the hand's own frame: toward the middle knuckle, and across from the little finger to the index */
  handFwd: THREE.Vector3;
  handAcross: THREE.Vector3;
  /** the two bones' lengths, metres on the body */
  upperLen: number;
  foreLen: number;
  /** the forearm's scale against the rig's group: the body's own units to the view's */
  restUnit: number;
}

const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const m1 = new THREE.Matrix4();
const m2 = new THREE.Matrix4();
const scl = new THREE.Vector3();

/** a rotation from three orthonormal axes, given as columns */
function basis(x: THREE.Vector3, y: THREE.Vector3, z: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  return out.setFromRotationMatrix(m1.makeBasis(x, y, z));
}

/**
 * A hand's frame from the line across its knuckles, which is kept exactly,
 * and the way its fingers point, squared to it. The knuckle line is what a
 * grip fixes: it lies along the grip. The glove's wrist sits low on a pistol
 * grip, so its line from wrist to knuckle climbs 47 degrees, and kept exact
 * it bent the wrist into an S.
 *
 * The third axis is always fingers cross knuckles, on either hand. On a left
 * hand that points out of the palm rather than the back, and that does not
 * matter, because the glove's frame and the body's are both built the same
 * way for the same hand. Building the left one the mirrored way to make it
 * "the back of the hand" made the frame a reflection, which is no rotation
 * at all: the left arm came out a ribbon stretched to the horizon.
 */
function frame(fwd: THREE.Vector3, across: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const s = v2.copy(across).normalize();
  const f = v1.copy(fwd).addScaledVector(s, -fwd.dot(s)).normalize();
  return basis(f, s, v3.crossVectors(f, s).normalize(), out);
}

export class FpArms {
  /** parented to the viewmodel's own root, so it is in the view's space and hides with it */
  readonly group = new THREE.Group();
  private rig: ArmRig | null = null;
  private sides: { r: Side; l: Side } | null = null;
  private skin: OperatorSkin | null = null;
  /** when the rig was last asked for, ms */
  private askedAt = -Infinity;

  /** the look to wear; the arms are rebuilt when it changes */
  setLook(skin: OperatorSkin): void {
    this.skin = skin;
    this.askedAt = -Infinity;
  }

  /** the real arms are in and posed; while false the viewmodel draws its own */
  get ready(): boolean {
    return !!this.rig && !!this.sides;
  }

  /** build, or rebuild when the look or what has loaded for it changed */
  refresh(): void {
    if (!this.skin) return;
    const key = armRigKey(this.skin);
    if (this.rig && this.rig.key === key) return;
    // a body still loading is asked for again, twice a second rather than
    // every frame (by the clock: a paused page draws a frame a second)
    const now = performance.now();
    if (now - this.askedAt < 500) return;
    this.askedAt = now;
    const rig = buildArmRig(this.skin);
    if (!rig) return;
    if (this.rig) this.group.remove(this.rig.root);
    this.rig = rig;
    this.group.add(rig.root);
    this.sides = { r: this.measure("r"), l: this.measure("l") };
  }

  private measure(s: "r" | "l"): Side {
    const b = this.rig!.bones;
    const up = b[`upperarm_${s}`];
    const lo = b[`lowerarm_${s}`];
    const hand = b[`hand_${s}`];
    const across = b[`index_01_${s}`].position.clone().sub(b[`pinky_01_${s}`].position);
    this.group.updateWorldMatrix(true, true);
    return {
      restUnit: Math.abs(lo.getWorldScale(new THREE.Vector3()).x) / this.group.matrixWorld.getMaxScaleOnAxis(),
      up,
      lo,
      hand,
      upAxis: lo.position.clone().normalize(),
      loAxis: hand.position.clone().normalize(),
      upRest: up.quaternion.clone(),
      loRest: lo.quaternion.clone(),
      handRest: hand.quaternion.clone(),
      handFwd: b[`middle_01_${s}`].position.clone().normalize(),
      handAcross: across.normalize(),
      upperLen: lo.position.length(),
      foreLen: hand.position.length(),
    };
  }

  /**
   * One arm onto a drawn glove and its drawn forearm, which the viewmodel has
   * already placed this frame. Everything is worked out in world space and
   * written back to the bones as turns against their parents.
   */
  pose(side: "r" | "l", glove: Hand, forearm: Forearm, grip: "grip" | "fist"): void {
    if (!this.rig || !this.sides) return;
    const S = this.sides[side];
    glove.group.updateWorldMatrix(true, false);
    forearm.group.updateWorldMatrix(true, false);
    const gm = glove.group.matrixWorld;
    // Each arm is sized to its own glove: whatever scale the viewmodel draws
    // a hand at, the real one is drawn at the same. The support glove is drawn
    // bigger than the grip hand, so the two arms are sized apart, at their
    // own upper arms. The rig's root keeps one scale: sizing it per arm, twice
    // a frame, compounded into the bones and grew a forearm to five times its
    // size in a few frames.
    const unit = S.restUnit * gm.getMaxScaleOnAxis();

    // the hand: on the glove's wrist, in the glove's own frame
    const wrist = GLOVE_WRIST.clone().applyMatrix4(gm);
    const fwd = GLOVE_MIDDLE_KNUCKLE.clone().sub(GLOVE_WRIST).transformDirection(gm);
    const across = GLOVE_ACROSS.clone().transformDirection(gm);
    const want = frame(fwd, across, new THREE.Quaternion());
    const own = frame(S.handFwd, S.handAcross, new THREE.Quaternion());
    const handQ = want.multiply(own.invert());

    // the forearm back along the drawn one, which the viewmodel keeps clear
    // of the eye; the elbow where a forearm of this body's length ends
    const along = new THREE.Vector3(0, 1, 0).applyQuaternion(forearm.group.getWorldQuaternion(q1)).normalize();
    const elbow = wrist.clone().addScaledVector(along, S.foreLen * unit);
    // The upper arm goes down in the view from the elbow, blended with the
    // forearm's own line: down is the shortest way out of the frame, so its
    // cut end is never seen. Run on along the forearm's line it swept up both
    // edges of the frame past the eye; run to a shoulder behind the eye it was
    // a wall of deltoid; cut short it ended in the frame.
    const down = new THREE.Vector3(0, -1, 0.35).transformDirection(this.group.matrixWorld);
    const upDir = along.clone().lerp(down, DOWN).normalize().negate();
    const top = elbow.clone().addScaledVector(upDir, -S.upperLen * unit);

    // The twist: a hand rolled over on a handguard is turned a long way from
    // an arm at rest. The forearm takes half of that turn and the wrist the
    // other half, and the upper arm's stub turns with the forearm so the
    // elbow takes none. Kept whole at the wrist it wrung the wrist; shared
    // between wrist and elbow, with the upper arm left at rest, it crumpled
    // the elbow.
    S.up.parent!.updateWorldMatrix(true, false);
    const rest = S.up.parent!.getWorldQuaternion(new THREE.Quaternion()).multiply(S.upRest).multiply(S.loRest);
    const loDir = wrist.clone().sub(elbow).normalize();
    const swing = (q: THREE.Quaternion, axis: THREE.Vector3, dir: THREE.Vector3): THREE.Quaternion => q.premultiply(q1.setFromUnitVectors(axis.clone().applyQuaternion(q).normalize(), dir));
    const fromRest = swing(rest, S.loAxis, loDir);
    const fromWrist = swing(handQ.clone().multiply(q2.copy(S.handRest).invert()), S.loAxis, loDir);
    const loQ = swing(fromRest.slerp(fromWrist, TWIST), S.loAxis, loDir);
    const upQ = swing(loQ.clone().multiply(q2.copy(S.loRest).invert()), S.upAxis, upDir);

    this.place(S.up, top, upQ, unit);
    this.place(S.lo, elbow, loQ, unit);
    this.place(S.hand, wrist, handQ, unit);
    // the fingers: closed round a grip, or a fist
    const pose = grip === "grip" ? this.rig.grip : this.rig.fist;
    for (const [name, q] of pose) {
      const bone = this.rig.bones[name];
      if (bone && name.endsWith(`_${side}`)) bone.quaternion.copy(q);
    }
    S.hand.updateMatrixWorld(true);
  }

  /** a bone to a world position and turn, written as its place against its parent */
  private place(bone: THREE.Bone, at: THREE.Vector3, turn: THREE.Quaternion, unit: number): void {
    const parent = bone.parent!;
    parent.updateWorldMatrix(true, false);
    m2.compose(at, turn, scl.set(unit, unit, unit));
    m1.copy(parent.matrixWorld).invert().multiply(m2);
    m1.decompose(bone.position, bone.quaternion, bone.scale);
    bone.updateMatrixWorld(true);
  }
}
