import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LiveParkingInfo } from '../components/LiveParkingInfo';
import { BrandColors, Colors, WarningColors } from '../constants/Colors';
import { useFilters } from '../context/FilterContext';
import jmuParkingData from '../data/jmuParkingData.json';
import { useColorScheme } from '../hooks/useColorScheme';
import { useLiveParkingData } from '../hooks/useLiveParkingData';
import { filterValidParkingSpots } from '../utils/parkingSpotGeometry';

const DOWNTOWN_API_URL = 'https://services5.arcgis.com/RnpJxEjCkCrMvNB1/arcgis/rest/services/Downtown_Parking/FeatureServer/2/query?f=json&where=1%3D1&outFields=*&returnGeometry=true&outSR=4326';
const DOWNTOWN_FETCH_TIMEOUT_MS = 10000;

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
const ParkingListItem = React.memo(function ParkingListItem({
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
}) {
  const router = useRouter();
  const theme = (useColorScheme() ?? 'light');
  const themeColors = Colors[theme];

  // Check if this is a parking deck that has live data
  const isParkingDeck = item.attributes.Type === 'Parking Deck';
  const liveData = isParkingDeck ? getParkingForDeck(item.attributes.ParkingName) : null;

  return (
    <View style={[styles.listItem, { backgroundColor: themeColors.surface }]}>
      <View style={styles.itemHeader}>
        <Text style={[styles.itemName, { color: themeColors.text }]}>{item.attributes.ParkingName}</Text>
        <Pressable
          style={[styles.mapButton, { backgroundColor: 'rgba(69,0,132,0.08)' }]}
          onPress={() => {
            router.push(`/explore?selectedLotId=${item.attributes.OBJECTID}`);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.mapButtonText, { color: themeColors.tint }]}>See on map</Text>
        </Pressable>
      </View>
      <Text style={[styles.itemType, { color: themeColors.tint }]}>{item.attributes.Type}</Text>
      <Text style={[styles.itemTiming, { color: themeColors.textSecondary }]}>{item.attributes.ChangeTimingGroup}</Text>

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
  const [downtownSpots, setDowntownSpots] = useState<ParkingSpot[]>([]);
  const [isDowntownLoading, setIsDowntownLoading] = useState<boolean>(true);
  const [downtownError, setDowntownError] = useState<string | null>(null);
  const [downtownBannerDismissed, setDowntownBannerDismissed] = useState<boolean>(false);
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

  // JMU's own lot data is bundled locally — it can never fail to load, so it's
  // computed synchronously and is always available from the very first render.
  const jmuParkingSpots = useMemo(() => (jmuParkingData as JmuParkingSpot[]).map(
    (spot: JmuParkingSpot, index: number): ParkingSpot => ({
      attributes: {
        OBJECTID: -1 - index,
        ParkingName: spot.name,
        address: spot.address,
        ChangeTimingGroup: spot.timing,
        Type: spot.type,
        isConditional: spot.isConditional,
      },
      geometry: { rings: [spot.polygon] },
    })
  ), []);

  // The downtown city lot data comes from an external ArcGIS feed and can fail
  // independently of the JMU data above. A failure here must never block the
  // rest of the screen — it only means downtown lots are temporarily missing.
  const fetchDowntownData = useCallback(async () => {
    setIsDowntownLoading(true);
    setDowntownError(null);
    setDowntownBannerDismissed(false);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DOWNTOWN_FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(DOWNTOWN_API_URL, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const cityApiData = await response.json();
      const cityParkingSpots: ParkingSpot[] = (cityApiData?.features || []).map((spot: ParkingSpot) => ({
        ...spot,
        attributes: { ...spot.attributes, Type: 'Downtown' },
      }));
      setDowntownSpots(cityParkingSpots);
    } catch (e: any) {
      setDowntownError(e?.name === 'AbortError' ? 'Request timed out' : (e?.message || 'Unknown error'));
    } finally {
      clearTimeout(timeoutId);
      setIsDowntownLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDowntownData();
  }, [fetchDowntownData]);

  // Drop any spot with malformed/missing geometry before it reaches this
  // screen — keeps "listable" consistent with what explore.tsx considers
  // "mappable" (see utils/parkingSpotGeometry.ts).
  const allParkingData = useMemo(
    () => filterValidParkingSpots([...downtownSpots, ...jmuParkingSpots]),
    [downtownSpots, jmuParkingSpots]
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: BrandColors.purple }]}>
      <StatusBar style="light" />
      <View style={styles.headerBandFull}>
        <Text style={styles.headerTitle}>Parking Directory</Text>
        <Text style={styles.headerSubtitle}>Browse all lots and decks</Text>
      </View>
      <View style={[styles.header, { backgroundColor: themeColors.background, borderBottomColor: themeColors.border }]}>
        <View style={[styles.searchContainer, { backgroundColor: themeColors.surface }]}>
          <View style={styles.searchIconWrap} pointerEvents="none">
            <Ionicons name="search" size={18} color={themeColors.icon} />
          </View>
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }]}
            placeholder="Search by lot name..."
            placeholderTextColor={themeColors.icon}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Filter Status Indicator */}
        <View style={[styles.filterStatus, { backgroundColor: 'rgba(69,0,132,0.06)' }]}>
          <Text style={[styles.filterStatusText, { color: themeColors.tint }]}>
            Showing: {getActiveFiltersText(filters)}
          </Text>
          <Text style={[styles.filterHint, { color: themeColors.textSecondary }]}>
            Adjust filters in Settings tab
          </Text>
        </View>

        {/* Downtown parking data unavailable — JMU lots still render below;
            this is informational only, not a blocking error. */}
        {downtownError && !downtownBannerDismissed && (
          <View style={styles.downtownBanner}>
            <Text style={styles.downtownBannerText}>Downtown parking data unavailable — showing JMU lots only</Text>
            <View style={styles.downtownBannerActions}>
              <Pressable
                onPress={fetchDowntownData}
                disabled={isDowntownLoading}
                style={styles.downtownBannerButton}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.downtownBannerButtonText}>{isDowntownLoading ? 'Retrying…' : 'Retry'}</Text>
              </Pressable>
              <Pressable
                onPress={() => setDowntownBannerDismissed(true)}
                style={styles.downtownBannerDismiss}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.downtownBannerDismissText}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}
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
  },
  headerBandFull: {
    backgroundColor: BrandColors.purple,
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
    padding: 15,
    borderBottomWidth: 1,
  },
  searchContainer: {
    position: 'relative',
    borderRadius: 22,
    justifyContent: 'center',
  },
  searchIconWrap: {
    position: 'absolute',
    left: 4,
    top: 0,
    bottom: 0,
    width: 34,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  searchInput: {
    height: 44,
    paddingLeft: 38,
    paddingRight: 15,
    fontSize: 16,
  },
  listContent: {
    padding: 15,
  },
  listItem: {
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
  filterStatus: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
  },
  filterStatusText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  filterHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  downtownBanner: {
    marginHorizontal: 20,
    marginTop: 10,
    backgroundColor: WarningColors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WarningColors.border,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  downtownBannerText: {
    flex: 1,
    color: WarningColors.text,
    fontSize: 13,
    marginRight: 8,
  },
  downtownBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downtownBannerButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: WarningColors.buttonBackground,
    marginRight: 6,
  },
  downtownBannerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: WarningColors.buttonText,
  },
  downtownBannerDismiss: {
    padding: 4,
  },
  downtownBannerDismissText: {
    fontSize: 14,
    color: WarningColors.text,
    fontWeight: 'bold',
  },
});