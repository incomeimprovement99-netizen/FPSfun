# Research for Phase 12: numbers and sources

Researched 2026-09-15. Mechanics and numbers only (PROJECT_RULES.md): nothing here proposes copying art, audio, code or branding. Current Apex season: **Season 30 "Marked"** (patch 2026-08-03/04; midseason patch 2026-09-14, Split 2 from 2026-09-15). Before it: S29 "Overclocked" (2026-05-04; Split 2 patch 2026-06-23), S28 "Breach" (2026-02-09/10).

"(unverified)" means I could not confirm the value from a source I read. Where a guide and the official notes disagree, the EA notes win and the conflict is noted. Each number says which season it is from.

Short names for the sources used most:

- **Marked** = https://www.ea.com/games/apex-legends/apex-legends/news/marked-patch-notes (S30, 2026-08-04)
- **Marked-mid** = https://www.ea.com/games/apex-legends/apex-legends/news/marked-midseason-patch-notes (S30, 2026-09-14)
- **Overclocked** = https://www.ea.com/en/games/apex-legends/apex-legends/news/overclocked-patch-notes (S29, 2026-05-04)
- **OC-mid** = https://www.ea.com/en/games/apex-legends/apex-legends/news/overclocked-midseason-patch-notes (S29 Split 2, 2026-06-23)
- **OC-design** = https://www.ea.com/en/games/apex-legends/apex-legends/news/29-0-designers-notes (S29 designer's notes)
- **Breach** = https://www.ea.com/games/apex-legends/apex-legends/news/breach-patch-notes (S28, 2026-02-09)
- **EA-controls** = https://help.ea.com/en/articles/apex-legends/pc-and-controller-settings/ ("updated 1 month ago", read 2026-09-15)
- **EA-able** = https://www.ea.com/able/resources/apex-legends/ps4/features (EA accessibility page)
- **wiki/X** = https://apexlegends.wiki.gg/wiki/X (raw pages read 2026-09-15)
- **HS/X** = https://hyperscape.fandom.com/wiki/X (Hyper Scape wiki, read through its API; the patch-notes pages quote Ubisoft's notes and link them)
- **CS2-bots** = https://raw.githubusercontent.com/SteamDatabase/GameTracking-CS2/master/game/csgo/pak01_dir/botprofile.db (CS2's shipped bot profile file, tracked by SteamDatabase)
- **TF2-src** = https://github.com/ValveSoftware/source-sdk-2013/tree/master/src/game/server/tf/bot (Valve's published TF2 bot source)

---

## 1. Apex controller defaults (the "Default" preset)

### 1.1 The Default layout (console, S30)

From **EA-controls** (the official table, current), cross-checked with **wiki/Controls** and https://qnnit.com/apex-legends-ps4-controls/.

| Action | PlayStation | Xbox | Tap / hold / combo |
|---|---|---|---|
| Fire | R2 | RT | |
| Aim down sights | L2 | LT | Hold by default; Toggle is an option (EA-able) |
| Jump | Cross | A | Also Mantle Boost (S27) and Ash's air dash |
| Crouch / slide | Circle | B | Toggle by default; Hold is an option (EA-able) |
| Sprint | L3 (press and hold) | L3 | wiki lists it as toggle; auto sprint is a setting |
| Melee | R3 | R3 | |
| Interact / pick up | Square | X | Same button as reload |
| Reload | Square | X | Three behaviours: "Tap to Use and Reload", Hold to Use / Tap to Reload, Hold to Reload / Tap to Use (EA-able). Which is default: (unverified) |
| Cycle weapon | Triangle | Y | **Tap** |
| Holster | Triangle | Y | **Hold** |
| Tactical | L1 | LB | |
| Ultimate | L1 + R1 | LB + RB | **Combo**, both bumpers together |
| Ping | R1 | RB | **Tap**: context ping |
| Enemy ping | R1 twice | RB twice | **Double-tap** |
| Ping wheel | R1 | RB | **Hold** (8 options in the wheel, https://progameguides.com/apex-legends/apex-legends-ping-system-guide/ via search) |
| Use health item (quick heal) | D-pad up | D-pad up | **Tap** |
| Health wheel | D-pad up | D-pad up | **Hold** |
| Equip grenade (ordnance) | D-pad right | D-pad right | **Tap**; hold opens the grenade wheel (wiki/Controls). Tapping again to cycle types: (unverified) |
| Toggle fire mode | D-pad left | D-pad left | **Tap** (qnnit) |
| Inspect weapon | hold D-pad right (EA's PS row) / hold D-pad left (EA's Xbox row) | hold D-pad left | EA's own table disagrees between platforms; qnnit and the wiki say hold D-pad left. Holding left also equips the survival slot item in some seasons (search snippet, unverified) |
| Extra character action | D-pad down | D-pad down | Tap |
| Map | Touch pad | View | |
| Inventory | Options | Menu | |

**PC defaults (EA-controls, wiki/Controls):** fire LMB, ADS RMB, jump Space, crouch C (toggle) or Left Ctrl (hold), sprint Left Shift (hold), interact E, reload R, melee V, tactical Q, ultimate Z, grenade G (hold for the wheel, wiki), cycle weapon mouse wheel, holster 3, inspect N, quick heal 4 / health wheel hold 4, extra character action H, ping middle mouse (hold for the wheel; EA's PC row wrongly says "R1"), map M, inventory Tab.

**Hold combinations in one place:** hold Triangle/Y = holster; hold R1/RB = ping wheel; double-tap R1/RB = enemy ping; L1+R1 / LB+RB = ultimate; hold D-pad up = health wheel; hold D-pad right = grenade wheel; hold D-pad left = inspect; hold Square/X = reload-or-use depending on the Interact setting.

### 1.2 Presets

EA lists six presets plus Customized (**EA-controls**, **EA-able**). Every button can also be rebound ("create your own", EA-controls).

| Preset | What moves (from Default) | Source |
|---|---|---|
| Default | "the recommended controller layout" | EA-able |
| Bumper Jumper | jump to LB; tactical to A / Cross | EA-able; https://www.gamersdecide.com/articles/apex-legends-best-button-layouts |
| Button Puncher | crouch to R3; melee to B / Circle | EA-able; gamersdecide |
| Evolved | jump to LB and crouch to R3 | EA-able. Where tactical and melee go: (unverified) |
| Grenadier | grenades to RB; ping to D-pad up | EA-able. Where the heal goes: (unverified) |
| Ninja | jump to LB, crouch to RB; tactical to Circle, ping to Cross (PS); pairs with Hold to Crouch | EA-able; gamersdecide |

Stick layouts: Default, Southpaw, Legacy, Legacy Southpaw (EA-able). Trigger deadzones: five levels (EA-able).

**For reference:** Hyper Scape shipped five named presets on 2020-08-11: No Click, Shoulder Jump, Deploy Master, Hack Master, Button Ping (**HS/Patch_Notes/August_11th,_2020**).

**What it means for us.** Our pad leaves the heal, a grenade and the ping unbound. Apex's defaults would be: D-pad up tap for the quick heal and hold for the wheel; D-pad right for a grenade (hold for a wheel); RB tap to ping, double-tap for an enemy ping, hold for the wheel; D-pad left for fire mode (our keyboard B) and hold for inspect. **Conflict to resolve:** our ability card uses D-pad left and right to pick JOLT or TRIAGE. It could move to the same buttons while the card is open, since the card only shows at a countdown or on landing. JOLT on LB already matches Apex's tactical.

---

## 2. Apex battle royale systems we lack (S28 to S30)

### 2.1 Deathbox Respawn (S29 onward, still in S30)

| Rule | Value | Source |
|---|---|---|
| What | A long press-and-hold on a dead squad mate's death box respawns them there | OC-design; Overclocked |
| Channel time | **7 s** | Overclocked; wiki/Death_Box |
| Who | Any living squad mate at the box (the patch says "respawn dead teammates directly from their Deathbox") | Overclocked |
| Warning | "High Risk": loud, with a **green beam into the sky** and a sound heard at a fair distance. S29 Split 2 made the in-progress sound louder with a larger radius for enemies | Overclocked; wiki/Death_Box; OC-mid |
| Line of sight | S30 mid fixed being able to "activate Respawn from Deathbox from behind a wall" | Marked-mid |
| Where they appear | On top of the box | wiki/Death_Box |
| Health on return | **about 20 HP**; the shield regenerates automatically (the box's shield core is refilled when the box drops) | wiki/Death_Box |
| Gear | Everything **still in the box** is equipped automatically; whatever was looted is gone. Locked hop-ups keep their points (fixed S30 mid) | Overclocked; wiki/Death_Box; Marked-mid |
| Lockout | Per player: each death **raises** the lockout before that player can be deathbox-respawned again; "stay alive to reset the timer" (a few minutes alive) | Overclocked; OC-design; wiki/Death_Box |
| Lockout seconds | **Not published** (unverified). No source I read gives the per-death values | searched EA notes, wiki, games.gg, pley.gg, dexerto |
| Cancelled by damage | (unverified). One guide says any damage cancels it (https://www.dtgre.com/2026/05/apex-season-29-deathbox-respawn-ranked-meta-beacon-vs-box-guide-2026.html); the same guide's claim that you respawn with a P2020 and Mozambique contradicts the EA notes, so the guide is not trusted |  |
| Beacons still exist | 5 s at a beacon, then the dropship. S29: the dropship **arrives sooner, hovers longer** and stays visible to the whole lobby for longer | wiki/Respawn_Beacon; Overclocked |

**For our BR (proposal, our numbers):** 7 s hold E at a squad mate's box, a green beam and a hum on everyone's screen within about 150 m, back at 20 HP with the box's shield core refilled, the box's remaining items put back on. A per-player lockout of 30 s, then 60 s, then 120 s (ours: Apex's are unpublished), reset after 3 minutes alive. Cancelled by moving out of 2.5 m or by using a gun, as our revive is.

### 2.2 Knockdown shields (in S30, now tied to the EVO level)

| Item | Value | Source |
|---|---|---|
| Status since S28 | **Removed from the loot pool**; "knockdown shield level is now tied to legend level" (Level 1 = White) | Breach (2026-02-09) |
| HP by level | L1 **200**, L2 **450**, L3 **750** | wiki/Knockdown_Shield |
| Gold (L4, Guardian Angel) | Removed from all modes 2024-11-26 | wiki/Knockdown_Shield |
| Use | While downed, hold fire to raise it; **front only**; crawl speed **-45%** while raised; once broken it stays broken until the next knock | wiki/Knockdown_Shield |
| Level thresholds | Presumably the same as the shield core (L2 at 450 EVO, L3 at 1,700 more): (unverified; the Breach notes only give "Level 1 = White") | Breach; wiki/Legend_Upgrade |

### 2.3 EVO: where it comes from (S30)

**Damage taken earns no EVO.** The gap analysis line "EVO from damage taken and from knocks" is half wrong: knocks, assists, finishers, revives and map objects earn it, and taking damage does not.

| Source | EVO | Who | Source / season |
|---|---|---|---|
| Damage dealt to players | **1 per point** | you | wiki/Legend_Upgrade (current April 2026) |
| Damage to NPCs (prowlers, spiders) | 0.25 per point | you | wiki/Legend_Upgrade |
| Knock | **150** | you | wiki/Legend_Upgrade |
| Knock assist | 100 (first knock only) | you | wiki/Legend_Upgrade |
| Underdog knock (enemy at a higher EVO level) | +100 | you | wiki/Legend_Upgrade |
| Finisher | 100 | you | wiki/Legend_Upgrade |
| Squad wipe | 100 | squad | wiki/Legend_Upgrade |
| Revive | **100 for the first 2 revives per team per game, then 25 less each** until 0 | squad | Breach (S28) |
| Banner recovery / respawn | 75 / 125 | squad | wiki/Legend_Upgrade |
| Small / large EVO cache | 150 / 300 | you | wiki/EVO_Cache |
| Full EVO cache | 500 / 1,800 / 3,800 by your level (always enough for the next level) | you | wiki/EVO_Cache |
| EVO Harvester | **350** each squad member; several squads can use one | squad | wiki/Evo_Harvester, wiki/Legend_Upgrade |
| Harvesters per match | 15 (wiki, last edited 2024-10-11); "~7 to ~10 per map" after 2025-08-26 (https://www.sportskeeda.com/esports/apex-legends-minor-update-august-26-2025-re-45-nerfs-evo-harvester-changes via search): conflicting, (unverified) | | |
| Care package loot / vault | 100 / 200 | squad | wiki/Legend_Upgrade |
| Accelerator hop-up (gold guns, S30) | **+30% EVO from damage**, and 15% ultimate charge on a knock | you | Marked |
| No gun in hand (S30 mid) | EVO earned unarmed now counts toward the first gun you equip (so guns carry their own progress) | | Marked-mid |
| Thresholds | Blue 75 at **450**, purple 100 at **1,700** more (2,150 total); red not earnable since S24 | | wiki/Shield_Core; wiki/Legend_Upgrade |

### 2.4 The three hop-ups (S29 to S30), and locked hop-ups

**Locked hop-ups** (since S26): the hop-up is already fitted to a compatible gun but locked; the gun earns **points** (from damage with it, upgrading it at an Arsenal, crafting, and general damage) and the hop-up unlocks on its own. Once unlocked it stays unlocked for whoever picks the gun up. **Gold and care-package guns spawn with it unlocked** (https://www.sportskeeda.com/esports/apex-legends-season-26-elite-weapons-locked-hop-ups via search). Rampart's passive: 50% faster locked hop-up progress (Marked).

| Hop-up | Guns | Effect | Numbers | Source |
|---|---|---|---|---|
| **Executioner** (added S29 Split 2, 2026-06-23) | **Peacekeeper, Mastiff** | Knocking an enemy with the gun gives shield regeneration | **50 shield over 5 s**. Unlock **375 points**, then **275** from 2026-09-14 | OC-mid (official: 5 s); Marked-mid. allthings.how says "over 10 seconds" (https://allthings.how/apex-legends-overclocked-split-2-patch-notes-season-29-mid-season-update/), which conflicts with the EA notes, so 5 s stands. It replaced Disruptor on the PK and Dual Shell on the Mastiff (OC-mid) |
| **Shattercaps** (on the 30-30 from S30) | **30-30 Repeater** (care package in S30) | **Hip fire** splits each round into a blast pattern | **7 pellets x 8 = 56**, head **x1.25**. The 30-30 does 51 (was 43), ADS charge 0.25 s (was 0.4), stockpile 50. Care-package gun, so already unlocked | Marked. Shattercaps was on the Bocek until May 2025 (wiki/Bocek_Compound_Bow) |
| **Redline** (added S29, still in S30) | **L-STAR EMG** (care package S29 and S30) | "Increased damage and projectile size when close to overheating" | **No published values** for the heat threshold, damage bonus or size (unverified). L-STAR 20 damage (S29, was 19), 600 RPM, 24/26/28/30 shots to overheat; S30 energy stockpile of 4 mags | Overclocked; https://patched.gg/games/apex-legends/overclocked-patch-notes; Marked |
| Accelerator (S30) | Every **gold** gun (fitted by default) | 15% ult on knock; +30% EVO from damage; damage-based ult charge removed | Unlock 150 (S26 value, unverified now) | Marked |
| Turbocharger | Devotion (unlock **500** in S30, was 425); Nemesis (**600**, S29 Split 2) | Spin-up / charge cut | | Marked; OC-mid |
| Graffiti Mod (S29 Split 2) | Moved to Flatline and Volt (off Longbow, Wingman, Mozambique) | | | OC-mid |

**For us (proposal, our numbers):** Redline could be +15% damage and x1.5 projectile radius above 75% heat, marked "ours" in the config until Respawn publishes values.

### 2.5 Other current BR systems (S30)

| System | S30 state | Source |
|---|---|---|
| **The ring** | No change in S28 to S30 notes. The wiki's table is from 2023-08-08: waits 1:15/2:00/1:30/1:30/1:15/1:00; closes ~4:20/~1:05/0:45/0:40/0:50/2:00; damage/tick 3/4/10/15/20/25 (a tick every 1.5 s); diameters ~1200/650/400/200/100/0 m. Match length ~19 min (small maps) / ~20 min (large) | wiki/The_Ring; Breach, Overclocked and Marked have no ring section |
| **Power Journey loot overhaul** | Fewer purple attachments; **Arsenals time-locked, opened by EVO Harvesters**; Mythic/Gold bins removed; bin reset no longer upgrades loot; gold attachments and gold backpacks removed; Hot Zone removed; MRVNs 24 to 12, single use | Marked |
| **Corrupted attachments** | Five, one each: Overflowing Magazine, Headseeker Barrel, Tactical Laser, Agile Standard Stock, Rapid Sniper Stock; a buff and a penalty each; low chance in loot, round 2-3 care packages, high-tier spots | Marked |
| **Energy ammo** | No ammo boxes; a stockpile per gun regenerating 1 mag per 18 s (details in RESEARCH_PHASE_11 section 8) | Marked |
| **Replicators** | 12 at the start plus 2 dropped in later rounds; **single use per player**; three consoles; menu: blue battery, blue med kit, an ammo stack for your guns (or a Bocek arrow refill), banner cards (plus a Mobile Respawn Beacon with a Support legend) | wiki/Replicator |
| **Starter kit** | White backpack moved into the starter kit (S28) | Breach |
| **Chain healing** (S29) | Off / Single (default) / Auto | Overclocked; OC-design |
| **Volunteer jumpmaster** (S30) | Opt in at character select; random if several | Marked |
| **Bots in public lobbies** (S29 test) | See section 4.1 | Overclocked |

---

## 3. Apex Control (Mixtape), current rules

Control is a permanent Mixtape mode since 2023-03-07 and is in the S30 Mixtape rotation (Marked). S29 Split 2 maps: Caustic Treatment, Production Yard, Thunderdome, Barometer (allthings.how S29 Split 2). The wiki lists Thunderdome, Hammond Labs and Caustic Treatment as in rotation.

| Rule | Value | Source |
|---|---|---|
| Teams | **9 v 9**, each team three trios; the same legend up to three times, once per trio | wiki/Control |
| Zones | **Three** capturable zones (A, B, C) plus one uncapturable **home base** per team | wiki/Control |
| Scoring | **1 point per second per held zone** | wiki/Control |
| Win | First to **1,000** (it was 1,250 in 2022, https://www.dexerto.com/apex-legends/how-to-play-control-in-apex-legends-1752403/) | wiki/Control |
| Lockout | Holding all three zones starts a Lockout; if the other team does not retake one before it ends, the holders win. Not offered late in a match (when a team is close to 1,000). Its length: (unverified) | wiki/Control |
| Time limit | **30 minutes**, then the higher score wins | wiki/Control |
| Capture speed by players on the zone | 1: x1, 2: x1.5, 3: x2, 4: x2.25, 5: x2.5, 6: x2.75, 7+: x3. A neutral zone must first be cleared of the enemy's partial capture. Base capture time: (unverified) | wiki/Control (2022-06-21 patch) |
| Timed events | **Bonus Capture**: a marked zone gives **150** to whoever holds it when the event ends. **Care packages**. **Mobile Respawn Beacon**: the carrier is shown live on the map; once placed it is a spawn point for **3 min** | wiki/Control |
| Spawns | No automatic respawn: you **pick a zone** after each death. A zone is spawnable only if captured, **connected to your home base with no enemy zone between**, and at least one zone away from the enemy base | wiki/Control |
| Spawn waves | Max death screen **15 s**, max spawn wave **10 s**, max first wave **15 s** (2022-06-21). A team losing by **62+** skips spawn waves (2023-01-10) | wiki/Control |
| Join in progress | Fills slots until a team reaches **625** or the gap is **300** | wiki/Control (2023-01-10) |
| Kit | Blue body shield, blue helmet, infinite ammo, infinite shield cells and batteries; **no knockdown**; **health regenerates after 4 s** without damage (rate raised 2024-08-06) | wiki/Control |
| Loadouts | **Five**, picked on the respawn screen, each with one grenade; optic free choice; the set rotates every 15 min (new matches). Categories include Long-Range and Specialist (2022) | wiki/Control |
| Ratings | Earned by kills, assists, capturing, defending and contesting zones, and a bonus for killing the Ratings Leader. **Tiers 2, 3, 4**: guns go from blue fully kitted to purple to gold, one tier at a time; **each tier fully charges the ultimate** (the only ult charge). Ratings Leader needs 500+. The points per action and the tier thresholds are on an in-game About tab and not in any source I read (unverified) | wiki/Control |
| Loot | Only care packages | wiki/Control |

**For us:** Control needs 18 players. With bots, 6 v 6 (you, friends and bots against bots) over three zones in a larger arena could keep Apex's rules and scale the numbers: 1 point/s per zone, first to **500** (ours), a 15 min limit, 150-point bonus zone, 10 s spawn waves, the capture multipliers as given.

---

## 4. Bots: Apex's and how other shooters grade difficulty

### 4.1 Apex

| Item | Value | Source |
|---|---|---|
| Bot Royale | Permanent since S22 (2024-08-06): **8 teams of 3**, every legend but the queuing party is a bot; the ring starts at round 2; levelling stops at level 10 | wiki/Bot_Royale |
| Bot Royale Evolved (S28) | **1-5 human squads plus 15-19 bot squads** (20 squads) | Breach |
| Apex Bots in pubs (S29) | Limited test in mid-tier **Unranked** Trios, Duos and Wildcard, off-hours or low-population regions, to fill gaps; **never on your team**; no plans for Ranked | Overclocked; https://www.ea.com/en/games/apex-legends/apex-legends/news/overclocked-matchmaking-update |
| Apex bots' skill | Respawn: bots only go "where they participate meaningfully"; outside lower-skill matches "they struggle to keep up". No published difficulty tiers (unverified) | overclocked-matchmaking-update |
| Behaviour seen by players | Pull toward the ring, poor at range, stall when you climb high (player reports, not official) | https://steamcommunity.com/app/1172470/discussions/0/595158486787100065/ |
| Firing Range dummies (S17+) | Stay still / strafe left-right, strafe speed (or random), random intervals, can stand / can crouch (alternating), shield level up to red, **Full Combat** ("dummies come to life and aggressively attack you all over the Firing Range"). No published aim or reaction values | wiki/Firing_Range; https://www.dualshockers.com/apex-legends-customize-firing-range/ |

### 4.2 Counter-Strike 2: the shipped bot profile (exact values)

Read from the game's own `botprofile.db` (**CS2-bots**, author credit Michael Booth, Turtle Rock). Every bot starts from `Default` and a template overrides it. The comments in the file define the aim fields: **AimFocusInitial** = starting aim error spread in degrees; **AimFocusDecay** = the fraction of the spread left after one second (0.25 = 25% left); **AimFocusOffsetScale** = tracking accuracy (0 = perfect); **AimfocusInterval** = how often the aim is re-adjusted in seconds (smaller tracks movement better).

| Template | Skill | Aggression | ReactionTime (s) | AttackDelay (s) | AimFocusInitial (deg) | AimFocusDecay | OffsetScale | Interval (s) |
|---|---|---|---|---|---|---|---|---|
| Default (base) | 50 | 50 | 0.30 | 0 | 20 | 0.7 | 0.30 | 0.8 |
| Easy | 5 | 10 | 0.60 | 0.70 | 20 | 0.7 | 0.6 | 0.70 |
| Fair | 25 | 15 | 0.60 | 0.90 | 17 | 0.6 | 0.5 | 0.70 |
| Normal | 50 | 30 | 0.60 | 0.80 | 12 | 0.5 | 0.35 | 0.60 |
| Tough | 60 | 45 | 0.50 | 0.70 | 10 | 0.4 | 0.25 | 0.50 |
| Hard | 75 | 60 | 0.40 | 0 (default) | 10 | 0.4 | 0.20 | 0.40 |
| VeryHard | 80 | 70 | 0.30 | 0 | 5 | 0.3 | 0.17 | 0.30 |
| Expert | 90 | 80 | 0.20 | 0 | 2 | 0.2 | 0.15 | 0.20 |
| Elite | 100 | 95 | 0.05 | 0 | 0.5 | 0.1 | 0.05 | 0.05 |

Look speeds (Default, all tiers): max angular acceleration 2000 deg/s² normal, **3000 attacking**; stiffness 100 / 150; damping 25 / 30.

### 4.3 Team Fortress 2: difficulty in Valve's published bot code (exact values)

From **TF2-src** (`tf_bot_body.cpp`, `tf_bot_vision.cpp`, `behavior/tf_bot_behavior.cpp`, `tf_bot.cpp`):

| Behaviour | Easy | Normal | Hard | Expert |
|---|---|---|---|---|
| Head-aim tracking interval (how often the aim updates) | 1.0 s | 0.25 s | 0.1 s | 0.05 s |
| Minimum time to recognise a seen enemy | 1.0 s | 0.5 s | 0.3 s | 0.2 s |
| Aim point (hitscan) | body centre | two thirds of the way up to the head | head ("reaction times will differentiate the skill levels") | head |
| Leads rockets, aims at feet | no | yes | yes | yes |
| Dodges (strafes) under fire | **never** | yes | yes | yes |
| Hears a quiet weapon within range | 10% | 30% | 60% | 90% |
| Pyro reflects projectiles | never | 50% | 90% | always |
| Target choice | the more dangerous of two threats, no healer check | 50% chance to switch to the healer of that threat | the healer first; medics and engineers treated as immediate threats | same |

### 4.4 Call of Duty, Valorant, Overwatch (qualitative)

| Game | Tiers | What changes | Source |
|---|---|---|---|
| Call of Duty (bots, most titles) | Recruit, Regular, Hardened, Veteran | Accuracy, movement speed, reaction time, aggression, weapon choice. Recruit/Regular: weak tactics, never check behind them. Hardened/Veteran: all tactics, check behind, hear footsteps. Veteran: very aggressive, sprints and jumps a lot, strongest guns. No numbers published | https://callofduty.fandom.com/wiki/Bots (via search summary; the page returns 402 to direct fetch) |
| Valorant Range | Shooting test Easy / Medium / Hard (bots appear and vanish faster); Eliminate 50/100; bots strafe, armour on/off; target practice at 5/10/20/30/50 m | https://wiki.playvalorant.com/en-us/Range |
| Overwatch 2 | Practice vs AI: 3 levels; custom games: 8 (Beginner, Practice, Casual, Hard, Lethal, Extreme, Ultimate, Aimbot). More damage, accuracy, ability use and movement at higher levels | https://overwatch.fandom.com/wiki/Practice_vs._AI (via search), (unverified) |

**For our easy / normal / hard bots (proposal, from the tables above):**

| Knob | Easy | Normal | Hard |
|---|---|---|---|
| Reaction to a newly seen enemy | 0.6 s | 0.4 s | 0.2 s |
| Aim update interval | 0.7 s | 0.4 s | 0.15 s |
| Starting aim error, then fraction left after 1 s | 15 deg, 0.7 | 8 deg, 0.45 | 3 deg, 0.25 |
| Aim point | chest | chest to neck | head, some misses |
| Strafe / dodge when shot | never | 50% | always, plus JOLT |
| Hears footsteps / gunfire | 20% | 50% | 90% |
| Grenades | never | at a static target over 8 s | at campers and on pushes |
| Cover | none | break line of sight to heal | peek, pre-aim, reposition on a crack |

---

## 5. Hyper Scape (Ubisoft Montreal; tech test 2020-07-02, open beta 2020-07-12, release 2020-08-11, shut down 2022-04-28)

Sources: **HS/Hyper_Scape**, https://en.wikipedia.org/wiki/Hyper_Scape, and Ubisoft's patch notes as quoted on **HS/Patch_Notes/...** (each links Ubisoft or r/HYPERSCAPE).

### 5.1 Core rules

| Item | Value | Source |
|---|---|---|
| Match size | Crown Rush squads: **33 squads of 3**; solo: **100** | HS/Game_Modes; HS/Patch_Notes/July_12,_2020 |
| Map | Neo Arcadia, a city; rooftops and interiors | HS/Hyper_Scape |
| Health | **120** (10 bars of 12); regenerates; **regen delay 5 s** from 2020-08-11 (was 10 s; "overall time to full HP unchanged") | HS/Contenders; HS/Patch_Notes/August_11th,_2020 |
| Loadout | **2 weapons + 2 hacks**; weapon swap on the floor is a **0.5 s hold** (was 0.8 s) | HS/Weapons; HS/Patch_Notes/July_12,_2020 |
| Ammo | Max ammo reached in **4 pickups** (was 6) | HS/Patch_Notes/July_12,_2020 |
| Ping | Enemy and location threat pings last **7 s** | HS/Patch_Notes/July_17,_2020 |
| No friendly fire | "an important anti-toxicity element" | HS/Patch_Notes/July_17,_2020 |
| Match length | ~15-20 min (search summaries; unverified) | |

### 5.2 Movement

| Item | Value | Source |
|---|---|---|
| Double jump | Everyone, always | HS/Contenders |
| Jump pads ("bumpers") | On every block, "quickly send you to the clouds"; heights not published (unverified) | https://www.pcgamer.com/hands-on-with-hyper-scape-ubisofts-urban-battle-royale-shooter/ (via search); HS/Patch_Notes/July_17,_2020 mentions ADS on a bumper |
| Slide, vault/mantle, sprint, bunny hop | Yes; speeds not published (unverified) | https://steelseries.com/blog/hyper-scape-beginners-guide-285 (via search) |
| Melee | A baton; melee gives a speed boost; it opens barricades | HS/Melee; HS/Patch_Notes/July_12,_2020 (Haste "cumulative with any other speed boost given by Melee") |

### 5.3 Hacks (abilities you loot). Values at Season 1 launch (patch v1.0, 2020-08-11) unless noted

Cooldowns are per **fusion level 0/1/2/3/4**.

| Hack | Cooldown (s) | Numbers | History / notes | Source |
|---|---|---|---|---|
| Teleport | 12/11/10/9/7 | Fixed distance toward your aim (distance unpublished) | 14/…/9 in v0.5, reverted in v1.0 | HS/Teleport; Aug 11 notes |
| Slam | 12/11/10/9/7 | Leap high, slam down: **20/20/20/20/30** splash, knock-up | 30/…/45 before v0.5 | HS/Slam; Aug 11 |
| Ball | 12/11/10/9/7 | Become a bouncing ball: **65 HP**, jump on landing, WASD steering; lasts up to **60 s** (v0.5, was 180); firing ends it | | HS/Ball; Aug 11; Jul 31 |
| Reveal | 12/11/10/9/7 | Pings enemies in a **60 m, 50 deg** cone (v0.4); effect **8 s** in S2 (was 6). Reveal cancels invisibility and vice versa; the last one wins | 14/…/9 in v0.5 | HS/Reveal; https://www.psu.com/news/hyper-scape-update-2-0-patch-notes-prepare-the-battle-royale-for-a-season-2-overhaul/ |
| Wall | 12/11/10/9/7 | **250 HP** (5 baton hits), lasts **9 s**, **max 2** out | Lifetime was 120 s, then 25 s, then 9 s | HS/Wall; Aug 11 |
| Invisibility | 14/13/12/11/9 | **5 s** (was 8); footsteps still audible (fixed in v1.0) | | HS/Invisibility; Aug 11 |
| Mine | 14/13/12/11/9 | Homing proximity mine: **30/30/30/30/45**, detects at **15 m**, chases **8 s**, **max 1**; projectile 60 HP; trigger 0.75 s and acceleration 7 in S2 | 50/…/75 and 15 s chase before v0.5 | HS/Mine; Aug 11; PSU S2 |
| Invulnerable (was Armor) | 14/13/12/11/9 | Immune to all damage for **5 s**; cannot shoot, hack, ADS or melee a barricade; firing ends it | 8 s at test, 6 s, then 5 s. The "fusion reset" let players chain 24 s of armour with the crown | HS/Armor; Jul 6 |
| Heal | 14/13/12/11/9 | Area heal for the squad, **9 s** (was 15), **max 1**; level 4 heals faster | | HS/Heal; Aug 11 |
| Shockwave | 12/11/10/9/7 | Ranged blast that launches everyone: **20/20/20/20/30**; aim at your feet to launch yourself | Added in the open beta (0.3); fastest hack at first (4 s at full fusion) | HS/Shockwave; Jul 12; Aug 11 |
| Magnet | 14/13/12/11/9 | Pulls in and traps enemies in its area; **max 1** | Added in S1 | HS/Hacks; Aug 11 |
| Platform | (unverified) | A limited-time hack in S2 | | PSU S2 |

**Design lesson from the notes:** in v0.5 Ubisoft nerfed every hack to speed up time to kill, then reverted most of it in v1.0 because "the unique pacing and gameplay provided by the Hacks is essential" (HS/Patch_Notes/August_11th,_2020).

### 5.4 Fusion (duplicates upgrade what you hold)

| Rule | Value | Source |
|---|---|---|
| How | Picking up a **duplicate** of a gun or hack you hold instantly upgrades it | HS/Crown_Rush |
| Levels | **0 to 4** (five values in every table). The Weapons page says "up to five times", which conflicts | HS weapon and hack pages; HS/Weapons |
| Guns | More damage at max fusion, bigger magazine each level (full-auto guns) | HS/Patch_Notes/July_12,_2020 |
| Hacks | Shorter cooldown each level; an extra effect at level 4 (more damage or more healing) | hack pages |
| Loot | Full-fusion items spawn only from chests and crates: standard chest 2 items with a **10%** fusion chance; game-event crates 2 items at **100%**. Players drop their gear on elimination | HS/Patch_Notes/August_11th,_2020 |

**Season 1 guns** (damage per fusion level; magazine per level), HS/Patch_Notes/August_11th,_2020:

| Gun | Kind | Damage | Magazine | Notes |
|---|---|---|---|---|
| Harpy | SMG | 7/7/7/7/8 | 30/33/36/39/45 | 740 RPM |
| Ripper | rifle (auto) | 11/11/11/11/14 | 24/26/28/30/36 | |
| Hexfire | minigun | 4/4/4/4/5 | 150/180/210/240/270 | 900 RPM (v0.5) |
| D-Tap | pistol | 5/5/5/5/6 | 15/17/18/20/23 | Auto-lock; ADS +15% RPM |
| Riot One | pistol | 26/28/31/34/38 | 6 | |
| Mammoth MK1 | shotgun | 5/5/5/5/7 per pellet | 5/6/7/8/9 | |
| Dragonfly | semi-auto rifle | 18/18/18/18/21 | 12/14/16/18/20 | New in S1 |
| Protocol V | sniper | 50/55/62/70/80 (S2: 60/64/68/72/80) | 3 | One-shot capability restored in v1.0 |
| Salvo EPL | grenade launcher | 23/23/23/23/28 | 6/7/8/9/10 | 90 RPM (v0.4) |
| Komodo | explosive | 29/29/29/29/34 | 5/6/7/8/9 | Full damage from 15 m (12 m in S2) |
| Skybreaker | rocket | 40/44/50/56/64 | 1 | Full damage and area from 20 m |

**Time to kill (derived, body shots, 120 HP, fusion 0):** Harpy 17 hits at 740 RPM = **1.30 s**; Hexfire 30 hits at 900 RPM = **1.93 s**. Headshot multipliers were not published.

### 5.5 Sector decay instead of a ring

| Rule | Value | Source |
|---|---|---|
| Shape | The city is split into sectors (districts); Decay **deletes whole sectors**, from the **edges of the city inward, district by district** | HS/Decay; HS/Crown_Rush |
| In it | Damage over time; hacks still work; an on-screen icon gives the direction and distance to the nearest safe sector | HS/Crown_Rush |
| Short lobbies | If a match starts short of players, parts of the city are already decayed as you drop | HS/Decay |
| Showdown multiplier | Collapsed-sector damage x5 (v0.3), **x7** (v0.4), **x3** (v0.5 onward) during the Showdown | HS/Patch_Notes July 12, July 17, July 31 |
| Sector count and phase timings | **Not published** (unverified). One search summary says nine districts | |

### 5.6 Echo and Restore Points (respawn)

| Rule | Value | Source |
|---|---|---|
| Echo | At 0 HP with a squad mate alive you become an **Echo**: **invisible to enemies**, normal movement, can **ping and scout**; no guns, hacks or breaking barricades | HS/Crown_Rush; HS/Restore_Points |
| Restore Points | **Dropped by every eliminated contender**, marked in the world and on the map, **single use**. The Echo stands on the point (it locks them there) and a living squad mate interacts to restore them | HS/Restore_Points |
| On return | **Without equipment, but all ammo kept** | HS/Restore_Points |
| Contest | Enemy Echoes can wait at the same point; the **first restored takes it** | HS/Restore_Points |
| Restore time | (unverified) | |

### 5.7 Crown Rush and the Showdown

| Rule | Value | Source |
|---|---|---|
| Win | Last squad standing, **or** hold the Crown | HS/Crown_Rush |
| Crown appears | When Decay reaches the final sector (the Showdown) | HS/Showdown; Wikipedia |
| Hold time | **Conflicting**: 45 s (launch guides, https://gamingbolt.com/hyper-scape-guide-best-weapons-and-how-to-get-a-crown-victory), 30 s (HS/Crown_Rush), 60 s (Wikipedia). 45 s was the launch value (RESEARCH_PHASE_11 section 14) | |
| Dropped | The timer **resets** when the Crown is dropped; an Echo loses it | HS/Crown_Rush; HS/Patch_Notes/July_17,_2020 |
| Carrier | Location revealed to everyone; hack cooldowns **+33%** (v0.3), then **+50%** (v0.4) | HS/Patch_Notes July 12 and 17; gamingbolt |
| Variants | Crown Rush event (crown from the start), Faction War (4 x 24), The Floor Is Lava (rooftops only, knockback kit), Gun Runner / Hack Runner (everyone given the same random pair each round, fusion rising), Turbo (everything max fusion, fast regen, fast decay), Dark Haze (solo, low visibility, a small pool, no crown) | HS/Events; HS/Game_Modes; HS/Dark_Haze |

### 5.8 Crowncast (Twitch) and Game Master events

Viewers vote on one of **three** effects shown on screen; with no streamer in the match, the host AI "Ultimate Grace" plays cards from a smaller pool (HS/Effects, quoting the dev AMA).

| Effect | Numbers | Source |
|---|---|---|
| Low Gravity | **35 s** (was 50); viewers only | HS/Patch_Notes/July_12,_2020 |
| Reveal | Everyone on the whole map for **20 s** | HS/Effects |
| Extra Jump | **+2** extra jumps | HS/Effects |
| Health Kit | Pickups that heal **120** (was 40) | HS/Patch_Notes/July_17,_2020 |
| Supply Crate | Crates in random districts, each with 1 fully fused hack and 1 fully fused gun; the 2 nearest shown on the HUD | HS/Patch_Notes/July_17,_2020 |
| Infinite Ammo | Unlimited ammo and faster reloads | HS/Effects |
| Cooldown Accelerator | Crystals that reset hacks; 45 s in S2 (was 50) | HS/Effects; PSU S2 |
| Haste | Faster movement for all, stacks with other boosts; viewers only | HS/Patch_Notes/July_12,_2020 |
| Lethal Melee | Melee kills instantly, **50 s**; viewers only | HS/Patch_Notes/August_11th,_2020 |
| Infinite Slide | S2 event (numbers unpublished) | PSU S2 |
| Social | Streamers invite viewers straight into their squad; viewers earn battle-pass points by watching (daily cap) | HS/Patch_Notes/July_12,_2020 |

---

## 6. Dash references and tuning a 2-charge dash (4 s a charge)

Unit note: Apex speeds are in hammer units per second; at 1 hu = 1 inch = 0.0254 m, Apex's sprint of 260 hu/s is **6.6 m/s**.

| Reference | Distance | Duration / speed | Charges and recharge | Source (date) |
|---|---|---|---|---|
| **Ours today: JOLT** | 10 m | 0.18 s (**55.6 m/s** average), exits at sprint speed | 1 charge, 3 s | docs/DEVELOPMENT_ROADMAP.md milestone 12 |
| Overwatch, Tracer Blink | **7.5 m** | Instant; **0.096 s** before it can be used again | **3 charges, 3 s each** | https://overwatch.fandom.com/wiki/Tracer (read via its API) |
| Overwatch, Genji Swift Strike | **15 m** | **50 m/s** (0.3 s of travel; listed duration 0.4 s), 50 damage | 1, 8 s; resets on an elimination | https://overwatch.fandom.com/wiki/Genji |
| Valorant, Jett Tailwind | **~11 m** (estimated by the wiki) | **0.45 s** (about 24 m/s), 1 s wind-up, then a 7.5 s window to dash | 1 charge; recharged by 2 kills | https://valorant.fandom.com/wiki/Tailwind (patch 7.04) |
| The Finals, Evasive Dash (Light) | not published | not published | **2 charges, 5 s each** (patch 11.9.0; was 3 charges) | https://www.thefinals.wiki/wiki/Evasive_Dash |
| Apex, Ash's Predator's Pursuit (S24+) | an impulse, not a set distance | velocity **450** (~11.4 m/s), from 425 on 2026-05-05; less boost off your momentum's direction; jump in the air to use it | 1 charge, **10 s** (5 s at launch, 10, 8, 12, then 10) | wiki/Ash |
| Apex, Axle's Nitro Gate (S29-S30) | | forced slide at **750** (~19 m/s) for 0.25-**3 s** (5 s before S30; 5 s again with an upgrade) | 25 s, 2 gates out | wiki/Axle; Marked |
| Apex, Octane Stim | | walk **+30%**, sprint **+40%** (~9.2 m/s) for **6 s**; costs 20 HP | 0.7 s cooldown | wiki/Octane |
| Apex, Wraith Into the Void | | **+30%** speed, 4 s, immune | 15 s | wiki/Wraith |
| Titanfall 2, Stim | | **+35%** for 5 s | 16.66 s | https://titanfall.fandom.com/wiki/Stim |
| Titanfall 2, Phase Shift | | **2 s** invisible and immune | 1 charge (2 at launch) | https://titanfall.fandom.com/wiki/Phase_Shift |
| Titanfall 2, Ronin's Phase Dash | | dash plus phase | 12 s | https://titanfall.fandom.com/wiki/Phase_Dash |

**Reading the references.** What reads as "fast" is a short travel time (0.1-0.3 s) and a peak speed several times sprint; distance is 7.5-15 m. Charge-based dashes sit at 2-3 charges and 3-5 s a charge (Tracer 3 x 3 s, The Finals 2 x 5 s). A 2 x 4 s dash lands between them.

**Suggested tuning for 2 charges, 4 s each (ours, to test in `npm run movesim`):**

| Knob | Suggested | Why |
|---|---|---|
| Distance per dash | **7.5 m** (range 7-8) | Tracer's value; two chained give 15 m, Genji's single strike |
| Travel time | **0.13 s** (about 58 m/s, 9x sprint) | Shorter than JOLT's 0.18 s so it reads as a snap; longer than 0.1 s so the eye can follow it |
| Speed curve | Ease-out: 70% of the distance in the first half | A pop, not a slide |
| Exit speed | **10 m/s (about 400 hu/s, our slide cap)**, blending to sprint over 0.35 s | Keeps momentum for a slide or a jump |
| Gap between charges | **0.25 s** | Stops two dashes merging into one 15 m teleport |
| Recharge | 4 s each, one at a time | The ask |
| Air use | Yes, level (as JOLT), keeping vertical speed at 0 during the dash | Ash and Jett both dash in the air |
| Direction | Movement keys, forward with none (as JOLT and Jett); a bit less distance backward (Ash's "less boost against momentum") | |
| Feel | FOV +8 deg in 0.06 s and back over 0.25 s; 2-3 deg of roll toward the side; a speed-line streak; a whoosh; a small rumble | Common practice in shooters (ours, unsourced) |

---

## 7. Gap analysis

"We have" is from docs/DEVELOPMENT_ROADMAP.md milestones 1-24. Effort is one person's working days.

| Area | Apex has (S30) | Hyper Scape had | We have | Gap | Effort | Value |
|---|---|---|---|---|---|---|
| Movement | Sprint/slide/lurch/superglide/Mantle Boost, ziplines, launch pads, jump towers; legend dashes (Ash 450 impulse, Axle 750 gate, Octane +40%) | Double jump for all, jump pads everywhere, slide, vault | The full Apex model (movesim-checked), ziplines, ladders, pads, towers, JOLT (10 m / 0.18 s / 3 s) | JOLT as a 2 x 4 s dash with the feel pass; an optional double-jump ruleset | 0.5-1 | High |
| Weapons | 29 guns, locked hop-ups with points, Executioner / Shattercaps / Redline, Accelerator on gold, corrupted attachments, energy stockpiles | 11 guns, fusion by duplicates (5 levels) | 29 guns, all charge/spin/heat mechanics, a hop-up slot with 7, counted ammo and energy regen | The three S29-S30 hop-ups; hop-ups that unlock with points; corrupted attachments | 1 + 1 | Med |
| Abilities | 28 legends: tactical, ult, passive, upgrades at EVO levels | 11-12 lootable hacks, 2 slots, fusion lowers cooldowns | JOLT and TRIAGE, picked on landing or at the countdown | Hacks as loot with fusion (a mode); ultimates are out of scope | 3-4 | Med |
| BR systems | Deathbox Respawn (7 s), knockdown shields tied to EVO level (200/450/750), EVO from knocks 150 / assists 100 / finishers 100 / revives / harvesters 350 / caches, arsenals opened by harvesters, replicators, chain healing, a ring unchanged since 2023 | Sector decay, Echo plus Restore Points, crown, fusion loot | Loot, downs, revives, banners, beacons, care packages, pings, EVO from damage dealt only, the six-round ring | Deathbox respawn; knock shields; EVO's full source table; replicators; an optional sector-decay ring | 1 + 1 + 0.5 + 1 + 2 | Med-High |
| Modes | Trios/duos BR, Ranked, Mixtape (TDM 6v6 to 40; Control 9v9 to 1000; Gun Run), Bot Royale | Crown Rush squad/solo, Faction War, Floor Is Lava, Gun/Hack Runner, Turbo, Dark Haze | 1v1 / 1v1v1, BR vs bots (squad of 3), Gun Run, TDM 4v4 to 30, Crown rounds, two courses, the tour | Control vs bots; a Hyper Scape-style round (decay plus crown) | 3 + 2 | Med |
| Bots | Bot Royale; public-lobby bots in low tiers; range dummies with Full Combat; no published tiers | None | Easy / normal / hard, strafe, heal after 4 s, JOLT dodge, loot search 30/18/10 s, crown and Gun Run logic | Tiers built from reaction, aim interval, aim error, dodge, hearing (CS2 and TF2 numbers); grenades; cover | 2-3 | High |
| Animation / feedback | Mocap legends; positional audio; hit tones by shield; knock stinger | Stylised, readable | Jointed figures and mocap mannequins (pistol clips), killcam, recap, synthesised positional audio | Rifle clips for the mannequin; recorded samples | 2 + 2 | Med |
| Controller | Default plus 5 presets and full rebinding; heal/grenade/ping on D-pad and RB with hold combos; advanced look; aim assist | 5 presets | Rebinding, advanced look, per-optic ADS, aim assist, toggles; heal/grenade/ping unbound on a pad | Apex's Default mapping and the six named presets; a hold-for-wheel ping and grenade | 0.5 | High |
| Accounts / social | Accounts, parties, Ranked, banners, champion squad | Twitch Crowncast: viewer votes, squad invites from stream, watch-to-earn | Local profile, client-trusted online boards, invite links, codes | Accounts (owner picks a provider); Game Master events as a friends' toggle | 2-3 / 1 | Med |

---

## 8. The 12 most valuable next steps (not counting PvP battle royale or the authoritative server)

1. **Apex's Default pad layout and the presets** (0.5 day). Quick heal on D-pad up (tap) with the wheel on hold; grenade on D-pad right (hold for a wheel); ping on RB (tap, double-tap for an enemy, hold for a wheel); fire mode on D-pad left, inspect on hold. The six presets as named layouts on the Controls tab. Move the ability card's pick to the same D-pad buttons only while the card is open.
2. **JOLT as a 2-charge dash, 4 s a charge, tuned to feel fast** (0.5-1 day). 7.5 m in 0.13 s, 0.25 s between charges, exit at 10 m/s; the FOV, roll and streak pass (section 6). Bots use a charge to dodge.
3. **Bot tiers from published numbers, plus grenades and cover** (2-3 days). Reaction 0.6 / 0.4 / 0.2 s, aim interval, error that shrinks, aim point, dodge and hearing chances (section 4's table); bots throw a frag at a still target and break line of sight to heal.
4. **Deathbox respawn in the BR** (1 day). 7 s hold at the box, a beam and a hum for everyone, 20 HP, the box's items put back on, a lockout that grows per death and resets after 3 min alive.
5. **EVO the way Apex counts it, and knockdown shields tied to it** (1 day). Knock 150, assist 100, finisher 100, revives 100 twice then less, care package 100; a shield raised with fire while down at 200 / 450 / 750 by EVO level, front only, crawl -45%.
6. **The S29-S30 hop-ups and locked hop-ups** (1 day). Executioner (PK, Mastiff: 50 shield over 5 s on a knock, 275 points), Shattercaps (30-30 hip fire: 7 x 8, head x1.25), Redline (L-STAR near overheat, our values marked as ours); hop-ups that unlock after N damage with that gun; care-package guns unlocked.
7. **The ping wheel of eight** (0.5 day). Hold ping: enemy, looting, attack, defend, watching, enemy activity, avoid, enemy audio.
8. **Game Master events in bot matches and the BR** (1 day). A setting: every 90 s one of low gravity (35 s), extra jumps (+2), reveal all (20 s), infinite ammo, health kits, haste, lethal melee (50 s); friends vote on three from the scoreboard.
9. **A sector-decay round on Outskirts, ending in a crown** (2 days). Replace the ring with the five places and the field decaying one at a time from the edge, damage x3 in the last sector, then the crown (45 s hold, reset on a drop, carrier shown, abilities +50% cooldown). Our Crown code does most of the end.
10. **Control against bots** (3 days). 6 v 6 in a larger arena with three zones: 1 point/s per zone, first to 500, a lockout, a 150-point bonus zone, spawn on connected zones, 10 s waves, ratings that upgrade the loadout and the ability.
11. **A hacks-and-fusion mode** (3-4 days). Abilities as loot in two slots; picking up a duplicate fuses it (5 levels, cooldown 14 to 9 s); Teleport, Wall (250 HP, 9 s), Invulnerable (5 s), Shockwave (20/30), Reveal (60 m cone), Ball (65 HP) as the first six, and double jump as that mode's movement.
12. **Rifle animation for the mannequin** (2 days). Then the mannequin can be the default figure.

After these: accounts (the owner's pick of provider), KTX2 textures, recorded sounds, corrupted attachments, replicators.
