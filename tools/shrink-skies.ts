// The skies already fetched (public/tex/*.hdr) at no more than tools/hdr.ts SKY_WIDTH across, in place; one already that
// small is left as it is. tools/fetch-assets.ts shrinks them as it fetches them; this is for a checkout that has the big
// ones from before (2026-10-04), and the deploy's own copy in the main checkout.
//
// Run: npx tsx tools/shrink-skies.ts [dir]   (default public/tex)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeHdr, meanLight, shrinkSky } from "./hdr";

const dir = process.argv[2] ?? join("public", "tex");
for (const name of readdirSync(dir).filter((f) => f.endsWith(".hdr"))) {
  const path = join(dir, name);
  const before = readFileSync(path);
  const after = shrinkSky(before);
  if (after === before) {
    console.log(`  ${name}: already small enough`);
    continue;
  }
  const [a, b] = [decodeHdr(before), decodeHdr(after)];
  const drift = Math.abs(meanLight(b) / meanLight(a) - 1);
  if (drift > 0.005) throw new Error(`${name}: its light moved ${(drift * 100).toFixed(2)}% shrunk; left as it was`);
  writeFileSync(path, after);
  console.log(`  ${name}: ${a.w}x${a.h} ${before.length} bytes -> ${b.w}x${b.h} ${after.length} bytes (its light within ${(drift * 100).toFixed(2)}%)`);
}
