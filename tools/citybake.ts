// The Neon City's files a release ships, checked before it goes and after it is live (Milestone 628).
//
// 2026-10-17: a deploy packed the release while another agent was still copying the new map version's files into
// apex-range, so the release went out without the High file (or with part of it), and the live check, which plays a
// 1v1 in an arena, never asked for the city. The owner dropped into a battle royale on High and the map was not
// there. A release now refuses to go unless every kit of the committed map version (lo, hi, max) is on disk whole: a
// GLB file says its own length in its header, so a copy still being written is caught. After a deploy the live check
// asks the site for each kit's header and holds it to the same.
import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from "node:fs";
import { join } from "node:path";

export const CITY_KITS = ["lo", "hi", "max"] as const;

/** the committed map version (src/config/neonmap.json) */
export function cityVersion(root: string): number {
  return (JSON.parse(readFileSync(join(root, "src", "config", "neonmap.json"), "utf8")) as { version: number }).version;
}

/** where a kit's file is, under the site's root */
export const cityFile = (version: number, kit: string): string => `models/paid/neon/neonmap-v${version}-${kit}.glb`;

/** a GLB's first 12 bytes: "glTF", its version, and the whole file's length; what is wrong with them, or null */
export function glbHeaderProblem(head: Uint8Array, size: number): string | null {
  if (head.length < 12) return `${head.length} bytes, not a GLB header`;
  const magic = String.fromCharCode(head[0], head[1], head[2], head[3]);
  if (magic !== "glTF") return `starts "${magic.replace(/[^\x20-\x7e]/g, "?")}", not "glTF"`;
  const said = new DataView(head.buffer, head.byteOffset, 12).getUint32(8, true);
  if (said !== size) return `its header says ${said} bytes and there are ${size} (a copy cut short, or still being written)`;
  return null;
}

/** a GLB under `siteRoot` at `file` (the site's own path), whole: what is wrong with it, or null */
function glbFileProblem(siteRoot: string, file: string): string | null {
  const f = join(siteRoot, file);
  if (!existsSync(f)) return `${file} is missing`;
  const size = statSync(f).size;
  const head = new Uint8Array(12);
  const fd = openSync(f, "r");
  try {
    readSync(fd, head, 0, 12, 0);
  } finally {
    closeSync(fd);
  }
  const p = glbHeaderProblem(head, size);
  return p ? `${file}: ${p}` : null;
}

/** every kit of `version` under `siteRoot` (the folder holding models/), whole; the problems, none when it can ship */
export function cityBakeProblems(siteRoot: string, version: number): string[] {
  return CITY_KITS.map((kit) => glbFileProblem(siteRoot, cityFile(version, kit))).filter((p): p is string => p !== null);
}

/** the tutorial's dressing (Milestone 634, tools/tutorial-dress.ts): its committed version (src/config/tutorialdress.json) */
export function tutorialVersion(root: string): number {
  return (JSON.parse(readFileSync(join(root, "src", "config", "tutorialdress.json"), "utf8")) as { version: number }).version;
}
/** where its file is, under the site's root */
export const tutorialFile = (version: number): string => `models/paid/neon/tutorial-v${version}.glb`;
/** that file under `siteRoot`, whole; the problems, none when it can ship */
export function tutorialDressProblems(siteRoot: string, version: number): string[] {
  const p = glbFileProblem(siteRoot, tutorialFile(version));
  return p ? [p] : [];
}

/** the tutorial's dressing on the live site, held as the city's kits are (liveCityProblems) */
export async function liveTutorialProblems(base: string, version: number, localSite?: string): Promise<string[]> {
  return liveGlbProblems(base, tutorialFile(version), version, "the tutorial's dressing", localSite);
}

async function liveGlbProblems(base: string, file: string, version: number, name: string, localSite?: string): Promise<string[]> {
  const out: string[] = [];
  const url = `${base.replace(/\/?$/, "/")}${file}?v=${version}`;
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-11" } });
    const type = r.headers.get("content-type") ?? "";
    const range = /\/(\d+)$/.exec(r.headers.get("content-range") ?? "");
    const size = range ? Number(range[1]) : Number(r.headers.get("content-length") ?? 0);
    const head = new Uint8Array(await r.arrayBuffer()).slice(0, 12);
    if (!r.ok) out.push(`${name}: ${r.status}`);
    else if (/text\/html/.test(type)) out.push(`${name}: answered with a page, not the file`);
    else {
      const p = glbHeaderProblem(head, size);
      if (p) out.push(`${name}: ${p}`);
      const local = localSite ? join(localSite, file) : null;
      if (local && existsSync(local) && statSync(local).size !== size) out.push(`${name}: ${size} bytes live, ${statSync(local).size} here`);
    }
  } catch (e) {
    out.push(`${name}: ${String((e as Error).message ?? e)}`);
  }
  return out;
}

/** the same of the live site: each kit's header asked for over HTTP, held to the file's own length and type */
export async function liveCityProblems(base: string, version: number, localSite?: string): Promise<string[]> {
  const out: string[] = [];
  for (const kit of CITY_KITS) {
    const url = `${base.replace(/\/?$/, "/")}${cityFile(version, kit)}?v=${version}`;
    try {
      const r = await fetch(url, { headers: { Range: "bytes=0-11" } });
      const type = r.headers.get("content-type") ?? "";
      // the whole file's length: a range answer says it after the slash, a whole answer in its own length
      const range = /\/(\d+)$/.exec(r.headers.get("content-range") ?? "");
      const size = range ? Number(range[1]) : Number(r.headers.get("content-length") ?? 0);
      const head = new Uint8Array(await r.arrayBuffer()).slice(0, 12);
      if (!r.ok) out.push(`${kit}: ${r.status}`);
      else if (/text\/html/.test(type)) out.push(`${kit}: answered with a page, not the file`);
      else {
        const p = glbHeaderProblem(head, size);
        if (p) out.push(`${kit}: ${p}`);
        const local = localSite ? join(localSite, cityFile(version, kit)) : null;
        if (local && existsSync(local) && statSync(local).size !== size) out.push(`${kit}: ${size} bytes live, ${statSync(local).size} here`);
      }
    } catch (e) {
      out.push(`${kit}: ${String((e as Error).message ?? e)}`);
    }
  }
  return out;
}
