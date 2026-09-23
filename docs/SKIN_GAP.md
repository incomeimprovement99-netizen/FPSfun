# Skins: where we are, counted

**Written 2026-09-22**, the day the published assets went in and our own geometry came out; **rewritten the
same evening** after the clothes were caught not covering the body and after the free asset pool was
searched to the bottom. This counts what is there rather than remembering it, says what each gap costs a
player, and ranks what to do.

## What exists

| | Count | Notes |
|---|---|---|
| Outfits | **20** | every one of them published cloth; none built in code |
| Distinct garment combinations | **12** | see the lopsided part below |
| Source sets behind them | **2** | Quaternius's Ranger and Peasant (CC0), 40 part files in all |
| Bodies | **2** | one heavier, one lighter, same skeleton and so the same hit boxes |
| Hair and beards on disk | **4** | buzzed, parted, long, a beard. **None of them worn by anything** |
| Recoloured atlases | **11** | one per outfit that asks for a colour, 484 KB |
| Operators | **6** | each in its own outfit |
| Loadouts shipped dressed | **6 default + 6 custom** | customs arrive in different clothes with different melee weapons |
| Heirlooms | **10** | |
| Gun finishes | **8** | all open from the first minute, no levels |

## The two faults that made the clothes fail to cover the body

Both are fixed; both are worth writing down because neither was visible from the code.

**A garment file holds more than one mesh.** The Ranger body file is a coat plus two belts. We wore the
first skinned mesh we found and dropped the rest, so a figure turned up in a belt on a bare chest. Every
skinned mesh in the file is worn now.

**The cloth is cut for a body we do not have.** The garments reference `T_Regular_Male_*`: they were
modelled on the pack's **Regular** proportions. The free tier of Universal Base Characters ships only
**Superhero**, measured at 424 mm across the shoulders against the mannequin's 384. A coat cut for Regular
does not close on Superhero, and no amount of code makes it. The torso is narrowed towards the shoulders
now so the cloth meets, and the garment sits on a 22 mm shell above the skin so the two surfaces stop
fighting over the same pixels. The narrowing is kept off the arms: in the bind pose they lie out at
shoulder height, and scaling them in dragged the hands off their own wrist bones and fanned them out.

## The free asset pool, searched

The owner's instruction was that free assets are a gold mine next to modelling our own. They are, and here
is the whole mine as of today.

| Source | What is free | Verdict |
|---|---|---|
| **Quaternius, Universal Base Characters** | 2 bodies, 5 hairstyles | **taken, all of it.** The other 6 bodies, including the **Regular** the clothes are cut for, and 20 hairstyles, are $19.99 |
| **Quaternius, Modular Character Outfits** | Ranger and Peasant only | **taken, all of it.** The other outfits, 82 modular parts, are $20 |
| **Mixamo (Adobe)** | **108 rigged characters**, free for unlimited commercial use, no attribution, no royalty | **the gold mine.** Swat, Swat Guy, Gas Mask, Vanguard, Exo Gray and Exo Red, Alien Soldier, Prisoner in coveralls, and about sixty men and women in t-shirts, jackets and jeans. The public list endpoint answers without a login; the **export** endpoint does not. One Adobe token unlocks all 108 |
| **Sketchfab, CC0 and downloadable** | museum scans | nothing rigged and human. Searched for soldier, swat, military uniform, tactical vest, hoodie, camouflage |
| **itch.io, CC0 characters** | KayKit and the low-poly packs | fantasy or blocky, each on its own rig, and a step down from what we already have |
| **Poly Pizza** | mirrors Quaternius and Kenney | nothing we do not have |
| **ambientCG, Poly Haven** | CC0 **textures**: fabric, leather, canvas | no garments, but real cloth for the ones we own |

The conclusion is short: **the free clothing is exhausted and the free bodies are exhausted.** What is left
free and untouched is Mixamo, and it is the largest of the lot.

## The gap, and what it costs

**1. Three shapes wearing twenty names.** Twelve of the twenty outfits are one of three silhouettes. Colour
tells them apart and shape does not, so at eighty metres COVERALLS, TRACKSUIT, PLAIN CLOTHES, DESERT and
WORKWEAR are the same person in different paint. A silhouette is what a player reads first.

**2. The cut is fantasy, and the names are not.** MOTOCROSS is a ranger's coat in blue; FATIGUES is a
ranger's coat in olive. The cards promise a military, a sports and a dirt bike look the meshes cannot give.

**3. Nothing covers a pair of eyes.** The pack has one hood and no eyewear.

**4. Every figure is bald.** Four hair meshes and a beard sit on disk, rigged to the Head bone, worn by
nobody. This is free content already downloaded.

**5. Bare hands on every figure.** The only skin left now that the clothes are real.

**6. The second body is barely used.** Four outfits are cut for it and a player cannot choose it.

## Ranked, and what happened to each

| # | Step | Why | State |
|---|---|---|---|
| 1 | **Wear the hair** | Gap 4. Four rigged CC0 meshes already downloaded and unused, and a bald head is the first thing an eye goes to. | **done.** Each outfit names a hairstyle and a colour; the pack ships its hair as a grey mask, mean 143 of 255, so without a colour every figure was white haired |
| 2 | **Unstick the pauldron** | It floated off the shoulder in a close shot. | **done.** The 22 mm shell is for the layer against the skin only: a pauldron sits on the coat and a hood on the head, and both were being lifted clear |
| 3 | **Mix the parts harder** | Gap 1. Twelve outlines out of forty part files is not the most the pack can give. | **done.** Twenty outfits, twenty outlines, held there by a check. The female sets wear the male garments, because the pack's female tops are corsets. The recoloured atlases went to one per outfit and pack, since the two packs lay their UVs out differently |
| 4 | **A Mixamo importer** | Gaps 1, 2 and 3 at once, and the only free thing that does all three. | **half done.** `npm run mixamo` lists the catalogue and writes it to `assets/mixamo/catalogue.json`; the list endpoint answers without a login. The export is wired and waits on `MIXAMO_TOKEN`. The FBX converter is deliberately unwritten: a converter written against a file nobody has yet is a converter that does not work |
| 5 | **Let a player pick the body** | Gap 6. On disk, rigged, textured, already used by four outfits. | **next.** See below: the `build` control it would sit beside is dead, and they are the same job |
| 6 | **Real cloth instead of flat colour** | The atlases are one base colour multiplied by a hex. CC0 fabric and leather from ambientCG would make an outfit read as a material. | not started, free and scriptable |
| 7 | **Gloves** | Gap 5, and there is no free glove that fits this rig. | blocked on step 4 or on money |

### The dead control

`build` - LEAN, REGULAR, HEAVY - is in the loadout, saved, sent over the wire,
and does nothing. It was a thickness multiplier on the garments we built in
code, and those are off. On published cloth the garment IS the silhouette, so
making it mean something again means scaling the garment geometry per build
and caching it per part and build, the way the bodies are cached. That is the
same job as letting a player pick a body, and they should ship together.

## The two things only the owner can decide

- **A Mixamo token.** Log in at mixamo.com, and the bearer token in any request the page makes unlocks the
  export endpoint for all 108 characters. This is the single largest free win available to the project.
- **$40.** $19.99 for the other six Quaternius bodies, including the **Regular** the garments are actually
  cut for, which ends the fit problem at its root rather than working around it; and $20 for the other 82
  modular garment parts. Both CC0, both from the author whose rig we already use.

**What is deliberately not here.** Building our own garments again: the owner saw what that looks like and
the answer was no. Anything we put on a figure from now on is an asset somebody modelled.
