import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { FilterProvider } from '../context/FilterContext';

export default function TabLayout() {
  return (
    <FilterProvider>
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
        {/* Add the new Settings tab */}
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>⚙️</Text>,
          }}
        />
      </Tabs>
    </FilterProvider>
  );
}