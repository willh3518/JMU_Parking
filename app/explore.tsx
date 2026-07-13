import { BrandColors, Colors, StatusColors, WarningColors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import area from '@turf/area';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon as turfPolygon } from '@turf/helpers';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  AppStateStatus,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View
} from 'react-native';
import MapView, { MapPressEvent, Polygon } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveParkingInfo } from '../components/LiveParkingInfo';
import { useFilters } from '../context/FilterContext';
import jmuParkingData from '../data/jmuParkingData.json';
import jmuBuildingsData from '../data/jmu_buildings.json';
import { useLiveParkingData } from '../hooks/useLiveParkingData';
import { hapticImpact, hapticSelection } from '../utils/haptics';
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

type Suggestion = {
    place_id: number;
    display_name: string;
    lat: string;
    lon: string;
}


const isCommuterParkingAvailable = (): boolean => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  if (day === 0 || day === 6) return true;
  if (day >= 1 && day <= 5 && hour >= 16) return true;
  return false;
};

export default function ExploreScreen() {
  const [highlightedBuildingPolygon, setHighlightedBuildingPolygon] = useState<number[][] | null>(null);
  const [highlightedParkingSpots, setHighlightedParkingSpots] = useState<ParkingSpot[]>([]);
  const [highlightBuildingId, setHighlightBuildingId] = useState<number | null>(null);
  const [showBuildingPin, setShowBuildingPin] = useState(false);
  const [buildingPinCoords, setBuildingPinCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [downtownSpots, setDowntownSpots] = useState<ParkingSpot[]>([]);
  const [isDowntownLoading, setIsDowntownLoading] = useState<boolean>(true);
  const [downtownError, setDowntownError] = useState<string | null>(null);
  const [downtownBannerDismissed, setDowntownBannerDismissed] = useState<boolean>(false);
  const [selectedSpot, setSelectedSpot] = useState<ParkingSpot | null>(null);
  const { filters } = useFilters();
  const params = useLocalSearchParams();
  let highlightIds: string[] | null = null;
  let highlightBuilding: string | null = null;
  if (params.highlightIds) {
    if (Array.isArray(params.highlightIds)) {
      highlightIds = params.highlightIds;
    } else if (typeof params.highlightIds === 'string') {
      try {
        highlightIds = JSON.parse(params.highlightIds);
      } catch {
        highlightIds = [params.highlightIds];
      }
    }
  }
  if (params.highlightBuilding) {
    highlightBuilding = params.highlightBuilding as string;
  }

  // Add live parking data hook
  const {
    parkingData: liveParkingData,
    isLoading: isLiveParkingLoading,
    error: liveParkingError,
    refreshData: refreshLiveParkingData,
    getParkingForDeck
  } = useLiveParkingData();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const router = useRouter();
  const initialMapRegion = {
    latitude: 38.4496,
    longitude: -78.8690,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  }
  const [currentRegion, setCurrentRegion] = useState(initialMapRegion);

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

  // Combine both sources and drop any spot with malformed/missing geometry
  // before it can reach map rendering or tap-handling code (see
  // utils/parkingSpotGeometry.ts). Also de-dupe the 'shed' lot, which can
  // appear more than once across the two data sources.
  const allParkingData = useMemo(() => {
    const combinedSpots = [...downtownSpots, ...jmuParkingSpots];
    const validSpots = filterValidParkingSpots(combinedSpots);
    const seenSheds = new Set();
    return validSpots.filter(spot => {
      if ((spot.attributes.ParkingName || '').toLowerCase() === 'shed') {
        if (seenSheds.has('shed')) return false;
        seenSheds.add('shed');
      }
      return true;
    });
  }, [downtownSpots, jmuParkingSpots]);

  // Center map to show all parking spots on initial load
  useEffect(() => {
    if (mapRef.current && allParkingData.length > 0) {
      // Gather all coordinates from all parking polygons
      const allCoords = allParkingData.flatMap(spot =>
        Array.isArray(spot.geometry.rings[0])
          ? spot.geometry.rings[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
          : []
      );
      if (allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: true,
        });
      }
    }
  }, [allParkingData]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // --- FIX: Separated the nested useEffect hooks ---

  // This useEffect listens for when the user returns to the app
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const { status } = await Location.getForegroundPermissionsAsync();
        setPermissionStatus(status);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const { selectedLotId } = params;

    if (selectedLotId && allParkingData.length > 0) {
      const targetId = Number(selectedLotId);
      const spotToFocus = allParkingData.find(spot => spot.attributes.OBJECTID === targetId);

      if (spotToFocus) {
        const centroid = getPolygonCentroid(spotToFocus.geometry.rings);

        mapRef.current?.animateToRegion({
          ...centroid,
          latitudeDelta: 0.003,
          longitudeDelta: 0.003,
        }, 1000);

        setSelectedSpot(spotToFocus);

        router.setParams({ selectedLotId: undefined as any });
      }
    }
  }, [params, allParkingData]);

  // This useEffect handles the initial permission request
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
    })();
  }, []);

  const filteredParkingData = useMemo(() => {
    const isAvailableNow = isCommuterParkingAvailable();
    return allParkingData.filter(spot => {
      // --- THIS IS THE FIX ---
      // Rule 1: Always show the spot that is currently selected.
      if (spot.attributes.OBJECTID === selectedSpot?.attributes.OBJECTID) {
        return true;
      }

      // Rule 2: Otherwise, follow the normal filter rules from the Settings page.
      const type = spot.attributes.Type;
      if (type === 'Commuter' && filters.commuter) return true;
      if (type === 'Resident' && filters.resident) return true;
      if (type === 'Parking Deck' && filters.parkingDeck) return true;
      if (type === 'Downtown' && filters.downtown) return true;
      if (type === 'Faculty/Staff' && (filters.facultyStaff || (isAvailableNow && spot.attributes.isConditional && filters.commuter))) return true;

      return false;
    });
  }, [filters, allParkingData, currentTime, selectedSpot]); // Add selectedSpot to dependencies

  // Filter parking spots to highlight only recommended ones if highlightIds is present
  const displayedParkingSpots = useMemo(() => {
    if (highlightIds && Array.isArray(highlightIds)) {
      // Only show and highlight the 5 recommended spots from filteredParkingData
      return filteredParkingData.filter(spot => highlightIds.includes(spot.attributes.ParkingName));
    }
    // Otherwise, show only filtered parking spots
    return filteredParkingData;
  }, [filteredParkingData, highlightIds]);

  const getPolygonCentroid = (rings: number[][][]) => {
    const allPoints = Array.isArray(rings?.[0]) ? rings[0] : [];
    if (allPoints.length === 0) {
      // Malformed/missing geometry — fall back to the map's default center
      // instead of throwing on an empty reduce.
      return { longitude: initialMapRegion.longitude, latitude: initialMapRegion.latitude };
    }
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
    const tappedPoint = point([tappedCoordinate.longitude, tappedCoordinate.latitude]);

    // 1. Find all polygons that contain the tapped point using Turf.js.
    // A ring can pass the length check in filterValidParkingSpots but still be
    // unclosed (first point !== last), which turf's polygon() rejects — catch
    // that here so one bad ring can't crash the whole tap handler.
    const tappedPolygons = filteredParkingData.filter(spot => {
      try {
        const spotPolygon = turfPolygon(spot.geometry.rings);
        return booleanPointInPolygon(tappedPoint, spotPolygon);
      } catch {
        return false;
      }
    });

    // If no polygons were tapped, clear the selection
    if (tappedPolygons.length === 0) {
      setSelectedSpot(null);
      return;
    }

    // 2. If there's only one match, select it. Otherwise, find the smallest one.
    let smallestSpot = tappedPolygons[0];
    if (tappedPolygons.length > 1) {
      smallestSpot = tappedPolygons.reduce((a, b) => {
        try {
          const areaA = area(turfPolygon(a.geometry.rings));
          const areaB = area(turfPolygon(b.geometry.rings));
          return areaA < areaB ? a : b;
        } catch {
          return a;
        }
      });
    }

    // 3. Toggle selection
    hapticSelection();
    if (selectedSpot?.attributes.OBJECTID === smallestSpot.attributes.OBJECTID) {
      setSelectedSpot(null); // If it's already selected, deselect it
    } else {
      setSelectedSpot(smallestSpot); // Otherwise, select the new spot
    }
  };

  const openDirections = () => {
    if (!selectedSpot) return;
    hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
    console.log('Selected spot:', selectedSpot);
    const centroid = getPolygonCentroid(selectedSpot.geometry.rings);
    console.log('Centroid:', centroid);
    // Ensure correct coordinate order for Marker: latitude, longitude
    const { latitude, longitude } = centroid;

    // Find the JMU building polygon by name (or other identifier) from jmu_buildings.json
    let buildingPolygon: number[][] | null = null;
    if (selectedSpot) {
      // jmuBuildingsData.features is an array of { attributes: { BldgName }, geometry: { rings } }
      const buildingFeature = (jmuBuildingsData.features || []).find(
        (feature: any) => feature.attributes.BldgName === selectedSpot.attributes.ParkingName
      );
      if (buildingFeature && buildingFeature.geometry && Array.isArray(buildingFeature.geometry.rings[0])) {
        buildingPolygon = buildingFeature.geometry.rings[0];
      }
    }
    setHighlightedBuildingPolygon(buildingPolygon ?? null);
    // Animate map to building location for visibility
    if (typeof latitude === 'number' && typeof longitude === 'number' && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0008,
        longitudeDelta: 0.0008,
      }, 500);
    }
    setTimeout(() => setHighlightedBuildingPolygon(null), 6000); // Highlight disappears after 6 seconds
    const latLng = `${latitude},${longitude}`;
    // Note: on Android, opening a custom-scheme app (Waze) that isn't in the
    // manifest's <queries> package-visibility list can also fail silently even
    // with the .catch() below — this app.json has no config plugin for that
    // yet, so the .catch() Alert is the only feedback Android users get today.
    const options = [
      {
        text: 'Google Maps',
        onPress: () => {
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latLng}`)
            .catch(() => Alert.alert('Unable to Open Google Maps', 'Google Maps could not be opened on this device.'));
        },
        style: 'default' as const,
      },
      {
        text: 'Waze',
        onPress: () => {
          Linking.openURL(`waze://?ll=${latLng}&navigate=yes`)
            .catch(() => Alert.alert('Waze Not Available', 'Waze does not appear to be installed on this device.'));
        },
        style: 'default' as const,
      },
      { text: 'Cancel', style: 'cancel' as const },
    ];
    if (Platform.OS === 'ios') {
      options.unshift({
        text: 'Apple Maps',
        onPress: () => {
          Linking.openURL(`http://maps.apple.com/?daddr=${latLng}`)
            .catch(() => Alert.alert('Unable to Open Apple Maps', 'Apple Maps could not be opened on this device.'));
        },
        style: 'default' as const,
      });
    }
    Alert.alert('Get Directions', 'Choose a maps app', options);
  };

  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];

  const getParkingColors = (spot: ParkingSpot) => {
    let type = spot.attributes.Type;
    const isAvailableNow = isCommuterParkingAvailable();
    if (spot.attributes.isConditional && isAvailableNow) {
      type = 'Commuter';
    }
    let fillColor = 'rgba(128, 128, 128, 0.4)';
    let strokeColor = '#808080';
    if (type === 'Commuter') {
      fillColor = 'rgba(69, 0, 132, 0.12)';
      strokeColor = themeColors.tint;
    } else if (type === 'Resident') {
      fillColor = 'rgba(69, 0, 132, 0.10)';
      strokeColor = themeColors.tint;
    } else if (type === 'Parking Deck') {
      fillColor = 'rgba(69, 0, 132, 0.18)';
      strokeColor = themeColors.tint;
    } else if (type === 'Faculty/Staff') {
      fillColor = 'rgba(69, 0, 132, 0.08)';
      strokeColor = themeColors.tint;
    } else if (type === 'Downtown') {
      fillColor = 'rgba(0,0,0,0)'; // transparent fill
      strokeColor = '#3CB371';
    }
    if (selectedSpot?.attributes.OBJECTID === spot.attributes.OBJECTID) {
      fillColor = theme === 'light' ? 'rgba(203, 182, 119, 0.32)' : 'rgba(203, 182, 119, 0.26)';
      strokeColor = Colors[theme].accent;
    }
    return { fillColor, strokeColor };
  };

  const formatDescription = (spot: ParkingSpot) => {
    const timing = spot.attributes.ChangeTimingGroup;
    if (!timing) return <Text style={[styles.infoDescription, { color: themeColors.text }]}>No specific timing info available.</Text>;
    const keyword = "Faculty and Staff Lot";
    if (timing.includes(keyword)) {
        const parts = timing.split(keyword);
      return (
        <View>
            <Text style={[styles.infoDescription, { fontWeight: 'bold', color: themeColors.tint, marginBottom: 2 }]}>{keyword}</Text>
            <Text style={[styles.infoDescription, { color: themeColors.text }]}>{parts[1] || ''}</Text>
        </View>
      );
    }
    return <Text style={[styles.infoDescription, { color: themeColors.text }]}>{timing}</Text>;
  };

  useEffect(() => {
    // Highlight building if highlightBuilding param is present
    if (highlightBuilding && highlightIds && mapRef.current) {
      // Highlight the building polygon
      const buildingFeature = (jmuBuildingsData.features || []).find(
        (feature: any) => feature.attributes.BldgName === highlightBuilding
      );
      if (buildingFeature && buildingFeature.geometry && Array.isArray(buildingFeature.geometry.rings[0])) {
        setHighlightedBuildingPolygon(buildingFeature.geometry.rings[0]);
      }
      // displayedParkingSpots is already filtered down to just the top 5
      // recommended spots while highlightIds is set — snapshot them now so
      // the green highlight survives the highlightIds param being cleared
      // below (which would otherwise widen displayedParkingSpots back out).
      setHighlightedParkingSpots(displayedParkingSpots);
      // Only fit map to top 5 recommended parking spots
      let parkingCoords: { latitude: number; longitude: number }[] = [];
      displayedParkingSpots.forEach(spot => {
        if (Array.isArray(spot.geometry.rings[0])) {
          parkingCoords = parkingCoords.concat(spot.geometry.rings[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng })));
        }
      });
      if (parkingCoords.length > 0) {
        mapRef.current.fitToCoordinates(parkingCoords, {
          edgePadding: { top: 0, right: 0, bottom: 0, left: 0 },
          animated: true,
        });
      }
      setTimeout(() => {
        setHighlightedBuildingPolygon(null);
        setHighlightedParkingSpots([]);
      }, 6000);
      // Only clear highlightBuilding and highlightIds after highlighting
      router.setParams({ highlightBuilding: undefined as any, highlightIds: undefined as any });
    }
    // Existing highlightIds logic for parking spots
    if (highlightIds && Array.isArray(highlightIds) && mapRef.current && displayedParkingSpots.length > 0) {
      const allCoords = displayedParkingSpots.flatMap(spot =>
        Array.isArray(spot.geometry.rings[0])
          ? spot.geometry.rings[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
          : []
      );
      if (allCoords.length > 0) {
        mapRef.current.fitToCoordinates(allCoords, {
          edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
          animated: true,
        });
        router.setParams({ highlightIds: undefined as any });
      }
    }
  }, [highlightIds, highlightBuilding, displayedParkingSpots]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: BrandColors.purple }]}>
      <StatusBar style="light" />
      <View style={styles.headerBandFull}>
        <Text style={styles.headerTitle}>Explore Parking</Text>
        <Text style={styles.headerSubtitle}>Tap a lot to view details</Text>
      </View>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={initialMapRegion}
        showsUserLocation={true}
        onPress={handleMapPress}
        onRegionChangeComplete={setCurrentRegion}
      >
        {/* Highlight JMU building polygon for 6 seconds in red */}
        {highlightedBuildingPolygon && (
          <Polygon
            coordinates={highlightedBuildingPolygon.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))}
            strokeColor="#FF0000"
            fillColor="rgba(255,0,0,0.45)"
            strokeWidth={3}
            tappable={false}
          />
        )}
        {displayedParkingSpots.map((spot, idx) => {
          const key = getSpotKey(spot, idx);
          const fillColor = getParkingColors(spot).fillColor;
          const strokeColor = getParkingColors(spot).strokeColor;
          return (
            <Polygon
              key={key}
              coordinates={Array.isArray(spot.geometry.rings[0]) ? spot.geometry.rings[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng })) : []}
              strokeColor={strokeColor}
              fillColor={fillColor}
              strokeWidth={2}
              tappable={false}
            />
          );
        })}
        {/* Recommended-spot highlight for 6 seconds after "See on Map" —
            mirrors the red building highlight above, but green for "park here". */}
        {highlightedParkingSpots.map((spot, idx) => (
          <Polygon
            key={`highlight-${getSpotKey(spot, idx)}`}
            coordinates={Array.isArray(spot.geometry.rings[0]) ? spot.geometry.rings[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng })) : []}
            strokeColor={StatusColors.available}
            fillColor="rgba(76, 175, 80, 0.45)"
            strokeWidth={3}
            tappable={false}
          />
        ))}
      </MapView>

      <Pressable
  style={[styles.homeButton, { top: insets.top + 60, backgroundColor: themeColors.background }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        onPress={() => {
          // Get all coordinates from displayed parking spots
          const allCoords = displayedParkingSpots.flatMap(spot =>
            Array.isArray(spot.geometry.rings[0])
              ? spot.geometry.rings[0].map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
              : []
          );
          if (allCoords.length > 0) {
            mapRef.current?.fitToCoordinates(allCoords, {
              edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
              animated: true,
            });
          } else {
            mapRef.current?.animateToRegion(initialMapRegion, 1000);
          }
        }}
      >
        <Text style={styles.homeButtonText}>🏠</Text>
      </Pressable>

      {/* Downtown parking data unavailable — JMU lots still render above; this is
          informational only, not a blocking error. */}
      {downtownError && !downtownBannerDismissed && (
        <View style={[styles.downtownBanner, { top: insets.top + 10 }]}>
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

      {/* The Permission Denied Banner */}
      {permissionStatus === 'denied' && (
        <View style={[styles.permissionOverlay, { paddingTop: insets.top + 10, paddingBottom: 10 }]}>          
          <Text style={styles.permissionText}>Location permission is needed to show your position.</Text>
          <Pressable
            style={[styles.permissionButton, { backgroundColor: themeColors.tint }]}
            onPress={() => Linking.openSettings()}
          >
            <Text style={styles.permissionButtonText}>Enable Location in Settings</Text>
          </Pressable>
        </View>
      )}

      {/* The Selected Spot Info Box */}
      {selectedSpot && (
        <View style={[styles.infoBox, { backgroundColor: themeColors.background }]}>
           <View style={styles.infoBoxHeader}>
             <Text style={[styles.infoTitle, { color: themeColors.text }]}>{selectedSpot.attributes.ParkingName}</Text>
             <Pressable
               onPress={() => setSelectedSpot(null)}
               style={[styles.closeButton, { backgroundColor: themeColors.border }]}
               hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
             >
               <Text style={[styles.closeButtonText, { color: themeColors.icon }]}>✕</Text>
             </Pressable>
           </View>

          {/* Show live parking data for parking decks */}
          {selectedSpot.attributes.Type === 'Parking Deck' && (
            <View style={[styles.liveParkingContainer, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
              <LiveParkingInfo
                deckName={selectedSpot.attributes.ParkingName}
                liveData={getParkingForDeck(selectedSpot.attributes.ParkingName)}
                isLoading={isLiveParkingLoading}
                error={liveParkingError}
                onRefresh={refreshLiveParkingData}
                compact={true}
              />
            </View>
          )}

          {formatDescription(selectedSpot)}

          {selectedSpot.attributes.Type === 'Faculty/Staff' && !selectedSpot.attributes.isConditional && (
             <Text style={styles.conditionalText}>
                This lot is restricted to Faculty/Staff at all times.
             </Text>
          )}

          <Pressable onPress={openDirections} style={[styles.directionsButton, { backgroundColor: themeColors.tint }]}> 
            <Text style={styles.directionsText}>Take me there</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  headerBandFull: {
    backgroundColor: BrandColors.purple,
    paddingTop: 12,
    paddingBottom: 12,
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
  infoBox: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  infoBoxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingRight: 16,
    marginTop: -16,
    marginRight: -16,
    marginBottom: 5,
  },
  infoTitle: {
    flex: 1,
    fontWeight: 'bold',
    fontSize: 18,
    marginRight: 10,
  },
  infoDescription: {
    fontSize: 16,
    marginBottom: 8,
  },
  conditionalText: {
    fontSize: 14,
    color: '#e67e22',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  directionsButton: {
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  directionsText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  closeButton: {
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  downtownBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: WarningColors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WarningColors.border,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
  permissionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
    alignItems: 'center',
  },
  permissionText: {
    color: 'white',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionButton: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  homeButton: {
    position: 'absolute',
    left: 20,
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  homeButtonText: {
    fontSize: 20,
  },
  liveParkingContainer: {
    marginVertical: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
});

function getSpotKey(spot: ParkingSpot, idx: number) {
  const id = spot.attributes.OBJECTID ?? 'id';
  const name = spot.attributes.ParkingName ?? 'name';
  // Hash coordinates for uniqueness. rings[0] should always be present after
  // filterValidParkingSpots, but default to [] defensively since
  // JSON.stringify(undefined) returns undefined, not "undefined".
  const coordsString = JSON.stringify(spot.geometry.rings[0] ?? []);
  // Simple hash function for coordinates
  let coordHash = 0;
  for (let i = 0; i < coordsString.length; i++) {
    coordHash = ((coordHash << 5) - coordHash) + coordsString.charCodeAt(i);
    coordHash |= 0;
  }
  return `${id}-${name}-${coordHash}-${idx}`;
}