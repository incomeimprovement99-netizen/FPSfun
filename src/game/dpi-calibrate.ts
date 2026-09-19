// Measure the mouse's real DPI by counting raw hardware counts over a known
// physical swipe distance. Pointer lock is requested with unadjustedMovement,
// so counts are pre-acceleration hardware counts and DPI = counts / inches.
//
// This exists because DPI is stored in the mouse's onboard memory, not in any
// file on this machine, so it cannot be read. Measuring is the reliable route.

export interface CalibrationResult {
  dpi: number;
  counts: number;
  inches: number;
}

export type CalibrationFailure =
  | { reason: "too-short"; counts: number }
  | { reason: "no-pointer-lock" }
  | { reason: "aborted" };

export class DpiCalibrator {
  private counts = 0;
  private active = false;
  private held = false;
  private onUpdate: ((counts: number) => void) | null = null;
  private onDone: ((r: CalibrationResult) => void) | null = null;
  private onFail: ((f: CalibrationFailure) => void) | null = null;
  private inches = 0;
  private locked = false;

  constructor(private el: HTMLElement) {
    document.addEventListener("mousemove", (e) => {
      if (!this.active || !this.held) return;
      this.counts += e.movementX;
      this.onUpdate?.(Math.abs(this.counts));
    });
    document.addEventListener("mousedown", (e) => {
      if (!this.active || e.button !== 0) return;
      this.held = true;
      this.counts = 0;
      this.onUpdate?.(0);
    });
    document.addEventListener("mouseup", (e) => {
      if (!this.active || e.button !== 0 || !this.held) return;
      this.held = false;
      this.finish();
    });
    // Escape (or any lock loss) must end the measurement, or the calibrator
    // stays armed invisibly and swallows every later click.
    document.addEventListener("pointerlockchange", () => {
      const nowLocked = document.pointerLockElement === this.el;
      if (this.active && this.locked && !nowLocked) {
        this.active = false;
        this.held = false;
        this.onFail?.({ reason: "aborted" });
      }
      this.locked = nowLocked;
    });
  }

  /** distanceCm: the physical distance the user will swipe */
  async start(
    distanceCm: number,
    onUpdate: (counts: number) => void,
    onDone: (r: CalibrationResult) => void,
    onFail: (f: CalibrationFailure) => void
  ): Promise<void> {
    this.inches = distanceCm / 2.54;
    this.counts = 0;
    this.held = false;
    this.onUpdate = onUpdate;
    this.onDone = onDone;
    this.onFail = onFail;
    const el = this.el as HTMLElement & {
      requestPointerLock: (o?: { unadjustedMovement?: boolean }) => Promise<void> | void;
    };
    // a page a test tool drives never takes the real lock (input.ts says why)
    if (navigator.webdriver === true) {
      this.onFail?.({ reason: "no-pointer-lock" });
      return;
    }
    let ok = true;
    try {
      await el.requestPointerLock({ unadjustedMovement: true });
    } catch {
      try {
        await el.requestPointerLock();
      } catch {
        ok = false;
      }
    }
    // Without pointer lock the browser applies OS acceleration to movementX,
    // so the counts are not hardware counts and the answer would be wrong.
    // Report it rather than measuring something meaningless.
    if (!ok || document.pointerLockElement !== this.el) {
      this.onFail?.({ reason: "no-pointer-lock" });
      return;
    }
    this.locked = true;
    this.active = true;
  }

  cancel(): void {
    this.active = false;
    this.held = false;
    this.locked = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private finish(): void {
    const counts = Math.abs(this.counts);
    this.active = false;
    this.locked = false;
    if (document.pointerLockElement) document.exitPointerLock();
    // A too-short swipe must report, not fall silent: the caller re-enables
    // its UI in these callbacks and would otherwise stay stuck.
    if (counts < 50 || this.inches <= 0) {
      this.onFail?.({ reason: "too-short", counts });
      return;
    }
    this.onDone?.({ dpi: Math.round(counts / this.inches), counts, inches: this.inches });
  }
}

/** Nearest common DPI step, so a measurement of 802 reads as 800. */
export function snapDpi(measured: number): number {
  if (!Number.isFinite(measured) || measured <= 0) return 800;
  const common = [400, 450, 500, 600, 700, 800, 900, 1000, 1200, 1400, 1600, 1800, 2000, 2400, 3200, 4000, 6400];
  let best = common[0];
  let bestErr = Infinity;
  for (const c of common) {
    // normalise by the MEASUREMENT so ties are not biased toward the larger step
    const err = Math.abs(c - measured) / measured;
    if (err < bestErr) {
      bestErr = err;
      best = c;
    }
  }
  // only snap when we are within 4%; otherwise the user has a custom step
  return bestErr <= 0.04 ? best : Math.round(measured);
}
