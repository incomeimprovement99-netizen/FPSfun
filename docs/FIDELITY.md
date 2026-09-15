# Fidelity ledger

What is exact (from the reference numbers), what is approximated, and where
each substitute came from. Update when a number moves.

## Exact (data/weapons.json, per weapon)
- Attachments: optics (ADS field of view and their own ADS time), barrel
  stabilisers (recoil scale), stocks (ADS, deploy, holster, reload, sway),
  laser sights (hipfire cone), magazines and shotgun bolts. Each is a mod
  block applied in order, so a stock's reload bonus stacks on a magazine's.
- Rechamber time. Pump and bolt-action weapons are limited by it rather than
  by fire rate: the Kraber reads 1.2 rounds per second but rechambers in
  1.6 s, and the Sentinel 0.32 s against 1.85 s.
- Damage body / head / leg multipliers, headshot max distance, distance falloff.
- Mag levels per ammo family. Four different naming schemes exist
  (`bullets_`, `energy_`, `sniper_`, `highcal_`); assuming `bullets_` gave the
  Wingman 6/6/6/6 instead of 6/7/8/9 and was wrong on 14 other weapons. Where
  a level is undefined the previous level carries forward, because the
  reference `_base_mags_sniper.txt` defines level 3 twice and never level 4,
  which otherwise made the Sentinel's gold mag worse than its purple.
- Fire rate, fire mode (auto / semi / burst count).
- Mag size per mag level, reload and empty-reload times (mag-level scaled).
- ADS in / out times, ADS FOV (4:3 horizontal), ADS move-speed scale.
- Projectile launch speed, gravity scale, lifetime (drag ignored, see below).
- Hipfire spread by stance and movement, ADS spread, per-shot kick, cap, decay.
- View-kick pattern table (per bullet yaw / pitch / random), soft and hard
  scales, base and random multipliers, spring constants and damping (hipfire
  and ADS sets).

## Movement (src/config/movement.json)

Previously community guesses. Now engine defaults, stored in Hammer units
(1 hu = 1 inch = 0.0254 m) exactly as the engine holds them, converted once in
`src/game/movement.ts`. Sources: a retail ConVar dump and a memory dump of the
player-settings struct.

| Constant | Value | In metres |
|---|---|---|
| walk / sprint / crouch speed | 173.5 / 260 / 80 hu/s | 4.41 / 6.60 / 2.03 m/s |
| gravity | 750 hu/s² | 19.05 m/s² |
| jump height | 56 hu | 1.422 m |
| standing deceleration | 1250 hu/s² | 31.75 m/s² |
| air acceleration / max wish speed | 500 / 60 hu/s | frictionless |
| slide start / boost / cap | 200 / 150 / 400 hu/s | |
| slide friction | 100 hu/s² | 12.5x gentler than standing |
| hull: stand / crouch / radius | 72 / 47 / 16 hu | 1.83 / 1.19 / 0.41 m |
| step-up / mantle height | 22 / 80 hu | 0.56 / 2.03 m |

Three things about this model matter more than the individual numbers:

1. **Ground movement is accelerate-to-target in three bands**, not Quake
   friction: below 120 hu/s use 450, between 120 and walk speed use 2500 (a
   near-instant snap), above walk speed use 100 (a long slow tail to sprint).
   Porting Quake friction here feels floaty and wrong.
2. **Air movement IS Quake-style**, with zero friction and zero drag, and a
   max wish speed of 60 hu/s which is double the classic Source value. Sticky
   ground plus frictionless air is why a slide jump carries so far.
3. **The slide-jump gate**: a slide jump keeps its speed only if taken below
   350 hu/s OR at least 0.24 s into the slide. Failing both is a "deadslide".

Approximated, and flagged: the exact combination of `slideDecel` (100) and
`slideVelocityDecay` (0.7) into one deceleration is not published. We use
`decel = slideDecel + slideVelocityDecay x speed`, which reproduces the
documented timing (a full sprint slide drops below 350 hu/s in about 0.2 s)
and has the right shape, fast at speed and gentle when slow. Lurch, climb,
superglide, fall stun, press-sprint and holster are now implemented from the
Apex Movement Wiki; the full audit, with what is still approximated, is
docs/MOVEMENT_AUDIT.md.

## Player settings (src/config/player.json)
- Copied once by hand from the owner's game config on 2026-09-13:
  sensitivity 0.4, per-scope scalars off (all 1.0), FOV scale 1.55,
  1920x1440. Never read at runtime, never written.
- Mouse yaw 0.022 degrees per count at sensitivity 1.0 (Source-family m_yaw).
- Pointer lock requests `unadjustedMovement` so OS acceleration is bypassed.

## Approximations (and why)
| Item | Used | Source / reason |
|---|---|---|
| Sprint / walk / crouch speed | 6.60 / 4.41 / 2.03 m/s (260 / 173.5 / 80 hu/s) | Engine values, confirmed by the Apex Movement Wiki. (This row used to read 7.4 / 5.6 / 3.2 m/s from early community guesses; stale since the engine values arrived.) |
| Gravity | 19.05 m/s² (750 u/s²) | Titanfall-family default sv_gravity. |
| Jump velocity | 7.36 m/s (289.8 hu/s) | Derived from the 56 hu engine jump height under 750 hu/s² gravity. (Previously "5.9 m/s, tuned"; stale.) |
| Ground accel / friction, air control | 14 / 10 / 8 | Feel values, not engine. |
| Spread units | full cone angle in degrees | Reference values (3.0 hip, 0 ADS) read like degrees; unverified. |
| Pattern reset | index restarts after 0.3 s idle | Reference has no explicit reset field in the weapon file. |
| Spring model | `x'' = -k x - c x'`, cold/hot constants blended by heat | ODE and both constant sets are from the data; see the recoil section below. Only the soft impulse scale is unknown. |
| Weapon swap time | outgoing `holster_time` + incoming `deploy_time` | Both fields are in the data; that they simply add is an assumption. R-301 to Wingman = 0.95 s. |
| Damage rounding | floor after multiplier | Matches observed in-game headshot values (13 × 1.75 → 22). |
| ADS sensitivity at 1.0 | zoom ratio (0% monitor-distance) | Community consensus for the default ADS scalar. |
| Projectile drag | ignored | `projectile_drag_coefficient` units unknown; effect small under 60 m. |
| Hitboxes | head sphere 0.13 m, torso 0.5×0.6×0.32 m, legs 0.42×0.92×0.3 m | Human hull height 72 units; zone bounds are ours. |
| Armor tiers | 50 / 75 / 100 / 125 | Reference-era shield values; no helmet. |
| Controller aim assist, rotational | 0.4 of the target's angular movement, only with input | The PC controller strength Respawn has stated (console was 0.6 until it was brought to 0.4 as well). How the game measures "the target's movement" is not published; ours is its bearing from your eye, frame to frame (`src/config/aimassist.json`). |
| Controller aim assist, slowdown and zone | 0.8 hip / 0.6 ADS, a 1.3 / 1.0 m sphere round the chest, 60 m | Ours. The game's slowdown and zone shapes are not published; chosen so a correction on a target does not overshoot, with no pull at all without input. |
| Air step-up | a box top within the step height (22 hu) above the feet in the air is climbed onto, keeping the jump's apex | Source has no air step (the hull would hit the face and a mantle would take over). Ours, because the level's ramps are stepped boxes and the courses' 1.1 m slide-jump walls were designed with it; it never raises a jump's apex (docs/RESULTS_SERVER_HUNT.md, finding 6). |
| The ring's damage per tick | 3, 4, 10, 15, 20, 25 every 1.5 s, six rounds | Apex's (https://apexlegends.wiki.gg/wiki/The_Ring). The waits and closes are scaled to a 440 m map (`src/game/ring.ts`); Apex's are 1:15 to 2:00 waits on a map a kilometre and a half across. |
| Healing | shield cell 25 in 2.5 s, syringe 25 in 4 s, four of each | Apex's item numbers (https://apexlegends.wiki.gg/wiki/Consumable). No batteries, med kits or phoenix kits yet; not interrupted by damage (unverified whether current Apex does). |
| The drop | 90 m up, 22 m/s terminal, 9 m/s steering, no fall stun | Ours: Apex's skydive is its own system with a dive angle and speed we have not measured. |
| Sounds, art, HUD | ours | By rule. |

## Recoil: how much is actually known (updated, most of it)

The question "if we have the exact parameters, why is anything tunable?" was
right to ask, and the answer changed after looking properly.

**The engine's view-kick CODE is not public.** The reference SDK reverse
engineers the state layout and function addresses but never the bodies; the
view-kick routine is still a raw pointer into the retail binary. No open
source project contains it.

**But the reference DATA documents nearly all of it**, and three things that
were being approximated are now implemented exactly:

1. **The differential equation.** The header of the reference `springs.txt` is
   first-party documentation of the spring: it states that the spring
   oscillates iff `4k > c²`, that its frequency is `sqrt(4k - c²)/(4π)`, and
   that its amplitude half-life is `2·ln2/c`. Those three identities hold
   uniquely for `x'' = -k·x - c·x'` with unit mass, so the ODE is known, not
   guessed. `npm run verify` checks the integrator against the closed-form
   solution (agreement to 9e-4) and measures the published half-life back out
   of it peak to peak.

2. **Why recoil holds during a spray, then snaps back.** Every weapon names
   TWO springs, cold and hot, plus `viewkick_spring_heatpershot`,
   `_cooldown_holdtime` and `_cooldown_fadetime`. Heat builds while firing and
   blends cold toward hot. **The R-301's hot ADS pitch springConstant is 0**,
   meaning no restoring force at all: the punch accumulates through the spray
   and only springs back once the gun cools (hold 0.08 s, fade 0.05 s, then
   back to k=115 with a 69 ms half-life). This replaced a hand-rolled
   "softRecoveryWhileFiring" dial that had been invented to imitate exactly
   this behaviour without knowing it existed.

3. **When the pattern resets.** Not a fixed timeout. A cursor advances
   `viewkick_scale_valuePerShot` per shot and walks back down after
   `_valueDecayDelay` at `_valueDecayRate`. For the R-301 that is 0.09 s then
   50 rows/second, so a full 28-row spray unwinds 0.65 s after the last shot
   and a 5-round burst in 0.19 s.

Two corrections fell out of the same work:

- **`hardScale` is not the permanent aim change.** `viewkick_perm_*` is, and
  it exists as a separate field family covering pitch and yaw only. `softScale`
  and `hardScale` both exist for pitch, yaw AND roll, and a permanent roll
  change is meaningless for aim. Both feed the spring and both recover. The
  R-301's `perm_*` values are all zero, so its recoil returns fully.
- **Soft is injected into the spring's velocity, hard into its angle.** The
  reference weapon files call `hardScale` the "chunky scale" and `softScale`
  the "overall pattern size", and the ancestor engine's punch code adds to
  velocity. Soft eases in, hard snaps.

### The one number that remains unknown

`softImpulseScale` in `src/config/recoil-tuning.json`. The ancestor engine
uses `punchAngleVel += offset * 20`, so **20** is the inherited default. It
scales how far the muzzle climbs without changing the pattern shape or the
recovery. `npm run verify` sweeps it:

| softImpulseScale | climb over a full R-301 mag | pulldown @800dpi/0.4 |
|---|---|---|
| 1 | 1.62° | 0.6 cm |
| 10 | 2.75° | 1.0 cm |
| **20** (default) | **4.00°** | **1.4 cm** |
| 30 | 5.24° | 1.9 cm |
| 50 | 7.74° | 2.8 cm |

Every value climbs monotonically through the first 8 rounds and sags 0% from
peak, because the hold-during-spray now comes from the hot spring rather than
from this dial. So this is a pure magnitude knob, and the playtest sets it.

## Superseded: the soft-recovery dial (kept for the lesson)

This knob no longer exists. It was invented to make recoil hold during a spray
before the cold/hot spring blend above was found. The section is kept because
the bug inside it is worth remembering.

### The bug that made the first answer wrong (keep this, it is the lesson)

The dial was first implemented as `k*rec, c*rec`. That is not a time rescale.
Slowing a spring's time by `r` requires **`k*r², c*r`**; scaling both linearly
divides the damping ratio by `√r`, so the R-301's near-critical ADS spring
(k 115, c 20, ζ = 0.93) became a **ringing** one:

| dial | ζ under the buggy `k*r, c*r` | ζ under the correct `k*r², c*r` |
|---|---|---|
| 1.00 | 0.933 | 0.933 |
| 0.35 | 0.552 | 0.933 |
| 0.10 | 0.295 (ringing) | 0.933 |

That ringing was the "view sinks back down mid-spray" that the first version
of this document cited as proof that **every** nonzero dial was impossible,
concluding the spring must freeze entirely. **That conclusion was an artifact
of the integrator, not a finding about the gun.** A measurement is only as
good as the model under it.

### The corrected sweep

| dial | peak | final | sag from peak | first 8 climb | pulldown @800dpi/0.4 |
|---|---|---|---|---|---|
| 0 | 11.45° | 11.45° | 0% | yes | 4.1 cm |
| 0.05 | 10.41° | 10.40° | 0% | yes | 3.8 cm |
| **0.10** | **9.07°** | **8.50°** | **6%** | **yes** | **3.1 cm** |
| 0.15 | 7.81° | 6.71° | 14% | no | 2.4 cm |
| 0.35 | 5.78° | 3.10° | 46% | no | 1.1 cm |
| 1.00 | 3.02° | 1.83° | 39% | no | 0.7 cm |

Three settings survived the shape tests, and 0.10 was chosen as the largest
that kept a continuously recovering spring while still climbing monotonically.

### And then the whole dial turned out to be unnecessary

The reasoning above is sound and the conclusion was still wrong, because the
question itself was wrong. There is no need to decide how much a spring
"should" recover while firing: the data already says. Each weapon names a
second, hot spring, and the R-301's hot ADS pitch constant is **0**, so while
the gun is hot the punch does not recover at all. The dial was reconstructing,
by feel, a mechanism sitting unread in the same file the spring constants came
from.

**Two lessons, both cheap to state and expensive to learn:**
1. A measurement is only as good as the model under it. The first sweep was
   measuring an integrator bug.
2. Before tuning a constant to imitate a behaviour, check whether the data
   already describes that behaviour. Here it did, two fields away.

## Where the weapon data comes from (corrected)

Two problems were found and fixed here, and both were invisible until checked.

**1. We were extracting from a mod, not the game.** The first clone was a
community mod's fork of the script dump. `npm run compare-sources` diffs the
two: **139 of 455 top-level values we read differ.** The R-301 read 13 damage
instead of 14, the Wingman 6 rounds instead of 4, the Mastiff 11 instead of 18.
The extractor now reads the canonical unmodified tree.

**2. The canonical tree nests values the fork had flattened.** Some stats live
in an `MP_BASE` block rather than at the top level. Reading only the top level
silently lost damage on the R-99, Spitfire, Prowler and P2020, which then fell
back to a hardcoded default. The extractor merges `MP_BASE` before reading.

**3. The dump is an early build, and live balance has moved.** So
`data/overrides.json` layers current-season values on top, sourced from the
community wiki's weapon infoboxes cross-checked against official patch notes.
All 27 weapons carry an override. The largest changes:

| | Dump | Current |
|---|---|---|
| Kraber headshot multiplier | 2.05 | **1.4** |
| Wingman headshot / mag | 2.1 / 4 | **1.5 / 5** |
| EVA-8, Mastiff, Peacekeeper headshot | 1.25-2.0 | **1.0, removed entirely** |
| Mastiff pellets / damage | 8 x 18 | **5 x 19** |
| Peacekeeper pellets / damage | 11 x 10 | **9 x 11** |
| R-301 damage / mag | 14 / 18 | **15 / 21** |

Use the infobox block on those wiki pages, not the damage-profile block below
it: the latter lags a patch, which was confirmed on two weapons.

**Pellets are now modelled.** Shotguns fire their real pellet count, each with
its own deviation. Before this an EVA-8 hit for 7 instead of 56.

Known-uncertain, flagged in `overrides.json`: the G7 Scout's headshot damage
and purple magazine are disputed between sources, and the 30-30 Repeater's
supply-drop variant is not published.

## Data era
The reference set is a Season 3 base with some later weapon updates. Live
balance differs on some guns. Patch overrides go in `data/overrides.json`
and are applied by the extractor; Season 30's changes are there (the 30-30's
51, the L-STAR's 20, the Charge Rifle's 75 growing to 110 at 200 m).

## Phase 11: the Season 30 systems (sources in docs/RESEARCH_PHASE_11.md)

| Number | Value | Source / confidence |
|---|---|---|
| Heals | cell 25 in 2.5 s, syringe 25 in 4 s, battery full in 5 s, med kit full in 8 s, phoenix both full in 10 s; stacks 6 / 6 / 2 / 2 / 1 | wiki, exact (research section 1) |
| Healing slow | 40% slower, no sprint; not cancelled by damage | wiki, exact |
| Helmets | no headshot cut since S24; gold sets armour 100 and doubles the small heals; mythic 125 | patch notes, exact (section 2) |
| Shield cores (EVO) | white 50, blue at 450 EVO, purple at 1,700 | wiki, exact (section 3); EVO from damage dealt only (ours: taken and knocks are left out) |
| Down and revive | bleed-out 90 / 60 / 30 / 15 s by knock, 100 more to finish, revive 5 s to 20 health, banner 90 s, beacon 5 s | wiki, exact (section 4); the crawl's 65% is ours |
| Frag | 100 inside 2.4 m, 8 m radius, 4 s fuse, +10 direct | wiki, exact (section 5); straight-line fall-off, throw speed, gravity, bounce are ours |
| Arc star | 75 inside 1.8 m, 8.75 m, 2.8 s after sticking, +10 stick, slow up to 5 s | wiki, exact; the slow's strength (55% speed) is ours |
| Thermite | 6 m, 8 s, 4 a tick twice a second, 25 afterburn | wiki, exact; the afterburn's 2.5 s, the fire's width, lying across the throw are ours |
| Nemesis, Bocek | the research's numbers (section 6, 7) | wiki, exact |
| Energy ammo | a magazine back every 18 s idle; stockpiles 2 (RE-45, Volt, Triple Take), 3 (HAVOC, Nemesis, Devotion), 4 (L-STAR) | patch notes, exact (section 8) |
| Charge Rifle, L-STAR, HAVOC, Devotion, 30-30 | 0.85 s charge, 75 to 110 at 200 m; overheat after 24/26/28/30 shots, lockout 1.19 to 1.07 s; 0.42 s wind-up (0.01 turbo); 1.75 s spin (0.85 turbo); 51 damage, 0.25 s aimed charge | patch notes and wiki, exact (sections 9 to 11) |
| Mantle boost cue | the mantle's last 0.15 s | patch notes, exact (section 12) |
| Gun Run | one kill a level, the knife (100 body / 300 head) wins, a melee death costs a level, 10 min, regen after 4 s | wiki, exact (section 13); free-for-all, 10 or 29 guns, 3 s respawn and the regen rate are ours |
| Team deathmatch | first to 30, teams of 4, 10 min, 4 s respawn | ours, scaled from Apex's 6v6 first to 40 |
| Crown | appears 20 s in, 30 s to hold, first to 3 | ours (Hyper Scape's launch value was 45 s, unverified) |
| JOLT, TRIAGE | 10 m every 3 s; heals twice as fast | the owner's numbers; JOLT's 0.18 s and 260 hu/s exit are ours |
| Killcam | the last 4 s, then 1 s after, recorded 30 times a second | ours |
| Loot tables | rarity weights, items per spot, what each rarity holds | ours (Apex does not publish them); the care-package guns per S30 |
| Launch pads, jump towers | a pad's 20 m/s along and 16 m/s up; a tower's drop from three quarters of the drop height | ours |
| Course pars | a room's share of the S rank by length; medals at par, +25%, +60% | ours |
| Controller advanced look | 180 / 120 deg/s hip, 90 / 60 ADS, ramp 0.33 s by default | ours (the game's own defaults are not published) |

## Phase 12: the dash, bots, the battle royale's newer systems, Control (sources in docs/RESEARCH_PHASE_12.md)

| Number | Value | Source / confidence |
|---|---|---|
| JOLT | 10 m, 2 charges, one back every 4 s (8 s for both) | the owner's numbers |
| JOLT's feel | 0.14 s on an ease-out (70% in the first half), 0.25 s between dashes, leaving at 400 hu/s, FOV +8 deg, roll 2.5 deg | ours, from the research's references (section 6: Tracer 3 x 3 s, The Finals 2 x 5 s, 0.1 to 0.3 s travel) |
| Shield cores (EVO) | blue at 450, purple 1,700 more (2,150 in all) | wiki, exact (section 2.3); Phase 11's "1,700 in all" corrected |
| EVO sources | damage 1 a point, knock 150, assist 100, finisher 100, revives 100 / 100 / 75 / 50 / 25 / 0, care package 100 | wiki and S28 notes, exact; the assist's 15 s window and "care package once a package" are ours; finishers do not apply (bots cannot be downed) |
| Knockdown shield | 200 / 450 / 750 by EVO level, front only, crawl -45%, broken for the knock | S28 notes and wiki, exact (section 2.2); the 70-degree arc is ours |
| Deathbox Respawn | 7 s hold, back at 20 HP with what is left in the box, a beam and a sound for all, a lockout per death | S29 notes and wiki, exact (section 2.1); the lockout's 30 / 60 / 120 s, the 3-minute reset, the 6 s shield regen and the 2.2 m reach are ours |
| Executioner | Peacekeeper and Mastiff, 50 shield over 5 s on a knock, 275 points | S29 mid and S30 mid notes, exact (section 2.4) |
| Shattercaps | 30-30 hip fire, 7 pellets x 8, heads x1.25 | S30 notes, exact; the 5.5-degree cone is ours |
| Redline | +15% damage above 75% heat | ours: Apex has published no numbers; the bigger projectile is not modelled (our rounds are rays) |
| Locked hop-ups | unlock after 275 damage with the gun; care-package guns unlocked | S26 on; 275 is Executioner's, ours for the other two |
| Controller Default | RB ping (double tap enemy), D-pad up heal (hold wheel), D-pad right grenade, D-pad left fire mode (hold inspect), Y hold holster, Back map; presets Default, Bumper Jumper, Button Puncher, Evolved, Grenadier, Ninja | EA's controls page, exact (section 1); D-pad down's zoom, the 0.3 s hold, and where Evolved and Grenadier put the actions they displace are ours |
| Bot tiers | reaction 0.6 / 0.4 / 0.2 / 0.12 s; aim error start, decay and floor; aim lag; dodge, hearing | CS2's bot profile and TF2's bot code (section 4) for the shape and the reactions; the rest ours |
| Bot frags and cover | frag after 8 / 5 / 4 s still in view or 1.5 s hidden, 2 a life, 14 s apart; cover below 55%, within 9 m | ours |
| Control | three zones, 1 a second per zone, bonus 150, lockout, linked spawns, capture x1 / 1.5 / 2 / 2.25 / 2.5 / 2.75 / 3 | wiki, exact (section 3); 5 v 5, first to 500, 10 min, 8 s base capture, the bonus's timings, the 30 s lockout and 5 s respawn are ours |
| The phoenix kit | "Nova kit" on the public build | the owner's Phase 11 question; decided in Phase 12 |
