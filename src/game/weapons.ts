// Typed access to data/weapons.json and resolution into the numbers the
// simulation consumes. Everything gameplay-relevant comes from here.
import raw from "../../data/weapons.json";
import { displayName } from "../config/names";

export type Pattern = { loopOffset: number; startMax: number; bullets: number[][] };
export type Spring = Record<string, number>;
export interface WeaponDef {
  id: string;
  name: string;
  stats: Record<string, number | string>;
  mods: Record<string, Record<string, number | string>>;
  /** mod name to apply for each mag level 0..4; null means no magazine */
  magMods: Array<string | null>;
  /** explicit clip size per mag level from the current-season override table */
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
function addDerived(id: string, base: string, name: string, clips: number[]): void {
  const b = DATA.weapons[base];
  if (!b || DATA.weapons[id]) return;
  DATA.weapons[id] = {
    ...b,
    id,
    name,
    stats: { ...b.stats, ammo_clip_size: clips[0] },
    magClips: clips,
  };
}
// The public build folds this to the codename, so the brand never ships.
addDerived("g17", "semipistol", typeof __PUBLIC_BUILD__ !== "undefined" && __PUBLIC_BUILD__ ? "Striker 9" : "Glock 17", [17, 19, 21, 24, 24]);

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
  magLevel: number;
  /** the fitted optic's mod name, or null for iron sights */
  optic: string | null;
  /**
   * The weapon's own sight when it is a scope, not irons: the Kraber's base
   * zoom is a 4x-8x. Drawn and used as the optic when none is fitted.
   */
  integralOptic: string | null;
  damage: {
    near: number; far: number; veryFar: number;
    nearDist: number; farDist: number; veryFarDist: number; // metres
    headshot: number; leg: number; headshotMaxDist: number;
  };
  fireRate: number; // rounds per second
  /**
   * Pump and bolt-action delay between shots, seconds. On those weapons it is
   * much longer than 1/fireRate and is what actually governs the cadence: the
   * Kraber reads 1.2 rps (0.83 s) but rechambers in 1.6 s, and the Sentinel
   * 0.32 s against 1.85 s. Use `shotInterval` rather than 1/fireRate.
   */
  rechamberTime: number;
  /** seconds between shots, the larger of the fire-rate and rechamber limits */
  shotInterval: number;
  /** projectiles per trigger pull; 1 for everything but shotguns */
  pellets: number;
  semiAuto: boolean;
  burstCount: number;
  burstDelay: number; // forced gap between bursts, seconds
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

export function weaponIds(): string[] {
  return Object.keys(DATA.weapons);
}
export function weaponName(id: string): string {
  return displayName(id, DATA.weapons[id]?.name ?? id);
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
export function resolveWeapon(id: string, magLevel = 0, attach: string[] = []): ResolvedWeapon {
  const w = DATA.weapons[id];
  if (!w) throw new Error(`unknown weapon ${id}`);
  const s: Record<string, number | string> = { ...w.stats };
  // The magazine is applied first, then the other attachments, so a stock's
  // reload multiplier stacks on top of the mag's instead of being overwritten.
  const lvl = Math.max(0, Math.min(4, magLevel));
  const magMod = w.magMods[lvl];
  if (magMod && w.mods[magMod]) applyMod(s, w.mods[magMod]);
  // A current-season clip ladder wins over the dump's mag mod, but the mod
  // still runs first so its reload scaling survives.
  if (w.magClips && typeof w.magClips[lvl] === "number") s.ammo_clip_size = w.magClips[lvl];
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
    magLevel,
    optic: attach.find((a) => a.startsWith("optic_") && Boolean(w.mods[a])) ?? null,
    // a base zoom_fov under 20 (a 3x is 25.3, a 4x is 20) is a scope built in
    integralOptic: n(s, "zoom_fov", 55) < 20 ? (n(s, "zoom_toggle_fov", 0) > 0 ? "optic_sniper_variable" : "optic_sniper") : null,
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
    },
    fireRate: n(s, "fire_rate", 10),
    rechamberTime: n(s, "rechamber_time", 0),
    shotInterval: Math.max(1 / Math.max(1e-6, n(s, "fire_rate", 10)), n(s, "rechamber_time", 0)),
    pellets: Math.max(1, Math.round(n(s, "pellets", 1))),
    semiAuto: n(s, "is_semi_auto", 0) === 1 || s.fire_mode === "semi-auto",
    burstCount: n(s, "burst_fire_count", 0),
    burstDelay: n(s, "burst_fire_delay", 0),
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
