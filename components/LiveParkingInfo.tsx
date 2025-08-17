import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveParkingData } from '../services/parkingService';

interface LiveParkingInfoProps {
  deckName: string;
  liveData: LiveParkingData | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
  compact?: boolean;
}

export function LiveParkingInfo({ 
  deckName, 
  liveData, 
  isLoading, 
  error, 
  onRefresh, 
  compact = false 
}: LiveParkingInfoProps) {
  const theme = useColorScheme() ?? 'light';
  const themeColors = Colors[theme];
  
  // Get color based on parking status
  const getStatusColor = (status: LiveParkingData['status']) => {
    switch (status) {
      case 'available': return '#4CAF50'; // Green
      case 'limited': return '#FF9800';   // Orange  
      case 'full': return '#F44336';      // Red
      case 'unknown': return '#9E9E9E';   // Gray
      default: return '#9E9E9E';
    }
  };

  // Get status text
  const getStatusText = (status: LiveParkingData['status']) => {
    switch (status) {
      case 'available': return 'Available';
      case 'limited': return 'Limited';
      case 'full': return 'Full';
      case 'unknown': return 'Unknown';
      default: return 'Unknown';
    }
  };

  // Format last updated time
  const formatLastUpdated = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme === 'light' ? '#f8f9fa' : '#1f2022', borderColor: theme === 'light' ? '#e9ecef' : '#2a2c2f' }, compact && styles.compactContainer]}>
        <View style={[styles.brandBar, { backgroundColor: themeColors.tint }]} />
        <ActivityIndicator size="small" color={themeColors.tint} />
        <Text style={[styles.loadingText, { color: themeColors.icon }]}>Loading live data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme === 'light' ? '#f8f9fa' : '#1f2022', borderColor: theme === 'light' ? '#e9ecef' : '#2a2c2f' }, compact && styles.compactContainer]}>
        <View style={[styles.brandBar, { backgroundColor: themeColors.tint }]} />
        <Text style={[styles.errorText]}>⚠️ Live data unavailable</Text>
        <Pressable onPress={onRefresh} style={styles.retryButton}>
          <Text style={[styles.retryText, { color: themeColors.tint }]}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!liveData) {
    return (
      <View style={[styles.container, { backgroundColor: theme === 'light' ? '#f8f9fa' : '#1f2022', borderColor: theme === 'light' ? '#e9ecef' : '#2a2c2f' }, compact && styles.compactContainer]}>
        <View style={[styles.brandBar, { backgroundColor: themeColors.tint }]} />
        <Text style={[styles.noDataText, { color: themeColors.icon }]}>No live data available</Text>
      </View>
    );
  }

  const statusColor = getStatusColor(liveData.status);
  const statusText = getStatusText(liveData.status);

  if (compact) {
    return (
      <View style={[styles.container, styles.compactContainer, { backgroundColor: theme === 'light' ? '#f8f9fa' : '#1f2022', borderColor: theme === 'light' ? '#e9ecef' : '#2a2c2f' }]}>        
        <View style={[styles.brandBar, { backgroundColor: themeColors.tint }]} />
        <View style={styles.compactRow}>
          <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
          <Text style={[styles.compactSpaces, { color: themeColors.text }]}>            
            {liveData.availableSpaces} spaces
          </Text>
          <Text style={[styles.compactStatus, { color: statusColor }]}>            
            {statusText}
          </Text>
        </View>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Text style={[styles.refreshText, { color: themeColors.tint }]}>🔄</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme === 'light' ? '#f8f9fa' : '#1f2022', borderColor: theme === 'light' ? '#e9ecef' : '#2a2c2f' }]}>      
      <View style={[styles.brandBar, { backgroundColor: themeColors.tint }]} />
      <View style={styles.header}>
        <Text style={[styles.title, { color: '#11181C' }]}>🅿️ Live Parking Data</Text>
        <Pressable onPress={onRefresh} style={styles.refreshButton}>
          <Text style={[styles.refreshText, { color: themeColors.tint }]}>🔄 Refresh</Text>
        </Pressable>
      </View>
      
      <View style={styles.dataRow}>
        <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
        <Text style={[styles.spacesText, { color: '#11181C' }]}>          
          {liveData.availableSpaces} of {liveData.totalSpaces} spaces available
        </Text>
      </View>
      
      <Text style={[styles.statusText, { color: statusColor }]}>        
        Status: {statusText}
      </Text>
      
      <Text style={[styles.lastUpdated, { color: '#666' }]}>        
        Last updated: {formatLastUpdated(liveData.lastUpdated)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
    position: 'relative',
    overflow: 'hidden',
  },
  brandBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  spacesText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  compactSpaces: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  compactStatus: {
    fontSize: 12,
    fontWeight: '500',
  },
  lastUpdated: {
    fontSize: 12,
    color: '#666',
  },
  refreshButton: {
    padding: 4,
  },
  refreshText: {
    fontSize: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
  },
  retryButton: {
    marginLeft: 8,
    padding: 4,
  },
  retryText: {
    fontSize: 12,
  },
  noDataText: {
    fontSize: 14,
    color: '#666',
  },
});
