# Phase 16 plan: real cloth, and the body under it

**Back-filled 2026-09-24.** This round ran from 2026-09-21 to 2026-09-24 as a string of owner messages
answered one at a time, and it shipped as roadmap Milestones 159 to 169 without a phase plan of its own.
The owner asked for the phase pattern to be kept, so this is the plan as the work actually went, written
from the messages and the milestones. What it turned into is `docs/PHASE_16_REAL_CLOTH_AND_THE_BODY.md`.

**Asked for**, in the owner's words:

> ensure we have operator gear as well like outfits (military, tshirt/shorts, taliban, stuff like that) and
> includes full masks and shades and gogles and stuff for different ones. Do the gap analysis on assets vs
> stuff like apex and then do all the next steps, ranked

> also, the clothes look rediculasly bad lol are you just making shit up or are you ripping free assets?
> bc this looks like you are just putting together roblox shapes and calling it a day

> yep do the body swap and we want the outfits as well. do 4 that we have for free and look for more
> options, i gaurentee that there are more out there that we can use for free

> so feature flag off the custom pixal shit that we built and just do the published assets

> only the back half of the "this is you" in the loadouts screen shows and we can't control its rotation
> [...] ensure that anybody's old skins are still not present, assign a random new one to the registered
> players [...] and a random heirloom preset to each of the custom loadouts

> CONTINUE WITH THE SKIN GAP ANALYSIS, ENSURE YOU GET SCREENSHOTS, THE CLOTHES AREN'T FULLY COVERING THE
> BODY AND SHIT, EXHAUST OUR OPTIONS FOR FREE ASSETS, THAT IS A GOLD MINE COMPARED TO MAKING NEW ONES.

## How the phase is shaped

| Round | What | Why this order |
|---|---|---|
| A | A wardrobe and a picker, the body measured off the model, frame-rate independence, ability numbers per match | The owner's direct asks at the start, before anyone had seen the clothes. |
| B | Published assets: the Quaternius bodies and garments, fetched by script, the code-built clothes flagged off | The owner saw the code-built clothes and called them Roblox shapes. Nothing built in code ships on a figure after this. |
| C | The Loadouts figure: faces you, turns, zooms; per-outfit colour in the picture | The owner could see only the back of the figure and not its head. |
| D | Fit: the clothes covering the body, hair, outlines, the body picker, a build that does something | The owner's screenshot request found bare backs, belts on bare chests, bald heads and a black face. |

## The work

| Id | Item | How | Verified by |
|---|---|---|---|
| 16.1 | A wardrobe with a picker | Outfits in `outfits.json`, a picker in the Loadouts tab, each operator dressed | `tools/checks/outfit.ts`, e2e `panel` |
| 16.2 | The body measured, not guessed | `tools/checks/body.ts` reads the model's own vertices; limb profiles and torso bands written into config with the measurement beside them | `npm run verify` (BODY) |
| 16.3 | Real bodies and real clothes | `npm run characters` drives itch.io's free download; the Superhero bodies, hair and the Ranger and Peasant garments, re-encoded to WebP | e2e `duel` wear check, snapshots |
| 16.4 | Our geometry off | `OUR_GEOMETRY()` false by default; the checks switch it on so the fallback stays tested | `tools/checks/outfit.ts` |
| 16.5 | Each outfit its own colour | `npm run tints` writes a recoloured atlas per outfit and pack | snapshot `outfit-real` |
| 16.6 | The Loadouts figure | Faces the player, drag to turn, wheel to zoom, head visible | snapshots `loadout-front`, `loadout-back` |
| 16.7 | Clothes that cover the body | Every skinned mesh in a garment file worn; the torso narrowed to the cloth; a 22 mm shell on the layer against the skin | snapshots `skin-audit-*`, `skin-close-*` |
| 16.8 | Hair | The four hair meshes on disk worn, each outfit naming a style and a colour | check "every outfit has hair", snapshot `hair-close` |
| 16.9 | Twenty outlines | Every outfit a different combination of the forty parts; one atlas per outfit and pack | check "no two outfits are the same outline", snapshots `wardrobe-a..d` |
| 16.10 | The free pool, searched | Quaternius, Mixamo, Sketchfab, itch, Poly Pizza, ambientCG; `npm run mixamo` lists the catalogue | `docs/SKIN_GAP.md` |
| 16.11 | A body to pick, a build that works | Body row in the Loadouts tab sent as a fourth look field; build scales the chest of body and cloth together | checks on the look round trip and the (F) migration; snapshots `builds-*`, `loadout-body` |
| 16.12 | The seams | The upper arm brought in around its bone; a dark undersuit under the clothes | check "the upper arm fits every sleeve"; magenta diagnostic shot |

## How it is proven

`npm run verify` and `npm run rules` on every change; the three e2e batches before each release, with any
failed section rerun alone; and snapshots from the front and the back, because every fit fault in this
phase was found in a picture and none of them in the code.
