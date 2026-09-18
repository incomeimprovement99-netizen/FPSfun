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
- **A two-state skydive**: look down to dive at 30 m/s, look level to glide 14 m/s across at 12 down, blended between; the drop's map steps aside after 2.5 s so you can see where you are steering.
- **verify** is 1,200+ checks; its new subjects live in `tools/checks/`.

## Not done, and why

| What | State | Where it is |
|---|---|---|
| **The Outskirts map expansion**: ground shape, a real map edge, THE MAST landmark, rebuilt ridge and town, eight micro-POIs, the rotation network, the bot graph over it | A six-stage build plan was designed and merged from three designs. **No stage was built**: the session limit hit first. | The plan is in the workflow result; the next prompt below restarts it. |
| **Delta-compressed netcode** (item 51) | Built, review never ran. Netcode that is wrong breaks every game with your buddy, so it is not shipped unreviewed. | `wip/phase15-unfinished`: `src/net/state.ts`, `statesync.ts`, `wire.ts`, `link.ts`, `net.json`, `tools/checks/net-delta.ts` |
| **Applying the new materials and rock meshes to the map** | Fetched and loadable, not placed. | Belongs with the map expansion |
| **Per-match sky pick** in the battle royale | The setting works; a match does not pick an hour by seed. | `brmatch.ts` |

## Fixed after the limit reset

- **The gun swap bug.** Taking a gun with both slots full put the old one at your feet, and a held press took it straight back: sixteen swaps in a quarter of a second, traced in a real page. A gun at your own feet is left out of the reach list for 0.8 s after you take one, and holding the key never takes guns. The e2e loot check passes.
- **The carried charges are back.** The frag check that failed with them does not reproduce: it failed only when the three-tab section ran first, passed with the blast instrumented, and the full first batch (185) and second batch (128) pass with the charges in. It turned out to be real after all: the bot lobbed frags into whatever stood in the arc's way. Bots now trace their arc before throwing, and the check passes steadily.

## Ranked next steps

3. **Build the Outskirts map expansion** from the six-stage plan. It is the owner's top ask and the backbone of everything else in the battle royale.
8. **Review and ship the delta netcode**, then run the `p2p` section and `npm run live` before any deploy.
9. **Place the new materials and rock meshes** on the map, one palette per place.
10. **Doors and supply bins** (items 10 and 11). The sounds for them are already fetched and have calls in `audio.ts`.
11. Then down `docs/NEXT_STEPS.md`: the Ring Console, Resurgence, spectate your squad, the Gulag, a drop with a dropship and a jumpmaster, emotes.

## What we are still missing against the big shooters

These came out of the gap analysis and nobody has started them:

- **A map that is a level**, with terrain, landmarks you can name from far away, and a mid band worth crossing.
- **A drop**: a dropship line and a jumpmaster. (The two-state dive is done.)
- **Doors, bins, vaults and keycards**, the interactive layer every modern battle royale has.
- **Crafting and an economy**: replicators, cash and buy stations, contracts.
- **After you die**: spectating your squad, the Gulag, a real match summary.
- **Who is shooting me**: a damage direction ring and better hit feedback.
- **Settings**: reticle customisation, HUD scale, colourblind palettes, text scale.
- **Progression**: XP, levels, challenges, unlocks, emotes, banners.
- **Netplay**: voice or quick chat, host migration and rejoin, and moving the leaderboard secret out of the browser bundle.
- **Performance**: batching the map's draw calls, LOD and draw distance, and a loading screen.

## Prompts to paste when the limit resets

3. "Build the Outskirts map expansion. The six-stage plan is in docs/PHASE_15_UNFINISHED.md: ground shape and map edge, THE MAST at the hub, rebuilt ridge and town, the other places, eight micro-POIs, then the rotation network and the bot graph. Keep the nav flood test passing."
7. "Review the delta-compressed netcode on wip/phase15-unfinished, run the p2p e2e section and npm run live, and merge only if both pass."
