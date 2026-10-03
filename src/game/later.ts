// What the page's first screen does not wait for (the owner, 2026-10-03: "Make the initial loading screen as fast as
// possible, the rest can load in when we need it").
//
// The first screen waited for 29 MB at a typical 50 Mbit/s, 11.5 s: every bought gun, the range's props, the arenas'
// textures and the first-person arms' detail maps among it, none of which the range's first frame shows. What is
// queued here runs once that screen has gone (main.ts calls firstScreenDone), a step a frame so their work does not
// land in one, and the test hook's loaded() waits for it all (laterSettled), so a tool still sees the page whole.
//
// Not for what a frame cannot be drawn without: the range's own floor, the sky, the gun in your hands and the arms.

type Job = () => Promise<unknown> | unknown;

const queue: Job[] = [];
let open = false;
let running = 0;

/** run `job` once the page's first screen has gone (now, if it has) */
export function later(job: Job): void {
  if (open) start(job);
  else queue.push(job);
}

function start(job: Job): void {
  running++;
  let out: unknown;
  try {
    out = job();
  } catch (e) {
    console.warn("a load after the first screen failed", e);
  }
  void Promise.resolve(out)
    .catch((e) => console.warn("a load after the first screen failed", e))
    .finally(() => running--);
}

/** the first screen has gone: what waited for it starts, one a frame */
export function firstScreenDone(): void {
  if (open) return;
  open = true;
  const step = (): void => {
    const job = queue.shift();
    if (!job) return;
    start(job);
    if (queue.length) requestAnimationFrame(step);
  };
  step();
}

/** everything queued here has started and come in (the test hook's loaded(): a tool sees the page whole) */
export function laterSettled(): boolean {
  return open && queue.length === 0 && running === 0;
}
