# Spec: `appType` identifier for shared collaboration

**Status:** Design approved 2026-06-04. Server side implemented on `collaboration-server@feat/app-type-identifier`. This document is the implementation spec for the **dsheet client** change, and records the server contract it relies on.

**Related:** [`RTC_FLOW.md`](./RTC_FLOW.md) — end-to-end RTC flow for dsheet.

---

## 1. Problem

ddoc and dsheet share one collaboration server (custom Socket.IO + Yjs, MongoDB storage). Today every session/update/commit is keyed only by `documentId` (a UUID) and `sessionDid` (a DID derived from the room key). The two apps are **indistinguishable** in storage and on the wire — both send identical-shaped `/auth`, `/documents/update`, `/documents/commit` payloads.

We want to differentiate them, for three reasons (in priority order):

1. **Isolation guard** — reject a client of one app that tries to join/load the other app's room.
2. **Observability** — know which app a session/connection belongs to (logs, dashboards).
3. **Data lifecycle** — query / export / purge one app's updates & commits independently.

## 2. Decision (Approach A)

Add an optional identifier **`appType: 'ddoc' | 'dsheet'`**, declared **once** by the client at `/auth`. The **server is authoritative**: it stores `appType` on the session and **stamps it onto every update and commit** it persists. The client never re-sends it per event.

- `appType` is a **document-level** property — all sessions/updates/commits for a given `documentId` share one value.
- **Missing ⇒ `'ddoc'`** (legacy). Every row in Mongo today is ddoc and dsheet is unreleased, so this default is already correct.
- Naming chosen deliberately: field `appType`, values `'ddoc' | 'dsheet'` (singular — matches the repo/package names and the existing `dsheet-` IndexedDB key prefix).

See the **Decision log** (§7) for why Approach A over per-event tagging or documentId-prefixing.

## 3. Server contract (implemented — for reference)

What the dsheet client must satisfy / can rely on:

- **`/auth` accepts an optional `appType` field** in its args.
  - **New (owner) session:** server records `appType` (default `'ddoc'`) on the `Session`.
  - **Joining an existing session:** the server compares the client's declared `appType` (missing ⇒ `'ddoc'`) against the document's stored `appType` (missing ⇒ `'ddoc'`). On mismatch it rejects with:
    ```
    { status: false, statusCode: 403, error: "App type mismatch for this document", errorCode: "APP_MISMATCH" }
    ```
- **Stamping:** the server stamps the connection's resolved `appType` onto every `DocumentUpdate` and `DocumentCommit` it writes — the client does **not** send it on update/commit/awareness.
- **Storage:** `appType` added to the `Session`, `DocumentUpdate`, and `DocumentCommit` collections (enum `['ddoc','dsheet']`, default `'ddoc'`); `DocumentUpdate` and `DocumentCommit` are indexed on `{ appType, createdAt }` for lifecycle/analytics queries.
- **Backward compatible:** any client that omits `appType` (current ddoc production, legacy raw-WebSocket clients) is treated as `'ddoc'`.

**Server files changed** (`collaboration-server`): `src/types/index.ts` (field + `AppType` + `APP_MISMATCH`), `src/database/models/{session,document-update,document-commit}.ts`, `src/services/auth-middleware.ts`, `src/services/session-manager.ts`, `src/services/mongodb-store.ts`, `src/services/socket-handlers.ts`, plus `src/scripts/backfill-apptype.ts` and tests.

## 4. dsheet client changes (to implement)

Repo: `fileverse-dsheet` (branch `maitra/rtc-2` or successor). The change is intentionally tiny — `appType` is intrinsic to the editor, so it's a hardcoded constant, **not** consumer config.

### 4.1 Types — `src/sync-local/types/index.ts`

- Add an `AppType` and use it on the auth args (`IAuthArgs`, ~line 200):
  ```ts
  export type AppType = 'ddoc' | 'dsheet';

  export interface IAuthArgs {
    collaborationToken: string;
    documentId: string;
    ownerToken?: string;
    ownerAddress?: string;
    contractAddress?: string;
    sessionDid?: string;
    roomInfo?: string;
    appType?: AppType; // NEW
  }
  ```
- Mirror the new server error in `ServerErrorCode` (~line 125):
  ```ts
  APP_MISMATCH = 'APP_MISMATCH',
  ```

### 4.2 Send `appType` at `/auth` — `src/sync-local/socketClient.ts`

In `_handleHandShake` (~line 321) include the constant in the auth args. Add a module-level constant near the top of the file:

```ts
const APP_TYPE = 'dsheet' as const;
```

```ts
const args: IAuthArgs = {
  collaborationToken: token,
  sessionDid: this.collaborationKeyPair?.did(),
  documentId: this.roomId,
  appType: APP_TYPE, // NEW
};
```

**No other change.** The `sendUpdate`, `commitUpdates`, and `broadcastAwareness` paths stay exactly as they are — the server stamps `appType` from the session.

### 4.3 (Optional) Friendlier `APP_MISMATCH` handling

The existing non-200 branch in `_handleHandShake` (~line 346) already surfaces a rejected handshake through `config.onHandShakeError`. Optionally special-case `response.errorCode === 'APP_MISMATCH'` to show a clearer message (e.g. "This link belongs to a different Fileverse app") instead of the generic error.

### 4.4 ddoc client — not in this change

The ddoc client need not change: the server defaults missing `appType` to `'ddoc'`, and the guard treats a non-declaring client as `'ddoc'` too. When convenient, mirror §4.2 in ddoc's `package/sync-local/socketClient.ts` with `APP_TYPE = 'ddoc'` for explicitness (cosmetic).

## 5. Rollout

Nothing is enforced as required, so ordering is low-risk:

1. Deploy the server (optional field + default + guard) — fully backward compatible; deployed ddoc clients keep working. **Operational note:** this adds `{ appType, createdAt }` indexes to the live, ddoc-populated `DocumentUpdate` and `DocumentCommit` collections. They are declared `{ background: true }`, so the build is non-blocking, but it is still an index build over production data — schedule/monitor accordingly.
2. Run the backfill: `tsx src/scripts/backfill-apptype.ts` — sets `appType: 'ddoc'` on existing rows missing it (safe; all current data is ddoc).
3. Ship the dsheet client (§4) sending `appType: 'dsheet'` — its first release.
4. *(Optional, low priority)* ship the ddoc client (§4.4) sending `appType: 'ddoc'`.

> Ongoing legacy raw-WebSocket writes are safe without any client change: that handler persists through the same Mongoose models (`createUpdate` / `createCommit` / `createSession`), so the `default: 'ddoc'` tags them automatically.

## 6. Testing

**dsheet client**
- Unit: `_handleHandShake` includes `appType: 'dsheet'` in the `/auth` args.
- E2E: a dsheet session creates a `Session` plus updates & commits tagged `'dsheet'` (verify in Mongo); ddoc collaboration continues unaffected; feeding a ddoc room into the dsheet client (or vice-versa) is rejected with `APP_MISMATCH`.

**Server** (implemented alongside the change, in `src/tests/services/`)
- New owner session stores the declared `appType` (defaults to `'ddoc'` when absent).
- Join with a matching `appType` succeeds; mismatch (including a non-declaring `ddoc`-defaulted client joining a `dsheet` document) is rejected with `APP_MISMATCH` / 403.
- `createUpdate` / `createCommit` receive the connection's `appType`.

## 7. Decision log

- **Approach A (auth-time tag, server stamps) over C (tag every event):** the isolation guard needs the app known at connect time (before joining the room); a single connection is always one app, so per-event tagging is pure redundancy; and A is actually *less* client code (only the `/auth` payload changes).
- **Naming `appType: 'ddoc' | 'dsheet'`** (singular) — matches `fileverse-ddoc` / `fileverse-dsheet` package names and the `dsheet-` IndexedDB prefix.
- **Missing ⇒ `'ddoc'`** — all current data is ddoc; dsheet is unreleased.
- **Guard: hard-reject on mismatch**, treating missing as `ddoc` on both sides so it's robust immediately. Can be relaxed to log-only if a transition period is desired.
- **Backfill: run it** — cheap and makes every row explicit, so queries are plain equality with no null-handling.

### Known limitation

The guard fires on the **join-existing-session** path. The **new-owner-session** path trusts the declared `appType` (it does not scan existing updates/commits for a conflicting app). Re-creating an existing ddoc document's session as dsheet therefore isn't blocked — but that requires the document's on-chain owner credentials, so it's not a cross-user isolation gap.
