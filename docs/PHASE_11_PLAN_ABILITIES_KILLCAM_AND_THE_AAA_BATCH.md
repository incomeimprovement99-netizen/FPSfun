# Phase 11 plan: abilities, the killcam and death recap, and every next step short of PvP BR

**Date:** 2026-09-15. **Status:** done; built in the order below, one committed checkpoint and one roadmap milestone per workstream. Results: `docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`.

**Owner:**

> *"we can do everything except the pvp br now in one large session as long as we plan it out accordingly. do the next steps in the gap_analysis.md, next_steps.md, and add two abilities we can pick as soon as we land / spawn in the first POI, that is either dash (dash 10 meters quickly in one direction every 3 seconds) or heal twice as fast. Ensure you give them names, allow them to choose via prompting them with text when its available. Allow the two abilities in the 1v1v1 mode and bots as well, make it a configurable option on if we want it or not. BR should always have it, or jsut have the option default selected when we choose the BR mode."*
>
> *"This is a massive undertaking so ensure that you take my prompt and put it into a detailed "Phase" document. It should also update a project roadmap file with a "milestone" every time we add something that is relatively large or just a new feature worth documenting."*
>
> *"Don't forget to add a killcam (skippable) and a "death recap" to see how much you hit them for vs how much they hit you for, how many times, what gun, what distance, if they healed recently."*

## How this phase is run

- **The docs pattern changes with this phase** (the owner's ask): `docs/DEVELOPMENT_ROADMAP.md` gets one `## Milestone N` entry per shipped feature or batch, and each round of work gets a `PHASE_N_PLAN_*.md` (this file) and a `PHASE_N_*.md` results doc. Rounds 1 to 10 are written into the roadmap after the fact from their `PLAN_*` / `RESULTS_*` docs, which keep their names.
- **Order:** the owner's three new asks first (abilities, killcam, death recap), then the gap-analysis list in its ranked order, grouped so each workstream touches one part of the code.
- **Per workstream:** build, then `npm run check`, `npm run verify`, `npm run movesim`, `npm run e2e` (with the dev server), `npm run rules`; a commit to `main` (no push unless asked); a milestone in the roadmap.
- **Numbers:** every gameplay number goes in `data/weapons.json` or `src/config/*.json`, never a literal in game code (PROJECT_RULES section 3). Numbers that are Apex's come with a source in `docs/RESEARCH_PHASE_11.md`; where no source confirms a number it is marked *ours* or *(unverified)* in `docs/FIDELITY.md`.
- **Art and sound:** all generated in code (PROJECT_RULES section 2). Nothing is copied from the game.
- **At the end:** a bug hunt over everything this phase touched, README, deploy guide, NEXT_STEPS and GAP_ANALYSIS brought up to date, the results doc, the Pages build deployed, and a list of what is still open.

## Not in this phase (and why)

| Item | Why not now |
|---|---|
| PvP battle royale | The owner's call: "down the road". It needs the authoritative server below. |
| The authoritative game server, ranked boards | Only needed for PvP and trusted boards; 2 to 4 weeks on its own (NEXT_STEPS 9, 10). |
| Accounts | Needs the owner to sign up for a provider, and the standing goal is "play without having to login". Stays a later option. |
| Corrupted attachments | Low value, and their effects are not confirmed by a source. |
| The Arenas buy phase | Apex removed Arenas (2023); our 1v1 already has its rounds and circle. |
| Wall running, double jumps | Break the Apex movement model (GAP_ANALYSIS section 3.5). |

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Ability names | **JOLT** (the dash) and **TRIAGE** (heal twice as fast) | Our own names; neither is an Apex ability name. |
| JOLT | 10 m in the direction you are moving (forward with no keys held), over 0.18 s, level (no gravity during it), walls stop it, you keep sprint speed out of it; 3 s cooldown from the start of one to the start of the next | The owner's numbers; the duration and exit speed are ours. |
| TRIAGE | Every heal item's use time halved | The owner's number. |
| When you choose | A prompt card when the ability becomes available: on landing from the BR drop, and in the countdown of the first round of a 1v1v1 or a bot match (and again each countdown, to change). It stays up, small, until you pick. In the range you can pick any time to practise. | "prompting them with text when it's available" |
| Keys | **5** picks JOLT, **6** picks TRIAGE (d-pad left and right on a controller while the card is up); **F** uses the ability (LB on a controller) | 5 and 6 sit next to the heal key; F is the free key nearest WASD. Everything is rebindable in the Controls tab. |
| Keys moved to make room for Apex's fight defaults | Reset dummies F to **Y**; fire mode on **B** (Apex's default), barrel moves B to **J**; grenade on **G** (Apex's default), mag level moves G to **U**; ping on the **middle mouse button** (Apex's default); hop-up cycles on **L** | The keys that matter in a fight match Apex; the range's attachment keys are the ones that move. |
| The option | "Abilities: on / off" per match type, on the 1v1 tab (it applies to 1v1, 1v1v1 and the bot match) and the BR box; BR's is on by default and is the one the Play tab's BR button uses. The host's setting is the match's (it rides in the welcome). | "a configurable option ... BR should always have it, or just have the option default selected" |
| Bots and abilities | When a match has abilities on, each bot takes one at random: a JOLT bot jolts sideways when it is being hit; a TRIAGE bot heals faster. Bots also heal now (cells and syringes) when they have had no target for a few seconds. | So the option means the same for both sides. |
| Killcam | On elimination (your round is over, or your life in a BR), the last 4 s before it replayed from your killer's eyes, then 1 s after; SPACE (or E, or A on a controller) skips; a setting turns it off. Not on a knock you can still be revived from. | Skippable, as asked; not on a down, so it never hides a fight you are still in. |
| Death recap | A card after the killcam (or at once if it is off): per opponent who damaged you this life, damage you did to them against damage they did to you, hits and headshots each way, the gun(s) they used and the distance of each hit, whether they healed in the 10 s before the kill (and with what), and what they had left. It stays until you press SPACE, the next round starts, or you spawn. | Everything the owner listed, plus what they had left, which is the question every recap answers. |

## Workstreams

Each table: **id**, **item**, **how it is done**, **verified by**. A workstream is one checkpoint commit and one roadmap milestone.

### 11A. The roadmap and this plan

| id | item | how | verified by |
|---|---|---|---|
| D1 | `docs/DEVELOPMENT_ROADMAP.md` | Milestones 1 to 10 written from the ten earlier rounds (their plans, results and commits); Milestone 11 onward added as this phase ships | the file |
| D2 | This plan | `docs/PHASE_11_PLAN_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md` | the file |
| D3 | Research with sources | `docs/RESEARCH_PHASE_11.md`: current Apex numbers (heals, helmets, Evo, revive, throwables, Nemesis, Bocek, ammo, charge weapons, Gun Run), each with a URL | the file; every number used cites it or is marked ours |

### 11B. Abilities: JOLT and TRIAGE

| id | item | how | verified by |
|---|---|---|---|
| A1 | The abilities and their numbers | `src/config/abilities.json` (names, blurbs, JOLT distance / duration / cooldown / exit speed, TRIAGE heal scale); `src/game/abilities.ts` owns the choice, the cooldown, and use | verify: cooldown gating, heal scale |
| A2 | JOLT in the movement code | `Player.jolt(dirX, dirZ, dist, time)`: a dash state that overrides horizontal velocity for its duration, keeps you level, collides with walls through the normal move, ends a slide, cannot start mid-climb, mantle or zip; you leave it at sprint speed in its direction | movesim: 10 m on open ground (±0.3), stopped by a wall, level in the air, no effect on the sprint numbers |
| A3 | TRIAGE in the heals | heal time divided by the scale | verify; e2e: a cell takes 1.25 s with TRIAGE |
| A4 | The choice prompt | HUD card "CHOOSE YOUR ABILITY  [5] JOLT ...  [6] TRIAGE ..." when one becomes available (BR landing, first countdown of a 1v1v1 or bot match, each countdown to change); small and out of the way until picked | e2e: the card shows after the BR landing, 5 picks JOLT, the card goes |
| A5 | The HUD | the ability, its key and a cooldown sweep, bottom left over the bars; a flash when it is ready | e2e reads the cooldown |
| A6 | The option | "Abilities" select on the 1v1 tab (1v1, 1v1v1, bots) and in the BR box (on by default); remembered; the host's choice goes in the welcome | e2e: a bot match with it off shows no card |
| A7 | Other players see a JOLT | a `fx` message: a streak along the jolt and its sound at their figure; bots' jolts drawn the same way | e2e over the local transport: the guest's jolt reaches the host |
| A8 | Bots with abilities | a JOLT bot jolts sideways under fire (cooldown respected); a TRIAGE bot heals twice as fast; every bot heals when it has had no target for 4 s | verify with a scripted bot |
| A9 | The range | 5 and 6 pick an ability to practise any time | e2e |
| A10 | Keys | `ability`, `pickAbility1`, `pickAbility2` in `binds.json` and the Controls tab; the pad's LB | e2e: rebinding still works |

### 11C. The killcam and the death recap

| id | item | how | verified by |
|---|---|---|---|
| K1 | A recorder | `src/game/killcam.ts`: in every match, 30 times a second, every figure's position, facing, pitch, stance, speed, weapon and skin, and yours; every tracer fired; the last 8 s kept | verify: the buffer holds 8 s and drops the rest |
| K2 | The replay | on elimination: ghost figures posed from the buffer, the real ones hidden, the camera at the killer's eye (their pitch and yaw), the tracers re-drawn; 4 s before the kill and 1 s after; a letterbox and "KILLCAM · <name> · <gun> · SPACE TO SKIP" | e2e: a bot kill starts it, the camera is at the bot, SPACE ends it |
| K3 | Skippable, and never in the way | SPACE, E, or A on a pad skip; it ends by itself when the next round's countdown starts; a Settings option turns it off; none for a ring kill (the recap only) | e2e |
| K4 | What each hit carries | the `hit` message gains the weapon and the distance; bot hits know theirs; the ring is "the ring" | verify: a hit with and without the new fields (old builds) |
| K5 | Heals seen on others | the state packet carries what someone is healing with; bots report theirs | verify |
| K6 | The damage log | `src/game/recap.ts`: per life, every hit you took and every hit you landed (who, gun, amount, headshot, distance, shield or health), and every heal seen on anyone | verify: the totals match the hits |
| K7 | The recap card | per opponent: YOU → THEM damage, hits, headshots; THEM → YOU the same; their gun(s) and distances (closest, farthest, typical); "HEALED 3.2 s BEFORE (SHIELD CELL)"; what they had left; the killer first | e2e: after a bot kill the card shows the bot, its gun, the damage both ways, and the distance |
| K8 | In every match | 1v1, 1v1v1, bots, BR solo and squad (the squad's on elimination, not on a down) | e2e per mode |

### 11D. Sound

All synthesised (Web Audio), positional, with a master and an effects volume in Settings.

| id | item | how | verified by |
|---|---|---|---|
| S1 | A positional engine | `src/game/audio.ts` rebuilt: a listener on the camera, a panner per sound (HRTF), distance fall-off and a low-pass that closes with distance, a voice cap | verify (headless: the node graph builds); e2e: no audio errors |
| S2 | Gunfire by class | pistol, SMG, rifle, LMG, marksman, sniper, shotgun, energy: a body, a transient and a tail per class; far shots lose their top end and arrive late (340 m/s); suppressed "crack" for rounds passing near you | the class table in FIDELITY |
| S3 | Footsteps by surface | per stride from speed, for you and every figure: concrete on the range floor, metal on raised boxes and platforms, dirt and grass on Outskirts; a crouch walk is quieter; a sprint louder | e2e: footsteps from a moving bot |
| S4 | Movement sounds | jump, landing (by fall speed), slide scrape (a loop while sliding), climb taps, mantle, zipline whine, JOLT whoosh, the drop's wind | e2e: no errors through a course run |
| S5 | Hit sounds by shield tier | the tick pitched by the shield colour; the shield break; the knock stinger; a headshot ping; hits you take thud | |
| S6 | Heals | the cell hum, the syringe, the battery, the med kit; the heal-done chime | |
| S7 | The ring and the match | the ring's closing horn, its damage tick outside, the countdown beeps, the round and match stingers, the champion sting | |
| S8 | Low health | a heartbeat under 30 health, and the picture loses colour (a desaturation in the colour grade) | |
| S9 | Weapons | the HAVOC and charge-rifle wind-up, the Devotion spin, the L-STAR overheat hiss, the empty click, reload parts (mag out, mag in, bolt), swap and holster | |
| S10 | Settings | master, effects, and "hit sounds" volumes, remembered | |

### 11E. Weapons: charge, spin-up, overheat, select fire, hop-ups, ammo

| id | item | how | verified by |
|---|---|---|---|
| W1 | HAVOC charge-up | `charge_time` 0.42 s before the first round, held while the trigger is; the Turbocharger removes it (the data's `hopup_turbocharger`) | verify: first shot at 0.42 s, 0 with the hop-up |
| W2 | Devotion spin-up | `fire_rate` 5 to `fire_rate_max` 15 over `fire_rate_max_time_speedup` 1.75 s of fire, back down when you let go; Turbocharger 6.8 / 0.85 s | verify: the rate at 0, 0.875, 1.75 s |
| W3 | L-STAR overheat | heat to full over `charge_time` 1.7 s of fire, locked out and cooling over `charge_cooldown_time` 2.45 s when it overheats, cooling from `charge_cooldown_delay` otherwise; a heat bar on the HUD | verify |
| W4 | Charge Rifle | hold to charge the beam for `sustained_discharge_duration` 0.48 s, the shot fires at the end; the beam's own damage per the research doc | verify |
| W5 | 30-30 charged shot | aiming charges over `charge_time` (the research doc's current value), the shot does up to `charge_additional_damage_multiplier` (36%) more | verify |
| W6 | Precision choke (Peacekeeper, Triple Take) | aiming charges the choke over `charge_time`, the pellet cone narrows | verify |
| W7 | Select fire | B toggles the weapon's other mode where the data has one (`altfire`): R-301 and Flatline single / auto, Hemlok single / burst, Prowler burst / auto (needs the Selectfire hop-up in Apex, noted), G7 and EVA double tap, HAVOC beam-less single | verify: the Hemlok's cadence in each mode |
| W8 | A hop-up slot | a fifth attachment slot from the data's hop-up mods: Turbocharger (HAVOC, Devotion), Skullpiercer (Longbow, Wingman: `damage_headshot_scale`), Hammerpoint (P2020, Mozambique: `damage_unshielded_scale`), Disruptor (Alternator, RE-45: `damage_shield_scale`), Precision Choke, Selectfire (Prowler), Multiplexer (Charge Rifle) | verify: a Hammerpoint P2020 on an unshielded dummy does 2.7x |
| W9 | Shield and unshielded damage | `damage_shield_scale` and `damage_unshielded_scale` applied where the round meets a shield or bare health, dummies and players alike | verify |
| W10 | Ammo types and reserve | `src/config/ammo.json`: each gun's ammo (light, heavy, energy, sniper, shotgun, arrows), stack sizes; reserve counted in matches, a reload takes from it, the HUD shows it; the range stays unlimited unless "Range ammo: real" is set | verify: a reload with 10 in reserve fills 10 |
| W11 | What you carry into a match | the 1v1 and the bots start with a set reserve per gun (config); the BR starts with nothing and loots (11H) | e2e |
| W12 | The HUD for all of it | charge ring on the crosshair, spin and heat bars, the fire mode, the hop-up line, the reserve under the magazine | e2e reads them |

### 11F. The missing guns: Nemesis and Bocek

| id | item | how | verified by |
|---|---|---|---|
| N1 | Nemesis Burst AR | a derived weapon (as the Striker 9 is), numbers from the research doc: burst of 4, damage, the burst delay and its charged delay after hits | verify: burst cadence charged and not |
| N2 | Bocek Compound Bow | a draw-to-fire weapon: hold to draw, damage by draw fraction, a perfect-draw window, arrows as its ammo; Shattercaps as its hop-up (pellets) | verify |
| N3 | Models | a Nemesis in the rifle family and a bow built from its own parts, first person and on figures | screenshots |
| N4 | Codenames | both in `names.ts` for the public build | beta-check |

### 11G. The range's own tooling

| id | item | how | verified by |
|---|---|---|---|
| R1 | Dummy behaviour | a "Dummies" panel (menu, Range box) and a key: stand, strafe, strafe and crouch, random ADAD, a speed; "shoot back" (Full Combat): the dummies fire at you with the bots' aim at a difficulty, and you have a shield and health in the range that refill when you go down | e2e: a strafing dummy moves; shoot-back hurts you |
| R2 | A spray wall | a wall at 20 m on the range: your hits drawn as marks, the weapon's pattern from the data drawn next to them, cleared with a key; the pattern scale follows the distance | screenshot; e2e: a mag leaves marks |
| R3 | A flick drill | "Blink": 30 targets one at a time at random spots in a 60 degree cone, 5 to 30 m; a clock; score = time, hits and misses; best kept, on the Stats tab and the online board | e2e: the drill runs to the end |
| R4 | Overlay | per-gun session history (shots, hits, damage, accuracy) on a Stats card, and a reset key for the live overlay | e2e |
| R5 | Hits by zone | a dummy flashes in the zone's colour (head gold, body white, legs blue) | screenshot |
| R6 | Superglide trainer | at the practice wall: a timing bar of your jump and crouch against the mantle's end, the frame you hit, ten tries, a score | movesim + e2e |
| R7 | The mantle boost cue | a ring on the crosshair on the mantle's last frames, where a superglide is possible (the research doc's S27 note) | movesim |
| R8 | A slide probe | `tools/slide-probe.ts`: speed, view height and gun pose every frame through a slide and a slide jump in the simulation, written as an HTML page of curves beside the wiki's numbers | the page |
| R9 | Course medals | a par time per room on the results TV and gold / silver / bronze per room | e2e |

### 11H. Heals, armour, helmets

| id | item | how | verified by |
|---|---|---|---|
| H1 | Every heal | Syringe, Med Kit, Shield Cell, Shield Battery, Phoenix Kit, amounts and times from the research doc, in `src/config/items.json` | verify |
| H2 | Healing as Apex does it | walk while healing (at its slowed speed), sprint / fire / aim / swap cancel it; the item is spent at the end | movesim: speed while healing |
| H3 | The heal key | 4 picks what you need (a battery for a lot of shield, a cell for a little, the same for health; a Phoenix when both are low); holding 4 opens a small wheel (5 items, the mouse or the keys pick) | e2e |
| H4 | Body shields and Evo | white 50, blue 75, purple 100, red 125; an Evo shield levels up with damage dealt at the research doc's thresholds and refills when it does | verify |
| H5 | Helmets | white, blue, purple, gold, each cutting headshot damage by the research doc's amount | verify |
| H6 | In the 1v1 and bots | the kit from config (default: 2 batteries, 4 cells, 2 med kits, 4 syringes), blue shield, no helmet; a "loadout: fixed / loot" choice for the BR | e2e |
| H7 | On the network | shield max and helmet in the state packet, so plates and damage colours are right | verify |

### 11I. The battle royale, filled in

| id | item | how | verified by |
|---|---|---|---|
| B1 | Floor loot | spawn points in every building from a seeded table (weapons, attachments, hop-ups, ammo, heals, shields, helmets, throwables), by rarity; glowing items with an E prompt; picking a gun up swaps your slot; attachments go on the gun that takes them | e2e: land, pick up a gun and a cell |
| B2 | You land with nothing | your fists, then what you find (a "BR start: loot / your loadout" choice, loot by default) | e2e |
| B3 | Bots loot too | a bot lands unarmed and armed after a search time (by difficulty), with a random shield tier | verify |
| B4 | Death boxes | a bot or player that is eliminated drops a box with its gun, ammo, heals and shield; E opens it (a list, click or a key takes) | e2e |
| B5 | Downed and revive (squad) | knocked with a squad mate up: you are down, not out: crawl, no guns, bleed out over the research doc's time; a squad mate holds E for the revive time; up with the research doc's health | e2e over the local transport |
| B6 | Banners and respawn beacons | eliminated: your banner in your death box for the research doc's time; a squad mate takes it and uses a beacon (one per outer POI) to bring you back by drop | e2e |
| B7 | Solo | a knock is the end, as in Apex's solos | e2e |
| B8 | Care packages | a pod drops at a random point inside the next ring during rounds 2 to 4, with a beam and a map marker, holding gold and purple items | verify: it lands inside the ring |
| B9 | Jump towers | one at each outer POI: E to ride up and drop again | e2e |
| B10 | Launch pads | pads on the roads between POIs that throw you forward and up | movesim |
| B11 | Pings | the middle mouse button: a ping where you look ("ENEMY" on a figure, "LOOTING" on an item, "GOING HERE" on the ground), a marker in the world and on the map, sent to the squad, a sound | e2e over the local transport |
| B12 | Spectating a squad mate | out with a squad mate still in: a first-person view from their eyes (their aim), with the third-person view on a key | e2e |
| B13 | The map | loot-rich spots, towers, beacons and pods on the full map; the ring's next circle shown earlier | screenshot |
| B14 | The squad's network | loot is the host's: the seed rides in the welcome, every side builds the same loot, a pick-up is asked of the host and the host tells everyone it is gone (first come wins); revives, banners and beacons go through the host | e2e |

### 11J. Modes

| id | item | how | verified by |
|---|---|---|---|
| M1 | Gun Run against bots | a list of guns (short: 10; full: every gun), one kill to move on, respawns, a time limit from the research doc; the bots run the list too; first to the end wins | e2e: kills move you on |
| M2 | Gun Run with friends | the same over the 1v1 links: 1v1 and 1v1v1, respawns in the arena | e2e over the local transport |
| M3 | Team deathmatch against bots | you (and friends) against a team of bots in the arena, respawns, first to the research doc's score | e2e |
| M4 | Crown | a 1v1v1 and bots variant (Hyper Scape's): the crown appears in the middle 20 s in, the carrier is shown to everyone and walks, holding it 30 s takes the round | e2e |
| M5 | Picking them | the 1v1 tab's mode list and the Play tab | e2e |
| M6 | Stats | per mode on the Stats tab | e2e |

### 11K. The figures, animated further

| id | item | how | verified by |
|---|---|---|---|
| F1 | Direction | the legs walk the way the figure moves while the body faces its aim: strafe steps, a backpedal | screenshot |
| F2 | Aim down sights | the gun comes up to the eye | screenshot |
| F3 | Firing, reloading, swapping | recoil in the arms, a magazine dip, a swap arc | screenshot |
| F4 | Hit reactions | a flinch on every hit, a stagger on a shield break | screenshot |
| F5 | Down | knocked: to the knees and a crawl pose (for the BR's downed state); eliminated: the fall | screenshot |
| F6 | Healing and abilities | a syringe / cell pose; a JOLT lean | screenshot |
| F7 | A motion-captured rig | if a CC0 rigged character with clips can be fetched by a script (research in progress), load it for the figures behind a setting; if not, recorded as open with why | the research note |
| F8 | Sent over the network | ADS, firing, reloading, healing in the state packet | verify |

### 11L. Throwables

| id | item | how | verified by |
|---|---|---|---|
| T1 | Frag | G readies it (again cycles the type), fire throws, aim cancels; an arc preview; a fuse, a radius and a fall-off from the research doc | verify: damage at the centre and the edge |
| T2 | Arc star | sticks to what it hits, a short fuse, damage and a slow | verify |
| T3 | Thermite | a line of fire along the ground, damage per tick | verify |
| T4 | Where you get them | the 1v1 kit (config), BR loot, the range (unlimited) | e2e |

### 11M. Finish

| id | item | how | verified by |
|---|---|---|---|
| P1 | Weapon inspect | hold R with a full magazine: the gun turns in the hands | screenshot |
| P2 | First draw | the first time a gun comes out after you pick it up: a longer flourish (cosmetic; the gun is usable at its data deploy time) | screenshot |
| P3 | A guided walk | "Tour" on the Play tab: waypoints through the range with prompts (move, sprint, slide, jump, climb, mantle, the practice wall, a superglide, shoot, swap, reload, heal, an ability) | e2e: the tour completes |
| P4 | Toggle ADS, toggle crouch | Settings | e2e |
| P5 | Per-optic ADS sensitivity | a multiplier per optic zoom (1x, 2x, 3x, 4x, 6x, 8x, 10x), like Apex's | verify |
| P6 | Advanced look controls for the pad | yaw and pitch speed, extra yaw with ramp-up time and delay | verify |
| P7 | Pad button rebinding | the Controls tab gets a controller column | e2e |

### 11N. Close the phase

| id | item | how | verified by |
|---|---|---|---|
| Z1 | Bug hunt | two independent read-only reviews of everything this phase touched; each finding re-read against the code before it is fixed | the findings table in the results doc |
| Z2 | Tests | `check`, `verify`, `movesim`, `e2e`, `rules`, `build:beta`, `deploy:server -- dry` | PASS lines in the results doc |
| Z3 | Docs | README (modes, keys, the abilities, the killcam, the recap, the BR, the tools), DEPLOY_GUIDE, SERVER_GUIDE, NEXT_STEPS, GAP_ANALYSIS, FIDELITY | the files |
| Z4 | Results doc | `docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md` | the file |
| Z5 | Deploy | `npm run deploy` (Pages) and `npm run live` | LIVE CHECK PASS |
| Z6 | Still open | what is not done, and why, ranked | the results doc |
