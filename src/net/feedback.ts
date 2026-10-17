// What a player tells the owner, from the menu's Feedback tab (Milestone 625; the owner, 2026-10-12: "message B00G
// with any feedback including suggestions, bugs, features or changes"). Until then a note reached the owner only if a
// friend messaged them, and Tiger's "really difficult on controller" came that way, days after the playtest. Posted to
// our own server's /api/feedback, which /net.json names, with the build and the settings it was seen with; `npm run
// fps feedback` reads it. Anywhere else (the dev server, a copy on another host) there is nowhere to send it, and the
// tab says so.
import { session } from "./account";
import { device, serverUrl } from "./seen";

export type FeedbackKind = "bug" | "idea" | "change" | "other";

/** the longest note the server keeps (server/game/serve.mjs FEEDBACK_MAX_CHARS) */
export const FEEDBACK_MAX = 1500;

export interface FeedbackContext {
  /** the name the player goes by */
  name?: string;
  /** what they were last in: the match's kind, or the range */
  mode?: string;
  preset?: string;
  fps?: number;
}

/** "sent", "nowhere" (no server of ours to take it) or "failed" (it could not be sent: the network, or too many at once) */
export async function sendFeedback(text: string, kind: FeedbackKind, c: FeedbackContext = {}): Promise<"sent" | "nowhere" | "failed"> {
  const url = await serverUrl("feedback");
  if (!url) return "nowhere";
  const body = JSON.stringify({
    text: text.slice(0, FEEDBACK_MAX),
    kind,
    name: c.name || undefined,
    acct: session()?.name,
    dev: device(),
    mode: c.mode,
    preset: c.preset,
    fps: c.fps,
    bot: navigator.webdriver ? 1 : undefined,
  });
  try {
    const r = await fetch(url, { method: "POST", body });
    return r.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
