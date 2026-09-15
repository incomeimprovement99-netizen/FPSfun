// The game server's network, probed from outside (npm run fps check): a TCP
// connect that tells the cloud's firewall from the box's own, a STUN binding
// over UDP, and a full TURN relay round trip, which is the only way to know the
// relay's own ports (UDP 49160-49200) are open before a friend on a strict
// network finds out the hard way.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { createSocket, type Socket } from "node:dgram";
import { lookup } from "node:dns/promises";
import { connect } from "node:net";

/**
 * "open"; "refused" or "unreachable": the packet got past the cloud's security
 * list and the box answered (nothing listening, or its own firewall, which on
 * Oracle's Ubuntu rejects with host-prohibited); "timeout": dropped before the
 * box, which is what a missing security-list rule looks like
 */
export type TcpState = "open" | "refused" | "unreachable" | "timeout";

export function tcpProbe(host: string, port: number, ms = 5000): Promise<TcpState> {
  return new Promise((res) => {
    const s = connect({ host, port });
    const done = (state: TcpState) => {
      s.destroy();
      res(state);
    };
    s.setTimeout(ms, () => done("timeout"));
    s.once("connect", () => done("open"));
    s.once("error", (e: NodeJS.ErrnoException) =>
      done(e.code === "ECONNREFUSED" ? "refused" : e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH" ? "unreachable" : "timeout")
    );
  });
}

// ---------- STUN/TURN messages (RFC 5389, 5766), IPv4 only ----------
const COOKIE = 0x2112a442;
const BINDING = 0x0001, ALLOCATE = 0x0003, REFRESH = 0x0004, CREATE_PERMISSION = 0x0008, DATA_INDICATION = 0x0017;
const SUCCESS = 0x0100, ERROR = 0x0110;
const A_USERNAME = 0x0006, A_INTEGRITY = 0x0008, A_ERROR = 0x0009, A_LIFETIME = 0x000d, A_PEER = 0x0012, A_DATA = 0x0013;
const A_REALM = 0x0014, A_NONCE = 0x0015, A_RELAYED = 0x0016, A_TRANSPORT = 0x0019, A_MAPPED = 0x0020;

type Attr = [number, Buffer];
interface Msg {
  type: number;
  tid: Buffer;
  attrs: Map<number, Buffer>;
}
interface Addr {
  ip: string;
  port: number;
}

/** a message; with a key, MESSAGE-INTEGRITY last (HMAC-SHA1 over everything before it, the length counting it) */
export function encode(type: number, tid: Buffer, attrs: Attr[], key?: Buffer): Buffer {
  const parts: Buffer[] = [];
  for (const [t, v] of attrs) {
    const h = Buffer.alloc(4);
    h.writeUInt16BE(t, 0);
    h.writeUInt16BE(v.length, 2);
    parts.push(h, v, Buffer.alloc((4 - (v.length % 4)) % 4));
  }
  let body = Buffer.concat(parts);
  const head = Buffer.alloc(20);
  head.writeUInt16BE(type, 0);
  head.writeUInt32BE(COOKIE, 4);
  tid.copy(head, 8);
  if (key) {
    head.writeUInt16BE(body.length + 24, 2);
    const mac = createHmac("sha1", key).update(Buffer.concat([head, body])).digest();
    const h = Buffer.alloc(4);
    h.writeUInt16BE(A_INTEGRITY, 0);
    h.writeUInt16BE(20, 2);
    body = Buffer.concat([body, h, mac]);
  }
  head.writeUInt16BE(body.length, 2);
  return Buffer.concat([head, body]);
}

export function decode(b: Buffer): Msg | null {
  if (b.length < 20 || b.readUInt32BE(4) !== COOKIE) return null;
  const end = Math.min(b.length, 20 + b.readUInt16BE(2));
  const attrs = new Map<number, Buffer>();
  for (let o = 20; o + 4 <= end; ) {
    const t = b.readUInt16BE(o);
    const l = b.readUInt16BE(o + 2);
    if (!attrs.has(t)) attrs.set(t, b.subarray(o + 4, Math.min(end, o + 4 + l)));
    o += 4 + l + ((4 - (l % 4)) % 4);
  }
  return { type: b.readUInt16BE(0), tid: b.subarray(8, 20), attrs };
}

export function readXorAddr(v: Buffer | undefined): Addr | null {
  if (!v || v.length < 8 || v[1] !== 0x01) return null;
  const a = (v.readUInt32BE(4) ^ COOKIE) >>> 0;
  return { ip: [a >>> 24, (a >>> 16) & 255, (a >>> 8) & 255, a & 255].join("."), port: v.readUInt16BE(2) ^ (COOKIE >>> 16) };
}

export function xorAddr({ ip, port }: Addr): Buffer {
  const b = Buffer.alloc(8);
  b[1] = 0x01;
  b.writeUInt16BE(port ^ (COOKIE >>> 16), 2);
  const a = ip.split(".").reduce((n, p) => ((n << 8) | Number(p)) >>> 0, 0);
  b.writeUInt32BE((a ^ COOKIE) >>> 0, 4);
  return b;
}

function errorText(m: Msg | null): string {
  if (!m) return "no answer";
  const e = m.attrs.get(A_ERROR);
  return e && e.length >= 4 ? `${e[2] * 100 + e[3]} ${e.subarray(4).toString()}`.trim() : `message 0x${m.type.toString(16)}`;
}

/** one request, resent every 600 ms until its answer (matched by transaction id) or the timeout */
function ask(sock: Socket, to: Addr, type: number, attrs: Attr[], key?: Buffer, ms = 3000): Promise<Msg | null> {
  const tid = randomBytes(12);
  const msg = encode(type, tid, attrs, key);
  return new Promise((res) => {
    const onMsg = (b: Buffer) => {
      const m = decode(b);
      if (m && m.tid.equals(tid)) finish(m);
    };
    const send = () => sock.send(msg, to.port, to.ip);
    const resend = setInterval(send, 600);
    const timer = setTimeout(() => finish(null), ms);
    const finish = (m: Msg | null) => {
      clearInterval(resend);
      clearTimeout(timer);
      sock.off("message", onMsg);
      res(m);
    };
    sock.on("message", onMsg);
    send();
  });
}

async function udpSocket(): Promise<Socket> {
  const s = createSocket("udp4");
  s.on("error", () => {}); // an ICMP "port unreachable" is just no answer here
  await new Promise<void>((r) => s.bind(0, r));
  return s;
}

/** our address as the STUN server at host:port sees it, or null when it does not answer */
export async function stunBinding(host: string, port: number, ms = 3000): Promise<Addr | null> {
  const to = { ip: (await lookup(host, { family: 4 })).address, port };
  const sock = await udpSocket();
  try {
    const r = await ask(sock, to, BINDING, [], undefined, ms);
    return r?.type === BINDING + SUCCESS ? readXorAddr(r.attrs.get(A_MAPPED)) : null;
  } finally {
    sock.close();
  }
}

/**
 * A relay allocation with the site's own credentials, a permission for this
 * PC, then a datagram from a second socket to the relayed port that must come
 * back through the relay. ok means a friend behind a strict network can play.
 */
export async function turnRelay(host: string, port: number, username: string, credential: string, ms = 4000): Promise<{ ok: boolean; detail: string }> {
  const to = { ip: (await lookup(host, { family: 4 })).address, port };
  const sock = await udpSocket();
  const peer = await udpSocket();
  try {
    const transport: Attr = [A_TRANSPORT, Buffer.from([17, 0, 0, 0])];
    const first = await ask(sock, to, ALLOCATE, [transport], undefined, ms);
    if (!first) return { ok: false, detail: `no answer on ${port}/udp` };
    const realm = first.attrs.get(A_REALM);
    const nonce = first.attrs.get(A_NONCE);
    if (first.type !== ALLOCATE + ERROR || !realm || !nonce) return { ok: false, detail: `unexpected first answer (${errorText(first)})` };
    const key = createHash("md5").update(`${username}:${realm.toString()}:${credential}`).digest();
    const auth: Attr[] = [[A_USERNAME, Buffer.from(username)], [A_REALM, realm], [A_NONCE, nonce]];

    const alloc = await ask(sock, to, ALLOCATE, [transport, ...auth], key, ms);
    if (alloc?.type !== ALLOCATE + SUCCESS) return { ok: false, detail: `the relay refused the site's credentials (${errorText(alloc)}): is TURN_SECRET the same in range.env and turnserver.conf?` };
    const relayed = readXorAddr(alloc.attrs.get(A_RELAYED));
    const mapped = readXorAddr(alloc.attrs.get(A_MAPPED));
    if (!relayed || !mapped) return { ok: false, detail: "the allocation came back without addresses" };
    try {
      const perm = await ask(sock, to, CREATE_PERMISSION, [[A_PEER, xorAddr({ ip: mapped.ip, port: 0 })], ...auth], key, ms);
      if (perm?.type !== CREATE_PERMISSION + SUCCESS) return { ok: false, detail: `no permission for this PC (${errorText(perm)})` };

      const token = randomBytes(8);
      const through = new Promise<boolean>((res) => {
        const timer = setTimeout(() => res(false), ms);
        sock.on("message", (b: Buffer) => {
          const m = decode(b);
          if (m?.type === DATA_INDICATION && m.attrs.get(A_DATA)?.equals(token)) {
            clearTimeout(timer);
            res(true);
          }
        });
      });
      const send = () => peer.send(token, relayed.port, relayed.ip);
      send();
      const resend = setInterval(send, 500);
      const ok = await through;
      clearInterval(resend);
      return ok
        ? { ok: true, detail: `a datagram went through the relay (${relayed.ip}:${relayed.port}/udp)` }
        : { ok: false, detail: `nothing came back through relay port ${relayed.port}/udp (the security-list rule for UDP 49160-49200${relayed.ip === to.ip ? "" : `; and the relay says it is at ${relayed.ip}, not ${to.ip}: external-ip in turnserver.conf`})` };
    } finally {
      // give the allocation back rather than leave it counting against the quota for ten minutes
      await ask(sock, to, REFRESH, [[A_LIFETIME, Buffer.alloc(4)], ...auth], key, 1500);
    }
  } finally {
    sock.close();
    peer.close();
  }
}
