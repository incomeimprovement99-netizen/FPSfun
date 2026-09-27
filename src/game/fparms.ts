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
import { IS_SK } from "./game";
import { armRigKey, buildArmRig, FP_UPPER, type ArmRig } from "./mannequin";
import type { OperatorSkin } from "./operators";

/** the drawn glove's knuckles run from the little finger at the bottom to the index at the top, along +y (arms.ts Hand) */
const GLOVE_ACROSS = new THREE.Vector3(0, 1, 0);

/** how much of the wrist's twist the forearm takes, and how far the upper arm turns down out of the frame (viewmodel.json realArms) */
const TWIST = cfg.realArms.twist;
/** how far the upper arm reaches out from its axis where it is cut, on the body (viewmodel.json realArms, measured off the soldier) */
const CUT_RADIUS = cfg.realArms.cutRadius;
/** how far toward its lower corner an aimed forearm always leans (viewmodel.json realArms adsLean) */
const ADS_LEAN = cfg.realArms.adsLean;
/** how much of the upper arm is drawn, from the elbow (mannequin.ts cuts it there) */
const UPPER = FP_UPPER;
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
  /**
   * the hand's size against the body's: the drawn glove's wrist to middle knuckle (arms.ts) over the body's, never
   * over 1, so the hand is the size of the glove the grips were posed for. The bought soldier's armoured hands are 1.4
   * times that glove (124 mm to 87). The forearm keeps the body's length and is drawn thinner by the same (mannequin.ts
   * slimForearms): shrunk whole, it was too short to take the arm out of the frame from a handguard, and the upper
   * arm's cut end hung under the gun; at the body's thickness it filled the sight picture either side of the gun
   */
  fit: number;
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
    const knuckle = b[`middle_01_${s}`]?.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3()));
    return {
      restUnit: Math.abs(lo.getWorldScale(new THREE.Vector3()).x) / this.group.matrixWorld.getMaxScaleOnAxis(),
      fit: knuckle ? Math.min(1, GLOVE_MIDDLE_KNUCKLE.distanceTo(GLOVE_WRIST) / (knuckle / this.group.matrixWorld.getMaxScaleOnAxis())) : 1,
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
  pose(side: "r" | "l", glove: Hand, forearm: Forearm, grip: "grip" | "fist" | "point" | "open"): void {
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
    // SpeedKills' soldier at the body's own size, both arms: sized to its glove, the support arm took the support
    // glove's 1.15 (drawn bigger so a plain glove reads) and was 15% bigger than the arm on the trigger, a slab across
    // the bottom of the owner's view at 1920 by 1080 (tools/pov-sheet.ts)
    const body = S.restUnit * (IS_SK ? this.group.matrixWorld.getMaxScaleOnAxis() : gm.getMaxScaleOnAxis());
    // the hand's scale (SpeedKills' soldier only: the legacy game's arms stay as they were)
    const unit = IS_SK ? body * S.fit : body;

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
    const down = new THREE.Vector3(0, -1, 0.35).transformDirection(this.group.matrixWorld);
    const downBy = IS_SK ? this.cutOffFrame(side, wrist, along, down, S.foreLen * body, UPPER * S.upperLen * body, 0.5 * CUT_RADIUS * body) : DOWN;
    const elbow = wrist.clone().addScaledVector(along, S.foreLen * body);
    // The upper arm goes down in the view from the elbow, blended with the
    // forearm's own line: down is the shortest way out of the frame, so its
    // cut end is never seen. Run on along the forearm's line it swept up both
    // edges of the frame past the eye; run to a shoulder behind the eye it was
    // a wall of deltoid; cut short it ended in the frame.
    const upDir = along.clone().lerp(down, downBy).normalize().negate();
    const top = elbow.clone().addScaledVector(upDir, -S.upperLen * body);
    this.cutsOff[side] = this.offFrame(elbow.clone().addScaledVector(upDir, -UPPER * S.upperLen * body), 0.5 * CUT_RADIUS * body);

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

    this.place(S.up, top, upQ, body);
    this.place(S.lo, elbow, loQ, body);
    this.place(S.hand, wrist, handQ, unit);
    // the fingers: closed round a grip, or a fist
    const pose = grip === "grip" ? this.rig.grip : grip === "fist" ? this.rig.fist : grip === "point" ? this.rig.point : this.rig.open;
    for (const [name, q] of pose) {
      const bone = this.rig.bones[name];
      if (bone && name.endsWith(`_${side}`)) bone.quaternion.copy(q);
    }
    S.hand.updateMatrixWorld(true);
  }

  /**
   * The upper arm's cut end off the gun camera's frame. The forearm runs from the glove toward the drawn forearm's far
   * end, a point low and forward, and where this body's forearm is shorter than the way there its elbow stopped in the
   * lower middle of the frame, and the upper arm's cut end hung in the picture under the gun (the owner: "the left is
   * clearly fucked up"). The frame is too tall (about 92 degrees) for a forearm the glove's size to take its elbow out
   * of it from a handguard, so the arm is turned until the cut end, and half its thickness, is past the frame's edge
   * (all of it took the arm on toward the eye like a tube), a step at a time: at the hip toward the frame's lower
   * corner on its own side (straight down, it stood under the gun like a post), in the sights down and out at about 30
   * degrees (straight down, the two walled the gun in; flat to the side, the narrower frame's edge took a forearm
   * across half the picture), and then on toward the eye as far as it takes. Worked in the gun camera's space: the
   * viewmodel's group hangs off that camera, the eye at its origin.
   */
  private cutOffFrame(side: "r" | "l", wrist: THREE.Vector3, along: THREE.Vector3, down: THREE.Vector3, fore: number, upper: number, radius: number): number {
    const eye = this.group.parent;
    if (!eye) return DOWN;
    const x = side === "l" ? -1 : 1;
    const ads = this.view.ads;
    // first toward the frame's lower corner (at the hip) or down under the gun (aimed), which is how an arm reads;
    // then, only as far as it takes, on toward the eye, the one way a short arm can always leave the frame (all the
    // way, it came at the eye like a tube)
    const corner = new THREE.Vector3(x, -0.9, 0.6).lerp(v2.set(0.95 * x, -1, 0.45), ads).transformDirection(eye.matrixWorld);
    const eyeward = new THREE.Vector3(0.8 * x, -0.9, 1.8).lerp(v2.set(0.4 * x, -1, 1.4), ads).transformDirection(eye.matrixWorld);
    const from = along.clone();
    const up = new THREE.Vector3();
    // aimed, the arm leans out toward its corner however little it needs to: hanging straight down from the gun, the
    // two forearms stood either side of the magazine and walled it in (tools/pov-sheet.ts at 1920 by 1080)
    // and past the eye, the upper arm turning on down with it: a support hand far out on a long gun (the rifle's, the
    // sniper's) leaves its elbow too near the middle for the forearm alone, and the stub's cut end stood at the bottom
    let dw = DOWN;
    for (let t = ADS_LEAN * ads; t <= 2.0001; t += 0.05) {
      if (t <= 1) along.copy(from).lerp(corner, t).normalize();
      else along.copy(corner).lerp(eyeward, t - 1).normalize();
      dw = t <= 1 ? DOWN : DOWN + (1 - DOWN) * (t - 1);
      up.copy(along).lerp(down, dw).normalize();
      if (this.offFrame(v3.copy(wrist).addScaledVector(along, fore).addScaledVector(up, upper), radius)) return dw;
    }
    return dw;
  }

  /** a point (world), with this much round it, entirely outside the gun camera's frame, or behind the eye */
  private offFrame(at: THREE.Vector3, radius: number): boolean {
    const eye = this.group.parent;
    if (!eye) return true;
    eye.updateWorldMatrix(true, false);
    const e = at.clone().applyMatrix4(m1.copy(eye.matrixWorld).invert());
    const r = radius / eye.matrixWorld.getMaxScaleOnAxis();
    const depth = -e.z;
    return depth < 0.03 || Math.abs(e.y) - r > this.view.tanV * depth || Math.abs(e.x) - r > this.view.tanH * depth;
  }

  /** whether each arm's upper arm's cut end was off the gun camera's frame when it was last posed (the e2e soldier section) */
  readonly cutsOff = { r: true, l: true };

  /** the gun camera's frame, as the tangents of its half angles (main.ts vmCamera, set every frame) */
  readonly view = { tanV: Math.tan((38 * Math.PI) / 180), tanH: Math.tan((38 * Math.PI) / 180) * (16 / 9), ads: 0 };

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
