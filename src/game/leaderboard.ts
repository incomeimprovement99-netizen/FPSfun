// The online leaderboard client. Talks to server/leaderboard/worker.ts when
// the game was built with VITE_LEADERBOARD_URL (and VITE_LEADERBOARD_SECRET);
// otherwise every call is a no-op and the boards stay in the browser.
//
// Results are posted after the fact and never block the game; a failed post
// is dropped (the local profile still has it).

export interface BoardEntry {
  name: string;
  value: number;
  at: string;
}

const URL_BASE = (import.meta.env.VITE_LEADERBOARD_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const SECRET = (import.meta.env.VITE_LEADERBOARD_SECRET as string | undefined) ?? "";

export const leaderboardOnline = (): boolean => URL_BASE.length > 0;

/** record a result; resolves to your rank on that board, or null */
export async function submitScore(board: string, name: string, value: number): Promise<number | null> {
  if (!leaderboardOnline()) return null;
  try {
    const r = await fetch(`${URL_BASE}/submit`, {
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
  if (!leaderboardOnline()) return [];
  try {
    const r = await fetch(`${URL_BASE}/top?board=${encodeURIComponent(board)}&n=${n}`);
    if (!r.ok) return [];
    const j = (await r.json()) as { entries?: BoardEntry[] };
    return Array.isArray(j.entries) ? j.entries : [];
  } catch {
    return [];
  }
}
