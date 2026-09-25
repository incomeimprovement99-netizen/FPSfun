# Phase 16: real cloth, and the body under it

**Written 2026-09-24.** The results of `docs/PHASE_16_PLAN_REAL_CLOTH_AND_THE_BODY.md`. Everything here is
on `main` and live at https://fpsfun.duckdns.org/ and on Pages; the last release served
`assets/index-DgIhjG-O.js` and passed the game server's live check.

## Shipped

| Id | Item | Milestone | State |
|---|---|---|---|
| 16.1 | A wardrobe with a picker | 159 | done |
| 16.2 | The body measured, not guessed | 159, 160 | done |
| 16.3 | Real bodies and real clothes | 164, 165 | done |
| 16.4 | Our geometry off | 166, 167 | done |
| 16.5 | Each outfit its own colour | 167 | done; one atlas per outfit and pack since 168 |
| 16.6 | The Loadouts figure | 167 | done |
| 16.7 | Clothes that cover the body | 168 | done |
| 16.8 | Hair | 168 | done |
| 16.9 | Twenty outlines | 168 | done; sixteen since the body became its own pick (169) |
| 16.10 | The free pool, searched | 168 | done; Mixamo waits on the owner's token |
| 16.11 | A body to pick, a build that works | 169 | done |
| 16.12 | The seams | 169 | done |

Alongside, and in the same milestones: movement identical at 30, 60, 144 and 240 fps (161), dash counts and
the other ability numbers set per match (162), gun finishes open to everyone (162), the reload bar moved to
the middle of the screen (167), and the rifle's stock off the shoulder of the new body (167).

## What went wrong, and what it taught

Every one of these was found in a snapshot and none in the code, which is why this phase added fourteen
snapshot scenarios and the owner's "ensure you get screenshots" is now how fit work is done.

- **Code-built clothes.** The first wardrobe was capsules and boxes. The owner's word was Roblox. Published
  assets only, from then on, with the code kept as a tested fallback nobody sees.
- **The figures stayed robots.** Fifteen megabytes of garments sat in the mannequin's blocking load; the
  body became an upgrade and the parts lazy.
- **Grey tints, then no tints.** `.tint()` after `.greyscale()` does not colourise; the atlas load sat in a
  loop a cold page never reached; nine outfits asked for atlases that did not exist.
- **Bare backs and belts on bare chests.** A garment file holds several meshes and only the first was worn;
  and the cloth is cut for a body the free tier does not ship (Regular against Superhero, 424 mm across the
  shoulders). The torso is narrowed to the cloth; the arms are left out of it, because narrowing them
  fanned the hands.
- **Bald heads.** Four hair meshes had been downloaded weeks earlier and worn by nobody; and the pack's
  hair is a grey mask the engine is meant to colour.
- **One black face per lineup.** Every body was painted in the operator's shell colour, a leftover from the
  grey mannequin.
- **Heads 29% narrow.** The narrowing never eased back out above the shoulders.
- **Shoulders through the sleeve.** The upper arm is 101 to 104 mm from the bone and the sleeves are cut
  for 60 to 69; measured, brought in to 0.8, and checked against every sleeve.
- **Skin at every seam.** No shape closes them all; a dark undersuit makes a seam read as fabric.

## Left for the next phase

- The Mixamo import needs the owner's Adobe token (`npm run mixamo` already lists all 108 characters).
- Gloves: no free glove fits this rig.
- Real cloth texture instead of a recoloured atlas.
- The e2e checks for BR host migration (passes about one run in two) and bot tiers (fail in a full batch,
  pass alone): both predate this phase.

The next round is `docs/PHASE_17_PLAN_FEEL_ANIMATION_AND_THE_WORLD.md`.
