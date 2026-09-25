// Recorded gunshots, from The Free Firearm Sound Library (Still North Media's
// Kickstarter recording sessions: 24 real firearms, released CC0, "NO RIGHTS
// RESERVED, may be used without royalty or credit"; credited anyway).
// https://opengameart.org/content/the-free-firearm-sound-library
//
// The game's shots were synthesised: a filtered thump, a band of noise and a
// crack per weapon class (src/config/audio.json). That is half of a
// shooter's feel, and a noise burst has no mechanism, no room and no tail
// that sounds like a gun, which docs/FEEL_GAP.md counts as a large part of
// "clunky". These are real guns, near and at mid distance, one class at a time.
//
// The library is 194 MB of 96 kHz, 24-bit stereo WAVs, each with several
// shots in it. What the game needs is a fraction of a second per shot. So:
// fetch the archive once, unpack it with the system's tar (libarchive reads
// 7z, on Windows and on Linux), find each shot by its onset, and write each
// take trimmed from just before the onset, faded out, folded to mono at
// 32 kHz, 16 bit. No encoder needed: every browser decodes a WAV.
//
// Run: npm run guns        Written to public/audio/guns, gitignored like
// every other download; this script is the source of truth.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const OUT = join(ROOT, "public", "audio", "guns");
const URL_7Z = "https://opengameart.org/sites/default/files/Prepared%20SFX%20Library.7z";
const CACHE = join(process.env.TEMP ?? "/tmp", "free-firearm-library");
/**
 * Sample rates: a near shot keeps its crack up to 16 kHz; a far one has lost
 * its top to the air before it arrives, so 8 kHz of it is all there is to keep.
 */
const NEAR_RATE = 32000;
const FAR_RATE = 16000;

/**
 * Which recordings voice which class, near and at mid distance, with how long
 * a take runs: a pistol's report is short, a rifle's tail rolls on. The class
 * names are audio.json's.
 */
const CLASSES: Record<string, { near: string[]; far: string[]; seconds: number }> = {
  // Walther PPQ 9mm, 1911 .45, Bersa .380
  pistol: { near: ["Walther PPQ/X_39P", "1911/A_42P", "Bersa/F_47P"], far: ["Walther PPQ/X_31P", "1911/A_34P", "Bersa/F_41P"], seconds: 0.7 },
  // Carl Gustav M45 and PPSh, both sub machine guns
  smg: { near: ["Carl Gustav M45/G_31P", "PPSh/P_30P"], far: ["Carl Gustav M45/G_20P", "PPSh/P_16P"], seconds: 0.55 },
  // AR-15 5.56 and AK-47 7.62x39
  rifle: { near: ["AR-15/D_32P", "AK-47/C_28P"], far: ["AR-15/D_24P", "AK-47/C_31P"], seconds: 0.65 },
  // the AK's heavier round and the Marlin's .30-30: a bigger gun than the rifle class
  lmg: { near: ["AK-47/C_28P", "Marlin 336/I_22P"], far: ["AK-47/C_31P", "Marlin 336/I_17P"], seconds: 0.75 },
  // SKS and a lever action
  marksman: { near: ["SKS/U_14P", "Model 1894/L_23P"], far: ["SKS/U_19P", "Model 1894/L_17P"], seconds: 0.95 },
  // Mosin Nagant, Savage 10, Tikka T3: bolt actions
  sniper: { near: ["Mosin Nagant/M_21P", "Savage 10 .300 Blackout/T_27P", "Tikka/W_29P"], far: ["Mosin Nagant/M_26P", "Savage 10 .300 Blackout/T_17P", "Tikka/W_24P"], seconds: 1.4 },
  // Benelli Nova, Winchester Model 12, Charles Daly: 12 gauge pumps
  shotgun: { near: ["Nova/O_21P", "Model 12/K_22P", "CD/H_21P"], far: ["Nova/O_17P", "Model 12/K_17P", "CD/H_16P"], seconds: 1.0 },
};

/** how many shots to take out of each recording (a file holds several): two near, one far */
const PER_FILE = { near: 2, far: 1 };

/** a WAV's samples as floats, channels folded to mono */
function readWav(path: string): { data: Float32Array; rate: number } {
  const b = readFileSync(path);
  let p = 12;
  let fmt: { ch: number; rate: number; bits: number; float: boolean } | null = null;
  while (p + 8 <= b.length) {
    const id = b.toString("ascii", p, p + 4);
    const size = b.readUInt32LE(p + 4);
    const body = p + 8;
    if (id === "fmt ") {
      const tag = b.readUInt16LE(body);
      fmt = { ch: b.readUInt16LE(body + 2), rate: b.readUInt32LE(body + 4), bits: b.readUInt16LE(body + 14), float: tag === 3 };
    } else if (id === "data" && fmt) {
      const bytes = fmt.bits / 8;
      const frames = Math.floor(size / (bytes * fmt.ch));
      const out = new Float32Array(frames);
      for (let i = 0; i < frames; i++) {
        let s = 0;
        for (let c = 0; c < fmt.ch; c++) {
          const o = body + (i * fmt.ch + c) * bytes;
          if (fmt.float) s += b.readFloatLE(o);
          else if (bytes === 3) s += b.readIntLE(o, 3) / 8388608;
          else if (bytes === 2) s += b.readInt16LE(o) / 32768;
          else s += b.readInt32LE(o) / 2147483648;
        }
        out[i] = s / fmt.ch;
      }
      return { data: out, rate: fmt.rate };
    }
    p = body + size + (size & 1);
  }
  throw new Error(`${path}: no PCM data`);
}

/**
 * Where each shot starts: the first sample over a third of the file's peak,
 * at least 0.4 s after the last shot, walked back to where its rise begins.
 * Waiting for a quiet stretch first missed every shot in the mid-distance
 * recordings, whose noise floor never goes quiet enough.
 */
function onsets(x: Float32Array, rate: number): number[] {
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  const gate = peak / 3;
  const gap = Math.floor(rate * 0.4);
  const back = Math.floor(rate * 0.006);
  const out: number[] = [];
  for (let i = 0; i < x.length; i++) {
    if (Math.abs(x[i]) < gate || (out.length && i - out[out.length - 1] < gap)) continue;
    let s = i;
    while (s > i - back && s > 0 && Math.abs(x[s - 1]) > peak * 0.03) s--;
    out.push(s);
  }
  return out;
}

/** a take: from 1 ms before the onset, faded over its last third, at RATE, peak at 0.9 */
function take(x: Float32Array, rate: number, at: number, seconds: number, RATE: number): Int16Array {
  const start = Math.max(0, at - Math.floor(rate * 0.001));
  const step = rate / RATE;
  const n = Math.floor(seconds * RATE);
  const out = new Float32Array(n);
  let peak = 1e-9;
  for (let i = 0; i < n; i++) {
    // an average over the samples folded into this one, which is the low-pass a decimation needs
    const a = start + Math.floor(i * step);
    let s = 0;
    let k = 0;
    for (let j = a; j < a + step && j < x.length; j++, k++) s += x[j];
    out[i] = k ? s / k : 0;
    peak = Math.max(peak, Math.abs(out[i]));
  }
  const fade = Math.floor(n / 3);
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const f = i > n - fade ? (n - i) / fade : 1;
    pcm[i] = Math.round(Math.max(-1, Math.min(1, (out[i] / peak) * 0.9 * f * f)) * 32767);
  }
  return pcm;
}

function wav(pcm: Int16Array, RATE: number): Buffer {
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

function main(): void {
  mkdirSync(CACHE, { recursive: true });
  const archive = join(CACHE, "library.7z");
  if (!existsSync(archive)) {
    console.log("fetching The Free Firearm Sound Library (194 MB, once)");
    execFileSync("curl", ["-sL", "-o", archive, URL_7Z], { stdio: "inherit" });
  }
  const lib = join(CACHE, "Prepared SFX Library");
  if (!existsSync(lib)) execFileSync("tar", ["-xf", archive, "-C", CACHE], { stdio: "inherit" });
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const index: Record<string, string[]> = {};
  let bytes = 0;
  for (const [cls, c] of Object.entries(CLASSES)) {
    for (const [range, files, rate, per] of [["", c.near, NEAR_RATE, PER_FILE.near], ["_far", c.far, FAR_RATE, PER_FILE.far]] as const) {
      const name = `shot_${cls}${range}`;
      index[name] = [];
      for (const f of files) {
        const { data, rate: src } = readWav(join(lib, `${f}.wav`));
        for (const at of onsets(data, src).slice(0, per)) {
          const file = `${name}_${index[name].length}.wav`;
          const out = wav(take(data, src, at, c.seconds, rate), rate);
          writeFileSync(join(OUT, file), out);
          bytes += out.length;
          index[name].push(file);
        }
      }
      console.log(`  ${name}: ${index[name].length} takes`);
    }
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1) + "\n");
  console.log(`\n${Object.values(index).flat().length} takes, ${(bytes / 1e6).toFixed(1)} MB, in public/audio/guns`);
}

main();
