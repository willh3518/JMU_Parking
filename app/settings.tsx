import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '../constants/Colors';
import { useFilters } from '../context/FilterContext';
import { useColorScheme } from '../hooks/useColorScheme';

// This is a generic checkbox for most options
const Checkbox = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: () => void }) => {
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];
  return (
    <Pressable style={styles.checkboxContainer} onPress={onValueChange}>
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
        <Text style={[styles.label, { color: '#11181C' }]}>{label}</Text>
      </View>
    </Pressable>
  );
};

export default function SettingsScreen() {
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];
  const { filters, setFilters } = useFilters();

  const toggleFilter = (key: keyof typeof filters) => {
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
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <View style={[styles.header, { borderBottomColor: theme === 'light' ? '#ddd' : '#2a2c2f' }]}>
        <Text style={[styles.title, { color: '#11181C' }]}>Map Filters</Text>
        <Text style={[styles.subtitle, { color: '#11181C' }]}>Select which parking types to display on the map and list.</Text>
        <Text style={[styles.activeCount, { color: '#11181C' }]}>{activeCount} of 5 types selected</Text>

        {/* Control Buttons */}
        <View style={styles.controlButtons}>
          <Pressable style={[styles.controlButton, { backgroundColor: themeColors.tint }]} onPress={selectAll}>
            <Text style={styles.controlButtonText}>Select All</Text>
          </Pressable>
          <Pressable style={[styles.controlButton, { backgroundColor: themeColors.tint }]} onPress={clearAll}>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#11181C',
  },
  subtitle: {
    fontSize: 16,
    color: '#11181C',
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
    color: '#11181C',
  },
  infoIcon: {
    fontSize: 22,
  },
  activeCount: {
    fontSize: 14,
    color: '#11181C',
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