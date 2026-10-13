// Display-name policy (PROJECT_RULES.md section 2): real names while the
// project is private, codenames on any public URL.
//
// The public (beta) build (`npm run build:beta`) sets __PUBLIC_BUILD__, and
// vite.config.ts also blanks the real names out of the bundled weapon data,
// so they are not in the shipped files at all.
// `tools/beta-check.ts` fails if any real name is left in `dist/`.
// `typeof` first: the node-run tools (verify, movesim) have no Vite define.
export const PUBLIC_BUILD = typeof __PUBLIC_BUILD__ !== "undefined" && __PUBLIC_BUILD__;
export const NAME_MODE: "real" | "codename" = PUBLIC_BUILD ? "codename" : "real";

/**
 * Every weapon on the public build. The owner's call (phase 13): "Not R-301"
 * reads better than a class name like "Carbine A", and says plainly that this
 * is a replica of a published number set rather than the gun itself.
 *
 * It does put the real name on the screen, so `tools/beta-check.ts` allows a
 * real name **only** in this exact form: a bare one anywhere in `dist/` still
 * fails the build.
 *
 * The course pistol keeps a made-up name: its real one is a firearm brand
 * rather than a game's weapon, which is not ours to joke with.
 */
const CODENAMES: Record<string, string> = {
  vinson: "Not Flatline",
  "3030": "Not 30-30",
  sentinel: "Not Sentinel",
  r97: "Not R-99",
  alternator_smg: "Not Alternator",
  lstar: "Not L-STAR",
  shotgun: "Not EVA-8",
  mastiff: "Not Mastiff",
  wingman: "Not Wingman",
  autopistol: "Not RE-45",
  semipistol: "Not P2020",
  g17: "Striker 9",
};

/** optic labels, by attachment mod name */
const OPTIC_CODENAMES: Record<string, string> = {
  optic_cq_holosight: "1x ring sight",
  optic_cq_hcog_classic: "1x red dot",
  optic_cq_threat: "1x threat sight",
  optic_cq_hcog_bruiser: "2x chevron sight",
  optic_cq_holosight_variable: "1x-2x variable ring",
  optic_ranged_hcog: "3x chevron scope",
  optic_ranged_aog_variable: "2x-4x variable scope",
  optic_sniper: "6x scope",
  optic_sniper_variable: "4x-8x variable scope",
  optic_sniper_threat: "4x-10x threat scope",
};

export function displayName(id: string, realName: string): string {
  return NAME_MODE === "real" ? realName : CODENAMES[id] ?? id;
}

export function opticName(mod: string, realLabel: string): string {
  return NAME_MODE === "real" ? realLabel : OPTIC_CODENAMES[mod] ?? realLabel;
}
