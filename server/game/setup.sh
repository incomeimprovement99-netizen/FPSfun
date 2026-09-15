#!/usr/bin/env bash
# One-time setup of the game server on an Ubuntu box (Oracle Always Free, the
# same kind of VM Algonomics runs on). Safe to run again: every step checks
# before it changes anything, and nothing here touches another app's files
# except one appended block in the Caddyfile (backed up, validated, rolled
# back if Caddy rejects it).
#
#   bash setup.sh <hostname>        e.g. bash setup.sh fpsfun.duckdns.org
#
# What it does:
#   1. Node 22 and pm2, if missing.
#   2. coturn, the TURN relay, on 3478 (UDP and TCP) with relay ports
#      49160-49200, shared-secret auth, and NO relaying into the box or any
#      private network (so the relay can never be used to reach the other apps
#      on this machine or the cloud metadata service).
#   3. The box's own firewall (iptables) opened for those ports and 80/443.
#   4. A Caddy site block for <hostname> -> the game on localhost:4100.
#   5. ~/range/range.env with the TURN secret and hostname (kept across deploys).
#
# What it cannot do (the cloud console, by hand; docs/SERVER_GUIDE.md):
#   - the Oracle security list rules for UDP/TCP 3478 and UDP 49160-49200,
#   - the DuckDNS name pointing at this box.
set -euo pipefail

DOMAIN="${1:-}"
if [[ -z "$DOMAIN" ]]; then
  echo "usage: bash setup.sh <hostname>   (the DuckDNS name for the game)" >&2
  exit 1
fi
RANGE_DIR="$HOME/range"
ENV_FILE="$RANGE_DIR/range.env"
RELAY_MIN=49160
RELAY_MAX=49200
mkdir -p "$RANGE_DIR"

say() { printf '\n== %s\n' "$*"; }

say "1. Node and pm2"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
node --version
if ! command -v pm2 >/dev/null; then sudo npm install -g pm2; fi
pm2 --version

say "2. coturn (the TURN relay)"
FRESH_COTURN=0
if ! command -v turnserver >/dev/null; then
  sudo apt-get update -y
  sudo apt-get install -y coturn
  FRESH_COTURN=1
fi
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"
if ! grep -q '^TURN_SECRET=' "$ENV_FILE"; then
  echo "TURN_SECRET=$(openssl rand -hex 32)" >>"$ENV_FILE"
fi
grep -q '^TURN_HOST=' "$ENV_FILE" || echo "TURN_HOST=$DOMAIN" >>"$ENV_FILE"
SECRET="$(grep '^TURN_SECRET=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
PRIVATE_IP="$(hostname -I | awk '{print $1}')"
PUBLIC_IP="$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')"
echo "public $PUBLIC_IP, private $PRIVATE_IP"

CONF=/etc/turnserver.conf
MARK="# written by apex-range server/game/setup.sh"
# a coturn someone else set up is left alone; the package's own sample file
# (just installed) is kept as a backup and replaced
if [[ -f "$CONF" ]] && ! grep -q "$MARK" "$CONF"; then
  if [[ "$FRESH_COTURN" == 1 ]] || ! grep -Eqv '^[[:space:]]*(#|$)' "$CONF"; then
    sudo cp "$CONF" "$CONF.dist"
  else
    echo "$CONF exists and was not written by this script: leaving it alone." >&2
    echo "Merge the settings from docs/SERVER_GUIDE.md by hand, then run this again with it removed." >&2
    exit 1
  fi
fi
sudo tee "$CONF" >/dev/null <<EOF
$MARK
listening-port=3478
realm=$DOMAIN
server-name=$DOMAIN
use-auth-secret
static-auth-secret=$SECRET
# Oracle gives the VM a private address behind a 1:1 NAT
external-ip=$PUBLIC_IP/$PRIVATE_IP
min-port=$RELAY_MIN
max-port=$RELAY_MAX
fingerprint
# a match is a few KB/s each way; these cap abuse, not play
total-quota=100
user-quota=8
max-bps=250000
stale-nonce=600
no-cli
no-tls
no-dtls
no-multicast-peers
no-software-attribute
simple-log
log-file=syslog
# never relay into this box or a private network: the other apps listen on
# localhost, and 169.254.169.254 is the cloud's metadata service
denied-peer-ip=0.0.0.0-0.255.255.255
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=100.64.0.0-100.127.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
denied-peer-ip=169.254.0.0-169.254.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.0.0.0-192.0.0.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=198.18.0.0-198.19.255.255
denied-peer-ip=224.0.0.0-255.255.255.255
denied-peer-ip=::1
denied-peer-ip=64:ff9b::-64:ff9b::ffff:ffff
denied-peer-ip=fc00::-fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff
denied-peer-ip=fe80::-febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff
EOF
sudo chmod 640 "$CONF"
sudo chgrp turnserver "$CONF" 2>/dev/null || true
# older Ubuntu packages only start when this is set
if [[ -f /etc/default/coturn ]]; then
  sudo sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
fi
sudo systemctl enable coturn >/dev/null
sudo systemctl restart coturn
sleep 1
systemctl is-active coturn

say "3. The box's firewall"
open_port() { # proto port-or-range
  if ! sudo iptables -C INPUT -p "$1" --dport "$2" -j ACCEPT 2>/dev/null; then
    sudo iptables -I INPUT -p "$1" --dport "$2" -j ACCEPT
    echo "opened $1 $2"
  fi
}
open_port tcp 80
open_port tcp 443
open_port udp 3478
open_port tcp 3478
open_port udp "$RELAY_MIN:$RELAY_MAX"
if command -v netfilter-persistent >/dev/null; then sudo netfilter-persistent save >/dev/null; fi

say "4. Caddy: $DOMAIN -> localhost:4100"
if ! command -v caddy >/dev/null; then
  sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -y
  sudo apt-get install -y caddy
fi
CADDYFILE=/etc/caddy/Caddyfile
if sudo grep -qF "$DOMAIN {" "$CADDYFILE" 2>/dev/null; then
  echo "Caddyfile already has $DOMAIN"
else
  BACKUP="$CADDYFILE.bak-range-$(date +%Y%m%d%H%M%S)"
  sudo cp "$CADDYFILE" "$BACKUP" 2>/dev/null || sudo touch "$BACKUP"
  sudo tee -a "$CADDYFILE" >/dev/null <<EOF

# the game (apex-range server/game/setup.sh)
$DOMAIN {
	encode zstd gzip
	reverse_proxy localhost:4100
}
EOF
  if ! sudo caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1; then
    sudo cp "$BACKUP" "$CADDYFILE"
    echo "Caddy rejected the new block; the Caddyfile is restored from $BACKUP" >&2
    exit 1
  fi
  echo "added; backup at $BACKUP"
fi
sudo systemctl reload caddy

say "Done on the box"
cat <<EOF
Still to do by hand (docs/SERVER_GUIDE.md):
  - DuckDNS: $DOMAIN -> $PUBLIC_IP
  - Oracle security list ingress: UDP 3478, TCP 3478, UDP $RELAY_MIN-$RELAY_MAX (and TCP 80, 443 if not already)
Then from the PC: npm run deploy:server
EOF
