import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useFilters } from '../context/FilterContext';
import { useColorScheme } from '../hooks/useColorScheme';
import { hapticSelection } from '../utils/haptics';

// This is a generic checkbox for most options
const Checkbox = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: () => void }) => {
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];
  return (
    <Pressable
      style={styles.checkboxContainer}
      onPress={onValueChange}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <View style={styles.checkboxLabelContainer}>
        <View
          style={[
            styles.checkbox,
            { borderColor: themeColors.tint },
            value && { backgroundColor: themeColors.tint },
          ]}
        >
          {value && <Text style={styles.checkmark}>✓</Text>}
        </View>
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
      </View>
    </Pressable>
  );
};

export default function SettingsScreen() {
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];
  const { filters, setFilters } = useFilters();

  const toggleFilter = (key: keyof typeof filters) => {
    hapticSelection();
    setFilters(prevFilters => ({
      ...prevFilters,
      [key]: !prevFilters[key],
    }));
  };

  const selectAll = () => {
    setFilters({
      commuter: true,
      resident: true,
      parkingDeck: true,
      downtown: true,
      facultyStaff: true,
    });
  };

  const clearAll = () => {
    setFilters({
      commuter: false,
      resident: false,
      parkingDeck: false,
      downtown: false,
      facultyStaff: false,
    });
  };

  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <View style={[styles.header, { borderBottomColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>Map Filters</Text>
        <Text style={[styles.subtitle, { color: themeColors.text }]}>Select which parking types to display on the map and list.</Text>
        <Text style={[styles.activeCount, { color: themeColors.text }]}>{activeCount} of 5 types selected</Text>

        {/* Control Buttons */}
        <View style={styles.controlButtons}>
          <Pressable
            style={[styles.controlButton, { backgroundColor: themeColors.tint }]}
            onPress={selectAll}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.controlButtonText}>Select All</Text>
          </Pressable>
          <Pressable
            style={[styles.controlButton, { backgroundColor: themeColors.tint }]}
            onPress={clearAll}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.controlButtonText}>Clear All</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.optionsContainer}>
        <Checkbox
          label="Commuter Parking"
          value={filters.commuter}
          onValueChange={() => toggleFilter('commuter')}
        />
        <Checkbox
          label="Resident Parking"
          value={filters.resident}
          onValueChange={() => toggleFilter('resident')}
        />
        <Checkbox
          label="Parking Decks"
          value={filters.parkingDeck}
          onValueChange={() => toggleFilter('parkingDeck')}
        />
        <Checkbox
          label="Faculty/Staff Parking"
          value={filters.facultyStaff}
          onValueChange={() => toggleFilter('facultyStaff')}
        />
        <Checkbox
          label="Downtown Public Parking"
          value={filters.downtown}
          onValueChange={() => toggleFilter('downtown')}
        />
      </View>
    </SafeAreaView>
  );
}

// This is the complete and corrected style object
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 5,
  },
  optionsContainer: {
    padding: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  checkboxLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    // backgroundColor injected dynamically
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  label: {
    fontSize: 18,
  },
  infoIcon: {
    fontSize: 22,
  },
  activeCount: {
    fontSize: 14,
    marginTop: 8,
    fontWeight: '500',
  },
  controlButtons: {
    flexDirection: 'row',
    marginTop: 15,
    gap: 10,
  },
  controlButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});