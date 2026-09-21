# Assets: where we stand against a shipped battle royale

**Written 2026-09-21**, after the operators were first dressed. The owner asked for a gap analysis on
assets against a game like Apex, and then the next steps ranked. This is that, and it is meant to be read
by somebody deciding what to spend the next week on, so it says what we have, what they have, what the
difference actually costs a player, and what is worth doing about it.

One framing note before the list. A shipped battle royale has somewhere between fifty and two hundred
artists behind it and a decade of accumulated content. We are not going to close that, and nothing here
pretends to. What we **can** close is the part of the gap a player feels in the first thirty seconds: does a
character read as a person, does a gun read as a gun, does a room read as a place somebody built. That is
mostly silhouette, material and variety, and those are reachable with CC0 assets and code.

---

## What we have today

| | Ours | Theirs | What the difference costs |
|---|---|---|---|
| **Characters** | One motion-captured mannequin (Quaternius, CC0) and one robot built in code. Five operators: a colour scheme, an outfit (six sets: fatigues, plain clothes, irregular, urban, arctic, desert) and ten pieces of kit each. | ~25 hand-modelled legends, each a unique silhouette, each with dozens of skins, each with bespoke facial rig and voice. | Ours now read as **different people**, which they did not this morning. They still read as *one body in different clothes*: same height, same build, same face. |
| **Character animation** | Quaternius's Universal library: walk, jog, sprint, crouch, aim, reload, heal, slide, climb, land, stagger, death. Pistol clips only, so long guns are posed by IK. | Hundreds of bespoke clips per legend, including a rifle set, per-weapon reloads, finishers, emotes, traversal. | The IK hold is good and checked, but it is a hold rather than an animation: a reload does not move the magazine, and a sprint does not carry a rifle differently from a pistol. |
| **Weapons** | 30 guns built in code, with working bolts, pumps, cylinders, magazines, optics, and a viewmodel with arms and hands. | ~30 guns, hand-modelled, with skins, charms, inspect animations and bespoke reloads. | Closer than anywhere else in this list. The models hold up; what is missing is surface detail and the inspect. |
| **Maps** | One battle royale map (440 m, nine places, eight sites), five arenas, a firing range and two courses. | Six battle royale maps in rotation, plus arenas and modes maps. | One map is one map. The arenas have five, which is why the small modes hold up better than the big one. |
| **Props and scenery** | ~20 Poly Haven CC0 props (crates, barrels, barriers, racks, generators, fences), 9 scanned rocks and scrub, all instanced; the arenas' cover now wears them. | Tens of thousands of bespoke props, set-dressed by hand per location. | The BR map's places read as built; the arenas are catching up; the range is still mostly boxes with decals. |
| **Materials** | 14 ambientCG CC0 PBR sets (concrete, metal, asphalt, sand, rock, gravel, corrugated, rust, plaster, brick, roof tiles, planks, catwalk, panel), world-tiled. | Hundreds, layered with vertex blending, decals and damage. | Surfaces read correctly at a distance and flat up close: no layering, no wear, no decals beyond the graffiti and bullet holes. |
| **Sky and light** | Seven HDRI hours (morning, noon, afternoon, golden, overcast, dusk, moonlight), GTAO, bloom, SMAA, a colour grade. | Per-map baked lighting, volumetrics, time-of-day per match. | This is the closest we get to parity. The renderer is not what makes us look unfinished. |
| **Audio** | Synthesised guns with a recorded CC0 mechanical layer, 17 recorded interaction sounds (Kenney CC0), footsteps, ring, doors, bins. | Thousands of recorded assets, per-surface footsteps, per-weapon tails, full voice for 25 legends. | Guns are the weak point: one synthesis family for 30 guns. No voice at all, which is the single biggest "this is not a real game" tell after characters. |
| **UI** | 45 icons (Lucide ISC, game-icons.net CC BY 3.0), a type pair, a HUD built to the same grid. | Bespoke, animated, per-legend themed. | Fine. Not the gap. |

---

## The ranked next steps

Ranked by **what a player notices per hour of work**, not by size.

| # | Step | Why it is here | Effort |
|---|---|---|---|
| 1 | **More outfits, and let a player choose one** | Six sets exist and five are spoken for by the operators. The system takes a new set in about ten lines of JSON, and a picker on the Loadouts tab would turn it into the thing players actually spend time on. Add: hoodie, coveralls, ghillie, plate-carrier-over-bare-arms, tracksuit. | half a day |
| 2 | **Body variety: two more builds and two head shapes** | Every figure is the same mannequin, so every silhouette is the same height and width. Scaling the rig per operator (±6% height, ±10% shoulder) and adding a second head shape costs almost nothing and breaks the sameness that clothes cannot. | half a day |
| 3 | **A rifle animation set** | The library is a pistol library, which is why long guns are posed by IK rather than animated. Quaternius's newer packs and Mixamo's CC0 set have rifle idles, walks and reloads. Retargeting one set onto this rig would make every figure holding a long gun read as holding it rather than presenting it. | 1-2 days |
| 4 | **Weapon surface detail** | The guns are good geometry with flat materials. A single shared "gunmetal" PBR set with wear in the roughness map, plus a decal per manufacturer, would lift all thirty at once. | 1 day |
| 5 | **Recorded gunshots, chosen by ear** | Half-built: the mechanical layer is recorded, the report is synthesised. A CC0 library (Airborne Sound's free set, gamesounds.xyz) picked per class and layered under the synthesis is the last big audio gap. **Needs the owner to pick by ear**, which is why it has stalled. | 1 day + listening |
| 6 | **Voice: eight lines per operator** | No voice at all. Eight lines (ping, enemy, thanks, knocked, revived, kill, last squad, victory) from a CC0 pack or a local TTS pass would be the single biggest "shipped game" signal after characters. | 1 day |
| 7 | **The range stops being boxes** | The arenas and the BR map now wear props; the range, which is the first thing anybody sees, is still mostly boxes with decals on them. Same dressing pass, same wardrobe. | half a day |
| 8 | **Decals and wear** | No scuffs, no leaks, no signage beyond the graffiti. A dozen CC0 decals placed by the same rules the props use would do more for "somebody built this" than another prop set. | 1 day |
| 9 | **A second battle royale map** | Still the biggest single item on the whole roadmap, and still 3-4 days. It is here rather than at the top because everything above it is cheaper per hour of player-visible change. | 3-4 days |
| 10 | **Per-surface footsteps** | One footstep sound for concrete, sand, metal and wood. The material is already known at the impact point, so this is a lookup and a sound set. | half a day |

**What is deliberately not on the list.** Bespoke legends, facial animation, a full voice cast, hand-modelled
props: all of them are the right answer for a studio and the wrong answer here, because each is weeks of work
for less visible change than items 1 to 8 together.
