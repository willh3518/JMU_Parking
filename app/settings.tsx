import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useFilters } from '../context/FilterContext'; // Import our custom hook

// A reusable Checkbox component
const Checkbox = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: () => void }) => (
  <Pressable style={styles.checkboxContainer} onPress={onValueChange}>
    <View style={[styles.checkbox, value && styles.checkboxChecked]}>
      {value && <Text style={styles.checkmark}>✓</Text>}
    </View>
    <Text style={styles.label}>{label}</Text>
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
        <Checkbox
          label="Parking Decks"
          value={filters.parkingDeck}
          onValueChange={() => toggleFilter('parkingDeck')}
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
});