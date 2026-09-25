// itch.io's own free-download flow, for Quaternius's CC0 packs: three
// requests and no account. The page (for a CSRF token), a POST for a signed
// download-page URL, and a POST to that page's file endpoint for the storage
// URL. The zip is kept in the temp folder, so a second run fetches nothing.
// Used by tools/fetch-characters.ts and tools/fetch-clips.ts.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

export function itchZip(slug: string, upload: number): Buffer {
  const sh = (cmd: string): string => execFileSync("bash", ["-lc", cmd], { encoding: "utf8", maxBuffer: 1 << 28 }).trim();
  const jar = `${process.env.TEMP ?? "/tmp"}/itch-${slug}.jar`;
  const page = `${process.env.TEMP ?? "/tmp"}/itch-${slug}.html`;
  sh(`curl -sL -c '${jar}' 'https://quaternius.itch.io/${slug}' -o '${page}'`);
  const tok = sh(`grep -oE 'name="csrf_token" value="[^"]+"' '${page}' | head -1 | sed 's/.*value="//;s/"//'`);
  if (!tok) throw new Error(`${slug}: no csrf token`);
  const url = sh(`curl -s -b '${jar}' -c '${jar}' -X POST 'https://quaternius.itch.io/${slug}/download_url' -d 'csrf_token=${tok}' | python -c "import sys,json;print(json.load(sys.stdin)['url'])"`);
  const dl = `${process.env.TEMP ?? "/tmp"}/dl-${slug}.html`;
  sh(`curl -sL -b '${jar}' -c '${jar}' -o '${dl}' '${url}'`);
  const tok2 = sh(`grep -oE 'name="csrf_token" value="[^"]+"' '${dl}' | head -1 | sed 's/.*value="//;s/"//'`);
  const file = sh(
    `curl -s -b '${jar}' -c '${jar}' -X POST 'https://quaternius.itch.io/${slug}/file/${upload}?source=game_download' --data-urlencode 'csrf_token=${tok2}' -H 'X-Requested-With: XMLHttpRequest' -H 'Referer: ${url}' | python -c "import sys,json;print(json.load(sys.stdin)['url'])"`
  );
  const zip = `${process.env.TEMP ?? "/tmp"}/${slug}.zip`;
  if (!existsSync(zip)) sh(`curl -sL -o '${zip}' '${file}'`);
  return readFileSync(zip);
}
