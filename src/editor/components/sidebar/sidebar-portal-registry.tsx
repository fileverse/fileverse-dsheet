import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react';

export type SidebarPortalTargets = Record<string, HTMLElement>;

export type SidebarPortalRegistryHandle = {
  getTargets: () => SidebarPortalTargets;
  subscribe: (onStoreChange: () => void) => () => void;
};

type SidebarPortalRegistryContextValue = {
  registerPortalTarget: (panelId: string, element: HTMLElement | null) => void;
  registryHandle: SidebarPortalRegistryHandle;
};

const SidebarPortalRegistryContext =
  createContext<SidebarPortalRegistryContextValue | null>(null);

export function SidebarPortalRegistryProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const targetsRef = useRef<SidebarPortalTargets>({});
  const listenersRef = useRef(new Set<() => void>());

  const notify = useCallback(() => {
    listenersRef.current.forEach((listener) => listener());
  }, []);

  const registerPortalTarget = useCallback(
    (panelId: string, element: HTMLElement | null) => {
      const prev = targetsRef.current;
      if (element === null) {
        if (!(panelId in prev)) return;
        const next = { ...prev };
        delete next[panelId];
        targetsRef.current = next;
        notify();
        return;
      }
      if (prev[panelId] === element) return;
      targetsRef.current = { ...prev, [panelId]: element };
      notify();
    },
    [notify],
  );

  const registryHandle = useMemo<SidebarPortalRegistryHandle>(
    () => ({
      getTargets: () => targetsRef.current,
      subscribe: (onStoreChange) => {
        listenersRef.current.add(onStoreChange);
        return () => {
          listenersRef.current.delete(onStoreChange);
        };
      },
    }),
    [],
  );

  const value = useMemo(
    () => ({ registerPortalTarget, registryHandle }),
    [registerPortalTarget, registryHandle],
  );

  return (
    <SidebarPortalRegistryContext.Provider value={value}>
      {children}
    </SidebarPortalRegistryContext.Provider>
  );
}

function useSidebarPortalRegistry(): SidebarPortalRegistryContextValue {
  const context = useContext(SidebarPortalRegistryContext);
  if (!context) {
    throw new Error(
      'useSidebarPortalRegistry must be used within SidebarPortalRegistryProvider',
    );
  }
  return context;
}

export function useSidebarPortalRegistryHandle(): SidebarPortalRegistryHandle {
  return useSidebarPortalRegistry().registryHandle;
}

export function useSidebarPortalTargets(): SidebarPortalTargets {
  const { registryHandle } = useSidebarPortalRegistry();
  return useSyncExternalStore(
    registryHandle.subscribe,
    registryHandle.getTargets,
    registryHandle.getTargets,
  );
}

export function useSidebarPortalTarget(panelId: string) {
  const { registerPortalTarget } = useSidebarPortalRegistry();
  return useCallback(
    (node: HTMLElement | null) => {
      registerPortalTarget(panelId, node);
    },
    [panelId, registerPortalTarget],
  );
}

interface SidebarPortalSlotProps {
  panelId: string;
  className?: string;
  style?: CSSProperties;
}

export function SidebarPortalSlot({
  panelId,
  className,
  style,
}: Readonly<SidebarPortalSlotProps>) {
  const setTargetRef = useSidebarPortalTarget(panelId);
  return <div ref={setTargetRef} className={className} style={style} />;
}
