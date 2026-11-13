// How dark a set of pictures is: the share of pixels under 30 and under 60 of 255 (luma), and over 235.
// Why: the fresh reviewers kept naming "black slabs" and "black pits", and the first guess at the cause (the height of
// the sun) was wrong; this number, on the same pictures before and after, is what a change to the light is judged by
// (docs/PLAN_MAP_TO_8.md section 3.4).
// Usage: node tools/neon-darkshare.cjs <folder of PNGs> [a regular expression the file names must match]
const sharp = require("sharp");
const fs = require("fs");
const dir = process.argv[2];
const only = process.argv[3] ? new RegExp(process.argv[3]) : null;
if (!dir) { console.error("usage: node tools/neon-darkshare.cjs <folder> [name pattern]"); process.exit(1); }
(async () => {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".png") && (!only || only.test(f))).sort();
  const sum = { u30: 0, u60: 0, o235: 0, mean: 0 };
  for (const f of files) {
    // (400 wide: the shares move under half a point against the full picture, and a folder of fifty reads in seconds)
    const { data, info } = await sharp(dir + "/" + f).resize(400).raw().toBuffer({ resolveWithObject: true });
    const px = info.width * info.height, c = info.channels;
    let u30 = 0, u60 = 0, o235 = 0, total = 0;
    for (let i = 0; i < px; i++) {
      const l = 0.2126 * data[i * c] + 0.7152 * data[i * c + 1] + 0.0722 * data[i * c + 2];
      if (l < 30) u30++;
      if (l < 60) u60++;
      if (l > 235) o235++;
      total += l;
    }
    const r = { u30: (100 * u30) / px, u60: (100 * u60) / px, o235: (100 * o235) / px, mean: total / px };
    for (const k of Object.keys(sum)) sum[k] += r[k];
    console.log(f.padEnd(52), "under 30:", r.u30.toFixed(1).padStart(5) + "%", " under 60:", r.u60.toFixed(1).padStart(5) + "%", " over 235:", r.o235.toFixed(1).padStart(4) + "%", " mean", r.mean.toFixed(0).padStart(3));
  }
  const n = files.length || 1;
  console.log(`${files.length} pictures`.padEnd(52), "under 30:", (sum.u30 / n).toFixed(1).padStart(5) + "%", " under 60:", (sum.u60 / n).toFixed(1).padStart(5) + "%", " over 235:", (sum.o235 / n).toFixed(1).padStart(4) + "%", " mean", (sum.mean / n).toFixed(0).padStart(3));
})();
