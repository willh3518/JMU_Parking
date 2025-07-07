import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function MainScreen() {
  return (
    <SafeAreaView style={styles.wrapper}>
      <View style={styles.container}>
        <Text style={styles.title}>Park Harrisonburg</Text>
        
        {/* New description */}
        <Text style={styles.description}>
          Welcome! This app helps you find available parking at JMU and in downtown Harrisonburg.
        </Text>
        <Text style={styles.description}>
          Use the 'Explore' tab to see the map and the 'Settings' tab to filter by parking type.
        </Text>

        {/* Updated Continue button */}
        <TouchableOpacity
          style={styles.button}
          onPress={() => alert('Welcome!')}
        >
          <Text style={styles.buttonText}>Continue</Text>
        </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40, // Added more padding
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 25, // Adjusted spacing
  },
  description: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 15, // Spacing between description lines
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginTop: 30, // Added spacing above the button
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});