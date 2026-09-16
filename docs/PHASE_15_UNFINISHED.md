# Phase 15: what did not get done, and what comes next

**Written 2026-09-16, when the weekly limit was nearly spent.** Everything listed as shipped is on `main`, pushed, and live at https://fpsfun.duckdns.org/ (the deploy's live check passed). Unfinished work is saved on the branch `wip/phase15-unfinished`, also pushed.

## Shipped this round

- **Bot nav graph.** Three nodes stood inside solid boxes, the ridge ramp stopped 5 m short of the top, and three drop spots were inside walls. An e2e flood fill now fails on anything a bot cannot reach.
- **The view model forearms (item 1).** Elbows are shoulder anchors in camera space, the inspect turns about the gun's centre, the sleeve end is capped, and a near-plane guard is in. A review found the guard could build an 8 m forearm at a sprint; the slide and the arm length are capped now.
- **The ring (item 4).** Every circle stays inside the map, and late circles lean toward cover. A review found the first ring sat on the map edge 58% of the time; it redraws instead of clamping, and 20,000 matches give 19,926 different first rings.
- **Loot tiers, a hot zone, typed spots (items 5 and 6).** A review found the rewrite had cut guns by 57% and multiplied magazines by 8. The floor was retuned to the old mix with slightly more of everything, and a density check now counts it.
- **Looting (item 9).** Ammo and small heals are taken as you walk over them, holding the key takes everything in reach, and a reach list shows what is there.
- **Bot senses and looting (items 20 and 21).** Built, but **not wired**: see below. A bot that finds no gun keeps looking now instead of walking the match unarmed.
- **Knockdown shield and backpack tiers (item 25).** Built in `kit.ts` with 56 checks. **Not wired** into a match yet.
- **Free assets.** Ten material sets, six skies, eight rock and scrub meshes, seventeen sounds, forty-five icons, and self-hosted fonts (no request to Google any more).
- **Seven hours of the day**, a setting under Graphics that applies with no reload.
- **Audio occlusion** and a cue for sounds above or below you.
- **Icons on the grenade row** of the HUD.
- **Three new arenas and a map picker** (finished after the limit reset): the Vault for 1v1 and free-for-all, the Crossing for team modes, the Ringworks for free-for-all and Crown. Pick one in the modes row, or "picked for the mode". The warehouse is still the default. The offline 1v1 against bots still plays the warehouse.
- **verify** is 1,160+ checks; its new subjects live in `tools/checks/`.

## Not done, and why

| What | State | Where it is |
|---|---|---|
| **The Outskirts map expansion**: ground shape, a real map edge, THE MAST landmark, rebuilt ridge and town, eight micro-POIs, the rotation network, the bot graph over it | A six-stage build plan was designed and merged from three designs. **No stage was built**: the session limit hit first. | The plan is in the workflow result; the next prompt below restarts it. |
| **The BR rules bundle**: loadout drops, care package theatre, Storm Surge, solo and duo BR (items 24, 32, 34, 46) | Built, but its adversarial review never ran. | `wip/phase15-unfinished`: `brmatch.ts`, `loadouts.ts`, `squad.json`, `br.json`, `index.html`, `menu.ts`, `tools/checks/br-rules.ts` |
| **Delta-compressed netcode** (item 51) | Built, review never ran. Netcode that is wrong breaks every game with your buddy, so it is not shipped unreviewed. | `wip/phase15-unfinished`: `src/net/state.ts`, `statesync.ts`, `wire.ts`, `link.ts`, `net.json`, `tools/checks/net-delta.ts` |
| **Carried mobility: shockwave and rift charges** (item 29) | Built and wired, then **backed out**: it stops a bot's frag blast from landing on you (e2e "tiers: and the frag's blast lands on you" passes without it and fails with it). Cause not found. | Commit `4027dcb` (reverted on `main`), also on `wip/phase15-unfinished` |
| **Wiring bot senses and bot looting** into a match | `brmatch.ts` never sets `sightMode` or `lootSource`, so battle royale bots still use arena sight and are handed a kit. | `src/game/bots.ts` is ready; the wiring goes in `brmatch.ts` |
| **Wiring knockdown and backpack tiers** | `main.ts` still uses its own inline knockdown object; no backpack is generated as loot. | The kit agent's full wiring list is in the workflow result |
| **Applying the new materials and rock meshes to the map** | Fetched and loadable, not placed. | Belongs with the map expansion |
| **Per-match sky pick** in the battle royale | The setting works; a match does not pick an hour by seed. | `brmatch.ts` |

## Known failing check

One e2e check fails on `main`: **"loot: a second gun fills the other slot, a third goes in place of the one in hand, which goes down."** The test holds the take key for about 250 ms. With the new reach list, the gun you just swapped out lands at your feet, is in reach, and gets taken straight back. A real single press is one frame and is probably fine; **holding** the key to take everything is likely to swap back and forth. A quick fix that skips just-dropped items was tried, and in that version the swapped gun disappeared from the floor, so it was not shipped. Fix this one first.

Not run before the deploy: the `p2p` e2e section. The deploy's own live check played a real 1v1 over the internet and passed.

## Ranked next steps

1. **Fix the gun swap in the reach list** and make that e2e check pass.
2. **Find why the mobility charges break bot frag blasts**, then restore commit `4027dcb`.
3. **Build the Outskirts map expansion** from the six-stage plan. It is the owner's top ask and the backbone of everything else in the battle royale.
4. **Review and ship the BR rules bundle** from the parked branch.
5. **Wire bot sight and bot looting** into `brmatch.ts`, so BR bots see across the map and loot for their kit.
6. **Let the offline 1v1 against bots use the new arenas**: `BotMatch` in `bots.ts` still hardcodes the warehouse.
7. **Wire knockdown and backpack tiers** into `main.ts` and the loot table.
8. **Review and ship the delta netcode**, then run the `p2p` section and `npm run live` before any deploy.
9. **Place the new materials and rock meshes** on the map, one palette per place.
10. **Doors and supply bins** (items 10 and 11). The sounds for them are already fetched and have calls in `audio.ts`.
11. Then down `docs/NEXT_STEPS.md`: the Ring Console, Resurgence, spectate your squad, a match summary, the Gulag, a damage direction indicator, reticle and colourblind settings, a progression spine.

## What we are still missing against the big shooters

These came out of the gap analysis and nobody has started them:

- **A map that is a level**, with terrain, landmarks you can name from far away, and a mid band worth crossing.
- **A drop**: a dropship line, a jumpmaster, a two-state dive.
- **Doors, bins, vaults and keycards**, the interactive layer every modern battle royale has.
- **Crafting and an economy**: replicators, cash and buy stations, contracts.
- **After you die**: spectating your squad, the Gulag, a real match summary.
- **Who is shooting me**: a damage direction ring and better hit feedback.
- **Settings**: reticle customisation, HUD scale, colourblind palettes, text scale.
- **Progression**: XP, levels, challenges, unlocks, emotes, banners.
- **Netplay**: voice or quick chat, host migration and rejoin, and moving the leaderboard secret out of the browser bundle.
- **Performance**: batching the map's draw calls, LOD and draw distance, and a loading screen.

## Prompts to paste when the limit resets

1. "Fix the gun swap bug in the reach list: holding E after a swap picks the dropped gun back up. Make the e2e loot check pass without making the swapped gun disappear."
2. "On branch wip/phase15-unfinished, commit 4027dcb added shockwave and rift charges and it breaks the e2e check 'tiers: and the frag's blast lands on you'. Find the cause, fix it, and bring the charges back to main."
3. "Build the Outskirts map expansion. The six-stage plan is in docs/PHASE_15_UNFINISHED.md: ground shape and map edge, THE MAST at the hub, rebuilt ridge and town, the other places, eight micro-POIs, then the rotation network and the bot graph. Keep the nav flood test passing."
4. "Review the BR rules bundle on wip/phase15-unfinished (loadout drops, care package theatre, Storm Surge, solo and duo), fix what the review finds, and merge it."
5. "Wire bot sight and bot looting into brmatch.ts, and wire the knockdown and backpack tiers into main.ts and the loot table."
6. "Let the offline 1v1 against bots (BotMatch) play on the Vault, the Crossing and the Ringworks, using the map picker."
7. "Review the delta-compressed netcode on wip/phase15-unfinished, run the p2p e2e section and npm run live, and merge only if both pass."
