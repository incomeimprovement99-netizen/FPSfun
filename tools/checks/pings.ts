// Pings where you look, proven on the real BrPlay (src/game/brplay.ts) over a stand-in match (Milestones 929 and 930,
// from a review of how players talk to each other in a match):
//   - below the street (the sunken court, the station) a ping lands ahead of you on the floor you stand on, where it went
//     28 m behind you; the wheel's lands on the floor too, where it went 300 m off and 45 m underground;
//   - loot behind the wall you look at is not marked;
//   - a double tap or the wheel's ENEMY HERE on an enemy keeps him marked and followed;
//   - an ENEMY HERE takes away only a place ping just put up, not a DEFENDING HERE of 8 s ago;
//   - an enemy gone invisible is not followed, and a squad mate who left takes their marks with them.
//
// It needs the game named: GAME=speedkills npx tsx tools/checks/pings.ts (verify runs it that way).
import * as THREE from "three";
import { BrPlay, PING_INTENTS } from "../../src/game/brplay";
import { FLOORS } from "../../src/game/floors";
import { RANGE_SOLIDS } from "../../src/game/range";
import type { BrMatch } from "../../src/game/brmatch";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

type Fig = { group: { visible: boolean; position: THREE.Vector3 }; knocked: boolean; cloaked?: boolean };
function matchWith(avatars: Fig[], ids: Map<Fig, { id: number; name: string }>, loot: { pos: THREE.Vector3; item: unknown } | null = null): BrMatch {
  return {
    avatars,
    remoteOf: (a: Fig) => ids.get(a) ?? null,
    isAlly: (id: number) => id === 2,
    lootField: loot ? { nearest: () => loot } : null,
    sendMark: () => undefined,
  } as unknown as BrMatch;
}
const play = () => new BrPlay({ keyLabel: () => "E", notice: () => undefined, sound: () => undefined } as never);
const look = (yawDeg: number, pitchDeg: number) => {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  return new THREE.Vector3(-Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)).normalize();
};
const last = (p: BrPlay) => p.markers[p.markers.length - 1];

console.log("Where a ping lands (src/game/brplay.ts)");
{
  // the sunken court's floor, 7 m under the street, its eye 1.6 m over it, looking ahead and a little down
  FLOORS.length = 0;
  FLOORS.push({ minX: -40, maxX: 40, minZ: 460, maxZ: 540, y: -7 });
  RANGE_SOLIDS.length = 0;
  const p = play();
  const m = matchWith([], new Map());
  const eye = new THREE.Vector3(0, -5.4, 500);
  const fwd = look(0, -8);
  p.ping(m, eye.clone(), fwd, 10, 1);
  const tap = last(p);
  const ahead = tap ? tap.at.clone().sub(eye).dot(fwd) : -1;
  check("below the street a tap ping lands ahead of you on the floor you stand on", !!tap && ahead > 0 && Math.abs(tap.at.y - -7) < 0.05, tap ? `${ahead.toFixed(1)} m along the look, at y ${tap.at.y.toFixed(2)}` : "no mark");
  const q = play();
  const goIdx = PING_INTENTS.findIndex((x) => x.id !== "enemy");
  const street = new THREE.Vector3(0, 1.6, 0);
  FLOORS.length = 0;
  q.pingIntent(m, street.clone(), look(0, -9), 10, 1, goIdx);
  const wheel = last(q);
  const dist = wheel ? wheel.at.distanceTo(street) : Infinity;
  check("the wheel's ping on open ground lands on the ground ahead, not 300 m off underground", !!wheel && dist < 15 && Math.abs(wheel.at.y) < 0.05, wheel ? `${dist.toFixed(1)} m off, at y ${wheel.at.y.toFixed(2)}` : "no mark");
}
{
  // an item 10 m off behind a wall 4 m ahead
  RANGE_SOLIDS.length = 0;
  RANGE_SOLIDS.push({ minX: -3, maxX: 3, minZ: -4.5, maxZ: -4, base: 0, top: 4 });
  const p = play();
  const item = { pos: new THREE.Vector3(0.5, 0, -10), item: { kind: "hack", id: "armor", n: 0, rarity: "common" } };
  const k = p.ping(matchWith([], new Map(), item), new THREE.Vector3(0, 1.6, 0), look(0, -2), 10, 1);
  check("loot behind the wall you look at is not marked: the wall is", k === "go", k);
  RANGE_SOLIDS.length = 0;
  const p2 = play();
  const k2 = p2.ping(matchWith([], new Map(), item), new THREE.Vector3(0, 1.6, 0), look(0, -2), 10, 1);
  check("and with the wall gone, the item is", k2 === "loot", k2);
}

console.log("\nEnemy marks");
{
  const enemy: Fig = { group: { visible: true, position: new THREE.Vector3(0, 0, -20) }, knocked: false };
  const ids = new Map([[enemy, { id: 900, name: "BOB" }]]);
  const m = matchWith([enemy], ids);
  const eye = new THREE.Vector3(0, 1.6, 0);
  const fwd = new THREE.Vector3(0, 1.2, -20).sub(eye).normalize();
  const p = play();
  p.ping(m, eye.clone(), fwd, 10, 1);
  p.pingEnemy(m, eye.clone(), fwd, 10.2, 1);
  const dbl = p.markers.filter((x) => x.from === 1);
  check("a double tap on an enemy keeps him marked and followed", dbl.length === 1 && dbl[0].target === 900, JSON.stringify(dbl.map((x) => ({ label: x.label, target: x.target }))));
  const w = play();
  w.pingIntent(m, eye.clone(), fwd, 20, 1, PING_INTENTS.findIndex((x) => x.id === "enemy"));
  check("and the wheel's ENEMY HERE on him the same", last(w)?.target === 900, last(w)?.label ?? "none");
  // gone invisible: the mark stays where he was seen
  enemy.group.visible = false;
  enemy.cloaked = true;
  enemy.group.position.set(15, 0, -20);
  p.update(11, m, {} as never, {} as never, eye, fwd, { alive: false, playing: false, myId: 1 });
  const at = p.markers.find((x) => x.target === 900)?.at;
  check("an enemy gone invisible is not followed by his mark", !!at && Math.abs(at.x) < 0.01, at ? `mark at x ${at.x.toFixed(1)}` : "no mark");
}
{
  // DEFENDING HERE, then an ENEMY HERE 8 s later by the same player
  RANGE_SOLIDS.length = 0;
  const p = play();
  const m = matchWith([], new Map());
  const defend = PING_INTENTS.findIndex((x) => x.id === "defend");
  p.pingIntent(m, new THREE.Vector3(0, 1.6, 0), look(0, -5), 10, 1, defend);
  p.pingEnemy(m, new THREE.Vector3(0, 1.6, 0), look(90, -5), 18, 1);
  const labels = p.markers.map((x) => x.label);
  check("an ENEMY HERE takes away only a place ping just put up, not a DEFENDING HERE of 8 s ago", labels.length === 2, JSON.stringify(labels));
  // a squad mate (2) who leaves: their mark goes
  const mate: Fig = { group: { visible: true, position: new THREE.Vector3(5, 0, 0) }, knocked: false };
  const withMate = matchWith([mate], new Map([[mate, { id: 2, name: "MATE" }]]));
  p.addMarker("go", new THREE.Vector3(1, 0, -5), "GOING HERE", 2, -1, 19);
  p.update(19.1, withMate, {} as never, {} as never, new THREE.Vector3(), look(0, 0), { alive: false, playing: false, myId: 1 });
  const before = p.markers.some((x) => x.from === 2);
  p.update(19.2, matchWith([], new Map()), {} as never, {} as never, new THREE.Vector3(), look(0, 0), { alive: false, playing: false, myId: 1 });
  const after = p.markers.some((x) => x.from === 2);
  check("a squad mate who left takes their marks with them", before && !after, JSON.stringify({ before, after }));
}

console.log("\nThe loot at your feet (src/game/brplay.ts)");
{
  // (Milestone 927) three guns at your feet: a hold takes no guns, so the prompt offers no HOLD: TAKE ALL; with two hack
  // cores of hacks you hold beside a gun it does
  const feet = (items: Array<Record<string, unknown>>) => {
    const drops = new Map(items.map((item, i) => [i + 1, { key: i + 1, pos: new THREE.Vector3(0.3 * i, 0, 0.2), item }]));
    const p = play();
    const out = { prompt: null as { text: string } | null, hold: null, markers: [], reach: { rows: [], pick: -1, cycleKey: "" } };
    const input = { held: () => false, pressedNow: () => false };
    (p as unknown as { lootHere: (...a: unknown[]) => void }).lootHere(10, { lootField: { drops, nearest: () => null } }, input, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1.6, 0), look(0, -60), "E", { hacks: { mobility: "dash", utility: "heal" }, topped: [] }, out);
    return out.prompt?.text ?? "";
  };
  const guns = feet([{ kind: "weapon", id: "mastiff", n: 1, rarity: "common", fusion: 0 }, { kind: "weapon", id: "vinson", n: 1, rarity: "common", fusion: 0 }, { kind: "weapon", id: "lstar", n: 1, rarity: "common", fusion: 0 }]);
  check("three guns at your feet: no HOLD: TAKE ALL, which would take none of them", !!guns && !/HOLD/.test(guns), guns);
  const cores = feet([{ kind: "weapon", id: "mastiff", n: 1, rarity: "common", fusion: 0 }, { kind: "hack", id: "dash", n: 1, rarity: "rare" }, { kind: "hack", id: "heal", n: 1, rarity: "rare" }]);
  check("and cores of the hacks you hold beside a gun: the hold is offered", /HOLD: TAKE ALL/.test(cores), cores);
}

console.log(fails === 0 ? "\nPINGS PASS" : `\nPINGS FAIL (${fails})`);
process.exit(fails === 0 ? 0 : 1);
