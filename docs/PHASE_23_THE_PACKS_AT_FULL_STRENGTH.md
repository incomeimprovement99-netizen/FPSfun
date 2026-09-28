# Phase 23 results: the packs at full strength, and the city drawn in to the middle

The round planned in `docs/PHASE_23_PLAN_THE_PACKS_AT_FULL_STRENGTH.md`, item by item as each ships. Started
2026-09-28.

| id | item | state | milestone | what it came to |
|---|---|---|---|---|
| 23.1 | Sharper textures on High, lighter on every preset | shipped | 290 | KTX2 at 2K, 1K and 512; the kit's texture memory 1.2 GB, 298 MB and 50 MB (Balanced from about 1.8 GB); downloads 119, 40 and 24 MB |
| 23.2 | The rooms behind the windows at full depth | shipped | 293 | 610 of 1,395 window walls whole rooms (from none); the towers' faces skinned and hidden under the kit, every face storey covered |
| 23.3 | The outer districts cut by about three quarters | shipped | 296 | the map 304 m across (from 500), the districts 75% smaller, the centre proven unchanged |
| 23.4 | The buildings as the packs build them | moved | | taken over by Phase 24 (`docs/PHASE_24_THE_CENTRE_FROM_THE_PACKS_OWN_BUILDINGS.md`), which builds them from the packs' own demo streets |
| 23.4b | Light and air | shipped | 298 | the haze coloured by block, thinning as you climb, the sky's horizon the same colour, the streets wet and reflecting the lit city; Balanced and High |
| 23.5 | Our old look replaced (cars, pads, kerb lines, bridges, billboards) | | | |
| 23.6 | Density like the store | | | |
| 23.7 | The districts dressed in the packs | later | | the owner, 2026-09-28: "Save the districts for later on, we still don't even have the center looking like they do in the asset packs" |
| 23.8 | Nothing of the old look left | | | |
| 23.9 | The batch's release tests | | | |

## Notes as it goes

- **Before the first edit:** measured the textures' graphics memory (1.76 GB decoded for the placed pieces at 1K, 7 GB
  at 2K), which turned "2K on High" into GPU-compressed textures; found no KTX2 encoder installed and took Basis
  Universal's own WebAssembly build rather than installing KTX-Software on the owner's machine.
- **23.1:** the first bake came out white in the pictures: the KTX2 images went into the GLBs without
  KHR_texture_basisu, which gltf-transform's IO writes only when the extension is registered with it. Fixed in the
  importer and the 15 files rewritten in place, rather than encoding again. The owner asked whether "most people
  couldn't play the good textures": no, the compression is what lets everyone have them, and no preset got worse
  textures; ETC1S is a little lossier a pixel than the WebP, far outweighed at twice the resolution in the pictures.
- **23.2 measured already:** the importer's new `front` share separates the room modules (Kyber's and Cyber City's
  window walls, 0.57 to 0.68 of their face at the front) from the relief ones (High City's and Glass's, 0.12 to 0.39).
- **23.2:** hiding the towers' boxes whole would have hidden their stair shafts and the rooms' ceilings (faces of the
  same boxes), and a box with a material per face is not merged (hundreds of draw calls), so each box is split into
  two meshes of one material. The first corner rule (no west or east room within 4.8 m of a corner) left 83% of those
  faces pressed; recording the north and south rooms' footprints and stopping short of them halved that. What is left
  pressed is geometry: 318 at corners, 236 in front of a stair core's end, 0.6 m from the shaft.
- **23.3:** the plan's first idea, one ring of blocks at 36 m, would have reshuffled the city's seeded stream and moved
  the centre (the outer blocks are built first, and a block's draws depend on its size). Built as before and taken
  away again instead, the districts rebuilt from a stream of their own, and the centre fingerprinted before and after.
  Five landmarks were too wide for their cut blocks and crossed into the centre's street (a bot's street link found
  the holo tower's screen in it), and the parked cars moved and one stood on a stairwell's way in: both fitted.
- **The owner, 2026-09-28:** the jump pads and the street's cars still had the look from before the packs; "we probably
  want to repalce all the older graphics with our new ones we have paid assets for". Agreed: 23.5 to 23.8 added, the
  release tests renumbered 23.9.
- **The owner, 2026-09-28:** districts later; the centre first, compared side by side with the packs' store pictures.
- **The side by sides (2026-09-28):** five pairs, store left, ours right. The gap is light and air first, our old
  look second, density third; the plan re-ranked to that order (the plan's last section).
- **The owner, on the buildings:** close pictures against the store and the pack's module proved most faces were flat
  two-triangle panels and the real walls pressed to 42%; the buildings themselves go first (the plan's last section).
