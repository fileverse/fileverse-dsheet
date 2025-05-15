import { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export const useYjsDocument = (
  dsheetId: string,
  enableIndexeddbSync: boolean,
  isReadOnly: boolean = false,
) => {
  const ydocRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  useEffect(() => {
    if (!dsheetId) return;

    // Create a unique database name based on the dsheetId
    const dbName = `dsheet-${dsheetId}`;
    const ydoc = new Y.Doc({ gc: true });

    // Initialize the document structure
    // We ensure both the array and map exist immediately
    ydoc.getArray(dsheetId);
    ydoc.getMap(`${dsheetId}-metadata`);

    ydocRef.current = ydoc;

    // Only create IndexedDB persistence if we're not in read-only mode
    if (enableIndexeddbSync && !isReadOnly) {
      const persistence = new IndexeddbPersistence(dbName, ydoc);
      persistenceRef.current = persistence;

      // Wait for the initial sync to complete
      persistence.once('synced', () => {
        // Initial sync completed
        const sheetArray = ydoc.getArray(dsheetId);
        Array.from(sheetArray);
      });

      // Add sync status handlers
      persistence.on('sync', () => {
        // Sync status changed
      });

      // Handle sync errors
      persistence.on('error', () => {
        // IndexedDB sync error
      });
    }

    return () => {
      if (persistenceRef.current) {
        persistenceRef.current.destroy();
        persistenceRef.current = null;
      }
      ydoc.destroy();
      ydocRef.current = null;
    };
  }, [dsheetId, enableIndexeddbSync, isReadOnly]);

  return { ydocRef, persistenceRef };
};
