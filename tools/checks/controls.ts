// The player's controls, proven on the real modules (Milestones 901 to 908, from a review of the settings and controls):
// the Controls tab on a small stand-in for the page, the controller's poll on a stand-in pad, the DPI measure on a
// stand-in pointer lock.
//   - every bound action has a row in the Controls tab: the carry card's had none, so a key put on another action took
//     its only one, Tab, for good;
//   - the controller's changes stay in the tab with the site data refused: a button changed after a preset put every
//     other button back to the default;
//   - the pad's ADS level comes in with the sights, not whole on the first aimed frame;
//   - the left stick crossing auto sprint's line is told apart from a sprint button (main.ts sprintPressed);
//   - the DPI measure waits for a pointer lock granted after its request returns, as where the request gives no promise;
//   - fullscreen's Keyboard Lock leaves Escape and Tab out, so Alt+Tab is the system's.
//
// It sets the page's globals for itself, so it runs in a process of its own: npx tsx tools/checks/controls.ts (verify
// runs it that way).

// (a module whose imports wait for the stand-ins below: a static import would read the page's globals before they are set)
export {};

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

// ---------- a stand-in page ----------
const store = new Map<string, string>();
let refuseStorage = false;
const guard = <T>(f: () => T): T => {
  if (refuseStorage) throw new Error("SecurityError: the site's data is refused");
  return f();
};
const g = globalThis as Record<string, unknown>;
g.localStorage = {
  getItem: (k: string) => guard(() => store.get(k) ?? null),
  setItem: (k: string, v: string) => guard(() => void store.set(k, v)),
  removeItem: (k: string) => guard(() => void store.delete(k)),
};
const timers = { set: setTimeout, clear: clearTimeout };
g.window = { addEventListener() {}, setTimeout: timers.set, clearTimeout: timers.clear };
const docListeners: Record<string, Array<(e: unknown) => void>> = {};
class El {
  children: El[] = [];
  listeners: Record<string, Array<(e?: unknown) => void>> = {};
  textContent = "";
  className = "";
  title = "";
  type = "";
  id = "";
  value = "";
  hidden = false;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  classList = { add() {}, remove() {}, toggle() {} };
  set innerHTML(_v: string) {
    this.children = [];
  }
  get innerHTML(): string {
    return "";
  }
  appendChild(c: El): El {
    this.children.push(c);
    return c;
  }
  addEventListener(t: string, f: (e?: unknown) => void): void {
    (this.listeners[t] ??= []).push(f);
  }
  all(): El[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
}
const doc = {
  pointerLockElement: null as unknown,
  exitPointerLock: () => void (doc.pointerLockElement = null),
  createElement: () => new El(),
  getElementById: () => null,
  addEventListener: (t: string, f: (e: unknown) => void) => void (docListeners[t] ??= []).push(f),
  removeEventListener: (t: string, f: (e: unknown) => void) => void (docListeners[t] = (docListeners[t] ?? []).filter((x) => x !== f)),
};
g.document = doc;
const pad = { id: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)", index: 0, connected: true, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
Object.defineProperty(globalThis.navigator, "getGamepads", { value: () => [pad], configurable: true });

const { initBindsUi } = await import("../../src/ui/binds");
const { DEFAULT_BINDS, keyboardLockKeys, setBinds } = await import("../../src/game/input");
const { GamepadInput, DEFAULT_PAD_BUTTONS, padButtons, setPadButtons } = await import("../../src/game/gamepad");
const { DpiCalibrator } = await import("../../src/game/dpi-calibrate");

console.log("The Controls tab (src/ui/binds.ts)");
{
  const root = new El();
  initBindsUi(root as unknown as HTMLElement, new El() as unknown as HTMLElement, new El() as unknown as HTMLElement);
  const rows = new Set(root.all().filter((e) => e.className === "bindRow").map((e) => e.dataset.action));
  const missing = Object.keys(DEFAULT_BINDS).filter((a) => !rows.has(a));
  check("every bound action has a row in the Controls tab, so a key taken from one can be given back", missing.length === 0, missing.length ? `no row: ${missing.join(", ")}` : `${rows.size} rows`);
}
{
  // the site's data refused: a preset, then one button changed; the preset's other buttons stay
  refuseStorage = true;
  setPadButtons({});
  const padRoot = new El();
  initBindsUi(new El() as unknown as HTMLElement, new El() as unknown as HTMLElement, padRoot as unknown as HTMLElement);
  const preset = padRoot.all().find((e) => e.id === "padPreset")!;
  preset.value = "bumperJumper";
  preset.listeners.change[0]();
  const after = { ...padButtons() };
  const x = padRoot.all().find((e) => e.dataset.button === "2")!;
  x.value = "melee";
  x.listeners.change[0]();
  const now = padButtons();
  const kept = Object.keys(after).every((i) => Number(i) === 2 || now[Number(i)] === after[Number(i)]);
  check(
    "with the site's data refused, a button changed after a preset keeps the preset's other buttons",
    after[0] !== DEFAULT_PAD_BUTTONS[0] && kept && now[2] === "melee",
    JSON.stringify({ presetA: after[0], nowA: now[0], defaultA: DEFAULT_PAD_BUTTONS[0], x: now[2] }),
  );
  refuseStorage = false;
  setPadButtons({});
  setBinds({});
}

console.log("\nThe controller's poll (src/game/gamepad.ts)");
{
  // the right stick full right, the sights coming up: the look's speed as adsFrac goes from 0 to a hair over it, at the
  // ADS levels 1 and 8. The zoom's ratio (main.ts padAdsScale) is made with adsFrac too; here 0.6 when fully aimed
  const p = new GamepadInput();
  pad.axes = [0, 0, 1, 0];
  const dt = 1 / 60;
  let t = 10;
  const speed = (adsFrac: number) => -p.poll((t += dt), dt, 1 + (0.6 - 1) * adsFrac, adsFrac, 1).yawLeft / dt;
  const jumps: Record<string, number> = {};
  for (const level of [1, 8]) {
    p.settings.ads = level;
    jumps[`level ${level}`] = Math.abs(speed(0.001) / speed(0) - 1);
  }
  check("the pad's ADS level comes in with the sights: a hair into the aim the look's speed is within 1% of the hip's, at levels 1 and 8", Object.values(jumps).every((j) => j < 0.01), JSON.stringify(Object.fromEntries(Object.entries(jumps).map(([k, v]) => [k, `${(v * 100).toFixed(1)}%`]))));
  p.settings.ads = 3;
  pad.axes = [0, 0, 0, 0];
}
{
  const p = new GamepadInput();
  p.settings.autoSprint = true;
  let t = 20;
  const step = () => p.poll((t += 1 / 60), 1 / 60, 1);
  pad.axes = [0, -0.7, 0, 0];
  step();
  pad.axes = [0, -0.95, 0, 0];
  step();
  const stick = { pressed: p.pressedNow("sprint"), stick: p.stickSprint };
  step();
  pad.axes = [0, 0, 0, 0];
  step();
  // the sprint button's own press (the Default layout's left stick click)
  const button = Object.entries(DEFAULT_PAD_BUTTONS).find(([, a]) => a === "sprint")?.[0];
  if (button !== undefined) pad.buttons[Number(button)].pressed = true;
  step();
  const pressed = { pressed: p.pressedNow("sprint"), stick: p.stickSprint };
  if (button !== undefined) pad.buttons[Number(button)].pressed = false;
  step();
  check("the left stick crossing auto sprint's line is a sprint press of the stick's own, and the sprint button's is not", stick.pressed && stick.stick && button !== undefined && pressed.pressed && !pressed.stick, JSON.stringify({ stick, button: pressed }));
}

console.log("\nThe DPI measure (src/game/dpi-calibrate.ts)");
{
  // a request that gives no promise, the lock granted 20 ms later, as a browser whose request returns nothing grants it
  const el = {
    requestPointerLock: () => {
      setTimeout(() => {
        doc.pointerLockElement = el;
        for (const f of [...(docListeners.pointerlockchange ?? [])]) f({});
      }, 20);
      return undefined;
    },
  };
  const cal = new DpiCalibrator(el as unknown as HTMLElement);
  let failed: string | null = null;
  await cal.start(10, () => undefined, () => undefined, (f) => (failed = f.reason));
  const on = (cal as unknown as { active: boolean }).active;
  check("a pointer lock granted after the request returns (no promise) is waited for, and the measure is on", on && failed === null, JSON.stringify({ active: on, failed }));
  cal.cancel();
  doc.pointerLockElement = null;
}

console.log("\nFullscreen's Keyboard Lock (src/game/input.ts)");
{
  const keys = keyboardLockKeys();
  check("it takes the bound keys but Escape and Tab, so Alt+Tab is still the system's", keys.length > 10 && !keys.includes("Escape") && !keys.includes("Tab") && keys.includes("KeyW"), `${keys.length} keys`);
}

console.log(fails === 0 ? "\nCONTROLS PASS" : `\nCONTROLS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
