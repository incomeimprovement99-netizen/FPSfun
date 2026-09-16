# Phase 15 plan: the gaps, and the Outskirts rebuild

**Asked for**, in the owner's words, over three evenings:

> Button for aimbot / allow dashes to be configurable, like speed distance,
> allow coop play in BR and other game modes, FFA, allow number of bots and
> human players in each / ADS in kill cam, turn off the health behind cover
> and far away / Clipping a wall like slows or stops you almost completely,
> we don't want that for sure. Apex/hyperscape/cod doesn't have that so we
> shouldn't either. We should also have a mele for hwwen the fists or the
> heirloom is out. / More maps small for 1v1s and FFA modes

> i don't want aimbot to switch itself off when other humans are in the
> match, i do want it to have like a red bar or something always visible on
> the player who currently has aimbot equipped though.

> I wasn't able to join like a tdm or FFA with a buddy plus bots, double
> check that you did implement that correctly [...] we can choose how many
> bots and their skill level and their gun choices [...] on the 1v1 / ffa
> maps, add ziplines and add cover in the middle lane like a building with
> some stuff we can do movement around in. make the br map not look like a
> complete pile of dogshit, should be all indoor for now like the small maps
> are. there needs to be much less open space and more loot [...] I couldn't
> even play a BR game bc i died right away from people spawning near me bc
> the map is open [...] combine hyperscape elements, list them out and see
> what we forgot we liked

> expand the shit out of that BR map and ensure that we list olut next steps
> for the gap analysis for games like apex and then fill the gaps in.

> stop taking breaks... thats the point in the analysis first, determine the
> gaps an fill them in, ensure you compare major AAA games and see what we
> are missing. The weapon inspect as well looks bad bc it shoves the arm stub
> in the character's face. There are so many more elements to the br that we
> need to ge tin play, especially when it comes to the map and how its laid
> out. Don't forget to look for more skins/assets and stuff that we can
> utilziee for free. I can think of like 20-30 next steps just off the top of
> my head, this next session shouild be extensive and have at least 40 items
> after a thorough gap analysis

## How the phase is shaped

Three rounds, in this order, because each one depends on the last.

| Round | What | Why this order |
|---|---|---|
| A | The direct asks: the aim bot, the dash, co-op and counts, the killcam, the plates, wall slide, melee, the arena building, the first Outskirts rebuild | These are what the owner could feel while playing. They ship first and they ship whole. |
| B | The gap analysis: twenty agents against Apex, Warzone, Fortnite, PUBG, Tarkov, The Finals, Titanfall 2, Valorant, CS2, Siege, plus gunplay, HUD, audio, progression, AI, netcode and free assets | The owner asked for the analysis **before** the work, so the work is aimed rather than guessed. Seventy ranked items came out of it. |
| C | Filling the gaps, top of the list down | The list is ranked by value per hour, so the order is the list's own order, except where two items share a file and it is cheaper to do them together. |

Round A and round B have shipped. This plan covers round C.

## The decisions

| Question | Answer, and why |
|---|---|
| Does the aim bot switch itself off when a human joins? | No. The owner's buddy asked for it in their 1v1 and the owner said to keep it on. Instead everyone sees a red bar and the words AIM BOT over whoever has it, at any range, through cover, ignoring the rules that hide an ordinary health plate. |
| Why did the owner die instantly in every battle royale match? | Two reasons, both fixed in round A. Bots dropped on the owner's own place, and a gun worked the instant you touched the ground. Bots take the other places now, and nobody's gun works for the first seconds after their own landing. |
| Was the killcam really not scoping in? | It was. The first check read the replay's first frame, four seconds before the kill, when the bot had not raised its sights yet. Sampling across the whole replay reads 0.85 of full ADS. The feature was right and the test was wrong. |
| Why fix the map before anything else in round C? | Because the analysis concluded every other battle royale problem is downstream of the layout: dead rotations, open-sand end games, drifting bots and meaningless loot all come from 193,600 m2 of flat plane with five identical box yards on a wheel. |
| Terrain, given collision is axis-aligned boxes? | Landforms built as stacked boxes, the way the east ridge already is. No mesh collision, no slopes. A hill is a wedding cake; a ramp is a staircase with a rise of 0.56 m or less so a bot can walk it. |
| How do we stop the map breaking the bots again? | An automatic test. Three of the nineteen nav nodes stood inside solid boxes and the ridge's ramp stopped five metres short of the top in open air. The suite now floods the whole map on a half-metre grid using the bot's own radius, step height and standing room, and fails on any node, link or drop spot the flood cannot reach. |
| Why not put that test in verify? | Building the map calls `material()`, which loads textures, which wants a DOM. It lives in the browser half of the suite instead. |
| Who does the work? | Agents, in waves, with the files split so no two agents hold the same file at once, and an adversarial reviewer on each piece. The map files are worked in sequence for the same reason. |
| What counts as done for an item? | Code, its numbers in `src/config/*.json`, a check that fails if the behaviour goes away, and a line in the roadmap. An item without a check is not done. |

## The work, round C

The ranked list is `docs/NEXT_STEPS.md`. Round C takes it in these groups.

1. **The view model at the root** (item 1). The inspect shoves a forearm stub into the camera because both elbow anchors live in gun-local space and swing through a wider arc than the gun. Re-anchor them to a shoulder point in camera space, pivot the inspect about the gun's own centre, cap the sleeve, guard the near plane, and delete the `handTurn` mitigation that round A added.
2. **The ring, the loot and the bots' senses** (items 4, 5, 6, 20, 21). Keep every circle inside the map and weight late ones onto cover. Give each place a loot tier and each match a hot zone with one fully-kitted gun. Replace per-item rolls with typed spots so a room reads as a room. Give bots a sight range that suits a 440 m map and a reason to loot.
3. **Looting that does not cost the fight** (item 9). Walk-over pickup for ammo and heals, hold to take everything in reach, and a reach list instead of silently taking whatever is nearest.
4. **The Outskirts rebuild** (items 12, 13, 15, 16, 17, 18, 19, 30). Ground with a shape, a mid band worth crossing, one tall landmark, a silhouette and a palette per place, a rotation network, a real edge, and a nav graph over all of it.
5. **Doors, bins and the rest of the list** (items 10, 11 and down).
6. **Free assets** (items 7, 8, 26, 27, 28, 48), because the owner asked for them by name: CC0 material sets per place, rock and vegetation meshes, more skies, recorded sounds for the new interactions, HUD icons and a type pair, and a modular building kit.

## How it is proven

- **verify** and **movesim** stay green, and every new behaviour adds checks to a module under `tools/checks/` that verify runs.
- **e2e** grows the map's own guards: the reachability flood, the place count, the rotation network, and the loot that lands indoors.
- The battle royale is played end to end in the suite, from the drop to the ring to the recap, so a map change that strands a bot or buries a drop spot fails the build rather than the owner's evening.
