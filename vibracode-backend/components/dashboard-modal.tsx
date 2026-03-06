'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import { ConvexDashboard } from '@/components/convex-dashboard';
import { Button } from '@/components/ui/button';
import { X, ExternalLink } from 'lucide-react';

interface ConvexProject {
  deploymentName: string;
  deploymentUrl: string;
  adminKey: string;
  token: string;
}

interface DashboardState {
  isOpen: boolean;
  project: ConvexProject | null;
}

const DashboardContext = createContext<{
  state: DashboardState;
  setState: (state: DashboardState) => void;
}>({
  state: { isOpen: false, project: null },
  setState: () => {},
});

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DashboardState>({
    isOpen: false,
    project: null,
  });

  return (
    <DashboardContext.Provider value={{ state, setState }}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  return useContext(DashboardContext);
}

// These functions are no longer needed - we use React Context directly

// DashboardModal component is no longer used - dashboard is embedded in preview tabs
