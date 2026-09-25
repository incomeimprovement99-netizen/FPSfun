# Do the tests catch bugs? An audit

**Written 2026-09-25**, Phase 17 item 17.15. The owner: "we need to do a bug hunt here, analyze our tests to see
if they really are preventing bugs."

## What there is

| Suite | Size | Runs | What it proves |
|---|---|---|---|
| `npm run verify` | 601 numeric checks in `tools/verify.ts`, 1,000+ more across 40 files in `tools/checks/`, and `tools/movesim.ts` (155) | on every change, by hand | that numbers, rules and pure functions are what they should be: gun stats, movement, loot tiers, ring placement, netcode deltas, the body's measurements |
| `npm run rules` and the beta check | every source file | on every change, and the beta check again inside the public build | no real game names in the public build, no literal gameplay numbers, the house style |
| `tools/e2e.ts` | 603 checks in 30 sections, three batches, real headless browsers on a real network | before every release, by hand | that the game works end to end: a match, a hit, a revive, a drop, host migration, loot, two builds talking to each other |
| `tools/snap.ts` | 127 scenarios | when something is visual, by hand | pictures, for a person to look at |
| the deploy's live check | a real 1v1 over the live server | after every server deploy | that what shipped works |

## Where this month's bugs were found

Counted from Phases 16 and 17 (2026-09-21 to 25), every bug fixed, and who or what found it.

| Bug | Found by | Would a test catch it now? |
|---|---|---|
| Clothes built out of capsules and boxes ("Roblox shapes") | the owner | no test can say "ugly"; the rule that nothing code-built is worn is now a check |
| A belt on a bare chest: only a garment file's first mesh worn | a snapshot | no |
| Bare backs: the cloth cut for a body the free tier does not ship | the owner, then a snapshot | partly: the sleeve fit is measured now (`body.ts`), the torso is not |
| Figures stuck as grey robots: garments on the blocking load | the e2e ("no spine_03") | yes |
| Eleven grey atlases (`.tint()` after `.greyscale()`) | the owner | no |
| The recoloured atlases never reached a figure | the owner | no |
| 404s for nine atlases never made | the e2e's page-error check | yes |
| The Loadouts figure showing its back and no head | the owner | no |
| A rifle stock through the shoulder | the owner | no |
| Every figure bald: four hair meshes never worn | an audit of what was on disk | yes now (`outfit.ts`) |
| White hair: the pack's hair is a grey mask | a snapshot | yes now (a colour per outfit) |
| One black face per lineup: bodies painted in the shell colour | a snapshot | no |
| Heads 29% narrow | a snapshot | no |
| Shoulders through the sleeve | a snapshot, then a measurement | yes now (`body.ts` measures the arm against every sleeve) |
| Skin at every seam | a snapshot (the magenta diagnostic) | no |
| A garment in another pack's seams (one atlas per outfit) | a snapshot | no |
| The first-person left arm a ribbon to the horizon (a reflected hand frame) | a snapshot | no |
| A forearm five times its size (scale compounding per frame) | a snapshot | no |
| The real arms never loading (retries counted in frames) | a probe | yes now (e2e `page`) |
| Throw and melee clips overridden by the rifle hold's IK | a snapshot | no |
| The test handle dropping the mode card's words | a snapshot | no |
| An e2e check that assumed the pouch always had room | the e2e | yes |
| A verify check holding a stale number (120 rounds) | verify | yes |

**The pattern is plain.** Of twenty-three bugs, the owner found six, snapshots found eleven, and the
automated suites found five. Almost nothing visual was caught by an assertion: the snapshot tool reports
`SNAP PASS` whenever the page threw no error, whatever the picture shows, so every one of those eleven was
caught by a person reading a picture, and would be missed by anyone who did not.

## What the tests get wrong

1. **The pictures assert nothing.** 127 scenarios, and a pass means only "no page error". The most useful
   diagnostic this month was painting the body magenta and looking for it through the clothes, which a
   program can count as easily as a person can see.
2. **Two checks pass when the thing they check is missing.** The recorded-sound and recorded-gunshot checks
   pass if the files are absent, so a release from a checkout that never ran `npm run sounds` or
   `npm run guns` would ship the synthesis with a green run.
3. **Three checks flake, and flaking has become normal.** BR host migration fails about one run in two; the
   bot tier checks fail in a full batch and pass alone, with the same numbers every time, which is a
   deterministic interaction rather than chance; and on 2026-09-25 the dropship's "a bot whose place is in
   a glide's reach lands on it" failed in the full batch and passed alone twice. Every release since has shipped "with the known flakes",
   which is how a real failure gets waved through.
4. **Nothing gates a release but discipline.** `npm run deploy` and `npm run fps deploy` build and ship
   without running verify; the live check runs after the ship.
5. **Some checks test the config rather than the game.** A check that `intro.json`'s flash is at most 0.45
   holds the owner's number in place, which is worth having, but it would pass if the drawing stopped
   reading the config. These are fine as guards and are not evidence the feature works.

## The fixes, ranked

| # | Fix | Why |
|---|---|---|
| 1 | **Pictures that assert.** A scenario can carry a check on its own image. First: the fit test, the magenta diagnostic automated: the body painted magenta, the figures shot front and back, and the share of the frame that is body showing through clothes counted and held under a limit | the class of bug the owner has reported most, caught without anyone looking |
| 2 | **No vacuous passes.** The sound checks fail when the files are missing | a green run means the release has its sounds |
| 3 | **A gate before a deploy.** Both deploys run `verify` and `rules` first and stop on a failure | the cheapest guard there is, and the one most likely to be skipped at the end of a long day |
| 4 | **The two flaky checks fixed at their cause** (Phase 17 item 17.9) | a suite with known flakes teaches everyone to ignore red |
| 5 | **Behaviour next to config.** Where a check reads a number from config, a companion checks the game uses it (the intro's drawn flash, not only its setting) | a check that cannot fail when the feature breaks is not a test of the feature |
