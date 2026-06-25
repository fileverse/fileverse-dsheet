import React, { useContext, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { Context } from '@sheet-engine/core';
import WorkbookContext from '../../context';
import DataVerification from '../DataVerification';
import ConditionRules from '../ConditionFormat/ConditionRules';

export type SidebarPortalTargets = Record<string, HTMLElement | undefined>;

export type SidebarPortalRegistryHandle = {
  getTargets: () => SidebarPortalTargets;
  subscribe: (onStoreChange: () => void) => () => void;
};

export type SidebarPortalRenderer = (
  workbook: React.ContextType<typeof WorkbookContext>,
) => React.ReactNode;

const BUILTIN_SIDEBAR_PORTALS: Record<string, SidebarPortalRenderer> = {
  'data-verification': () => <DataVerification />,
  'conditional-format': ({ context }) => (
    <ConditionRules context={context} />
  ),
};

interface SidebarPanelPortalsProps {
  activePanel: string | null;
  portalRegistry?: SidebarPortalRegistryHandle | null;
  extraPortals?: Record<string, SidebarPortalRenderer>;
}

const EMPTY_TARGETS: SidebarPortalTargets = {};

export function SidebarPanelPortals({
  activePanel,
  portalRegistry = null,
  extraPortals = {},
}: Readonly<SidebarPanelPortalsProps>) {
  const workbook = useContext(WorkbookContext);
  const targets = useSyncExternalStore(
    portalRegistry?.subscribe ?? (() => () => {}),
    portalRegistry?.getTargets ?? (() => EMPTY_TARGETS),
    portalRegistry?.getTargets ?? (() => EMPTY_TARGETS),
  );

  if (!activePanel || !portalRegistry) return null;

  const target = targets[activePanel];
  const render =
    BUILTIN_SIDEBAR_PORTALS[activePanel] ?? extraPortals[activePanel];

  if (!target || !render) return null;

  return createPortal(render(workbook), target);
}

export type { Context };
