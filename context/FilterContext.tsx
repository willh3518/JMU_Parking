import React, { createContext, ReactNode, useContext, useState } from 'react';

interface FilterState {
  commuter: boolean;
  resident: boolean;
  parkingDeck: boolean;
  downtown: boolean;
  facultyStaff: boolean; 
}

interface FilterContextType {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [filters, setFilters] = useState<FilterState>({
    commuter: true,
    resident: true,
    parkingDeck: true,
    downtown: true,
    facultyStaff: true, 
  });

  return (
    <FilterContext.Provider value={{ filters, setFilters }}>
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
};