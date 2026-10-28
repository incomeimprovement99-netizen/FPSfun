// The voice chat after a match (Milestone 734). The microphone asked for in a match and allowed after it ended was
// taken for a voice chat that was over, the last match's players were called with it, and nothing let it go: the
// browser's recording mark stayed on for the rest of the visit. And a stopped voice chat still answered the last
// match's players' calls. The same Voice serves the next match (main.ts keeps one a peer), so it must still work then.
//
// Run on its own: npx tsx tools/checks/voice-stop.ts.
import type Peer from "peerjs";
import { Voice } from "../../src/net/voice";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("The voice chat after a match");
/** a microphone track that says whether it was let go */
const track = () => ({ enabled: true, stopped: false, stop() { this.stopped = true; } });
const stream = (t: ReturnType<typeof track>) => ({ getAudioTracks: () => [t], getTracks: () => [t] }) as unknown as MediaStream;
const calls: string[] = [];
/** the next call made is turned away at once, as a page not ready for it turns it away */
const closeNext = { value: false };
// (in an object: assigned in a callback, a plain variable reads as never set)
const hooks: { onCall: ((c: unknown) => void) | null } = { onCall: null };
const peer = {
  id: "me",
  on: (ev: string, fn: (c: unknown) => void) => { if (ev === "call") hooks.onCall = fn; },
  call: (id: string) => {
    calls.push(id);
    const on: Record<string, () => void> = {};
    const c = { on: (ev: string, fn: () => void) => { on[ev] = fn; }, close: () => undefined };
    if (closeNext.value) setTimeout(() => on.close?.(), 10);
    return c;
  },
} as unknown as Peer;

// the browser's question, answered when the check says
let allow: ((s: MediaStream) => void) | null = null;
const nav = globalThis.navigator as unknown as Record<string, unknown>;
const had = Object.getOwnPropertyDescriptor(nav, "mediaDevices");
Object.defineProperty(nav, "mediaDevices", { configurable: true, value: { getUserMedia: () => new Promise<MediaStream>((ok) => (allow = ok)) } });
try {
  const v = new Voice(peer);
  v.setGroup(["mate"]);
  // the key pressed in the match: the browser asks; the match ends; the player allows it
  const t1 = track();
  const asked = v.setTalking(true);
  v.stop();
  allow!(stream(t1));
  await asked;
  check("a microphone allowed after the match ended is let go at once, and nobody is called with it", t1.stopped && calls.length === 0 && !v.live, JSON.stringify({ stopped: t1.stopped, calls }));
  // a late call from the last match's mate
  let answered = false;
  let closed = false;
  hooks.onCall?.({ peer: "mate", metadata: { voice: 1 }, answer: () => (answered = true), close: () => (closed = true), on: () => undefined });
  check("a stopped voice chat turns a late call from the last match away", !answered && closed, JSON.stringify({ answered, closed }));
  // the next match on the same peer: it talks again
  v.setGroup(["next"]);
  const t2 = track();
  const again = v.setTalking(true);
  allow!(stream(t2));
  await again;
  check("and the next match's voice chat on the same peer works: the microphone kept, the new mate called", !t2.stopped && calls.join() === "next" && v.live, JSON.stringify({ stopped: t2.stopped, calls }));
  // a call turned away (the mate's page not ready for it) is made again (Milestone 735: made once, they never heard us)
  closeNext.value = true;
  v.setGroup(["late"]);
  // (up to 8 s for it: verify runs its checks side by side, and a busy loop fired the 1.5 s timer late)
  for (let i = 0; i < 80 && calls.filter((c) => c === "late").length < 2; i++) await new Promise((r) => setTimeout(r, 100));
  closeNext.value = false;
  const lateCalls = calls.filter((c) => c === "late").length;
  check("a call turned away is made again a moment later, while they are still in the group", lateCalls >= 2, `${lateCalls} calls to them`);
  v.stop();
} finally {
  if (had) Object.defineProperty(nav, "mediaDevices", had);
  else delete nav.mediaDevices;
}

export const voiceStopFails = fails;
if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) process.exitCode = fails ? 1 : 0;
