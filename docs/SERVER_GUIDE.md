# Server Guide: the game on its own server, like Algonomics

The do-it-now guide for putting the game on a real server with its own
address (for example **https://fpsfun.duckdns.org**) instead of the
GitHub Pages link. Cost: $0. Time: about twenty minutes the first time, one
command after that.

It is the same setup Algonomics runs on: an Oracle Always Free VM, the app
under **pm2**, **Caddy** in front for HTTPS, a free **DuckDNS** name.

## 0. What the server gives you over GitHub Pages

| | GitHub Pages (today) | Own server |
|---|---|---|
| Address | `incomeimprovement99-netizen.github.io/FPSfun/` | `yourname.duckdns.org` (or any domain you buy) |
| Matchmaking (the 5-letter codes) | the free public PeerJS broker, which is sometimes down or rate-limited | **our own broker** on the server |
| Friends on strict networks (school, office, hotspot, VPN) | often "Lost the connection" | **our own TURN relay** carries the match when a direct connection is blocked |
| Online leaderboards | none | **on**: best course times, the flick drill, and win counts by name for every mode (1v1, 1v1v1, the bots, the battle royale, Gun Run, team deathmatch, Crown), in the Stats tab |
| Deploy | `npm run deploy` | `npm run deploy:server` (builds, ships, plays a test 1v1 on the live site) |

The build is the same for both. On Pages the game falls back to the public
broker by itself, so the Pages link keeps working as a backup.

## 1. Where to put it (your choice)

**Chosen: B, its own free VM.** The Algonomics box runs a live trader with
real money and is not to be touched; option A below stays for the record
only. Once the Micro VM exists: its IP in DuckDNS (section 2, the name
`fpsfun`), the relay's ports in its security list (section 3), its address
and key path in `.env.server` (section 4), then `npm run deploy:server --
setup` and `npm run deploy:server`.

**A. On the Algonomics VM (fastest).** The box has 4 cores and 24 GB and
the game needs almost none of it: a small Node process and the relay. It
runs as its own pm2 app (`range`) on `localhost:4100`, next to
`algonomics`, and Caddy gets one more site block for the game's name.
Nothing of Algonomics is touched, and the relay is configured so it can never
be used to reach anything on the box itself or any private address (the
trading app on localhost, the cloud's metadata service). The one shared
thing is the machine: if the game ever got very popular it would share
network and CPU with the trader.

**B. On its own free VM (cleanest).** Oracle's Always Free tier also gives
two small AMD VMs (`VM.Standard.E2.1.Micro`, 1 GB), which is plenty for
this. Nothing is shared with the trader. It costs one more pass through the
Oracle console (section 3 of the Algonomics DEPLOY_GUIDE, with the Micro
shape instead of A1).

## 2. The name: DuckDNS

1. https://www.duckdns.org, sign in (the same account as `algonomics`).
2. Type a sub domain, e.g. `fpsfun`, **add domain**.
3. In its row, put the VM's public IP (for A, the Algonomics IP) in
   "current ip", **update ip**.

The game's address is now `fpsfun.duckdns.org`.

## 3. Open the relay's ports in the Oracle console

Console, Networking, Virtual cloud networks, your VCN, Security Lists, the
default list, **Add Ingress Rules**, source `0.0.0.0/0`:

| Protocol | Port range | Why |
|---|---|---|
| UDP | 3478 | TURN relay |
| TCP | 3478 | TURN relay over TCP, for networks that block UDP |
| UDP | 49160-49200 | the relay's own ports |
| TCP | 80 and 443 | HTTPS (already open on the Algonomics box) |

The box's own firewall is opened by the setup script (step 5).

## 4. Tell the PC where the server is

Create `.env.server` in `C:\Users\jwilb\Downloads\apex-range` (it is in
`.gitignore`, never committed):

```
RANGE_HOST=ubuntu@<the VM's public IP>
RANGE_KEY=C:\Users\jwilb\Downloads\<the VM's ssh key file>
RANGE_DOMAIN=fpsfun.duckdns.org
```

For option A these are the same IP and key file Algonomics' `npm run prod`
uses.

## 5. One-time setup on the box

```
npm run deploy:server -- setup
```

This copies `server/game/setup.sh` to the box and runs it. It installs Node
and pm2 if they are missing (on the Algonomics box they are there already),
installs **coturn** with a generated secret, opens UDP/TCP 3478 and the relay
ports in the box's firewall, and appends one block to the Caddyfile:

```
fpsfun.duckdns.org {
	encode zstd gzip
	reverse_proxy localhost:4100
}
```

It backs the Caddyfile up first, has Caddy validate the result, and puts the
backup back if Caddy rejects it. A reload of Caddy does not drop Algonomics'
connections. Safe to run again.

## 6. Ship it

```
npm run deploy:server
```

It builds the public beta (codenames only, checked), packs the site with the
server, copies it over ssh, installs, swaps it in, restarts the `range` pm2
app, checks `/health`, and then plays a real 1v1 between two browser pages
on `https://fpsfun.duckdns.org` through its own broker. About two minutes.

Send your friend **https://fpsfun.duckdns.org**. Better: make a match and
send the **invite link** the 1v1 tab copies; opening it joins your match.

## 7. Day to day

| Command | What it does |
|---|---|
| `npm run deploy:server` | build, ship, check (as above) |
| `npm run deploy:server -- dry` | the whole release, unpacked and run on this PC with a 1v1 through it: everything but the ssh. Run it before a deploy if you changed the server |
| `npm run deploy:server -- health` | `/health`, `pm2 ls`, whether coturn and Caddy are up |
| `npm run deploy:server -- logs` | the server's last 60 log lines |
| `npm run deploy:server -- rollback` | put the previous release back |

What lives where on the box: `~/range/app/` is the current release
(`site/` and `server/`), `~/range/prev/` the one before, `~/range/range.env`
the relay secret (written once by setup, never shipped), and
`~/range/boards.json` the online boards (outside the release, so a deploy
keeps them).

## 8. When something is wrong

- **The page does not load**: `npm run deploy:server -- health`. If `range`
  is not online in `pm2 ls`, `-- logs` says why. If it is, check the DuckDNS
  IP and that Caddy is active.
- **"Could not reach the matchmaking server"**: the broker is part of the
  server, so it is the same as the page not loading.
- **"Found the match but could not connect to the host"** (after 20 s): the
  relay did not get through either. Check the three relay rules in section 3
  and `systemctl is-active coturn` (in `-- health`).
- **A friend's name shows oddly, or a board has junk on it**: the boards take
  what browsers send (there is no account system yet). Edit or empty
  `~/range/boards.json` on the box and restart: `pm2 restart range`.

## 9. How it works, briefly

`server/game/serve.mjs` is one Node process: it serves the built site, runs
the PeerJS broker at `/peerjs`, answers `/net.json` (the broker's path and
TURN credentials that expire after 12 hours, signed with the relay's
secret), keeps the boards at `/api/board`, and answers `/health`. The game
reads `/net.json` when a match is made or joined (`src/net/link.ts`) and when
the Stats tab opens (`src/game/leaderboard.ts`). The match itself still goes
browser to browser; the relay only carries it when a network blocks that.
