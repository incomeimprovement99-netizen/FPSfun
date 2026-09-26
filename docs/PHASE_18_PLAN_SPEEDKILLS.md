# SpeedKills: the plan

**Written 2026-09-26, revised the same day with the owner's answers.** This is the plan for turning the
project into **SpeedKills**: a fast, vertical, futuristic-city FPS and battle royale that reproduces what made
Hyper Scape satisfying to play, above all its movement, and fixes what made it fail. It is written for the
owner to approve or edit before one long, continuous build.

It rests on four things:

- the owner's brief (62 sections);
- the owner's answers to 20 questions on 2026-09-26 (section 3);
- four read-only passes over this codebase (section 5);
- research into Hyper Scape as it was left when development stopped (section 4).

**The rule over everything: easy to understand, extremely difficult to master.**

---

## Contents

1. [The goal, in one page](#1-the-goal-in-one-page)
2. [What is preserved](#2-what-is-preserved)
3. [The owner's decisions](#3-the-owners-decisions)
4. [Gap analysis: Hyper Scape as it was left, and us](#4-gap-analysis-hyper-scape-as-it-was-left-and-us)
5. [What the code is today](#5-what-the-code-is-today)
6. [The architecture](#6-the-architecture)
7. [The design, system by system](#7-the-design-system-by-system)
8. [The build: one continuous workstream, in order](#8-the-build-one-continuous-workstream-in-order)
9. [Testing and proof](#9-testing-and-proof)
10. [Performance budget](#10-performance-budget)
11. [Risks](#11-risks)
12. [Bugs to fix on the way](#12-bugs-to-fix-on-the-way)
13. [Still open (small)](#13-still-open-small)

---

## 1. The goal, in one page

**The loop:**

1. Drop from a ship that starts off the map.
2. Land with your two chosen hacks.
3. Grab a gun in seconds.
4. Move through a dense neon city by street, interior, wall and roof.
5. Fight.
6. Fuse duplicates into better guns and hacks.
7. Rotate vertically as sectors of the city decay away.
8. Take the capture zone in the last sector, or be the last squad.

Die once and you get a 1v1 comeback. Die again and you become a ghost: you stay with your squad, scout, and
follow them to be revived, up to twice.

**What a player should feel:**

- **Moving is fun on its own.** Double jump, wall run, fast climbing, slide tech, dash, slam, leap and
  grapple through a city built for them.
- **A fight is a tracking duel with room to outplay.** It is long enough to escape, reposition and come back,
  but it is never a bullet sponge.
- **There is little to learn and much to master.** Ten guns in five families, ten hacks, no attachments, no
  ammo to manage.
- **Losing does not mean leaving.** A comeback, then ghost and revive, so a beginner playing with a
  100-hour friend stays in the match and keeps helping.

**The two tests every decision answers to** (brief, sections 57 to 59):

- **The first-timer test.** A first-timer joining a 100-hour friend can find a gun, shoot someone, use a hack,
  survive a few minutes, understand their death, come back and help.
- **The veteran test.** A 500-hour player is still finding faster routes and new plays.

---

## 2. What is preserved

- **The frozen build.** The whole Apex-era game (Milestones 1 to 182) is the git tag **`apex-era-final`**. It
  is pushed, and it was live on the game server and on Pages on 2026-09-26.
- **Unfinished work** is on the branch **`wip/follower-graph`**.
- **The legacy game stays in the running code.** It is reached with `?game=legacy`. Nothing is deleted;
  SpeedKills is built beside it on the same machinery.
- **To go back:** `git checkout apex-era-final`.
- **Test state at the freeze.**
  - verify, rules and fit pass.
  - E2e batches 1 and 3 pass.
  - Batch 2 fails one known flake, bot squads keeping together (cause found).
  - Three more checks flake at times (see `docs/TEST_AUDIT.md`).
- **Two of the owner's local files were not committed:** `9.19.26-PROGRESS.MD` and `.map-expansion.js`. They
  are the owner's to commit. A personal email draft was left out of the repository on purpose.

---

## 3. The owner's decisions

Asked and answered on 2026-09-26. These are fixed unless the owner changes them.

| Topic | Decision |
|---|---|
| How hacks are got | **Both.** Pick 1 mobility and 1 utility hack before the match. In the battle royale, hacks on the floor fuse (a duplicate) or swap. Arena modes use your picks. |
| Knockdowns | **None.** At zero health you die. The Gulag and the ghost are the second chances. |
| Ghost revives | **Limited to 2 a match.** A third ghosting is final. |
| Baseline movement for everyone | **Double jump, wall run and wall kick, slide with its tech (lurch, superglide, tap-strafe), auto-climb and mantle.** Plus the city and verticality as the heart of the game. |
| The hacks | **Ten:** Dash, Slam, Leap, Grapple (mobility); Heal, Armor, Wall, Invisibility, Reveal, Mine (utility). |
| Guns | **About 10, sci-fi originals**, two per family, built on the existing gun code and restyled. |
| Gun names | **The owner's friends for five of them:** USSO (the fast, harder-to-control SMG), ANAKIN (the slower, easier SMG), BIGANTLER, PANDA, and BOOG (the sniper, where one headshot always kills). The rest get interesting futuristic names. |
| Ammo | **Infinite reserve.** Reload forever; never pick ammo up. |
| Fusion | **A gun on the floor is level 0; each of five fusions adds 2% damage and 10% magazine**, to +10% damage and +50% magazine at level 5. Reload and recoil improve too. |
| Endgame | **A capture zone** in the final sector. Hold it with your squad to win, or be the last squad standing. |
| Zone | **Sector decay.** The city is split into sectors drawn plainly on the map and in the world. They are announced, then decay in waves from the edges toward a final sector. |
| Match length | **About 6 to 7 minutes for now**, to be adjusted later. |
| The centre | **The middle sector is the biggest and the hottest drop:** the most loot and the best of it, where bots land most. The decay closes toward it more often than anywhere else, so landing there means less early rotating. |
| Match size | **Up to 30 players, in trios by default**, with bots filling the empty seats. |
| The city | **About 500 m square, neon night.** |
| Time to kill | **Longer, Hyper Scape-like:** about 1.3 to 1.8 s at close range with good tracking. |
| Ghost revive spot | **Where they died:** an echo marker. A teammate goes there and holds interact while the ghost follows them. |
| What a ghost can do | **Move freely and fast, ping and mark, see enemies near it. Nothing offensive:** no shooting, pickups or hacks. |
| Landing | **Your two picked hacks, no gun.** Guns are dense near every landing spot. |
| The dropship | **It starts off the edge of the map and flies at least 5 s before the doors open**, so the world finishes loading behind it. Its line moves outward from the centre to allow for that. |
| Default game on the live site | **SpeedKills, right away.** Legacy stays at `?game=legacy`. |
| Assets | **Free and CC0 until SpeedKills is fully built.** After that, up to **$50** of paid packs where they would clearly help, to be the owner's purchase. |
| How the work is done | **A single agent**, working continuously through the plan, with no multi-agent workflows. |
| Menu | **PLAY:** Battle Royale (solo, duos, trios) and Arena (1v1, FFA, TDM, a rotating mode). **TRAINING:** Firing Range, Run, Advanced Run and the Tour. Other modes are hidden, not deleted. |
| Arena maps | **Small vertical arenas cut from the city's look:** rooftops and towers. |
| Camera | **First person by default.** Third person stays a setting. |

---

## 4. Gap analysis: Hyper Scape as it was left, and us

**How Hyper Scape ended.** It launched on 11 August 2020, and by October 2020 Ubisoft had said it "failed to
meet the expectations from players". The last content update was in April 2021, it never passed Season 3, and
the servers closed on 28 April 2022. What follows is the game as it stood at that last update. "Us" means this
codebase today. The last column is what SpeedKills does, with the owner's simplifications applied.

### 4.1 The systems

| System | Hyper Scape as left | Us today | SpeedKills (the gap to close) |
|---|---|---|---|
| **Map** | Neo Arcadia: one large futuristic city, dense and vertical, with interiors and roofs. Critics said much of it looked the same. | Outskirts: 440 m of low desert places, ridges and sand. The weakest part of the project. | A **new 500 m neon-night city**. It has six to eight districts, each with its own colour accent and a landmark, so it does not all look the same. Towers are 6 to 16 storeys, with walkways, bridges, a transit viaduct, plazas, alleys and an underground passage. Every tall building has a way up inside and outside. |
| **Movement** | Fast sprint, a baseline double jump, lower gravity feel, precise air control, fast ledge climbing, jump pads across the city, no fall damage. | Apex's measured movement: slide, lurch, tap-strafe, superglide, mantle, climb, wall bounce. Double jump and wall run exist as an opt-in. Launch pads, ziplines and balloons. | **Everything we have, plus HS's lightness.** Double jump, wall run, auto-climb and mantle for everyone. No fall stun. Faster climbing. Launch pads and jump towers throughout the city. A gravity and air-control overlay tuned in a movement lab. This is the star of the game (section 7.2). |
| **Hacks** | Eleven, found on the floor, two slots, fused for shorter cooldowns: Teleport, Slam, Ball, Mine, Armor, Invisibility, Reveal, Shockwave, Magnet, Heal (a squad healing area), Wall. | Six kits of tactical, passive and ultimate. Ours: JOLT (dash), GRAPPLE, PATCH, PULSE, SMOKE, WALL. | **Ten:** Dash, Slam, Leap, Grapple, Heal, Armor, Wall, Invisibility, Reveal, Mine. Ball, Shockwave and Magnet are dropped as the ones least liked. Grapple and Leap are ours. Pick 1+1 before the match, and they fuse or swap on the floor. No passives, no ultimates. |
| **Guns** | About ten sci-fi guns: Ripper (AR), Harpy (SMG), Mammoth (shotgun), Protocol V (sniper), Dragonfly, Hexfire (a gatling), Komodo and Salvo (launchers), Skybreaker (an energy cannon), Riot One and D-Sink (pistols). Criticised as unbalanced. | Thirty Apex guns with attachments, hop-ups and magazine tiers. | **Ten originals in pairs** with obvious identities (section 7.3), including the owner's friends' names. No attachments. Each gun is tuned against a TTK table so no gun is a trap. |
| **Fusion** | A duplicate raised a gun five levels. Most gained magazine size, with a damage bump at the top level. Sniper and cannon levels were all damage. Hacks fused for cooldown. | Milestone 179: the magazine goes up a level, empty attachment slots fill, and it brings ammo. BR only; bots never fuse. | **Levels 1 to 5 for guns:** +50% magazine and +10% damage at the top, faster reload, less recoil. Hacks fuse to four levels of shorter cooldown. A higher-level copy upgrades yours to its level. Bots fuse too. |
| **Ammo** | Infinite reserve. | Six typed ammo kinds, stacks, a pouch. | **Infinite reserve.** Loot is guns and hacks only. |
| **Health** | 100 health. No armour loot; the Armor hack. Regeneration and the Heal hack. | Health, EVO shields, armour tiers, helmets, knockdown shields, five heal items. | **100 health and 50 shield.** The shield comes back on its own after a few seconds out of damage. Health comes back slowly, and fast with Heal. No heal items, no armour loot (section 7.6). |
| **Death** | No knockdowns. An eliminated player becomes an **Echo**: invisible to enemies, able to scout and ping, unable to shoot. Restore points appear where enemies die. The Echo stands on one and a squad mate revives them. | Knockdowns, bleed-out, revive, Gulag (first death before ring 4), Deathbox Respawn, beacons, Resurgence. No explicit state machine; eight ways states can contradict each other. | **No knockdowns.** The first death goes to the **Gulag** (a short 1v1). A later death makes a **ghost**: invisible to enemies, fast, scouting, pinging, and able to see enemies near it. A teammate revives the ghost at its echo marker (where it died) in 5 s, or 3x as long if the ghost is not following them. Two ghost revives a match. All of this runs on one **pure state machine** with an epoch, so no contradictions. |
| **Zone** | **Decay:** sectors of the city phase out from the edges, district by district, and staying in one hurts. | A circle ring with Storm Surge. | **Sector decay:** a grid over the city (about 100 m sectors). Decaying sectors are announced, then their buildings dissolve floor by floor, their collision goes, and they damage anyone inside. Waves run toward a final sector. The schedule is computed from the seed on every browser. |
| **Endgame** | A crown appears once the last sector is left; hold it 30 to 60 s to win, or be the last one standing. | Crown and Control exist as arena modes. | **A capture zone** in the final sector. Hold it with your squad to fill a meter and win, or be the last squad. Built from our Control mode. |
| **Players** | Up to 100, trios. The population collapsed within months. | Up to 12 in a BR (bots and friends). | **Up to 30, trios by default,** with bots in every empty seat. A match always has a full lobby. |
| **Drop** | Players spawned falling over the city and chose where to go. | A dropship on a line over the map; the doors open about 2 s in. | **Our dropship,** starting off the map's edge and flying at least 5 s before the doors open so loading finishes behind it. Then the skydive and glide we have. |
| **Twitch** | Viewer voting on match modifiers. | None. | **Not planned.** It was HS's marketing bet, not its gameplay. |
| **Onboarding** | Thin. New players were deleted by veterans. | A tour, two movement courses and a range. | **An eight-step tour**, practice as core, and bots that teach (section 7.13). |
| **Bots** | None. | Four tiers that loot, fight, squad, ride ropes and pads, and play objectives. | **Five tiers** (beginner to extreme). Floor-aware navigation in the city. Bots fuse, use hacks and play the capture zone. |
| **Controller** | Supported; aim assist tuning was criticised. | Pad support with presets, curves, aim assist (slowdown and rotational) and advanced tuning. | **First class:** everything in config, an outer deadzone, curves, per-optic ADS, an aim assist with distance falloff and no snapping, and tested defaults (section 7.11). |
| **Look** | Bright stylised daylight city. | Textured desert, real clothes on real bodies. | **Neon night:** dark architecture, emissive trims in cyan and magenta, holographic signs of our own, bloom on in every quality preset. Our own names, UI and art throughout. |

### 4.2 Why Hyper Scape struggled, and what SpeedKills does differently

| HS's problem | SpeedKills' answer |
|---|---|
| TTK too long for how mobile players were | Longer than Apex, as the owner chose, but held to a measured band (1.3 to 1.8 s close, good tracking), checked against movement speed so a fight can be won and escaped. It is tuned in play, and if fights feel spongy they come down. |
| Unbalanced guns | A TTK table per gun, level and range as a check, and a clear role for each pair. |
| Much of the map looked alike | Districts with distinct colour, architecture and landmarks, and callouts named after them. |
| Empty servers | Bots fill every match; 30 is the design size, not 100. |
| New players deleted by veterans, then bored | Gulag, then ghost with two revives; teaching bots; an eight-step tour; practice modes as core. |
| Little to do after dying | The ghost scouts, pings, sees enemies and speeds up its own revive by following. |
| Bland cosmetics | Out of scope until the core is excellent (brief, section 45). |

---

## 5. What the code is today

From four read-only passes on 2026-09-26. The short version: **the machinery is general, and the design is
written into lists, branches and single-map constants.**

**Weapons.**
- `resolveWeapon` (`src/game/weapons.ts:280`) makes every gun from `data/weapons.json` and
  `weapon-mechanics.json`. Recoil, spread, weapon state, projectiles and the view model never branch on an id.
- The choice of guns sits in about **15 hand-written lists**: `loot.json`, `br.json`, `modes.json`,
  `rules.json`, `rangetools.json`, `bots.ts` `BOT_WEAPONS`, `loadouts.ts`, several places in `main.ts`, and
  fallbacks in `duel.ts` and `killcam.ts`.
- `net/hitcheck.ts` builds its set of legal guns from `weaponIds()`, so host and guests must agree on the
  roster.

**Attachments.**
- Attachments reach into `main.ts` (58 references), `loadout.ts` (47), `loot.ts` (41), the HUD, the bots' kit
  and the network's item check.

**Abilities.**
- Six kits, but one `AbilityId` means both a kit and its tactical.
- Every ability is an if-chain in `main.ts`: use, ultimates, HUD, pick keys, passives, and others' effects.
- The per-match tuning channel (`MatchRules.abil`) is already the right shape.

**Movement.**
- `movement.json` becomes `MOVE` once, at import. `player.ts` is 2,139 lines of it.
- Double jump and wall run are a per-player lobby setting, not part of the match's rules.

**Input.**
- Good pad and mouse support, but some pad numbers are literals in code.
- The aim assist has no distance falloff.

**Life, the battle royale and the network.**
- Life is a dozen booleans across `duel.ts`, `brmatch.ts` and `main.ts`. Only the Gulag is a state machine.
- Each player's browser decides its own death. State packets travel on an unordered channel, events on an
  ordered one.
- New optional state fields can be appended without a protocol change.
- `modes.ts` `Crown` and `Control` are pure and reusable.

**Maps.**
- Outskirts is `buildBrMap`, 2,862 lines in `br.ts`, wired in by `BR_*` constants in about 30 places.
- **Collision is a linear scan of one global box list**, which a dense city cannot afford.
- Bots navigate a graph that ignores height and cannot jump or climb.
- The HUD map hides anything over 2.5 m.
- The arenas already use the right pattern: pure map information plus a builder.

**UI.**
- The menu is 14 cards in `index.html`, held in step with `lobby.ts` by `checks/lobby.ts`.
- The HUD is one 2,882-line canvas file, and the **e2e reads its state, not its pixels.**
- The public build may not contain the word "Apex" (`tools/beta-check.ts`), so the old game is **legacy** in
  code.

---

## 6. The architecture

**One switch.** `src/game/game.ts` (done) sets `GAME`, which is `"legacy"` or `"speedkills"`. It is read from
the URL, then from the browser's last choice, then from the build default. The default becomes `speedkills`.
It is read once at startup and applied with a reload, the way the graphics preset is. Only the active game's
battle royale map is built.

**Per-game profiles.** `src/config/games/legacy.json` and `speedkills.json` (done, to be extended) say what is
in play and where the design differs. Numbers describing a thing stay in that thing's config.
`tools/checks/games.ts` (done, 34 checks) holds each profile to naming only things that exist.

**Registries replace lists and if-chains:**

| Registry | Replaces |
|---|---|
| Roster: `weaponIds()` returns the active game's guns; `allWeaponIds()` returns the catalogue | the 15 id lists |
| Hack registry: `AbilityDef { id, slot, name, icon, cooldown, knobs, use, remoteFx, bot }` and a generic per-slot `Abilities` | the if-chains in `main.ts` and `abilities.ts` |
| Movement profile: `buildMove()` and `applyMoveProfile(overlay)` | the one `MOVE` built at import, and the local extra-moves flag |
| BR map registry: `src/game/brmaps/` holds pure info plus builders, `outskirts` and `city` | `BR_*` constants, `ring.json` bounds, the single `brMap` |
| Life: `src/game/lifecycle.ts`, a pure transition table with an epoch | a dozen booleans |

**The network.**
- The game id and map id go in every welcome and invite. A guest on the other game reloads into the host's.
- The life state and its epoch are appended to the state packet.
- Decay and the capture zone ride the host's existing ring packet.
- Nothing is rewritten.

**Legacy parity.** With `?game=legacy`, every existing check must still pass. That proves the switch changed
nothing it should not.

---

## 7. The design, system by system

Numbers are starting values in config, each with a note, and all are tuned in play.

### 7.1 Identity

- **Name and look.** SpeedKills, tagline "Move fast. Aim true." Neon night: dark blue-grey architecture,
  emissive trims in cyan (#20e0ff) and magenta (#ff2e9a), and holographic signs and billboards of our own.
- **Title and HUD.** A new title card built on the intro's machinery, a HUD theme in the same accents, and our
  own graffiti word.
- **Sound.** The recorded guns and footsteps stay. A synthwave drop theme and city ambience come from CC0
  sources.
- **Rules check.** It refuses "Hyper Scape", "Neo Arcadia" and "Ubisoft" in shipped text, as it already
  refuses "Apex".

### 7.2 Movement: the star

**The baseline for everyone**, from the owner's list:

- **Double jump:** a second jump in the air, with a short window to steer.
- **Wall run and wall kick:** run along a wall at speed, kick off it for height and distance, and chain
  wall to wall.
- **Slide and its tech:** slide, lurch, superglide and tap-strafe, the ceiling that exists today.
- **Auto-climb and mantle:** faster than now. A wall you run at is climbed without a key, and a ledge is
  mantled at speed.

**The SpeedKills overlay** on today's measured numbers:

- no fall stun;
- faster climbing (Hyper Scape's ledge climb was quick);
- a little more air control for the double jump;
- gravity and jump height tuned for the city's storey height (about 4 m) so that a double jump plus a
  climb reaches the next floor of a balcony.

**The movement lab.** A training space in the range where the overlay is tuned and measured:
- a wall-run corridor;
- a set of climbs at storey heights;
- a double-jump gap course;
- a launch pad and tower loop;
- a roof-to-roof line.

**Targets, written as checks** (from `tools/movesim.ts`), such as:
- reach a 2-storey ledge from a standing start with double jump and climb;
- cross a 12 m street gap roof to roof with a run, double jump and wall kick;
- no chain may exceed a maximum speed without a decaying cap, so movement stays readable.

**Why it feels good:** momentum is kept through every transition (slide into double jump, wall run into
kick, climb into mantle into sprint), and every piece has a sound and a camera cue.

### 7.3 Guns: ten originals

Two per family, each pair a hard-hitter and a fast one. Built on existing guns and restyled with sci-fi
models. Owner's friends' names are in capitals as given; the rest are ours.

| Family | Gun | Built on | Identity |
|---|---|---|---|
| Rifle | **PANDA** | `vinson` | the heavy rifle: slower, hits hard, steady at range |
| Rifle | **ZEPHYR** | `rspn101` | the fast rifle: quick fire, light recoil, forgiving |
| SMG | **USSO** | `r97` | the fastest gun in the game: melts up close, **hard to control** |
| SMG | **ANAKIN** | `alternator_smg` | the steady SMG: slower, **easy to control**, hits harder a round |
| Shotgun | **BIGANTLER** | `mastiff` | a wall of pellets, slow: one big hit |
| Shotgun | **RIPTIDE** | `shotgun` | fast handling, lower per shot: sustained |
| Marksman | **HELIX** | `3030` | lever action; a charged shot hits hard: patience |
| Marksman | **PULSAR** | `g2` | fast semi-auto: rhythm |
| Sniper | **BOOG** | `sentinel` | bolt action; **a headshot always kills, at any fusion level and any health** |
| Special | **NOVA** | `lstar` | an energy beam gun with no reload that overheats instead: suppression |

**No attachments.** Each gun has one fixed optic: 1x on the SMGs and shotguns, 2x on the rifles and NOVA,
3x on the marksman guns, and a 6x scope on BOOG.

**Recoil.** Predictable and learnable. Each gun's pattern scale sets its difficulty (USSO the hardest, ANAKIN
among the easiest), and every pattern stays a pattern: never random past its spread.

**Models.** New sci-fi silhouettes built on the procedural gun models, so each family reads at a glance.

### 7.4 Time to kill

- **Target:** 1.3 to 1.8 s at close range against 150 (100 health and 50 shield) with good tracking, at level 1.
  Longer at range for the close-range guns.
- **BOOG** breaks the band on purpose: a headshot is a kill, a body shot is not.
- **A check** (`tools/checks/ttk.ts`) computes every gun's time to kill at every fusion level and range band,
  and holds each gun's close-range figure inside its family's band. It also holds level 5 at most 10% quicker
  than level 1, and stops any gun from dominating its pair everywhere.

### 7.5 Fusion

| Level | Damage | Magazine | Reload time | Recoil |
|---|---|---|---|---|
| 0 (as found) | 1.00 | 1.0 | 1.00 | 1.00 |
| 1 | 1.02 | 1.1 | 0.96 | 0.96 |
| 2 | 1.04 | 1.2 | 0.92 | 0.92 |
| 3 | 1.06 | 1.3 | 0.88 | 0.88 |
| 4 | 1.08 | 1.4 | 0.84 | 0.84 |
| 5 | 1.10 | 1.5 | 0.80 | 0.80 |

- **BOOG** fuses its body damage and handling only; its headshot is already a kill.
- **NOVA** fuses its heat capacity where others fuse the magazine.
- **Picking up a gun you already hold** raises yours one level. A copy of a higher level than yours raises
  yours to that level.
- **Hacks fuse** to four levels, each 10% off the cooldown.
- **The HUD** shows each gun's level as pips, and the floor shows a gun's level by its colour.

### 7.6 Health, healing, ammo

- **100 health and 50 shield.**
- **The shield** starts coming back 4 s after the last damage, and is full 3 s later.
- **Health** comes back slowly after 8 s without damage, and quickly inside a Heal hack's area.
- **No heal items and no armour loot.** This is our simplification, not the owner's words. The owner said
  loot should be a gun and a hack, never homework; this is the whole of how health works, and it can be
  changed.
- **Ammo:** infinite reserve. Every gun reloads forever, and NOVA cools down instead.

### 7.7 Hacks: ten, in two slots

Pick one of each slot before the match. In the battle royale, hacks on the floor fuse (the same hack) or
swap (another of the same slot).

| Slot | Hack | What it does | Counterplay | Built on |
|---|---|---|---|---|
| Mobility | **DASH** | a fast blink of about 8 m the way you look | a streak and a sound; it does not go up | JOLT |
| Mobility | **SLAM** | up into the air, then down onto a spot, damaging whoever is under it | you are visible and committed in the air | new, on the throw arc and blast code |
| Mobility | **LEAP** | straight up about four storeys, then glide | loud, and a target in the air | the launch pad's impulse |
| Mobility | **GRAPPLE** | a line to a surface up to 35 m that pulls you in | a visible line; a straight, predictable path | the grapple, made a continuous pull |
| Utility | **HEAL** | a healing area on the ground for you and your squad | it holds you in one place | PATCH and the MEDIC's field heal |
| Utility | **ARMOR** | 3 s of 60% less damage, moving slower | it runs out; you are slow and obvious | new, a damage scale and a speed scale |
| Utility | **WALL** | a barrier where you aim | it can be broken or gone round | WARD's wall |
| Utility | **INVISIBILITY** | about 5 s nearly unseen, which firing ends | a shimmer up close, footsteps, and it ends when you shoot | new, a figure shader |
| Utility | **REVEAL** | shows enemies in a wide cone through walls for a few seconds | the revealed are told | SCOUT's pulse |
| Utility | **MINE** | a proximity mine that homes in on an enemy close by | visible and audible; can be shot | new, on the throwables code |

- **Each hack** has an obvious look and sound, one number that matters, and a cooldown in config.
- **Bots** use every hack from the Skilled tier up.
- **One-slot rule:** you carry one hack per slot, so a squad reads each other's kit at a glance.

### 7.8 Life, death and return

**The state machine** is `src/game/lifecycle.ts`, a pure table:

```
ALIVE --first death--> GULAG --won--> ALIVE
                       GULAG --lost--> GHOST
ALIVE --later death--> GHOST            (if the squad has someone alive and revives are left)
ALIVE --later death--> ELIMINATED       (otherwise: solo, no squad mate up, or two revives used)
GHOST --revived--> ALIVE
GHOST --squad out--> ELIMINATED
```

**How it works:**
- An event not legal in the current state is dropped, so no contradictory states are possible.
- Each transition has an epoch in the state packet, so a late packet cannot undo a newer state.
- The victim's browser owns its life, and the host reads it.

**The Gulag** keeps today's rules: a short, symmetrical 1v1 with the same guns, one trip, first death only.
- While a player is in it, their squad and the host count them as neither up nor out. Today a Gulag player
  counts as up, which is a bug.
- A loss is a transition, not a second elimination.

**The ghost:**
- invisible to enemies;
- moves fast and flies through players;
- sees enemies within about 25 m, pings and marks them, and hears the squad;
- cannot shoot, pick up or use hacks;
- is drawn as a translucent figure, to the squad only.

**The revive:**
- A squad mate holds interact at the ghost's **echo marker**, where it died. The marker is in the world and
  on the squad's map.
- Base time is 5 s. The ghost's own browser runs the progress: full speed within 12 m of the reviver, a third
  of that otherwise.
- The HUD tells the ghost "Stay with your teammate to revive faster" and shows the rate.
- A hit on the reviver pauses it.
- Each player has **two ghost revives a match**.
- The reviver is credited only when the ghost confirms, which fixes a credit bug.

**Solo:** the first death goes to the Gulag; the second is out.

**A squad is out** when none of it is alive or in the Gulag.

### 7.9 The city

**Size and layout.**
- A square of about 500 m, placed in its own part of the world.
- Districts (six to eight), each with a colour accent, an architecture and a landmark seen from anywhere.
  Working names: the Spire (the core towers), Neon Row (markets and signs), the Stacks (dense housing), the
  Yards (transit and depots), Harbor Glass (offices on water), the Circuit (a raised racetrack loop), the
  Gardens (terraces), Old Town (low brick with neon).

**Buildings.**
- Towers of 6 to 16 storeys at the core, mid-rises around them, and low blocks at the edge.
- Streets and alleys, elevated walkways and bridges at two or three heights, a transit viaduct, plazas, and an
  underground passage under the core.
- **Every tall building has a way up inside** (stairs, and a lift shaft that launches you) **and outside** (a
  fire escape, a launch pad, grapple points, climbable faces). So "through, over or up" is always a choice.
- Interiors are real floors with cover and windows.

**Loot.** Guns and hacks are dense enough that a player is armed within about 20 s of landing anywhere in a
district.

**Engineering.**
- The map registry.
- **A collision grid** over the box list, used by every caller that scans it today. It comes first and is
  measured.
- **Floor-aware bot navigation:** stacked nodes, nearest-in-3D, and links for stairs, ramps, lifts, pads and
  ropes.
- The HUD map by floor, with roofs drawn.
- Built with the existing building shell (`brpoi.building`), the CC0 city kit, new kit pieces from free
  sci-fi sets, and emissive neon.

**Arenas.** 1v1, FFA and TDM maps cut from the same city look: rooftops, a tower's floors, and a plaza with
walkways.

### 7.10 Decay and the capture zone

**Sectors.** Nine sectors, drawn plainly on the map (their borders and names) and in the world (a line of light along each border at street level):
- **the centre**, 200 m square, the biggest; it is the hottest drop, with the most loot and the best of it, and bots land there most;
- eight around it (north, north-east, east and so on), each with its own district accent.

**The waves.**
- A seeded plan picks the final sector (the centre half the time, else one of the eight) and the order of
  decay: the outer sectors in four waves of two, then whatever is left but the final sector.
- **The match runs about 6 to 7 minutes:** the first wave about 60 s after the landing, then one every
  60 s or so, with the capture zone opening at about 5 minutes.
- Each wave is announced with its sectors marked on the map and in the world (a colour wash and a sound),
  about 30 s ahead.

**When a sector decays:**
- Its buildings dissolve floor by floor from the bottom, over about 20 s.
- Their boxes leave the collision grid on the same schedule, the same on every browser.
- Standing in a decayed sector hurts, more with each wave.

**The capture zone.**
- When one sector remains, a zone opens in it.
- A squad that holds it alone fills a meter (about 45 s, paused when contested) and wins.
- Otherwise the last squad standing wins.
- Built from `modes.ts` `Control`, sent on the ring packet and kept in the host-migration snapshot.

**Network cost.** Only the phase goes over the wire; everything else follows from the seed.

### 7.11 Controller and aim assist

- **Pad numbers into config.** A new `gamepad.json` for the literals in `gamepad.ts`.
- **New pad settings:** an outer deadzone, a response curve exponent, and per-optic ADS.
- **Aim assist in `aimassist.json`:**
  - slowdown strength;
  - rotational strength, hip and ADS separately;
  - an acquisition radius with falloff over distance;
  - no snapping: a new target needs the stick to leave the old one's zone;
  - never through walls; never on a mouse.
- **A check proves each rule.**
- **Defaults** are tuned for tracking fast vertical targets on a stick, and every value is in Settings.
- **Fixed on the way:** the pad can pick every hack (today it can pick two of six kits), and the key
  collisions.

### 7.12 Bots

- **Five tiers:** Beginner (new: plain movement, misses, takes cover, teaches), Casual, Skilled, Advanced and
  Extreme.
- **In the battle royale they fill every empty seat** up to 30.
- **Movement:** floor-aware navigation, and the upper tiers use launch pads, grapples and leaps.
- **Loot and play:** they loot a gun first, fuse, use hacks, and play the capture zone.
- **A stuck check:** a bot with no progress for a few seconds re-plans. The one fix on `wip/follower-graph`
  is finished properly here.

### 7.13 Onboarding and practice

**The tour becomes eight short steps**, each done once to go on:
1. move;
2. double jump, wall run and climb;
3. shoot;
4. hacks;
5. loot and fusion;
6. a vertical fight (a bot on a roof);
7. decay and the capture zone;
8. dying: the Gulag, the ghost, following to be revived.

**Practice is core:** Range, Run, Advanced Run, the movement lab, and 1v1 and FFA with bots.

### 7.14 Menu and HUD

**Menu, in SpeedKills:**
- **PLAY:** Battle Royale (Solo, Duos, Trios) and Arena (1v1, FFA, TDM, and a rotating mode).
- **TRAINING:** Firing Range, Run, Advanced Run, Tour.
- The other modes are hidden. Every card's id is kept, because the e2e clicks them.

**The HUD shows only:**
- health and shield;
- the gun and its fusion level;
- the two hacks and their cooldowns;
- the objective;
- the squad (alive, Gulag or ghost);
- the next decay and its time;
- revive status.

**Settings** stay deep. The legacy widgets are simply not drawn in SpeedKills.

### 7.15 Dropship

- The line starts off the map's edge and crosses it.
- The doors open no sooner than 5 s after the ship appears, however fast the page loaded. The line is moved
  outward from the centre so the ship still reaches the city on time.
- The loading screen and the city's heavier assets finish during that flight.

---

## 8. The build: one continuous workstream, in order

A single agent works through this in order. Every item goes through the house loop: **build it, test it,
document it, commit it, ship it**, then the next.
- **Tests:** verify and rules on every change; the three e2e batches and `npm run fit` before each release.
- **Docs:** a roadmap milestone and a diary entry per shipped item.
- **Deploy:** both deploys per release.
- **When to stop:** only for a decision that is the owner's, or something destructive or outward-facing.

**Stages A to C make SpeedKills real and playable fast.** SpeedKills is the default from stage B, so the live
site shows it growing.

| Stage | What | Proof |
|---|---|---|
| **A. Foundation** | A1: the switch read at startup; `data-game` on the page; the game id in welcomes and invites. A2: the roster registry, with legacy's lists moved verbatim. A3: the hack registry in place of the if-chains (legacy kits unchanged). A4: the movement profile overlay. A5: the map registry (Outskirts behind it). A6: the collision grid. | The whole suite passes with `?game=legacy`; collision cost measured before and after |
| **B. Front door** | B1: SpeedKills identity (title, colours, title card, HUD theme). B2: the PLAY and TRAINING menu. B3: SpeedKills becomes the default, and legacy moves to `?game=legacy`. | `checks/lobby.ts` for both games; snapshots; e2e menu |
| **C. Movement** | C1: baseline double jump, wall run and faster climb, with no fall stun. C2: the movement lab. C3: movesim targets for the city's storey heights. | movesim targets; feel checks; the owner's play |
| **D. Guns** | D1: the ten guns, names and fixed optics, no attachments. D2: tuning overlays and `ttk.ts`. D3: infinite reserve. D4: sci-fi models. D5: BOOG's headshot rule. | `ttk.ts`; snapshots; e2e weapons |
| **E. Health** | 100 health and 50 shield, regeneration, no heal or armour loot. | a check of the regeneration curves; e2e |
| **F. Hacks** | F1: DASH, GRAPPLE (pull), LEAP. F2: HEAL, WALL, REVEAL. F3: SLAM, ARMOR, INVISIBILITY, MINE. F4: the pre-match pick and the pad pick. | a check per hack; e2e per hack; snapshots |
| **G. Loot and fusion** | G1: SpeedKills loot tables (guns and hacks only). G2: gun fusion 1 to 5. G3: hack fusion and swap. G4: bots fuse. G5: armed within 20 s. | `fusion.ts`; a density check; e2e `loot` |
| **H. The city** | H1: blockout of the districts, streets, towers and walkways. H2: floor-aware nav and the city bot walk. H3: interiors, ways up and launch points. H4: dressing, neon, landmarks. H5: HUD map by floor. H6: loot spots. H7: the dropship off the map. | bot walk; render budget; collision cost; snapshots of every district; e2e BR |
| **I. Life** | I1: `lifecycle.ts` and the epoch. I2: the Gulag as a state (fixes two bugs). I3: the ghost. I4: the echo-marker revive with the follow rule. I5: two revives, and squad-out. | `lifecycle.ts` check; two-tab and real-network e2e |
| **J. Decay and capture** | J1: sectors and the seeded plan. J2: announcements. J3: dissolving buildings and collision removal. J4: decay damage. J5: the capture zone. | `decay.ts`; e2e; snapshots |
| **K. Match size** | K1: up to 30 with bots filling. K2: trios default. K3: a performance pass at 30. | frame time at 30 on the laptop |
| **L. Arenas** | 1v1, FFA and TDM maps from city blocks. | arena checks; e2e modes |
| **M. Controller** | `gamepad.json`, outer deadzone, curve, per-optic ADS, aim assist rules. | aim assist checks; e2e pad |
| **N. Bots** | Five tiers, teaching bots, hacks, capture play, the stuck check. | bot tier checks; e2e |
| **O. Onboarding** | The eight-step tour. | e2e walks it |
| **P. Polish** | Audio (drop theme, city ambience, hack sounds), effects, readability, performance on low-end machines, the rules check for names. | frame budget; the owner's play |

**When the build is complete**, the owner reviews paid assets up to $50 (a list with a free alternative for
each).

---

## 9. Testing and proof

- **Legacy is the regression net.** Every existing check runs on `?game=legacy` and must pass unchanged.
- **A check for every new system**, pure where it can be: `games`, `ttk`, `fusion`, `hacks`, `lifecycle`,
  `decay`, `capture`, `aimassist`, city `bot-walk`, `render-budget` and `collision-cost`, and the movement
  targets in `movesim`.
- **E2e sections for SpeedKills** on `?game=speedkills`:
  - the menu;
  - a drop from the off-map ship;
  - arming within 20 s;
  - fusion;
  - each hack;
  - the Gulag;
  - a ghost revive over two tabs and the real network;
  - decay;
  - the capture zone;
  - a 30-player match.
- **Every new check is proven** by putting the bug back and watching it fail.
- **Tests that fail because the design changed on purpose are updated, never weakened or deleted**, with the
  reason in the commit.
- **Hands-on after each stage:** snapshots for everything visual, and the owner's own play for feel (brief,
  section 52).
- **The four known flakes are fixed** at their causes along the way: bot squads in N, the ship's glide check
  in H7, host migration in N, and the bot tiers.

---

## 10. Performance budget

Checked, not hoped for:
- **Collision:** the grid makes a move, a bullet or a sight check cost the boxes near it, not the whole map.
  There is a check on the cost.
- **Draw calls and triangles:** the render-budget check extended to the city, with instancing for repeated
  pieces, merging for static ones, and LOD for towers.
- **30 players:** bots' sensing is staggered, figures use the existing LOD, and the frame time is measured on
  the laptop.
- **Decay:** buildings dissolve with a shader and one schedule, with no physics.
- **Network:** decay and the objective are a phase on the ring packet; life is one appended field.

---

## 11. Risks

| Risk | Handling |
|---|---|
| The city is too heavy for a browser | The collision grid first; the city blocked out and measured before it is dressed; budgets as checks |
| Bots cannot play a vertical city | Floor-aware nav and bot traversal are built with the city, with a city bot-walk check |
| A long TTK feels spongy (Hyper Scape's own problem) | A measured band held by a check; tuned in play; lowered if it drags |
| The death systems tangle the netcode | One pure state machine with epochs, victim-owned, with two-tab and real-network e2e |
| Speed becomes chaos | Loud cues per hack, predictable physics, a HUD that shows only what matters, first-timer playtests |
| Flipping the default early shows an unfinished game | Stages A to C first, so the front door is SpeedKills' own from day one; legacy one link away |
| Free assets run short for a futuristic city | Procedural neon and signage, plus the CC0 kits; paid options listed for the owner at the end |
| Friends on different games | The game id in every welcome and invite; the guest reloads into the host's game |
| Scope | Stages in order, each shipped; the owner can stop or redirect at any stage |

---

## 12. Bugs to fix on the way

The passes found these. Each is fixed with the system that replaces it, or sooner if it hurts legacy.

1. A late state packet can "respawn" a dead player on others' screens. Fixed by the lifecycle epoch (I1).
2. A player in the Gulag counts as up to their squad and the host (I2).
3. Losing the Gulag is a second elimination: a feed line naming "PLAYER 991", a second death box (I2).
4. Two revivers at once: either one stopping clears the other (I4).
5. The reviver is credited before the revive is confirmed (I4).
6. Box-respawn lockouts are counted separately on each browser (legacy; A).
7. A respawn message is accepted from anyone (I1).
8. `revivedBy` is not cleared on death (I1).
9. The pad can pick only two of six kits (F4).
10. Key collisions: ultimate and zoom on Z; picks 3 and 4 on the emote and spray keys (F4).
11. Extra moves are per player, not per match (A4).
12. Backpacks and knockdown shields sent over the network are thrown away (A, legacy).
13. `bots.json` has its `_squads` note twice (N).
14. A follower bot can strand itself upstairs (N).

---

## 13. Still open (small)

These do not block the build. Each proceeds as written unless the owner says otherwise.

- **Health model** (7.6): 100 health and 50 shield with regeneration and no heal items. This is my
  simplification of "loot is a gun and a hack".
- **The five non-friend gun names:** ZEPHYR, RIPTIDE, HELIX, PULSAR, NOVA. Renamed in one config file.
- **District names** (7.9): working names.
- **Capture hold time** (about 45 s) and **ghost sight range** (about 25 m): starting values, tuned in play.
  The match length is the owner's: about 6 to 7 minutes.

**Approved 2026-09-26**, with the numbers above. Work runs from stage A to P without stopping.
