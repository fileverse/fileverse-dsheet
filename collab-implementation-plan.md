# Real-Time Collaboration Implementation Plan — fileverse-dsheet

Port the Socket.IO + IPFS collaboration architecture from fileverse-ddoc to fileverse-dsheet. The ydoc infrastructure already exists and is solid. What's missing is the socket transport, the state machine, encryption, and awareness rendering.

---

## Current State

dsheet already has:
- `Y.Doc` + `IndexeddbPersistence` via `use-editor-sync.tsx`
- Full ydoc write path (`updateYdocSheetData`, `ydoc.transact()`)
- Remote observer (`sheetArray.observe` with `transaction.local` guard)
- `portalContent` prop → state-vector diff apply in `use-editor-data.tsx`
- `onChange?: (updateData: SheetUpdateData, encodedUpdate?: string) => void` — second arg already exists but is unused
- A dead `use-editor-collaboration.tsx` stub using y-webrtc (public signaling, no encryption)

What's missing:
- Encrypted Socket.IO transport layer (SocketClient)
- Collab state machine (idle → connecting → syncing → ready → reconnecting)
- SyncManager class orchestrating initial sync, outgoing batching, remote apply
- IPFS commit snapshots + uncommitted-update tracking
- Awareness broadcast/receive for live cell cursors
- `CollaborationProps` discriminated-union prop on `DsheetProps`

---

## Architecture Overview

```
DsheetEditor (consumer)
  ↓ collaboration?: CollaborationProps
useEditorSync (modified)
  ├── Y.Doc + IndexeddbPersistence (unchanged)
  └── useSyncManager (NEW)
        └── SyncManager (NEW)
              ├── SocketClient (NEW — port from ddoc)
              ├── collabStateMachine (NEW — pure, port from ddoc)
              └── crypto utils (NEW — port from ddoc)

useEditorData (modified)
  └── ydoc.on('update') → debounced onChange(fullState, chunk)

Awareness (NEW)
  └── SyncManager.awareness → useCollabAwareness hook
        └── cell highlight overlay in EditorWorkbook
```

---

## Step 1 — Install Dependencies

```bash
npm install socket.io-client @ucans/ucans @stablelib/ed25519 @noble/curves js-base64 y-protocols
```

ddoc also uses `@fileverse/crypto` for ECIES. That package may not be public. If not available, implement inline (Step 2 covers this).

**Do not** remove `y-webrtc` or `y-websocket` yet — leave them until the new transport is verified.

---

## Step 2 — Create `src/sync-local/` Directory

Mirror ddoc's `package/sync-local/` layout exactly:

```
src/sync-local/
  crypto/
    index.ts
  utils/
    objectToFile.ts
    createAwarenessUpdateHandler.ts
  types/index.ts
  collabStateMachine.ts
  socketClient.ts
  SyncManager.ts
  useSyncManager.ts
  index.ts
```

### 2a. `src/sync-local/crypto/index.ts`

Copy from ddoc verbatim. If `@fileverse/crypto` is unavailable, implement ECIES using `@noble/curves/secp256k1` directly:

```ts
import { secp256k1 } from '@noble/curves/secp256k1';
import { gcm } from '@noble/ciphers/aes';
import { randomBytes } from '@noble/ciphers/webcrypto';
import { fromUint8Array, toUint8Array } from 'js-base64';

export const crypto = {
  encryptData(key: Uint8Array, message: Uint8Array): string {
    // ECIES: derive shared secret from key, encrypt with AES-GCM
    const ephemeralKey = secp256k1.utils.randomPrivateKey();
    const ephemeralPub = secp256k1.getPublicKey(ephemeralKey);
    const pubKey = secp256k1.getPublicKey(key);
    const sharedPoint = secp256k1.getSharedSecret(ephemeralKey, pubKey);
    const sharedSecret = sharedPoint.slice(1, 33); // x-coord only

    const nonce = randomBytes(12);
    const cipher = gcm(sharedSecret, nonce);
    const encrypted = cipher.encrypt(message);

    // Pack: [ephemeralPub(33) | nonce(12) | ciphertext]
    const result = new Uint8Array(33 + 12 + encrypted.length);
    result.set(ephemeralPub, 0);
    result.set(nonce, 33);
    result.set(encrypted, 45);
    return fromUint8Array(result);
  },

  decryptData(key: Uint8Array, message: string): Uint8Array {
    const bytes = toUint8Array(message);
    const ephemeralPub = bytes.slice(0, 33);
    const nonce = bytes.slice(33, 45);
    const ciphertext = bytes.slice(45);

    const sharedPoint = secp256k1.getSharedSecret(key, ephemeralPub);
    const sharedSecret = sharedPoint.slice(1, 33);

    const cipher = gcm(sharedSecret, nonce);
    return cipher.decrypt(ciphertext);
  },
};
```

> **Note:** If the server uses `@fileverse/crypto/ecies` specifically, the encrypt/decrypt format must match. Coordinate with the backend team on the exact wire format before implementing this step.

### 2b. `src/sync-local/utils/objectToFile.ts`

Copy from ddoc verbatim — no changes needed.

### 2c. `src/sync-local/utils/createAwarenessUpdateHandler.ts`

Copy from ddoc verbatim. Awareness update batching (50ms throttle) is transport-agnostic.

### 2d. `src/sync-local/types/index.ts`

Port from ddoc, replacing `Data['editorJSONData']` with `string` (dsheet encodes as base64 ydoc state):

```ts
import * as Y from 'yjs';

export interface CollabConnectionConfig {
  roomKey: string;
  roomId: string;
  wsUrl: string;
  isOwner: boolean;
  ownerEdSecret?: string;
  contractAddress?: string;
  ownerAddress?: string;
  roomInfo?: {
    documentTitle: string;
    portalAddress: string;
    commentKey: string;
  };
}

export interface CollabSessionMeta {
  username: string;
  color?: string;         // dsheet-specific: cell cursor color
}

export interface CollabServices {
  commitToStorage?: (file: File) => Promise<string>;
  fetchFromStorage?: (cid: string) => Promise<any>;
}

export type CollabStatus =
  | 'idle' | 'connecting' | 'syncing' | 'ready'
  | 'reconnecting' | 'error' | 'terminated';

export type CollabState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'syncing'; hasUnmergedPeerUpdates: boolean }
  | { status: 'ready' }
  | { status: 'reconnecting'; attempt: number; maxAttempts: number }
  | { status: 'error'; error: CollabError }
  | { status: 'terminated'; reason?: string };

// ... (CollabEvent, CollabContext, CollabError — copy verbatim from ddoc)

export interface CollabCallbacks {
  onStateChange?: (state: CollabState) => void;
  onError?: (error: CollabError) => void;
  onCollaboratorsChange?: (collaborators: CollabUser[]) => void;
  onHandshakeData?: (data: { data: AckResponse; roomKey: string }) => void;
}

export interface CollabUser {
  clientId: number;
  name: string;
  color: string;
  cell?: { r: number; c: number; sheetId: string };  // dsheet-specific
}

/** Discriminated union — same pattern as ddoc */
export type CollaborationProps =
  | { enabled: false }
  | {
      enabled: true;
      connection: CollabConnectionConfig;
      session: CollabSessionMeta;
      services: CollabServices;
      on?: CollabCallbacks;
    };

export interface SyncManagerConfig {
  ydoc: Y.Doc;
  services?: CollabServices;
  callbacks?: CollabCallbacks;
  onLocalUpdate?: (fullState: string, updateChunk: string) => void;
  ignoredOrigins?: Array<{ current: unknown }>;
}

// ... AckResponse, SendUpdateResponse, CommitResponse, ISocketInitConfig,
//     SocketStatusEnum, RoomMember, IAuthArgs — copy verbatim from ddoc
```

### 2e. `src/sync-local/collabStateMachine.ts`

**Copy verbatim from ddoc.** Pure function, zero dependencies on doc type. No changes.

### 2f. `src/sync-local/socketClient.ts`

**Copy verbatim from ddoc.** The SocketClient is entirely transport-level and knows nothing about ydoc structure. No changes needed.

### 2g. `src/sync-local/SyncManager.ts`

**Copy from ddoc as base.** Remove tab-awareness concepts; adapt `onLocalUpdate` signature.

Key changes from ddoc version:

```ts
// ddoc signature:
onLocalUpdate?: (updatedDocContent: Data['editorJSONData'], updateChunk: string) => void;

// dsheet signature (matches existing onChange second arg pattern):
onLocalUpdate?: (fullState: string, updateChunk: string) => void;
```

Everything else — `syncLatestCommit`, `sendUpdateBatch`, `applyRemoteYjsUpdate`, `applyQueuedRemoteContents`, `processCommit`, state machine transitions — **copy verbatim**. The ydoc operations (`Y.mergeUpdates`, `Y.applyUpdate`, `Y.encodeStateAsUpdate`) are the same regardless of ydoc content type.

### 2h. `src/sync-local/useSyncManager.ts`

**Copy verbatim from ddoc.** The hook is ydoc-agnostic — it only listens to `ydoc.on('update')` and calls `manager.enqueueLocalUpdate(update)`.

### 2i. `src/sync-local/index.ts`

```ts
export { useSyncManager } from './useSyncManager';
export { SyncManager } from './SyncManager';
export type {
  CollaborationProps, CollabConnectionConfig, CollabSessionMeta,
  CollabServices, CollabCallbacks, CollabState, CollabStatus,
  CollabError, CollabUser,
} from './types';
```

---

## Step 3 — Add `CollaborationProps` to `DsheetProps`

**File:** `src/editor/types.ts`

```ts
import { CollaborationProps } from '../sync-local/types';

export interface DsheetProps {
  // ... existing props ...

  collaboration?: CollaborationProps;

  // Modify onChange to match ddoc's two-arg signature:
  // arg1: full encoded ydoc state (base64) for persistence
  // arg2: incremental update chunk for real-time relay
  onChange?: (fullState: string, updateChunk: string) => void;

  // portalContent stays — used for non-collaborative portals and read-only mode
  portalContent?: string;
}
```

> **Breaking change note:** `onChange` signature changes from `(updateData: SheetUpdateData, encodedUpdate?: string)` to `(fullState: string, updateChunk: string)`. The consumer must be updated simultaneously. Coordinate this before merging.

---

## Step 4 — Modify `use-editor-sync.tsx`

**File:** `src/editor/hooks/use-editor-sync.tsx`

This hook currently owns ydoc + IDB. Extend it to also own the SyncManager when collaboration is enabled.

```ts
import { useRef, useEffect, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { fromUint8Array } from 'js-base64';
import { useSyncManager } from '../../sync-local/useSyncManager';
import type { CollaborationProps, CollabConnectionConfig } from '../../sync-local/types';

export const useEditorSync = (
  dsheetId: string,
  enableIndexeddbSync = true,
  isReadOnly = false,
  collaboration?: CollaborationProps,
  onChange?: (fullState: string, updateChunk: string) => void,
) => {
  const ydocRef = useRef<Y.Doc | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const [syncStatus, setSyncStatus] = useState<
    'initializing' | 'syncing' | 'synced' | 'error'
  >('initializing');
  const isSyncedRef = useRef<boolean>(false);
  const onChangeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stable ref so the debounced handler never captures a stale onChange identity
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

  // ---- Initialize ydoc once ----
  if (!ydocRef.current) {
    ydocRef.current = new Y.Doc();
  }
  const ydoc = ydocRef.current;

  const collabEnabled = collaboration?.enabled === true;
  const collabServices = collabEnabled ? collaboration.services : undefined;
  const collabCallbacks = collabEnabled ? collaboration.on : undefined;

  // ---- SyncManager (collaboration transport) ----
  const {
    connect,
    isReady,
    isSyncing,
    terminateSession,
    awareness,
    hasCollabContentInitialised,
    state: collabState,
  } = useSyncManager({
    ydoc,
    services: collabServices,
    callbacks: collabCallbacks,
    onLocalUpdate: (fullState, chunk) => {
      // Remote updates arrive here — forward to consumer immediately
      onChangeRef.current?.(fullState, chunk);
    },
    ignoredOrigins: [persistenceRef],
  });

  // ---- ydoc.on('update') → debounced onChange for local edits ----
  // (Only fires when not in collab mode — collab onChange is handled by SyncManager)
  useEffect(() => {
    if (collabEnabled) return;  // SyncManager handles this path

    const handler = (update: Uint8Array, origin: any) => {
      if (origin === persistenceRef.current) return;

      if (onChangeDebounceRef.current) clearTimeout(onChangeDebounceRef.current);
      onChangeDebounceRef.current = setTimeout(() => {
        onChangeDebounceRef.current = null;
        const fullState = fromUint8Array(Y.encodeStateAsUpdate(ydoc));
        const chunk = fromUint8Array(update);
        onChangeRef.current?.(fullState, chunk);
      }, 300);
    };

    ydoc.on('update', handler);
    return () => {
      ydoc.off('update', handler);
    };
  }, [ydoc, collabEnabled]);

  // ---- IndexedDB persistence ----
  const initialiseEditorIndexedDB = useCallback(async () => {
    if (persistenceRef.current) await persistenceRef.current.destroy();
    if (!enableIndexeddbSync || !dsheetId) {
      setSyncStatus('synced');
      isSyncedRef.current = true;
      return;
    }

    persistenceRef.current = new IndexeddbPersistence(dsheetId, ydoc);
    persistenceRef.current.once('synced', () => {
      setSyncStatus('synced');
      isSyncedRef.current = true;

      // After IDB syncs, connect to collab server (if enabled)
      if (collabEnabled && collaboration.enabled) {
        connect(collaboration.connection);
      }
    });
    persistenceRef.current.on('error', (err: Error) => {
      console.error('[DSheet] IndexedDB error:', err);
      setSyncStatus('error');
    });
  }, [dsheetId, enableIndexeddbSync, ydoc, collabEnabled]);

  useEffect(() => {
    if (isReadOnly) {
      setSyncStatus('synced');
      isSyncedRef.current = true;
      return;
    }
    initialiseEditorIndexedDB();

    return () => {
      persistenceRef.current?.destroy();
      persistenceRef.current = null;
      ydocRef.current?.destroy();
      ydocRef.current = null;
      isSyncedRef.current = false;
    };
  }, [dsheetId, enableIndexeddbSync, isReadOnly]);

  // Reconnect when connection config identity changes (e.g. new roomId)
  useEffect(() => {
    if (!collabEnabled || !isSyncedRef.current) return;
    connect((collaboration as any).connection as CollabConnectionConfig);
  }, [
    collabEnabled && (collaboration as any)?.connection?.roomId,
    collabEnabled && (collaboration as any)?.connection?.roomKey,
  ]);

  return {
    ydocRef,
    persistenceRef,
    syncStatus,
    isSyncedRef,
    refreshIndexedDB: initialiseEditorIndexedDB,
    // collab
    collabState,
    isCollabReady: isReady,
    isCollabSyncing: isSyncing,
    terminateSession,
    awareness,
    hasCollabContentInitialised,
  };
};
```

**Key decisions:**
- IDB sync fires first (`persistence.once('synced')`), then `connect()` is called. This matches ddoc's `whenSynced` → render flow. IDB gives the ydoc its local history before the server sync merges in remote history.
- In non-collab mode, the 300ms debounced `onChange` handler lives here (replaces the one currently in `use-editor-data.tsx`).
- `ignoredOrigins: [persistenceRef]` prevents IDB replays from triggering `enqueueLocalUpdate`.

---

## Step 5 — Modify `use-editor-data.tsx`

**File:** `src/editor/hooks/use-editor-data.tsx`

Remove the existing `portalContent` apply loop's `onChange` side-effects — `onChange` is now owned by `use-editor-sync.tsx` in collab mode. The `portalContent` path (non-collab, portal-based sync) remains unchanged.

Add a collab content initialisation path: when `hasCollabContentInitialised` becomes true, convert ydoc → `currentDataRef` and trigger re-render:

```ts
// NEW: Initialise sheet data from ydoc once collab sync completes
useEffect(() => {
  if (!hasCollabContentInitialised || !ydocRef.current || !dsheetId) return;

  const sheetArray = ydocRef.current.getArray(dsheetId);
  migrateSheetArrayIfNeeded(ydocRef.current, sheetArray);
  const plain = ySheetArrayToPlain(sheetArray as any);
  currentDataRef.current = plain;
  setIsDataLoaded(true);
  dataInitialized.current = true;
  if (setForceSheetRender) setForceSheetRender(prev => prev + 1);
}, [hasCollabContentInitialised]);
```

The existing `sheetArray.observe` handler (with `transaction.local` guard + 50ms debounce) already handles all subsequent remote updates — no changes needed there.

---

## Step 6 — Awareness: Cell Cursor Tracking

### 6a. Set local awareness state on cell selection

**File:** `src/editor/components/editor-workbook.tsx` (or wherever `onCellSelect` / `onRangeSelect` callbacks live)

```ts
// Whenever the user selects a cell, broadcast via awareness
const handleCellSelect = useCallback((r: number, c: number) => {
  if (!awareness) return;
  awareness.setLocalStateField('user', {
    name: username,
    color: userColor,
  });
  awareness.setLocalStateField('cell', {
    r, c,
    sheetId: sheetEditorRef.current?.getWorkbookContext()?.currentSheetId,
  });
}, [awareness, username, userColor]);
```

`awareness.setLocalStateField` triggers the `createAwarenessUpdateHandler` throttle (50ms), which encrypts and broadcasts via `socketClient.broadcastAwareness`.

### 6b. `useCollabAwareness` hook (NEW)

**File:** `src/editor/hooks/use-collab-awareness.tsx`

```ts
import { useEffect, useState } from 'react';
import { Awareness } from 'y-protocols/awareness.js';

export interface CollabCursor {
  clientId: number;
  name: string;
  color: string;
  cell?: { r: number; c: number; sheetId: string };
}

export const useCollabAwareness = (
  awareness: Awareness | null,
  localClientId: number,
): CollabCursor[] => {
  const [cursors, setCursors] = useState<CollabCursor[]>([]);

  useEffect(() => {
    if (!awareness) return;

    const update = () => {
      const states = awareness.getStates();
      const next: CollabCursor[] = [];
      states.forEach((state, clientId) => {
        if (clientId === localClientId) return;  // skip self
        if (!state.user) return;
        next.push({
          clientId,
          name: state.user.name ?? 'Anonymous',
          color: state.user.color ?? '#888',
          cell: state.cell,
        });
      });
      setCursors(next);
    };

    awareness.on('change', update);
    update(); // initial state
    return () => awareness.off('change', update);
  }, [awareness, localClientId]);

  return cursors;
};
```

### 6c. Cell highlight overlay

**File:** `src/editor/components/editor-workbook.tsx`

Pass `cursors` from `useCollabAwareness` to Fortune sheet's cell render. Fortune (`@sheet-engine/react`) supports `getCommentCellUI` and custom cell rendering — use the same mechanism to inject colored borders:

```tsx
// Build a map: "sheetId_r_c" → CollabCursor[] for O(1) lookup
const cursorMap = useMemo(() => {
  const map = new Map<string, CollabCursor[]>();
  cursors.forEach(cursor => {
    if (!cursor.cell) return;
    const key = `${cursor.cell.sheetId}_${cursor.cell.r}_${cursor.cell.c}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(cursor);
  });
  return map;
}, [cursors]);

// Pass to Workbook via a cell style hook or custom render prop
// Exact API depends on @sheet-engine/react capabilities —
// check if it exposes getCellStyle, getCellClassName, or a render slot.
```

> **Investigation needed:** Audit `@sheet-engine/react` API for cell overlay injection. If no hook exists, the alternative is a positioned `<div>` overlay matching cell coordinates via `getBoundingClientRect`.

---

## Step 7 — Update `DsheetEditor` Entry Point

**File:** `src/editor/dsheet-editor.tsx`

Pass `collaboration` and the new `onChange` through the context or directly to the hooks:

```tsx
<EditorProvider
  dsheetId={dsheetId}
  collaboration={collaboration}
  onChange={onChange}
  // ... other props
>
```

Update `EditorContext` to accept and distribute `collaboration`, `awareness`, `collabState`, `collabCursors`.

---

## Step 8 — Update `EditorContext`

**File:** `src/editor/contexts/editor-context.tsx`

```ts
// Add to context value:
collaboration?: CollaborationProps;
collabState?: CollabState;
awareness?: Awareness | null;
isCollabReady?: boolean;
isCollabSyncing?: boolean;
terminateSession?: () => void;
collabCursors?: CollabCursor[];
```

Wire from `useEditorSync` return values through the context so any component can read `collabState` for UI indicators.

---

## Step 9 — Collab Status UI

Add a small status indicator in the toolbar/navbar:

```tsx
// Minimal collab status chip
const CollabStatus = ({ state }: { state: CollabState }) => {
  if (state.status === 'ready') return <span className="text-green-500">● Live</span>;
  if (state.status === 'syncing') return <span className="text-yellow-500">● Syncing...</span>;
  if (state.status === 'reconnecting') return <span className="text-yellow-500">● Reconnecting ({state.attempt}/{state.maxAttempts})</span>;
  if (state.status === 'error') return <span className="text-red-500">● {state.error.message}</span>;
  return null;
};
```

---

## Step 10 — Clean Up Dead Code

After the new transport is verified in staging:

1. Delete `src/editor/hooks/use-editor-collaboration.tsx` (y-webrtc stub)
2. Remove `enableWebrtc` prop from `DsheetProps`
3. Remove `y-webrtc` and `y-websocket` from `package.json`
4. Remove `isCollaborative` prop (replace with `collaboration?.enabled` check)

---

## File Change Summary

| Action | File |
|---|---|
| **Create** | `src/sync-local/crypto/index.ts` |
| **Create** | `src/sync-local/utils/objectToFile.ts` |
| **Create** | `src/sync-local/utils/createAwarenessUpdateHandler.ts` |
| **Create** | `src/sync-local/types/index.ts` |
| **Create** | `src/sync-local/collabStateMachine.ts` |
| **Create** | `src/sync-local/socketClient.ts` |
| **Create** | `src/sync-local/SyncManager.ts` |
| **Create** | `src/sync-local/useSyncManager.ts` |
| **Create** | `src/sync-local/index.ts` |
| **Create** | `src/editor/hooks/use-collab-awareness.tsx` |
| **Modify** | `src/editor/hooks/use-editor-sync.tsx` — integrate SyncManager |
| **Modify** | `src/editor/hooks/use-editor-data.tsx` — collab init path |
| **Modify** | `src/editor/types.ts` — `CollaborationProps`, updated `onChange` |
| **Modify** | `src/editor/contexts/editor-context.tsx` — expose collab state |
| **Modify** | `src/editor/dsheet-editor.tsx` — pass collaboration prop |
| **Modify** | `src/editor/components/editor-workbook.tsx` — cell cursor overlay |
| **Delete** | `src/editor/hooks/use-editor-collaboration.tsx` |

---

## Implementation Order

Execute in this order to allow incremental testing at each stage:

1. **Steps 2a–2i** — Create all `sync-local/` files. No existing code touched. Can be merged as a standalone PR.
2. **Step 3** — Add `CollaborationProps` to `DsheetProps`. Additive — backward compatible if `onChange` deprecation is handled with an overload.
3. **Step 4** — Modify `use-editor-sync.tsx`. The `collabEnabled = false` path is identical to current behavior — test non-collab mode still works.
4. **Step 5** — Modify `use-editor-data.tsx`. `hasCollabContentInitialised` is `false` in non-collab mode — existing code paths unchanged.
5. **Step 6** — Awareness hooks + cell overlay. Self-contained — degraded gracefully when `awareness` is null.
6. **Steps 7–9** — Wire into context + UI. Last because it depends on all prior steps.
7. **Step 10** — Cleanup. Do this only after end-to-end testing in staging confirms the new transport works.

---

## Critical Differences from ddoc

### 1. No `Y.XmlFragment` — manual transact writes

ddoc content writes happen automatically via ProseMirror → y-prosemirror. dsheet writes happen manually via `updateYdocSheetData` → `ydoc.transact()`. The `transaction.local = true` guard in the observer means local writes already skip re-render — this is correct and unchanged. The SyncManager's `ydoc.on('update')` handler in `useSyncManager` will also see these local transactions and enqueue them — that is the intended behavior.

### 2. No tab-aware merge

ddoc's `mergeTabAwareYjsUpdates` is needed because raw `Y.mergeUpdates` loses legacy nested tab state. dsheet has no equivalent structural ambiguity — `Y.mergeUpdates` on dsheet's `Y.Array<Y.Map>` is safe without special handling.

### 3. Awareness state shape

ddoc awareness: `{ user: { name, color } }` → renders inline text cursors via y-prosemirror.

dsheet awareness: `{ user: { name, color }, cell: { r, c, sheetId } }` → renders colored cell borders. This is a custom layer on top of the same `Awareness` object.

### 4. `onChange` signature migration

ddoc `onChange(fullState, chunk)` is already that shape from day one. dsheet's current `onChange(updateData: SheetUpdateData, encodedUpdate?: string)` needs migration. The second arg `encodedUpdate` was always optional and matches what we need. The first arg changes from a structured object to a base64 string.

**Migration path for existing consumers:**
```ts
// Old:
onChange={(data, encoded) => saveToServer(data.data)}

// New:
onChange={(fullState, chunk) => saveToServer(fullState)}
```

The consumer should decode with `Y.applyUpdate(new Y.Doc(), toUint8Array(fullState))` + `ySheetArrayToPlain` if they need the structured data. Alternatively, expose a separate `onDataChange?: (sheets: Sheet[]) => void` prop that fires after ydoc updates, preserving backward compat.

### 5. `portalContent` stays

`portalContent` is the non-collaborative portal sync path (parent pushes a full ydoc blob). It coexists with the collab path — when `collaboration.enabled = true`, `portalContent` is simply ignored (or can be used for the initial seed before socket connects). The `lastAppliedPortalContentRef` dedup guard prevents double-apply.

---

## Testing Checklist

Before shipping:

- [ ] Non-collab mode (`collaboration` prop absent): existing behavior unchanged, IDB sync works, `onChange` fires with full state
- [ ] Read-only mode: no SyncManager instantiated, no socket connection
- [ ] Collab connect: IDB syncs → `connect()` fires → state machine reaches `ready`
- [ ] Two peers editing the same cell simultaneously: CRDT resolves without crash
- [ ] Peer disconnects mid-session: state transitions to `reconnecting`, updates queued, re-applied after reconnect
- [ ] Owner auto-commit fires after 100 updates: IPFS hash stored, `uncommittedUpdatesIdList` cleared
- [ ] Fresh load with no IDB + server has committed history: IPFS snapshot fetched and applied correctly
- [ ] Awareness: peer cursor appears on correct cell, disappears on disconnect/tab close
- [ ] `terminateSession()`: owner terminates, all peers get `terminated` state, no ghost socket connections
