// What the other players' shots look like: the second AAA gap pass's feel
// items, the parts that are pure numbers.
//
// A muzzle flash has to read at the map's sightlines: never fewer than
// minPx pixels across however far away, and the size it was made at up close.
//
// Run on its own: npx tsx tools/checks/feel.ts.
import hudCfg from "../../src/config/hud.json";
import audioCfg from "../../src/config/audio.json";
import { MUZZLE, flashSize } from "../../src/game/muzzle";
import { blastShakeDeg } from "../../src/game/impacts";

let fails = 0;
function check(label: string, cond: boolean, detail = ""): void {
  if (!cond) fails++;
  console.log(`${cond ? "  ok  " : "FAIL  "}${label}${detail ? ` (${detail})` : ""}`);
}

console.log("Muzzle flashes, damage numbers, the low-ammo line");
{
  // a 1080-pixel-high view at the game's 90 degree vertical field of view
  const pxPerRad = 1080 / (Math.PI / 2);
  const px = (dist: number) => (flashSize(dist, pxPerRad) / dist) * pxPerRad;
  check("a flash up close is its own size", flashSize(5, pxPerRad) === MUZZLE.size, `${flashSize(5, pxPerRad)} m at 5 m`);
  check(`a flash at 150 m and 300 m is still ${MUZZLE.minPx} pixels across or more`, px(150) >= MUZZLE.minPx - 1e-6 && px(300) >= MUZZLE.minPx - 1e-6, `${px(150).toFixed(1)} px at 150 m, ${px(300).toFixed(1)} px at 300 m`);
  check("a flash lasts about two frames at 60 fps", MUZZLE.life >= 0.02 && MUZZLE.life <= 0.06, `${MUZZLE.life} s`);
  check("damage numbers stack within a spray's gaps, and pop briefly", hudCfg.damageNumbers.stack >= 0.3 && hudCfg.damageNumbers.stack <= 1.2 && hudCfg.damageNumbers.pop <= 0.15);
  check("the low-ammo line comes before the click, and short magazines are left alone", hudCfg.lowAmmo.warn >= hudCfg.lowAmmo.click && hudCfg.lowAmmo.minClip >= 4);
}

// A blast's shake: full at its heart, nothing past its radius.
{
  const B = hudCfg.blasts;
  check("a blast shakes the view hardest at its heart, and not at all past its radius", blastShakeDeg(0) === B.shakeDeg && blastShakeDeg(B.shakeRadius) === 0 && blastShakeDeg(B.shakeRadius / 2) < B.shakeDeg / 2, `${blastShakeDeg(0)} deg at 0 m, ${blastShakeDeg(B.shakeRadius / 2).toFixed(2)} at ${B.shakeRadius / 2} m`);
  check("your ears ring only close to one", B.ringRadius < B.shakeRadius / 2 && B.ringTime <= 2.5);
}

// How far a sound carries: the panner's own inverse-distance law (ref /
// (ref + rolloff * (d - ref))), with the reference distance each kind gets.
{
  const ROLLOFF = 1.1;
  const db = (ref: number, d: number) => 20 * Math.log10(ref / (ref + ROLLOFF * Math.max(0, d - ref)));
  const R = audioCfg.distance.ref;
  check("a gunshot at 100 m is heard (about -15 dB), where one curve for every sound had it at -31", db(R.gun, 100) > -17 && db(R.default, 100) < -28, `${db(R.gun, 100).toFixed(1)} dB now, ${db(R.default, 100).toFixed(1)} on the old curve`);
  check("and at 300 m it is still there (above -26 dB)", db(R.gun, 300) > -26, `${db(R.gun, 300).toFixed(1)} dB`);
  check("footsteps still fade fast (below -15 dB at 20 m)", db(R.default, 20) < -15, `${db(R.default, 20).toFixed(1)} dB`);
  check("a blast carries further than a gunshot", R.blast >= R.gun);
}

console.log(fails === 0 ? "\nFEEL PASS" : `\nFEEL FAIL (${fails})`);
export const feelFails = fails;
if (process.argv[1]?.endsWith("feel.ts")) process.exit(fails === 0 ? 0 : 1);
