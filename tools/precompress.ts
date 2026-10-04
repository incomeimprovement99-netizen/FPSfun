// The built scripts and styles (dist/assets) compressed with brotli at its strongest, once, beside each file as .br, for
// the game's server to send to a browser that takes brotli (server/game/serve.mjs). Caddy compresses on the fly with
// zstd or gzip at a fast setting: the page's first script came over at 1.49 MB (2026-10-04), and brotli at 11 makes it
// about a fifth smaller. The files are named by their hash, so each is compressed once and kept for good.
//
// Run by npm run build:beta, after the build and its name check.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { brotliCompressSync, constants } from "node:zlib";

const dir = join(process.argv[2] ?? "dist", "assets");
let before = 0;
let after = 0;
for (const name of readdirSync(dir)) {
  if (!/\.(js|css)$/.test(name)) continue;
  const path = join(dir, name);
  const size = statSync(path).size;
  if (size < 1024) continue;
  const data = readFileSync(path);
  const br = brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11, [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT, [constants.BROTLI_PARAM_SIZE_HINT]: size } });
  writeFileSync(`${path}.br`, br);
  before += size;
  after += br.length;
}
console.log(`precompressed: ${(before / 1048576).toFixed(2)} MB of scripts and styles to ${(after / 1048576).toFixed(2)} MB of brotli`);
