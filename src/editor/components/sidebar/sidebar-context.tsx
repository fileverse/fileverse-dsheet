import { createContext, useContext, ReactNode } from 'react';
import { useRightPanels, PanelId } from './use-right-panels';

interface SidebarContextType {
  activePanel: PanelId | null;
  isOpen: boolean;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  isActive: (panel: PanelId) => boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({
  children,
  isReadMode = false,
}: Readonly<{ children: ReactNode; isReadMode?: boolean }>) {
  const panelsState = useRightPanels(isReadMode);
  return (
    <SidebarContext.Provider value={panelsState}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarContextType {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
