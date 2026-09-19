# Phase 15: what did not get done, and what comes next

**Written 2026-09-16, when the weekly limit was nearly spent.** Everything listed as shipped is on `main`, pushed, and live at https://fpsfun.duckdns.org/ (the deploy's live check passed). Unfinished work is saved on the branch `wip/phase15-unfinished`, also pushed.

## Shipped this round

- **Bot nav graph.** Three nodes stood inside solid boxes, the ridge ramp stopped 5 m short of the top, and three drop spots were inside walls. An e2e flood fill now fails on anything a bot cannot reach.
- **The view model forearms (item 1).** Elbows are shoulder anchors in camera space, the inspect turns about the gun's centre, the sleeve end is capped, and a near-plane guard is in. A review found the guard could build an 8 m forearm at a sprint; the slide and the arm length are capped now.
- **The ring (item 4).** Every circle stays inside the map, and late circles lean toward cover. A review found the first ring sat on the map edge 58% of the time; it redraws instead of clamping, and 20,000 matches give 19,926 different first rings.
- **Loot tiers, a hot zone, typed spots (items 5 and 6).** A review found the rewrite had cut guns by 57% and multiplied magazines by 8. The floor was retuned to the old mix with slightly more of everything, and a density check now counts it.
- **Looting (item 9).** Ammo and small heals are taken as you walk over them, holding the key takes everything in reach, and a reach list shows what is there.
- **Bot senses and looting (items 20 and 21)**, wired after the reset: battle royale bots see 60 to 170 m by tier and loot their own gun, armour, heals and grenades. Two bugs the wiring exposed are fixed: bots chasing loot on the floor above, and bots landing inside the ridge's rock.
- **Knockdown shield and backpack tiers (item 25)**, wired after the reset: both are floor loot, a pack adds heal room and gold heals faster, and a gold shield's self-revive works (hold interact while down). The walk-over pickup turned out never to have run in a real match; it does now, and it keeps out of death boxes.
- **Free assets.** Ten material sets, six skies, eight rock and scrub meshes, seventeen sounds, forty-five icons, and self-hosted fonts (no request to Google any more).
- **Seven hours of the day**, a setting under Graphics that applies with no reload.
- **Audio occlusion** and a cue for sounds above or below you.
- **Icons on the grenade row** of the HUD.
- **Carried shockwave and rift charges** (restored after the reset), battle royale floor loot.
- **The battle royale rules (items 24, 32, 34, 46)**, reviewed and merged after the second reset: solo, duos and trios; the care package called before it falls, with its canopy, smoke, thump and a contest window; a loadout crate that hands you your own saved guns; and Storm Surge, which hurts whoever has dealt no damage lately when too many are alive late. The review found and fixed twenty problems, among them a surge that only ever reached the host.
- **Bots look at their arc before throwing**, and grenades fly the same at any frame rate. This was the cause of the one flaky e2e check.
- **Three new arenas and a map picker** (finished after the limit reset): the Vault for 1v1 and free-for-all, the Crossing for team modes, the Ringworks for free-for-all and Crown. Pick one in the modes row, or "picked for the mode". The warehouse is still the default. The offline 1v1 against bots uses the picker too.
- **After the second reset:** a damage direction indicator, crosshair customisation, colour vision modes and a HUD scale, XP with levels and challenges, a match summary card, quick chat, and spawning facing open floor in the new arenas. Two flaky e2e checks were found at their causes and fixed.
- **Delta state packets (item 51)**, reviewed, fixed and merged (Milestone 62): a player's state goes as its difference from one the other end has acknowledged, and one packet a frame carries everything for a peer. The host's upload to a guest in a squad battle royale fell from 34.8 to 7.3 kB/s; an older build still plays against this one on the full packets.
- **A loading screen**: the models and textures counted in, a tip to read, gone once the world is in. And loot laid over each place's whole reach, none of it on a wall's top.
- **The Outskirts map, stages 1 to 3 and most of 4 (items 12, 16, 17, 18, 30)**: the ground has a shape (a bowl of berms round the hub, the Notch ridge with its defile, the Table mesa, the Wash with its culverts, the Knuckles), the map ends at a 10 m cliff on a stepped shelf with four gate towers instead of 92 posts, THE MAST stands at the hub (seven floors to a 28 m roof, its balloon on top), East Ridge has a room inside it and a chimney stack, West Town has roof stairs, a clocktower and a water tower, North Yard has walk-through container runs and a silo block, South Depot has walled bays, a loading building and a portal crane, and each of the five big places has its own wall tint. Building stairs climb to the roofs, so the bots stand on roofs for the first time. The map's triangles fell from 457k to under 200k while the meshes grew. Walk into a place and its name comes up.
- **Emotes**: a wheel on 7 with six (wave, cheer, over there, salute, shrug, dance) that everyone sees; your view comes round in front to watch, and a step ends it. Sprays and banner cards are still to do.
- **The Gulag (item 41)**: under the battle royale's own rules, a first death before the fourth ring sends you, 3 s later, to the Vault against a bot of your own on the same two guns: 3 s, 40 s, then an overtime flag won by 4 s alone on it. Win and you drop back in near a mate with those guns; lose and you are out; one trip a match. The room is yours alone; the host only hears you are in it, so your squad is not out and its bots do not hunt you.
- **Resurgence (item 23)**: a choice beside the squad size. The dead redeploy from the sky after 15 s early to 39 s late, cut 5 s by every kill of their side, near a mate who is up, with a sidearm, ammo and heals; the bots too. A squad all down at once is out, deaths go final at the fifth ring, and the ring's clock runs at 60%. The smaller play area the item asked for waits for the map to settle.
- **Ring Consoles (item 22)**: four by four of the places; a 7.5 s scan puts the circle after next on the squad's map until the ring gets there, pays 100 EVO, and the console reboots when the ring closes. The ring's whole chain is drawn from the seed at the start, so every browser knows it.
- **The dropship and the jumpmaster**: the match starts on a ship flying a line across the map over the squad's place; you jump when you like, the ship puts out whoever is left at the far edge, a squad follows the host's jump in formation until C breaks off, and the bots ride along out of sight and glide onto their places. The bots drop from the sky again, which they had stopped doing when the squad match came in.
- **A two-state skydive**: look down to dive at 30 m/s, look level to glide 14 m/s across at 12 down, blended between; the drop's map steps aside after 2.5 s so you can see where you are steering.
- **verify** is 1,200+ checks; its new subjects live in `tools/checks/`.

## Not done, and why

| What | State | Where it is |
|---|---|---|
| **The Outskirts map expansion, stages 4 to 6**: the four compounds rebuilt with a fourth building each, eight micro-POIs between the places (the `sites` list is ready for them, empty), the rotation network, and the bot graph over the new ground | Stages 1 to 3 are built and shipped, and most of stage 4 (North Yard and South Depot); the session limit stopped the rest. | The six-stage plan is in the workflow's result; `.map-expansion.js` in the main folder is its script. |
| **Applying the new materials and rock meshes to the map** | Fetched and loadable, not placed. | Belongs with the map expansion |
| **Per-match sky pick** in the battle royale | The setting works; a match does not pick an hour by seed. | `brmatch.ts` |

## Fixed after the limit reset

- **The gun swap bug.** Taking a gun with both slots full put the old one at your feet, and a held press took it straight back: sixteen swaps in a quarter of a second, traced in a real page. A gun at your own feet is left out of the reach list for 0.8 s after you take one, and holding the key never takes guns. The e2e loot check passes.
- **The carried charges are back.** The frag check that failed with them does not reproduce: it failed only when the three-tab section ran first, passed with the blast instrumented, and the full first batch (185) and second batch (128) pass with the charges in. It turned out to be real after all: the bot lobbed frags into whatever stood in the arc's way. Bots now trace their arc before throwing, and the check passes steadily.

## Ranked next steps

3. **Finish the Outskirts map expansion**: the four compounds, the eight micro-POIs with their loot and arrival names, the rotation network, and new bot nodes on the new ground. Stages 1 to 3 and most of 4 are in.
9. **Place the new materials and rock meshes** on the map, one palette per place.
10. **Doors and supply bins** (items 10 and 11). The sounds for them are already fetched and have calls in `audio.ts`.
11. Then down `docs/NEXT_STEPS.md`: LOD and draw distance, sprays and banner cards, doors and bins once the map is finished. (Spectating your squad already works; the dropship, the Ring Console, Resurgence, the Gulag, the loading screen and emotes are done.)

## What we are still missing against the big shooters

These came out of the gap analysis. The ones since shipped are gone from this list: the drop (the dive, the dropship and the jumpmaster), who is shooting me (the damage direction arcs), the reticle, HUD scale and colour vision settings, XP with levels and challenges, the match summary card, and quick chat.

- **A map that is a level**, with terrain, landmarks you can name from far away, and a mid band worth crossing. The expansion is being built.
- **Doors, bins, vaults and keycards**, the interactive layer every modern battle royale has.
- **Crafting and an economy**: replicators, cash and buy stations, contracts.
- **After you die**: done now (spectating a squad mate, the match summary, Resurgence and the Gulag).
- **Settings**: a text scale apart from the HUD scale.
- **Progression**: unlocks, emotes and banners on top of the levels and challenges.
- **Netplay**: voice, host migration and rejoin. The online board's shared key is still in the page, though a signed-in name can no longer be taken by anyone else.
- **Performance**: batching the map's draw calls, LOD and draw distance, and a loading screen.

## Prompts to paste when the limit resets

3. "Finish the Outskirts map expansion: the four compounds, the eight micro-POIs, the rotation network and the bot graph over the new ground. Keep the nav flood test passing."
7. "Review the delta-compressed netcode on wip/phase15-unfinished, run the p2p e2e section and npm run live, and merge only if both pass."
