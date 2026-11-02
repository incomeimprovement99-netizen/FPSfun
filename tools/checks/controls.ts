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
const pad = { id: "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e)", index: 0, connected: true, mapping: "standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
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

// (Milestone 1001) the smaller things from the settings review
console.log("\nThe Controls tab's smaller things (src/ui/binds.ts)");
{
  const { bindName, setKeyboardLayout, cancelBindCapture } = await import("../../src/ui/binds");
  setKeyboardLayout(new Map([["KeyW", "z"], ["KeyQ", "a"], ["Digit1", "&"], ["Semicolon", "m"]]));
  const named = ["KeyW", "KeyQ", "Digit1", "Semicolon", "ShiftLeft", "KeyE"].map(bindName);
  setKeyboardLayout(null);
  // (the digits stay digits: AZERTY's unshifted "&" and "É" are printed beside the 1 and 2 a player looks for, Milestone 1006)
  check("an AZERTY keyboard's keys go by its own marks (the key bound as W is Z), its digits and the rest as before", named.join(" ") === "Z A 1 M Shift E", named.join(" "));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const fire = (t: string, e: Record<string, unknown>) => (docListeners[t] ?? []).slice().forEach((f) => f({ preventDefault() {}, stopPropagation() {}, ...e }));
  const root = new El();
  const note = new El();
  setBinds({});
  store.clear();
  initBindsUi(root as unknown as HTMLElement, note as unknown as HTMLElement, new El() as unknown as HTMLElement);
  const chips = (a: string) => (root.all().find((r) => r.dataset.action === a)?.all() ?? []).filter((e) => e.className === "bindKey" || e.className === "bindKey add");
  // Backspace on the "+" after a key: nothing removed, and not told it was
  const add = chips("melee").find((e) => e.className.includes("add"))!;
  const before = JSON.stringify(DEFAULT_BINDS.melee);
  add.listeners.click[0]();
  await tick();
  fire("keydown", { code: "Backspace" });
  check("Backspace on the + says nothing was removed, and nothing is", !/^Removed/.test(note.textContent) && JSON.stringify(chips("melee").filter((e) => !e.className.includes("add")).map((e) => e.textContent)) === JSON.stringify(JSON.parse(before).map(bindName)), note.textContent);
  // A on a chip by a controller: the wait it armed is let go, and the key is still bound
  const fireChip = chips("fire")[0];
  fireChip.listeners.click[0]();
  await tick();
  const waiting = !!(docListeners.keydown ?? []).length;
  const let1 = cancelBindCapture();
  const let2 = cancelBindCapture();
  // (and that press is spent: the menu reads the buttons by index, and B took it back to the start screen, Milestone 1006)
  const gp = new GamepadInput();
  gp.rawPressed.add(1);
  gp.swallow();
  check("a press that lets go of a key chip reaches nothing else, the menu's buttons included", gp.rawPressed.size === 0);
  check("a key chip waiting for a key is let go by a controller's button, its key kept", waiting && let1 && !let2 && !(docListeners.keydown ?? []).length && chips("fire")[0].textContent === bindName(DEFAULT_BINDS.fire[0]), JSON.stringify({ waiting, let1, let2 }));
  // the controller's own tab says what changed on it, where the keys' note is on another tab
  const padRoot = new El();
  initBindsUi(new El() as unknown as HTMLElement, new El() as unknown as HTMLElement, padRoot as unknown as HTMLElement);
  const preset = padRoot.all().find((e) => e.id === "padPreset")!;
  preset.value = "bumperJumper";
  preset.listeners.change[0]();
  const said = padRoot.all().find((e) => e.className === "hintLine")?.textContent ?? "";
  check("a controller preset is said on the controller's own tab", /The controller is on/.test(said), said);
  setPadButtons({});
  setBinds({});
}

console.log(fails === 0 ? "\nCONTROLS PASS" : `\nCONTROLS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
