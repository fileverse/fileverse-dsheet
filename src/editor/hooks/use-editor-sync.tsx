import { useRef, useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useSyncManager } from '../../sync-local/useSyncManager';
import type { CollaborationProps } from '../../sync-local/types';
import { presenceColor } from '../../constants';
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

  const activeCollab =
    collaboration?.enabled === true ? collaboration : undefined;
  const collabEnabled = activeCollab != null;
  const collabServices = activeCollab?.services;
  const collabCallbacks = activeCollab?.on;

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

  // Doc-lifecycle effect: owns ydocRef only. Deps = [dsheetId] deliberately —
  // recreating the doc on enableIndexeddbSync/isReadOnly changes is what let
  // SyncManager (bound once, see useSyncManager) end up pointed at a stale,
  // destroyed doc while the editor kept editing a new one. See collab
  // stale-Y.Doc-split design doc for the full incident writeup.
  useEffect(() => {
    if (!ydocRef.current) {
      ydocRef.current = new Y.Doc();
    }

    return () => {
      if (ydocRef.current) {
        ydocRef.current.destroy();
        ydocRef.current = null;
      }
    };
  }, [dsheetId]);

  // Persistence effect: attaches/detaches IndexedDB sync on the existing doc.
  // Never touches ydocRef — that's what keeps doc identity stable across
  // enableIndexeddbSync/isReadOnly flips (e.g. content arriving post-mount).
  useEffect(() => {
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
      isSyncedRef.current = false;
    };
  }, [dsheetId, enableIndexeddbSync, isReadOnly, initialiseEditorIndexedDB]);

  // Separate effect: connect to collab when collaboration is enabled AFTER the
  // ydoc/IDB is already synced (e.g. user clicks "Start Collaboration").
  // Does NOT touch the ydoc — just calls connect() on the live ydoc.
  // Cleanup disconnects the socket when collabEnabled flips back to false
  // (owner clicks Stop) so edits stop flowing between peers.
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

    return () => {
      // collabEnabled went false → tear down the socket connection.
      // terminateSession (owner) broadcasts SESSION_TERMINATED to joiners
      // before disconnecting; disconnect (joiner) just drops the socket.
      terminateSession();
    };
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
      color: presenceColor(session.isEns, session.color),
      isEns: session.isEns ?? false,
    });
  }, [awareness, collabEnabled]);

  const isEnsSession =
    collabEnabled && collaboration?.enabled
      ? (collaboration as Extract<CollaborationProps, { enabled: true }>)
        .session.isEns
      : undefined;

  const prevCollabStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const prev = prevCollabStatusRef.current;
    prevCollabStatusRef.current = collabState?.status;

    if (collabState?.status === 'ready' && prev === 'syncing' && awareness) {
      const localState = awareness.getLocalState();
      if (localState?.user) {
        awareness.setLocalStateField('user', localState.user);
      }
    }
  }, [collabState?.status, awareness]);

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
      color: presenceColor(session.isEns),
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
