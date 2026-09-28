# Mannequin attribution

Released as **Public Domain (CC0 1.0)**: commercial use permitted,
attribution not required, redistribution permitted. Credited anyway.

| File | What | Author | Source |
|---|---|---|---|
| `mannequin.glb` | The mannequin and 19 of its motion-captured clips (idle, walk, jog, sprint, crouch, jump, the pistol aims, a reload, a shot, a hit, a death, a roll) | Quaternius | Universal Animation Library, https://quaternius.itch.io/universal-animation-library |
| `mannequin-more.glb` | 6 more clips for the same skeleton (a slide, a climb, a heal, a knockback, a zipline hang, getting up) | Quaternius | Universal Animation Library 2, https://quaternius.itch.io/universal-animation-library-2 |

Trimmed from the libraries' `UAL1_Standard.glb` and `UAL2_Standard.glb` (no
root motion) with `tools/trim-glb.ts`, which keeps the clips named and drops
the rest (the command lines are in `docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`).
The figures use them only when Settings says "Figures: mannequins"; the robots
built in code are the default.
