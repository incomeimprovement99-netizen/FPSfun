// A pool of worker threads encoding textures to KTX2 (tools/basis-worker.mjs), one a core less two, so a pack's hundreds
// of textures encode in minutes rather than hours (a 2K colour map is 14 s, a 1K normal map 28 s, on one thread).
// The encoder, Basis Universal's WebAssembly build (Apache-2.0), is fetched once into the paid folder's tools: the
// importer only runs where the bought files are, and nothing is installed.
// Each encoded texture is kept in the paid folder's cache under a hash of its pixels, size and kind and of the encoder and its
// settings (this worker's source), so a re-bake encodes only the textures that are new: every bake encoded all its ~1,100
// again, most of a bake's time. NEON_KTX2_CACHE=0 encodes everything as before.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, join } from "node:path";
import { Worker } from "node:worker_threads";

const SRC = "https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/webgl/encoder/build/";
export type BasisKind = "color" | "emissive" | "normal" | "data";

export class BasisPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ id: number; msg: unknown; ok: (b: Uint8Array) => void; no: (e: Error) => void }> = [];
  private pending = new Map<number, { ok: (b: Uint8Array) => void; no: (e: Error) => void }>();
  private next = 0;
  private cache = "";
  private salt = "";
  hits = 0;
  encoded = 0;
  private constructor() {}

  static async start(paidDir: string): Promise<BasisPool> {
    const dir = join(paidDir, "tools", "basis") + "/";
    mkdirSync(dir, { recursive: true });
    for (const f of ["basis_encoder.js", "basis_encoder.wasm", "LICENSE"]) {
      if (existsSync(dir + f)) continue;
      const r = await fetch(f === "LICENSE" ? "https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/LICENSE" : SRC + f);
      if (!r.ok) throw new Error(`the Basis encoder's ${f} did not download (${r.status})`);
      writeFileSync(dir + f, Buffer.from(await r.arrayBuffer()));
    }
    const pool = new BasisPool();
    if (process.env.NEON_KTX2_CACHE !== "0") {
      pool.cache = join(paidDir, "cache", "ktx2");
      pool.salt = createHash("sha1").update(readFileSync(dir + "basis_encoder.wasm")).update(readFileSync(new URL("./basis-worker.mjs", import.meta.url))).digest("hex");
    }
    const n = Math.max(1, availableParallelism() - 2);
    await Promise.all(
      Array.from({ length: n }, () => {
        const w = new Worker(new URL("./basis-worker.mjs", import.meta.url), { workerData: { dir } });
        pool.workers.push(w);
        return new Promise<void>((ready) => {
          w.on("message", (m: { ready?: boolean; id?: number; ktx2?: Uint8Array; error?: string }) => {
            if (m.ready) {
              pool.idle.push(w);
              ready();
              return;
            }
            const p = pool.pending.get(m.id!);
            pool.pending.delete(m.id!);
            if (m.error || !m.ktx2) p?.no(new Error(m.error ?? "no output"));
            else p?.ok(m.ktx2);
            pool.idle.push(w);
            pool.pump();
          });
        });
      }),
    );
    return pool;
  }

  /** a picture's raw RGBA as a KTX2 file, mips included */
  encode(rgba: Buffer, width: number, height: number, kind: BasisKind): Promise<Uint8Array> {
    const file = this.cache ? join(this.cache, createHash("sha1").update(this.salt).update(`${width}x${height} ${kind} `).update(rgba).digest("hex") + ".ktx2") : "";
    if (file && existsSync(file)) {
      this.hits++;
      return Promise.resolve(new Uint8Array(readFileSync(file)));
    }
    return new Promise<Uint8Array>((ok, no) => {
      this.queue.push({ id: this.next++, msg: { rgba, width, height, kind }, ok, no });
      this.pump();
    }).then((ktx2) => {
      this.encoded++;
      if (file) {
        // (written aside and renamed: a bake stopped mid-write leaves no half file to be read as whole)
        mkdirSync(dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, ktx2);
        renameSync(tmp, file);
      }
      return ktx2;
    });
  }

  private pump(): void {
    while (this.idle.length && this.queue.length) {
      const w = this.idle.pop()!;
      const j = this.queue.shift()!;
      this.pending.set(j.id, { ok: j.ok, no: j.no });
      w.postMessage({ id: j.id, ...(j.msg as object) });
    }
  }

  async stop(): Promise<void> {
    console.log(`ktx2: ${this.encoded} encoded, ${this.hits} from the cache${this.cache ? "" : " (off)"}`);
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
