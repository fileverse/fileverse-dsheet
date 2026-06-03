# RTC (Real-Time Collaboration) Flow — fileverse-dsheet

> LLM context doc. Covers the full data path from demo UI → ydoc → WebSocket server and back. Use this to debug or extend the collaboration feature.

---

## Architecture Overview

```
Demo (App.tsx)
  └─ DSheetEditor (dsheet-editor.tsx)
       └─ EditorProvider (editor-context.tsx)
            ├─ useEditorSync (use-editor-sync.tsx)        ← ydoc + IndexedDB + collab wiring
            │    └─ useSyncManager (useSyncManager.ts)   ← React wrapper around SyncManager
            │         └─ SyncManager (SyncManager.ts)    ← core class: state machine + queue
            │              ├─ collabStateMachine.ts       ← pure state transitions
            │              └─ SocketClient (socketClient.ts) ← Socket.IO + UCAN auth
            └─ useCollabAwareness (use-collab-awareness.tsx) ← remote cursors → Fortune sheet
```

---

## File Map

| File | Role |
|------|------|
| `demo/src/App.tsx` | Demo entry: manages collab state, generates roomKey, builds `CollaborationProps` |
| `demo/src/storage/collab-store.ts` | Persists collab config in `localStorage` (survives refresh) |
| `demo/src/crypto/index.ts` | ECIES key generation for the demo |
| `src/editor/dsheet-editor.tsx` | Public component: renders `EditorProvider` + `EditorContent` |
| `src/editor/contexts/editor-context.tsx` | React context: wires all hooks together, exposes collab state downward |
| `src/editor/hooks/use-editor-sync.tsx` | Sets up ydoc, IndexedDB persistence, and calls `useSyncManager` |
| `src/editor/hooks/use-collab-awareness.tsx` | Reads remote awareness states → calls Fortune `addPresences`/`removePresences` |
| `src/editor/components/editor-workbook-sync.ts` | Ydoc ↔ Fortune sheet data sync (cell updates) |
| `src/sync-local/useSyncManager.ts` | React hook: creates `SyncManager`, registers ydoc update listener |
| `src/sync-local/SyncManager.ts` | Core class: owns state machine, update queue, commit logic |
| `src/sync-local/collabStateMachine.ts` | Pure function state machine: `(status, event) → nextStatus` |
| `src/sync-local/socketClient.ts` | Socket.IO client: UCAN auth, event listeners, awareness broadcast |
| `src/sync-local/crypto/index.ts` | ECIES encrypt/decrypt using secp256k1 (roomKey as private key) |
| `src/sync-local/utils/createAwarenessUpdateHandler.ts` | 50ms throttled awareness broadcaster |
| `src/sync-local/types/index.ts` | All shared types: `CollaborationProps`, `CollabState`, `CollabEvent`, etc. |

---

## Key Concepts

### roomKey
A base64-encoded secp256k1 private key (32 bytes). Generated once by the owner via `@fileverse/crypto/ecies`. Shared via the invite URL (`#key=<roomKey>`). Every encrypted payload uses this key:
- Encrypt: derive public key from private key → ECIES-encrypt
- Decrypt: ECIES-decrypt with private key

### roomId
A UUID (`crypto.randomUUID()`). Identifies the document/session on the server. Travels as `documentId` in all socket events.

### Owner vs Collaborator
- **Owner** (`isOwner: true`): has `ownerEdSecret` → gets `ownerToken` (UCAN). Can commit updates to IPFS, terminate sessions.
- **Collaborator** (`isOwner: false`): only has `collaborationToken` (UCAN from roomKey). Can read/write updates but cannot commit or terminate.

### Yjs (ydoc)
All sheet content lives in a single `Y.Doc`. Mutations happen as `Uint8Array` update blobs (CRDT). The ydoc is the single source of truth; Fortune sheet state is derived from it.

---

## State Machine

States: `idle → connecting → syncing → ready ⇄ reconnecting → error | terminated`

```
idle
  CONNECT → connecting
connecting
  AUTH_SUCCESS → syncing
  ERROR → error
  SESSION_TERMINATED → terminated
  RESET → idle
syncing
  SYNC_COMPLETE → ready        ← awareness is initialized here (entry action)
  SET_UNMERGED_UPDATES → syncing (context update only)
  ERROR → error
  RESET → idle
ready
  SOCKET_DROPPED → reconnecting
  SESSION_TERMINATED → terminated
  ERROR → error
  RESET → idle
reconnecting
  RECONNECTED → syncing
  RETRY_EXHAUSTED → error
  SOCKET_DROPPED → reconnecting (increments attempt counter)
  RESET → idle
error
  RESET → idle
terminated
  RESET → idle
```

**Entry actions:**
- `syncing ← ready`: `initializeAwareness()` — creates `Awareness` instance, registers handler, wires to socket

**Exit actions:**
- `→ idle`: `cleanupAwareness()` — tears down awareness, destroys it

The consumer-facing `CollabState` is derived from `(status, context)` via `deriveCollabState()`. This is what `onStateChange` callback receives.

---

## Full Connection Flow

### 1. Demo: Starting Collaboration

```typescript
// App.tsx — onStartCollaboration()
const { privateKeyBase64 } = cryptoUtils.generateKeyPair(); // ECIES key
const newCollabId = crypto.randomUUID();

// Build CollaborationProps:
collaboration = {
  enabled: true,
  connection: { roomKey, roomId, wsUrl, isOwner, ownerEdSecret, contractAddress, ownerAddress },
  session: { username },
  services: { commitToStorage, fetchFromStorage }, // undefined in demo
  on: { onStateChange, onError },
}
```

The owner's invite URL format:
```
https://app.example.com/?collaborationId=<roomId>&sheet=<dsheetId>#key=<roomKey>
```

On page load, a collaborator detects `collaborationId` + `#key` in the URL, prompts for a username, and sets `collabEnabled = true`.

Collab config is persisted to `localStorage` via `collabStore` so refreshes restore the session.

### 2. useEditorSync: ydoc + IndexedDB Setup

`useEditorSync` runs in `EditorProvider`. It:
1. Creates `Y.Doc` eagerly (before any hooks).
2. Calls `useSyncManager` (always — hooks can't be conditional).
3. Sets up `IndexeddbPersistence(dsheetId, ydoc)` — local content loads from IDB.
4. On IDB `'synced'` event: if collab is enabled, calls `connect(collabFull.connection)`.
5. If collab becomes enabled *after* IDB sync (user clicks "Start"): a separate effect calls `connect()`.
6. Once `awareness` is set (after `ready`): sets `awareness.localState.user = { name, color }`.

**Critical invariant:** `dsheetId` / `enableIndexeddbSync` / `isReadOnly` changes recreate the ydoc+IDB. `collabEnabled` changes do NOT recreate the ydoc — they only call `connect()`/`disconnect()` on the live ydoc.

### 3. useSyncManager: React Wrapper

- Creates one `SyncManager` instance per mount (via `useRef`, not `useState` — avoids re-render on creation).
- Calls `manager.updateRefs(services, callbacks, onLocalUpdate)` on every render to keep closures fresh.
- Attaches ydoc `'update'` listener when `isConnected` (covers `syncing | ready | reconnecting`). Filters origins:
  - `'self'`: own sync-time broadcast — skip
  - `'remote'`: incoming from peer — skip
  - IndexedDB provider origin (via `ignoredOrigins` ref) — skip
  - Everything else: `manager.enqueueLocalUpdate(update)`
- On unmount: `manager.forceCleanup()`.
- Manages awareness cleanup (`removeAwarenessStates`) on unmount and `beforeunload`.

### 4. SyncManager.connect()

Called with `CollabConnectionConfig`. Sequence:

```
connect(config)
  ├─ store roomKey, roomKeyBytes, isOwner
  ├─ snapshot pre-sync ydoc state as initialUpdate
  ├─ create SocketClient(config)
  ├─ send(CONNECT) → status: connecting
  ├─ connectSocket() → waits for handshake success
  ├─ send(AUTH_SUCCESS) → status: syncing
  ├─ syncLatestCommit(initialUpdate)
  │    ├─ fetchLatestCommit() → get latest IPFS CID
  │    ├─ decrypt commit data (if present)
  │    ├─ fetchFromStorage(cid) → fetch from IPFS (if service provided + CID present)
  │    ├─ getUncommittedChanges() → get all uncommitted update blobs from server
  │    ├─ merge: [initialUpdate, decryptedCommit, decryptedUncommittedUpdates]
  │    ├─ Y.applyUpdate(ydoc, merged, 'self')
  │    └─ owner: commitLocalContents() if threshold reached; else broadcastLocalContents()
  ├─ applyQueuedRemoteContents() → apply updates received during sync phase
  ├─ send(SYNC_COMPLETE) → status: ready → initializeAwareness() (entry action)
  └─ processUpdateQueue() if updateQueue is non-empty
```

### 5. SocketClient: Auth Handshake

Socket.IO connects to `wsUrl`. Server sends `/server/handshake` with `{ server_did }`.

```
client → /auth {
  collaborationToken: UCAN (issued by roomKey keypair, audience: server DID),
  sessionDid: collaborationKeyPair.did(),
  documentId: roomId,
  ownerToken: UCAN (issued by ownerKeyPair, audience: server DID),  ← owner only
  ownerAddress, contractAddress,                                    ← owner only
  roomInfo: encrypted JSON { documentTitle, portalAddress, commentKey } ← optional
}

server → ACK { status, statusCode, data }
  statusCode 200 → handshake success
  statusCode 404 → session not found → SESSION_TERMINATED event
  statusCode 401 → auth failed → reject / ERROR event
```

UCAN tokens are built with `@ucans/ucans`, 1-hour lifetime, cached and reused until 60s before expiry.

**Key derivation:** `collaborationKeyPair` is an Ed25519 keypair derived from the secp256k1 roomKey via `generateKeyPairFromSeed(toUint8Array(roomKey))`. The private key bytes of the secp256k1 key are reused as the Ed25519 seed.

### 6. Real-time Update Flow (local → peers)

```
User edits cell
  → Fortune fires sheet change event
  → editor-workbook-sync.ts calls Y.transact(ydoc, ...)  ← updates ydoc
  → ydoc 'update' event fires (origin = null or transaction origin)
  → useSyncManager updateHandler: origin not 'self'/'remote'/IDB → enqueueLocalUpdate(update)

SyncManager.enqueueLocalUpdate(update):
  → push to updateQueue
  → if queue.length >= 5: flushUpdates() immediately
  → else: start/reset 50ms timer → flushUpdates()

flushUpdates() → sendUpdateBatch():
  → Y.mergeUpdates(all queued updates) → single merged blob
  → ECIES-encrypt with roomKeyBytes
  → socketClient.sendUpdate({ update: encrypted })
       → emits '/documents/update' with { data, documentId, collaborationToken }
       → server ACK: { status, data: { id } }
  → store updateId in uncommittedUpdatesIdList
  → if isOwner && uncommittedUpdatesIdList.length >= 100: processCommit()
```

### 7. Real-time Update Flow (peers → local)

```
Server broadcasts '/document/content_update' to room
  → SocketClient: config.onContentUpdate(payload)
  → SyncManager.handleRemoteContentUpdate(payload)
       if status === 'syncing' | 'connecting':
         → queue in contentTobeAppliedQueue (applied after sync)
       else:
         → applyRemoteYjsUpdate(payload.data, payload.id)
              → ECIES-decrypt
              → Y.applyUpdate(ydoc, update, 'remote')
              → onLocalUpdate(fullState, updateChunk)  ← triggers onChange in demo
              → if isOwner: push id to uncommittedUpdatesIdList
```

`Y.applyUpdate` mutates the ydoc, which triggers the `observeDeep` callback registered in `use-editor-data.tsx`. The callback skips local-origin transactions and routes the update through one of two paths:

#### Surgical path (small cell edits, no remount)

For remote updates where all events are cell-data changes and the total changed-cell count is ≤ `SURGICAL_CELL_LIMIT` (50):

```
observerCallback fires (origin = 'remote')
  → classify events:
       path=[sheetIdx, 'celldata'] → CellBatch (r/c key → action + value)
       path=[sheetIdx, metaKey]   → SheetMetaUpdate (name/order/color/…)
       isSheetTabArrayChange()     → hasStructural = true
       anything else               → hasStructural = true
  → totalCells ≤ 50 && !hasStructural && sheetEditorRef.current exists
       → for each CellBatch:
            changedKeys.forEach((key) → sheetEditorRef.current.setCellValue(r, c, value, {id: sheetId}, false))
            ← callAfterUpdate=false prevents writing value back into ydoc (no loop)
       → if sheetMetaUpdates present:
            sheetEditorRef.current.setSheetName(name, {id: sheetId})
       → currentDataRef.current = ySheetArrayToPlain(sheetArray)  ← sync snapshot, no re-render
```

No `setForceSheetRender` call → no Workbook remount → **no flicker**.

#### Remount path (structural changes or large batches)

Falls back to debounced full remount when:
- Any event is structural (tab insert/delete or unknown path)
- `totalCells > SURGICAL_CELL_LIMIT`
- `sheetEditorRef.current` is null

```
  → debounce 50ms → setForceSheetRender(prev + 1)
       ← guarded: skipped if user is mid-cell-edit (luckysheetCellUpdate.length > 0)
       ← currentDataRef.current synced from ydoc before remount to avoid stale snapshot
```

**`SURGICAL_SHEET_META_KEYS`** — sheet-level fields that can be applied without a remount: `name`, `order`, `status`, `showGridLines`. `color` and `hide` are in the set for classification purposes but trigger a remount because no imperative `WorkbookInstance` API exists for them.

### 8. Commit Flow (owner only)

Commits are IPFS snapshots of the full ydoc state. They reduce uncommitted update count on the server.

Trigger conditions:
- After `syncLatestCommit` if `uncommittedUpdatesIdList.length >= 100`
- After `sendUpdateBatch` ACK if `uncommittedUpdatesIdList.length >= 100`
- After `handleRemoteContentUpdate` if threshold reached

```
processCommit():
  → Y.encodeStateAsUpdate(ydoc) → full state blob
  → ECIES-encrypt
  → objectToFile({ data: encrypted }, 'commit') → File object
  → services.commitToStorage(file) → upload to IPFS → returns CID
  → socketClient.commitUpdates({ updates: ids[], cid })
       → emits '/documents/commit' with ownerToken
       → server: marks those update IDs as committed, stores CID
  → uncommittedUpdatesIdList = []
```

If `commitToStorage` is not provided (demo uses `undefined`), commits are skipped. This means the server accumulates all uncommitted updates — fine for dev, degrades performance at scale.

### 9. Awareness (Cursors)

Awareness = presence data (cursor position, username, color). Separate channel from content updates.

**Local → remote:**
```
Awareness state changed (e.g. user moves to cell)
  → awareness 'update' event
  → createAwarenessUpdateHandler: accumulate clientIds, flush after 50ms
  → encodeAwarenessUpdate(awareness, [clientIds])
  → ECIES-encrypt
  → socketClient.broadcastAwareness(encrypted)
       → emits '/documents/awareness' (no ACK — fire and forget)
```

**Remote → local:**
```
Server broadcasts '/document/awareness_update'
  → SocketClient._handleAwarenessUpdate(data)
  → ECIES-decrypt data.data.position
  → applyAwarenessUpdate(awareness, decrypted, 'remote')
  → awareness 'change' event fires
  → useCollabAwareness handleChange()
       → reads all remote states from awareness
       → calls workbook.removePresences([...allRemoteIds])
       → calls workbook.addPresences([{ sheetId, username, userId, color, selection }])
       → Fortune renders colored cell highlights + username labels
```

Awareness is only initialized once `status === 'ready'` (entry action in state machine). On full disconnect (→ `idle`), awareness is destroyed. During reconnect, awareness is preserved — ghost cursors are cleaned up by the `disconnect` handler in SocketClient.

Cell position is written to awareness via:
```typescript
awareness.setLocalStateField('cell', { r, c, sheetId })
```
Username/color via:
```typescript
awareness.setLocalStateField('user', { name, color })
```

### 10. Reconnection Flow

```
Socket drops (unintentional)
  → SocketClient 'disconnect' event → config.onSocketDropped()
  → SyncManager: if status === 'ready': send(SOCKET_DROPPED) → status: reconnecting
  → Socket.IO auto-reconnects (3 attempts, 1500ms delay)
  → On reconnect: SocketClient sends 'reconnect' event, re-broadcasts awareness
  → Server re-sends '/server/handshake'
  → _handleHandShake runs again → onHandshakeSuccess() called again
  → SyncManager.connectSocket resolved already (settled=true), so goes to:
       if status !== 'reconnecting': send(SOCKET_DROPPED)
       handleReconnection()
         ├─ send(RECONNECTED) → status: syncing
         ├─ syncLatestCommit(initialUpdate)  ← re-sync missed changes
         ├─ applyQueuedRemoteContents()
         └─ send(SYNC_COMPLETE) → status: ready

If all 3 reconnect attempts fail:
  → 'reconnect_failed' event → config.onReconnectFailed()
  → SyncManager: send(RETRY_EXHAUSTED) → status: error
```

### 11. Session Termination

**Owner terminates:**
```
onStopCollaboration() in demo
  → collabStore.clearCollabConf()
  → sets collabEnabled = false → triggers useEditorSync disconnect effect
  → manager.terminateSession()
       → socketClient.terminateSession()
            → emits '/documents/terminate' with ownerToken
            → server broadcasts '/session/terminated' to all peers
       → resetInternalState()
       → send(SESSION_TERMINATED) → status: terminated
       → send(RESET) → status: idle
```

**Collaborator receives termination:**
```
Server sends '/session/terminated'
  → SocketClient: config.onSessionTerminated() + _onSessionTerminated()
  → SyncManager: resetInternalState() + send(SESSION_TERMINATED) → terminated
  → consumer's onStateChange receives { status: 'terminated' }
```

---

## Data Structures

### CollaborationProps (public API)

```typescript
type CollaborationProps =
  | { enabled: false }
  | {
      enabled: true;
      connection: {
        roomKey: string;      // base64 secp256k1 private key
        roomId: string;       // UUID
        wsUrl: string;        // Socket.IO server URL
        isOwner: boolean;
        ownerEdSecret?: string;      // base64 Ed25519 secret — owner only
        contractAddress?: string;    // for UCAN capability
        ownerAddress?: string;
        roomInfo?: { documentTitle, portalAddress, commentKey };
      };
      session: {
        username: string;
        color?: string;       // hex color for cursor
        isEns?: boolean;
      };
      services: {
        commitToStorage?: (file: File) => Promise<string>;  // returns IPFS CID
        fetchFromStorage?: (cid: string) => Promise<any>;   // returns { data: encryptedBase64 }
      };
      on?: {
        onStateChange?: (state: CollabState) => void;
        onError?: (error: CollabError) => void;
        onCollaboratorsChange?: (collaborators: CollabUser[]) => void;
        onHandshakeData?: (data: { data: AckResponse; roomKey: string }) => void;
      };
    };
```

### CollabState (consumer-facing)

```typescript
type CollabState =
  | { status: 'idle' }
  | { status: 'connecting' }
  | { status: 'syncing'; hasUnmergedPeerUpdates: boolean }
  | { status: 'ready' }
  | { status: 'reconnecting'; attempt: number; maxAttempts: number }
  | { status: 'error'; error: { code: CollabErrorCode; message: string; recoverable: boolean } }
  | { status: 'terminated'; reason?: string };
```

### Socket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `/server/handshake` | server → client | Server DID for UCAN audience |
| `/auth` | client → server | Auth with UCAN tokens |
| `/documents/update` | client → server | Send encrypted ydoc update |
| `/document/content_update` | server → client | Peer sent an update |
| `/documents/commit` | client → server | Owner commits updates to IPFS |
| `/documents/commit/history` | client → server | Fetch latest commit |
| `/documents/update/history` | client → server | Fetch uncommitted updates |
| `/documents/awareness` | client → server | Send encrypted awareness state |
| `/document/awareness_update` | server → client | Peer awareness changed |
| `/documents/terminate` | client → server | Owner terminates session |
| `/session/terminated` | server → client | Session was terminated |
| `/room/membership_change` | server → client | Peer joined or left |
| `/documents/peers/list` | client → server | Fetch current room members |

---

## Error Classification

| Error Code | Trigger Condition |
|------------|------------------|
| `CONNECTION_FAILED` | `SocketConnectionFailedError` name or "Failed to reconnect" message |
| `AUTH_FAILED` | statusCode 401 or message contains "AUTH_" |
| `SYNC_FAILED` | message contains "sync" or "decrypt" |
| `TIMEOUT` | `SocketConnectionTimeoutError` name or "timed out" message |
| `UNKNOWN` | Everything else |

---

## Constants

| Constant | Value | Purpose |
|----------|-------|---------|
| `MAX_RETRIES` | 3 | Retry count for sync/commit operations |
| `COMMIT_THRESHOLD` | 100 | Uncommitted updates before auto-commit |
| `FLUSH_INTERVAL_MS` | 50ms | Update batching window |
| `MAX_QUEUE_SIZE` | 5 | Immediate flush if queue reaches this |
| `SURGICAL_CELL_LIMIT` | 50 | Max changed cells for surgical (no-remount) remote apply; larger batches fall back to full Workbook remount |
| Remount debounce | 50ms | Delay before `setForceSheetRender` fires on structural/large-batch remote updates |
| Socket reconnection attempts | 3 | `reconnectionAttempts` in socket.io config |
| Socket reconnection delay | 1500ms | `reconnectionDelay` |
| Socket timeout | 6000ms | `timeout` (transport layer) |
| Connection timeout | 30s | Safety net in `connectSocket()` |
| UCAN lifetime | 3600s | 1 hour, cached until 60s before expiry |
| Awareness throttle | 50ms | Same window as update flush |

---

## Common Debugging Scenarios

### "Collaboration doesn't start"
1. Check `VITE_OWNER_ED_SECRET` is set in `demo/.env` — the "Start collaboration" button is disabled without it.
2. Check `VITE_COLLAB_WS_URL` points to a running server.
3. `collabEnabled` becomes true but IDB hasn't synced yet → `connect()` is deferred to the `once('synced')` callback. Add a log there.

### "Peer doesn't see my changes"
1. Check `collabState.status === 'ready'` — updates only flow in `ready` state (queued in `syncing`/`reconnecting`).
2. Check the ydoc update origin — must not be `'self'`, `'remote'`, or the IDB provider origin.
3. Check `sendUpdateBatch` — if `roomKey` or `isConnected` is false, the batch is dropped silently.

### "Stale cursors (ghost cursors)"
1. SocketClient `disconnect` handler cleans remote awareness states — if this doesn't fire, ghost cursors persist.
2. `useCollabAwareness` teardown calls `removePresences` + `removeAwarenessStates` — verify the hook unmounts correctly.

### "Reconnect loops"
1. Socket.IO fires `reconnect` → server sends `/server/handshake` → `onHandshakeSuccess` fires again → `handleReconnection()`.
2. If `_status !== 'reconnecting'` on the second `onHandshakeSuccess`, we send `SOCKET_DROPPED` first. This protects against double-transitions.
3. `connectSocket` resolves the outer promise only once (`settled` flag). Subsequent handshakes go through the reconnect path.

### "Remote cell updates cause visible flicker"
Flicker = full Workbook remount firing on every peer keystroke. Remounts happen when the surgical path is bypassed:
1. `sheetEditorRef.current` is null (workbook not yet mounted) → remount is the only option; resolve by ensuring `EditorWorkbook` is mounted before RTC connects.
2. `totalCells > SURGICAL_CELL_LIMIT` (paste / import / formula recalc) → intentional fallback; large batches are cheaper as one remount than N `setCellValue` calls.
3. An event path was unrecognised → `hasStructural = true`. Add a `console.log(event.path)` in the observer to identify the unclassified event and extend the classifier if needed.
4. `setCellValue` is missing on `sheetEditorRef.current` → the workbook API surface changed; check the `ISheetEditor` interface.

### "Commit never happens (demo)"
`services.commitToStorage` is `undefined` in the demo. `commitLocalContents` and `processCommit` both return early with a `console.debug`. This is by design — the demo accumulates all updates as uncommitted on the server.

### "Session terminated unexpectedly"
Server 404 on `/auth` → `onHandShakeError(err, 404)` → `SESSION_TERMINATED` event → `status: terminated`. The room may not exist yet (race on join before owner connects), or was already terminated.

---

## Adding New Features

### Adding a new collab event type
1. Add the event type to `CollabEvent` union in `src/sync-local/types/index.ts`.
2. Add the transition case(s) to `collabStateMachine.ts` `transition()`.
3. If it affects consumer-visible state, update `CollabState` type and `deriveCollabState()`.
4. Emit the event from `SyncManager` via `this.send({ type: 'NEW_EVENT' })`.

### Adding a new socket event
1. Add the listener in `SocketClient.connectSocket()`.
2. Add the callback to `ISocketInitConfig` in `types/index.ts`.
3. Pass the callback when calling `this.socketClient.connectSocket({...})` in `SyncManager.connectSocket()`.
4. Handle it in `SyncManager`.

### Adding a new awareness field
1. Set via `awareness.setLocalStateField('myField', value)` where awareness is available.
2. Read in `useCollabAwareness` via `states.forEach((state, clientId) => state.myField)`.
3. The field is automatically encrypted/decrypted as part of the awareness update blob.

### Replacing IPFS with a different storage backend
Implement `CollabServices.commitToStorage` and `fetchFromStorage`. The interface:
- `commitToStorage(file: File): Promise<string>` — returns a content-addressable ID (CID/hash/URL).
- `fetchFromStorage(cid: string): Promise<{ data: string }>` — returns `{ data: <base64-encrypted-blob> }`.

The encrypted blob is the ECIES-encrypted `Y.encodeStateAsUpdate(ydoc)`.

---

## Crypto Details

All payloads (content updates, awareness, commits) are encrypted with ECIES (secp256k1):

```
encrypt(roomKeyBytes: Uint8Array, message: Uint8Array) → base64 string
  - derive secp256k1 public key from private key (roomKeyBytes)
  - ECIES-encrypt message with public key
  - return base64-encoded ciphertext

decrypt(roomKeyBytes: Uint8Array, ciphertext: string) → Uint8Array
  - ECIES-decrypt base64 ciphertext with private key (roomKeyBytes)
  - return plaintext Uint8Array
```

Auth uses UCAN (ucans.build) with Ed25519 keypairs:
- `collaborationKeyPair`: Ed25519 derived from `generateKeyPairFromSeed(roomKeyBytes)` — shared by all room members
- `ownerKeyPair`: Ed25519 from `ownerEdSecret` — owner only, used to authorize commits and termination
