// Regression tests for services/parkingService.ts — the JMU live parking API client.
// Run with: node --experimental-strip-types --test tests/
//
// These tests exercise "what happens if the parking API is down" scenarios by
// stubbing global.fetch, since the real endpoint requires a live network call.
//
// Contract under test: fetchLiveParkingData() THROWS on a genuine failure
// (network error, non-OK HTTP response, timeout) — callers (see
// hooks/useLiveParkingData.ts) are expected to catch that and surface an
// "unavailable" state, rather than the service fabricating fake placeholder
// numbers. A deck with no matching zone in an otherwise-successful response is
// NOT an error — it resolves with availableSpaces: null / lastUpdated: null /
// status: 'unknown' for that deck only.

const test = require('node:test');
const assert = require('node:assert/strict');

const DECK_NAMES = [
  'Ballard Parking Deck',
  'Champions Drive Parking Deck',
  'Chesapeake Avenue Parking Deck',
  'Grace Street Parking Deck',
  'Warsaw Avenue Parking Deck',
];

async function loadFetchLiveParkingData() {
  const mod = await import('../services/parkingService.ts');
  return mod.fetchLiveParkingData;
}

function withFetch(impl, run) {
  const original = global.fetch;
  global.fetch = impl;
  return run().finally(() => {
    global.fetch = original;
  });
}

test('fetchLiveParkingData throws when the network request rejects (API unreachable)', async () => {
  const fetchLiveParkingData = await loadFetchLiveParkingData();
  await withFetch(
    async () => { throw new TypeError('Network request failed'); },
    async () => {
      await assert.rejects(() => fetchLiveParkingData(), /Network request failed/);
    }
  );
});

test('fetchLiveParkingData throws on a non-OK HTTP response (e.g. 500/503)', async () => {
  const fetchLiveParkingData = await loadFetchLiveParkingData();
  await withFetch(
    async () => ({ ok: false, status: 503, text: async () => '' }),
    async () => {
      await assert.rejects(() => fetchLiveParkingData(), /503/);
    }
  );
});

test('fetchLiveParkingData throws when the request is aborted/times out', async () => {
  const fetchLiveParkingData = await loadFetchLiveParkingData();
  await withFetch(
    async () => { throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }); },
    async () => {
      await assert.rejects(() => fetchLiveParkingData(), /aborted/);
    }
  );
});

test('fetchLiveParkingData does not throw on malformed/empty XML — degrades to "unknown"/null per deck', async () => {
  const fetchLiveParkingData = await loadFetchLiveParkingData();
  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => '<html>not the expected xml</html>' }),
    async () => {
      const data = await fetchLiveParkingData();
      assert.equal(data.length, DECK_NAMES.length);
      assert.ok(data.every(d => d.status === 'unknown'));
      assert.ok(data.every(d => d.availableSpaces === null));
      assert.ok(data.every(d => d.lastUpdated === null));
    }
  );
});

test('fetchLiveParkingData correctly parses a well-formed XML response', async () => {
  const fetchLiveParkingData = await loadFetchLiveParkingData();
  const xml = `
    <Zones>
      <ZoneVacanSpaces><ZoneId>22</ZoneId><Result>500</Result><AsOf>2026-07-13 10:00:00</AsOf></ZoneVacanSpaces>
      <ZoneVacanSpaces><ZoneId>13</ZoneId><Result>0</Result><AsOf>2026-07-13 10:00:00</AsOf></ZoneVacanSpaces>
    </Zones>`;
  await withFetch(
    async () => ({ ok: true, status: 200, text: async () => xml }),
    async () => {
      const data = await fetchLiveParkingData();
      const ballard = data.find(d => d.name === 'Ballard Parking Deck');
      const champions = data.find(d => d.name === 'Champions Drive Parking Deck');
      assert.equal(ballard.availableSpaces, 500);
      assert.equal(ballard.status, 'available');
      assert.equal(champions.availableSpaces, 0);
      assert.equal(champions.status, 'full');
      // A deck with no matching zone in the response degrades to null/'unknown', not a crash and not a fake 0.
      const chesapeake = data.find(d => d.name === 'Chesapeake Avenue Parking Deck');
      assert.equal(chesapeake.status, 'unknown');
      assert.equal(chesapeake.availableSpaces, null);
      assert.equal(chesapeake.lastUpdated, null);
    }
  );
});
