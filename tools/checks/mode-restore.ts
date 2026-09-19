// Host migration, phase 3 (docs/PLAN_HOST_MIGRATION.md): the heir builds
// the crown and Control's zones again from what its copy of the match saw
// (modes.ts Crown.restore, Control.restore), and they carry on exactly as
// the host's would have: the crown's hold keeps counting to its win, a zone
// held keeps scoring, the bonus comes when the snapshot said, and a lockout
// keeps its clock.
//
// Run on its own: npx tsx tools/checks/mode-restore.ts.
import { Control, Crown, MODES } from "../../src/game/modes";
import { Ring } from "../../src/game/ring";
import { seeded } from "../../src/game/loot";

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

{
  // The battle royale's ring (phase 4): the heir draws the same plan from the
  // seed and puts it where a guest's view says it is, waiting or part way
  // through a close, and from there the two run in step to the end.
  const start = { cx: 0, cz: 0, r: 300 };
  let worst = 0;
  let cases = 0;
  for (const seed of [7, 99, 12345]) {
    for (const at of [20, 95, 140, 260]) {
      const host = new Ring(start, seeded(seed));
      for (let t = 0; t < at; t += 0.25) host.update(0.25);
      const heir = new Ring(start, seeded(seed));
      heir.restore({ phase: host.phase, state: host.state, timeLeft: host.timeLeft }, start);
      cases++;
      for (let k = 0; k < 4000 && !host.done; k++) {
        host.update(0.25);
        heir.update(0.25);
        worst = Math.max(worst, Math.abs(host.current.cx - heir.current.cx), Math.abs(host.current.cz - heir.current.cz), Math.abs(host.current.r - heir.current.r), host.phase === heir.phase ? 0 : 1e9);
      }
    }
  }
  check("the ring: rebuilt from the seed where a guest saw it (waiting or mid-close, early and late), it runs in step with the host's to the end", worst < 1e-6, `${cases} cases, worst ${worst.toExponential(1)} m`);
}

console.log(fails === 0 ? "\nMODE RESTORE PASS" : `\nMODE RESTORE FAIL (${fails})`);
export const modeRestoreFails = fails;
if (process.argv[1]?.endsWith("mode-restore.ts")) process.exit(fails === 0 ? 0 : 1);
