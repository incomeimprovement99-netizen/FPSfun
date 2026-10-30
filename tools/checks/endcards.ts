// A match's end on the screen (Milestone 922, from a review of how matches end), drawn by the real HUD onto a stand-in
// canvas that keeps where each line goes, at 1920 x 1080. Every end but a battle royale's drew SpeedKills' match card,
// the old summary card and the big result over one another, the friends' table under the old card's rows. Now: one
// card, under the result and the rematch's clock, a 1v1's and an arena mode's alike.
//
// It sets the page's globals for itself, so it runs in a process of its own: npx tsx tools/checks/endcards.ts (verify
// runs it that way).

// (a module whose imports wait for the stand-ins below: a static import would read the page's globals before they are set)
export {};

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

const g = globalThis as Record<string, unknown>;
g.window = g;
g.innerWidth = 1920;
g.innerHeight = 1080;
g.devicePixelRatio = 1;
g.addEventListener = () => undefined;
const store = new Map<string, string>();
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: () => undefined };
g.document = { createElement: () => ({ getContext: () => null, style: {} }), addEventListener: () => undefined, documentElement: { style: {} } };
g.Image = class {
  src = "";
};
g.location = { search: "", href: "http://endcards.test/" };

const ops: Array<{ tag: string; y: number; h?: number; text?: string }> = [];
let tag = "";
const ctx = new Proxy(
  {},
  {
    get(_t, p) {
      if (p === "measureText") return (s: string) => ({ width: s.length * 8 });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop() {} });
      if (p === "fillText") return (t: string, _x: number, y: number) => ops.push({ tag, y, text: t });
      if (p === "fillRect") return (_x: number, y: number, _w: number, h: number) => ops.push({ tag, y, h });
      return () => undefined;
    },
    set() {
      return true;
    },
  },
);
const { Hud } = await import("../../src/game/hud");
type Drawn = { drawMatchCard(s: unknown, u: number): void; drawDuel(s: unknown, u: number): void; drawSummary(s: unknown, u: number): void; endLayout(s: unknown, u: number): { card: { y: number } | null }; h: number };
const hud = new Hud({ getContext: () => ctx, style: {} } as unknown as HTMLCanvasElement) as unknown as Drawn;

const summary = { title: "VICTORY", good: true, rows: [["Kills", "3"], ["Damage", "450"], ["Accuracy", "40%"], ["Rounds", "3 - 1"]], xp: 250, lines: [], table: [{ name: "ME", kills: 3, damage: 450, place: 1, you: true }, { name: "FRIEND", kills: 1, damage: 200, place: 2, you: false }], level: 4, bar: 0.5, levelUp: false, alpha: 1 };
const duel = { phase: "matchEnd", youWonMatch: true, you: 3, them: 1, left: 6, round: 4, ping: 40, players: [{ name: "ME", you: true, alive: true, score: 3 }, { name: "FRIEND", you: false, alive: false, score: 1 }], zone: { live: false, startsIn: 20, you: 0, them: 0, need: 10 }, summary: { won: true, roundsWon: 3, roundsLost: 1, kills: 3, deaths: 1, damage: 450, shots: 40, hits: 16, streak: 2 }, br: null, mode: null, waiting: null };
const s = { summary, duel, recap: null };
tag = "card";
hud.drawMatchCard(s, 1);
tag = "result";
hud.drawDuel(s, 1);
tag = "old";
hud.drawSummary(s, 1);
const ys = (t: string) => ops.filter((o) => o.tag === t).flatMap((o) => (o.h ? [o.y, o.y + o.h] : [o.y]));
const cardTop = Math.min(...ys("card"));
const resultBottom = Math.max(...ys("result"));
const old = ops.filter((o) => o.tag === "old").length;
check("a 1v1's end: SpeedKills' card alone, no old summary card drawn with it", old === 0, `${old} old card draws`);
check("and the card under the result and the rematch's clock, not over them", cardTop > resultBottom, `card from ${Math.round(cardTop)}, result to ${Math.round(resultBottom)}`);
// an arena mode's end: its title at 30% down and its rematch line under it
const modeEnd = hud.endLayout({ ...s, duel: { ...duel, mode: { kind: "tdm", won: true, winner: "YOUR TEAM", title: "TEAM DEATHMATCH" } } }, 1);
const modeLine = hud.h * 0.3 + 44 + 11;
check("an arena mode's end: the card under its result and its rematch line", !!modeEnd.card && modeEnd.card.y > modeLine, `card at ${Math.round(modeEnd.card?.y ?? -1)}, the rematch line to ${Math.round(modeLine)}`);

console.log(fails === 0 ? "\nEND CARDS PASS" : `\nEND CARDS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
