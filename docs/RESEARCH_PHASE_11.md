# Research for Phase 11: numbers and sources

Researched 2026-09-15. Current Apex season: **Season 30 "Marked"** (patch 2026-08-03, midseason patch 2026-09-14). Before it: S29 "Overclocked" (2026-05-04), S27 "Amped" (2025-11-03), S25 (2025-05-06), S24 "Takeover" (2025-02-10/11).

Key sources (short names used in the tables):

- **Marked** = https://www.ea.com/games/apex-legends/apex-legends/news/marked-patch-notes (S30, 2026-08-03)
- **Marked-mid** = https://www.ea.com/games/apex-legends/apex-legends/news/marked-midseason-patch-notes (2026-09-14)
- **Overclocked** = https://www.ea.com/en/games/apex-legends/apex-legends/news/overclocked-patch-notes (S29, 2026-05-04)
- **Amped** = https://www.ea.com/en/games/apex-legends/apex-legends/news/amped-patch-notes (S27, 2025-11-03)
- **Takeover** = https://www.ea.com/games/apex-legends/apex-legends/news/takeover-patch-notes (S24, 2025-02-10)
- **wiki/X** = https://apexlegends.wiki.gg/wiki/X

"(unverified)" means I could not confirm the value from a source I actually read. The best-known value and where it came from are given with it. Where the wiki and the newer EA patch notes disagree, the patch notes win and the conflict is noted.

---

## 1. Healing items

| item | value | source | note |
|---|---|---|---|
| Shield Cell | +25 shield, **2.5 s**, stack 6 | wiki/Shield_Cell; Takeover | 3 s until S24. Heals 50 with the Gold helmet |
| Syringe | +25 HP, **4 s**, stack 6 | wiki/Syringe; Takeover | 5 s and stack 4 until S24. Heals 50 with the Gold helmet |
| Med Kit | 100% HP, **8 s**, stack 2 | wiki/Med_Kit | stack 3 with the Gold backpack (gold backpacks left the loot pool in S30, Marked) |
| Shield Battery | 100% shield, **5 s**, stack 2 | wiki/Shield_Battery | stack 3 with the Gold backpack |
| Phoenix Kit | full HP and shield, **10 s**, stack 1 | wiki/Phoenix_Kit | stack 2 with the Gold backpack |
| Starting heals | 4 Cells + 4 Syringes | Takeover | was 2 each |
| Moving while healing | speed **-40%**; no sprinting, firing, interacting, or most abilities | wiki/Shield_Cell (same text on every heal page) | The wiki's line that Support moves at full speed while healing is **stale**: Takeover removed it ("no longer ... increased movement speed while healing"), and wiki/Support lists no heal perk |
| Sprint cancels | yes, pressing Sprint cancels the heal | https://forums.ea.com/discussions/apex-legends-feedback-en/qol---gameplay-tab-toggle-for-sprint-cancels-healing-items/8724728 | a player request for a toggle, which confirms the behavior |
| Firing / swapping cancels | (unverified) yes, both inputs cancel | community knowledge | the wiki says only "until completed or canceled" |
| Damage interrupts heal | (unverified) **no**, taking damage does not cancel a heal | community knowledge | no source I read lists damage as a cancel; wiki/Health mentions only manual cancelling |
| Chain healing (S29) | a second heal can be queued to start when the current one ends; the setting is Off, Single, or Auto | Overclocked | Auto keeps queuing until full |

## 2. Helmets

| item | value | source | note |
|---|---|---|---|
| Headshot reduction (all tiers) | **none** | Takeover; wiki/Helmet | removed on 2025-02-11. White, blue, and purple helmets left the loot pool |
| Gold helmet | no head reduction. Sets armor to 100 and doubles Cell/Syringe healing | Takeover | "Gold Armor Upgrade Helmet" |
| Mythic (red) helmet | sets armor to 125 | Takeover | |
| Historic, pre-S24 (reference only) | L1 20%, L2 50%, L3/L4 65% of the head *bonus*: dmg = x·(r + (1−r)·y) | wiki/Helmet | x = base damage, y = head multiplier, r = 0.2/0.5/0.65 |

## 3. Body shields / Evo (Shield Cores)

| item | value | source | note |
|---|---|---|---|
| White (L1) | 50 | wiki/Shield_Core | |
| Blue (L2) | 75, reached at **450 EVO** | wiki/Shield_Core | |
| Purple (L3) | 100, reached at **1,700 EVO** | wiki/Shield_Core; Takeover | was 1,350. L3 is the maximum you can earn |
| Red (L4/5) | 125, only from the Mythic helmet (not earned by leveling) | Takeover | "Red Armor no longer earnable through leveling" |
| How EVO is earned | mainly from damage dealt | wiki/Shield_Core | S30 Accelerator hop-up gives +30% EVO from damage (Marked) |
| Old Evo Shield (S4 to S19, reference) | damage to upgrade 0→1: 100, 1→2: 150 (200 from S18), 2→3: 300, 3→red: 750 | wiki/Evo_Shield | replaced by Shield Cores on 2024-02-13 (S20) |
| Overcharge | picking up a higher-tier core gives temporary overshield for 30 s | wiki/Shield | |
| Body Shield item | 50/75/100; not in BR since 2024-02-13 (still in Mixtape and Control) | wiki/Body_Shield | |

## 4. Knockdown, revive, banner, respawn

| item | value | source | note |
|---|---|---|---|
| Bleedout timer | 90 s, then 60 s, 30 s, and 15 s on later knocks | wiki/Health | |
| Downed HP | 100 bleedout HP, so downed players can be shot to death | wiki/Health | |
| Finishers | yes. A completed finisher restores all of the finisher's shields | wiki/Health | finisher duration: (unverified) |
| Revive time | 5 s | wiki/Health | Support "Revive Expert" makes revives 33% faster, about 3.3 s (wiki/Support) |
| HP after revive | 20 HP plus any remaining shields | wiki/Health | 70 HP + 50 shield if the reviver has a Gold knockdown shield (the item may be outdated) |
| Crawl speed | "significantly increased" in S24 | Takeover | the number is (unverified) |
| Banner expiry | 90 s after death | wiki/Banner_Card (from the search snippet) | |
| Respawn beacon use | 5 s channel, then the dropship | wiki/Respawn_Beacon | S29: the dropship arrives sooner and hovers longer (Overclocked) |
| Respawned kit | 2 Syringes, 2 Cells, a Level 1 knockdown shield, previous helmet and armor, non-care-package weapons without attachments, 2 ammo stacks per weapon, cooldowns reset | wiki/Respawn_Beacon | the wiki may predate S24 and S29 |
| Deathbox respawn (S29) | 7 s activation at the teammate's deathbox. Unlooted gear returns automatically, and the cooldown grows with each death | Overclocked | |

## 5. Throwables

| item | value | source | note |
|---|---|---|---|
| Frag | **100** max damage inside 2.4 m, 8 m outer radius, **4 s** fuse from the throw, +10 on a direct hit | wiki/Frag_Grenade | stack 1 (Fuse carries 2) |
| Arc Star | **75** max damage inside 1.8 m, 8.75 m radius, detonates **2.8 s** after sticking, +10 stick damage | wiki/Arc_Star | slow and blur up to 5 s, scaled by distance. From June 2024 it also kills airborne or slide momentum |
| Thermite | 6 m line of fire lasting **8 s**. **4 dmg per tick (8/s)** inside the fire, plus a **25** afterburn | wiki/Thermite_Grenade | initial impact damage: (unverified, none listed) |

## 6. Nemesis Burst AR

| item | value | source | note |
|---|---|---|---|
| Damage | 17 body / 22 head (×1.3) / 13 leg (×0.75) | wiki/Nemesis_Burst_AR; Takeover | |
| Burst | 4 rounds, keeps bursting while the trigger is held | wiki | |
| In-burst rate | 18 rounds/s | wiki | overall 451 to 582 RPM, 128 to 165 DPS |
| Burst delay | 0.31 s uncharged, 0.19 s fully charged | wiki | |
| Charge | +16.7% per burst fired, hit or miss (6 bursts to full) | wiki | |
| Charge decay | after 8 s without firing, loses 12.5%/s | wiki | 2025-03-25 patch |
| Magazine | 20 / 24 / 28 / 32 (none, white, blue, purple), 36 gold | wiki | gold attachments left the loot pool in S30 (Marked) |
| Reload | tactical 2.7 s, empty 3.0 s (none) → 2.43 s / 2.7 s (purple) | wiki | |
| Ammo | Energy: now a **3-mag regenerating stockpile** | Marked | see section 8 |
| Projectile speed | 31,000 hu/s (812 m/s) | wiki | |
| ADS / draw | ADS 0.27 s in / 0.23 s out; draw 0.6 s | wiki | |

## 7. Bocek Compound Bow

| item | value | source | note |
|---|---|---|---|
| Max-draw damage | **55** body (S25: "decreased to 55 from 75") | https://www.destructoid.com/apex-legends-season-25-patch-notes-all-weapon-buffs-and-nerfs/ | the wiki infobox shows body 35 to 65, head 56 to 104, leg 28 to 52. That implies ×1.6 head and ×0.8 leg, but it may be stale |
| Draw time | **0.35 s** to full nock (2025-09-16, was 0.45) | wiki/Bocek_Compound_Bow | the infobox still says 0.54 (stale) |
| Perfect draw | none today. Deadeye's Tempo was removed in February 2025 | wiki/Bocek_Compound_Bow | longer draw means more damage, speed, and accuracy |
| Projectile speed | 10,000 hu/s (254 m/s) uncharged → 28,000 hu/s (711 m/s) full | wiki | |
| Fire rate | (unverified) the wiki says "3 fired in one second" | wiki | the S25 patch lowered the rate of fire |
| Arrows | own stockpile of **60** (Sparrow 70), up from 40/50 on 2026-09-14. Arrows are recoverable, max 4 from a deathbox | Marked-mid; wiki | arrows take no inventory slot. S27 added a craftable Arrow Bundle refill (Amped) |
| Explosive arrows | a Frag Grenade energizes the bow: **10** arrows per energize (Sparrow 12). Full draw only. 40 on hit (64 head), then +25 in a 5 m radius after 2 s | Marked-mid; destructoid S25 | replaced Shattercaps in S25 |
| Shattercaps | **removed** from the Bocek (May 2025). In S30 Shattercaps is on the 30-30 instead | wiki; Marked | |
| Availability | Sniper Arsenals, no longer in the care package | wiki | |

## 8. Ammo types and the S30 energy rework

| item | value | source | note |
|---|---|---|---|
| Light | R-301, R-99, Alternator, P2020, Spitfire, G7 Scout, C.A.R. (either) | wiki/Ammo; wiki/Weapons | |
| Heavy | Flatline (VK-47), Hemlok, Prowler, Rampage, 30-30, C.A.R. (either) | wiki/Ammo | in S30 the 30-30 is a care-package weapon with its own 50-round stockpile (Marked) |
| Energy | HAVOC, Nemesis, Devotion, L-STAR, Volt, Triple Take, RE-45 | Marked | wiki/Weapons still lists the RE-45 as Light (stale). Marked lists it with an energy stockpile |
| Sniper | Charge Rifle, Sentinel, Longbow, Wingman | wiki/Ammo | |
| Shotgun | Mastiff, EVA-8, Peacekeeper, Mozambique | wiki/Ammo | |
| Arrows | Bocek (own stockpile, not inventory) | wiki/Ammo | |
| Kraber | (unverified) care-package weapon with its own non-refillable sniper rounds | web search summary for S30; no page I read confirms it | |
| Stack per slot | Light **60** (from 72, 2026-05-05), Heavy 60, Sniper 28, Shotgun 20; Energy was 54 | wiki/Ammo | Assault class stacks: 80 / 80 / 37 / 27 (Energy 72) |
| **Energy regen claim** | **CONFIRMED (S30 Marked, 2026-08-03).** Energy ammo boxes are removed. Energy guns carry a stockpile that **regenerates 1 magazine per 18 s** while idle; regen pauses while shooting or reloading | Marked | the 18 s does not change with mag size. The HUD shows energy ammo as a % |
| Stockpile per gun | **2 mags**: RE-45, Volt, Triple Take. **3 mags**: HAVOC, Nemesis, Devotion. **4 mags**: L-STAR | Marked | so "2 to 4 mags" is correct |
| Wildcard mode | +1 mag of stockpile, regen 1 mag per 12 s | Marked | |

## 9. Charge Rifle

| item | value | source | note |
|---|---|---|---|
| Charge | **0.85 s** delay after the trigger, then one shot | wiki/Charge_Rifle | charges on trigger press, not on ADS |
| Beam | **no damaging beam**. The pre-fire laser was removed in S18 (2023-08-08), and the shot became a projectile | wiki/Charge_Rifle | |
| Damage | grows with travel distance: **75** body near, **110** max at >200 m (2026-09-14, was 99) | wiki; Marked-mid | head ×1.8 (135 near), limb ×0.9 (May 2025) |
| Selectfire (auto) | damage penalty **25%** (2026-09-14, was 40%) | Marked-mid | Selectfire added 2025-01-07 |
| Ammo / mag | Sniper, 1 per shot. Mag 6 / 7 / 8 / 9 | wiki | floor loot |

## 10. L-STAR

| item | value | source | note |
|---|---|---|---|
| Magazine or heat | **overheat instead of a mag**: 24 / 26 / 28 / 30 shots to overheat (by mag level) | wiki/L-STAR_EMG | the S30 energy stockpile adds 4 mags' worth of reserve (Marked) |
| Cooling | starts 0.08 s after you stop firing | wiki | |
| Overheat lockout | forced "reload" of **1.19 / 1.15 / 1.11 / 1.07 s** per 100% heat (0.83 s with gold mag). Cannot be started manually | wiki | |
| Damage | **20** body (S29, was 19), 600 RPM | Overclocked; wiki | S29 added the Redline hop-up: more damage and projectile size near overheat |
| Location | care package (S29) | Overclocked | S30 status: (unverified); a web search summary says it stays in the care package |

## 11. HAVOC, Devotion, 30-30

| item | value | source | note |
|---|---|---|---|
| HAVOC charge-up | **0.42 s** wind-up before firing | wiki/HAVOC_Rifle; wiki/Turbocharger | |
| HAVOC with Turbocharger | 0.01 s (near instant) | wiki/Turbocharger | now a locked hop-up unlocked with points. The HAVOC cost is 600 per the wiki (unverified for now) |
| HAVOC damage | 20 body / 26 head, 672 RPM | wiki/HAVOC_Rifle | 2025-05-14 |
| Devotion spin-up | 300 → **900 RPM**, **1.75 s** to reach max | wiki/Turbocharger; wiki/Devotion_LMG | 16 damage |
| Devotion with Turbocharger | 0.85 s to max | wiki/Turbocharger | locked Turbocharger unlocks at **500 points** (S30, was 425) (Marked) |
| 30-30 (S30, care package) | **51** damage (was 43). **ADS charge time 0.25 s** (was 0.4). Stockpile 50 | Marked | |
| 30-30 charged bonus | Feb 2025: 43 → 58 (+36%). Mar 2025: charged 65 body / 104 head (about ×1.5) | Takeover; wiki/30-30_Repeater | the S30 charged value is (unverified) |
| 30-30 Shattercaps (S30) | 7 pellets × 8 = 56 per blast, ×1.25 head | Marked; allthings.how | |

## 12. Mantle Boost (S27)

| item | value | source | note |
|---|---|---|---|
| What it is | "grants velocity on a timed input after a mantle", for all Legends | Amped | the official version of the superglide |
| Timing window | press in the **last 0.15 s** of the mantle | https://apexmovement.tech/wiki/tech/General%20Tech%3EMantle%20Tech%3EMantle%20boost%3EMantle%20boost%20entry (search snippet; page returns 403) | mantle pull of 0.3 s: (unverified, third-party summary) |
| Cue | optional timing indicator on the reticle; overlay toggle in Gameplay settings | Amped; apexmovement.tech | the input is remappable. Default jump: (unverified) |

## 13. Gun Run and TDM

| item | value | source | note |
|---|---|---|---|
| Gun Run teams | 4 teams of 3 | wiki/Gun_Run | |
| Gun Run ladder | **25** weapons, **1 kill** advances you. The new weapon comes from your team's highest score + 1 | wiki/Gun_Run | |
| Gun Run final | Throwing Knife (100 body / 300 head). The first team to get a knife kill wins | wiki/Gun_Run | |
| Gun Run melee | being killed by melee costs 1 score | wiki/Gun_Run | |
| Gun Run time | 10 min, then highest score wins. Auto respawn; regen starts after 4 s without damage | wiki/Gun_Run | |
| TDM | 6v6, first to **40** kills, 1 round, **10 min**, unlimited respawns, 5 loadouts | wiki/Team_Deathmatch | 40 since 2024-08-06 |

## 14. Hyper Scape Crown Rush (game shut down 2022-04-28)

| item | value | source | note |
|---|---|---|---|
| Crown appears | when the last sector closes (the final "Showdown" phase) | https://en.wikipedia.org/wiki/Hyper_Scape | |
| Hold to win | **45 s** per launch guides, **60 s** per Wikipedia | https://www.redbull.com/in-en/hyper-scape-crown-rush-tips-guide (via search); Wikipedia | conflicting. 45 s was the launch value |
| Carrier visibility | the carrier's location is shown on the map to everyone | https://gamertweak.com/hyper-scape-crown-victory-tips/ (via search) | |
| Carrier penalty | +33% hack (ability) cooldown | https://www.gfinityesports.com/article/hyper-scape-open-beta-patch-notes-12th-july-ubisoft-pc-battle-royale-solo-harpy-haste (via search) | patch of 2020-07-12. Carrier speed change: (unverified) |

## 15. Care packages, jump towers, launch pads

| item | value | source | note |
|---|---|---|---|
| Drop schedule | Round 1: 2 packages (announced 4:05 before the ring closes, land 2:30 before). Rounds 2 to 4: 1 each | wiki/Care_Package | the wiki page is flagged as outdated. The actual fall time is (unverified); a third-party summary says 35 to 55 s |
| Contents | center slot: a fully kitted care-package weapon or a jackpot item. Left: heals. Right: attachments and optics. Tan beam until opened | wiki/Care_Package | |
| S30 rotation | 30-30 in; G7 back to the floor | Marked | full rotation (L-STAR, Kraber?) is (unverified) |
| S30 loot | gold attachments and gold backpacks removed from the loot pool | Marked | |
| Jump tower | a zipline up to a balloon; at the top you start skydiving to redeploy | wiki/Jump_Tower | no numbers on the wiki |
| Octane Launch Pad | 2 charges, 90 s per charge, 200 HP, 4 max. Double jump mid-air. Walking gives a high arc; crouching or sliding gives a low, longer arc | wiki/Launch_Pad | height and velocity: (unverified) |

## 16. Death recap (reference)

| item | value | source | note |
|---|---|---|---|
| Death recap | yes. Shows who knocked and who killed you, and damage dealt and received per enemy | https://answers.ea.com/t5/General-Feedback/Can-someone-explain-this-death-recap-discrepancy/td-p/8560738 | players report the numbers can differ from what the server recorded. Apex has no replay-style killcam: (unverified) |
