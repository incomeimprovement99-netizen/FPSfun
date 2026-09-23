// What Adobe's Mixamo has, and how to get it.
//
// The wardrobe is two fantasy garment sets because that is the whole of what
// is free from the author whose rig we use (docs/SKIN_GAP.md counts it).
// Mixamo is the one free source left that is bigger, and it is much bigger:
// 108 rigged characters, free for unlimited commercial use with no royalty
// and no attribution, and among them the swat, gas mask, coveralls and
// sixty-odd men and women in t-shirts and jackets that this game has been
// asking for since the first outfit went in.
//
// Two halves, and only one of them needs anything from anybody:
//
//   npm run mixamo            lists the catalogue and writes the manifest
//   MIXAMO_TOKEN=... npm run mixamo <name>...   downloads those characters
//
// The list endpoint answers without a login. The export endpoint does not:
// it wants an Adobe OAuth bearer token, which is the `authorization` header
// on any request mixamo.com makes once you are signed in. Paste it into
// MIXAMO_TOKEN and the second half runs.
//
// What comes down is FBX, which is what Mixamo exports. Converting it and
// renaming its bones onto our rig is the next step and it is deliberately not
// written yet: the mapping is a one-liner per bone (mixamorig:Hips is pelvis,
// Spine1 is spine_02, LeftArm is upperarm_l) but writing a converter against
// a file nobody has yet is how you get a converter that does not work.
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const API = "https://www.mixamo.com/api/v1";
const KEY = "mixamo2";
const OUT = resolve(process.cwd(), "assets", "mixamo");

interface Character {
  id: string;
  name: string;
  character_type?: string;
}

function headers(auth: boolean): Record<string, string> {
  const h: Record<string, string> = {
    "X-Api-Key": KEY,
    "Content-Type": "application/json",
  };
  const t = process.env.MIXAMO_TOKEN;
  if (auth && t) h.Authorization = t.startsWith("Bearer ") ? t : `Bearer ${t}`;
  return h;
}

/** every character in the catalogue, in the order Mixamo lists them */
async function catalogue(): Promise<Character[]> {
  const out: Character[] = [];
  for (let page = 1; ; page++) {
    const r = await fetch(
      `${API}/products?page=${page}&limit=96&type=Character`,
      { headers: headers(false) },
    );
    if (!r.ok) throw new Error(`catalogue page ${page}: HTTP ${r.status}`);
    const body = (await r.json()) as {
      results: Character[];
      pagination: { num_pages: number };
    };
    out.push(...body.results);
    if (page >= body.pagination.num_pages) break;
  }
  // the same character is listed twice in places, and an id is the identity
  const seen = new Set<string>();
  return out.filter((c) => !seen.has(c.id) && seen.add(c.id));
}

/**
 * Ask for one character as FBX and wait for it.
 *
 * Mixamo builds the file rather than serving one off a shelf, so the export
 * is a request and then a poll: the monitor answers `processing` until it
 * answers `completed` with somewhere to fetch it from.
 */
async function download(c: Character): Promise<string> {
  const body = {
    character_id: c.id,
    type: "Character",
    product_name: c.name,
    preferences: { format: "fbx7", skin: "true", fps: "30", reducekf: "0" },
  };
  const r = await fetch(`${API}/animations/export`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify(body),
  });
  if (!r.ok)
    throw new Error(`${c.name}: export HTTP ${r.status} ${await r.text()}`);
  for (let tries = 0; tries < 60; tries++) {
    await new Promise((f) => setTimeout(f, 2000));
    const m = await fetch(`${API}/characters/${c.id}/monitor`, {
      headers: headers(true),
    });
    if (!m.ok) throw new Error(`${c.name}: monitor HTTP ${m.status}`);
    const s = (await m.json()) as {
      status: string;
      job_result?: string;
      message?: string;
    };
    if (s.status === "completed" && s.job_result) {
      const file = await fetch(s.job_result);
      if (!file.ok) throw new Error(`${c.name}: fetch HTTP ${file.status}`);
      const name = `${c.name.replace(/[^A-Za-z0-9]+/g, "_")}.fbx`;
      writeFileSync(resolve(OUT, name), Buffer.from(await file.arrayBuffer()));
      return name;
    }
    if (s.status === "failed")
      throw new Error(`${c.name}: ${s.message ?? "export failed"}`);
  }
  throw new Error(`${c.name}: still building after two minutes`);
}

async function main(): Promise<void> {
  const want = process.argv.slice(2).map((s) => s.toLowerCase());
  const all = await catalogue();
  console.log(
    `${all.length} characters, free for unlimited commercial use (helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)\n`,
  );
  if (!want.length) {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      resolve(OUT, "catalogue.json"),
      JSON.stringify(
        all.map((c) => ({ id: c.id, name: c.name })),
        null,
        2,
      ) + "\n",
    );
    for (const c of all) console.log(`  ${c.name}`);
    console.log(`\nwritten to assets/mixamo/catalogue.json`);
    console.log(
      `to fetch: MIXAMO_TOKEN=<bearer from a signed-in mixamo.com request> npm run mixamo "Swat Guy" "Gas Mask"`,
    );
    return;
  }
  const picked = all.filter((c) =>
    want.some((w) => c.name.toLowerCase().includes(w)),
  );
  if (!picked.length) {
    console.log(`nothing matches ${want.join(", ")}`);
    process.exitCode = 1;
    return;
  }
  if (!process.env.MIXAMO_TOKEN) {
    console.log(
      `${picked.length} would be fetched: ${picked.map((c) => c.name).join(", ")}`,
    );
    console.log(
      `MIXAMO_TOKEN is not set, so nothing was. The export endpoint is the only part that needs it.`,
    );
    process.exitCode = 1;
    return;
  }
  mkdirSync(OUT, { recursive: true });
  for (const c of picked) {
    try {
      console.log(`  ${c.name} -> ${await download(c)}`);
    } catch (e) {
      console.log(`  ${c.name}: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
}

void main();
