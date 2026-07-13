// Live parking data service for JMU parking decks
export interface LiveParkingData {
  zoneId: string;
  name: string;
  // null means "we don't know" (API down, or this deck had no matching zone in
  // the response) — this must be rendered differently from an actual 0.
  availableSpaces: number | null;
  totalSpaces: number;
  lastUpdated: string | null;
  status: 'available' | 'limited' | 'full' | 'unknown';
}

// Map JMU parking deck names to their zone IDs in the API (from the Python script)
// Names must match exactly with the JSON file
const PARKING_DECK_MAPPING: Record<string, { zoneId: string; totalSpaces: number }> = {
  'Ballard Parking Deck': { zoneId: '22', totalSpaces: 1437 },
  'Champions Drive Parking Deck': { zoneId: '13', totalSpaces: 440 },
  'Chesapeake Avenue Parking Deck': { zoneId: '19', totalSpaces: 624 },
  'Grace Street Parking Deck': { zoneId: '4', totalSpaces: 281 },
  'Warsaw Avenue Parking Deck': { zoneId: '42', totalSpaces: 582 }
};

// The API URL with the hash from the Python script
const API_URL = "https://www.jmu.edu/cgi-bin/parking_sign_data.cgi?hash=53616c7465645f5f19336688bc3f49059660f38af48097ba97ff9d23b60477fee772d5e5efff2fc6b9363bec5c23d89314661e15a2ab5292ba5768112518a20e6dd865ed35187c4668122e7f6ea5cfda|869835tg89dhkdnbnsv5sg5wg0vmcf4mfcfc2qwm5968unmeh5";

// Parse XML response from JMU API
function parseXMLResponse(xmlText: string): Record<string, { spaces: number; timestamp: string }> {
  const zones: Record<string, { spaces: number; timestamp: string }> = {};

  try {
    // Simple XML parsing for React Native (no DOMParser available)
    const zoneMatches = xmlText.match(/<ZoneVacanSpaces>[\s\S]*?<\/ZoneVacanSpaces>/g);

    if (zoneMatches) {
      zoneMatches.forEach(zoneXml => {
        const zoneIdMatch = zoneXml.match(/<ZoneId>(.*?)<\/ZoneId>/);
        const spacesMatch = zoneXml.match(/<Result>(.*?)<\/Result>/);
        const timestampMatch = zoneXml.match(/<AsOf>(.*?)<\/AsOf>/);

        if (zoneIdMatch && spacesMatch && timestampMatch) {
          const zoneId = zoneIdMatch[1];
          const spaces = parseInt(spacesMatch[1], 10);
          const timestamp = timestampMatch[1];

          // Keep the latest timestamp for each zone
          if (!zones[zoneId] || timestamp > zones[zoneId].timestamp) {
            zones[zoneId] = { spaces, timestamp };
          }
        }
      });
    }
  } catch (error) {
    console.error('Error parsing XML:', error);
  }

  return zones;
}

const FETCH_TIMEOUT_MS = 10000;

// Fetch live parking data from the JMU API.
// Throws on failure (network error, HTTP error, timeout) — callers (see
// hooks/useLiveParkingData.ts) are expected to catch this and surface an
// "unavailable" state rather than fabricated data. Per-deck gaps (a deck with
// no matching zone in an otherwise-successful response) are NOT an error —
// they resolve to availableSpaces: null / status: 'unknown' for that deck only.
export async function fetchLiveParkingData(): Promise<LiveParkingData[]> {
  console.log('Fetching live parking data from JMU API...');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let xmlText: string;
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'User-Agent': 'JMU-Parking-App/1.0',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    xmlText = await response.text();
    console.log('Received XML response, length:', xmlText.length);
  } finally {
    clearTimeout(timeoutId);
  }

  const zonesData = parseXMLResponse(xmlText);
  console.log('Parsed zones data:', zonesData);

  const parkingData: LiveParkingData[] = Object.entries(PARKING_DECK_MAPPING).map(([deckName, deckInfo]) => {
    const zoneData = zonesData[deckInfo.zoneId];

    if (!zoneData) {
      // No data available for this deck — say so, don't invent a 0.
      return {
        zoneId: deckInfo.zoneId,
        name: deckName,
        availableSpaces: null,
        totalSpaces: deckInfo.totalSpaces,
        lastUpdated: null,
        status: 'unknown' as const,
      };
    }

    const availableSpaces = zoneData.spaces;
    const totalSpaces = deckInfo.totalSpaces;

    let status: LiveParkingData['status'] = 'unknown';
    if (availableSpaces > totalSpaces * 0.3) status = 'available';
    else if (availableSpaces > 0) status = 'limited';
    else status = 'full';

    return {
      zoneId: deckInfo.zoneId,
      name: deckName,
      availableSpaces,
      totalSpaces,
      lastUpdated: zoneData.timestamp,
      status,
    };
  });

  console.log('Final parking data:', parkingData);
  return parkingData;
}
