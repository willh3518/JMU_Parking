import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';
import { FilterProvider } from '../context/FilterContext';

export default function TabLayout() {
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];

  return (
    <FilterProvider>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: '#450084',
            borderTopColor: 'transparent',
          },
          tabBarActiveTintColor: '#FFFFFF',
          tabBarInactiveTintColor: 'rgba(255,255,255,0.75)',
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Find Parking',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🔍</Text>,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>🗺️</Text>,
          }}
        />
        {/* --- ADD THE NEW TAB HERE --- */}
        <Tabs.Screen
          name="list"
          options={{
            title: 'List',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>📄</Text>,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: 'Settings',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 24 }}>⚙️</Text>,
          }}
        />
        {/* Hide the not-found route from the tab bar */}
        <Tabs.Screen name="+not-found" options={{ href: null }} />
      </Tabs>
    </FilterProvider>
  );
}