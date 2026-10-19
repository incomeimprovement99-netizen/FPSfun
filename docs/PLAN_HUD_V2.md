# The HUD, made to look finished

The owner, 2026-10-18: "our hud is looking pretty basic, any way we can shape it up to be a bit nicer and more polished
looking? like what is on screen all the time" and "ENSURE WE USE FREE ASSETS THAT LOOK LIKE THEY ARE PAID FOR THE HUD.
COMPARE HYPER/EMPULSE/APEX AND LOOK HOW FANCY THEIR UI IS FOR THE HUD".

## What the three do (frames off their gameplay, 2026-10-18)

| Part | Hyper Scape | Apex | Empulse | SpeedKills now |
|---|---|---|---|---|
| Your vitals | A framed plate, bottom left: your name, a thin bar, kills | Slanted plates, bottom left: portrait, level, name, shield cells over health | A slanted plate: 60/100, a green bar, your name | Two bare bars and "0 HU/S STAND" |
| Squad | A plate each over yours: name, bar, kills, their two guns' outlines | A smaller slanted plate each over yours | (6v6: none) | Rows in the squad panel |
| Abilities | Bottom middle: two framed tiles in gold, the hack's picture, its name over it, the cooldown's seconds on it, the key beside | Bottom middle: the tactical's icon, the ultimate in a lit diamond | Bottom right: slanted tiles with the ability's picture, charges, the key cap under | Two outlined squares with the hack's name in text and its key |
| Guns | Bottom right: a framed plate a gun, the gun's outline in it, its rounds, the slot number | Bottom right: slanted plates, the gun's outline, rounds big, the reserve under, the ammo's colour | Bottom right: a slanted plate, rounds, the gun's outline | Two text rows and the rounds |
| Compass | A framed strip, the bearing in a plate under its middle | A strip of numbers and letters, the bearing under | (none) | A strip of numbers and letters, the bearing under |
| Counts | Top right: icons with numbers in one framed row | Top right: "5 SQUADS LEFT" and players in plates | Top middle: the clock and both teams' scores in plates | A flat box: alive, the decay's clock, kills |
| Kill feed | Text lines | Names with the gun's outline between | Name plates in the teams' colours, the gun's outline between | Text lines |
| Minimap | (none on screen) | A square, a thin frame | A square, your view's cone, the place's name under | A square, a thin frame |

What makes theirs look paid, in one line each:

- **Every element sits on a plate:** dark, see-through, a hairline edge, often a cut or slanted corner. Nothing floats
  as bare text.
- **Pictures, not words:** each gun's own outline, each ability's own picture. Words are small caps labels over them.
- **One language:** the same plate, line weight, label size and accent colours everywhere.
- **Numbers big, labels small:** the rounds, the cooldown and your health in a condensed face; their labels in
  small spaced capitals.

## What SpeedKills does with free assets

- **The guns' outlines from our own guns:** each gun's bought model drawn side-on, flat white, into a small picture by a
  tool (`tools/gun-silhouettes.ts`), so the outline on the HUD is exactly the gun in your hands. Nothing to buy, and no
  other game's art.
- **The hacks' pictures:** game-icons.net (CC BY 3.0, credited in public/icons/ATTRIBUTION.md and the README), the set
  the HUD already draws its loot pictures from. Fetched by `npm run icons`.
- **The faces:** Barlow Condensed for numbers and Rajdhani for labels, both already in the game (SIL OFL).
- **The plates, frames and glows:** drawn in code on the HUD's canvas, so they are sharp at every scale.

## The order

1. **The bottom of the screen**:
   - **Your plate:** your name and number, the shield in cells over your health, your speed.
   - **The hacks as framed tiles:** each hack's picture, its name over it, the cooldown sweeping round with its seconds,
     the key under it.
   - **The guns as framed plates:** each gun's outline, the rounds big on the one in your hands, the reserve and the
     fusion pips.
2. **The top of the screen:**
   - **The compass:** a framed strip with the bearing in a plate.
   - **The counts:** alive, the decay's clock and kills, as icon plates.
   - **The minimap:** framed, with north marked.
   - **The kill feed:** the guns' outlines between the names.
   - **The frame rate:** small, out of the way.
3. Photographed at 1080p and 720p in the range and in a battle royale, side by side with the frames above, and shown
   to the owner.

## Shipped

- **Milestone 697:** the bottom of the screen.
- **Milestone 698:** the top of the screen.
- **Left for later:** the kill feed's gun outlines between the names (the feed carries only text today), and a
  headshot flag on a kill.
