// Regression tests for map/list rendering helpers that operate on parking-spot
// geometry pulled from the external Downtown_Parking ArcGIS FeatureServer.
//
// app/explore.tsx, app/list.tsx and app/index.js are React Native screens (JSX +
// native modules like react-native-maps/expo-location) and can't be imported into
// a plain Node test. Where the vulnerable logic still lives inline in those
// files (getSpotKey, getPolygonCentroid — both now fixed in place with inline
// guards), the functions below are verbatim BEFORE-the-fix copies, kept only to
// document the original crash. The shared geometry-validation helpers that were
// extracted out (utils/parkingSpotGeometry.ts) are imported directly below,
// since that module has no React Native dependencies.
//
// Run with: node --experimental-strip-types --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');

async function loadGeometryHelpers() {
  return import('../utils/parkingSpotGeometry.ts');
}

// --- Original (pre-fix) copy of app/explore.tsx's getSpotKey, to document the bug ---
function getSpotKeyBeforeFix(spot, idx) {
  const id = spot.attributes.OBJECTID ?? 'id';
  const name = spot.attributes.ParkingName ?? 'name';
  const coordsString = JSON.stringify(spot.geometry.rings[0]);
  let coordHash = 0;
  for (let i = 0; i < coordsString.length; i++) {
    coordHash = ((coordHash << 5) - coordHash) + coordsString.charCodeAt(i);
    coordHash |= 0;
  }
  return `${id}-${name}-${coordHash}-${idx}`;
}

test('BUG (fixed in app/explore.tsx): getSpotKey used to throw when a spot has no geometry rings', () => {
  const spotWithMissingGeometry = {
    attributes: { OBJECTID: 99, ParkingName: 'Mystery Lot' },
    geometry: { rings: [] }, // rings[0] is undefined — realistic for a malformed/edited ArcGIS record
  };
  assert.throws(
    () => getSpotKeyBeforeFix(spotWithMissingGeometry, 0),
    /Cannot read propert/,
    'this was the original bug: it crashed instead of degrading gracefully, taking down the whole FlatList/MapView render'
  );
});

test('utils/parkingSpotGeometry: hasValidGeometry/filterValidParkingSpots reject missing or short rings', async () => {
  const { hasValidGeometry, filterValidParkingSpots } = await loadGeometryHelpers();

  const missingRings = { attributes: { OBJECTID: 1 }, geometry: { rings: [] } };
  const shortRing = { attributes: { OBJECTID: 2 }, geometry: { rings: [[[0, 0], [1, 1], [0, 0]]] } }; // 3 points
  const validRing = {
    attributes: { OBJECTID: 3 },
    geometry: { rings: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }, // 5 points, closed
  };

  assert.equal(hasValidGeometry(missingRings), false);
  assert.equal(hasValidGeometry(shortRing), false);
  assert.equal(hasValidGeometry(validRing), true);
  assert.equal(hasValidGeometry(null), false);
  assert.equal(hasValidGeometry(undefined), false);

  const filtered = filterValidParkingSpots([missingRings, shortRing, validRing]);
  assert.deepEqual(filtered, [validRing]);
});

// --- Original (pre-fix) copy of app/explore.tsx's getPolygonCentroid, to document the bug ---
function getPolygonCentroidBeforeFix(rings) {
  const allPoints = rings[0];
  return allPoints.reduce(
    (acc, point) => ({
      longitude: acc.longitude + point[0] / allPoints.length,
      latitude: acc.latitude + point[1] / allPoints.length,
    }),
    { longitude: 0, latitude: 0 }
  );
}

test('BUG (fixed in app/explore.tsx): getPolygonCentroid used to throw on empty rings', () => {
  assert.throws(() => getPolygonCentroidBeforeFix([]));
});

// --- Copy of the day/hour "is Faculty/Staff conditional lot open to commuters" rule,
// duplicated verbatim across app/explore.tsx, app/list.tsx and app/index.js.
function isAvailableNow(date) {
  const day = date.getDay();
  const hour = date.getHours();
  if (day === 0 || day === 6) return true;
  if (day >= 1 && day <= 5 && hour >= 16) return true;
  return false;
}

test('conditional Faculty/Staff lots open at exactly 4:00pm on weekdays, not before', () => {
  const mon3_59pm = new Date(2026, 6, 13, 15, 59); // Mon Jul 13 2026
  const mon4_00pm = new Date(2026, 6, 13, 16, 0);
  assert.equal(isAvailableNow(mon3_59pm), false);
  assert.equal(isAvailableNow(mon4_00pm), true);
});

test('conditional Faculty/Staff lots are open all day on weekends', () => {
  const satNoon = new Date(2026, 6, 18, 12, 0); // Sat Jul 18 2026
  const sunEarly = new Date(2026, 6, 19, 6, 0); // Sun Jul 19 2026
  assert.equal(isAvailableNow(satNoon), true);
  assert.equal(isAvailableNow(sunEarly), true);
});

// --- Copy of app/index.js's calculateDistance (Haversine, lines ~50-63) ---
function calculateDistance(coord1, coord2) {
  if (!Array.isArray(coord1) || !Array.isArray(coord2) || coord1.length < 2 || coord2.length < 2) return 9999;
  const [lon1, lat1] = coord1;
  const [lon2, lat2] = coord2;
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

test('calculateDistance returns a sentinel (9999 mi) instead of throwing/NaN on malformed coordinates', () => {
  assert.equal(calculateDistance(null, [1, 2]), 9999);
  assert.equal(calculateDistance([1], [1, 2]), 9999);
  assert.equal(calculateDistance(undefined, undefined), 9999);
});

test('calculateDistance returns ~0 for identical coordinates and a sane value for a known campus distance', () => {
  const wilsonHall = [-78.8686, 38.4496];
  assert.ok(calculateDistance(wilsonHall, wilsonHall) < 0.0001);
  // Ballard Deck to Champions Drive Deck is roughly a mile apart on campus.
  const ballard = [-78.8583, 38.4297];
  const champions = [-78.8740, 38.4347];
  const d = calculateDistance(ballard, champions);
  assert.ok(d > 0.3 && d < 2, `expected a plausible on-campus distance, got ${d} miles`);
});
