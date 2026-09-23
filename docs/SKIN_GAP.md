# Skins: where we are, counted

**Written 2026-09-22**, the day the published assets went in and our own geometry came out. The owner asked
where the skins stand. This counts what is there rather than remembering it, says what each gap costs a
player, and ranks what to do.

## What exists

| | Count | Notes |
|---|---|---|
| Outfits | **20** | every one of them published cloth; none built in code |
| Distinct garment combinations | **12** | see the lopsided part below |
| Source sets behind them | **2** | Quaternius's Ranger and Peasant (CC0), 20 parts in all |
| Bodies | **2** | one heavier, one lighter, same skeleton and so the same hit boxes |
| Recoloured atlases | **11** | one per outfit that asks for a colour, 484 KB |
| Operators | **6** | each in its own outfit |
| Loadouts shipped dressed | **6 default + 6 custom** | customs arrive in different clothes with different melee weapons |
| Heirlooms | **10** | |
| Gun finishes | **8** | all open from the first minute, no levels |

## The gap, and what it costs

**1. Three shapes wearing twenty names.** Twelve of the twenty outfits are one of three silhouettes: six
share the peasant's full set, three share the hooded mix, three share the ranger's. Colour tells them
apart and shape does not, so at eighty metres - the distance most of this game is played at - COVERALLS,
TRACKSUIT, PLAIN CLOTHES, DESERT and WORKWEAR are the same person in different paint. A silhouette is what
a player reads first, and we have three of them.

**2. The cut is fantasy, and the names are not.** Every garment is a ranger's coat or a peasant's shirt.
MOTOCROSS is a ranger's coat in blue; TRACKSUIT is a peasant's shirt in navy; FATIGUES is a ranger's coat
in olive. The cards promise a military, a sports and a dirt bike look that the meshes cannot give. This is
the honest cost of the only CC0 clothing that fits our rig.

**3. Nothing covers a pair of eyes.** The pack has one hood and no eyewear. The owner's rule - every figure
has its face covered - is not met, and cannot be met with what is on disk.

**4. Bare hands on every figure.** The base body's hands are skin, and they are the only skin left now that
the clothes are real. They read as pale blobs at the end of every sleeve.

**5. The second body is barely used.** Four outfits are cut for it and a player cannot choose it: the body
comes with the outfit rather than being a thing you pick. The parts exist for both.

## Ranked

| # | Step | Why | Effort |
|---|---|---|---|
| 1 | **A second clothing pack, rigged to the Unreal mannequin** | Fixes gaps 1, 2 and 3 at once, and it is the only thing that does. Our rig uses the Unreal mannequin's bone names, so any CC0 asset built for that skeleton drops in with no retargeting - a much larger pool than the one author we have used. The CC0 modern kits that exist are mostly on Sketchfab, whose downloads need an account token, unlike itch.io which `npm run characters` already drives. | 1 day once a pack is in hand |
| 2 | **Let a player pick the body** | The second body is on disk, rigged, textured and already used by four outfits. A row in the picker beside Build, and every outfit can be worn on either. Hit boxes do not move: they are built from the bones, and the bones are identical. | half a day |
| 3 | **Gloves** | The last bare skin, on every figure, in every screenshot. One CC0 glove mesh per hand bone. | half a day |
| 4 | **Rename what the meshes cannot deliver** | Until a modern pack lands, MOTOCROSS, TRACKSUIT and FATIGUES describe clothes nobody is wearing. Either the names follow the cloth or the cards stop promising. Cheap, and it stops the wardrobe lying. | an hour |
| 5 | **Mix the parts harder** | Twelve combinations out of twenty parts is not the most the pack can give. A body from one set, legs from the other, a hood on or off, a pauldron or not: two dozen combinations are reachable without another download, and each is a different outline. | half a day |
| 6 | **Per-outfit heirloom and finish suggestions** | A loadout is an outfit, a gun, a finish and a melee weapon, and nothing ties them together. A suggested pairing per outfit would make a loadout feel authored. | half a day |

**What is deliberately not here.** Building our own garments again: the owner saw what that looks like and
the answer was no. Anything we put on a figure from now on is an asset somebody modelled.
