import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveParkingInfo } from '../components/LiveParkingInfo';
import { Colors } from '../constants/Colors';
import { useFilters } from '../context/FilterContext';
import jmuParkingData from '../data/jmuParkingData.json';
import { useColorScheme } from '../hooks/useColorScheme';
import { useLiveParkingData } from '../hooks/useLiveParkingData';

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
const ParkingListItem = React.memo(({ 
  item,
  getParkingForDeck,
  isLiveParkingLoading,
  liveParkingError,
  refreshLiveParkingData
}: {
  item: ParkingSpot;
  getParkingForDeck: (deckName: string) => any;
  isLiveParkingLoading: boolean;
  liveParkingError: string | null;
  refreshLiveParkingData: () => void;
}) => {
  const router = useRouter();
  const theme = (useColorScheme() ?? 'light');
  const themeColors = Colors[theme];

  // Check if this is a parking deck that has live data
  const isParkingDeck = item.attributes.Type === 'Parking Deck';
  const liveData = isParkingDeck ? getParkingForDeck(item.attributes.ParkingName) : null;

  return (
    <View style={styles.listItem}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.attributes.ParkingName}</Text>
        <Pressable
          style={[styles.mapButton, { backgroundColor: 'rgba(69,0,132,0.08)' }]}
          onPress={() => {
            router.push({
              pathname: '/explore',
              params: { selectedLotId: item.attributes.OBJECTID },
            });
          }}
        >
          <Text style={[styles.mapButtonText, { color: themeColors.tint }]}>See on map</Text>
        </Pressable>
      </View>
      <Text style={[styles.itemType, { color: themeColors.tint }]}>{item.attributes.Type}</Text>
      <Text style={styles.itemTiming}>{item.attributes.ChangeTimingGroup}</Text>

      {/* Show live parking data for parking decks */}
      {isParkingDeck && (
        <LiveParkingInfo
          deckName={item.attributes.ParkingName}
          liveData={liveData}
          isLoading={isLiveParkingLoading}
          error={liveParkingError}
          onRefresh={refreshLiveParkingData}
          compact={true}
        />
      )}
    </View>
  );
});

// Helper function to get active filters text
const getActiveFiltersText = (filters: any) => {
  const activeFilters = [];
  if (filters.commuter) activeFilters.push('Commuter');
  if (filters.resident) activeFilters.push('Resident');
  if (filters.parkingDeck) activeFilters.push('Parking Decks');
  if (filters.facultyStaff) activeFilters.push('Faculty/Staff');
  if (filters.downtown) activeFilters.push('Downtown');

  if (activeFilters.length === 0) return 'No parking types';
  if (activeFilters.length === 5) return 'All parking types';
  return activeFilters.join(', ');
};

export default function ListScreen() {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [allParkingData, setAllParkingData] = useState<ParkingSpot[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { filters } = useFilters();
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];

  // Add live parking data hook
  const {
    parkingData: liveParkingData,
    isLoading: isLiveParkingLoading,
    error: liveParkingError,
    refreshData: refreshLiveParkingData,
    getParkingForDeck
  } = useLiveParkingData();


  useFocusEffect(
    useCallback(() => {
      // This function is for when the screen is focused.
      return () => {
        // This function runs when the screen is unfocused.
        setSearchQuery('');
      };
    }, [])
  );

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
    // First apply type filters (same logic as map view)
    const currentTime = new Date();
    const day = currentTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = currentTime.getHours();

    // Helper function to check if Faculty/Staff lots are available to commuters
    const isAvailableNow = (day === 0 || day === 6) || (day >= 1 && day <= 5 && hour >= 16);

    let typeFilteredData = allParkingData.filter(spot => {
      const type = spot.attributes.Type;

      // Apply the same filtering logic as the map view
      if (type === 'Commuter' && filters.commuter) return true;
      if (type === 'Resident' && filters.resident) return true;
      if (type === 'Parking Deck' && filters.parkingDeck) return true;
      if (type === 'Downtown' && filters.downtown) return true;
      if (type === 'Faculty/Staff' && (filters.facultyStaff || (isAvailableNow && spot.attributes.isConditional && filters.commuter))) return true;

      return false;
    });

    // Then apply search filter
    if (!searchQuery) {
      return typeFilteredData;
    }
    return typeFilteredData.filter(spot =>
      spot.attributes.ParkingName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, allParkingData, filters]);

  // --- CHANGE 2: The renderItem function now passes live parking data ---
  const renderItem = ({ item }: { item: ParkingSpot }) => (
    <ParkingListItem
      item={item}
      getParkingForDeck={getParkingForDeck}
      isLiveParkingLoading={isLiveParkingLoading}
      liveParkingError={liveParkingError}
      refreshLiveParkingData={refreshLiveParkingData}
    />
  );

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" /><Text>Loading...</Text></View>;
  }

  if (error) {
    return <View style={styles.center}><Text style={styles.errorText}>Error: {error}</Text></View>;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#450084' }]}>
      <StatusBar style="light" />
      <View style={styles.headerBandFull}>
        <Text style={styles.headerTitle}>Parking Directory</Text>
        <Text style={styles.headerSubtitle}>Browse all lots and decks</Text>
      </View>
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

        {/* Filter Status Indicator */}
        <View style={[styles.filterStatus, { backgroundColor: 'rgba(69,0,132,0.06)' }]}>
          <Text style={[styles.filterStatusText, { color: themeColors.tint }]}>
            Showing: {getActiveFiltersText(filters)}
          </Text>
          <Text style={styles.filterHint}>
            Adjust filters in Settings tab
          </Text>
        </View>
      </View>
      <FlatList
        data={filteredData}
        renderItem={renderItem}
        keyExtractor={(item) => item.attributes.OBJECTID.toString()}
        contentContainerStyle={styles.listContent}
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
  headerBandFull: {
    backgroundColor: '#450084',
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
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
    fontWeight: '500',
    marginTop: 4,
  },
  itemTiming: {
    fontSize: 14,
    color: '#555',
    marginTop: 4,
  },
  mapButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
  },
  mapButtonText: {
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
  filterStatus: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#e8f4f8',
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
  },
  filterStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c5aa0',
    marginBottom: 2,
  },
  filterHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});