# Phase 13 plan: the README in the range

**Asked for**, in the owner's words:

> Make sure the readme is updated and that we can see the readme in the firing
> range near the end and can scroll through the tv pages and sections by
> shooting an Aarow near the tv. It explains all of what it is and what
> features we have, above it should say B00G's range

## What that means

1. **README.md current.** It had not caught up with Control (the mode was in
   the table but not the opening line) and says nothing about the screen.
2. **A screen in the range, near the far end**, showing what the project is
   and every feature it has.
3. **Paged by shooting**: arrows beside the screen step the pages and the
   sections.
4. **"B00G's range" above it.**

## The decisions

| Question | Answer, and why |
|---|---|
| A written-out copy of the features, or the README itself? | **The README itself.** `README.md?raw` is bundled with the build and parsed at load (`src/game/readme.ts`), so the screen cannot drift from the file: the next edit to the README is on the wall in the range with no second place to keep in step. It is also exactly "see the readme in the firing range". |
| Where? | The **far backstop** (z = −106.75), the 107 m end of the range. Nothing was on that wall but the kick plate, the back of the range is otherwise empty, and it gives the run down range a destination. |
| How big? | **16 m × 6.5 m**, a stadium screen. Anything smaller cannot be read: a 30 px line on a 5 m panel is about two screen pixels from the firing line. At this size the text reads from a few metres away without an optic, and from the 100 m mark with a 3x on. |
| The sign | **B00G'S RANGE** in lit letters on its own board above the screen, with a line under it saying what the screen is. Its material ignores the fog so it reads from the firing line, which is where most players will see it first. |
| The arrows | Four plates, 2.2 × 1.9 m, beside the screen: ◀ ▶ a page, ▲ ▼ a section. Big enough to hit from down range, far enough from the screen that a round meant for one is not a round on the other. |
| How a shot reaches them | A new `Shootable` in the projectile system (`addShootable`), gathered with the dummies and the targets. Every gun, every pellet, an arrow and a melee punch already run through that raycast, so all of them work with no special cases. |
| Stray fire | A round anywhere on the page itself does **nothing** (`onHit` returns false and it stays an ordinary miss). Only the arrow plates and the list of sections react, so shooting past the target banks never moves the page. |
| The public build | The README carries real names. `tools/public-text.ts` rewrites every one of them to the codename the game itself shows, and vite.config.ts runs it over `README.md?raw` in beta mode, so `tools/beta-check.ts` still passes. |
| Extra | The list of sections down the left of the screen is shootable too: a round on a name opens that section. It is the contents page, and it means 22 sections are one shot away instead of twenty presses. |

## The work

1. `tools/public-text.ts`: the real-name table and `publicText`, with a check
   that throws if a name survives it.
2. `vite.config.ts`: `scrubReadme()` on the beta build.
3. `src/game/readme.ts`: README.md → sections and blocks (headings,
   paragraphs, lists, fenced code, tables, **bold**, `code`, links).
4. `src/game/readmetv.ts`: the screen, the sign, the four arrow plates, the
   canvas layout (measured, so it paginates itself), the hit routing.
5. `src/config/readme-tv.json`: where it stands, how big, and its layout.
6. `src/game/projectile.ts`: `Shootable`, `addShootable`, dispatch in both
   `update()` and `melee()`.
7. `src/main.ts`: build it, register it, the click and the hit marker, the
   frame update, the `__range` hook.
8. Tests: six e2e checks in the range section, two snap scenarios.
9. Docs: README, this plan, the results, roadmap milestone 37.

## How it is proven

- `npm run e2e` (the `range` section): the screen is the README, its first
  page is the README's text, the ▶ arrow turns a page, ▼ and ▲ move a section
  each way, a round on the page itself changes nothing, and a punch on a
  section's name opens it.
- `npm run snap`: `readme-tv` and `readme-tv-page`, drawn for real.
- `npm run build:beta`: BETA CHECK PASS with the README in the bundle.

## Asked for during the phase

> Last think i want to do is just put a "Not [weaponNameFromApex]" i think that
> looks way better and then we wouldn't get sued or anything especially if its
> not directly the same. so instead of "R-301" its "Not R-301" for example. I
> don't like "SMG A" "CARBINE A". its a simple change

The public build's gun names become **"Not" the real name**. Said plainly at
the time, and worth keeping in the record: "Not R-301" contains the real name,
so it is not legally safer than "Carbine A" — it refers to the mark rather than
avoiding it. What keeps this project on the right side of the line is what it
is (a non-commercial replica of published numbers, no game files, own art),
not the wording. The owner's call was the look, and it is theirs to make.

So the guard is narrowed rather than dropped: `tools/beta-check.ts` allows a
real name **only** directly after "Not ", and a bare one anywhere in `dist/`
still fails the build. Optics, hop-ups and the one branded heal keep their
generic labels; the course pistol keeps a made-up name, its real one being a
firearm brand rather than a game's weapon.
