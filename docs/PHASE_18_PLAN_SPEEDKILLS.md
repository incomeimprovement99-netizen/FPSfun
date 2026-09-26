# Phase 18 plan: SpeedKills

**Written 2026-09-26.** The owner's brief, "SPEEDKILLS: major game direction transition" (62 sections), turns
the project from an Apex-inspired browser FPS into **SpeedKills**: a fast, futuristic, highly vertical FPS and
battle royale, inspired by what made Hyper Scape exciting and correcting what made it struggle. This document
is the plan for that transition. It was written after reading the brief in full and after four read-only
passes over the code (weapons and loot; abilities, movement and input; the battle royale, life states and the
network; maps, modes, UI and tests), so every claim about the code below names the file it came from.

The one sentence to hold on to, from the brief: **easy to understand, extremely difficult to master.**

---

## Contents

1. [What was preserved, and how to get it back](#1-what-was-preserved-and-how-to-get-it-back)
2. [The design in one page](#2-the-design-in-one-page)
3. [What the code is today](#3-what-the-code-is-today)
4. [The architecture: one switch, per-game profiles, shared machinery](#4-the-architecture-one-switch-per-game-profiles-shared-machinery)
5. [System by system: reuse, change, add](#5-system-by-system-reuse-change-add)
6. [The SpeedKills design, first version](#6-the-speedkills-design-first-version)
7. [The roadmap: phases 18 to 29](#7-the-roadmap-phases-18-to-29)
8. [Testing](#8-testing)
9. [Risks](#9-risks)
10. [Bugs the recon found](#10-bugs-the-recon-found)
11. [Decisions for the owner](#11-decisions-for-the-owner)
12. [What happens first, and what waits for a yes](#12-what-happens-first-and-what-waits-for-a-yes)

---

## 1. What was preserved, and how to get it back

Done on 2026-09-26, before anything else, as the brief's first priority asked.

| What | Where |
|---|---|
| The whole Apex-era game, Milestones 1 to 182 | git tag **`apex-era-final`** on `main` (commit e3fa8da), pushed to GitHub |
| That same build, live | the game server (fpsfun.duckdns.org, LIVE CHECK PASS) and GitHub Pages (`== LIVE`), both deployed from that commit through the release gate |
| Unfinished work that was only local | branch **`wip/follower-graph`** (a bot squad fix that is not ready), pushed; the diagnostics and the diary note committed on `main` |
| The server's accounts and boards | `npm run fps backup`, 2026-09-26 04:33 |

To go back at any time: `git checkout apex-era-final` (or `git switch -c apex-era apex-era-final` to work on
it), then build and deploy as usual. Nothing in this plan deletes an Apex-era system; the plan below keeps
the whole Apex design available in the running code as the **legacy** game, beside SpeedKills, for as long
as that is useful.

Test state at the freeze, recorded rather than hidden (brief section 51): `npm run verify`, `npm run rules`
and `npm run fit` pass. In the e2e, batches 1 and 3 pass. Batch 2 fails one check, the bot squads'
"each squad out of a fight keeps together", which is a known flake with its cause found (a follower bot
stranded on the Hub's first floor; `docs/updates/2026-09-25.md`). Three more checks flake now and then (BR host
migration, the bot tiers, the dropship glide); `docs/TEST_AUDIT.md` lists all four.

Three local files in `apex-range` were **not** pushed: `9.19.26-PROGRESS.MD` and `.map-expansion.js` (project
work, but committing them was blocked by the session's permissions, so they are the owner's to move or
commit), and `docs/updates/temp.txt`, which is a personal email draft and does not belong in a public repo.

---

## 2. The design in one page

**The loop** (brief section 54):

Drop, find a weapon and an ability fast, move through the city, fight, find duplicates that fuse into
upgrades, rotate vertically, fight again while the city decays around you, reach a high-mobility endgame
with an objective, win. Die once: a short 1v1 comeback. Die again: a ghost who stays with the squad and can
be brought back.

**The pillars**, each tied to the part of the brief it comes from:

| Pillar | What it means in practice | Brief |
|---|---|---|
| Movement is the star | Keep the whole measured movement model; add grapple, launch and dash as abilities; a city built to be crossed on the roofs | 38, 39 |
| Verticality is combat | A dense city of tall buildings with interiors, roofs, walkways and shortcuts; "through, over, or up" as a constant choice | 5, 30, 31 |
| Few things, deep things | About 12 guns in 2-per-category pairs, 7 abilities, no attachment ecosystem, fusion as the only upgrade | 7 to 14, 35 |
| Losing is not leaving | Gulag-style comeback, then ghost with a revive, so a beginner keeps playing | 15 to 21 |
| Low floor, high ceiling | Onboarding that teaches eight things in order; practice modes as core; bots in five tiers | 22, 25 to 29 |
| Controller is first class | Tunable aim assist, curves, deadzones, per-optic sensitivity, in config | 23, 24 |
| The city changes | Sectors of the city decay and fall away as the zone closes, instead of a damage circle | 32, 33 |
| An endgame with a choice | An objective (a crown) in the final sector: fight everyone, or play the objective | 34 |
| Readable at speed | Clean HUD, loud ability cues, predictable physics; "I was outplayed", never "what happened" | 43, 56 |
| Original | Our own city, names, sounds, UI; CC0 and original assets; no Hyper Scape or Ubisoft material | 6, 46 |

**The two tests every decision answers to** (brief sections 57 to 59): a first-timer joining a 100-hour
friend can find a gun, shoot someone, use an ability, survive a few minutes, understand their death, come
back and help; and a 500-hour player can still find faster routes, harder techniques and new plays.

---

## 3. What the code is today

The short version: **the machinery is general, the design is written into lists and branches.** The recoil,
spread, projectile, movement, networking, bots and rendering code already works for any weapon, any ability
numbers and any map geometry. What is Apex-shaped is a set of hand-written lists, if-chains and
single-map constants, and that is what the plan moves behind a game switch.

### 3.1 Weapons

- Every gun's numbers come from one resolver, `resolveWeapon(id, magLevel, attach[])`
  (`src/game/weapons.ts:280`), reading `data/weapons.json` (the extracted stats, patterns and springs) and
  `src/config/weapon-mechanics.json` for the special guns. Nothing downstream (recoil, spread, weapon state,
  view model, projectiles) branches on a weapon id.
- 30 guns: 27 in the data and 3 derived in code (`addDerived`, `weapons.ts:64-122`). Six ammo types.
- The Apex choice of guns lives in about **15 hand-written id lists**: `loot.json` (by rarity, care package),
  `br.json` (vault guard, Resurgence kit, Gulag pairs), `modes.json` (Gun Run), `rules.json` (classes),
  `rangetools.json`, `bots.ts:248` `BOT_WEAPONS`, `loadouts.ts` `DEFAULT_LOADOUTS`, `main.ts` (`LOADOUT_IDS`,
  course guns, debug figures), fallbacks in `duel.ts` and `killcam.ts`, and the course target guns.
- Catalogue tables keyed by id (ammo, audio class, gun models, mechanics, codenames) can stay one shared
  superset: a table with an entry for a gun the active game never uses costs nothing.
- `src/config/rules.json` already defines **exactly two guns per class**. That is SpeedKills' shape, today
  used only as a friends' match rule.

### 3.2 Attachments and loot

- Attachments reach everywhere: 58 references in `main.ts`, 47 in `loadout.ts`, 41 in `loot.ts`, plus the HUD,
  the bots' loot kit (`bots.ts:321-335`), the loot generator and the network's `wireItem`.
- Fusion exists (Milestone 179, `main.ts:3502-3517`, `br.json` `fusion`) but only raises the magazine level,
  only in the battle royale, and does nothing for the four guns with no magazine levels. Bots never fuse.
- The loot field is seeded and deterministic on every browser (`LootField.generate`, `loot.ts:677`); place
  tiers, spot kinds and densities are all config, and there is a density check.

### 3.3 Abilities

- Six kits (`kits.json`, `abilities.ts`): RUNNER (JOLT dash), HOOK (grapple), MEDIC (PATCH heal), SCOUT (PULSE
  scan), SMOKE (canister), WARD (wall), each with a tactical, a passive and an ultimate.
- One `AbilityId` means both a kit and its tactical. `main.ts` holds every ability in if-chains: use
  (L3058-3180), ultimates (L2987-3052), the HUD square and card (L6602-6621), pick keys (L5408-5416), passives
  (L5528-5531), and the others' effects (L3702-3810).
- The per-match tuning channel is already right: `ABILITY_KNOBS`, `tuneAbilities`, and `MatchRules.abil`
  carried to every guest (`net/link.ts:259`).
- The grapple is one instant impulse (`player.impulse`), not a pull.

### 3.4 Movement

- `src/config/movement.json` (192 lines, measured Apex numbers with notes) becomes `MOVE` in
  `src/game/movement.ts`, built once at import. `player.ts` (2139 lines) runs ship, zip, mantle, superglide,
  JOLT, sprint, slide, jumps (with fatigue, hop penalty, deadslide), wall run, double jump, climb, lurch,
  gravity and auto-mantle.
- "Extra moves" (double jump and wall run) are a **local** lobby setting (`range.move.extra`), not part of the
  match's rules, so two players in one match can run different movement.
- No runtime profile or overlay exists; JOLT is the one thing tuned at runtime (it mutates its config).

### 3.5 Input, controller, aim assist

- Keyboard and mouse: raw pointer lock, per-optic ADS multipliers, `cm/360` sensitivity, toggles.
- Pad (`gamepad.ts`): look and ADS levels, classic or linear curve, an inner deadzone, an advanced block
  (yaw and pitch rates, edge boost, ramp), seven button presets. Several numbers are literals in code (60 deg/s
  per level, pitch at 2/3 of yaw, curve exponent 1.7, thresholds), against the project's config rule. No
  outer deadzone and no per-optic ADS on the pad.
- Aim assist (`aimassist.ts`, `aimassist.json`): slowdown (hip 0.8, ADS 0.6), rotational 0.4 while there is
  input, a torso-sphere zone, 60 m range, line of sight. Never on the mouse. No distance falloff or
  per-weapon tuning.

### 3.6 Life states, the battle royale and the network

- **No state machine.** Life is a set of booleans and nullables (`alive`, `downed`, `bleed*`, `revivedBy`,
  `kdUp`, `gulag`, `gulagUsed`, `gulagIds`, `selfRedeploy`, `boxDeaths`) across `duel.ts`, `brmatch.ts` and
  `main.ts`. The Gulag itself (`gulag.ts`) is the one real state machine, and Resurgence (`resurgence.ts`) is
  pure too.
- Each player's own browser decides their knock and death (victim-authoritative); the host runs phases, the
  ring, bots and loot, and relays. Events go on a reliable ordered channel; state packets (`s`/`sd`) on an
  unordered fast one. The delta codec lets new optional keys be appended without a protocol bump.
- The recon found **eight ways states can contradict each other** today (section 10). They are the reason the
  SpeedKills lifecycle must be an explicit machine.
- Reusable for the endgame: `modes.ts` `Crown` (pure, with migration `restore`), `Control` (zones), `Search`
  (a hold-to-interact precedent), and the crown model in `modematch.ts`.

### 3.7 Maps

- The battle royale map ("Outskirts") is `buildBrMap` in `src/game/br.ts`, 2,862 lines of hand-authored
  sections, authored in map-local space under a root at `BR_X=0, BR_Z=500`. Buildings come from
  `brpoi.ts` `building()` (storeys, stairs, roof access, balconies), dressed from the CC0 city kit.
- It is hard-wired in about 30 places: `BR_*` constants in `main.ts` and `brmatch.ts`, the ring's bounds in
  `ring.json`, one `brMap` constant in `main.ts`, a camera z test that decides which map to draw.
- Collision is a **linear scan of one global list** (`RANGE_SOLIDS`) everywhere: player, projectiles, bots'
  sight, throwables, loot, the map. A dense city would make every check pay for every box.
- Bots walk a node graph that ignores height (`navgraph.ts` picks the nearest node by x and z; `br.ts:2323`
  keeps nodes from stacking). Bots cannot jump, climb or mantle. **A vertical city needs a floor-aware graph.**
- The HUD map only draws boxes under 2.5 m (`hud.ts:1677`), so roofs would not show.
- The arenas already follow the pattern to copy: pure map info (`arenas/index.ts`) plus a builder.

### 3.8 UI, menu, branding

- `index.html` holds the menu: 14 mode cards, a setup panel, tabs for Play, Friends, Loadouts, Stats, Settings
  and Controls. `lobby.ts` `LOBBY_MODES` lists the modes; `checks/lobby.ts` holds the menu and the list to
  each other.
- The HUD is one 2,882-line canvas file with about 40 widgets. **The e2e reads HUD state, not pixels**, so a
  restyle that keeps `HudState` and its getters breaks no e2e check.
- Branding is spread over `index.html` (title, loading screen, header), `intro.json` (the card's words), `hud.json`
  (loading tips), `geo.ts` (the graffiti word) and `readme-tv.json`.
- The public build must not contain "Apex" (`tools/beta-check.ts`), so the legacy game is called **legacy** in
  code and never "Apex" on screen.

---

## 4. The architecture: one switch, per-game profiles, shared machinery

### 4.1 The switch

A new pure module, **`src/game/game.ts`**, with no three.js or DOM work at import, so node checks can load it:

```ts
export type GameId = "legacy" | "speedkills";
export const GAME: GameId; // resolved once, at startup
```

Resolved in this order: the URL (`?game=speedkills`), then `localStorage["range.game"]`, then a build-time
default (`__DEFAULT_GAME__`, set in `vite.config.ts` beside `__PUBLIC_BUILD__`). The default stays `legacy`
until SpeedKills is ready to be the front door (brief section 50), then flips.

It is applied **at startup, with a reload to change it**, the way the graphics preset already works
(`main.ts:780`). The world is built once, so reading the game first means only that game's battle royale
map is ever built, which also keeps the collision list at one map's size.

A tiny inline script in `index.html`'s head sets `document.documentElement.dataset.game` and the title before
anything draws, so the page's look can follow the game (`[data-game=speedkills]` styles) with no flash.

### 4.2 The profiles

One JSON per game under **`src/config/games/`**, read through `game.ts`:

| File | Holds |
|---|---|
| `legacy.json` | Today's lists, moved verbatim: roster, classes, default loadouts, bot guns, Gun Run ladders, Gulag pairs, Resurgence kit, vault gun, range and course guns, loot's weapon tables, attachment slots, fusion (magazine only), ability set (six kits with ultimates), death rules (knock, bleed, Gulag, box respawn), map id `outskirts`, HUD theme `legacy`, menu layout `legacy` |
| `speedkills.json` | The same keys with SpeedKills' values (section 6) |

Rules for the profiles:

- **Only selection and design live in a profile.** Numbers that describe a thing (a gun's damage, a jump's
  height) stay in their own configs; a profile says which things are in play and overlays tuning where the
  design differs.
- Legacy must behave **byte for byte** as `apex-era-final` does. The proof is the existing suite: every check
  that passes today passes with `GAME = legacy`, unchanged.
- Everything a profile names is checked to exist (a gun id in the catalogue, an ability in the registry, a map
  in the map registry) by a new `tools/checks/games.ts`.

### 4.3 Registries in place of if-chains and lists

| Registry | Replaces | Shape |
|---|---|---|
| Weapon roster (`game.ts` `roster()`, `classes()`) | the 15 id lists; `weaponIds()` returns the active roster, `allWeaponIds()` the catalogue | ids from the profile; `resolveWeapon` still resolves any id |
| Ability registry (`abilities.ts`) | the if-chains in `main.ts`, `abilities.ts` `kitOf`, the HUD card | `AbilityDef { id, slot, name, blurb, icon, cooldown or charges, knobs, use(ctx), passive?, remoteFx?, bot? }`; `Abilities` becomes generic per-slot state |
| Movement profile (`movement.ts` `applyMoveProfile`) | the one `MOVE` built at import; the local `extraMoves` flag | `MOVE` becomes mutable, built by `buildMove(raw)`; a profile's overlay deep-merges and re-derives; `extraMoves` becomes a feature set in the profile |
| Battle royale maps (`src/game/brmaps/`) | `BR_*` constants, `ring.json` bounds, the single `brMap` | pure `BrMapInfo` (id, name, centre, half size, fog, ring bounds and attractors, sky weights, vault spot) plus a builder; `outskirts.ts` is today's code, `city.ts` the new one |
| Life (`src/game/lifecycle.ts`) | the booleans in `duel.ts`, `brmatch.ts`, `main.ts` | a pure transition table, section 5.8 |

### 4.4 The network

- The **game and map ids go in the welcome** (`BrWelcome`, `MatchOpts` in `net/link.ts`) and in invite links.
  A guest on the other game reloads into it or refuses to join, rather than joining with a different roster:
  `net/hitcheck.ts` builds its set of legal guns from `weaponIds()`, so mismatched rosters would reject
  each other's hits.
- The movement profile and ability set travel with the game id, which also closes the local-only `extraMoves`
  gap.
- New per-player state (the life state and its epoch) is **appended** to the state packet's optional keys, which
  the codec allows without a protocol bump.

### 4.5 What does not change

The renderer, the recoil and spread model, projectiles and hit detection, the whole movement code, the
netcode, host migration, the loot field's seeding, the bots' brains, the killcam, recap, stats, settings,
the controller stack, the release gate and the test tools. SpeedKills is built on these.

---

## 5. System by system: reuse, change, add

### 5.1 Weapons (brief 10, 11, 35 to 37)

- **Reuse:** the resolver, recoil patterns and springs, spread, ADS, weapon state, models, recorded sounds per
  class, hit checking.
- **Change:** the roster (section 6.2) through the profile. Tune each pair so its answer to "why this one" is
  obvious. Give each SpeedKills gun an original name (the codename table already exists for the public build).
- **Add:** a `fusionLevel` on the slot, the loot item and the bot kit, separate from the magazine level (the 0-4
  magazine clamps and the four no-magazine guns would otherwise block it), passed into `resolveWeapon` as
  a set of per-level multipliers from config.
- **TTK:** measured, not guessed. A check will compute each gun's time to kill against each shield level at
  each fusion level, so the pairs' identities and the brief's "sustained tracking, not bullet sponges" are
  numbers on a page before they are felt.

### 5.2 Loot and fusion (brief 12 to 14)

- **Reuse:** the seeded loot field, place tiers, spot kinds, density targets and their check, bins, care
  packages, death boxes, the existing fusion hook.
- **Change:** SpeedKills' loot tables contain guns, ability cores, heals and ammo, and nothing else. No
  barrels, stocks, lasers, hop-ups or magazine tiers. One optic per gun, fixed. Ammo simplified (section 6.4).
- **Add:** fusion levels 1 to 5 for guns and for abilities (section 6.5); a density target that a player can
  be armed within about 20 seconds of landing anywhere in a place; bots that fuse.

### 5.3 Abilities (brief 7 to 9)

- **Reuse:** JOLT (dash, with charges), the grapple (as the base of a proper pull), WALL, PULSE, the smoke
  canister, PATCH, the per-match tuning channel, the bots' ability use.
- **Change:** the registry (4.3); the pick becomes one mobility slot and one utility slot; no passives, no
  ultimates in SpeedKills (fewer things to learn; Hyper Scape had none); the controller pick, broken today
  for four of six kits, fixed.
- **Add:** LAUNCH (a vertical jump ability, from the launch pad's impulse); a continuous grapple pull; ability
  cores as loot that fuse (shorter cooldown per level).

### 5.4 Movement (brief 38, 39, 55, 56)

- **Reuse:** all of it. It is the project's strongest system.
- **Change:** a SpeedKills overlay, applied through `applyMoveProfile`, starting from today's numbers with
  double jump and wall run on for everyone (they are the city's language). Tuning passes only after the city
  exists to test in, with movesim and the feel checks as guards.
- **Add:** the grapple pull and LAUNCH as player primitives beside `jolt()` and `impulse()`; an OVERDRIVE-style
  speed multiplier of its own (it borrows `holsterBoost` today).

### 5.5 Input, controller, aim assist (brief 23, 24, 44)

- **Reuse:** everything.
- **Change:** move the pad's literals into a new `src/config/gamepad.json`; let a profile overlay pad and
  aim-assist defaults.
- **Add:** an outer deadzone; custom response curve (exponent); per-optic ADS on the pad; aim assist
  distance falloff, separate hip and ADS rotational strength, a no-snap rule (target switch needs the stick to
  leave the old target's zone), all in `aimassist.json` with notes. A check that the assist never acts
  through a wall or on a mouse.

### 5.6 The battle royale map (brief 5, 6, 30, 31, 40)

A new map, not a redecoration. Section 6.8 has the design; the engineering:

- **The map registry** (4.3), so Outskirts and the city are two builders behind one interface, and only the
  active game's map is built.
- **A spatial index for collision.** A uniform grid (for example 8 m cells) over `RANGE_SOLIDS`, used by
  every caller that scans it today. This comes before the city, measured with the existing render budget and
  a new collision-cost check, because the city will have several times Outskirts' boxes.
- **A floor-aware bot graph:** nodes may stack; the nearest node is chosen in three dimensions; stair runs,
  ramps, lifts, ziplines and launch pads are links; bots learn to use grapples and pads as the players do
  (the pad and rope code already exists for them).
- **The HUD map** draws roofs and floors by height, with the player's level shown.
- **Content** from CC0 kits (the Downtown City MegaKit already fetched; Quaternius' free sci-fi kits and
  others to be searched), emissive neon, a night sky hour, bloom on in every quality preset for SpeedKills
  (Competitive turns post-processing off today, so neon would not glow).

### 5.7 The dynamic city (brief 32, 33)

- **Reuse:** the ring's seeded plan, the host's ring packet (which already carries door states and Storm Surge),
  the doors' sync, the ring wall mesh.
- **Add:** sectors. The city is divided into blocks. Each ring phase marks sectors to decay; a decaying sector
  warns (a colour shift, a sound, the map), then its buildings dissolve floor by floor from the bottom and
  their boxes leave the collision index on a schedule every browser computes from the seed and the phase,
  so nothing but the phase needs to go over the wire. Standing in a decayed sector hurts. Scripted, not
  simulated (brief 33).

### 5.8 Life, death and return (brief 15 to 21, 41, 42)

A pure module, `src/game/lifecycle.ts`, after `gulag.ts`'s pattern, with a check of its own:

```
ALIVE --death, first--> GULAG --won--> ALIVE
                        GULAG --lost--> GHOST
ALIVE --death, later--> GHOST
GHOST --revived--> ALIVE
GHOST --squad out / match end--> ELIMINATED
```

- A transition table `next(state, event)`: an event that is not legal in the current state is dropped, which
  is what makes contradictory states impossible.
- A monotonic **epoch** on every transition, sent in the state packet, so a late packet can never undo a
  newer state. This fixes the stale "alive" race on the fast channel.
- The victim's browser owns its life, as today. The host only reads it (side-out judging, the objective,
  counts). No host-migration snapshot change is needed.
- The old booleans are kept, derived from the machine (`alive` is "has a body in the world"), so the rest of
  the game keeps working while systems move over one by one.
- **The ghost:** moves freely (no collision with players, no damage dealt or taken), sees the squad, pings,
  talks, shows as a translucent figure to the squad only. It cannot pick up, shoot or use abilities.
- **The revive:** a squad mate holds interact at the ghost's **echo point** (where they died, marked on the
  squad's map and in the world). Base time 5 s. The ghost's browser runs the progress: at full speed while
  the ghost is within a follow radius of the reviver, at a third of it otherwise, so it takes three times as
  long. The HUD tells the ghost "Stay with your teammate to revive faster" and shows the rate. The reviver is
  exposed and a hit on them pauses it.
- **The Gulag**, while in progress, is a state of its own: squad mates and the host stop counting that player
  as up (a bug today), and a loss is a transition to ghost, not a second elimination (another bug today).

### 5.9 The endgame (brief 34)

- **Reuse:** `modes.ts` `Crown`, with its numbers made a parameter rather than read from `modes.json`.
- **Add:** once the last sector remains, a crown appears there. A squad that holds it for its time wins
  outright, or the last squad standing wins. The objective travels as an optional field on the ring packet and
  goes into the host-migration snapshot.

### 5.10 UI and HUD (brief 43, 44)

- **Reuse:** the whole HUD code and `HudState`.
- **Change:** a SpeedKills theme and layout that shows only health, shield, weapon and fusion level, ammo, the
  two ability cooldowns, the objective, squad status (alive, Gulag, ghost), the zone, revive status. The legacy
  widgets (EVO, kit, hop-up progress, attachments) are simply not drawn in SpeedKills.
- **Keep:** every setting. Settings stay deep; play stays simple.

### 5.11 Menu and modes (brief 26, 27)

- **Reuse:** every mode and every card id (the e2e clicks them).
- **Change, in SpeedKills only:** the Play tab shows two groups. **PLAY**: Battle Royale (solo, duos, trios),
  Arena (1v1, FFA, TDM, a rotating mode). **TRAINING**: Firing Range, Run, Advanced Run, Tour. Other modes are
  hidden, not deleted, and can rotate in. `LOBBY_MODES`, `menu.ts` and `checks/lobby.ts` change together.

### 5.12 Bots (brief 28, 29)

- **Reuse:** the tiers, looting, squads, traversal, abilities, the vault guard.
- **Change:** five named tiers (Beginner, Casual, Skilled, Advanced, Extreme), today's four plus one below
  easy that deliberately teaches (misses, takes cover, moves plainly). Loot a gun first (they loot the
  nearest thing today, which is one suspect in the host-migration flake).
- **Add:** floor-aware navigation, fusion, grapples and launches for the upper tiers, a stuck check (bots have
  none).

### 5.13 Onboarding (brief 25)

The Tour becomes eight short steps in order, each gated on doing it once: move; jump and advanced movement;
shoot; abilities; loot and fusion; vertical combat; the zone and the objective; dying, the Gulag and the
ghost revive. Each is a small space in the range, reusing the course engine.

### 5.14 Identity and assets (brief 6, 45, 46)

- Name, title, loading screen, intro card, loading tips, HUD palette and graffiti word follow the game.
- Every new asset is original or CC0 or permissively licensed, recorded in the attribution files. Nothing
  from Hyper Scape or Ubisoft, and no copied UI or art. A rule in `tools/rules-check.ts` for the words
  "Hyper Scape", "Neo Arcadia" and "Ubisoft" in shipped text, as the public build already guards "Apex".
- Cosmetics are out of scope until the core is excellent (brief 45).

---

## 6. The SpeedKills design, first version

Everything here goes into `src/config/games/speedkills.json` and the configs it points at, with notes, and is
tuned in play.

### 6.1 Identity

- Name: **SpeedKills**. Tagline candidates: "Move fast. Aim true." / "The city is the weapon."
- Look: a night city, dark blue-grey architecture with emissive trims in two accent colours (cyan and hot
  magenta), holographic signs of our own, clean surfaces; a HUD in the same two accents.
- Sound: the recorded guns and footsteps stay; a synth drop theme and a city ambience from CC0 sources.

### 6.2 The arsenal: twelve guns, six pairs

Chosen from guns that already work in the engine, each pair with an obvious difference. Names are proposals.

| Family | Hard-hitter | Fast one | The difference |
|---|---|---|---|
| Rifle | **ANVIL** (from `vinson`): heavy full auto, strong at range | **RAZOR** (from `rspn101`): fast, light recoil, forgiving | precision against pressure |
| SMG | **HORNET** (from `alternator_smg`): slower, hits harder | **BUZZSAW** (from `r97`): very fast, melts up close | burst windows against a hose |
| Shotgun | **THUNDERCLAP** (from `mastiff`): a wall of pellets, slow | **SCATTER** (from `shotgun`): fast handling, lower per shot | one big hit against sustained |
| Marksman | **LONGSHOT** (from `3030`): lever action, charged shots hit hard | **PIKE** (from `g2`): fast semi-auto | patience against rhythm |
| Sniper | **LANCE** (from `sentinel`): bolt action, one precise shot | (none at first) | |
| Heavy | **TORRENT** (from `lmg`): a big magazine, suppression | (none at first) | |
| Sidearm | **HAMMER** (from `wingman`): hand cannon | **STING** (from `autopistol`): fast pistol | |

Each SpeedKills gun gets a tuning overlay (damage, rate, recoil scale) so the pair's identity is sharp and the
TTK sits in the band section 5.1's check sets. The legacy roster is untouched.

### 6.3 Attachments

None, in the first version. Each gun has one fixed optic suited to it (a 1x on the SMGs and shotguns, a 2x on
the rifles, a 3x on the marksman guns, a scope on the sniper). Fusion is the upgrade.

### 6.4 Ammo

**Decision for the owner** (section 11): one universal ammo for everything, generous stacks, or two kinds
(regular and sniper). The owner's earlier rule, "I don't want people running out of ammo", points at one kind.

### 6.5 Fusion

Guns: level 1 on the floor; a duplicate raises it one level, to 5.

| Level | Magazine | Reload | Damage | Recoil |
|---|---|---|---|---|
| 1 | base | base | base | base |
| 2 | +15% | -5% | +3% | -5% |
| 3 | +30% | -10% | +6% | -10% |
| 4 | +45% | -15% | +9% | -15% |
| 5 | +60% | -20% | +12% | -20% |

A level-5 gun is better, not decisive (brief 13): its TTK is at most about 15% shorter than level 1's, which
the TTK check holds. A found gun of a higher level than yours of the same kind takes the higher level.

Abilities: ability cores on the floor; a duplicate of an ability you hold lowers its cooldown one level
(to 4 levels, -10% each). A core of the other ability in the same slot swaps it.

### 6.6 Abilities: seven, in two slots

| Slot | Ability | What it does | Counterplay | From |
|---|---|---|---|---|
| Mobility | **DASH** | a short burst the way you move, 2 charges | its trail and sound give you away; it does not go up | JOLT |
| Mobility | **GRAPPLE** | a line that pulls you to a surface up to 35 m | a visible line, and you are predictable while pulled | the grapple, made a pull |
| Mobility | **LAUNCH** | straight up, about four storeys, then you glide | loud, and you are a target in the air | the launch pad's impulse |
| Utility | **WALL** | a barrier in front of you | it can be broken or walked round | WARD |
| Utility | **PULSE** | a short-range scan that shows enemies through walls | a sound and a mark the scanned see | SCOUT |
| Utility | **VEIL** | a smoke cloud to break sight | it hides you from them and them from you | SMOKE |
| Utility | **PATCH** | heal over a few seconds, cancelled by a hit | you are slow while healing | MEDIC |

One offensive ability (brief 8) is left for later, when there is a map to judge it in, rather than invented
to fill a slot. No passives and no ultimates in SpeedKills.

### 6.7 Life

As section 5.8. Numbers to start: Gulag as today (short, symmetrical, one trip, first death only);
ghost revive 5 s, three times as long away from the reviver, follow radius 12 m; a squad is out when no
member is alive or in the Gulag (a squad of ghosts is out). **Knockdowns: none in SpeedKills** (a death is a
death; the Gulag and the ghost are the second chances), which is a decision for the owner (section 11).

### 6.8 The city

- One square district about 400 m on a side, placed in its own part of the world (not overlapping the range,
  the arenas or Outskirts).
- A grid of blocks: towers of 6 to 16 storeys at the core, mid-rises around them, a low ring at the edge;
  streets and alleys between; elevated walkways and bridges between towers at two or three heights; a transit
  line on a viaduct; plazas as open fights; an underground passage under the core.
- Every tall building has a way up inside (stairs, a lift shaft that launches you) and a way up outside
  (grapple points, a launch pad, a fire escape), so "through, over or up" is always a choice.
- Named districts to call out (six to eight), each with its own colour accent and a landmark visible from
  anywhere.
- Loot concentrated so a player is armed within about 20 seconds anywhere in a district.
- Bot routes on every floor that matters.
- Performance budget set by the existing render-budget check, extended for the city.

### 6.9 The zone and the endgame

Six phases, each decaying the outermost remaining sectors; the final sector holds the crown (hold it for
its time to win) while the last sectors decay around it.

### 6.10 Modes

PLAY: Battle Royale (solo, duos, trios), Arena (1v1, FFA, TDM, a rotating mode). TRAINING: Firing Range, Run,
Advanced Run, Tour. The legacy modes remain in the legacy game.

### 6.11 Controller defaults

Look curve and speed tuned for tracking fast vertical targets; aim-assist slowdown near today's values,
rotational a little lower, with distance falloff; every value in Settings.

---

## 7. The roadmap: phases 18 to 29

The brief's order (section 49), one project phase each, each with its own plan and results document and a
roadmap milestone per shipped feature, as every phase since 11 has had. Each item: build it, test it,
document it, commit it, ship it.

| Phase | Brief phase | Name | Main items | Done when |
|---|---|---|---|---|
| **18** | 1, 2 | **Foundation** | 18.1 the game switch and profiles (legacy = today, verbatim); 18.2 the weapon roster behind the profile; 18.3 identity (title, colours, intro, HUD theme, menu groups) for SpeedKills; 18.4 fixes the recon found (section 10) | `?game=speedkills` shows SpeedKills' front door; `legacy` passes the whole suite unchanged |
| 19 | 3 | Movement | the movement profile overlay; grapple pull; LAUNCH; double jump and wall run in the profile; a traversal playground in the range | movesim and feel checks pass; a movement course for SpeedKills |
| 20 | 4 | Weapons | the twelve guns, their names, tuning overlays, fixed optics; the TTK check; recoil tuned per pair | TTK table in band; snapshots; e2e weapon sections |
| 21 | 5 | Abilities | the registry; seven abilities in two slots; HUD; controller pick; bots | a check per ability; e2e |
| 22 | 6 | Loot and fusion | SpeedKills loot tables; fusion levels 1 to 5 for guns and abilities; bots fuse; armed-in-20-seconds density | loot and fusion checks; e2e `loot` |
| 23 | 7 | The city | map registry; collision grid; floor-aware bot graph; the city's blocking, then its dressing; HUD map by floor | bot-walk, render budget, collision cost, snapshots of every district |
| 24 | 8 | Life | `lifecycle.ts`; epoch in the state packet; Gulag as a state; ghost; echo-point revive with the follow rule | lifecycle check; e2e over two tabs and the real network |
| 25 | 9 | The dynamic city | sectors; decay schedule from the seed; dissolving buildings; the crown endgame | a decay check; e2e; snapshots |
| 26 | 10 | Onboarding | the eight-step Tour | e2e walks it; a first-timer playtest |
| 27 | 11 | Bots and matchmaking | five tiers; teaching bots; bots fill any match; party and join flow | bot tier checks; e2e |
| 28 | 12 | Polish | audio, effects, UI, performance on low-end machines | frame time budget on the laptop |
| 29 | | The switch | SpeedKills becomes the default game; legacy stays behind `?game=legacy` | the owner says so |

Phases 19 to 22 can overlap once 18 is done (they touch different files). 23 is the largest and can begin its
engineering (registry, collision grid, graph) in parallel with 19 to 22.

---

## 8. Testing

- **Legacy is the regression net.** With `GAME = legacy`, every existing check must pass unchanged. That is how
  we know the switch did not break the game we froze.
- **Every SpeedKills system gets a check** in `tools/checks/`, pure where possible: `games.ts` (profiles
  complete and consistent), `ttk.ts`, `fusion.ts`, `abilities.ts`, `lifecycle.ts`, `decay.ts`, a city
  `bot-walk`, `render-budget` and `collision-cost`.
- **E2e sections for SpeedKills** run the same page with `?game=speedkills`: the menu, a battle royale drop,
  fusion, the Gulag, a ghost revive over two tabs, the decay and the crown.
- **Every new check is proven** by putting the bug back and watching it fail (CLAUDE.md).
- **Tests that fail because the design changed on purpose are updated, not weakened or deleted** (brief 51);
  the reason goes in the commit.
- **Hands-on checks after each phase** (brief 52): movement, shooting, swapping, abilities, controller, the
  battle royale, bots, death, revive, loot, UI, traversal. Snapshots for everything visual, and the owner's
  own play for feel.

---

## 9. Risks

| Risk | How it is handled |
|---|---|
| The switch breaks the legacy game | legacy's profile is today's lists moved verbatim; the whole suite runs on legacy after every step |
| The city is too big for the browser | the collision grid before the city; render and collision budgets as checks; instancing and merging as Outskirts does; the city is blocked out and measured before it is dressed |
| Bots cannot play a vertical city | the floor-aware graph and bot traversal come with the city, not after; a city bot-walk check |
| The death systems tangle the netcode | one pure state machine with epochs; old booleans derived from it; victim-owned as today; two-tab and real-network e2e |
| "Fast" becomes "unreadable" | loud cues per ability, predictable physics, a HUD that shows only what matters; playtests with a first-timer |
| Scope | one phase at a time, each shipped; the brief says not to try everything in one session |
| Assets: finding a futuristic look for free | search every CC0 source first (the project's rule); anything still paid goes to the owner as a choice |
| Two games in one build confuse friends' matches | the game id in every welcome and invite; a guest on the other game reloads into the host's |

---

## 10. Bugs the recon found

To fix in Phase 18.4 (the ones that hurt legacy too) or with the system that replaces them:

1. **A late state packet can "respawn" a dead player** on others' screens: deltas travel unordered, and a
   stale "alive" arriving after a death is treated as a respawn (`duel.ts` applyState). Fixed properly by the
   lifecycle epoch.
2. **A player in the Gulag counts as up** to their squad and the host (`enterGulag` sets `alive`).
3. **Losing the Gulag is a second elimination**: a second death message, a feed line naming "PLAYER 991", a
   second death box and killcam.
4. **Two revivers at once**: either one stopping clears the other's revive.
5. **The reviver is credited before the revive is confirmed**, and a box respawn is assumed to have worked.
6. **Box respawn lockouts are counted separately on each browser** and can disagree.
7. **A respawn message is accepted from anyone**, friend or not.
8. **`revivedBy` is not cleared on death.**
9. **The controller can pick only two of the six kits** (`gamepad.ts:252`).
10. **Key collisions**: ultimate and zoom toggle both Z; the third and fourth ability picks share 7 and 8 with
    emote and spray. And `ultimate` and picks 3 to 6 cannot be rebound.
11. **Extra moves are per player, not per match.**
12. **Backpacks and knockdown shields dropped over the network are thrown away** (`brmatch.ts:519` `KINDS`).
13. **`bots.json` has its `_squads` note twice** (the first is lost; the fix is on `wip/follower-graph`).
14. **A follower bot can strand itself upstairs** (the squads-together flake).

---

## 11. Decisions for the owner

Each has a recommendation; the plan proceeds on the recommendation unless told otherwise.

| # | Question | Recommendation |
|---|---|---|
| 1 | Abilities chosen before the match (brief 9) or found in the world (brief 14, 54)? | Both: pick one mobility and one utility before the match; in the battle royale, ability cores on the floor fuse (and can swap). A beginner starts with abilities; looting still matters. |
| 2 | Knockdowns in SpeedKills? | None. The Gulag and the ghost are the second chances, and one fewer state keeps fights fast and readable. |
| 3 | After a ghost revive, is the next death final? | No: a revived player can become a ghost again while a squad mate lives; each ghost revive takes longer than the last. The friend test favours coming back. |
| 4 | Ammo | One universal ammo, generous. |
| 5 | Ultimates | None in SpeedKills. |
| 6 | Weapon names | The table in 6.2, or the owner's. |
| 7 | The default game | Legacy until Phase 29, then SpeedKills. |
| 8 | Solo battle royale | First death: the Gulag; second: out (a ghost has nobody to revive it). |
| 9 | Paid assets, if the free search runs out for a futuristic city | The owner's choice, as always, with a free search first. |
| 10 | What happens to the live site during the transition | Keep deploying: legacy stays the default, and `?game=speedkills` lets anyone try the new game as it grows. |

---

## 12. What happens first, and what waits for a yes

**Done:** section 1 (the freeze, the tag, the pushes, both deploys).

**Next, and not destructive** (nothing changes for anyone who does not ask for SpeedKills):

- **18.1a**: `src/game/game.ts` (the switch), `src/config/games/legacy.json` and `speedkills.json` (the design
  above as data), and `tools/checks/games.ts`, which checks both profiles name only things that exist. The
  game switch is read but nothing yet acts on it, so legacy is untouched by construction.

**Waiting for the owner's yes** (brief section 61: report the architecture before major changes):

- **18.1b onward**: moving the fifteen weapon lists, the ability if-chains, the `BR_*` constants and the life
  booleans behind the profiles and registries. Legacy's behaviour is meant to be identical afterwards, and
  the suite will prove it, but these edits touch `main.ts`, `brmatch.ts`, `duel.ts`, `loot.ts`, `bots.ts` and
  the menu, so they wait for a go-ahead on this architecture.
- The decisions in section 11.
