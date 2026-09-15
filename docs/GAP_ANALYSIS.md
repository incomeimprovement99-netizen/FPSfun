# Gap analysis: B00G Range against Apex Legends (Season 30, September 2026) and the other shooters

Mechanics and numbers only, per PROJECT_RULES.md; nothing here proposes copying art, audio, code or branding. Effort is one person's working time. "(unverified)" marks anything not confirmed from a source.

**Updated after Phase 11 (2026-09-15).** Rows marked ✅ were closed in Phase 11 (`docs/PHASE_11_ABILITIES_KILLCAM_AND_THE_AAA_BATCH.md`, `docs/DEVELOPMENT_ROADMAP.md` milestones 12 to 23); the ranked list in section 5 is new. The summary below is the one written before the phase, kept for the record; section 5 says what is left.

## 1. Summary (before Phase 11)

What we have is faithful where it counts for a range: the movement model is the engine's (speed bands, frictionless air, the slide gate, lurch, climb zones, the one-frame superglide, ziplines, fall stun), verified against the Apex Movement Wiki; 27 guns fire from the reference data (damage zones, fire rate, mags per level, reload, ADS, spread, the full cold and hot recoil spring, projectile speed and drop, pellets) with mags, barrels, stocks, lasers and ten optics; dummies have zones, shield tiers, damage numbers and a knock-time readout; the courses, the 1v1 by code, bots, loadouts, stats and controller aim assist are done. The three biggest gaps: (1) guns that are not a plain trigger (HAVOC charge-up, Devotion spin-up, L-STAR overheat, select fire; the Nemesis and Bocek are missing) and Apex's ammo economy (reserve stacks, the Season 30 energy regen), which is where TTK practice stops being honest; (2) the range's own tooling, where Apex's dummies strafe, crouch, randomise and shoot back, and Valorant's bot drills set the bar; (3) what makes a fight a match rather than a duel: healing, footsteps, animated opponents, and any mode above three players.

## 2. Areas

### Movement

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Sprint 260, walk 173.5, crouch 80 hu/s, three accel bands, Quake air, slide 400 cap with the 350 / 0.24 s gate, lurch 0.2 to 0.4 s, wallbounce, climb zones, mantle, zip superjump, fall stun | All of it, checked by `npm run movesim` | None | 0 | - |
| Mantle Boost (Season 27): the superglide as an official input with a timing cue on the reticle (https://pley.gg/apex-legends/apex-legends-season-27-patch-notes/) | ✅ The superglide with the feed's reason on a miss, the cue on the crosshair in the mantle's last 0.15 s (a setting), and the trainer's timing bar | The official wider window itself is not published | - | - |
| Legend passives: Ash dash, Sparrow double jump, Axle slide boost (3 s in S30) (https://pley.gg/apex-legends/movement-tech-2026/) | One movement set for everyone | Out of scope by design | 1 day each | Low |
| Launch pads, jump towers, the skydive | ✅ Ziplines, ladders, launch pads on the BR's roads, jump towers at its outer places, a steered drop | A true skydive glide with its speeds | 2 days | Low |
| Wall running: Respawn "experimenting", not shipped | None | None today | - | Low |

### Shooting and weapons

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| 29 guns on the current list, R-99, Devotion and Kraber care-package only (https://apexlegends.wiki.gg/wiki/Weapon) | ✅ All 29 (the Nemesis and the Bocek added), and the care package carries the Kraber, the 30-30 and the L-STAR per Season 30 | None | - | - |
| HAVOC charge-up, Devotion spin-up, L-STAR overheat, Charge Rifle beam, Sentinel charge, 30-30 ADS charge 0.25 s in S30 (https://www.ea.com/games/apex-legends/apex-legends/news/marked-patch-notes) | ✅ All of them, from `src/config/weapon-mechanics.json`; the Peacekeeper's choke and the Nemesis's burst charge too | The Sentinel's amped shot (a cell) | 0.5 day | Low |
| Hop-ups: Selectfire (HAVOC, Prowler, Charge Rifle), Hammerpoint, Skullpiercer, Accelerator, Gun Shield Generator, Graffiti Mod (https://apexlegends.wiki.gg/wiki/Hop-Up); S30 adds Executioner, Shattercaps, Redline (https://allthings.how/apex-legends-season-30-every-weapon-change-in-the-marked-update/) | ✅ A hop-up slot (L) with the turbocharger, head rounds, hollow points, shield rounds, the choke, double tap and select fire; fire modes on B | The S30 three (Executioner, Shattercaps, Redline), the Gun Shield Generator | 0.5 day each | Low |
| Corrupted attachments: five, one per gun, a bonus and a penalty each (S30 notes) | None | A new attachment tier | 1 day | Low |
| Ammo stacks: light 60, heavy 60, energy 54, sniper 28, shotgun 20 (https://apexlegends.wiki.gg/wiki/Ammo); energy guns regenerate a magazine every 18 s from a 2 to 4 mag stockpile (S30 notes) | ✅ Counted in a match (and in the range if you like): stacks by type, the energy stockpiles and their regen | None | - | - |
| Helmets, Evo shields that level with damage | ✅ Season 30's helmets (100 and 125 armour, the gold one doubling the small heals; no headshot cut since S24) and a shield core that levels with EVO in the BR | EVO from damage taken and from knocks as well as damage dealt | 0.5 day | Low |
| Frag, arc star, thermite | ✅ All three with Season 30's numbers, an arc preview, a kit per life, BR loot | Bots do not throw them | 1 day | Med |
| Weapon inspect | ✅ Hold reload with a full magazine; a first-draw twirl for a new gun | None | - | - |

### Range and practice tooling

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Dummies that strafe, change speed, crouch, randomise, shoot back ("Full Combat"), shield and helmet levels (https://apexlegends.wiki.gg/wiki/Firing_Range, https://www.dualshockers.com/apex-legends-customize-firing-range/) | ✅ Stand, strafe, strafe and crouch, random; three speeds; shoot back at a bot difficulty with your own shield and health in the range | Helmets on dummies | 0.5 day | Low |
| Live overlay: shots, damage, headshots, kills, accuracy, manual reset | ✅ The overlay, and per-gun session numbers on the Stats tab | None | - | - |
| Targets coloured by hit zone | ✅ The hit zone flashes gold, white or blue | None | - | - |
| Agility Course, Tech Tunnel, Duel Pit | Two timed courses with splits, ghosts, ranks; the practice wall with its recipe | Ours goes further | 0 | - |
| Every weapon, attachment, grenade and heal item; all legends; friendly-fire toggle | ✅ Every gun, attachment, hop-up, grenade and heal, endless in the range | Legends (out of scope) | - | - |
| No recoil trainer in Apex; Valorant has bots at 5/10/20/30/50 m, Blinking Bots (30 at random), Eliminate 50/100 (https://valorant.fandom.com/wiki/Range); CS2 players learn sprays on a wall | ✅ The spray wall (your hits beside the pattern) and the flick drill (30 figures, a board) | Fixed-distance bot lanes | 0.5 day | Low |
| Tech trainer (none in Apex) | ✅ The superglide trainer's bar over ten tries, and a guided tour of every move | None | - | - |

### Match and multiplayer systems

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| BR: 20 squads of 3, six ring rounds, loot, Evo, respawn beacons; Duos 15 x 2; Bot Royale (https://apexlegends.wiki.gg/wiki/Game_mode) | ✅ A BR on Outskirts against up to 11 bots, alone or a squad of up to three: the six-round ring, floor loot, death boxes, care packages, EVO, downs and revives, banners and beacons, pings, jump towers, launch pads | Other human squads (PvP) need the authoritative server; the S29 deathbox respawn | 2 to 4 weeks (server) | High |
| Mixtape: TDM 6v6 first to 40; Control 9v9, three zones, 1000 points at 1/s per zone, 30 min, five rotating loadouts, 150-point bonus zone; Gun Run 4 x 3, 25 weapons ending on a throwing knife (100 body / 300 head), 10 min, no downed state (https://apexlegends.wiki.gg/wiki/Control, https://apexlegends.wiki.gg/wiki/Gun_Run) | ✅ Gun Run (free-for-all, 10 or 29 guns, the knife, a melee death costs a level) and TDM (teams of four with bots, first to 30), alone or with friends and bots; Crown as a round mode | Control (needs more players than the arena holds) | 3 days | Med |
| Arenas (S9 to S15, removed 14 Feb 2023, LTM in S25): rounds, a buy phase, a four-round ring at 10/15/20/25 damage (https://www.dexerto.com/apex-legends/arenas-axed-from-apex-legends-and-replaced-by-tdm-to-start-season-16-2050279/, https://apexlegends.wiki.gg/wiki/The_Ring) | Our 1v1 is Arenas-shaped: rounds, a closing circle | A buy phase with a budget | 1 day | Med |
| Healing: syringe 25 in 4 s, med kit full in 8 s, cell 25 in 2.5 s, battery full in 5 s, phoenix kit 10 s (https://apexlegends.wiki.gg/wiki/Consumable) | ✅ All five, the quick heal and the wheel, the 40% slow, cancelled by a sprint, a shot, an aim or a swap (damage does not cancel it, as in Apex) | None | - | - |
| Knockdown 90 s bleedout, 5 s revive (https://apexlegends.fandom.com/wiki/Health) | ✅ In a BR squad: down with a squad mate up, 90/60/30/15 s bleed-outs, a 5 s revive to 20 health | Knockdown shields | 1 day | Low |
| Ping wheel: Enemy, Looting, Attack, Defend, Watching, Enemy Activity, Avoid, Enemy Audio (https://apexlegends.fandom.com/wiki/Ping) | ✅ A context ping (an enemy, an item, a place) on the middle mouse button, in the world and on the maps | The wheel of eight kinds | 0.5 day | Low |
| Ranked, banners, champion squad | Kill feed, nameplates, scoreboard, summary, boards that trust the client | Ranked needs an authoritative server (NEXT_STEPS 9) | 2 to 4 weeks | Med |

### Feedback: HUD, audio, animation

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Footsteps by surface, slide, climb and zip sounds, distance-filtered gunfire; S22 footstep reliability work (https://gamerant.com/apex-legends-season-22-footstep-audio-changes-explained/) | ✅ Synthesised and positional (HRTF): footsteps by surface for everyone, the slide scrape, the climb, the zip whine, gunfire by class dulled and delayed with distance, rounds cracking past | Recorded samples would sound richer | 2 days | Low |
| Hit sounds by shield tier, knock stingers, low-health heartbeat | ✅ All three, and the ring's tick and horn, the countdown, the win and loss stingers | None | - | - |
| Damage numbers, hit markers, health and shield bars | The same | Parity | 0 | - |
| Minimap, compass, the ring on the map | Minimap and compass (`hud.ts`) | Ring comes with the BR | With Section 4 | - |
| Animated third-person legends: run, slide, climb, zip, crawl | ✅ Jointed figures that strafe and backpedal with the body on the aim, aim, kick, reload, swap, heal, flinch, lean, crawl when down; a motion-captured mannequin as a setting | Rifle mocap clips (the free library is pistol clips) | 2 days | Med |
| Sprint shake Normal/Minimal, ring tint, low-health desaturation | ✅ All of them | None | - | - |

### Controller

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Sensitivity 1 to 8, separate ADS, Classic and Linear, deadzone, auto sprint | The same, and rumble | Parity | 0 | - |
| Aim assist 0.4 rotational on PC plus slowdown; zone and slowdown shapes unpublished | 0.4 rotational, 0.8 / 0.6 slowdown in a chest sphere, off through walls and without input | Zone shape is ours; a playtest decides | 0.5 day | Med |
| Advanced Look Controls: per-axis speed, extra yaw, ramp-up, per-optic ADS scalars | ✅ Yaw and pitch speeds for hip and ADS, extra yaw and pitch at the edge with a ramp-up time and delay; per-optic ADS multipliers (mouse and pad) | Per-optic ADS on the advanced look's own scale | 0.5 day | Low |
| Button layouts, hold or toggle crouch and ADS | ✅ Every pad button rebindable on the Controls tab (Start stays the menu); hold or toggle ADS and crouch | Named layouts (Default, Bumper Jumper, Evolved) | 0.5 day | Low |
| No tap-strafe on a pad | Same limit | Parity | 0 | - |

## 3. From other shooters, worth taking

1. Valorant's bot drills: bots at fixed distances, Blinking Bots with a difficulty dial, Eliminate 50 with a timer. Our bots and pop-ups are most of it; it makes the range a warm-up routine.
2. CS2's spray wall: fire a mag and see your hits against the pattern from `data/weapons.json`.
3. Gun Run as a 1v1 and bot mode: every gun in order, one kill each, respawns, 10 minutes. The fastest way to learn all 27 guns.
4. CoD's gunsmith idea: save the attachment set with the loadout, not only the two guns. Slide cancel and tac sprint would break the Apex model; tac sprint is stamina-based in MWIII and BO7, exact seconds vary by title (https://callofduty.fandom.com/wiki/Tactical_Sprint) (unverified).
5. Titanfall 2's wallrun (1.75 s, 3.5 s with the kit) and double jump (https://titanfall.fandom.com/wiki/Wall-Running): only as a separate arena with its own rules (NEXT_STEPS 5).
6. Overwatch's practice range: bots that stand, shoot and move, and a hero switch on the spot (https://overwatch.fandom.com/wiki/Practice_Range). The shooting bots are the part we lack.
7. Halo Infinite: shield recharge after a delay that sprint does not reset (https://xboxera.com/2021/08/06/halo-infinite-did-343-accomplish-the-impossible/). A cheap stand-in for heal items in a friends' mode.
8. Fortnite's storm: nine phases, 1 to 10 damage per second, first wait 3:20 (https://gaming-tools.com/fortnite/the-storm/). Apex's six rounds are the ones to copy; Fortnite shows a faster early ring suits a small map.
9. The Finals: destruction is out of reach for box collision; its light/medium/heavy weights are one config knob if a friends' mode wants asymmetry (unverified numbers).

## 4. A BR mode against bots

Minimum viable version, in build order:

1. Map: one middle POI and four outer POIs on a 400 m square from the range's box system, three or four buildings each with mantle ledges and a zipline, routes proven in `tools/movesim.ts`. 2 to 3 days.
2. Players: you plus 11 bots, solos (squads need revive, ping and downed states). The `bots.ts` brain gets a loop: go to the ring, loot, fight what it sees. 2 days.
3. Drop-in: a spawn-at-POI menu in an hour; a fixed-path skydive is 2 days and can wait.
4. Ring: Apex's numbers, per round (wait, close, damage per tick, a tick every 1.5 s): 1: 1:15, 4:20, 3; 2: 2:00, 1:05, 4; 3: 1:30, 0:45, 10; 4: 1:30, 0:40, 15; 5: 1:15, 0:50, 20; 6: 1:00, 2:00, 25; diameters about 1200 / 650 / 400 / 200 / 100 m on Apex's maps (https://apexlegends.wiki.gg/wiki/The_Ring). On 400 m, halve the waits and start at 300 m. 1 day, with the ring on the minimap and a damage tint.
5. Loadouts: fixed first (from the Loadouts tab, blue shield, two batteries, four cells). Floor loot with the ammo stacks from Section 2 is the second pass, 2 days.
6. Healing: the five items with Apex's times, interrupted by damage (unverified for current Apex). 1 day.
7. Placement: place 1 to 12 and kills to the Stats tab and the boards. 0.5 day.

Leave out first: squads, revive, Evo, care packages, beacons, legends, the skydive, loot. About 10 working days, all in the browser, no server needed.

## 5. Ranked next steps (after Phase 11)

All twelve of the ranked steps written before Phase 11 are done (the list is in the git history of this file). What is left, in order:

1. **The authoritative game server** (2 to 4 weeks): the one thing between us and PvP battle royale, lobbies of more than three humans, 2v2, trusted hits and ranked boards. The movement and projectile code can run on it as it is. The owner's call is "down the road".
2. **Get the game's own server live** (an hour of the owner's time, then `npm run deploy:server`): the broker, the relay and the online boards are built and tested and waiting on a VM (`docs/SERVER_GUIDE.md`).
3. **Rifle animation for the mannequin** (2 days): a CC0 rifle clip set if one can be found, or rifle poses keyframed over the mannequin's skeleton; then the mannequin can be the default.
4. **Controller defaults for the heal, a grenade and the ping** (0.5 day): Apex puts them on hold combinations; ours are unbound on a pad until the player binds them.
5. **Bots that throw grenades and use cover** (2 days): today they strafe and heal; a frag at a camper is the next step in making them feel like players.
6. **The battle royale's last Apex pieces** (2 days): the Season 29 deathbox respawn, knockdown shields, EVO from damage taken and knocks, the S30 hop-ups (Executioner, Shattercaps, Redline).
7. **Control** (3 days) if the arena grows or the server arrives: three zones, 1000 points.
8. **Accounts** (2 to 3 days, needs the owner to pick a provider): the profile and boards follow you between devices.
9. **Smaller downloads** (1 day): KTX2 textures would cut most of the 29 MB of props.
10. **Recorded sounds** (2 days): CC0 samples layered over the synthesis for a richer mix.
