# Results: the lobby, the figures, third person, the battle royale, the squad

The ask, in order: a 1v1 that connects right away with the creator waiting
in the map; clear next steps against Apex and the other big shooters;
animated figures (run, climb, mantle); a third-person camera with a way to
look round the character; a bots-only battle royale (one middle place, four
outer ones, roads between, a random drop shown on the map); then a buddy or
two in it; and the README and the deploy guide kept true. Everything below
is built, tested and committed, one checkpoint per piece.

## 1. The lobby

Create match puts the host into the arena at once, with the code and
"waiting for a friend" on the HUD under the compass. They run around until
the others arrive. A guest who connects is taken in too when the browser
still allows it (the Join click a moment before counts as the gesture;
opening an invite link does not, so that guest clicks Play). The countdown
starts when everyone is in. The e2e checks the host's position and the code
on the HUD after Create.

## 2. The gap analysis

`docs/GAP_ANALYSIS.md`, researched against Apex Season 30 (September 2026)
and Titanfall 2, Call of Duty, Valorant, CS2, Fortnite, The Finals, Overwatch
and Halo. Per area (movement, shooting, range tooling, match systems,
feedback, controller): what Apex has, what we have, the gap, the effort and
the value. Then what is worth taking from the others, a minimum BR against
bots with Apex's ring numbers, and twelve ranked next steps. The short
version is in `docs/NEXT_STEPS.md`.

## 3. The figures

The dummy can be built as a jointed rig: pelvis, torso, head, arms with the
gun, thighs and shins, each part baked about its own pivot (so a rigged
figure costs about three times the draw calls of a merged range dummy, which
stays merged). `setPose({ speed, stance, pitch })` drives a run cycle with a
knee bend, the crouch (pelvis down, torso forward, legs folded, and the hit
zones shrink with it), the slide lean, arms raised on a climb (legs
alternating) or a mantle, the jump tuck, the zipline hang, and the head and
the gun following the look pitch. Every transition is eased. Other players
send their stance and speed in the state packet (`st`, `sp`); the arena
bots run when they move and look at what they shoot.

Checked by screenshot (tools in the scratchpad, not the repo): fourteen
figures in every stance, armed and unarmed, and the third-person views.

## 4. Third person

X (or the Settings tab) puts the camera behind the right shoulder, pulled in
by a wall behind and pushed off the shoulder by a wall beside. Holding Alt
turns the camera round your own figure to see the skin; letting go eases it
back. Shots leave from the eye toward what the camera's centre ray hits, so
they land on the crosshair rather than parallel to it; melee the same. The
gun in your hands hides, your figure shows (rebuilt when the gun or the
operator changes), and knocked it falls. The scope overlay stays first
person. Both keys are on the Controls tab and rebindable. The e2e checks the
camera distance, the figure and the view model in both modes, and the orbit.

## 5. The battle royale

**Outskirts** (`src/game/br.ts`): 440 m square, 500 m south of the range.
The Hub in the middle (walls with a gate each side, four buildings with crate
steps to their roofs, a three-tier tower with a zipline off it, containers,
low cover); North Yard (four rows of containers, stacked at the ends, a
hut); South Depot (three open sheds on pillars with crates under them, low
walls); East Ridge (a mesa in four 2 m steps, each mantleable, a bunker on
top, a ramp of 0.5 m steps the bots can walk, a zipline down toward the
hub); West Town (six houses in alleys with crate steps, a water tower).
Roads between them on the ground, cover clusters along the spokes, forty
rocks in the field (seeded, so the same every load), posts and a lit line at
the edge, the bounds clamp behind them. The sun's shadow map and the fog are
re-aimed there and back. The whole map merges into the static batch.

**The ring** (`src/game/ring.ts`): six phases with Apex's damage per 1.5 s
tick (3, 4, 10, 15, 20, 25); waits 45/50/45/40/35/30 s and closes
60/45/35/30/25/40 s, scaled to the map; each phase closes onto a random
circle wholly inside the last (an even spread over the area). A translucent
orange wall in the world; the live ring orange and the next ring white on
the minimap and the full map; an orange edge and the cost on screen when
you are outside. Verified in a loop: six closes, the tick count, every ring
inside the last.

**The match** (`src/game/brmatch.ts`): a `Duel` subclass. You and up to 11
bots; the bots spread over the other four places first, then yours. Everyone
drops from 90 m: the full map shows the place you are dropping onto with a
pulsing marker and "DROPPING INTO ..."; the movement keys steer the fall at
9 m/s; 22 m/s terminal; no fall stun on landing; the bots fall into their own
places. The fight starts when you land. Bots walk a graph of the map's nodes
(the places, the gates, the road bends, the field corners), pick a linked
node inside the next ring when they arrive, and head for the ring's centre
when they are outside it or it is about to close on them; they fight
whoever they can see nearest, you or another bot, and the feed says who
knocked whom (grey for bot on bot). Alive and kills top centre with the
ring's clock. Out: "#N of 12", your kills and your time on the card, and you
watch the nearest bot until the menu comes back; last one standing is the
champion. Recorded as "br" in the Stats tab and on the "br:wins" board.

**Healing**, in every match: four shield cells (25 in 2.5 s) and four
syringes (25 in 4 s) per life on the heal key; a cell while the shield is
down, else a syringe; firing or aiming cancels; the item is spent when it
finishes; the kit shows under the bars.

The e2e drops in with five bots, checks the landing, the bots on the ground,
a knock, the ring's damage in a corner, a heal, and leaving.

## 6. The squad

The 1v1 tab's Create match has a mode: the arena, or the battle royale as a
squad of two or three against the bots. The host fixes the place, the bots
and the difficulty at Create, and every guest's welcome carries them. The
same codes and invite links; the same lobby. When everyone is in, the host's
countdown drops the whole squad on the same place (a drop spot each). The
host runs the bots and the ring and sends the bots as state packets with ids
from 100, so a guest draws a bot the way it draws any player; the ring goes
out twice a second with the alive count. A guest's hits on a bot go to the
host as hit messages, which applies them and credits the knock; a bot's shots
at a guest are tested on the host and sent as hits. No friendly fire. A
squad mate who goes down watches the others; when the last of the squad is
down everyone gets the placement (bots still up plus one); when every bot is
down the squad wins. The host or a guest leaving is handled the way the 1v1
handles it (the BR goes on for whoever is left, unless the host goes).

The e2e runs it over two tabs: the same place on both, both drop, the fight
starts on both when the host lands, the guest sees the host and the three
bots, the guest's knock is credited to the guest and both counts drop, a
squad mate down does not end it, the last down gives both the placement.

## 7. Verified

- `npx tsc --noEmit` clean.
- MOVESIM PASS (the air step-up kept every gate).
- VERIFY PASS: the ring, aim assist, the fire-rate floor and the rest.
- E2E PASS: 100+ checks including the lobby, third person, the BR alone
  and as a squad.
- `rules ok`; `build:beta`, BETA CHECK PASS; the server's dry run.

## 8. Still open (also `docs/NEXT_STEPS.md`)

- Sound is now the biggest gap: nothing beyond the synthesised ticks.
- No loot, helmets, Evo, downed state, revives or beacons in the BR; the
  squad is against bots only until the authoritative server.
- The figures are posed in code, not motion-captured.
- Bots cannot jump, climb or mantle: East Ridge's mesa is theirs only by its
  ramp, and a player on a roof is safe from them.
- Healing is not interrupted by damage; there are no batteries or med kits.
- The server is built and dry-run tested but not live: it needs the VM, the
  DuckDNS name (`fpsfun`) and the three firewall rules (`docs/SERVER_GUIDE.md`).
