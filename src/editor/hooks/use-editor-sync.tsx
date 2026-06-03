import { useRef, useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useSyncManager } from '../../sync-local/useSyncManager';
import type { CollaborationProps } from '../../sync-local/types';
import { ENS_PRESENCE_COLOR } from '../../sync-local/constants';

export const useEditorSync = (
  dsheetId: string,
  enableIndexeddbSync = true,
  isReadOnly = false,
  collaboration?: CollaborationProps,
  onCollabUpdate?: (fullState: string, updateChunk: string) => void,
) => {
  const ydocRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'initializing' | 'syncing' | 'synced' | 'error'
  >('initializing');
  const isSyncedRef = useRef<boolean>(false);

  // Eager init — must exist before useSyncManager is called (hooks can't be conditional)
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }

  const collabEnabled = collaboration?.enabled === true;
  const collabServices = collabEnabled
    ? (collaboration as Extract<CollaborationProps, { enabled: true }>).services
    : undefined;
  const collabCallbacks = collabEnabled
    ? (collaboration as Extract<CollaborationProps, { enabled: true }>).on
    : undefined;

  // Stable ref so SyncManager closure never captures a stale onCollabUpdate identity
  const onCollabUpdateRef = useRef(onCollabUpdate);
  useEffect(() => {
    onCollabUpdateRef.current = onCollabUpdate;
  }, [onCollabUpdate]);

  const {
    connect,
    isReady: isCollabReady,
    isSyncing: isCollabSyncing,
    terminateSession,
    awareness,
    hasCollabContentInitialised,
    state: collabState,
  } = useSyncManager({
    ydoc: ydocRef.current,
    services: collabServices,
    callbacks: collabCallbacks,
    onLocalUpdate: (fullState, chunk) => {
      onCollabUpdateRef.current?.(fullState, chunk);
    },
    ignoredOrigins: [persistenceRef],
  });

  // Stable ref to connect so the collab effect doesn't recreate on every render
  const connectRef = useRef(connect);
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  // Always-current refs for collab state — read inside async/event callbacks
  // to avoid stale closures (e.g. once('synced') capturing collab=false at mount)
  const collabEnabledRef = useRef(collabEnabled);
  const collaborationRef = useRef(collaboration);
  collabEnabledRef.current = collabEnabled;
  collaborationRef.current = collaboration;

  const initialiseEditorIndexedDB = useCallback(async () => {
    if (!ydocRef.current) return;

    if (persistenceRef.current) {
      await persistenceRef.current.destroy();
    }

    persistenceRef.current = new IndexeddbPersistence(
      dsheetId,
      ydocRef.current,
    );

    persistenceRef.current.once('synced', () => {
      setSyncStatus('synced');
      isSyncedRef.current = true;

      // Read from refs — not from the closure — so we always get the value
      // at fire time, not at callback-creation time. Fixes the collaborator
      // race where collabEnabled becomes true after mount but before IDB sync.
      if (collabEnabledRef.current && collaborationRef.current?.enabled) {
        const collabFull = collaborationRef.current as Extract<
          CollaborationProps,
          { enabled: true }
        >;
        connectRef.current(collabFull.connection);
      }
    });

    persistenceRef.current.on('error', (err: Error) => {
      console.error('[DSheet] IndexedDB persistence error:', err);
      setSyncStatus('error');
    });
    // Intentionally excludes collabEnabled/connect — changing those must NOT
    // destroy the ydoc. The separate collabEnabled effect handles late connects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dsheetId]);

  // Main effect: only runs when dsheetId/enableIndexeddbSync/isReadOnly changes.
  // Does NOT include collabEnabled — starting/stopping collaboration must not
  // destroy and recreate the ydoc (data loss).
  useEffect(() => {
    if (!ydocRef.current) {
      ydocRef.current = new Y.Doc();
    }

    if (isReadOnly) {
      setSyncStatus('synced');
      isSyncedRef.current = true;
      return;
    }

    if (enableIndexeddbSync && dsheetId) {
      setSyncStatus('syncing');
      try {
        initialiseEditorIndexedDB();
      } catch (error) {
        console.error(
          '[DSheet] Error setting up IndexedDB persistence:',
          error,
        );
        setSyncStatus('error');
      }
    } else {
      setSyncStatus('synced');
      isSyncedRef.current = true;
    }

    return () => {
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
      isSyncedRef.current = false;
    };
  }, [dsheetId, enableIndexeddbSync, isReadOnly]);

  // Separate effect: connect to collab when collaboration is enabled AFTER the
  // ydoc/IDB is already synced (e.g. user clicks "Start Collaboration").
  // Does NOT touch the ydoc — just calls connect() on the live ydoc.
  useEffect(() => {
    if (!collabEnabled || !collaboration?.enabled) return;
    // If IDB hasn't synced yet, the once('synced') handler above will connect.
    // Only call connect() here when IDB is already synced (late enable).
    if (!isSyncedRef.current) return;

    const collabFull = collaboration as Extract<
      CollaborationProps,
      { enabled: true }
    >;
    connectRef.current(collabFull.connection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabEnabled]);

  // Set local awareness user state once awareness is initialised
  useEffect(() => {
    if (!awareness || !collabEnabled || !collaboration?.enabled) return;
    const session = (
      collaboration as Extract<CollaborationProps, { enabled: true }>
    ).session;
    awareness.setLocalStateField('user', {
      name: session.username,
      color: session.isEns
        ? ENS_PRESENCE_COLOR
        : (session.color ??
          '#' +
          Math.floor(Math.random() * 0xffffff)
            .toString(16)
            .padStart(6, '0')),
      isEns: session.isEns ?? false,
    });
  }, [awareness, collabEnabled]);

  const isEnsSession =
    collabEnabled && collaboration?.enabled
      ? (collaboration as Extract<CollaborationProps, { enabled: true }>)
        .session.isEns
      : undefined;

  // Re-publish awareness when ENS status resolves asynchronously
  useEffect(() => {
    if (!awareness || !collabEnabled || !collaboration?.enabled) return;
    const session = (
      collaboration as Extract<CollaborationProps, { enabled: true }>
    ).session;
    if (!session.isEns) return;
    const localState = awareness.getLocalState();
    awareness.setLocalStateField('user', {
      ...(localState?.user ?? {}),
      color: ENS_PRESENCE_COLOR,
      isEns: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [awareness, collabEnabled, isEnsSession]);

  return {
    ydocRef,
    persistenceRef,
    syncStatus,
    isSyncedRef,
    refreshIndexedDB: initialiseEditorIndexedDB,
    // collab
    collabState,
    isCollabReady,
    isCollabSyncing,
    terminateSession,
    awareness,
    hasCollabContentInitialised,
  };
};
