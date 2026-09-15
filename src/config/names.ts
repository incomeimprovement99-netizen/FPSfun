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

/** every weapon, generic names by class */
const CODENAMES: Record<string, string> = {
  rspn101: "Carbine A",
  vinson: "Rifle B",
  hemlok: "Burst Rifle",
  energy_ar: "Energy Rifle",
  "3030": "Lever Rifle",
  g2: "Scout Rifle",
  dmr: "Marksman Rifle",
  doubletake: "Triple Rifle",
  sentinel: "Bolt Rifle",
  sniper: "Heavy Sniper",
  defender: "Beam Rifle",
  r97: "SMG A",
  volt_smg: "SMG B",
  car: "SMG C",
  alternator_smg: "SMG D",
  pdw: "Burst SMG",
  lmg: "LMG A",
  esaw: "LMG B",
  dragon_lmg: "LMG C",
  lstar: "Energy LMG",
  shotgun: "Auto Shotgun",
  mastiff: "Heavy Shotgun",
  energy_shotgun: "Choke Shotgun",
  shotgun_pistol: "Shotgun Pistol",
  wingman: "Revolver",
  autopistol: "Auto Pistol",
  semipistol: "Pistol A",
  g17: "Striker 9",
  nemesis: "Burst Rifle E",
  bocek: "Compound Bow",
};

/**
 * hop-ups: the game's names while private, generic ones on a public build.
 * Each is its own ternary on the build flag, so the minifier drops the name
 * the build does not use (a table of both shipped both).
 */
const HOPUP_NAMES: Record<string, string> = {
  hopup_turbocharger: PUBLIC_BUILD ? "spin-up kit" : "Turbocharger",
  hopup_headshot_dmg: PUBLIC_BUILD ? "head rounds" : "Skullpiercer",
  hopup_unshielded_dmg: PUBLIC_BUILD ? "hollow points" : "Hammerpoint",
  hopup_shield_breaker: PUBLIC_BUILD ? "shield rounds" : "Disruptor",
  hopup_energy_choke: PUBLIC_BUILD ? "choke" : "Precision choke",
  altfire_double_tap: PUBLIC_BUILD ? "double shot" : "Double tap",
  selectfire: PUBLIC_BUILD ? "mode switch" : "Selectfire",
  hopup_executioner: PUBLIC_BUILD ? "knock recharge" : "Executioner",
  hopup_shattercaps: PUBLIC_BUILD ? "split rounds" : "Shattercaps",
  hopup_redline: PUBLIC_BUILD ? "hot bolts" : "Redline",
};
export function hopupName(mod: string): string {
  return HOPUP_NAMES[mod] ?? mod;
}

/** throwables: the frag and the thermite are plain words; the arc star is the game's own name */
const THROW_NAMES: Record<string, string> = {
  frag: "FRAG GRENADE",
  arcstar: PUBLIC_BUILD ? "SPARK STAR" : "ARC STAR",
  thermite: "THERMITE",
};
export function throwName(kind: string): string {
  return THROW_NAMES[kind] ?? kind.toUpperCase();
}

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
