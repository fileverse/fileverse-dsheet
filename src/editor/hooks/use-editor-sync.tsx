import { useRef, useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useSyncManager } from '../../sync-local/useSyncManager';
import type { CollaborationProps } from '../../sync-local/types';

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

      // Connect to collab server after IDB has replayed local history
      if (collabEnabled && collaboration?.enabled) {
        const collabFull = collaboration as Extract<
          CollaborationProps,
          { enabled: true }
        >;
        connect(collabFull.connection);
      }
    });

    persistenceRef.current.on('error', (err: Error) => {
      console.error('[DSheet] IndexedDB persistence error:', err);
      setSyncStatus('error');
    });
  }, [dsheetId, collabEnabled, connect]);

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

      // No IDB — connect to collab directly
      if (collabEnabled && collaboration?.enabled) {
        connect(
          (collaboration as Extract<CollaborationProps, { enabled: true }>)
            .connection,
        );
      }
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

  // Set local awareness user state once awareness is initialised
  useEffect(() => {
    if (!awareness || !collabEnabled || !collaboration?.enabled) return;
    const session = (
      collaboration as Extract<CollaborationProps, { enabled: true }>
    ).session;
    awareness.setLocalStateField('user', {
      name: session.username,
      color:
        session.color ??
        '#' +
        Math.floor(Math.random() * 0xffffff)
          .toString(16)
          .padStart(6, '0'),
    });
  }, [awareness, collabEnabled]);

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
