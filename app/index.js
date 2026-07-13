import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList, Keyboard, Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandColors, Colors, StatusColors } from '../constants/Colors';
import { useFilters } from '../context/FilterContext';
import jmuBuildings from '../data/jmu_buildings.json';
import jmuParkingData from '../data/jmuParkingData.json';
import { useColorScheme } from '../hooks/useColorScheme';
import { useLiveParkingData } from '../hooks/useLiveParkingData';
import { hapticSelection } from '../utils/haptics';

// Type definitions (removed for JavaScript compatibility)

// Helper function to get active filters text
const getActiveFiltersText = (filters) => {
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

export default function MainScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];

  // Get live parking data and filters
  const { parkingData: liveParkingData, isLoading: isLiveParkingLoading } = useLiveParkingData();
  const { filters } = useFilters();

  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(coord1, coord2) {
    if (!Array.isArray(coord1) || !Array.isArray(coord2) || coord1.length < 2 || coord2.length < 2) return 9999;
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Helper function to check if parking is available based on time and filters
  const isParkingTypeAllowed = (parkingType, isConditional = false) => {
    const currentTime = new Date();
    const day = currentTime.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = currentTime.getHours();

    // Check if Faculty/Staff lots are available to commuters (weekends or after 4pm weekdays)
    const isAvailableNow = (day === 0 || day === 6) || (day >= 1 && day <= 5 && hour >= 16);

    // Apply filter logic (same as map and list views)
    if (parkingType === 'Commuter' && filters.commuter) return true;
    if (parkingType === 'Resident' && filters.resident) return true;
    if (parkingType === 'Parking Deck' && filters.parkingDeck) return true;
    if (parkingType === 'Downtown' && filters.downtown) return true;
    if (parkingType === 'Faculty/Staff' && (filters.facultyStaff || (isAvailableNow && isConditional && filters.commuter))) return true;

    return false;
  };

  // Helper to get centroid from building polygon
  function getBuildingCentroid(rings) {
    if (!Array.isArray(rings) || rings.length === 0) return [0, 0];
    const coords = Array.isArray(rings[0]) ? rings[0] : [];
    if (!coords.length) return [0, 0];
    const avgLat = coords.reduce((sum, c) => sum + c[1], 0) / coords.length;
    const avgLon = coords.reduce((sum, c) => sum + c[0], 0) / coords.length;
    return [avgLon, avgLat];
  }

  // Get parking recommendations for a building using coordinates only
  function getParkingRecommendations(building) {
    const recommendations = [];
    // Get centroid from building geometry
    const buildingCentroid = getBuildingCentroid(building.geometry?.rings);
    jmuParkingData.forEach((spot) => {
      if (!isParkingTypeAllowed(spot.type, spot.isConditional)) {
        return;
      }
      // Calculate center of polygon for parking spot
      let spotCoords = [0, 0];
      if (Array.isArray(spot.polygon) && spot.polygon.length > 0) {
        const coords = spot.polygon;
        const centerLat = coords.reduce((sum, coord) => sum + coord[1], 0) / coords.length;
        const centerLon = coords.reduce((sum, coord) => sum + coord[0], 0) / coords.length;
        spotCoords = [centerLon, centerLat];
      }
      const distance = calculateDistance(buildingCentroid, spotCoords);
      const liveData = liveParkingData?.find(live => live.name === spot.name);
      const hasLiveData = !!liveData;
      const availableSpaces = liveData?.availableSpaces;
      recommendations.push({
        name: spot.name,
        type: spot.type,
        distance: distance,
        availableSpaces: availableSpaces,
        hasLiveData: hasLiveData,
        timing: spot.timing
      });
    });
    // Sort by straight-line distance (lower is better)
    return recommendations.sort((a, b) => a.distance - b.distance).slice(0, 5);
  }

  // Use buildings array from features property
  const buildingsArray = jmuBuildings.features;

  // Fix: Ensure searchQuery is always a string
  const safeSearchQuery = typeof searchQuery === 'string' ? searchQuery : '';

  // Filter buildings based on search query
  const filteredBuildings = useMemo(() => {
    if (!safeSearchQuery.trim()) return [];
    const query = safeSearchQuery.toLowerCase();
    return buildingsArray.filter(building => {
      const name = building.attributes?.BldgName?.toLowerCase() || '';
      if (name.includes(query)) return true;
      return false;
    }).slice(0, 10);
  }, [safeSearchQuery]);

  // Get recommendations for selected building
  const recommendations = useMemo(() => {
    if (!selectedBuilding) return [];
    return getParkingRecommendations(selectedBuilding);
  }, [selectedBuilding, liveParkingData, filters]);

  const handleBuildingSelect = (building) => {
    hapticSelection();
    setSelectedBuilding(building);
    setSearchQuery(building.attributes?.BldgName || '');
    setShowSuggestions(false);
    Keyboard.dismiss(); // Dismiss the keyboard when a building is selected
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    setShowSuggestions(text.length > 0);
    if (text.length === 0) {
      setSelectedBuilding(null);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSelectedBuilding(null);
    setShowSuggestions(false);
  };

  return (
    <SafeAreaView style={[styles.wrapper, { backgroundColor: BrandColors.purple }]}>
      <StatusBar style="light" />
      <View style={styles.headerBandFull}>
        <Text style={styles.headerTitle}>Find Parking</Text>
        <Text style={styles.headerSubtitle}>Where are you going on campus?</Text>
      </View>
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        {/* Search Input */}
        <View style={styles.searchContainer}>
          <View style={styles.searchIconWrap} pointerEvents="none">
            <Ionicons name="search" size={20} color={themeColors.icon} />
          </View>
          <TextInput
            style={[styles.searchInput, { backgroundColor: themeColors.surface, color: themeColors.text }]}
            placeholder="Search buildings (e.g., Wilson Hall, UREC, ISAT)..."
            placeholderTextColor={themeColors.icon}
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setShowSuggestions(searchQuery.length > 0)}
          />
          {searchQuery.length > 0 && (
            <Pressable
              style={[styles.clearButton, { backgroundColor: themeColors.icon }]}
              onPress={clearSearch}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Filter Status Indicator */}
        {selectedBuilding && (
          <View style={[styles.filterStatusContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <Text style={[styles.filterStatusText, { color: themeColors.textSecondary }]}>
              Showing: {getActiveFiltersText(filters)}
            </Text>
            <Pressable
              style={styles.settingsLink}
              onPress={() => router.push('/settings')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.settingsLinkText, { color: themeColors.tint }]}>⚙️ Change Filters</Text>
            </Pressable>
          </View>
        )}

        {/* Building Suggestions */}
        {showSuggestions && filteredBuildings.length > 0 && (
          <View style={[styles.suggestionsContainer, { backgroundColor: themeColors.background }]}>
            <FlatList
              data={filteredBuildings}
              keyExtractor={(item, index) => {
                const buildingId = item.attributes?.OBJECTID ?? item.attributes?.BldgCode ?? item.attributes?.BldgName;
                return String(buildingId ?? `building-${index}`);
              }}
              renderItem={({ item, index }) => {
                const buildingKey = String(
                  item.attributes?.OBJECTID ?? item.attributes?.BldgCode ?? item.attributes?.BldgName ?? `building-${index}`
                );
                return (
                  <Pressable
                    style={[styles.suggestionItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => handleBuildingSelect(item)}
                    key={buildingKey}
                  >
                    <View style={styles.suggestionHeader}>
                      <Text style={[styles.suggestionName, { color: themeColors.text }]}>{item.attributes?.BldgName}</Text>
                      {item.attributes?.BldgCode && (
                        <Text style={[styles.suggestionCode, { color: themeColors.tint, backgroundColor: 'rgba(69,0,132,0.08)' }]}>{item.attributes.BldgCode}</Text>
                      )}
                    </View>
                    {item.attributes?.Address && (
                      <Text style={[styles.suggestionAddress, { color: themeColors.textSecondary }]}>{item.attributes.Address}</Text>
                    )}
                  </Pressable>
                );
              }}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}

        {/* Loading State */}
        {selectedBuilding && isLiveParkingLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.tint} />
            <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Finding best parking options...</Text>
          </View>
        )}

        {/* Parking Recommendations */}
        {selectedBuilding && !isLiveParkingLoading && recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={[styles.recommendationsTitle, { color: themeColors.text }]}>
              Best parking for {selectedBuilding.attributes?.BldgName}:
            </Text>
            <FlatList
              data={recommendations}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <View style={[styles.recommendationItem, { backgroundColor: themeColors.surface }]}>
                  <View style={styles.recommendationHeader}>
                    <Text style={[styles.recommendationName, { color: themeColors.text }]}>{item.name}</Text>
                    <Text style={[styles.recommendationDistance, { color: themeColors.tint }]}>
                      {(item.distance * 5280).toFixed(0)} ft
                    </Text>
                  </View>
                  <Text style={[styles.recommendationType, { color: themeColors.textSecondary }]}>{item.type}</Text>
                  {item.hasLiveData && item.availableSpaces !== undefined && (
                    <View style={styles.availabilityContainer}>
                      <View style={[
                        styles.availabilityDot,
                        { backgroundColor: item.availableSpaces === null ? StatusColors.unknown : item.availableSpaces > 0 ? StatusColors.available : StatusColors.full }
                      ]} />
                      <Text style={[
                        styles.availabilityText,
                        { color: item.availableSpaces === null ? StatusColors.unknown : item.availableSpaces > 0 ? StatusColors.available : StatusColors.full }
                      ]}>
                        {item.availableSpaces === null
                          ? 'No live data'
                          : item.availableSpaces > 0
                            ? `${item.availableSpaces} spaces available`
                            : 'No spaces available'
                        }
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.recommendationTiming, { color: themeColors.textSecondary }]}>{item.timing}</Text>
                </View>
              )}
              style={styles.recommendationsList}
            />
            {/* Small See on Map button */}
            <TouchableOpacity
              style={[styles.seeOnMapButton, { backgroundColor: BrandColors.purple, position: 'absolute', left: 0, right: 0, bottom: 8, marginLeft: 'auto', marginRight: 'auto', alignSelf: 'center', zIndex: 10 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              onPress={() => {
                // Pass the top 5 recommended parking spot names to explore page for zoom/highlight
                if (selectedBuilding && recommendations.length > 0) {
                  router.push(
                    `/explore?highlightBuilding=${encodeURIComponent(selectedBuilding.attributes?.BldgName || '')}&highlightIds=${encodeURIComponent(JSON.stringify(recommendations.map(r => r.name)))}`
                  );
                }
              }}
            >
              <Text style={styles.seeOnMapButtonText}>See on Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Default State */}
        {!selectedBuilding && (
          <View style={styles.defaultContainer}>
            <Text style={[styles.defaultText, { color: themeColors.textSecondary }]}>
              Search for any JMU building to find the closest parking spots with live availability
            </Text>
            <TouchableOpacity
              style={[styles.exploreButton, { backgroundColor: themeColors.tint }]}
              onPress={() => router.push('/explore')}
            >
              <Text style={styles.exploreButtonText}>Explore All Parking</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerBandFull: {
    backgroundColor: BrandColors.purple,
    paddingTop: 12,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 4,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 10,
    justifyContent: 'center',
  },
  searchIconWrap: {
    position: 'absolute',
    left: 6,
    top: 0,
    bottom: 0,
    width: 38,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  searchInput: {
    borderRadius: 26,
    paddingLeft: 44,
    paddingRight: 44,
    paddingVertical: 14,
    fontSize: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 200,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  suggestionName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  suggestionCode: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  suggestionAddress: {
    fontSize: 12,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  recommendationsContainer: {
    flex: 1,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  recommendationsList: {
    flex: 1,
  },
  recommendationItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recommendationName: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  recommendationDistance: {
    fontSize: 14,
    fontWeight: '600',
  },
  recommendationType: {
    fontSize: 14,
    marginBottom: 8,
  },
  availabilityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  availabilityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  availabilityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recommendationTiming: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  defaultContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  exploreButton: {
    marginTop: 20,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  defaultText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  filterStatusContainer: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  filterStatusText: {
    fontSize: 14,
    flex: 1,
  },
  settingsLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  settingsLinkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  seeOnMapButton: {
    marginTop: 4,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  seeOnMapButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
});