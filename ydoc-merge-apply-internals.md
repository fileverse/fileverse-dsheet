# YDoc Merge & Apply Internals

Covers how **fileverse-dsheet** and **fileverse-ddoc** manage Yjs document state: how updates are produced, batched, merged, applied, and persisted. Read both sections to understand the architectural split.

---

## Part 1 — fileverse-dsheet

### Data Model

The ydoc holds one top-level `Y.Array` keyed by `dsheetId`. Each element is a `Y.Map` representing one sheet tab. Inside each sheet map, specific fields use nested Yjs types for granular conflict resolution:

```
ydoc
└── Y.Array<Y.Map> (key = dsheetId)
    └── sheet Y.Map
        ├── id, name, order, status  → primitives
        ├── celldata                 → Y.Map  (key = "r_c", e.g. "0_3")
        ├── calcChain                → Y.Map  (key = "r_c")
        ├── conditionRules           → Y.Map
        ├── dataVerification         → Y.Map
        ├── hyperlink                → Y.Map
        ├── filter_select            → Y.Map
        ├── filter                   → Y.Map  (replaced wholesale)
        ├── dataBlockCalcFunction    → Y.Map
        ├── liveQueryList            → Y.Map
        └── luckysheet_conditionformat_save → Y.Array
```

Cell keys use `"r_c"` (row_col) format. This allows per-cell CRDT updates instead of replacing entire arrays — critical for multi-user spreadsheet editing.

---

### YDoc Initialization

**File:** [`src/editor/hooks/use-editor-sync.tsx`](src/editor/hooks/use-editor-sync.tsx)

```ts
// One ydoc per editor mount, lives for the lifetime of the component
const ydocRef = useRef<Y.Doc | null>(null);

useEffect(() => {
  ydocRef.current = new Y.Doc();

  // IndexedDB persistence — syncs automatically, fires 'synced' event when ready
  const persistence = new IndexeddbPersistence(dsheetId, ydocRef.current);
  persistence.once('synced', () => setSyncStatus('synced'));

  return () => {
    persistence.destroy();
    ydocRef.current?.destroy();
  };
}, [dsheetId]);
```

The `syncStatus` gate (`'synced'`) prevents the editor from loading stale data before IDB replay is complete.

---

### Applying Remote / Portal Content

**File:** [`src/editor/hooks/use-editor-data.tsx:59-125`](src/editor/hooks/use-editor-data.tsx)

This is the most important merge path. The parent passes a `portalContent` string (base64-encoded full ydoc state blob) whenever remote content changes (multi-device sync, initial load from server).

```ts
useEffect(() => {
  if (!portalContent || portalContent === lastApplied) return;

  const incoming = toUint8Array(portalContent);
  const ydoc = ydocRef.current!;

  // Step 1: Get current state vector — encodes "what this ydoc already knows"
  const sv = Y.encodeStateVector(ydoc);

  // Step 2: Decode incoming blob into a throw-away doc
  const targetDoc = new Y.Doc();
  Y.applyUpdate(targetDoc, incoming);

  // Step 3: Compute only the delta — bytes that ydoc doesn't have yet
  const delta = Y.encodeStateAsUpdate(targetDoc, sv);
  targetDoc.destroy();

  // Step 4: Apply delta — safe, idempotent, no duplicate ops
  if (delta.byteLength > 0) {
    Y.applyUpdate(ydoc, delta);
  }

  // Step 5: Discover the dsheetId key from the blob, then migrate + convert
  const tempDoc = new Y.Doc();
  Y.applyUpdate(tempDoc, incoming);
  const internalDsheetId = [...tempDoc.share.keys()][0];

  // Migration runs on main ydoc (not tempDoc) so migration result persists
  const sheetArray = ydocRef.current.getArray(internalDsheetId);
  migrateSheetArrayIfNeeded(ydocRef.current, sheetArray);

  // Convert Yjs structure to plain Sheet[] for Fortune spreadsheet renderer
  const newSheetData = ySheetArrayToPlain(sheetArray);
  tempDoc.destroy();
}, [portalContent]);
```

**Why the state-vector diff approach?**
The IDB provider may have already replayed some history into the ydoc. A naive `Y.applyUpdate(ydoc, incoming)` would still work (Yjs is idempotent) but wastes bandwidth encoding operations that are already known. The diff approach sends only the net-new bytes.

---

### Writing Changes Into YDoc

**File:** [`src/editor/utils/update-ydoc.ts`](src/editor/utils/update-ydoc.ts)

All editor mutations funnel through `updateYdocSheetData`. It uses `ydoc.transact()` to batch all changes into a single Yjs update event.

```ts
export const updateYdocSheetData = (
  ydoc: Y.Doc,
  dsheetId: string,
  changes: SheetChangePath[],
  handleContentPortal: any,
) => {
  const sheetArray = ydoc.getArray<any>(dsheetId);

  ydoc.transact(() => {
    // Build sheetId → Y.Map lookup once per transaction
    const sheetById = new Map<string, Y.Map<any>>();
    sheetArray.toArray().forEach(s => {
      if (s instanceof Y.Map) sheetById.set(s.get('id'), s);
    });

    changes.forEach(({ sheetId, path, key, value, type }) => {
      const sheet = sheetById.get(sheetId);

      // celldata: granular per-cell updates
      if (path[0] === 'celldata' && key) {
        let cellMap = sheet.get('celldata');
        if (!(cellMap instanceof Y.Map)) {
          cellMap = new Y.Map();
          sheet.set('celldata', cellMap);
        }
        type === 'delete' ? cellMap.delete(key) : cellMap.set(key, value);
        return;
      }

      // filter: replace entire object (not keyed)
      if (path[0] === 'filter') {
        let filterMap = sheet.get('filter') ?? new Y.Map();
        filterMap.forEach((_, k) => filterMap.delete(k));  // clear first
        Object.entries(value || {}).forEach(([k, v]) => filterMap.set(k, v));
        return;
      }

      // luckysheet_conditionformat_save: replace entire array
      if (path[0] === 'luckysheet_conditionformat_save') {
        let arr = sheet.get('luckysheet_conditionformat_save') ?? new Y.Array();
        arr.delete(0, arr.length);
        arr.insert(0, Array.isArray(value) ? value : [value]);
        return;
      }

      // General path walk for nested Y.Map fields
      let target = sheet;
      for (let i = 0; i < path.length - 1; i++) {
        let next = target.get(path[i]);
        if (!(next instanceof Y.Map)) { next = new Y.Map(); target.set(path[i], next); }
        target = next;
      }
      target.set(path[path.length - 1], value);
    });
  });
};
```

`ydoc.transact()` means all `changes` produce **one** Yjs update event. Without this, each `.set()` fires a separate update — expensive and noisy for the observer.

---

### Reading YDoc Back to Plain Data

**File:** [`src/editor/utils/update-ydoc.ts:346-455`](src/editor/utils/update-ydoc.ts) — `ySheetArrayToPlain`

```ts
// Y.Array<Y.Map> → Sheet[] (plain objects for Fortune renderer)
export function ySheetArrayToPlain(sheetArray: Y.Array<Y.Map>): Sheet[] {
  return sheetArray.toArray().map(sheetMap => {
    const obj: any = {};
    sheetMap.forEach((value, key) => {
      if (key === 'celldata' && value instanceof Y.Map) {
        obj.celldata = value.toJSON();  // Y.Map → { "r_c": cellObj }
      } else if (value instanceof Y.Map || value instanceof Y.Array) {
        obj[key] = value.toJSON();
      } else {
        obj[key] = value;              // primitives pass through
      }
    });

    // Fortune expects arrays; IDB/ydoc stores as keyed objects
    obj.celldata = obj.celldata ? Object.values(obj.celldata) : [];
    obj.calcChain = obj.calcChain ? Object.values(obj.calcChain) : [];
    return obj;
  });
}
```

The `Object.values()` unwrapping at the end converts the `"r_c"`-keyed maps back to arrays for the spreadsheet engine.

---

### Observing Remote Changes

**File:** [`src/editor/hooks/use-editor-data.tsx:242-296`](src/editor/hooks/use-editor-data.tsx)

```ts
const sheetArray = ydoc.getArray(dsheetId);

sheetArray.observe((event: Y.YArrayEvent<any>, transaction: Y.Transaction) => {
  // Skip local changes — Fortune already reflects them, rebuilding would be wasteful
  if (transaction.local || isUpdatingRef.current) return;

  // Debounce to batch rapid remote updates (e.g. a peer typing quickly)
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const plain = ySheetArrayToPlain(sheetArray);
    currentDataRef.current = plain;

    // Don't force remount while user is actively editing a cell
    if (!isEditingCell) setForceSheetRender(prev => prev + 1);
  }, 50);
});
```

The `transaction.local` check is the anti-feedback-loop guard. Without it, every local write would trigger a re-render that re-initializes the spreadsheet and discards in-flight edits.

---

### Legacy Migration

**File:** [`src/editor/utils/migrate-new-yjs.ts`](src/editor/utils/migrate-new-yjs.ts)

Old documents stored sheets as plain JS objects inside `Y.Array`. The migration runs once on load, inside a `ydoc.transact()`, replacing each plain object with a proper `Y.Map`:

```ts
ydoc.transact(() => {
  sheetArray.forEach((item, index) => {
    if (item instanceof Y.Map) return;  // already migrated

    const sheetMap = new Y.Map();
    Object.entries(item).forEach(([key, value]) => {
      if (key === 'celldata' && Array.isArray(value)) {
        const cellMap = new Y.Map();
        value.forEach(cell => cellMap.set(`${cell.r}_${cell.c}`, cell));
        sheetMap.set('celldata', cellMap);
      } else {
        sheetMap.set(key, value);
      }
    });

    sheetArray.delete(index, 1);
    sheetArray.insert(index, [sheetMap]);
  });
});
```

Migration runs on the **main ydoc**, not a temp doc. Running it on a temp doc (a past bug) left the main doc unmigrated and caused `t.forEach is not a function` errors.

---

### dsheet — Data Flow Summary

```
portalContent (base64)
  ↓ toUint8Array
  ↓ Y.encodeStateVector(ydoc) → sv
  ↓ Y.applyUpdate(tempDoc, incoming)
  ↓ Y.encodeStateAsUpdate(tempDoc, sv) → delta   ← only net-new bytes
  ↓ Y.applyUpdate(ydoc, delta)
  ↓ migrateSheetArrayIfNeeded
  ↓ ySheetArrayToPlain → Sheet[]
  ↓ setForceSheetRender

User edits (Fortune onChange)
  ↓ diff against ydoc snapshot (diffObjectMap)
  ↓ SheetChangePath[]
  ↓ ydoc.transact(() => { ... set/delete on Y.Map ... })
  ↓ Y.Array observer fires (transaction.local = true → skip re-render)
  ↓ IDB provider persists automatically
```

---

---

## Part 2 — fileverse-ddoc

### Data Model

ddoc uses Tiptap/ProseMirror with `y-prosemirror`. The document content lives in a `Y.XmlFragment` managed by the Tiptap `Collaboration` extension. Tab metadata lives in separate `Y.Map` / `Y.Array` / `Y.Text` nodes at the root of the ydoc.

```
ydoc
├── Y.XmlFragment  ("default" tab content — Tiptap managed)
├── Y.XmlFragment  (per-tab content, key = tabId)
├── Y.Map (ddocTabsState)    ← active tab, tab order
│   ├── nameById   → Y.Map<tabId, string>
│   ├── emojiById  → Y.Map<tabId, string | null>
│   ├── order      → Y.Array<string>
│   └── activeTab  → string
└── Y.Map (ddocTabsDeleted)  ← tombstones for soft-deleted tabs
```

Content editing is entirely CRDT-native via ProseMirror operations — no manual `.set()` calls needed for text. Only tab metadata and comment mutations are written imperatively.

---

### YDoc Initialization

**File:** `fileverse-ddoc/package/hooks/use-yjs-setup.ts`

```ts
// Single ydoc, stable reference (useState not useRef — no re-creation on render)
const [ydoc] = useState(new Y.Doc());

// IndexedDB persistence
const provider = new IndexeddbPersistence(ddocId, ydoc);
yjsIndexeddbProviderRef.current = provider;
await provider.whenSynced;  // wait before rendering editor
setIsIndexeddbSynced(true);
```

Storing in `useState` (not `useRef`) means the ydoc identity never changes even if the component re-renders — important because Tiptap registers extension handlers once at mount.

---

### onChange — Debounced Full-State Export

**File:** `fileverse-ddoc/package/hooks/use-yjs-setup.ts:114-145`

```ts
ydoc.on('update', (update: Uint8Array, origin: any) => {
  // Skip IDB replay (yjsIndexeddbProviderRef.current) and self-applied updates ('self')
  if (origin === 'self' || origin === yjsIndexeddbProviderRef.current) return;

  // Debounce 300ms — encoding the full state on every keystroke is O(n) expensive
  clearTimeout(onChangeDebounceRef.current);
  onChangeDebounceRef.current = setTimeout(() => {
    onChange(
      fromUint8Array(Y.encodeStateAsUpdate(ydoc)),  // full state → persistence
      fromUint8Array(update),                        // incremental chunk → real-time broadcast
    );
  }, 300);
});
```

`onChange` receives **two** arguments:
- `fullState` — the entire ydoc encoded as a single blob. Used by the consumer to persist to their backend.
- `updateChunk` — the incremental Yjs update that just fired. Used for real-time relay to other peers without re-encoding the full doc.

The debounce ref is **not** cleared on unmount intentionally — a pending save must complete even if the component tears down between keystrokes.

---

### Flush Pending Update

```ts
// Immediately flush any debounced onChange before a critical structural operation
const flushPendingUpdate = () => {
  clearTimeout(onChangeDebounceRef.current);
  onChange(fromUint8Array(Y.encodeStateAsUpdate(ydoc)), '');
};
```

Called before tab create/delete/rename/reorder to ensure the persistence layer captures the full state before the structural mutation.

---

### SyncManager — Collaborative Sync

**File:** `fileverse-ddoc/package/sync-local/SyncManager.ts`

The `SyncManager` is a state-machine-driven class (states: `idle → connecting → syncing → ready`) that handles WebSocket collaboration.

#### Initial Sync (`syncLatestCommit`)

When connecting, the manager collects three update sources and merges them into a single state:

```ts
const updates: Uint8Array[] = [];

// 1. Current local ydoc state (IDB-hydrated)
updates.push(toUint8Array(initialUpdate));

// 2. Latest committed snapshot from IPFS (decrypted)
if (history?.cid) {
  const content = await fetchFromStorage(history.cid);
  updates.push(cryptoUtils.decryptData(roomKeyBytes, content.data));
}

// 3. Uncommitted server-side updates since last commit (decrypted)
for (const encryptedUpdate of uncommittedChanges) {
  updates.push(cryptoUtils.decryptData(roomKeyBytes, encryptedUpdate.data));
}

// Merge all — Y.mergeUpdates deduplicates overlapping history
const mergedState = Y.mergeUpdates(updates);
Y.applyUpdate(this.ydoc, mergedState, 'self');  // origin='self' skips onChange
```

Using `'self'` as origin prevents the `ydoc.on('update')` handler from triggering `onChange` and saving back to the backend during initial sync.

After sync, the **post-sync state** (not pre-sync `initialUpdate`) is broadcast to peers:

```ts
// Broadcast post-sync so peers get the merged state including server content
const postSyncUpdate = fromUint8Array(Y.encodeStateAsUpdate(this.ydoc));
await broadcastLocalContents(postSyncUpdate);
```

This is critical — broadcasting the pre-sync `initialUpdate` would send a stale blob that lacks the server content just merged in, causing peers to miss parent operations for subsequent edits.

---

#### Outgoing Local Updates — Batched Send

```ts
// Enqueued by ydoc.on('update') listener in useSyncManager
enqueueLocalUpdate(update: Uint8Array): void {
  this.updateQueue.push(update);

  // Flush immediately if queue is full (MAX_QUEUE_SIZE = 5)
  if (this.updateQueue.length >= 5) {
    this.flushUpdates();
    return;
  }

  // Otherwise batch with 50ms timer
  clearTimeout(this.flushTimer);
  this.flushTimer = setTimeout(() => this.flushUpdates(), 50);
}

private sendUpdateBatch(): void {
  const merged = Y.mergeUpdates(this.updateQueue);  // combine queued keystrokes
  const encrypted = cryptoUtils.encryptData(this.roomKeyBytes!, merged);
  this.updateQueue = [];

  // Fire-and-forget — server broadcasts to peers before MongoDB write
  this.socketClient.sendUpdate({ update: encrypted })
    .then(response => {
      if (response?.data?.id) this.uncommittedUpdatesIdList.push(response.data.id);
      if (this.isOwner && this.uncommittedUpdatesIdList.length >= 100) {
        this.processCommit();  // auto-commit to IPFS when 100 updates accumulate
      }
    });
}
```

The 50ms batch window means rapid typing is collapsed into one network message. The `MAX_QUEUE_SIZE=5` flush ensures no more than 5 pending updates accumulate even during a burst.

---

#### Receiving Remote Updates

Two paths depending on timing:

**During syncing phase** — updates queue up:
```ts
// Socket fires onContentUpdate while status is 'syncing'
this.contentTobeAppliedQueue.push({ data: payload.data, id: payload.id });
```

**After ready** — apply immediately:
```ts
private applyRemoteYjsUpdate(encrypted: string, id?: string): void {
  const update = cryptoUtils.decryptData(this.roomKeyBytes!, encrypted);
  Y.applyUpdate(this.ydoc, update, 'remote');  // origin='remote'

  // Notify persistence with full state + delta chunk
  this.onLocalUpdate(
    fromUint8Array(Y.encodeStateAsUpdate(this.ydoc)),  // full state
    fromUint8Array(update),                             // delta
  );
}
```

**Flushing the queue** (after sync completes):
```ts
private applyQueuedRemoteContents(): void {
  const decryptedContents = this.contentTobeAppliedQueue.map(item =>
    cryptoUtils.decryptData(this.roomKeyBytes!, item.data)
  );
  this.contentTobeAppliedQueue = [];

  // Merge all queued updates into one, apply once
  const mergedContents = Y.mergeUpdates(decryptedContents);
  Y.applyUpdate(this.ydoc, mergedContents, 'remote');
}
```

---

#### Auto-Commit to IPFS

Every 100 uncommitted updates, the owner (room creator) snapshots the full ydoc state and commits it to IPFS:

```ts
private async processCommit(): Promise<void> {
  const commitContent = {
    data: cryptoUtils.encryptData(
      this.roomKeyBytes!,
      Y.encodeStateAsUpdate(this.ydoc),  // full state snapshot
    )
  };
  const file = objectToFile(commitContent, 'commit');
  const ipfsHash = await this.servicesRef.commitToStorage(file);

  await this.socketClient.commitUpdates({ updates: committedIds, cid: ipfsHash });
  this.uncommittedUpdatesIdList = [];
}
```

This keeps the uncommitted-update list bounded. On next `syncLatestCommit`, the IPFS snapshot is fetched instead of replaying all individual updates from scratch.

---

### Tab-Aware Merge

**File:** `fileverse-ddoc/package/components/tabs/utils/tab-utils.ts:544-577`

Multi-tab documents have a structural problem: raw `Y.mergeUpdates` can lose legacy nested `ddocTabs` state when conflicting with the flat schema. `mergeTabAwareYjsUpdates` handles this:

```ts
export function mergeTabAwareYjsUpdates(encodedUpdates: string[]): string {
  // 1. Resolve tab state from each source independently (before merging)
  //    This recovers tabs that would be lost in the raw Yjs merge
  const resolvedStatesPerUpdate = encodedUpdates.map(update => {
    const tempDoc = new Y.Doc();
    Y.applyUpdate(tempDoc, toUint8Array(update), 'self');
    return getResolvedTabStateForDoc(tempDoc).resolvedTabState;
  });

  // 2. Raw Yjs merge into a new doc
  const mergedDoc = new Y.Doc();
  const parsed = encodedUpdates.map(u => toUint8Array(u));
  Y.applyUpdate(mergedDoc, Y.mergeUpdates(parsed), 'self');

  // 3. Resolve tab state from merged doc (may have lost legacy data)
  const { resolvedTabState: mergedDocState } = getResolvedTabStateForDoc(mergedDoc);

  // 4. Union: merge per-update recovery states into merged result
  const finalResolvedState = mergeResolvedTabState(mergedDocState, resolvedStatesPerUpdate);

  // 5. Write canonical flat tab state back into merged doc
  applyResolvedTabState(mergedDoc, finalResolvedState);

  return fromUint8Array(Y.encodeStateAsUpdate(mergedDoc));
}
```

This is called from `DdocEditor.mergeYjsContents()` (exposed via `useImperativeHandle`) when the consumer wants to reconcile multiple document versions.

---

### Comment Mutation Tracking

**File:** `fileverse-ddoc/package/stores/comment-store.ts:3348-3369`

Comments are written directly into the ydoc. The store tracks exactly what changed using a before/after state vector diff:

```ts
createMutationMeta: (type, mutate) => {
  // Snapshot state vector before mutation
  const beforeStateVector = Y.encodeStateVector(ydoc);

  // Run the mutation (writes to ydoc)
  const hasMutated = mutate();
  if (!hasMutated) return undefined;

  // Encode only the delta — bytes added since the snapshot
  const update = Y.encodeStateAsUpdate(ydoc, beforeStateVector);
  if (!update || update.byteLength === 0) return undefined;

  return { type, updateChunk: fromUint8Array(update) };
}
```

This produces a minimal delta that can be broadcast to peers or stored independently — equivalent to the dsheet state-vector-diff pattern, but applied at the mutation level rather than the portal-content level.

---

### ddoc — Data Flow Summary

```
Initial load (IDB synced)
  ↓ IndexeddbPersistence.whenSynced
  ↓ setIsIndexeddbSynced(true) → editor renders

Collaborative connect
  ↓ fetchLatestCommit (IPFS snapshot)
  ↓ getUncommittedChanges (server updates)
  ↓ Y.mergeUpdates([localState, ipfsSnapshot, ...uncommitted])
  ↓ Y.applyUpdate(ydoc, mergedState, 'self')       ← origin skips onChange
  ↓ Y.encodeStateAsUpdate(ydoc) → broadcast postSyncUpdate to peers

User types (ProseMirror ops)
  ↓ y-prosemirror applies to Y.XmlFragment automatically
  ↓ ydoc fires 'update' event
  ↓ enqueueLocalUpdate(update)  ← 50ms batch / MAX_QUEUE_SIZE=5
  ↓ Y.mergeUpdates(queue) → encrypt → send via socket
  ↓ debounced 300ms → onChange(fullState, chunk)  ← persist to consumer

Remote peer update arrives
  ↓ if syncing: queue in contentTobeAppliedQueue
  ↓ if ready:   decrypt → Y.applyUpdate(ydoc, update, 'remote')
                       → onLocalUpdate(fullState, chunk)

After 100 uncommitted updates (owner only)
  ↓ Y.encodeStateAsUpdate(ydoc) → encrypt → upload to IPFS → commit
```

---

---

## Comparison

| Concern | dsheet | ddoc |
|---|---|---|
| **Top-level structure** | `Y.Array<Y.Map>` (sheets) | `Y.XmlFragment` (ProseMirror) + `Y.Map` (tab metadata) |
| **Write path** | Manual `.set()` / `.delete()` inside `ydoc.transact()` | ProseMirror ops via y-prosemirror (content); manual `Y.Map.set()` (metadata) |
| **Merge strategy** | `encodeStateVector` diff — only net-new bytes applied | `Y.mergeUpdates([...])` — all sources merged at once |
| **Remote apply origin** | Not tagged | Tagged `'self'` (local/sync) or `'remote'` (peer) |
| **Feedback loop guard** | `transaction.local` check in observer | `origin === 'self'` check in `ydoc.on('update')` |
| **IDB sync** | Event-based (`persistence.once('synced', ...)`) | Promise-based (`await provider.whenSynced`) |
| **Transport** | IndexedDB only (no real-time collab) | Socket.IO + IPFS commit snapshots |
| **Outgoing batching** | None (transact handles it locally) | 50ms timer + `MAX_QUEUE_SIZE=5` queue |
| **Persistence callback** | `portalContent` prop passed from parent | `onChange(fullState, chunk)` — two args, debounced 300ms |
| **Commit/snapshot** | No concept | IPFS snapshot every 100 uncommitted updates (owner only) |
| **Tab structure** | `status`/`order` fields on sheet Y.Map | Dedicated `Y.Map` nodes; `mergeTabAwareYjsUpdates` for loss-free merge |
| **Delta extraction** | `encodeStateAsUpdate(targetDoc, sv)` at portal apply time | `encodeStateAsUpdate(ydoc, beforeSV)` at mutation time (comment store) |

### Key Insight

dsheet uses a **pull model**: the parent sends a full state blob (`portalContent`) and dsheet diffs against its own state vector to apply only what's new. There's no real-time socket — updates flow in through a React prop.

ddoc uses a **push model**: the `SyncManager` holds a persistent socket connection, encrypts and ships incremental updates in near-real-time (50ms batch), and periodically compacts history into IPFS snapshots to bound the uncommitted-update chain length.

Both converge on the same Yjs guarantee: operations are commutative and idempotent — applying the same update twice or in different orders always produces the same final state.
