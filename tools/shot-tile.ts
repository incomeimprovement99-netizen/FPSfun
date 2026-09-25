// Look closer at snapshots: crop a region and blow it up, or tile several
// into one picture so states can be compared side by side. Fit faults in
// the arms and the clothes were found this way and not in the code.
//
//   npx tsx tools/shot-tile.ts crop <in.png> <out.png> x y w h
//   npx tsx tools/shot-tile.ts grid <out.png> <a.png> <b.png> ...
import sharp from "sharp";

async function main(): Promise<void> {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === "crop") {
    const [src, out, x, y, w, h] = rest;
    await sharp(src).extract({ left: +x, top: +y, width: +w, height: +h }).resize(+w * 2).toFile(out);
    return;
  }
  if (mode === "grid") {
    const [out, ...ins] = rest;
    const w = 640;
    const h = 360;
    const tiles = await Promise.all(ins.map((f) => sharp(f).resize(w, h).toBuffer()));
    const rows = Math.ceil(tiles.length / 2);
    await sharp({ create: { width: w * 2, height: h * rows, channels: 3, background: "#000" } })
      .composite(tiles.map((t, i) => ({ input: t, left: (i % 2) * w, top: Math.floor(i / 2) * h })))
      .png()
      .toFile(out);
    return;
  }
  console.log("usage: shot-tile.ts crop <in> <out> x y w h | grid <out> <in...>");
  process.exitCode = 1;
}

void main();
