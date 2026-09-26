// Vite config.
//
// `npm run build:beta` builds in "beta" mode, the public build:
//   - __PUBLIC_BUILD__ is true, which switches every weapon and optic name to
//     its codename (src/config/names.ts), as PROJECT_RULES.md section 2 asks
//     of anything on a public URL;
//   - the bundled JSON is scrubbed: the real weapon names in data/weapons.json
//     are replaced by the weapon ids, and every "_note"-style key in the
//     config files (they cite sources by name) is dropped.
//   `tools/beta-check.ts` then fails if any real weapon name is left in dist/.
//
// `base: "./"` makes every path relative, so dist/ works from any folder of
// any static host (GitHub Pages serves a project from /<repo>/).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { publicText } from "./tools/public-text";

const ROOT = fileURLToPath(new URL(".", import.meta.url));

/**
 * README.md is bundled (the range's README screen, src/game/readmetv.ts).
 * On the public build every real name in it becomes the codename the game
 * itself shows, before it is ever written into dist/.
 */
function scrubReadme(): Plugin {
  return {
    name: "scrub-readme",
    enforce: "pre",
    load(id) {
      const file = id.replace(/\\/g, "/");
      if (!file.endsWith("/README.md?raw")) return null;
      const md = readFileSync(file.slice(0, -"?raw".length), "utf8");
      return `export default ${JSON.stringify(publicText(md, ROOT))};`;
    },
  };
}

function scrubForPublic(): Plugin {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      // "_note" keys cite sources; *printname fields are the game's own names
      for (const [k, x] of Object.entries(v)) if (!k.startsWith("_") && !/printname$/i.test(k)) out[k] = strip(x);
      return out;
    }
    return v;
  };
  return {
    name: "scrub-for-public",
    enforce: "pre",
    transform(code, id) {
      const file = id.replace(/\\/g, "/");
      if (!file.endsWith(".json") || file.includes("/node_modules/")) return null;
      const data = strip(JSON.parse(code)) as { weapons?: Record<string, { name?: string }> };
      if (file.endsWith("/data/weapons.json") && data.weapons) {
        for (const [wid, w] of Object.entries(data.weapons)) w.name = wid;
      }
      return { code: JSON.stringify(data), map: null };
    },
  };
}

export default defineConfig(({ mode }) => {
  const beta = mode === "beta";
  return {
    base: "./",
    // the game a page opens in when neither the URL nor the browser says (src/game/game.ts)
    define: { __PUBLIC_BUILD__: JSON.stringify(beta), __DEFAULT_GAME__: JSON.stringify(process.env.DEFAULT_GAME ?? "legacy") },
    plugins: beta ? [scrubForPublic(), scrubReadme()] : [],
    build: { chunkSizeWarningLimit: 2000 },
  };
});
