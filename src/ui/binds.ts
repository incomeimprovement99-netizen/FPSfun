// The Controls tab: every action with its keys, and a click to change one.
// Click a key, then press the new key, mouse button or scroll direction (Esc
// cancels, Backspace removes it). A key another action was using moves over,
// and the tab says so. The changes live in this browser (localStorage) on top
// of src/config/binds.json, which stays the default.
import { DEFAULT_BINDS, currentBinds, setBinds, type Action } from "../game/input";
import { DEFAULT_PAD_BUTTONS, PAD_BUTTON_NAMES, PAD_HOLDS, PAD_PRESETS, padButtons, setPadButtons, type PadPreset } from "../game/gamepad";

const PAD_KEY = "range.padbinds.v1";
/** the controller's changes: a button's index to an action, or "none" */
type PadChanges = Partial<Record<number, Action | "none">>;

function loadPad(): PadChanges {
  try {
    const raw = JSON.parse(localStorage.getItem(PAD_KEY) ?? "{}") as Record<string, unknown>;
    const out: PadChanges = {};
    for (const [k, v] of Object.entries(raw)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i > 15 || i === 9) continue;
      if (v === "none" || (typeof v === "string" && v in DEFAULT_BINDS)) out[i] = v as Action | "none";
    }
    return out;
  } catch {
    return {};
  }
}

const KEY = "range.binds.v1";
/** at most this many keys per action */
const MAX_PER_ACTION = 3;

const GROUPS: ReadonlyArray<{ title: string; actions: ReadonlyArray<[Action, string]> }> = [
  {
    title: "Movement",
    actions: [
      ["forward", "Forward"],
      ["back", "Back"],
      ["left", "Left"],
      ["right", "Right"],
      ["jump", "Jump"],
      ["crouch", "Crouch, slide"],
      ["sprint", "Sprint"],
      ["interact", "Interact: a zipline, an item (hold: a revive, a beacon, skip a tour step)"],
      ["chat", "Quick chat: then 1 to 6 sends a line to everyone in the match"],
    ],
  },
  {
    title: "Weapons",
    actions: [
      ["fire", "Fire"],
      ["ads", "Aim down sights"],
      ["reload", "Reload"],
      ["swapWeapon", "Swap weapon"],
      ["slot1", "Weapon 1"],
      ["slot2", "Weapon 2"],
      ["holster", "Holster (15% faster)"],
      ["inspect", "Inspect the gun (also: hold reload with a full magazine)"],
      ["melee", "Melee"],
      ["zoomToggle", "Variable optic zoom"],
      ["fireMode", "Fire mode (where the gun has two)"],
      ["heal", "Heal (a cell, then a syringe)"],
      ["grenade", "Ready a grenade (again: the next kind; fire throws, aim puts it away)"],
    ],
  },
  {
    title: "Abilities",
    actions: [
      ["ability", "Use your ability (JOLT)"],
      ["pickAbility1", "Pick JOLT (when offered)"],
      ["pickAbility2", "Pick TRIAGE (when offered)"],
    ],
  },
  {
    title: "Attachments",
    actions: [
      ["magLevel", "Magazine level"],
      ["optic", "Optic"],
      ["barrel", "Barrel"],
      ["stock", "Stock"],
      ["laser", "Laser"],
      ["hopup", "Hop-up"],
    ],
  },
  {
    title: "Camera",
    actions: [
      ["thirdPerson", "Third person on / off"],
      ["orbit", "Look round your character (hold)"],
      ["map", "The full map"],
      ["ping", "Ping (enemy, item, place) for the squad"],
    ],
  },
  {
    title: "The range",
    actions: [
      ["cycleArmor", "Dummy armour"],
      ["dummyMode", "Dummies: stand, strafe, crouch, random"],
      ["resetDummies", "Reset dummies and the course"],
      ["ghost", "Ghost of your best run"],
      ["copyResult", "Copy your course result"],
    ],
  },
];

/** a binding as a person would say it */
export function bindName(b: string): string {
  const named: Record<string, string> = {
    mouse0: "Left click",
    mouse1: "Middle click",
    mouse2: "Right click",
    mouse3: "Mouse 4",
    mouse4: "Mouse 5",
    wheelup: "Scroll up",
    wheeldown: "Scroll down",
    ShiftLeft: "Shift",
    ShiftRight: "Right Shift",
    ControlLeft: "Ctrl",
    ControlRight: "Right Ctrl",
    AltLeft: "Alt",
    AltRight: "Right Alt",
    Space: "Space",
    CapsLock: "Caps Lock",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    Backslash: "\\",
  };
  if (named[b]) return named[b];
  const m = /^(?:Key|Digit)(.+)$/.exec(b) ?? /^Arrow(.+)$/.exec(b);
  if (m) return m[1];
  const np = /^Numpad(.+)$/.exec(b);
  if (np) return `Num ${np[1]}`;
  return b;
}

/** the saved changes, checked: unknown actions and odd values are dropped */
function load(): Partial<Record<Action, string[]>> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, unknown>;
    const out: Partial<Record<Action, string[]>> = {};
    for (const [a, v] of Object.entries(raw)) {
      if (!(a in DEFAULT_BINDS) || !Array.isArray(v)) continue;
      out[a as Action] = v.filter((b): b is string => typeof b === "string" && /^[A-Za-z0-9]{1,24}$/.test(b) && b !== "Escape").slice(0, MAX_PER_ACTION);
    }
    return out;
  } catch {
    return {};
  }
}

function save(changes: Partial<Record<Action, string[]>>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(changes));
  } catch {
    /* ignore */
  }
}

/**
 * A player's saved keys against today's defaults: a key they gave to one
 * action is taken off any action still on its default (a default can move to
 * a key a player had already used: G was the magazine level and is now the
 * grenade, and someone who had put melee on G got both).
 */
export function withoutClashes(changes: Partial<Record<Action, string[]>>): Partial<Record<Action, string[]>> {
  const taken = new Set(Object.values(changes).flat());
  const out: Partial<Record<Action, string[]>> = { ...changes };
  for (const a of Object.keys(DEFAULT_BINDS) as Action[]) {
    if (a in changes) continue;
    const kept = DEFAULT_BINDS[a].filter((k) => !taken.has(k));
    if (kept.length !== DEFAULT_BINDS[a].length) out[a] = kept;
  }
  return out;
}

/** put the saved bindings on; call once at startup, before the first frame */
export function applySavedBinds(): void {
  setBinds(withoutClashes(load()));
  setPadButtons(loadPad());
}

/** build the Controls tab's table into `root` and keep it live */
export function initBindsUi(root: HTMLElement, note: HTMLElement): void {
  let changes = withoutClashes(load());
  /** the chip waiting for a key, and how to stop waiting */
  let capturing: { stop: () => void } | null = null;

  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  const commit = (next: Record<Action, string[]>) => {
    // only what differs from the default is kept, so a later default change still reaches this player
    changes = {};
    for (const a of Object.keys(DEFAULT_BINDS) as Action[]) if (!same(next[a], DEFAULT_BINDS[a])) changes[a] = next[a];
    save(changes);
    setBinds(changes);
    render();
  };
  const copy = (): Record<Action, string[]> => {
    const b = currentBinds();
    return Object.fromEntries((Object.keys(b) as Action[]).map((a) => [a, [...b[a]]])) as Record<Action, string[]>;
  };

  /** wait for the next key, button or scroll; then set it at `index` of `action` (index = length adds one) */
  const capture = (action: Action, index: number, chip: HTMLElement) => {
    capturing?.stop();
    chip.classList.add("waiting");
    chip.textContent = "press a key";
    note.textContent = "Press a key, a mouse button or scroll. Esc cancels, Backspace removes this one.";
    const finish = (bind: string | null, remove = false) => {
      stop();
      const next = copy();
      const list = next[action];
      if (remove) {
        if (index < list.length) list.splice(index, 1);
        note.textContent = `Removed from ${labelOf(action)}.`;
        return commit(next);
      }
      if (!bind) return render();
      // the key moves over from whatever had it
      let from: Action | null = null;
      for (const a of Object.keys(next) as Action[]) {
        if (a === action) continue;
        const i = next[a].indexOf(bind);
        if (i >= 0) {
          next[a].splice(i, 1);
          from = a;
        }
      }
      if (index < list.length) list[index] = bind;
      else if (!list.includes(bind)) list.push(bind);
      next[action] = [...new Set(list)].slice(0, MAX_PER_ACTION);
      note.textContent = from
        ? `${bindName(bind)} is now ${labelOf(action)}. It was ${labelOf(from)}${next[from].length ? "" : ", which has no key now"}.`
        : `${bindName(bind)} is now ${labelOf(action)}.`;
      commit(next);
    };
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") return finish(null);
      if (e.code === "Backspace") return finish(null, true);
      finish(e.code);
    };
    const onMouse = (e: MouseEvent) => {
      if (e.button > 4) return;
      e.preventDefault();
      e.stopPropagation();
      finish(`mouse${e.button}`);
    };
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      finish(e.deltaY < 0 ? "wheelup" : "wheeldown");
    };
    const block = (e: Event) => e.preventDefault();
    const stop = () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onMouse, true);
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("contextmenu", block, true);
      capturing = null;
    };
    capturing = { stop };
    // the click that started this is still being handled: listen from the next event on
    setTimeout(() => {
      if (capturing?.stop !== stop) return;
      document.addEventListener("keydown", onKey, true);
      document.addEventListener("mousedown", onMouse, true);
      document.addEventListener("wheel", onWheel, { capture: true, passive: false });
      document.addEventListener("contextmenu", block, true);
    }, 0);
  };

  const labelOf = (a: Action) => GROUPS.flatMap((g) => g.actions).find(([x]) => x === a)?.[1] ?? a;

  const render = () => {
    const b = currentBinds();
    root.innerHTML = "";
    for (const g of GROUPS) {
      const h = document.createElement("div");
      h.className = "bindGroup";
      h.textContent = g.title;
      root.appendChild(h);
      for (const [action, label] of g.actions) {
        const row = document.createElement("div");
        row.className = "bindRow";
        const name = document.createElement("span");
        name.className = "bindName";
        name.textContent = label;
        row.appendChild(name);
        const keys = document.createElement("span");
        keys.className = "bindKeys";
        const list = b[action] ?? [];
        list.forEach((k, i) => {
          const chip = document.createElement("button");
          chip.type = "button";
          chip.className = "bindKey";
          chip.textContent = bindName(k);
          chip.title = "Click, then press the new key";
          chip.addEventListener("click", () => capture(action, i, chip));
          keys.appendChild(chip);
        });
        if (list.length < MAX_PER_ACTION) {
          const add = document.createElement("button");
          add.type = "button";
          add.className = "bindKey add";
          add.textContent = list.length ? "+" : "none: click to set";
          add.title = "Add another key";
          add.addEventListener("click", () => capture(action, list.length, add));
          keys.appendChild(add);
        }
        row.appendChild(keys);
        root.appendChild(row);
      }
    }
    renderPad();
  };

  /** the controller: a row per button, a list of what it can do; Start is always the menu */
  const renderPad = () => {
    let pad = loadPad();
    const h = document.createElement("div");
    h.className = "bindGroup";
    h.textContent = "Controller buttons";
    root.appendChild(h);
    const hint = document.createElement("div");
    hint.className = "bindRow";
    hint.innerHTML = `<span class="bindName" style="color:#7d8895">The game's Default layout. The sticks move and look. Start is always the menu, so it cannot be moved. X also rides ziplines and takes items where there is a prompt. Held: ${Object.entries(PAD_HOLDS)
      .map(([a, h]) => `${labelOf(a as Action).split(" (")[0].toLowerCase()} → ${labelOf(h as Action).split(" (")[0].toLowerCase()}`)
      .join("; ")}. Twice on ping: an enemy there. While the ability card is up, D-pad left and right pick.</span>`;
    root.appendChild(hint);
    // the game's presets: a layout in one go
    const presetRow = document.createElement("div");
    presetRow.className = "bindRow";
    presetRow.innerHTML = `<span class="bindName">Preset</span>`;
    const presetSel = document.createElement("select");
    presetSel.id = "padPreset";
    presetSel.className = "padBind";
    presetSel.innerHTML = `<option value="">Custom</option>` + (Object.keys(PAD_PRESETS) as PadPreset[]).map((k) => `<option value="${k}">${PAD_PRESETS[k].name}</option>`).join("");
    const matching = (Object.keys(PAD_PRESETS) as PadPreset[]).find((k) => {
      const want: Record<number, string> = { ...DEFAULT_PAD_BUTTONS, ...PAD_PRESETS[k].changes } as Record<number, string>;
      const live = padButtons() as Record<number, string>;
      return PAD_BUTTON_NAMES.every((_, i) => (want[i] ?? "none") === (live[i] ?? "none"));
    });
    presetSel.value = matching ?? "";
    presetSel.addEventListener("change", () => {
      const k = presetSel.value as PadPreset | "";
      if (!k) return;
      pad = { ...PAD_PRESETS[k].changes };
      try {
        if (Object.keys(pad).length) localStorage.setItem(PAD_KEY, JSON.stringify(pad));
        else localStorage.removeItem(PAD_KEY);
      } catch {
        /* ignore */
      }
      setPadButtons(pad);
      note.textContent = `The controller is on ${PAD_PRESETS[k].name}.`;
      render();
    });
    presetRow.appendChild(presetSel);
    root.appendChild(presetRow);
    const actions = GROUPS.flatMap((g) => g.actions);
    const live = padButtons();
    PAD_BUTTON_NAMES.forEach((name, i) => {
      const row = document.createElement("div");
      row.className = "bindRow";
      const lab = document.createElement("span");
      lab.className = "bindName";
      lab.textContent = name;
      row.appendChild(lab);
      if (i === 9) {
        const fixed = document.createElement("span");
        fixed.className = "bindKeys";
        fixed.textContent = "Menu";
        row.appendChild(fixed);
        root.appendChild(row);
        return;
      }
      const sel = document.createElement("select");
      sel.className = "padBind";
      sel.dataset.button = String(i);
      sel.innerHTML = `<option value="none">Nothing</option>` + actions.map(([a, l]) => `<option value="${a}">${l}</option>`).join("");
      sel.value = (live[i] as string | undefined) ?? "none";
      sel.addEventListener("change", () => {
        const def = (DEFAULT_PAD_BUTTONS[i] as string | undefined) ?? "none";
        if (sel.value === def) delete pad[i];
        else pad[i] = sel.value as Action | "none";
        try {
          localStorage.setItem(PAD_KEY, JSON.stringify(pad));
        } catch {
          /* ignore */
        }
        setPadButtons(pad);
        note.textContent = `${name} is now ${sel.value === "none" ? "nothing" : labelOf(sel.value as Action)}.`;
      });
      row.appendChild(sel);
      root.appendChild(row);
    });
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "bindKey";
    reset.textContent = "Controller back to the default";
    reset.addEventListener("click", () => {
      pad = {};
      try {
        localStorage.removeItem(PAD_KEY);
      } catch {
        /* ignore */
      }
      setPadButtons(pad);
      note.textContent = "The controller's buttons are back to the default.";
      render();
    });
    root.appendChild(reset);
  };

  document.getElementById("bindsReset")?.addEventListener("click", () => {
    capturing?.stop();
    note.textContent = "Every key is back to the default.";
    commit(Object.fromEntries((Object.keys(DEFAULT_BINDS) as Action[]).map((a) => [a, [...DEFAULT_BINDS[a]]])) as Record<Action, string[]>);
  });
  render();
}
