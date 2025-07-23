import { useCallback, useEffect, useState } from 'react';
import { fetchLiveParkingData, LiveParkingData } from '../services/parkingService';

export function useLiveParkingData() {
  const [parkingData, setParkingData] = useState<LiveParkingData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Function to refresh the parking data
  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      console.log('Refreshing parking data...');
      
      const data = await fetchLiveParkingData();
      setParkingData(data);
      
      console.log('Parking data refreshed successfully');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch parking data';
      setError(errorMessage);
      console.error('Error refreshing parking data:', errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Function to get parking data for a specific deck by name
  const getParkingForDeck = useCallback((deckName: string): LiveParkingData | null => {
    return parkingData.find(deck => deck.name === deckName) || null;
  }, [parkingData]);

  // Load data on mount
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('Auto-refreshing parking data...');
      refreshData();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [refreshData]);

  return {
    parkingData,
    isLoading,
    error,
    refreshData,
    getParkingForDeck,
  };
}
