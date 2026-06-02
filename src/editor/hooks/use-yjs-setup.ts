import { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { useSyncManager } from '../../sync-local/useSyncManager';
import {
  CollaborationProps,
  CollabCallbacks,
  CollabServices,
} from '../../sync-local/types';

interface UseYjsSetupArgs {
  /** Y.Doc ref — already initialised by useEditorSync */
  ydocRef: React.MutableRefObject<Y.Doc | null>;
  /** IndexedDB persistence ref — used as ignoredOrigin so IDB replay isn't forwarded to server */
  persistenceRef: React.MutableRefObject<IndexeddbPersistence | null>;
  /** Sync status from useEditorSync — used to gate the auto-connect */
  syncStatus: 'initializing' | 'syncing' | 'synced' | 'error';
  collaboration?: CollaborationProps;
  /**
   * Called after every remote Y.Doc update so the consumer's onChange fires
   * with fresh sheet data. Pass handleOnChangePortalUpdate from EditorProvider.
   */
  onRemoteUpdate?: () => void;
}

/**
 * Yjs + collaboration setup for dsheet — mirrors ddoc's use-yjs-setup pattern.
 *
 * Responsibilities:
 *  - Wraps useSyncManager (sync-local WebSocket engine).
 *  - Auto-connects after IndexedDB finishes syncing.
 *  - Adapts onLocalUpdate (string, string) → onRemoteUpdate () => void.
 *  - Passes persistenceRef as ignoredOrigins so IDB replay isn't forwarded to server.
 *  - When collaboration is disabled/absent, SyncManager stays idle — no server connection.
 */
export const useYjsSetup = ({
  ydocRef,
  persistenceRef,
  syncStatus,
  collaboration,
  onRemoteUpdate,
}: UseYjsSetupArgs) => {
  const collabEnabled = collaboration?.enabled === true;

  const services: CollabServices | undefined = collabEnabled
    ? (collaboration as Extract<CollaborationProps, { enabled: true }>).services
    : undefined;

  const callbacks: CollabCallbacks | undefined = collabEnabled
    ? (collaboration as Extract<CollaborationProps, { enabled: true }>).on
    : undefined;

  // Stable ref so onRemoteUpdate identity changes don't cause stale closures
  const onRemoteUpdateRef = useRef(onRemoteUpdate);
  onRemoteUpdateRef.current = onRemoteUpdate;

  const {
    connect,
    disconnect,
    terminateSession,
    isReady,
    isSyncing,
    awareness,
    hasCollabContentInitialised,
    state: collabState,
  } = useSyncManager({
    ydoc: ydocRef.current!,
    services,
    callbacks,
    onLocalUpdate: () => {
      onRemoteUpdateRef.current?.();
    },
    ignoredOrigins: [persistenceRef],
  });

  // Auto-connect once IndexedDB finishes syncing (or errors) and SyncManager is idle
  useEffect(() => {
    if (!collabEnabled) return;
    if (syncStatus !== 'synced' && syncStatus !== 'error') return;
    if (collabState.status !== 'idle') return;

    connect(
      (collaboration as Extract<CollaborationProps, { enabled: true }>)
        .connection,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabEnabled, syncStatus]);

  return {
    onConnect: connect,
    disconnect,
    terminateSession,
    isReady,
    isSyncing,
    awareness,
    hasCollabContentInitialised,
    collabState,
    collabEnabled,
  };
};
