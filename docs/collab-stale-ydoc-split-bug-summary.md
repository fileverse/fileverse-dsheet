# Collab share links stuck on loading skeleton — bug summary

**Status:** Fixed on `main` (both `fileverse-dsheet` and `dsheets.new`).

---

## Non-technical summary

When someone shared a live-collaboration link to a spreadsheet, the person opening the link would sometimes see the sheet's title load fine, but the actual spreadsheet grid never appeared — it just showed a loading skeleton forever. No error message, nothing to click, nothing to retry.

**Why it happened:** under a specific timing condition — starting a collaboration session right as an existing sheet's content was still loading — the app ended up tracking two separate, disconnected copies of the sheet internally. One copy kept the owner's real edits; the other, empty copy is what got sent to anyone who joined the session. Joiners received nothing, but nothing told them anything was wrong.

**Who was affected:** only sheets where the owner started a live-collaboration session while the sheet was still loading (e.g., right after opening it, especially on a slow connection). Brand-new sheets were never affected.

**What we fixed:**

1. Fixed the underlying bug so the app can no longer end up with two disconnected copies.
2. Added a safety check that refuses to start a session with a broken copy, instead of silently going ahead.
3. Added detection so that if a session is ever found to be broken, the person joining sees a clear error instead of an endless loading screen.
4. Fixed a couple of places where real errors were happening but getting silently swallowed before they reached the screen.
5. On the app side, the "Start Collaboration" button and automatic session resume now wait until the sheet has genuinely finished loading before they become available — closing the timing window that caused this in the first place.

**Already-affected sheets:** no manual fix or data recovery needed. The next time the owner opens the sheet (on the updated app) and starts or resumes a session, it self-heals automatically.

---

## Technical summary

### Symptom

Joiner opens a collab invite link (`/sheet/[dsheetId]/share#key=…`): socket auth succeeds, room title decrypts and renders, but the sheet grid never loads — indefinite skeleton, no error surfaced anywhere. Owner sees their own sheet normally (their content is local). Affected every joiner of an affected room, on every attempt.

### Root cause

`useSyncManager` builds its `SyncManager` once and never updates the `Y.Doc` it holds. Separately, `use-editor-sync.tsx`'s main effect destroyed and recreated the `Y.Doc` whenever `enableIndexeddbSync` flipped true — which happens for an **existing** sheet the moment its content arrives after first render. When that happened while a collaboration session was active, `SyncManager` was left bound to the old, destroyed, empty doc, while the live editor (and local edits) moved to a new doc. The session's initial "here's the sheet" broadcast ended up being an empty 2-byte update instead of real content; any real edits made afterward referenced history that was never uploaded. Joiners received either a completely empty document or one with unintegratable dangling changes — either way, permanently stuck.

This only triggered when: the sheet already existed (not new), its content arrived after first paint (e.g. slower network), and collaboration was started before or during that arrival — a race condition, which is why it looked random and correlated with slow loads.

### Fix

1. **Root fix** — split the doc-lifecycle effect from the IndexedDB-persistence effect in `use-editor-sync.tsx`. The document instance is now only created/destroyed on sheet switch, never on sync-status changes — so `SyncManager` can never end up bound to a stale doc again.
2. **Defense-in-depth** — `SyncManager.connect()`/`handleReconnection()` now refuse to broadcast from a destroyed doc, throwing loudly instead of silently seeding an empty session.
3. **Detection** — after syncing history, `SyncManager` checks whether the merged document is unexpectedly empty or has unintegrated dangling updates despite the server reporting history existed, and raises a dedicated error instead of declaring sync complete.
4. **Error surfacing** — fixed a race where a genuine connection error was immediately overwritten by an unrelated internal reset before the UI could render it, and fixed the handshake timeout so a stalled server handshake can no longer hang the connection state forever with no error.
5. **UX gate (app side)** — the "Start Collaboration" control and automatic session resume now require a real, package-confirmed sync-complete signal, not just "we have content to hand to the editor" — closing the same timing window from the UI side as well.

### Recovery for already-affected sessions

No data migration or manual repair needed. The fix is self-healing: the next time the affected sheet's owner opens it on an updated client and (re)starts or resumes the session, the app broadcasts a genuine full-state update into the same session, and any previously-stranded changes integrate automatically. Every invite link for that session then starts working.
