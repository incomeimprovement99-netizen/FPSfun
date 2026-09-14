# Results: the look pass, the movement pass, and the models

Follows `PLAN_LOOK_AND_FEEL.md`. Owner asks, in order:

1. "can we do something about the shitty looking brick graphics? or is this
   the limitation of the browser?"
2. "i don't feel like the movement is quite at apex yet"
3. "ensure the weapon and player models look way less like roblox"

## Answer to the browser question

Not a browser limitation. WebGL2 is roughly DirectX 11 class. Everything wrong
with the frame was art direction and a handful of real bugs, listed below.

## What shipped

### Look
| ID | Change | File |
|---|---|---|
| A1 | Colour grade after tone mapping: split tone, S-curve, saturation, vignette, grain, gamut guard | `src/game/grade.ts` |
| A2 | Re-light: 41 degree sun, environment at 0.85, hemisphere bounce, rim light | `src/game/range.ts` |
| A3 | Authored gradient sky dome; the HDRI stays as the environment only | `src/game/sky.ts` |
| A4 | Bevelled geometry for all structure (`RoundedBoxGeometry`) | `src/game/geo.ts` |
| A5 | One committed palette; painted-metal metalness | `src/game/geo.ts`, `range.ts` |
| A6 | Hazard chevrons on the firing line, floor distance numerals, orange kick plates, handrails, emissive edge strips, lit ceiling | `src/game/range.ts` |

### Models
| Change | File |
|---|---|
| All 27 weapons modelled from extruded, bevelled side profiles in seven families; R-301 and Wingman in the most detail | `src/game/gunmodels.ts` |
| Gloved first-person hands and sleeved forearms that follow the hands | `src/game/arms.ts` |
| Bolt, slide, pump, bolt-action and cylinder cycling; muzzle flash with a real light; ejected brass and shotgun hulls; magazine, cylinder and shell reloads with the support hand doing the work; look lag; breathing; landing dip; rarity-coloured, longer magazines by mag level | `src/game/viewmodel.ts` |
| Dummies: a jointed training robot over INVISIBLE, unchanged hit zones; hit flash (gold on the head); animated fall; armour vest and base ring in the tier colour; merged to ~7 draw calls each | `src/game/dummy.ts` |
| Targets: bullseye boards in a bevelled frame on an A-frame stand with an LED readout; flippers are extruded steel silhouettes with scoring zones on a hinge. Hit meshes unchanged | `src/game/targets.ts` |

### Movement
| ID | Change |
|---|---|
| B1 | Sprint FOV kick (1.08), cancelled by ADS |
| B2 | Wall climb: hold jump facing a wall, 230 hu/s, 3 m from where the climb started, finishes with a mantle |
| B3 | Tap-strafe lurch, using the constants that were already in `movement.json` and read by nothing |
| B4 | Downhill slides gain speed (g sin theta, derived from descent rate, so no surface normal needed) |
| B5 | Landing dip, strafe roll; cosmetic only, the aim never moves |
| B6 | Sprint viewmodel pose |

## Verification

- `npm run verify`: PASS, 311 checks. New: wall climb, lurch, slope slide,
  ramp break-even angle, view-feel bounds, viewmodel roster coverage.
- `npm run check`, `npm run build`, `npm run rules`: clean.
- `npm run shot` with new views: `gun-r301`, `gun-r301-ads`, `gun-r301-reload`,
  `gun-wingman`, `gun-wingman-reload`, `gun-flatline`, `gun-mastiff`,
  `dummy-close`, `targets`. A `debugView` hook on `window.__range` poses the
  viewmodel for screenshots; it changes only what is drawn.
- Zero page errors (the one remaining 404 was the favicon; one was added).

## What was wrong along the way

These are the reusable part.

1. **The first re-light over-corrected into a night scene.** Lower sun, a
   third of the environment and a cool grade, stacked: three darkening
   changes at once. The reference is a bright sunny desert, not golden hour.
2. **The grade was working in the wrong colour space.** `THREE.Color`
   linearises on assignment but the pass runs after tone mapping on sRGB.
   The tint's channel ratios were exaggerated, red was driven negative and
   clamped to zero. Measured off the screenshot: `rgb(0, 44, 90)`. Fixed by
   reading the hex bytes directly and adding a gamut guard that desaturates
   instead of clipping a channel.
3. **The "dark sky" was not sky.** A pixel measurement put the dark/light edge
   at screen y = 126 to 139; the roof's leading edge projects to y = 132. The
   player spawned under the roof and its underside filled the top of frame.
4. **Metalness is a physical claim, not a gloss dial.** The 0.72-metal roof
   reflected only blue sky and had no diffuse at all. Painted steel is
   dielectric.
5. **The ramp could never have accelerated a slide.** Built by eye at 12.9
   degrees; the break-even at the slide boost cap is 30.4 degrees. The angle
   is now derived from the physics in `movement.ts`.
6. **The AO pass drew sprites and invisible meshes as solid.** `GTAOPass`
   redraws the scene with an override material and hides only points and
   lines. The distance-label sprites became black rectangles on the walls,
   and the dummies' new invisible hit zones would have put box-shaped AO
   halos round every robot. The pass now skips sprites, transparent and
   invisible materials for its prepass.
7. **The viewmodel's visible flank faces away from the sun.** The camera sits
   left of the gun. Games use a viewmodel-only light rig; three cannot mask
   lights per object, so the viewmodel-only materials get extra image-based
   fill instead.
8. **The support forearm needs a different elbow when aiming.** A hip-pose
   elbow stretched it into a tube across the sight picture.

## Still open

- **Slide friction on slopes.** The combination of `slideDecel` and
  `slideVelocityDecay` is unpublished (already flagged in `FIDELITY.md`). With
  the current formula, a hill gentler than 17 degrees still slows a slide at
  walking speed. If real slides carry on gentler hills, this is the constant
  to change, and it needs a measured target, not a guess.
- Superglide, wall bounce, fallstun.
- Scope sight pictures; snipers use iron sights.
- Bullet-hole decals and impact sparks.
- Sounds are still synthesised.
- The named range areas (Duel Pit, Agility Course, Tech Tunnel, Wolf's Peak).
- The shadow on the right-hand wall still reads too blue; the steel palette
  could go more neutral.
- A second session appears to have edited `geo.ts` (palette) and `range.ts`
  (roof moved back) in parallel with this one. Both changes were kept.
