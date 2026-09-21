// How a figure holds a gun (src/game/hold.ts, src/config/figure.json).
//
// The animation library the figures use is a pistol library: it has an aim
// pose with two hands out in front and nothing at all for a rifle. So a long
// gun is not animated, it is hung off the chest at a point we choose and both
// arms are reached onto it, and that point is the whole of how a figure looks
// holding a gun. It used to be three numbers in the middle of the rigging
// code, one of which put the grip inboard of the shoulder; a stock sits behind
// the grip, so inboard of the shoulder put the stock beside the neck. Guns
// went through people, which is what the owner reported.
//
// What is checked here is the arithmetic: a gun's own length decides how far
// forward it hangs, no gun ends up with its stock deeper in the body than a
// stock goes, a longer gun always hangs further out than a shorter one, and
// the support hand, when the handguard is further away than the arm is long,
// takes hold further back along the gun instead of hanging in the air.
//
// The gun models themselves need a canvas to build, so what each gun actually
// measures is checked in a real page: the e2e `hold` section.
//
// Run on its own: npx tsx tools/checks/hold.ts.
import { HOLD, gripAt, gripForward, reachFraction, stockBehind, tooLongToHold } from "../../src/game/hold";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

/** what the guns in the game actually measure behind their grips, metres (the e2e prints these) */
const REAL = [
  { id: "a pistol", rear: 0.04 },
  { id: "the Volt", rear: 0.09 },
  { id: "an SMG", rear: 0.27 },
  { id: "a rifle", rear: 0.41 },
  { id: "a marksman rifle", rear: 0.43 },
  { id: "an LMG", rear: 0.45 },
];

console.log("How a figure holds a gun");
{
  check("the shoulder pocket is outboard of the joint, not inboard of it: this is the bug that put stocks through chests", HOLD.out > 0, `${HOLD.out} m out`);
  check("a stock sits in the shoulder rather than in front of it, so the allowance is not zero", HOLD.stockAllow > 0.05 && HOLD.stockAllow < 0.25, `${HOLD.stockAllow} m`);
  check("and a gun hangs in front of the shoulder, below it", HOLD.forward > 0.1 && HOLD.drop > 0, `${HOLD.forward} m forward, ${HOLD.drop} m down`);
  check("there is a limit to how far forward a gun may be pushed, or a hand would be sent somewhere it cannot reach", HOLD.maxForward > HOLD.forward, `${HOLD.maxForward} m`);
}
{
  for (const g of REAL) {
    check(`${g.id}: its stock clears the body`, !tooLongToHold(g.rear), `${(stockBehind(g.rear) * 100).toFixed(0)} cm behind the shoulder, ${HOLD.stockAllow * 100} allowed`);
  }
  const lengths = REAL.map((g) => gripForward(g.rear));
  check("a longer gun never hangs closer in than a shorter one", lengths.every((f, i) => i === 0 || f >= lengths[i - 1] - 1e-9), lengths.map((f) => f.toFixed(2)).join(" -> "));
  check("a short gun is not pushed out at all: it hangs where the hold says", gripForward(0.04) === HOLD.forward && gripForward(0.27) === HOLD.forward, `${gripForward(0.27)} m`);
  check("a long one is pushed out exactly far enough and no further", Math.abs(stockBehind(0.45) - HOLD.stockAllow) < 1e-9, `${gripForward(0.45).toFixed(2)} m forward`);
  check("and an absurd gun stops at the limit rather than being held at arm's length", gripForward(9) === HOLD.maxForward && tooLongToHold(9), "a 9 m gun");
}
{
  const sh = { x: 0.19, y: 1.42, z: 0 };
  const rifle = gripAt(sh, 0.41);
  const smg = gripAt(sh, 0.27);
  check("the grip goes outboard of the shoulder, below it and in front", rifle.x > sh.x && rifle.y < sh.y && rifle.z > sh.z, JSON.stringify(rifle));
  check("a rifle's grip is further out than an SMG's, because its stock is longer", rifle.z > smg.z, `${rifle.z.toFixed(2)} m against ${smg.z.toFixed(2)}`);
  const left = gripAt({ x: -0.19, y: 1.42, z: 0 }, 0.41);
  check("and a left-handed shoulder puts it out to the left, not through the chest", left.x < -0.19, `${left.x.toFixed(2)}`);
}
{
  // the support hand: the handguard, or as far along the gun as the arm reaches
  const arm = 0.547;
  const near: number[] = [0.3, 0, 0.3];
  const far: number[] = [0.41, 0, 0.6];
  const toGrip: number[] = [-0.1, 0, -0.3];
  check("a hand that can reach the handguard takes the handguard", reachFraction(near, toGrip, arm) === 0, `${Math.hypot(...near).toFixed(2)} m away, arm ${arm}`);
  const t = reachFraction(far, toGrip, arm);
  check("a hand that cannot slides back along the gun until it can", t > 0 && t < 1, `${(t * 100).toFixed(0)}% of the way to the grip`);
  const at = far.map((v, i) => v + toGrip[i] * t);
  check("and where it lands is exactly within reach, not short of it", Math.abs(Math.hypot(...at) - arm) < 1e-6, `${Math.hypot(...at).toFixed(3)} m against an arm of ${arm}`);
  check("a gun whose whole length is out of reach puts both hands together at the grip", reachFraction([2, 0, 2], toGrip, arm) === 1);
  check("a hand reaching for something it is already on stays where it is", reachFraction([0, 0, 0], toGrip, arm) === 0);
  check("and a gun with no length to slide along does not divide by nothing", reachFraction(far, [0, 0, 0], arm) === 1);
}

console.log(fails === 0 ? "\nHOLD PASS" : `\nHOLD FAIL (${fails})`);
export const holdFails = fails;
if (process.argv[1]?.endsWith("hold.ts")) process.exit(fails === 0 ? 0 : 1);
