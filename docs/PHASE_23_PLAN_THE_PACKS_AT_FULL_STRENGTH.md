# Phase 23 plan: the packs at full strength, and the city drawn in to the middle

**Written 2026-09-28**, before the first edit of the round. Results, item by item as each ships:
`docs/PHASE_23_THE_PACKS_AT_FULL_STRENGTH.md`. Phase 22's open items (22.4 draw calls, 22.5 the last room at 30 to 60
m, 22.6 the release tests) fold into this round, since the map they measure changes under them.

The owner, 2026-09-28, after comparing the centre with the packs' store pictures and seeing the import's fault
(Milestone 287): "YEP SHARPER TEXTERS ON HIGH AND YEP WE WANT TO UTILIZE THE PACKS TO THEIR FULL POTENTIAL, CUT DOWN
ON THE OTSIDE DISTRICTS TOO BY LIKE 75% BC WE WANT IT TO BE FOCUSED IN THE MIDDLE NOW."

## What was measured first

- **Graphics memory.** A browser decodes a WebP or PNG texture to raw RGBA on the card. The textures the centre's
  placed pieces use are 1.76 GB so decoded at today's 1K (`tools/kit-texmem`); every texture in the five packs, which
  load whole, 3.5 GB. At 2K that is 7 GB and 14 GB: past what a browser gets on most cards, the owner's included in
  time. So "sharper on High" cannot be the same pictures at twice the size.
- **GPU-compressed textures** (KTX2, Basis Universal) stay compressed on the card, 4 to 8 times smaller than RGBA:
  2K on High would cost about what 1K costs today, and 1K on Balanced about a quarter of it. three.js ships the
  browser's side (KTX2Loader and its transcoder); the encoder is Basis Universal's own WebAssembly build (Apache-2.0),
  run in Node by the importer, nothing installed.
- **Half the packs' textures are unused**: 323 of 631. A pack's GLB loads whole, so every unused texture is decoded
  anyway. The importer can write only the pieces the dressing names.
- **The rooms behind the windows.** Kyber's and Cyber City's deep window modules are a wall with a furnished room
  behind the glass, 3 to 4.7 m deep, and the city pressed each to half a metre (its relief rule), so every window shows
  a slab (Milestone 288's finding). They belong with their front on the building's face and the room inside it, where
  the tower's solid box stands, which the city draws over them today.
- **The map.** SpeedKills' city is a 500 m square (`br.ts` BR_HALF 250), 7 by 7 blocks of about 57 m with 14 m
  streets; the centre, THE SPIRE, is the middle 3 by 3 (200 m); the eight outer districts are two rings of blocks
  round it, 150 m deep: 210,000 m² of the map's 250,000.

## The items, in the owner's order

| id | item | how | verified by |
|---|---|---|---|
| 23.1 | **Sharper textures on High, lighter on every preset** | The importer encodes every texture as KTX2 (Basis ETC1S, normal maps in its normal-map mode; UASTC where ETC1S shows banding) at three sizes: 2048 for High (a new `max` bake), 1024 for Balanced, 512 for Competitive; writes only the pieces the dressing names; the game loads them through KTX2Loader. The kit version goes to 3 | graphics memory measured in the browser (`renderer.info`, the transcoded formats) on each preset; the download per preset; pictures at 2K against 1K; a bench, kit on and off |
| 23.2 | **The rooms behind the windows at full depth** | The importer measures each module's front: the share of its face area within 0.3 m of its front. A room module (most of its face at the front) goes with its front on the tower's face and its room inside the tower's box, unpressed; a relief module (frames and cornices before a wall) keeps its relief pressed as today. The centre's tower masses under dressed faces are drawn in materials of their own, hidden once the kit dresses them, as the stalls' and the cars' are; collision unchanged. A canyon's face then wears its modules whole, their fronts on the face | `citykit.ts`: rule 1 on the real depth, no room module's front off its face, nothing of the kit outside a tower's box by more than the relief; the tower masses hidden only when every face storey is dressed; pictures through the windows by day and night |
| 23.3 | **The outer districts cut by about three quarters** | One ring of blocks round the centre instead of two, the ring's blocks 36 m deep: the map 314 m across (half 157), the outer districts 58,600 m², 72% less. The eight sectors keep their names, colours and landmarks, re-fitted; the ring, the drop, the loot, the bots, the edge's fence, the skyline and the minimap follow the size from one number | every check that walks the city (`sk-roofs`, `sk-roofrun`, `city-levels`, `city-budget`, `sk-metro`, `sk-drop`, `sk-stairs`, `sk-escapes`); the e2e batches; a full match played by bots to its end; the street's share of the room to stand, which the cut takes under the plan's 20% |
| 23.4 | **The packs' street life** | The store pictures' clutter at street level, from pieces already imported and the ones not yet: stoops and steps at doors, bins, bags, hydrants, AC units low on the walls, lamps over doors, the fire escapes' drop ladders, puddle decals; a review of the roughly 300 models never imported for what the centre can use | the placed-piece count, pictures of the streets by day and night against the store's, the budgets |
| 23.5 | **The batch's release tests** | The three e2e batches, each failed section rerun alone, `npm run fit`, `npm run live`, a quiet bench of every preset | all green, or each failure named with its cause |

## How each item is done

As Phase 22: build it, check it, write it down (a milestone, a diary entry, a row in the results doc, the README and
the deploy guide kept true), commit, rebase onto main, fast-forward main alone, push, `npm run fps backup`, `npm run
fps deploy` (LIVE CHECK). No Pages. A re-bake is copied into `apex-range/public/models/paid/` before the deploy, and a
new bake takes a new kit version so no browser keeps the old one (Milestone 287's slip). The heavy tests run once, at
the end of the batch. Gameplay numbers in config with notes; numbers about the pieces measured off them.

## Time

About eight hours: 23.1 two (the encoding runs an hour on its own), 23.2 one and a half, 23.3 three (every system
that knows the map's size, and its checks), 23.4 one, 23.5 one and a half.
