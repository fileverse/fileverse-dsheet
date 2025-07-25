import { useRef, useEffect, useState } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

/**
 * Hook for setting up YJS document and persistence
 * Handles initialization of YJS document and optional IndexedDB persistence
 */
export const useEditorSync = (
  dsheetId: string,
  enableIndexeddbSync = true,
  isReadOnly = false,
) => {
  // References for YJS document and persistence
  const ydocRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'initializing' | 'syncing' | 'synced' | 'error'
  >('initializing');
  const isSyncedRef = useRef<boolean>(false);

  const initialiseEditorIndexedDB = async () => {
    if (!ydocRef.current) {
      return;
    }
    if (persistenceRef.current) {
      // If persistence already
      await persistenceRef.current.destroy();
    }
    persistenceRef.current = new IndexeddbPersistence(
      dsheetId,
      ydocRef.current,
    );

    // Listen for sync events
    persistenceRef.current.once('synced', () => {
      setSyncStatus('synced');
      isSyncedRef.current = true;
    });

    // Handle sync errors
    persistenceRef.current.on('error', (err: Error) => {
      console.error('[DSheet] IndexedDB persistence error:', err);
      setSyncStatus('error');
    });
  };

  // Initialize YJS document and persistence
  useEffect(() => {
    // Create new YJS document if it doesn't exist yet
    if (!ydocRef.current) {
      ydocRef.current = new Y.Doc();
    }

    // Set up IndexedDB persistence if enabled
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

    // Cleanup function
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

  return {
    ydocRef,
    persistenceRef,
    syncStatus,
    isSyncedRef,
    refreshIndexedDB: initialiseEditorIndexedDB,
  };
};
