// The online leaderboard client. The board is found at run time: on our own
// server (server/game/serve.mjs) /net.json names it, and a build made with
// VITE_LEADERBOARD_URL (the Cloudflare Worker, server/leaderboard/worker.ts)
// uses that. On a site with neither (GitHub Pages) every call is a no-op and
// the boards stay in the browser.
//
// Results are posted after the fact and never block the game; a failed post
// is dropped (the local profile still has it).

export interface BoardEntry {
  name: string;
  value: number;
  at: string;
}

/** the boards the game posts to, in the order the Stats tab offers them */
export const BOARDS: ReadonlyArray<{ id: string; label: string; unit: "s" | "wins" }> = [
  { id: "course:basic", label: "The Run (Basic)", unit: "s" },
  { id: "course:advanced", label: "The Run (Advanced)", unit: "s" },
  { id: "course:drill", label: "Flick drill (30 targets)", unit: "s" },
  { id: "duel:wins", label: "1v1 wins", unit: "wins" },
  { id: "triple:wins", label: "1v1v1 wins", unit: "wins" },
  { id: "br:wins", label: "Battle royale wins", unit: "wins" },
  { id: "gunrun:wins", label: "Gun Run wins", unit: "wins" },
  { id: "tdm:wins", label: "Team deathmatch wins", unit: "wins" },
  { id: "crown:wins", label: "Crown wins", unit: "wins" },
  { id: "bots:hard:wins", label: "Wins against hard bots", unit: "wins" },
  { id: "bots:normal:wins", label: "Wins against normal bots", unit: "wins" },
  { id: "bots:easy:wins", label: "Wins against easy bots", unit: "wins" },
];

const BUILD_URL = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SECRET = (import.meta.env.VITE_LEADERBOARD_SECRET as string | undefined) ?? "";

let base: Promise<string> | null = null;
/** the board's address, or "" when there is none; looked up once */
function boardBase(): Promise<string> {
  return (base ??= (async () => {
    if (BUILD_URL) return BUILD_URL;
    try {
      const r = await fetch("./net.json", { cache: "no-store" });
      // the dev server answers any path with the game page
      if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return "";
      const j = (await r.json()) as { board?: unknown };
      return typeof j.board === "string" ? new URL(j.board, location.href).href.replace(/\/$/, "") : "";
    } catch {
      return "";
    }
  })());
}

export const leaderboardOnline = async (): Promise<boolean> => (await boardBase()) !== "";

/** record a result; resolves to your rank on that board, or null */
export async function submitScore(board: string, name: string, value: number): Promise<number | null> {
  const b = await boardBase();
  if (!b) return null;
  try {
    const r = await fetch(`${b}/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ board, name, value, secret: SECRET }),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { rank?: number };
    return typeof j.rank === "number" ? j.rank : null;
  } catch {
    return null;
  }
}

export async function topScores(board: string, n = 20): Promise<BoardEntry[]> {
  const b = await boardBase();
  if (!b) return [];
  try {
    const r = await fetch(`${b}/top?board=${encodeURIComponent(board)}&n=${n}`, { cache: "no-store" });
    if (!r.ok) return [];
    const j = (await r.json()) as { entries?: BoardEntry[] };
    return Array.isArray(j.entries) ? j.entries.filter((e) => e && typeof e.name === "string" && typeof e.value === "number") : [];
  } catch {
    return [];
  }
}
