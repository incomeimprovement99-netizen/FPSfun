# Character attribution

Released as **Public Domain (CC0 1.0)**: commercial use permitted, attribution
not required, redistribution permitted. Credited anyway.

| Files | What | Author | Source |
|---|---|---|---|
| `Superhero_*_FullBody.gltf` | The bodies the figures are built on: real topology, a face, base colour, normal and roughness maps | Quaternius | Universal Base Characters, https://quaternius.itch.io/universal-base-characters |
| `hair/Hair_*.gltf` | Hair and a beard, rigged to the Head bone | Quaternius | the same pack |
| `../outfits/*.gltf` | Modular garments: bodies, arms, legs, boots, hoods and pauldrons | Quaternius | Modular Character Outfits, https://quaternius.itch.io/modular-character-outfits-fantasy |

All of it is built on the same universal humanoid rig as the Universal
Animation Library our clips come from (the Unreal mannequin's bone names), so
the bodies take our animations and the garments hang on the bones the outfit
system measures against. Fetched by `tools/fetch-characters.ts`.
