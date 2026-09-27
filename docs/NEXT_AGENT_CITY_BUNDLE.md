# Next agent: build SpeedKills' city with the bundle the owner bought

**Written 2026-09-27, at the handoff after Milestone 251.** Paste the prompt below into a fresh Claude Code session
in `C:\Users\jwilb\Downloads\apex-range`, or point the session at this file.

---

## The prompt

You are picking up SpeedKills, a browser FPS (three.js, TypeScript, Vite) in `C:\Users\jwilb\Downloads\apex-range`.
Your job is the **environment**: build the city, starting with its vertical centre, from the city asset bundle the owner bought
(about $25 in total, 2026-09-27). Read `CLAUDE.md` first; its rules bind you. The owner has another agent writing a
doc on how to implement this bundle: **ask the owner where that doc is and read it before you start**, and where it
and this file disagree, it wins.

### Where things stand

- **main is at Milestone 251, deployed** to the game server (fpsfun.duckdns.org) and to Pages. The bought guns and
  soldier are in:
  - one model a gun, and their own parts animated;
  - every gun aimed down its own sights;
  - the first-person hands drawn at the glove's size.
- **Work in a worktree on a branch**, as the last agent did (`apex-soldier`, branch `soldier`, vite on 5196). main in
  `apex-range` (vite 5195) is the release copy. Commit in the worktree, rebase, then `git merge --ff-only` into main.
- **Do not research or suggest other city packs.** The owner chose this bundle. The Daelonik Neon City pick in the
  plan could not be bought and is replaced.

### Find the bundle

- The files are not in the repo. Look in:
  - `%APPDATA%\Unity\Asset Store-5.x\<publisher>\...\*.unitypackage` (Unity Asset Store downloads land here);
  - `C:\Users\jwilb\Downloads`;
  - `C:\Users\jwilb\Downloads\speedkills-paid\`, where the receipts and licences go.
- If none is there, ask the owner where it downloaded, and keep a copy of its licence page in
  `speedkills-paid\licences`.
- As of this handoff, only the two earlier packs were in the Unity cache: Tirgames' Sci-Fi Battle Weapons and AC
  Game Assets' Sci-Fi Modular Soldier.

### How the last two packs were brought in (follow the same road)

- **Unpacking.** A `.unitypackage` is a gzipped tar of GUID folders, each holding a `pathname` and an `asset`. It is
  unpacked with tar into `speedkills-paid\extract\<pack>`, with no Unity Editor. A Unity project exists at
  `speedkills-paid\unity\speedkills-import` for anything that truly needs the Editor.
- **Conversion.** `tools/import-paid.ts` (`npm run paid`) runs FBX2glTF, then glTF-Transform (prune, merge, meshopt),
  then sharp for the textures. It writes GLBs and WebP textures into `public/models/paid/<pack>/`, which is gitignored.
  Extend it for the city bundle; do not write a second pipeline.
- **Materials.** These are rebuilt at run time as `MeshStandardMaterial` from the textures (see `paidgun.ts`
  skinMaterial and `soldier.ts`). Unity's custom shaders do not export. Neon goes on emissive, with the game's bloom.
- **Measure, do not guess.** Every size, height and offset the code uses is measured off the model by a check and
  written to config with the measurement. The precedents are `tools/checks/paid-weapons.ts`, which writes
  `src/config/paidmodels.json`, and `tools/checks/soldier.ts`. Two faults came from numbers typed in by eye.
- **The fallback.** The game must still run without the paid files: verify, e2e and the Pages build all run without
  them. Every paid model needs a free fallback, and today's city is that fallback.

### Paid files: the hard rules (plan section 5.2)

- **Never in git and never on Pages.** `npm run rules` and `tools/release-gate.ts` refuse a tracked paid path, and
  `npm run deploy` strips them.
- **Where they ship.** They go only to the game server, with `npm run fps deploy`.
- **Local tools only.** Agents touch the files with tar, FBX2glTF, glTF-Transform, sharp and three.js. Never upload
  them anywhere, and never paste their bytes into a prompt.

### The design to build

`docs/PHASE_21_PLAN_THE_VERTICAL_CENTRE.md` holds the design:
- section 1: today's city, measured;
- section 2: the targets, and the five levels (street, concourse at 8 m, sky lobby at about 32 m, sky park at about
  64 m, crowns at 96 to 120 m, the Spire at 140 to 160 m);
- section 2.3: jump pads, stairs inside the towers, skybridges and ziplines;
- section 2.4: performance.

In the code:
- the city is `src/game/city.ts` with `src/config/city.json`;
- the city checks are `tools/checks/city-levels.ts` (standing room by height band, the plan's targets),
  `city-budget.ts`, `sk-roofs.ts`, `sk-roofrun.ts` and `sk-chimneys.ts`.

### Performance (a browser, 30 players)

- One InstancedMesh per kit piece type, and static pieces merged per block.
- Interiors drawn only for the tower you are in or next to.
- Tower shells with LODs, and the far skyline as impostors.
- Textures at 1K WebP, 2K only for hero pieces, never 4K.
- Measure frame time and draw calls in the centre, before and after, by medians over interleaved runs. The machine
  is often loaded by the owner and by agents; see the memory on benches.

### Testing, kept light unless asked

- `npm run verify` and `npm run rules` on every change.
- For pictures, headless puppeteer with `--use-angle=d3d11`, like `tools/weapon-sheet.ts`, never the real mouse or
  keyboard: the webdriver guard in `input.ts` stays.
- The e2e (`tools/e2e.ts`, sections through `E2E_ONLY`) draws on the CPU (swiftshader), at a few frames a second. Wait
  on game time (`__range.gameTime()`), not on real time.
- The full three-batch gate (`$TEMP/run-e2e.sh`) takes about 40 minutes. The owner asked for minimal testing at this
  handoff; ask before running it.

### Release

1. Commit, fast-forward main and push.
2. `npm run fps backup`.
3. `npm run fps deploy`, which prints a LIVE CHECK.
4. `npm run deploy` for Pages, which prints `== LIVE:` or `== NOT LIVE:`.

Document each shipped item as a Milestone in `docs/DEVELOPMENT_ROADMAP.md` (the next is 252), with a diary entry in
`docs/updates/<date>.md`, and keep the README true.

### Never

- Touch the Algonomics VM (147.224.132.60). It runs a live real-money trader. The game's server is the separate box
  at fpsfun.duckdns.org.
- Put real game names in the public build (`npm run rules`, `tools/beta-check.ts`).
- Commit the owner's untracked files: `.map-expansion.js`, `9.19.26-PROGRESS.MD` and `docs/updates/temp.txt`.

### Open items left at this handoff (not the city's, but worth knowing)

- **The rifle's scope rim.** The rifle's own scope has its glass cut out on the gun in hand (`paidgun.ts`
  openLenses). From the eye its rim reads thinner than from outside; the owner may want it looked at.
- **The bug hunt of the soldier and guns** was paused by the owner. Third-person hand placement on the ten bought
  guns has had only a far look.
- **The full e2e gate** has not run since Milestone 249. Batch 1 passed on Milestone 250; Milestones 250 and 251 went
  out on verify, rules and the soldier section, at the owner's word.
- **The bot looter fix** (bots that land more than 45 m from loot set no goal) waits for the owner's decision.
