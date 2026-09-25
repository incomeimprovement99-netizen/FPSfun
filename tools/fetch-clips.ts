// The figures' animation clips, from Quaternius's Universal Animation Library
// 1 and 2 (CC0), free tiers: 43 clips each, on the same universal humanoid
// rig as the bodies and every garment (the Unreal mannequin's bone names).
//
// The game ships two trimmed files rather than the libraries: the first, with
// the grey mannequin's mesh, from library 1; the second, clips only, from
// library 2. Each is cut down to the clips the game plays (tools/trim-glb.ts),
// which is a fraction of the size. This is the source of truth for which
// those are: add a clip here and to the code that plays it, and run
//
//   npm run clips
//
// The trimmed files are kept in git (public/models/mannequin), so a checkout
// has them without running this.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { itchZip } from "./itch";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const TMP = process.env.TEMP ?? "/tmp";

const UAL1 = { slug: "universal-animation-library", upload: 17958403, glb: "Universal Animation Library[Standard]/Unreal-Godot/UAL1_Standard.glb" };
const UAL2 = { slug: "universal-animation-library-2", upload: 17958478, glb: "Universal Animation Library 2[Standard]/Unreal-Godot/UAL2_Standard.glb" };

/**
 * The files, and what goes in each. The first two are what every figure
 * needs before it can stop being a grey robot, and they load before anything
 * else (mannequin.ts loadMannequin). The extras are what a figure does now and
 * then - a slide's way in and out, a throw, a revive, an emote - and they load
 * after it is up, so 2.6 MB of them never holds a page up.
 */
const FILES = [
  {
    ...UAL1,
    out: "public/models/mannequin/mannequin.glb",
    mesh: true,
    clips: [
      ..."Idle_Loop Walk_Loop Jog_Fwd_Loop Sprint_Loop Crouch_Idle_Loop Crouch_Fwd_Loop Jump_Start Jump_Loop Jump_Land Roll".split(" "),
      ..."Pistol_Idle_Loop Pistol_Aim_Neutral Pistol_Aim_Up Pistol_Aim_Down Pistol_Shoot Pistol_Reload".split(" "),
      ..."Punch_Jab Hit_Chest Death01".split(" "),
    ],
  },
  { ...UAL2, out: "public/models/mannequin/mannequin-more.glb", mesh: false, clips: "Slide_Loop ClimbUp_1m Idle_Rail_Loop Consume Hit_Knockback LayToIdle".split(" ") },
  // Phase 17 (docs/FEEL_GAP.md): a second punch, a headshot that reads, a
  // hand to a door or a bin, a revive, a dance
  { ...UAL1, out: "public/models/mannequin/mannequin-extra-1.glb", mesh: false, clips: "Punch_Cross Hit_Head Interact Fixing_Kneeling Dance_Loop".split(" ") },
  // a slide with a way in and a way out, a throw, a hook, an athletic jump, and two more emotes
  {
    ...UAL2,
    out: "public/models/mannequin/mannequin-extra-2.glb",
    mesh: false,
    clips: "Slide_Start Slide_Exit OverhandThrow Melee_Hook NinjaJump_Idle_Loop Yes Idle_FoldArms_Loop".split(" "),
  },
];

for (const lib of FILES) {
  const zip = join(TMP, `${lib.slug}.zip`);
  if (!existsSync(zip)) itchZip(lib.slug, lib.upload);
  const dir = join(TMP, `${lib.slug}-x`);
  const src = join(dir, lib.glb);
  if (!existsSync(src)) execFileSync("python", ["-c", `import zipfile;zipfile.ZipFile(r"${zip}").extract(r"${lib.glb}", r"${dir}")`]);
  // through a shell, since npx is a script on Windows; every argument quoted, since the library's paths have spaces and brackets
  const args = ["tsx", "tools/trim-glb.ts", src, join(ROOT, lib.out), ...(lib.mesh ? [] : ["--no-mesh"]), ...lib.clips];
  execFileSync(`npx ${args.map((a) => JSON.stringify(a)).join(" ")}`, { cwd: ROOT, stdio: "inherit", shell: true });
}
