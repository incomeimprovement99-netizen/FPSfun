# The match against AAA

The owner, 2026-11-04: "stop for a moment to plan and do a gap analysis vs AAA game / comparisons, then implement if it
fits our speedkills use case".

The character agent's round is the soldier ([PLAN_SOLDIER_AAA_GAPS.md](PLAN_SOLDIER_AAA_GAPS.md)). This one is the rest
of a match, the lobby's side of the game: the battle royale from the drop to the end card, the HUD, the net between the
pages, the bots, and what a player keeps between matches. The owner's word that the arena modes matter less (2026-11-02)
puts the battle royale first.

The reference is Apex Legends, the closest game to SpeedKills, with Hyper Scape, Warzone, Fortnite and Valorant where they
do something Apex does not. For Apex, the evidence is the owner's own clip `pk clutch win.mp4`, frames read by Chrome
(the session scratchpad's `apexref/`), not memory alone.

## Where the match stands

Level already, checked in the code on 2026-11-04:

- **The loop:** the dropship and jumpmaster, the glide, the floor's loot in rarity rings, weapon and hack fusion, the
  decay closing the city sector by sector, care packages, the capture zone at the end, the Gulag, the echo restore,
  ghosts that still move, a recap and an end card side by side.
- **Reading a fight:** damage numbers summed per target, hit markers by tier, a knock and a kill marker, shield flares
  and shards, plates over enemies you hurt, a kill feed with the gun's outline and the headshot, directional damage
  marks, a heartbeat when low.
- **Talking:** a ping wheel and a tap ping, an emote wheel, sprays, voice chat with push to talk, captions on every cue.
- **The net:** host migration, held seats and rejoin, an echo band and the host's word on takes, delta state with
  keyframes, adaptive interpolation.
- **Settings:** binds on keyboard and pad, sensitivity by DPI, FOV, the crosshair, colour vision modes, quality presets,
  and the FPS counter (the owner's ask).
- **Between matches:** XP and levels, three challenges, the boards, records, an account that keeps them.

## The gaps

| # | Gap | AAA | SpeedKills today | Fits SpeedKills? |
|---|---|---|---|---|
| 1 | **Your damage and the net, on the HUD** | Apex's top right carries kills, assists and knocks, the damage you have dealt, and a performance line (FPS, ping, loss, choke): all in the owner's clip at 0:15 and 0:32 (2,163 damage, ping 23 ms) | The BR's top shows alive, squads and kills. The ping is measured every few seconds, but shown only on the 1v1's round line and the lobby's roster. Nothing shows loss | **Yes**, cheap. Most matches are a friend hosting from a browser, where lag is the first question |
| 2 | **No kill leader** | Apex names a kill leader to the whole lobby, and says when they go down. A target for everyone else, a crown for one | Kills count only for you, on your own page. The arena modes' board has a leader, the battle royale nothing | **Yes**. Kills are in the game's name, and bots fill most of a lobby, so a hunt for one name gives the middle of a match a story |
| 3 | **A body knocked high lies flat in the air** | Apex's bodies go down as they fall and land lying down | M1011 brings a body down, but its fall clip runs at full speed. Measured from the side: flat 256 ms after the knock, still 0.2 to 0.4 s above the street for knocks 2 to 4 m up | **Yes**, a fault: the fall lies flat as it lands |
| 4 | **Bots' hits flinch straight back on the host's page** | Every page sees a hit push the body from the side it came from | M1027 reads the side off the hit's point. The battle royale lays every host-side bot hit at the bot's middle (guests' rounds, bot on bot, the ring), which has no side | **Yes**, small: the point offset toward the shooter |
| 5 | **No match history** | Valorant and Warzone list every recent match: mode, place, kills, damage, time | The Stats tab has totals, bests and boards. A match ends and is gone | **Yes**, cheap, on the profile that is already kept and synced |
| 6 | **Sound only as sound** | Fortnite's Visualize Sound Effects rings footsteps, shots and chests round the crosshair | Captions say what was heard but not where from | **Yes**, later: accessibility, and the soundscape already places every cue |
| 7 | **No text chat** | Apex has lobby and match text chat | Voice chat, pings and emotes | **The owner's call**: friends on voice need it least, and every line a stranger types is text to clean |

Do not fit, left out:

- **Knocks, revives and finishers:** SpeedKills has no knock-down state. An enemy is out when their health is gone.
- **Ranked points and a season:** a meta loop for the owner to choose, on the game's server.
- **Matchmaking with strangers:** the game is friends by code with bots to fill, and the host is a browser.
- **Whole-match replays:** the killcam keeps what a kill needs.

## The order

1. **M1011, a body knocked in the air comes down** (built; shipping with this plan).
2. **M1012, the fall lies flat as it lands (gap 3):** the death clip and the hit zones' topple slowed, while the body is
   still in the air, so they are flat as it touches down, never at full speed into a plank in the air.
3. **M1013, your damage and the net on the HUD (gap 1):** your damage dealt under your kills. Under the FPS, the ping to
   the host (or a host's worst guest) and the state packets lost, with a warning mark when either is bad.
4. **M1014, the kill leader (gap 2):** the host counts every kill and names a leader once someone has the most, past a
   floor of kills. It tells every page, says it in the feed and the announcer, marks the leader's plate, and says when
   they go down.
5. **M1015, bots' hits from their side (gap 4).**
6. **M1016, the match history (gap 5):** the last 20 matches in the Stats tab.
7. **Sound visualisation (gap 6),** after these, with pictures first.
