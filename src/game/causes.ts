// Who killed you when no one did: the world's own causes, as negative
// attacker ids beside the players' (0 up) and the bots' (100 up). Named in one
// place so the feed, the death recap and every page say the same thing: an
// id with no name read "PLAYER 0" on the other screens (Phase 20 A4).

/** the legacy ring, and SpeedKills' decay */
export const RING_ID = -1;
/** SpeedKills: past the city's edge for too long (edge.ts) */
export const EDGE_ID = -2;

export const causeName = (id: number): string | null => (id === RING_ID ? "THE RING" : id === EDGE_ID ? "OUT OF BOUNDS" : null);
