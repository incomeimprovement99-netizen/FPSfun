# Results: snappy, Apex HUD, the course

Follows `PLAN_SNAPPY_HUD_COURSE.md`.

## Performance

Measured on the owner's machine with `npm run bench` (headless Chrome on
D3D11, v-sync and the frame cap off, 1920x1080, AMD Radeon RX 9070 XT):

| Preset | Median | Frame | p95 |
|---|---|---|---|
| Competitive (default) | 833 fps | 1.20 ms | 1.70 ms |
| Balanced | 769 fps | 1.30 ms | 1.70 ms |
| High | 357 fps | 2.80 ms | 3.40 ms |

**The GPU was never the bottleneck.** Even High produces 357 fps. A game that
feels like 60 fps on this machine is being capped: the browser draws only when
the display can show a frame, so the display's refresh rate is the ceiling. The
settings screen now measures it and says so. Past it needs Chrome launched with
`--disable-frame-rate-limit --disable-gpu-vsync`. Chrome's Energy Saver mode
can also cap the frame rate.

What the presets change: Competitive draws straight to the screen with MSAA
(no post chain, no offscreen copy), drops every point light, draws the shadow
map once, and uses a low-latency (desynchronized) canvas. High keeps ambient
occlusion, bloom, SMAA, the grade, live shadows and the point lights.

Gunshots: the muzzle flash's point light is gone (it strobed the floor on
automatic fire and cost every lit pixel) and the flash is half as bright, so
it barely blooms.

## Feel

| Change | Before | After |
|---|---|---|
| Speed bands | slowest band (450) at the START of every move | lowAcceleration (2500) below lowSpeed, as the engine names pair them |
| Reversing direction | braking only, then accelerating | brake and drive at once (Source-family) |
| Full right to moving left | about 0.14 s | 0.05 s |
| Full right to 120 hu/s left | about 0.43 s to full | 0.10 s (full speed 0.22 s) |
| Standstill to 120 hu/s | 0.27 s | 0.05 s |
| Gun look lag | the gun trailed fast mouse turns | none: the gun is locked to the view |
| Slide friction | 100 + 0.7 x speed, matched neither wiki timing | fitted to both: 0.210 s (wiki 0.21) and 0.116 s (wiki 0.11-0.12) |
| Slide above sprint speed | about 0.4 s | about 1 s; slides now coast on 100 hu/s2 below 350 |

## Found along the way

1. **The acceleration band was chosen once per frame.** A frame starting just
   under 120 hu/s ran the fast band well past it: up to 42 hu/s of overshoot
   at 60 fps, so movement was quicker at low framerates. Now integrated
   through the band edges; the reversal takes the same time at 30, 60 and
   144 fps (tested).
2. **Left and right were mirrored in every course tip.** Facing +z, +x is on
   your left. The simulation caught it when a "left" lurch went right.
3. **A test passed by accident.** The slide-on-landing drop test walked off
   the ledge before crouch was ever held.
4. **Bullets went through walls.** Harmless on an open range; in a pop-up
   course it let you pre-shoot the next room. Bullets now stop at any
   collision box.
5. **A pure sideways lurch cannot make the gap**, because it trades 70% of
   your forward speed. The tip now says W held plus D, a forward-right
   lurch, which the simulation shows landing.

## HUD

Minimap (top-left, rotating, drawn from the collision boxes, course included),
compass (top-centre), FPS in the largest type on screen with frame time
(top-right), speed and stance plus shield and health (bottom-left), weapon
slots and ammo (bottom-right), damage numbers at the hit point, knock notice,
course timer and results.

## The course ("THE RUN")

Behind the firing line through a gate in the back wall. References: MW2's
"The Pit" and MW4's 2026 Mobility Course.

| Room | Technique | Enemies |
|---|---|---|
| Start | rules sign, green start line | |
| 1 Breach | jump the low wall | 3 |
| 2 Vent | slide under a 1.25 m crawl space | 2 |
| 3 Climb | climb a 4.2 m wall (a jump plus mantle only reaches 3.45 m), slide down a 30 degree ramp | 3 |
| 4 Superglide | mantle a 1.4 m ledge, superglide off it | 3 |
| 5 Gap | slide jump and lurch forward-right over a hazard floor | 2 |
| 6 Final | holster sprint, finish line | 4 |

17 armed pop-ups that turn to keep their guns on you, 6 of them swaying.
One hit drops one. +3 s per enemy left standing, +2 s for falling in the gap.
Ranks S 30 / A 35 / B 45 (A and B are The Pit's star times; S is a guess
until someone sets times). Best time saved; P copies a result line to share.
Starting a run equips the P2020 and the Glock 17 and gives your guns back at
the end. Each room's fastest route is on its entry wall, facing into the
room, so it only shows when you turn round.

Every room is proven possible in `tools/movesim.ts`: slide under the vent but
not walk under it, stay crouched under it, the jump head-bump, climb plus
mantle onto 4.2 m, mantle 1.4 m, and the gap by diagonal jump or lurch, while a
straight jump falls in.

## Pistols

- **P2020**: our design, with slide windows showing the barrel, a three-slot
  rail, extended beavertail, orange flared magwell.
- **Glock 17**: new weapon id `g17` with P2020 handling and a 17-round magazine
  (19/21/24 extended). Flat-sided slide, 22 degree grip, finger grooves,
  squared guard, white-dot sights. All black.
- Both are self-contained groups with the grip origin at the hand, which is
  what a WebXR controller grip needs later.

## Verification

`npm run verify` 382 checks pass (movesim included); `check`, `build`,
`rules` clean; screenshots in `shots/`; `npm run bench` for the numbers above.

## Open

- Rank thresholds are provisional until real runs exist.
- Wallbounce proper and mantle boost are not in.
- VR port: models are ready to parent to a controller; the WebXR session,
  hands and locomotion are a separate job.
