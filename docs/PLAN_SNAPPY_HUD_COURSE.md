# Plan: snappy, Apex HUD, and the movement course

Every ask from the owner's message, in the order they asked to settle them.

## Performance and feel (settle first)

| ID | Ask | Plan | Verify |
|---|---|---|---|
| P1 | "frames seem low, is that the lighting?" | Measure where the frame goes. Suspects: 12 point lights (every lit pixel pays for each one), full-resolution ambient occlusion, a 4096 shadow map redrawn every frame, bloom, SMAA and the grade pass | frame time before and after, per preset |
| P2 | snappy over pretty | Quality presets chosen at the start: **Competitive** (direct render, MSAA, no post, no point lights, static low shadows, low-latency canvas), **Balanced**, **High** (current look) | presets switch cleanly; Competitive is the default |
| P3 | "what is the bottleneck from 60 to 240?" | Explain: the browser paces frames to the monitor's refresh; above that needs Chrome flags. Show refresh rate, frame time and the cap reason in settings | text in settings |
| P4 | less bloom and lighting on gunshots | Remove the muzzle flash's point light; halve the flash's brightness so it barely blooms | screenshot |
| P5 | aiming feels laggy | Remove the gun's look lag and trim idle sway; low-latency canvas option; nothing between mouse and camera | code review |
| M1 | strafing right then left must be instant | Fix the speed bands (lowAcceleration belongs BELOW lowSpeed, the name says so), and brake plus drive together when reversing | movesim: counter-strafe time |
| M2 | slide a bit faster | Refit slide friction to the two wiki timings: gentle below 350 hu/s, fast shed above | movesim: both wiki timings |

## HUD

| ID | Ask | Plan |
|---|---|---|
| H1 | exactly where Apex puts things | minimap top-left, compass top-centre, health and shield bottom-left, weapons and ammo bottom-right, damage numbers at the hit |
| H2 | FPS bigger than everything else | large FPS number top-right, frame time under it |
| H3 | minimap | rotating, drawn from the range's own collision boxes, with the course and its start line |
| H4 | more Apex-like range things | damage numbers coloured by shield tier, knock notifications, a range-mode banner |

## The course

References: MW2's "The Pit" (24 armed pop-up cutouts and 5 civilians in 7
areas, stars at 45 s and 35 s, IW best 22.6 s) and MW4's 2026 "Mobility
Course" (a timed route through every movement mechanic, 40 targets, S under
56 s).

| ID | Ask | Plan |
|---|---|---|
| C1 | timed course near the start | a compound behind the firing-line back wall, through a gate; cross the start line to start, the finish line to stop |
| C2 | rooms where dummies pop up with guns pointed at you | room triggers raise armed robots that face and track you; one hit drops them |
| C3 | some move slightly | a few sway side to side |
| C4 | race while eliminating everyone | +3 s per enemy left standing at the finish, like The Pit's penalties; best times saved |
| C5 | each room needs specific tech | rooms built around: holster sprint, slide under, mantle, climb, superglide, slide down a slope, tap-strafe round a corner, climb jump |
| C6 | optimal path text on the wall, visible only going backwards | a panel on each room's ENTRY wall facing into the room |
| C7 | detailed P2020 | its own detailed builder |
| C8 | Glock 17 in hand, VR-portable later | a new weapon id with P2020 handling and a 17-round mag; models stay self-contained groups with a grip origin, which is what a WebXR controller grip needs |
| C9 | shareable with buddies | results panel with time, rank and a copyable result line |
