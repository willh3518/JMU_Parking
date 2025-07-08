import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import jmuParkingData from '../data/jmuParkingData.json';

// Type Definitions
type ParkingSpot = {
  attributes: {
    OBJECTID: number;
    ParkingName: string;
    address: string;
    ChangeTimingGroup: string | null;
    Type?: 'Commuter' | 'Resident' | 'Parking Deck' | 'Downtown' | 'Faculty/Staff';
    isConditional?: boolean;
  };
  geometry: {
    rings: number[][][];
  };
};

type JmuParkingSpot = {
  name: string;
  address: string;
  type: 'Parking Deck' | 'Commuter' | 'Resident' | 'Faculty/Staff';
  timing: string;
  polygon: number[][];
  isConditional?: boolean;
};

// --- CHANGE 1: Create a new, optimized component for a single list item ---
const ParkingListItem = React.memo(({ item }: { item: ParkingSpot }) => {
  const router = useRouter();

  return (
    <View style={styles.listItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.attributes.ParkingName}</Text>
        <Pressable
          style={styles.mapButton}
          onPress={() => {
            router.push({
              pathname: '/explore',
              params: { selectedLotId: item.attributes.OBJECTID },
            });
          }}
        >
          <Text style={styles.mapButtonText}>See on map</Text>
        </Pressable>
      </View>
      <Text style={styles.itemType}>{item.attributes.Type}</Text>
      <Text style={styles.itemTiming}>{item.attributes.ChangeTimingGroup}</Text>
    </View>
  );
});

export default function ListScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allParkingData, setAllParkingData] = useState<ParkingSpot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

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
            isConditional: spot.isConditional,
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

  const filteredData = useMemo(() => {
    if (!searchQuery) {
      return allParkingData;
    }
    return allParkingData.filter(spot =>
      spot.attributes.ParkingName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allParkingData]);

  // --- CHANGE 2: The renderItem function is now simpler ---
  const renderItem = ({ item }: { item: ParkingSpot }) => <ParkingListItem item={item} />;

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading...</Text></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>Error: {error}</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Parking Directory</Text>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by lot name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item.attributes.OBJECTID.toString()}
        contentContainerStyle={styles.listContent}
        // --- CHANGE 3: Add this prop for better performance ---
        windowSize={10}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: 'white',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  searchContainer: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  searchInput: {
    height: 40,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  listContent: {
    padding: 15,
  },
  listItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  itemName: {
    fontSize: 18,
    fontWeight: '600',
    flexShrink: 1, // This tells the text to shrink and wrap if needed
    marginRight: 8, // Adds a little space next to the button
  },
  itemType: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
    marginTop: 4,
  },
  itemTiming: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  mapButton: {
    backgroundColor: '#eef',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  mapButtonText: {
    color: '#007AFF',
    fontWeight: '600',
    fontSize: 12,
  },
  center: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  errorText: { 
    color: 'red' 
  },
});