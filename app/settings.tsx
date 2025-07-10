import React from 'react';
import { Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFilters } from '../context/FilterContext';

// This is a generic checkbox for most options
const Checkbox = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: () => void }) => (
  <Pressable style={styles.checkboxContainer} onPress={onValueChange}>
    <View style={styles.checkboxLabelContainer}>
      <View style={[styles.checkbox, value && styles.checkboxChecked]}>
        {value && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  </Pressable>
);

export default function SettingsScreen() {
  const { filters, setFilters } = useFilters();

  const toggleFilter = (key: keyof typeof filters) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [key]: !prevFilters[key],
    }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Map Filters</Text>
        <Text style={styles.subtitle}>Select which parking types to display on the map.</Text>
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

        {/* --- This is the corrected custom row for Parking Decks --- */}
        <View style={styles.checkboxContainer}>
          <Pressable style={styles.checkboxLabelContainer} onPress={() => toggleFilter('parkingDeck')}>
            <View style={[styles.checkbox, filters.parkingDeck && styles.checkboxChecked]}>
              {filters.parkingDeck && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.label}>Parking Decks</Text>
          </Pressable>
          <Pressable onPress={() => Linking.openURL('https://www.jmu.edu/parking/index.shtml')}>
            <Text style={styles.infoIcon}>ℹ️</Text>
          </Pressable>
        </View>
        
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
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
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
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
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
    color: '#007AFF',
  },
});