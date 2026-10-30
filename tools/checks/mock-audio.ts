// A Web Audio stand-in that keeps the graph: every node, every edge, every gain's value, enough of the API for
// src/game/audio.ts to build its buses and voices, so a check can walk each sound's way to the speakers (tools/checks/sound.ts).
export const nodes: MockNode[] = [];
let seq = 0;

class MockParam {
  value: number;
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime(_v: number) {
    return this;
  }
  setTargetAtTime(v: number) {
    // the slider's ramp, taken at once: what it settles to
    this.value = v;
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}

export class MockNode {
  id = seq++;
  out: Array<MockNode | MockParam> = [];
  gain?: MockParam;
  constructor(public kind: string, public ctx: MockCtx) {
    nodes.push(this);
  }
  connect(t: MockNode | MockParam) {
    this.out.push(t);
    return t;
  }
  disconnect() {
    this.out = [];
  }
  // sources
  start() {}
  stop() {}
  buffer: unknown = null;
  loop = false;
  playbackRate = new MockParam(1);
  frequency = new MockParam(0);
  Q = new MockParam(1);
  type = "";
  threshold = new MockParam(0);
  knee = new MockParam(0);
  ratio = new MockParam(0);
  attack = new MockParam(0);
  release = new MockParam(0);
  positionX = new MockParam(0);
  positionY = new MockParam(0);
  positionZ = new MockParam(0);
  panningModel = "";
  distanceModel = "";
  refDistance = 1;
  rolloffFactor = 1;
  maxDistance = 1;
}

export class MockCtx {
  currentTime = 0;
  sampleRate = 8000;
  state = "running";
  destination: MockNode;
  listener = {
    positionX: new MockParam(),
    positionY: new MockParam(),
    positionZ: new MockParam(),
    forwardX: new MockParam(),
    forwardY: new MockParam(),
    forwardZ: new MockParam(),
    upX: new MockParam(),
    upY: new MockParam(),
    upZ: new MockParam(),
  };
  constructor() {
    this.destination = new MockNode("destination", this);
  }
  resume() {
    return Promise.resolve();
  }
  createGain() {
    const n = new MockNode("gain", this);
    n.gain = new MockParam(1);
    return n;
  }
  createBiquadFilter() {
    return new MockNode("filter", this);
  }
  createPanner() {
    return new MockNode("panner", this);
  }
  createConvolver() {
    return new MockNode("convolver", this);
  }
  createDynamicsCompressor() {
    return new MockNode("compressor", this);
  }
  createOscillator() {
    return new MockNode("osc", this);
  }
  createBufferSource() {
    return new MockNode("bufsrc", this);
  }
  createMediaElementSource() {
    return new MockNode("media", this);
  }
  createBuffer(ch: number, len: number) {
    const data = Array.from({ length: ch }, () => new Float32Array(len));
    return { duration: len / 8000, getChannelData: (c: number) => data[c] };
  }
  decodeAudioData() {
    return Promise.reject(new Error("no"));
  }
}

/** every path from `from` to the destination, with the product of the plain gains along it and the named nodes it went through */
export function paths(from: MockNode, names: Map<MockNode, string>): Array<{ gain: number; via: string[] }> {
  const out: Array<{ gain: number; via: string[] }> = [];
  const walk = (n: MockNode, g: number, via: string[], depth: number) => {
    if (depth > 40) return;
    const here = names.get(n);
    const v2 = here ? [...via, here] : via;
    const g2 = n.gain ? g * n.gain.value : g;
    if (n.kind === "destination") {
      out.push({ gain: g, via: v2 });
      return;
    }
    for (const t of n.out) if (t instanceof MockNode) walk(t, g2, v2, depth + 1);
  };
  walk(from, 1, [], 0);
  return out;
}
