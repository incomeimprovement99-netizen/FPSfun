// The superglide trainer and the mantle boost cue.
//
// A superglide is a jump in the last 0.15 s of a mantle (0.01 s if you did not
// sprint into it) and a crouch exactly one frame later (player.ts). Apex's
// Season 27 made the timed press official ("Mantle Boost") with an optional
// cue on the crosshair (docs/RESEARCH_PHASE_11.md section 12).
//
// The trainer watches every mantle: a bar of the mantle's last 0.3 s with the
// window shaded, where your jump and your crouch landed on it, the frames
// between them, and your last ten tries. The cue is a ring on the crosshair
// while the window is open.
import type { Player } from "./player";
import type { MoveInput } from "./player";

export interface TrainerHud {
  /** the bar: seconds shown, the window, and your presses as seconds before the mantle's end (positive: before) */
  span: number;
  window: number;
  jump: number | null;
  crouch: number | null;
  /** frames from the jump to the crouch */
  frames: number | null;
  /** the verdict, once the mantle is over */
  result: "SUPERGLIDE" | "MISS" | null;
  reason: string;
  /** the last ten tries, oldest first */
  tries: boolean[];
  /** the bar is live (a mantle is on), or showing a finished try */
  live: boolean;
  age: number;
}

const SPAN = 0.3;

export class SuperglideTrainer {
  /** a mantle being watched */
  private cur: { end: number; window: number; jump: number | null; crouch: number | null; jumpFrame: number; crouchFrame: number } | null = null;
  private last: TrainerHud | null = null;
  private lastAt = 0;
  private frame = 0;
  private sawGlide = false;
  private missReason = "";
  tries: boolean[] = [];
  /** the cue is open this frame (a mantle's window) */
  cue = false;

  /** from the tech feed: a superglide landed, or a miss with its reason */
  onTech(name: string, detail: string): void {
    if (name === "SUPERGLIDE") this.sawGlide = true;
    else if (name === "SUPERGLIDE MISS" && !this.missReason) this.missReason = detail;
  }

  update(now: number, player: Player, input: MoveInput): void {
    this.frame++;
    const mi = player.mantleInfo;
    if (mi && !this.cur) {
      this.cur = { end: mi.started + mi.duration, window: mi.window, jump: null, crouch: null, jumpFrame: -1, crouchFrame: -1 };
      this.sawGlide = false;
      this.missReason = "";
    }
    const c = this.cur;
    this.cue = !!mi && mi.remaining <= mi.window + 1e-6;
    if (c) {
      if (input.pressedNow("jump") && c.jump === null) {
        c.jump = c.end - now;
        c.jumpFrame = this.frame;
      }
      if (input.pressedNow("crouch") && c.crouch === null) {
        c.crouch = c.end - now;
        c.crouchFrame = this.frame;
      }
      // the mantle is over (landed, or the superglide ended it): a try if you pressed jump
      if (!mi) {
        if (c.jump !== null || this.sawGlide) {
          const ok = this.sawGlide;
          this.tries.push(ok);
          if (this.tries.length > 10) this.tries.shift();
          this.last = {
            span: SPAN,
            window: c.window,
            jump: c.jump,
            crouch: c.crouch,
            frames: c.jump !== null && c.crouch !== null ? c.crouchFrame - c.jumpFrame : null,
            result: ok ? "SUPERGLIDE" : "MISS",
            reason: ok ? "" : this.missReason || (c.crouch === null ? "no crouch after the jump" : "outside the window"),
            tries: this.tries.slice(),
            live: false,
            age: 0,
          };
          this.lastAt = now;
        }
        this.cur = null;
      }
    }
  }

  hud(now: number): TrainerHud | null {
    const c = this.cur;
    if (c) return { span: SPAN, window: c.window, jump: c.jump, crouch: c.crouch, frames: c.jump !== null && c.crouch !== null ? c.crouchFrame - c.jumpFrame : null, result: null, reason: "", tries: this.tries.slice(), live: true, age: 0 };
    if (this.last && now - this.lastAt < 2.5) return { ...this.last, age: now - this.lastAt };
    return null;
  }
}
