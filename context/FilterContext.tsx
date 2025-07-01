import React, { createContext, ReactNode, useContext, useState } from 'react';

// Define the shape of our filter settings
interface FilterState {
  commuter: boolean;
  resident: boolean;
  parkingDeck: boolean;
  downtown: boolean;
}

// Define what our context will provide: the state and a function to update it
interface FilterContextType {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

// Create the context with a default value
const FilterContext = createContext<FilterContextType | undefined>(undefined);

// Create a provider component that will wrap our app
export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<FilterState>({
    commuter: true,
    resident: true,
    parkingDeck: true,
    downtown: true,
  });

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

// Create a custom hook to easily access the context
export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};