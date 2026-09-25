# Against Apex, Warzone and Hyper Scape: what is left, ranked

**Written 2026-09-24**, Phase 17 item 17.14. The owner: "make a document that lists out the gaps from this and
AAA shooters like Apex/Warzone/Hyperscape and rank the next steps according to those gaps and execute on
them."

The earlier passes (`docs/GAP_ANALYSIS.md`, `docs/HYPER_SCAPE.md`, `docs/NEXT_STEPS.md`) ranked seventy-odd
items and most of the top of those lists has shipped since. This pass starts from what the code has today,
checked by reading it rather than from the old lists, and asks what each of the three games does that a
player here would notice is missing.

## What is already level with them

Checked in the code on 2026-09-24:

| Area | What we have | Who it matches |
|---|---|---|
| Movement | Apex's numbers, measured frame by frame at 30 to 240 fps: slide, lurch, tap-strafe, coyote time, jump fatigue, mantle, wallbounce, superglide, climb | Apex |
| Traversal | ziplines, jump pads, balloons, doors that open, kick and break | Apex |
| Guns | the published numbers with attachments, hop-ups, per-optic ADS, spray patterns, finishes, heirlooms | Apex |
| Sound | recorded shots per class near and far (Milestone 171), footsteps per surface, occlusion, a cue for above and below | Apex, Warzone |
| Abilities | six kits of a tactical, a passive and an ultimate | Apex |
| Battle royale | a dropship, the ring with a hot zone, loot tiers, bins, care packages, loadout crates, death boxes, banners and beacons, self-revive, knockdown shields, backpacks, plates, the Gulag, Resurgence, Storm Surge, a vault, Ring Consoles | Apex, Warzone |
| Squads | solo to trios, a ping wheel, revives, spectating after death, host migration | Apex |
| Modes | eleven: battle royale, Resurgence, 1v1, 1v1v1, vs bots, gun run, TDM, FFA, crown, control, search | Apex, Hyper Scape (crown) |
| Presentation | a card per mode (Milestone 174), a killcam, emotes, banners, captions, colour-vision modes | Apex |
| Characters | published cloth, sixteen outlines, two bodies, three builds, hair, your own arms in view (Milestone 170), third-person throws, swings, revives and a real slide (Milestone 172) | Apex (a long way behind) |

## The gaps, by what a player feels first

**1. The world is the biggest single gap.** Apex's and Warzone's maps are dense, modelled and set-dressed:
every street has cars, fences, signs and cover, and the ground has grass, rocks and height. Ours is textured
slabs on a flat plane, with ridges built as stairs, nine places on a symmetric wheel and wide empty sand
between them (`docs/FEEL_GAP.md` has the snapshots). Hyper Scape's whole identity was a dense vertical city.
Nothing else on this list is seen as much.

**2. Third-person motion holding a rifle.** Every Apex and Warzone figure strafes, backpedals, crouch-walks
and reloads with a rifle in its hands. Ours hold rifles with pistol clips corrected by IK, strafe by turning
the hips over a forward run, and backpedal by playing the run in reverse. No free Quaternius tier has the
clips; Mixamo does, behind the owner's token.

**3. No economy loop inside a match.** Warzone's cash (from kills, contracts and the ground) buys a loadout
drop, a self-revive kit, a UAV or a squad mate back at a buy station. Apex's crafting materials buy ammo,
attachments and banner recrafts at a replicator. Hyper Scape's weapon fusion upgrades a gun when you pick up
its twin. Each gives a player something to do between fights besides walk; we have none of them.

**4. No voice and no music.** Apex's legends say "enemy spotted", "ring closing" and "I'm down"; Warzone has
an announcer for every phase; all three have a drop theme and match music. Ours is sound effects and
captions.

**5. Finishers and the kill moment.** Apex's finisher is the most-watched three seconds of the game: a knocked
enemy, a close-up execution, a shield reward. We have a melee and a killcam.

**6. One battle royale map.** Apex rotates three, Warzone has a large and a small, and our lobby offers five
arenas and one battle royale.

**7. Ranked, and a reason to come back.** Apex's ranked and battle pass, Warzone's seasonal challenges. We have
XP, three challenges and boards.

**8. The server decides nothing.** In all three the server owns damage and position; here the host does, which
is fine among friends and documented, and it is the one line between this and a public game.

**9. A whole match cannot be watched back.** The killcam keeps eight seconds.

**10. Nothing teaches the battle royale.** The tour teaches movement; the ring, the Gulag, bins, crates and
the vault are learned by dying.

## Ranked next steps

Ranked by how much of a match each changes against its cost, and free before paid.

| # | Step | Gap | How | Cost |
|---|---|---|---|---|
| 1 | **Towns from a building kit** | 1 | The free Downtown City MegaKit's facades, windows and roofs over the collision boxes we have: the boxes stay the physics, bots' nav, doors and loot spots keep working, and what is seen is modelled | 2 to 3 days |
| 2 | **Terrain and vegetation** | 1 | The stepped ridges as a sloped heightfield; trees, rocks, scrub and grass from the free nature kits across the sand | 2 days |
| 3 | **Set dressing and a landmark per place** | 1 | Vehicles, barriers, fences, lights and cover in every street; one thing per place you could name from the dropship, which also breaks the wheel | a day a place |
| 4 | **Weapon fusion** | 3 | Hyper Scape's: picking up the gun you already hold upgrades it a tier (a better magazine, then a better hop, then gold) instead of being a duplicate. All the tiers and attachments exist already; this is a rule on pickup | half a day |
| 5 | **A buy station and cash** | 3 | Warzone's: cash from kills and from the floor; a buy station per place selling a loadout drop, a self-revive, a UAV (the map pings enemies for a few seconds), and a squad mate back | 2 days |
| 6 | **Finishers** | 5 | Hold melee over a knocked enemy: both figures play the free library's clips for it (a hook, a knockback, a fall), the camera pulls out to third person, the finish gives shield | 1 day |
| 7 | **Voice callouts and an announcer, and a drop theme** | 4 | CC0 voice lines are scarce; the browser's own speech synthesis reads short lines ("ring closing", "enemy spotted", "squad wiped") in a set voice for the announcer, and a CC0 track plays over the drop | 1 day |
| 8 | **Rifle, strafe and backpedal clips** | 2 | Search every free source again (the owner's rule); if none, the owner's Mixamo token, whose library has all of them free | a day once found |
| 9 | **A battle royale primer** | 10 | Five short cards the first time a player drops: the ring, bins and crates, the Gulag, the vault, revives | half a day |
| 10 | **A second battle royale map, or the other half of this one** | 6 | After 1 to 3, when the kit and the terrain make a second map a week rather than a month | 3 to 4 days |
| 11 | **Ranked and a season** | 7 | A rating per mode and a weekly board reset on the game's own server | 2 days |
| 12 | **Whole-match replays** | 9 | Every snapshot the killcam already takes, kept for the match and played back | 2 to 3 days |
| 13 | **Server-authoritative damage** | 8 | The game server already relays every packet; checking hits there is the anti-cheat line | 3 to 5 days |

Steps 1 to 3 are also Phase 17's items 17.5 to 17.7, and step 8 is 17.8, so this is the order Phase 17 now
works in: the world first, then the three loops (fusion, the buy station, finishers), then voice, then the
rest. Paid items stay the owner's call and come with a free search first.
