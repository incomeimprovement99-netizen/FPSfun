// Real Duel instances over a hand-driven wire (PeerJS packing) and a hand-moved clock, for tools/checks/netfigures.ts.
import * as THREE from "three";
import { pack, unpack } from "peerjs-js-binarypack";
import { Duel, type LocalState } from "../../src/game/duel";
import type { Link, NetMsg } from "../../src/net/link";
import { withoutUndefined } from "../../src/net/wire";

const g = globalThis as unknown as Record<string, unknown>;
if (!("document" in g)) {
  g.document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: () => undefined }) }),
  };
}
const perf = performance as unknown as { now: () => number };
export let clockMs = 5000;
perf.now = () => clockMs;
export function tick(ms: number): void {
  clockMs += ms;
}
const warn = console.warn;
console.warn = (...a: unknown[]) => void (String(a[0]).includes("Unable to serialize Texture") ? undefined : warn(...a));

const viaPeerJs = <T,>(v: T): T => unpack(pack(withoutUndefined(v) as Parameters<typeof pack>[0]) as ArrayBuffer) as T;

export interface Crossing {
  from: number;
  to: number;
  m: NetMsg;
  fast: boolean;
}

/** a wire: reliable messages in order; fast ones may be held by `holdFast` and let go later */
export class Wire {
  log: Crossing[] = [];
  queue: Array<() => void> = [];
  cut = new Set<string>();
  drop: ((c: Crossing) => boolean) | null = null;
  held: Array<() => void> = [];
  holdFast: ((c: Crossing) => boolean) | null = null;
  pair(a: number, b: number, roleA: "host" | "guest" = "host"): [Link, Link] {
    const ends: Array<Link & { closed?: boolean }> = [];
    const make = (me: number, them: number, role: "host" | "guest"): Link & { closed?: boolean } => {
      const sendAny = (m: NetMsg, fast: boolean) => {
        const self = ends[me === a ? 0 : 1];
        if (self.closed) return;
        if (this.cut.has(`${me}>${them}`)) return;
        const c: Crossing = { from: me, to: them, m, fast };
        this.log.push(c);
        if (this.drop?.(c)) return;
        const arrived = viaPeerJs(m);
        const other = ends[me === a ? 1 : 0];
        const go = () => {
          if (!other.closed) other.onMessage?.(arrived);
        };
        if (fast && this.holdFast?.(c)) this.held.push(go);
        else this.queue.push(go);
      };
      return {
        role,
        send: (m: NetMsg) => sendAny(m, false),
        sendFast: (m: NetMsg) => sendAny(m, true),
        close: () => {
          const self = ends[me === a ? 0 : 1];
          if (self.closed) return;
          sendAny({ t: "bye" }, false);
          self.closed = true;
        },
        abandon: () => {
          const self = ends[me === a ? 0 : 1];
          self.closed = true;
        },
        onMessage: null,
        onClose: null,
      };
    };
    ends.push(make(a, b, roleA), make(b, a, "guest"));
    return [ends[0], ends[1]];
  }
  drain(): void {
    for (let i = 0; i < 5000 && this.queue.length; i++) (this.queue.shift() as () => void)();
  }
  release(): void {
    for (const f of this.held.splice(0)) f();
  }
}

export const projectiles = { addDummy: () => undefined, removeDummy: () => undefined, fire: () => undefined } as unknown as ConstructorParameters<typeof Duel>[1];
export const scene = new THREE.Scene();

export function at(id: number, f: number, still = false, x0 = 30, z0 = -20): LocalState {
  const a = still ? id : id * 1.3 + f * 0.02;
  const r = 6 + id;
  return { x: x0 + Math.cos(a) * r, y: 0, z: z0 + Math.sin(a) * r, yaw: (a * 180) / Math.PI + 90, pitch: 0, crouch: false, weapon: "vinson", operator: "vanguard", name: `P${id}`, ready: true, stance: "stand", speed: still ? 0 : 6, ads: 0, act: 0 };
}

export type In = {
  remotes: Map<number, { id: number; name: string; alive: boolean; lastHeard: number; samples: Array<{ at: number; x: number; y: number; z: number }>; avatar: { group: THREE.Group; knocked: boolean }; clock?: unknown; outAtSent?: number }>;
  phase: string;
  held: Map<number, number>;
  receive(m: NetMsg, via: number): void;
  reconnectUntil: number | null;
};
export const ins = (d: Duel): In => d as unknown as In;
export { Duel };
