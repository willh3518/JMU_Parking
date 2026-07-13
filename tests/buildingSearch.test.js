// Regression tests for the building search used on the Find Parking tab
// (app/index.js's filteredBuildings, ~lines 135-143), run against the real
// data/jmu_buildings.json. Replaces the four pre-existing test scripts that
// referenced a nonexistent ../data/jmuBuildings.json with a schema
// (.name/.category/.coordinates/.buildingCode/.departments) that doesn't exist
// anywhere in this codebase — the real file only ever has
// { features: [{ attributes: { BldgName }, geometry: { rings } }] }.
//
// Run with: node --experimental-strip-types --test tests/

const test = require('node:test');
const assert = require('node:assert/strict');
const buildingsData = require('../data/jmu_buildings.json');

// Verbatim copy of app/index.js's filteredBuildings logic (~lines 135-143).
function filterBuildings(buildingsArray, query) {
  const safeQuery = typeof query === 'string' ? query : '';
  if (!safeQuery.trim()) return [];
  const q = safeQuery.toLowerCase();
  return buildingsArray.filter(building => {
    const name = building.attributes?.BldgName?.toLowerCase() || '';
    return name.includes(q);
  }).slice(0, 10);
}

const buildings = buildingsData.features;

test('data/jmu_buildings.json has the expected shape', () => {
  assert.ok(Array.isArray(buildings));
  assert.ok(buildings.length > 0);
});

test('empty or whitespace-only query returns no results', () => {
  assert.deepEqual(filterBuildings(buildings, ''), []);
  assert.deepEqual(filterBuildings(buildings, '   '), []);
});

test('known buildings resolve to exactly one match by name', () => {
  for (const query of ['Wilson Hall', 'Carrier Library', 'Hartman Hall']) {
    const matches = filterBuildings(buildings, query);
    assert.equal(matches.length, 1, `expected exactly one match for "${query}"`);
    assert.equal(matches[0].attributes.BldgName, query);
  }
});

test('"UREC" matches real UREC-related buildings (not a name that no longer exists in the data)', () => {
  const matches = filterBuildings(buildings, 'UREC');
  assert.ok(matches.length > 0);
  assert.ok(matches.every(b => b.attributes.BldgName.toLowerCase().includes('urec')));
});

test('a query with more than 10 matches is capped at 10 results', () => {
  const matches = filterBuildings(buildings, 'hall');
  assert.equal(matches.length, 10);
});

test('buildings with a null or empty BldgName never crash the filter and never appear in results', () => {
  const falsyNamed = buildings.filter(b => !b.attributes?.BldgName);
  assert.ok(falsyNamed.length > 0, 'expected the real dataset to still contain some null/empty-named buildings');

  assert.doesNotThrow(() => filterBuildings(buildings, 'hall'));
  const matches = filterBuildings(buildings, 'hall');
  assert.ok(matches.every(b => !!b.attributes.BldgName));
});
