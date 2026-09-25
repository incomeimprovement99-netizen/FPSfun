// Fetch recorded CC0 sounds (Kenney: kenney.nl, Creative Commons Zero 1.0:
// commercial use permitted, attribution not required, redistribution
// permitted; credited anyway) into public/audio/kenney. The game layers them
// over its synthesis (src/game/audio.ts): footsteps, landings and body falls,
// a punch, the magazine and the bolt, a frag's crunch, and the menu's clicks.
// The guns are synthesised, each by its class, with one recorded layer under
// the attack (`gun_mech`): the action, which is the part of a shot synthesis
// gets least right. Without these files every
// sound is the synthesis alone, so a checkout that has not run this still
// sounds complete.
//
// Run: npm run sounds
// Downloaded files are gitignored; this script is the source of truth.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";

const OUT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "audio", "kenney");

/** the packs (their pages carry the zip's current address) */
const PACKS = ["impact-sounds", "sci-fi-sounds", "interface-sounds"] as const;

/** what the game calls a sound -> the pack's file names (every take of it) */
const PICK: Record<string, { pack: (typeof PACKS)[number]; files: string[] }> = {
  step_concrete: { pack: "impact-sounds", files: [0, 1, 2, 3, 4].map((i) => `footstep_concrete_00${i}`) },
  step_grass: { pack: "impact-sounds", files: [0, 1, 2, 3, 4].map((i) => `footstep_grass_00${i}`) },
  land: { pack: "impact-sounds", files: [0, 1, 2].map((i) => `impactSoft_heavy_00${i}`) },
  bodyfall: { pack: "impact-sounds", files: [0, 1, 2].map((i) => `impactSoft_medium_00${i}`) },
  punch: { pack: "impact-sounds", files: [0, 1, 2].map((i) => `impactPunch_medium_00${i}`) },
  mag_out: { pack: "impact-sounds", files: [0, 1, 2].map((i) => `impactPlate_light_00${i}`) },
  mag_in: { pack: "impact-sounds", files: [0, 1, 2].map((i) => `impactMetal_light_00${i}`) },
  bolt: { pack: "impact-sounds", files: [0, 1].map((i) => `impactMetal_medium_00${i}`) },
  // the gun's action, under the synthesised shot (src/game/audio.ts gun): a
  // real metal mechanism is the part of a gunshot that synthesis gets least
  // right, and the one a player hears as "a gun" rather than "a noise"
  gun_mech: { pack: "impact-sounds", files: [0, 1, 2, 3].map((i) => `impactPlate_light_00${i}`) },
  clatter: { pack: "impact-sounds", files: [0, 1, 2].map((i) => `impactMetal_light_00${i + 2}`) },
  explosion: { pack: "sci-fi-sounds", files: [0, 1, 2, 3].map((i) => `explosionCrunch_00${i}`) },
  click: { pack: "interface-sounds", files: ["click_001", "click_002", "click_003"] },
  confirm: { pack: "interface-sounds", files: ["confirmation_001", "confirmation_002"] },
  error: { pack: "interface-sounds", files: ["error_004"] },
  // Outskirts' interactions. Doors, supply bins and the drop's horn all make
  // a sound a player listens FOR: a door swinging two rooms away is the tell
  // that someone is in the building with you, and in Apex it is most of how
  // you know. Synthesis cannot do a door, so these are recorded takes.
  door_open: { pack: "impact-sounds", files: [0, 1].map((i) => `impactWood_medium_00${i}`) },
  door_close: { pack: "impact-sounds", files: [2, 3].map((i) => `impactWood_medium_00${i}`) },
  door_kick: { pack: "impact-sounds", files: [0, 1].map((i) => `impactWood_heavy_00${i}`) },
  bin_open: { pack: "impact-sounds", files: [0, 1].map((i) => `impactMetal_heavy_00${i}`) },
  bin_close: { pack: "impact-sounds", files: [2, 3].map((i) => `impactMetal_heavy_00${i}`) },
  pickup: { pack: "interface-sounds", files: ["select_002", "select_003"] },
  beacon: { pack: "sci-fi-sounds", files: ["forceField_000", "forceField_001"] },
  horn: { pack: "sci-fi-sounds", files: ["lowFrequency_explosion_000"] },
  ping: { pack: "interface-sounds", files: ["tick_002", "tick_004"] },
  zip_ride: { pack: "sci-fi-sounds", files: ["spaceEngine_001"] },
};

/**
 * Footsteps Kenney does not have: metal (ladders, grates, catwalks) and
 * gravel, from congusbongus's "Footsteps on different surfaces" on
 * OpenGameArt, each mastered from a freesound.org original. The metal takes
 * are CC-BY 3.0 (Eelke) and so are credited as their licence asks; the
 * gravel is CC0 (Ali_6868). A metal floor used to be the concrete step
 * pitched up, and the sand the grass step.
 */
const OGA_STEPS = "https://opengameart.org/sites/default/files/footsteps_0.zip";
const STEPS: Record<string, string[]> = {
  step_metal: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `footsteps/metal/${i}.ogg`),
  step_gravel: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => `footsteps/gravel/${i}.ogg`),
};

/** a small ZIP reader (the same as tools/fetch-assets.ts): no unzip binary to depend on */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("not a zip");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    p += 46 + nameLen + extraLen + commentLen;
    const dataStart = localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const raw = buf.subarray(dataStart, dataStart + compSize);
    if (method === 0) out.set(name, Buffer.from(raw));
    else if (method === 8) out.set(name, inflateRawSync(raw));
  }
  return out;
}

async function get(url: string): Promise<Buffer> {
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return Buffer.from(await r.arrayBuffer());
}

async function main(): Promise<void> {
  const packs = new Map<string, Map<string, Buffer>>();
  for (const pack of PACKS) {
    process.stdout.write(`  kenney ${pack} ... `);
    const page = (await get(`https://kenney.nl/assets/${pack}`)).toString("utf8");
    const zip = /https:\/\/kenney\.nl\/media\/pages\/assets\/[^"']+\.zip/.exec(page)?.[0];
    if (!zip) throw new Error(`no download link on the ${pack} page`);
    const files = unzip(await get(zip));
    packs.set(pack, files);
    console.log(`${files.size} files`);
  }
  process.stdout.write("  opengameart footsteps ... ");
  const steps = unzip(await get(OGA_STEPS));
  console.log(`${steps.size} files`);
  // everything fetched: only now the old files go (a failed download leaves them as they were)
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const index: Record<string, string[]> = {};
  let bytes = 0;
  for (const [name, p] of Object.entries(PICK)) {
    const files = packs.get(p.pack)!;
    index[name] = [];
    for (const f of p.files) {
      const data = files.get(`Audio/${f}.ogg`);
      if (!data) {
        console.log(`  missing: ${p.pack} ${f}`);
        continue;
      }
      const out = `${name}_${index[name].length}.ogg`;
      writeFileSync(join(OUT, out), data);
      index[name].push(out);
      bytes += data.length;
    }
  }
  for (const [name, files] of Object.entries(STEPS)) {
    index[name] = [];
    for (const f of files) {
      const data = steps.get(f);
      if (!data) {
        console.log(`  missing: footsteps ${f}`);
        continue;
      }
      const out = `${name}_${index[name].length}.ogg`;
      writeFileSync(join(OUT, out), data);
      index[name].push(out);
      bytes += data.length;
    }
  }
  writeFileSync(join(OUT, "index.json"), JSON.stringify(index, null, 1));
  writeFileSync(
    join(OUT, "..", "ATTRIBUTION.md"),
    [
      "# Sound attribution",
      "",
      "Recorded sounds from **Kenney** (www.kenney.nl), released under **Creative Commons Zero (CC0 1.0)**:",
      "commercial use permitted, attribution not required, redistribution permitted. Credited anyway.",
      "",
      "| Pack | Used for |",
      "|---|---|",
      "| Impact Sounds (kenney.nl/assets/impact-sounds) | footsteps on concrete and grass, landings, a body falling, a punch, the magazine and bolt, a gun hitting the floor |",
      "| Sci-Fi Sounds (kenney.nl/assets/sci-fi-sounds) | the frag's crunch under its synthesised boom |",
      "| Interface Sounds (kenney.nl/assets/interface-sounds) | the menu's clicks, a confirmation, an error |",
      "",
      "Footsteps on metal and gravel from **Footsteps on different surfaces** by congusbongus",
      "(opengameart.org/content/footsteps-on-different-surfaces), mastered from freesound.org originals:",
      "",
      "| Surface | Original | Licence |",
      "|---|---|---|",
      "| metal | *fboots on aluminum ladder 01* by Eelke, freesound.org/people/Eelke/sounds/462598 | CC-BY 3.0 |",
      "| gravel | *Gravel Footsteps* pack by Ali_6868, freesound.org/people/Ali_6868/packs/21608 | CC0 |",
      "",
      "Gunshots from **The Free Firearm Sound Library** (opengameart.org/content/the-free-firearm-sound-library),",
      "recorded by Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney and released CC0, \"no rights",
      "reserved, may be used without royalty or credit\". Credited anyway. Re-fetch with `npm run guns`",
      "(tools/fetch-guns.ts), which writes public/audio/guns.",
      "",
      "The drop theme is **Battle Theme A** by cynicmusic (opengameart.org/content/battle-theme-a), CC0, fetched",
      "into public/audio/music by tools/fetch-music.ts as part of `npm run sounds`.",
      "",
      "They are layered over the game's own synthesis (src/game/audio.ts), which plays alone where a file is missing.",
      "Re-fetch with `npm run sounds` (tools/fetch-sounds.ts) and `npm run guns`; the files are gitignored.",
      "",
    ].join("\n")
  );
  console.log(`\n${Object.values(index).flat().length} sounds, ${(bytes / 1024).toFixed(0)} KB, in ${OUT}`);
}

void main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
