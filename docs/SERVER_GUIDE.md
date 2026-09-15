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
| Online leaderboards | none | **on**: best course times, the flick drill, and win counts by name for every mode (1v1, 1v1v1, the bots by tier, the battle royale, Gun Run, team deathmatch, Crown, Control), in the Stats tab |
| Accounts | none: everything stays in the browser | **optional accounts** on the Stats tab: a name and a password (a salted scrypt hash on the box, nothing third-party), and your settings, keys, loadouts and stats in every browser you sign in on |
| Deploy | `npm run deploy` | `npm run deploy:server` (builds, ships, plays a test 1v1 on the live site) |

The build is the same for both. On Pages the game falls back to the public
broker by itself, so the Pages link keeps working as a backup.

## 1. Where to put it (your choice)

**Chosen: B, its own free VM.** The Algonomics box runs a live trader with
real money and is not to be touched; option A below stays for the record
only. Once the game's VM exists: its IP in DuckDNS (section 2, the name
`fpsfun`), the relay's ports in its security list (section 3), its address
and key path in `.env.server` (section 4), then `npm run fps setup`,
`npm run fps deploy` and `npm run fps check`.

**What the tenancy looks like (checked 2026-09-15).** The Oracle account is
**Pay As You Go** (upgraded 2026-07-26, during the A1 capacity retries). That
cannot be undone, and it does not need to be: Always Free resources stay free
on it, only use past the free limits is billed, and it spares the game box
Oracle's reclaiming of idle free VMs. The limits that matter:

| Always Free | Limit | Used by |
|---|---|---|
| Ampere A1 (Arm) | a monthly pool of hours: 1,500 OCPU-h / 9,000 GB-h (2 / 12 all month) since 2026-06-15 in the docs, but this PAYG tenancy is still billed against the old 3,000 / 18,000 (4 / 24) | the trader, **3 OCPU / 18 GB**, and **the game, 1 OCPU / 6 GB**: 4 / 24 together, exactly the pool |
| AMD `VM.Standard.E2.1.Micro` | not offered here: the tenancy's limits read 0 (and "Deprecated") and the shape list is empty in all three Chicago ADs | nothing |
| Block storage (all disks) | 200 GB | the trader's 150 GB + the game's ~47 GB |
| VCNs | 2 | `algonomics-vcn` + the game's own |

A spare A1 VM from the retries (`instance-20260726-2149`, 3 OCPU / 18 GB,
150 GB disk) was billing: its disk every day (~$0.21), and, since the two
A1 boxes drain the month's pool of hours by about the 18th, compute for the
rest of each month (~$3 a day; August came to $47.88). Terminate it with its
boot volume before making the game's VM, or the disks go past 200 GB too.
Daily Cost Analysis reads $0 compute until the pool runs out, so judge a
month by month. A $1 monthly budget (Billing, Budgets) emails the moment
anything bills.

### 1.1 Making the game's VM, click by click (option B)

With no Micro in Chicago, the game box is a slice of the A1 pool: the trader
was shrunk from 4 / 24 to 3 OCPU / 18 GB (Instances → Algonomics Official →
**Edit** → shape → 3 OCPUs, 18 GB → Save; it restarts once, about two
minutes) to leave 1 OCPU / 6 GB for the game at $0. (The alternative, the
trader untouched and the game at 1 OCPU / 2 GB, bills about $7-9 a month.)

1. ☰ → **Compute** → **Instances** → **Create instance**. Name `fpsfun`.
2. **Placement**: AD 1; if the create says out of capacity, AD 2, then AD 3.
3. **Image and shape**: **Change shape** first → **Virtual machine** →
   **Ampere** → **VM.Standard.A1.Flex** → **1** OCPU, **6** GB → Select.
   Then **Change image** → **Ubuntu** → **Canonical Ubuntu 24.04** (the plain
   one, not Minimal; with the shape set it picks the Arm build).
4. **Networking**: **Create new virtual cloud network** (name it
   `fpsfun-vcn`) and **Create new public subnet**. Its own network means the
   relay's open ports are never on the trader's security list. **Automatically
   assign public IPv4 address**: on.
5. **SSH keys**: **Generate a key pair for me** → **Download private key**
   (and the public one). Rename the private key to
   `C:\Users\jwilb\Downloads\ssh-key-fpsfun.key`.
6. **Boot volume**: leave the default (about 47 GB); anything past 50 GB goes
   over the 200 GB of free disk.
7. **Create**. Once it says **Running**, copy the **Public IP address**.

**A. On the Algonomics VM (fastest).** The box has 4 cores and 24 GB and
the game needs almost none of it: a small Node process and the relay. It
runs as its own pm2 app (`range`) on `localhost:4100`, next to
`algonomics`, and Caddy gets one more site block for the game's name.
Nothing of Algonomics is touched, and the relay is configured so it can never
be used to reach anything on the box itself or any private address (the
trading app on localhost, the cloud's metadata service). The one shared
thing is the machine: if the game ever got very popular it would share
network and CPU with the trader.

**B. On its own free VM (cleanest).** Nothing is shared with the trader. It
costs one more pass through the Oracle console (section 1.1). The plan was
one of Oracle's two free AMD Micro VMs, but Chicago does not offer them to
this tenancy, so it is a 1 OCPU / 6 GB slice of the A1 pool instead.

## 2. The name: DuckDNS

1. https://www.duckdns.org, sign in (the same account as `algonomics`).
2. Type a sub domain, e.g. `fpsfun`, **add domain**.
3. In its row, put the VM's public IP (for A, the Algonomics IP) in
   "current ip", **update ip**.

The game's address is now `fpsfun.duckdns.org`. Or put the **token** shown
at the top of the DuckDNS page in `.env.server` as `DUCKDNS_TOKEN=...` and
`npm run fps dns` points the name at `RANGE_HOST` (handy if the VM is ever
remade with a new IP).

## 3. Open the relay's ports in the Oracle console

☰ → **Networking** → **Virtual cloud networks** → **fpsfun-vcn** (the game's,
never `algonomics-vcn`) → **Security** → the **Default Security List for
fpsfun-vcn** → **Security rules** → **Add Ingress Rules**. One dialog takes
them all: fill the first, **+ Another Ingress Rule** for the next. Each is
**Source CIDR** `0.0.0.0/0`, stateless off, source port empty:

| IP Protocol | Destination port range | Why |
|---|---|---|
| TCP | 80 | HTTPS certificates, and the redirect to HTTPS |
| TCP | 443 | the site |
| TCP | 3478 | TURN relay over TCP, for networks that block UDP |
| UDP | 3478 | TURN relay |
| UDP | 49160-49200 | the relay's own ports |

(SSH, TCP 22, is in the list already.) The box's own firewall is opened by
the setup script (step 5). `npm run fps check` tests every one of these from
the PC: a rule missing shows as a timeout, with the rule to add under it.

## 4. Tell the PC where the server is

Create `.env.server` in `C:\Users\jwilb\Downloads\apex-range` (it is in
`.gitignore`, never committed):

```
RANGE_HOST=ubuntu@<the VM's public IP>
RANGE_KEY=C:\Users\jwilb\Downloads\ssh-key-fpsfun.key
RANGE_DOMAIN=fpsfun.duckdns.org
```

For option A these are the same IP and key file Algonomics' `npm run prod`
uses. If Windows' ssh calls a freshly downloaded key "unprotected", the tool
narrows the file to your user by itself.

## 5. One-time setup on the box

```
npm run fps setup
```

This copies `server/game/setup.sh` to the box and runs it. On a fresh VM it
first waits out the box's own first-boot updates and, on a box under 2 GB
(a Micro, say), adds 2 GB of swap. It installs Node and pm2 if they are missing (on the Algonomics
box they are there already) and has pm2 start at boot, installs **coturn**
with a generated secret, opens 80/443, UDP/TCP 3478 and the relay ports in
the box's firewall, and adds one block to the Caddyfile (on a new box it
replaces Caddy's welcome page; on a shared one it is appended):

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
npm run fps deploy
npm run fps check
```

`deploy` builds the public beta (codenames only, checked), packs the site with
the server, copies it over ssh, installs, swaps it in, restarts the `range`
pm2 app, checks `/health`, and then plays a real 1v1 between two browser
pages on `https://fpsfun.duckdns.org` through its own broker. About two
minutes. `check` then probes it from outside the way a stranger's browser
would: the DNS name, ssh, TCP 80/443/3478, a STUN answer on UDP 3478,
`/health` over HTTPS, and a real datagram sent through the relay with the
site's own credentials, which is the only proof the UDP 49160-49200 rule is
right (the 1v1 on one PC never needs the relay).

Send your friend **https://fpsfun.duckdns.org**. Better: make a match and
send the **invite link** the 1v1 tab copies; opening it joins your match.

## 7. Day to day

`npm run fps <verb>` and `npm run deploy:server -- <verb>` are the same tool
(`tools/deploy-server.ts`), the way Algonomics has `npm run prod <verb>`.
`npm run fps` on its own is `health`; `npm run deploy:server` on its own
ships.

| Command | What it does | Changes the box? |
|---|---|---|
| `npm run fps deploy` | build, ship, check (as above). It builds **the last commit** from a clean copy, so edits in progress in this folder never go out; `npm run fps deploy local` ships the folder as it is | yes: a new release |
| `npm run fps dry` | the whole release, unpacked and run on this PC: the boards' and the accounts' rules checked, an account made and synced through the page into a second browser, and a 1v1 through it. Everything but the ssh. Run it before a deploy if you changed the server | no, runs here |
| `npm run fps check` | everything from outside, each failure with its fix | no |
| `npm run fps health` | `/health`, `pm2 ls`, coturn and Caddy up, memory, disk | no |
| `npm run fps logs` | the server's last 60 log lines | no |
| `npm run fps backup` | copies `boards.json` and `accounts.json` down to `server-backup/<date>/` (gitignored: password hashes) | no |
| `npm run fps ssh` | a shell on the box | only what you type |
| `npm run fps restart` | restart the game server, rereading `~/range/range.env` | restarts it |
| `npm run fps rollback` | put the previous release back | yes |
| `npm run fps setup` | the one-time setup; safe to run again | yes |
| `npm run fps dns` | point `RANGE_DOMAIN` at `RANGE_HOST` on DuckDNS (`DUCKDNS_TOKEN`) | DNS only |
| `npm run fps run "<cmd>"` | any shell command on the box, in `~/range` | whatever it does |

What lives where on the box: `~/range/app/` is the current release
(`site/` and `server/`), `~/range/prev/` the one before, `~/range/range.env`
the relay secret (written once by setup, never shipped),
`~/range/boards.json` the online boards and `~/range/accounts.json` the
accounts (password hashes, sessions and synced profiles), both outside the
release so a deploy keeps them. Back `accounts.json` up now and then
(`npm run fps backup`): it is the one file on the box a player would miss.

## 8. When something is wrong

- **Anything**: `npm run fps check` first; it names the broken piece and
  its fix.
- **The page does not load**: `npm run fps health`. If `range` is not online
  in `pm2 ls`, `npm run fps logs` says why. If it is, check the DuckDNS IP and
  that Caddy is active.
- **"Could not reach the matchmaking server"**: the broker is part of the
  server, so it is the same as the page not loading.
- **"Found the match but could not connect to the host"** (after 20 s): the
  relay did not get through either. `npm run fps check` sends a datagram
  through the relay and says which of the relay rules in section 3 is missing,
  or whether coturn is down.
- **A friend's name shows oddly, or a board has junk on it**: the boards take
  what browsers send (accounts do not sign the posts). Edit or empty
  `~/range/boards.json` on the box (`npm run fps backup` first, then
  `npm run fps ssh`) and `npm run fps restart`.
- **Someone forgot their password**: there is no email on the box, so no
  reset link. Delete their entry from `~/range/accounts.json` (the key is the
  name in lower case) and restart; they sign up again with the same name.

## 9. How it works, briefly

`server/game/serve.mjs` is one Node process: it serves the built site, runs
the PeerJS broker at `/peerjs`, answers `/net.json` (the broker's path and
TURN credentials that expire after 12 hours, signed with the relay's
secret), keeps the boards at `/api/board` and the accounts at `/api/account`
(register, login, logout, profile; rate limited, sessions of 30 days), and
answers `/health`. The game
reads `/net.json` when a match is made or joined (`src/net/link.ts`) and when
the Stats tab opens (`src/game/leaderboard.ts`). The match itself still goes
browser to browser; the relay only carries it when a network blocks that.
