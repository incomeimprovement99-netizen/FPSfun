# Phase 20 plan: the owner's playtest fixes, then what comes next

Written 2026-09-26 at the close of Phase 19 (`docs/PHASE_19_PLAN_DOWNTOWN.md`, Milestones 209 to 220).

- **Part A** is the owner's feedback from playing the live build. All of it is done before the game is shared
  with the owner's friends, in the order below.
- **Part B** is the ranked next steps. They follow Part A.

"The game" in this plan is SpeedKills. Nothing here changes the legacy game (B00G FPS, the BOOG range) unless
an item says so.

## Where Phase 20 stands (paused 2026-09-27 for the Unity soldiers)

The owner moved the work to the soldiers from the Unity store (Phase 21), so Phase 20 stops here with A17 and A18
part done and A19 not started. Everything below is live.

- **Live at 292bf1c** (game server and Pages, both checked live on 2026-09-27):
  - A1 to A16 (A13 is the memory rule).
  - A15 (Milestone 235): the sprint twice as fast (14 m/s), auto sprint, a slide just above it.
  - A16 (Milestone 234): quicker gun swaps, quicker again with each level.
  - A17's roof-run check; A18's first fixes: a friend's swing at the new speeds (Milestone 236) and the bots' aim
    against runners (Milestone 237); the frame-phase timer and the repeating bench.
- **The last full run before that release** (at the same code, 540e676 before the rebase):
  - verify and rules passed, `npm run fit` passed (0.014% to 0.038% against 0.060%), and the mixed batch passed;
  - batch 1 failed two: the legacy range's spray wall (passed alone) and the SpeedKills bot pad ride (see the table
    below; not rerun alone, the owner called time);
  - batch 2 failed one: the host migration in a battle royale, the old flake in Part B.
- **What is left of Phase 20, for when it comes back:**
  1. A17: the footage measurements (a research agent was measuring when the work moved; its numbers go to
     `phase20-specs/A17-movement.json` beside the repo), then movement.speedkills.json from them, and the
     A15 recheck list against the new numbers. The roof-run check moves with them.
  2. A18: the frame pacing measured on a quiet machine (the instrument is in); a friend's figure at the new speeds
     measured again on a quiet machine; checks for input to screen and hit feel; Hyper Scape's gunfight facts.
  3. A19: the PANDA as an animation showcase.
  4. Part B, from its second step.

## Part A: the owner's playtest fixes (before sharing)

**How each item is proven:**
- Each fix gets a check that fails with the bug put back.
- Each fix gets a snapshot where it shows on screen.
- Each fix gets a roadmap Milestone and a diary line.
- Part A ends with the full release run: the three e2e batches, `npm run fit`, and both deploys.

**Numbers:** where an item needs a number about Hyper Scape, the number comes from a source or a measurement
and says which. Where there is neither, the owner is asked rather than a value invented.

### Decisions taken for the owner (reversible)

The diagnoses (2026-09-26) raised questions. Each was decided with the recommended option so the work does not
stop; any of them can be reversed. Legacy stays untouched throughout, by the owner's rule.

- **A1:**
  - In a loadout start the bots still land armed.
  - SpeedKills care packages hold SpeedKills loot, not legacy guns, batteries or a phoenix.
  - Loadout crates are off in SpeedKills: they handed level-0 copies, against fusion.
- **A2:**
  - Damage is rounded for display only.
  - SpeedKills stops rounding each hit down before it lands (dummy.ts). The rounding cut USSO 10% and made some
    guns' fusion add nothing.
- **A3:**
  - Real arms that nothing posed are hidden; they showed in the 3x scope on HELIX and PULSAR.
  - A reload while aiming keeps the sight steady (reloadAds 0.85), instead of leaving the sights.
- **A4:**
  - 38 m of grace, not 40, because the range's back wall stands 39 m north of the city.
  - An out-of-bounds death goes to the Gulag like a ring death.
  - The skyline moves out past the fence.
- **A5:**
  - SpeedKills draws the city from the ship's first frame.
  - The stray range props join the range side.
  - The ship flies above the skyline's tallest towers.
  - The mannequins' frustum culling being off (about 324 draw calls and 980k triangles for 27 bots) becomes the
    first lead of Part B step 1.
- **A6:**
  - The health bar is twice as thick and a little longer.
  - Only the bottom HUD moves.
  - The range's stats panel is hidden in a match.
  - The ping and emote wheels and the captions are drawn again in SpeedKills.
  - Gun levels show as pips and "LV n".
  - The speed readout stays, smaller.
- **A7:**
  - The kinds: PANDA Heavy Rifle, ZEPHYR Fast Rifle, ANAKIN Steady SMG, USSO Fast SMG, BIGANTLER Heavy
    Shotgun, RIPTIDE Auto Shotgun, HELIX Heavy Marksman, PULSAR Fast Marksman, BOOG Sniper, NOVA Energy LMG.
    The Run's pistols are Pistol.
  - The kill feed names no gun, as today.
  - The bot called NOVA is renamed in SpeedKills.
  - SpeedKills' default loadouts get names that fit their guns.
  - The FUSED notice is no longer overwritten.
- **A8:**
  - Full (the default) and Compact, no Off.
  - The card shows for the item you look at or cycle to, and steps aside while aiming.
  - The per-family lines are as proposed.
  - The hack-core swap flip-flop is fixed.
- **A9:**
  - Slam's height is measured from footage. If that is impossible, the one sourced number (30 m, a player's
    claim) is used and flagged.
  - Every other hack takes the final published values, and their missing behaviours are built: the Mine seeks,
    the Wall has 250 HP and at most 2, Reveal is a 50 degree cone, and Invisibility breaks on aiming and on a
    hack.
  - The owner's earlier choice for Armor stays: it takes 60% of damage off and you can still shoot. Its
    duration and cooldowns follow Hyper Scape.
  - Unpublished numbers (Teleport's distance) are measured from footage or left and flagged.
- **A10:**
  - SpeedKills bots lose every legacy kit (hacks only).
  - The grenade kit leaves SpeedKills.
  - The Frag spray stays; it is a spray.
- **A11:**
  - The menu grows with the screen: 1120, 1200, 1280 and 1400 px.
  - Scrollbars have a cyan thumb that turns magenta under the mouse.
  - The settings' control column is wider.
- **A12:**
  - The barrier stands 24 m down range.
  - The TV hangs in it at three-quarter size.
  - Signs point to The Run (Basic and Advanced) and a sign to the movement lab.
  - The courses keep their old look for now.
  - The hacks reset at a match's end.

### A1. Loot does not work after "land with your loadout"

- **The owner:** "i can't loot anything so i can't fusion anything together, can't change my guns ... i did do
  the 'land with your loadout'".
- **Found:** `brmatch.ts:756`, `this.startLoot = opts.start !== "loadout"`. With a loadout start the floor gets
  no loot at all, so nothing can be picked up, fused or swapped.
- **Fix:** in SpeedKills the floor always has its loot. The loadout start changes only what you land holding.
- **Also check** everything else that reads `startLoot`: the bots' arming (`botArmed`), their gun visibility,
  the supply bins. Legacy keeps its behaviour.
- **Done when:** an e2e check in both start modes finds loot on the floor, picks up a copy of the held gun (its
  level goes up), and picks up a different gun (it swaps in).

*Done (Milestone 221).*

### A2. Damage numbers show long decimals

- **The owner:** each shot shows "33.66666666666666".
- **Found:** `hud.ts:387` writes `String(amount)`. SpeedKills' tuned damage is fractional, and a spray's summed
  number is too.
- **Fix:** whole numbers wherever damage is shown: the damage numbers, their spray totals, the range's stats,
  the recap, the death recap and the kill feed.
- **Done when:** an e2e check lands several hits of a fractional-damage gun and finds only whole numbers on
  screen.
- **On a closer look:** the fraction did not come from the guns, because every hit was rounded down as it landed
  (`dummy.ts`). It came from SpeedKills bots' shield and health, which come back a sliver a frame: a hit that
  finishes a part-healed bot reports what it had left. The stats panel's DAMAGE line was a second raw site. So
  the "Done when" above could not fail as written (a fractional gun on a dummy read whole). The checks became a
  drawn HUD frame with real fractions in every field, a finishing hit on a healed bot in a match, and, once
  SpeedKills' hits stopped being rounded down (the decision above), USSO's rounds on a range dummy and a board.

*Done (Milestone 222).*

### A3. The left arm covers the red dot when aiming

- **The owner:** "the left arm is in the red dot and sight area".
- **Where:** the first-person arms and the aim pose (`viewmodel.ts`, `fparms.ts`, `arms.ts`, `viewmodel.json`),
  per gun and per optic.
- **Fix:** measure it first. A snapshot aiming down the sights with every SpeedKills gun and every optic finds
  which pairs show the arm inside the sight picture. Then fix the pose or the hand's grip for those.
- **Done when:** a picture test, like `npm run fit`, counts the arm's pixels inside each optic's window while
  aiming, and every one is 0.

*Done (Milestone 223).*

### A4. The map's edge: visible, a 40 m grace with a countdown, then a red laser

- **The owner:** the edge is vague in the game (clear only on the minimap). Allow about 40 m out with a timer
  saying you will be terminated in 5 s if you do not come back. If you test it, a big red laser zaps you: it
  lights up your view so all you see is the red laser, and it tells you that you died out of bounds.
- **Where:** today the battle royale's bounds are a hard wall (`main.ts` `player.setBounds(BR_BOUNDS)`).
- **Fix:**
  - The bounds become the map plus 40 m.
  - The edge gets a boundary you can see in the world (a lit holographic fence on all four sides).
  - Past the edge, the HUD says RETURN TO THE CITY and counts down from 5. Coming back cancels it.
  - At 0, a red laser comes down on you, the screen floods red, and you die with the cause OUT OF BOUNDS (in the
    kill feed and the death recap).
  - Every screen in the match sees the laser.
  - All of it is set in config with a note (the grace distance, the seconds, the laser's look).
- **Done when:** an e2e check walks out and sees the countdown, walks back and sees it cancelled, walks out and
  stays, and sees the death by OUT OF BOUNDS. Snapshots show the fence and the laser.

*Done (Milestone 224).*

### A5. The dropship shows other maps: is everything rendered at once?

- **The owner:** from the dropship at the start they could see "the old BR map". Are both maps rendered, and
  does that hurt performance?
- **To find out first:** a snapshot from the ship at the start of a match, to see exactly what shows. The
  legacy battle royale map itself is not built in SpeedKills (`main.ts`: the city OR the old map). The range,
  the arenas and the tri arena are all in the scene, a few hundred metres away.
- **Fix:** during a match only the city and its skyline are drawn. The range and the arenas are hidden in the
  battle royale's region and shown again after it.
- **Done when:** measured from the ship, the draw calls and frame rate before and after are written down (the
  median of several bench runs, since single runs swing about 25%), and a snapshot from the ship shows only the
  city.

*Done (Milestone 225).*

### A6. The HUD, compact at the bottom of the screen

- **The owner:**
  - Make it all compact on the lowest part of the monitor.
  - Gun names and levels to the left of the current ammo count.
  - The two abilities to the right of the health, moved slightly down and right.
  - The Slam and Heal boxes (the hack boxes) bigger.
  - The health bar about twice as big, the ammo at least 1.5 times as big.
  - Slight black outlines on all UI so it is never hard to read.
- **Where:** `hud.ts` (the canvas HUD) and `hud.json`.
- **Fix:**
  - The bottom band re-laid out as asked, with the sizes as config numbers.
  - Every piece of HUD text and every bar gets a thin dark outline.
  - Checked at the smallest and the largest HUD scale.
- **Done when:** a HUD layout check reads each element's box and finds:
  - the health bar at least 2x and the ammo at least 1.5x their old sizes;
  - the gun names left of the ammo;
  - the hacks right of the health;
  - everything in the bottom band.

  Snapshots at 1080p and 1440p show it.

*Done (Milestone 226).*

### A7. Every gun named with its class

- **The owner:** "USSO (Fast SMG)" and so on, so a beginner can see what each gun is.
- **Fix:**
  - Each gun gets a short class in speedkills.json, with a note (Fast SMG, Steady SMG, Sniper, and so on).
  - One helper names a gun everywhere a gun is named: the HUD slots, loot labels and prompts, the loadout and
    setup menus, pickup notices, the kill feed, the recap and the tour.
- **Done when:** an e2e check reads the menus and the HUD and finds no gun named without its class.

*Done (Milestone 227).*

### A8. The loot card: this gun against yours

- **The owner:** looking at a gun on the floor shows what it is and compares it with your current gun: level,
  stats, ammo count, "all that". There are two versions:
  - the default, verbose, which helps a player learn;
  - a compact one for experienced players, with just what a quick call needs.
- **Fix:**
  - A card when aiming at floor loot within reach: its name and class, its level, and its stats set beside the
    gun it would replace, with better or worse marked. The stats are damage, fire rate, magazine, and time to
    kill against a full 150.
  - For a copy of your own gun, the card says FUSES TO LEVEL N.
  - Hack cores get the same card.
  - A setting, Loot card: Full (the default) or Compact.
- **Done when:** an e2e check aims at a floor gun in both modes and reads the card, and snapshots show both
  modes.

*Done (Milestone 228).*

### A9. The hacks as Hyper Scape's were, from sources, Slam first

- **The owner:** "the slam barely goes up, it went like 10x higher in hyperscape, make sure you look into that
  exactly and the other abilities so you know how they are supposed to work exactly instead of assuming or
  filling in holes".
- **Found:** Slam launches at 9 m/s (`hacks.json` slam.up). At SpeedKills' gravity of 17.5 m/s² that is a peak
  of about 2.3 m.
- **Fix:**
  - First, research each hack: what it did, and every number the sources give. That means height, distance,
    duration, radius, damage and the cooldown at each fusion level, from wikis, patch notes, guides and footage.
  - Where there is no number, measure the footage where possible, for example a Slam's height against a
    building of known storeys, and label it measured.
  - Then tune each hack to the result, Slam first. Then Heal, Dash (Hyper Scape's Teleport), Invisibility,
    Armor, Wall, Reveal and Mine. LEAP and GRAPPLE are ours, with their numbers kept.
  - A table in the plan lists every hack number with its source, measurement or owner decision.
- **Done when:** a hack check measures each hack in the movement simulator (Slam's peak, a dash's distance, a
  heal's rate) and holds it to the table.

*Done (Milestone 229).*

### A10. No smoke grenade in SpeedKills

- **The owner:** "remove the smoke grenade, i don't like it for this type of gameplay, keep it in boog fps,
  legacy one".
- **Found:** it is the legacy SMOKE kit (kits.json `smoke`, `main.ts` stepSmokeKit), still offered in
  SpeedKills.
- **Fix:** gone from SpeedKills' pickers, loot, keys, HUD and tour. Unchanged in legacy.
- **Done when:** an e2e check finds no smoke anywhere in a SpeedKills page, and still finds it in a legacy one.

*Done (Milestone 230).*

### A14. Two friends could not both join one battle royale (added 2026-09-26, done first)

- **The owner:** two friends could not join a battle royale; once one friend joined, the other was sent to the
  lobby.
- **Found:** a battle royale's host took as many players as the players dropdown said. That dropdown belongs to
  the 1v1 and defaults to 2, so the host and one friend filled the match. The second friend was turned away with
  "the match is full", back to the lobby. A test with a trio battle royale and the dropdown left alone reproduced
  it: the host's match had 2 players and the second friend read "The host turned the connection away".
- **Fix:** a battle royale's room comes from its squads. Friends as one squad get the squad's size, so a trio is
  3. Squads against each other, or solo, get up to 8. Start now still starts with fewer. The dropdown is hidden
  for a battle royale.
- **Checked:** the new e2e section `skfriends`, which failed before the fix and passes after: all three are in,
  3 players, 2 friends connected.

*Done (Milestone 231).*

### A15. Movement: sprint about twice as fast, always sprinting if Hyper Scape had no walk, a slide just above it (added 2026-09-26)

- **The owner:** sprint should be about twice as fast. Check whether Hyper Scape even had a walk mode; if not,
  always sprint. Adjust the slide to match: only slightly faster than sprinting, using Hyper Scape's values if
  they are known.
- **Now:** SpeedKills sprints at 275 hu/s (7.0 m/s). A slide boosts to at most 400 hu/s (10.2 m/s).
- **Plan:**
  - Research Hyper Scape's walk, sprint and slide from sources (started 2026-09-26).
  - Set sprint to about twice today's, with the source or the owner's number beside it.
  - Make movement always sprint if Hyper Scape had no walk.
  - Retune the slide to sit slightly above the new sprint.
  - Recheck the movement checks (tools/checks), the movement lab's gaps and climbs, the city's canyons, the jump
    pads' landings (their throws are solved from gravity, not run speed) and the bots' walk.
- **Done:**
  - **Hyper Scape had a walk.** It had walk and sprint, and from its patch 2.1 Auto-Sprint was on by default. So
    SpeedKills now sprints whenever you move forward: a new sprint mode, auto, is SpeedKills' default. Toggle
    and hold stay in the menu, and each game remembers its own choice.
  - **No Hyper Scape speed was ever published** (searched twice on 2026-09-26). So the numbers are the owner's:
    - the run (sideways or back) 347 hu/s (8.8 m/s);
    - the sprint 550 hu/s (14.0 m/s);
    - the slide capped at 630 hu/s (16.0 m/s), 1.15 times the sprint, where it was 400 over a 275 sprint.
    A17 replaces them with footage measurements.
  - **The ground curve doubled with them.** movement.json's bands would have taken 5 s to reach 550, so every
    band edge and every rate is doubled too: the full sprint in 1.4 s from standing with a gun out, as the first
    pass reached its 275, and a stop in 0.22 s.
  - **Bots** move at twice their tier's speed (speedkills.json `botSpeedScale`), so they can still chase a player
    and get away.
  - **Speed streaks** now start at 1.05 of the new sprint and are full at 1.6.
  - **Checked:** `tools/sk-movesim.ts` holds the sprint, the time to reach it and the stop. Its roof tests now
    record standing on the roof at any point, since a 4 s run at 14 m/s crosses a roof and drops off its far
    side.
  - **What it changes:** running, a jump and a double jump now clear a 24 m gap roof to roof, where the first
    pass cleared 12. Every street in the city is 14 m, so every street can now be crossed by the roofs. That
    suits a game of roofs, but it is A17's to confirm against footage, since a gap that no longer needs a pad
    changes the city's flow.

### A16. Switching guns quicker, and quicker again with each level (added 2026-09-26)

- **The owner:** switching between guns should be quicker as a base, 1.5 or 2 times, and level up along with
  damage and magazine, so a level 5 SMG swaps quicker than a level 1.
- **Done:** a gun's draw and put-away times are 1.5 times as quick as found and twice as quick at level 5,
  falling each level (speedkills.json `fusion.gun[].swap`). ZEPHYR draws in 0.40 s as found and 0.30 s at level
  5, where it was 0.60. `tools/checks/ttk.ts` holds it.

### Why A17 to A19: the draw and the hook (the owner, 2026-09-26)

In the owner's words: the movement is the thing that draws people back; the smooth gameplay and the gunfights are
why they are hooked. A17 to A19 are that aim.

**One rule for all three.** Hyper Scape's code, models and animations are Ubisoft's creative work. We take:
- facts: durations, speeds, heights, cooldowns;
- rhythm: which beat happens when;
- style: the kind of thing that happens, such as parts that move by themselves, and light and energy cues.

We author the motion and the models ourselves. We never trace their animation pose by pose off frames, and never
copy a gun's design. Numbers go in src/config with the source or the measurement beside them. Hyper Scape's names
stay out of the public build (`npm run rules`).

**Where the numbers come from.** No movement number (sprint speed, jump height, gravity) was ever published;
this was searched twice on 2026-09-26. So they come from footage, by the Phase 20 A9 method:
- download with yt-dlp and step the frames;
- measure against something of known size (a training dummy, the floor's tiles, a storey), credible to about
  15%;
- use several clips per number, and write down the range.

The written sources are:
- the Fandom wiki through its MediaWiki API;
- Ubisoft's patch notes via the Wayback Machine;
- devtrackers.gg;
- the PCGamesN interview with producer Graeme Jennings, on making it "faster than anything on the market";
- the PowerUp! interview with creative director Jean-Christophe Guyot, on rooftops and high jumps from the
  first prototypes.

### A17. Movement measured off Hyper Scape's footage (the draw)

This builds on A15, which keeps sprint, walk and slide.

- **Measure:**
  - Jump height and time in the air on flat ground, which together give gravity.
  - The double jump: its extra height, and how late in a jump it can still be used.
  - Air control: how far a player can steer or reverse between leaving the ground and landing.
  - Jump pads: each pad's height and horizontal carry, and how many there are per block.
  - Ledge climbing: the highest ledge a player catches, how fast they go up it, and mantle speed.
  - Landing: confirm there is no fall damage, and look for any slowdown on landing.
  - Camera: FOV, any FOV kick at speed, head bob, and the dip on landing.
  - Which of our moves Hyper Scape did not have (wall run, wall kick, superglide, tap-strafe). We keep them,
    marked "ours" in the _note.
- **Implement:**
  - movement.speedkills.json takes the measured values, each with its source or range, and "Ours, a first
    pass" goes.
  - Recheck everything A15 lists: tools/checks, the movement lab, the city's canyons and climbs, the jump pads'
    throws and the bots' traversal. A gravity change moves every gap and every pad.
  - Add a check that a set route across the city's roofs can be run without touching the street, so a change
    that breaks the flow fails. **Done** (`tools/checks/sk-roofrun.ts`): no one straight route runs the city's
    roofs (along a row they stand apart, with plazas between), so it runs every facing gap between the 186 roofs.
    At A15's movement 147 of 958 are crossed and the best roof reaches 9 others; the first pass's sprint gave 99
    and 7, and fails it. Held a tenth under today's numbers.
- **Done:** the owner runs the movement lab and a city route side by side with a Hyper Scape clip, and says it
  feels right.

### A18. Smooth play and gunfights (the hook)

- **Measure:**
  - **Frame pacing** in a full SpeedKills battle royale: the median and 1% low frame times, and every hitch
    over 50 ms with its cause from a CPU profile. Bench as the memory note says: medians, and interleaved A/B
    runs, since the owner uses the PC during runs.
  - **Input to screen,** in frames: mouse move to camera move, and trigger to muzzle flash.
  - **Hit feel:** the hit marker, hit sound, headshot sound, shield break and kill confirmation, each on the
    frame of the hit.
  - **TTK against a moving target.** Players move faster after A15 and A17, so rerun tools/checks/ttk.ts against
    a strafing target at the new speeds. Keep the 1.3 to 1.8 s close-range band
    (docs/PHASE_18_PLAN_SPEEDKILLS.md 4.2). If fights feel spongy at the new speeds, raise damage.
  - **With friends:** remote players move smoothly at the new speeds (interpolation, no rubber-banding), and hits
    land on what the shooter saw. Run the p2p section over the real network.
  - **Hyper Scape facts to collect:** its TTK, its hit feedback, and what reviews and players complained about in
    its gunfights (the 4.2 table already names the long TTK) and what they praised.
- **Done:** before and after numbers are written into the plan, and the owner plays a match with friends and
  says it is smooth.
- **Started 2026-09-27, the instrument** (built while A17 waits on its footage):
  - `src/game/framephase.ts`: the game loop marks seven phases (view, input, player, aim and shots, projectiles
    and figures, match, render, hud). With `?perf` on the address, or `__range.perf(true)`, every frame over 50
    ms keeps its breakdown. verify holds it, and fails with the switch ignored.
  - `tools/bench.ts`: `BENCH_RUNS=n` takes every preset in turn, round by round, and ends with each one's median
    and spread; every run counts its frames over 50 ms and its worst; `BENCH_PHASES=1` names each hitch's phase,
    or "outside the loop"; the spot `skrun` runs a street toward the Spire at 14 m/s in the match.
  - First reading, one run on a loaded machine and not to be trusted: Competitive on `skrun` at 128 fps median,
    p99 11.7 ms, no frame over 50 ms. Of a 7.8 ms frame, render took 5.5, the match 1.1, the figures and the
    HUD about 0.4 each. So the first lead stays Part B's: the draw calls (623 here), the skinned figures above all.
  - The real measurement waits for a quiet machine (the footage measuring for A17 runs beside it now).
- **With friends, done 2026-09-27 (Milestone 236):** the host refused a swing seen more than 5 m apart, and at A15's
  speeds a real one on a sliding target could be 9.4 m apart at the host. SpeedKills' limit is now worked out from
  its reach, its top speed and the jitter buffer's most (net.json `_hitCheckSk`); a gun's claim was already wide
  enough.
- **A friend's figure at the new speeds, measured 2026-09-27:** the jitter test run in SpeedKills (a guest running
  a tight circle at about 9 m/s) moves as evenly as the legacy one for a typical frame (the median deviation
  2%), but its worst frames are rougher (the 95th percentile 0.57 to 0.61 of the median speed, where the legacy
  test's is 0.12 to 0.30). A glide back after a carry-on past the newest state was built and tried against it,
  four runs interleaved: it changed nothing, so the carry-on is not the cause, and it was taken back out. Two runs
  of the eight fell apart (the guest's own motion broke up, about thirty stalls), so this machine's load is in
  these numbers. To do on a quiet machine: the same measurement with the frame pacing, and the owner's own match
  with friends as the judge.
- **The bots' aim, done 2026-09-27 (Milestone 237):** a bot trails a runner by the runner's speed times its tier's
  aim lag, so A15 about halved every tier's hits on a running player. SpeedKills' bots aim with half the lag
  (`botAimLagScale`), which puts each tier back where it was tuned.

### A19. The PANDA as an animation showcase, then every gun

The owner wants one gun taken as far as it can go for animations and looks. Hyper Scape's gun animations were
short, snappy and full of futuristic detail.

The PANDA is the heavy rifle (the legacy vinson):
- its procedural model is in src/game/gunmodels.ts (about line 1636);
- its poses are code in src/game/viewmodel.ts: the reload poses near line 746, the action cycle near 974, and
  INSPECT_TIME = 3.2 near line 84.

- **Look for, in footage of Hyper Scape's rifles:**
  - Each action's length: draw, holster, reload with rounds left, reload from empty, and inspect. These are
    facts; write them down.
  - Each action's beats: when the magazine leaves, when the new one seats, when the gun is ready, and when the
    hands move.
  - The style, described in words and not copied as poses: what moves on its own, what lights up, what vents,
    and how the inspect shows the gun off.
- **Implement, all authored by us:**
  - A PANDA model with the parts the animations need: a magazine or energy cell that comes out, a moving bolt or
    charging part, lights, a small ammo readout on the gun, and vents or panels that open on a reload. Our own
    design, in SpeedKills' neon-night look.
  - Every animation:
    - the draw, with a flourish on the first draw and quick after that;
    - holster, tactical reload, empty reload and inspect;
    - firing: the action, the heat, the shell;
    - the last round;
    - sprint, slide, jump and land;
    - sights in and out, and idle;
    - a fusion level-up where the gun visibly upgrades.
  - Each animation's length comes from the gameplay number (the reload time, A16's swap times at every fusion
    level), never the other way round. INSPECT_TIME moves into config.
  - A sound on each beat (audio.json): magazine out, magazine in, servo, bolt, vent.
  - Decide, and write down why, whether the procedural poses can carry this or it moves to authored keyframe
    clips (a three.js AnimationClip, or a keyframe JSON per gun). Pick whichever will work for every gun
    afterwards.
  - A scrub view (a dev page, or the range TV) that steps each animation frame by frame and screenshots it.
  - Third person: other players see the reload and the swap.
- **Tests:**
  - A check that every PANDA animation's length matches its gameplay time at every fusion level.
  - Screenshots at key frames: the hand on the magazine, nothing passing through the camera, the red dot clear
    in the sights (the A3 lesson).
  - An e2e that plays each animation.
  - The owner reviews it against a Hyper Scape clip.
- **Done:** the owner watches the PANDA's inspect, reload and swap in the game and says they are at Hyper
  Scape's level. Only then does the system roll out to the other guns, in an order written into the plan then.

**Order:** A15 and A16, then A17, then A18, then A19. Each follows CLAUDE.md: build, test, document, commit,
ship.

### A11. The main menu too narrow, and scrollbars in our colours

- **The owner:** the main screen's menu is not wide enough and shows a horizontal scrollbar. All scrollbars
  should be our custom colours.
- **Found:** `index.html`, `.menu { width: 780px; ... overflow-y: auto }`. A row wider than that makes the
  horizontal bar. No scrollbar is styled anywhere.
- **Fix:**
  - A wider menu, with the wide row found and made to fit, so there is no horizontal scroll at any window size
    from 1280 wide up.
  - Every scrollbar in the page styled in SpeedKills' colours (`scrollbar-color` and `::-webkit-scrollbar`).
- **Done when:** an e2e check finds the menu's scroll width no wider than its box at 1280, 1920 and 2560, and
  every scrolling panel with the custom scrollbar. A snapshot shows it.

*Done (Milestone 232).*

### A12. After a match, a SpeedKills range

- **The owner:** after winning the battle royale it goes back to the BOOG range (the legacy one). Redress it in
  SpeedKills' style:
  - keep what it has, but block it off about 20 m in, so it is a sandbox;
  - guide the player to the two courses and to the TV that explains the README;
  - the new abilities work there.

  A quick reskin and a smaller area is fine for now.
- **Where:** the range (`range.ts`), the return after a match (`main.ts`, setRegion "range"), the courses
  (`course.ts`, `courses/`) and the TV (`readmetv.ts`).
- **Fix:**
  - In SpeedKills the range takes the city's night materials and neon.
  - A lit barrier about 20 m in (a config number).
  - Markers and signs to the two courses and to the TV.
  - Both hacks usable there.
- **Done when:** an e2e check after a match finds you in the SpeedKills range, can't go past the barrier, finds
  the markers, and uses a hack. Snapshots show the reskinned range.

*Done (Milestone 233).*

### A13. Memory: SpeedKills and legacy kept apart (done)

The owner's rule, saved in memory on 2026-09-26: everything is SpeedKills unless legacy is named.

### Every point of the feedback, and the item that covers it

| The owner said | Item |
|---|---|
| left arm in the red dot and sight area | A3 |
| main menu not wide enough, a scroll bar at the bottom | A11 |
| all scroll bars in our custom colours | A11 |
| gun names with a quick description, "USSO (Fast SMG)" | A7 |
| the slam barely goes up, 10x higher in Hyper Scape; look into the other abilities exactly, do not assume | A9 |
| the slam and heal boxes bigger | A6 |
| all compact at the bottom; gun names and levels left of the ammo; abilities right of the health, slightly down and right | A6 |
| health bar twice as big, ammo at least 1.5x | A6 |
| slight black outlines on all UI | A6 |
| can't loot, can't fuse, can't change guns (after "land with your loadout") | A1 |
| damage numbers with long decimals | A2 |
| remove the smoke grenade, keep it in legacy | A10 |
| memory distinguishes the two games; everything is the new one unless stated | A13 |
| a loot UI comparing the floor gun with ours (level, stats, ammo), default verbose and compact | A8 |
| after winning, back to the BOOG range: reskin, block it about 20 m in, guide to the two courses and the README TV | A12 |
| the old map visible from the dropship; are both rendered, does it hurt performance | A5 |
| the map's edge vague; 40 m out, a 5 s termination timer, a big red laser that fills your view, told you died out of bounds | A4 |

## Part B: after the playtest fixes

### Where Phase 19 ended

Live on fpsfun.duckdns.org and Pages at e4971df:

- **The downtown core:** podiums and towers split by canyons.
- **Jump pads** with gold beams and rings, their throws solved from the movement's gravity.
- **The mid-rise ring:** its buildings are entered from the street and climbed by their stairs, with loot on
  every floor.
- **A landmark in each of the eight districts.**
- **The centre as one raised district** after Red Tiger: nine podiums at one height, bridges over the streets,
  a public stair up each, and loot that comes back as it is taken.
- **The rooftop highway.**
- **The neon night,** with golden hour as a setting.
- **Street life:** parked cars, crossings and canopies.
- **The red outline** on the enemy under the crosshair, and **speed streaks** past a sprint.
- **Bots** that climb the concourse, ride the centre's pads and go for the capture zone.

Not done from Phase 19's list:

- **The rest of step 10:** the guns' snap to hand. It needs the owner's decision; see step 2 below.
- **Trees and planters** from the free Quaternius nature kit.

### If something breaks, where to look

| Symptom | Where it is made | What checks it |
|---|---|---|
| A jump pad throws you short, or into a wall | `city.ts` padOnto (the solver), city.json `padSolve`; `brplay.ts` padCarry (the push over the edge) | e2e pad rides (street, highway, terrace) in speedkillsBrTest |
| A bot stuck on a roof or against a wall | `city.ts` the graph (the concourse and pads block, `walkLink`), `navgraph.ts` (`padFrom`), `brmatch.ts` botTraversal (the pad ride) and the zone branch (`zoneTree`), `bots.ts` jumpPad | `tools/checks/sk-roofs.ts` (street links, stairs, bridges, pads, the way to the Spire), e2e bot pad ride and zone checks |
| A bot falls through the Spire | usually right: a decaying sector's solids are taken out (`city.ts` cityDecay) | the pad e2e runs early in the fight for this reason |
| A stair or a building cannot be climbed | `brpoi.ts` building (stairs; treads under 0.25 m are too shallow for the bots), `city.ts` perimeterBlock and tower(), city.json `perimeter.enter` | sk-roofs route walks |
| A concourse stair or bridge is blocked | `city.ts` downtownBlock (the public stair, `stairZones`), the concourse bridges (`underPad`) | sk-roofs stairs and bridges |
| The highway | `city.ts` the rooftop highway block, city.json `highway` | sk-roofs highway walk, e2e highway pad |
| A car in the way | `city.ts` street life (placed before the graph, kept clear of pads and doors) | sk-roofs street links |
| No loot up high, or the centre's loot not coming back | `loot.ts` generate (maxFloor, hotSpots, restockPlan), `brmatch.ts` tick (the restock), speedkills.json `loot` | e2e roof loot and restock checks |
| The outline missing, wrong, or showing through a wall | `outline.ts`, `dummy.ts` setOutline, `main.ts` (the outline ray), speedkills.json `feel` | e2e outline check, snapshot `sk-outline` |
| The streaks over the HUD | `main.ts` speedLines (inserted just before `#hud`) | e2e streaks check |
| The sky wrong in SpeedKills | sky.json `neonNight`, `sky.ts` loadSkHour and saveSkHour, `main.ts` gameHour | `tools/checks/sky-hours.ts`, e2e sky check |
| The city too heavy | city.json and `city.ts` | `tools/checks/city-budget.ts` (225k of 240k triangles, 354 merged meshes), `npm run bench` |

These e2e checks have failed under load and passed alone: the tour's double jump, one bot-squads sample and the
legacy supply bin. Three were made steadier in Phase 19:

- the lab climb presses jump in frames, not milliseconds;
- the ghost's walk turns until it has room;
- the restore's finish waits 15 s.

### If something breaks after 2026-09-27 (A15 to A18), where to look

| Symptom | Where it is made | What checks it |
|---|---|---|
| The sprint too slow or too quick, or slow to reach full speed | movement.speedkills.json `speed`, `sprintSpeed` and the ground bands (`lowSpeed`, `sprintBandStart`, the rates, `deceleration`: all doubled with the speeds) | `tools/sk-movesim.ts` (550 hu/s, reached in 1.4 s, a stop in 0.22 s) |
| No sprint when moving forward, or the legacy game sprinting by itself | `player.ts` updateSprint (the `auto` branch), `main.ts` the sprint mode at load (SpeedKills `auto`, its own key `range.sk.sprintMode`), index.html `#sprintMode` | sk-movesim; a real page sprints at 13.97 m/s holding forward |
| A slide too quick or too slow against the sprint | movement.speedkills.json `slideSpeedBoost`, `slideSpeedBoostCap` (630, 1.15 times the sprint) | sk-movesim |
| Swapping guns too slow or too quick | speedkills.json `fusion.gun[].swap`, `weapons.ts` speedkillsTuned (deployTime, holsterTime) | `tools/checks/ttk.ts` |
| Bots too slow to chase, or too quick | speedkills.json `botSpeedScale` (2), `bots.ts` speedNow | the SpeedKills e2e |
| Bots hitting a running player too much or too little | speedkills.json `botAimLagScale` (0.5), `bots.ts` aimLagOf | `tools/checks/bot-aim.ts` (each tier's trail behind a runner) |
| A friend's melee hit not counting | net.json `hitCheck` meleeReach and staleTrip (`_hitCheckSk`), `src/net/hitcheck.ts` MELEE_APART (9.4 m in SpeedKills, 5 m legacy) | `tools/checks/hitcheck.ts`, run in both games by verify |
| A second friend turned away from a battle royale | `main.ts` brPlayersDefault (runs on the mode, squad and sides changes, and once after the menu has put back the saved squad) | e2e `skfriends` (in batch 2) |
| The roofs no longer joining up (a movement or city change) | the movement numbers above, city.json | `tools/checks/sk-roofrun.ts` (147 of 958 gaps, the best roof reaching 9; the first pass's sprint gives 99 and 7) |
| Hitches, or a frame's time | `?perf` on the address, `__range.perf()`, `src/game/framephase.ts`; `npm run bench` with `BENCH_RUNS`, `BENCH_PHASES=1`, `BENCH_SPOT=skrun` | verify "Frame phases" |
| The outline check failing | it crouches the bot and aims at its torso, and casts a 1.2 m ray that must miss; `__range.outlinedNow()` | e2e speedkills |
| The tour's HIGH GROUND step failing | the trigger is pulled by frame count; `__range.triggerWhy()` says what holds a trigger | e2e sktour |
| The SpeedKills bot pad ride failing (the bot rises a little and falls) | seen once, in batch 1 at 540e676: `brmatch.ts` sense() can re-plan a bot's goal before botTraversal checks the pad, so the bot walks off instead. Rerun the `speedkills` section alone first | e2e speedkills |
| e2e checks failing in a batch and passing alone | the machine under load: a starved page's game time falls behind the wall's. Sample the CPU, rerun the section alone, reproduce with `E2E_THROTTLE=4`, and wait on game time with `gameSleep` | the door and vault checks use `gameSleep` |
| The e2e picking the wrong game | `open()` in tools/e2e.ts makes a page legacy unless its address names a game; pages share one browser, so localStorage (the saved squad, the sprint mode) carries between sections | set every choice with its change event, as `skfriends` does |

### A measurement not to trust yet

Frame rate in SpeedKills' street facing the Spire (`BENCH_SPOT=skmatch`, Competitive, one run each, 26
September):

| Build | fps (median) |
|---|---|
| 502e05b, before Phase 19 | 120 |
| 86accca, landmarks | 164 |
| ff22362, the concourse | 116 |
| e1ba530, the neon night | 159 |
| 774e548, street life | 132 |
| 65ede41, now | 169 |

Single runs swing by about 25%: the current code read 114 fps in one run and 169 in the next. Nothing here
shows Phase 19 made the city slower, and nothing shows it did not.

### Ranked next steps (proposal)

1. **A frame-rate number to trust, and the first lead.**
   - The bench takes the median of several runs, run interleaved A/B since the owner may be using the PC.
   - SpeedKills gets a floor in fps per preset for its street and roof views, checked before a release. Smooth
     was the first thing Hyper Scape was.
   - The first lead, from A5's diagnosis: every figure's skinned meshes skip frustum culling. That costs about
     324 draw calls and 980k triangles a frame for 27 bots.
2. **The guns' pace: the owner's call.** They draw in 0.4 s as found (A16; 0.3 s at level 5) and aim in 0.31 s, and no
   public source gives Hyper Scape's numbers. The rest of Phase 19's step 10 follows the decision.
3. **The free Quaternius kits,** downloaded and added (already agreed): trees and planters on the streets, and
   props for the interiors, so the rooms differ (Hyper Scape's reviewers called its rooms all the same).
4. **Bots, further:**
   - the pads outside the centre and the highway on their graph;
   - a bot's whole walk to the capture zone checked end to end. Today the plan and the pad ride are checked,
     not the full climb.
5. **A second Hyper Scape gap pass,** from snapshots of the live build set beside its screenshots.
6. **Open items from before:** the host-migration flake, and the guns' look (the owner's call).
