# Phase 17 plan: feel, animation, and the world

**Written 2026-09-24**, at the start of the round. The analysis behind it is `docs/FEEL_GAP.md`.

**Asked for**, in the owner's words:

> do a gap analysis on the skins and movement and any feel to make it less "clunky" is a review i got from
> someone, not sure if they just didn't know how to play / move efficiently. more animations are needed and
> more word details / POIs in the battle royale

> CONTINUE, WE HAVE CLEARR NEXT STEPS, WE SHOULD BE ABLE TO SAFELY WORK THROUGH STEPS 1-9 IN ONE SESSION, WE
> HAVE IT SCOPED OUT ALREADY, GO AHEAD, AND FOR THE THINGS WE ARE SUGGESTING TGO PAY WE SHOULD SEARCH FOR
> MORE FREE ASSETS

> ENSURE THAT YOU HAVE BEEN DOCUMENTING THIS WITH THE PHASE AND MILESTONE PATTERN SO WE HAVE IT ALL THERE

> CONTINUE BUT OK ENSURE YOU MAKE A DOCUMENT THAT LISTS OUT THE GAPS FROM THIS AND AAA SHOOTERS LIKE
> APEX/WARZONE/HYPERSCAPE AND RANK THE NEXT STEPS ACCORDING TO THOSE GAPS AND EXECUTE ON THEM. ALSO, WE WANT A
> UNIQUE ANIMATION SCREEN FOR EACH DIFFERENT GAME MODE, THEY CAN BE THE SAME AS THE INTRO, BUT THE TEXT SHOULD
> CHANGE AND THE NAME OF THE MODE SHOULD BE PROMINENT, AND MAKE THE FLASHES OF LIGHT ONLY LIKE HALF AS BRIGHT,
> AND THE SECOND GUNSHOT SHOULD SOUND MORE LIKE A SHOTGUN, SO LIKE A BIT DEEPER LIKE A 12 GUAGE.
>
> WHEN YOU'RE DONE WITH THAT, WE NEED TO DO A BUG HUNT HERE, ANALYZE OUR TESTS TO SEE IF THEY REALLY ARE
> PREVENTING BUGS AND MAKE BATTLE ROYALE WHEN WE SPAWN IN WITH GUNS HAVE WAY MORE AMMO AND THE AMMO STACKS SHOULD
> BE A LOT MORE PER STACK ON THE GROUND. I DON'T WANT PPL RUNNING OUT OF AMMO.

## How the phase is shaped

| Round | What | Why this order |
|---|---|---|
| A | What the player sees and hears every second: their own arms, their gunshots, their footsteps | The largest share of "clunky" is feedback, not physics (the movement numbers are Apex's own and measured). These are on screen and in the ears for the whole match. |
| B | Motion: third-person clips, the gun's small motion | Every other player watches the third-person motion; the gun's motion is the player's own hands. |
| C | The world: the towns from a building kit, terrain and vegetation, set dressing and a landmark per place | The largest single job, and the one the owner asked for by name. It comes after A and B because it does not change how a fight feels, only where it happens. |
| D | Free alternatives to everything that was going to cost money, and the test debt | The owner's rule for this phase: search harder before paying. The flaky checks are last because they block nothing, but a check that flakes teaches everyone to ignore it. |
| E | The owner's second message: the intro (half the flash, a 12 gauge, one per mode), battle royale ammo, then a gap document against Apex, Warzone and Hyper Scape with its steps worked, then a bug hunt and an audit of the tests | Taken in the order it was asked: the concrete asks first, since each is small and felt at once, then the analysis, then the hunt. They go ahead of 17.5 to 17.9, which are larger. |

## The work

| Id | Item | How | Verified by |
|---|---|---|---|
| 17.1 | Real first-person arms | The published body cut down to its arms (`mannequin.ts buildArmRig`), in the loadout's body and build, the outfit's own sleeves in its own colour, fingers from the grip and jab clips; posed onto the drawn gloves each frame by a two-bone solve (`fparms.ts`), with the gloves no longer drawn | snapshots `fp-arms`, `-ads`, `-reload`, `-holstered`, `-zip`, `-down`; e2e `realArms()` |
| 17.2 | Recorded gunshots and more footstep surfaces | CC0 recordings per weapon class and per surface, through the sample loader `audio.ts` already has; the synthesis stays as the fallback | a check that every class and surface has takes; e2e page errors; listening |
| 17.3 | The free clips wired in | `Slide_Start`, `Slide_Exit`, `OverhandThrow`, `Melee_Hook`, `Punch_Cross`, `Hit_Head`, `Chest_Open`, `Interact`, `Fixing_Kneeling`, `NinjaJump_*`, `Dance_Loop`, `Yes`, `Idle_FoldArms_Loop`, trimmed out of the free Universal Animation Library downloads into our clip files | a check that each named clip is in the file; snapshots of each |
| 17.4 | The gun's small motion | A roll into a strafe, a turn in a swap, a reaction to a mantle and a hard landing, in `viewmodel.ts` with the numbers in `viewmodel.json` | `tools/checks/viewmodel-arms.ts` still passes; snapshots |
| 17.5 | Towns from a building kit | The free Downtown City MegaKit pieces over the collision boxes we have: the boxes stay the physics, the kit is what is seen | e2e `br`, `loot`, bot nav flood fill; snapshots of each place |
| 17.6 | Terrain and vegetation | The stepped ridges as a sloped heightfield; trees, rocks and scrub from the free nature kits on the empty sand | movesim and bot walk still pass; snapshots from the dropship and the ground |
| 17.7 | Set dressing and a landmark per place | Vehicles, barriers, lights and cover in the streets; one named thing per place visible from the dropship | snapshots per place; render budget check |
| 17.8 | Free before paid | Search for free strafe, backpedal and rifle clips, and free alternatives to the paid Quaternius tiers and the Downtown kit's paid half; fetch what is found | `docs/FEEL_GAP.md` updated with what was found |
| 17.9 | The test debt | Why the BR host-migration check passes one run in two, and why the bot tier checks fail in a full batch and pass alone; fix the cause | three clean full batches in a row |
| 17.10 | The intro's flashes half as bright | The flash intensities in the intro's config halved | snapshot `intro-*`; e2e `intro` |
| 17.11 | The intro's second shot a 12 gauge | The second shot voiced as the shotgun class, lower and heavier, with the recorded 12 gauge takes | e2e `intro`; listening |
| 17.12 | An intro per game mode | The same animation, with the mode's own name large and its own lines, played when a mode starts | snapshots per mode; e2e |
| 17.13 | Battle royale ammo | Much more ammo with a spawn gun, and much bigger stacks on the floor | `tools/checks` loot density; e2e `loot` |
| 17.14 | A gap document against Apex, Warzone and Hyper Scape | What each does that we do not, from the code and the configs, ranked by what a player feels, with the next steps it implies; those steps then worked | `docs/AAA_GAP.md`; milestones |
| 17.15 | A bug hunt, and whether the tests catch bugs | Every bug fixed in the last month set against whether a test would have caught it; the tests that pass without testing anything; the bugs that turn up | `docs/TEST_AUDIT.md`; fixes with checks |

## The decisions

| Question | Answer, and why |
|---|---|
| Replace the viewmodel's animation or dress it? | Dress it. The viewmodel's hand placement is tuned and tested (grip, handguard, magazine, trolley, fists, crawl); the real arms follow the gloves it already places, so none of that work is thrown away and the drawn arms remain the fallback. |
| Bare hands or gloves? | Whatever the outfit's arms garment has: the Ranger arms come gloved, the Peasant arms bare. |
| Replace the BR buildings' collision? | No. The kit is what is seen; the boxes stay the physics, so bots' nav, loot spots and doors keep working. |
| Spend money? | Not in this phase. Everything suggested as paid gets a search for a free equivalent first (17.8), and anything still only paid goes to the owner as a choice. |

## How it is proven

`npm run verify` and `npm run rules` on every change; snapshots for every visible change, from both sides
where it has two; the three e2e batches before each release with any failed section rerun alone; a roadmap
milestone at each release; and `docs/PHASE_17_FEEL_ANIMATION_AND_THE_WORLD.md` at the end with what shipped
and what did not.
