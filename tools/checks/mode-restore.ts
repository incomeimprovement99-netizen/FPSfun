// Host migration, phase 3 (docs/PLAN_HOST_MIGRATION.md): the heir builds
// the crown and Control's zones again from what its copy of the match saw
// (modes.ts Crown.restore, Control.restore), and they carry on exactly as
// the host's would have: the crown's hold keeps counting to its win, a zone
// held keeps scoring, the bonus comes when the snapshot said, and a lockout
// keeps its clock.
//
// Run on its own: npx tsx tools/checks/mode-restore.ts.
import { Control, Crown, MODES } from "../../src/game/modes";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Host migration: the crown and Control rebuilt");
{
  // the host's crown, carried by player 2 for 3 s; the heir's, from the view
  const host = new Crown(0, 0, 0);
  const at = { id: 2, x: 0, z: 0, alive: true };
  let t = MODES.crown.appearsAfter + 0.1;
  host.update(t, 0.1, [at]);
  host.update(t + 0.1, 0.1, [at]);
  for (let i = 0; i < 30; i++) host.update((t += 0.1), 0.1, [at]);
  const heir = new Crown(0, 0, t);
  heir.restore({ phase: host.phase, x: host.x, z: host.z, carrier: host.carrier, held: host.held }, 0);
  let hw: number | null = null;
  let ew: number | null = null;
  for (let i = 0; i < 400 && (hw === null || ew === null); i++) {
    t += 0.1;
    hw ??= host.update(t, 0.1, [at]).winner;
    ew ??= heir.update(t, 0.1, [at]).winner;
  }
  check("the crown: carried when the heir took over, the hold keeps counting to the same win", heir.phase === "carried" && hw === 2 && ew === 2, JSON.stringify({ hw, ew }));
  // one still waiting to appear: it appears when the snapshot said
  const w = new Crown(0, 0, 100);
  w.restore({ phase: "waiting", x: 0, z: 0, carrier: -1, held: 0 }, 107);
  check("the crown: still waiting, it appears when the snapshot said", w.update(106.9, 0.1, []).event === null && w.update(107.1, 0.1, []).event === "appears");
}
{
  const zones: Array<readonly [string, number, number]> = [
    ["A", -30, 0],
    ["B", 0, 0],
    ["C", 30, 0],
  ];
  const host = new Control(0, () => 0.5, zones);
  const team0 = [{ x: -30, z: 0, team: 0 as const, alive: true }];
  let t = 0;
  for (let i = 0; i < 200; i++) host.update((t += 0.1), 0.1, team0);
  const view = { v: host.zones.map((z) => z.v), owner: host.zones.map((z) => z.owner), score: [host.score[0], host.score[1]] as [number, number], bonus: host.bonus ? host.bonus.zone : -1, bonusLeft: host.bonus ? host.bonus.endsAt - t : 0, lockTeam: host.lockout ? host.lockout.team : -1, lockLeft: host.lockout ? host.lockout.endsAt - t : 0 };
  const heir = new Control(t, () => 0.5, zones);
  heir.restore(view, t, host.nextBonus);
  for (let i = 0; i < 600; i++) {
    t += 0.1;
    host.update(t, 0.1, team0);
    heir.update(t, 0.1, team0);
  }
  const same = host.zones.every((z, i) => z.owner === heir.zones[i].owner && Math.abs(z.v - heir.zones[i].v) < 1e-9);
  check("Control: the zones held go on scoring, and the bonus comes when the snapshot said: the heir's match runs as the host's would have", view.owner[0] === 0 && same && Math.abs(host.score[0] - heir.score[0]) < 1e-6, JSON.stringify({ host: host.score, heir: heir.score }));
  const lock = new Control(0, () => 0.5, zones);
  lock.restore({ v: [-1, -1, -1], owner: [0, 0, 0], score: [10, 5], bonus: -1, bonusLeft: 0, lockTeam: 0, lockLeft: 4 }, 50, 1e9);
  check("Control: a lockout keeps its clock", lock.lockout?.team === 0 && Math.abs((lock.lockout?.endsAt ?? 0) - 54) < 1e-9);
}

console.log(fails === 0 ? "\nMODE RESTORE PASS" : `\nMODE RESTORE FAIL (${fails})`);
export const modeRestoreFails = fails;
if (process.argv[1]?.endsWith("mode-restore.ts")) process.exit(fails === 0 ? 0 : 1);
