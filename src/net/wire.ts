// What a message looks like on the wire, and the one rule about it that this
// project has already been bitten by.
//
// PeerJS packs a message with its own binary encoder before it goes down the
// data channel, and that encoder has no `undefined`: a field set to undefined
// arrives at the other browser as `null`. A field checked as "absent, or a
// string" then fails, so a hit sent without its gun and a JOLT sent without
// its number were dropped whole over the real connection while the local
// BroadcastChannel link, which is a structured clone and keeps undefined
// exactly as it was, carried them happily. Every bug of that shape has only
// ever shown up over the internet, which is the worst place to find one.
//
// So there are two rules here, and the delta codec in state.ts leans on both.
// Sending: a field is either present with a real value or it is not there at
// all, never null, which is what withoutUndefined guarantees. Reading: null
// and absent mean the same thing, because we cannot know which transport the
// sender was on, or how old their build is.

/**
 * A message without its undefined fields. PeerJS packs `undefined` as `null`,
 * and a field checked as "absent or a string" then fails: a hit sent without
 * its gun, a JOLT's effect without its number, were dropped whole on the real
 * connection while the local transport (a structured clone) kept them.
 */
export function withoutUndefined<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => withoutUndefined(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) if (x !== undefined) out[k] = withoutUndefined(x);
    return out as T;
  }
  return v;
}

/**
 * Absent, however the transport spelled it. This is the only test the codec
 * uses for "the sender did not send this", so a packet that came through a
 * link which turned undefined into null reads the same as one that did not.
 */
export function absent(v: unknown): v is null | undefined {
  return v === undefined || v === null;
}

/** a finite number, or the fallback: a NaN from another browser poisons whatever it touches */
export function wireNum(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/** a string, or the fallback: anything else on the wire is someone else's bug or nobody's business */
export function wireStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * How many bytes a message costs, counted as JSON. The real link packs
 * binary and is smaller than this, so every budget measured with it is the
 * pessimistic one, which is the side to be wrong on.
 */
export function wireBytes(m: unknown): number {
  try {
    return JSON.stringify(m)?.length ?? 0;
  } catch {
    return 0;
  }
}
