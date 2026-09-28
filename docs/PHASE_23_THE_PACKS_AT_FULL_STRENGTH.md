# Phase 23 results: the packs at full strength, and the city drawn in to the middle

The round planned in `docs/PHASE_23_PLAN_THE_PACKS_AT_FULL_STRENGTH.md`, item by item as each ships. Started
2026-09-28.

| id | item | state | milestone | what it came to |
|---|---|---|---|---|
| 23.1 | Sharper textures on High, lighter on every preset | shipped | 290 | KTX2 at 2K, 1K and 512; the kit's texture memory 1.2 GB, 298 MB and 50 MB (Balanced from about 1.8 GB); downloads 119, 40 and 24 MB |
| 23.2 | The rooms behind the windows at full depth | shipped | 293 | 610 of 1,395 window walls whole rooms (from none); the towers' faces skinned and hidden under the kit, every face storey covered |
| 23.3 | The outer districts cut by about three quarters | | | |
| 23.4 | The packs' street life | | | |
| 23.5 | The batch's release tests | | | |

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

