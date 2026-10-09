// The guns' recorded sounds from KINEMATION's FPS Animation Ultimate (src/config/packsounds.json), made into what the
// game loads: public/audio/paid, which .gitignore keeps out and `npm run rules` refuses if it is ever tracked. Paid
// files are licensed to the owner, not the public, so like the pack's models they ship only with the game server.
//
// The pack's sounds are 44.1 kHz stereo WAVs, a shot 1.9 s long with most of it silence. Each is folded to mono at
// packsounds.json's rate, 16 bit (every browser decodes a WAV, so no encoder is needed), and brought to one peak, so a
// gun's level is the config's and not how loud the pack happened to record it. A shot is trimmed where its tail dies.
// A reload or a rechamber is kept whole and cut where each of its sounds starts, with the length of the pack clip it
// was recorded to, measured off the clip itself: the game plays each piece at the same share of its own, quicker,
// reload (src/game/audio.ts packTimed).
//
// Sources: the pack unpacked by `npm run paid` into PAID_DIR/extract/fparms (unpacked here if it is not), and the
// clips' lengths from public/models/paid/arms/clips, which `npm run paid` writes.
//
//   npm run paid:sounds
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import DATA from "../data/weapons.json";
import CFG from "../src/config/packsounds.json";
import FP from "../src/config/fparms.json";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const PAID = process.env.PAID_DIR ?? "C:\\Users\\jwilb\\Downloads\\speedkills-paid";
const OUT = join(ROOT, "public", "audio", "paid");
const CLIPS = join(ROOT, "public", "models", "paid", "arms", "clips");
const RATE = CFG.rate;

/** the pack's files by their project path under SFX/, unpacked from Unity's cache if `npm run paid` has not */
function packFiles(): Map<string, string> {
  const dir = join(PAID, "extract", "fparms");
  if (!existsSync(dir)) {
    const pkg = join(process.env.APPDATA ?? "", "Unity", "Asset Store-5.x", "KINEMATION", "Animation", "FPS Animation Ultimate.unitypackage");
    if (!existsSync(pkg)) throw new Error(`the pack is neither unpacked (${dir}) nor in Unity's cache (${pkg})`);
    mkdirSync(dir, { recursive: true });
    execFileSync("tar", ["-xzf", pkg, "-C", dir], { stdio: "inherit" });
  }
  const files = new Map<string, string>();
  for (const guid of readdirSync(dir)) {
    const pn = join(dir, guid, "pathname");
    const asset = join(dir, guid, "asset");
    if (!existsSync(pn) || !existsSync(asset)) continue;
    const path = readFileSync(pn, "utf8").split(/\r?\n/)[0].trim();
    const at = path.indexOf("/SFX/");
    if (at >= 0) files.set(path.slice(at + 5), asset);
  }
  return files;
}

/** the pack's sounds for a reload a shell at a time (packsounds.json packs shells) */
type Shells = { start: string; insert: string; end: string; pump: string };
/** its beats, shares of the empty reload's time (fparms.json packGuns reload) */
type ShellReload = { style: string; count: number; leave: number[]; feed: number[]; push: number[]; back: number[]; pump: number[] };

/** recordings one after the other */
function inOrder(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** a PCM WAV (16 or 24 bit, any channels) folded to mono, -1..1 */
function readWav(path: string): { data: Float32Array; rate: number } {
  const b = readFileSync(path);
  let i = 12;
  let ch = 0;
  let rate = 0;
  let bits = 0;
  while (i < b.length - 8) {
    const id = b.toString("ascii", i, i + 4);
    const size = b.readUInt32LE(i + 4);
    if (id === "fmt ") {
      if (b.readUInt16LE(i + 8) !== 1) throw new Error(`${path}: not PCM`);
      ch = b.readUInt16LE(i + 10);
      rate = b.readUInt32LE(i + 12);
      bits = b.readUInt16LE(i + 22);
    } else if (id === "data") {
      const bytes = bits / 8;
      const n = Math.floor(size / (bytes * ch));
      const data = new Float32Array(n);
      for (let s = 0; s < n; s++) {
        let sum = 0;
        for (let c = 0; c < ch; c++) {
          const o = i + 8 + (s * ch + c) * bytes;
          sum += bits === 16 ? b.readInt16LE(o) / 32768 : bits === 24 ? b.readIntLE(o, 3) / 8388608 : 0;
        }
        data[s] = sum / ch;
      }
      return { data, rate };
    }
    i += 8 + size + (size & 1);
  }
  throw new Error(`${path}: no data`);
}

/** down to RATE, each output sample the mean of those folded into it (the low-pass a decimation needs) */
function resample(x: Float32Array, rate: number): Float32Array {
  const step = rate / RATE;
  const out = new Float32Array(Math.floor(x.length / step));
  for (let i = 0; i < out.length; i++) {
    const a = Math.floor(i * step);
    let s = 0;
    let k = 0;
    for (let j = a; j < a + step && j < x.length; j++, k++) s += x[j];
    out[i] = k ? s / k : 0;
  }
  return out;
}

/** each 10 ms window's RMS */
function envelope(x: Float32Array): Float32Array {
  const w = Math.floor(RATE * 0.01);
  const env = new Float32Array(Math.floor(x.length / w));
  for (let k = 0; k < env.length; k++) {
    let s = 0;
    for (let j = k * w; j < (k + 1) * w; j++) s += x[j] * x[j];
    env[k] = Math.sqrt(s / w);
  }
  return env;
}

/** where each sound in it starts, seconds (packsounds.json cuts) */
function cuts(x: Float32Array): number[] {
  const env = envelope(x);
  const top = Math.max(1e-9, ...env);
  const C = CFG.cuts;
  const out = [0];
  for (let k = 3; k < env.length; k++) {
    const quietBefore = Math.min(env[k - 1], env[k - 2], env[k - 3]) < C.off * top;
    if (env[k] >= C.on * top && quietBefore && k * 0.01 - out[out.length - 1] >= C.gap) out.push(+(k * 0.01 - 0.005).toFixed(3));
  }
  return out;
}

/** to one peak, a shot trimmed where its tail dies and faded there */
function finish(x: Float32Array, trim: boolean): Int16Array {
  let peak = 1e-9;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  let n = x.length;
  let fade = 0;
  if (trim) {
    const env = envelope(x);
    const top = Math.max(...env);
    let last = 0;
    for (let k = 0; k < env.length; k++) if (env[k] > CFG.shotTrim.floor * top) last = k;
    fade = Math.floor(CFG.shotTrim.fade * RATE);
    n = Math.min(x.length, Math.floor((last + 1) * 0.01 * RATE) + fade);
  }
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const f = fade && i > n - fade ? (n - i) / fade : 1;
    pcm[i] = Math.round(Math.max(-1, Math.min(1, (x[i] / peak) * CFG.peak * f * f)) * 32767);
  }
  return pcm;
}

function wav(pcm: Int16Array): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(RATE, 24);
  b.writeUInt32LE(RATE * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  for (let i = 0; i < pcm.length; i++) b.writeInt16LE(pcm[i], 44 + i * 2);
  return b;
}

/** a clip's length in seconds, off its GLB (its samplers' last key) */
function clipSeconds(name: string): number {
  const file = join(CLIPS, `${name}.glb`);
  if (!existsSync(file)) throw new Error(`no clip ${file}: run npm run paid first`);
  const b = readFileSync(file);
  const json = JSON.parse(b.toString("utf8", 20, 20 + b.readUInt32LE(12))) as { animations: Array<{ samplers: Array<{ input: number }> }>; accessors: Array<{ max?: number[] }> };
  return Math.max(...json.animations.flatMap((a) => a.samplers.map((s) => json.accessors[s.input].max?.[0] ?? 0)));
}

function main(): void {
  const files = packFiles();
  mkdirSync(OUT, { recursive: true });
  const index: Record<string, string[]> = {};
  const meta: Record<string, { clip: number; cuts: number[] }> = {};
  const packs = CFG.packs as unknown as Record<string, { fire: string[]; reloadTac?: string | string[]; reloadEmpty?: string | string[]; foley?: string; shells?: Shells }>;
  const fpGuns = FP.guns as Record<string, string>;
  const fpPacks = FP.packGuns as unknown as Record<string, { arms: { reloadTac?: string; reloadEmpty?: string; fire?: string }; reload?: ShellReload }>;
  let bytes = 0;
  const write = (name: string, pcm: Int16Array) => {
    const buf = wav(pcm);
    writeFileSync(join(OUT, name), buf);
    bytes += buf.length;
  };
  const src = (path: string) => {
    const f = files.get(path);
    if (!f) throw new Error(`the pack has no SFX/${path}`);
    const { data, rate } = readWav(f);
    return resample(data, rate);
  };
  for (const [id, g] of Object.entries(CFG.guns)) {
    const p = packs[g.pack];
    index[`pack_fire_${id}`] = p.fire.map((path, i) => {
      const name = `fire_${id}_${i}.wav`;
      write(name, finish(src(path), true));
      return name;
    });
    // a reload or a rechamber only where it is the pack gun's own animation: its sound was recorded to that clip
    if (fpGuns[id] !== g.pack) continue;
    const arms = fpPacks[g.pack]?.arms ?? {};
    const timed: Array<[string, string | string[] | undefined, string | undefined]> = [
      [`pack_reload_${id}_tac`, p.reloadTac, arms.reloadTac],
      [`pack_reload_${id}_empty`, p.reloadEmpty, arms.reloadEmpty],
      [`pack_foley_${id}`, p.foley, arms.fire],
    ];
    for (const [key, path, clip] of timed) {
      if (!path || !clip) continue;
      // (a reload recorded in pieces, the Drake-12's tactical one's start, insert and end, played one after the other)
      const x = Array.isArray(path) ? inOrder(path.map(src)) : src(path);
      const name = `${key.slice(5)}.wav`;
      write(name, finish(x, false));
      index[key] = [name];
      meta[key] = { clip: +clipSeconds(clip).toFixed(3), cuts: cuts(x) };
      console.log(`${key}: ${(x.length / RATE).toFixed(2)} s of sound to a ${meta[key].clip} s clip, ${meta[key].cuts.length} pieces`);
    }
    // a reload a shell at a time (BIGANTLER's): no clip of the pack's plays it, so its sound is laid out here on its own
    // beats (fparms.json packGuns reload), the pack's start, a shell going in at each push, the end, and from empty the
    // pump; the gun's own reload time is the "clip" the pieces are timed to, so each plays at its own speed
    const R = fpPacks[g.pack]?.reload;
    if (p.shells && R?.style === "shells") {
      const stats = (DATA as unknown as { weapons: Record<string, { stats: { reload_time: number; reloadempty_time: number } }> }).weapons[id].stats;
      for (const empty of [false, true]) {
        // (a tactical reload is read onto the empty one's timeline and ends where its hand is back on the pump)
        const span = empty ? 1 : R.back[1];
        const seconds = empty ? stats.reloadempty_time : stats.reload_time;
        const at: Array<[number, string]> = [[R.leave[0], p.shells.start]];
        for (let k = 0; k < R.count; k++) at.push([R.feed[0] + ((k + R.push[0]) / R.count) * (R.feed[1] - R.feed[0]), p.shells.insert]);
        at.push([R.back[0], p.shells.end]);
        if (empty) at.push([R.pump[0], p.shells.pump]);
        const parts = at.map(([share, path]) => ({ from: Math.round((share / span) * seconds * RATE), x: src(path) }));
        const x = new Float32Array(Math.max(...parts.map((q) => q.from + q.x.length)));
        // (each piece cut short where the next starts: they are played as pieces, each to the next one's start)
        parts.forEach((q, i) => x.set(q.x.subarray(0, Math.min(q.x.length, (parts[i + 1]?.from ?? x.length) - q.from)), q.from));
        const key = `pack_reload_${id}_${empty ? "empty" : "tac"}`;
        const name = `${key.slice(5)}.wav`;
        write(name, finish(x, false));
        index[key] = [name];
        meta[key] = { clip: seconds, cuts: parts.map((q) => +(q.from / RATE).toFixed(3)) };
        console.log(`${key}: ${parts.length} pieces laid on a ${seconds} s reload`);
      }
    }
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 1));
  console.log(`${Object.values(index).flat().length} files, ${(bytes / 1048576).toFixed(2)} MB, to ${OUT}`);
}

main();
