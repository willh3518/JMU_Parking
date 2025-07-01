import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { MapPressEvent, Polygon } from 'react-native-maps';
import { useFilters } from '../context/FilterContext';
import jmuParkingData from '../data/jmuParkingData.json';

// Type definitions remain the same
type ParkingSpot = {
  attributes: {
    OBJECTID: number;
    ParkingName: string;
    address: string;
    ChangeTimingGroup: string | null;
    Type?: 'Commuter' | 'Resident' | 'Parking Deck' | 'Downtown';
  };
  geometry: {
    rings: number[][][];
  };
};

type JmuParkingSpot = {
  name: string;
  address: string;
  type: 'Parking Deck' | 'Commuter' | 'Resident';
  timing: string;
  polygon: number[][];
};

function isPointInPolygon(
  point: { latitude: number; longitude: number },
  polygon: { latitude: number; longitude: number }[]
): boolean {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; i++) {
    const xi = polygon[i].latitude,
      yi = polygon[i].longitude;
    const xj = polygon[j].latitude,
      yj = polygon[j].longitude;

    const intersect =
      yi > point.longitude !== yj > point.longitude &&
      point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }
  return isInside;
}

export default function ExploreScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allParkingData, setAllParkingData] = useState<ParkingSpot[]>([]);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const { filters } = useFilters();

  useEffect(() => {
    // Data fetching logic remains the same
    const fetchAndCombineData = async () => {
      try {
        const response = await fetch('https://services5.arcgis.com/RnpJxEjCkCrMvNB1/arcgis/rest/services/Downtown_Parking/FeatureServer/2/query?f=json&where=1%3D1&outFields=*&returnGeometry=true&outSR=4326');
        const cityApiData = await response.json();
        const cityParkingSpots: ParkingSpot[] = (cityApiData?.features || []).map((spot: ParkingSpot) => ({
          ...spot,
          attributes: { ...spot.attributes, Type: 'Downtown' },
        }));

        const jmuParkingSpots = (jmuParkingData as JmuParkingSpot[]).map((spot: JmuParkingSpot, index: number): ParkingSpot => ({
          attributes: {
            OBJECTID: -1 - index,
            ParkingName: spot.name,
            address: spot.address,
            ChangeTimingGroup: spot.timing,
            Type: spot.type,
          },
          geometry: { rings: [spot.polygon] },
        }));

        setAllParkingData([...cityParkingSpots, ...jmuParkingSpots]);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAndCombineData();
  }, []);

  const filteredParkingData = useMemo(() => {
    // Filtering logic remains the same
    return allParkingData.filter(spot => {
      const type = spot.attributes.Type;
      if (type === 'Commuter' && filters.commuter) return true;
      if (type === 'Resident' && filters.resident) return true;
      if (type === 'Parking Deck' && filters.parkingDeck) return true;
      if (type === 'Downtown' && filters.downtown) return true;
      return false;
    });
  }, [filters, allParkingData]);
  
  // --- ADDED THIS HELPER FUNCTION BACK ---
  const getPolygonCentroid = (rings: number[][][]) => {
    const allPoints = rings[0];
    const centroid = allPoints.reduce(
      (acc, point) => ({
        longitude: acc.longitude + point[0] / allPoints.length,
        latitude: acc.latitude + point[1] / allPoints.length,
      }),
      { longitude: 0, latitude: 0 }
    );
    return centroid;
  };

  const handleMapPress = (e: MapPressEvent) => {
    const tappedCoordinate = e.nativeEvent.coordinate;
    let spotFound = false;
    for (const spot of filteredParkingData) {
      const polygonCoords = spot.geometry.rings[0].map(p => ({ latitude: p[1], longitude: p[0] }));
      if (isPointInPolygon(tappedCoordinate, polygonCoords)) {
        setSelectedSpot(spot);
        spotFound = true;
        break;
      }
    }
    if (!spotFound) {
      setSelectedSpot(null);
    }
  };
  
  // --- ADDED THIS FUNCTION BACK ---
  const openDirections = () => {
    if (!selectedSpot) return;

    const centroid = getPolygonCentroid(selectedSpot.geometry.rings);
    const { latitude, longitude } = centroid;
    const latLng = `${latitude},${longitude}`;

    const options = [
      { text: 'Google Maps', onPress: () => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latLng}`), style: 'default' as const },
      { text: 'Waze', onPress: () => Linking.openURL(`waze://?ll=${latLng}&navigate=yes`), style: 'default' as const },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    
    if (Platform.OS === 'ios') {
      options.unshift({
        text: 'Apple Maps',
        onPress: () => Linking.openURL(`http://maps.apple.com/?daddr=${latLng}`),
        style: 'default' as const,
      });
    }

    Alert.alert('Get Directions', 'Choose a maps app', options);
  };

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading...</Text></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>Error: {error}</Text></View>;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 38.4496,
          longitude: -78.8690,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        onPress={handleMapPress}
      >
        {filteredParkingData.map((spot: ParkingSpot) => {
          const coordinates = spot.geometry.rings[0].map(point => ({
            latitude: point[1],
            longitude: point[0],
          }));
          return (
            <Polygon
              key={spot.attributes.OBJECTID}
              coordinates={coordinates}
              strokeColor="#007AFF"
              fillColor={
                selectedSpot?.attributes.OBJECTID === spot.attributes.OBJECTID
                  ? 'rgba(255, 215, 0, 0.5)'
                  : 'rgba(0, 122, 255, 0.3)'
              }
              tappable={false}
            />
          );
        })}
      </MapView>

      {selectedSpot && (
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>{selectedSpot.attributes.ParkingName}</Text>
          <Text style={styles.infoDescription}>
            {selectedSpot.attributes.ChangeTimingGroup || 'No specific timing info available.'}
          </Text>
          {/* --- ADDED THIS BUTTON BACK --- */}
          <Pressable onPress={openDirections} style={styles.directionsButton}>
            <Text style={styles.directionsText}>Take me there</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: 'red' },
  infoBox: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  infoTitle: {
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 5,
  },
  infoDescription: {
    fontSize: 16,
    color: '#333',
    marginBottom: 15, // Added margin back
  },
  // --- ADDED THESE STYLES BACK ---
  directionsButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  directionsText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
});