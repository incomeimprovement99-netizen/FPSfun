# Plan: ability kits

Today a player picks one of two abilities: JOLT (a dash with two charges) or TRIAGE (heals twice as fast). The genre this game follows gives every character a kit instead: a tactical on a cooldown, a passive that is always on, and an ultimate that charges over the match. That kit is most of what makes one player's fight different from another's, and it is the largest slice of the genre still missing (`docs/NEXT_STEPS.md`, item 15).

The plan: turn the two abilities into the first two kits, add the ultimate meter and key they need, then add kits one at a time, each built from code the game already has. Kits are ours, with our own names. Operators stay cosmetic, so nothing is gated behind a figure.

## What exists to build on

| Piece | Where | What it gives |
| --- | --- | --- |
| The pick | `abilities.ts` (`Abilities`, the choice card), `main.ts` (the card, keys 1 and 2, the ability key) | When a pick is offered (landing, countdowns), the card, and switching it on per match (the host's setting, in the welcome) |
| JOLT | `Player.jolt`, `abilities.ts` charges, the `jolt` effect | A tactical with charges, its feel (FOV kick, roll, rumble), how the others see it (a lean on the figure) |
| TRIAGE | `healScale` in `main.ts` | A passive that scales an existing number |
| Bots' abilities | `Bot.setAbilities`, `BOT_ABILITY` | Bots with a random ability, and when they use it |
| Throwables | `throwables.ts` | An arc, a bounce and a blast, sent as effects: the base for a smoke or a launcher |
| Ziplines | `traversal.ts` `zipline()` | A rope that can be put up at runtime |
| Pings | the `mark` message, `brPlay.addMarker` | Marks the squad sees: the base for a scan |
| The HUD | `hud.ts` ability slot | Where a tactical's charges and cooldown are drawn |

## The kit

- **Tactical** (F, the ability key): a cooldown or charges. JOLT's model generalised: `charges`, `recharge`, `gap`.
- **Passive**: always on. Read by the code it changes (heal time, movement, the map), as TRIAGE is now.
- **Ultimate** (Z): a meter from 0 to 1. It fills with time (`fullAfter` seconds from empty), with damage dealt (`perDamage`), and later at once with an ultimate accelerant item from the floor. It is spent whole when used.

`src/config/kits.json` holds each kit's name, blurb and numbers, with a `_note` for where each number comes from.

## Phases

1. **The framework and the first two kits.**
   - The card offers kits. The ids stay "jolt" and "triage" underneath, so the bots, the settings and their checks are unchanged.
   - The two kits:
     - **RUNNER**: tactical JOLT; passive SURE FOOTING (no stun from a hard landing); ultimate OVERDRIVE (8 s of +25% move speed with JOLT's charges refilled).
     - **MEDIC**: passive TRIAGE; tactical PATCH (25 health over 3 s, 18 s cooldown); ultimate FIELD HEAL (60 health over 5 s for you and every mate within 10 m, each page healing its own player).
   - Plus the meter, the Z key and its bind, and the HUD's ultimate ring.
   - On the network: each use as an effect (`patch`, `ult`), so others see it and older builds ignore it. No kit code rides in the state packet: every page runs its own player's kit.
   - Bots pick a kit and use its tactical and passive, as they did. Their ultimates, and the accelerant item, come with phase 2, where a bot's rule for each ultimate is written once for all the kits so far.
   - Checks: `tools/checks/kits.ts` for the meter's arithmetic and each tactical's charges. e2e: pick each kit, use its tactical and its ultimate, and see a friend's use on the other screen.
2. **SCOUT**: tactical, a recon pulse (enemies within 40 m in front of you marked for the squad for 2 s, through the ping path); passive, footsteps marked on the compass; ultimate, a 60 m scan of the whole area.
3. **HOOK**: tactical, a grapple (an impulse toward a point hit within 30 m, with a tether that holds while the key is held); passive, a shorter zipline mount; ultimate, a zipline put up where you aim (`zipline()` at runtime, as an effect every page builds).
4. **SMOKE**: tactical, a smoke canister (the throwable arc, then a fog volume that blocks sight for bots and screens); passive, faster reloads while in smoke; ultimate, a line of three.
5. **WARD**: tactical, a shield wall (a solid that stops bullets for 10 s, `projectile.ts`); passive, a shield regenerating slowly out of combat; ultimate, a dome.

Each phase ships on its own, with its checks and docs, like host migration did.

## Risks

- **Old builds.** A kit code an older build does not know reads as "no ability" there. The effects of a new kit are new effect kinds, which an older build ignores. The mixed e2e plays the two against each other every phase.
- **Balance.** The numbers are ours and go in `kits.json` with notes, so the owner can tune them without code.
- **The bots.** Each kit needs a rule for when a bot uses it. Phase 2 writes the rule for each ultimate (at a full meter, in a fight), and each later kit adds one line of intent.
