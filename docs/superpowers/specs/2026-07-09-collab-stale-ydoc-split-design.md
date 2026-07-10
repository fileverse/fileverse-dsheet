# Design: Fix collab stale-Y.Doc split (share links stuck on loading skeleton)

**Date:** 2026-07-09
**RCA:** see conversation / `sheets.fileverse.io` case study `ayTRRkn6KV1tcC6pYyvW1M`
**Repos touched:** `fileverse-dsheet` (package, Fixes 1-4 + small Fix 5 hook), `dsheets.new` (app, Fix 5 gating).
**Scope:** five fixes — code-level root fix + defenses in the package, plus a UX-level gate in the app. Forced-heal maintenance script explicitly out of scope — poisoned rooms recover organically when their owner revisits on a fixed client.

---

## Problem recap

`useSyncManager` constructs `SyncManager` once and never updates its bound `Y.Doc` (`updateRefs` skips it). `use-editor-sync.tsx`'s main effect destroys/recreates the doc when `enableIndexeddbSync` flips (existing-sheet content arriving after first render), while collab-active rooms suppress the remount that would otherwise fix the binding. Result: `SyncManager` broadcasts/reads a stale, empty doc while the real editor doc gets local edits — joiners receive an unintegratable or empty room, stuck on skeleton, no error surfaced anywhere.

---

## Fix 1 — Kill the split (root fix)

**File:** `src/editor/hooks/use-editor-sync.tsx`

Split the current single effect (deps `[dsheetId, enableIndexeddbSync, isReadOnly]`, lines 109-147) into two:

- **Doc-lifecycle effect** — deps `[dsheetId]` only. Owns `ydocRef.current` create/destroy. Fires on sheet switch or unmount, never on `enableIndexeddbSync`/`isReadOnly` changes.
- **Persistence effect** — deps `[enableIndexeddbSync, isReadOnly]`. Attaches/detaches `IndexeddbPersistence` on the existing doc (calls `initialiseEditorIndexedDB` / destroys `persistenceRef.current`). Never touches `ydocRef`.

The collab-connect-on-synced logic currently living inside `persistenceRef.current.once('synced', ...)` moves with the persistence effect; behavior unchanged, just no longer coupled to doc recreation.

Host apps that key the editor component on `dsheetId` (e.g. `dsheets.new`'s `key={dsheetId}-...}`) already remount on sheet switch, so the `[dsheetId]` dep on doc-lifecycle is a no-op there — it exists for other/future consumers of the package that might not remount.

---

## Fix 2 — Refuse to broadcast from a destroyed doc (defense-in-depth)

**File:** `src/sync-local/SyncManager.ts`, `connect()` (~line 174) and `handleReconnection()` (~line 407)

Before the initial `Y.encodeStateAsUpdate(this.ydoc)` broadcast, guard:

```
if (this.ydoc.isDestroyed) {
  throw new Error('SyncManager: refusing to connect with a destroyed Y.Doc');
}
```

Caught by the existing `connect()`/`handleReconnection()` try/catch, which routes to `handleConnectionError` → surfaces via Fix 4's error path instead of silently broadcasting a 2-byte empty state. Makes this whole bug class fail loud if any future code path reintroduces a stale-doc handoff.

---

## Fix 3 — Detect poisoned rooms at the joiner

**File:** `src/sync-local/SyncManager.ts`, `syncLatestCommit()` (~line 555)

After merging and applying history (`Y.applyUpdate(this.ydoc, mergedState, 'self')`, ~line 628), add a post-merge health check, only when the server actually claimed history existed (`history?.data` present or `encryptedUpdates.length > 0` — i.e. don't flag a legitimately brand-new empty sheet):

- `this.ydoc.store.pendingStructs !== null` → dangling deltas referencing a missing base (the case-study room's exact signature).
- Server claimed content but doc has zero top-level keys after merge (`this.ydoc.share.size === 0`) → complete-but-empty era (the two other confirmed cases).

On either: don't transition to `SYNC_COMPLETE`. Instead raise a new `CollabErrorCode` (e.g. `POISONED_ROOM`) through the existing error path (`handleConnectionError`-equivalent / direct `send({type:'ERROR', ...})`), non-recoverable. Add the code to `CollabErrorCode` in `types.ts` and a friendly message branch in `dsheets.new`'s `use-collab-sheet.ts` `sessionError` memo (something like "This session had a sync problem — ask the sheet owner to reopen it.").

This is observability + fail-loud, not a fix — it turns an invisible infinite skeleton into a visible, reported error, and gives a count of how many existing rooms are still poisoned post-deploy.

---

## Fix 4 — Surface errors that currently get swallowed

**File:** `src/sync-local/SyncManager.ts`, `src/sync-local/socketClient.ts`

Two independent gaps:

**a) ERROR gets clobbered by a stray RESET.** `handleConnectionError` (~line 370) calls `socketClient.disconnect()` before sending `ERROR`. `socketClient.disconnect()` synchronously fires the socket's `'disconnect'` event → `SyncManager.disconnect()` (async) → deferred (via `await`) call to `disconnectInternal()` → `send({type:'RESET'})`. That RESET is a *valid* transition from `error` (intentional, for retry flows) — but it fires on the next microtask, and consumer-facing `collabState` is a live `useMemo`, so the error state gets overwritten before React ever paints it. The `onError` callback itself does fire correctly (confirmed: these errors are reported today) — only the **UI state** is lost.

  Fix: `disconnectInternal()` should not send `RESET` if the current status is already a terminal state reached via an explicit error/termination path in the same call chain (i.e., don't auto-RESET out of `error` as a side effect of cleanup — RESET-from-error should only happen from an explicit user-initiated retry, not from `handleConnectionError`'s own teardown). Concretely: have `handleConnectionError` perform socket teardown without routing back through the public `disconnect()`/`disconnectInternal()` path (which is what triggers the auto-RESET), so the `error` state set by `send({type:'ERROR', ...})` is the last word.

**b) Handshake can hang forever.** `socketClient.ts`'s 30s `connectionTimeout` (~line 420) is cleared on the raw `'connect'` (transport-level) event, not on handshake completion. If the transport connects but the server never emits `/server/handshake`, nothing times out — `SyncManager.connect()` awaits `onHandshakeSuccess` indefinitely, status sits at `connecting` silently.

  Fix: only clear `connectionTimeout` inside `_handleHandShake` (success and `onHandShakeError` branches), not in the raw `'connect'` handler. Keeps the 30s window covering the full connect→handshake sequence instead of just the transport leg.

`hasCollabContentInitialised` wiring (RCA's 4th sub-item) is already correctly passed at `editor-context.tsx:368` on current `main` — no work needed there, dropped from this plan.

---

## Fix 5 — Gate "Start Collaboration" on real content-sync completion (UX-level)

**Files:** `fileverse-dsheet` (`src/editor/dsheet-editor.tsx`, `src/editor/types.ts`), `dsheets.new` (`components/dsheet-editor/dsheet-editor.tsx`, `components/providers/rtc-provider.tsx`)

Belt-and-suspenders on top of Fix 1: even with the split killed, don't let the UI offer collaboration before the package confirms local content is actually synced.

Current gate (`isSheetReadyForCollab`, [dsheet-editor.tsx:317-319](dsheets.new/components/dsheet-editor/dsheet-editor.tsx#L317-L319)) only checks the app's own `DsheetLoadState.READY` — which flips true the instant on-chain/local content resolves. That's the *same* instant `enableIndexeddbSync` latches true in the package (`dsheet-editor.tsx:491-492`) — i.e. today the button unlocks right as the sync race window opens, not after it closes. The app has no visibility into the package's internal `syncStatus` (IndexedDB persistence completion) today — it's package-internal state, never exposed.

**Package side:** add an optional callback prop, e.g. `onContentSyncStatusChange?: (status: 'initializing' | 'syncing' | 'synced' | 'error') => void`, fired from `EditorContent` (`src/editor/dsheet-editor.tsx`) whenever `syncStatus` (already in `editor-context`) changes.

**App side:** `dsheet-editor.tsx` wires the callback into local state (`contentSyncStatus`), then tightens the gate:

```
const isSheetReadyForCollab =
  (loadState === DsheetLoadState.READY || loadState === DsheetLoadState.READY_NO_AUTH) &&
  contentSyncStatus === 'synced';
```

No new UI needed — `sheetReadyForCollaboration` already drives both the Start-button `disabled` state ([collaboration-popup.tsx:71-74](dsheets.new/components/collaboration-popup/collaboration-popup.tsx#L71-L74)) and the auto-resume-on-mount effect ([rtc-provider.tsx:565](dsheets.new/components/providers/rtc-provider.tsx#L565)). Tightening the one upstream signal fixes both consumers. Optional: adjust the tooltip copy at collaboration-popup.tsx to distinguish "loading sheet content…" from the existing "checking existing collaboration" message, so the disabled state reads accurately.

This fully subsumes RCA's original fix #5 ("gate collab resume on hydration") — same mechanism now covers manual start too, not just resume.

---

## Non-goals

- **No forced-heal maintenance script.** Poisoned rooms recover organically: next time the owner (or any device with full local history) opens the sheet on a client running the fixed bundle and (re)connects collab, `connect()` broadcasts genuine full state into the same room era; Yjs's pending-struct mechanism integrates any dangling deltas automatically. No server or data migration involved. Operator plan: after this ships, ask the owner(s) of known-affected sheets to revisit and restart their session.
- No changes to `collaboration-server` (relay) — confirmed not at fault, stores/forwards data as received.

---

## Testing

- No existing test runner in `fileverse-dsheet` (`package.json` has no `test` script, no vitest/jest config) — adding one is out of scope here unless the implementation plan decides a unit test for Fix 1/2 is cheap enough to justify introducing minimal test infra.
- Primary verification: manual repro (Recipe A from the RCA — throttled network, existing sheet, start collab before content settles, join from fresh incognito) before and after the fix, on local dev pointed at the existing dev relay (`wss://dev-collaboration-server-ff60826701cd.herokuapp.com`).
- Fix 2 and Fix 3 are independently observable: force a stale doc / truncate the mocked history in a manual test and confirm the guard throws / the error surfaces instead of silently proceeding.
- Fix 5: confirm the Start-Collaboration button/tooltip stays disabled through `syncing`, only enables after `contentSyncStatus === 'synced'` — throttle network to widen the window and observe.
