// Typed access to data/weapons.json and resolution into the numbers the
// simulation consumes. Everything gameplay-relevant comes from here.
import { PROFILE } from "./game";
import raw from "../../data/weapons.json";
import { displayName } from "../config/names";
import mechCfg from "../config/weapon-mechanics.json";
import ammoCfg from "../config/ammo.json";
import rocketCfg from "../config/rocket.json";

export type AmmoType = "light" | "heavy" | "energy" | "sniper" | "shotgun";

/**
 * The rules of a gun that is not a plain trigger (src/config/weapon-mechanics.json): the L-STAR's heat and the
 * shotguns' blast patterns. The legacy guns' own went with them (Milestone 522).
 */
export interface WeaponMech {
  /** L-STAR: the magazine is its heat; empty is an overheat with a forced cooldown */
  overheat: { lockout: number; coolDelay: number; coolTime: number } | null;
  /**
   * Shotguns: the fixed pellet pattern (blast.ts). `shape` is [across, up] per
   * pellet in `unit` hammer units at `zeroDistance`; `scale` and `adsScale`
   * are the data's blast_pattern scales; `jitter` is degrees of random on top.
   */
  blast: { shape: Array<[number, number]>; unit: number; jitter: number; scale: number; adsScale: number; zeroDistance: number } | null;
}

type MechTable = Record<string, Record<string, unknown>>;
const mechOf = <T>(table: string, id: string): T | null => ((mechCfg as unknown as Record<string, MechTable>)[table]?.[id] as T | undefined) ?? null;

export type Pattern = { loopOffset: number; startMax: number; bullets: number[][] };
export type Spring = Record<string, number>;
export interface WeaponDef {
  id: string;
  name: string;
  stats: Record<string, number | string>;
  mods: Record<string, Record<string, number | string>>;
  /** mod name for each of the data's mag levels 0..4 (the first is the gun as it comes; the legacy game's others went, Milestone 522) */
  magMods: Array<string | null>;
  /** explicit clip size per mag level from the current-season override table (the first is the one used) */
  magClips: number[] | null;
  /** projectiles per trigger pull; shotguns fire several */
  pellets?: number;
}
interface DataFile {
  weapons: Record<string, WeaponDef>;
  patterns: Record<string, Pattern>;
  springs: Record<string, Spring>;
}
export const DATA = raw as unknown as DataFile;

/**
 * Weapons that are not in the game's data. The Glock 17 is here for the
 * movement course: it takes the P2020's handling (damage, fire rate, spread,
 * recoil, ADS) and its own 17-round magazine, with extended magazines at the
 * sizes the real one ships with.
 */
function addDerived(id: string, base: string, name: string, clips: number[], stats: Record<string, number> = {}, keepMod: (m: string) => boolean = () => true): void {
  const b = DATA.weapons[base];
  if (!b || DATA.weapons[id]) return;
  const mods = Object.fromEntries(Object.entries(b.mods).filter(([m]) => keepMod(m)));
  DATA.weapons[id] = {
    ...b,
    id,
    name,
    stats: { ...b.stats, ...stats, ammo_clip_size: clips[0] },
    mods,
    magClips: clips,
  };
}
const PUB = typeof __PUBLIC_BUILD__ !== "undefined" && __PUBLIC_BUILD__;
// The public build folds these to their codenames, so no real name ships.
addDerived("g17", "semipistol", PUB ? "Striker 9" : "Glock 17", [17, 19, 21, 24, 24]);
// (the Nemesis and the Bocek were derived here, off the Hemlok and the G7: legacy guns, gone with it, Milestone 521)

// DEVINOS's rocket launcher (src/game/rocket.ts, rocket.json), SpeedKills' alone (weaponIds leaves it out of the legacy
// game's catalogue, which is the data's whole): no gun in the data fires a rocket, so the 30-30's handling
// with the rocket's own numbers; its damage by distance is how far the rocket has flown to its burst (10 point blank to
// 50 from 20 m), the curve every gun's damage takes, here rising; no headshot; the burst does the damage (rocket_blast)
addDerived(
  "launcher",
  "3030",
  "Launcher",
  Array(5).fill(rocketCfg.magazine),
  {
    damage_near_value: rocketCfg.damage.pointBlank, damage_far_value: rocketCfg.damage.full, damage_very_far_value: rocketCfg.damage.full,
    damage_near_distance: rocketCfg.damage.from / 0.0254, damage_far_distance: rocketCfg.damage.fullFrom / 0.0254, damage_very_far_distance: (rocketCfg.damage.fullFrom + 10) / 0.0254,
    damage_headshot_scale: 1, damage_leg_scale: 1, headshot_distance: 0,
    fire_rate: rocketCfg.fireRate, is_semi_auto: 1, rechamber_time: 0,
    reload_time: rocketCfg.reload, reloadempty_time: rocketCfg.reload,
    projectile_launch_speed: rocketCfg.speed / 0.0254, projectile_gravity_scale: 0, bolt_gravity_enabled: 0, projectile_lifetime: rocketCfg.lifetime,
    rocket_blast: 1,
  },
  (m) => m.startsWith("optic_")
);

/** metres per engine unit (1 unit = 1 inch) */
export const U = 0.0254;
/** engine world gravity, units/s^2 (Titanfall-family default) */
export const ENGINE_GRAVITY_U = 750;

function n(stats: Record<string, number | string>, key: string, fallback = 0): number {
  const v = stats[key];
  return typeof v === "number" ? v : fallback;
}

export interface ResolvedWeapon {
  id: string;
  name: string;
  /** SpeedKills' fusion level, 0 as found (a bought gun's skin follows it, paidgun.ts) */
  fusion?: number;
  /** the fitted optic's mod name, or null for iron sights */
  optic: string | null;
  damage: {
    near: number; far: number; veryFar: number;
    nearDist: number; farDist: number; veryFarDist: number; // metres
    headshot: number; leg: number; headshotMaxDist: number;
    /** extra damage to a shield (Disruptor rounds: the data's damage_shield_scale) */
    shieldScale: number;
    /** extra damage to bare health (Hammerpoint: damage_unshielded_scale) */
    unshieldedScale: number;
  };
  mech: WeaponMech;
  /** the ammo it takes, and for an energy gun the magazines its own stockpile holds (0: the inventory's) */
  ammoType: AmmoType;
  energyStock: number;
  fireRate: number; // rounds per second
  /**
   * Pump and bolt-action delay between shots, seconds. On those weapons it is
   * much longer than 1/fireRate and is what actually governs the cadence: the
   * Sentinel reads 3.1 rps (0.32 s) but rechambers in 1.62 s. Use
   * `shotInterval` rather than 1/fireRate.
   */
  rechamberTime: number;
  /** seconds between shots, the larger of the fire-rate and rechamber limits */
  shotInterval: number;
  /** projectiles per trigger pull; 1 for everything but shotguns */
  pellets: number;
  semiAuto: boolean;
  clipSize: number;
  reloadTime: number;
  reloadEmptyTime: number;
  adsIn: number;
  adsOut: number;
  deployTime: number; // time to raise this weapon when swapped to
  holsterTime: number; // time to put this weapon away
  zoomFov43: number; // 4:3 horizontal, before FOV scale
  /** a variable optic's second zoom (zoom_toggle_fov), null for fixed ones */
  zoomToggleFov43: number | null;
  /** seconds to blend between the two zooms (zoom_toggle_lerp_time) */
  zoomToggleLerp: number;
  /** Digital Threat optics: enemies highlighted out to here, metres (fade start, end) */
  threatRange: [number, number] | null;
  adsMoveScale: number;
  projectile: { speed: number; gravity: number; lifetime: number }; // m/s, m/s^2, s
  /** its round bursts where it stops, and the burst does the damage (DEVINOS's rocket, rocket.ts) */
  blast?: boolean;
  spread: {
    standHip: number; runHip: number; sprintHip: number; crouchHip: number; airHip: number;
    standAds: number; crouchAds: number; airAds: number;
    kickOnFireHip: number; maxKickHip: number; kickOnFireAds: number; maxKickAds: number;
    decayDelay: number; decayRate: number; movingDecayRate: number;
  };
  viewkick: {
    pattern: Pattern | null;
    /** cold spring: used when the gun is not firing */
    spring: Spring | null;
    /**
     * hot spring: blended in as "heat" builds while firing. For the R-301 the
     * hot ADS pitch springConstant is 0, i.e. NO restoring force, so the view
     * punch holds during a spray and only snaps back once the gun cools.
     */
    springHot: Spring | null;
    heatPerShot: number;
    cooldownHoldTime: number;
    cooldownFadeTime: number;
    /** pattern cursor: +valuePerShot per shot, decays back after a delay */
    valuePerShot: number;
    valueDecayDelay: number;
    valueDecayRate: number;
    pitchBase: number; pitchRandom: number; pitchSoft: number; pitchHard: number;
    yawBase: number; yawRandom: number; yawInnerExclude: number; yawSoft: number; yawHard: number;
    airScaleAds: number; duckScale: number;
    permPitchBase: number; permPitchRandom: number; permYawBase: number; permYawRandom: number;
  };
}

/** a gun's category in the weapon data (menu_category): ar, smg, lmg, shotgun, sniper, pistol (the handgun is a pistol) */
export function weaponClass(id: string): string {
  const w = (DATA as unknown as { weapons: Record<string, { stats?: Record<string, unknown> } | undefined> }).weapons[id];
  const c = String(w?.stats?.menu_category ?? "");
  return c === "handgun" ? "pistol" : c;
}

/**
 * The guns in play: SpeedKills' roster (speedkills.json). The pickers, a
 * loadout's check and the network's hit check all follow it.
 */
export function weaponIds(): string[] {
  return [...PROFILE.roster];
}
/** every gun the engine can make, whatever game is on */
export function allWeaponIds(): string[] {
  return Object.keys(DATA.weapons);
}
export function weaponName(id: string): string {
  // SpeedKills' guns carry their own names, the same in every build
  const sk = PROFILE.weapons[id]?.name ?? PROFILE.otherNames?.[id];
  if (sk) return sk;
  return displayName(id, DATA.weapons[id]?.name ?? id);
}
/** SpeedKills: a gun's two-word class (speedkills.json kind), or null for a gun it names none for */
export function weaponKind(id: string): string | null {
  return PROFILE.weapons[id]?.kind ?? PROFILE.otherKinds?.[id] ?? null;
}
/**
 * A gun as a beginner reads it, "USSO (Fast SMG)" (the owner, Phase 20 A7), where there is room for it; the bare
 * name, weaponName, stays for the tight spots, and is all the legacy game shows
 */
export function weaponLabel(id: string): string {
  const k = weaponKind(id);
  return k ? `${weaponName(id)} (${k})` : weaponName(id);
}
/** this weapon's Mods block, keyed by mod name, for attachment discovery */
export function weaponMods(id: string): Record<string, Record<string, number | string>> {
  return DATA.weapons[id]?.mods ?? {};
}

/**
 * Apply one mod's fields over a stat block. Mod values are either absolute
 * numbers or operators: `*x` scales, `++x` adds, `--x` subtracts.
 */
function applyMod(stats: Record<string, number | string>, mod: Record<string, number | string>): void {
  for (const [key, raw] of Object.entries(mod)) {
    if (typeof raw === "number") {
      stats[key] = raw;
      continue;
    }
    const t = raw.trim();
    const op = t.startsWith("*") ? "*" : t.startsWith("++") ? "++" : t.startsWith("--") ? "--" : null;
    if (!op) {
      // A bare numeric string is an absolute value, not text. Storing it as a
      // string made every later read fall through to a hardcoded default and
      // any later `*` mod see a base of 0.
      const asNum = Number(t);
      stats[key] = t !== "" && Number.isFinite(asNum) ? asNum : raw;
      continue;
    }
    const num = Number(t.slice(op.length));
    if (!Number.isFinite(num)) continue;
    const base = stats[key];
    if (typeof base !== "number") {
      // Scaling a stat the weapon does not have must leave it absent, not
      // invent it as 0: a fabricated 0 defeats the fallback chains below
      // (a missing reloadempty_time would become an instant reload).
      if (op === "*") continue;
      stats[key] = op === "++" ? num : -num;
      continue;
    }
    stats[key] = op === "*" ? base * num : op === "++" ? base + num : base - num;
  }
}

/**
 * @param attach mod names to apply, in order. Mag levels are still addressed
 *   through `magLevel` because the reference data defines some mag steps in a
 *   base file that another level never overrides.
 */
/**
 * A gun, ready to fire: its data, its magazine level and attachments, and on
 * a SpeedKills page its own tuning and its fusion level (0 as found, to 5,
 * src/config/games/speedkills.json). The legacy game never applies either,
 * so every existing caller gets exactly what it always did.
 */
export function resolveWeapon(id: string, attach: string[] = [], fusion = 0): ResolvedWeapon {
  return speedkillsTuned(resolveBase(id, attach), fusion);
}

/** SpeedKills' tuning and fusion over a resolved gun */
function speedkillsTuned(r: ResolvedWeapon, fusion: number): ResolvedWeapon {
  const t = PROFILE.tuning?.[r.id];
  const rows = PROFILE.fusion.gun;
  const f = rows[Math.max(0, Math.min(rows.length - 1, Math.round(fusion)))] ?? { mag: 1, reload: 1, damage: 1, recoil: 1 };
  const dmg = (t?.damage ?? 1) * f.damage;
  const kick = (t?.recoil ?? 1) * f.recoil;
  const rate = t?.fireRate ?? 1;
  const d = r.damage;
  // (far and veryFar: the gun's own fall-off with range, as shares of its near damage; flat where not given)
  const damage = { ...d, near: d.near * dmg, far: d.far * dmg * (t?.far ?? 1), veryFar: d.veryFar * dmg * (t?.veryFar ?? 1) };
  // a headshot's damage outright (BOOG): the multiplier that gives it from the near damage
  if (t?.headshotDamage && damage.near > 0) damage.headshot = t.headshotDamage / damage.near;
  const vk = r.viewkick;
  return {
    ...r,
    name: PROFILE.weapons[r.id]?.name ?? r.name,
    damage,
    fireRate: r.fireRate * rate,
    shotInterval: r.shotInterval / rate,
    clipSize: Math.max(1, Math.round(r.clipSize * (t?.mag ?? 1) * f.mag)),
    reloadTime: r.reloadTime * f.reload,
    reloadEmptyTime: r.reloadEmptyTime * f.reload,
    fusion: Math.max(0, Math.round(fusion)),
    // switching guns: quicker as a base and quicker again with each level (speedkills.json fusion swap)
    deployTime: r.deployTime * (f.swap ?? 1),
    holsterTime: r.holsterTime * (f.swap ?? 1),
    viewkick: { ...vk, pitchBase: vk.pitchBase * kick, pitchRandom: vk.pitchRandom * kick, yawBase: vk.yawBase * kick, yawRandom: vk.yawRandom * kick },
  };
}

function resolveBase(id: string, attach: string[]): ResolvedWeapon {
  const w = DATA.weapons[id];
  if (!w) throw new Error(`unknown weapon ${id}`);
  const s: Record<string, number | string> = { ...w.stats };
  // the gun as it comes: the data's first magazine (fusion grows it, speedkillsTuned), its mod first so its reload
  // scaling survives the current season's clip
  const magMod = w.magMods[0];
  if (magMod && w.mods[magMod]) applyMod(s, w.mods[magMod]);
  if (w.magClips && typeof w.magClips[0] === "number") s.ammo_clip_size = w.magClips[0];
  for (const name of attach) {
    const mod = w.mods[name];
    if (mod) applyMod(s, mod);
  }
  const pat = typeof s.viewkick_pattern === "string" ? DATA.patterns[s.viewkick_pattern] ?? null : null;
  const spr = typeof s.viewkick_spring === "string" ? DATA.springs[s.viewkick_spring] ?? null : null;
  const gravScale = n(s, "projectile_gravity_scale", 1) * (n(s, "bolt_gravity_enabled", 1) ? 1 : 0);
  return {
    id,
    name: displayName(id, w.name),
    optic: attach.find((a) => a.startsWith("optic_") && Boolean(w.mods[a])) ?? null,
    damage: {
      near: n(s, "damage_near_value"),
      far: n(s, "damage_far_value", n(s, "damage_near_value")),
      veryFar: n(s, "damage_very_far_value", n(s, "damage_far_value", n(s, "damage_near_value"))),
      nearDist: n(s, "damage_near_distance", 1000) * U,
      farDist: n(s, "damage_far_distance", 2500) * U,
      veryFarDist: n(s, "damage_very_far_distance", 5000) * U,
      headshot: n(s, "damage_headshot_scale", 1.5),
      leg: n(s, "damage_leg_scale", 1),
      headshotMaxDist: n(s, "headshot_distance", 11828) * U,
      shieldScale: n(s, "damage_shield_scale", 1),
      unshieldedScale: n(s, "damage_unshielded_scale", 1),
    },
    mech: {
      overheat: (() => {
        const c = mechOf<{ lockout: number[]; coolDelay: number; coolTime: number }>("overheat", id);
        return c ? { lockout: c.lockout[0], coolDelay: c.coolDelay, coolTime: c.coolTime } : null;
      })(),
      blast: (() => {
        const c = mechOf<{ shape: Array<[number, number]>; unit: number; jitter: number }>("blast", id);
        if (!c || n(s, "pellets", 1) <= 1) return null;
        const scale = n(s, "blast_pattern_default_scale", 1);
        return { shape: c.shape, unit: c.unit, jitter: c.jitter, scale, adsScale: n(s, "blast_pattern_ads_scale", scale), zeroDistance: n(s, "blast_pattern_zero_distance", 512) };
      })(),
    },
    ammoType: ((ammoCfg.types as Record<string, string>)[id] ?? "light") as AmmoType,
    energyStock: (ammoCfg.energyStock as Record<string, number>)[id] ?? 0,
    fireRate: n(s, "fire_rate", 10),
    rechamberTime: n(s, "rechamber_time", 0),
    shotInterval: Math.max(1 / Math.max(1e-6, n(s, "fire_rate", 10)), n(s, "rechamber_time", 0)),
    pellets: Math.max(1, Math.round(n(s, "pellets", 1))),
    semiAuto: n(s, "is_semi_auto", 0) === 1 || s.fire_mode === "semi-auto",
    // whole rounds only: a `*1.25` mag on the L-STAR's 18 gives 22.5 raw
    clipSize: Math.max(1, Math.floor(n(s, "ammo_clip_size", 1))),
    reloadTime: n(s, "reload_time", 2),
    reloadEmptyTime: n(s, "reloadempty_time", n(s, "reload_time", 2)),
    adsIn: n(s, "zoom_time_in", 0.25),
    adsOut: n(s, "zoom_time_out", 0.2),
    deployTime: n(s, "deploy_time", 0.5),
    holsterTime: n(s, "holster_time", 0.4),
    zoomFov43: n(s, "zoom_fov", 55),
    zoomToggleFov43: n(s, "zoom_toggle_fov", 0) > 0 ? n(s, "zoom_toggle_fov") : null,
    zoomToggleLerp: n(s, "zoom_toggle_lerp_time", 0.15),
    threatRange:
      n(s, "threat_scope_enabled", 0) === 1
        ? [n(s, "threat_scope_fadedist_start", 0) * U, n(s, "threat_scope_fadedist_end", 0) * U]
        : null,
    adsMoveScale: n(s, "ads_move_speed_scale", 0.5),
    projectile: {
      speed: n(s, "projectile_launch_speed", 30000) * U,
      gravity: ENGINE_GRAVITY_U * gravScale * U,
      lifetime: n(s, "projectile_lifetime", 5),
    },
    blast: n(s, "rocket_blast", 0) === 1,
    spread: {
      standHip: n(s, "spread_stand_hip"),
      runHip: n(s, "spread_stand_hip_run", n(s, "spread_stand_hip")),
      sprintHip: n(s, "spread_stand_hip_sprint", n(s, "spread_stand_hip_run", n(s, "spread_stand_hip"))),
      crouchHip: n(s, "spread_crouch_hip", n(s, "spread_stand_hip")),
      airHip: n(s, "spread_air_hip", n(s, "spread_stand_hip")),
      standAds: n(s, "spread_stand_ads"),
      crouchAds: n(s, "spread_crouch_ads"),
      airAds: n(s, "spread_air_ads"),
      kickOnFireHip: n(s, "spread_kick_on_fire_stand_hip"),
      maxKickHip: n(s, "spread_max_kick_stand_hip"),
      kickOnFireAds: n(s, "spread_kick_on_fire_stand_ads"),
      maxKickAds: n(s, "spread_max_kick_stand_ads"),
      decayDelay: n(s, "spread_decay_delay", 0.25),
      decayRate: n(s, "spread_decay_rate", 100),
      movingDecayRate: n(s, "spread_moving_decay_rate", 30),
    },
    viewkick: {
      pattern: pat,
      spring: spr,
      springHot: typeof s.viewkick_spring_hot === "string" ? DATA.springs[s.viewkick_spring_hot] ?? null : null,
      heatPerShot: n(s, "viewkick_spring_heatpershot", 1),
      cooldownHoldTime: n(s, "viewkick_spring_cooldown_holdtime", 0.1),
      cooldownFadeTime: n(s, "viewkick_spring_cooldown_fadetime", 0.1),
      valuePerShot: n(s, "viewkick_scale_valuePerShot", 1),
      valueDecayDelay: n(s, "viewkick_scale_valueDecayDelay", 0.1),
      valueDecayRate: n(s, "viewkick_scale_valueDecayRate", 50),
      pitchBase: n(s, "viewkick_pitch_base", 1),
      pitchRandom: n(s, "viewkick_pitch_random", 0),
      pitchSoft: n(s, "viewkick_pitch_softScale", 1),
      pitchHard: n(s, "viewkick_pitch_hardScale", 0),
      yawBase: n(s, "viewkick_yaw_base", 1),
      yawRandom: n(s, "viewkick_yaw_random", 0),
      yawInnerExclude: n(s, "viewkick_yaw_random_innerexclude", 0),
      yawSoft: n(s, "viewkick_yaw_softScale", 1),
      yawHard: n(s, "viewkick_yaw_hardScale", 0),
      airScaleAds: n(s, "viewkick_air_scale_ads", 1),
      duckScale: n(s, "viewkick_duck_scale", 1),
      permPitchBase: n(s, "viewkick_perm_pitch_base"),
      permPitchRandom: n(s, "viewkick_perm_pitch_random"),
      permYawBase: n(s, "viewkick_perm_yaw_base"),
      permYawRandom: n(s, "viewkick_perm_yaw_random"),
    },
  };
}
