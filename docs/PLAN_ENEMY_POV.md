# The enemy as you see it: a gap analysis against Hyper Scape, Apex and Empulse

The owner, 2026-10-18: "do a gap analysis on your section (3rd person, enemy pov) between hyperscape/apex/empules vs
speedkills and implement the most important ones, tell me why and how you implemented them and list out the next ones
to do as 'nice to haves'".

Split three ways the same day:

- **The character agent:** the figure's poses and motion: wall run, skydive, hit reactions as motion, deaths.
- **The guns agent:** an enemy's gun in their hands, its flash, tracers and the sound of its shots.
- **The lobby agent (this plan):** what is drawn on, over and round an enemy, and how they sound when they move.

## Where SpeedKills stood

An inventory of the code, 2026-10-18.

**Already level with the three:**

- **Damage numbers:** over the head, stacked per target, gold for a head.
- **An enemy's plate after you hit them:** name, shield and health.
- **Hit markers:** white for a body, gold for a head, a big red one for a kill, with tiered hit sounds.
- **The red outline round the enemy you aim at.**
- **REVEAL drawn through walls.**
- **Kill feed and killcam.**
- **Enemy fire:** 3D gunfire with distance and occlusion, red tracers.
- **When you are hit:** damage direction arcs.
- **Others' footsteps:** 3D, occluded.

## The gaps, by how much they matter in a fight

| # | Gap | The three | Built |
|---|---|---|---|
| 1 | A shield taking a round looked like flesh taking one: a white flash | Apex flares the shield's colour where it is hit; Halo, Splitgate and Empulse shimmer over the body | **M694**: the shield flare |
| 2 | Breaking a shield had a sound and nothing else: the moment to push was easy to miss | Apex: a burst of the shield's colour and a cracked-shield marker | **M694**: shards and the break's marker |
| 3 | An enemy under ARMOR looked like any other, and your numbers on them were two and a half times the truth | Hyper Scape: armour reads as a shell on the body | **M694**: a gold shell, true numbers |
| 4 | Others' SLAM, LEAP and ARMOR sounded from everywhere at full volume; ARMOR's was a shield breaking | Every ability heard where it is used | **M694/M695**: heard where they are, with their own sounds |
| 5 | Others' jumps, landings, slides and mantles were silent | Apex: an enemy's landing and slide are among the loudest things you hear | **M695** |
| 6 | An enemy's REVEAL never told you | Apex: "you've been scanned" | **M695**: REVEALED, counting down |
| 7 | The minimap turned with your own body while you watched someone else | | **M696** |

## Nice to haves, next

- ~~A kill confirmed by a skull~~ and ~~the kill feed with the gun's outline and a headshot flag~~: done in
  Milestone 701.
- **INVISIBILITY's shimmer:** Hyper Scape's invisible players ripple when they move and flash when hit; ours vanish
  past 6 m and are whole inside it.
- ~~HEAL's sound and a bot's HEAL drawn~~: a player's HEAL is heard where it is since Milestone 695, and a bot's HEAL
  shows its area since Milestone 702.
- **An enemy colour setting** for the outline, REVEAL and the trails, as Splitgate and Empulse offer. The colour-vision
  modes recolour only the HUD today.
- **Hit reactions seen by a third player:** a hit flinches the figure only on the shooter's page (the character agent's,
  once the hit travels).
- **An echo or dissolve on death:** Hyper Scape turns the dead into an echo. Ours fall where they die, guns scattered
  (with the character agent: the fall is theirs, any material effect ours).
- **Shard size by distance:** the break's shards are a fixed size; far off they are a few pixels.
