# PROJECT RULES (standing, mechanically checked by `npm run rules`)

This project is a browser game. It reproduces the FEEL of the Apex Legends
firing range from extracted numbers. It has no relationship to the Apex
install, EA App, Steam, or Easy Anti-Cheat, and it must stay that way.

## 1. Separation from Apex (the account must never be at risk)

- NO code, script, config or doc in this repo may reference a path under
  the Apex install, `EA Games`, `Origin Games`, `steamapps`, or
  `Saved Games\Respawn`. `npm run rules` greps for these and fails.
- We never write to any Apex file. We never read one at runtime.
- The ONE read that ever happened: a human (or Claude, on the owner's
  explicit order) read `settings.cfg` / `profile.cfg` once, by hand, to copy
  the owner's sensitivity, ADS scalars and FOV into `src/config/player.json`.
  That is a copy of four numbers, done outside this codebase.
- No DLLs, no overlays, no process hooks, no memory reads, no Apex process
  interaction of any kind. The product runs in a browser tab.
- R5Reloaded is NOT installed on this machine for this project and is not a
  dependency. The two reference clones in `..\apex-range-research` are
  read-only text used as a spec sheet by `tools/extract.ts`.

## 2. Legal line

**What is copied and what is not, stated precisely.** Copyright protects
expression, not mechanics or functional arrangement. So:

- **Replicated deliberately**: movement mechanics and their constants, weapon
  behaviour and its constants, recoil, time to kill, hit zones, the shape and
  layout of a firing range. These are systems and facts. A browser clone of a
  car-football game replicates that game's arena, boost and car physics on the
  same basis.
- **Never copied**: the game's own art files (models, textures, sounds, fonts,
  icons), its UI resource files, its script code, its logos and wordmarks, and
  any character likeness. All art in this project is either generated in code
  or CC0 (see `public/tex/ATTRIBUTION.md`).

The distinction is not about how close the result looks. It is about whether
the bytes came from someone else's asset files.

- Numbers extracted from the reference files (damage, RPM, mags, reload,
  ADS, spread, recoil tables, projectile speed) are facts and ship as our own
  `data/weapons.json`.
- NEVER copy into this repo: Respawn/R5 script code (.nut/.gnut), models,
  textures, sounds, fonts, icons, map geometry, UI .res/.menu files,
  localization strings, or any EA logo/branding.
- Weapon display names are real while the project is private. A single
  mapping in `src/config/names.ts` swaps them to codenames before any public
  URL.

## 3. Engineering

- Vite + TypeScript + Three.js. Own collision, own audio, own art.
- Every gameplay constant comes from `data/weapons.json` or
  `src/config/*.json`, never a literal in game code, so a patch-note change
  is a data edit.
- Fidelity gaps are documented in `docs/FIDELITY.md` with the source of each
  substitute number.
