# Phase 13 results: the README in the range

The plan is `PHASE_13_PLAN_THE_README_IN_THE_RANGE.md`. Everything in it
shipped.

## What is in the game now

**A 16 m × 6.5 m screen on the far backstop**, 107 m down the range, under a
lit **B00G'S RANGE** sign. On it is this repository's README: 22 sections,
paginated to fit, with the list of sections down the left side and the section
and page number in its header.

**It is the README, not a copy of it.** `README.md` is bundled with the build
(`README.md?raw`), parsed into sections and blocks at load, and laid out by
measuring the text against the canvas, so it paginates itself. Editing the
README is the only step needed to change what the screen says, and there is no
second copy to fall out of step.

**You turn the pages by shooting.** Four plates beside the screen:

| Plate | What it does |
|---|---|
| ◀ PAGE | the page before (from the first page: the end of the section before) |
| ▶ PAGE | the next page (past the last: the next section) |
| ▲ SECTION | the section before, at its first page |
| ▼ SECTION | the next section, at its first page |

The list of sections is shootable too: a round on a name opens that section,
which is 22 sections in one shot rather than twenty presses. Every gun, every
pellet of a shotgun, a bow's arrow and a melee punch all work, because the
plates are registered as `Shootable`s in the projectile system and go through
the same raycast a dummy or a target does. A hit gives a hit marker and a
click; it does no damage and costs no accuracy.

**Stray fire is safe.** A round anywhere else on the screen returns false from
`onHit` and stays an ordinary miss, so shooting past the target banks into the
backstop never moves the page.

**The public build** ships the README under the public build's own names.
`tools/public-text.ts` rewrites every real weapon, hop-up and game name (the
weapon data's own names first, then the short forms prose uses: "the Kraber",
"the R-301") and throws if one survives; `vite.config.ts` runs it over the raw
import in beta mode. `npm run build:beta` prints BETA CHECK PASS with the whole
README in the bundle.

## "Not R-301": the public build's gun names

Asked for while the screen was being built, and shipped in the same round. The
public build called its guns "Carbine A", "SMG A", "Heavy Sniper"; they are now
**"Not" the real name** — Not R-301, Not Kraber, Not Peacekeeper, Not Bocek.

It was said at the time and belongs in the record: "Not R-301" carries the real
name, so it is not safer in law than a class name; it points at the mark rather
than avoiding it. What keeps this project where it should be is what it is, not
what it calls things. The owner's call was the look of it, which is theirs.

The guard was therefore narrowed, not dropped:

- `tools/beta-check.ts` allows a real name **only** directly after "Not ". A
  bare "R-301" anywhere in `dist/` still fails the build, which is what stops
  an accidental leak.
- Both the check and the README scrub now match a name across a line break.
- Optics, hop-ups and the one branded heal keep their generic labels ("3x
  chevron scope", "knock recharge", "Nova kit"). The course pistol keeps a
  made-up name: its real one is a firearm brand, not a game's weapon.
- `tools/public-text.ts` renames the README's prose the same way, so the manual
  on the range's screen and the HUD agree ("the Not Kraber's 4x-8x").

## The files

| File | What changed |
|---|---|
| `src/game/readme.ts` | new: markdown → sections and blocks (headings, paragraphs, lists, fenced code, tables, **bold**, `code`, links). A four-column "Key / Action / Key / Action" table becomes two rows a line. "Contents" is dropped: the screen's own list is the contents. |
| `src/game/readmetv.ts` | new: the screen, the sign, the four arrow plates, the canvas layout and pagination, the hit routing, the test hooks |
| `src/config/readme-tv.json` | new: where it stands, how big, the plates, the layout in canvas pixels |
| `src/game/projectile.ts` | `Shootable` and `addShootable`, gathered with the dummies and targets, dispatched in `update()` and `melee()`; `ImpactEvent.shootable` |
| `src/main.ts` | builds it, registers it, the click and the hit marker, the HUD notice, the frame update, `__range.readmeTv` |
| `tools/public-text.ts` | new: the real-name table and `publicText` |
| `vite.config.ts` | `scrubReadme()` on the beta build |
| `tools/e2e.ts` | six checks in the `range` section |
| `tools/snap.ts` | `readme-tv`, `readme-tv-page` |
| `README.md` | the screen in the opening, in the Firing Range row, its own paragraph under the range's tools, the layout, the config table, How it works, the scripts |

## The bug hunt

Everything found while building it, and what was done.

| # | Found | Fix |
|---|---|---|
| 1 | The public-name rule `"the Apex "` could never match: the whole-word test forbids a letter after the pattern, and the pattern ended in a space. | The rule is `"the Apex"` → `"the game's"`. Proven by running `publicText` over the README before wiring anything up. |
| 2 | **Every shot missed the screen under `?norender`.** The renderer updates world matrices; with drawing off it never runs, so to a raycast the plates sat at the origin. The projectile system already updated the dummies' and targets' matrices for exactly this reason. | `gather()` updates each shootable mesh's world matrix too. Without this the feature would have been untestable in e2e and broken in any frame where the screen had just moved. |
| 3 | At the first size (10 m × 4.6 m, 29 px body) the text was about four screen pixels tall from ten metres: unreadable. | 16 m × 6.5 m, the body at 40 px on a 150 px/m canvas, the sign 1.4 m tall. Readable a few metres away with the naked eye and from the 100 m mark with a 3x. |
| 4 | The list of sections ran off the bottom of the screen (22 of them at a fixed line height) and over the footer. | The list scales its line height and type size to the room it has, so it fits however many sections the README grows to. |
| 5 | The first pagination pass dropped lines: pulling a subhead off the foot of a page left its lines behind. | The held lines are carried onto the next page. |
| 6 | The fog is 22% deep at 107 m, which dulled the text seen from the firing line. | The screen and the sign ignore the fog, as a lit display would. |
| 7 | The e2e punch on a section's name could not reach it: the melee is 1.8 m and the name was 3.5 m from the player once the height was counted. | The test punches the last section, low on the screen. |
| 8 | With the guns renamed "Not R-301", every replacement contained the name it replaced: a second pass turned "Not Kraber" into "Not Not Kraber", and the scrub's own final check called its own output a leak. | Both the replacement and the check skip a name that already sits behind "Not ". |
| 9 | The README wraps its prose, so a two-word name can span a line break ("the Charge" at the end of one line, "Rifle's charge" at the start of the next). Neither the scrub nor `beta-check` matched across the break, so a real name would have shipped unrenamed — and unreported. | A space in a name now matches any whitespace in both tools. It found exactly one: the Charge Rifle in the guns section. |

## Proven

| Check | Result |
|---|---|
| `npm run check` | clean |
| `npm run verify` | VERIFY PASS |
| `npm run movesim` | MOVESIM PASS |
| `npm run rules` | rules ok (165 files) |
| `npm run build:beta` | BETA CHECK PASS, with the README bundled |
| `npm run e2e` (`range`) | six new checks pass: the screen is the README, its text is the README's, ▶ turns a page, ▼ and ▲ move a section each way, a round on the page changes nothing, a punch on a name opens that section |
| `npm run snap` | `readme-tv`, `readme-tv-page` |

## What it does not do

- **No scrolling within a page.** A page is a page: the text is laid out to
  fit and the arrows step whole pages. A smooth scroll would need the canvas
  drawn to a taller texture and offset, which buys little at this size.
- **No search, no links.** The README's own links are printed as text
  (`[label](url)` becomes "label (url)"); nothing on the screen is clickable,
  because nothing in this game uses a cursor in the world.
- **It is one screen, in the range.** The arena, the courses and the battle
  royale do not have one; the range is where a player is reading rather than
  fighting.
- **Tables are flattened** to "first cell — the rest", which suits the
  README's tables (a key and what it does) but would not suit a wide grid of
  numbers.
