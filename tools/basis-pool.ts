// A pool of worker threads encoding textures to KTX2 (tools/basis-worker.mjs), one a core less two, so a pack's hundreds
// of textures encode in minutes rather than hours (a 2K colour map is 14 s, a 1K normal map 28 s, on one thread).
// The encoder, Basis Universal's WebAssembly build (Apache-2.0), is fetched once into the paid folder's tools: the
// importer only runs where the bought files are, and nothing is installed.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

const SRC = "https://raw.githubusercontent.com/BinomialLLC/basis_universal/master/webgl/encoder/build/";
export type BasisKind = "color" | "emissive" | "normal" | "data";

export class BasisPool {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private queue: Array<{ id: number; msg: unknown; ok: (b: Uint8Array) => void; no: (e: Error) => void }> = [];
  private pending = new Map<number, { ok: (b: Uint8Array) => void; no: (e: Error) => void }>();
  private next = 0;
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
    return new Promise((ok, no) => {
      this.queue.push({ id: this.next++, msg: { rgba, width, height, kind }, ok, no });
      this.pump();
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
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
