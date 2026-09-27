# Hyper Scape gap analysis: the signature guns, the first-person view, the characters

**Written 2026-09-27**, at the owner's request: "do the gap analysis between this and Hyperscape for the char models,
guns and first person views, even when aiming down the sights".

Hyper Scape's side comes from two research passes. Sources are quoted in the Milestone entries of
`DEVELOPMENT_ROADMAP.md`:
- official hack stills and patch notes;
- PC Gamer, GameSpot, Game Informer and TheGamer;
- the Fandom wiki;
- YouTube thumbnails and storyboards;
- r/HYPERSCAPE.

SpeedKills' side is read off `tools/pov-sheet.ts`: the owner's view at 1920 by 1080, FOV 110.

Hyper Scape's nearest guns to ours: the **USSO** is its Ripper (a fast automatic) and Harpy (the true SMG). **BOOG**
is its Protocol V (a scoped bolt-action with a 3-round magazine).

**Status:** ✅ matched, 🟡 partly, ❌ missing, ⛔ by design (ours on purpose).

## Aiming down the sights

| Hyper Scape | SpeedKills now | Status |
|---|---|---|
| Two zoom classes: holo-sights (a plain zoom, the gun on screen) and the 8x scope (full screen) | The same: the SMGs' and rifles' dots zoom with the gun up, BOOG's scope is full screen | ✅ |
| Holo-sights were projected frames with a reticle, red until patch 2.3, white after | Every bought gun aims down its own sight; its dot is drawn red; the USSO wears the pack's reflex sight (Milestone 266) | ✅ |
| The Protocol V's scope: the whole screen in a soft chamfered frame, thin red lines across with range ticks, a post above, stadia below, "x8.00" by a chevron at the left | BOOG's scope is drawn that way (hud.ts drawHsScope), with our recharge bar under the readout; it was a circle | ✅ (Milestone 269) |
| The scope's rear face is a small screen showing the reticle at the hip | BOOG's scope keeps the pack's own glass | 🟡 |
| A lens flare other players see while you are scoped (patch 1.1) | A figure aiming a magnified optic throws a flare, a hot core with a streak across, head-sized near and never under 18 pixels far | ✅ (Milestone 271) |
| No published ADS time | Ours | ⛔ |

## The guns in the hands

| Hyper Scape | SpeedKills now | Status |
|---|---|---|
| The draw "spins the gun ahead of you like a fractured boomerang, materialising your secondary weapon before your eyes" | USSO and BOOG spin once ahead of the hand as they build from dark cubes behind an amber band | ✅ (Milestone 266) |
| A live screen on the gun: the magazine count in digits, fusion as pips, gold at the top | USSO and BOOG carry one: rounds in big digits, fusion pips, gold at level 5 | ✅ (Milestone 269) |
| Glow strips along the gun | The pack's own emissive skin, pulsing on each shot | ✅ |
| Ripper: warm orange-yellow flash timed to the fire rate, mostly vertical recoil | The USSO's flash is warm now; its own tight kick and a buzz | ✅ |
| Protocol V: "thick, blue bullet tracer" | BOOG's tracer is blue and three times as wide | ✅ (Milestone 269) |
| Protocol V: a bolt cycle after every shot | BOOG's recharge: the glow drains and builds, the side wheels turn, a ready ping and flash | 🟡 ours, futuristic by the owner's word |
| Reload: the magazine out and in by hand | The magazine phases out and a new one materialises and slaps in | ⛔ futuristic by the owner's word |
| Fusion: the gun "turning golden" at the top; the level on the gun's screen | The skin changes and the glow brightens each level, a flood and scan on each fusion, gold pips at the top | ✅ |
| No in-match inspect | We have one (a scan along the gun) | ⛔ kept |

## The first-person view

| Hyper Scape | SpeedKills now | Status |
|---|---|---|
| Hands and wrists only, the outfit's gloves; the gun large, bottom right, angled in | The soldier's own gloves and forearms, both arms the same size, the arm running out of the frame | ✅ (Milestone 257) |
| The gun and hands do not change with FOV | The gun camera is fixed at FOV scale 1.55 whatever the setting | ✅ |
| FOV 70 to 105 on console (80 default), 120 on PC | 70 to 110, 108 default | ✅ |
| A hack's cast: the left hand taps an amber card with the hack's icon | Built | ✅ (Milestone 259) |
| Picking up or fusing a hack: pressing hologram buttons | The card is tapped on a hack pickup too | ✅ (Milestone 269) |
| As an Echo (out), your own hands are black-and-white low-poly holograms | Our ghost has no first-person hands | ❌ |

## The characters

| Hyper Scape | SpeedKills now | Status |
|---|---|---|
| Realistic proportions, techwear, emissive cyan accents; a shared default jumpsuit | The bought soldier, four variants and palettes; its armour's own trim | ✅ |
| A red outline on the enemy under your aim | Built (Phase 19) | ✅ |
| A red bar over an enemy's head | The hit plates | 🟡 |
| Movement trails: red for enemies, blue for mates, gold for the crown | None | ❌ next |
| No corpses: the fallen become a hologram (Echo) and a gold Restore Point | Death boxes and ghosts (ours) | 🟡 |

## Feedback on hits and kills

| Hyper Scape | SpeedKills now | Status |
|---|---|---|
| Floating damage numbers, white, crits red | Built (hud.ts drawDamageNumbers) | ✅ |
| Four white ticks round the crosshair, red only on a kill (patch 2.3) | Our hit marker | ✅ |
| A red skull with the victim's name just under the crosshair on a kill, and a three-skull squad-wipe tracker | The kill feed and a notice | ❌ |

## What is next, ranked

1. ~~The scope's lens flare~~ done (Milestone 271).
2. **Movement trails.** Red behind enemies, blue behind mates, gold behind the crown. Hyper Scape's players named them
   among the game's defining reads.
3. **The kill skull and the squad-wipe tracker** under the crosshair.
4. **Echo hands.** As a ghost, low-poly hologram hands in first person.
5. **The scope's rear screen** on BOOG at the hip, showing the reticle.
