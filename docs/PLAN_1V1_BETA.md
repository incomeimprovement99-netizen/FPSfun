# Plan: 1v1, loadouts, menus, polish, bug hunt, beta build

Every ask from the last four messages, so nothing is dropped. Grouped by area;
each has an ID, what will be done, and how it will be checked.

## Network and the 1v1 mode

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| N1 | 1v1 with a buddy by entering the same code | Peer to peer over WebRTC (PeerJS, its free public broker only introduces the two browsers; no game server, the build stays a static site). One player makes a match and gets a 5-letter code, the other types it. `?net=local` joins two tabs on one machine for testing. | e2e: two pages connect over both paths |
| N2 | One small map, 3 lanes, like the small CoD maps; fun, quick rounds | A dedicated arena, about 40 m by 60 m: three lanes split by long walls, spawns at the two ends, a middle section where the lanes open up with boxes to jump on and get over or on top of the lanes. Built away from the range so neither sees the other. | movesim: every box is reachable by jump or mantle; screenshot |
| N3 | Warehouse roof over the arena | Solid roof with beams and light strips, as on the course. | screenshot |
| N4 | B00G on the arena walls, different shades and colours, about 30% opacity so it does not distract | A second graffiti tile drawn at low contrast on the arena's walls. | screenshot |
| N5 | Round rule against camping | 20 s after a round starts, a circle lights up in the middle. Standing in it alone for 10 s wins the round (both in it: contested, nobody gains). A knock still wins at any time. Host decides. | e2e: capture wins a round |
| N6 | Seeing the other player | Their chosen operator skin holding their weapon, turned to their view, crouched when they crouch, 100 ms interpolation. Their shots draw tracers and make sound. | screenshot from both sides |
| N7 | Hits | Shooter decides hits and sends the damage; the other side applies shield then health. Right for friends; no protection against cheating. | e2e |
| N8 | Keep running when the tab is hidden | Frames keep going on a timer when the tab is in the background, so an alt-tabbed player does not freeze. | e2e runs two pages |

## Loadouts, operators, heirlooms, hands

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| L1 | Loadouts like CoD: 5 defaults, custom saved ones, remembers the last used | Loadout = operator skin, slot 1, slot 2, heirloom. Five named defaults, five custom slots you can edit and name, the last one used is remembered. A 1v1 starts with whatever loadout is selected; you can change between rounds. | verify: save and load round-trip |
| L2 | Operator model, 3 to 5 choices | Five operators built in code: the robot in five distinct looks (colours, visor, helmet, shoulder armour). The other player sees yours. | screenshot of each |
| L3 | Heirloom melee weapons like Apex, at least 3, free assets if good ones exist | Search for free (CC0 or CC-BY) knife models. Whatever is found or not, at least four built: karambit, butterfly knife, tactical kukri, and one more. Holstered, you hold your heirloom instead of fists, as in Apex. | screenshot of each |
| L4 | Melee | V is melee, as in Apex (the optic key moves to O). A swing with your heirloom or fist, short range, hits dummies, targets and the other player. | e2e / verify |
| L5 | Cooler hands | Better gloves: knuckle armour, stitched cuffs, a two-tone palette. | screenshot |

## The game itself

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| G1 | Slide starts just about instantly when running | Measure the slide start and the camera drop; make the view drop as fast as the slide begins. | movesim: slide on the frame crouch is pressed |
| G2 | Zipline superjump with the scroll wheel, exactly like Apex | Research the wiki's Superjump page and implement its rule and numbers; scroll up is jump, so a scroll spin does it. | movesim |
| G3 | Ceiling over the range as well | A warehouse roof over the whole range. | screenshot |
| G4 | Each room of THE RUN its own theme and colour | Seven palettes, walls, trim and lights per room. | screenshot |
| G5 | Finishing the course puts you back near the start, facing a TV with your time and stats | A results screen on the wall by the start, you are placed facing it; shows time, rank, best, splits and deltas, enemies. | e2e / screenshot |

## Menus and pages

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| U1 | A new UI so everything is navigable when someone visits the page | A main menu: Firing Range, The Run, 1v1, Loadouts, Settings, Controls. Each its own screen; Esc in game comes back to it. | e2e clicks through every screen |

## Quality, docs, release

| ID | Ask | What will be done | Checked by |
|---|---|---|---|
| Q1 | Everything working together | End-to-end browser test covering the page, the course, the 1v1 on both transports, the menus. | `npm run e2e` |
| Q2 | An end-to-end bug hunt, thorough and specific | Read every system against every other (holster, zipline, climb, mantle, optics, 1v1, course, menus, loadouts), list each bug found with its fix and a test where one is possible. | results doc lists them |
| Q3 | Document everything at its latest state; README with what it can and can't do, its limits, and when it would need to leave the browser | New README.md; results doc. | read |
| B1 | Beta build to push and deploy | Codenames for weapon and optic names in the public build (PROJECT_RULES section 2), the game's name out of on-screen text, `npm run build:beta`, a git repository with a first commit. Where it is pushed and hosted is your choice; nothing leaves this machine until you say. | build; a check that the beta bundle has no real weapon names |
