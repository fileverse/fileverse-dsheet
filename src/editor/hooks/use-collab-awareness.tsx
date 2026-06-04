import { useEffect, useRef } from 'react';
import { removeAwarenessStates } from 'y-protocols/awareness.js';
import type { Awareness } from 'y-protocols/awareness';
import { WorkbookInstance } from '@sheet-engine/react';
import { COLLAB_PRESENCE_COLORS, presenceColor } from '../../constants';

/**
 * Reads remote cursor positions from Yjs awareness and keeps Fortune sheet's
 * native presence list in sync. Fortune renders colored cell borders + username
 * labels automatically via context.presences[].
 */
export const useCollabAwareness = (
  awareness: Awareness | null | undefined,
  sheetEditorRef: React.MutableRefObject<WorkbookInstance | null>,
) => {
  const colorRef = useRef(
    COLLAB_PRESENCE_COLORS[
    Math.floor(Math.random() * COLLAB_PRESENCE_COLORS.length)
    ],
  );

  // Sync remote awareness states → Fortune addPresences / removePresences
  useEffect(() => {
    if (!awareness) return;

    const handleChange = ({
      removed,
    }: {
      added: number[];
      updated: number[];
      removed: number[];
    }) => {
      const workbook = sheetEditorRef.current;
      if (!workbook) return;

      // Explicitly remove departed clients from Fortune before re-reading states.
      if (removed.length > 0) {
        workbook.removePresences(
          removed.map((id) => ({ userId: String(id), username: '' })),
        );
      }

      const states = awareness.getStates();
      const localClientId = awareness.clientID;
      const presences: {
        sheetId: string;
        username: string;
        userId: string;
        color: string;
        isEns: boolean;
        selection: { r: number; c: number };
      }[] = [];

      states.forEach((state, clientId) => {
        if (clientId === localClientId) return;
        if (!state.user || !state.cell) return;

        const isEns = !!state.user.isEns;
        presences.push({
          sheetId: state.cell.sheetId,
          username: state.user.name ?? 'Anonymous',
          userId: String(clientId),
          color: presenceColor(isEns, state.user.color, clientId),
          isEns,
          selection: { r: state.cell.r, c: state.cell.c },
        });
      });

      // Replace all remote presences atomically:
      // removePresences clears stale entries, addPresences writes current ones
      const allRemoteIds = Array.from(states.keys())
        .filter((id) => id !== localClientId)
        .map((id) => ({ userId: String(id), username: '' }));

      if (allRemoteIds.length > 0) {
        workbook.removePresences(allRemoteIds);
      }
      if (presences.length > 0) {
        workbook.addPresences(presences);
      }
    };

    awareness.on('change', handleChange);

    // Periodically remove awareness states that haven't been updated within
    const STALE_TIMEOUT_MS = 10000;
    const staleCleanupInterval = setInterval(() => {
      const now = Date.now();
      const stale: number[] = [];
      awareness.meta.forEach(
        (meta: { clock: number; lastUpdated: number }, clientId: number) => {
          if (
            clientId !== awareness.clientID &&
            now - meta.lastUpdated > STALE_TIMEOUT_MS
          ) {
            stale.push(clientId);
          }
        },
      );
      if (stale.length > 0) {
        removeAwarenessStates(awareness, stale, 'timeout');
      }
    }, 5000);

    return () => {
      clearInterval(staleCleanupInterval);
      awareness.off('change', handleChange);

      // Remove local state so other peers stop seeing this cursor
      removeAwarenessStates(awareness, [awareness.clientID], 'hook unmount');

      // Clear all presences from Fortune on teardown
      sheetEditorRef.current?.removePresences(
        Array.from(awareness.getStates().keys())
          .filter((id) => id !== awareness.clientID)
          .map((id) => ({ userId: String(id), username: '' })),
      );
    };
  }, [awareness, sheetEditorRef]);

  return { localColor: colorRef.current };
};
