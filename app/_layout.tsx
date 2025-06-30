import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native'; // Simple component for icons

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Main',
          // A simple text component can serve as a placeholder icon
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🗺️</Text>,
        }}
      />
    </Tabs>
  );
}