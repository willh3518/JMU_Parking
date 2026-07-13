// Validation helpers guarding against malformed/missing polygon geometry —
// e.g. an ArcGIS feature edited badly upstream. GeoJSON/turf require a linear
// ring to have >=4 positions (and be closed, which we don't check here; see
// the try/catch around @turf/helpers usage in app/explore.tsx for that case).

export function hasValidRing(rings: unknown): rings is number[][][] {
  return Array.isArray(rings) && Array.isArray(rings[0]) && rings[0].length >= 4;
}

export function hasValidGeometry(
  spot: { geometry?: { rings?: unknown } } | null | undefined
): boolean {
  return !!spot && hasValidRing(spot.geometry?.rings);
}

export function filterValidParkingSpots<T extends { geometry?: { rings?: unknown } }>(
  spots: T[]
): T[] {
  return spots.filter(hasValidGeometry);
}
