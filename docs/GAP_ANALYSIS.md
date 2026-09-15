# Gap analysis: B00G Range against Apex Legends (Season 30) and Hyper Scape

Mechanics and numbers only, per PROJECT_RULES.md: nothing here proposes copying art, audio, code or branding. Effort is one person's working days. "(unverified)" marks anything no source confirmed.

**Rewritten after Phase 12 (2026-09-15).** The owner asked for "another next steps and gap analysis from big time players like Apex and Hyperscape". The research behind every number is `docs/RESEARCH_PHASE_12.md`: Apex S28 to S30 from EA's notes and the wiki, and Hyper Scape from Ubisoft's notes as the wiki quotes them. The Phase 11 version of this file, and its ranked list, are in the git history.

## 1. Summary

Against Apex we now have almost everything a range, a squad against bots and the Mixtape modes need:
- the full movement model (movesim-checked) and all 29 guns with their charge, spin and heat mechanics, hop-ups including Season 29 and 30's three, and counted ammo;
- every heal, the helmets and the EVO shield core, counted as Season 30 counts it, with knockdown shields at its levels;
- the battle royale on Outskirts with loot, downs, revives, banners, beacons, Deathbox Respawn, care packages, pings and the ring;
- Gun Run, team deathmatch, Crown and Control;
- a controller with Apex's Default layout and presets;
- bots in four tiers that throw frags, take cover and hear shots;
- motion-captured figures that hold a rifle at the shoulder and let go of it when they fall;
- a killcam and a death recap, and optional accounts.

What Apex has that we do not:
- **other human squads**: PvP needs the authoritative server;
- **legends**: tacticals, ultimates and passives. We have two picked abilities by design;
- the smaller systems: a ping wheel, replicators, corrupted attachments, ratings and loadout upgrades in Control, and bots that can be downed and finished.

Hyper Scape is a different game on the same bones. It shows what a battle royale can be when abilities are loot (hacks with fusion), when the ring is a city deleting itself sector by sector, and when spectators steer the match (Crowncast). None of it is in the game yet. Those are the new ideas at the top of the list in section 5.

## 2. Against Apex Legends, Season 30 "Marked"

### Movement

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Sprint 260, walk 173.5, crouch 80 hu/s, Quake air, the slide gate and 400 cap, lurch, wallbounce, climb, mantle, the superglide as Mantle Boost (S27), ziplines, launch pads, jump towers | All of it, checked by `npm run movesim`; the superglide trainer and cue | None | - | - |
| Legend movement: Ash's dash (impulse 450, 10 s), Axle's Nitro Gate (750 slide), Octane's stim (+40% sprint, 6 s) | ✅ **JOLT**: two stored dashes of 10 m, one back every 4 s, 0.14 s on an ease-out, leaving at 400 hu/s, with an FOV kick, a roll and a rumble | Other legends' kits are out of scope | - | - |
| A true skydive: glide speeds, a jumpmaster, a volunteer jumpmaster in S30 | A steered drop straight down, onto the squad's place | The glide and the jumpmaster | 2 | Low |

### Weapons and items

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| 29 guns, charge, spin-up, overheat, energy stockpiles | ✅ All 29, all their mechanics | None | - | - |
| Hop-ups, and since S26 **locked hop-ups** that unlock with points; S29 to S30: Executioner (PK, Mastiff: 50 shield over 5 s on a knock, 275 points), Shattercaps (30-30 hip fire 7 x 8), Redline (L-STAR near overheat), Accelerator (gold guns: +30% EVO from damage) | ✅ The slot with the data's hop-ups; ✅ Executioner, Shattercaps, Redline (ours for Redline's numbers), locked on floor guns until 275 damage, unlocked in care packages | Accelerator (we have no gold floor guns and no ultimates); the Gun Shield Generator | 0.5 | Low |
| Corrupted attachments (S30): five, a buff and a penalty each | None | A new attachment tier | 1 | Low |
| Heals, helmets, the EVO shield core (blue at 450, purple at 1,700 more) | ✅ All five heals and the wheel, both helmets, EVO from damage, knocks, assists, revives and care packages; purple corrected to 2,150 in all | Finishers' 100 (bots cannot be downed); EVO harvesters (350 each) and EVO caches | 1 | Low |
| Frag, arc star, thermite | ✅ With Season 30's numbers; bots throw frags | Bots' arc stars and thermite | 0.5 | Low |

### Battle royale systems

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| 20 squads, the ring (six rounds, unchanged since 2023), loot, care packages | ✅ One squad of up to three against up to 11 bots on Outskirts, the six-round ring, floor loot, death boxes, care packages | Other human squads (the server); Bot Royale's 8 teams of 3 bots | 2 to 4 weeks | High |
| Downs, 5 s revives, banners, 5 s beacons | ✅ All of them | None | - | - |
| **Deathbox Respawn** (S29): 7 s at a mate's box, a green beam, back on the box at about 20 HP with what is left in it, a lockout per death | ✅ All of it; the lockout's seconds are ours (30, 60, 120), Apex's are unpublished | Damage cancelling the channel (unverified in Apex) | - | - |
| **Knockdown shields** by EVO level (S28): 200, 450, 750, front only, crawl -45% | ✅ All of it | None | - | - |
| Replicators (single use per player: a battery, a med kit, ammo, banners), EVO harvesters opening Arsenals, chain healing | None | Replicators and harvesters on Outskirts | 1.5 | Med |
| The ping wheel: enemy, looting, attack, defend, watching, enemy activity, avoid, enemy audio | A context ping, and the double tap for an enemy there | The wheel of eight | 0.5 | Med |
| Finishers on a downed enemy (100 EVO, a shield back) | Bots go straight out; downed players are only your squad | Bots with a downed state, then finishers | 1.5 | Med |

### Modes

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Mixtape TDM (6 v 6, first to 40) and Gun Run (4 x 3, 25 guns, the throwing knife) | ✅ TDM (4 v 4, first to 30), Gun Run (free-for-all, 10 or 29 guns, the knife) | Sizes, bounded by the arena | - | - |
| **Control** (9 v 9, three zones, 1,000 points, a lockout, a bonus zone, spawns on linked zones, five loadouts, ratings that upgrade guns and charge ultimates) | ✅ Control in the arena, 5 v 5, first to 500: zones, capture speeds, the bonus, the lockout, linked spawns | Loadout choice at each spawn, ratings and their gun tiers, spawn waves, 9 v 9 on a bigger map | 2 | Med |
| Ranked, banners, the champion squad | Stats, records, online boards between friends, optional accounts | Ranked needs the server | with the server | Med |

### Bots

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Bot Royale, bots in low-tier public lobbies; no published difficulty | ✅ **Easy, normal, hard, elite and mixed**, from CS2's bot profile and TF2's published code: reaction, aim lag, a settling aim error, aim point, dodging, hearing, frags at campers and hiders, cover to heal, crouching in fights, elite pre-aim | Bots that loot their way up, use abilities other than JOLT, and revive each other (bots have no squads) | 2 | Med |

### Animation, audio, feedback

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| Motion-captured legends | ✅ The mannequin (the default): its clips, a rifle at the shoulder with two-bone IK to the grip and handguard, planted feet turning on the spot, landings, a stagger, a death; nobody holds a gun down or out, and a dropped gun lies by the body | Rifle-specific reload and crawl clips (the free library has none), finishers | 2 | Low |
| Recorded, positional audio | ✅ Synthesis with Kenney's CC0 recordings layered in (footsteps, landings, falls, punches, the magazine, a frag's crunch); HRTF, distance, delay | Recorded guns (the synthesis voices them by class) | 2 | Low |
| Killcam, death recap | ✅ Both | None | - | - |

### Controller

| Apex has | We have | Gap | Effort | Value |
|---|---|---|---|---|
| The Default layout with holds and double taps; six presets; full rebinding | ✅ Default (RB ping and its double tap, D-pad heal with the wheel on hold, grenade, fire mode with inspect on hold, Y hold to holster), Bumper Jumper, Button Puncher, Evolved, Grenadier, Ninja, and our Range layout; every button rebindable | The grenade wheel on hold | 0.5 | Low |

## 3. Against Hyper Scape (Ubisoft, 2020 to 2022)

| Hyper Scape had | We have | Gap | Effort | Value |
|---|---|---|---|---|
| **Hacks**: eleven abilities found as loot, two slots (Teleport, Slam, Ball, Reveal, Wall 250 HP 9 s, Invisibility 5 s, Mine, Invulnerable 5 s, Heal, Shockwave, Magnet); cooldowns 12 to 7 s or 14 to 9 s by fusion | Two abilities, picked, not looted | A hacks-and-fusion mode with the first six | 3 to 4 | Med |
| **Fusion**: a duplicate of a gun or hack you hold upgrades it (5 levels: more damage and magazine for guns, shorter cooldowns for hacks); full-fusion items from chests at 10% | Mag levels and attachments on floor guns | Fusion as that mode's loot rule | with the mode | Med |
| **Sector decay** in place of a ring: the city deletes whole districts from the edges inward, x3 damage in the Showdown | Apex's six-round ring | A decay round on Outskirts's five places | 2 | Med |
| **Crown Rush**: the crown appears in the final sector; hold it 45 s (at launch) to win; the carrier is shown, hack cooldowns +50% | ✅ Crown in the arena (appears at 20 s, 30 s to hold, rounds) | The crown as the BR's end (with decay) | with decay | Med |
| **Echo and Restore Points**: out, you are an invisible Echo who can scout and ping; a mate restores you at any elimination's point | Banners and beacons, Deathbox Respawn | An Echo spectator who can ping | 1 | Low |
| **Crowncast**: viewers vote on events (low gravity 35 s, reveal everyone 20 s, +2 jumps, infinite ammo, 120-HP kits, haste, lethal melee 50 s); with no streamer, the host AI plays them | None | Game Master events for friends' matches, voted from the scoreboard | 1 | Med |
| Double jump for everyone, jump pads on every block | Apex's movement, launch pads | A double-jump arena rule | 0.5 | Low |
| 120 HP that regenerates after 5 s | Shields and heals (and Gun Run's regen) | None needed | - | - |
| Five controller presets | ✅ Seven | None | - | - |
| No friendly fire, as anti-toxicity | ✅ None between team mates | None | - | - |

## 4. Technology

| Area | Where it stands | Gap | Effort |
|---|---|---|---|
| The authoritative server | Peer-to-peer through our own broker and TURN relay (built, dry-run tested, waiting on the owner's VM) | The server that runs the fight | 2 to 4 weeks |
| Downloads | ✅ Textures as WebP (30.5 MB to 5.8 MB) | KTX2 textures, meshopt geometry for the props (about 11 MB) | 1 |
| Accounts | ✅ Optional, on our own server: hashed passwords, sessions, a profile that syncs | Password reset (no email on the box), account deletion from the page | 0.5 |

## 5. Ranked next steps (after Phase 12)

Not counting PvP battle royale and the authoritative server under it (the owner's call: its own project, later):

1. **Get the game's own server live** (an hour of the owner's time): the broker, the relay, the boards and now the accounts are built and dry-run tested; the VM, the DuckDNS name and the firewall are the owner's (`docs/SERVER_GUIDE.md`).
2. **The ping wheel** (0.5 day): Apex's eight pings on a hold of the ping button.
3. **Game Master events** (1 day): Hyper Scape's Crowncast for friends. Every 90 s the host plays one, or the squad votes on three from the scoreboard: low gravity, extra jumps, reveal everyone, infinite ammo, big heals, haste, lethal melee.
4. **A decay round ending in the crown** (2 days): Outskirts's five places decaying from the edge in place of the ring, damage x3 in the last, then Crown Rush's crown (45 s, reset on a drop, carrier shown).
5. **Bots that go down and can be finished** (1.5 days): the down state for bots, their squad mates reviving, and finishers with Apex's 100 EVO and a shield back.
6. **Replicators and EVO harvesters on Outskirts** (1.5 days): single-use replicators for a battery, a med kit or ammo; harvesters giving 350 EVO to the squad.
7. **A hacks-and-fusion mode** (3 to 4 days): six of Hyper Scape's hacks as loot in two slots, fusion by duplicates, double jump as the mode's movement.
8. **Control's ratings and loadouts** (2 days): pick a loadout at each spawn; ratings from kills and captures upgrade the guns a tier at a time.
9. **KTX2 and meshopt** (1 day): the props' geometry and GPU memory.
10. **Corrupted attachments and the Accelerator** (1 day).
