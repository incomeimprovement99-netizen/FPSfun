// The arenas: the maps a match that is not the battle royale is played on, and the Gulag's room.
//
// SpeedKills fights on its Neon maps (the owner, 2026-10-09: "2 1v1 maps, 1 centre destrict map, 1 br map, all new
// neon stuff"): NEON YARD and NEON HALL (arenas/neonarenas.ts) and THE CENTRE (arenas/centre.ts), all three drawn in the
// city's own file, and the Gulag's fight on THE GULAG, a street in the same file (br.json gulag.map, Milestone 662). The
// Vault, the last arena drawn from a plan and the Gulag's room before, went in Milestone 663; the legacy game's
// Warehouse, Triangle, Crossing, Ringworks and NEON BLOCK in Milestone 533.
import * as THREE from "three";
import type { ArenaMapInfo } from "./arenas";
import { CENTRE_MAP } from "./arenas/centre";
import { YARD_MAP, HALL_MAP, GULAG_MAP } from "./arenas/neonarenas";

/** the capture circle, arena centre */
export const ZONE_RADIUS = 3.5;

export interface ArenaHandles {
  root: THREE.Group;
  /** the capture circle: shows when the zone is live */
  zone: { ring: THREE.Mesh; column: THREE.Mesh; disc: THREE.Mesh };
}

// ------------------------------------------------------------- the maps
//
// Everything a match, a mode or a menu needs to know about a map is in the list below in world coordinates. Nothing
// here picks a map by itself: the choosing is duel.ts's arenaFor, and what a mode picks if nobody says otherwise is
// `mapFor`.

export type ArenaMapId = "centre" | "yard" | "hall" | "gulag";

/** every arena there is: the three a menu offers, and the Gulag's street */
export const ARENA_MAPS: ArenaMapInfo[] = [YARD_MAP, HALL_MAP, CENTRE_MAP, GULAG_MAP];

/** a map by id, falling back to THE CENTRE (it has spawns for eight) so a stale saved id can never leave a match without an arena */
export function arenaMap(id: string | null | undefined): ArenaMapInfo {
  return ARENA_MAPS.find((m) => m.id === id) ?? CENTRE_MAP;
}

/** the map a mode is played on when nobody has chosen one */
export function mapFor(mode: string, players: number): ArenaMapId {
  // a 1v1 in NEON YARD (NEON HALL the picker's other), and everything with more than two players, the free-for-all,
  // teams, Control and a 1v1v1, on THE CENTRE, the city's middle, which has spawns for eight
  if (mode === "duel" && players === 2) return "yard";
  return "centre";
}

/**
 * A city map's capture circle, the same one every arena has (a ring on the floor, a faint disc, a column of light while
 * the match's circle is live), on the city's side of the world: THE CENTRE and the two Neon arenas are drawn in the
 * city's file, which has none.
 */
export function buildCityMarks(parent: THREE.Object3D, m: ArenaMapInfo): ArenaHandles {
  const root = new THREE.Group();
  root.name = `arena:${m.id}`;
  parent.add(root);
  const { x, z } = m.center;
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0xffd23c, emissiveIntensity: 1.2, roughness: 0.4 });
  const ring = new THREE.Mesh(new THREE.RingGeometry(ZONE_RADIUS - 0.18, ZONE_RADIUS, 48), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.02, z);
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(ZONE_RADIUS - 0.18, 48),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.08, depthWrite: false })
  );
  disc.rotation.x = -Math.PI / 2;
  disc.position.set(x, 0.015, z);
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(ZONE_RADIUS, ZONE_RADIUS, 6, 48, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true })
  );
  column.position.set(x, 3, z);
  column.visible = false;
  root.add(ring, disc, column);
  for (const m of [ring, disc, column]) m.userData.dynamic = true;
  // (shown only while a match is played on it: the city is the battle royale's the rest of the time)
  root.visible = false;
  const handles: ArenaHandles = { root, zone: { ring, column, disc } };
  ARENA_HANDLES.set(m.id, handles);
  return handles;
}

/** the built arenas by id, so whoever shows a capture circle can find the right one */
export const ARENA_HANDLES = new Map<string, ArenaHandles>();

