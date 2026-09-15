# Gap analysis: B00G Range against Apex Legends (Season 30, September 2026) and the other shooters

Mechanics and numbers only, per PROJECT_RULES.md; nothing here proposes copying art, audio, code or branding. Effort is one person's working time. "(unverified)" marks anything not confirmed from a source.

## 1. Summary

What we have is faithful where it counts for a range: the movement model is the engine's (speed bands, frictionless air, the slide gate, lurch, climb zones, the one-frame superglide, ziplines, fall stun), verified against the Apex Movement Wiki; 27 guns fire from the reference data (damage zones, fire rate, mags per level, reload, ADS, spread, the full cold and hot recoil spring, projectile speed and drop, pellets) with mags, barrels, stocks, lasers and ten optics; dummies have zones, shield tiers, damage numbers and a knock-time readout; the courses, the 1v1 by code, bots, loadouts, stats and controller aim assist are done. The three biggest gaps: (1) guns that are not a plain trigger (HAVOC charge-up, Devotion spin-up, L-STAR overheat, select fire; the Nemesis and Bocek are missing) and Apex's ammo economy (reserve stacks, the Season 30 energy regen), which is where TTK practice stops being honest; (2) the range's own tooling, where Apex's dummies strafe, crouch, randomise and shoot back, and Valorant's bot drills set the bar; (3) what makes a fight a match rather than a duel: healing, footsteps, animated opponents, and any mode above three players.

## 2. Areas

### Movement

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Sprint 260, walk 173.5, crouch 80 hu/s, three accel bands, Quake air, slide 400 cap with the 350 / 0.24 s gate, lurch 0.2 to 0.4 s, wallbounce, climb zones, mantle, zip superjump, fall stun | All of it, checked by `npm run movesim` | None | 0 | - |
| Mantle Boost (Season 27): the superglide as an official input with a timing cue on the reticle (https://pley.gg/apex-legends/apex-legends-season-27-patch-notes/) | The one-frame community superglide, a feed line on a miss | Wider window plus a cue | 0.5 day | High for the course |
| Legend passives: Ash dash, Sparrow double jump, Axle slide boost (3 s in S30) (https://pley.gg/apex-legends/movement-tech-2026/) | One movement set for everyone | Out of scope by design | 1 day each | Low |
| Launch pads, jump towers, the skydive | Ziplines, ladders | No pad or skydive physics | 1 day pads, 2 days skydive | Med (BR mode) |
| Wall running: Respawn "experimenting", not shipped | None | None today | - | Low |

### Shooting and weapons

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| 29 guns on the current list, R-99, Devotion and Kraber care-package only (https://apexlegends.wiki.gg/wiki/Weapon) | 27 in `data/weapons.json` (README says 28; `names.ts` has a `g17` codename with no data row) | Nemesis Burst AR and Bocek Bow missing | 1 day Nemesis, 2 days Bocek | Med |
| HAVOC charge-up, Devotion spin-up, L-STAR overheat, Charge Rifle beam, Sentinel charge, 30-30 ADS charge 0.25 s in S30 (https://www.ea.com/games/apex-legends/apex-legends/news/marked-patch-notes) | Plain trigger for all; the data carries `charge_time` but nothing in `src/` reads it (grep) | The energy family fires wrong | 2 days | High for TTK |
| Hop-ups: Selectfire (HAVOC, Prowler, Charge Rifle), Hammerpoint, Skullpiercer, Accelerator, Gun Shield Generator, Graffiti Mod (https://apexlegends.wiki.gg/wiki/Hop-Up); S30 adds Executioner, Shattercaps, Redline (https://allthings.how/apex-legends-season-30-every-weapon-change-in-the-marked-update/) | Mags, barrels, stocks, lasers, optics | No hop-up slot; Selectfire alone turns the Prowler auto | 1 day slot, 0.5 day each | Med (Selectfire high) |
| Corrupted attachments: five, one per gun, a bonus and a penalty each (S30 notes) | None | A new attachment tier | 1 day | Low |
| Ammo stacks: light 60, heavy 60, energy 54, sniper 28, shotgun 20 (https://apexlegends.wiki.gg/wiki/Ammo); energy guns regenerate a magazine every 18 s from a 2 to 4 mag stockpile (S30 notes) | Unlimited ammo; the HUD reserve is never counted | The 1v1 economy | 1 day reserve, 1 day regen | High for 1v1 |
| Helmets, Evo shields that level with damage | Tiers 50/75/100/125, no helmet | Headshot TTK on the dummy is too high | 0.5 day helmet, 2 days Evo | Med |
| Frag, arc star, thermite | None | No throwables | 2 days | Med for 1v1 |
| Weapon inspect | None (NEXT_STEPS 12) | Cosmetic | 1 day | Low |

### Range and practice tooling

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Dummies that strafe, change speed, crouch, randomise, shoot back ("Full Combat"), shield and helmet levels (https://apexlegends.wiki.gg/wiki/Firing_Range, https://www.dualshockers.com/apex-legends-customize-firing-range/) | Static dummies with tiers, moving rails, pop-ups; bots only in the arena | No dummy behaviour panel | 2 days (reuse `bots.ts`) | High |
| Live overlay: shots, damage, headshots, kills, accuracy, manual reset | Shots, hits, headshots, damage, knocks, last TTK, accuracy | No per-gun history, no reset button | 0.5 day | Med |
| Targets coloured by hit zone | Damage numbers at the hit point | Small | 0.5 day | Low |
| Agility Course, Tech Tunnel, Duel Pit | Two timed courses with splits, ghosts, ranks; the practice wall with its recipe | Ours goes further | 0 | - |
| Every weapon, attachment, grenade and heal item; all legends; friendly-fire toggle | Loadouts with two guns; attachments by key | No item pickup, no heals to practise | With Section 4 | Med |
| No recoil trainer in Apex; Valorant has bots at 5/10/20/30/50 m, Blinking Bots (30 at random), Eliminate 50/100 (https://valorant.fandom.com/wiki/Range); CS2 players learn sprays on a wall | The pattern is in the data, never drawn; no timed drill | A spray wall (your trace against the pattern) and a scored flick drill | 1 day each | High |
| Tech trainer (none in Apex) | Feed lines with the reason for a miss | A superglide timing bar over ten tries (NEXT_STEPS 13) | 1 day | High |

### Match and multiplayer systems

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| BR: 20 squads of 3, six ring rounds, loot, Evo, respawn beacons; Duos 15 x 2; Bot Royale (https://apexlegends.wiki.gg/wiki/Game_mode) | 1v1, 1v1v1, bots, first to 3 with a 10 s circle hold | No BR; peer to peer caps us at 3 humans | Section 4 | High (vs bots) |
| Mixtape: TDM 6v6 first to 40; Control 9v9, three zones, 1000 points at 1/s per zone, 30 min, five rotating loadouts, 150-point bonus zone; Gun Run 4 x 3, 25 weapons ending on a throwing knife (100 body / 300 head), 10 min, no downed state (https://apexlegends.wiki.gg/wiki/Control, https://apexlegends.wiki.gg/wiki/Gun_Run) | Nothing with respawns | Gun Run against a friend or bots is a natural range mode | 2 days Gun Run, 1 day TDM vs bots | High |
| Arenas (S9 to S15, removed 14 Feb 2023, LTM in S25): rounds, a buy phase, a four-round ring at 10/15/20/25 damage (https://www.dexerto.com/apex-legends/arenas-axed-from-apex-legends-and-replaced-by-tdm-to-start-season-16-2050279/, https://apexlegends.wiki.gg/wiki/The_Ring) | Our 1v1 is Arenas-shaped: rounds, a closing circle | A buy phase with a budget | 1 day | Med |
| Healing: syringe 25 in 4 s, med kit full in 8 s, cell 25 in 2.5 s, battery full in 5 s, phoenix kit 10 s (https://apexlegends.wiki.gg/wiki/Consumable) | None; a round resets you | Heal or push is the 1v1's mind game | 1 day | High |
| Knockdown 90 s bleedout, 5 s revive (https://apexlegends.fandom.com/wiki/Health) | Knocked means out until the round ends | Only matters with teams | 2 days | Low until 2v2 |
| Ping wheel: Enemy, Looting, Attack, Defend, Watching, Enemy Activity, Avoid, Enemy Audio (https://apexlegends.fandom.com/wiki/Ping) | Latency on the HUD, nothing else | Only needed for teams | 1 day | Low until 2v2 |
| Ranked, banners, champion squad | Kill feed, nameplates, scoreboard, summary, boards that trust the client | Ranked needs an authoritative server (NEXT_STEPS 9) | 2 to 4 weeks | Med |

### Feedback: HUD, audio, animation

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Footsteps by surface, slide, climb and zip sounds, distance-filtered gunfire; S22 footstep reliability work (https://gamerant.com/apex-legends-season-22-footstep-audio-changes-explained/) | Synthesised shot, hit and headshot ticks, shield break, reload, dry click | No footsteps at all | 2 days with CC0 sets (NEXT_STEPS 4) | High |
| Hit sounds by shield tier, knock stingers, low-health heartbeat | Hit tick, shield break | Tier-pitched hit sounds | 0.5 day | Med |
| Damage numbers, hit markers, health and shield bars | The same | Parity | 0 | - |
| Minimap, compass, the ring on the map | Minimap and compass (`hud.ts`) | Ring comes with the BR | With Section 4 | - |
| Animated third-person legends: run, slide, climb, zip, crawl | Rigid figures that slide and crouch | Reading an opponent's movement is half of Apex | 2 to 3 days with a CC0 rig (NEXT_STEPS 3) | High for 1v1 |
| Sprint shake Normal/Minimal, ring tint, low-health desaturation | Sprint shake, fall-stun dip | Ring tint with the BR | With Section 4 | - |

### Controller

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Sensitivity 1 to 8, separate ADS, Classic and Linear, deadzone, auto sprint | The same, and rumble | Parity | 0 | - |
| Aim assist 0.4 rotational on PC plus slowdown; zone and slowdown shapes unpublished | 0.4 rotational, 0.8 / 0.6 slowdown in a chest sphere, off through walls and without input | Zone shape is ours; a playtest decides | 0.5 day | Med |
| Advanced Look Controls: per-axis speed, extra yaw, ramp-up, per-optic ADS scalars | One sensitivity, one ADS, one curve | What serious pad players use | 1 day | Med |
| Button layouts, hold or toggle crouch and ADS | Fixed layout; rebinding is keyboard only | No pad rebinding, no toggle ADS | 1 day | Med |
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

## 5. Ranked next steps

1. Charge-up, spin-up, overheat and select fire (2 days). The data is there; the energy family fires wrong.
2. Footsteps and movement sounds from CC0 sets (2 days). The 1v1's biggest information gap.
3. Range dummies that strafe, crouch and shoot back, with a panel (2 days). Apex has had it since Season 16.
4. Spray wall and a scored flick drill (2 days). Makes the range a routine.
5. Healing items in the 1v1 (1 day). Heal or push is the fight.
6. Mantle Boost cue and the superglide trainer bar (1.5 days). The hardest gate becomes learnable.
7. Reserve ammo and energy regen (2 days). Needed by 5, 8 and 11.
8. Gun Run against a friend or bots (2 days). All 27 guns, one kill each.
9. Nemesis and Bocek (3 days). Roster parity.
10. Animated third-person figures (3 days). Reading an opponent's slide and climb.
11. BR against 11 bots (10 days). Section 4.
12. Helmets and a hop-up slot with Selectfire, Hammerpoint, Skullpiercer (2 days). The last TTK details.

After these the next wall is the authoritative server (2 to 4 weeks) for more than three humans, trusted ranked boards and Control-sized modes, as README and NEXT_STEPS say.
