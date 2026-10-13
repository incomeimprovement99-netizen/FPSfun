// Which game this page is: SpeedKills, the one game (docs/PHASE_18_PLAN_SPEEDKILLS.md).
//
// The legacy game (Milestones 1 to 182, frozen at the git tag apex-era-final)
// was a second game on the same code until Milestone 520, reached by a
// ?game=legacy address for the tests that still ran it; the owner retired it
// (2026-10-09: "i am fine with retiring all old apex-range stuff"), and its
// profile, its switch and those tests went. Its code went milestone by
// milestone after it (docs/PLAN_LEGACY_REMOVAL.md), and with the last branch
// on it folded, the IS_SK constant that stood in for the switch went too
// (Milestone 622).
//
// Pure: no three.js and no DOM work at import, so the node checks load it.
import speedkills from "../config/games/speedkills.json";

export type GameId = "speedkills";

/** a game's profile, src/config/games/<id>.json; the notes there say what each part means */
export interface GameProfile {
  id: string;
  name: string;
  tagline: string;
  /** every gun in play */
  roster: string[];
  /** the roster in families, each with its label */
  families: Record<string, { label: string; guns: string[] }>;
  /** a gun's own name, its role in its pair and its fixed optic, where the game gives them */
  weapons: Record<string, { name: string; role: string; optic: string; kind?: string }>;
  /** the classes of guns outside the roster (the Run's pistols) */
  otherKinds?: Record<string, string>;
  /** and their names */
  otherNames?: Record<string, string>;
  /** the attachment slots in play (none: fusion is the upgrade) */
  attachments: string[];
  ammo: "infinite" | "typed" | string;
  fusion: { on: boolean; levels: number; gun: Array<{ mag: number; reload: number; damage: number; recoil: number; swap?: number }>; abilityLevels: number; cooldownStep: number };
  abilities: { slots: string[]; passives: boolean; ultimates: boolean; set: Array<{ id: string; slot: string; from: string | null; name: string; blurb: string }> };
  life: { knockdowns: boolean; gulag: boolean; ghost: boolean; reviveSeconds: number; awaySlowdown: number; followRadius: number; ghostRevives: number; ghostSight: number; ghostSpeed?: number; restoreHealth?: number };
  /** null: the legacy game's own health, shields, EVO and heals */
  health: { health: number; shield: number; shieldDelay: number; shieldFill: number; healthDelay: number; healthRegen: number } | null;
  /** the battle royale's size: most players, and how many to a squad by default */
  match: { maxPlayers: number; team: number; teams?: Array<{ id: string; size: number; label: string; bots: number[]; defaultBots: number; bleed: number }> };
  map: string;
  hud: string;
  menu: string;
  bots: string[];
  /** what this game calls each bot tier (absent: the tier's own name) */
  botNames?: Record<string, string>;
  identity: { title: string; accent: string; accent2: string; sky: string; skies?: string[] };
  /** the game's own versions of lists the legacy game keeps in its configs; absent: the legacy game's own */
  /** loadoutPick: a tag; a browser that has not seen this one is moved onto the first default once (loadouts.ts) */
  lists?: { botWeapons: string[]; loadouts: string[][]; gulagGuns: string[]; loadoutNames?: string[]; botRename?: Record<string, string>; loadoutPick?: string };
  /** the battle royale's floor: spots a sector by tier, the chances of a gun and a hack core, their fusion odds */
  loot?: { spots: Record<string, number>; gunChance: number; hackChance: number; gunOdds: Record<string, number[]>; hackOdds: Record<string, number[]>; maxFloor?: number; restock?: LootRestock; carePackage?: CarePackage };
  /** a bot's tier speed times this (speedkills.json botSpeedScale; Phase 20 A15) */
  botSpeedScale?: number;
  /** and a tier's own on top of it (speedkills.json botTierSpeed: Casual slower) */
  botTierSpeed?: Record<string, number>;
  /** a fighting bot's sideways share times this (speedkills.json botStrafe) */
  botStrafe?: number;
  /** the battle royale row as everyone starts it, written once over what a browser had (main.ts applyBrDefaults) */
  brDefaults?: { tag: string; team: string; bots: number; pace: string; start: string; difficulty: string };
  /** a bot's tier aim lag times this (speedkills.json botAimLagScale; Phase 20 A18) */
  botAimLagScale?: number;
  /** how a fight feels (speedkills.json feel): the aimed enemy's outline, the speed streaks */
  feel?: { outline: { color: string; px: number; min: number; back: number; range: number }; streaks: { from: number; full: number; opacity: number } };
  /** the first-person gun over viewmodel.json's (absent: the legacy game's own) */
  viewmodel?: { reloadAds: number; support?: { roll: number; below: number; corner: number[]; cornerAds: number[]; straighten: number; maxRoll: number } };
  /** the dropship over squad.json's (doorsIn: the seconds before a jump is allowed) */
  ship?: { doorsIn: number; centre?: { near: number; far: number } };
  /** each gun's tuning over its legacy numbers (multipliers; headshotDamage outright) */
  tuning?: Record<string, { damage: number; fireRate: number; recoil: number; mag?: number; headshotDamage?: number; far?: number; veryFar?: number }>;
  /** an id the roster no longer has, to the one that took its name (loadouts.ts valid) */
  renamed?: Record<string, string>;
}

/** the hot zone's loot coming back (speedkills.json loot.restock): seconds, a share, spots, metres */
export interface LootRestock {
  every: number;
  below: number;
  batch: number;
  near: number;
}

/** what a care package holds (speedkills.json loot.carePackage): how many guns and hack cores, and their level odds, one number a level */
export interface CarePackage {
  guns: number;
  gunOdds: number[];
  hacks: number;
  hackOdds: number[];
}

/** this page's game */
export const GAME: GameId = "speedkills";

/** its profile (src/config/games/speedkills.json): what is in play, and the design that differs */
export const PROFILE: GameProfile = speedkills;

