import { useRef, useEffect } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';

export const useYjsDocument = (
  dsheetId: string,
  enableIndexeddbSync: boolean,
) => {
  const ydocRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);

  useEffect(() => {
    if (!dsheetId) return;

    const ydoc = new Y.Doc({ gc: true });
    ydocRef.current = ydoc;

    if (enableIndexeddbSync) {
      const persistence = new IndexeddbPersistence(dsheetId, ydoc);
      persistenceRef.current = persistence;

      // Wait for the initial sync to complete
      persistence.once('synced', () => {
        console.log('Initial IndexedDB sync completed');
      });

      // Handle sync errors
      persistence.on('error', (error: Error) => {
        console.error('IndexedDB sync error:', error);
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
  }, [dsheetId, enableIndexeddbSync]);

  return { ydocRef, persistenceRef };
};
