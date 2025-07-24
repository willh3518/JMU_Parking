import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    SafeAreaView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useFilters } from '../context/FilterContext';
import jmuBuildings from '../data/jmuBuildings.json';
import jmuParkingData from '../data/jmuParkingData.json';
import { useLiveParkingData } from '../hooks/useLiveParkingData';

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

  // Get live parking data and filters
  const { parkingData: liveParkingData, isLoading: isLiveParkingLoading } = useLiveParkingData();
  const { filters } = useFilters();

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (coord1, coord2) => {
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
  };

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

  // Get parking recommendations for a building
  const getParkingRecommendations = (building) => {
    const recommendations = [];

    // Process each parking spot
    jmuParkingData.forEach((spot: any) => {
      // Check if this parking type is allowed by current filter settings
      if (!isParkingTypeAllowed(spot.type, spot.isConditional)) {
        return; // Skip this parking spot if it's filtered out
      }

      // Calculate center of polygon for distance calculation
      const coords = spot.polygon;
      const centerLat = coords.reduce((sum: number, coord: number[]) => sum + coord[1], 0) / coords.length;
      const centerLon = coords.reduce((sum: number, coord: number[]) => sum + coord[0], 0) / coords.length;

      const distance = calculateDistance(building.coordinates, [centerLon, centerLat]);

      // Check if this parking spot has live data
      const liveData = liveParkingData?.find(live => live.name === spot.name);
      const hasLiveData = !!liveData;
      const availableSpaces = liveData?.availableSpaces;

      recommendations.push({
        name: spot.name,
        type: spot.type,
        distance: distance,
        availableSpaces: availableSpaces,
        hasLiveData: hasLiveData,
        coordinates: [centerLon, centerLat],
        timing: spot.timing
      });
    });

    // Sort recommendations: prioritize parking decks with available spaces, then by distance
    return recommendations.sort((a, b) => {
      // If both have live data, prioritize the one with more spaces
      if (a.hasLiveData && b.hasLiveData && a.availableSpaces && b.availableSpaces) {
        if (a.availableSpaces > 0 && b.availableSpaces === 0) return -1;
        if (b.availableSpaces > 0 && a.availableSpaces === 0) return 1;
        if (Math.abs(a.distance - b.distance) < 0.1) { // If distances are similar (within 0.1 miles)
          return b.availableSpaces - a.availableSpaces; // More spaces first
        }
      }

      // Prioritize parking decks with live data over those without
      if (a.hasLiveData && !b.hasLiveData && Math.abs(a.distance - b.distance) < 0.2) return -1;
      if (b.hasLiveData && !a.hasLiveData && Math.abs(a.distance - b.distance) < 0.2) return 1;

      // Finally, sort by distance
      return a.distance - b.distance;
    }).slice(0, 5); // Return top 5 recommendations
  };

  // Filter buildings based on search query
  const filteredBuildings = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase();
    return jmuBuildings.filter(building => {
      // Search by name (primary search)
      if (building.name.toLowerCase().includes(query)) return true;

      // Search by building code (if available)
      if (building.buildingCode && building.buildingCode.toLowerCase().includes(query)) return true;

      // Search by address (if available)
      if (building.address && building.address.toLowerCase().includes(query)) return true;

      return false;
    }).slice(0, 10); // Show top 10 matches
  }, [searchQuery]);

  // Get recommendations for selected building
  const recommendations = useMemo(() => {
    if (!selectedBuilding) return [];
    return getParkingRecommendations(selectedBuilding);
  }, [selectedBuilding, liveParkingData, filters]);

  const handleBuildingSelect = (building) => {
    setSelectedBuilding(building);
    setSearchQuery(building.name);
    setShowSuggestions(false);
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
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.title}>Find Parking</Text>
        <Text style={styles.subtitle}>Where are you going on campus?</Text>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search buildings (e.g., Wilson Hall, UREC, ISAT)..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            onFocus={() => setShowSuggestions(searchQuery.length > 0)}
          />
          {searchQuery.length > 0 && (
            <Pressable style={styles.clearButton} onPress={clearSearch}>
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          )}
        </View>

        {/* Filter Status Indicator */}
        {selectedBuilding && (
          <View style={styles.filterStatusContainer}>
            <Text style={styles.filterStatusText}>
              Showing: {getActiveFiltersText(filters)}
            </Text>
            <Pressable
              style={styles.settingsLink}
              onPress={() => router.push('/settings')}
            >
              <Text style={styles.settingsLinkText}>⚙️ Change Filters</Text>
            </Pressable>
          </View>
        )}

        {/* Building Suggestions */}
        {showSuggestions && filteredBuildings.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={filteredBuildings}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.suggestionItem}
                  onPress={() => handleBuildingSelect(item)}
                >
                  <View style={styles.suggestionHeader}>
                    <Text style={styles.suggestionName}>{item.name}</Text>
                    {item.buildingCode && (
                      <Text style={styles.suggestionCode}>{item.buildingCode}</Text>
                    )}
                  </View>
                  {item.address && (
                    <Text style={styles.suggestionAddress}>{item.address}</Text>
                  )}
                </Pressable>
              )}
              style={styles.suggestionsList}
              keyboardShouldPersistTaps="handled"
            />
          </View>
        )}

        {/* Loading State */}
        {selectedBuilding && isLiveParkingLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.loadingText}>Finding best parking options...</Text>
          </View>
        )}

        {/* Parking Recommendations */}
        {selectedBuilding && !isLiveParkingLoading && recommendations.length > 0 && (
          <View style={styles.recommendationsContainer}>
            <Text style={styles.recommendationsTitle}>
              Best parking for {selectedBuilding.name}:
            </Text>
            <FlatList
              data={recommendations}
              keyExtractor={(item) => item.name}
              renderItem={({ item }) => (
                <View style={styles.recommendationItem}>
                  <View style={styles.recommendationHeader}>
                    <Text style={styles.recommendationName}>{item.name}</Text>
                    <Text style={styles.recommendationDistance}>
                      {(item.distance * 5280).toFixed(0)} ft
                    </Text>
                  </View>
                  <Text style={styles.recommendationType}>{item.type}</Text>
                  {item.hasLiveData && item.availableSpaces !== undefined && (
                    <View style={styles.availabilityContainer}>
                      <View style={[
                        styles.availabilityDot,
                        { backgroundColor: item.availableSpaces > 0 ? '#4CAF50' : '#F44336' }
                      ]} />
                      <Text style={[
                        styles.availabilityText,
                        { color: item.availableSpaces > 0 ? '#4CAF50' : '#F44336' }
                      ]}>
                        {item.availableSpaces > 0
                          ? `${item.availableSpaces} spaces available`
                          : 'No spaces available'
                        }
                      </Text>
                    </View>
                  )}
                  <Text style={styles.recommendationTiming}>{item.timing}</Text>
                </View>
              )}
              style={styles.recommendationsList}
            />

            <TouchableOpacity
              style={styles.viewMapButton}
              onPress={() => router.push('/explore')}
            >
              <Text style={styles.viewMapButtonText}>View on Map</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Default State */}
        {!selectedBuilding && (
          <View style={styles.defaultContainer}>
            <Text style={styles.defaultText}>
              Search for any JMU building to find the closest parking spots with live availability
            </Text>
            <TouchableOpacity
              style={styles.exploreButton}
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
    backgroundColor: '#f4f4f8',
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  searchContainer: {
    position: 'relative',
    marginBottom: 10,
  },
  searchInput: {
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  clearButton: {
    position: 'absolute',
    right: 12,
    top: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionsContainer: {
    backgroundColor: 'white',
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
    borderBottomColor: '#f0f0f0',
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
    color: '#333',
    flex: 1,
  },
  suggestionCode: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    backgroundColor: '#f0f8ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  suggestionAddress: {
    fontSize: 12,
    color: '#666',
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
    color: '#666',
  },
  recommendationsContainer: {
    flex: 1,
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  recommendationsList: {
    flex: 1,
  },
  recommendationItem: {
    backgroundColor: 'white',
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
    color: '#333',
    flex: 1,
  },
  recommendationDistance: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  recommendationType: {
    fontSize: 14,
    color: '#666',
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
    color: '#888',
    fontStyle: 'italic',
  },
  viewMapButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  viewMapButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  defaultContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  defaultText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  exploreButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  exploreButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  filterStatusContainer: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterStatusText: {
    fontSize: 14,
    color: '#495057',
    flex: 1,
  },
  settingsLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  settingsLinkText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});