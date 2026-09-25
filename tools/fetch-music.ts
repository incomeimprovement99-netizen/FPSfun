// The drop theme: "Battle Theme A" by cynicmusic, CC0, from OpenGameArt
// (opengameart.org/content/battle-theme-a). docs/AAA_GAP.md step 7: all three
// of the big games score the drop, and ours was silent.
//
// The file is the author's own MP3, kept as it is: every browser plays MP3,
// it is already small for three minutes of music, and the game streams it
// rather than decoding it (audio.ts music). Run by `npm run sounds`, after the
// effects; written to public/audio/music, gitignored like the other downloads.
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(resolve(fileURLToPath(new URL(".", import.meta.url)), ".."), "public", "audio", "music");
const TRACKS = [{ url: "https://opengameart.org/sites/default/files/battleThemeA.mp3", out: "drop.mp3" }];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  for (const t of TRACKS) {
    const r = await fetch(t.url);
    if (!r.ok) throw new Error(`${t.url}: ${r.status}`);
    const data = Buffer.from(await r.arrayBuffer());
    // an HTML error page served with a 200 is not a track
    if (data.length < 100_000 || !(data.subarray(0, 3).toString() === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0))) throw new Error(`${t.url}: not an MP3 (${data.length} bytes)`);
    writeFileSync(join(OUT, t.out), data);
    console.log(`  ${t.out}: ${(data.length / 1e6).toFixed(1)} MB`);
  }
}

void main();
