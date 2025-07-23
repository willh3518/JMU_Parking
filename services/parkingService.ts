// Live parking data service for JMU parking decks
export interface LiveParkingData {
  zoneId: string;
  name: string;
  availableSpaces: number;
  totalSpaces: number;
  lastUpdated: string;
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

// Fetch live parking data from JMU API
export async function fetchLiveParkingData(): Promise<LiveParkingData[]> {
  try {
    console.log('Fetching live parking data from JMU API...');

    const response = await fetch(API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/xml, text/xml, */*',
        'User-Agent': 'JMU-Parking-App/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const xmlText = await response.text();
    console.log('Received XML response, length:', xmlText.length);

    const zonesData = parseXMLResponse(xmlText);
    console.log('Parsed zones data:', zonesData);

    // Map the zones to our parking deck format
    const parkingData: LiveParkingData[] = [];

    Object.entries(PARKING_DECK_MAPPING).forEach(([deckName, deckInfo]) => {
      const zoneData = zonesData[deckInfo.zoneId];

      if (zoneData) {
        const availableSpaces = zoneData.spaces;
        const totalSpaces = deckInfo.totalSpaces;

        // Determine status based on availability
        let status: LiveParkingData['status'] = 'unknown';
        if (availableSpaces > totalSpaces * 0.3) status = 'available';
        else if (availableSpaces > 0) status = 'limited';
        else status = 'full';

        parkingData.push({
          zoneId: deckInfo.zoneId,
          name: deckName,
          availableSpaces,
          totalSpaces,
          lastUpdated: zoneData.timestamp,
          status
        });
      } else {
        // No data available for this deck
        parkingData.push({
          zoneId: deckInfo.zoneId,
          name: deckName,
          availableSpaces: 0,
          totalSpaces: deckInfo.totalSpaces,
          lastUpdated: new Date().toISOString(),
          status: 'unknown'
        });
      }
    });

    console.log('Final parking data:', parkingData);
    return parkingData;

  } catch (error) {
    console.error('Error fetching parking data:', error);

    // Return placeholder data if API fails
    return Object.entries(PARKING_DECK_MAPPING).map(([deckName, deckInfo]) => ({
      zoneId: deckInfo.zoneId,
      name: deckName,
      availableSpaces: 0,
      totalSpaces: deckInfo.totalSpaces,
      lastUpdated: new Date().toISOString(),
      status: 'unknown' as const
    }));
  }
}
