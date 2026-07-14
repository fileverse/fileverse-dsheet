import { useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from 'usehooks-ts';

export type BuiltInPanelType =
  | 'templates'
  | 'comments'
  | 'functions'
  | 'data-verification'
  | 'conditional-format';

// string allows consumer custom panels (e.g. 'smart-contract-list-view')
export type PanelId = BuiltInPanelType | string;

interface UseRightPanelsReturn {
  activePanel: PanelId | null;
  isOpen: boolean;
  openPanel: (panel: PanelId) => void;
  closePanel: () => void;
  togglePanel: (panel: PanelId) => void;
  isActive: (panel: PanelId) => boolean;
}

// Local constants (previously SIDEBAR_STATE_KEY came from app constants).
const ACTIVE_PANEL_KEY = 'dsheets-active-panel';
const SIDEBAR_STATE_KEY = 'dsheets-active-panel-state';

export const useRightPanels = (
  isReadMode: boolean = false,
): UseRightPanelsReturn => {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const isPanelAllowed = useCallback(
    (panel: PanelId) => {
      if (isReadMode) return panel === 'comments';
      return true;
    },
    [isReadMode],
  );

  const isMobile = useMediaQuery('(max-width: 840px)', { defaultValue: false });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedState = localStorage.getItem(SIDEBAR_STATE_KEY);

    if (savedState === null) {
      // First-time user — auto-open templates on the owner editor only.
      if (!isReadMode && !isMobile) {
        setActivePanel('templates');
        setIsOpen(true);
      }
    }
  }, [isReadMode, isMobile]);

  // Keep isOpen in sync with activePanel
  useEffect(() => {
    setIsOpen(activePanel !== null);
  }, [activePanel]);

  // Persist panel + open state
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activePanel) {
      localStorage.setItem(ACTIVE_PANEL_KEY, activePanel);
      localStorage.setItem(SIDEBAR_STATE_KEY, 'true');
    } else {
      localStorage.removeItem(ACTIVE_PANEL_KEY);
      localStorage.setItem(SIDEBAR_STATE_KEY, 'false');
    }
  }, [activePanel]);

  const openPanel = useCallback(
    (panel: PanelId) => {
      if (!isPanelAllowed(panel)) return;
      setActivePanel(panel);
    },
    [isPanelAllowed],
  );

  const closePanel = useCallback(() => setActivePanel(null), []);

  const togglePanel = useCallback(
    (panel: PanelId) => {
      if (!isPanelAllowed(panel)) return;
      setActivePanel((current) => (current === panel ? null : panel));
    },
    [isPanelAllowed],
  );

  const isActive = useCallback(
    (panel: PanelId) => activePanel === panel,
    [activePanel],
  );

  return { activePanel, isOpen, openPanel, closePanel, togglePanel, isActive };
};
