# Sound attribution

Recorded sounds from **Kenney** (www.kenney.nl), released under **Creative Commons Zero (CC0 1.0)**:
commercial use permitted, attribution not required, redistribution permitted. Credited anyway.

| Pack | Used for |
|---|---|
| Impact Sounds (kenney.nl/assets/impact-sounds) | footsteps on concrete and grass, landings, a body falling, a punch, the magazine and bolt, a gun hitting the floor |
| Sci-Fi Sounds (kenney.nl/assets/sci-fi-sounds) | the frag's crunch under its synthesised boom |
| Interface Sounds (kenney.nl/assets/interface-sounds) | the menu's clicks, a confirmation, an error |

Footsteps on metal and gravel from **Footsteps on different surfaces** by congusbongus
(opengameart.org/content/footsteps-on-different-surfaces), mastered from freesound.org originals:

| Surface | Original | Licence |
|---|---|---|
| metal | *fboots on aluminum ladder 01* by Eelke, freesound.org/people/Eelke/sounds/462598 | CC-BY 3.0 |
| gravel | *Gravel Footsteps* pack by Ali_6868, freesound.org/people/Ali_6868/packs/21608 | CC0 |

Gunshots from **The Free Firearm Sound Library** (opengameart.org/content/the-free-firearm-sound-library),
recorded by Ben Jaszczak, Brian Nelson, Kevin Heras and Matthew Nanney and released CC0, "no rights
reserved, may be used without royalty or credit". Credited anyway. Re-fetch with `npm run guns`
(tools/fetch-guns.ts), which writes public/audio/guns.

They are layered over the game's own synthesis (src/game/audio.ts); the guns are synthesised. Re-fetch with
`npm run sounds` (tools/fetch-sounds.ts); the files are gitignored.
