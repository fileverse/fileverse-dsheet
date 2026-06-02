import { useEffect, useRef } from 'react';
import { removeAwarenessStates } from 'y-protocols/awareness.js';
import type { Awareness } from 'y-protocols/awareness';
import { WorkbookInstance } from '@sheet-engine/react';

const COLLAB_COLORS = [
  '#E91E63', '#9C27B0', '#3F51B5', '#00BCD4',
  '#009688', '#FF5722', '#795548', '#607D8B',
];

function colorForClient(clientId: number): string {
  return COLLAB_COLORS[clientId % COLLAB_COLORS.length];
}

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
    COLLAB_COLORS[Math.floor(Math.random() * COLLAB_COLORS.length)],
  );

  // Sync remote awareness states → Fortune addPresences / removePresences
  useEffect(() => {
    if (!awareness) return;

    const handleChange = () => {
      const workbook = sheetEditorRef.current;
      if (!workbook) return;

      const states = awareness.getStates();
      const localClientId = awareness.clientID;
      const presences: {
        sheetId: string;
        username: string;
        userId: string;
        color: string;
        selection: { r: number; c: number };
      }[] = [];

      states.forEach((state, clientId) => {
        if (clientId === localClientId) return;
        if (!state.user || !state.cell) return;

        presences.push({
          sheetId: state.cell.sheetId,
          username: state.user.name ?? 'Anonymous',
          userId: String(clientId),
          color: state.user.color ?? colorForClient(clientId),
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

    return () => {
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
