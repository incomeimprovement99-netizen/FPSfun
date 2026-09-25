// Emotes: a wave, a cheer, a point, a salute, a shrug and a dance, for
// friends between fights.
//
// This is what a group does at a landing, over a death box or on the
// champion screen, and the game had nothing for it. A wheel on the emote key
// (7) picks one; your figure plays it for everyone, and your own view steps
// back to third person to watch it. Moving, jumping or firing ends it early.
//
// The figures' rigs are not the same (the mannequin has an elbow, the robot's
// arm is one piece with its gun), so an emote is described once here as
// angles for a generic body, eased in and out, and each rig reads what it can
// (dummy.ts for the robot, mannequin.ts for the mannequin). Pure, so the
// checks can run it. The list and the timings are in src/config/emotes.json.
import cfg from "../config/emotes.json";

export interface EmoteDef {
  id: string;
  name: string;
  seconds: number;
  /** a recorded clip the figure plays whole, in place of a pose (emotes.json) */
  clip?: string;
}
export const EMOTES: readonly EmoteDef[] = cfg.list;
/** the network's code for "stopped": past the list */
export const EMOTE_STOP = 255;

/**
 * A body's angles for an emote at a moment, radians, figure space, each
 * already multiplied by the blend: 0 is the figure's own pose.
 */
export interface EmotePose {
  /** 0..1: how far in the emote is (eased in, eased out) */
  weight: number;
  /** each arm: raised sideways (0 down, pi overhead), swung forward (0 down, pi/2 straight ahead), the elbow bent across (toward the head) and forward */
  rRaise: number;
  rForward: number;
  rElbow: number;
  rElbowF: number;
  lRaise: number;
  lForward: number;
  lElbow: number;
  lElbowF: number;
  /** the upper body: turned, leant forward (+) or back, leant to its left (+) */
  spineTwist: number;
  spineLean: number;
  spineSide: number;
  /** the head: nodded down (+), tilted to its left (+) */
  headNod: number;
  headTilt: number;
  /** the hips swung round, and the whole body bounced up, metres */
  hipSway: number;
  bounce: number;
  /** an emote made of a recorded clip (a dance, a nod) names it; the figure plays it whole instead of the pose */
  clip?: string;
}

const ZERO: EmotePose = { weight: 0, rRaise: 0, rForward: 0, rElbow: 0, rElbowF: 0, lRaise: 0, lForward: 0, lElbow: 0, lElbowF: 0, spineTwist: 0, spineLean: 0, spineSide: 0, headNod: 0, headTilt: 0, hipSway: 0, bounce: 0 };

const smooth = (x: number) => {
  const c = Math.max(0, Math.min(1, x));
  return c * c * (3 - 2 * c);
};

/** an emote by its index, or null past the list */
export function emoteAt(index: number | null | undefined): EmoteDef | null {
  return index !== null && index !== undefined && index >= 0 && index < EMOTES.length ? EMOTES[index] : null;
}

/** the pose `t` seconds into emote `index` (all zero before it starts and once it is over) */
export function emotePose(index: number, t: number): EmotePose {
  const def = emoteAt(index);
  if (!def || t < 0 || t >= def.seconds) return { ...ZERO };
  const w = smooth(t / cfg.blendIn) * smooth((def.seconds - t) / cfg.blendOut);
  const p: EmotePose = { ...ZERO, weight: w, clip: def.clip };
  const s = Math.sin;
  switch (def.id) {
    case "wave":
      // the right arm up and out, the forearm swinging side to side
      p.rRaise = 2.5;
      p.rElbow = 0.7 + 0.45 * s(t * 9);
      p.headTilt = 0.12;
      break;
    case "cheer":
      // both arms up, a bounce on every beat
      p.rRaise = 2.75;
      p.lRaise = 2.75;
      p.rElbow = 0.25;
      p.lElbow = 0.25;
      p.bounce = 0.06 * Math.abs(s(t * 7));
      p.spineLean = -0.12;
      break;
    case "point":
      // the right arm straight out ahead, the body turned a little into it
      p.rForward = 1.5;
      p.spineTwist = 0.22;
      p.headNod = -0.08;
      break;
    case "salute":
      // the right hand to the brow, standing straight
      p.rRaise = 1.25;
      p.rForward = 0.9;
      p.rElbow = 2.2;
      p.spineLean = -0.05;
      break;
    case "shrug":
      // the upper arms a little out, the forearms forward and open, the head to one side
      p.rRaise = 0.35;
      p.lRaise = 0.35;
      p.rElbowF = 1.35;
      p.lElbowF = 1.35;
      p.rElbow = -0.35;
      p.lElbow = -0.35;
      p.headTilt = 0.22 * s(t * 3);
      p.spineLean = -0.06;
      break;
    case "dance":
      // the hips sway, the arms go up in turn, the body bounces twice a sway
      p.hipSway = 0.42 * s(t * 5.5);
      p.bounce = 0.06 * Math.abs(s(t * 11));
      p.rRaise = 1.1 + 0.9 * s(t * 5.5);
      p.lRaise = 1.1 - 0.9 * s(t * 5.5);
      p.rElbow = 1.1;
      p.lElbow = 1.1;
      p.spineSide = 0.16 * s(t * 5.5);
      p.headTilt = 0.18 * s(t * 5.5 + 1);
      break;
  }
  // everything eased in and out together
  for (const k of Object.keys(p) as Array<keyof EmotePose>) if (k !== "weight" && k !== "clip") (p[k] as number) *= w;
  return p;
}
