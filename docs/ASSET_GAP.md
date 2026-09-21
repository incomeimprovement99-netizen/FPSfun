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
| **Characters** | One motion-captured mannequin (Quaternius, CC0) and one robot built in code. **Six** operators and **eleven** outfits in three builds, any of which a player can put on a loadout: a colour scheme, clothes measured to the body they hang on, a covered face on every one of them and ten pieces of kit. | ~25 hand-modelled legends, each a unique silhouette, each with dozens of skins, each with bespoke facial rig and voice. | Ours now read as **different people**, which they did not this morning. They still read as *one body in different clothes*: same height, same face, and bare hands at the end of every sleeve. |
| **Character animation** | Quaternius's Universal library, **25 clips counted**: walk, jog, sprint, crouch, aim, reload, heal, slide, climb, land, stagger, death. Every weapon clip is a **pistol** clip, so long guns are posed by IK. | Hundreds of bespoke clips per legend, including a rifle set, per-weapon reloads, finishers, emotes, traversal. | The IK hold is good and checked, but it is a hold rather than an animation: a reload does not move the magazine, and a sprint does not carry a rifle differently from a pistol. |
| **Weapons** | 30 guns built in code, with working bolts, pumps, cylinders, magazines, optics, and a viewmodel with arms and hands. | ~30 guns, hand-modelled, with skins, charms, inspect animations and bespoke reloads. | Closer than anywhere else in this list. The models hold up; what is missing is surface detail and the inspect. |
| **Maps** | One battle royale map (440 m, nine places, eight sites), five arenas, a firing range and two courses. | Six battle royale maps in rotation, plus arenas and modes maps. | One map is one map. The arenas have five, which is why the small modes hold up better than the big one. |
| **Props and scenery** | ~20 Poly Haven CC0 props (crates, barrels, barriers, racks, generators, fences), 9 scanned rocks and scrub, all instanced; the arenas' cover now wears them. | Tens of thousands of bespoke props, set-dressed by hand per location. | The BR map's places read as built; the arenas are catching up; the range is still mostly boxes with decals. |
| **Clothes** | Ten sets, six garments each, turned along a profile measured off the model itself so a sleeve narrows at the elbow and a trouser leg swells at the calf. No cloth simulation, no weighting: one piece per bone. | Bespoke modelled and weighted outfits per legend, with simulated cloth on the loose parts. | Ours move with the limb rather than with the body, which is right for a sleeve and wrong for a coat tail. Nothing here has a coat tail, so it holds. |
| **Materials** | 14 ambientCG CC0 PBR sets (concrete, metal, asphalt, sand, rock, gravel, corrugated, rust, plaster, brick, roof tiles, planks, catwalk, panel), world-tiled. | Hundreds, layered with vertex blending, decals and damage. | Surfaces read correctly at a distance and flat up close: no layering, no wear, no decals beyond the graffiti and bullet holes. |
| **Sky and light** | Seven HDRI hours (morning, noon, afternoon, golden, overcast, dusk, moonlight), GTAO, bloom, SMAA, a colour grade. | Per-map baked lighting, volumetrics, time-of-day per match. | This is the closest we get to parity. The renderer is not what makes us look unfinished. |
| **Audio** | Synthesised guns with a recorded CC0 mechanical layer, **63 recorded interaction takes** (Kenney CC0), footsteps, ring, doors, bins. No recorded gunshot, and no character voice at all. | Thousands of recorded assets, per-surface footsteps, per-weapon tails, full voice for 25 legends. | Guns are the weak point: one synthesis family for 30 guns. No voice at all, which is the single biggest "this is not a real game" tell after characters. |
| **UI** | 45 icons (Lucide ISC, game-icons.net CC BY 3.0), a type pair, a HUD built to the same grid. | Bespoke, animated, per-legend themed. | Fine. Not the gap. |

---

## The ranked next steps

**Re-ranked 2026-09-21, evening**, after the wardrobe, the measured body and the dirt bike shipped. The
morning's list had ten items; three of them are done, one turned out to be two, and the day's work put two
new ones near the top that nobody could have ranked this morning because they did not exist yet. Ranked, as
before, by **what a player notices per hour of work**.

What the game actually holds today, counted rather than remembered: **25 animation clips** (19 in the base
file, 6 more in the second), of which every weapon clip is a **pistol** clip; **63 recorded interaction
sounds** and no recorded gunshot; **no character voice at all**; 23 texture sets; 20 prop models; 11
outfits, 3 builds, 6 operators, 30 guns, 1 battle royale map, 5 arenas.

| # | Step | Why it is here | Effort |
|---|---|---|---|
| 1 | **See what you are wearing while you pick it** | We shipped a picker today with eleven outfits, three builds and four ways to cover a face, and **there is no way to see any of it** without starting a match and going third person. A figure on the Loadouts tab, turning, wearing what the cards say, is the difference between a wardrobe and a list of words. It is also the cheapest thing on this list: the figure, the rig and the outfit builder all exist and are already used by the snapshot tool. | half a day |
| 2 | **Gloves, and the kit measured against the body** | Now that everybody is dressed, the **bare hands** are the only skin left and they read as pale blobs at the end of every sleeve in every screenshot. Gloves are one more piece per hand on a bone that already exists. And the kit is still placed by eye: a plate carrier 170 mm deep on a chest that measures 300 is a number nobody has checked, which is exactly the class of fault the clothes had this morning. | half a day |
| 3 | **A rifle animation set** | The single biggest character gap, and now the clearest: of 25 clips, every weapon clip is a **pistol** clip. Long guns are posed by IK, which holds up still but is a hold rather than an animation: a reload does not move the magazine, and a sprint does not carry a rifle differently from a pistol. Quaternius's newer packs and Mixamo's CC0 set have rifle idles, walks and reloads for this rig. | 1-2 days |
| 4 | **Voice: eight lines per operator** | Still nothing, and it is still the biggest "this is not a shipped game" tell after the characters themselves. Eight lines each (ping, enemy spotted, thanks, knocked, revived, kill, last squad, victory) from a CC0 pack or a local TTS pass. Six operators, so 48 takes. | 1 day |
| 5 | **Weapon surface detail** | Thirty guns of good geometry with flat materials. One shared gunmetal PBR set with wear in the roughness, plus a decal per manufacturer, lifts all thirty at once. | 1 day |
| 6 | **Recorded gunshots, chosen by ear** | Half built: the mechanical layer is recorded, the report is synthesised, and one synthesis family covers thirty guns. **Needs the owner to pick by ear**, which is why it has not moved. | 1 day + listening |
| 7 | **The range stops being boxes** | The arenas and the BR map wear props now; the range, which is the first thing anybody sees, is still mostly boxes with decals. Same dressing pass, same wardrobe of props. | half a day |
| 8 | **Decals and wear** | No scuffs, no leaks, no signage beyond the graffiti. A dozen CC0 decals placed by the rules the props already use. | 1 day |
| 9 | **Per-surface footsteps** | One footstep sound for concrete, sand, metal and wood. The material is already known at the impact point, so this is a lookup and a sound set. | half a day |
| 10 | **A second head shape, and a sleeveless set** | What clothes cannot do: every head is the same head, and nothing in the wardrobe bares an arm the way a plate carrier over a t-shirt would. | half a day |
| 11 | **A second battle royale map** | Still the biggest single item on the roadmap and still 3-4 days. Last because everything above it is cheaper per hour of visible change. | 3-4 days |

**Done today**, struck off this list: more outfits and a picker (#1 this morning), the torso measured like the
limbs (#2), the silhouette pieces that made the wardrobe more than colourways (#3, mostly), and the face rule
with the dirt bike kit that came out of the owner's own message.

**What is deliberately not on the list.** Bespoke legends, facial animation, a full voice cast, hand-modelled
props: each is weeks of work for less visible change than items 1 to 9 together.
