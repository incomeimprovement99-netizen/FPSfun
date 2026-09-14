# Plan: the look pass and the movement pass

Two complaints, both fair:

1. *"my god can we do something about the shitty looking brick graphics? or is
   this the limitation of the browser?"*
2. *"i don't feel like the movement is quite at apex yet"*

## Is it a browser limitation?

No. Not close. The browser is running the same renderer features a 2015 console
game shipped with: PBR, shadow maps, HDR tone mapping, screen-space AO, bloom,
temporal-quality antialiasing. car-soccer.com does not look good because it has
more GPU budget than us. It looks good because it **commits to one coherent,
simple, saturated look** and lights it well.

What we have is a **greybox**. That is a precise term, not an insult: it is what
a level looks like after the layout is blocked out and before anyone art-directs
it. Photographic concrete on axis-aligned boxes under a neutral outdoor HDRI
always looks like this, no matter how many boxes you add.

Four specific faults, measured off `shots/firing-line.png`:

| Fault | Why it reads as cheap |
|---|---|
| Every pixel sits in a narrow value band around 50-65% grey | No darks, no brights. Nothing has weight. |
| One hue for the whole scene, desaturated blue | No warm/cool separation, so no depth cue |
| Sun almost overhead, shadows near-invisible | Nothing is grounded, objects float on the floor |
| Hard 90 degree box edges everywhere | An edge with no chamfer catches no highlight, so it has no material |

None of those is a polygon-count problem. All four are free to fix.

## Part A: the look

**A1. Colour grade pass.** A `ShaderPass` after tone mapping doing split-toning
(cool shadows, warm highlights), an S-curve, saturation, vignette and film
grain. The single cheapest change that reads as "a game" rather than "a WebGL
demo". Verify: screenshot diff.

**A2. Re-light.** Drop the sun from near-overhead to about 24 degrees elevation
and make it warm and strong; cut `scene.environmentIntensity` so shadows go deep
instead of being filled flat by the HDRI. Long raking shadows across the lanes.
Verify: shadows visible in every screenshot pose.

**A3. Gradient sky, not a photo.** The blurred HDRI has a hard horizon line
where the ground plane ends. Replace the *background* with an authored gradient
dome plus a sun disk and horizon haze, and keep the HDRI only for reflections at
reduced intensity. Match the fog colour to the horizon so ground and sky join.

**A4. Bevel the structures.** `RoundedBoxGeometry` with a 2-4 cm radius on every
structural box. Bevels are how a surface tells you what it is made of.

**A5. Commit the palette.** Warm sand floor, dark blue-grey steel, saturated
orange trim, cyan emissive. Drop the photographic tiling off most structures:
flat colour plus bevel plus AO beats tiled photo concrete at this scale.

**A6. Paint the floor.** Lane markings, hazard chevrons on the firing line,
distance numerals. Cheap, and it is most of what makes a range read as a range.

## Part B: the movement

Already in: run, sprint bands, crouch, slide, slide-jump gate, air strafe,
mantle, step-up, jump fatigue, bunny-hop penalty, wall jump.

Missing, in order of how much each one is *the* Apex feel:

**B1. Sprint FOV kick.** Apex widens the FOV when you sprint. This is the
largest single cue that sprint is a different state, and we have it only on
slide. Cheap.

**B2. Wall climb.** The signature Apex traversal. Hold jump into a wall and you
climb it. Currently absent entirely.

**B3. Tap-strafe lurch.** The constants are already sitting in
`movement.json` (`lurchGraceMin/Max`, `lurchStrength`, `lurchMaxFraction`) and
nothing reads them. A new keyboard direction inside the grace window should
*redirect* velocity, not merely accelerate it.

**B4. Slope acceleration on slides.** Sliding down a ramp must gain speed.
Right now a slide only ever decays, so the ramp is pointless.

**B5. Camera feel.** Landing dip, strafe roll, sprint bob. These are the
difference between "the camera moved" and "I moved".

**B6. Sprint viewmodel pose.** The gun should drop and swing across the screen
when sprinting, and come up when you stop.

## Verification

- `npm run verify` assertions extended for every new constant and gate
- `npm run check` and `npm run build` clean
- `npm run rules` clean
- before/after screenshots in `shots/`

## Not in this batch

Superglide, wall bounce, fallstun, bullet-hole decals, sound. Named range areas
(Duel Pit, Agility Course, Tech Tunnel, Wolf's Peak) are a layout job, separate
from this one.
