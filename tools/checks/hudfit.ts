// The HUD's panels where they can be read, and saying what is so (Milestones 927 and 928, from a review of the HUD and
// the loot screens), drawn by the real HUD onto a stand-in canvas that keeps where each line goes, at 1366 x 768 and
// 1920 x 1080, HUD scales 1 to 1.4:
//   - the loot card ends above the prompt (what E does) and keeps off the minimap, where at 1.25 it sat over the prompt;
//   - the kill feed stops above the ammo count and the gun slots, where at 1.25 and 1.4 it ran down over them;
//   - a prompt with no key (a ghost's line) has no empty key cap;
//   - the carry card says the reserve as the bottom panel does, and a cooldown to a tenth;
//   - the loot card says a gun put down comes with the rounds it had, and sets a gun that overheats only against
//     another, its magazine and reload rows only against guns that reload.
//
// It sets the page's globals for itself, so it runs in a process of its own: npx tsx tools/checks/hudfit.ts (verify runs
// it that way).

// (a module whose imports wait for the stand-ins below: a static import would read the page's globals before they are set)
export {};

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const g = globalThis as Record<string, unknown>;
g.window = g;
g.devicePixelRatio = 1;
g.addEventListener = () => undefined;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: () => undefined };
g.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener: () => undefined, documentElement: { style: {} } };
g.Image = class {
  src = "";
};
g.location = { search: "", href: "http://hudfit.test/" };

const ops: Array<{ tag: string; y: number; h?: number; x?: number; w?: number; text?: string }> = [];
let tag = "";
let font = 10;
const ctx = new Proxy(
  {},
  {
    get(_t, p) {
      if (p === "measureText") return (s: string) => ({ width: s.length * font * 0.52 });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "fillText") return (t: string, x: number, y: number) => ops.push({ tag, y, x, text: t });
      if (p === "fillRect") return (x: number, y: number, w: number, h: number) => ops.push({ tag, y, h, x, w });
      return () => undefined;
    },
    set(_t, p, v) {
      if (p === "font" && typeof v === "string") font = Number(/(\d+(?:\.\d+)?)px/.exec(v)?.[1] ?? 10);
      return true;
    },
  },
);
const { Hud } = await import("../../src/game/hud");
const { setHudScale } = await import("../../src/game/palette");
const { lootCardView } = await import("../../src/game/lootcard");
type H = Record<string, unknown> & {
  w: number;
  h: number;
  boxes: Record<string, { x: number; y: number; w: number; h: number }>;
  resize(w: number, h: number): void;
  drawLootCard(s: unknown, u: number): void;
  drawPrompt(s: unknown, u: number): void;
  drawFeed(now: number, u: number): void;
  feed(text: string, now: number): void;
  drawInventory?(s: unknown, u: number): void;
};
const make = (W: number, Hh: number): H => {
  g.innerWidth = W;
  g.innerHeight = Hh;
  const hud = new Hud({ getContext: () => ctx, style: {}, width: W, height: Hh } as unknown as HTMLCanvasElement) as unknown as H;
  (hud as unknown as { w: number }).w = W;
  (hud as unknown as { h: number }).h = Hh;
  return hud;
};
const span = (t: string) => {
  const ys = ops.filter((o) => o.tag === t).flatMap((o) => (o.h ? [o.y, o.y + o.h] : [o.y]));
  return { top: Math.min(...ys), bottom: Math.max(...ys) };
};

console.log("The loot card and the prompt (src/game/hud.ts)");
{
  // the tallest card: a gun to swap for, the full card, its notes
  const card = lootCardView({ kind: "weapon", id: "mastiff", n: 1, rarity: "epic", fusion: 2 }, { slots: [{ id: "r97", empty: false, fusion: 0, clip: 20 }, { id: "sentinel", empty: false, fusion: 0, clip: 4 }], active: 0, held: {} }, "full");
  const fits: string[] = [];
  for (const [W, Hh] of [[1366, 768], [1920, 1080]]) {
    for (const scale of [1, 1.25, 1.4]) {
      setHudScale(scale);
      const hud = make(W, Hh);
      const u = (Hh / 1080) * scale;
      ops.length = 0;
      tag = "card";
      hud.drawLootCard({ lootCard: card }, u);
      tag = "prompt";
      hud.drawPrompt({ prompt: { key: "E", text: "TAKE BIGANTLER (HEAVY SHOTGUN)  ·  HOLD: TAKE ALL" } }, u);
      const c = span("card");
      const p = span("prompt");
      if (!(c.bottom <= p.top)) fits.push(`${W}x${Hh} at ${scale}: card to ${Math.round(c.bottom)}, prompt from ${Math.round(p.top)}`);
    }
  }
  setHudScale(1);
  check("the full loot card ends above the prompt at 1366x768 and 1920x1080, HUD scales 1 to 1.4", fits.length === 0, fits.join("; ") || "all clear");
}
{
  const hud = make(1920, 1080);
  ops.length = 0;
  tag = "ghost";
  hud.drawPrompt({ prompt: { key: "", text: "GHOST  ·  STAY WITH YOUR SQUAD" } }, 1);
  const empty = ops.filter((o) => o.tag === "ghost" && o.text === "").length;
  check("a prompt with no key (a ghost's line) draws no empty key cap", empty === 0, `${empty} empty caps`);
}

console.log("\nThe kill feed (src/game/hud.ts)");
{
  const over: string[] = [];
  for (const [W, Hh] of [[1366, 768], [1920, 1080], [2560, 1440]]) {
    for (const scale of [1, 1.25, 1.4]) {
      const hud = make(W, Hh);
      const u = (Hh / 1080) * scale;
      // the bottom right's panels as the weapons draw puts them, and the keys panel's bottom a third down
      hud.boxes.ammo = { x: W - 260 * u, y: Hh - 96 * u, w: 200 * u, h: 70 * u };
      hud.boxes.slot0 = { x: W - 300 * u, y: Hh - 150 * u, w: 120 * u, h: 40 * u };
      (hud as unknown as { hintsBottom: number }).hintsBottom = Hh * 0.62;
      for (let i = 0; i < 6; i++) hud.feed(`BOT ${i} eliminated BOT ${i + 10}`, 10);
      ops.length = 0;
      tag = "feed";
      hud.drawFeed(10.5, u);
      const f = span("feed");
      const floor = Hh - 150 * u;
      const lines = ops.filter((o) => o.tag === "feed" && o.text).length;
      if (lines && f.bottom > floor) over.push(`${W}x${Hh} at ${scale}: feed to ${Math.round(f.bottom)}, panels from ${Math.round(floor)}`);
    }
  }
  check("the kill feed stops above the ammo count and the gun slots at every size and HUD scale", over.length === 0, over.join("; ") || "all clear");
}

console.log("\nThe carry card and the loot card (src/game/hud.ts, src/game/lootcard.ts)");
{
  const hud = make(1920, 1080);
  ops.length = 0;
  tag = "carry";
  const inv = {
    guns: [{ id: "r97", name: "USSO", kind: "smg", clip: 20, size: 27, reserve: 40, inHand: true, level: 0, max: 5, perks: [] }, { id: null, name: "EMPTY", kind: null, clip: 0, size: 0, reserve: 0, inHand: false, level: 0, max: 5, perks: [] }],
    hacks: [{ id: "dash", name: "DASH", slot: "mobility", key: "F", level: 1, max: 5, left: 0, cooldown: 12.6, blurb: "" }, null],
    vitals: null,
  };
  const draw = (hud as unknown as Record<string, (s: unknown, u: number) => void>);
  const fn = Object.getOwnPropertyNames(Object.getPrototypeOf(hud)).find((k) => /^draw(Inventory|Carry)/.test(k));
  if (fn) draw[fn].call(hud, { inventory: inv }, 1);
  const texts = ops.filter((o) => o.tag === "carry").map((o) => o.text ?? "");
  check("the carry card says the reserve as the bottom panel counts it", texts.some((t) => /20 \/ 27\s+40$/.test(t)), texts.filter((t) => / \/ /.test(t)).join(" | ") || `no gun row (${fn ?? "no draw"})`);
  check("and a hack's cooldown to a tenth, as the loot card says it", texts.some((t) => t === "COOLDOWN 12.6 S"), texts.filter((t) => /COOLDOWN/.test(t)).join(" | "));
}
{
  const slots = [{ id: "r97", empty: false, fusion: 0, clip: 20 }, { id: "sentinel", empty: false, fusion: 0, clip: 4 }];
  const dropped = lootCardView({ kind: "weapon", id: "mastiff", n: 1, rarity: "common", fusion: 0, clip: 1 }, { slots, active: 0, held: {} }, "full");
  const mag = dropped?.rows.find((r) => r.label === "MAGAZINE");
  check("a gun put down with 1 round is offered with 1 round, not full", !!mag && /^1\//.test(mag.get), mag?.get ?? "no row");
  const heatHand = lootCardView({ kind: "weapon", id: "r97", n: 1, rarity: "common", fusion: 0 }, { slots: [{ id: "lstar", empty: false, fusion: 0, clip: 9 }, { id: "sentinel", empty: false, fusion: 0, clip: 4 }], active: 0, held: {} }, "full");
  const reload = heatHand?.rows.find((r) => r.label === "RELOAD");
  const magH = heatHand?.rows.find((r) => r.label === "MAGAZINE");
  check("with the CHOOCH (it overheats) in hand, a reloading gun's reload and magazine are not set against it", !!reload && reload.have === "-" && !!magH && magH.have === "-", JSON.stringify({ reload, magH }));
}

console.log("\nWhat the match's own state says (src/main.ts)");
{
  const { readFileSync } = await import("node:fs");
  const main = readFileSync(new URL("../../src/main.ts", import.meta.url), "utf8");
  // (Milestone 927) the dropship's panel names who leads the drop by the drop's own rule, and a hack core swapped down is
  // in its level's colour; (Milestone 930) a ghost or a player between lives puts no spray up
  check("the dropship panel says who leads the drop by the drop's own rule", /master: d\.isJumpmaster\(\)/.test(main));
  check("a hack core swapped down goes in its level's colour", /putBack\(\{ kind: "hack", id: had\.id, n: had\.level, rarity: levelRarity\(had\.level\) \}\)/.test(main));
  check("out (a ghost, between lives), no spray goes up", /function doSpray[\s\S]{0,200}if \(duel && !duel\.alive\) return false;/.test(main));
}

console.log(fails === 0 ? "\nHUD FIT PASS" : `\nHUD FIT FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
