#!/usr/bin/env python3
import sys
import requests
import xml.etree.ElementTree as ET
from datetime import datetime
from collections import defaultdict

# Direct API endpoint with the provided hash
# Note: This hash may expire and need to be updated periodically
API_URL = "https://www.jmu.edu/cgi-bin/parking_sign_data.cgi?hash=53616c7465645f5f19336688bc3f49059660f38af48097ba97ff9d23b60477fee772d5e5efff2fc6b9363bec5c23d89314661e15a2ab5292ba5768112518a20e6dd865ed35187c4668122e7f6ea5cfda|869835tg89dhkdnbnsv5sg5wg0vmcf4mfcfc2qwm5968unmeh5"

# Mapping of zone IDs to parking deck names (based on live data matching)
ZONE_NAMES = {
    "22": "Ballard Deck",     # 1437 spaces
    "13": "Champions Deck",   # 440 spaces
    "19": "Chesapeake Deck",  # 624 spaces
    "4": "Grace Deck",        # 281 spaces
    "42": "Warsaw Deck",      # 582 spaces
    # Other notable zones
    "6": "Zone 6 (Full)",
    "12": "Zone 12 (Large Lot)"
}

def fetch_parking_data() -> dict[str, dict]:
    """
    Fetch live parking data from JMU API.
    Returns a dict mapping zone IDs to their latest data.
    """
    try:
        r = requests.get(API_URL, timeout=(5, 20))
        r.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to fetch parking data: {e}") from e

    try:
        root = ET.fromstring(r.text)
    except ET.ParseError as e:
        raise RuntimeError(f"Failed to parse XML response: {e}") from e

    # Use defaultdict to store the latest data for each zone
    zones_data = defaultdict(dict)

    for node in root.findall('ZoneVacanSpaces'):
        zone_id = node.findtext('ZoneId')
        spaces = node.findtext('Result')  # 'Result' field contains available spaces
        timestamp = node.findtext('AsOf')

        if zone_id and spaces and timestamp:
            # Keep the latest timestamp for each zone
            if 'timestamp' not in zones_data[zone_id] or timestamp > zones_data[zone_id]['timestamp']:
                zones_data[zone_id] = {
                    'spaces': int(spaces),
                    'timestamp': timestamp,
                    'name': ZONE_NAMES.get(zone_id, f"Zone {zone_id}")
                }

    return dict(zones_data)

def format_timestamp(timestamp_str: str) -> str:
    """Convert ISO timestamp to readable format."""
    try:
        dt = datetime.fromisoformat(timestamp_str.replace('T', ' '))
        return dt.strftime('%Y-%m-%d %I:%M:%S %p')
    except:
        return timestamp_str

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Get JMU live parking availability')
    parser.add_argument('--decks-only', action='store_true',
                       help='Show only main parking decks (not individual zones)')
    args = parser.parse_args()

    try:
        data = fetch_parking_data()
    except RuntimeError as err:
        print(f"Error: {err}", file=sys.stderr)
        sys.exit(1)

    if not data:
        print("No parking data available", file=sys.stderr)
        sys.exit(1)

    print("JMU Live Parking Availability")
    print("=" * 50)

    # Main parking decks (from the screenshot)
    main_decks = {"22", "13", "19", "4", "42"}  # Ballard, Champions, Chesapeake, Grace, Warsaw

    # Filter data if --decks-only is specified
    if args.decks_only:
        data = {k: v for k, v in data.items() if k in main_decks}

    # Sort by zone ID numerically
    for zone_id in sorted(data.keys(), key=lambda x: int(x)):
        zone_info = data[zone_id]
        name = zone_info['name']
        spaces = zone_info['spaces']
        timestamp = format_timestamp(zone_info['timestamp'])

        print(f"{name:<25} {spaces:>4} spaces available")
        print(f"{'':25} Last updated: {timestamp}")
        print()

if __name__ == "__main__":
    main()